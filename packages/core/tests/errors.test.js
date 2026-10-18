import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AuthenticationError, ConflictError, NetworkError, VoultError } from '@voult/sdk';
import { GENERIC_ERROR_MESSAGE, publicError } from '../src/index.js';

const quiet = () => {};

test('a 4xx the user can fix keeps its message and uses the API code (ERRORS.md)', () => {
  const err = new AuthenticationError('Invalid email or password', { status: 401, apiCode: 'INVALID_CREDENTIALS' });
  assert.deepEqual(publicError(err, { log: quiet }), { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password', status: 401 });
  const taken = new ConflictError('An account with this email already exists', { status: 409, apiCode: 'USER_EXISTS' });
  assert.equal(publicError(taken, { log: quiet }).code, 'USER_EXISTS');
});

test('an SDK error with no API code keeps the SDK code (e.g. the router\'s own 401)', () => {
  assert.equal(publicError(new AuthenticationError('Authentication required'), { log: quiet }).code, 'AUTHENTICATION_ERROR');
});

test('5xx, network failures and bugs: generic message for the browser, full error in the log', () => {
  const logged = [];
  const log = (...args) => logged.push(args);
  for (const err of [
    new VoultError('Database exploded at 10.0.0.4', 'SERVER_ERROR', 500, { apiCode: 'CONFIG_ERROR' }),
    new NetworkError('connect ECONNREFUSED 127.0.0.1:4100'),
    new TypeError("Cannot read properties of undefined (reading 'id')"),
  ]) {
    const out = publicError(err, { log, context: 'GET /api/auth/session' });
    assert.equal(out.code, 'INTERNAL_ERROR');
    assert.equal(out.message, GENERIC_ERROR_MESSAGE);
    assert.ok(out.status >= 500);
  }
  assert.equal(logged.length, 3);
  assert.match(logged[0][0], /GET \/api\/auth\/session failed/);
  assert.match(String(logged[1][1].message), /ECONNREFUSED/); // the developer still sees the cause
});

test('the router\'s own 4xx errors (bad JSON, too large) keep their codes', () => {
  assert.equal(publicError(Object.assign(new Error('Request body is not valid JSON'), { status: 400, code: 'INVALID_JSON' })).code, 'INVALID_JSON');
});
