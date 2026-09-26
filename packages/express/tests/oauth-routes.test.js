import { readFileSync, readdirSync } from 'node:fs';
import http from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createVoultRouter } from '../src/index.js';

const APP_URL = 'http://frontend.test';

/** A fake Voult API with just the hosted-OAuth endpoints; records every call. */
async function startFakeVoult() {
  const calls = [];
  const server = http.createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) : {};
    const path = new URL(req.url, 'http://x').pathname;
    calls.push({ method: req.method, path, body, headers: req.headers });

    const send = (status, payload) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(payload));
    };
    const fail = (status, code, message) => send(status, { error: { code, message, status } });

    const authorize = path.match(/^\/api\/oauth\/([^/]+)\/authorize$/);
    if (authorize) {
      if (authorize[1] === 'facebook') return fail(403, 'PROVIDER_NOT_ENABLED', 'OAuth provider is not enabled for this app');
      return send(200, { authUrl: `https://provider.test/${authorize[1]}?state=${encodeURIComponent(body.state)}`, provider: authorize[1], intent: body.intent });
    }
    const link = path.match(/^\/api\/oauth\/([^/]+)\/link$/);
    if (link) {
      if (!req.headers.authorization) return fail(401, 'UNAUTHORIZED', 'Authentication required');
      return send(200, { authUrl: `https://provider.test/${link[1]}/link?state=${encodeURIComponent(body.state)}`, intent: 'link' });
    }
    if (path === '/api/oauth/exchange') {
      if (body.code === 'otc_ok') {
        return send(200, { accessToken: 'access-oauth', refreshToken: 'refresh-oauth', user: { id: 'u1', email: 'oauth@example.com' } });
      }
      if (body.code === 'otc_mfa') {
        return send(200, { mfaRequired: true, mfaPendingToken: 'pending-from-oauth', message: 'MFA verification required' });
      }
      return fail(400, 'INVALID_OAUTH_CODE', 'OAuth exchange code is invalid or expired');
    }
    if (path === '/api/auth/mfa/verify') {
      if (body.mfaPendingToken !== 'pending-from-oauth') return fail(401, 'INVALID_MFA_TOKEN', 'bad pending token');
      return send(200, { accessToken: 'access-mfa', refreshToken: 'refresh-mfa', user: { id: 'u2', email: 'mfa@example.com' } });
    }
    if (path === '/api/apps/me') {
      return send(200, {
        providers: {
          google: { enabled: true, configured: true },
          github: { enabled: true, configured: false },
          facebook: { enabled: false, configured: true },
        },
      });
    }
    return fail(404, 'NOT_FOUND', path);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, calls, baseURL: `http://127.0.0.1:${server.address().port}` };
}

let fake;
afterEach(() => fake?.server.close());

async function mount({ strategy = 'cookie', appUrl = APP_URL, oauthCallbackUrl, oauth } = {}) {
  fake = await startFakeVoult();
  const app = express();
  app.use('/api/auth', createVoultRouter({
    config: {
      clientId: 'client-id',
      clientSecret: 'client-secret',
      baseURL: fake.baseURL,
      sessionSecret: 'session-secret-for-tests',
      appUrl,
      oauthCallbackUrl,
      session: { strategy },
    },
    oauth,
  }));
  return request.agent(app);
}

const exchanges = () => fake.calls.filter((c) => c.path === '/api/oauth/exchange');
const stateOf = (location) => new URL(location).searchParams.get('state');

async function start(agent, path = '/api/auth/oauth/google/start') {
  const res = await agent.get(path);
  expect(res.status).toBe(302);
  return res;
}

describe('GET /oauth/providers', () => {
  it('lists providers that are enabled and configured, cached between calls', async () => {
    const agent = await mount();
    const first = await agent.get('/api/auth/oauth/providers');
    await agent.get('/api/auth/oauth/providers');

    expect(first.body).toEqual({ providers: { google: true, github: false, facebook: false } });
    expect(fake.calls.filter((c) => c.path === '/api/apps/me')).toHaveLength(1);
    expect(fake.calls[0].headers['x-client-secret']).toBe('client-secret');
  });
});

