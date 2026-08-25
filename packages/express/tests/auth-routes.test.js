import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createVoultRouter } from '../src/index.js';
import { startTestServer } from '../../voult-sdk/tests/support/test-server.js';

const PASSWORD = 'StrongPass123!';

async function mountApp(strategy = 'cookie') {
  const { server, baseURL, state } = await startTestServer();
  const app = express();
  app.use(
    '/api/auth',
    createVoultRouter({
      config: {
        clientId: 'client-id',
        clientSecret: 'client-secret',
        baseURL,
        sessionSecret: 'session-secret',
        session: { strategy },
      },
    })
  );

  return { app, server, state, baseURL };
}

describe('Phase 1 auth routes (cookie strategy)', () => {
  it('registers, then returns an authenticated session', async () => {
    const { app, server } = await mountApp();
    try {
      const agent = request.agent(app);

      const registered = await agent.post('/api/auth/register').send({
        email: 'user@example.com',
        password: PASSWORD,
        fullName: 'Jane Doe',
      });

      expect(registered.status).toBe(200);
      expect(registered.body.user.email).toBe('user@example.com');
      expect(registered.body.accessToken).toBeUndefined();
      expect(registered.headers['set-cookie']).toBeTruthy();

      const session = await agent.get('/api/auth/session');
      expect(session.status).toBe(200);
      expect(session.body.authenticated).toBe(true);
      expect(session.body.user.email).toBe('user@example.com');
    } finally {
      server.close();
    }
  });

  it('logs in, sets cookies, and serves GET /user/me', async () => {
    const { app, server } = await mountApp();
    try {
      const agent = request.agent(app);

      const login = await agent.post('/api/auth/email-login').send({
        email: 'user@example.com',
        password: 'password',
      });

      expect(login.status).toBe(200);
      expect(login.body.user.email).toBe('user@example.com');
      expect(login.headers['set-cookie']).toEqual(
        expect.arrayContaining([expect.stringContaining('voult_access=')])
      );

      const me = await agent.get('/api/auth/user/me');
      expect(me.status).toBe(200);
      expect(me.body.user.email).toBe('user@example.com');
    } finally {
      server.close();
    }
  });

  it('persists a rotated access token after refresh', async () => {
    const { app, server, state } = await mountApp();
    try {
      const agent = request.agent(app);

      await agent.post('/api/auth/email-login').send({
        email: 'user@example.com',
        password: 'password',
      });

      const refresh = await agent.post('/api/auth/sessions/refresh');
      expect(refresh.status).toBe(200);

      await agent.get('/api/auth/user/me');
      const meCalls = state.requests.filter((entry) => entry.path === '/api/user/me');
      expect(meCalls.at(-1).headers.authorization).toBe('Bearer access-2');
    } finally {
      server.close();
    }
  });

  it('clears the session on logout so /user/me becomes 401', async () => {
    const { app, server } = await mountApp();
    try {
      const agent = request.agent(app);

      await agent.post('/api/auth/email-login').send({
        email: 'user@example.com',
        password: 'password',
      });

      const logout = await agent.post('/api/auth/logout');
      expect(logout.status).toBe(200);

      const me = await agent.get('/api/auth/user/me');
      expect(me.status).toBe(401);
      expect(me.body.error.code).toBe('AUTHENTICATION_ERROR');
      expect(me.body.error.status).toBe(401);
    } finally {
      server.close();
    }
  });

  it('returns a normalized 401 when a protected route has no session', async () => {
    const { app, server } = await mountApp();
    try {
      const response = await request(app).get('/api/auth/user/me');

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Authentication required',
          status: 401,
        },
      });
    } finally {
      server.close();
    }
  });

  it('covers username auth, profile, password, email, and MFA routes', async () => {
    const { app, server } = await mountApp();
    try {
      const agent = request.agent(app);

      const usernameRegister = await agent.post('/api/auth/username-register').send({
        username: 'janedoe',
        password: PASSWORD,
        fullName: 'Jane Doe',
        email: 'jane@example.com',
      });
      expect(usernameRegister.status).toBe(200);

      const usernameLogin = await agent.post('/api/auth/username-login').send({
        username: 'janedoe',
        password: 'password',
      });
      expect(usernameLogin.status).toBe(200);

      const patched = await agent.patch('/api/auth/user/me').send({ fullName: 'Updated User' });
      expect(patched.status).toBe(200);
      expect(patched.body.user.fullName).toBe('Updated User');

      const forgot = await agent.post('/api/auth/user/forgot-password').send({
        email: 'user@example.com',
      });
      expect(forgot.status).toBe(200);

      const reset = await agent.post('/api/auth/user/reset-password').send({
        token: 'reset-token',
        password: PASSWORD,
        appId: 'app-1',
      });
      expect(reset.status).toBe(200);

      const verified = await agent.get('/api/auth/user/verify-email').query({
        token: 'verify-token',
        appId: 'app-1',
      });
      expect(verified.status).toBe(200);

      const mfaChallenge = await request(app).post('/api/auth/email-login').send({
        email: 'mfa@example.com',
        password: 'password',
      });
      expect(mfaChallenge.status).toBe(200);
      expect(mfaChallenge.body.mfaRequired).toBe(true);

      const mfa = await agent.post('/api/auth/mfa/verify').send({
        mfaPendingToken: 'mfa-pending-token',
        mfaToken: '123456',
      });
      expect(mfa.status).toBe(200);

      const mfaStatus = await agent.get('/api/auth/mfa/status');
      expect(mfaStatus.status).toBe(200);
      expect(mfaStatus.body.mfaEnabled).toBe(true);
    } finally {
      server.close();
    }
  });
});

describe('Phase 1 auth routes (bearer strategy)', () => {
  it('returns tokens in the body instead of cookies', async () => {
    const { app, server } = await mountApp('bearer');
    try {
      const login = await request(app).post('/api/auth/email-login').send({
        email: 'user@example.com',
        password: 'password',
      });

      expect(login.status).toBe(200);
      expect(login.body.accessToken).toBe('access-1');
      expect(login.body.refreshToken).toBe('refresh-1');
      expect(login.headers['set-cookie']).toBeUndefined();

      const me = await request(app)
        .get('/api/auth/user/me')
        .set('Authorization', `Bearer ${login.body.accessToken}`);

      expect(me.status).toBe(200);
      expect(me.body.user.email).toBe('user@example.com');
    } finally {
      server.close();
    }
  });
});
