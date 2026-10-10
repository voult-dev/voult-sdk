# Changelog

All notable changes to `@voult/react` are documented here.

## 0.2.0

`useVoult()` now also returns helpers for every account feature the server's router serves (`@voult/express` 0.3+), so pages never build URLs:

- `mfa`: `status()`, `setup()`, `enable(code)`, `disable({ code, password? })`, `regenerateBackupCodes(code)`, `cancel()` (abandon a sign-in waiting for its code; the session updates).
- `sessions`: `list()` (this browser's session has `isCurrent`), `revoke(id)` (revoking your own signs this browser out and updates the session).
- `linkedAccounts`: `list()`, `unlink(provider)`.
- `passkeys`: `list()`, `registrationOptions(deviceName)`, `register(credential, deviceName)`, `rename(id, deviceName)`, `remove(id)`, `loginOptions(email?)`, `signIn(credential)` (resolves `{ mfaRequired }` like `signIn()`). Run the WebAuthn ceremony itself with `navigator.credentials` or `@simplewebauthn/browser`.
- `magicLink.send(email, { returnTo })`: always `{ sent: true }` for a well-formed email.
- `deleteAccount()`: Voult disables the account; the session updates to signed out.

Each returns the router's JSON and throws `VoultRequestError` on failure. Nothing changed for existing code.

## 0.1.0

First release. React bindings for apps whose server uses `@voult/express`.

- `VoultProvider`: loads the session from `GET {apiBase}/session` (cookies included); no tokens or secrets reach the browser.
- `useSession()`: `status` is `loading | authenticated | unauthenticated | mfa_required`, plus `user`, `isAuthenticated`, `error`, `refresh()`.
- `useVoult()`: `signIn`, `signUp`, `signOut`, `verifyMfa`, `refresh`. `verifyMfa(code)` works after both password and OAuth sign-in. Failures throw `VoultRequestError` (`code`, `status`, `message`, `field(s)`).
- `OAuthButton`: a plain `<a href>` to `/oauth/:provider/start`, so it works without JavaScript; takes `intent` and `returnTo`.
- `useOAuthProviders()`: only the providers that are enabled and configured.
- `getOAuthRedirectResult()`: reads `voult_error` / `voult_linked` after the OAuth redirect.
- Re-exports `isValidPassword`, `isValidEmail`, `isValidUsername`, `PASSWORD_REQUIREMENTS_MESSAGE` from `@voult/sdk/validation` (no HTTP client in your bundle).
- No build step: ships plain ES modules (`React.createElement`, no JSX). Requires `react >= 18`.
