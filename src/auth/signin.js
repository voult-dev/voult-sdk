/**
 * Sign In functions for the Voult SDK
 * Handles user authentication with email/password, username/password, and magic links
 */

import { validateEmail, validatePassword, validateToken, isValidUrl } from '../utils/validation.js';

/**
 * Username validation regex (3-30 characters, alphanumeric and underscores)
 */
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,30}$/;

/**
 * Validate username format
 * @param {string} username - The username to validate
 * @returns {string} Normalized username
 * @throws {ValidationError} If username is invalid
 */
function validateUsername(username) {
  if (!username || typeof username !== 'string') {
    throw new Error('Username is required');
  }
  
  const normalizedUsername = username.trim().toLowerCase();
  
  if (!USERNAME_REGEX.test(normalizedUsername)) {
    throw new Error('Username must be 3-30 characters, alphanumeric and underscores only');
  }
  
  return normalizedUsername;
}

/**
 * Authenticate a user with email and password
 * 
 * Uses the /api/auth/email-login endpoint.
 * 
 * @param {string} email - The user's email address
 * @param {string} password - The user's password
 * @param {VoultClient} client - The Voult client instance
 * @returns {Promise<Object>} Authentication response with user data and tokens
 * @throws {ValidationError} If email or password is invalid
 * @throws {AuthenticationError} If credentials are invalid
 * @throws {AuthorizationError} If email is not verified or account is disabled
 * @throws {AccountLockedError} If account is locked due to too many failed attempts
 * 
 * @example
 * ```js
 * const { user, accessToken, refreshToken } = await signInWithEmailAndPassword(
 *   'user@example.com',
 *   'StrongPass123!',
 *   client
 * );
 * ```
 */
export async function signInWithEmailAndPassword(email, password, client) {
  // Validate inputs
  const normalizedEmail = validateEmail(email);
  validatePassword(password);
  
  // Make API request to /api/auth/email-login
  const response = await client.post('/api/auth/email-login', {
    email: normalizedEmail,
    password,
  });
  
  // Extract data from response
  const { user, accessToken, refreshToken, message } = response;
  
  // Store session in client
  if (accessToken) {
    client.setSession(user, accessToken, refreshToken || null);
  }
  
  return {
    user,
    accessToken,
    refreshToken,
    message,
  };
}

/**
 * Authenticate a user with username and password
 * 
 * Uses the /api/auth/username-login endpoint.
 * 
 * @param {string} username - The user's username (3-30 chars, alphanumeric and underscores)
 * @param {string} password - The user's password
 * @param {VoultClient} client - The Voult client instance
 * @returns {Promise<Object>} Authentication response with user data and tokens
 * @throws {ValidationError} If username or password is invalid
 * @throws {AuthenticationError} If credentials are invalid
 * @throws {AuthorizationError} If email is not verified or account is disabled
 * @throws {AccountLockedError} If account is locked due to too many failed attempts
 * 
 * @example
 * ```js
 * const { user, accessToken, refreshToken } = await signInWithUsernameAndPassword(
 *   'john_doe',
 *   'StrongPass123!',
 *   client
 * );
 * ```
 */
export async function signInWithUsernameAndPassword(username, password, client) {
  // Validate username
  const normalizedUsername = validateUsername(username);
  
  // Validate password
  validatePassword(password);
  
  // Make API request to /api/auth/username-login
  const response = await client.post('/api/auth/username-login', {
    username: normalizedUsername,
    password,
  });
  
  // Extract data from response
  const { user, accessToken, refreshToken, message } = response;
  
  // Store session in client
  if (accessToken) {
    client.setSession(user, accessToken, refreshToken || null);
  }
  
  return {
    user,
    accessToken,
    refreshToken,
    message,
  };
}

