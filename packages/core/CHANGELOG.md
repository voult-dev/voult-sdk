# Changelog

All notable changes to `@voult/core` are documented here.

## 0.1.0

First release. The Voult router as one function on the Fetch API, so adapters only translate requests:

- `createVoultHandler(config)` → `handle(request, { basePath, notFound }) → Response`: every route `@voult/express` 0.2.1 served (session, password sign-up/sign-in, sign-out, refresh, profile, password reset, email verification, MFA, hosted OAuth with the browser-bound nonce), with session renewal from the refresh cookie.
- Cookies are byte-compatible with Express + `cookie-parser` (`s:` + HMAC-SHA256 signatures), signed with WebCrypto.
- No framework imports and no Node-only APIs in `src/` (a test checks), so it can run on Node 20+, Next.js route handlers and Edge runtimes.
- For adapters: `resolveConfig`, `loadConfigFromEnv`, `getSessionFromRequest`, `restoreSession`, `renewSession`, `sessionCookies`, `normalizeVoultError`, and the cookie helpers.
