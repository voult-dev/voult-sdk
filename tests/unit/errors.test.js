import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VoultError,
  AuthenticationError,
  ValidationError,
  NetworkError,
  AuthorizationError,
  ConflictError,
  AccountLockedError,
} from '../../src/errors.js';

test('creates typed Voult error classes with metadata', () => {
  const details = {
    apiCode: 'INVALID_CREDENTIALS',
    status: 401,
    request: { method: 'POST', url: '/api/auth/email-login' },
  };

  const cases = [
    [VoultError, 'Something failed', 'CUSTOM_ERROR', 500, details],
    [AuthenticationError, 'Invalid credentials', details],
    [ValidationError, 'Bad email', 'email'],
    [NetworkError, 'Connection failed', { apiCode: 'ECONNREFUSED' }],
    [AuthorizationError, 'Forbidden', details],
    [ConflictError, 'Already exists', details],
    [AccountLockedError, 'Locked', details],
  ];

  for (const [ErrorClass, message, ...args] of cases) {
    const error = new ErrorClass(message, ...args);

    assert.equal(error instanceof VoultError, true);
    assert.equal(error.name, ErrorClass.name);
    assert.equal(error.message, message);
    assert.equal(error instanceof Error, true);
  }
});

test('stores field-specific validation metadata', () => {
  const error = new ValidationError('Email is required', 'email');

  assert.equal(error.name, 'ValidationError');
  assert.equal(error.code, 'VALIDATION_ERROR');
  assert.equal(error.status, 400);
  assert.equal(error.field, 'email');
});

test('stores API metadata on typed errors', () => {
  const details = {
    apiCode: 'ACCOUNT_DISABLED',
    status: 403,
    response: {
      error: {
        code: 'ACCOUNT_DISABLED',
        message: 'This account has been disabled',
        status: 403,
      },
    },
    request: { method: 'PATCH', url: '/api/user/me', baseURL: 'https://api.voult.dev' },
  };
  const error = new AuthorizationError('This account has been disabled', details);

  assert.equal(error.code, 'AUTHORIZATION_ERROR');
  assert.equal(error.apiCode, 'ACCOUNT_DISABLED');
  assert.equal(error.status, 403);
  assert.equal(error.details, details);
  assert.equal(error.request.method, 'PATCH');
  assert.match(error.toString(), /AuthorizationError: This account has been disabled/);
  assert.match(error.toString(), /apiCode=ACCOUNT_DISABLED/);
  assert.match(error.toString(), /request=PATCH \/api\/user\/me/);
  assert.deepEqual(error.toJSON(), {
    name: 'AuthorizationError',
    message: 'This account has been disabled',
    code: 'AUTHORIZATION_ERROR',
    apiCode: 'ACCOUNT_DISABLED',
    status: 403,
    request: details.request,
    fields: undefined,
    details,
  });
});
