/**
 * Multi-factor authentication (MFA) flows
 */

import { ENDPOINTS } from '../constants.js';
import { requireAuthenticated, applyAuthResponse, resolveClientArg } from '../utils/helpers.js';
import { ValidationError } from '../errors.js';

function validateMfaToken(mfaToken, field = 'mfaToken') {
  if (!mfaToken || typeof mfaToken !== 'string') {
    throw new ValidationError('MFA token is required', field);
  }

  const normalized = mfaToken.trim();
  if (normalized.length < 6 || normalized.length > 16) {
    throw new ValidationError('MFA token must be 6-16 characters', field);
  }

  return normalized;
}

function validateEnrollmentToken(token) {
  const normalized = validateMfaToken(token, 'token');
  if (!/^\d{6}$/.test(normalized)) {
    throw new ValidationError('Enrollment token must be a 6-digit code', 'token');
  }
  return normalized;
}

/**
 * Complete login after password auth when MFA is required.
 * @param {string} mfaPendingToken
 * @param {string} mfaToken - 6-digit TOTP or backup code
 * @param {import('../client.js').VoultClient} client
 */
export async function verifyMfaLogin(mfaPendingToken, mfaToken, client) {
  if (!mfaPendingToken || typeof mfaPendingToken !== 'string') {
    throw new ValidationError('MFA pending token is required', 'mfaPendingToken');
  }

  const normalizedToken = validateMfaToken(mfaToken);

  const response = await client.post(ENDPOINTS.MFA_VERIFY, {
    mfaPendingToken,
    mfaToken: normalizedToken,
  });

  return applyAuthResponse(client, response);
}

/**
 * Get MFA status for the authenticated user.
 * @param {import('../client.js').VoultClient} client
 */
export async function getMfaStatus(client) {
  requireAuthenticated(client);

  const response = await client.get(ENDPOINTS.MFA_STATUS, { requireAuth: true });

  return {
    mfaEnabled: Boolean(response.mfaEnabled),
    mfaEnabledAt: response.mfaEnabledAt ?? null,
    backupCodesRemaining: response.backupCodesRemaining ?? 0,
  };
}

/**
 * Start MFA enrollment — returns QR code and backup codes.
 * @param {import('../client.js').VoultClient} client
 */
export async function setupMfa(client) {
  requireAuthenticated(client);

  const response = await client.post(ENDPOINTS.MFA_SETUP, {}, { requireAuth: true });

  return {
    message: response.message,
    qrCode: response.qrCode,
    secret: response.secret,
    backupCodes: response.backupCodes ?? [],
  };
}

/**
 * Confirm MFA enrollment with a TOTP code from the authenticator app.
 * @param {string} token - 6-digit TOTP code
 * @param {import('../client.js').VoultClient} client
 */
export async function enableMfa(token, client) {
  requireAuthenticated(client);

  const normalizedToken = validateEnrollmentToken(token);

  const response = await client.post(
    ENDPOINTS.MFA_ENABLE,
    { token: normalizedToken },
    { requireAuth: true }
  );

  return {
    success: true,
    mfaEnabled: response.mfaEnabled ?? true,
    message: response.message || 'MFA enabled successfully',
  };
}

/**
 * Disable MFA for the authenticated user.
 * @param {string} password
 * @param {string} mfaToken
 * @param {import('../client.js').VoultClient} client
 */
export async function disableMfa(password, mfaToken, client) {
  requireAuthenticated(client);

  if (!password || typeof password !== 'string') {
    throw new ValidationError('Password is required', 'password');
  }

  const normalizedToken = validateMfaToken(mfaToken);

  const response = await client.post(
    ENDPOINTS.MFA_DISABLE,
    { password, mfaToken: normalizedToken },
    { requireAuth: true }
  );

  return {
    success: true,
    mfaEnabled: response.mfaEnabled ?? false,
    message: response.message || 'MFA disabled successfully',
  };
}

/**
 * Regenerate MFA backup codes (requires current TOTP).
 * @param {string} token - 6-digit TOTP code
 * @param {import('../client.js').VoultClient} client
 */
export async function regenerateMfaBackupCodes(token, client) {
  requireAuthenticated(client);

  const normalizedToken = validateEnrollmentToken(token);

  const response = await client.post(
    ENDPOINTS.MFA_REGENERATE_BACKUP_CODES,
    { token: normalizedToken },
    { requireAuth: true }
  );

  return {
    message: response.message || 'Backup codes regenerated successfully',
    backupCodes: response.backupCodes ?? [],
  };
}
