# Changelog

All notable changes to `@voult/react` are documented here.

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
