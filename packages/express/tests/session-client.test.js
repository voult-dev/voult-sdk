import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { VoultClient } from 'voult-sdk';
import { createVoultMiddleware, createVoultRouter } from '../src/index.js';
import { startTestServer } from '../../voult-sdk/tests/support/test-server.js';

const validConfig = {
  clientId: 'client-id',
  clientSecret: 'client-secret',
  baseURL: 'https://api.voult.dev',
  sessionSecret: 'session-secret',
  session: { strategy: 'cookie' },
};

describe('per-request VoultClient', () => {
  it('creates a new client instance on every request', async () => {
    const app = express();
    const clients = [];

    app.use(createVoultMiddleware({ config: validConfig }));
    app.get('/probe', (req, res) => {
      clients.push(req.voult);
      res.json({ ok: true });
    });

    await request(app).get('/probe');
    await request(app).get('/probe');

    expect(clients).toHaveLength(2);
    expect(clients[0]).toBeInstanceOf(VoultClient);
    expect(clients[1]).toBeInstanceOf(VoultClient);
    expect(clients[0]).not.toBe(clients[1]);
  });

  it('restores a cookie session onto req.voult', async () => {
    const { server, baseURL } = await startTestServer();
    try {
      const app = express();
      app.use(
        '/api/auth',
        createVoultRouter({
          config: { ...validConfig, baseURL },
        })
      );

      const agent = request.agent(app);
      const login = await agent.post('/api/auth/email-login').send({
        email: 'user@example.com',
        password: 'password',
      });

      expect(login.status).toBe(200);
      expect(login.headers['set-cookie']).toBeTruthy();

      const me = await agent.get('/api/auth/user/me');
      expect(me.status).toBe(200);
      expect(me.body.user.email).toBe('user@example.com');
    } finally {
      server.close();
    }
  });

  it('applies Authorization Bearer tokens in bearer strategy', async () => {
    const { server, baseURL } = await startTestServer();
    try {
      const app = express();
      app.use(
        '/api/auth',
        createVoultRouter({
          config: {
            ...validConfig,
            baseURL,
            session: { strategy: 'bearer' },
          },
        })
      );

      const response = await request(app)
        .get('/api/auth/user/me')
        .set('Authorization', 'Bearer access-1');

      expect(response.status).toBe(200);
      expect(response.body.user.email).toBe('user@example.com');
    } finally {
      server.close();
    }
  });
});
