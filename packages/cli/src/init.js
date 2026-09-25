import fs from 'node:fs';
import path from 'node:path';
import { buildEnvExampleFile, buildEnvFile, generateSessionSecret } from './env.js';
import { ask, askSecret, closePrompts } from './prompt.js';

const DASHBOARD_URL = 'https://www.voult.dev/dashboard';
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
  const force = argv.includes('--force');

  const envPath = path.join(cwd, '.env');
  if (fs.existsSync(envPath) && !force) {
    log(`.env already exists at ${envPath}. Re-run with --force to overwrite it.`);
    return { wrote: false };
  }

  log('Create an App in the Voult dashboard to get your Client ID and Secret:');
  log(`  ${DASHBOARD_URL}\n`);

  let clientId, clientSecret, strategyInput;
  try {
    // No VOULT_BASE_URL prompt: @voult/express already falls back to the
    // Voult API's default URL when it's unset (see DEFAULT_BASE_URL in
    // @voult/sdk) — integrators only need it to point somewhere else
    // (self-hosted, local dev against a non-default environment).
    clientId = await promptText('VOULT_CLIENT_ID');
    clientSecret = await promptSecret('VOULT_CLIENT_SECRET');
    strategyInput = await promptText('Session strategy — cookie or bearer', { default: 'cookie' });
  } finally {
    closePrompts();
  }
  clientId = clientId.trim();
  clientSecret = clientSecret.trim();
  if (!clientId || !clientSecret) {
    throw new Error(
      `VOULT_CLIENT_ID and VOULT_CLIENT_SECRET are both required — copy them from your App in ${DASHBOARD_URL}. Nothing was written.`
    );
  }

  const strategy = strategyInput.trim().toLowerCase() === 'bearer' ? 'bearer' : 'cookie';

  const values = {
    VOULT_CLIENT_ID: clientId,
    VOULT_CLIENT_SECRET: clientSecret,
  };

  if (strategy === 'cookie') {
    values.VOULT_SESSION_SECRET = generateSessionSecret();
  }

  fs.writeFileSync(envPath, buildEnvFile(values), { mode: 0o600 });
  fs.writeFileSync(path.join(cwd, '.env.example'), buildEnvExampleFile());

  log('\nWrote .env and .env.example.');
  log(
    'VOULT_BASE_URL was not written — @voult/express talks to the Voult API by default. ' +
      'Only add VOULT_BASE_URL to .env if you need to point at something else (self-hosted, local dev).'
  );
  if (strategy === 'cookie') {
    log('Generated VOULT_SESSION_SECRET — it is only ever written to .env, never printed.');
  }

  log('\nMount the router:\n');
  log(SERVER_SNIPPET);
  log('Smoke test once your server is running:\n');
  log(SMOKE_TEST_COMMANDS);

  return { wrote: true, strategy };
}
