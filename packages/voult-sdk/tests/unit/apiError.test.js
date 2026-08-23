import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseApiErrorResponse,
  extractValidationFields,
  buildRequestContext,
} from '../../src/utils/apiError.js';

test('parseApiErrorResponse handles nested Voult API errors', () => {
  const parsed = parseApiErrorResponse(
    {
      error: {
        code: 'ACCOUNT_DISABLED',
        message: 'This account has been disabled',
        status: 403,
      },
    },
    403
  );

  assert.deepEqual(parsed, {
    apiCode: 'ACCOUNT_DISABLED',
    message: 'This account has been disabled',
    status: 403,
    response: {
      error: {
        code: 'ACCOUNT_DISABLED',
        message: 'This account has been disabled',
        status: 403,
      },
    },
  });
});

test('parseApiErrorResponse handles flat string error codes', () => {
  const parsed = parseApiErrorResponse(
    {
      error: 'EMAIL_NOT_VERIFIED',
      message: 'Please verify your email',
    },
    403
  );

  assert.equal(parsed.apiCode, 'EMAIL_NOT_VERIFIED');
  assert.equal(parsed.message, 'Please verify your email');
});

test('parseApiErrorResponse extracts field validation errors', () => {
  const parsed = parseApiErrorResponse(
    {
      code: 'VALIDATION_ERROR',
      message: 'Invalid input',
      errors: [
        { field: 'fullName', message: 'fullName is required' },
        { path: 'email', msg: 'Invalid email format' },
      ],
    },
    400
  );

  assert.deepEqual(parsed.fields, [
    { field: 'fullName', message: 'fullName is required' },
    { field: 'email', message: 'Invalid email format' },
  ]);
});

test('extractValidationFields returns undefined when no field errors exist', () => {
  assert.equal(extractValidationFields({ message: 'Bad request' }), undefined);
});

test('buildRequestContext captures axios request metadata', () => {
  assert.deepEqual(
    buildRequestContext({ method: 'patch', url: '/api/user/me', baseURL: 'https://api.voult.dev' }),
    {
      method: 'PATCH',
      url: '/api/user/me',
      baseURL: 'https://api.voult.dev',
    }
  );
});
