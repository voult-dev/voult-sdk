import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildEnvExampleFile, buildEnvFile, generateSessionSecret, isSecretKey } from '../src/env.js';

test('buildEnvFile writes only the keys given a value', () => {
  const body = buildEnvFile({ VOULT_BASE_URL: 'https://api.voult.dev', VOULT_CLIENT_ID: 'app_1' });
  assert.equal(body, 'VOULT_BASE_URL=https://api.voult.dev\nVOULT_CLIENT_ID=app_1\n');
});

test('buildEnvExampleFile: the 3 required keys, the optional ones commented out, no values', () => {
  const body = buildEnvExampleFile();
  const active = body.split('\n').filter((line) => line && !line.startsWith('#'));
  assert.deepEqual(active, ['VOULT_CLIENT_ID=', 'VOULT_CLIENT_SECRET=', 'VOULT_SESSION_SECRET=']);
  for (const key of ['VOULT_APP_URL', 'VOULT_OAUTH_CALLBACK_URL', 'VOULT_SESSION_STRATEGY', 'VOULT_BASE_URL']) {
    assert.match(body, new RegExp(`^# ${key}=$`, 'm'), key); // uncommenting gives an empty value, never the note
  }
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
