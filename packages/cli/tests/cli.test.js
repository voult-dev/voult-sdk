import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { runCli } from '../src/cli.js';

test('no command prints help', async () => {
  const logs = [];
  await runCli([], { log: (msg) => logs.push(msg) });
  assert.ok(logs.some((line) => line.includes('voult init')));
});

test('--help prints help without running init', async () => {
  const logs = [];
  await runCli(['--help'], { log: (msg) => logs.push(msg) });
  assert.ok(logs.some((line) => line.includes('Usage')));
});

test('init --help prints help without running init', async () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'voult-cli-'));
  try {
    const logs = [];
    await runCli(['init', '--help'], { cwd, log: (msg) => logs.push(msg) });
    assert.ok(logs.some((line) => line.includes('Usage')));
    assert.ok(!fs.existsSync(path.join(cwd, '.env')));
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('init rejects blank credentials without writing .env', async () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'voult-cli-'));
  try {
    await assert.rejects(
      () => runCli(['init'], { cwd, log: () => {}, ask: async () => '  ', askSecret: async () => '' }),
      /both required/
    );
    assert.ok(!fs.existsSync(path.join(cwd, '.env')));
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('unknown command rejects with a usage hint', async () => {
  await assert.rejects(() => runCli(['bogus']), /Unknown command "bogus"/);
});

test('init delegates to runInit with the remaining args', async () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'voult-cli-'));
  try {
    const logs = [];
    await runCli(['init', '--force'], {
      cwd,
      log: (msg) => logs.push(msg),
      ask: async (_q, opts) => opts?.default ?? 'app_123',
      askSecret: async () => 'x',
    });
    assert.ok(fs.existsSync(path.join(cwd, '.env')));
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});
