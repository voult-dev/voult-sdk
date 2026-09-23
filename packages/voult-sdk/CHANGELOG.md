# Changelog

All notable changes to `@voult/sdk` are documented here.

## 0.1.2

- **Pre-launch:** `DEFAULT_BASE_URL` now points at `https://staging.voult.dev` instead of `https://api.voult.dev`, which isn't deployed yet. Anyone constructing a client without an explicit `baseURL` was getting a generic network error with no indication *why* (DNS didn't resolve). Phase 21 (launch) will switch this to the real production URL once it exists — tracked in `docs/phases/PHASE_21_LAUNCH.md`.

## 0.1.0

- `exchangeOAuthCode` — exchange a one-time Voult OAuth code (returned to the integrator callback) for tokens via `POST /api/oauth/exchange`.
- Reorganized into the `@voult/sdk` monorepo alongside `@voult/express` and `@voult/cli`.

## 0.0.4 and earlier

Initial SDK releases: client setup, error handling, authentication flows (register, login, logout, session refresh, password reset, email verification, MFA/WebAuthn), and API endpoint management.
