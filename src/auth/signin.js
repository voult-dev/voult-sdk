/**
 * Sign In functions for the Voult SDK
 */

import { ENDPOINTS } from '../constants.js';
import {
  validateEmail,
  validatePasswordRequired,
  validateUsername,
  validateToken,
  isValidUrl,
} from '../utils/validation.js';
import { resolveClientArg, applyAuthResponse } from '../utils/helpers.js';
import { ValidationError } from '../errors.js';

/**
 * Authenticate with email and password
 */
export async function signInWithEmailAndPassword(email, password, client) {
  const normalizedEmail = validateEmail(email);
  validatePasswordRequired(password);

  const response = await client.post(ENDPOINTS.EMAIL_LOGIN, {
    email: normalizedEmail,
    password,
  });

  return applyAuthResponse(client, response);
}

/**
 * Authenticate with username and password
 */
export async function signInWithUsernameAndPassword(username, password, client) {
  const normalizedUsername = validateUsername(username);
  validatePasswordRequired(password);

  const response = await client.post(ENDPOINTS.USERNAME_LOGIN, {
    username: normalizedUsername,
    password,
  });

  return applyAuthResponse(client, response);
}

/**
 * Send a magic link to the user's email
 */
export async function signInWithEmailLink(email, options = {}, client) {
  const resolved = resolveClientArg(options, client);
  options = resolved.options;
  client = resolved.client;

  const normalizedEmail = validateEmail(email);

  if (!options.redirectUri) {
    throw new ValidationError('redirectUri is required for magic link authentication', 'redirectUri');
  }

  if (!isValidUrl(options.redirectUri)) {
    throw new ValidationError('Invalid redirectUri format. Must be a valid URL.', 'redirectUri');
  }

  const response = await client.post(ENDPOINTS.SEND_MAGIC_LINK, {
    email: normalizedEmail,
    clientId: client.clientId,
    redirectUri: options.redirectUri,
  });

  return {
    success: response.success ?? true,
    message: response.message,
  };
}

/**
 * Verify a magic link token and complete authentication
 */
export async function verifyEmailLink(token, client) {
  const validToken = validateToken(token);

  const response = await client.post(ENDPOINTS.VALIDATE_MAGIC_LINK, {
    token: validToken,
  });

  const result = applyAuthResponse(client, response);
  return {
    ...result,
    success: response.success ?? true,
  };
}
