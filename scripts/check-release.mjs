#!/usr/bin/env node
// Release gate run by .github/workflows/release.yml (see RELEASING.md).
// Usage: node scripts/check-release.mjs <tag>   e.g. @voult/express@0.3.0, create-voult-app@0.1.0
// Finds the workspace for the tag, checks its `npm pack --dry-run` tarball and CHANGELOG,
// and writes `dir` and `dist_tag` to $GITHUB_OUTPUT. Exits 1 listing every problem.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function parseTag(tag) {
  const match = /^((?:@voult\/)?[a-z0-9][a-z0-9-]*)@(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/.exec(tag ?? '');
  if (!match) return null;
  const [, name, version] = match;
  return { name, version, distTag: version.includes('-') ? 'next' : 'latest' };
}

// `pack` is one entry of `npm pack --dry-run --json`.
export function checkPack(pack, { name, version }, changelog) {
  const problems = [];
  if (pack.name !== name) problems.push(`package name is ${pack.name}, tag says ${name}`);
  if (pack.version !== version) problems.push(`package.json version is ${pack.version}, tag says ${version}`);
  for (const { path: file } of pack.files) {
    const parts = file.split('/');
    if (parts.some((part) => part.startsWith('.env'))) problems.push(`tarball contains an env file: ${file}`);
    if (parts.some((part) => ['test', 'tests', '__tests__'].includes(part)) || /\.(test|spec)\.[cm]?[jt]sx?$/.test(file)) {
      problems.push(`tarball contains a test file: ${file}`);
    }
  }
  const heading = new RegExp(`^## ${version.replace(/\./g, '\\.')}\\s*$`, 'm');
  if (!changelog) problems.push('CHANGELOG.md is missing');
  else if (!heading.test(changelog)) problems.push(`CHANGELOG.md has no "## ${version}" entry`);
  return problems;
}

function findWorkspace(name) {
  const packagesDir = path.join(ROOT, 'packages');
  for (const entry of fs.readdirSync(packagesDir)) {
    const manifest = path.join(packagesDir, entry, 'package.json');
    if (fs.existsSync(manifest) && JSON.parse(fs.readFileSync(manifest, 'utf8')).name === name) {
      return path.join('packages', entry);
    }
  }
  return null;
}

function main(tag) {
  const release = parseTag(tag);
  if (!release) throw new Error(`"${tag}" is not a release tag (expected @voult/<pkg>@<semver> or create-voult-app@<semver>)`);
  const dir = findWorkspace(release.name);
  if (!dir) throw new Error(`no workspace under packages/ is named ${release.name}`);

  // The tag points at a commit, but npm pack reads the files on disk: they must be the same.
  const dirty = execFileSync('git', ['status', '--porcelain', '--', dir], { cwd: ROOT, encoding: 'utf8' }).trim();
  if (dirty) throw new Error(`${dir} has uncommitted changes. Commit and push them, then tag:\n${dirty}`);

  const [pack] = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json'], { cwd: path.join(ROOT, dir), encoding: 'utf8' }));
  const changelogPath = path.join(ROOT, dir, 'CHANGELOG.md');
  const changelog = fs.existsSync(changelogPath) ? fs.readFileSync(changelogPath, 'utf8') : null;
  const problems = checkPack(pack, release, changelog);
  if (problems.length) throw new Error(`${tag} is not releasable:\n- ${problems.join('\n- ')}`);

  console.log(`${tag}: ${pack.files.length} files, dist-tag "${release.distTag}", from ${dir}`);
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `dir=${dir}\ndist_tag=${release.distTag}\n`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv[2]);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
