import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { runCli } from '../src/cli.js';
import { compareVersions } from '../src/doctor.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_SECRET = 'doctor-client-secret-VALUE';
const SESSION_SECRET = 'doctor-session-secret-0123456789abcdef-VALUE';

// The real workspace packages, injected as if resolved from the project.
const realPackages = async () => ({
  express: await import('../../express/src/index.js'),
  sdk: await import('../../voult-sdk/src/index.js'),
  versions: {
    express: JSON.parse(fs.readFileSync(path.join(here, '../../express/package.json'), 'utf8')).version,
    sdk: JSON.parse(fs.readFileSync(path.join(here, '../../voult-sdk/package.json'), 'utf8')).version,
  },
});

/** Fake Voult API: /api/meta + /api/apps/me, shaped per scenario. */
const api = { minSdkVersion: '0.1.3', app: null, rejectCredentials: false };
let server;
let baseURL;

before(async () => {
  server = http.createServer((req, res) => {
    const send = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (req.url === '/api/meta') return send(200, { version: '1.0.0', minSdkVersion: api.minSdkVersion, features: ['oauth-hosted'] });
    if (req.url === '/api/apps/me') {
      if (api.rejectCredentials || req.headers['x-client-secret'] !== CLIENT_SECRET) {
        return send(401, { error: { code: 'INVALID_CLIENT', message: 'Invalid client credentials', status: 401 } });
      }
      return send(200, api.app);
    }
    return send(404, { error: { code: 'NOT_FOUND', message: req.url, status: 404 } });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseURL = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

const goodApp = () => ({
  name: 'Doctor App',
  allowedCallbackUrls: ['http://localhost:3000/api/auth/oauth/callback'],
  providers: {
    google: { enabled: true, configured: true },
    github: { enabled: false, configured: false },
  },
});

function project(envLines) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'voult-doctor-'));
  if (envLines) fs.writeFileSync(path.join(dir, '.env'), `${envLines.join('\n')}\n`);
  return dir;
}

const baseEnv = () => [
  `VOULT_BASE_URL=${baseURL}`,
  'VOULT_CLIENT_ID=client-id',
  `VOULT_CLIENT_SECRET=${CLIENT_SECRET}`,
  `VOULT_SESSION_SECRET=${SESSION_SECRET}`,
];

/** Run `voult doctor` in a temp project; returns result + printed output. */
async function doctor(envLines, { args = [], env = {}, app = goodApp(), loadPackages = realPackages } = {}) {
  api.app = app;
  const logs = [];
  const cwd = project(envLines);
  try {
    const result = await runCli(['doctor', ...args], { cwd, env, log: (m) => logs.push(m), loadPackages });
    return { ...result, output: logs.join('\n'), byId: (id) => result.checks.find((c) => c.id === id) };
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
}

test('healthy project: every check passes, exit ok', async () => {
  const r = await doctor(baseEnv());
  assert.equal(r.ok, true, r.output);
  assert.deepEqual(r.checks.map((c) => [c.id, c.status]), [
    ['packages', 'pass'], ['env', 'pass'], ['session-secret', 'pass'], ['stray-env', 'pass'],
    ['reachable', 'pass'], ['version', 'pass'], ['credentials', 'pass'], ['callback', 'pass'], ['providers', 'pass'],
  ]);
  assert.match(r.byId('providers').message, /Ready: Google/);
});

test('never prints secret values (human and --json)', async () => {
  for (const args of [[], ['--json']]) {
    const r = await doctor(baseEnv(), { args });
    assert.ok(!r.output.includes(CLIENT_SECRET), 'client secret leaked');
    assert.ok(!r.output.includes(SESSION_SECRET), 'session secret leaked');
  }
});

test('--json prints { ok, checks } for CI', async () => {
  api.rejectCredentials = true;
  try {
    const r = await doctor(baseEnv(), { args: ['--json'] });
    const parsed = JSON.parse(r.output);
    assert.equal(parsed.ok, false);
    assert.ok(parsed.checks.every((c) => typeof c.id === 'string' && ['pass', 'warn', 'fail'].includes(c.status)));
  } finally {
    api.rejectCredentials = false;
  }
});

test('packages: missing @voult/express is caught with the install command', async () => {
  // null, not undefined: undefined would pick up the helper's default (the real packages).
  const r = await doctor(baseEnv(), { loadPackages: null });
  assert.equal(r.ok, false);
  assert.equal(r.byId('packages').status, 'fail');
  assert.match(r.byId('packages').fix, /npm install @voult\/express @voult\/sdk/);
  assert.equal(r.checks.length, 1, 'later checks are skipped');
});

test('env: a missing client ID fails with the server\'s own message', async () => {
  const r = await doctor(baseEnv().filter((l) => !l.startsWith('VOULT_CLIENT_ID')));
  assert.equal(r.byId('env').status, 'fail');
  assert.match(r.byId('env').message, /Missing VOULT_CLIENT_ID/);
});

test('env: no .env at all points to voult init', async () => {
  const r = await doctor(null);
  assert.equal(r.byId('env').status, 'fail');
  assert.match(r.byId('env').fix, /npx voult init/);
});

test('reachable: a wrong VOULT_BASE_URL fails and stops the API checks', async () => {
  const lines = baseEnv().map((l) => (l.startsWith('VOULT_BASE_URL') ? 'VOULT_BASE_URL=http://127.0.0.1:9' : l));
  const r = await doctor(lines);
  assert.equal(r.byId('reachable').status, 'fail');
  assert.equal(r.byId('credentials'), undefined);
});

test('version: SDK older than the API supports', async () => {
  api.minSdkVersion = '9.0.0';
  try {
    const r = await doctor(baseEnv());
    assert.equal(r.byId('version').status, 'fail');
    assert.match(r.byId('version').fix, /@voult\/sdk@latest/);
  } finally {
    api.minSdkVersion = '0.1.3';
  }
});

test('version: an SDK without doctor support (pre-0.2) is reported, not crashed on', async () => {
  const r = await doctor(baseEnv(), {
    loadPackages: async () => {
      const real = await realPackages();
      const { getApiMeta, getAppInfo, ...oldSdk } = real.sdk;
      return { ...real, sdk: oldSdk, versions: { ...real.versions, sdk: '0.1.4' } };
    },
  });
  assert.equal(r.byId('version').status, 'fail');
  assert.match(r.byId('version').message, /0\.1\.4 is too old/);
});

test('credentials: rejected client secret', async () => {
  const lines = baseEnv().map((l) => (l.startsWith('VOULT_CLIENT_SECRET') ? 'VOULT_CLIENT_SECRET=wrong' : l));
  const r = await doctor(lines);
  assert.equal(r.byId('credentials').status, 'fail');
  assert.match(r.byId('credentials').fix, /dashboard/);
});

test('callback: not on the allowlist → fail with the exact URL to add', async () => {
  const r = await doctor([...baseEnv(), 'PORT=4000']);
  assert.equal(r.byId('callback').status, 'fail');
  assert.match(r.byId('callback').message, /http:\/\/localhost:4000\/api\/auth\/oauth\/callback is not on the app's allowlist \(assumed from PORT/);
});

test('callback: --callback-url and VOULT_OAUTH_CALLBACK_URL are honoured', async () => {
  const app = { ...goodApp(), allowedCallbackUrls: ['https://api.myapp.test/api/auth/oauth/callback'] };
  const viaFlag = await doctor(baseEnv(), { app, args: ['--callback-url', 'https://api.myapp.test/api/auth/oauth/callback'] });
  assert.equal(viaFlag.byId('callback').status, 'pass');
  const viaEnv = await doctor([...baseEnv(), 'VOULT_OAUTH_CALLBACK_URL=https://api.myapp.test/api/auth/oauth/callback'], { app });
  assert.equal(viaEnv.byId('callback').status, 'pass');
});

test('callback: empty allowlist + localhost is a warning (works locally, not in production)', async () => {
  const r = await doctor(baseEnv(), { app: { ...goodApp(), allowedCallbackUrls: [] } });
  assert.equal(r.byId('callback').status, 'warn');
  assert.equal(r.ok, true);
});

test('https: production callback over http fails', async () => {
  const url = 'http://api.myapp.test/api/auth/oauth/callback';
  const r = await doctor([...baseEnv(), 'NODE_ENV=production', `VOULT_OAUTH_CALLBACK_URL=${url}`], {
    app: { ...goodApp(), allowedCallbackUrls: [url] },
  });
  assert.equal(r.byId('https').status, 'fail');
});

test('providers: enabled without credentials fails; none enabled warns', async () => {
  const broken = await doctor(baseEnv(), {
    app: { ...goodApp(), providers: { google: { enabled: true, configured: false } } },
  });
  assert.equal(broken.byId('providers').status, 'fail');
  assert.match(broken.byId('providers').message, /Google sign-in is on but missing credentials/);

  const none = await doctor(baseEnv(), { app: { ...goodApp(), providers: { google: { enabled: false, configured: true } } } });
  assert.equal(none.byId('providers-none').status, 'warn');
});

test('stray-env: provider keys in .env warn by name; machine-wide vars are ignored', async () => {
  const r = await doctor([...baseEnv(), 'GOOGLE_CLIENT_SECRET=should-not-print', 'GITHUB_CLIENT_ID=x'], {
    env: { GOOGLE_APPLICATION_CREDENTIALS: '/gcp/key.json' },
  });
  const check = r.byId('stray-env');
  assert.equal(check.status, 'warn');
  assert.match(check.message, /GOOGLE_CLIENT_SECRET/);
  assert.match(check.message, /GITHUB_CLIENT_ID/);
  assert.doesNotMatch(check.message, /GOOGLE_APPLICATION_CREDENTIALS/);
  assert.ok(!r.output.includes('should-not-print'));
});

test('session-secret: missing in development warns; short in production fails', async () => {
  const dev = await doctor(baseEnv().filter((l) => !l.startsWith('VOULT_SESSION_SECRET')));
  assert.equal(dev.byId('session-secret').status, 'warn');

  const prod = await doctor([
    ...baseEnv().filter((l) => !l.startsWith('VOULT_SESSION_SECRET')), 'VOULT_SESSION_SECRET=short', 'NODE_ENV=production',
  ]);
  assert.equal(prod.byId('session-secret').status, 'fail');
});

test('process env wins over .env (like dotenv)', async () => {
  const r = await doctor(baseEnv().map((l) => (l.startsWith('VOULT_CLIENT_SECRET') ? 'VOULT_CLIENT_SECRET=wrong' : l)), {
    env: { VOULT_CLIENT_SECRET: CLIENT_SECRET },
  });
  assert.equal(r.byId('credentials').status, 'pass');
});

test('compareVersions', () => {
  assert.ok(compareVersions('0.2.0', '0.1.3') > 0);
  assert.ok(compareVersions('0.1.3', '0.1.3') === 0);
  assert.ok(compareVersions('0.1.10', '0.1.9') > 0);
  assert.ok(compareVersions('1.0.0-beta.1', '1.0.0') === 0);
});

test('bin: exits 1 when a check fails, prints help for doctor --help', async () => {
  const bin = path.join(here, '../bin/voult.js');
  const cwd = project(['VOULT_BASE_URL=http://127.0.0.1:9', 'VOULT_CLIENT_ID=x', 'VOULT_CLIENT_SECRET=y']);
  try {
    const code = await new Promise((resolve) => execFile(process.execPath, [bin, 'doctor'], { cwd, env: { PATH: process.env.PATH } }, (err) => resolve(err?.code ?? 0)));
    assert.equal(code, 1);
    const help = await new Promise((resolve) => execFile(process.execPath, [bin, 'doctor', '--help'], (_e, stdout) => resolve(stdout)));
    assert.match(help, /voult doctor \[--json\]/);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});
