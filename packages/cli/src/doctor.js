import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseEnv } from 'node:util';

// `voult doctor`: catches setup mistakes before the first sign-in attempt.
// It loads @voult/express and @voult/sdk from the *project* (not from this CLI), so .env is
// validated by the same code the server will run. Never prints secret values.

const PROVIDER_LABELS = {
  google: 'Google',
  github: 'GitHub',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  microsoft: 'Microsoft',
  apple: 'Apple',
};
const STRAY_PROVIDER_ENV = /^(GOOGLE|GITHUB|FACEBOOK|LINKEDIN|MICROSOFT|APPLE)_/;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);
const SYMBOLS = { pass: '✓', warn: '⚠', fail: '✗', skip: '–' };

const HELP = `voult doctor — check this project's Voult setup

Usage:
  voult doctor [--json] [--callback-url <url>]

Options:
  --json                 Machine-readable output (for CI). Exit code 1 if any check fails.
  --callback-url <url>   Your server's OAuth callback, if not http://localhost:$PORT/api/auth/oauth/callback
                         (VOULT_OAUTH_CALLBACK_URL is used when set)
`;

/** @param {string} a @param {string} b @returns {number} <0, 0, >0 like a sort comparator */
export function compareVersions(a, b) {
  const parts = (v) => String(v).split('-')[0].split('.').map((n) => Number.parseInt(n, 10) || 0);
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < 3; i += 1) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  }
  return 0;
}

function readDotEnv(cwd) {
  const file = path.join(cwd, '.env');
  if (!fs.existsSync(file)) return { exists: false, values: {} };
  return { exists: true, values: parseEnv(fs.readFileSync(file, 'utf8')) };
}

/** Nearest package.json above a resolved entry file (packages don't export ./package.json). */
function packageVersion(entryFile) {
  let dir = path.dirname(entryFile);
  while (dir !== path.dirname(dir)) {
    const candidate = path.join(dir, 'package.json');
    if (fs.existsSync(candidate)) return JSON.parse(fs.readFileSync(candidate, 'utf8')).version;
    dir = path.dirname(dir);
  }
  return undefined;
}

/** Resolve @voult/express + @voult/sdk the way the project's server would. */
async function loadProjectPackages(cwd) {
  const require = createRequire(path.join(cwd, 'package.json'));
  const expressPath = require.resolve('@voult/express');
  const sdkPath = require.resolve('@voult/sdk');
  return {
    express: await import(pathToFileURL(expressPath).href),
    sdk: await import(pathToFileURL(sdkPath).href),
    versions: { express: packageVersion(expressPath), sdk: packageVersion(sdkPath) },
  };
}

