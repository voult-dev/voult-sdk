# Voult SDK — Implementation Guide

This guide documents every function in the **voult-sdk** (v0.2.0), how each maps to the [Voult API](https://github.com/DevOlabode/voult), and how to integrate authentication into your application.

---

## Table of Contents

1. [Quick start](#1-quick-start)
2. [Installation & configuration](#2-installation--configuration)
3. [Password authentication](#3-password-authentication)
4. [Magic link (passwordless)](#4-magic-link-passwordless)
5. [Email verification](#5-email-verification)
6. [Password reset](#6-password-reset)
7. [Profile & account management](#7-profile--account-management)
8. [Session management](#8-session-management)
9. [OAuth providers](#9-oauth-providers)
10. [OAuth account linking](#10-oauth-account-linking)
11. [Session persistence](#11-session-persistence)
12. [Error handling](#12-error-handling)
13. [Validation utilities](#13-validation-utilities)
14. [Full React example](#14-full-react-example)
15. [API endpoint reference](#15-api-endpoint-reference)

---

## 1. Quick start

```bash
npm install voult-sdk
```

```javascript
import voult from 'voult-sdk';

const auth = voult({
  clientId: process.env.VOULT_CLIENT_ID,       // from Voult dashboard
  clientSecret: process.env.VOULT_CLIENT_SECRET, // server-side only!
  baseURL: 'https://api.voult.dev',            // optional
});

// Register
await auth.signUpWithEmailAndPassword('user@example.com', 'StrongPass123!', {
  fullName: 'Jane Doe',
});

// Login
const { user, accessToken, refreshToken } = await auth.signInWithEmailAndPassword(
  'user@example.com',
  'StrongPass123!'
);

// Current user
const profile = await auth.getCurrentUser();

// Logout
await auth.signOut();
```

> **Security:** Never expose `clientSecret` in browser bundles. Use the SDK on your **backend** (Node.js, serverless) or proxy auth through your API.

---

## 2. Installation & configuration

### Default export — `voult(config)`

Returns an object with all SDK methods bound to one `VoultClient` instance.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `clientId` | `string` | Yes | App client ID (`X-Client-Id`) |
| `clientSecret` | `string` | Yes | App client secret (`X-Client-Secret`) |
| `baseURL` | `string` | No | API base URL (default: `https://api.voult.dev`) |

### Named export — `VoultClient`

Use when you prefer explicit dependency injection:

```javascript
import { VoultClient, signInWithEmailAndPassword } from 'voult-sdk';

const client = new VoultClient({ clientId: '...', clientSecret: '...' });
await signInWithEmailAndPassword('user@example.com', 'password', client);
```

### Headers sent automatically

| Header | When |
|--------|------|
| `X-Client-Id` | Every request |
| `X-Client-Secret` | Unauthenticated client calls (register, login, forgot password) |
| `Authorization: Bearer <accessToken>` | When a user session is active |

---

## 3. Password authentication

### `signUpWithEmailAndPassword(email, password, options?)`

Registers a user with email as the primary identifier.

**API:** `POST /api/auth/register`

| Parameter | Required | Description |
|-----------|----------|-------------|
| `email` | Yes | Valid email (normalized to lowercase) |
| `password` | Yes | Min 8 chars, upper, lower, number, special (`@$!%*?&`) |
| `options.fullName` | Yes | Display name (required by Voult API) |
| `options.username` | No | 3–30 chars, alphanumeric + underscore |

**Returns:** `{ user, token, message }`

- Stores session in the client (`token` is the access JWT).
- Backend sends a verification email automatically.

```javascript
const { user, token, message } = await auth.signUpWithEmailAndPassword(
  'jane@example.com',
  'StrongPass123!',
  { fullName: 'Jane Doe', username: 'jane_doe' }
);
```

**Typical flow in your app:**

1. User submits registration form → call this method on your **server**.
2. Show “Check your email to verify your account.”
3. Handle verification via `verifyEmail()` (see [§5](#5-email-verification)).

---

### `signUpWithUsernameAndPassword(username, password, options?)`

Registers with username as the primary identifier.

**API:** `POST /api/auth/username-register`

| Parameter | Required | Description |
|-----------|----------|-------------|
| `username` | Yes | 3–30 chars, alphanumeric + underscore |
| `password` | Yes | Same rules as email signup |
| `options.fullName` | No | Display name |
| `options.email` | No | If provided, verification email is sent |

**Returns:** `{ user, token, message }`

```javascript
await auth.signUpWithUsernameAndPassword('jane_doe', 'StrongPass123!', {
  fullName: 'Jane Doe',
  email: 'jane@example.com',
});
```

---

### `signInWithEmailAndPassword(email, password)`

**API:** `POST /api/auth/email-login`

**Returns:** `{ user, accessToken, refreshToken, message }`

- Session is stored on the client.
- Fails with `AuthorizationError` if email is not verified.
- Fails with `AccountLockedError` after too many failed attempts.

```javascript
try {
  const session = await auth.signInWithEmailAndPassword('jane@example.com', 'StrongPass123!');
  // Redirect to dashboard
} catch (error) {
  if (error.name === 'AuthorizationError') {
    // Prompt user to verify email
  }
}
```

---

### `signInWithUsernameAndPassword(username, password)`

**API:** `POST /api/auth/username-login`

Same return shape and behavior as email login.

```javascript
await auth.signInWithUsernameAndPassword('jane_doe', 'StrongPass123!');
```

---

## 4. Magic link (passwordless)

### `signInWithEmailLink(email, options)`

Sends a magic link email. The user clicks the link and lands on **your** callback URL with a `token` query param.

**API:** `POST /api/send-magic-link`

| Parameter | Required | Description |
|-----------|----------|-------------|
| `email` | Yes | User email |
| `options.redirectUri` | Yes | Your app URL (must be allowlisted in Voult dashboard) |

**Returns:** `{ success, message }`

```javascript
await auth.signInWithEmailLink('jane@example.com', {
  redirectUri: 'https://myapp.com/auth/callback',
});
```

**Your callback page** (e.g. `/auth/callback`):

```javascript
// Browser: read token from URL
const token = new URLSearchParams(window.location.search).get('token');

// Exchange token on your server
const result = await auth.verifyEmailLink(token);
// result: { user, accessToken, refreshToken, success, message }
```

---

### `verifyEmailLink(token)`

Exchanges the magic-link token for JWTs.

**API:** `POST /api/validate-magic-link`

| Parameter | Required | Description |
|-----------|----------|-------------|
| `token` | Yes | From `?token=` on your redirect URI |

**Returns:** `{ user, accessToken, refreshToken, message, success }`

---

## 5. Email verification

After email/password signup, users receive a link like:

`https://api.voult.dev/api/user/verify-email?token=RAW_TOKEN&appId=APP_ID`

### `verifyEmail(token, options)`

**API:** `GET /api/user/verify-email?token=...&appId=...`

| Parameter | Required | Description |
|-----------|----------|-------------|
| `token` | Yes | From verification email URL |
| `options.appId` | Yes | From verification email URL |

**Returns:** `{ success, message }`

```javascript
// In your /verify-email route handler
const { token, appId } = req.query;
await auth.verifyEmail(token, { appId });
res.send('Email verified! You can now log in.');
```

---

## 6. Password reset

### `sendPasswordResetEmail(email)`

**API:** `POST /api/user/forgot-password`

Sends a reset link if the email exists and is verified. Always returns a generic success message (no email enumeration).

```javascript
await auth.sendPasswordResetEmail('jane@example.com');
```

---

### `resetPassword(token, newPassword, options)`

**API:** `POST /api/user/reset-password?token=...&appId=...`

| Parameter | Required | Description |
|-----------|----------|-------------|
| `token` | Yes | From reset email URL |
| `newPassword` | Yes | Must meet password rules |
| `options.appId` | Yes | From reset email URL |

```javascript
// Page: /reset-password?token=abc&appId=xyz
await auth.resetPassword(token, 'NewStrongPass123!', { appId });
```

---

## 7. Profile & account management

### `getCurrentUser()`

Fetches the authenticated user's profile from the API and updates the in-memory session.

**API:** `GET /api/user/me`

**Requires:** Active session (`accessToken`)

**Returns:**

```javascript
{
  id, email, fullName, isEmailVerified,
  createdAt, updatedAt, isLocked, lastLoginAt, app
}
```

```javascript
const profile = await auth.getCurrentUser();
console.log(profile.fullName, profile.isEmailVerified);
```

---

### `updateProfile({ fullName })`

**API:** `PATCH /api/user/me`

| Parameter | Required | Description |
|-----------|----------|-------------|
| `fullName` | Yes | New display name (must differ from current) |

**Returns:** `{ success, message, user }`

```javascript
await auth.updateProfile({ fullName: 'Jane Smith' });
```

---

### `deleteUser()`

Soft-disables the account (Voult does not hard-delete).

**API:** `POST /api/user/disable`

Clears the local session after success.

```javascript
await auth.deleteUser();
```

---

### `reenableAccount()`

Re-enables a disabled account. **Clears the session** — user must sign in again.

**API:** `POST /api/user/reenable`

```javascript
await auth.reenableAccount();
await auth.signInWithEmailAndPassword(email, password);
```

---

## 8. Session management

### `signOut()`

**API:** `POST /api/auth/logout`

Revokes refresh tokens server-side and clears local session. If the token is already invalid, local session is still cleared.

```javascript
await auth.signOut();
```

---

### `refreshSession()`

**API:** `POST /api/sessions/refresh`

Uses the stored `refreshToken` to obtain new tokens. Called automatically when an API request returns `401` and a refresh token exists.

```javascript
const { accessToken, refreshToken, user } = await auth.refreshSession();
```

---

### `listSessions()`

**API:** `GET /api/sessions`

**Returns:** `{ sessions: [{ id, ipAddress, userAgent, createdAt, lastUsedAt, expiresAt }] }`

```javascript
const { sessions } = await auth.listSessions();
```

---

### `revokeSession(sessionId)`

**API:** `GET /api/sessions/revoke/:sessionId`

```javascript
await auth.revokeSession('60d5ecb74b24c72b8c8b4567');
```

---

## 9. OAuth providers

OAuth routes use **client ID only** (no client secret). Configure each provider in the [Voult dashboard](https://www.voult.dev) first.

All OAuth sign-in/sign-up methods return:

`{ user, accessToken, refreshToken, token, message, success }`

### Google — `signInWithGoogle` / `signUpWithGoogle`

**API:** `POST /api/auth/google/login` | `/register`

```javascript
// After Google Identity Services callback
await auth.signInWithGoogle({ idToken: credential });
// or
await auth.signInWithGoogle({ accessToken: googleAccessToken });
```

### GitHub — `signInWithGitHub` / `signUpWithGitHub`

**API:** `POST /api/auth/github/login` | `/register`

```javascript
// After OAuth redirect with ?code=
await auth.signInWithGitHub({
  code: authorizationCode,
  redirectUri: 'https://myapp.com/auth/github/callback',
});
```

### Facebook — `signInWithFacebook` / `signUpWithFacebook`

**API:** `POST /api/auth/facebook/login` | `/register`

```javascript
await auth.signInWithFacebook({ accessToken: fbAccessToken });
```

### LinkedIn — `signInWithLinkedIn` / `signUpWithLinkedIn`

**API:** `POST /api/auth/linkedin/login` | `/register`

```javascript
await auth.signInWithLinkedIn({ code: authorizationCode });
```

### Microsoft — `signInWithMicrosoft` / `signUpWithMicrosoft`

**API:** `POST /api/auth/microsoft/login` | `/register`

```javascript
await auth.signInWithMicrosoft({ code: authorizationCode });
```

### Apple — `signInWithApple` / `signUpWithApple`

**API:** `POST /api/auth/apple/login` | `/register`

```javascript
await auth.signInWithApple({
  code: appleAuthCode,
  idToken: appleIdToken,
});
```

---

## 10. OAuth account linking

For users already signed in who want to connect additional providers.

### `linkOAuthProvider(provider)`

**API:** `POST /api/oauth/:provider/link`

**Returns:** `{ redirectUrl }` — redirect the user to this URL.

```javascript
const { redirectUrl } = await auth.linkOAuthProvider('google');
window.location.href = redirectUrl;
```

Supported providers: `google`, `github`, `facebook`, `linkedin`, `microsoft`, `apple`.

---

### `getLinkedOAuthProviders()`

**API:** `GET /api/me/oauth-accounts` (falls back to `/api/me/oauth`)

**Returns:** `{ providers: [{ provider, createdAt }] }`

---

### `unlinkOAuthProvider(provider)`

**API:** `DELETE /api/me/oauth-accounts/:provider`

```javascript
await auth.unlinkOAuthProvider('github');
```

---

### `setPassword(password)`

For social-only accounts without a password.

**API:** `POST /api/me/set-password`

```javascript
await auth.setPassword('StrongPass123!');
```

---

## 11. Session persistence

The SDK stores sessions **in memory** by default. For SPAs or mobile apps, persist across reloads:

```javascript
import { persistSession, restoreSession, clearPersistedSession } from 'voult-sdk';

// After login
auth.persistSession(localStorage);

// On app startup
if (auth.restoreSession(localStorage)) {
  await auth.getCurrentUser(); // optional: refresh profile
}

// On logout
await auth.signOut();
clearPersistedSession(localStorage);
```

Or use the convenience methods on the default instance:

```javascript
auth.persistSession(localStorage);
auth.restoreSession(localStorage);
```

---

## 12. Error handling

```javascript
import {
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  AccountLockedError,
  NetworkError,
} from 'voult-sdk';

try {
  await auth.signInWithEmailAndPassword(email, password);
} catch (error) {
  if (error instanceof ValidationError) {
    // Bad input — show field error (error.field may be set)
  } else if (error instanceof AuthenticationError) {
    // Wrong credentials or expired session
  } else if (error instanceof AuthorizationError) {
    // Email not verified, account disabled
  } else if (error instanceof ConflictError) {
    // Email/username already exists
  } else if (error instanceof AccountLockedError) {
    // Too many failed logins
  } else if (error instanceof NetworkError) {
    // Connection issues
  }
}
```

| Error | HTTP | When |
|-------|------|------|
| `ValidationError` | 400 | Invalid input |
| `AuthenticationError` | 401 | Bad credentials, expired session |
| `AuthorizationError` | 403 | Unverified email, disabled account |
| `ConflictError` | 409 | Duplicate user |
| `AccountLockedError` | 423 | Account locked |
| `NetworkError` | — | No response from API |

---

## 13. Validation utilities

Use before submit for instant UX feedback:

```javascript
import {
  isValidEmail,
  isValidPassword,
  isValidUsername,
  isValidUrl,
  PASSWORD_REQUIREMENTS_MESSAGE,
} from 'voult-sdk';

if (!isValidEmail(email)) { /* show error */ }
if (!isValidPassword(password)) {
  alert(PASSWORD_REQUIREMENTS_MESSAGE);
}
```

---

## 14. Full React example

### Server (Express) — keep secrets safe

```javascript
// server/auth.js
import express from 'express';
import voult from 'voult-sdk';

const auth = voult({
  clientId: process.env.VOULT_CLIENT_ID,
  clientSecret: process.env.VOULT_CLIENT_SECRET,
});

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const result = await auth.signUpWithEmailAndPassword(
      req.body.email,
      req.body.password,
      { fullName: req.body.fullName }
    );
    req.session.voult = {
      accessToken: result.token,
      refreshToken: null,
      user: result.user,
    };
    res.json({ user: result.user, message: result.message });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const result = await auth.signInWithEmailAndPassword(
      req.body.email,
      req.body.password
    );
    req.session.voult = {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    };
    res.json(result);
  } catch (err) {
    res.status(err.status || 401).json({ error: err.message });
  }
});

router.get('/me', async (req, res) => {
  if (!req.session.voult?.accessToken) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  auth.client.setSession(
    req.session.voult.user,
    req.session.voult.accessToken,
    req.session.voult.refreshToken
  );
  const user = await auth.getCurrentUser();
  res.json(user);
});

router.post('/logout', async (req, res) => {
  auth.client.setSession(
    req.session.voult?.user,
    req.session.voult?.accessToken,
    req.session.voult?.refreshToken
  );
  await auth.signOut();
  req.session.destroy();
  res.json({ success: true });
});

export default router;
```

### Client (React)

```jsx
// LoginForm.jsx
async function handleLogin(e) {
  e.preventDefault();
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    credentials: 'include',
  });
  if (!res.ok) {
    const { error } = await res.json();
    setError(error);
    return;
  }
  navigate('/dashboard');
}
```

### Magic link callback page

```jsx
// MagicLinkCallback.jsx
useEffect(() => {
  const token = new URLSearchParams(location.search).get('token');
  if (!token) return;

  fetch('/api/auth/magic-link/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
    credentials: 'include',
  })
    .then((r) => r.json())
    .then(() => navigate('/dashboard'));
}, []);
```

---

## 15. API endpoint reference

| SDK method | HTTP | Endpoint |
|------------|------|----------|
| `signUpWithEmailAndPassword` | POST | `/api/auth/register` |
| `signUpWithUsernameAndPassword` | POST | `/api/auth/username-register` |
| `signInWithEmailAndPassword` | POST | `/api/auth/email-login` |
| `signInWithUsernameAndPassword` | POST | `/api/auth/username-login` |
| `signOut` | POST | `/api/auth/logout` |
| `signInWithEmailLink` | POST | `/api/send-magic-link` |
| `verifyEmailLink` | POST | `/api/validate-magic-link` |
| `verifyEmail` | GET | `/api/user/verify-email` |
| `sendPasswordResetEmail` | POST | `/api/user/forgot-password` |
| `resetPassword` | POST | `/api/user/reset-password` |
| `getCurrentUser` | GET | `/api/user/me` |
| `updateProfile` | PATCH | `/api/user/me` |
| `deleteUser` | POST | `/api/user/disable` |
| `reenableAccount` | POST | `/api/user/reenable` |
| `refreshSession` | POST | `/api/sessions/refresh` |
| `listSessions` | GET | `/api/sessions` |
| `revokeSession` | GET | `/api/sessions/revoke/:id` |
| `signInWithGoogle` | POST | `/api/auth/google/login` |
| `signUpWithGoogle` | POST | `/api/auth/google/register` |
| `signInWithGitHub` | POST | `/api/auth/github/login` |
| … | … | (same pattern for other providers) |
| `linkOAuthProvider` | POST | `/api/oauth/:provider/link` |
| `getLinkedOAuthProviders` | GET | `/api/me/oauth-accounts` |
| `unlinkOAuthProvider` | DELETE | `/api/me/oauth-accounts/:provider` |
| `setPassword` | POST | `/api/me/set-password` |

---

## Dashboard checklist

Before going to production, configure in [voult.dev](https://www.voult.dev):

1. **Client ID & secret** — used in `voult({ clientId, clientSecret })`
2. **Allowed callback URLs** — required for magic links and OAuth redirects
3. **OAuth providers** — enable Google, GitHub, etc. per app
4. **Email templates** — verification and reset emails

---

## Related resources

- [Voult API repository](https://github.com/DevOlabode/voult)
- [SDK source](https://github.com/DevOlabode/voult-sdk)
- Live API: [https://api.voult.dev](https://api.voult.dev)
