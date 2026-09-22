export const COOKIE_ACCESS = 'voult_access';
export const COOKIE_REFRESH = 'voult_refresh';
export const COOKIE_USER = 'voult_user';

const ACCESS_MAX_AGE_MS = 60 * 60 * 1000;
const REFRESH_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * @typedef {import('./index.js').VoultExpressConfig} VoultExpressConfig
 * @typedef {import('@voult/sdk').VoultClient} VoultClient
 */

/**
 * @param {VoultExpressConfig} config
 * @param {{ maxAge?: number }} [overrides]
 */
function cookieOptions(config, overrides = {}) {
  return {
    httpOnly: true,
    signed: Boolean(config.sessionSecret),
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    ...overrides,
  };
}

/**
 * @param {import('express').Request} req
 * @param {string} name
 * @returns {unknown}
 */
function readCookie(req, name) {
  return req.signedCookies?.[name] ?? req.cookies?.[name];
}

/**
 * @param {unknown} value
 * @returns {object | null}
 */
function parseUserCookie(value) {
  if (!value) {
    return null;
  }

  if (typeof value === 'object') {
    return value;
  }

  if (typeof value !== 'string') {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/**
 * Restore SDK session from cookies or the Authorization header.
 * @param {import('express').Request} req
 * @param {VoultClient} client
 * @param {VoultExpressConfig} config
 */
export function applyIncomingSession(req, client, config) {
  let accessToken;
  let refreshToken;
  let user = null;

  if (config.session.strategy === 'cookie') {
    accessToken = readCookie(req, COOKIE_ACCESS);
    refreshToken = readCookie(req, COOKIE_REFRESH);
    user = parseUserCookie(readCookie(req, COOKIE_USER));
  } else {
    const header = req.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      accessToken = header.slice('Bearer '.length).trim();
    }
    refreshToken = req.body?.refreshToken || req.headers['x-refresh-token'];
  }

  if (typeof accessToken === 'string' && accessToken.length > 0) {
    client.setSession(user || {}, accessToken, refreshToken || null);
  }

  req.voultIncomingSession = {
    accessToken: client.accessToken || null,
    refreshToken: client.refreshToken || null,
  };
}

/**
 * Write or clear session cookies. Must run before response headers are sent.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {VoultExpressConfig} config
 */
export function persistOutgoingSession(req, res, config) {
  if (config.session.strategy !== 'cookie') {
    return;
  }

  const client = req.voult;
  if (!client) {
    return;
  }

  if (client.accessToken) {
    res.cookie(COOKIE_ACCESS, client.accessToken, cookieOptions(config, { maxAge: ACCESS_MAX_AGE_MS }));

    if (client.refreshToken) {
      res.cookie(COOKIE_REFRESH, client.refreshToken, cookieOptions(config, { maxAge: REFRESH_MAX_AGE_MS }));
    }

    if (client.user) {
      res.cookie(COOKIE_USER, JSON.stringify(client.user), cookieOptions(config, { maxAge: REFRESH_MAX_AGE_MS }));
    }

    return;
  }

  const hadSession = Boolean(req.voultIncomingSession?.accessToken);
  if (hadSession) {
    clearSessionCookies(res, config);
  }
}

/**
 * @param {import('express').Response} res
 * @param {VoultExpressConfig} config
 */
export function clearSessionCookies(res, config) {
  const options = cookieOptions(config);
  res.clearCookie(COOKIE_ACCESS, options);
  res.clearCookie(COOKIE_REFRESH, options);
  res.clearCookie(COOKIE_USER, options);
}

/**
 * Persist tokens when the handler writes the response, not on `finish`.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {VoultExpressConfig} config
 */
export function attachSessionPersistence(req, res, config) {
  let flushed = false;

  const persist = () => {
    if (flushed || res.headersSent) {
      return;
    }
    flushed = true;
    persistOutgoingSession(req, res, config);
  };

  for (const method of ['json', 'send', 'redirect']) {
    const original = res[method].bind(res);
    res[method] = (...args) => {
      persist();
      return original(...args);
    };
  }
}

/**
 * Cookie strategy keeps tokens in httpOnly cookies; bearer returns them in JSON.
 * @param {import('express').Request} req
 * @param {object} result
 */
export function toPublicAuthResult(req, result) {
  if (!result || result.mfaRequired) {
    return result;
  }

  if (req.voultConfig?.session?.strategy !== 'cookie') {
    return result;
  }

  const { accessToken, refreshToken, token, ...rest } = result;
  return rest;
}
