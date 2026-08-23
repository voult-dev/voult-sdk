import cookieParser from 'cookie-parser';
import { resolveConfig } from './config.js';

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
 * Thin helper that parses cookies (cookie strategy) and attaches resolved config.
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
      next();
    });
  }

  return voultMiddleware;
}
