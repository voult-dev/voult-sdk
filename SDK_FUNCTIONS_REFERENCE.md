# Voult SDK Functions Reference

Complete reference of all functions available in the Voult SDK for testing and development.

## Table of Contents

- [Core Client](#-core-client)
- [Password Authentication - Sign Up](#-password-authentication---sign-up)
- [Password Authentication - Sign In](#-password-authentication---sign-in)
- [Passwordless Authentication - Magic Link](#-passwordless-authentication---magic-link)
- [Session Management](#-session-management)
- [Validation Utilities](#-validation-utilities)
- [Error Classes](#-error-classes)
- [Default Export (Convenient API)](#-convenient-default-export)
- [Quick Testing Checklist](#-quick-testing-checklist)

---

## 📦 Core Client

### `VoultClient`
The main HTTP client class for interacting with the Voult API.

```javascript
import { VoultClient } from 'voult-sdk';

const client = new VoultClient({
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  baseURL: 'https://api.voult.dev' // optional, defaults to this
});
```

**Configuration Options:**
| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `clientId` | string | Yes | Your application's client ID from Voult dashboard |
| `clientSecret` | string | Yes | Your application's client secret |
| `baseURL` | string | No | API base URL (defaults to `https://api.voult.dev`) |

**Instance Methods:**
- `setSession(user, accessToken, refreshToken)` - Store user session
- `clearSession()` - Clear user session
- `isAuthenticated()` - Check if user is logged in
- `getCurrentUser()` - Get current user data

---

## 🔐 Password Authentication - Sign Up

### `signUpWithEmailAndPassword(email, password, options, client)`
Register a new user with email and password.

```javascript
import { signUpWithEmailAndPassword } from 'voult-sdk';

const { user, token } = await signUpWithEmailAndPassword(
  'user@example.com',
  'StrongPass123!',  // Must have uppercase, lowercase, number, special char
  { fullName: 'John Doe' },  // optional
  client
);
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `email` | string | Yes | User's email address |
| `password` | string | Yes | User's password (must meet complexity requirements) |
| `options` | object | No | Optional parameters |
| `options.fullName` | string | No | User's full name |
| `client` | VoultClient | Yes | The Voult client instance |

**Returns:**
```javascript
{
  user: { id, email },
  token: string,
  message: string
}
```

**Errors:**
- `ValidationError` - Invalid email or weak password
- `ConflictError` - User with email already exists
- `AuthenticationError` - Registration failed

---

### `signUpWithUsernameAndPassword(username, password, options, client)`
Register a new user with username and password (requires email in options).

```javascript
import { signUpWithUsernameAndPassword } from 'voult-sdk';

const { user, token } = await signUpWithUsernameAndPassword(
  'john_doe',
  'StrongPass123!',
  { email: 'john@example.com', fullName: 'John Doe' },
  client
);
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `username` | string | Yes | User's username |
| `password` | string | Yes | User's password |
| `options` | object | Yes | Options object |
| `options.email` | string | Yes | User's email address |
| `options.fullName` | string | No | User's full name |
| `client` | VoultClient | Yes | The Voult client instance |

**Returns:**
```javascript
{
  user: { id, email },
  token: string,
  message: string
}
```

---

## 🔓 Password Authentication - Sign In

### `signInWithEmailAndPassword(email, password, client)`
Authenticate with email and password.

```javascript
import { signInWithEmailAndPassword } from 'voult-sdk';

const { user, accessToken, refreshToken } = await signInWithEmailAndPassword(
  'user@example.com',
  'StrongPass123!',
  client
);
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `email` | string | Yes | User's email address |
| `password` | string | Yes | User's password |
| `client` | VoultClient | Yes | The Voult client instance |

**Returns:**
```javascript
{
  user: { id, email },
  accessToken: string,
  refreshToken: string,
  message: string
}
```

**Errors:**
- `ValidationError` - Invalid email or password format
- `AuthenticationError` - Invalid credentials
- `AuthorizationError` - Email not verified or account disabled
- `AccountLockedError` - Too many failed attempts

---

### `signInWithUsernameAndPassword(username, password, client)`
Authenticate with username and password (username must be email format).

```javascript
import { signInWithUsernameAndPassword } from 'voult-sdk';

const { user, accessToken } = await signInWithUsernameAndPassword(
  'user@example.com',
  'StrongPass123!',
  client
);
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `username` | string | Yes | User's username (must be email format) |
| `password` | string | Yes | User's password |
| `client` | VoultClient | Yes | The Voult client instance |

**Returns:**
```javascript
{
  user: { id, email },
  accessToken: string,
  refreshToken: string,
  message: string
}
```

---

## ✨ Passwordless Authentication - Magic Link

### `signInWithEmailLink(email, options, client)`
Send a magic link to the user's email.

```javascript
import { signInWithEmailLink } from 'voult-sdk';

await signInWithEmailLink(
  'user@example.com',
  { redirectUri: 'https://yourapp.com/callback' },  // required
  client
);
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `email` | string | Yes | User's email address |
| `options` | object | Yes | Options object |
| `options.redirectUri` | string | Yes | URL where user is redirected after clicking link |
| `client` | VoultClient | Yes | The Voult client instance |

**Returns:**
```javascript
{
  success: boolean,
  message: string
}
```

---

### `verifyEmailLink(token, client)`
Verify a magic link token and complete authentication.

```javascript
import { verifyEmailLink } from 'voult-sdk';

// After user clicks the magic link, extract token from URL
const token = new URLSearchParams(window.location.search).get('token');
const { user, accessToken, refreshToken } = await verifyEmailLink(token, client);
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `token` | string | Yes | The magic link token from URL |
| `client` | VoultClient | Yes | The Voult client instance |

**Returns:**
```javascript
{
  user: { id, email, fullName, isEmailVerified },
  accessToken: string,
  refreshToken: string,
  message: string,
  success: boolean
}
```

---

## 👤 Session Management

### `getCurrentUser(client)`
Get the current authenticated user's profile.

```javascript
import { getCurrentUser } from 'voult-sdk';

const profile = await getCurrentUser(client);
console.log(profile.email, profile.fullName, profile.isEmailVerified);
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `client` | VoultClient | Yes | The Voult client instance |

**Returns:**
```javascript
{
  id: string,
  email: string,
  fullName: string,
  isEmailVerified: boolean,
  createdAt: string,
  updatedAt: string,
  // ... other user fields
}
```

---

### `signOut(client)`
Log out the current user and clear session.

```javascript
import { signOut } from 'voult-sdk';

await signOut(client);
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `client` | VoultClient | Yes | The Voult client instance |

**Returns:**
```javascript
{
  success: boolean,
  message: string
}
```

---

### `deleteUser(client)`
Delete/disable the current user's account.

```javascript
import { deleteUser } from 'voult-sdk';

await deleteUser(client);
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `client` | VoultClient | Yes | The Voult client instance |

**Returns:**
```javascript
{
  success: boolean,
  message: string
}
```

---

## ✅ Validation Utilities

### `isValidEmail(email)`
Check if an email is valid.

```javascript
import { isValidEmail } from 'voult-sdk';

console.log(isValidEmail('test@example.com')); // true
console.log(isValidEmail('invalid')); // false
```

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `email` | string | Email to validate |

**Returns:** `boolean`

---

### `isValidPassword(password)`
Check if a password meets requirements.

```javascript
import { isValidPassword } from 'voult-sdk';

console.log(isValidPassword('StrongPass123!')); // true
console.log(isValidPassword('weak')); // false
```

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `password` | string | Password to validate |

**Returns:** `boolean`

---

### `PASSWORD_REQUIREMENTS_MESSAGE`
The password requirements message constant.

```javascript
import { PASSWORD_REQUIREMENTS_MESSAGE } from 'voult-sdk';

console.log(PASSWORD_REQUIREMENTS_MESSAGE);
// "Password must be at least 8 characters long and include uppercase, lowercase, number, and special character"
```

---

## ❌ Error Classes

### Available Error Classes

```javascript
import { 
  VoultError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  AccountLockedError,
  NetworkError
} from 'voult-sdk';
```

| Error Class | HTTP Status | Description |
|-------------|-------------|-------------|
| `VoultError` | - | Base error class for all Voult errors |
| `ValidationError` | 400 | Invalid input (email, password, etc.) |
| `AuthenticationError` | 401 | Invalid credentials |
| `AuthorizationError` | 403 | Email not verified or account disabled |
| `ConflictError` | 409 | User already exists |
| `AccountLockedError` | 423 | Too many failed login attempts |
| `NetworkError` | - | Network connection failed |

**Example Usage:**
```javascript
try {
  await signInWithEmailAndPassword('invalid', 'weak', client);
} catch (error) {
  if (error instanceof ValidationError) {
    console.log('Validation failed:', error.message);
  } else if (error instanceof AuthenticationError) {
    console.log('Authentication failed:', error.message);
  } else if (error instanceof AccountLockedError) {
    console.log('Account locked:', error.message);
  }
}
```

---

## 🚀 Convenient Default Export

You can use the default export for a simpler API:

```javascript
import voult from 'voult-sdk';

const auth = voult({
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  baseURL: 'https://api.voult.dev' // optional
});

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
auth.client          // Access the underlying VoultClient
auth.VERSION         // SDK version
```

---

## 📋 Quick Testing Checklist

Use this checklist to verify all SDK functions work correctly:

| Function | Description | Test Status |
|----------|-------------|-------------|
| `VoultClient` | Create client instance | ⬜ |
| `signUpWithEmailAndPassword` | Register with email | ⬜ |
| `signUpWithUsernameAndPassword` | Register with username | ⬜ |
| `signInWithEmailAndPassword` | Login with email | ⬜ |
| `signInWithUsernameAndPassword` | Login with username | ⬜ |
| `signInWithEmailLink` | Send magic link | ⬜ |
| `verifyEmailLink` | Verify magic link | ⬜ |
| `getCurrentUser` | Get user profile | ⬜ |
| `signOut` | Logout user | ⬜ |
| `deleteUser` | Delete account | ⬜ |
| `isValidEmail` | Validate email | ⬜ |
| `isValidPassword` | Validate password | ⬜ |
| Error classes | Test error handling | ⬜ |

---

## 🔗 Additional Resources

- [README.md](./README.md) - Full SDK documentation
- [TESTING_GUIDE.md](./TESTING_GUIDE.md) - How to test the SDK locally
- [SDK_DEVELOPMENT_GUIDE.md](./SDK_DEVELOPMENT_GUIDE.md) - Development guide
- [GitHub Repository](https://github.com/DevOlabode/voult-sdk) - Source code
- [Voult API Repository](https://github.com/DevOlabode/voult) - Backend API