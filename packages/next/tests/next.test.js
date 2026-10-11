// @voult/next against the SDK's fake Voult. Route handlers are called directly with Fetch
// Requests; next/headers and next/navigation are stubbed to play a Server Component (cookies
// read-only) or a route handler (cookies writable). The middleware runs on real NextRequests.
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { sign } from '@voult/core';
import { startTestServer } from '../../voult-sdk/tests/support/test-server.js';

const nextHeaders = vi.hoisted(() => ({ headers: vi.fn(), cookies: vi.fn() }));
vi.mock('next/headers', () => nextHeaders);
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url) => { throw Object.assign(new Error('NEXT_REDIRECT'), { url }); }),
}));

const { createVoultRouteHandlers, getSession, requireSession } = await import('../src/index.js');
const { voultMiddleware } = await import('../src/middleware.js');

const SECRET = 'next-test-session-secret';
let fake;
let options;
beforeEach(async () => {
  fake = await startTestServer();
  options = { config: { clientId: 'client-id', clientSecret: 'client-secret', baseURL: fake.baseURL, sessionSecret: SECRET } };
});
afterEach(() => fake.server.close());

const signed = async (value) => encodeURIComponent(`s:${await sign(value, SECRET)}`);
const cookieHeader = (res) => res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');

/** Play a request: its Cookie header, and whether the context may write cookies. */
function asRequest(cookie, { writable = false, path } = {}) {
  const written = [];
  nextHeaders.headers.mockResolvedValue(new Headers({ ...(cookie && { cookie }), ...(path && { 'x-voult-path': path }) }));
  nextHeaders.cookies.mockResolvedValue({
    set: (name, value, opts) => {
      if (!writable) throw new Error('Cookies can only be modified in a Server Action or Route Handler.');
      if (name !== 'voult_probe') written.push({ name, value, opts });
    },
  });
  return written;
}

async function signIn() {
  const { POST } = createVoultRouteHandlers(options);
  const res = await POST(new Request('http://app.test/api/auth/email-login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'user@example.com', password: 'StrongPass123!' }),
  }));
  expect(res.status).toBe(200);
  return cookieHeader(res);
}

/** Cookies an hour later: the access token is dead, the refresh and user cookies remain. */
async function expiredSession(refresh = 'refresh-1') {
  const user = JSON.stringify({ id: 'u1', email: 'user@example.com' });
  return `voult_access=${await signed('expired-token')}; voult_refresh=${await signed(refresh)}; voult_user=${await signed(user)}`;
}

describe('createVoultRouteHandlers (C3)', () => {
  it('serves the router: sign-in sets cookies, then /session reads them', async () => {
    const cookie = await signIn();
    const { GET } = createVoultRouteHandlers(options);
    const res = await GET(new Request('http://app.test/api/auth/session', { headers: { cookie } }));
    expect(await res.json()).toMatchObject({ authenticated: true, user: { email: 'user@example.com' } });
  });

  it('serves the Step 4 routes too, under a custom basePath', async () => {
    const { GET } = createVoultRouteHandlers({ ...options, basePath: '/auth' });
    const res = await GET(new Request('http://app.test/auth/sessions'));
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('AUTHENTICATION_ERROR');
  });

  it('missing config is a JSON 500 with the setup message, not a crash at build time', async () => {
    const { GET } = createVoultRouteHandlers({ env: {} }); // creating it reads no env
    const res = await GET(new Request('http://app.test/api/auth/session'));
    expect(res.status).toBe(500);
    expect((await res.json()).error.message).toMatch(/VOULT_CLIENT_ID/);
  });
});

