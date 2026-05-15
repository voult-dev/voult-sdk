/**
 * Optional session persistence helpers
 */

const STORAGE_KEY = 'voult_sdk_session';

/**
 * @typedef {Object} StoredSession
 * @property {Object} user
 * @property {string} accessToken
 * @property {string|null} refreshToken
 */

/**
 * Save session to a storage adapter
 * @param {import('../client.js').VoultClient} client
 * @param {{ setItem: (key: string, value: string) => void }} storage
 */
export function persistSession(client, storage) {
  if (!storage?.setItem) {
    throw new Error('Storage adapter must implement setItem(key, value)');
  }

  if (!client.isAuthenticated()) {
    storage.setItem(STORAGE_KEY, '');
    return;
  }

  storage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      user: client.user,
      accessToken: client.accessToken,
      refreshToken: client.refreshToken,
    })
  );
}

/**
 * Restore session from a storage adapter
 * @param {import('../client.js').VoultClient} client
 * @param {{ getItem: (key: string) => string|null }} storage
 * @returns {boolean} Whether a session was restored
 */
export function restoreSession(client, storage) {
  if (!storage?.getItem) {
    throw new Error('Storage adapter must implement getItem(key)');
  }

  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) {
    return false;
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed?.accessToken && parsed?.user) {
      client.setSession(parsed.user, parsed.accessToken, parsed.refreshToken ?? null);
      return true;
    }
  } catch {
    storage.setItem(STORAGE_KEY, '');
  }

  return false;
}

/**
 * Clear persisted session
 * @param {{ removeItem: (key: string) => void }} storage
 */
export function clearPersistedSession(storage) {
  storage?.removeItem?.(STORAGE_KEY);
}

export { STORAGE_KEY };
