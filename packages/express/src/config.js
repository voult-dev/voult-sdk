import { DEFAULT_BASE_URL } from '@voult/sdk';

/**
 * @typedef {import('./index.js').VoultExpressConfig} VoultExpressConfig
 * @typedef {import('./index.js').LoadConfigFromEnvOptions} LoadConfigFromEnvOptions
 * @typedef {import('./index.js').CreateVoultRouterOptions} CreateVoultRouterOptions
 */

const ENV_FIELDS = {
  baseURL: { canonical: 'VOULT_BASE_URL', aliases: ['BASE_URL'] },
  clientId: { canonical: 'VOULT_CLIENT_ID', aliases: ['CLIENT_ID'] },
  clientSecret: { canonical: 'VOULT_CLIENT_SECRET', aliases: ['CLIENT_SECRET'] },
  sessionSecret: { canonical: 'VOULT_SESSION_SECRET', aliases: ['SESSION_SECRET'] },
  appUrl: { canonical: 'VOULT_APP_URL', aliases: ['APP_URL'] },
  sessionStrategy: { canonical: 'VOULT_SESSION_STRATEGY', aliases: [] },
};

const warnedLegacyAliases = new Set();

/**
 * Read a config value from canonical env names, falling back to deprecated aliases.
 * @param {NodeJS.Dict<string | undefined>} env
 * @param {{ canonical: string, aliases: string[] }} field
 * @returns {string | undefined}
 */
function readEnvValue(env, field) {
  const canonicalValue = trimToUndefined(env[field.canonical]);
  if (canonicalValue) {
    return canonicalValue;
  }

  for (const alias of field.aliases) {
    const aliasValue = trimToUndefined(env[alias]);
    if (!aliasValue) {
      continue;
    }

    if (!warnedLegacyAliases.has(alias)) {
      warnedLegacyAliases.add(alias);
      console.warn(
        `[voult] ${alias} is deprecated; use ${field.canonical} instead. This alias will be removed in a future release.`
      );
    }

    return aliasValue;
  }

  return undefined;
}

/**
 * @param {unknown} value
 * @returns {string | undefined}
 */
function trimToUndefined(value) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

const DASHBOARD_URL = 'https://www.voult.dev';

/**
 * @param {NodeJS.Dict<string | undefined>} env
 * @returns {string}
 */
function resolveNodeEnv(env) {
  return (
    trimToUndefined(env.NODE_ENV) ??
    trimToUndefined(process.env.NODE_ENV) ??
    'development'
  );
}

/**
 * @param {unknown} value
 * @param {string} envName
 * @returns {string}
 */
function requireHttpUrl(value, envName) {
  const raw = trimToUndefined(value);
  if (!raw) {
    return DEFAULT_BASE_URL;
  }

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    parsed = null;
  }

  if (!parsed || (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')) {
    throw new Error(
      `[voult] Invalid ${envName} "${raw}". Set it to an absolute http(s) URL, for example https://api.voult.dev or https://staging.voult.dev.`
    );
  }

  return raw;
}

/**
 * @param {VoultExpressConfig} config
 * @param {NodeJS.Dict<string | undefined>} env
 * @returns {VoultExpressConfig}
 */
function normalizeConfig(config, env) {
  const clientId = trimToUndefined(config.clientId);
  const clientSecret = trimToUndefined(config.clientSecret);
  const sessionSecret = trimToUndefined(config.sessionSecret);
  const requestedStrategy = trimToUndefined(config.session?.strategy)?.toLowerCase() ?? 'cookie';
  if (requestedStrategy !== 'cookie' && requestedStrategy !== 'bearer') {
    throw new Error(
      `[voult] Invalid VOULT_SESSION_STRATEGY "${config.session.strategy}". Use "cookie" (default, httpOnly cookies) or "bearer" (tokens returned in JSON).`
    );
  }
  const strategy = requestedStrategy;

  if (!clientId) {
    throw new Error(
      `[voult] Missing VOULT_CLIENT_ID. Create an App in the Voult dashboard (${DASHBOARD_URL}), then copy the Client ID into your .env as VOULT_CLIENT_ID.`
    );
  }

  if (!clientSecret) {
    throw new Error(
      `[voult] Missing VOULT_CLIENT_SECRET. Copy the Client Secret from your App in the Voult dashboard (${DASHBOARD_URL}) into your .env as VOULT_CLIENT_SECRET. The secret is required for this Express BFF and must not be sent to the browser.`
    );
  }

  const baseURL = requireHttpUrl(config.baseURL, 'VOULT_BASE_URL');
  const appUrl = trimToUndefined(config.appUrl)
    ? requireHttpUrl(config.appUrl, 'VOULT_APP_URL')
    : undefined;

  if (strategy === 'cookie' && !sessionSecret && resolveNodeEnv(env) === 'production') {
    throw new Error(
      '[voult] Cookie sessions require VOULT_SESSION_SECRET in production. Add a long random value to your .env (openssl rand -hex 32). If the client stores tokens itself, set VOULT_SESSION_STRATEGY=bearer instead.'
    );
  }

  return {
    baseURL,
    clientId,
    clientSecret,
    sessionSecret,
    appUrl,
    session: { strategy },
  };
}

/**
 * Load BFF config from process env (or a provided env map).
 * Canonical names are `VOULT_*`. Legacy aliases warn once per process.
 *
 * @param {LoadConfigFromEnvOptions} [options]
 * @returns {VoultExpressConfig}
 */
export function loadConfigFromEnv(options = {}) {
  const env = options.env ?? process.env;
  const overrides = options.overrides ?? {};

  return normalizeConfig(
    {
      baseURL: overrides.baseURL ?? readEnvValue(env, ENV_FIELDS.baseURL),
      clientId: overrides.clientId ?? readEnvValue(env, ENV_FIELDS.clientId),
      clientSecret: overrides.clientSecret ?? readEnvValue(env, ENV_FIELDS.clientSecret),
      sessionSecret: overrides.sessionSecret ?? readEnvValue(env, ENV_FIELDS.sessionSecret),
      appUrl: overrides.appUrl ?? readEnvValue(env, ENV_FIELDS.appUrl),
      session: {
        strategy: overrides.session?.strategy ?? readEnvValue(env, ENV_FIELDS.sessionStrategy),
      },
    },
    env
  );
}

/**
 * Resolve router/middleware options into a normalized config.
 * @param {CreateVoultRouterOptions} [options]
 * @returns {VoultExpressConfig}
 */
export function resolveConfig(options = {}) {
  const env = options.env ?? process.env;

  if (options.config) {
    return normalizeConfig(options.config, env);
  }

  return loadConfigFromEnv({
    env,
    overrides: options.overrides,
  });
}
