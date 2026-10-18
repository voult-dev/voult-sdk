import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { buildEnvExampleFile, buildEnvFile, generateSessionSecret } from './env.js';
import { ask, askSecret, closePrompts } from './prompt.js';

// PRE-LAUNCH: same host as @voult/sdk's DEFAULT_BASE_URL (tests/init.test.js keeps them in sync;
// Phase 21 flips both). Each Voult instance serves its dashboard at /dashboard.
export const DEFAULT_VOULT_URL = 'https://staging.voult.dev';
const dashboardUrl = () => new URL('/dashboard', process.env.VOULT_BASE_URL || DEFAULT_VOULT_URL).href;
const LOCAL_PORT = 3000;

// The integrator's own BFF server, not the Voult API — @voult/express is
// what's mounted at /api/auth, so smoke tests hit localhost, matching
// SERVER_SNIPPET below.
const SMOKE_TEST_COMMANDS = [
  `curl -i -c cookies.txt -X POST http://localhost:${LOCAL_PORT}/api/auth/register \\`,
  `  -H 'Content-Type: application/json' \\`,
  `  -d '{"email":"dev@example.com","password":"Str0ng!Pass","fullName":"Dev User"}'`,
  '',
  `curl -i -b cookies.txt http://localhost:${LOCAL_PORT}/api/auth/user/me`,
].join('\n');

const SERVER_SNIPPET = `import express from 'express';
import { createVoultRouter } from '@voult/express';

const app = express();
app.use('/api/auth', createVoultRouter());
app.listen(${LOCAL_PORT}, () => console.log('listening on :${LOCAL_PORT}'));
`;

/**
 * Run `voult init`. Prompts are injectable so this is unit-testable without a real TTY.
 *
 * @param {string[]} argv
 * @param {{
 *   cwd?: string,
 *   log?: (msg: string) => void,
 *   ask?: typeof ask,
 *   askSecret?: typeof askSecret,
 * }} [io]
 */
export async function runInit(argv, io = {}) {
  const cwd = io.cwd ?? process.cwd();
  const log = io.log ?? console.log;
  const promptText = io.ask ?? ask;
  const promptSecret = io.askSecret ?? askSecret;
  const env = io.env ?? process.env;
  // Flags answer their prompt; --yes means no prompts at all (create-voult-app, CI).
  const { values: flags } = parseArgs({
    args: argv,
    strict: false,
    options: {
      force: { type: 'boolean' },
      yes: { type: 'boolean', short: 'y' },
      quiet: { type: 'boolean' },
      'client-id': { type: 'string' },
      'client-secret': { type: 'string' },
      strategy: { type: 'string' },
      'base-url': { type: 'string' },
    },
  });
  const force = Boolean(flags.force);
  const quiet = Boolean(flags.quiet);

  const envPath = path.join(cwd, '.env');
  if (fs.existsSync(envPath) && !force) {
    log(`.env already exists at ${envPath}. Re-run with --force to overwrite it.`);
    return { wrote: false };
  }

  // The secret can come from the environment so it never sits in shell history.
  const given = {
    clientId: typeof flags['client-id'] === 'string' ? flags['client-id'] : undefined,
    clientSecret: typeof flags['client-secret'] === 'string' ? flags['client-secret'] : env.VOULT_CLIENT_SECRET,
    strategy: typeof flags.strategy === 'string' ? flags.strategy : undefined,
  };
  if (flags.yes) given.strategy ??= 'cookie';

  if (!flags.yes || !given.clientId || !given.clientSecret) {
    log('Create an App in the Voult dashboard to get your Client ID and Secret:');
    log(`  ${dashboardUrl()}\n`);
  }

  let clientId = given.clientId ?? '';
  let clientSecret = given.clientSecret ?? '';
  let strategyInput = given.strategy ?? '';
  if (!flags.yes) {
    try {
      // No VOULT_BASE_URL prompt: @voult/express already falls back to the
      // Voult API's default URL when it's unset (see DEFAULT_BASE_URL in
      // @voult/sdk) — integrators only need it to point somewhere else
      // (self-hosted, local dev against a non-default environment).
      if (given.clientId === undefined) clientId = await promptText('VOULT_CLIENT_ID');
      if (given.clientSecret === undefined) clientSecret = await promptSecret('VOULT_CLIENT_SECRET');
      if (given.strategy === undefined) strategyInput = await promptText('Session strategy — cookie or bearer', { default: 'cookie' });
    } finally {
      closePrompts();
    }
  }
  clientId = clientId.trim();
  clientSecret = clientSecret.trim();
  if (!clientId || !clientSecret) {
    const how = flags.yes ? ' With --yes, pass --client-id and --client-secret (or set VOULT_CLIENT_SECRET).' : '';
    throw new Error(
      `VOULT_CLIENT_ID and VOULT_CLIENT_SECRET are both required — copy them from your App in ${dashboardUrl()}.${how} Nothing was written.`
    );
  }

  const strategy = strategyInput.trim().toLowerCase() === 'bearer' ? 'bearer' : 'cookie';

  const values = {
    ...(typeof flags['base-url'] === 'string' && flags['base-url'] && { VOULT_BASE_URL: flags['base-url'] }),
    VOULT_CLIENT_ID: clientId,
    VOULT_CLIENT_SECRET: clientSecret,
    // Only when it differs from the default (cookie): a starter .env holds only what matters.
    ...(strategy === 'bearer' && { VOULT_SESSION_STRATEGY: strategy }),
  };

  if (strategy === 'cookie') {
    values.VOULT_SESSION_SECRET = generateSessionSecret();
  }

  fs.writeFileSync(envPath, buildEnvFile(values), { mode: 0o600 });
  fs.writeFileSync(path.join(cwd, '.env.example'), buildEnvExampleFile());

  log('\nWrote .env and .env.example.');
  if (strategy === 'cookie') {
    log('Generated VOULT_SESSION_SECRET — it is only ever written to .env, never printed.');
  }
  if (quiet) return { wrote: true, strategy };
  if (!values.VOULT_BASE_URL) {
    log(
      'VOULT_BASE_URL was not written — @voult/express talks to the Voult API by default. ' +
        'Only add VOULT_BASE_URL to .env if you need to point at something else (self-hosted, local dev).'
    );
  }

  log('\nMount the router:\n');
  log(SERVER_SNIPPET);
  log('Smoke test once your server is running:\n');
  log(SMOKE_TEST_COMMANDS);
  log('\nThen check everything (credentials, callback URL, providers):\n\n  npx voult doctor');

  return { wrote: true, strategy };
}
