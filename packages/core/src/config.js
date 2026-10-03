import { DEFAULT_BASE_URL } from '@voult/sdk';

/**
 * @typedef {import('./index.js').VoultConfig} VoultExpressConfig
 * @typedef {import('./index.js').LoadConfigFromEnvOptions} LoadConfigFromEnvOptions
 * @typedef {import('./index.js').ResolveConfigOptions} CreateVoultRouterOptions
 */

// No `process` on the Edge: read it through globalThis.
const processEnv = () => globalThis.process?.env ?? {};

const ENV_FIELDS = {
  baseURL: { canonical: 'VOULT_BASE_URL', aliases: ['BASE_URL'] },
  clientId: { canonical: 'VOULT_CLIENT_ID', aliases: ['CLIENT_ID'] },
  clientSecret: { canonical: 'VOULT_CLIENT_SECRET', aliases: ['CLIENT_SECRET'] },
  sessionSecret: { canonical: 'VOULT_SESSION_SECRET', aliases: ['SESSION_SECRET'] },
  appUrl: { canonical: 'VOULT_APP_URL', aliases: ['APP_URL'] },
  sessionStrategy: { canonical: 'VOULT_SESSION_STRATEGY', aliases: [] },
  oauthCallbackUrl: { canonical: 'VOULT_OAUTH_CALLBACK_URL', aliases: [] },
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

// Each Voult instance serves its own developer dashboard at /dashboard.
const dashboardUrl = (baseURL) => new URL('/dashboard', baseURL).href;

/**
 * @param {NodeJS.Dict<string | undefined>} env
 * @returns {string}
 */
function resolveNodeEnv(env) {
  return (
    trimToUndefined(env.NODE_ENV) ??
    trimToUndefined(processEnv().NODE_ENV) ??
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

const OAUTH_PATH_DEFAULTS = { successPath: '/', mfaPath: '/mfa', errorPath: '/login' };

/**
 * Where the hosted-OAuth callback sends the browser, relative to VOULT_APP_URL.
 * @param {Partial<Record<keyof typeof OAUTH_PATH_DEFAULTS, string>> | undefined} oauth
 */
function normalizeOAuthPaths(oauth = {}) {
  return Object.fromEntries(Object.entries(OAUTH_PATH_DEFAULTS).map(([key, fallback]) => {
    const value = trimToUndefined(oauth[key]) ?? fallback;
    if (!value.startsWith('/') || value.startsWith('//')) {
      throw new Error(`[voult] oauth.${key} must be a path starting with "/" (got "${value}").`);
    }
    return [key, value];
  }));
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
  const baseURL = requireHttpUrl(config.baseURL, 'VOULT_BASE_URL');

  if (!clientId) {
    throw new Error(
      `[voult] Missing VOULT_CLIENT_ID. Create an App in the Voult dashboard (${dashboardUrl(baseURL)}), then copy the Client ID into your .env as VOULT_CLIENT_ID.`
    );
  }

  if (!clientSecret) {
    throw new Error(
      `[voult] Missing VOULT_CLIENT_SECRET. Copy the Client Secret from your App in the Voult dashboard (${dashboardUrl(baseURL)}) into your .env as VOULT_CLIENT_SECRET. The secret is required for this Express BFF and must not be sent to the browser.`
    );
  }

  const appUrl = trimToUndefined(config.appUrl)
    ? requireHttpUrl(config.appUrl, 'VOULT_APP_URL')
    : undefined;
  const oauthCallbackUrl = trimToUndefined(config.oauthCallbackUrl)
    ? requireHttpUrl(config.oauthCallbackUrl, 'VOULT_OAUTH_CALLBACK_URL')
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
    oauthCallbackUrl,
    oauth: normalizeOAuthPaths(config.oauth),
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
  const env = options.env ?? processEnv();
  const overrides = options.overrides ?? {};

  return normalizeConfig(
    {
      baseURL: overrides.baseURL ?? readEnvValue(env, ENV_FIELDS.baseURL),
      clientId: overrides.clientId ?? readEnvValue(env, ENV_FIELDS.clientId),
      clientSecret: overrides.clientSecret ?? readEnvValue(env, ENV_FIELDS.clientSecret),
      sessionSecret: overrides.sessionSecret ?? readEnvValue(env, ENV_FIELDS.sessionSecret),
      appUrl: overrides.appUrl ?? readEnvValue(env, ENV_FIELDS.appUrl),
      oauthCallbackUrl: overrides.oauthCallbackUrl ?? readEnvValue(env, ENV_FIELDS.oauthCallbackUrl),
      oauth: overrides.oauth,
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
  const env = options.env ?? processEnv();

  // `oauth` paths may also be passed at the top level: createVoultRouter({ oauth: { ... } }).
  if (options.config) {
    return normalizeConfig({ ...options.config, oauth: options.oauth ?? options.config.oauth }, env);
  }

  return loadConfigFromEnv({
    env,
    overrides: options.oauth ? { ...options.overrides, oauth: options.oauth } : options.overrides,
  });
}
