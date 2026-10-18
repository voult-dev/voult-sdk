/**
 * Input validation utilities for the Voult SDK
 */

import { ValidationError } from '../errors.js';

/**
 * Password rule (Voult API 1.4+, NIST SP 800-63B): 8 to 128 characters, any characters, no
 * composition rules. The API also refuses commonly used passwords; that list stays server-side
 * (it would bloat browser bundles), so the server's WEAK_PASSWORD message says when it applies.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/**
 * Email validation regex
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Username validation regex (3-30 characters, alphanumeric and underscores)
 */
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,30}$/;

/**
 * Password requirements message
 */
export const PASSWORD_REQUIREMENTS_MESSAGE = 'Password must be 8 to 128 characters. Any characters work, including spaces.';

/**
 * Validates an email address format
 * @param {string} email - The email address to validate
 * @returns {boolean} True if email is valid
 */
export function isValidEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }
  return EMAIL_REGEX.test(email.trim());
}

/**
 * Validates a password meets the requirements
 * @param {string} password - The password to validate
 * @returns {boolean} True if password is valid
 */
export function isValidPassword(password) {
  if (!password || typeof password !== 'string') {
    return false;
  }
  const length = [...password].length; // characters, not UTF-16 units
  return length >= PASSWORD_MIN_LENGTH && length <= PASSWORD_MAX_LENGTH;
}

/**
 * Validates email and throws error if invalid
 * @param {string} email - The email to validate
 * @throws {ValidationError} If email is invalid
 */
export function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    throw new ValidationError('Email is required', 'email');
  }
  
  const normalizedEmail = email.trim().toLowerCase();
  if (!isValidEmail(normalizedEmail)) {
    throw new ValidationError('Invalid email format', 'email');
  }
  
  return normalizedEmail;
}

/**
 * Validates password and throws error if invalid
 * @param {string} password - The password to validate
 * @throws {ValidationError} If password is invalid
 */
export function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    throw new ValidationError('Password is required', 'password');
  }
  
  if (!isValidPassword(password)) {
    throw new ValidationError(PASSWORD_REQUIREMENTS_MESSAGE, 'password');
  }
  
  return password;
}

/**
 * Validates a full name
 * @param {string} fullName - The full name to validate
 * @throws {ValidationError} If full name is invalid
 */
export function validateFullName(fullName) {
  if (!fullName || typeof fullName !== 'string') {
    throw new ValidationError('Full name is required', 'fullName');
  }
  
  if (fullName.trim().length === 0) {
    throw new ValidationError('Full name cannot be empty', 'fullName');
  }
  
  return fullName.trim();
}

/**
 * Validates a URL format
 * @param {string} url - The URL to validate
 * @returns {boolean} True if URL is valid
 */
export function isValidUrl(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }
  
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates a token (for magic links, etc.)
 * @param {string} token - The token to validate
 * @throws {ValidationError} If token is invalid
 */
/**
 * @param {string} username
 * @returns {boolean}
 */
export function isValidUsername(username) {
  if (!username || typeof username !== 'string') {
    return false;
  }
  return USERNAME_REGEX.test(username.trim().toLowerCase());
}

/**
 * Validates username and throws error if invalid
 * @param {string} username
 * @returns {string} Normalized username
 */
export function validateUsername(username) {
  if (!username || typeof username !== 'string') {
    throw new ValidationError('Username is required', 'username');
  }

  const normalizedUsername = username.trim().toLowerCase();
  if (!USERNAME_REGEX.test(normalizedUsername)) {
    throw new ValidationError(
      'Username must be 3-30 characters, alphanumeric and underscores only',
      'username'
    );
  }

  return normalizedUsername;
}

/**
 * Validates that a password is present (for sign-in)
 * @param {string} password
 * @returns {string}
 */
export function validatePasswordRequired(password) {
  if (!password || typeof password !== 'string' || password.length === 0) {
    throw new ValidationError('Password is required', 'password');
  }
  return password;
}

/**
 * Validates a token (for magic links, etc.)
 * @param {string} token
 * @throws {ValidationError} If token is invalid
 */
export function validateToken(token) {
  if (!token || typeof token !== 'string') {
    throw new ValidationError('Token is required', 'token');
  }
  
  if (token.trim().length === 0) {
    throw new ValidationError('Token cannot be empty', 'token');
  }
  
  return token.trim();
}