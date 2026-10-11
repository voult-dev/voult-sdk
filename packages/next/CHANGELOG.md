# Changelog

All notable changes to `@voult/next` are documented here.

## 0.1.0

First release: Voult for the Next.js App Router (Next 14.2+, tested on 16).

- `createVoultRouteHandlers({ basePath? })` → `{ GET, POST, PATCH, PUT, DELETE }` for `app/api/auth/[...voult]/route.js`: the whole `@voult/core` router (every route `@voult/express` 0.3 serves). Config is read on the first request, so `next build` doesn't need the env vars.
- `getSession()` → `{ user, verified }` or `null`, for Server Components, route handlers and server actions. Voult confirms the session on each call. In Server Components it never renews (Voult rotates refresh tokens, and the rotated one couldn't be saved): an expired access token there gives `verified: false` with the user from the signed cookie. Route handlers and server actions renew and set the cookies.
- `requireSession({ signInPath, returnTo })`: a verified session, or a redirect: to `/api/auth/session/renew` (renews and comes back) or to the sign-in page with `returnTo`.
- `@voult/next/middleware` → `voultMiddleware({ publicPaths, signInPath })`: redirects visitors without a correctly signed session cookie (WebCrypto, Edge-safe). A UX guard; `requireSession()` is the authority. Works as `proxy.js` (Next 16) or `middleware.js`.
- Needs `@voult/core` 0.2.1 (for `/session/renew`).
