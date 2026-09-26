# Changelog

All notable changes to `@voult/express` are documented here.

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
