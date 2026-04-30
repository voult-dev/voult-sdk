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

The Voult SDK is a JavaScript/TypeScript library that provides a simple, developer-friendly interface to the Voult authentication API. It abstracts away the complexity of HTTP requests, token management, and error handling.

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
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
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
│   ├── index.ts           # Main entry point, exports all functions
│   ├── client.ts          # HTTP client wrapper
│   ├── types.ts           # TypeScript type definitions
│   ├── errors.ts          # Custom error classes
│   ├── constants.ts       # API endpoints, default values
│   ├── auth/
│   │   ├── index.ts       # Auth module exports
│   │   ├── signup.ts      # Sign up functions
│   │   ├── signin.ts      # Sign in functions
│   │   ├── signout.ts     # Sign out function
│   │   ├── delete-user.ts # Delete user function
│   │   └── session.ts     # Session management
│   └── utils/
│       ├── storage.ts     # LocalStorage/SessionStorage helpers
│       └── validation.ts  # Input validation utilities
├── dist/                  # Built output (generated)
├── test/
│   ├── auth.test.ts       # Auth function tests
│   └── client.test.ts     # Client tests
├── .eslintrc.js
├── tsconfig.json
├── vite.config.ts
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

```typescript
// src/client.ts
export class VoultClient {
  private baseURL: string;
  private apiKey: string;
  private appId: string;

  constructor(config: VoultClientConfig) {
    this.baseURL = config.baseURL || 'https://api.voult.com';
    this.apiKey = config.apiKey;
    this.appId = config.appId;
  }

  async request<T>(endpoint: string, options: RequestOptions): Promise<T> {
    // Build URL, headers, body
    // Make request
    // Handle response
    // Throw normalized errors
  }

  get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  post<T>(endpoint: string, body?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'POST', body });
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

## Step 4: Implement Authentication Functions

### 4.1 Sign Up Functions

```typescript
// src/auth/signup.ts

/**
 * Register a new user with username and password
 */
export async function signUpWithUsernameAndPassword(
  username: string,
  password: string,
  client: VoultClient
): Promise<AuthResponse> {
  // Validate username format
  // Validate password strength
  // POST to /auth/signup/username
  // Return user data and tokens
}

/**
 * Register a new user with email and password
 */
export async function signUpWithEmailAndPassword(
  email: string,
  password: string,
  client: VoultClient
): Promise<AuthResponse> {
  // Validate email format
  // Validate password strength
  // POST to /auth/signup/email
  // Return user data and tokens
}
```

### 4.2 Sign In Functions

```typescript
// src/auth/signin.ts

/**
 * Authenticate with username and password
 */
export async function signInWithUsernameAndPassword(
  username: string,
  password: string,
  client: VoultClient
): Promise<AuthResponse> {
  // POST to /auth/signin/username
  // Store tokens in session
  // Return user data
}

/**
 * Authenticate with email and password
 */
export async function signInWithEmailAndPassword(
  email: string,
  password: string,
  client: VoultClient
): Promise<AuthResponse> {
  // POST to /auth/signin/email
  // Store tokens in session
  // Return user data
}
```

### 4.3 Passwordless Sign In

```typescript
// src/auth/signin.ts

/**
 * Send magic link to email
 */
export async function signInWithEmailLink(
  email: string,
  client: VoultClient
): Promise<{ success: boolean; message: string }> {
  // Validate email
  // POST to /auth/magic-link/send
  // Return success confirmation
}

/**
 * Verify magic link token
 */
export async function verifyEmailLink(
  token: string,
  client: VoultClient
): Promise<AuthResponse> {
  // POST to /auth/magic-link/verify
  // Store tokens
  // Return user data
}
```

### 4.4 Sign Out & Delete User

```typescript
// src/auth/signout.ts
export async function signOut(client: VoultClient): Promise<void> {
  // Call API to invalidate token (if needed)
  // Clear local storage
  // Clear session state
}

// src/auth/delete-user.ts
export async function deleteUser(client: VoultClient): Promise<void> {
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

```typescript
// src/errors.ts

export class VoultError extends Error {
  constructor(
    message: string,
    public code: string,
    public status?: number,
    public details?: any
  ) {
    super(message);
    this.name = 'VoultError';
  }
}

export class AuthenticationError extends VoultError {
  constructor(message: string, details?: any) {
    super(message, 'AUTH_ERROR', 401, details);
    this.name = 'AuthenticationError';
  }
}

export class ValidationError extends VoultError {
  constructor(message: string, public field?: string) {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
  }
}

export class NetworkError extends VoultError {
  constructor(message: string) {
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
npm install -D vite @vitejs/plugin-react typescript vitest @vitest/ui
```

### 7.2 Vite Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
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

### 7.3 TypeScript Configuration

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM"],
    "declaration": true,
    "declarationMap": true,
    "outDir": "./dist",
    "strict": true,
    "moduleResolution": "node",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "test"]
}
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

```typescript
// test/auth/signup.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signUpWithEmailAndPassword } from '../../src/auth/signup';

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

## Step 9: Add TypeScript Support

### 9.1 Type Definitions

Define all types in `src/types.ts`:

```typescript
export interface User {
  id: string;
  email?: string;
  username?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

export interface VoultClientConfig {
  apiKey: string;
  appId: string;
  baseURL?: string;
}

export interface SignUpWithEmailParams {
  email: string;
  password: string;
  username?: string;
}

export interface SignUpWithUsernameParams {
  username: string;
  password: string;
  email?: string;
}
```

### 9.2 Generate Declaration Files

Vite/Rollup will generate `.d.ts` files automatically with the `declaration: true` TypeScript setting.

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

```typescript
/**
 * Registers a new user using their email and password.
 *
 * @param email - The user's email address
 * @param password - The user's password (min 8 chars, 1 uppercase, 1 number)
 * @param client - The Voult client instance
 * @returns A promise resolving to the auth response with user data and tokens
 * @throws {ValidationError} If email or password is invalid
 * @throws {AuthenticationError} If email already exists
 *
 * @example
 * ```ts
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
9. **Typing** with TypeScript
10. **Documenting** clearly
11. **Publishing** to npm

Follow this guide step by step to transform the Voult SDK from a concept into a production-ready library.