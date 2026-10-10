// 0.3: every end-user feature is a router route, so apps write no auth handlers.
// Each route against the SDK's fake Voult, through the real Express adapter.
import { afterEach, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createVoultRouter } from '../src/index.js';
import { startTestServer } from '../../voult-sdk/tests/support/test-server.js';

const APP_URL = 'http://frontend.test';
let fake;
afterEach(() => fake?.server.close());

async function mount() {
  fake = await startTestServer();
  const app = express();
  app.use('/api/auth', createVoultRouter({
    config: {
      clientId: 'client-id',
      clientSecret: 'client-secret',
      baseURL: fake.baseURL,
      sessionSecret: 'session-secret',
      appUrl: APP_URL,
      session: { strategy: 'cookie' },
    },
  }));
  return app;
}

async function signedIn() {
  const agent = request.agent(await mount());
  const login = await agent.post('/api/auth/email-login').send({ email: 'user@example.com', password: 'StrongPass123!' });
  expect(login.status).toBe(200);
  return agent;
}

const lastCall = (path) => fake.state.requests.filter((r) => r.path === path).at(-1);
const cleared = (res, name) => res.headers['set-cookie']?.some((c) => c.startsWith(`${name}=`) && /Expires=Thu, 01 Jan 1970/.test(c));

