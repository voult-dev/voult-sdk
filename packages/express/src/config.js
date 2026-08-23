import { DEFAULT_BASE_URL } from 'voult-sdk';

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

/**
 * @param {VoultExpressConfig} config
 * @returns {VoultExpressConfig}
 */
function normalizeConfig(config) {
  const clientId = trimToUndefined(config.clientId);
  const clientSecret = trimToUndefined(config.clientSecret);

  if (!clientId || !clientSecret) {
    throw new Error('VOULT_CLIENT_ID and VOULT_CLIENT_SECRET are required');
  }

  return {
    baseURL: trimToUndefined(config.baseURL) || DEFAULT_BASE_URL,
    clientId,
    clientSecret,
    sessionSecret: trimToUndefined(config.sessionSecret),
    appUrl: trimToUndefined(config.appUrl),
    session: {
      strategy: config.session?.strategy === 'bearer' ? 'bearer' : 'cookie',
    },
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

  return normalizeConfig({
    baseURL: overrides.baseURL ?? readEnvValue(env, ENV_FIELDS.baseURL),
    clientId: overrides.clientId ?? readEnvValue(env, ENV_FIELDS.clientId),
    clientSecret: overrides.clientSecret ?? readEnvValue(env, ENV_FIELDS.clientSecret),
    sessionSecret: overrides.sessionSecret ?? readEnvValue(env, ENV_FIELDS.sessionSecret),
    appUrl: overrides.appUrl ?? readEnvValue(env, ENV_FIELDS.appUrl),
    session: {
      strategy: overrides.session?.strategy,
    },
  });
}

/**
 * Resolve router/middleware options into a normalized config.
 * @param {CreateVoultRouterOptions} [options]
 * @returns {VoultExpressConfig}
 */
export function resolveConfig(options = {}) {
  if (options.config) {
    return normalizeConfig(options.config);
  }

  return loadConfigFromEnv({
    env: options.env,
    overrides: options.overrides,
  });
}
