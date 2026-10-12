# Changelog

All notable changes to `@voult/next` are documented here.

## 0.1.1

- **Fix: after a server action renewed the session, the page re-rendered as if it hadn't.** `getSession()` read the raw `Cookie` request header, which doesn't include cookies a server action sets; Next re-renders the page in the same request, so the layout saw the expired token and `requireSession()` redirected away. It now reads `cookies()`, which does. Found by the end-to-end suite (`voult-next-e2e`).
- README: navigate with a full page load after signing in or out (Next's router cache can replay a redirect prefetched while signed out).
- Peer dependency `@voult/sdk` raised to `>=0.2.1`, which fixes "Voult client instance is required" in minified production builds.

## 0.1.0

First release: Voult for the Next.js App Router (Next 14.2+, tested on 16).

- `createVoultRouteHandlers({ basePath? })` → `{ GET, POST, PATCH, PUT, DELETE }` for `app/api/auth/[...voult]/route.js`: the whole `@voult/core` router (every route `@voult/express` 0.3 serves). Config is read on the first request, so `next build` doesn't need the env vars.
- `getSession()` → `{ user, verified }` or `null`, for Server Components, route handlers and server actions. Voult confirms the session on each call. In Server Components it never renews (Voult rotates refresh tokens, and the rotated one couldn't be saved): an expired access token there gives `verified: false` with the user from the signed cookie. Route handlers and server actions renew and set the cookies.
- `requireSession({ signInPath, returnTo })`: a verified session, or a redirect: to `/api/auth/session/renew` (renews and comes back) or to the sign-in page with `returnTo`.
- `@voult/next/middleware` → `voultMiddleware({ publicPaths, signInPath })`: redirects visitors without a correctly signed session cookie (WebCrypto, Edge-safe). A UX guard; `requireSession()` is the authority. Works as `proxy.js` (Next 16) or `middleware.js`.
- Needs `@voult/core` 0.2.1 (for `/session/renew`).
