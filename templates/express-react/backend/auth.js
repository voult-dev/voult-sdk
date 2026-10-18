import { createVoultMiddleware, createVoultRouter } from '@voult/express';

/**
 * Every auth route, from @voult/express: sign-up/in, sign-out, MFA, sessions, linked accounts,
 * passkeys, magic links, password reset, hosted Google/GitHub sign-in. Nothing to write here;
 * see the route reference: https://github.com/voult-dev/voult/blob/main/docs/integration/QUICK_START.md#route-reference
 * @param {import('express').Express} app
 */
export function mountAuth(app) {
  app.use(createVoultMiddleware());              // req.voult on every request (your routes use it)
  app.use('/api/auth', createVoultRouter());     // the auth routes, under /api/auth
}
