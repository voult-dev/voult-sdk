import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, afterEach, before, test } from 'node:test';
import { DEFAULT_VOULT_URL, runInit } from '../src/init.js';
import { DEFAULT_BASE_URL } from '../../voult-sdk/src/constants.js';

let cwd;

before(() => {
  cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'voult-cli-'));
});

after(() => {
  fs.rmSync(cwd, { recursive: true, force: true });
});

afterEach(() => {
  for (const file of ['.env', '.env.example']) {
    fs.rmSync(path.join(cwd, file), { force: true });
  }
});

function fakeIo({ answers = {}, secret = 'shh-secret' } = {}) {
  const logs = [];
  return {
    io: {
      cwd,
      log: (msg) => logs.push(msg),
      ask: async (question) => ({ VOULT_CLIENT_ID: 'app_123', ...answers })[question] ?? '',
      askSecret: async () => secret,
    },
    logs,
  };
}

test('writes .env with prompted values and a generated session secret for the cookie strategy', async () => {
  const { io } = fakeIo({
    answers: {
      VOULT_CLIENT_ID: 'app_123',
      'Session strategy — cookie or bearer': 'cookie',
    },
  });

  const result = await runInit([], io);

  assert.equal(result.wrote, true);
  assert.equal(result.strategy, 'cookie');

  const env = fs.readFileSync(path.join(cwd, '.env'), 'utf8');
  assert.match(env, /VOULT_CLIENT_ID=app_123/);
  assert.match(env, /VOULT_CLIENT_SECRET=shh-secret/);
  assert.match(env, /VOULT_SESSION_SECRET=[0-9a-f]{64}/);
  assert.doesNotMatch(env, /VOULT_SESSION_STRATEGY/); // cookie is the default: not written

  const example = fs.readFileSync(path.join(cwd, '.env.example'), 'utf8');
  assert.doesNotMatch(example, /shh-secret/);
  assert.match(example, /^VOULT_CLIENT_SECRET=$/m);
});

test('does not prompt for or write VOULT_BASE_URL — @voult/express defaults it', async () => {
  const { io, logs } = fakeIo({
    answers: { VOULT_CLIENT_ID: 'app_123', 'Session strategy — cookie or bearer': 'cookie' },
  });

  await runInit([], io);

  const env = fs.readFileSync(path.join(cwd, '.env'), 'utf8');
  assert.doesNotMatch(env, /VOULT_BASE_URL/);
  assert.ok(logs.some((line) => line.includes('VOULT_BASE_URL was not written')));

  // .env.example still lists it as an available (optional) override, commented out.
  const example = fs.readFileSync(path.join(cwd, '.env.example'), 'utf8');
  assert.match(example, /^# VOULT_BASE_URL=$/m);
});

test('bearer strategy skips generating a session secret', async () => {
  const { io } = fakeIo({
    answers: { 'Session strategy — cookie or bearer': 'bearer' },
  });

  const result = await runInit([], io);

  assert.equal(result.strategy, 'bearer');
  const env = fs.readFileSync(path.join(cwd, '.env'), 'utf8');
  assert.match(env, /^VOULT_SESSION_STRATEGY=bearer$/m);
  assert.doesNotMatch(env, /VOULT_SESSION_SECRET/);
});

test('refuses to overwrite an existing .env without --force', async () => {
  fs.writeFileSync(path.join(cwd, '.env'), 'VOULT_CLIENT_ID=already-here\n');
  const { io, logs } = fakeIo();

  const result = await runInit([], io);

  assert.equal(result.wrote, false);
  assert.ok(logs.some((line) => line.includes('--force')));
  assert.equal(fs.readFileSync(path.join(cwd, '.env'), 'utf8'), 'VOULT_CLIENT_ID=already-here\n');
});

test('--force overwrites an existing .env', async () => {
  fs.writeFileSync(path.join(cwd, '.env'), 'VOULT_CLIENT_ID=stale\n');
  const { io } = fakeIo({ answers: { VOULT_CLIENT_ID: 'fresh' } });

  const result = await runInit(['--force'], io);

  assert.equal(result.wrote, true);
  const env = fs.readFileSync(path.join(cwd, '.env'), 'utf8');
  assert.match(env, /VOULT_CLIENT_ID=fresh/);
});

test('never logs the client secret value', async () => {
  const { io, logs } = fakeIo({ secret: 'super-secret-value' });

  await runInit([], io);

  assert.ok(logs.every((line) => !line.includes('super-secret-value')));
});

test('points at the same Voult as @voult/sdk (dashboard link can\'t drift)', async () => {
  assert.equal(DEFAULT_VOULT_URL, DEFAULT_BASE_URL);
  const { io, logs } = fakeIo({ answers: { VOULT_CLIENT_ID: 'app_123' } });
  await runInit(['--force'], io);
  assert.ok(logs.some((line) => line.includes(`${DEFAULT_BASE_URL}/dashboard`)));
});

// --yes: no prompts (create-voult-app and CI run it this way).
const noPrompts = () => ({
  cwd,
  log: (msg) => noPrompts.logs.push(msg),
  env: {},
  ask: async () => { throw new Error('prompted for text'); },
  askSecret: async () => { throw new Error('prompted for a secret'); },
});
noPrompts.logs = [];

test('--yes with flags writes .env without prompting and never prints the secret', async () => {
  noPrompts.logs = [];
  const result = await runInit(['--yes', '--client-id', 'cid_123', '--client-secret=super-secret-value', '--base-url', 'http://127.0.0.1:4100'], noPrompts());
  assert.deepEqual(result, { wrote: true, strategy: 'cookie' });
  const env = fs.readFileSync(path.join(cwd, '.env'), 'utf8');
  assert.match(env, /^VOULT_BASE_URL=http:\/\/127\.0\.0\.1:4100$/m);
  assert.match(env, /^VOULT_CLIENT_ID=cid_123$/m);
  assert.match(env, /^VOULT_CLIENT_SECRET=super-secret-value$/m);
  assert.match(env, /^VOULT_SESSION_SECRET=[0-9a-f]{64}$/m);
  assert.ok(!noPrompts.logs.join('\n').includes('super-secret-value'));
});

test('--yes takes the secret from VOULT_CLIENT_SECRET (keeps it out of shell history)', async () => {
  await runInit(['--yes', '--client-id', 'cid_123', '--quiet'], { ...noPrompts(), env: { VOULT_CLIENT_SECRET: 'from-env' } });
  assert.match(fs.readFileSync(path.join(cwd, '.env'), 'utf8'), /^VOULT_CLIENT_SECRET=from-env$/m);
});

test('--yes without credentials fails clearly and writes nothing', async () => {
  await assert.rejects(() => runInit(['--yes'], noPrompts()), /With --yes, pass --client-id and --client-secret/);
  assert.ok(!fs.existsSync(path.join(cwd, '.env')));
});

test('flags without --yes skip only their own prompt', async () => {
  const asked = [];
  await runInit(['--client-id', 'cid_flag'], {
    cwd, log: () => {}, env: {},
    ask: async (q) => { asked.push(q); return ''; },
    askSecret: async (q) => { asked.push(q); return 'typed-secret'; },
  });
  assert.deepEqual(asked, ['VOULT_CLIENT_SECRET', 'Session strategy — cookie or bearer']);
  assert.match(fs.readFileSync(path.join(cwd, '.env'), 'utf8'), /^VOULT_CLIENT_ID=cid_flag$/m);
});
