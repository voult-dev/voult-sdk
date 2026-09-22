import cookieParser from 'cookie-parser';
import { VoultClient } from '@voult/sdk';
import { resolveConfig } from './config.js';
import { applyIncomingSession, attachSessionPersistence } from './tokens.js';

/**
 * @typedef {import('express').RequestHandler} RequestHandler
 * @typedef {import('./index.js').CreateVoultRouterOptions} CreateVoultRouterOptions
 */

/**
 * @type {RequestHandler}
 */
function passthrough(_req, _res, next) {
  next();
}

/**
 * Per-request Voult client: new instance, restore session, persist before headers.
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
      req.voult = new VoultClient({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        baseURL: config.baseURL,
      });

      applyIncomingSession(req, req.voult, config);
      attachSessionPersistence(req, res, config);
      next();
    });
  }

  return voultMiddleware;
}
