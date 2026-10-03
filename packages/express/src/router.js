import { Router } from 'express';
import { createVoultHandler, normalizeVoultError, resolveConfig } from '@voult/core';
import { toRequest, writeResponse } from './fetch.js';
import { createVoultMiddleware } from './middleware.js';

/**
 * @typedef {import('express').Router} ExpressRouter
 * @typedef {import('./index.js').CreateVoultRouterOptions} CreateVoultRouterOptions
 */

/**
 * Create an Express router for Voult auth routes. The routes live in @voult/core; this
 * translates Express requests to Fetch API `Request`s and back. No `express.json()` needed.
 *
 * @param {CreateVoultRouterOptions} [options]
 * @returns {ExpressRouter}
 */
export function createVoultRouter(options = {}) {
  const config = resolveConfig(options);
  const handle = createVoultHandler(config);
  // Paths the router doesn't serve fall through with req.voult set, as before 0.3.
  const voultMiddleware = createVoultMiddleware({ config });
  const router = Router();

  router.use(async (req, res, next) => {
    try {
      const response = await handle(await toRequest(req), { basePath: req.baseUrl, notFound: () => null });
      if (!response) {
        voultMiddleware(req, res, next);
        return;
      }
      await writeResponse(res, response);
    } catch (err) {
      if (res.headersSent) {
        next(err);
        return;
      }
      const payload = normalizeVoultError(err);
      res.status(payload.error.status).json(payload);
    }
  });

  return router;
}
