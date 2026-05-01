/**
 * Sign Up functions for the Voult SDK
 * Handles user registration with email and password
 */

import { validateEmail, validatePassword, validateFullName } from '../utils/validation.js';

/**
 * Register a new user with email and password
 * 
 * @param {string} email - The user's email address
 * @param {string} password - The user's password (must meet complexity requirements)
 * @param {Object} options - Optional parameters
 * @param {string} options.fullName - The user's full name
 * @param {VoultClient} client - The Voult client instance
 * @returns {Promise<Object>} Registration response with user data and token
 * @throws {ValidationError} If email or password is invalid
 * @throws {ConflictError} If user with email already exists
 * @throws {AuthenticationError} If registration fails
 * 
 * @example
 * ```js
 * const { user, token } = await signUpWithEmailAndPassword(
 *   'user@example.com',
 *   'StrongPass123!',
 *   { fullName: 'John Doe' },
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
  
  // Prepare request body
  const requestBody = {
    email: normalizedEmail,
    password,
  };
  
  if (fullName) {
    requestBody.fullName = fullName;
  }
  
  // Make API request
  const response = await client.post('/api/auth/register', requestBody);
  
  // Extract user data and token
  const { user, token, message } = response;
  
  // Store session in client
  if (token) {
    client.setSession(user, token, null);
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
 * Note: The current Voult API uses email-based registration.
 * This function maps username to email format if needed.
 * 
 * @param {string} username - The user's username (will be used as email if no @ symbol)
 * @param {string} password - The user's password (must meet complexity requirements)
 * @param {Object} options - Optional parameters
 * @param {string} options.fullName - The user's full name
 * @param {string} options.email - The user's actual email (if different from username)
 * @param {VoultClient} client - The Voult client instance
 * @returns {Promise<Object>} Registration response with user data and token
 * @throws {ValidationError} If username or password is invalid
 * @throws {ConflictError} If user already exists
 * @throws {AuthenticationError} If registration fails
 * 
 * @example
 * ```js
 * // Using username that will be converted to email
 * const { user, token } = await signUpWithUsernameAndPassword(
 *   'john.doe',
 *   'StrongPass123!',
 *   { email: 'john@example.com', fullName: 'John Doe' },
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
  
  // Validate password
  validatePassword(password);
  
  // The Voult API requires email for registration
  // If an email is provided in options, use it; otherwise, the username should be an email
  let email;
  if (options.email) {
    email = validateEmail(options.email);
  } else {
    // Treat username as email
    email = validateEmail(username);
  }
  
  const fullName = options.fullName ? validateFullName(options.fullName) : undefined;
  
  // Prepare request body
  const requestBody = {
    email,
    password,
  };
  
  if (fullName) {
    requestBody.fullName = fullName;
  }
  
  // Make API request
  const response = await client.post('/api/auth/register', requestBody);
  
  // Extract user data and token
  const { user, token, message } = response;
  
  // Store session in client
  if (token) {
    client.setSession(user, token, null);
  }
  
  return {
    user,
    token,
    message,
  };
}