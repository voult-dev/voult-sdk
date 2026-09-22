import { AuthenticationError } from '@voult/sdk';

/**
 * Block handlers that need an end-user session.
 * @type {import('express').RequestHandler}
 */
export function requireAuth(req, _res, next) {
  if (!req.voult?.accessToken) {
    next(new AuthenticationError('Authentication required'));
    return;
  }

  next();
}
