import {
  AuthenticationError,
  getCurrentUser,
  getMfaStatus,
  refreshSession,
  resetPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithUsernameAndPassword,
  signOut,
  signUpWithEmailAndPassword,
  signUpWithUsernameAndPassword,
  updateProfile,
  verifyEmail,
  verifyMfaLogin,
} from '@voult/sdk';
import { normalizeVoultError } from './errors.js';
import { COOKIE_MFA_PENDING, MFA_PENDING_MAX_AGE_MS, clearCookie, setCookie, toPublicAuthResult } from './session.js';

/**
 * @typedef {import('./handler.js').Context} Context
 * @typedef {import('./handler.js').Route} Route
 */

/** @param {unknown} body @param {number} [status] */
export const json = (body, status = 200) => ({ status, body });
/** @param {string} location */
export const redirect = (location) => ({ status: 302, location });

/**
 * Only signed-in users get through: renews an expired access cookie from the refresh cookie
 * first, then answers 401 JSON.
 * @param {(ctx: Context) => Promise<unknown>} handler
 */
export function authenticated(handler) {
  return async (ctx) => {
    await ctx.renew();
    if (!ctx.client.accessToken) {
      const payload = normalizeVoultError(new AuthenticationError('Authentication required'));
      return json(payload, payload.error.status);
    }
    return handler(ctx);
  };
}

/** @param {Context} ctx @param {object} result */
function authResult(ctx, result) {
  // Park the MFA pending token server-side too (as hosted OAuth does), so /mfa/verify needs only
  // the code and a page reload doesn't lose the sign-in. The JSON still carries it for older clients.
  if (result?.mfaRequired && result.mfaPendingToken && ctx.config.session.strategy === 'cookie') {
    ctx.cookies.push(setCookie(ctx.config, COOKIE_MFA_PENDING, result.mfaPendingToken, { maxAge: MFA_PENDING_MAX_AGE_MS }));
  }
  return json(toPublicAuthResult(result, ctx.config));
}

/** @type {Route[]} */
export const authRoutes = [
  ['GET', '/session', async (ctx) => {
    await ctx.renew();

    if (!ctx.client.accessToken) {
      // A sign-in that stopped at MFA: the page should show the code prompt.
      const mfaPending = Boolean(ctx.read(COOKIE_MFA_PENDING));
      return json({ authenticated: false, user: null, ...(mfaPending && { mfaPending: true }) });
    }

    const localUser = ctx.client.getCurrentUser();
    if (localUser?.id || localUser?.email) {
      return json({ authenticated: true, user: localUser });
    }

    try {
      return json({ authenticated: true, user: await getCurrentUser(ctx.client) });
    } catch {
      return json({ authenticated: false, user: null });
    }
  }],

  ['POST', '/register', async (ctx) => {
    const { email, password, fullName, username } = ctx.body;
    return authResult(ctx, await signUpWithEmailAndPassword(email, password, { fullName, username }, ctx.client));
  }],

  ['POST', '/username-register', async (ctx) => {
    const { username, password, fullName, email } = ctx.body;
    return authResult(ctx, await signUpWithUsernameAndPassword(username, password, { fullName, email }, ctx.client));
  }],

  ['POST', '/email-login', async (ctx) => {
    const { email, password } = ctx.body;
    return authResult(ctx, await signInWithEmailAndPassword(email, password, ctx.client));
  }],

  ['POST', '/username-login', async (ctx) => {
    const { username, password } = ctx.body;
    return authResult(ctx, await signInWithUsernameAndPassword(username, password, ctx.client));
  }],

  ['POST', '/logout', async (ctx) => json(await signOut(ctx.client))],

  ['POST', '/sessions/refresh', async (ctx) => {
    if (ctx.body.refreshToken) {
      ctx.client.refreshToken = ctx.body.refreshToken;
    }
    return authResult(ctx, await refreshSession(ctx.client));
  }],

  ['GET', '/user/me', authenticated(async (ctx) => json({ user: await getCurrentUser(ctx.client) }))],

  ['PATCH', '/user/me', authenticated(async (ctx) => json(await updateProfile(ctx.body, ctx.client)))],

  ['POST', '/user/forgot-password', async (ctx) => json(await sendPasswordResetEmail(ctx.body.email, ctx.client))],

  ['POST', '/user/reset-password', async (ctx) => {
    const { token, appId } = ctx.body;
    const newPassword = ctx.body.newPassword ?? ctx.body.password;
    return json(await resetPassword(token, newPassword, { appId }, ctx.client));
  }],

  ['GET', '/user/verify-email', async (ctx) => (
    json(await verifyEmail(ctx.query('token'), { appId: ctx.query('appId') }, ctx.client))
  )],

  ['POST', '/mfa/verify', async (ctx) => {
    const { mfaToken } = ctx.body;
    // Password sign-in hands the token to the page; hosted OAuth keeps it in a cookie.
    const mfaPendingToken = ctx.body.mfaPendingToken ?? ctx.read(COOKIE_MFA_PENDING);
    const result = await verifyMfaLogin(mfaPendingToken, mfaToken, ctx.client);
    ctx.cookies.push(clearCookie(ctx.config, COOKIE_MFA_PENDING));
    return authResult(ctx, result);
  }],

  ['GET', '/mfa/status', authenticated(async (ctx) => json(await getMfaStatus(ctx.client)))],
];
