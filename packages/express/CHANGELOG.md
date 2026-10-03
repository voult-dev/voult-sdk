# Changelog

All notable changes to `@voult/express` are documented here.

## 0.3.0-beta.0

The router now runs on [`@voult/core`](../core): one implementation of every route on the Fetch API (`Request → Response`), which `@voult/next` will share. This package is the Express adapter. **The public API is unchanged** (`createVoultRouter`, `createVoultMiddleware`, `requireAuth`, `loadConfigFromEnv`), and so are routes, responses, cookie names, flags and the signed-cookie format, so existing sessions keep working across the upgrade. Every 0.2.1 test passes unedited.

- `express.json()` is no longer needed for the router: it reads JSON bodies itself (100 kB limit, as before). If your app already parses the body, that still works.
- Invalid JSON now answers `400 INVALID_JSON` (was `400 INTERNAL_ERROR`); a body over 100 kB answers `413 PAYLOAD_TOO_LARGE`.
- Router JSON responses no longer carry an `ETag` header.
- Requests under the mount path that the router doesn't serve still reach your own routes with `req.body` and `req.voult` set.
- New dependency: `@voult/core`. The internal files `src/config.js`, `src/routes.js`, `src/oauth.js`, `src/tokens.js`, `src/errors.js` and `src/catchAsync.js` are gone (they were never exported; `exports` only allows the package root).

## 0.2.1

- **Fix:** `GET /session` reported a signed-in user as signed out once the 1-hour access cookie expired, even with a valid 30-day refresh cookie. It now renews quietly (and clears the cookies if the refresh token is dead).
- **New export: `requireAuth`** to protect your own routes (`app.use(createVoultMiddleware()); app.get('/api/orders', requireAuth, …)`). It renews an expired access cookie from the refresh cookie first (so protected calls don't start failing an hour into a session), answers `401` JSON itself, and throws a clear setup error if `createVoultMiddleware()` isn't mounted.
- Password sign-ins that need MFA now also park the pending token in the httpOnly `voult_mfa_pending` cookie (as hosted OAuth already did), so `POST /mfa/verify { mfaToken }` works without the page holding the token, and survives a reload. The JSON response still includes `mfaPendingToken`.

## 0.2.0

- **New: hosted OAuth in the router.** `createVoultRouter()` now also serves `GET /oauth/providers`, `GET /oauth/:provider/start` and `GET /oauth/callback`. Provider credentials stay in the Voult dashboard; this server needs no `GOOGLE_*`/`GITHUB_*` variables. Supports `intent=authenticate|login|register|link` and a relative `returnTo`.
- Each sign-in is bound to the browser that started it: a signed httpOnly `voult_oauth` cookie holds a nonce that Voult echoes back as `state`; mismatches redirect with `voult_error=INVALID_OAUTH_STATE` (login-CSRF protection).
- MFA after OAuth: the pending token is parked in an httpOnly `voult_mfa_pending` cookie and the browser lands on `oauth.mfaPath`. `POST /mfa/verify` now accepts `{ mfaToken }` alone (body `mfaPendingToken` still works) and `GET /session` reports `mfaPending: true`.
- New config: `VOULT_OAUTH_CALLBACK_URL` (override the computed callback URL, e.g. behind a proxy) and `oauth: { successPath, mfaPath, errorPath }` (router option or `overrides.oauth`; paths must start with `/`).
- Hosted OAuth with `VOULT_SESSION_STRATEGY=bearer` returns `400 OAUTH_REQUIRES_COOKIE_SESSION`.
- **Requires `@voult/sdk` >= 0.2.0** (peer dependency).

## 0.1.2

- **New:** `VOULT_SESSION_STRATEGY` env var (`cookie` | `bearer`, case-insensitive). Previously the strategy could only be set in code via `overrides.session.strategy`, so `voult init`'s bearer choice had no effect. A code override still wins over the env var.
- An unrecognised strategy (e.g. `bearr`) now throws at startup instead of silently falling back to `cookie`.
- Requires `@voult/sdk` >= 0.1.3 for the `signOut` fix (logout now reports API failures instead of claiming success).

## 0.1.1

- Depend on `@voult/sdk` instead of `voult-sdk` (peer dependency updated to `>=0.1.0`).

## 0.1.0

Initial release.

- `createVoultRouter` — mountable BFF router: session bootstrap, register, username/email login, logout, session refresh, `/user/me` (get/patch), forgot/reset password, verify email, MFA verify/status.
- `createVoultMiddleware` — attaches a per-request `VoultClient` (no global/shared client).
- `loadConfigFromEnv` — validates `VOULT_*` env vars at startup with actionable error messages; supports legacy env var aliases with a deprecation warning.
- Cookie and bearer session strategies.
