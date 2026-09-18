import crypto from 'node:crypto';

export const ENV_KEYS = [
  'VOULT_BASE_URL',
  'VOULT_CLIENT_ID',
  'VOULT_CLIENT_SECRET',
  'VOULT_SESSION_SECRET',
  'VOULT_APP_URL',
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

/** @returns {string} a `.env.example` body — canonical keys only, never real values */
export function buildEnvExampleFile() {
  return `${ENV_KEYS.map((key) => `${key}=`).join('\n')}\n`;
}

/** @param {string} key @returns {boolean} true if this key's value must never be echoed back */
export function isSecretKey(key) {
  return SECRET_KEYS.has(key);
}
