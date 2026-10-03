import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkPack, parseTag } from './check-release.mjs';

const pack = (files, version = '0.3.0') => ({ name: '@voult/express', version, files: files.map((p) => ({ path: p })) });
const changelog = '# Changelog\n\n## 0.3.0\n\n- stuff\n\n## 0.2.1\n';
const release = { name: '@voult/express', version: '0.3.0' };

test('parseTag accepts scoped, unscoped and prerelease tags', () => {
  assert.deepEqual(parseTag('@voult/express@0.3.0'), { name: '@voult/express', version: '0.3.0', distTag: 'latest' });
  assert.deepEqual(parseTag('create-voult-app@0.1.0'), { name: 'create-voult-app', version: '0.1.0', distTag: 'latest' });
  assert.equal(parseTag('@voult/express@0.3.0-beta.0').distTag, 'next');
});

test('parseTag rejects anything else', () => {
  for (const tag of ['v0.3.0', '@voult/express', '@other/pkg@1.0.0', '@voult/express@0.3', 'express@latest', undefined]) {
    assert.equal(parseTag(tag), null, String(tag));
  }
});

test('a clean tarball with a CHANGELOG entry passes', () => {
  assert.deepEqual(checkPack(pack(['package.json', 'src/index.js', 'src/env.js', 'CHANGELOG.md']), release, changelog), []);
});

test('version mismatch, env files, tests and a missing CHANGELOG entry are all reported', () => {
  const problems = checkPack(
    pack(['src/index.js', '.env', 'src/.env.local', 'tests/router.test.js', 'src/a.spec.ts'], '0.2.1'),
    release,
    '# Changelog\n\n## 0.3.0-beta.0\n',
  );
  assert.equal(problems.length, 6, problems.join('\n'));
  assert.match(problems[0], /version is 0\.2\.1/);
  assert.match(problems.at(-1), /no "## 0\.3\.0" entry/);
});

test('a missing CHANGELOG fails', () => {
  assert.deepEqual(checkPack(pack(['src/index.js']), release, null), ['CHANGELOG.md is missing']);
});
