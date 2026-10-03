import cookieParser from 'cookie-parser';
import { createVoultClient, resolveConfig, restoreSession, sessionCookies } from '@voult/core';

/**
 * @typedef {import('express').RequestHandler} RequestHandler
 * @typedef {import('./index.js').CreateVoultRouterOptions} CreateVoultRouterOptions
 * @typedef {import('@voult/core').CookieToSet} CookieToSet
 */

/**
 * @type {RequestHandler}
 */
function passthrough(_req, _res, next) {
  next();
}

/** @param {import('express').Request} req */
export const readCookie = (req) => (name) => req.signedCookies?.[name] ?? req.cookies?.[name];

/**
 * Write core's cookie descriptions with `res.cookie()` (cookie-parser's secret signs them).
 * @param {import('express').Response} res
 * @param {CookieToSet[]} cookies
 */
export function applyCookies(res, cookies) {
  for (const { name, value, options } of cookies) res.cookie(name, value, options);
}

/**
 * Persist the session when the handler writes the response, not on `finish`.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
function attachSessionPersistence(req, res) {
  let flushed = false;

  const persist = () => {
    if (flushed || res.headersSent) return;
    flushed = true;
    applyCookies(res, sessionCookies(req.voult, req.voultIncomingSession, req.voultConfig));
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
 * Per-request Voult client for your own routes: new instance, session restored from the
 * cookies (or bearer header), new tokens persisted before the response goes out.
 *
 * @param {CreateVoultRouterOptions} [options]
 * @returns {RequestHandler}
 */
export function createVoultMiddleware(options = {}) {
  const config = resolveConfig(options);
  const parseCookies =
    config.session.strategy === 'cookie'
      ? cookieParser(config.sessionSecret)
      : passthrough;

  /** @type {RequestHandler} */
  function voultMiddleware(req, res, next) {
    parseCookies(req, res, (err) => {
      if (err) {
        next(err);
        return;
      }

      req.voultConfig = config;
      req.voult = createVoultClient(config);
      req.voultIncomingSession = restoreSession(req.voult, {
        read: readCookie(req),
        authorization: req.headers.authorization,
        refreshToken: req.body?.refreshToken || req.headers['x-refresh-token'],
      }, config);
      attachSessionPersistence(req, res);
      next();
    });
  }

  return voultMiddleware;
}
