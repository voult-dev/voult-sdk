import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildEnvExampleFile, buildEnvFile, generateSessionSecret, isSecretKey } from '../src/env.js';

test('buildEnvFile writes only the keys given a value', () => {
  const body = buildEnvFile({ VOULT_BASE_URL: 'https://api.voult.dev', VOULT_CLIENT_ID: 'app_1' });
  assert.equal(body, 'VOULT_BASE_URL=https://api.voult.dev\nVOULT_CLIENT_ID=app_1\n');
});

test('buildEnvExampleFile lists every canonical key with no value', () => {
  const body = buildEnvExampleFile();
  assert.match(body, /^VOULT_BASE_URL=$/m);
  assert.match(body, /^VOULT_CLIENT_SECRET=$/m);
  assert.doesNotMatch(body, /=.+/); // no key has a value after '='
});

test('generateSessionSecret returns a 64-char hex string (32 bytes)', () => {
  const secret = generateSessionSecret();
  assert.equal(secret.length, 64);
  assert.match(secret, /^[0-9a-f]{64}$/);
  assert.notEqual(secret, generateSessionSecret());
});

test('isSecretKey flags client secret and session secret only', () => {
  assert.equal(isSecretKey('VOULT_CLIENT_SECRET'), true);
  assert.equal(isSecretKey('VOULT_SESSION_SECRET'), true);
  assert.equal(isSecretKey('VOULT_CLIENT_ID'), false);
  assert.equal(isSecretKey('VOULT_BASE_URL'), false);
});