describe('session routes need a session (renew first, then 401 JSON)', () => {
  it.each([
    ['post', '/mfa/setup'], ['post', '/mfa/enable'], ['post', '/mfa/disable'], ['post', '/mfa/backup-codes'],
    ['get', '/sessions'], ['delete', '/sessions/session-1'], ['get', '/oauth/linked'], ['delete', '/oauth/linked/google'],
    ['delete', '/user/me'], ['post', '/passkeys/register/options'], ['post', '/passkeys/register/verify'],
    ['get', '/passkeys'], ['patch', '/passkeys/cred-1'], ['delete', '/passkeys/cred-1'],
  ])('%s %s → 401 without a session', async (method, path) => {
    const res = await request(await mount())[method](`/api/auth${path}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTHENTICATION_ERROR');
  });
});

describe('MFA', () => {
  it('setup → enable → backup codes → disable', async () => {
    const agent = await signedIn();

    const setup = await agent.post('/api/auth/mfa/setup');
    expect(setup.status).toBe(200);
    expect(setup.body).toMatchObject({ secret: 'SECRET123', qrCode: expect.any(String), backupCodes: expect.any(Array) });

    const enabled = await agent.post('/api/auth/mfa/enable').send({ code: '123456' });
    expect(enabled.body.mfaEnabled).toBe(true);
    expect(lastCall('/api/auth/mfa/enable').body).toEqual({ token: '123456' });

    const codes = await agent.post('/api/auth/mfa/backup-codes').send({ code: '123456' });
    expect(codes.body.backupCodes).toEqual(['333333', '444444']);

    const disabled = await agent.post('/api/auth/mfa/disable').send({ password: 'StrongPass123!', code: '123456' });
    expect(disabled.body.mfaEnabled).toBe(false);
    expect(lastCall('/api/auth/mfa/disable').body).toEqual({ mfaToken: '123456', password: 'StrongPass123!' });
  });

  it('disable works without a password (accounts created with Google/GitHub)', async () => {
    const agent = await signedIn();
    await agent.post('/api/auth/mfa/disable').send({ code: '123456' });
    expect(lastCall('/api/auth/mfa/disable').body).toEqual({ mfaToken: '123456' });
  });

  it('cancel drops a pending MFA sign-in', async () => {
    const agent = request.agent(await mount());
    await agent.post('/api/auth/email-login').send({ email: 'mfa@example.com', password: 'StrongPass123!' });
    expect((await agent.get('/api/auth/session')).body.mfaPending).toBe(true);

    const res = await agent.post('/api/auth/mfa/cancel');
    expect(res.body).toEqual({ success: true });
    expect(cleared(res, 'voult_mfa_pending')).toBe(true);
    expect((await agent.get('/api/auth/session')).body.mfaPending).toBeUndefined();
  });
});

describe('sessions', () => {
  it('lists sessions with this browser marked current (refresh token sent server-side only)', async () => {
    const agent = await signedIn();
    const res = await agent.get('/api/auth/sessions');
    expect(res.body.sessions).toEqual([
      { id: 'session-1', device: 'Chrome', isCurrent: true },
      { id: 'session-2', device: 'Firefox', isCurrent: false },
    ]);
    expect(lastCall('/api/sessions').headers['x-refresh-token']).toBe('refresh-1');
  });

  it('revoking another session keeps this one', async () => {
    const agent = await signedIn();
    const res = await agent.delete('/api/auth/sessions/session-2');
    expect(res.body).toMatchObject({ success: true, current: false });
    expect(cleared(res, 'voult_access')).toBeFalsy();
    expect((await agent.get('/api/auth/session')).body.authenticated).toBe(true);
  });

  it('revoking this session signs this browser out', async () => {
    const agent = await signedIn();
    const res = await agent.delete('/api/auth/sessions/session-1');
    expect(res.body).toMatchObject({ success: true, current: true });
    expect(cleared(res, 'voult_access')).toBe(true);
    expect(cleared(res, 'voult_refresh')).toBe(true);
    expect(lastCall('/api/sessions/revoke/session-1')).toBeTruthy();
  });
});

describe('linked accounts', () => {
  it('lists and unlinks providers', async () => {
    const agent = await signedIn();
    const linked = await agent.get('/api/auth/oauth/linked');
    expect(linked.status).toBe(200);
    expect(Array.isArray(linked.body.providers)).toBe(true);

    const unlinked = await agent.delete('/api/auth/oauth/linked/google');
    expect(unlinked.body.success).toBe(true);
  });
});

describe('DELETE /user/me', () => {
  it('disables the account at Voult and signs this browser out', async () => {
    const agent = await signedIn();
    const res = await agent.delete('/api/auth/user/me');
    expect(res.status).toBe(200);
    expect(lastCall('/api/user/disable')).toBeTruthy();
    expect(cleared(res, 'voult_access')).toBe(true);
    expect((await agent.get('/api/auth/session')).body.authenticated).toBe(false);
  });
});

describe('passkeys', () => {
  it('registration options/verify, list, rename, delete (session)', async () => {
    const agent = await signedIn();
    const options = await agent.post('/api/auth/passkeys/register/options').send({ deviceName: 'MacBook' });
    expect(options.body.options).toEqual({ challenge: 'abc' });

    const verified = await agent.post('/api/auth/passkeys/register/verify').send({ credential: { id: 'c' }, deviceName: 'MacBook' });
    expect(verified.body.credential).toMatchObject({ id: 'cred-1', deviceName: 'MacBook' });

    expect((await agent.get('/api/auth/passkeys')).body).toBeTruthy();
    const renamed = await agent.patch('/api/auth/passkeys/cred-1').send({ deviceName: 'Work laptop' });
    expect(renamed.status).toBe(200);
    expect((await agent.delete('/api/auth/passkeys/cred-1')).status).toBe(200);
  });

  it('login options/verify (public) set the session cookies like password sign-in', async () => {
    const agent = request.agent(await mount());
    const options = await agent.post('/api/auth/passkeys/login/options').send({});
    expect(options.body.options).toEqual({ challenge: 'xyz' });

    const login = await agent.post('/api/auth/passkeys/login/verify').send({ credential: { id: 'c' } });
    expect(login.status).toBe(200);
    expect(login.body.accessToken).toBeUndefined();
    expect(login.headers['set-cookie'].join(';')).toMatch(/voult_access=.*HttpOnly/);
    expect((await agent.get('/api/auth/session')).body.authenticated).toBe(true);
  });
});

describe('magic links', () => {
  it('POST /magic-link answers { sent: true } and points the link at /magic-link/verify on this server', async () => {
    const app = await mount();
    const res = await request(app).post('/api/auth/magic-link').send({ email: 'someone@example.com', returnTo: '/account' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ sent: true });
    const redirectUri = new URL(lastCall('/api/send-magic-link').body.redirectUri);
    expect(redirectUri.pathname).toBe('/api/auth/magic-link/verify');
    expect(redirectUri.searchParams.get('returnTo')).toBe('/account');
  });

  it('verify sets the session and redirects to returnTo', async () => {
    const agent = request.agent(await mount());
    const res = await agent.get('/api/auth/magic-link/verify').query({ token: 'link-token', returnTo: '/account' });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`${APP_URL}/account`);
    expect((await agent.get('/api/auth/session')).body).toMatchObject({ authenticated: true, user: { email: 'magic@example.com' } });
  });

  it('verify with MFA parks the pending token and goes to the MFA page', async () => {
    const agent = request.agent(await mount());
    const res = await agent.get('/api/auth/magic-link/verify').query({ token: 'mfa-link-token' });
    expect(res.headers.location).toBe(`${APP_URL}/mfa`);
    expect((await agent.get('/api/auth/session')).body).toEqual({ authenticated: false, user: null, mfaPending: true });
  });

  it('a used or expired link goes to the error page', async () => {
    const res = await request(await mount()).get('/api/auth/magic-link/verify').query({ token: 'used-token', returnTo: '//evil.example' });
    expect(res.headers.location).toMatch(`${APP_URL}/login?voult_error=INVALID_OR_EXPIRED_TOKEN`);
  });
});
