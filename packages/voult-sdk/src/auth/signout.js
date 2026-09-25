/**
 * Sign out and account deletion
 */

import { ENDPOINTS } from '../constants.js';
import { requireAuthenticated } from '../utils/helpers.js';

/**
 * Log out the current user
 * @param {import('../client.js').VoultClient} client
 */
export async function signOut(client) {
  if (!client.isAuthenticated()) {
    client.clearSession();
    return {
      success: true,
      message: 'User was not logged in',
    };
  }

  let response;
  try {
    response = await client.post(ENDPOINTS.LOGOUT, {}, { requireAuth: true });
  } catch (err) {
    client.clearSession();
    // A dead token means there's nothing left to revoke. Anything else (5xx,
    // network) means the server-side session may still be live — surface it.
    if (err?.status === 401 || err?.status === 403 || err?.name === 'AuthenticationError') {
      return {
        success: true,
        message: 'Logged out successfully',
        warning: 'Remote token invalid/expired; local session cleared.',
      };
    }
    throw err;
  }

  client.clearSession();

  return {
    success: true,
    message: response?.message || 'Logged out successfully',
  };
}

/**
 * Disable/delete the current user's account
 * @param {import('../client.js').VoultClient} client
 */
export async function deleteUser(client) {
  requireAuthenticated(client);

  const response = await client.post(ENDPOINTS.DISABLE_ACCOUNT, {}, { requireAuth: true });

  client.clearSession();

  return {
    success: response.success ?? true,
    message: response.message || 'Account disabled successfully',
  };
}
