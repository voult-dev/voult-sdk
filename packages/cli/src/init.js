import fs from 'node:fs';
import path from 'node:path';
import { buildEnvExampleFile, buildEnvFile, generateSessionSecret } from './env.js';
import { ask, askSecret, closePrompts } from './prompt.js';

const DASHBOARD_URL = 'https://www.voult.dev/dashboard';

function smokeTestCommands(baseUrl) {
  const origin = baseUrl.replace(/\/$/, '');
  return [
    `curl -i -c cookies.txt -X POST ${origin}/api/auth/register \\`,
    `  -H 'Content-Type: application/json' \\`,
    `  -d '{"email":"dev@example.com","password":"Str0ng!Pass","fullName":"Dev User"}'`,
    '',
    `curl -i -b cookies.txt ${origin}/api/auth/user/me`,
  ].join('\n');
}

const SERVER_SNIPPET = `import express from 'express';
import { createVoultRouter } from '@voult/express';

const app = express();
app.use('/api/auth', createVoultRouter());
app.listen(3000, () => console.log('listening on :3000'));
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

  let baseURL, clientId, clientSecret, strategyInput;
  try {
    baseURL = await promptText('VOULT_BASE_URL', { default: 'https://api.voult.dev' });
    clientId = await promptText('VOULT_CLIENT_ID');
    clientSecret = await promptSecret('VOULT_CLIENT_SECRET');
    strategyInput = await promptText('Session strategy — cookie or bearer', { default: 'cookie' });
  } finally {
    closePrompts();
  }
  const strategy = strategyInput.trim().toLowerCase() === 'bearer' ? 'bearer' : 'cookie';

  const values = {
    VOULT_BASE_URL: baseURL,
    VOULT_CLIENT_ID: clientId,
    VOULT_CLIENT_SECRET: clientSecret,
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

  log('\nMount the router:\n');
  log(SERVER_SNIPPET);
  log('Smoke test once your server is running:\n');
  log(smokeTestCommands(baseURL));

  return { wrote: true, strategy };
}