describe('hosted OAuth sign-in', () => {
  it('start → callback → exchange sets the session and returns to VOULT_APP_URL + returnTo', async () => {
    const agent = await mount();
    const started = await start(agent, '/api/auth/oauth/google/start?returnTo=/account?tab=security');

    expect(started.headers.location).toMatch(/^https:\/\/provider\.test\/google\?state=/);
    expect(started.headers['set-cookie'].join(';')).toMatch(/voult_oauth=.*HttpOnly/);
    const authorize = fake.calls.find((c) => c.path === '/api/oauth/google/authorize');
    expect(authorize.body).toMatchObject({ intent: 'authenticate', redirectUri: expect.stringMatching(/\/api\/auth\/oauth\/callback$/) });
    expect(authorize.body.state).toBe(stateOf(started.headers.location));
    expect(authorize.headers['x-client-secret']).toBeUndefined();

    const done = await agent.get('/api/auth/oauth/callback')
      .query({ voult_code: 'otc_ok', state: stateOf(started.headers.location) });
    expect(done.status).toBe(302);
    expect(done.headers.location).toBe(`${APP_URL}/account?tab=security`);
    expect(exchanges()[0].body).toEqual({ code: 'otc_ok', redirectUri: authorize.body.redirectUri });

    const session = await agent.get('/api/auth/session');
    expect(session.body).toMatchObject({ authenticated: true, user: { email: 'oauth@example.com' } });
  });

  it('rejects a callback whose state does not match this browser (login CSRF)', async () => {
    const agent = await mount();
    await start(agent);
    const res = await agent.get('/api/auth/oauth/callback').query({ voult_code: 'otc_ok', state: 'attacker-state' });

    expect(res.headers.location).toMatch(`${APP_URL}/login?voult_error=INVALID_OAUTH_STATE`);
    expect(exchanges()).toHaveLength(0);
    expect((await agent.get('/api/auth/session')).body.authenticated).toBe(false);
  });

  it('rejects a callback in a browser that never started the flow', async () => {
    const agent = await mount();
    const res = await agent.get('/api/auth/oauth/callback').query({ voult_code: 'otc_ok', state: 'anything' });
    expect(res.headers.location).toMatch(/voult_error=INVALID_OAUTH_STATE/);
    expect(exchanges()).toHaveLength(0);
  });

  it('passes a provider denial through to the error page', async () => {
    const agent = await mount();
    const started = await start(agent);
    const res = await agent.get('/api/auth/oauth/callback')
      .query({ error: 'access_denied', error_description: 'User cancelled', state: stateOf(started.headers.location) });
    expect(res.headers.location).toBe(`${APP_URL}/login?voult_error=access_denied&voult_error_description=User+cancelled`);
  });

  it('reports a failed exchange instead of setting a session', async () => {
    const agent = await mount();
    const started = await start(agent);
    const res = await agent.get('/api/auth/oauth/callback')
      .query({ voult_code: 'otc_expired', state: stateOf(started.headers.location) });
    expect(res.headers.location).toMatch(/voult_error=INVALID_OAUTH_CODE/);
  });

  it('a provider that is off redirects with its error code', async () => {
    const agent = await mount();
    const res = await start(agent, '/api/auth/oauth/facebook/start');
    expect(res.headers.location).toMatch(`${APP_URL}/login?voult_error=PROVIDER_NOT_ENABLED`);
  });

  it.each(['//evil.example/x', 'https://evil.example', '/\\evil.example'])('ignores returnTo=%s', async (returnTo) => {
    const agent = await mount({ oauth: { successPath: '/home' } });
    const started = await start(agent, `/api/auth/oauth/google/start?returnTo=${encodeURIComponent(returnTo)}`);
    const done = await agent.get('/api/auth/oauth/callback').query({ voult_code: 'otc_ok', state: stateOf(started.headers.location) });
    expect(done.headers.location).toBe(`${APP_URL}/home`);
  });

  it('uses VOULT_OAUTH_CALLBACK_URL when set (e.g. behind a proxy)', async () => {
    const agent = await mount({ oauthCallbackUrl: 'https://api.myapp.test/api/auth/oauth/callback' });
    await start(agent);
    expect(fake.calls[0].body.redirectUri).toBe('https://api.myapp.test/api/auth/oauth/callback');
  });

  it('redirects same-origin when VOULT_APP_URL is not set', async () => {
    const agent = await mount({ appUrl: '' }); // '' — `undefined` would pick up the default
    const started = await start(agent);
    const done = await agent.get('/api/auth/oauth/callback').query({ voult_code: 'otc_ok', state: stateOf(started.headers.location) });
    expect(done.headers.location).toBe('/');
  });
});

