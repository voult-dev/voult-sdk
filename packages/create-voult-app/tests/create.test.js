import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';
import { TEMPLATES, createVoultApp, detectPackageManager } from '../src/index.js';
import { bundleTemplates, templatesDir } from '../src/templates.js';

let cwd;
beforeEach(() => { cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'create-voult-app-')); });
afterEach(() => fs.rmSync(cwd, { recursive: true, force: true }));

/** No prompts, no real installs: records what would run. */
function io(extra = {}) {
  const calls = [];
  const logs = [];
  return {
    calls,
    logs,
    io: {
      cwd,
      log: (s) => logs.push(s),
      ask: async (_q, fallback) => fallback,
      run: (cmd, args, opts) => { calls.push({ cmd, args, opts }); return { status: 0 }; },
      env: {},
      ...extra,
    },
  };
}

const read = (...p) => fs.readFileSync(path.join(cwd, ...p), 'utf8');

for (const template of Object.keys(TEMPLATES)) {
  test(`${template}: copies the template, names the project, restores dotfiles`, async () => {
    const t = io();
    const result = await createVoultApp([`My App ${template}`, '--template', template, '--no-install'], t.io);
    const dir = `My App ${template}`;
    assert.equal(result.template, template);
    assert.equal(JSON.parse(read(dir, 'package.json')).name, `my-app-${template}`);
    assert.ok(fs.existsSync(path.join(cwd, dir, '.gitignore')), '.gitignore restored');
    assert.ok(fs.existsSync(path.join(cwd, dir, '.env.example')), '.env.example restored');
    assert.ok(!fs.existsSync(path.join(cwd, dir, '_gitignore')));
    assert.ok(!fs.existsSync(path.join(cwd, dir, 'node_modules')));
    assert.ok(!fs.existsSync(path.join(cwd, dir, '.env')), 'never ships a .env');
    assert.match(read(dir, '.gitignore'), /^\.env$/m);
    assert.deepEqual(t.calls, [], '--no-install runs nothing');
    assert.ok(t.logs.join('\n').includes(TEMPLATES[template].callback));
  });
}

test('the templates have no auth route handlers of their own (the router serves them)', () => {
  const backend = path.join(templatesDir(), 'express-react', 'backend');
  const auth = fs.readFileSync(path.join(backend, 'auth.js'), 'utf8');
  assert.match(auth, /app\.use\('\/api\/auth', createVoultRouter\(\)\)/);
  const api = fs.readFileSync(path.join(backend, 'api.js'), 'utf8');
  assert.equal((api.match(/api\.(get|post|put|patch|delete)\(/g) ?? []).length, 1, 'only the /api/me example');
  assert.ok(fs.existsSync(path.join(templatesDir(), 'express-react', 'frontend', 'src', 'auth', 'SignIn.jsx')));
  const nextRoutes = fs.readdirSync(path.join(templatesDir(), 'nextjs', 'app', 'api'));
  assert.deepEqual(nextRoutes.sort(), ['auth', 'me']);
});

test('npm start works on hosts without a .env file (no --env-file in any script)', () => {
  for (const template of Object.keys(TEMPLATES)) {
    const { scripts } = JSON.parse(fs.readFileSync(path.join(templatesDir(), template, 'package.json'), 'utf8'));
    assert.doesNotMatch(Object.values(scripts).join(' '), /--env-file=/, template);
  }
});

test('refuses a folder that exists and is not empty', async () => {
  fs.mkdirSync(path.join(cwd, 'taken'));
  fs.writeFileSync(path.join(cwd, 'taken', 'file.txt'), 'x');
  await assert.rejects(() => createVoultApp(['taken', '--template', 'minimal', '--no-install'], io().io), /already exists and isn't empty/);
});

test('an empty existing folder is fine', async () => {
  fs.mkdirSync(path.join(cwd, 'empty'));
  await createVoultApp(['empty', '--template', 'minimal', '--no-install'], io().io);
  assert.ok(fs.existsSync(path.join(cwd, 'empty', 'server.js')));
});

test('rejects an unknown template', async () => {
  await assert.rejects(() => createVoultApp(['x', '--template', 'vue', '--no-install'], io().io), /Unknown template "vue"/);
});

test('installs with the package manager that ran it, then voult init --yes with the secret in the environment only', async () => {
  const t = io({ env: { npm_config_user_agent: 'pnpm/9.12.0 npm/? node/v24.0.0 darwin arm64' } });
  const result = await createVoultApp(['app', '--template', 'nextjs', '--client-id', 'cid_1', '--client-secret', 'top-secret'], t.io);
  assert.equal(result.packageManager, 'pnpm');
  assert.equal(result.initialized, true);
  const [install, init] = t.calls;
  assert.deepEqual([install.cmd, install.args], ['pnpm', ['install']]);
  assert.deepEqual([init.cmd, init.args], ['pnpm', ['exec', 'voult', 'init', '--yes', '--quiet', '--client-id', 'cid_1']]);
  assert.equal(init.opts.env.VOULT_CLIENT_SECRET, 'top-secret');
  assert.ok(!JSON.stringify(init.args).includes('top-secret'), 'secret never on the command line');
  assert.ok(!t.logs.join('\n').includes('top-secret'), 'secret never printed');
  assert.ok(t.logs.join('\n').includes('pnpm run dev'));
  assert.ok(t.logs.join('\n').includes('pnpm run doctor'), 'not "pnpm doctor": that runs pnpm\'s own doctor');
});

test('without credentials it installs but tells you to run voult init', async () => {
  const t = io();
  const result = await createVoultApp(['app', '--template', 'express-react'], t.io);
  assert.equal(result.initialized, false);
  assert.equal(t.calls.length, 1);
  assert.match(t.logs.join('\n'), /npx voult init/);
});

test('the voult init hint uses the package manager that ran it', async () => {
  const t = io({ env: { npm_config_user_agent: 'pnpm/12.14.0 npm/? node/v24' } });
  await createVoultApp(['app', '--template', 'minimal'], t.io);
  assert.match(t.logs.join('\n'), /pnpm exec voult init/);
});

test('a failed install stops with a clear message', async () => {
  const t = io({ run: () => ({ status: 1 }) });
  await assert.rejects(() => createVoultApp(['app', '--template', 'minimal'], t.io), /npm install failed/);
});

test('detectPackageManager reads npm_config_user_agent', () => {
  assert.equal(detectPackageManager('yarn/4.5.0 npm/? node/v24'), 'yarn');
  assert.equal(detectPackageManager('bun/1.2.0'), 'bun');
  assert.equal(detectPackageManager('npm/11.0.0 node/v24'), 'npm');
  assert.equal(detectPackageManager(''), 'npm');
});

test('bundling pins every @voult/* dependency to the released versions', () => {
  const out = path.join(cwd, 'bundled');
  const versions = { '@voult/express': '9.1.0', '@voult/react': '9.2.0', '@voult/sdk': '9.3.0', '@voult/next': '9.4.0', '@voult/cli': '9.5.0' };
  bundleTemplates(templatesDir(), out, versions);
  for (const template of Object.keys(TEMPLATES)) {
    const manifest = JSON.parse(fs.readFileSync(path.join(out, template, 'package.json'), 'utf8'));
    for (const [dep, range] of Object.entries({ ...manifest.dependencies, ...manifest.devDependencies })) {
      if (dep.startsWith('@voult/')) assert.equal(range, `^${versions[dep]}`, `${template} ${dep}`);
    }
    assert.ok(!fs.existsSync(path.join(out, template, 'node_modules')));
  }
});
