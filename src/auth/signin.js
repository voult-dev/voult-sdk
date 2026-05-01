/**
 * Sign In functions for the Voult SDK
 * Handles user authentication with email/password and magic links
 */

import { validateEmail, validatePassword, validateToken, isValidUrl } from '../utils/validation.js';

/**
 * Authenticate a user with email and password
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
  
  // Make API request
  const response = await client.post('/api/auth/login', {
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
 * Note: The Voult API uses email-based authentication.
 * This function treats the username as an email address.
 * 
 * @param {string} username - The user's username (must be a valid email format)
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
 *   'user@example.com',
 *   'StrongPass123!',
 *   client
 * );
 * ```
 */
export async function signInWithUsernameAndPassword(username, password, client) {
  // Validate password
  validatePassword(password);
  
  // Treat username as email (Voult API requires email)
  const normalizedEmail = validateEmail(username);
  
  // Make API request
  const response = await client.post('/api/auth/login', {
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
  
  const response = await client.get('/api/me', { requireAuth: true });
  return response;
}