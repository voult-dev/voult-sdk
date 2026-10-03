import { VoultClient, refreshSession } from '@voult/sdk';
import { readCookieHeader } from './cookies.js';

export const COOKIE_ACCESS = 'voult_access';
export const COOKIE_REFRESH = 'voult_refresh';
export const COOKIE_USER = 'voult_user';
export const COOKIE_OAUTH = 'voult_oauth';
export const COOKIE_MFA_PENDING = 'voult_mfa_pending';

export const ACCESS_MAX_AGE_MS = 60 * 60 * 1000;
export const REFRESH_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
export const MFA_PENDING_MAX_AGE_MS = 5 * 60 * 1000;
export const OAUTH_COOKIE_MAX_AGE_MS = 10 * 60 * 1000; // matches Voult's signed state lifetime

/**
 * Cookies are described as `{ name, value, options }` and written by the adapter: core signs
 * them with WebCrypto, @voult/express hands them to `res.cookie()`. Same bytes either way.
 * @typedef {import('./index.js').VoultConfig} VoultConfig
 * @typedef {{ name: string, value: string, options: Record<string, unknown> }} CookieToSet
 * @typedef {(name: string) => unknown} ReadCookie
 */

/**
 * @param {VoultConfig} config
 * @param {{ maxAge?: number }} [overrides]
 */
export function cookieOptions(config, overrides = {}) {
  return {
    httpOnly: true,
    signed: Boolean(config.sessionSecret),
    sameSite: 'lax',
    secure: globalThis.process?.env?.NODE_ENV === 'production',
    path: '/',
    ...overrides,
  };
}

/** @returns {CookieToSet} */
export function setCookie(config, name, value, overrides) {
  return { name, value, options: cookieOptions(config, overrides) };
}

/** Express `res.clearCookie()`: an empty value that expired in 1970. @returns {CookieToSet} */
export function clearCookie(config, name) {
  return { name, value: '', options: { ...cookieOptions(config), expires: new Date(1) } };
}

/** @returns {CookieToSet[]} */
export function clearSessionCookies(config) {
  return [COOKIE_ACCESS, COOKIE_REFRESH, COOKIE_USER].map((name) => clearCookie(config, name));
}

/**
 * @param {unknown} value
 * @returns {object | null}
 */
export function parseUserCookie(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/** @param {VoultConfig} config */
export function createVoultClient(config) {
  return new VoultClient({ clientId: config.clientId, clientSecret: config.clientSecret, baseURL: config.baseURL });
}

/**
 * Restore the SDK session from cookies (cookie strategy) or the Authorization header (bearer).
 * Returns what came in, so the outgoing side knows whether there was a session to clear.
 * @param {VoultClient} client
 * @param {{ read: ReadCookie, authorization?: string | null, refreshToken?: unknown }} incoming
 * @param {VoultConfig} config
 */
export function restoreSession(client, { read, authorization, refreshToken: bearerRefresh }, config) {
  let accessToken;
  let refreshToken;
  let user = null;

  if (config.session.strategy === 'cookie') {
    accessToken = read(COOKIE_ACCESS);
    refreshToken = read(COOKIE_REFRESH);
    user = parseUserCookie(read(COOKIE_USER));
  } else {
    if (typeof authorization === 'string' && authorization.startsWith('Bearer ')) {
      accessToken = authorization.slice('Bearer '.length).trim();
    }
    refreshToken = bearerRefresh;
  }

  if (typeof accessToken === 'string' && accessToken.length > 0) {
    client.setSession(user || {}, accessToken, refreshToken || null);
  }

  return { accessToken: client.accessToken || null, refreshToken: client.refreshToken || null };
}

/**
 * The cookies that persist the client's session when the response goes out: fresh tokens,
 * or a clear when a session that came in is gone (sign-out). Cookie strategy only.
 * @returns {CookieToSet[]}
 */
export function sessionCookies(client, incoming, config) {
  if (config.session.strategy !== 'cookie' || !client) return [];

  if (client.accessToken) {
    return [
      setCookie(config, COOKIE_ACCESS, client.accessToken, { maxAge: ACCESS_MAX_AGE_MS }),
      ...(client.refreshToken ? [setCookie(config, COOKIE_REFRESH, client.refreshToken, { maxAge: REFRESH_MAX_AGE_MS })] : []),
      ...(client.user ? [setCookie(config, COOKIE_USER, JSON.stringify(client.user), { maxAge: REFRESH_MAX_AGE_MS })] : []),
    ];
  }

  return incoming?.accessToken ? clearSessionCookies(config) : [];
}

/**
 * The access cookie lives 1h, the refresh cookie 30 days: when only the refresh cookie is
 * left, get a new access token instead of treating the user as signed out. The new tokens go
 * out with the response (sessionCookies). A dead refresh token clears the session cookies,
 * which this returns.
 * @param {VoultClient} client
 * @param {ReadCookie} read
 * @param {VoultConfig} config
 * @returns {Promise<CookieToSet[]>}
 */
export async function renewSession(client, read, config) {
  if (!client || client.accessToken || config?.session?.strategy !== 'cookie') return [];

  const refreshToken = read(COOKIE_REFRESH);
  if (typeof refreshToken !== 'string' || !refreshToken) return [];

  client.refreshToken = refreshToken;
  try {
    await refreshSession(client);
    // The SDK only counts a client as signed in with a user object: reuse the (30-day)
    // user cookie, or {} so the caller can fetch /user/me.
    client.user = client.user ?? parseUserCookie(read(COOKIE_USER)) ?? {};
    return [];
  } catch {
    client.clearSession();
    return clearSessionCookies(config);
  }
}

/**
 * Cookie strategy keeps tokens in httpOnly cookies; bearer returns them in JSON.
 * @param {object} result
 * @param {VoultConfig} config
 */
export function toPublicAuthResult(result, config) {
  if (!result || result.mfaRequired || config.session.strategy !== 'cookie') return result;
  const { accessToken, refreshToken, token, ...rest } = result;
  return rest;
}

/**
 * The Voult session behind a Fetch API `Request`: a fresh VoultClient with the cookie or bearer
 * session restored. For adapters (`@voult/next`'s `getSession`, middleware) and the router.
 * @param {Request} request
 * @param {VoultConfig} config
 * @param {{ body?: Record<string, unknown> }} [options]
 */
export async function getSessionFromRequest(request, config, { body } = {}) {
  const { cookies, signedCookies } = config.session.strategy === 'cookie'
    ? await readCookieHeader(request.headers.get('cookie'), config.sessionSecret)
    : { cookies: {}, signedCookies: {} };
  /** @type {ReadCookie} */
  const read = (name) => signedCookies[name] ?? cookies[name];

  const client = createVoultClient(config);
  const incoming = restoreSession(client, {
    read,
    authorization: request.headers.get('authorization'),
    refreshToken: body?.refreshToken || request.headers.get('x-refresh-token'),
  }, config);

  return { client, incoming, read };
}
