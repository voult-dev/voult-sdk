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
  const details = { reason: 'locked' };
  const cases = [
    [VoultError, 'Something failed', 'CUSTOM_ERROR', 500, details],
    [AuthenticationError, 'Invalid credentials', undefined, 401, details],
    [ValidationError, 'Bad email', undefined, 400, undefined],
    [NetworkError, 'Connection failed', undefined, null, undefined],
    [AuthorizationError, 'Forbidden', undefined, 403, details],
    [ConflictError, 'Already exists', undefined, 409, details],
    [AccountLockedError, 'Locked', undefined, 423, details],
  ];

  for (const [ErrorClass, message, code, status, errorDetails] of cases) {
    const error = code === undefined && errorDetails === undefined
      ? new ErrorClass(message)
      : new ErrorClass(message, code ?? errorDetails, status, errorDetails);

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

test('stores details on typed errors', () => {
  const details = { provider: 'google' };
  const error = new AuthorizationError('Not allowed', details);

  assert.equal(error.code, 'AUTHORIZATION_ERROR');
  assert.equal(error.status, 403);
  assert.equal(error.details, details);
});
