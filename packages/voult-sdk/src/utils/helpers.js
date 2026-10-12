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
// Set on every VoultClient. A class-name check breaks once a bundler minifies the code (Next.js
// production builds), and `instanceof` breaks with two copies of the SDK; a registry symbol
// survives both.
export const VOULT_CLIENT = Symbol.for('@voult/sdk.client');

/** @returns {boolean} true for a VoultClient, minified or from another copy of the SDK */
export function isVoultClient(value) {
  return Boolean(value && value[VOULT_CLIENT] === true);
}

export function resolveClientArg(options = {}, client) {
  if (isVoultClient(client)) {
    return { options: options || {}, client };
  }
  if (isVoultClient(options)) {
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
 * Normalize auth API responses without mutating client session.
 * @param {Object} response
 * @returns {Object}
 */
export function parseAuthResponse(response) {
  const payload = response?.data ?? response;
  const user = payload?.user ?? response?.user;
  const accessToken =
    payload?.accessToken ?? response?.accessToken ?? response?.token ?? undefined;
  const refreshToken = payload?.refreshToken ?? response?.refreshToken ?? undefined;

  const result = {
    user,
    accessToken,
    refreshToken,
    token: accessToken,
    message: payload?.message ?? response?.message,
  };

  const success = payload?.success ?? response?.success;
  if (success != null) {
    result.success = success;
  }

  const emailVerificationRequired =
    response?.emailVerificationRequired ?? payload?.emailVerificationRequired;
  if (emailVerificationRequired != null) {
    result.emailVerificationRequired = emailVerificationRequired;
  }

  return result;
}

/**
 * Returns MFA challenge payload when login requires a second factor.
 * @param {Object} response
 * @returns {Object|null}
 */
export function parseMfaChallenge(response) {
  if (!response?.mfaRequired) {
    return null;
  }

  return {
    mfaRequired: true,
    mfaPendingToken: response.mfaPendingToken,
    message: response.message,
  };
}

/**
 * Normalize auth API responses and persist session on the client.
 * @param {VoultClient} client
 * @param {Object} response
 * @returns {Object}
 */
export function applyAuthResponse(client, response) {
  const mfaChallenge = parseMfaChallenge(response);
  if (mfaChallenge) {
    return mfaChallenge;
  }

  const parsed = parseAuthResponse(response);

  if (parsed.accessToken && parsed.user) {
    client.setSession(parsed.user, parsed.accessToken, parsed.refreshToken);
  }

  return parsed;
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
