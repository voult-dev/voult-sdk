import test from 'node:test';
import assert from 'node:assert/strict';
import voult from '../../src/index.js';
import {
  persistSession,
  restoreSession,
  clearPersistedSession,
  STORAGE_KEY,
} from '../../src/utils/storage.js';
import { startTestServer } from '../support/test-server.js';

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

test('session persistence can be restored into a fresh SDK client', async (t) => {
  const { server, baseURL } = await startTestServer();
  t.after(() => server.close());

  const auth = voult({ clientId: 'client-id', clientSecret: 'client-secret', baseURL });
  const storage = new MemoryStorage();

  assert.equal(persistSession(auth.client, storage), undefined);
  assert.equal(storage.getItem(STORAGE_KEY), '');

  await auth.signInWithEmailAndPassword('user@example.com', 'password');
  persistSession(auth.client, storage);

  const restored = JSON.parse(storage.getItem(STORAGE_KEY));
  assert.equal(restored.accessToken, 'access-1');
  assert.equal(restored.refreshToken, 'refresh-1');
  assert.equal(restored.user.email, 'user@example.com');

  const restoredClient = voult({ clientId: 'client-id', clientSecret: 'client-secret', baseURL }).client;
  assert.equal(restoreSession(restoredClient, storage), true);
  assert.equal(restoredClient.isAuthenticated(), true);
  assert.deepEqual(restoredClient.getCurrentUser(), restored.user);

  clearPersistedSession(storage);
  assert.equal(storage.getItem(STORAGE_KEY), null);
});
