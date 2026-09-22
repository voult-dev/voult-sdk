# Changelog

All notable changes to `@voult/express` are documented here.

## 0.1.0

Initial release.

- `createVoultRouter` — mountable BFF router: session bootstrap, register, username/email login, logout, session refresh, `/user/me` (get/patch), forgot/reset password, verify email, MFA verify/status.
- `createVoultMiddleware` — attaches a per-request `VoultClient` (no global/shared client).
- `loadConfigFromEnv` — validates `VOULT_*` env vars at startup with actionable error messages; supports legacy env var aliases with a deprecation warning.
- Cookie and bearer session strategies.
