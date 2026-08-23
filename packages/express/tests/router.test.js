import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createVoultMiddleware, createVoultRouter } from '../src/index.js';

const validConfig = {
  clientId: 'client-id',
  clientSecret: 'client-secret',
  baseURL: 'https://api.voult.dev',
  sessionSecret: 'session-secret',
  session: { strategy: 'cookie' },
};

describe('createVoultRouter', () => {
  it('mounts on Express without throwing when config is valid', async () => {
    const app = express();

    expect(() => {
      app.use('/api/auth', createVoultRouter({ config: validConfig }));
    }).not.toThrow();

    const response = await request(app).get('/api/auth/session');
    expect(response.status).toBe(404);
  });

  it('loads config from env when mounting', async () => {
    const app = express();
    app.use(
      '/api/auth',
      createVoultRouter({
        env: {
          VOULT_CLIENT_ID: 'env-client-id',
          VOULT_CLIENT_SECRET: 'env-client-secret',
          VOULT_SESSION_SECRET: 'env-session-secret',
        },
      })
    );

    const response = await request(app).get('/health-unrelated');
    expect(response.status).toBe(404);
  });
});

describe('createVoultMiddleware', () => {
  it('attaches resolved config and parses cookies', async () => {
    const app = express();
    app.use(createVoultMiddleware({ config: validConfig }));
    app.get('/probe', (req, res) => {
      res.json({
        clientId: req.voultConfig?.clientId,
        strategy: req.voultConfig?.session?.strategy,
        cookie: req.cookies?.demo,
      });
    });

    const response = await request(app).get('/probe').set('Cookie', 'demo=ok');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      clientId: 'client-id',
      strategy: 'cookie',
      cookie: 'ok',
    });
  });
});
