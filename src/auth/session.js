/**
 * Session listing, refresh, and revocation
 */

import { ENDPOINTS } from '../constants.js';
import { requireAuthenticated } from '../utils/helpers.js';
import { ValidationError } from '../errors.js';

/**
 * Refresh the access token using a stored refresh token
 * @param {import('../client.js').VoultClient} client
 */
export async function refreshSession(client) {
  const data = await client.refreshSession();
  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    user: client.getCurrentUser(),
  };
}

/**
 * List active sessions for the authenticated user
 * @param {import('../client.js').VoultClient} client
 */
export async function listSessions(client) {
  requireAuthenticated(client);

  const response = await client.get(ENDPOINTS.SESSIONS, { requireAuth: true });
  return {
    sessions: response.sessions ?? [],
  };
}

/**
 * Revoke a specific session by ID
 * @param {string} sessionId
 * @param {import('../client.js').VoultClient} client
 */
export async function revokeSession(sessionId, client) {
  requireAuthenticated(client);

  if (!sessionId || typeof sessionId !== 'string') {
    throw new ValidationError('Session ID is required', 'sessionId');
  }

  const response = await client.get(ENDPOINTS.SESSION_REVOKE(sessionId), {
    requireAuth: true,
  });

  return {
    success: true,
    message: response.message || 'Session revoked successfully',
  };
}
