// @voult/next: the Voult router as Next.js route handlers, plus getSession()/requireSession()
// for Server Components. Node runtime (`@voult/sdk` uses axios). The Edge middleware lives in
// `@voult/next/middleware`, which imports none of this.
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@voult/sdk';
import {
  COOKIE_REFRESH,
  COOKIE_USER,
  createVoultHandler,
  getSessionFromRequest,
  normalizeVoultError,
  parseUserCookie,
  renewSession,
  resolveConfig,
  safeReturnTo,
  sessionCookies,
  sign,
} from '@voult/core';

const DEFAULT_BASE_PATH = '/api/auth';

/**
 * `app/api/auth/[...voult]/route.js`:
 *
 *   export const { GET, POST, PATCH, DELETE } = createVoultRouteHandlers();
 *
 * Serves every route of the Voult router. Config comes from the `VOULT_*` env vars (or `config`),
 * read on the first request so `next build` doesn't need them.
 * @param {import('./index.js').VoultNextOptions} [options]
 */
export function createVoultRouteHandlers({ basePath = DEFAULT_BASE_PATH, ...options } = {}) {
  let handle;
  /** @param {Request} request */
  async function route(request) {
    try {
      handle ??= createVoultHandler(resolveConfig(options));
    } catch (err) {
      console.error(err);
      const payload = normalizeVoultError(err);
      return Response.json(payload, { status: payload.error.status });
    }
    return handle(request, { basePath });
  }
  return { GET: route, POST: route, PATCH: route, PUT: route, DELETE: route };
}

let defaultConfig;
const configFor = (options) => (options && Object.keys(options).length ? resolveConfig(options) : (defaultConfig ??= resolveConfig()));

/** Server Components can read cookies but not write them; route handlers and server actions can. */
function cookiesWritable(store) {
  try {
    store.set('voult_probe', '', { maxAge: 0, path: '/' });
    return true;
  } catch {
    return false;
  }
}

/** Write core's `{ name, value, options }` cookies through Next (same bytes as the router's). */
async function writeCookies(store, list, config) {
  for (const { name, value, options } of list) {
    const final = options.signed ? `s:${await sign(value, config.sessionSecret)}` : value;
    store.set(name, final, {
      httpOnly: options.httpOnly,
      secure: options.secure,
      sameSite: options.sameSite,
      path: options.path,
      ...(options.maxAge != null && { maxAge: Math.floor(options.maxAge / 1000) }),
      ...(options.expires && { expires: options.expires }),
    });
  }
}

const hasIdentity = (user) => Boolean(user?.id || user?.email);

/**
 * The signed-in user, or `null`. Works in Server Components, route handlers and server actions.
 *
 * - `verified: true`: Voult confirmed the session just now (revoked sessions are caught).
 * - `verified: false` (Server Components only): the access token has expired and renewing it
 *   here would rotate the refresh token without being able to save it. `user` comes from the
 *   signed session cookie; `requireSession()` sends the browser through `/session/renew`.
 *
 * In route handlers and server actions an expired access token is renewed and the new cookies set.
 * @param {import('./index.js').VoultNextOptions} [options]
 * @returns {Promise<{ user: Record<string, unknown>, verified: boolean } | null>}
 */
export async function getSession(options) {
  const config = configFor(options);
  const incomingHeaders = await headers();
  const request = new Request('http://voult.local/', {
    headers: Object.fromEntries(
      ['cookie', 'authorization'].flatMap((name) => (incomingHeaders.get(name) ? [[name, incomingHeaders.get(name)]] : []))
    ),
  });
  const { client, incoming, read } = await getSessionFromRequest(request, config);

  if (client.accessToken) {
    // The SDK refreshes on a 401 by itself; not here, where the rotated token might not be saved.
    client.refreshToken = null;
    try {
      return { user: await getCurrentUser(client), verified: true };
    } catch (err) {
      if (err?.status !== 401) throw err;
      client.clearSession();
    }
  }

  if (typeof read(COOKIE_REFRESH) !== 'string' || !read(COOKIE_REFRESH)) return null;

  const store = await cookies();
  if (!cookiesWritable(store)) {
    const user = parseUserCookie(read(COOKIE_USER));
    return hasIdentity(user) ? { user, verified: false } : null;
  }

  const cleared = await renewSession(client, read, config);
  if (!client.accessToken) {
    await writeCookies(store, cleared, config);
    return null;
  }
  const user = hasIdentity(client.user) ? client.user : await getCurrentUser(client);
  client.user = user;
  await writeCookies(store, sessionCookies(client, incoming, config), config);
  return { user, verified: true };
}

/**
 * Like getSession(), but only returns a verified session. Otherwise redirects:
 * expired access token → `<basePath>/session/renew?returnTo=…` (renews and comes back);
 * signed out → `<signInPath>?returnTo=…`. `returnTo` defaults to the path `voultMiddleware`
 * recorded, if it runs.
 * @param {import('./index.js').RequireSessionOptions} [options]
 */
export async function requireSession({ signInPath = '/login', basePath = DEFAULT_BASE_PATH, returnTo, ...options } = {}) {
  const session = await getSession(options);
  if (session?.verified) return session;

  const path = safeReturnTo(returnTo ?? (await headers()).get('x-voult-path'), '');
  const query = path ? `?returnTo=${encodeURIComponent(path)}` : '';
  redirect(session ? `${basePath}/session/renew${query}` : `${signInPath}${query}`);
}
