# Voult SDK

Official JavaScript SDK for the [Voult Authentication API](https://github.com/voult-dev/voult). Provides a simple, developer-friendly interface for user authentication including password-based and passwordless authentication methods.

## Features

- **Password Authentication** - Sign up and sign in with email/password or username/password
- **Passwordless Authentication** - Magic link authentication via email
- **Multi-Factor Authentication** - TOTP enrollment, verification, and backup codes
- **Passkeys (WebAuthn)** - Register and sign in with platform passkeys
- **OAuth** - Direct provider token exchange and redirect-based authorization URLs
- **Secure Session Management** - Automatic token handling, refresh, and storage
- **CSRF Support** - Optional CSRF token fetching for browser-based clients
- **Tree-shakeable** - Import only what you need
- **Zero Configuration** - Works out of the box

## Installation

```bash
npm install @voult/sdk
```

## Quick Start

```javascript
import voult from '@voult/sdk';

// Initialize the SDK
const auth = voult({
  clientId: 'your-client-id', 
  clientSecret: 'your-client-secret',
  baseURL: 'https://api.voult.dev'
});

// Sign up a new user
const { user, accessToken, refreshToken, emailVerificationRequired } =
  await auth.signUpWithEmailAndPassword(
    'user@example.com',
    'StrongPass123!', 
    { fullName: 'Jane Doe' }
  );

// Sign in
const { user, accessToken } = await auth.signInWithEmailAndPassword(
  'user@example.com',
  'StrongPass123!'
);

// Check if user is authenticated
if (auth.isAuthenticated()) {
  const currentUser = auth.getCurrentUser();
  console.log('Logged in as:', currentUser.email);
}

// Sign out
await auth.signOut();
```

## Usage

### Initialization

```javascript
import voult from '@voult/sdk';

const auth = voult({
  clientId: 'app_abc123',
  clientSecret: 'secret_xyz789',
  baseURL: 'https://api.voult.dev', 
  useCookies: true,                
});
```

### Password Authentication

#### Sign Up with Email

```javascript
import { signUpWithEmailAndPassword } from '@voult/sdk';

try {
  const { user, token } = await signUpWithEmailAndPassword(
    'user@example.com',
    'StrongPass123!',
    { fullName: 'John Doe' }, 
    client
  );
  
  console.log('User registered:', user.email);
} catch (error) {
  if (error.code === 'USER_EXISTS') {
    console.log('User already exists');
  }
}
```

#### Sign Up with Username

```javascript
import { signUpWithUsernameAndPassword } from '@voult/sdk';

// Note: Voult API uses email-based registration
// This function requires an email in the options
const { user, token } = await signUpWithUsernameAndPassword(
  'john_doe',
  'StrongPass123!',
  { 
    email: 'john@example.com',
    fullName: 'John Doe'
  },
  client
);
```

#### Sign In with Email

```javascript
import { signInWithEmailAndPassword } from '@voult/sdk';

const { user, accessToken, refreshToken } = await signInWithEmailAndPassword(
  'user@example.com',
  'StrongPass123!',
  client
);
```

#### Sign In with Username

```javascript
import { signInWithUsernameAndPassword } from '@voult/sdk';

// Username must be in email format for Voult API
const { user, accessToken } = await signInWithUsernameAndPassword(
  'user@example.com',
  'StrongPass123!',
  client
);
```

### Passwordless Authentication (Magic Link)

#### Send Magic Link

```javascript
import { signInWithEmailLink } from '@voult/sdk';

await signInWithEmailLink(
  'user@example.com',
  { 
    redirectUri: 'https://yourapp.com/auth/callback'
  },
  client
);
```

#### Verify Magic Link

```javascript
import { verifyEmailLink } from '@voult/sdk';

// After user clicks the magic link, extract token from URL
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');

const { user, accessToken, refreshToken } = await verifyEmailLink(token, client);
```

### Session Management

#### Get Current User

```javascript
import { getCurrentUser } from '@voult/sdk';

const profile = await getCurrentUser(client);
console.log(profile.email, profile.fullName, profile.isEmailVerified);
```

#### Sign Out

```javascript
import { signOut } from '@voult/sdk';

await signOut(client);
// Session is automatically cleared
```

#### Delete User

```javascript
import { deleteUser } from '@voult/sdk';

await deleteUser(client);
```

### MFA (Two-Factor Authentication)

When a user has MFA enabled, sign-in returns a challenge instead of tokens:

```javascript
const result = await auth.signInWithEmailAndPassword('user@example.com', 'password');

if (result.mfaRequired) {
  const { user, accessToken } = await auth.verifyMfaLogin(
    result.mfaPendingToken,
    '123456' 
  );
}
```

Manage MFA on an authenticated account:

```javascript
const setup = await auth.setupMfa();           
await auth.enableMfa('123456');              
const status = await auth.getMfaStatus();
await auth.regenerateMfaBackupCodes('123456');
await auth.disableMfa('currentPassword', '123456');
```

### Passkeys (WebAuthn)

```javascript

const compat = await auth.getWebAuthnCompatibility();

const { options } = await auth.createPasskeyRegistrationOptions({ deviceName: 'MacBook' });

await auth.verifyPasskeyRegistration(credential, { deviceName: 'MacBook' });

const { options: loginOptions } = await auth.createPasskeyLoginOptions({ email: 'user@example.com' });

await auth.verifyPasskeyLogin(credential);
```

### Hosted OAuth (Google, GitHub, …)

Provider credentials live in the Voult dashboard, not in your `.env`. Your server starts the
flow, Voult talks to the provider, and your callback swaps a one-time code for a session.
`redirectUri` must be on the app's **Callback URLs** list in the dashboard.

> Using Express? `@voult/express` does all of this for you (`/oauth/:provider/start` and `/oauth/callback`).

```javascript
// 1. Start: remember a nonce, send it as `state`, redirect the browser
const state = crypto.randomUUID();                 // store it in a signed, httpOnly cookie
const { authUrl } = await getOAuthAuthorizationUrl('google', {
  intent: 'authenticate',                          // or 'login' / 'register'
  redirectUri: 'https://myapp.com/oauth/callback',
  state,
}, client);
res.redirect(authUrl);

// 2. Callback: Voult redirects to redirectUri?voult_code=…&state=…  (or ?error=…&state=…)
if (req.query.state !== cookieState) throw new Error('Sign-in not started here');
const result = await exchangeOAuthCode(req.query.voult_code, {
  redirectUri: 'https://myapp.com/oauth/callback',
}, client);                                        // needs the client secret: server-side only

if (result.mfaRequired) {
  // same as password sign-in: finish with verifyMfaLogin(result.mfaPendingToken, code, client)
}
```

Link a provider to the **signed-in** user (Voult returns to `redirectUri?linked=1&state=…`):

```javascript
const { authUrl } = await linkOAuthProvider('github', { redirectUri, state }, client);
```

Diagnostics: `getApiMeta(client)` (API version, `minSdkVersion`) and `getAppInfo(client)`
(allowed callback URLs and which providers are enabled/configured — never secrets).

### CSRF Token (Browser Clients)

Several Voult routes require CSRF protection. Enable cookies and fetch a token:

```javascript
const auth = voult({ clientId, clientSecret, useCookies: true });
await auth.fetchCsrfToken();
await auth.sendPasswordResetEmail('user@example.com');
```

### Error Handling

The SDK provides custom error classes for different error scenarios:

```javascript
import { 
  VoultError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  AccountLockedError,
  NetworkError
} from '@voult/sdk';

try {
  await auth.signInWithEmailAndPassword('user@example.com', 'wrongpassword');
} catch (error) {
  if (error instanceof ValidationError) {
    console.log('Invalid input:', error.message);
  } else if (error instanceof AuthenticationError) {
    console.log('Invalid credentials:', error.message);
  } else if (error instanceof AccountLockedError) {
    console.log('Account locked due to too many failed attempts');
  } else if (error instanceof ConflictError) {
    console.log('User already exists:', error.message);
  } else if (error instanceof NetworkError) {
    console.log('Network error, check connection');
  } else {
    console.log('Voult error:', error.code, error.message);
  }
}
```

### Password Requirements

Passwords must meet the following requirements:
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character (@$!%*?&)

You can validate passwords before sending to the API. In browser code, import from
`@voult/sdk/validation`: it has no network code, so it doesn't pull the HTTP client into your bundle.

```javascript
import { isValidPassword, PASSWORD_REQUIREMENTS_MESSAGE } from '@voult/sdk/validation';

if (!isValidPassword(password)) {
  console.log(PASSWORD_REQUIREMENTS_MESSAGE);
  // "Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character from @$!%*?& (only letters, numbers, and @$!%*?& are allowed)"
}
```

## API Reference

### VoultClient

The core HTTP client that handles all API communication.

```javascript
import { VoultClient } from '@voult/sdk';

const client = new VoultClient({
  clientId: 'app_abc123',
  clientSecret: 'secret_xyz789',
  baseURL: 'https://api.voult.dev'
});

// Session management
client.setSession(user, accessToken, refreshToken);
client.clearSession();
client.isAuthenticated();
client.getCurrentUser();
```

### Default Export (Convenient Usage)

```javascript
import voult from '@voult/sdk';

const auth = voult({ clientId: '...', clientSecret: '...' });

// All methods available on the auth object:
auth.signUpWithEmailAndPassword(email, password, options)
auth.signUpWithUsernameAndPassword(username, password, options)
auth.signInWithEmailAndPassword(email, password)
auth.signInWithUsernameAndPassword(username, password)
auth.signInWithEmailLink(email, options)
auth.verifyEmailLink(token)
auth.getCurrentUser()
auth.signOut()
auth.deleteUser()
auth.isAuthenticated()
```

### Named Exports (Tree-shakeable)

```javascript
import {
  VoultClient,
  signUpWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  ValidationError,
  AuthenticationError,
} from '@voult/sdk';
```

## Configuration Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `clientId` | string | Yes | Your application's client ID from Voult dashboard |
| `clientSecret` | string | Yes | Your application's client secret |
| `baseURL` | string | No | API base URL (defaults to `https://staging.voult.dev` — pre-launch; will become the real production URL at launch) |
| `csrfToken` | string | No | CSRF token for state-changing routes |
| `useCookies` | boolean | No | Send cookies with requests (needed for CSRF in browsers) |

## Error Codes

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid input (email, password, etc.) |
| `AUTHENTICATION_ERROR` | 401 | Invalid credentials |
| `AUTHORIZATION_ERROR` | 403 | Email not verified or account disabled |
| `CONFLICT_ERROR` | 409 | User already exists |
| `ACCOUNT_LOCKED` | 423 | Too many failed login attempts |
| `NETWORK_ERROR` | - | Network connection failed |

## Browser Support

The SDK works in all modern browsers that support ES modules:
- Chrome 61+
- Firefox 67+
- Safari 11+
- Edge 79+

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting a pull request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT

## Links

- [GitHub Repository](https://github.com/voult-dev/voult-sdk)
- [Voult API Repository](https://github.com/voult-dev/voult)
- [Report an Issue](https://github.com/voult-dev/voult-sdk/issues)