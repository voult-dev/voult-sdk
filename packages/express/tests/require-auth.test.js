import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createVoultMiddleware, createVoultRouter, requireAuth } from '../src/index.js';
import { startTestServer } from '../../voult-sdk/tests/support/test-server.js';

/** An integrator's app: the router plus one of *their own* protected routes. */
async function integratorApp() {
  const { server, baseURL, state } = await startTestServer();
  const config = { clientId: 'client-id', clientSecret: 'client-secret', baseURL, sessionSecret: 'session-secret', session: { strategy: 'cookie' } };
  const app = express();
  app.use(createVoultMiddleware({ config }));
  app.use('/api/auth', createVoultRouter({ config }));
  app.get('/api/orders', requireAuth, (req, res) => res.json({ orders: [], owner: req.voult.getCurrentUser()?.email ?? null }));
  return { app, server, state };
}

const cookie = (res, name) => res.headers['set-cookie']?.map((c) => c.split(';')[0]).find((c) => c.startsWith(`${name}=`));

describe('requireAuth on your own routes', () => {
  it('answers 401 JSON without a session', async () => {
    const { app, server } = await integratorApp();
    try {
      const res = await request(app).get('/api/orders');
      expect(res.status).toBe(401);
      expect(res.body.error).toMatchObject({ code: 'AUTHENTICATION_ERROR', status: 401 });
    } finally {
      server.close();
    }
  });

  it('lets a signed-in user through', async () => {
    const { app, server } = await integratorApp();
    try {
      const agent = request.agent(app);
      await agent.post('/api/auth/email-login').send({ email: 'user@example.com', password: 'StrongPass123!' });
      const res = await agent.get('/api/orders');
      expect(res.status).toBe(200);
      expect(res.body.owner).toBe('user@example.com');
    } finally {
      server.close();
    }
  });

  it('renews an expired access cookie from the refresh cookie (no 401 an hour in)', async () => {
    const { app, server, state } = await integratorApp();
    try {
      const login = await request(app).post('/api/auth/email-login').send({ email: 'user@example.com', password: 'StrongPass123!' });
      const res = await request(app).get('/api/orders').set('Cookie', `${cookie(login, 'voult_refresh')}; ${cookie(login, 'voult_user')}`);
      expect(res.status).toBe(200);
      expect(state.refreshCount).toBe(1);
      expect(cookie(res, 'voult_access')).toMatch(/access-2/);
    } finally {
      server.close();
    }
  });

  it('explains the setup mistake when createVoultMiddleware is missing', async () => {
    const app = express();
    app.get('/api/orders', requireAuth, (_req, res) => res.json({}));
    app.use((err, _req, res, _next) => res.status(500).json({ message: err.message }));
    const res = await request(app).get('/api/orders');
    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/needs createVoultMiddleware/);
  });
});
