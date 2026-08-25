import { Router, json } from 'express';
import { resolveConfig } from './config.js';
import { errorHandler } from './errors.js';
import { createVoultMiddleware } from './middleware.js';
import { registerAuthRoutes } from './routes.js';

/**
 * @typedef {import('express').Router} ExpressRouter
 * @typedef {import('./index.js').CreateVoultRouterOptions} CreateVoultRouterOptions
 */

/**
 * Create an Express router for Voult auth routes.
 *
 * @param {CreateVoultRouterOptions} [options]
 * @returns {ExpressRouter}
 */
export function createVoultRouter(options = {}) {
  const config = resolveConfig(options);
  const router = Router();

  router.use(json());
  router.use(createVoultMiddleware({ config }));
  registerAuthRoutes(router);
  router.use(errorHandler);

  return router;
}
