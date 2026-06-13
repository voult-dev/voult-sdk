import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveClientArg, requireAuthenticated, applyAuthResponse, assertOAuthCredential } from '../../src/utils/helpers.js';
import { VoultClient } from '../../src/client.js';
import { AuthenticationError, ValidationError } from '../../src/errors.js';

test('resolves optional client argument overloads', () => {
  const client = new VoultClient({ clientId: 'client-id', clientSecret: 'client-secret' });
  const options = { fullName: 'Jane Doe' };

  assert.deepEqual(resolveClientArg(options, client), { options, client });
  assert.deepEqual(resolveClientArg(client), { options: {}, client });
  assert.throws(() => resolveClientArg({}), {
    name: 'ValidationError',
    code: 'VALIDATION_ERROR',
    status: 400,
  });
});

test('requires authenticated client sessions', () => {
  const client = new VoultClient({ clientId: 'client-id', clientSecret: 'client-secret' });

  assert.throws(() => requireAuthenticated(client), {
    name: 'AuthenticationError',
    code: 'AUTHENTICATION_ERROR',
    status: 401,
  });

  client.setSession({ id: 'user-1' }, 'access-1', 'refresh-1');
  assert.doesNotThrow(() => requireAuthenticated(client));
});

test('applies auth response payloads and sets client sessions', () => {
  const client = new VoultClient({ clientId: 'client-id', clientSecret: 'client-secret' });
  const user = { id: 'user-1', email: 'user@example.com' };

  const result = applyAuthResponse(client, {
    data: {
      user,
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      message: 'Signed in',
      success: true,
    },
  });

  assert.deepEqual(result, {
    user,
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    token: 'access-1',
    message: 'Signed in',
    success: true,
  });
  assert.equal(client.isAuthenticated(), true);
  assert.deepEqual(client.getCurrentUser(), user);
});

test('asserts OAuth credentials are objects', () => {
  assert.throws(() => assertOAuthCredential('Google', null), {
    name: 'ValidationError',
    code: 'VALIDATION_ERROR',
    status: 400,
  });

  assert.doesNotThrow(() => assertOAuthCredential('Google', { idToken: 'token' }));
});
