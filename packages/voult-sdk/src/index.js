/**
 * Voult SDK - Authentication made simple
 * @module voult-sdk
 * @see https://github.com/voult-dev/voult
 */

export const VERSION = '0.3.0';

export { VoultClient } from './client.js';
export { DEFAULT_BASE_URL, ENDPOINTS, OAUTH_PROVIDERS, OAUTH_INTENTS } from './constants.js';

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

// MFA
export {
  verifyMfaLogin,
  getMfaStatus,
  setupMfa,
  enableMfa,
  disableMfa,
  regenerateMfaBackupCodes,
} from './auth/mfa.js';

// WebAuthn / passkeys
export {
  getWebAuthnCompatibility,
  createPasskeyRegistrationOptions,
  verifyPasskeyRegistration,
  createPasskeyLoginOptions,
  verifyPasskeyLogin,
  listPasskeys,
  updatePasskey,
  deletePasskey,
} from './auth/webauthn.js';

// OAuth
export {
  getOAuthAuthorizationUrl,
  signInWithGoogle,
  signUpWithGoogle,
  authenticateWithGoogle,
  signInWithGitHub,
  signUpWithGitHub,
  authenticateWithGitHub,
  signInWithFacebook,
  signUpWithFacebook,
  authenticateWithFacebook,
  signInWithLinkedIn,
  signUpWithLinkedIn,
  authenticateWithLinkedIn,
  signInWithMicrosoft,
  signUpWithMicrosoft,
  authenticateWithMicrosoft,
  signInWithApple,
  signUpWithApple,
  authenticateWithApple,
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

// Helpers
export {
  parseAuthResponse,
  parseMfaChallenge,
  applyAuthResponse,
  resolveClientArg,
} from './utils/helpers.js';

export {
  parseApiErrorResponse,
  extractValidationFields,
  buildRequestContext,
} from './utils/apiError.js';

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
  verifyMfaLogin as _verifyMfaLogin,
  getMfaStatus as _getMfaStatus,
  setupMfa as _setupMfa,
  enableMfa as _enableMfa,
  disableMfa as _disableMfa,
  regenerateMfaBackupCodes as _regenerateMfaBackupCodes,
} from './auth/mfa.js';
import {
  getWebAuthnCompatibility as _getWebAuthnCompatibility,
  createPasskeyRegistrationOptions as _createPasskeyRegistrationOptions,
  verifyPasskeyRegistration as _verifyPasskeyRegistration,
  createPasskeyLoginOptions as _createPasskeyLoginOptions,
  verifyPasskeyLogin as _verifyPasskeyLogin,
  listPasskeys as _listPasskeys,
  updatePasskey as _updatePasskey,
  deletePasskey as _deletePasskey,
} from './auth/webauthn.js';
import {
  getOAuthAuthorizationUrl as _getOAuthAuthorizationUrl,
  signInWithGoogle as _googleIn,
  signUpWithGoogle as _googleUp,
  authenticateWithGoogle as _googleAuth,
  signInWithGitHub as _githubIn,
  signUpWithGitHub as _githubUp,
  authenticateWithGitHub as _githubAuth,
  signInWithFacebook as _facebookIn,
  signUpWithFacebook as _facebookUp,
  authenticateWithFacebook as _facebookAuth,
  signInWithLinkedIn as _linkedinIn,
  signUpWithLinkedIn as _linkedinUp,
  authenticateWithLinkedIn as _linkedinAuth,
  signInWithMicrosoft as _microsoftIn,
  signUpWithMicrosoft as _microsoftUp,
  authenticateWithMicrosoft as _microsoftAuth,
  signInWithApple as _appleIn,
  signUpWithApple as _appleUp,
  authenticateWithApple as _appleAuth,
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
 * @param {string} [config.csrfToken]
 * @param {boolean} [config.useCookies]
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

    // MFA
    verifyMfaLogin: (mfaPendingToken, mfaToken) =>
      _verifyMfaLogin(mfaPendingToken, mfaToken, client),
    getMfaStatus: () => _getMfaStatus(client),
    setupMfa: () => _setupMfa(client),
    enableMfa: (token) => _enableMfa(token, client),
    disableMfa: (password, mfaToken) => _disableMfa(password, mfaToken, client),
    regenerateMfaBackupCodes: (token) => _regenerateMfaBackupCodes(token, client),

    // WebAuthn
    getWebAuthnCompatibility: () => _getWebAuthnCompatibility(client),
    createPasskeyRegistrationOptions: (options) =>
      _createPasskeyRegistrationOptions(options, client),
    verifyPasskeyRegistration: (credential, options) =>
      _verifyPasskeyRegistration(credential, options, client),
    createPasskeyLoginOptions: (options) => _createPasskeyLoginOptions(options, client),
    verifyPasskeyLogin: (credential) => _verifyPasskeyLogin(credential, client),
    listPasskeys: () => _listPasskeys(client),
    updatePasskey: (credentialId, deviceName) =>
      _updatePasskey(credentialId, deviceName, client),
    deletePasskey: (credentialId) => _deletePasskey(credentialId, client),

    // OAuth
    getOAuthAuthorizationUrl: (provider, options) =>
      _getOAuthAuthorizationUrl(provider, options, client),
    signInWithGoogle: (credentials) => _googleIn(credentials, client),
    signUpWithGoogle: (credentials) => _googleUp(credentials, client),
    authenticateWithGoogle: (credentials) => _googleAuth(credentials, client),
    signInWithGitHub: (credentials) => _githubIn(credentials, client),
    signUpWithGitHub: (credentials) => _githubUp(credentials, client),
    authenticateWithGitHub: (credentials) => _githubAuth(credentials, client),
    signInWithFacebook: (credentials) => _facebookIn(credentials, client),
    signUpWithFacebook: (credentials) => _facebookUp(credentials, client),
    authenticateWithFacebook: (credentials) => _facebookAuth(credentials, client),
    signInWithLinkedIn: (credentials) => _linkedinIn(credentials, client),
    signUpWithLinkedIn: (credentials) => _linkedinUp(credentials, client),
    authenticateWithLinkedIn: (credentials) => _linkedinAuth(credentials, client),
    signInWithMicrosoft: (credentials) => _microsoftIn(credentials, client),
    signUpWithMicrosoft: (credentials) => _microsoftUp(credentials, client),
    authenticateWithMicrosoft: (credentials) => _microsoftAuth(credentials, client),
    signInWithApple: (credentials) => _appleIn(credentials, client),
    signUpWithApple: (credentials) => _appleUp(credentials, client),
    authenticateWithApple: (credentials) => _appleAuth(credentials, client),

    // OAuth linking
    linkOAuthProvider: (provider) => _linkOAuth(provider, client),
    getLinkedOAuthProviders: () => _getLinkedOAuth(client),
    unlinkOAuthProvider: (provider) => _unlinkOAuth(provider, client),
    setPassword: (password) => _setPassword(password, client),

    // Helpers
    isAuthenticated: () => client.isAuthenticated(),
    fetchCsrfToken: () => client.fetchCsrfToken(),
    setCsrfToken: (token) => client.setCsrfToken(token),
    persistSession: (storage) => _persistSession(client, storage),
    restoreSession: (storage) => _restoreSession(client, storage),
  };
}
