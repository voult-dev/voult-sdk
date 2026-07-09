/**
 * WebAuthn / passkey authentication
 */

import { ENDPOINTS } from '../constants.js';
import {
  requireAuthenticated,
  applyAuthResponse,
  resolveClientArg,
} from '../utils/helpers.js';
import { validateEmail } from '../utils/validation.js';
import { ValidationError } from '../errors.js';

/**
 * Check browser/passkey compatibility and RP configuration.
 * @param {import('../client.js').VoultClient} client
 */
export async function getWebAuthnCompatibility(client) {
  const response = await client.get(ENDPOINTS.WEBAUTHN_COMPATIBILITY);

  return {
    ...response,
  };
}

/**
 * Begin passkey registration for the authenticated user.
 * @param {Object} [options]
 * @param {string} [options.deviceName]
 * @param {import('../client.js').VoultClient} client
 */
export async function createPasskeyRegistrationOptions(options = {}, client) {
  const resolved = resolveClientArg(options, client);
  client = resolved.client;
  options = resolved.options;

  requireAuthenticated(client);

  const response = await client.post(
    ENDPOINTS.WEBAUTHN_REGISTER_OPTIONS,
    { deviceName: options.deviceName },
    { requireAuth: true }
  );

  return {
    message: response.message,
    options: response.options,
    deviceName: response.deviceName,
  };
}

/**
 * Complete passkey registration with the browser credential.
 * @param {Object} credential - WebAuthn registration credential from the browser
 * @param {Object} [options]
 * @param {string} [options.deviceName]
 * @param {import('../client.js').VoultClient} client
 */
export async function verifyPasskeyRegistration(credential, options = {}, client) {
  const resolved = resolveClientArg(options, client);
  client = resolved.client;
  options = resolved.options;

  requireAuthenticated(client);

  if (!credential || typeof credential !== 'object') {
    throw new ValidationError('WebAuthn credential is required', 'credential');
  }

  const response = await client.post(
    ENDPOINTS.WEBAUTHN_REGISTER_VERIFY,
    { credential, deviceName: options.deviceName },
    { requireAuth: true }
  );

  return {
    message: response.message || 'Passkey registered successfully',
    credential: response.credential,
  };
}

/**
 * Begin passkey sign-in.
 * @param {Object} [options]
 * @param {string} [options.email] - Optional email hint for discoverable credentials
 * @param {import('../client.js').VoultClient} client
 */
export async function createPasskeyLoginOptions(options = {}, client) {
  const resolved = resolveClientArg(options, client);
  client = resolved.client;
  options = resolved.options;

  const body = {};
  if (options.email) {
    body.email = validateEmail(options.email);
  }

  const response = await client.post(ENDPOINTS.WEBAUTHN_LOGIN_OPTIONS, body);

  return {
    message: response.message,
    options: response.options,
  };
}

/**
 * Complete passkey sign-in with the browser credential.
 * @param {Object} credential - WebAuthn authentication credential from the browser
 * @param {import('../client.js').VoultClient} client
 */
export async function verifyPasskeyLogin(credential, client) {
  if (!credential || typeof credential !== 'object') {
    throw new ValidationError('WebAuthn credential is required', 'credential');
  }

  const response = await client.post(ENDPOINTS.WEBAUTHN_LOGIN_VERIFY, { credential });

  return applyAuthResponse(client, response);
}

/**
 * List registered passkeys for the authenticated user.
 * @param {import('../client.js').VoultClient} client
 */
export async function listPasskeys(client) {
  requireAuthenticated(client);

  const response = await client.get(ENDPOINTS.WEBAUTHN_CREDENTIALS, { requireAuth: true });

  return {
    credentials: response.credentials ?? [],
  };
}

/**
 * Rename a registered passkey.
 * @param {string} credentialId
 * @param {string} deviceName
 * @param {import('../client.js').VoultClient} client
 */
export async function updatePasskey(credentialId, deviceName, client) {
  requireAuthenticated(client);

  if (!credentialId || typeof credentialId !== 'string') {
    throw new ValidationError('Credential ID is required', 'credentialId');
  }

  if (!deviceName || typeof deviceName !== 'string' || !deviceName.trim()) {
    throw new ValidationError('Device name is required', 'deviceName');
  }

  const response = await client.patch(
    ENDPOINTS.WEBAUTHN_CREDENTIAL(credentialId),
    { deviceName: deviceName.trim() },
    { requireAuth: true }
  );

  return {
    message: response.message || 'Passkey updated successfully',
    credential: response.credential,
  };
}

/**
 * Delete a registered passkey.
 * @param {string} credentialId
 * @param {import('../client.js').VoultClient} client
 */
export async function deletePasskey(credentialId, client) {
  requireAuthenticated(client);

  if (!credentialId || typeof credentialId !== 'string') {
    throw new ValidationError('Credential ID is required', 'credentialId');
  }

  const response = await client.delete(ENDPOINTS.WEBAUTHN_CREDENTIAL(credentialId), {
    requireAuth: true,
  });

  return {
    success: true,
    message: response.message || 'Passkey deleted successfully',
  };
}
