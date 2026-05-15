/**
 * Voult SDK - Authentication made simple
 * @module voult-sdk
 */

export const VERSION = '0.2.0';

export { VoultClient } from './client.js';
export { DEFAULT_BASE_URL, ENDPOINTS } from './constants.js';

export {
  VoultError,
  AuthenticationError,
  ValidationError,
  NetworkError,
  AuthorizationError,
  ConflictError,
  AccountLockedError,
} from './errors.js';

// Sign up
export {
  signUpWithEmailAndPassword,
  signUpWithUsernameAndPassword,
} from './auth/signup.js';

// Sign in
export {
  signInWithEmailAndPassword,
  signInWithUsernameAndPassword,
  signInWithEmailLink,
  verifyEmailLink,
} from './auth/signin.js';

// Sign out / account
export { signOut, deleteUser } from './auth/signout.js';

// Password reset
export { sendPasswordResetEmail, resetPassword } from './auth/password.js';

// Email verification
export { verifyEmail } from './auth/email.js';

// Profile & account status
export {
  getCurrentUser,
  updateProfile,
  reenableAccount,
} from './auth/profile.js';

// Sessions
export {
  refreshSession,
  listSessions,
  revokeSession,
} from './auth/session.js';

// OAuth
export {
  signInWithGoogle,
  signUpWithGoogle,
  signInWithGitHub,
  signUpWithGitHub,
  signInWithFacebook,
  signUpWithFacebook,
  signInWithLinkedIn,
  signUpWithLinkedIn,
  signInWithMicrosoft,
  signUpWithMicrosoft,
  signInWithApple,
  signUpWithApple,
} from './auth/oauth.js';

// OAuth linking
export {
  linkOAuthProvider,
  getLinkedOAuthProviders,
  unlinkOAuthProvider,
  setPassword,
} from './auth/oauthLinking.js';

// Validation
export {
  isValidEmail,
  isValidPassword,
  isValidUsername,
  isValidUrl,
  PASSWORD_REQUIREMENTS_MESSAGE,
} from './utils/validation.js';

// Session persistence
export {
  persistSession,
  restoreSession,
  clearPersistedSession,
  STORAGE_KEY,
} from './utils/storage.js';

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
import { signOut as _signOut, deleteUser as _deleteUser } from './auth/signout.js';
import { sendPasswordResetEmail as _forgotPassword, resetPassword as _resetPassword } from './auth/password.js';
import { verifyEmail as _verifyEmail } from './auth/email.js';
import {
  getCurrentUser as _getCurrentUser,
  updateProfile as _updateProfile,
  reenableAccount as _reenableAccount,
} from './auth/profile.js';
import {
  refreshSession as _refreshSession,
  listSessions as _listSessions,
  revokeSession as _revokeSession,
} from './auth/session.js';
import {
  signInWithGoogle as _googleIn,
  signUpWithGoogle as _googleUp,
  signInWithGitHub as _githubIn,
  signUpWithGitHub as _githubUp,
  signInWithFacebook as _facebookIn,
  signUpWithFacebook as _facebookUp,
  signInWithLinkedIn as _linkedinIn,
  signUpWithLinkedIn as _linkedinUp,
  signInWithMicrosoft as _microsoftIn,
  signUpWithMicrosoft as _microsoftUp,
  signInWithApple as _appleIn,
  signUpWithApple as _appleUp,
} from './auth/oauth.js';
import {
  linkOAuthProvider as _linkOAuth,
  getLinkedOAuthProviders as _getLinkedOAuth,
  unlinkOAuthProvider as _unlinkOAuth,
  setPassword as _setPassword,
} from './auth/oauthLinking.js';
import { persistSession as _persistSession, restoreSession as _restoreSession } from './utils/storage.js';

/**
 * Initialize the Voult SDK
 * @param {Object} config
 * @param {string} config.clientId
 * @param {string} config.clientSecret
 * @param {string} [config.baseURL]
 * @returns {Object} SDK instance
 */
export default function voult(config) {
  const client = new VoultClient(config);

  return {
    client,
    VERSION,

    // Sign up
    signUpWithEmailAndPassword: (email, password, options) =>
      _signupEmail(email, password, options, client),
    signUpWithUsernameAndPassword: (username, password, options) =>
      _signupUsername(username, password, options, client),

    // Sign in
    signInWithEmailAndPassword: (email, password) =>
      _signinEmail(email, password, client),
    signInWithUsernameAndPassword: (username, password) =>
      _signinUsername(username, password, client),
    signInWithEmailLink: (email, options) =>
      _signinLink(email, options, client),
    verifyEmailLink: (token) => _verifyLink(token, client),

    // User
    getCurrentUser: () => _getCurrentUser(client),
    updateProfile: (updates) => _updateProfile(updates, client),
    reenableAccount: () => _reenableAccount(client),

    // Password
    sendPasswordResetEmail: (email) => _forgotPassword(email, client),
    resetPassword: (token, newPassword, options) =>
      _resetPassword(token, newPassword, options, client),

    // Email
    verifyEmail: (token, options) => _verifyEmail(token, options, client),

    // Session
    signOut: () => _signOut(client),
    deleteUser: () => _deleteUser(client),
    refreshSession: () => _refreshSession(client),
    listSessions: () => _listSessions(client),
    revokeSession: (sessionId) => _revokeSession(sessionId, client),

    // OAuth
    signInWithGoogle: (credentials) => _googleIn(credentials, client),
    signUpWithGoogle: (credentials) => _googleUp(credentials, client),
    signInWithGitHub: (credentials) => _githubIn(credentials, client),
    signUpWithGitHub: (credentials) => _githubUp(credentials, client),
    signInWithFacebook: (credentials) => _facebookIn(credentials, client),
    signUpWithFacebook: (credentials) => _facebookUp(credentials, client),
    signInWithLinkedIn: (credentials) => _linkedinIn(credentials, client),
    signUpWithLinkedIn: (credentials) => _linkedinUp(credentials, client),
    signInWithMicrosoft: (credentials) => _microsoftIn(credentials, client),
    signUpWithMicrosoft: (credentials) => _microsoftUp(credentials, client),
    signInWithApple: (credentials) => _appleIn(credentials, client),
    signUpWithApple: (credentials) => _appleUp(credentials, client),

    // OAuth linking
    linkOAuthProvider: (provider) => _linkOAuth(provider, client),
    getLinkedOAuthProviders: () => _getLinkedOAuth(client),
    unlinkOAuthProvider: (provider) => _unlinkOAuth(provider, client),
    setPassword: (password) => _setPassword(password, client),

    // Helpers
    isAuthenticated: () => client.isAuthenticated(),
    persistSession: (storage) => _persistSession(client, storage),
    restoreSession: (storage) => _restoreSession(client, storage),
  };
}
