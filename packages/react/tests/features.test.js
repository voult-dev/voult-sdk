// 0.2.0 helpers (useVoult().mfa, .sessions, .passkeys, …) against the real @voult/express router
// over HTTP, so a path or response-shape mismatch between the two fails here.
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { createElement as h } from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { VoultProvider, useSession, useVoult } from '../src/index.js';

const children = [];
afterEach(() => {
  cleanup();
  children.splice(0).forEach((child) => child.kill('SIGTERM'));
});

function startBff() {
  const child = spawn(process.execPath, [join(process.cwd(), 'tests/support/bff-server.mjs')], { stdio: ['ignore', 'pipe', 'inherit'] });
  children.push(child);
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.stdout.once('data', (chunk) => resolve(`http://127.0.0.1:${JSON.parse(String(chunk)).port}/api/auth`));
  });
}

function browserFetch() {
  const jar = new Map();
  return async (url, init = {}) => {
    const cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
    const res = await fetch(url, { ...init, headers: { ...init.headers, ...(cookie && { cookie }) } });
    for (const line of res.headers.getSetCookie()) {
      const [name, ...rest] = line.split(';')[0].split('=');
      if (!rest.join('=') || /expires=Thu, 01 Jan 1970/i.test(line)) jar.delete(name);
      else jar.set(name, rest.join('='));
    }
    return res;
  };
}

async function render() {
  const apiBase = await startBff();
  const wrapper = ({ children: kids }) => h(VoultProvider, { apiBase, fetch: browserFetch() }, kids);
  const { result } = renderHook(() => ({ session: useSession(), voult: useVoult() }), { wrapper });
  await waitFor(() => expect(result.current.session.status).toBe('unauthenticated'));
  return result;
}

it('account helpers: MFA setup, sessions, linked accounts, then revoking this session signs out', async () => {
  const result = await render();
  await act(() => result.current.voult.signIn({ email: 'user@example.com', password: 'StrongPass123!' }));

  const setup = await result.current.voult.mfa.setup();
  expect(setup.secret).toBe('SECRET123');
  expect((await result.current.voult.mfa.status()).mfaEnabled).toBe(true);

  const { sessions } = await result.current.voult.sessions.list();
  const current = sessions.find((s) => s.isCurrent);
  expect(current.id).toBe('session-1');
  expect(Array.isArray((await result.current.voult.linkedAccounts.list()).providers)).toBe(true);

  await act(async () => {
    expect((await result.current.voult.sessions.revoke(current.id)).current).toBe(true);
  });
  expect(result.current.session.status).toBe('unauthenticated');
});

it('passkey sign-in sets the session like signIn()', async () => {
  const result = await render();
  const { options } = await result.current.voult.passkeys.loginOptions();
  expect(options).toEqual({ challenge: 'xyz' });

  await act(async () => {
    expect(await result.current.voult.passkeys.signIn({ id: 'credential' })).toMatchObject({ mfaRequired: false });
  });
  expect(result.current.session.user.email).toBe('passkey@example.com');
});

it('magic link send, MFA cancel and deleteAccount', async () => {
  const result = await render();
  expect(await result.current.voult.magicLink.send('someone@example.com', { returnTo: '/account' })).toEqual({ sent: true });

  await act(() => result.current.voult.signIn({ email: 'mfa@example.com', password: 'StrongPass123!' }));
  expect(result.current.session.status).toBe('mfa_required');
  await act(() => result.current.voult.mfa.cancel());
  expect(result.current.session.status).toBe('unauthenticated');

  await act(() => result.current.voult.signIn({ email: 'user@example.com', password: 'StrongPass123!' }));
  expect(result.current.session.status).toBe('authenticated');
  await act(() => result.current.voult.deleteAccount());
  expect(result.current.session.status).toBe('unauthenticated');
});
