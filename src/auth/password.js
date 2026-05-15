/**
 * Password reset flows
 */

import { ENDPOINTS } from '../constants.js';
import {
  validateEmail,
  validatePassword,
  validateToken,
} from '../utils/validation.js';
import { ValidationError } from '../errors.js';

/**
 * Request a password reset email
 * @param {string} email
 * @param {import('../client.js').VoultClient} client
 */
export async function sendPasswordResetEmail(email, client) {
  const normalizedEmail = validateEmail(email);

  const response = await client.post(
    ENDPOINTS.FORGOT_PASSWORD,
    { email: normalizedEmail },
    { includeClientSecret: true }
  );

  return {
    success: true,
    message: response.message || 'If that email exists, a reset link has been sent',
  };
}

/**
 * Reset password using token from email link
 * @param {string} token - Reset token from email URL
 * @param {string} newPassword
 * @param {Object} options
 * @param {string} options.appId - Application ID from reset URL
 * @param {import('../client.js').VoultClient} client
 */
export async function resetPassword(token, newPassword, options = {}, client) {
  if (options?.constructor?.name === 'VoultClient') {
    client = options;
    options = {};
  }

  const validToken = validateToken(token);
  validatePassword(newPassword);

  const appId = options.appId;
  if (!appId || typeof appId !== 'string') {
    throw new ValidationError('appId is required (from the reset link query string)', 'appId');
  }

  const response = await client.post(
    ENDPOINTS.RESET_PASSWORD,
    { password: newPassword },
    {
      params: { token: validToken, appId },
      includeClientSecret: true,
    }
  );

  return {
    success: true,
    message: response.message || 'Password reset successful',
  };
}
