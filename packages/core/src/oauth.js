import {
  exchangeOAuthCode,
  getAppInfo,
  getOAuthAuthorizationUrl,
  linkOAuthProvider,
} from '@voult/sdk';
import { base64 } from './cookies.js';
import { json, redirect } from './routes.js';
import {
  COOKIE_MFA_PENDING,
  COOKIE_OAUTH,
  MFA_PENDING_MAX_AGE_MS,
  OAUTH_COOKIE_MAX_AGE_MS,
  clearCookie,
  setCookie,
} from './session.js';

// Hosted OAuth: provider credentials live in the Voult dashboard, never in this server's env.
//   GET /oauth/providers          → which providers the app can use
//   GET /oauth/:provider/start    → 302 to the provider (via Voult)
//   GET /oauth/callback           → Voult sends the browser back here; we set the session

/**
 * @typedef {import('./handler.js').Context} Context
 * @typedef {import('./handler.js').Route} Route
 * @typedef {import('./index.js').VoultConfig} VoultConfig
 */

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
 * @param {VoultConfig} config
 * @param {string} path
 * @param {Record<string, string | undefined>} [params]
 */
export function appLocation(config, path, params = {}) {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value != null && value !== '')
  ).toString();
  const base = config.appUrl ? config.appUrl.replace(/\/$/, '') : '';
  const joiner = path.includes('?') ? '&' : '?';
  return `${base}${path}${query ? `${joiner}${query}` : ''}`;
}

/**
 * The URL Voult sends the browser back to. Must be on the app's callback allowlist.
 * Behind a proxy, let the adapter see the public URL (Express: `app.set('trust proxy', 1)`)
 * or set VOULT_OAUTH_CALLBACK_URL.
 * @param {Context} ctx
 */
export function oauthCallbackUrl(ctx) {
  return ctx.config.oauthCallbackUrl || `${ctx.url.protocol}//${ctx.url.host}${ctx.basePath}/oauth/callback`;
}

export function redirectWithError(config, code, description) {
  return redirect(appLocation(config, config.oauth.errorPath, {
    voult_error: code,
    voult_error_description: description,
  }));
}

export function errorCode(err) {
  return err?.apiCode || err?.code || 'OAUTH_FAILED';
}

function newNonce() {
  return base64(globalThis.crypto.getRandomValues(new Uint8Array(24)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function readOAuthCookie(ctx) {
  const raw = ctx.read(COOKIE_OAUTH);
  if (typeof raw !== 'string') return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** One provider cache per handler. @returns {Route[]} */
export function oauthRoutes() {
  let providersCache = { at: 0, value: null };

  return [
    ['GET', '/oauth/providers', async (ctx) => {
      if (!providersCache.value || Date.now() - providersCache.at > PROVIDERS_CACHE_MS) {
        const info = await getAppInfo(ctx.client);
        const providers = Object.fromEntries(
          Object.entries(info.providers || {}).map(([name, s]) => [name, Boolean(s.enabled && s.configured)])
        );
        providersCache = { at: Date.now(), value: { providers } };
      }
      return json(providersCache.value);
    }],

    ['GET', '/oauth/:provider/start', async (ctx) => {
      const { config, client } = ctx;
      if (config.session.strategy !== 'cookie') {
        return json({
          error: {
            code: 'OAUTH_REQUIRES_COOKIE_SESSION',
            message: 'Hosted OAuth sets the session in a cookie. Use VOULT_SESSION_STRATEGY=cookie, or call the @voult/sdk OAuth functions yourself.',
            status: 400,
          },
        }, 400);
      }

      const provider = String(ctx.params.provider).toLowerCase();
      const intent = ctx.query('intent') ?? 'authenticate';
      if (!INTENTS.includes(intent)) {
        return redirectWithError(config, 'INVALID_INTENT', `intent must be one of: ${INTENTS.join(', ')}`);
      }
      if (intent === 'link' && !client.accessToken) {
        return redirectWithError(config, 'LOGIN_REQUIRED', 'Sign in before linking another account.');
      }

      const nonce = newNonce();
      const redirectUri = oauthCallbackUrl(ctx);
      const returnTo = safeReturnTo(ctx.query('returnTo'), config.oauth.successPath);

      let authUrl;
      try {
        ({ authUrl } = intent === 'link'
          ? await linkOAuthProvider(provider, { redirectUri, state: nonce }, client)
          : await getOAuthAuthorizationUrl(provider, { intent, redirectUri, state: nonce }, client));
      } catch (err) {
        return redirectWithError(config, errorCode(err), err.message);
      }

      // Ties the callback to this browser: Voult echoes `state`, we compare it to this cookie.
      ctx.cookies.push(setCookie(
        config,
        COOKIE_OAUTH,
        JSON.stringify({ nonce, provider, intent, returnTo, redirectUri }),
        { maxAge: OAUTH_COOKIE_MAX_AGE_MS }
      ));
      return redirect(authUrl);
    }],

    ['GET', '/oauth/callback', async (ctx) => {
      const { config, client } = ctx;
      const saved = readOAuthCookie(ctx);
      ctx.cookies.push(clearCookie(config, COOKIE_OAUTH));

      if (!saved?.nonce || ctx.query('state') !== saved.nonce) {
        return redirectWithError(
          config, 'INVALID_OAUTH_STATE',
          'This sign-in expired or was started in another browser. Please try again.'
        );
      }

      if (ctx.query('error')) {
        return redirectWithError(config, ctx.query('error'), ctx.query('error_description'));
      }

      if (ctx.query('linked') === '1') {
        return redirect(appLocation(config, saved.returnTo, { voult_linked: saved.provider }));
      }

      const voultCode = ctx.query('voult_code');
      if (typeof voultCode !== 'string') {
        return redirectWithError(config, 'MISSING_OAUTH_CODE', 'Voult did not return a sign-in code.');
      }

      let result;
      try {
        result = await exchangeOAuthCode(voultCode, { redirectUri: saved.redirectUri }, client);
      } catch (err) {
        return redirectWithError(config, errorCode(err), err.message);
      }

      if (result.mfaRequired) {
        ctx.cookies.push(setCookie(config, COOKIE_MFA_PENDING, result.mfaPendingToken, { maxAge: MFA_PENDING_MAX_AGE_MS }));
        return redirect(appLocation(config, config.oauth.mfaPath));
      }

      // The session cookies go out with this redirect (sessionCookies, in the handler).
      return redirect(appLocation(config, saved.returnTo));
    }],
  ];
}
