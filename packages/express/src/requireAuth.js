import { AuthenticationError } from '@voult/sdk';
import { normalizeVoultError } from './errors.js';
import { renewSessionFromRefreshCookie } from './tokens.js';

/**
 * Only let signed-in users through. Use it on your own routes too:
 *
 *   app.use(createVoultMiddleware());
 *   app.get('/api/orders', requireAuth, (req, res) => { ... req.voult ... });
 *
 * Renews an expired access cookie from the refresh cookie first, and answers
 * 401 JSON (`{ error: { code, message, status } }`) itself, inside or outside the router.
 * @type {import('express').RequestHandler}
 */
export async function requireAuth(req, res, next) {
  if (!req.voult) {
    next(new Error('[voult] requireAuth needs createVoultMiddleware() (or createVoultRouter()) mounted before it.'));
    return;
  }

  try {
    await renewSessionFromRefreshCookie(req, res);
  } catch (err) {
    next(err);
    return;
  }

  if (!req.voult.accessToken) {
    const payload = normalizeVoultError(new AuthenticationError('Authentication required'));
    res.status(payload.error.status).json(payload);
    return;
  }

  next();
}
