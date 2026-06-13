/**
 * Shared helpers for SDK auth modules
 */

import { AuthenticationError, ValidationError } from '../errors.js';
import { VoultClient } from '../client.js';

/**
 * Resolve optional-parameter overload where `client` may be passed as third arg.
 * @param {Object} options
 * @param {VoultClient} client
 * @returns {{ options: Object, client: VoultClient }}
 */
export function resolveClientArg(options = {}, client) {
  if (client && client.constructor?.name === 'VoultClient') {
    return { options: options || {}, client };
  }
  if (options && options.constructor?.name === 'VoultClient') {
    return { options: {}, client: options };
  }
  throw new ValidationError('Voult client instance is required', 'client');
}

/**
 * @param {VoultClient} client
 */
export function requireAuthenticated(client) {
  if (!client?.isAuthenticated?.()) {
    throw new AuthenticationError('No authenticated user. Please sign in first.');
  }
}

/**
 * Normalize auth API responses and persist session on the client.
 * @param {VoultClient} client
 * @param {Object} response
 * @returns {Object}
 */
export function applyAuthResponse(client, response) {
  const payload = response?.data ?? response;
  const user = payload?.user ?? response?.user;
  const accessToken = payload?.accessToken ?? response?.accessToken ?? response?.token;
  const refreshToken = payload?.refreshToken ?? response?.refreshToken ?? null;

  if (accessToken && user) {
    client.setSession(user, accessToken, refreshToken);
  }

  return {
    user,
    accessToken,
    refreshToken,
    token: accessToken,
    message: payload?.message ?? response?.message,
    success: payload?.success ?? response?.success,
  };
}

/**
 * @param {string} provider
 * @param {Object} credentials
 */
export function assertOAuthCredential(provider, credentials) {
  if (!credentials || typeof credentials !== 'object') {
    throw new ValidationError(`${provider} credentials are required`, 'credentials');
  }
}
