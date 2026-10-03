import {
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
import { catchAsync } from './catchAsync.js';
import { requireAuth } from './requireAuth.js';
import {
  cookieOptions,
  readCookie,
  renewSessionFromRefreshCookie,
  toPublicAuthResult,
} from './tokens.js';
import { COOKIE_MFA_PENDING, MFA_PENDING_MAX_AGE_MS } from './oauth.js';

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {object} result
 */
function sendAuthResult(req, res, result) {
  // Park the MFA pending token server-side too (as hosted OAuth does), so /mfa/verify needs only
  // the code and a page reload doesn't lose the sign-in. The JSON still carries it for older clients.
  if (result?.mfaRequired && result.mfaPendingToken && req.voultConfig?.session?.strategy === 'cookie') {
    res.cookie(COOKIE_MFA_PENDING, result.mfaPendingToken, cookieOptions(req.voultConfig, { maxAge: MFA_PENDING_MAX_AGE_MS }));
  }
  res.json(toPublicAuthResult(req, result));
}

/**
 * @param {import('express').Router} router
 */
export function registerAuthRoutes(router) {
  router.get(
    '/session',
    catchAsync(async (req, res) => {
      const client = req.voult;
      await renewSessionFromRefreshCookie(req, res);

      if (!client?.accessToken) {
        // A sign-in that stopped at MFA: the page should show the code prompt.
        const mfaPending = Boolean(readCookie(req, COOKIE_MFA_PENDING));
        res.json({ authenticated: false, user: null, ...(mfaPending && { mfaPending: true }) });
        return;
      }

      const localUser = client.getCurrentUser();
      if (localUser?.id || localUser?.email) {
        res.json({ authenticated: true, user: localUser });
        return;
      }

      try {
        const user = await getCurrentUser(client);
        res.json({ authenticated: true, user });
      } catch {
        res.json({ authenticated: false, user: null });
      }
    })
  );

  router.post(
    '/register',
    catchAsync(async (req, res) => {
      const { email, password, fullName, username } = req.body ?? {};
      const result = await signUpWithEmailAndPassword(
        email,
        password,
        { fullName, username },
        req.voult
      );
      sendAuthResult(req, res, result);
    })
  );

  router.post(
    '/username-register',
    catchAsync(async (req, res) => {
      const { username, password, fullName, email } = req.body ?? {};
      const result = await signUpWithUsernameAndPassword(
        username,
        password,
        { fullName, email },
        req.voult
      );
      sendAuthResult(req, res, result);
    })
  );

  router.post(
    '/email-login',
    catchAsync(async (req, res) => {
      const { email, password } = req.body ?? {};
      const result = await signInWithEmailAndPassword(email, password, req.voult);
      sendAuthResult(req, res, result);
    })
  );

  router.post(
    '/username-login',
    catchAsync(async (req, res) => {
      const { username, password } = req.body ?? {};
      const result = await signInWithUsernameAndPassword(username, password, req.voult);
      sendAuthResult(req, res, result);
    })
  );

  router.post(
    '/logout',
    catchAsync(async (req, res) => {
      const result = await signOut(req.voult);
      res.json(result);
    })
  );

  router.post(
    '/sessions/refresh',
    catchAsync(async (req, res) => {
      if (req.body?.refreshToken) {
        req.voult.refreshToken = req.body.refreshToken;
      }

      const result = await refreshSession(req.voult);
      sendAuthResult(req, res, result);
    })
  );

  router.get(
    '/user/me',
    requireAuth,
    catchAsync(async (req, res) => {
      const user = await getCurrentUser(req.voult);
      res.json({ user });
    })
  );

  router.patch(
    '/user/me',
    requireAuth,
    catchAsync(async (req, res) => {
      const result = await updateProfile(req.body ?? {}, req.voult);
      res.json(result);
    })
  );

  router.post(
    '/user/forgot-password',
    catchAsync(async (req, res) => {
      const result = await sendPasswordResetEmail(req.body?.email, req.voult);
      res.json(result);
    })
  );

  router.post(
    '/user/reset-password',
    catchAsync(async (req, res) => {
      const token = req.body?.token;
      const newPassword = req.body?.newPassword ?? req.body?.password;
      const appId = req.body?.appId;
      const result = await resetPassword(token, newPassword, { appId }, req.voult);
      res.json(result);
    })
  );

  router.get(
    '/user/verify-email',
    catchAsync(async (req, res) => {
      const token = req.query?.token;
      const appId = req.query?.appId;
      const result = await verifyEmail(token, { appId }, req.voult);
      res.json(result);
    })
  );

  router.post(
    '/mfa/verify',
    catchAsync(async (req, res) => {
      const { mfaToken } = req.body ?? {};
      // Password sign-in hands the token to the page; hosted OAuth keeps it in a cookie.
      const mfaPendingToken = req.body?.mfaPendingToken ?? readCookie(req, COOKIE_MFA_PENDING);
      const result = await verifyMfaLogin(mfaPendingToken, mfaToken, req.voult);
      res.clearCookie(COOKIE_MFA_PENDING, cookieOptions(req.voultConfig));
      sendAuthResult(req, res, result);
    })
  );

  router.get(
    '/mfa/status',
    requireAuth,
    catchAsync(async (req, res) => {
      const result = await getMfaStatus(req.voult);
      res.json(result);
    })
  );
}
