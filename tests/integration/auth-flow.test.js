import test from 'node:test';
import assert from 'node:assert/strict';
import voult from '../../src/index.js';
import {
  signInWithEmailAndPassword,
  signUpWithEmailAndPassword,
  signInWithEmailLink,
  verifyEmailLink,
  getCurrentUser,
  updateProfile,
  signOut,
} from '../../src/index.js';
import { ValidationError } from '../../src/errors.js';
import { startTestServer } from '../support/test-server.js';

test('named exports and default export run a complete password and magic-link flow', async (t) => {
  const { server, baseURL, state } = await startTestServer();
  t.after(() => server.close());

  const auth = voult({ clientId: 'client-id', clientSecret: 'client-secret', baseURL });
  assert.equal(auth.VERSION, '0.2.0');
  assert.equal(typeof auth.client.request, 'function');
  assert.equal(typeof auth.signUpWithEmailAndPassword, 'function');

  const signedUp = await signUpWithEmailAndPassword(
    ' USER@EXAMPLE.com ',
    'StrongPass123!',
    { fullName: ' Jane Doe ', username: 'JohnDoe' },
    auth.client
  );

  assert.deepEqual(signedUp, {
    user: {
      id: 'user-1',
      email: 'user@example.com',
      fullName: 'Jane Doe',
      username: 'johndoe',
      isEmailVerified: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      isLocked: false,
      lastLoginAt: '2026-01-01T00:00:00.000Z',
      app: { id: 'app-1' },
    },
    token: 'signup-token',
    message: 'Registered',
  });
  assert.equal(auth.client.isAuthenticated(), true);
  assert.deepEqual(auth.client.getCurrentUser(), signedUp.user);

  await auth.client.get('/api/user/me', { requireAuth: true });
  const loggedIn = await signInWithEmailAndPassword('user@example.com', 'password', auth.client);
  assert.deepEqual(loggedIn, {
    user: {
      id: 'user-1',
      email: 'user@example.com',
      fullName: 'Test User',
      isEmailVerified: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      isLocked: false,
      lastLoginAt: '2026-01-01T00:00:00.000Z',
      app: { id: 'app-1' },
    },
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    token: 'access-1',
    message: undefined,
    success: true,
  });

  const magicLinkSent = await signInWithEmailLink(
    'user@example.com',
    { redirectUri: 'https://example.com/callback' },
    auth.client
  );
  assert.deepEqual(magicLinkSent, { success: true, message: 'Magic link sent' });

  await assert.rejects(
    () => auth.signInWithEmailLink('user@example.com', { redirectUri: 'not-a-url' }),
    (error) => error instanceof ValidationError && error.field === 'redirectUri'
  );

  const verified = await verifyEmailLink('magic-token', auth.client);
  assert.deepEqual(verified.user, {
    id: 'user-1',
    email: 'magic@example.com',
    fullName: 'Magic User',
    isEmailVerified: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    isLocked: false,
    lastLoginAt: '2026-01-01T00:00:00.000Z',
    app: { id: 'app-1' },
  });
  assert.equal(verified.accessToken, 'access-1');
  assert.equal(verified.refreshToken, 'refresh-1');

  const profile = await getCurrentUser(auth.client);
  assert.deepEqual(profile, {
    id: 'user-1',
    email: 'user@example.com',
    fullName: 'Profile User',
    isEmailVerified: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    isLocked: false,
    lastLoginAt: '2026-01-01T00:00:00.000Z',
    app: { id: 'app-1' },
  });

  const updated = await updateProfile({ fullName: ' Updated User ' }, auth.client);
  assert.equal(updated.user.fullName, 'Updated User');
  assert.equal(auth.client.getCurrentUser().fullName, 'Updated User');

  const logout = await signOut(auth.client);
  assert.deepEqual(logout, {
    success: true,
    message: 'Logged out successfully',
  });
  assert.equal(auth.client.isAuthenticated(), false);

  assert.ok(state.requests.some((request) => request.method === 'POST' && request.path === '/api/auth/register'));
  assert.ok(state.requests.some((request) => request.method === 'POST' && request.path === '/api/auth/email-login'));
  assert.ok(state.requests.some((request) => request.method === 'POST' && request.path === '/api/send-magic-link'));
  assert.ok(state.requests.some((request) => request.method === 'POST' && request.path === '/api/validate-magic-link'));
  assert.ok(state.requests.some((request) => request.method === 'GET' && request.path === '/api/user/me'));
  assert.ok(state.requests.some((request) => request.method === 'PATCH' && request.path === '/api/user/me'));
  assert.ok(state.requests.some((request) => request.method === 'POST' && request.path === '/api/auth/logout'));
});
