/**
 * Voult SDK - Authentication made simple
 * 
 * Official JavaScript SDK for the Voult Authentication and Authorization API.
 * Provides a simple, developer-friendly interface for user authentication,
 * including password-based and passwordless authentication methods.
 * 
 * @module voult-sdk
 * @version 1.0.0
 * 
 * @example
 * ```js
 * import voult from 'voult-sdk';
 * 
 * // Initialize the SDK
 * const auth = voult({
 *   clientId: 'your-client-id',
 *   clientSecret: 'your-client-secret',
 * });
 * 
 * // Sign up a new user
 * const { user, token } = await auth.signUpWithEmailAndPassword(
 *   'user@example.com',
 *   'StrongPass123!'
 * );
 * 
 * // Sign in
 * const { user, accessToken } = await auth.signInWithEmailAndPassword(
 *   'user@example.com',
 *   'StrongPass123!'
 * );
 * 
 * // Sign out
 * await auth.signOut();
 * ```
 */

// Version
export const VERSION = '0.1.0';

// Core client
export { VoultClient } from './client.js';

// Error classes
export {
  VoultError,
  AuthenticationError,
  ValidationError,
  NetworkError,
  AuthorizationError,
  ConflictError,
  AccountLockedError,
} from './errors.js';

// Sign up functions
export {
  signUpWithEmailAndPassword,
  signUpWithUsernameAndPassword,
} from './auth/signup.js';

// Sign in functions
export {
  signInWithEmailAndPassword,
  signInWithUsernameAndPassword,
  signInWithEmailLink,
  verifyEmailLink,
  getCurrentUser,
} from './auth/signin.js';

// Sign out functions
export {
  signOut,
  deleteUser,
} from './auth/signout.js';

// Validation utilities
export {
  isValidEmail,
  isValidPassword,
  isValidUrl,
  PASSWORD_REQUIREMENTS_MESSAGE,
} from './utils/validation.js';

// Import all functions for default export
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
  getCurrentUser as _getCurrentUser,
} from './auth/signin.js';
import {
  signOut as _signOut,
  deleteUser as _deleteUser,
} from './auth/signout.js';

/**
 * Initialize the Voult SDK
 * 
 * @param {Object} config - Configuration options
 * @param {string} config.clientId - Your application's client ID
 * @param {string} config.clientSecret - Your application's client secret
 * @param {string} [config.baseURL] - Optional API base URL (defaults to https://api.voult.dev)
 * @returns {Object} SDK instance with all authentication methods
 * 
 * @example
 * ```js
 * import voult from 'voult-sdk';
 * 
 * const auth = voult({
 *   clientId: 'app_abc123',
 *   clientSecret: 'secret_xyz789',
 *   baseURL: 'https://api.voult.dev' // optional
 * });
 * 
 * // Now you can use all auth methods
 * await auth.signUpWithEmailAndPassword('user@example.com', 'StrongPass123!');
 * await auth.signInWithEmailAndPassword('user@example.com', 'StrongPass123!');
 * await auth.signOut();
 * ```
 */
export default function voult(config) {
  const client = new VoultClient(config);
  
  return {
    // Client instance
    client,
    
    // SDK version
    VERSION,
    
    // Sign up methods
    signUpWithEmailAndPassword: (email, password, options) =>
      _signupEmail(email, password, options, client),
    
    signUpWithUsernameAndPassword: (username, password, options) =>
      _signupUsername(username, password, options, client),
    
    // Sign in methods
    signInWithEmailAndPassword: (email, password) =>
      _signinEmail(email, password, client),
    
    signInWithUsernameAndPassword: (username, password) =>
      _signinUsername(username, password, client),
    
    signInWithEmailLink: (email, options) =>
      _signinLink(email, options, client),
    
    verifyEmailLink: (token) =>
      _verifyLink(token, client),
    
    // User methods
    getCurrentUser: () =>
      _getCurrentUser(client),
    
    signOut: () =>
      _signOut(client),
    
    deleteUser: () =>
      _deleteUser(client),
    
    // Session helpers
    isAuthenticated: () =>
      client.isAuthenticated(),
  };
}