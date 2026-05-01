# Voult SDK Development Guide

This guide outlines the complete steps to build a professional-grade SDK for the Voult authentication API. It is based on the existing project structure, the planned features in `src/index.js`, and the development mindmap.

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Step 1: Understand Real SDKs](#step-1-understand-real-sdks)
4. [Step 2: Set Up Project Structure](#step-2-set-up-project-structure)
5. [Step 3: Build the API Client Layer](#step-3-build-the-api-client-layer)
6. [Step 4: Implement Authentication Functions](#step-4-implement-authentication-functions)
7. [Step 5: Implement Session Management](#step-5-implement-session-management)
8. [Step 6: Add Error Handling](#step-6-add-error-handling)
9. [Step 7: Configure Build & Bundling](#step-7-configure-build--bundling)
10. [Step 8: Write Tests](#step-8-write-tests)
11. [Step 9: Add TypeScript Support](#step-9-add-typescript-support)
12. [Step 10: Documentation](#step-10-documentation)
13. [Step 11: Publish to npm](#step-11-publish-to-npm)

---

## Overview

The Voult SDK is a JavaScript library that provides a simple, developer-friendly interface to the Voult authentication API. It abstracts away the complexity of HTTP requests, token management, and error handling.

### Planned Features (from `src/index.js`)

**Password Authentication:**
- `signUpWithUsernameAndPassword` - Register with username + password
- `signUpWithEmailAndPassword` - Register with email + password
- `signInWithUsernameAndPassword` - Login with username + password
- `signInWithEmailAndPassword` - Login with email + password

**Passwordless Authentication:**
- `signInWithEmailLink` - Magic link authentication

**Session Management:**
- `signOut` - Clear session and logout
- `deleteUser` - Delete user account

---

## Prerequisites

Before building the SDK, ensure you have:

- **Node.js** (v18+) and **npm** installed
- Access to the **Voult API** (base URL, API endpoints)
- Understanding of the **API contract** (request/response formats)
- An **npm account** for publishing

---

## Step 1: Understand Real SDKs

Study established SDKs to understand best practices:

### Stripe SDK
- **Clean API design** with method chaining
- **Consistent naming conventions**
- **Comprehensive error messages**

### Firebase SDK
- **Modular architecture** (tree-shakeable)
- **Auth state persistence**
- **Observer patterns** for auth state changes

### Clerk SDK
- **Developer experience (DX) focused**
- **Hidden complexity** with simple interfaces
- **TypeScript-first approach**

---

## Step 2: Set Up Project Structure

### 2.1 Initialize the Project

```bash
npm init -y
```

### 2.2 Update `package.json`

Configure the package for both ESM and CommonJS:

```json
{
  "name": "voult-sdk",
  "version": "0.1.0",
  "description": "Official SDK for Voult Authentication API",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  },
  "type": "module",
  "files": ["dist"],
  "scripts": {
    "build": "vite build",
    "test": "vitest",
    "lint": "eslint src/",
    "prepublishOnly": "npm run build"
  },
  "keywords": ["auth", "authentication", "voult", "sdk"],
  "author": "Your Name",
  "license": "MIT"
}
```

### 2.3 Recommended Directory Structure

```
voult-sdk/
├── src/
│   ├── index.js           # Main entry point, exports all functions and initializes SDK
│   ├── client.js          # HTTP client wrapper
│   ├── types.js           # JSDoc type definitions
│   ├── errors.js          # Custom error classes
│   ├── constants.js       # API endpoints, default values
│   ├── auth/
│   │   ├── index.js       # Auth module exports
│   │   ├── signup.js      # Sign up functions
│   │   ├── signin.js      # Sign in functions
│   │   ├── signout.js     # Sign out function
│   │   ├── delete-user.js # Delete user function
│   │   └── session.js     # Session management
│   └── utils/
│       ├── storage.js     # LocalStorage/SessionStorage helpers
│       └── validation.js  # Input validation utilities
├── dist/                  # Built output (generated)
├── test/
│   ├── auth.test.js       # Auth function tests
│   └── client.test.js     # Client tests
├── .eslintrc.js
├── vite.config.js
└── package.json
```

---

## Step 3: Build the API Client Layer

The client layer handles all HTTP communication with the Voult API.

### 3.1 Create the HTTP Client

Key responsibilities:
- Wrap `fetch` or `axios` for consistent API calls
- Inject headers (API key, appId, tokens)
- Handle request/response transformation
- Normalize errors

### 3.2 Example Client Structure

```javascript
// src/client.js
export class VoultClient {
  constructor(config) {
    this.baseURL = config.baseURL || 'https://api.voult.com';
    this.apiKey = config.apiKey;
    this.appId = config.appId;
  }

  /**
   * Make an HTTP request to the Voult API
   * @param {string} endpoint - API endpoint path
   * @param {Object} options - Request options (method, body, headers)
   * @returns {Promise<any>} Response data
   */
  async request(endpoint, options = {}) {
    const { method = 'GET', body, headers = {} } = options;
    
    const url = `${this.baseURL}${endpoint}`;
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'X-API-Key': this.apiKey,
      'X-App-Id': this.appId,
    };

    const response = await fetch(url, {
      method,
      headers: { ...defaultHeaders, ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
      throw this.handleError(response.status, data);
    }

    return data;
  }

  /**
   * Make a GET request
   * @param {string} endpoint - API endpoint path
   * @param {Object} options - Request options
   * @returns {Promise<any>} Response data
   */
  async get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  /**
   * Make a POST request
   * @param {string} endpoint - API endpoint path
   * @param {Object} body - Request body
   * @param {Object} options - Request options
   * @returns {Promise<any>} Response data
   */
  async post(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'POST', body });
  }

  /**
   * Handle API errors
   * @private
   */
  handleError(status, data) {
    // Error handling logic here
  }
}
```

### 3.3 Header Injection

Always include:
- `Content-Type: application/json`
- `X-API-Key` or `Authorization` header
- `X-App-Id` for app identification
- `X-Request-ID` for tracing

---

### What Goes in `src/index.js` (Main Entry Point)

The `src/index.js` file is the main entry point for your SDK. It serves several critical purposes:

#### 1. Re-export All Public Functions

```javascript
// src/index.js

// Export the main client class
export { VoultClient } from './client.js';

// Export all auth functions
export {
  signUpWithUsernameAndPassword,
  signUpWithEmailAndPassword,
} from './auth/signup.js';

export {
  signInWithUsernameAndPassword,
  signInWithEmailAndPassword,
  signInWithEmailLink,
  verifyEmailLink,
} from './auth/signin.js';

export { signOut } from './auth/signout.js';
export { deleteUser } from './auth/delete-user.js';

// Export error classes
export {
  VoultError,
  AuthenticationError,
  ValidationError,
  NetworkError,
} from './errors.js';
```

#### 2. Create a Default Export (Optional but Recommended)

Provide a convenient default export that initializes the SDK:

```javascript
// src/index.js

import { VoultClient } from './client.js';

// Default export - initialize with config
export default function voult(config) {
  const client = new VoultClient(config);
  
  // Return an object with all methods bound to the client
  return {
    client,
    signUpWithUsernameAndPassword: (username, password) => 
      signUpWithUsernameAndPassword(username, password, client),
    signUpWithEmailAndPassword: (email, password) => 
      signUpWithEmailAndPassword(email, password, client),
    signInWithUsernameAndPassword: (username, password) => 
      signInWithUsernameAndPassword(username, password, client),
    signInWithEmailAndPassword: (email, password) => 
      signInWithEmailAndPassword(email, password, client),
    signInWithEmailLink: (email) => 
      signInWithEmailLink(email, client),
    verifyEmailLink: (token) => 
      verifyEmailLink(token, client),
    signOut: () => signOut(client),
    deleteUser: () => deleteUser(client),
  };
}
```

#### 3. Usage Examples

With the above setup, developers can use your SDK in two ways:

**Option A: Named Imports (Tree-shakeable)**
```javascript
import { VoultClient, signInWithEmailAndPassword } from 'voult-sdk';

const client = new VoultClient({ apiKey: 'your-key', appId: 'your-app-id' });
const { user } = await signInWithEmailAndPassword('user@example.com', 'password', client);
```

**Option B: Default Export (Convenient)**
```javascript
import voult from 'voult-sdk';

const auth = voult({ apiKey: 'your-key', appId: 'your-app-id' });
const { user } = await auth.signInWithEmailAndPassword('user@example.com', 'password');
```

#### 4. Version Export

Export the SDK version for debugging:

```javascript
// src/index.js
export const VERSION = '1.0.0'; // Or import from package.json
```

#### 5. Complete `src/index.js` Example

```javascript
// src/index.js

/**
 * Voult SDK - Authentication made simple
 * @module voult-sdk
 */

// Version
export const VERSION = '1.0.0';

// Core client
export { VoultClient } from './client.js';

// Auth functions
export {
  signUpWithUsernameAndPassword,
  signUpWithEmailAndPassword,
} from './auth/signup.js';

export {
  signInWithUsernameAndPassword,
  signInWithEmailAndPassword,
  signInWithEmailLink,
  verifyEmailLink,
} from './auth/signin.js';

export { signOut } from './auth/signout.js';
export { deleteUser } from './auth/delete-user.js';

// Error classes
export {
  VoultError,
  AuthenticationError,
  ValidationError,
  NetworkError,
} from './errors.js';

// Default export for convenient usage
import { VoultClient } from './client.js';
import {
  signUpWithUsernameAndPassword as _signupUsername,
  signUpWithEmailAndPassword as _signupEmail,
} from './auth/signup.js';
import {
  signInWithUsernameAndPassword as _signinUsername,
  signInWithEmailAndPassword as _signinEmail,
  signInWithEmailLink as _signinLink,
  verifyEmailLink as _verifyLink,
} from './auth/signin.js';
import { signOut as _signOut } from './auth/signout.js';
import { deleteUser as _deleteUser } from './auth/delete-user.js';

/**
 * Initialize the Voult SDK
 * @param {Object} config - Configuration options
 * @param {string} config.apiKey - Your API key
 * @param {string} config.appId - Your application ID
 * @param {string} [config.baseURL] - Optional API base URL
 * @returns {Object} SDK instance with all methods
 */
export default function voult(config) {
  const client = new VoultClient(config);

  return {
    client,
    VERSION,
    
    // Auth methods
    signUpWithUsernameAndPassword: (username, password) => 
      _signupUsername(username, password, client),
    signUpWithEmailAndPassword: (email, password) => 
      _signupEmail(email, password, client),
    signInWithUsernameAndPassword: (username, password) => 
      _signinUsername(username, password, client),
    signInWithEmailAndPassword: (email, password) => 
      _signinEmail(email, password, client),
    signInWithEmailLink: (email) => 
      _signinLink(email, client),
    verifyEmailLink: (token) => 
      _verifyLink(token, client),
    signOut: () => _signOut(client),
    deleteUser: () => _deleteUser(client),
  };
}
```

---

## Step 4: Implement Authentication Functions

### 4.1 Sign Up Functions

```javascript
// src/auth/signup.js

/**
 * Register a new user with username and password
 * @param {string} username - The user's username
 * @param {string} password - The user's password
 * @param {VoultClient} client - The Voult client instance
 * @returns {Promise<Object>} User data and tokens
 */
export async function signUpWithUsernameAndPassword(username, password, client) {
  // Validate username format
  // Validate password strength
  // POST to /auth/signup/username
  // Return user data and tokens
}

/**
 * Register a new user with email and password
 * @param {string} email - The user's email address
 * @param {string} password - The user's password
 * @param {VoultClient} client - The Voult client instance
 * @returns {Promise<Object>} User data and tokens
 */
export async function signUpWithEmailAndPassword(email, password, client) {
  // Validate email format
  // Validate password strength
  // POST to /auth/signup/email
  // Return user data and tokens
}
```

### 4.2 Sign In Functions

```javascript
// src/auth/signin.js

/**
 * Authenticate with username and password
 * @param {string} username - The user's username
 * @param {string} password - The user's password
 * @param {VoultClient} client - The Voult client instance
 * @returns {Promise<Object>} User data and tokens
 */
export async function signInWithUsernameAndPassword(username, password, client) {
  // POST to /auth/signin/username
  // Store tokens in session
  // Return user data
}

/**
 * Authenticate with email and password
 * @param {string} email - The user's email address
 * @param {string} password - The user's password
 * @param {VoultClient} client - The Voult client instance
 * @returns {Promise<Object>} User data and tokens
 */
export async function signInWithEmailAndPassword(email, password, client) {
  // POST to /auth/signin/email
  // Store tokens in session
  // Return user data
}
```

### 4.3 Passwordless Sign In

```javascript
// src/auth/signin.js

/**
 * Send magic link to email
 * @param {string} email - The user's email address
 * @param {VoultClient} client - The Voult client instance
 * @returns {Promise<Object>} Success confirmation
 */
export async function signInWithEmailLink(email, client) {
  // Validate email
  // POST to /auth/magic-link/send
  // Return success confirmation
}

/**
 * Verify magic link token
 * @param {string} token - The magic link token
 * @param {VoultClient} client - The Voult client instance
 * @returns {Promise<Object>} User data and tokens
 */
export async function verifyEmailLink(token, client) {
  // POST to /auth/magic-link/verify
  // Store tokens
  // Return user data
}
```

### 4.4 Sign Out & Delete User

```javascript
// src/auth/signout.js

/**
 * Sign out the current user
 * @param {VoultClient} client - The Voult client instance
 * @returns {Promise<void>}
 */
export async function signOut(client) {
  // Call API to invalidate token (if needed)
  // Clear local storage
  // Clear session state
}

// src/auth/delete-user.js

/**
 * Delete the current user's account
 * @param {VoultClient} client - The Voult client instance
 * @returns {Promise<void>}
 */
export async function deleteUser(client) {
  // DELETE /auth/user
  // Clear local storage
  // Clear session state
}
```

---

## Step 5: Implement Session Management

### 5.1 Token Storage

Store tokens securely:
- **Access Token**: In memory (for security) or localStorage (for persistence)
- **Refresh Token**: In httpOnly cookie (if backend supports) or localStorage
- **User Data**: In memory or localStorage

### 5.2 Session Restoration

On SDK initialization:
1. Check localStorage for existing tokens
2. Validate token expiration
3. Attempt refresh if expired
4. Restore user session if valid

### 5.3 Session Events

Provide callbacks for:
- `onAuthStateChanged` - When user logs in/out
- `onTokenRefresh` - When tokens are refreshed
- `onSessionExpired` - When session can't be refreshed

---

## Step 6: Add Error Handling

### 6.1 Custom Error Classes

```javascript
// src/errors.js

/**
 * Base error class for all Voult SDK errors
 */
export class VoultError extends Error {
  constructor(message, code, status, details) {
    super(message);
    this.name = 'VoultError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/**
 * Error thrown when authentication fails
 */
export class AuthenticationError extends VoultError {
  constructor(message, details) {
    super(message, 'AUTH_ERROR', 401, details);
    this.name = 'AuthenticationError';
  }
}

/**
 * Error thrown when input validation fails
 */
export class ValidationError extends VoultError {
  constructor(message, field) {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
    this.field = field;
  }
}

/**
 * Error thrown when network request fails
 */
export class NetworkError extends VoultError {
  constructor(message) {
    super(message, 'NETWORK_ERROR');
    this.name = 'NetworkError';
  }
}
```

### 6.2 Error Response Mapping

Map API error responses to custom errors:
- `400` → `ValidationError`
- `401` → `AuthenticationError`
- `403` → `PermissionDeniedError`
- `404` → `NotFoundError`
- `429` → `RateLimitError`
- `5xx` → `ServerError`

---

## Step 7: Configure Build & Bundling

### 7.1 Install Build Tools

```bash
npm install -D vite vitest @vitest/ui
```

### 7.2 Vite Configuration

```javascript
// vite.config.js
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.js'),
      name: 'VoultSDK',
      fileName: (format) => `index.${format === 'es' ? 'js' : 'cjs'}`,
    },
    rollupOptions: {
      external: [], // External dependencies
      output: {
        globals: {},
      },
    },
    sourcemap: true,
    minify: false, // Keep readable for debugging
  },
});
```

### 7.3 ESLint Configuration (for JavaScript)

```javascript
// .eslintrc.js
module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    // Add your preferred rules here
  },
};
```

---

## Step 8: Write Tests

### 8.1 Unit Tests

Test individual functions in isolation:
- Input validation
- Error handling
- Token storage

### 8.2 Integration Tests

Test API interactions:
- Mock the HTTP client
- Test full auth flows
- Test session restoration

### 8.3 Example Test Structure

```javascript
// test/auth/signup.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signUpWithEmailAndPassword } from '../../src/auth/signup.js';

describe('signUpWithEmailAndPassword', () => {
  it('should reject invalid email', async () => {
    // Test validation
  });

  it('should reject weak passwords', async () => {
    // Test password validation
  });

  it('should call API with correct payload', async () => {
    // Test API call
  });
});
```

---

## Step 9: Add JSDoc Type Annotations

### 9.1 Type Definitions with JSDoc

Define all types using JSDoc comments in `src/types.js`:

```javascript
// src/types.js

/**
 * @typedef {Object} User
 * @property {string} id - Unique user identifier
 * @property {string} [email] - User's email address
 * @property {string} [username] - User's username
 * @property {string} createdAt - Account creation timestamp
 * @property {string} updatedAt - Last update timestamp
 */

/**
 * @typedef {Object} AuthResponse
 * @property {User} user - The authenticated user
 * @property {string} accessToken - JWT access token
 * @property {string} [refreshToken] - JWT refresh token
 * @property {number} expiresIn - Token expiration time in seconds
 */

/**
 * @typedef {Object} VoultClientConfig
 * @property {string} apiKey - API key for authentication
 * @property {string} appId - Application identifier
 * @property {string} [baseURL] - API base URL (defaults to https://api.voult.com)
 */

/**
 * @typedef {Object} SignUpWithEmailParams
 * @property {string} email - User's email address
 * @property {string} password - User's password
 * @property {string} [username] - Optional username
 */

/**
 * @typedef {Object} SignUpWithUsernameParams
 * @property {string} username - User's username
 * @property {string} password - User's password
 * @property {string} [email] - Optional email address
 */
```

### 9.2 Benefits of JSDoc

- IDE autocomplete and type checking in VS Code
- No build step required for type definitions
- Works natively in JavaScript files
- Can generate documentation with JSDoc tools

---

## Step 10: Documentation

### 10.1 README.md

Create a comprehensive README with:
- Installation instructions
- Quick start guide
- API reference
- Examples for each auth method
- Configuration options
- Error handling guide

### 10.2 JSDoc Comments

Add JSDoc to all exported functions:

```javascript
/**
 * Registers a new user using their email and password.
 *
 * @param {string} email - The user's email address
 * @param {string} password - The user's password (min 8 chars, 1 uppercase, 1 number)
 * @param {VoultClient} client - The Voult client instance
 * @returns {Promise<AuthResponse>} Auth response with user data and tokens
 * @throws {ValidationError} If email or password is invalid
 * @throws {AuthenticationError} If email already exists
 *
 * @example
 * ```js
 * const { user, accessToken } = await signUpWithEmailAndPassword(
 *   'user@example.com',
 *   'StrongPass123',
 *   client
 * );
 * ```
 */
```

---

## Step 11: Publish to npm

### 11.1 Pre-Publish Checklist

- [ ] All tests passing
- [ ] Build completes without errors
- [ ] README is complete
- [ ] LICENSE file exists
- [ ] `.npmignore` or `files` field in package.json
- [ ] Version is updated

### 11.2 Publish Commands

```bash
# Login to npm
npm login

# Build the package
npm run build

# Publish (use --access public for scoped packages)
npm publish --access public
```

### 11.3 Version Management

Follow [Semantic Versioning](https://semver.org/):
- `MAJOR.MINOR.PATCH`
- Breaking changes → Major version bump
- New features → Minor version bump
- Bug fixes → Patch version bump

---

## Summary

Building a professional SDK involves:

1. **Understanding** established SDK patterns
2. **Structuring** the project for scalability
3. **Implementing** a robust API client
4. **Building** all planned auth functions
5. **Managing** sessions securely
6. **Handling** errors gracefully
7. **Bundling** for multiple environments
8. **Testing** thoroughly
9. **Adding JSDoc types** for IDE support
10. **Documenting** clearly
11. **Publishing** to npm

Follow this guide step by step to transform the Voult SDK from a concept into a production-ready library.
