import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// @voult/react re-exports this entry into browser bundles: it must not pull in axios/the client.
test('@voult/sdk/validation exposes the password rules without network code', async () => {
  const entry = await import('@voult/sdk/validation');
  assert.equal(typeof entry.isValidPassword, 'function');
  assert.equal(typeof entry.PASSWORD_REQUIREMENTS_MESSAGE, 'string');

  for (const file of ['../../src/utils/validation.js', '../../src/errors.js']) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    const imports = [...source.matchAll(/^import .* from ['"](.+)['"]/gm)].map((m) => m[1]);
    assert.ok(imports.every((spec) => spec.startsWith('.')), `${file} imports ${imports.join(', ')}`);
    assert.ok(!/axios|client\.js/.test(imports.join(' ')), `${file} must not import network code`);
  }
});
