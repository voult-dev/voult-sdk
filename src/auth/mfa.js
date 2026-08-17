/**
 * Multi-factor authentication (MFA) flows
 */

import { ENDPOINTS } from '../constants.js';
import { requireAuthenticated, applyAuthResponse, resolveClientArg } from '../utils/helpers.js';
import { ValidationError } from '../errors.js';

function normalizeMfaToken(mfaToken, field = 'mfaToken') {
  if (!mfaToken || typeof mfaToken !== 'string') {
    throw new ValidationError('MFA token is required', field);
  }

  const stripped = mfaToken.trim().replace(/\s+/g, '');

  if (/^\d{6}$/.test(stripped)) {
    return stripped;
  }

  if (/^[A-Fa-f0-9]{8}$/.test(stripped)) {
    return stripped.toUpperCase();
  }

  throw new ValidationError(
    'MFA token must be a 6-digit authenticator code or 8-character backup code',
    field
  );
}

function validateEnrollmentToken(token) {
  const normalized = normalizeMfaToken(token, 'token');
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

  const normalizedToken = normalizeMfaToken(mfaToken);

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

  const normalizedToken = normalizeMfaToken(mfaToken);

  const body = { mfaToken: normalizedToken };
  if (typeof password === 'string' && password.length > 0) {
    body.password = password;
  }

  const response = await client.post(
    ENDPOINTS.MFA_DISABLE,
    body,
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
