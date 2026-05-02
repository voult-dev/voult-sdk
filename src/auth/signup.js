/**
 * Sign Up functions for the Voult SDK
 * Handles user registration with email/password and username/password
 */

import { validateEmail, validatePassword, validateFullName } from '../utils/validation.js';

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
 * Register a new user with email and password
 * 
 * This endpoint registers a user with email as the primary identifier.
 * Username is optional.
 * 
 * @param {string} email - The user's email address
 * @param {string} password - The user's password (must meet complexity requirements)
 * @param {Object} options - Optional parameters
 * @param {string} options.fullName - The user's full name
 * @param {string} options.username - Optional username (3-30 chars, alphanumeric and underscores)
 * @param {VoultClient} client - The Voult client instance
 * @returns {Promise<Object>} Registration response with user data and token
 * @throws {ValidationError} If email or password is invalid
 * @throws {ConflictError} If user with email already exists
 * @throws {AuthenticationError} If registration fails
 * 
 * @example
 * ```js
 * // Register with email only
 * const { user, token } = await signUpWithEmailAndPassword(
 *   'user@example.com',
 *   'StrongPass123!',
 *   { fullName: 'John Doe' },
 *   client
 * );
 * 
 * // Register with email and username
 * const { user, token } = await signUpWithEmailAndPassword(
 *   'user@example.com',
 *   'StrongPass123!',
 *   { fullName: 'John Doe', username: 'john_doe' },
 *   client
 * );
 * ```
 */
export async function signUpWithEmailAndPassword(email, password, options = {}, client) {
  // Handle function overloading - if options is the client, shift parameters
  if (options && options.constructor.name === 'VoultClient') {
    client = options;
    options = {};
  }
  
  // Validate inputs
  const normalizedEmail = validateEmail(email);
  validatePassword(password);
  
  const fullName = options.fullName ? validateFullName(options.fullName) : undefined;
  const username = options.username ? validateUsername(options.username) : undefined;
  
  // Prepare request body
  const requestBody = {
    email: normalizedEmail,
    password,
  };
  
  if (fullName) {
    requestBody.fullName = fullName;
  }
  
  if (username) {
    requestBody.username = username;
  }
  
// Make API request to /api/auth/register
  const response = await client.post('/api/auth/register', requestBody);
  
  // Extract user data and token
  const { user, token, message } = response;
  
  // Store session in client
  if (token) {
    client.setSession(user, token, null);
  }
  
  // Send verification email automatically after successful registration
  try {
    await client.post('/api/auth/resend-verification', {
      email: normalizedEmail,
    });
  } catch (verificationError) {
    // Log but don't fail the signup if verification email fails
    console.warn('Failed to send verification email:', verificationError.message);
  }
  
  return {
    user,
    token,
    message,
  };
}

/**
 * Register a new user with username and password
 * 
 * This endpoint registers a user with username as the primary identifier.
 * Email is optional.
 * 
 * @param {string} username - The user's username (3-30 chars, alphanumeric and underscores)
 * @param {string} password - The user's password (must meet complexity requirements)
 * @param {Object} options - Optional parameters
 * @param {string} options.fullName - The user's full name
 * @param {string} options.email - Optional email address
 * @param {VoultClient} client - The Voult client instance
 * @returns {Promise<Object>} Registration response with user data and token
 * @throws {ValidationError} If username or password is invalid
 * @throws {ConflictError} If username or email already exists
 * @throws {AuthenticationError} If registration fails
 * 
 * @example
 * ```js
 * // Register with username only
 * const { user, token } = await signUpWithUsernameAndPassword(
 *   'john_doe',
 *   'StrongPass123!',
 *   { fullName: 'John Doe' },
 *   client
 * );
 * 
 * // Register with username and email
 * const { user, token } = await signUpWithUsernameAndPassword(
 *   'john_doe',
 *   'StrongPass123!',
 *   { fullName: 'John Doe', email: 'john@example.com' },
 *   client
 * );
 * ```
 */
export async function signUpWithUsernameAndPassword(username, password, options = {}, client) {
  // Handle function overloading
  if (options && options.constructor.name === 'VoultClient') {
    client = options;
    options = {};
  }
  
  // Validate username
  const normalizedUsername = validateUsername(username);
  
  // Validate password
  validatePassword(password);
  
  const fullName = options.fullName ? validateFullName(options.fullName) : undefined;
  const email = options.email ? validateEmail(options.email) : undefined;
  
  // Prepare request body
  const requestBody = {
    username: normalizedUsername,
    password,
  };
  
  if (fullName) {
    requestBody.fullName = fullName;
  }
  
  if (email) {
    requestBody.email = email;
  }
  
// Make API request to /api/auth/username-register
  const response = await client.post('/api/auth/username-register', requestBody);
  
  // Extract user data and token
  const { user, token, message } = response;
  
  // Store session in client
  if (token) {
    client.setSession(user, token, null);
  }
  
  // Send verification email automatically if email was provided
  if (email) {
    try {
      await client.post('/api/auth/resend-verification', {
        email: email,
      });
    } catch (verificationError) {
      // Log but don't fail the signup if verification email fails
      console.warn('Failed to send verification email:', verificationError.message);
    }
  }
  
  return {
    user,
    token,
    message,
  };
}
