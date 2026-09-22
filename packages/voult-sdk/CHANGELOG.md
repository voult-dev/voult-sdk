# Changelog

All notable changes to `voult-sdk` are documented here.

## 0.1.0

- `exchangeOAuthCode` — exchange a one-time Voult OAuth code (returned to the integrator callback) for tokens via `POST /api/oauth/exchange`.
- Reorganized into the `voult-sdk` monorepo alongside `@voult/express` and `@voult/cli`.

## 0.0.4 and earlier

Initial SDK releases: client setup, error handling, authentication flows (register, login, logout, session refresh, password reset, email verification, MFA/WebAuthn), and API endpoint management.
