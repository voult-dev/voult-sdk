// @voult/core: the Voult router on the Fetch API, for adapters (@voult/express, @voult/next).
// Apps install an adapter, not this package.
export { createVoultHandler } from './handler.js';
export { loadConfigFromEnv, resolveConfig } from './config.js';
export { normalizeVoultError } from './errors.js';
export {
  COOKIE_ACCESS,
  COOKIE_MFA_PENDING,
  COOKIE_OAUTH,
  COOKIE_REFRESH,
  COOKIE_USER,
  createVoultClient,
  getSessionFromRequest,
  renewSession,
  restoreSession,
  sessionCookies,
} from './session.js';
export { readCookieHeader, serializeCookie, setCookieHeader, sign, unsign } from './cookies.js';
