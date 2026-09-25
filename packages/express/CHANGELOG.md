# Changelog

All notable changes to `@voult/express` are documented here.

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
