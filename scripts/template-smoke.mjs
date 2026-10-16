#!/usr/bin/env node
// Template smoke test (CI job "templates", and locally):
//   node scripts/template-smoke.mjs <express-react|nextjs|minimal> [--keep]
// Packs every package, scaffolds the template with the PACKED create-voult-app, installs the app
// from the local tarballs, writes .env with `voult init --yes` against the SDK's fake Voult,
// builds, starts it, and runs password sign-in → /session → sign-out through its own server.
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startTestServer } from '../packages/voult-sdk/tests/support/test-server.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const template = process.argv[2];
const keep = process.argv.includes('--keep');
if (!['express-react', 'nextjs', 'minimal'].includes(template)) {
  console.error('Usage: node scripts/template-smoke.mjs <express-react|nextjs|minimal> [--keep]');
  process.exit(2);
}

const step = (text) => console.log(`\n▸ ${text}`);
const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: 'inherit', ...opts });
const fail = (text) => { throw new Error(text); };

const work = fs.mkdtempSync(path.join(os.tmpdir(), `voult-smoke-${template}-`));
const packs = path.join(work, 'packs');
const app = path.join(work, 'app');
fs.mkdirSync(packs);
let server;
let fake;

try {
  step('Packing every package');
  const tarballs = {};
  for (const dir of fs.readdirSync(path.join(ROOT, 'packages'))) {
    const cwd = path.join(ROOT, 'packages', dir);
    if (!fs.existsSync(path.join(cwd, 'package.json'))) continue;
    const [info] = JSON.parse(execFileSync('npm', ['pack', '--json', '--pack-destination', packs], { cwd, encoding: 'utf8' }));
    tarballs[info.name] = path.join(packs, info.filename);
    console.log(`  ${info.name}@${info.version}`);
  }

  step(`Scaffolding ${template} with the packed create-voult-app`);
  sh('npm', ['exec', '--yes', '--package', tarballs['create-voult-app'], '--', 'create-voult-app', 'app', '--template', template, '--no-install'], { cwd: work });

  step('Installing the app from the local tarballs');
  const manifestPath = path.join(app, 'package.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const local = Object.fromEntries(Object.entries(tarballs).filter(([name]) => name.startsWith('@voult/')).map(([name, file]) => [name, `file:${file}`]));
  for (const field of ['dependencies', 'devDependencies']) {
    for (const dep of Object.keys(manifest[field] ?? {})) if (local[dep]) manifest[field][dep] = local[dep];
  }
  manifest.overrides = local; // transitive @voult/* (e.g. express → core) come from the tarballs too
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  sh('npm', ['install', '--no-audit', '--no-fund'], { cwd: app });

  fake = await startTestServer();
  step(`Writing .env with voult init --yes (fake Voult at ${fake.baseURL})`);
  sh('npx', ['voult', 'init', '--yes', '--quiet', '--client-id', 'client-id', '--base-url', fake.baseURL], {
    cwd: app,
    env: { ...process.env, VOULT_CLIENT_SECRET: 'client-secret' },
  });
  const env = fs.readFileSync(path.join(app, '.env'), 'utf8');
  if (!/^VOULT_SESSION_SECRET=[0-9a-f]{64}$/m.test(env) || !/^VOULT_CLIENT_SECRET=client-secret$/m.test(env)) fail('.env is missing values');

  if (manifest.scripts.build) {
    step('Building');
    sh('npm', ['run', 'build'], { cwd: app, env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' } });
  }

  const port = await new Promise((resolve) => {
    const probe = net.createServer().listen(0, () => { const { port: p } = probe.address(); probe.close(() => resolve(p)); });
  });
  step(`Starting the app on :${port}`);
  server = spawn('npm', ['start'], { cwd: app, env: { ...process.env, PORT: String(port), NEXT_TELEMETRY_DISABLED: '1' }, stdio: 'inherit', detached: true });
  const base = `http://localhost:${port}`;
  const deadline = Date.now() + 90_000;
  for (;;) {
    try { if ((await fetch(base)).ok) break; } catch { /* not up yet */ }
    if (Date.now() > deadline) fail('the app did not answer on / within 90 s');
    await new Promise((r) => setTimeout(r, 500));
  }

  step('Sign-in → /session → sign-out, through the app’s own server');
  const jar = new Map();
  const call = async (pathname, init = {}) => {
    const res = await fetch(base + pathname, {
      redirect: 'manual',
      ...init,
      headers: { ...(init.body && { 'content-type': 'application/json' }), cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '), ...init.headers },
    });
    for (const line of res.headers.getSetCookie()) {
      const [pair] = line.split(';');
      const i = pair.indexOf('=');
      if (/expires=Thu, 01 Jan 1970/i.test(line) || i === pair.length - 1) jar.delete(pair.slice(0, i));
      else jar.set(pair.slice(0, i), pair.slice(i + 1));
    }
    return res;
  };
  const expect = (ok, text) => { if (!ok) fail(text); console.log(`  ✓ ${text}`); };

  expect((await (await call('/api/auth/session')).json()).authenticated === false, 'signed out at first');
  const login = await call('/api/auth/email-login', { method: 'POST', body: JSON.stringify({ email: 'user@example.com', password: 'StrongPass123!' }) });
  expect(login.status === 200 && jar.has('voult_access'), 'password sign-in sets the session cookies');
  const session = await (await call('/api/auth/session')).json();
  expect(session.authenticated === true && session.user?.email === 'user@example.com', '/session reports the signed-in user');
  if (template !== 'minimal') {
    const me = await call('/api/me');
    expect(me.status === 200 && (await me.json()).user?.email === 'user@example.com', 'the app’s own protected route (/api/me) sees the user');
  }
  if (template === 'nextjs') {
    const account = await call('/account');
    expect(account.status === 200 && (await account.text()).includes('user@example.com'), 'requireSession(): /account renders for the user');
  }
  expect((await call('/api/auth/logout', { method: 'POST' })).status === 200, 'sign-out answers 200');
  expect((await (await call('/api/auth/session')).json()).authenticated === false, 'signed out again');
  if (template === 'nextjs') {
    const guarded = await call('/account');
    expect([307, 308].includes(guarded.status) && guarded.headers.get('location').includes('/login'), 'signed out, /account redirects to /login');
  }
  if (template !== 'minimal') {
    expect((await call('/api/me')).status === 401, 'signed out, /api/me is 401');
  }

  console.log(`\n✔ ${template}: scaffolded, installed from the packed packages, built, booted, signed in and out`);
} catch (err) {
  console.error(`\n✖ ${template}: ${err.message}`);
  process.exitCode = 1;
} finally {
  if (server) { try { process.kill(-server.pid); } catch { /* already gone */ } }
  fake?.server.close();
  if (keep) console.log(`kept ${work}`); else fs.rmSync(work, { recursive: true, force: true });
}
