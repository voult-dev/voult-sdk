/**
 * User profile and account status
 */

import { ENDPOINTS } from '../constants.js';
import { validateFullName } from '../utils/validation.js';
import { requireAuthenticated, resolveClientArg } from '../utils/helpers.js';
import { AuthenticationError } from '../errors.js';

/**
 * Get the current authenticated user's profile from the API
 * @param {import('../client.js').VoultClient} client
 */
export async function getCurrentUser(client) {
  if (!client.isAuthenticated()) {
    throw new AuthenticationError('No authenticated user. Please sign in first.');
  }

  const profile = await client.get(ENDPOINTS.ME, { requireAuth: true });

  const user = {
    id: profile.id,
    email: profile.email,
    fullName: profile.name ?? profile.fullName,
    isEmailVerified: profile.isEmailVerified,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    isLocked: profile.isLocked,
    lastLoginAt: profile.lastLoginAt,
    app: profile.app,
  };

  client.user = user;
  return user;
}

/**
 * Update the authenticated user's profile
 * @param {Object} updates
 * @param {string} updates.fullName
 * @param {import('../client.js').VoultClient} client
 */
export async function updateProfile(updates = {}, client) {
  const resolved = resolveClientArg(updates, client);
  client = resolved.client;
  updates = resolved.options;

  requireAuthenticated(client);

  const fullName = validateFullName(updates.fullName);

  const response = await client.patch(
    ENDPOINTS.ME,
    { fullName },
    { requireAuth: true }
  );

  if (response.user) {
    client.user = {
      ...client.user,
      ...response.user,
      fullName: response.user.fullName,
    };
  } else if (client.user) {
    client.user = { ...client.user, fullName };
  }

  return {
    success: true,
    message: response.message || 'Profile updated successfully',
    user: response.user ?? client.user,
  };
}

/**
 * Re-enable a previously disabled account (user must be signed in)
 * @param {import('../client.js').VoultClient} client
 */
export async function reenableAccount(client) {
  requireAuthenticated(client);

  const response = await client.post(
    ENDPOINTS.REENABLE_ACCOUNT,
    {},
    { requireAuth: true }
  );

  client.clearSession();

  return {
    success: response.success ?? true,
    message: response.message || 'Account re-enabled successfully. Please log in again.',
  };
}
