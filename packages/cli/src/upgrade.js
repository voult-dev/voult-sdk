import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { compareVersions, projectRoot, runDoctor } from './doctor.js';

// `voult upgrade`: moves every @voult/* dependency to the latest set released together (the versions
// the latest create-voult-app pins into its templates), prints the CHANGELOG notes in between with
// the Breaking ones first, installs with the project's package manager, then runs voult doctor.
// Edits package.json and the lockfile only (through the package manager), never app code.

const HELP = `voult upgrade — move every @voult/* package to the latest set released together

Usage:
  voult upgrade [--dry-run]

Options:
  --dry-run   Show what would change and the CHANGELOG notes, install nothing

It installs with your package manager (from the lockfile), prints what changed and what you
may need to change (Breaking notes first), then runs voult doctor. Your code is never edited.
`;

const LOCKFILES = [['pnpm-lock.yaml', 'pnpm'], ['yarn.lock', 'yarn'], ['bun.lock', 'bun'], ['bun.lockb', 'bun'], ['package-lock.json', 'npm']];
const ADD = { npm: ['install'], pnpm: ['add'], yarn: ['add'], bun: ['add'] };
const REGISTRY_SPEC = /^[\^~]?\d+\.\d+\.\d+(-[\w.]+)?$/;

/** Files in a .tgz (npm tarballs are ustar), filtered by path. */
export function readTarball(tgz, wanted) {
  const tar = gunzipSync(tgz);
  const files = new Map();
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512);
    if (header[0] === 0) break;
    const field = (start, length) => header.subarray(start, start + length).toString('utf8').replace(/\0.*$/s, '');
    const prefix = field(345, 155);
    const name = prefix ? `${prefix}/${field(0, 100)}` : field(0, 100);
    const size = Number.parseInt(field(124, 12).trim() || '0', 8);
    if (wanted(name)) files.set(name, tar.subarray(offset + 512, offset + 512 + size).toString('utf8'));
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return files;
}

/**
 * CHANGELOG sections newer than `from`, up to and including `to`, newest first.
 * @returns {Array<{ version: string, breaking: string[], other: string[] }>}
 */
export function changelogBetween(markdown, from, to) {
  const sections = [];
  let current;
  for (const line of markdown.split('\n')) {
    const heading = /^## \[?v?(\d+\.\d+\.\d+[\w.-]*)\]?/.exec(line);
    if (heading) {
      const version = heading[1];
      current = compareVersions(version, from) > 0 && compareVersions(version, to) <= 0
        ? { version, breaking: [], other: [] }
        : undefined;
      if (current) sections.push(current);
    } else if (current && /^\s*- /.test(line)) {
      const entry = line.trim().slice(2);
      (/\bbreaking\b/i.test(entry) ? current.breaking : current.other).push(entry);
    }
  }
  return sections;
}

/** pnpm-lock.yaml → pnpm, …; npm when there's no lockfile. */
export function detectPackageManager(cwd) {
  return LOCKFILES.find(([file]) => fs.existsSync(path.join(cwd, file)))?.[1] ?? 'npm';
}

/** The version actually installed, else the one the range names. */
function currentVersion(cwd, name, spec) {
  try {
    return JSON.parse(fs.readFileSync(path.join(cwd, 'node_modules', name, 'package.json'), 'utf8')).version;
  } catch {
    return spec.replace(/^[\^~]/, '');
  }
}

/**
 * @param {string[]} argv arguments after `upgrade`
 * @param {{ cwd?: string, env?: NodeJS.ProcessEnv, log?: (msg: string) => void,
 *   fetch?: typeof fetch, run?: (cmd: string, args: string[], opts: object) => { status: number | null },
 *   doctor?: (argv: string[], io: object) => Promise<{ ok: boolean }> }} [io]
 * @returns {Promise<{ ok: boolean, plan: Array<{ name: string, from: string, to: string, dev: boolean }> }>}
 */
