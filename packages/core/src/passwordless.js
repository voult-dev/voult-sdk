import {
  createPasskeyLoginOptions,
  createPasskeyRegistrationOptions,
  deletePasskey,
  listPasskeys,
  signInWithEmailLink,
  updatePasskey,
  verifyEmailLink,
  verifyPasskeyLogin,
  verifyPasskeyRegistration,
} from '@voult/sdk';
import { appLocation, errorCode, oauthCallbackUrl, redirectWithError, safeReturnTo } from './oauth.js';
import { authResult, authenticated, json, redirect } from './routes.js';
import { COOKIE_MFA_PENDING, MFA_PENDING_MAX_AGE_MS, setCookie } from './session.js';

// Passkeys and magic links: sign-ins without a password.
//   Passkeys: the page runs the WebAuthn ceremony (@simplewebauthn/browser or navigator.credentials)
//   with the options from here, then posts the browser's credential back.
//   Magic links: Voult emails a link to GET /magic-link/verify on this server, which sets the
//   session and redirects like the OAuth callback.

/**
 * @typedef {import('./handler.js').Context} Context
 * @typedef {import('./handler.js').Route} Route
 */

/**
 * The URL magic links open: next to the OAuth callback, so the one callback URL on the app's
 * allowlist covers it too (Voult accepts any page on an allowlisted callback's origin).
 * @param {Context} ctx
 */
function magicLinkUrl(ctx) {
  const url = new URL(oauthCallbackUrl(ctx));
  url.pathname = url.pathname.endsWith('/oauth/callback')
    ? url.pathname.replace(/\/oauth\/callback$/, '/magic-link/verify')
    : `${ctx.basePath}/magic-link/verify`;
  url.search = '';
  return url;
}

/** @type {Route[]} */
export const passwordlessRoutes = [
  ['POST', '/passkeys/register/options', authenticated(async (ctx) => (
    json(await createPasskeyRegistrationOptions({ deviceName: ctx.body.deviceName }, ctx.client))
  ))],
  ['POST', '/passkeys/register/verify', authenticated(async (ctx) => (
    json(await verifyPasskeyRegistration(ctx.body.credential, { deviceName: ctx.body.deviceName }, ctx.client))
  ))],
  ['GET', '/passkeys', authenticated(async (ctx) => json(await listPasskeys(ctx.client)))],
  ['PATCH', '/passkeys/:id', authenticated(async (ctx) => (
    json(await updatePasskey(ctx.params.id, ctx.body.deviceName, ctx.client))
  ))],
  ['DELETE', '/passkeys/:id', authenticated(async (ctx) => json(await deletePasskey(ctx.params.id, ctx.client)))],

  // Public: sign in with a passkey. Sets the session (or the MFA-pending cookie) like password sign-in.
  ['POST', '/passkeys/login/options', async (ctx) => (
    json(await createPasskeyLoginOptions(ctx.body.email ? { email: ctx.body.email } : {}, ctx.client))
  )],
  ['POST', '/passkeys/login/verify', async (ctx) => authResult(ctx, await verifyPasskeyLogin(ctx.body.credential, ctx.client))],

  // Public. Answers the same whether or not the email has an account, so it can't be used to
  // find out who signed up. Mistakes in the request or the app's setup still come back as errors.
  ['POST', '/magic-link', async (ctx) => {
    const url = magicLinkUrl(ctx);
    const returnTo = safeReturnTo(ctx.body.returnTo, '');
    if (returnTo) url.searchParams.set('returnTo', returnTo);
    try {
      await signInWithEmailLink(ctx.body.email, { redirectUri: url.href }, ctx.client);
    } catch (err) {
      if (err?.status !== 404) throw err;
    }
    return json({ sent: true });
  }],

  // ponytail: a GET that spends a one-time token: mail scanners that open links can use it up first.
  // Upgrade path: a confirm page that POSTs, if users report "link expired" on first click.
  ['GET', '/magic-link/verify', async (ctx) => {
    const { config } = ctx;
    let result;
    try {
      result = await verifyEmailLink(ctx.query('token'), ctx.client);
    } catch (err) {
      return redirectWithError(config, errorCode(err), err.message);
    }

    if (result.mfaRequired) {
      ctx.cookies.push(setCookie(config, COOKIE_MFA_PENDING, result.mfaPendingToken, { maxAge: MFA_PENDING_MAX_AGE_MS }));
      return redirect(appLocation(config, config.oauth.mfaPath));
    }

    // The session cookies go out with this redirect (sessionCookies, in the handler).
    return redirect(appLocation(config, safeReturnTo(ctx.query('returnTo'), config.oauth.successPath)));
  }],
];
