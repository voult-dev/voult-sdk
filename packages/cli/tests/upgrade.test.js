import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';
import { gzipSync } from 'node:zlib';
import { runCli } from '../src/cli.js';
import { changelogBetween, detectPackageManager, readTarball } from '../src/upgrade.js';

/** A minimal ustar .tgz, the shape npm publishes. */
function tgz(files) {
  const blocks = [];
  for (const [name, content] of Object.entries(files)) {
    const body = Buffer.from(content);
    const header = Buffer.alloc(512);
    header.write(name, 0);
    header.write('0000644\0', 100);
    header.write(`${body.length.toString(8).padStart(11, '0')}\0`, 124);
    header.write('0', 156);
    header.write('ustar\0', 257);
    blocks.push(header, body, Buffer.alloc((512 - (body.length % 512)) % 512));
  }
  return gzipSync(Buffer.concat([...blocks, Buffer.alloc(1024)]));
}

const EXPRESS_CHANGELOG = `# Changelog

## 0.4.0

- **Breaking: error \`code\`s are the Voult API's** (see ERRORS.md).
- Internal errors are logged on the server.

## 0.3.0

Intro paragraph that says **Breaking** changes are marked.

- Every end-user feature is a router route.

## 0.2.1

- Old fix.
`;

/** Fake registry: create-voult-app pins express 0.4.0, sdk 0.2.2, cli 0.3.0. */
function registry() {
  const R = 'https://registry.test';
  const template = (deps, devDeps) => JSON.stringify({ dependencies: deps, devDependencies: devDeps });
  const routes = {
    [`${R}/create-voult-app/latest`]: { version: '0.1.4', dist: { tarball: `${R}/cva.tgz` } },
    [`${R}/cva.tgz`]: tgz({
      'package/templates/express-react/package.json': template({ '@voult/express': '^0.4.0', '@voult/sdk': '^0.2.2', '@voult/react': '^0.2.0' }, { '@voult/cli': '^0.3.0' }),
      'package/templates/nextjs/package.json': template({ '@voult/next': '^0.2.0' }, {}),
      'package/README.md': 'x',
    }),
    [`${R}/@voult/express/0.4.0`]: { dist: { tarball: `${R}/express.tgz` } },
    [`${R}/express.tgz`]: tgz({ 'package/CHANGELOG.md': EXPRESS_CHANGELOG }),
    [`${R}/@voult/sdk/0.2.2`]: { dist: { tarball: `${R}/sdk.tgz` } },
    [`${R}/sdk.tgz`]: tgz({ 'package/CHANGELOG.md': '## 0.2.2\n\n- Password rule matches the API.\n\n## 0.2.1\n\n- Old.\n' }),
    [`${R}/@voult/cli/0.3.0`]: { dist: { tarball: `${R}/cli.tgz` } },
    [`${R}/cli.tgz`]: tgz({ 'package/CHANGELOG.md': '## 0.3.0\n\n- voult upgrade.\n' }),
    [`${R}/@voult/core/latest`]: { version: '0.3.0' },
  };
  const requested = [];
  const fetch = async (url) => {
    requested.push(url);
    const body = routes[url];
    if (!body) return { ok: false, status: 404 };
    return Buffer.isBuffer(body)
      ? { ok: true, arrayBuffer: async () => body }
      : { ok: true, json: async () => body };
  };
  return { fetch, requested, env: { npm_config_registry: R } };
}

let cwd;
beforeEach(() => { cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'voult-upgrade-')); });
afterEach(() => fs.rmSync(cwd, { recursive: true, force: true }));

function app({ deps = {}, devDeps = {}, installed = {}, lockfile } = {}) {
  fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ name: 'app', dependencies: deps, devDependencies: devDeps }));
  for (const [name, version] of Object.entries(installed)) {
    fs.mkdirSync(path.join(cwd, 'node_modules', name), { recursive: true });
    fs.writeFileSync(path.join(cwd, 'node_modules', name, 'package.json'), JSON.stringify({ name, version }));
  }
  if (lockfile) fs.writeFileSync(path.join(cwd, lockfile), '');
}

async function upgrade(args = [], extra = {}) {
  const reg = registry();
  const logs = [];
  const calls = [];
  const doctorCalls = [];
  const result = await runCli(['upgrade', ...args], {
    cwd,
    env: reg.env,
    fetch: reg.fetch,
    log: (m) => logs.push(m),
    run: (cmd, a, opts) => { calls.push([cmd, ...a]); return { status: 0 }; },
    doctor: async (argv, io) => { doctorCalls.push(io.cwd); return { ok: true }; },
    ...extra,
  });
  return { result, output: logs.join('\n'), calls, doctorCalls, requested: reg.requested };
}

test('readTarball reads files out of an npm-style .tgz', () => {
  const files = readTarball(tgz({ 'package/a.txt': 'hello', 'package/b.txt': 'x'.repeat(700) }), () => true);
  assert.equal(files.get('package/a.txt'), 'hello');
  assert.equal(files.get('package/b.txt').length, 700);
});

test('changelogBetween: newer than from, up to to, Breaking split out, prose ignored', () => {
  const sections = changelogBetween(EXPRESS_CHANGELOG, '0.2.1', '0.4.0');
  assert.deepEqual(sections.map((s) => s.version), ['0.4.0', '0.3.0']);
  assert.equal(sections[0].breaking.length, 1);
  assert.match(sections[0].breaking[0], /error `code`s/);
  assert.deepEqual(sections[1].breaking, [], 'an intro line mentioning **Breaking** is not a change');
  assert.deepEqual(changelogBetween(EXPRESS_CHANGELOG, '0.4.0', '0.4.0'), []);
});