/**
 * Send a magic link to the user's email for passwordless authentication
 * 
 * @param {string} email - The user's email address
 * @param {Object} options - Configuration options
 * @param {string} options.redirectUri - The URL where the user should be redirected after clicking the magic link
 * @param {VoultClient} client - The Voult client instance
 * @returns {Promise<Object>} Response confirming magic link was sent
 * @throws {ValidationError} If email is invalid or redirectUri is missing/invalid
 * @throws {AuthenticationError} If sending fails
 * 
 * @example
 * ```js
 * await signInWithEmailLink(
 *   'user@example.com',
 *   { redirectUri: 'https://myapp.com/callback' },
 *   client
 * );
 * ```
 */
export async function signInWithEmailLink(email, options = {}, client) {
  // Handle function overloading
  if (options && options.constructor.name === 'VoultClient') {
    client = options;
    options = {};
  }
  
  // Validate email
  const normalizedEmail = validateEmail(email);
  
  // Validate redirectUri
  if (!options.redirectUri) {
    throw new Error('redirectUri is required for magic link authentication');
  }
  
  if (!isValidUrl(options.redirectUri)) {
    throw new Error('Invalid redirectUri format. Must be a valid URL.');
  }
  
  // Make API request to send magic link
  const response = await client.post('/api/send-magic-link', {
    email: normalizedEmail,
    clientId: client.clientId,
    redirectUri: options.redirectUri,
  });
  
  return {
    success: response.success,
    message: response.message,
  };
}

/**
 * Verify a magic link token and complete authentication
 * 
 * This function is called after the user clicks the magic link in their email.
 * The token is typically extracted from the URL query parameters.
 * 
 * @param {string} token - The magic link token from the URL
 * @param {VoultClient} client - The Voult client instance
 * @returns {Promise<Object>} Authentication response with user data and tokens
 * @throws {ValidationError} If token is invalid
 * @throws {AuthenticationError} If token is invalid or expired
 * @throws {AuthorizationError} If no account found with the email
 * 
 * @example
 * ```js
 * // After user clicks magic link: https://myapp.com/callback?token=abc123
 * const token = new URLSearchParams(window.location.search).get('token');
 * const { user, accessToken, refreshToken } = await verifyEmailLink(token, client);
 * ```
 */
export async function verifyEmailLink(token, client) {
  // Validate token
  const validToken = validateToken(token);
  
  // Make API request to validate the token
  const response = await client.post('/api/validate-magic-link', {
    token: validToken,
  });
  
  // Extract data from response
  const { user, accessToken, refreshToken, message } = response.data || response;
  
  // Store session in client
  if (accessToken) {
    client.setSession(user, accessToken, refreshToken || null);
  }
  
  return {
    user,
    accessToken,
    refreshToken,
    message,
    success: response.success,
  };
}

/**
 * Get the current user's profile
 * 
 * @param {VoultClient} client - The Voult client instance
 * @returns {Promise<Object>} User profile data
 * @throws {AuthenticationError} If user is not authenticated
 * 
 * @example
 * ```js
 * const profile = await getCurrentUser(client);
 * console.log(profile.email, profile.fullName);
 * ```
 */
export async function getCurrentUser(client) {
  if (!client.isAuthenticated()) {
    throw new Error('No authenticated user. Please sign in first.');
  }
  
  const response = await client.get('/api/user/me', { requireAuth: true });
  return response;
}

/**
 * Resend verification email to the user's email address
 * 
 * This function sends a new verification email to the user.
 * Used when the original verification email was not received or has expired.
 * 
 * @param {string} email - The user's email address
 * @param {VoultClient} client - The Voult client instance
 * @returns {Promise<Object>} Response confirming verification email was sent
 * @throws {ValidationError} If email is invalid
 * @throws {AuthenticationError} If sending fails
 * @throws {ConflictError} If user is already verified
 * 
 * @example
 * ```js
 * const result = await resendVerificationEmail(
 *   'user@example.com',
 *   client
 * );
 * console.log(result.message); // "Verification email sent"
 * ```
 */
export async function resendVerificationEmail(email, client) {
  // Validate email
  const normalizedEmail = validateEmail(email);
  
// Note: Backend doesn't have resend-verification endpoint. Manual resend must be implemented on backend.
  throw new Error('Backend resend-verification endpoint not found. Verification emails are automatically sent during registration.');
}
