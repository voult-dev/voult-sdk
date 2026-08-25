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
} from 'voult-sdk';
import { catchAsync } from './catchAsync.js';
import { requireAuth } from './requireAuth.js';
import { toPublicAuthResult } from './tokens.js';

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {object} result
 */
function sendAuthResult(req, res, result) {
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
      if (!client?.accessToken) {
        res.json({ authenticated: false, user: null });
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
      const { mfaPendingToken, mfaToken } = req.body ?? {};
      const result = await verifyMfaLogin(mfaPendingToken, mfaToken, req.voult);
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
