import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidEmail,
  isValidPassword,
  isValidUsername,
  isValidUrl,
  PASSWORD_REQUIREMENTS_MESSAGE,
  validateEmail,
  validatePassword,
  validateFullName,
  validateUsername,
  validateToken,
  validatePasswordRequired,
} from '../../src/utils/validation.js';
import { ValidationError } from '../../src/errors.js';

test('validates email, password, username, url, and token formats', () => {
  assert.equal(isValidEmail(' USER@EXAMPLE.com '), true);
  assert.equal(isValidEmail('not-an-email'), false);
  assert.equal(isValidEmail(null), false);

  assert.equal(isValidPassword('StrongPass123!'), true);
  assert.equal(isValidPassword('weak'), false);
  assert.equal(isValidPassword(null), false);

  assert.equal(isValidUsername(' John_Doe1 '), true);
  assert.equal(isValidUsername('ab'), false);
  assert.equal(isValidUsername('bad-name'), false);

  assert.equal(isValidUrl('https://example.com/callback'), true);
  assert.equal(isValidUrl('not-a-url'), false);

  assert.equal(PASSWORD_REQUIREMENTS_MESSAGE, 'Password must be at least 8 characters long and include uppercase, lowercase, number, and special character');
});

test('validate helpers throw ValidationError for invalid input', () => {
  assert.throws(() => validateEmail('bad'), {
    name: 'ValidationError',
    code: 'VALIDATION_ERROR',
    status: 400,
    field: 'email',
  });

  assert.throws(() => validatePassword('weak'), {
    name: 'ValidationError',
    code: 'VALIDATION_ERROR',
    status: 400,
    field: 'password',
  });

  assert.throws(() => validateFullName('   '), {
    name: 'ValidationError',
    code: 'VALIDATION_ERROR',
    status: 400,
    field: 'fullName',
  });

  assert.throws(() => validateUsername('bad-name'), {
    name: 'ValidationError',
    code: 'VALIDATION_ERROR',
    status: 400,
    field: 'username',
  });

  assert.throws(() => validateToken('   '), {
    name: 'ValidationError',
    code: 'VALIDATION_ERROR',
    status: 400,
    field: 'token',
  });

  assert.throws(() => validatePasswordRequired(''), {
    name: 'ValidationError',
    code: 'VALIDATION_ERROR',
    status: 400,
    field: 'password',
  });
});

test('validate helpers normalize accepted values', () => {
  assert.equal(validateEmail(' USER@EXAMPLE.com '), 'user@example.com');
  assert.equal(validatePassword('StrongPass123!'), 'StrongPass123!');
  assert.equal(validateFullName('  Jane Doe  '), 'Jane Doe');
  assert.equal(validateUsername(' John_Doe1 '), 'john_doe1');
  assert.equal(validateToken(' token-123 '), 'token-123');
  assert.equal(validatePasswordRequired(' password '), ' password ');
});
