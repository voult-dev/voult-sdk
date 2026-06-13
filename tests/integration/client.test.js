import test from 'node:test';
import assert from 'node:assert/strict';
import { VoultClient } from '../../src/client.js';
import {
  VoultError,
  AuthenticationError,
  ConflictError,
  AccountLockedError,
} from '../../src/errors.js';
import { startTestServer } from '../support/test-server.js';

test('VoultClient validates config, injects headers, and maps API errors', async (t) => {
  const { server, baseURL, state } = await startTestServer();
  t.after(() => server.close());

  assert.throws(() => new VoultClient({ clientSecret: 'secret' }), {
    name: 'ValidationError',
    code: 'VALIDATION_ERROR',
    status: 400,
    field: 'clientId',
  });

  assert.throws(() => new VoultClient({ clientId: 'client-id' }), {
    name: 'ValidationError',
    code: 'VALIDATION_ERROR',
    status: 400,
    field: 'clientSecret',
  });

  const client = new VoultClient({ clientId: 'client-id', clientSecret: 'client-secret', baseURL });

  await assert.rejects(
    () => client.post('/api/auth/register', {
      email: 'conflict@example.com',
      password: 'StrongPass123!',
      fullName: 'Conflict User',
    }),
    ConflictError
  );
  assert.deepEqual(state.requests[0].headers['x-client-id'], 'client-id');
  assert.deepEqual(state.requests[0].headers['x-client-secret'], 'client-secret');

  await assert.rejects(
    () => client.post('/api/auth/email-login', { email: 'locked@example.com', password: 'StrongPass123!' }),
    AccountLockedError
  );

  client.setSession({ id: 'user-1', email: 'user@example.com' }, 'access-1', 'refresh-1');
  const profile = await client.get('/api/user/me', { requireAuth: true });
  assert.equal(profile.email, 'user@example.com');
  assert.deepEqual(state.requests.at(-1).headers.authorization, 'Bearer access-1');

  const expiredClient = new VoultClient({ clientId: 'client-id', clientSecret: 'client-secret', baseURL });
  expiredClient.setSession({ id: 'user-1', email: 'user@example.com' }, 'expired-token', 'refresh-1');
  const refreshedProfile = await expiredClient.get('/api/user/me', { requireAuth: true });
  assert.equal(refreshedProfile.email, 'user@example.com');
  assert.equal(state.requests.filter((request) => request.path === '/api/sessions/refresh').length, 1);
  assert.deepEqual(state.requests.at(-1).headers.authorization, 'Bearer access-2');

  const conflictClient = new VoultClient({ clientId: 'client-id', clientSecret: 'client-secret', baseURL });
  await assert.rejects(
    () => conflictClient.post('/api/auth/register', { email: 'conflict@example.com', password: 'StrongPass123!', fullName: 'Conflict User' }),
    ConflictError
  );

  const authErrorClient = new VoultClient({ clientId: 'client-id', clientSecret: 'client-secret', baseURL });
  await assert.rejects(
    () => authErrorClient.post('/api/auth/email-login', { email: 'user@example.com', password: 'wrong' }),
    AuthenticationError
  );

  const notFoundClient = new VoultClient({ clientId: 'client-id', clientSecret: 'client-secret', baseURL });
  await assert.rejects(
    () => notFoundClient.get('/api/missing'),
    (error) => error instanceof VoultError && error.status === 404 && error.code === 'NOT_FOUND'
  );
});
