/**
 * API and app discovery (used by `voult doctor` and @voult/express)
 */

import { ENDPOINTS } from '../constants.js';

/**
 * Public API info: `{ version, minSdkVersion, features }`. No credentials needed.
 * @param {import('../client.js').VoultClient} client
 */
export async function getApiMeta(client) {
  return client.get(ENDPOINTS.META, { includeClientSecret: false });
}

/**
 * The calling app's configuration — needs the client secret, so server-side only.
 * Returns `{ name, clientId, allowedCallbackUrls, providers }` where each provider is
 * `{ enabled, configured, providerCallbackUrl }`. Never includes secrets.
 * @param {import('../client.js').VoultClient} client
 */
export async function getAppInfo(client) {
  return client.get(ENDPOINTS.APP_INFO, { includeClientSecret: true });
}
