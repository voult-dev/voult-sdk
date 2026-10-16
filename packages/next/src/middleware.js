// Edge-safe: imports only next/server and @voult/core/cookies (WebCrypto, no @voult/sdk).
import { NextResponse } from 'next/server';
import { unsign } from '@voult/core/cookies';

// The session cookies @voult/core sets (src/session.js).
const SESSION_COOKIES = ['voult_access', 'voult_refresh'];

/** Exact paths, or `/prefix/*` for a path and everything below it. */
function matches(pathname, patterns) {
  return patterns.some((pattern) => (
    pattern.endsWith('/*')
      ? pathname === pattern.slice(0, -2) || pathname.startsWith(pattern.slice(0, -1))
      : pathname === pattern
  ));
}

async function hasSessionCookie(request, secret) {
  for (const name of SESSION_COOKIES) {
    const value = request.cookies.get(name)?.value;
    if (!value) continue;
    if (!secret) return true; // no VOULT_SESSION_SECRET (development): cookies aren't signed
    if (value.startsWith('s:') && (await unsign(value.slice(2), secret)) !== false) return true;
  }
  return false;
}

/**
 * `middleware.js`: send signed-out visitors to the sign-in page before the page renders.
 *
 *   import { voultMiddleware } from '@voult/next/middleware';
 *   export default voultMiddleware({ publicPaths: ['/', '/login'], signInPath: '/login' });
 *   export const config = { matcher: ['/((?!_next/|favicon.ico|.*\\..*).*)'] };
 *
 * Only pages are redirected; `/api/*` passes through so route handlers answer 401 JSON themselves.
 * A UX guard, not the authority: it only checks that a correctly signed session cookie exists,
 * so it can't see a revoked session. Pages that need certainty call `requireSession()`.
 * It also records the request path for `requireSession()`'s `returnTo`.
 * @param {import('./middleware.js').VoultMiddlewareOptions} [options]
 */
export function voultMiddleware({ publicPaths = ['/'], signInPath = '/login', basePath = '/api/auth', sessionSecret } = {}) {
  return async function middleware(request) {
    const { pathname, search } = request.nextUrl;
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-voult-path', `${pathname}${search}`);
    const next = () => NextResponse.next({ request: { headers: requestHeaders } });

    // Pages only: an API request redirected to the sign-in page would hand fetch() HTML instead of
    // the route's 401 JSON. API routes check the session themselves (getSession()).
    if (
      pathname.startsWith('/_next/')
      || pathname === '/api'
      || pathname.startsWith('/api/')
      || matches(pathname, [signInPath, basePath, `${basePath}/*`, ...publicPaths])
    ) {
      return next();
    }

    const secret = sessionSecret ?? process.env.VOULT_SESSION_SECRET ?? process.env.SESSION_SECRET;
    if (await hasSessionCookie(request, secret)) return next();

    const signIn = new URL(signInPath, request.url);
    signIn.searchParams.set('returnTo', `${pathname}${search}`);
    return NextResponse.redirect(signIn);
  };
}
