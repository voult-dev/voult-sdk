import crypto from 'node:crypto';
import {
  exchangeOAuthCode,
  getAppInfo,
  getOAuthAuthorizationUrl,
  linkOAuthProvider,
} from '@voult/sdk';
import { catchAsync } from './catchAsync.js';
import { cookieOptions, readCookie } from './tokens.js';

// Hosted OAuth: provider credentials live in the Voult dashboard, never in this server's env.
//   GET /oauth/providers          → which providers the app can use
//   GET /oauth/:provider/start    → 302 to the provider (via Voult)
//   GET /oauth/callback           → Voult sends the browser back here; we set the session

export const COOKIE_OAUTH = 'voult_oauth';
export const COOKIE_MFA_PENDING = 'voult_mfa_pending';

const OAUTH_COOKIE_MAX_AGE_MS = 10 * 60 * 1000; // matches Voult's signed state lifetime
const MFA_PENDING_MAX_AGE_MS = 5 * 60 * 1000;
const PROVIDERS_CACHE_MS = 60 * 1000;
const INTENTS = ['authenticate', 'login', 'register', 'link'];

/**
 * Only same-site relative paths, so `returnTo` can't send users to another site.
 * @param {unknown} value
 * @param {string} fallback
 */
export function safeReturnTo(value, fallback) {
  return typeof value === 'string'
    && value.length <= 2048
    && value.startsWith('/')
    && !value.startsWith('//')
    && !value.includes('\\')
    ? value
    : fallback;
}

/**
 * A browser URL on the integrator's frontend (VOULT_APP_URL), or same-origin when unset.
 * @param {import('./index.js').VoultExpressConfig} config
 * @param {string} path
 * @param {Record<string, string | undefined>} [params]
 */
function appLocation(config, path, params = {}) {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value != null && value !== '')
  ).toString();
  const base = config.appUrl ? config.appUrl.replace(/\/$/, '') : '';
  const joiner = path.includes('?') ? '&' : '?';
  return `${base}${path}${query ? `${joiner}${query}` : ''}`;
}

/**
 * The URL Voult sends the browser back to. Must be on the app's callback allowlist.
 * Behind a proxy, set `app.set('trust proxy', 1)` or VOULT_OAUTH_CALLBACK_URL.
 * @param {import('express').Request} req
 * @param {import('./index.js').VoultExpressConfig} config
 */
export function oauthCallbackUrl(req, config) {
  return config.oauthCallbackUrl || `${req.protocol}://${req.get('host')}${req.baseUrl}/oauth/callback`;
}

function redirectWithError(res, config, code, description) {
  res.redirect(appLocation(config, config.oauth.errorPath, {
    voult_error: code,
    voult_error_description: description,
  }));
}

function errorCode(err) {
  return err?.apiCode || err?.code || 'OAUTH_FAILED';
}

function readOAuthCookie(req) {
  const raw = readCookie(req, COOKIE_OAUTH);
  if (typeof raw !== 'string') return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * @param {import('express').Router} router
 */
export function registerOAuthRoutes(router) {
  let providersCache = { at: 0, value: null };

  router.get(
    '/oauth/providers',
    catchAsync(async (req, res) => {
      if (!providersCache.value || Date.now() - providersCache.at > PROVIDERS_CACHE_MS) {
        const info = await getAppInfo(req.voult);
        const providers = Object.fromEntries(
          Object.entries(info.providers || {}).map(([name, s]) => [name, Boolean(s.enabled && s.configured)])
        );
        providersCache = { at: Date.now(), value: { providers } };
      }
      res.json(providersCache.value);
    })
  );

  router.get(
    '/oauth/:provider/start',
    catchAsync(async (req, res) => {
      const config = req.voultConfig;
      if (config.session.strategy !== 'cookie') {
        res.status(400).json({
          error: {
            code: 'OAUTH_REQUIRES_COOKIE_SESSION',
            message: 'Hosted OAuth sets the session in a cookie. Use VOULT_SESSION_STRATEGY=cookie, or call the @voult/sdk OAuth functions yourself.',
            status: 400,
          },
        });
        return;
      }

      const provider = String(req.params.provider).toLowerCase();
      const intent = req.query.intent ?? 'authenticate';
      if (!INTENTS.includes(intent)) {
        redirectWithError(res, config, 'INVALID_INTENT', `intent must be one of: ${INTENTS.join(', ')}`);
        return;
      }
      if (intent === 'link' && !req.voult.accessToken) {
        redirectWithError(res, config, 'LOGIN_REQUIRED', 'Sign in before linking another account.');
        return;
      }

      const nonce = crypto.randomBytes(24).toString('base64url');
      const redirectUri = oauthCallbackUrl(req, config);
      const returnTo = safeReturnTo(req.query.returnTo, config.oauth.successPath);

      let authUrl;
      try {
        ({ authUrl } = intent === 'link'
          ? await linkOAuthProvider(provider, { redirectUri, state: nonce }, req.voult)
          : await getOAuthAuthorizationUrl(provider, { intent, redirectUri, state: nonce }, req.voult));
      } catch (err) {
        redirectWithError(res, config, errorCode(err), err.message);
        return;
      }

      // Ties the callback to this browser: Voult echoes `state`, we compare it to this cookie.
      res.cookie(
        COOKIE_OAUTH,
        JSON.stringify({ nonce, provider, intent, returnTo, redirectUri }),
        cookieOptions(config, { maxAge: OAUTH_COOKIE_MAX_AGE_MS })
      );
      res.redirect(authUrl);
    })
  );

  router.get(
    '/oauth/callback',
    catchAsync(async (req, res) => {
      const config = req.voultConfig;
      const saved = readOAuthCookie(req);
      res.clearCookie(COOKIE_OAUTH, cookieOptions(config));

      if (!saved?.nonce || req.query.state !== saved.nonce) {
        redirectWithError(
          res, config, 'INVALID_OAUTH_STATE',
          'This sign-in expired or was started in another browser. Please try again.'
        );
        return;
      }

      if (req.query.error) {
        redirectWithError(res, config, String(req.query.error), req.query.error_description && String(req.query.error_description));
        return;
      }

      if (req.query.linked === '1') {
        res.redirect(appLocation(config, saved.returnTo, { voult_linked: saved.provider }));
        return;
      }

      if (typeof req.query.voult_code !== 'string') {
        redirectWithError(res, config, 'MISSING_OAUTH_CODE', 'Voult did not return a sign-in code.');
        return;
      }

      let result;
      try {
        result = await exchangeOAuthCode(req.query.voult_code, { redirectUri: saved.redirectUri }, req.voult);
      } catch (err) {
        redirectWithError(res, config, errorCode(err), err.message);
        return;
      }

      if (result.mfaRequired) {
        res.cookie(COOKIE_MFA_PENDING, result.mfaPendingToken, cookieOptions(config, { maxAge: MFA_PENDING_MAX_AGE_MS }));
        res.redirect(appLocation(config, config.oauth.mfaPath));
        return;
      }

      // Session cookies are written by attachSessionPersistence as this redirect goes out.
      res.redirect(appLocation(config, saved.returnTo));
    })
  );
}