function isLocal(url) {
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

/**
 * @param {string[]} argv arguments after `doctor`
 * @param {{ cwd?: string, env?: NodeJS.ProcessEnv, log?: (msg: string) => void,
 *   loadPackages?: (cwd: string) => Promise<{ express: any, sdk: any, versions: { express?: string, sdk?: string } }> }} [io]
 * @returns {Promise<{ ok: boolean, checks: Array<{ id: string, status: string, message: string, fix?: string }> }>}
 */
export async function runDoctor(argv, io = {}) {
  const log = io.log ?? console.log;
  if (argv.includes('-h') || argv.includes('--help')) {
    log(HELP);
    return { ok: true, checks: [] };
  }

  const cwd = io.cwd ?? process.cwd();
  const json = argv.includes('--json');
  const flagIndex = argv.indexOf('--callback-url');
  const callbackFlag = flagIndex >= 0 ? argv[flagIndex + 1] : undefined;

  const dotEnv = readDotEnv(cwd);
  // Like dotenv: variables already in the environment win over .env.
  const env = { ...dotEnv.values, ...(io.env ?? process.env) };
  const nodeEnv = env.NODE_ENV || 'development';
  const production = nodeEnv === 'production';

  const checks = [];
  const add = (id, status, message, fix) => checks.push({ id, status, message, ...(fix && { fix }) });
  const finish = () => report(checks, { json, log, cwd, dotEnv });

  // 1. Packages, from the project itself.
  let packages;
  try {
    packages = await (io.loadPackages ?? loadProjectPackages)(cwd);
    add('packages', 'pass', `@voult/express ${packages.versions.express ?? '?'}, @voult/sdk ${packages.versions.sdk ?? '?'}`);
  } catch {
    add('packages', 'fail', '@voult/express and @voult/sdk are not installed in this project.',
      'npm install @voult/express @voult/sdk');
    return finish();
  }
  const { express, sdk, versions } = packages;

  // 2. .env, validated by the server's own loader.
  let config;
  try {
    config = express.loadConfigFromEnv({ env });
    add('env', 'pass', dotEnv.exists ? '.env loads and validates' : 'Environment validates (no .env file; using process env)');
  } catch (err) {
    add('env', 'fail', String(err.message).replace(/^\[voult\] /, ''),
      dotEnv.exists ? 'Fix .env, or run: npx voult init --force' : 'Run: npx voult init');
    return finish();
  }

  // 3. Session secret.
  if (config.session.strategy === 'cookie') {
    const secret = config.sessionSecret ?? '';
    if (secret.length >= 32) add('session-secret', 'pass', 'VOULT_SESSION_SECRET is set (32+ characters)');
    else if (production) add('session-secret', 'fail', 'VOULT_SESSION_SECRET is shorter than 32 characters.', 'Use: openssl rand -hex 32');
    else add('session-secret', 'warn', secret ? 'VOULT_SESSION_SECRET is shorter than 32 characters.' : 'VOULT_SESSION_SECRET is not set; session cookies are unsigned.', 'Use: openssl rand -hex 32 (production refuses to start without it)');
  } else {
    add('session-secret', 'pass', 'Bearer strategy: no session secret needed (hosted OAuth needs cookie sessions)');
  }

  // 4. Provider secrets that no longer belong in .env (only this project's .env, not the whole machine).
  const stray = Object.keys(dotEnv.values).filter((key) => STRAY_PROVIDER_ENV.test(key));
  if (stray.length > 0) {
    add('stray-env', 'warn', `.env has provider variables Voult's hosted OAuth doesn't use: ${stray.join(', ')}`,
      'Configure providers in the Voult dashboard, then delete these from .env');
  } else {
    add('stray-env', 'pass', 'No provider secrets in .env');
  }

  // 5. The SDK must be new enough for doctor itself to talk to the API.
  if (typeof sdk.getApiMeta !== 'function' || typeof sdk.getAppInfo !== 'function') {
    add('version', 'fail', `@voult/sdk${versions.sdk ? ` ${versions.sdk}` : ''} is too old for doctor's checks.`,
      'npm install @voult/sdk@latest @voult/express@latest');
    return finish();
  }

  const client = new sdk.VoultClient({ baseURL: config.baseURL, clientId: config.clientId, clientSecret: config.clientSecret });

  // 6. API reachable.
  let meta;
  try {
    meta = await sdk.getApiMeta(client);
    add('reachable', 'pass', `Voult API at ${config.baseURL} (v${meta.version ?? '?'})`);
  } catch (err) {
    add('reachable', 'fail', `Can't reach the Voult API at ${config.baseURL}: ${err.message}`,
      'Check VOULT_BASE_URL (leave it unset for the hosted Voult API) and your network');
    return finish();
  }

  // 7. SDK version the API supports.
  if (meta.minSdkVersion && versions.sdk && compareVersions(versions.sdk, meta.minSdkVersion) < 0) {
    add('version', 'fail', `@voult/sdk ${versions.sdk} is older than this API supports (${meta.minSdkVersion}+).`,
      'npm install @voult/sdk@latest');
  } else {
    add('version', 'pass', `@voult/sdk ${versions.sdk ?? '?'} is supported (API needs ${meta.minSdkVersion ?? 'any'}+)`);
  }

  // 8. Credentials.
  let app;
  try {
    app = await sdk.getAppInfo(client);
    add('credentials', 'pass', `Client ID and secret accepted (app "${app.name ?? '?'}")`);
  } catch (err) {
    const rejected = err.status === 401 || err.status === 403;
    add('credentials', 'fail',
      rejected ? 'Voult rejected VOULT_CLIENT_ID / VOULT_CLIENT_SECRET.' : `Couldn't read the app's settings: ${err.message}`,
      rejected ? 'Copy both again from the Voult dashboard (rotate the secret if you lost it)' : undefined);
    return finish();
  }

  // 9. OAuth callback URL is allowlisted.
  const assumed = !callbackFlag && !config.oauthCallbackUrl;
  const callbackUrl = callbackFlag || config.oauthCallbackUrl || `http://localhost:${env.PORT || 3000}/api/auth/oauth/callback`;
  const allowed = app.allowedCallbackUrls ?? [];
  const assumedNote = assumed ? ' (assumed from PORT; pass --callback-url if your server differs)' : '';
  if (allowed.includes(callbackUrl)) {
    add('callback', 'pass', `Callback URL ${callbackUrl} is allowlisted`);
  } else if (allowed.length === 0 && isLocal(callbackUrl)) {
    add('callback', 'warn', `The app has no callback URLs yet, so only localhost works${assumedNote}.`,
      `Before deploying, add your production callback in Voult dashboard → your app → Callback URLs`);
  } else {
    add('callback', 'fail', `Callback URL ${callbackUrl} is not on the app's allowlist${assumedNote}.`,
      `Add it in Voult dashboard → your app → Callback URLs`);
  }

  // 10. https in production.
  if (production && callbackUrl.startsWith('http:') && !isLocal(callbackUrl)) {
    add('https', 'fail', `Production callback URL uses http: ${callbackUrl}`,
      "Serve over https; behind a proxy set app.set('trust proxy', 1) or VOULT_OAUTH_CALLBACK_URL");
  }

  // 11. Providers.
  const providers = Object.entries(app.providers ?? {});
  const broken = providers.filter(([, s]) => s.enabled && !s.configured);
  const ready = providers.filter(([, s]) => s.enabled && s.configured).map(([name]) => PROVIDER_LABELS[name] ?? name);
  for (const [name] of broken) {
    add('providers', 'fail', `${PROVIDER_LABELS[name] ?? name} sign-in is on but missing credentials.`,
      `Voult dashboard → your app → Sign-in providers → ${PROVIDER_LABELS[name] ?? name}`);
  }
  if (broken.length === 0 && ready.length === 0) {
    add('providers-none', 'warn', 'No sign-in providers are on, so OAuth buttons will be empty.',
      'Voult dashboard → your app → Sign-in providers');
  } else if (broken.length === 0) {
    add('providers', 'pass', `Ready: ${ready.join(', ')}`);
  }

  return finish();
}

function report(checks, { json, log }) {
  const ok = !checks.some((c) => c.status === 'fail');
  if (json) {
    log(JSON.stringify({ ok, checks }, null, 2));
    return { ok, checks };
  }

  log('voult doctor\n');
  for (const check of checks) {
    log(`  ${SYMBOLS[check.status]} ${check.message}`);
    if (check.fix && check.status !== 'pass') log(`      → ${check.fix}`);
  }
  const count = (status) => checks.filter((c) => c.status === status).length;
  log(`\n${count('pass')} passed, ${count('warn')} warning(s), ${count('fail')} failed`);
  if (!ok) log('Fix the ✗ items above; doctor exits with code 1 until they pass.');
  return { ok, checks };
}

export { HELP as DOCTOR_HELP };
