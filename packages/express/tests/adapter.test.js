// 0.3: the router is @voult/core behind an Express ↔ Fetch adapter. These pin what the
// adapter itself must keep doing; the route behaviour is covered by the other suites.
import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createVoultRouter } from '../src/index.js';
import { startTestServer } from '../../voult-sdk/tests/support/test-server.js';

async function mount({ jsonFirst = false } = {}) {
  const { server, baseURL } = await startTestServer();
  const config = { clientId: 'client-id', clientSecret: 'client-secret', baseURL, sessionSecret: 'session-secret', session: { strategy: 'cookie' } };
  const app = express();
  if (jsonFirst) app.use(express.json());
  app.use('/api/auth', createVoultRouter({ config }));
  // An app route mounted behind the router, under the same path.
  app.post('/api/auth/custom', (req, res) => res.json({ body: req.body, hasClient: Boolean(req.voult) }));
  return { app, server };
}

describe('Express adapter', () => {
  it('routes behind the router still get req.body and req.voult', async () => {
    const { app, server } = await mount();
    try {
      const res = await request(app).post('/api/auth/custom').send({ hello: 'world' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ body: { hello: 'world' }, hasClient: true });
    } finally {
      server.close();
    }
  });

  it('works when the app already parsed the body with express.json()', async () => {
    const { app, server } = await mount({ jsonFirst: true });
    try {
      const login = await request(app).post('/api/auth/email-login').send({ email: 'user@example.com', password: 'StrongPass123!' });
      expect(login.status).toBe(200);
      expect(login.body.user.email).toBe('user@example.com');
    } finally {
      server.close();
    }
  });

  it('answers 413 JSON for a body over 100 kB, like express.json()', async () => {
    const { app, server } = await mount();
    try {
      const res = await request(app)
        .post('/api/auth/email-login')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ email: 'x'.repeat(110 * 1024) }));
      expect(res.status).toBe(413);
      expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    } finally {
      server.close();
    }
  });
});
