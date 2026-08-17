/**
 * Email verification
 */

import { ENDPOINTS } from '../constants.js';
import { validateToken } from '../utils/validation.js';
import { ValidationError } from '../errors.js';

/**
 * Verify a user's email using the token from the verification link
 * @param {string} token - Verification token from email URL
 * @param {Object} options
 * @param {string} options.appId - Application ID from verification URL
 * @param {import('../client.js').VoultClient} client
 */
export async function verifyEmail(token, options = {}, client) {
  if (options?.constructor?.name === 'VoultClient') {
    client = options;
    options = {};
  }

  const validToken = validateToken(token);
  const appId = options.appId;

  if (!appId || typeof appId !== 'string') {
    throw new ValidationError(
      'appId is required (from the verification link query string)',
      'appId'
    );
  }

  const response = await client.get(ENDPOINTS.VERIFY_EMAIL, {
    params: { token: validToken, appId },
    includeClientSecret: false,
  });

  if (client.user) {
    client.user = { ...client.user, isEmailVerified: true };
  }

  return {
    success: true,
    message: response.message || 'Email verified successfully',
  };
}
