import test from 'node:test';
import assert from 'node:assert/strict';
import {
  signInWithGoogle,
  signUpWithGoogle,
  signInWithGitHub,
  signUpWithGitHub,
  signInWithFacebook,
  signUpWithFacebook,
  signInWithLinkedIn,
  signUpWithLinkedIn,
  signInWithMicrosoft,
  signUpWithMicrosoft,
  signInWithApple,
  signUpWithApple,
  linkOAuthProvider,
  getLinkedOAuthProviders,
  unlinkOAuthProvider,
  setPassword,
} from '../../src/index.js';
import { VoultClient } from '../../src/client.js';
import { ValidationError } from '../../src/errors.js';
import { startTestServer } from '../support/test-server.js';

function authenticatedClient(baseURL) {
  const client = new VoultClient({ clientId: 'client-id', clientSecret: 'client-secret', baseURL });
  client.setSession({ id: 'user-1', email: 'user@example.com' }, 'access-1', 'refresh-1');
  return client;
}

test('OAuth providers send expected credential shapes and apply auth responses', async (t) => {
  const { server, baseURL, state } = await startTestServer();
  t.after(() => server.close());

  const client = new VoultClient({ clientId: 'client-id', clientSecret: 'client-secret', baseURL });

  await assert.rejects(() => signInWithGoogle({}, client), {
    name: 'ValidationError',
    code: 'VALIDATION_ERROR',
    status: 400,
  });

  const googleIn = await signInWithGoogle({ idToken: 'google-id-token' }, client);
  assert.equal(googleIn.accessToken, 'access-1');
  assert.equal(googleIn.refreshToken, 'refresh-1');
  assert.equal(googleIn.user.email, 'google@example.com');

  const googleUp = await signUpWithGoogle({ accessToken: 'google-access-token' }, client);
  assert.equal(googleUp.user.email, 'google@example.com');

  const githubIn = await signInWithGitHub({ code: 'github-code', redirectUri: 'https://example.com/callback' }, client);
  assert.equal(githubIn.user.email, 'github@example.com');
  assert.deepEqual(state.requests.at(-1).body, { code: 'github-code', redirect_uri: 'https://example.com/callback' });

  const githubUp = await signUpWithGitHub({ code: 'github-code' }, client);
  assert.equal(githubUp.user.email, 'github@example.com');

  const facebookIn = await signInWithFacebook({ accessToken: 'facebook-access-token' }, client);
  assert.equal(facebookIn.user.email, 'facebook@example.com');
  assert.deepEqual(state.requests.at(-1).body, { accessToken: 'facebook-access-token' });

  const facebookUp = await signUpWithFacebook({ accessToken: 'facebook-access-token' }, client);
  assert.equal(facebookUp.user.email, 'facebook@example.com');

  const linkedinIn = await signInWithLinkedIn({ code: 'linkedin-code' }, client);
  assert.equal(linkedinIn.user.email, 'linkedin@example.com');

  const linkedinUp = await signUpWithLinkedIn({ code: 'linkedin-code' }, client);
  assert.equal(linkedinUp.user.email, 'linkedin@example.com');

  const microsoftIn = await signInWithMicrosoft({ code: 'microsoft-code' }, client);
  assert.equal(microsoftIn.user.email, 'microsoft@example.com');

  const microsoftUp = await signUpWithMicrosoft({ code: 'microsoft-code' }, client);
  assert.equal(microsoftUp.user.email, 'microsoft@example.com');

  await assert.rejects(() => signInWithApple({ code: 'apple-code' }, client), {
    name: 'ValidationError',
    code: 'VALIDATION_ERROR',
    status: 400,
  });

  const appleIn = await signInWithApple({ code: 'apple-code', idToken: 'apple-id-token' }, client);
  assert.equal(appleIn.user.email, 'apple@example.com');

  const appleUp = await signUpWithApple({ code: 'apple-code', idToken: 'apple-id-token' }, client);
  assert.equal(appleUp.user.email, 'apple@example.com');
});

test('OAuth linking endpoints require authentication and fall back to alternate paths', async (t) => {
  const { server, baseURL, state } = await startTestServer();
  t.after(() => server.close());

  const client = authenticatedClient(baseURL);

  await assert.rejects(() => linkOAuthProvider('twitter', client), {
    name: 'ValidationError',
    code: 'VALIDATION_ERROR',
    status: 400,
  });

  const linked = await linkOAuthProvider('GOOGLE', client);
  assert.deepEqual(linked, { redirectUrl: 'https://oauth.example.test/link/google' });
  assert.deepEqual(state.requests.at(-1), {
    method: 'POST',
    path: '/api/oauth/google/link',
    query: {},
    body: {},
    headers: state.requests.at(-1).headers,
  });
  assert.equal(state.requests.at(-1).headers.authorization, 'Bearer access-1');

  const providers = await getLinkedOAuthProviders(client);
  assert.deepEqual(providers, { providers: ['google', 'github'] });
  assert.equal(state.requests.at(-1).path, '/api/me/oauth-accounts');

  await linkOAuthProvider('facebook', client);
  state.oauthAccountsPrimaryFails = true;
  const fallbackProviders = await getLinkedOAuthProviders(client);
  assert.deepEqual(fallbackProviders, { providers: ['facebook'] });
  assert.equal(state.requests.at(-1).path, '/api/me/oauth');

  const unlinked = await unlinkOAuthProvider('github', client);
  assert.deepEqual(unlinked, { success: true });
  assert.deepEqual(state.requests.at(-1), {
    method: 'DELETE',
    path: '/api/me/oauth-accounts/github',
    query: {},
    body: {},
    headers: state.requests.at(-1).headers,
  });

  await linkOAuthProvider('facebook', client);
  state.oauthUnlinkPrimaryFails = true;
  const fallbackUnlinked = await unlinkOAuthProvider('facebook', client);
  assert.deepEqual(fallbackUnlinked, { success: true });
  assert.equal(state.requests.at(-1).path, '/api/me/oauth/facebook');

  const passwordSet = await setPassword('StrongPass123!', client);
  assert.deepEqual(passwordSet, {
    success: true,
    message: 'Password set successfully',
  });
  assert.equal(state.requests.at(-1).path, '/api/me/set-password');
  assert.deepEqual(state.requests.at(-1).body, { password: 'StrongPass123!' });

  await assert.rejects(
    () => setPassword('weak', client),
    (error) => error instanceof ValidationError && error.field === 'password'
  );
});
