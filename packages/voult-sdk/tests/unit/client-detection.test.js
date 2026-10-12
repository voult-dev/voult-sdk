import assert from 'node:assert/strict';
import test from 'node:test';
import { VoultClient, resetPassword, resolveClientArg } from '../../src/index.js';

// Bundlers minify class names (Next.js production builds), so SDK functions must recognise a
// client without relying on `constructor.name === 'VoultClient'`.
test('a client whose class name was minified is still recognised', async () => {
  class a extends VoultClient {}
  const client = new a({ clientId: 'id', clientSecret: 'secret', baseURL: 'http://127.0.0.1:9' });
  assert.equal(client.constructor.name, 'a');
  assert.equal(resolveClientArg({ x: 1 }, client).client, client);
  assert.equal(resolveClientArg(client).client, client);
  // resetPassword's (options, client) overload also accepts the client in the options slot
  await assert.rejects(() => resetPassword('token', 'StrongPass123!', client), (err) => err.name !== 'ValidationError' || err.field !== 'client');
});

test('plain objects are not clients, and the brand stays out of JSON', () => {
  assert.throws(() => resolveClientArg({}, { constructor: { name: 'VoultClient' } }), /client instance is required/);
  const client = new VoultClient({ clientId: 'id', clientSecret: 'secret' });
  assert.deepEqual(Object.keys(JSON.parse(JSON.stringify({ clientId: client.clientId }))), ['clientId']);
  assert.equal(Object.getOwnPropertySymbols(client).length, 1);
});