test('detectPackageManager reads the lockfile', () => {
  assert.equal(detectPackageManager(cwd), 'npm');
  fs.writeFileSync(path.join(cwd, 'pnpm-lock.yaml'), '');
  assert.equal(detectPackageManager(cwd), 'pnpm');
});

test('upgrades to the create-voult-app set, Breaking first, installs deps and dev deps, runs doctor', async () => {
  app({
    deps: { '@voult/express': '^0.3.0', '@voult/sdk': '^0.2.1', express: '^5.0.0' },
    devDeps: { '@voult/cli': '^0.2.5' },
    installed: { '@voult/express': '0.3.0', '@voult/sdk': '0.2.1', '@voult/cli': '0.2.5' },
  });
  const r = await upgrade();
  assert.deepEqual(r.result.plan.map((p) => [p.name, p.from, p.to]), [
    ['@voult/express', '0.3.0', '0.4.0'], ['@voult/sdk', '0.2.1', '0.2.2'], ['@voult/cli', '0.2.5', '0.3.0'],
  ]);
  assert.match(r.output, /@voult\/express {2}0\.3\.0 → 0\.4\.0/);
  assert.match(r.output, /⚠ BREAKING \(0\.4\.0\): \*\*Breaking: error `code`s/);
  assert.ok(r.output.indexOf('BREAKING') < r.output.indexOf('Internal errors are logged'), 'Breaking before the rest');
  assert.doesNotMatch(r.output, /0\.3\.0: Every end-user/, '0.3.0 is the installed version, not new');
  assert.match(r.output, /1 breaking change\(s\) above/);
  assert.deepEqual(r.calls, [
    ['npm', 'install', '@voult/express@^0.4.0', '@voult/sdk@^0.2.2'],
    ['npm', 'install', '-D', '@voult/cli@^0.3.0'],
  ]);
  assert.deepEqual(r.doctorCalls, [cwd]);
  assert.equal(r.result.ok, true);
});

test('--dry-run prints the plan and notes but installs nothing and skips doctor', async () => {
  app({ deps: { '@voult/express': '^0.3.0' }, installed: { '@voult/express': '0.3.0' } });
  const r = await upgrade(['--dry-run']);
  assert.match(r.output, /BREAKING/);
  assert.match(r.output, /Dry run, nothing installed\. It would run:\n {2}npm install @voult\/express@\^0\.4\.0/);
  assert.deepEqual(r.calls, []);
  assert.deepEqual(r.doctorCalls, []);
});

test('uses the project\'s package manager', async () => {
  for (const [lockfile, expected] of [['pnpm-lock.yaml', ['pnpm', 'add']], ['yarn.lock', ['yarn', 'add']]]) {
    fs.rmSync(cwd, { recursive: true, force: true });
    fs.mkdirSync(cwd);
    app({ deps: { '@voult/sdk': '^0.2.1' }, lockfile });
    const r = await upgrade();
    assert.deepEqual(r.calls, [[...expected, '@voult/sdk@^0.2.2']]);
  }
});

test('already on the latest set: says so, installs nothing', async () => {
  app({ deps: { '@voult/express': '^0.4.0' }, installed: { '@voult/express': '0.4.0' } });
  const r = await upgrade();
  assert.match(r.output, /latest set \(create-voult-app 0\.1\.4\)\. Nothing to do/);
  assert.deepEqual(r.calls, []);
});

test('a package the templates don\'t pin uses its latest release; workspace/file specs are skipped', async () => {
  app({ deps: { '@voult/core': '^0.2.0', '@voult/next': 'workspace:*' } });
  const r = await upgrade(['--dry-run']);
  assert.deepEqual(r.result.plan.map((p) => [p.name, p.to]), [['@voult/core', '0.3.0']]);
  assert.match(r.output, /Skipping @voult\/next \(workspace:\*\)/);
});

test('a failed install stops before doctor with a clear message', async () => {
  app({ deps: { '@voult/sdk': '^0.2.1' } });
  await assert.rejects(() => upgrade([], { run: () => ({ status: 1 }) }), /npm failed\. Nothing else was changed/);
});

test('no package.json, or no @voult packages, fails clearly', async () => {
  await assert.rejects(() => upgrade(), /No package\.json here/);
  app({ deps: { express: '^5.0.0' } });
  await assert.rejects(() => upgrade(), /No @voult\/\* packages/);
});

test('never edits app code: only the package manager touches the project', async () => {
  app({ deps: { '@voult/sdk': '^0.2.1' } });
  fs.writeFileSync(path.join(cwd, 'server.js'), 'original');
  const before = fs.readFileSync(path.join(cwd, 'package.json'), 'utf8');
  await upgrade();
  assert.equal(fs.readFileSync(path.join(cwd, 'server.js'), 'utf8'), 'original');
  assert.equal(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'), before, 'package.json is left to the package manager');
});

test('run from a subfolder, it upgrades the app at the nearest package.json', async () => {
  app({ deps: { '@voult/sdk': '^0.2.1' } });
  fs.mkdirSync(path.join(cwd, 'backend'));
  const r = await upgrade([], { cwd: path.join(cwd, 'backend') });
  assert.deepEqual(r.calls, [['npm', 'install', '@voult/sdk@^0.2.2']]);
  assert.deepEqual(r.doctorCalls, [cwd]);
});
