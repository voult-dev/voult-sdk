/**
 * Link / unlink OAuth providers on an authenticated account
 */

import { ENDPOINTS } from '../constants.js';
import { requireAuthenticated } from '../utils/helpers.js';
import { validatePassword } from '../utils/validation.js';
import { ValidationError } from '../errors.js';

const SUPPORTED_PROVIDERS = [
  'google',
  'github',
  'facebook',
  'linkedin',
  'microsoft',
  'apple',
];

function assertProvider(provider) {
  if (!provider || typeof provider !== 'string') {
    throw new ValidationError('OAuth provider is required', 'provider');
  }
  const normalized = provider.toLowerCase();
  if (!SUPPORTED_PROVIDERS.includes(normalized)) {
    throw new ValidationError(
      `Unsupported provider. Use one of: ${SUPPORTED_PROVIDERS.join(', ')}`,
      'provider'
    );
  }
  return normalized;
}

/**
 * Start OAuth linking flow — returns URL to redirect the user to
 * @param {string} provider
 * @param {import('../client.js').VoultClient} client
 */
export async function linkOAuthProvider(provider, client) {
  requireAuthenticated(client);
  const normalized = assertProvider(provider);

  const response = await client.post(
    ENDPOINTS.OAUTH_LINK(normalized),
    {},
    { requireAuth: true }
  );

  return {
    redirectUrl: response.redirectUrl,
  };
}

/**
 * List OAuth providers linked to the current user
 * @param {import('../client.js').VoultClient} client
 */
export async function getLinkedOAuthProviders(client) {
  requireAuthenticated(client);

  try {
    const response = await client.get(ENDPOINTS.OAUTH_ACCOUNTS, { requireAuth: true });
    return { providers: response.providers ?? [] };
  } catch {
    const response = await client.get(ENDPOINTS.OAUTH_ACCOUNTS_ALT, { requireAuth: true });
    return { providers: response.providers ?? [] };
  }
}

/**
 * Unlink an OAuth provider from the current user
 * @param {string} provider
 * @param {import('../client.js').VoultClient} client
 */
export async function unlinkOAuthProvider(provider, client) {
  requireAuthenticated(client);
  const normalized = assertProvider(provider);

  try {
    const response = await client.delete(ENDPOINTS.OAUTH_UNLINK(normalized), {
      requireAuth: true,
    });
    return { success: response.success ?? true };
  } catch {
    const response = await client.delete(ENDPOINTS.OAUTH_UNLINK_ALT(normalized), {
      requireAuth: true,
    });
    return { success: response.success ?? true };
  }
}

/**
 * Set a password on a social-only account
 * @param {string} password
 * @param {import('../client.js').VoultClient} client
 */
export async function setPassword(password, client) {
  requireAuthenticated(client);
  validatePassword(password);

  const response = await client.post(
    ENDPOINTS.SET_PASSWORD,
    { password },
    { requireAuth: true }
  );

  return {
    success: response.success ?? true,
    message: 'Password set successfully',
  };
}
