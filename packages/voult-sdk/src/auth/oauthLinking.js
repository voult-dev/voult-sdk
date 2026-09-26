/**
 * Link / unlink OAuth providers on an authenticated account
 */

import { ENDPOINTS } from '../constants.js';
import { requireAuthenticated, resolveClientArg } from '../utils/helpers.js';
import { assertOAuthRedirect } from './oauth.js';
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
 * Start linking a provider to the signed-in user. Redirect the browser to `authUrl`;
 * Voult returns it to `redirectUri` with `?linked=1&state=…` (or `?error=…`).
 * @param {string} provider
 * @param {Object} options
 * @param {string} options.redirectUri - Your callback URL; must be on the app's allowlist
 * @param {string} [options.state] - Opaque value (≤256 chars) Voult sends back unchanged
 * @param {import('../client.js').VoultClient} client
 */
export async function linkOAuthProvider(provider, options = {}, client) {
  const resolved = resolveClientArg(options, client);
  client = resolved.client;
  options = resolved.options;

  requireAuthenticated(client);
  const normalized = assertProvider(provider);
  assertOAuthRedirect(options);

  const body = { redirectUri: options.redirectUri };
  if (options.state != null) body.state = options.state;

  const response = await client.post(ENDPOINTS.OAUTH_LINK(normalized), body, { requireAuth: true });

  // Voult < Phase 2 answered with `redirectUrl`.
  const authUrl = response.authUrl ?? response.redirectUrl;
  return {
    authUrl,
    /** @deprecated use authUrl */
    redirectUrl: authUrl,
    provider: response.provider ?? normalized,
    intent: 'link',
    expiresInSeconds: response.expiresInSeconds,
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
