import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deleteUser,
  reenableAccount,
  refreshSession,
  listSessions,
  revokeSession,
  sendPasswordResetEmail,
  resetPassword,
  verifyEmail,
} from '../../src/index.js';
import { VoultClient } from '../../src/client.js';
import { AuthenticationError, ValidationError } from '../../src/errors.js';
import { startTestServer } from '../support/test-server.js';

test('account, session, password reset, and email verification flows use authenticated endpoints', async (t) => {
  const { server, baseURL, state } = await startTestServer();
  t.after(() => server.close());

  const client = new VoultClient({ clientId: 'client-id', clientSecret: 'client-secret', baseURL });

  await assert.rejects(() => deleteUser(client), AuthenticationError);
  await assert.rejects(() => reenableAccount(client), AuthenticationError);
  await assert.rejects(() => listSessions(client), AuthenticationError);
  await assert.rejects(() => revokeSession('session-1', client), AuthenticationError);

  client.setSession({ id: 'user-1', email: 'user@example.com', isEmailVerified: false }, 'access-1', 'refresh-1');

  const deleted = await deleteUser(client);
  assert.deepEqual(deleted, {
    success: true,
    message: 'Account disabled successfully',
  });
  assert.equal(client.isAuthenticated(), false);

  client.setSession({ id: 'user-1', email: 'user@example.com' }, 'access-1', 'refresh-1');
  const reenabled = await reenableAccount(client);
  assert.deepEqual(reenabled, {
    success: true,
    message: 'Account re-enabled successfully. Please log in again.',
  });
  assert.equal(client.isAuthenticated(), false);

  client.setSession({ id: 'user-1', email: 'user@example.com' }, 'access-1', 'refresh-1');
  const sessions = await listSessions(client);
  assert.deepEqual(sessions, { sessions: [{ id: 'session-1', device: 'Chrome' }] });

  const revoked = await revokeSession('session-1', client);
  assert.deepEqual(revoked, {
    success: true,
    message: 'Session revoked successfully',
  });

  const refreshed = await refreshSession(client);
  assert.deepEqual(refreshed, {
    accessToken: 'access-2',
    refreshToken: 'refresh-1',
    user: client.getCurrentUser(),
  });
  assert.equal(client.accessToken, 'access-2');

  const resetSent = await sendPasswordResetEmail(' USER@EXAMPLE.com ', client);
  const forgotPasswordRequest = state.requests.at(-1);
  assert.deepEqual(resetSent, {
    success: true,
    message: 'If that email exists, a reset link has been sent',
  });
  assert.equal(forgotPasswordRequest.method, 'POST');
  assert.equal(forgotPasswordRequest.path, '/api/user/forgot-password');
  assert.deepEqual(forgotPasswordRequest.body, { email: 'user@example.com' });
  assert.equal(forgotPasswordRequest.headers['x-client-id'], 'client-id');
  assert.equal(forgotPasswordRequest.headers['x-client-secret'], 'client-secret');

  const reset = await resetPassword(' reset-token ', 'StrongPass123!', { appId: 'app-1' }, client);
  assert.deepEqual(reset, {
    success: true,
    message: 'Password reset successful',
  });
  assert.deepEqual(state.requests.at(-1).query, { token: 'reset-token', appId: 'app-1' });
  assert.equal(state.requests.at(-1).headers['x-client-secret'], 'client-secret');

  const verified = await verifyEmail(' email-token ', { appId: 'app-1' }, client);
  assert.deepEqual(verified, {
    success: true,
    message: 'Email verified successfully',
  });
  assert.deepEqual(state.requests.at(-1).query, { token: 'email-token', appId: 'app-1' });
  assert.equal(state.requests.at(-1).headers['x-client-secret'], undefined);
  assert.equal(client.user.isEmailVerified, true);

  await assert.rejects(
    () => resetPassword('reset-token', 'weak', { appId: 'app-1' }, client),
    (error) => error instanceof ValidationError && error.field === 'password'
  );
});
