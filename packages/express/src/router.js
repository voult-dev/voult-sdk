import { Router } from 'express';
import { resolveConfig } from './config.js';
import { createVoultMiddleware } from './middleware.js';

/**
 * @typedef {import('express').Router} ExpressRouter
 * @typedef {import('./index.js').CreateVoultRouterOptions} CreateVoultRouterOptions
 */

/**
 * Create an Express router for Voult auth routes.
 * Phase 1 Step 2 mounts an empty router; routes land in a later step.
 *
 * @param {CreateVoultRouterOptions} [options]
 * @returns {ExpressRouter}
 */
export function createVoultRouter(options = {}) {
  const config = resolveConfig(options);
  const router = Router();
  router.use(createVoultMiddleware({ config }));
  return router;
}
