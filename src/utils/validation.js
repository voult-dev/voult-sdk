/**
 * Input validation utilities for the Voult SDK
 */

import { ValidationError } from '../errors.js';

/**
 * Password validation regex
 * Requirements: Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special character
 */
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

/**
 * Email validation regex
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Password requirements message
 */
export const PASSWORD_REQUIREMENTS_MESSAGE = 
  'Password must be at least 8 characters long and include uppercase, lowercase, number, and special character';

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
  return PASSWORD_REGEX.test(password);
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
export function validateToken(token) {
  if (!token || typeof token !== 'string') {
    throw new ValidationError('Token is required', 'token');
  }
  
  if (token.trim().length === 0) {
    throw new ValidationError('Token cannot be empty', 'token');
  }
  
  return token.trim();
}