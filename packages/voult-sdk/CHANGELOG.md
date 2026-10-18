# Changelog

All notable changes to `@voult/sdk` are documented here.

## 0.2.2

For Voult API 1.4.

- **Password rule relaxed** to match the API: `isValidPassword` accepts 8 to 128 characters of any kind (spaces, Unicode, any symbol), with no composition rules. Before, only letters, digits and `@$!%*?&` were allowed, so `MyPass#2026` was refused. `PASSWORD_REQUIREMENTS_MESSAGE` says the new rule; new exports `PASSWORD_MIN_LENGTH`, `PASSWORD_MAX_LENGTH`. The API also refuses commonly used passwords (server-side only; its `WEAK_PASSWORD` message says so).
- Passkey functions take an optional `origin` (the page running the ceremony): `createPasskeyRegistrationOptions({ deviceName, origin })`, `verifyPasskeyRegistration(credential, { deviceName, origin })`, `createPasskeyLoginOptions({ email, origin })`, and `verifyPasskeyLogin(credential, { origin }, client)` (the old `(credential, client)` call still works). Voult uses it to pick the passkey domain when an app allows several origins.

## 0.2.1

- **Fix: SDK functions rejected the client in minified builds** ("Voult client instance is required"). They recognised a client by its class name (`constructor.name === 'VoultClient'`), which bundlers rename when minifying, so every call failed in Next.js production builds (`next build`, Vercel) and through `@voult/next`. A client is now recognised by a `Symbol.for('@voult/sdk.client')` brand, which survives minification and also works across two copies of the SDK. Found by the `@voult/next` end-to-end suite.
- New export `isVoultClient(value)`.

## 0.2.0

Matches the Phase 2 hosted-OAuth API. **Breaking** changes are marked.

- `getOAuthAuthorizationUrl(provider, { intent, redirectUri, state }, client)`: new optional `state` (≤256 chars), which Voult returns unchanged on every redirect so your callback can reject sign-ins it didn't start. **Breaking:** `intent: 'link'` is rejected (use `linkOAuthProvider`), and the `appId`/`userId` options and `X-App-ID` header are gone (the API identifies the app by client ID). The `deprecation` field is no longer returned.
- **Breaking:** `linkOAuthProvider(provider, { redirectUri, state }, client)`: `redirectUri` is now required (the API needs it to send the user back). Returns `authUrl` (`redirectUrl` is kept as a deprecated alias, and replies from older APIs are mapped). The client-bound form is `auth.linkOAuthProvider(provider, { redirectUri })`.
- **Breaking:** `OAUTH_INTENTS` no longer includes `'link'`. New `OAUTH_STATE_MAX_LENGTH` (256).
- `exchangeOAuthCode`: documented and tested. For users with MFA it returns `{ mfaRequired, mfaPendingToken }` and sets no session; finish with `verifyMfaLogin`, as with password sign-in.
- New `getApiMeta(client)` (`GET /api/meta`) and `getAppInfo(client)` (`GET /api/apps/me`, needs the client secret) for diagnostics.
- New subpath `@voult/sdk/validation`: password/email/username helpers with no network code, safe for browser bundles.
- `VERSION` now reports the real package version (it said `0.3.0`); a test keeps it in sync with `package.json`.

## 0.1.4

- `PASSWORD_REQUIREMENTS_MESSAGE` now names the accepted special characters (`@$!%*?&`) and says other symbols aren't allowed. The old "…and special character" wording made passwords like `Str0ng!Pass#2026` fail with no hint that `#` was the problem. The rule itself is unchanged and still matches the API.

## 0.1.3

- **Fix:** `signOut` no longer reports success when the API fails to log out. It used to swallow every error and return `{ success: true }`, which hid a server-side 500 that left refresh tokens un-revoked. It still clears the local session in all cases and still returns success (with a `warning`) on 401/403, where the token is already dead; any other error is now rethrown so callers (including `@voult/express`'s `/logout`) can report it.

## 0.1.2

- **Pre-launch:** `DEFAULT_BASE_URL` now points at `https://staging.voult.dev` instead of `https://api.voult.dev`, which isn't deployed yet. Anyone constructing a client without an explicit `baseURL` was getting a generic network error with no indication *why* (DNS didn't resolve). Phase 21 (launch) will switch this to the real production URL once it exists — tracked in `docs/phases/PHASE_21_LAUNCH.md`.

## 0.1.0

- `exchangeOAuthCode` — exchange a one-time Voult OAuth code (returned to the integrator callback) for tokens via `POST /api/oauth/exchange`.
- Reorganized into the `@voult/sdk` monorepo alongside `@voult/express` and `@voult/cli`.

## 0.0.4 and earlier

Initial SDK releases: client setup, error handling, authentication flows (register, login, logout, session refresh, password reset, email verification, MFA/WebAuthn), and API endpoint management.