describe('getSession (C4)', () => {
  it('signed in: the user, confirmed by Voult', async () => {
    asRequest(await signIn());
    expect(await getSession(options)).toEqual({ user: expect.objectContaining({ email: 'user@example.com' }), verified: true });
  });

  it('signed out: null', async () => {
    asRequest(undefined);
    expect(await getSession(options)).toBeNull();
  });

  it('Server Component with an expired access token: cookie user, unverified, and NO refresh (it would rotate unsaved)', async () => {
    asRequest(await expiredSession());
    expect(await getSession(options)).toEqual({ user: { id: 'u1', email: 'user@example.com' }, verified: false });
    expect(fake.state.refreshCount).toBe(0);
  });

  it('route handler with an expired access token: renews and writes the new cookies', async () => {
    const written = asRequest(await expiredSession(), { writable: true });
    const session = await getSession(options);
    expect(session).toMatchObject({ verified: true, user: { email: 'user@example.com' } });
    expect(fake.state.refreshCount).toBe(1);
    const access = written.find((c) => c.name === 'voult_access');
    expect(access.value).toBe(`s:${await sign('access-2', SECRET)}`);
    expect(access.opts).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/', maxAge: 3600 });
  });

  it('route handler with a dead refresh token: null, and the session cookies are cleared', async () => {
    const written = asRequest(await expiredSession('revoked-token'), { writable: true });
    expect(await getSession(options)).toBeNull();
    expect(written.map((c) => c.name)).toEqual(['voult_access', 'voult_refresh', 'voult_user']);
    expect(written.every((c) => c.opts.expires.getTime() === 1)).toBe(true);
  });
});

describe('requireSession (C4)', () => {
  it('returns a verified session', async () => {
    asRequest(await signIn());
    expect((await requireSession(options)).verified).toBe(true);
  });

  it('signed out → the sign-in page, with returnTo from the middleware', async () => {
    asRequest(undefined, { path: '/account?tab=security' });
    await expect(requireSession(options)).rejects.toMatchObject({ url: '/login?returnTo=%2Faccount%3Ftab%3Dsecurity' });
  });

  it('expired in a Server Component → /session/renew, which renews and comes back', async () => {
    asRequest(await expiredSession(), { path: '/account' });
    await expect(requireSession(options)).rejects.toMatchObject({ url: '/api/auth/session/renew?returnTo=%2Faccount' });

    const { GET } = createVoultRouteHandlers(options);
    const renew = await GET(new Request('http://app.test/api/auth/session/renew?returnTo=/account', { headers: { cookie: await expiredSession() } }));
    expect(renew.status).toBe(302);
    expect(renew.headers.get('location')).toBe('/account');
    expect(renew.headers.getSetCookie().join(';')).toMatch(/voult_access=s%3Aaccess-2/);
  });

  it('ignores an unsafe returnTo', async () => {
    asRequest(undefined, { path: '//evil.example' });
    await expect(requireSession({ ...options, signInPath: '/signin' })).rejects.toMatchObject({ url: '/signin' });
  });
});

describe('voultMiddleware (C5)', () => {
  const run = (path, cookie, opts = {}) => voultMiddleware({ publicPaths: ['/', '/blog/*'], sessionSecret: SECRET, ...opts })(
    new NextRequest(`http://app.test${path}`, { headers: cookie ? { cookie } : {} })
  );
  const passed = (res) => res.headers.get('x-middleware-next') === '1';

  it('lets a correctly signed session cookie through and records the path', async () => {
    const res = await run('/account?tab=1', `voult_refresh=${await signed('refresh-1')}`);
    expect(passed(res)).toBe(true);
    expect(res.headers.get('x-middleware-request-x-voult-path')).toBe('/account?tab=1');
  });

  it.each([
    ['no cookie', undefined],
    ['an unsigned cookie', 'voult_access=access-1'],
    ['a cookie signed with another secret', 'voult_access=s%3Aaccess-1.forged'],
  ])('redirects with %s to the sign-in page', async (_, cookie) => {
    const res = await run('/account', cookie);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://app.test/login?returnTo=%2Faccount');
  });

  it.each(['/', '/blog', '/blog/post-1', '/login', '/api/auth/session', '/_next/static/x.js'])('%s is public', async (path) => {
    expect(passed(await run(path))).toBe(true);
  });

  it('without a session secret (development), any session cookie counts: cookies are not signed then', async () => {
    expect(passed(await run('/account', 'voult_access=access-1', { sessionSecret: '' }))).toBe(true);
  });

  it('imports nothing that cannot run on the Edge (no @voult/sdk, no Node built-ins)', () => {
    const source = readFileSync(new URL('../src/middleware.js', import.meta.url), 'utf8');
    const imports = [...source.matchAll(/^import .* from\s*['"]([^'"]+)['"]/gm)].map(([, name]) => name);
    expect(imports).toEqual(['next/server', '@voult/core/cookies']);
    const cookies = readFileSync(new URL('../../core/src/cookies.js', import.meta.url), 'utf8');
    expect(cookies).not.toMatch(/\bfrom\s*['"]/);
  });
});
