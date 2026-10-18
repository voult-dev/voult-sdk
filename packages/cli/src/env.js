import crypto from 'node:crypto';

export const ENV_KEYS = [
  'VOULT_BASE_URL',
  'VOULT_CLIENT_ID',
  'VOULT_CLIENT_SECRET',
  'VOULT_SESSION_STRATEGY',
  'VOULT_SESSION_SECRET',
  'VOULT_APP_URL',
  'VOULT_OAUTH_CALLBACK_URL',
];

const SECRET_KEYS = new Set(['VOULT_CLIENT_SECRET', 'VOULT_SESSION_SECRET']);

/** @returns {string} a 32-byte hex secret, suitable for VOULT_SESSION_SECRET */
export function generateSessionSecret() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * @param {Record<string, string | undefined>} values keyed by ENV_KEYS
 * @returns {string} a `.env` file body, omitting keys with no value
 */
export function buildEnvFile(values) {
  const lines = ENV_KEYS.filter((key) => values[key]).map((key) => `${key}=${values[key]}`);
  return `${lines.join('\n')}\n`;
}

/**
 * @returns {string} a `.env.example` body: the 3 keys every app needs, then the optional ones
 * commented out, each explained on the line above it (so uncommenting can't paste the note
 * into the value). Never real values.
 */
export function buildEnvExampleFile() {
  return `# Required. From your app in the Voult dashboard; \`npx voult init\` writes .env for you.
VOULT_CLIENT_ID=
VOULT_CLIENT_SECRET=
# 32+ random characters that sign the session cookies (openssl rand -hex 32).
VOULT_SESSION_SECRET=

# Optional: only when you need them.
# Your frontend, when it is on another origin than this server (e.g. https://myapp.com).
# VOULT_APP_URL=
# The OAuth callback URL, when a proxy hides the public URL.
# VOULT_OAUTH_CALLBACK_URL=
# "bearer" returns tokens in JSON (mobile apps). Default: cookie.
# VOULT_SESSION_STRATEGY=
# A Voult other than the default (self-hosted, local development).
# VOULT_BASE_URL=
`;
}

/** @param {string} key @returns {boolean} true if this key's value must never be echoed back */
export function isSecretKey(key) {
  return SECRET_KEYS.has(key);
}
