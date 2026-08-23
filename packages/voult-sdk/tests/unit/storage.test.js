import test from 'node:test';
import assert from 'node:assert/strict';
import { VoultClient } from '../../src/client.js';
import {
  persistSession,
  restoreSession,
  clearPersistedSession,
  STORAGE_KEY,
} from '../../src/utils/storage.js';

class MemoryStorage {
  constructor() {
    this.store = new Map();
  }

  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }

  setItem(key, value) {
    this.store.set(key, value);
  }

  removeItem(key) {
    this.store.delete(key);
  }
}

test('persists authenticated sessions and clears unauthenticated sessions', () => {
  const client = new VoultClient({ clientId: 'client-id', clientSecret: 'client-secret' });
  const storage = new MemoryStorage();

  persistSession(client, storage);
  assert.equal(storage.getItem(STORAGE_KEY), '');

  client.setSession({ id: 'user-1', email: 'user@example.com' }, 'access-1', 'refresh-1');
  persistSession(client, storage);

  assert.deepEqual(JSON.parse(storage.getItem(STORAGE_KEY)), {
    user: { id: 'user-1', email: 'user@example.com' },
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
  });
});

test('restores sessions and clears invalid persisted JSON', () => {
  const client = new VoultClient({ clientId: 'client-id', clientSecret: 'client-secret' });
  const storage = new MemoryStorage();

  assert.equal(restoreSession(client, storage), false);

  storage.setItem(STORAGE_KEY, 'not-json');
  assert.equal(restoreSession(client, storage), false);
  assert.equal(storage.getItem(STORAGE_KEY), '');

  storage.setItem(STORAGE_KEY, JSON.stringify({
    user: { id: 'user-1', email: 'user@example.com' },
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
  }));

  assert.equal(restoreSession(client, storage), true);
  assert.equal(client.isAuthenticated(), true);
  assert.deepEqual(client.getCurrentUser(), { id: 'user-1', email: 'user@example.com' });
});

test('requires storage adapter methods and clears persisted sessions', () => {
  const client = new VoultClient({ clientId: 'client-id', clientSecret: 'client-secret' });
  const storage = new MemoryStorage();

  assert.throws(() => persistSession(client, {}), {
    message: 'Storage adapter must implement setItem(key, value)',
  });

  assert.throws(() => restoreSession(client, {}), {
    message: 'Storage adapter must implement getItem(key)',
  });

  storage.setItem(STORAGE_KEY, 'session');
  clearPersistedSession(storage);
  assert.equal(storage.getItem(STORAGE_KEY), null);
});
