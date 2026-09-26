import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createElement as h } from 'react';
import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  OAuthButton,
  PASSWORD_REQUIREMENTS_MESSAGE,
  VoultProvider,
  VoultRequestError,
  getOAuthRedirectResult,
  isValidPassword,
  useOAuthProviders,
  useSession,
  useVoult,
} from '../src/index.js';

afterEach(cleanup);

/** In-memory stand-in for @voult/express. Records every request. */
function fakeBff({ mfaFor = [], providers = {}, logoutFails = false, down = false } = {}) {
  const state = { user: null, mfaPending: false, pendingToken: null, calls: [] };
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  const fetchImpl = async (url, init = {}) => {
    const path = url.replace(/^\/api\/auth/, '').replace(/^\/custom/, '');
    const body = init.body ? JSON.parse(init.body) : undefined;
    state.calls.push({ url, path, method: init.method ?? 'GET', body, credentials: init.credentials });
    if (down) throw new TypeError('Failed to fetch');

    switch (`${init.method ?? 'GET'} ${path}`) {
      case 'GET /session':
        return json(200, state.user
          ? { authenticated: true, user: state.user }
          : { authenticated: false, user: null, ...(state.mfaPending && { mfaPending: true }) });
      case 'POST /email-login':
      case 'POST /username-login': {
        const id = body.email ?? body.username;
        if (body.password !== 'Str0ng!Pass') return json(401, { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password', status: 401 } });
        if (mfaFor.includes(id)) {
          state.pendingToken = 'pending-password';
          return json(200, { mfaRequired: true, mfaPendingToken: 'pending-password' });
        }
        state.user = { id: 'u1', email: body.email, username: body.username };
        return json(200, { user: state.user });
      }
      case 'POST /register':
        state.user = { id: 'u2', email: body.email };
        return json(200, { user: state.user, emailVerificationRequired: true });
      case 'POST /mfa/verify': {
        const token = body.mfaPendingToken ?? (state.mfaPending ? 'pending-cookie' : null);
        if (!token || body.mfaToken !== '123456') return json(401, { error: { code: 'INVALID_MFA_TOKEN', message: 'Invalid code', status: 401 } });
        state.mfaPending = false;
        state.user = { id: 'u3', email: 'mfa@example.com' };
        return json(200, { user: state.user });
      }
      case 'POST /logout':
        state.user = null;
        return logoutFails
          ? json(500, { error: { code: 'INTERNAL_ERROR', message: 'Logout failed upstream', status: 500 } })
          : json(200, { success: true });
      case 'GET /oauth/providers':
        return json(200, { providers });
      default:
        return json(404, { error: { code: 'NOT_FOUND', message: path, status: 404 } });
    }
  };
  return { state, fetchImpl };
}

function renderVoult(bff, props = {}) {
  const wrapper = ({ children }) => h(VoultProvider, { fetch: bff.fetchImpl, ...props }, children);
  return renderHook(() => ({ session: useSession(), actions: useVoult() }), { wrapper });
}

describe('VoultProvider + useSession', () => {
  it('starts loading, then reports the signed-in user (cookies sent)', async () => {
    const bff = fakeBff();
    bff.state.user = { id: 'u1', email: 'me@example.com' };
    const { result } = renderVoult(bff);

    expect(result.current.session.status).toBe('loading');
    await waitFor(() => expect(result.current.session.status).toBe('authenticated'));
    expect(result.current.session.user.email).toBe('me@example.com');
    expect(result.current.session.isAuthenticated).toBe(true);
    expect(bff.state.calls[0]).toMatchObject({ url: '/api/auth/session', credentials: 'include' });
  });

  it('reports unauthenticated, and mfa_required while an OAuth sign-in waits for its code', async () => {
    const bff = fakeBff();
    const { result } = renderVoult(bff);
    await waitFor(() => expect(result.current.session.status).toBe('unauthenticated'));

    bff.state.mfaPending = true;
    await act(() => result.current.session.refresh());
    expect(result.current.session.status).toBe('mfa_required');
  });

  it('uses a custom apiBase', async () => {
    const bff = fakeBff();
    const { result } = renderVoult(bff, { apiBase: '/custom' });
    await waitFor(() => expect(result.current.session.status).toBe('unauthenticated'));
    expect(bff.state.calls[0].url).toBe('/custom/session');
  });

  it('treats an unreachable BFF as signed out and exposes the error', async () => {
    const { result } = renderVoult(fakeBff({ down: true }));
    await waitFor(() => expect(result.current.session.status).toBe('unauthenticated'));
    expect(result.current.session.error).toBeInstanceOf(TypeError);
  });

  it('hooks outside the provider fail with a clear message', () => {
    expect(() => renderHook(() => useSession())).toThrow(/inside <VoultProvider>/);
  });
});

describe('useVoult actions', () => {
  it('signIn (email) → authenticated', async () => {
    const bff = fakeBff();
    const { result } = renderVoult(bff);
    await waitFor(() => expect(result.current.session.status).toBe('unauthenticated'));

    let outcome;
    await act(async () => { outcome = await result.current.actions.signIn({ email: 'a@example.com', password: 'Str0ng!Pass' }); });
    expect(outcome).toEqual({ mfaRequired: false, user: { id: 'u1', email: 'a@example.com' } });
    expect(result.current.session.status).toBe('authenticated');
    expect(bff.state.calls.find((c) => c.path === '/email-login').body).toEqual({ email: 'a@example.com', password: 'Str0ng!Pass' });
  });

  it('signIn (username) uses /username-login', async () => {
    const bff = fakeBff();
    const { result } = renderVoult(bff);
    await act(() => result.current.actions.signIn({ username: 'ada', password: 'Str0ng!Pass' }));
    expect(bff.state.calls.some((c) => c.path === '/username-login')).toBe(true);
  });

  it('wrong password throws VoultRequestError and leaves the user signed out', async () => {
    const bff = fakeBff();
    const { result } = renderVoult(bff);
    await waitFor(() => expect(result.current.session.status).toBe('unauthenticated'));

    const error = await result.current.actions.signIn({ email: 'a@example.com', password: 'wrong' }).catch((e) => e);
    expect(error).toBeInstanceOf(VoultRequestError);
    expect(error).toMatchObject({ code: 'INVALID_CREDENTIALS', status: 401, message: 'Invalid email or password' });
    expect(result.current.session.status).toBe('unauthenticated');
  });

  it('password MFA: signIn → mfa_required → verifyMfa(code) sends the pending token', async () => {
    const bff = fakeBff({ mfaFor: ['mfa@example.com'] });
    const { result } = renderVoult(bff);
    await waitFor(() => expect(result.current.session.status).toBe('unauthenticated'));

    let outcome;
    await act(async () => { outcome = await result.current.actions.signIn({ email: 'mfa@example.com', password: 'Str0ng!Pass' }); });
    expect(outcome).toEqual({ mfaRequired: true });
    expect(result.current.session.status).toBe('mfa_required');

    await act(() => result.current.actions.verifyMfa('123456'));
    expect(bff.state.calls.find((c) => c.path === '/mfa/verify').body).toEqual({ mfaToken: '123456', mfaPendingToken: 'pending-password' });
    expect(result.current.session.status).toBe('authenticated');
  });

  it('OAuth MFA: verifyMfa(code) sends only the code (the pending token is in a cookie)', async () => {
    const bff = fakeBff();
    bff.state.mfaPending = true;
    const { result } = renderVoult(bff);
    await waitFor(() => expect(result.current.session.status).toBe('mfa_required'));

    await act(() => result.current.actions.verifyMfa('123456'));
    expect(bff.state.calls.find((c) => c.path === '/mfa/verify').body).toEqual({ mfaToken: '123456' });
    expect(result.current.session.status).toBe('authenticated');
  });

  it('signUp → session refreshed; response returned (e.g. emailVerificationRequired)', async () => {
    const bff = fakeBff();
    const { result } = renderVoult(bff);
    let data;
    await act(async () => { data = await result.current.actions.signUp({ email: 'new@example.com', password: 'Str0ng!Pass', fullName: 'New' }); });
    expect(data.emailVerificationRequired).toBe(true);
    expect(result.current.session.status).toBe('authenticated');
  });

  it('signOut → unauthenticated, and still signs out locally when Voult reports a failure', async () => {
    const bff = fakeBff({ logoutFails: true });
    bff.state.user = { id: 'u1', email: 'me@example.com' };
    const { result } = renderVoult(bff);
    await waitFor(() => expect(result.current.session.status).toBe('authenticated'));

    let error;
    await act(async () => {
      try {
        await result.current.actions.signOut();
      } catch (e) {
        error = e;
      }
    });
    expect(error).toMatchObject({ code: 'INTERNAL_ERROR', status: 500 });
    expect(result.current.session.status).toBe('unauthenticated');
  });

  it('never writes tokens to browser storage', async () => {
    const bff = fakeBff();
    const { result } = renderVoult(bff);
    await act(() => result.current.actions.signIn({ email: 'a@example.com', password: 'Str0ng!Pass' }));
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(document.cookie).toBe('');
  });
});

describe('OAuth', () => {
  it('OAuthButton is a real link to the BFF start route', () => {
    render(h(VoultProvider, { fetch: fakeBff().fetchImpl },
      h(OAuthButton, { provider: 'google', returnTo: '/account', className: 'btn' })));

    const link = screen.getByRole('link', { name: 'Continue with Google' });
    expect(link.getAttribute('href')).toBe('/api/auth/oauth/google/start?returnTo=%2Faccount');
    expect(link.className).toBe('btn');
  });

  it('OAuthButton supports intent, custom apiBase and custom content', () => {
    render(h(VoultProvider, { fetch: fakeBff().fetchImpl, apiBase: '/custom' },
      h(OAuthButton, { provider: 'github', intent: 'link' }, 'Connect GitHub')));

    expect(screen.getByRole('link', { name: 'Connect GitHub' }).getAttribute('href'))
      .toBe('/custom/oauth/github/start?intent=link');
  });

  it('useOAuthProviders lists only providers that are ready', async () => {
    const bff = fakeBff({ providers: { google: true, github: false, microsoft: true } });
    const wrapper = ({ children }) => h(VoultProvider, { fetch: bff.fetchImpl }, children);
    const { result } = renderHook(() => useOAuthProviders(), { wrapper });

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.providers).toEqual(['google', 'microsoft']);
  });

  it('getOAuthRedirectResult reads voult_error / voult_linked', () => {
    expect(getOAuthRedirectResult('?voult_error=access_denied&voult_error_description=User+cancelled'))
      .toEqual({ error: { code: 'access_denied', description: 'User cancelled' }, linked: null });
    expect(getOAuthRedirectResult('?voult_linked=github')).toEqual({ error: null, linked: 'github' });
    expect(getOAuthRedirectResult('')).toEqual({ error: null, linked: null });
  });
});

describe('package boundaries', () => {
  it('re-exports the password rules', () => {
    expect(isValidPassword('Str0ng!Pass')).toBe(true);
    expect(isValidPassword('weak')).toBe(false);
    expect(PASSWORD_REQUIREMENTS_MESSAGE).toMatch(/@\$!%\*\?&/);
  });

  it('source imports only react, local files and @voult/sdk/validation (no HTTP client in the bundle)', () => {
    // jsdom's import.meta.url isn't a file: URL; vitest runs from the package directory.
    const dir = join(process.cwd(), 'src');
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.js'))) {
      const source = readFileSync(join(dir, file), 'utf8');
      for (const [, spec] of source.matchAll(/from ['"]([^'"]+)['"]/g)) {
        expect(['react', '@voult/sdk/validation'].includes(spec) || spec.startsWith('./'), `${file}: ${spec}`).toBe(true);
      }
    }
  });
});
