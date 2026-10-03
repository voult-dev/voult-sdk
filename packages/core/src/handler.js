import { setCookieHeader } from './cookies.js';
import { normalizeVoultError } from './errors.js';
import { oauthRoutes } from './oauth.js';
import { authRoutes, json } from './routes.js';
import { getSessionFromRequest, renewSession, sessionCookies } from './session.js';

/**
 * @typedef {import('./index.js').VoultConfig} VoultConfig
 * @typedef {import('./session.js').CookieToSet} CookieToSet
 * @typedef {{ status: number, body?: unknown, location?: string }} Result
 * @typedef {{
 *   request: Request,
 *   url: URL,
 *   basePath: string,
 *   params: Record<string, string>,
 *   query: (name: string) => string | undefined,
 *   body: Record<string, any>,
 *   config: VoultConfig,
 *   client: import('@voult/sdk').VoultClient,
 *   incoming: { accessToken: string | null, refreshToken: string | null },
 *   read: (name: string) => unknown,
 *   cookies: CookieToSet[],
 *   renew: () => Promise<void>,
 * }} Context
 * @typedef {[method: string, path: string, handler: (ctx: Context) => Promise<Result>]} Route
 */

const MAX_BODY_BYTES = 100 * 1024; // express.json()'s default limit

/** Express-style route matching: `:param` segments, case-insensitive, optional trailing slash. */
function compile([method, path, handler]) {
  const keys = [];
  const source = path.replace(/:(\w+)/g, (_, key) => {
    keys.push(key);
    return '([^/]+)';
  });
  return { method, pattern: new RegExp(`^${source}/?$`, 'i'), keys, handler };
}

function match(routes, method, path) {
  for (const route of routes) {
    if (route.method !== method) continue;
    const found = route.pattern.exec(path);
    if (found) {
      const params = Object.fromEntries(route.keys.map((key, i) => [key, decodeURIComponent(found[i + 1])]));
      return { handler: route.handler, params };
    }
  }
  return null;
}

/** The request path below `basePath`, or null when the request isn't for this router. */
function routePath(pathname, basePath) {
  if (!basePath) return pathname;
  if (pathname.toLowerCase() === basePath.toLowerCase()) return '/';
  return pathname.toLowerCase().startsWith(`${basePath.toLowerCase()}/`) ? pathname.slice(basePath.length) : null;
}

/** JSON bodies only, like express.json(); anything else is `{}`. */
async function readBody(request) {
  if (request.method === 'GET' || request.method === 'HEAD') return {};
  if (!/\bjson\b/i.test(request.headers.get('content-type') ?? '')) return {};
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    throw Object.assign(new Error('Request body is too large'), { status: 413, code: 'PAYLOAD_TOO_LARGE' });
  }
  if (!text.trim()) return {};
  try {
    const body = JSON.parse(text);
    return body && typeof body === 'object' ? body : {};
  } catch {
    throw Object.assign(new Error('Request body is not valid JSON'), { status: 400, code: 'INVALID_JSON' });
  }
}

// Express's res.location() encoding (the `encodeurl` package): keep valid URL characters and
// %-escapes, encode the rest, so a Location header is always valid ASCII.
const ENCODE_CHARS = /(?:[^\x21\x23-\x3B\x3D\x3F-\x5F\x61-\x7A\x7C\x7E]|%(?:[^0-9A-Fa-f]|[0-9A-Fa-f][^0-9A-Fa-f]|$))+/g;
const UNMATCHED_SURROGATES = /(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]|[\uD800-\uDBFF]([^\uDC00-\uDFFF]|$)/g;
const encodeLocation = (url) => String(url).replace(UNMATCHED_SURROGATES, '$1�$2').replace(ENCODE_CHARS, encodeURI);

/** @param {Result} result @param {string[]} setCookies */
function toResponse(result, setCookies) {
  const headers = new Headers();
  for (const cookie of setCookies) headers.append('Set-Cookie', cookie);
  if (result.location !== undefined) {
    headers.set('Location', encodeLocation(result.location));
    return new Response(null, { status: result.status, headers });
  }
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(result.body), { status: result.status, headers });
}

const defaultNotFound = () => Response.json(
  { error: { code: 'NOT_FOUND', message: 'No such Voult route', status: 404 } },
  { status: 404 }
);

/**
 * The Voult router as one function: `handle(request, { basePath }) → Response`.
 * Holds every auth route, the cookies, the OAuth nonce and session renewal; adapters only
 * translate their framework's request/response to and from the Fetch API.
 *
 * @param {VoultConfig} config  A normalized config (`resolveConfig` / `loadConfigFromEnv`).
 */
export function createVoultHandler(config) {
  const routes = [...authRoutes, ...oauthRoutes()].map(compile);

  /**
   * @param {Request} request
   * @param {{ basePath?: string, notFound?: (request: Request) => Response | null }} [options]
   *   basePath: where the router is mounted (`/api/auth`). notFound: answer for paths with no
   *   route (default 404 JSON; return null to let the adapter fall through).
   * @returns {Promise<Response | null>}
   */
  return async function handle(request, { basePath = '', notFound = defaultNotFound } = {}) {
    const url = new URL(request.url);
    const path = routePath(url.pathname, basePath.replace(/\/$/, ''));
    const method = request.method === 'HEAD' ? 'GET' : request.method;
    const found = path === null ? null : match(routes, method, path);
    if (!found) return notFound(request);

    /** @type {Context | undefined} */
    let ctx;
    /** @type {Result} */
    let result;
    try {
      const body = await readBody(request);
      const { client, incoming, read } = await getSessionFromRequest(request, config, { body });
      ctx = {
        request,
        url,
        basePath: basePath.replace(/\/$/, ''),
        params: found.params,
        query: (name) => url.searchParams.get(name) ?? undefined,
        body,
        config,
        client,
        incoming,
        read,
        cookies: [],
        renew: async () => { ctx.cookies.push(...await renewSession(client, read, config)); },
      };
      result = await found.handler(ctx);
    } catch (err) {
      const payload = normalizeVoultError(err);
      result = json(payload, payload.error.status);
    }

    // The handler's own cookies first, then the session as it stands now (like Express, where
    // the session cookies are written as the response goes out).
    const cookies = ctx ? [...ctx.cookies, ...sessionCookies(ctx.client, ctx.incoming, config)] : [];
    const setCookies = await Promise.all(cookies.map((cookie) => setCookieHeader(cookie, config.sessionSecret)));
    const response = toResponse(result, setCookies);
    return request.method === 'HEAD' ? new Response(null, response) : response;
  };
}