describe('MFA after OAuth', () => {
  it('parks the pending token in a cookie; /mfa/verify finishes with just the code', async () => {
    const agent = await mount();
    const started = await start(agent);
    const done = await agent.get('/api/auth/oauth/callback').query({ voult_code: 'otc_mfa', state: stateOf(started.headers.location) });

    expect(done.headers.location).toBe(`${APP_URL}/mfa`);
    expect(done.headers['set-cookie'].join(';')).toMatch(/voult_mfa_pending=.*HttpOnly/);
    expect((await agent.get('/api/auth/session')).body).toEqual({ authenticated: false, user: null, mfaPending: true });

    const verified = await agent.post('/api/auth/mfa/verify').send({ mfaToken: '123456' });
    expect(verified.status).toBe(200);
    expect(verified.body.accessToken).toBeUndefined();

    const session = await agent.get('/api/auth/session');
    expect(session.body).toMatchObject({ authenticated: true, user: { email: 'mfa@example.com' } });
    expect(session.body.mfaPending).toBeUndefined();
  });
});

describe('linking a provider', () => {
  it('requires a signed-in session', async () => {
    const agent = await mount();
    const res = await start(agent, '/api/auth/oauth/github/start?intent=link');
    expect(res.headers.location).toMatch(/voult_error=LOGIN_REQUIRED/);
    expect(fake.calls).toHaveLength(0);
  });

  it('forwards the user token and returns with voult_linked', async () => {
    const agent = await mount();
    const signIn = await start(agent);
    await agent.get('/api/auth/oauth/callback').query({ voult_code: 'otc_ok', state: stateOf(signIn.headers.location) });

    const started = await start(agent, '/api/auth/oauth/github/start?intent=link&returnTo=/settings');
    const link = fake.calls.find((c) => c.path === '/api/oauth/github/link');
    expect(link.headers.authorization).toBe('Bearer access-oauth');
    expect(link.body.state).toBe(stateOf(started.headers.location));

    const done = await agent.get('/api/auth/oauth/callback').query({ linked: '1', state: stateOf(started.headers.location) });
    expect(done.headers.location).toBe(`${APP_URL}/settings?voult_linked=github`);
  });
});

describe('guards', () => {
  it('bearer strategy gets a clear 400 (hosted OAuth needs cookie sessions)', async () => {
    const agent = await mount({ strategy: 'bearer' });
    const res = await agent.get('/api/auth/oauth/google/start');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('OAUTH_REQUIRES_COOKIE_SESSION');
  });

  it('never reads provider secrets from the environment', () => {
    const dir = new URL('../src/', import.meta.url);
    for (const file of readdirSync(dir)) {
      const source = readFileSync(new URL(file, dir), 'utf8');
      expect(source, file).not.toMatch(/(GOOGLE|GITHUB|FACEBOOK|LINKEDIN|MICROSOFT|APPLE)_/);
    }
  });
});