export async function runUpgrade(argv, io = {}) {
  const log = io.log ?? console.log;
  if (argv.includes('-h') || argv.includes('--help')) {
    log(HELP);
    return { ok: true, plan: [] };
  }
  const cwd = projectRoot(io.cwd ?? process.cwd());
  const env = io.env ?? process.env;
  const dryRun = argv.includes('--dry-run');
  const fetchFn = io.fetch ?? fetch;
  const run = io.run ?? ((cmd, args, opts) => spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32', ...opts }));
  const registry = (env.npm_config_registry || 'https://registry.npmjs.org').replace(/\/$/, '');

  const getJson = async (url) => {
    const res = await fetchFn(url);
    if (!res.ok) throw new Error(`${url} answered ${res.status}`);
    return res.json();
  };
  const getTarball = async (url) => {
    const res = await fetchFn(url);
    if (!res.ok) throw new Error(`${url} answered ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  };

  // 1. This project's @voult/* dependencies.
  const manifestPath = path.join(cwd, 'package.json');
  if (!fs.existsSync(manifestPath)) throw new Error('No package.json here. Run voult upgrade in your app\'s folder.');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const deps = [
    ...Object.entries(manifest.dependencies ?? {}).map(([name, spec]) => ({ name, spec, dev: false })),
    ...Object.entries(manifest.devDependencies ?? {}).map(([name, spec]) => ({ name, spec, dev: true })),
  ].filter((d) => d.name.startsWith('@voult/'));
  if (deps.length === 0) throw new Error('No @voult/* packages in package.json, so there is nothing to upgrade.');
  const skipped = deps.filter((d) => !REGISTRY_SPEC.test(d.spec));
  for (const d of skipped) log(`Skipping ${d.name} (${d.spec}): not a registry version.`);

  // 2. The latest set released together: what the latest create-voult-app pins in its templates.
  const creator = await getJson(`${registry}/create-voult-app/latest`);
  const templates = readTarball(await getTarball(creator.dist.tarball), (name) => /^package\/templates\/[^/]+\/package\.json$/.test(name));
  const pins = {};
  for (const json of templates.values()) {
    const tpl = JSON.parse(json);
    for (const [name, range] of Object.entries({ ...tpl.dependencies, ...tpl.devDependencies })) {
      if (name.startsWith('@voult/')) pins[name] = range.replace(/^[\^~]/, '');
    }
  }

  const plan = [];
  for (const d of deps.filter((x) => !skipped.includes(x))) {
    const to = pins[d.name] ?? (await getJson(`${registry}/${d.name}/latest`)).version;
    const from = currentVersion(cwd, d.name, d.spec);
    if (compareVersions(to, from) > 0) plan.push({ name: d.name, from, to, dev: d.dev });
  }
  if (plan.length === 0) {
    log(`Every @voult/* package is on the latest set (create-voult-app ${creator.version}). Nothing to do.`);
    return { ok: true, plan };
  }

  // 3. What changed, from each new version's CHANGELOG (also on --dry-run: nothing is installed for it).
  log('voult upgrade\n');
  let breakingCount = 0;
  for (const p of plan) {
    log(`${p.name}  ${p.from} → ${p.to}`);
    let sections = [];
    try {
      const meta = await getJson(`${registry}/${p.name}/${p.to}`);
      const files = readTarball(await getTarball(meta.dist.tarball), (name) => name === 'package/CHANGELOG.md');
      sections = changelogBetween(files.get('package/CHANGELOG.md') ?? '', p.from, p.to);
    } catch (err) {
      log(`  (couldn't read its CHANGELOG: ${err.message})`);
    }
    for (const s of sections) {
      for (const entry of s.breaking) log(`  ⚠ BREAKING (${s.version}): ${entry}`);
      breakingCount += s.breaking.length;
    }
    for (const s of sections) {
      for (const entry of s.other) log(`  • ${s.version}: ${entry}`);
    }
    log('');
  }
  if (breakingCount > 0) log(`${breakingCount} breaking change(s) above: check your code against each ⚠ before deploying.\n`);

  const packageManager = detectPackageManager(cwd);
  const commands = [false, true]
    .map((dev) => plan.filter((p) => p.dev === dev).map((p) => `${p.name}@^${p.to}`))
    .map((specs, i) => specs.length && [packageManager, [...ADD[packageManager], ...(i === 1 ? ['-D'] : []), ...specs]])
    .filter(Boolean);

  if (dryRun) {
    log('Dry run, nothing installed. It would run:');
    for (const [cmd, args] of commands) log(`  ${cmd} ${args.join(' ')}`);
    return { ok: true, plan };
  }

  // 4. Install with the project's package manager.
  for (const [cmd, args] of commands) {
    log(`$ ${cmd} ${args.join(' ')}`);
    const result = run(cmd, args, { cwd });
    if (result.status !== 0) throw new Error(`${cmd} failed. Nothing else was changed; fix the error above and run voult upgrade again.`);
  }

  // 5. Check the result.
  log('');
  const doctor = await (io.doctor ?? runDoctor)([], { ...io, cwd, log });
  return { ok: doctor.ok, plan };
}

export { HELP as UPGRADE_HELP };
