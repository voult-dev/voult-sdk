import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { after, before, describe, test } from 'node:test';
import signature from 'cookie-signature';
import { createVoultHandler, readCookieHeader, resolveConfig, serializeCookie, sign, unsign } from '../src/index.js';
import { startTestServer } from '../../voult-sdk/tests/support/test-server.js';

const SECRET = 'session-secret';

describe('runs anywhere the Fetch API does', () => {
  test('src imports no framework and no Node-only module', () => {
    const dir = new URL('../src/', import.meta.url);
    for (const file of readdirSync(dir)) {
      const source = readFileSync(new URL(file, dir), 'utf8');
      const imports = [...source.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map(([, name]) => name);
      for (const name of imports) {
        assert.ok(name.startsWith('./') || name === '@voult/sdk', `${file} imports ${name}`);
      }
      assert.doesNotMatch(source, /\brequire\(|\bBuffer\.|(?<!globalThis\.)\bprocess\.\w/, file);
    }
  });
});

describe('cookies match Express + cookie-parser byte for byte', () => {
  test('sign() equals cookie-signature', async () => {
    for (const value of ['access-1', '', '{"email":"ü@example.com"}']) {
      assert.equal(await sign(value, SECRET), signature.sign(value, SECRET));
    }
  });

  test('unsign() accepts cookie-signature output and rejects tampering', async () => {
    const signed = signature.sign('refresh-1', SECRET);
    assert.equal(await unsign(signed, SECRET), 'refresh-1');
    assert.equal(await unsign(signed.replace('refresh-1', 'refresh-2'), SECRET), false);
    assert.equal(await unsign(signed, 'other-secret'), false);
  });

  test('readCookieHeader() splits signed and plain cookies like cookie-parser', async () => {
    const good = encodeURIComponent(`s:${signature.sign('access-1', SECRET)}`);
    const bad = encodeURIComponent(`s:${signature.sign('access-1', 'wrong')}`);
    const { cookies, signedCookies } = await readCookieHeader(`voult_access=${good}; voult_user=${bad}; demo=ok; demo=second`, SECRET);
    assert.deepEqual({ ...signedCookies }, { voult_access: 'access-1', voult_user: false });
    assert.deepEqual({ ...cookies }, { demo: 'ok' });
  });

  test('serializeCookie() matches res.cookie() / res.clearCookie()', () => {
    const options = { httpOnly: true, sameSite: 'lax', path: '/' };
    assert.equal(
      serializeCookie('voult_access', 's:a.b', { ...options, expires: new Date(1) }),
      'voult_access=s%3Aa.b; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax'
    );
    assert.match(
      serializeCookie('voult_refresh', 'r', { ...options, secure: true, maxAge: 3600_000 }),
      /^voult_refresh=r; Max-Age=3600; Path=\/; Expires=[^;]+ GMT; HttpOnly; Secure; SameSite=Lax$/
    );
  });
});

describe('handle(Request) → Response', () => {
  let fake;
  let handle;
  before(async () => {
    fake = await startTestServer();
    handle = createVoultHandler(resolveConfig({
      config: { clientId: 'client-id', clientSecret: 'client-secret', baseURL: fake.baseURL, sessionSecret: SECRET },
    }));
  });
  after(() => fake.server.close());

  const call = (path, init) => handle(new Request(`http://app.test${path}`, init), { basePath: '/api/auth' });
  const cookieJar = (response) => response.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');

  test('serves the session route below basePath', async () => {
    const res = await call('/api/auth/session');
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { authenticated: false, user: null });
  });

  test('unknown paths get the notFound answer (404 JSON, or null for adapters that fall through)', async () => {
    assert.equal((await call('/api/auth/nope')).status, 404);
    assert.equal((await call('/elsewhere/session')).status, 404);
    assert.equal(await handle(new Request('http://app.test/api/auth/nope'), { basePath: '/api/auth', notFound: () => null }), null);
  });

  test('sign-in sets signed httpOnly cookies that cookie-signature accepts, and the next request is signed in', async () => {
    const login = await call('/api/auth/email-login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com', password: 'StrongPass123!' }),
    });
    assert.equal(login.status, 200);
    assert.equal((await login.json()).accessToken, undefined);

    const access = login.headers.getSetCookie().find((c) => c.startsWith('voult_access='));
    assert.match(access, /HttpOnly; SameSite=Lax/);
    const value = decodeURIComponent(access.split(';')[0].slice('voult_access='.length));
    assert.equal(signature.unsign(value.slice(2), SECRET), 'access-1');

    const me = await call('/api/auth/user/me', { headers: { cookie: cookieJar(login) } });
    assert.equal(me.status, 200);
    assert.equal((await me.json()).user.email, 'user@example.com');
  });

  test('a cookie signed with another secret is not a session', async () => {
    const forged = encodeURIComponent(`s:${signature.sign('access-1', 'attacker')}`);
    const res = await call('/api/auth/user/me', { headers: { cookie: `voult_access=${forged}` } });
    assert.equal(res.status, 401);
    assert.equal((await res.json()).error.code, 'AUTHENTICATION_ERROR');
  });

  test('invalid JSON is a 400, not a crash', async () => {
    const res = await call('/api/auth/email-login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{nope' });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error.code, 'INVALID_JSON');
  });

  test('OAuth start builds the callback URL from the request URL and basePath', async () => {
    const res = await call('/api/auth/oauth/google/start');
    assert.equal(res.status, 302);
    const authorize = fake.state.requests.find((r) => r.path === '/api/oauth/google/authorize');
    assert.equal(authorize?.body.redirectUri, 'http://app.test/api/auth/oauth/callback');
    assert.match(res.headers.getSetCookie().join(';'), /voult_oauth=s%3A/);
  });
});
