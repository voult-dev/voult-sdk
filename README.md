# Voult SDK

Official JavaScript SDK for the [Voult Authentication API](https://github.com/DevOlabode/voult). Provides a simple, developer-friendly interface for user authentication including password-based and passwordless authentication methods.

## Features

- 🔐 **Password Authentication** - Sign up and sign in with email/password
- ✨ **Passwordless Authentication** - Magic link authentication via email
- 🔒 **Secure Session Management** - Automatic token handling and storage
- 🛡️ **TypeScript Ready** - Full JSDoc type annotations for IDE autocomplete
- 🎯 **Tree-shakeable** - Import only what you need
- 📦 **Zero Configuration** - Works out of the box

## Installation

```bash
npm install voult-sdk
```

## Quick Start

```javascript
import voult from 'voult-sdk';

// Initialize the SDK
const auth = voult({
  clientId: 'your-client-id',      // From your Voult dashboard
  clientSecret: 'your-client-secret',
  baseURL: 'https://api.voult.dev'  // Optional, defaults to this
});

// Sign up a new user
const { user, token } = await auth.signUpWithEmailAndPassword(
  'user@example.com',
  'StrongPass123!'  // Must include uppercase, lowercase, number, special char
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
import voult from 'voult-sdk';

const auth = voult({
  clientId: 'app_abc123',
  clientSecret: 'secret_xyz789',
  baseURL: 'https://api.voult.dev' // Optional
});
```

### Password Authentication

#### Sign Up with Email

```javascript
import { signUpWithEmailAndPassword } from 'voult-sdk';

try {
  const { user, token } = await signUpWithEmailAndPassword(
    'user@example.com',
    'StrongPass123!',
    { fullName: 'John Doe' },  // Optional
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
import { signUpWithUsernameAndPassword } from 'voult-sdk';

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
import { signInWithEmailAndPassword } from 'voult-sdk';

const { user, accessToken, refreshToken } = await signInWithEmailAndPassword(
  'user@example.com',
  'StrongPass123!',
  client
);
```

#### Sign In with Username

```javascript
import { signInWithUsernameAndPassword } from 'voult-sdk';

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
import { signInWithEmailLink } from 'voult-sdk';

await signInWithEmailLink(
  'user@example.com',
  { 
    redirectUri: 'https://yourapp.com/auth/callback'  // Where user goes after clicking link
  },
  client
);
```

#### Verify Magic Link

```javascript
import { verifyEmailLink } from 'voult-sdk';

// After user clicks the magic link, extract token from URL
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');

const { user, accessToken, refreshToken } = await verifyEmailLink(token, client);
```

### Session Management

#### Get Current User

```javascript
import { getCurrentUser } from 'voult-sdk';

const profile = await getCurrentUser(client);
console.log(profile.email, profile.fullName, profile.isEmailVerified);
```

#### Sign Out

```javascript
import { signOut } from 'voult-sdk';

await signOut(client);
// Session is automatically cleared
```

#### Delete User

```javascript
import { deleteUser } from 'voult-sdk';

await deleteUser(client);
// Account is disabled and session is cleared
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
} from 'voult-sdk';

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

You can validate passwords before sending to the API:

```javascript
import { isValidPassword, PASSWORD_REQUIREMENTS_MESSAGE } from 'voult-sdk';

if (!isValidPassword(password)) {
  console.log(PASSWORD_REQUIREMENTS_MESSAGE);
  // "Password must be at least 8 characters long and include uppercase, lowercase, number, and special character"
}
```

## API Reference

### VoultClient

The core HTTP client that handles all API communication.

```javascript
import { VoultClient } from 'voult-sdk';

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
import voult from 'voult-sdk';

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
} from 'voult-sdk';
```

## Configuration Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `clientId` | string | Yes | Your application's client ID from Voult dashboard |
| `clientSecret` | string | Yes | Your application's client secret |
| `baseURL` | string | No | API base URL (defaults to `https://api.voult.dev`) |

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

ISC

## Links

- [GitHub Repository](https://github.com/DevOlabode/voult-sdk)
- [Voult API Repository](https://github.com/DevOlabode/voult)
- [Report an Issue](https://github.com/DevOlabode/voult-sdk/issues)