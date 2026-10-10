# Changelog

All notable changes to `@voult/core` are documented here.

## 0.2.0

The router now serves every end-user feature, so apps write no auth route handlers. New routes (below the mount path):

- **Session required** (renews from the refresh cookie first, else `401` JSON): `POST /mfa/setup`, `POST /mfa/enable { code }`, `POST /mfa/disable { code, password? }` (no password needed for Google/GitHub accounts), `POST /mfa/backup-codes { code }`, `GET /sessions` (this browser's session has `isCurrent: true`), `DELETE /sessions/:id` (revoking your own session signs this browser out; the answer says `current: true`), `GET /oauth/linked`, `DELETE /oauth/linked/:provider`, `DELETE /user/me` (Voult disables the account; this browser is signed out), `POST /passkeys/register/options`, `POST /passkeys/register/verify`, `GET /passkeys`, `PATCH /passkeys/:id`, `DELETE /passkeys/:id`.
- **Public:** `POST /mfa/cancel` (drop a sign-in waiting for its code), `POST /passkeys/login/options`, `POST /passkeys/login/verify` (sets the session, or the MFA-pending cookie, like password sign-in), `POST /magic-link { email, returnTo? }` (answers `{ sent: true }` whether or not the email has an account), `GET /magic-link/verify?token=` (sets the session or MFA-pending cookie and redirects like the OAuth callback: `returnTo`, `mfaPath`, or `errorPath?voult_error=…`).
- Magic links point at `/magic-link/verify` next to the OAuth callback, so the one callback URL on the app's allowlist covers both.
- Needs Voult API 1.2+ for `isCurrent` (older APIs: `isCurrent` is missing and revoking your own session doesn't sign this browser out) and for MFA on magic links.

## 0.1.0

First release. The Voult router as one function on the Fetch API, so adapters only translate requests:

- `createVoultHandler(config)` → `handle(request, { basePath, notFound }) → Response`: every route `@voult/express` 0.2.1 served (session, password sign-up/sign-in, sign-out, refresh, profile, password reset, email verification, MFA, hosted OAuth with the browser-bound nonce), with session renewal from the refresh cookie.
- Cookies are byte-compatible with Express + `cookie-parser` (`s:` + HMAC-SHA256 signatures), signed with WebCrypto.
- No framework imports and no Node-only APIs in `src/` (a test checks), so it can run on Node 20+, Next.js route handlers and Edge runtimes.
- For adapters: `resolveConfig`, `loadConfigFromEnv`, `getSessionFromRequest`, `restoreSession`, `renewSession`, `sessionCookies`, `normalizeVoultError`, and the cookie helpers.
