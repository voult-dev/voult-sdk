import test from 'node:test';
import assert from 'node:assert/strict';
import {
  signUpWithEmailAndPassword,
  signUpWithUsernameAndPassword,
} from '../../src/auth/signup.js';
import {
  signInWithEmailAndPassword,
  signInWithUsernameAndPassword,
  signInWithEmailLink,
  verifyEmailLink,
} from '../../src/auth/signin.js';
import { signOut, deleteUser } from '../../src/auth/signout.js';
import { sendPasswordResetEmail, resetPassword } from '../../src/auth/password.js';
import { verifyEmail } from '../../src/auth/email.js';
import {
  getCurrentUser,
  updateProfile,
  reenableAccount,
} from '../../src/auth/profile.js';
import {
  refreshSession,
  listSessions,
  revokeSession,
} from '../../src/auth/session.js';
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
} from '../../src/auth/oauth.js';
import {
  linkOAuthProvider,
  getLinkedOAuthProviders,
  unlinkOAuthProvider,
  setPassword,
} from '../../src/auth/oauthLinking.js';
import {
  verifyMfaLogin,
  getMfaStatus,
  setupMfa,
  enableMfa,
  disableMfa,
  regenerateMfaBackupCodes,
} from '../../src/auth/mfa.js';
import {
  getWebAuthnCompatibility,
  createPasskeyRegistrationOptions,
  verifyPasskeyRegistration,
  createPasskeyLoginOptions,
  verifyPasskeyLogin,
  listPasskeys,
  updatePasskey,
  deletePasskey,
} from '../../src/auth/webauthn.js';
import { getOAuthAuthorizationUrl } from '../../src/auth/oauth.js';
import { ENDPOINTS } from '../../src/constants.js';
import { VoultClient } from '../../src/client.js';
import { AuthenticationError, ValidationError } from '../../src/errors.js';

function createFakeClient() {
  const calls = [];
  const client = {
    user: null,
    accessToken: null,
    refreshToken: null,
    clientId: 'client-id',
    calls,
    isAuthenticated() {
      return !!this.accessToken && !!this.user;
    },
    setSession(user, accessToken, refreshToken) {
      this.user = user;
      this.accessToken = accessToken;
      this.refreshToken = refreshToken;
    },
    clearSession() {
      this.user = null;
      this.accessToken = null;
      this.refreshToken = null;
    },
    getCurrentUser() {
      return this.user;
    },
    async post(endpoint, body, options = {}) {
      calls.push({ method: 'post', endpoint, body, options });
      if (endpoint === ENDPOINTS.REGISTER || endpoint === ENDPOINTS.USERNAME_REGISTER) {
        return {
          message: 'ok',
          accessToken: 'access-1',
          refreshToken: 'refresh-1',
          emailVerificationRequired: true,
          user: {
            id: 'user-1',
            email: body.email,
            username: body.username,
          },
        };
      }
      if (endpoint === ENDPOINTS.EMAIL_LOGIN && body.email === 'mfa@example.com') {
        return {
          mfaRequired: true,
          mfaPendingToken: 'mfa-pending-token',
          message: 'MFA verification required',
        };
      }
      if (endpoint === ENDPOINTS.MFA_VERIFY) {
        return {
          message: 'Login successful',
          accessToken: 'access-1',
          refreshToken: 'refresh-1',
          user: { id: 'user-1', email: 'mfa@example.com' },
        };
      }
      if (endpoint === ENDPOINTS.MFA_ENABLE) {
        return { message: 'MFA enabled successfully', mfaEnabled: true };
      }
      if (endpoint === ENDPOINTS.MFA_DISABLE) {
        return { message: 'MFA disabled successfully', mfaEnabled: false };
      }
      if (endpoint === ENDPOINTS.MFA_REGENERATE_BACKUP_CODES) {
        return { message: 'Backup codes regenerated', backupCodes: ['111111', '222222'] };
      }
      if (endpoint === ENDPOINTS.OAUTH_AUTHORIZE('google') || endpoint.startsWith('/api/oauth/')) {
        return {
          authUrl: 'https://oauth.example.test/google',
          provider: 'google',
          intent: body.intent,
          expiresInSeconds: 600,
        };
      }
      if (endpoint === ENDPOINTS.WEBAUTHN_REGISTER_OPTIONS) {
        return { message: 'Complete registration', options: { challenge: 'abc' }, deviceName: body.deviceName };
      }
      if (endpoint === ENDPOINTS.WEBAUTHN_REGISTER_VERIFY) {
        return { message: 'Passkey registered', credential: { id: 'cred-1', deviceName: body.deviceName } };
      }
      if (endpoint === ENDPOINTS.WEBAUTHN_LOGIN_OPTIONS) {
        return { message: 'Complete login', options: { challenge: 'xyz' } };
      }
      if (endpoint === ENDPOINTS.WEBAUTHN_LOGIN_VERIFY) {
        return {
          message: 'Login successful',
          accessToken: 'access-1',
          refreshToken: 'refresh-1',
          user: { id: 'user-1', email: 'passkey@example.com' },
        };
      }
      if (endpoint === ENDPOINTS.REENABLE_ACCOUNT) {
        return { success: true, message: 'Account re-enabled successfully. Please log in again.', user: this.user };
      }
      return { success: true, message: 'ok', user: this.user, accessToken: this.accessToken, refreshToken: this.refreshToken };
    },
    async get(endpoint, options = {}) {
      calls.push({ method: 'get', endpoint, options });
      if (endpoint === ENDPOINTS.ME) {
        return {
          id: this.user?.id,
          email: this.user?.email,
          name: this.user?.fullName,
          fullName: this.user?.fullName,
          isEmailVerified: this.user?.isEmailVerified,
          createdAt: this.user?.createdAt,
          updatedAt: this.user?.updatedAt,
          isLocked: this.user?.isLocked,
          lastLoginAt: this.user?.lastLoginAt,
          app: this.user?.app,
        };
      }
      if (endpoint === ENDPOINTS.MFA_STATUS) {
        return { mfaEnabled: true, mfaEnabledAt: '2026-01-01T00:00:00.000Z', backupCodesRemaining: 5 };
      }
      if (endpoint === ENDPOINTS.WEBAUTHN_COMPATIBILITY) {
        return { supported: true, rpID: 'voult.dev', origin: 'https://voult.dev' };
      }
      if (endpoint === ENDPOINTS.WEBAUTHN_CREDENTIALS) {
        return { credentials: [{ id: 'cred-1', deviceName: 'MacBook' }] };
      }
      return { success: true, message: 'ok', user: this.user };
    },
    async patch(endpoint, body, options = {}) {
      calls.push({ method: 'patch', endpoint, body, options });
      if (endpoint.startsWith('/api/auth/webauthn/credentials/')) {
        return { message: 'Passkey updated', credential: { id: 'cred-1', deviceName: body.deviceName } };
      }
      return { success: true, message: 'ok', user: { ...this.user, fullName: body.fullName } };
    },
    async delete(endpoint, options = {}) {
      calls.push({ method: 'delete', endpoint, options });
      if (endpoint.startsWith('/api/auth/webauthn/credentials/')) {
        return { message: 'Passkey deleted' };
      }
      return { success: true, message: 'ok' };
    },
    async refreshSession() {
      calls.push({ method: 'refresh', endpoint: ENDPOINTS.SESSION_REFRESH });
      this.setSession(this.user, 'access-2', 'refresh-2');
      return { accessToken: 'access-2', refreshToken: 'refresh-2' };
    },
  };
  client.constructor = VoultClient;
  return client;
}

test('sign up functions validate input, call register endpoints, and set sessions', async () => {
  const client = createFakeClient();

  const emailSignup = await signUpWithEmailAndPassword(
    ' USER@EXAMPLE.com ',
    'StrongPass123!',
    { fullName: ' Jane Doe ', username: 'JohnDoe' },
    client
  );

  assert.equal(emailSignup.accessToken, 'access-1');
  assert.equal(emailSignup.token, 'access-1');
  assert.equal(emailSignup.emailVerificationRequired, true);
  assert.equal(emailSignup.message, 'ok');
  assert.equal(client.accessToken, 'access-1');
  assert.deepEqual(client.calls[0], {
    method: 'post',
    endpoint: ENDPOINTS.REGISTER,
    body: {
      email: 'user@example.com',
      password: 'StrongPass123!',
      fullName: 'Jane Doe',
      username: 'johndoe',
    },
    options: {},
  });

  const usernameSignup = await signUpWithUsernameAndPassword(
    ' John_Doe1 ',
    'StrongPass123!',
    { email: ' JOHN@EXAMPLE.com ', fullName: 'John Doe' },
    client
  );

  assert.equal(usernameSignup.accessToken, 'access-1');
  assert.equal(usernameSignup.message, 'ok');
  assert.deepEqual(client.calls[1], {
    method: 'post',
    endpoint: ENDPOINTS.USERNAME_REGISTER,
    body: {
      username: 'john_doe1',
      password: 'StrongPass123!',
      fullName: 'John Doe',
      email: 'john@example.com',
    },
    options: {},
  });
});

test('sign in functions validate input, call login endpoints, and apply auth responses', async () => {
  const client = createFakeClient();
  const user = { id: 'user-1', email: 'user@example.com' };
  client.user = user;
  client.accessToken = 'access-1';
  client.refreshToken = 'refresh-1';

  const emailResult = await signInWithEmailAndPassword(' USER@EXAMPLE.com ', 'password', client);
  assert.deepEqual(emailResult, {
    user,
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    token: 'access-1',
    message: 'ok',
    success: true,
  });
  assert.deepEqual(client.calls[0], {
    method: 'post',
    endpoint: ENDPOINTS.EMAIL_LOGIN,
    body: { email: 'user@example.com', password: 'password' },
    options: {},
  });

  const usernameResult = await signInWithUsernameAndPassword(' John_Doe1 ', 'password', client);
  assert.deepEqual(usernameResult, {
    user,
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    token: 'access-1',
    message: 'ok',
    success: true,
  });
  assert.deepEqual(client.calls[1], {
    method: 'post',
    endpoint: ENDPOINTS.USERNAME_LOGIN,
    body: { username: 'john_doe1', password: 'password' },
    options: {},
  });

  client.clearSession();
  const mfaChallenge = await signInWithEmailAndPassword('mfa@example.com', 'password', client);
  assert.deepEqual(mfaChallenge, {
    mfaRequired: true,
    mfaPendingToken: 'mfa-pending-token',
    message: 'MFA verification required',
  });
  assert.equal(client.isAuthenticated(), false);
});

test('magic link functions validate redirect URIs, tokens, and auth responses', async () => {
  const client = createFakeClient();
  const user = { id: 'user-1', email: 'magic@example.com' };
  client.user = user;
  client.accessToken = 'access-1';
  client.refreshToken = 'refresh-1';

  await assert.rejects(
    () => signInWithEmailLink('user@example.com', {}, client),
    (error) => error instanceof ValidationError && error.field === 'redirectUri'
  );

  const sent = await signInWithEmailLink(
    ' USER@EXAMPLE.com ',
    { redirectUri: 'https://example.com/callback' },
    client
  );

  assert.deepEqual(sent, { success: true, message: 'ok' });
  assert.deepEqual(client.calls[0], {
    method: 'post',
    endpoint: ENDPOINTS.SEND_MAGIC_LINK,
    body: {
      email: 'user@example.com',
      clientId: 'client-id',
      redirectUri: 'https://example.com/callback',
    },
    options: {},
  });

  const verified = await verifyEmailLink(' token-1 ', client);
  assert.deepEqual(verified, {
    user,
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    token: 'access-1',
    message: 'ok',
    success: true,
  });
  assert.deepEqual(client.calls[1], {
    method: 'post',
    endpoint: ENDPOINTS.VALIDATE_MAGIC_LINK,
    body: { token: 'token-1' },
    options: {},
  });
});

test('password reset and email verification functions validate inputs and call expected endpoints', async () => {
  const client = createFakeClient();

  const resetSent = await sendPasswordResetEmail(' USER@EXAMPLE.com ', client);
  assert.deepEqual(resetSent, {
    success: true,
    message: 'ok',
  });
  assert.deepEqual(client.calls[0], {
    method: 'post',
    endpoint: ENDPOINTS.FORGOT_PASSWORD,
    body: { email: 'user@example.com' },
    options: { includeClientSecret: true },
  });

  const reset = await resetPassword(' token-1 ', 'StrongPass123!', { appId: 'app-1' }, client);
  assert.deepEqual(reset, {
    success: true,
    message: 'ok',
  });
  assert.deepEqual(client.calls[1], {
    method: 'post',
    endpoint: ENDPOINTS.RESET_PASSWORD,
    body: { password: 'StrongPass123!' },
    options: { params: { token: 'token-1', appId: 'app-1' }, includeClientSecret: true },
  });

  client.user = { id: 'user-1', email: 'user@example.com', isEmailVerified: false };
  const verified = await verifyEmail(' token-1 ', { appId: 'app-1' }, client);
  assert.deepEqual(verified, { success: true, message: 'ok' });
  assert.deepEqual(client.calls[2], {
    method: 'get',
    endpoint: ENDPOINTS.VERIFY_EMAIL,
    options: { params: { token: 'token-1', appId: 'app-1' }, includeClientSecret: false },
  });
  assert.equal(client.user.isEmailVerified, true);
});

test('profile and account functions require authentication and update local user state', async () => {
  const client = createFakeClient();

  await assert.rejects(() => getCurrentUser(client), {
    name: 'AuthenticationError',
    code: 'AUTHENTICATION_ERROR',
    status: 401,
  });

  client.user = { id: 'user-1', email: 'user@example.com', fullName: 'Jane Doe', isEmailVerified: true };
  client.accessToken = 'access-1';
  client.refreshToken = 'refresh-1';

  const profile = await getCurrentUser(client);
  assert.deepEqual(profile, client.user);
  assert.deepEqual(client.calls[0], {
    method: 'get',
    endpoint: ENDPOINTS.ME,
    options: { requireAuth: true },
  });

  const updated = await updateProfile({ fullName: ' Jane Updated ' }, client);
  assert.deepEqual(updated, {
    success: true,
    message: 'ok',
    user: { ...client.user, fullName: 'Jane Updated' },
  });
  assert.equal(client.user.fullName, 'Jane Updated');
  assert.deepEqual(client.calls[1], {
    method: 'patch',
    endpoint: ENDPOINTS.ME,
    body: { fullName: 'Jane Updated' },
    options: { requireAuth: true },
  });

  const reenabled = await reenableAccount(client);
  assert.deepEqual(reenabled, {
    success: true,
    message: 'Account re-enabled successfully. Please log in again.',
  });
  assert.equal(client.isAuthenticated(), false);
});

test('sign out and delete user clear local sessions', async () => {
  const client = createFakeClient();

  const notLoggedIn = await signOut(client);
  assert.deepEqual(notLoggedIn, {
    success: true,
    message: 'User was not logged in',
  });

  client.user = { id: 'user-1', email: 'user@example.com' };
  client.accessToken = 'access-1';
  client.refreshToken = 'refresh-1';

  const loggedOut = await signOut(client);
  assert.deepEqual(loggedOut, {
    success: true,
    message: 'ok',
  });
  assert.equal(client.isAuthenticated(), false);

  client.user = { id: 'user-1', email: 'user@example.com' };
  client.accessToken = 'access-1';
  client.refreshToken = 'refresh-1';

  const deleted = await deleteUser(client);
  assert.deepEqual(deleted, {
    success: true,
    message: 'ok',
  });
  assert.equal(client.isAuthenticated(), false);
  assert.deepEqual(client.calls.at(-1), {
    method: 'post',
    endpoint: ENDPOINTS.DISABLE_ACCOUNT,
    body: {},
    options: { requireAuth: true },
  });
});

test('session functions refresh, list, and revoke authenticated sessions', async () => {
  const client = createFakeClient();

  await assert.rejects(() => listSessions(client), {
    name: 'AuthenticationError',
    code: 'AUTHENTICATION_ERROR',
    status: 401,
  });

  client.user = { id: 'user-1', email: 'user@example.com' };
  client.accessToken = 'access-1';
  client.refreshToken = 'refresh-1';

  const refreshed = await refreshSession(client);
  assert.deepEqual(refreshed, {
    accessToken: 'access-2',
    refreshToken: 'refresh-2',
    user: client.user,
  });
  assert.equal(client.accessToken, 'access-2');

  const sessions = await listSessions(client);
  assert.deepEqual(sessions, { sessions: [] });

  const revoked = await revokeSession('session-1', client);
  assert.deepEqual(revoked, {
    success: true,
    message: 'ok',
  });
  assert.deepEqual(client.calls.at(-1), {
    method: 'get',
    endpoint: ENDPOINTS.SESSION_REVOKE('session-1'),
    options: { requireAuth: true },
  });
});

test('OAuth handlers validate provider credentials and call expected endpoints', async () => {
  const client = createFakeClient();

  await assert.rejects(() => signInWithGoogle({}, client), {
    name: 'ValidationError',
    code: 'VALIDATION_ERROR',
    status: 400,
  });

  const googleIn = await signInWithGoogle({ idToken: 'google-id' }, client);
  assert.deepEqual(client.calls[0], {
    method: 'post',
    endpoint: ENDPOINTS.GOOGLE_LOGIN,
    body: { idToken: 'google-id' },
    options: { includeClientSecret: false },
  });
  assert.deepEqual(googleIn, {
    user: null,
    accessToken: undefined,
    refreshToken: undefined,
    token: undefined,
    message: 'ok',
    success: true,
  });

  const googleUp = await signUpWithGoogle({ accessToken: 'google-access' }, client);
  assert.deepEqual(client.calls[1], {
    method: 'post',
    endpoint: ENDPOINTS.GOOGLE_REGISTER,
    body: { accessToken: 'google-access' },
    options: { includeClientSecret: false },
  });

  const githubIn = await signInWithGitHub({ code: 'github-code', redirectUri: 'https://example.com/callback' }, client);
  assert.deepEqual(client.calls[2], {
    method: 'post',
    endpoint: ENDPOINTS.GITHUB_LOGIN,
    body: { code: 'github-code', redirect_uri: 'https://example.com/callback' },
    options: { includeClientSecret: false },
  });

  const githubUp = await signUpWithGitHub({ code: 'github-code' }, client);
  assert.deepEqual(client.calls[3], {
    method: 'post',
    endpoint: ENDPOINTS.GITHUB_REGISTER,
    body: { code: 'github-code' },
    options: { includeClientSecret: false },
  });

  const facebookIn = await signInWithFacebook({ accessToken: 'facebook-access' }, client);
  assert.deepEqual(client.calls[4], {
    method: 'post',
    endpoint: ENDPOINTS.FACEBOOK_LOGIN,
    body: { accessToken: 'facebook-access' },
    options: { includeClientSecret: false },
  });

  const facebookUp = await signUpWithFacebook({ accessToken: 'facebook-access' }, client);
  assert.deepEqual(client.calls[5], {
    method: 'post',
    endpoint: ENDPOINTS.FACEBOOK_REGISTER,
    body: { accessToken: 'facebook-access' },
    options: { includeClientSecret: false },
  });

  const linkedinIn = await signInWithLinkedIn({ code: 'linkedin-code' }, client);
  assert.deepEqual(client.calls[6], {
    method: 'post',
    endpoint: ENDPOINTS.LINKEDIN_LOGIN,
    body: { code: 'linkedin-code' },
    options: { includeClientSecret: false },
  });

  const linkedinUp = await signUpWithLinkedIn({ code: 'linkedin-code' }, client);
  assert.deepEqual(client.calls[7], {
    method: 'post',
    endpoint: ENDPOINTS.LINKEDIN_REGISTER,
    body: { code: 'linkedin-code' },
    options: { includeClientSecret: false },
  });

  const microsoftIn = await signInWithMicrosoft({ code: 'microsoft-code' }, client);
  assert.deepEqual(client.calls[8], {
    method: 'post',
    endpoint: ENDPOINTS.MICROSOFT_LOGIN,
    body: { code: 'microsoft-code' },
    options: { includeClientSecret: false },
  });

  const microsoftUp = await signUpWithMicrosoft({ code: 'microsoft-code' }, client);
  assert.deepEqual(client.calls[9], {
    method: 'post',
    endpoint: ENDPOINTS.MICROSOFT_REGISTER,
    body: { code: 'microsoft-code' },
    options: { includeClientSecret: false },
  });

  await assert.rejects(() => signInWithApple({ code: 'apple-code' }, client), {
    name: 'ValidationError',
    code: 'VALIDATION_ERROR',
    status: 400,
  });

  const appleIn = await signInWithApple({ code: 'apple-code', idToken: 'apple-id' }, client);
  assert.deepEqual(client.calls[10], {
    method: 'post',
    endpoint: ENDPOINTS.APPLE_LOGIN,
    body: { code: 'apple-code', idToken: 'apple-id' },
    options: { includeClientSecret: false },
  });

  const appleUp = await signUpWithApple({ code: 'apple-code', idToken: 'apple-id' }, client);
  assert.deepEqual(client.calls[11], {
    method: 'post',
    endpoint: ENDPOINTS.APPLE_REGISTER,
    body: { code: 'apple-code', idToken: 'apple-id' },
    options: { includeClientSecret: false },
  });
});

test('OAuth linking functions validate providers and use authenticated endpoints', async () => {
  const client = createFakeClient();
  client.user = { id: 'user-1', email: 'user@example.com' };
  client.accessToken = 'access-1';
  client.refreshToken = 'refresh-1';

  await assert.rejects(() => linkOAuthProvider('twitter', client), {
    name: 'ValidationError',
    code: 'VALIDATION_ERROR',
    status: 400,
  });

  const linked = await linkOAuthProvider('GOOGLE', client);
  assert.deepEqual(linked, { redirectUrl: undefined });
  assert.deepEqual(client.calls[0], {
    method: 'post',
    endpoint: ENDPOINTS.OAUTH_LINK('google'),
    body: {},
    options: { requireAuth: true },
  });

  const providers = await getLinkedOAuthProviders(client);
  assert.deepEqual(providers, { providers: [] });
  assert.deepEqual(client.calls[1], {
    method: 'get',
    endpoint: ENDPOINTS.OAUTH_ACCOUNTS,
    options: { requireAuth: true },
  });

  const unlinked = await unlinkOAuthProvider('github', client);
  assert.deepEqual(unlinked, { success: true });
  assert.deepEqual(client.calls[2], {
    method: 'delete',
    endpoint: ENDPOINTS.OAUTH_UNLINK('github'),
    options: { requireAuth: true },
  });

  const passwordSet = await setPassword('StrongPass123!', client);
  assert.deepEqual(passwordSet, {
    success: true,
    message: 'Password set successfully',
  });
  assert.deepEqual(client.calls[3], {
    method: 'post',
    endpoint: ENDPOINTS.SET_PASSWORD,
    body: { password: 'StrongPass123!' },
    options: { requireAuth: true },
  });
});

test('MFA functions validate input and call expected endpoints', async () => {
  const client = createFakeClient();
  client.user = { id: 'user-1', email: 'mfa@example.com' };
  client.accessToken = 'access-1';
  client.refreshToken = 'refresh-1';

  const verified = await verifyMfaLogin('pending-token', '123456', client);
  assert.equal(verified.accessToken, 'access-1');
  assert.deepEqual(client.calls[0], {
    method: 'post',
    endpoint: ENDPOINTS.MFA_VERIFY,
    body: { mfaPendingToken: 'pending-token', mfaToken: '123456' },
    options: {},
  });

  const status = await getMfaStatus(client);
  assert.equal(status.mfaEnabled, true);
  assert.equal(status.backupCodesRemaining, 5);
  assert.deepEqual(client.calls[1], {
    method: 'get',
    endpoint: ENDPOINTS.MFA_STATUS,
    options: { requireAuth: true },
  });

  const setup = await setupMfa(client);
  assert.equal(setup.message, 'ok');
  assert.deepEqual(client.calls[2], {
    method: 'post',
    endpoint: ENDPOINTS.MFA_SETUP,
    body: {},
    options: { requireAuth: true },
  });

  const enabled = await enableMfa('123456', client);
  assert.equal(enabled.mfaEnabled, true);
  assert.deepEqual(client.calls[3], {
    method: 'post',
    endpoint: ENDPOINTS.MFA_ENABLE,
    body: { token: '123456' },
    options: { requireAuth: true },
  });

  const disabled = await disableMfa('password', '123456', client);
  assert.equal(disabled.mfaEnabled, false);
  assert.deepEqual(client.calls[4], {
    method: 'post',
    endpoint: ENDPOINTS.MFA_DISABLE,
    body: { password: 'password', mfaToken: '123456' },
    options: { requireAuth: true },
  });

  const regenerated = await regenerateMfaBackupCodes('123456', client);
  assert.equal(regenerated.message, 'Backup codes regenerated');
  assert.deepEqual(client.calls[5], {
    method: 'post',
    endpoint: ENDPOINTS.MFA_REGENERATE_BACKUP_CODES,
    body: { token: '123456' },
    options: { requireAuth: true },
  });
});

test('WebAuthn functions call expected endpoints', async () => {
  const client = createFakeClient();
  client.user = { id: 'user-1', email: 'user@example.com' };
  client.accessToken = 'access-1';
  client.refreshToken = 'refresh-1';

  const compatibility = await getWebAuthnCompatibility(client);
  assert.equal(compatibility.supported, true);
  assert.deepEqual(client.calls[0], {
    method: 'get',
    endpoint: ENDPOINTS.WEBAUTHN_COMPATIBILITY,
    options: {},
  });

  const registrationOptions = await createPasskeyRegistrationOptions({ deviceName: 'MacBook' }, client);
  assert.equal(registrationOptions.message, 'Complete registration');
  assert.deepEqual(client.calls[1], {
    method: 'post',
    endpoint: ENDPOINTS.WEBAUTHN_REGISTER_OPTIONS,
    body: { deviceName: 'MacBook' },
    options: { requireAuth: true },
  });

  const registration = await verifyPasskeyRegistration({ id: 'cred' }, { deviceName: 'MacBook' }, client);
  assert.equal(registration.message, 'Passkey registered');
  assert.deepEqual(client.calls[2], {
    method: 'post',
    endpoint: ENDPOINTS.WEBAUTHN_REGISTER_VERIFY,
    body: { credential: { id: 'cred' }, deviceName: 'MacBook' },
    options: { requireAuth: true },
  });

  const loginOptions = await createPasskeyLoginOptions({ email: 'user@example.com' }, client);
  assert.equal(loginOptions.message, 'Complete login');
  assert.deepEqual(client.calls[3], {
    method: 'post',
    endpoint: ENDPOINTS.WEBAUTHN_LOGIN_OPTIONS,
    body: { email: 'user@example.com' },
    options: {},
  });

  const login = await verifyPasskeyLogin({ id: 'cred' }, client);
  assert.equal(login.accessToken, 'access-1');
  assert.deepEqual(client.calls[4], {
    method: 'post',
    endpoint: ENDPOINTS.WEBAUTHN_LOGIN_VERIFY,
    body: { credential: { id: 'cred' } },
    options: {},
  });

  const passkeys = await listPasskeys(client);
  assert.deepEqual(passkeys, { credentials: [{ id: 'cred-1', deviceName: 'MacBook' }] });
  assert.deepEqual(client.calls[5], {
    method: 'get',
    endpoint: ENDPOINTS.WEBAUTHN_CREDENTIALS,
    options: { requireAuth: true },
  });

  const updated = await updatePasskey('cred-1', 'Work Laptop', client);
  assert.equal(updated.message, 'Passkey updated');
  assert.deepEqual(client.calls[6], {
    method: 'patch',
    endpoint: ENDPOINTS.WEBAUTHN_CREDENTIAL('cred-1'),
    body: { deviceName: 'Work Laptop' },
    options: { requireAuth: true },
  });

  const deleted = await deletePasskey('cred-1', client);
  assert.deepEqual(deleted, {
    success: true,
    message: 'Passkey deleted',
  });
  assert.deepEqual(client.calls[7], {
    method: 'delete',
    endpoint: ENDPOINTS.WEBAUTHN_CREDENTIAL('cred-1'),
    options: { requireAuth: true },
  });
});

test('getOAuthAuthorizationUrl validates provider and request payload', async () => {
  const client = createFakeClient();

  await assert.rejects(
    () => getOAuthAuthorizationUrl('twitter', { intent: 'login', redirectUri: 'https://example.com/callback' }, client),
    (error) => error instanceof ValidationError && error.field === 'provider'
  );

  const result = await getOAuthAuthorizationUrl(
    'google',
    { intent: 'login', redirectUri: 'https://example.com/callback', appId: 'app-1' },
    client
  );

  assert.equal(result.authUrl, 'https://oauth.example.test/google');
  assert.deepEqual(client.calls[0], {
    method: 'post',
    endpoint: ENDPOINTS.OAUTH_AUTHORIZE('google'),
    body: {
      intent: 'login',
      redirectUri: 'https://example.com/callback',
      appId: 'app-1',
      userId: undefined,
    },
    options: {
      headers: { 'X-App-ID': 'app-1' },
      includeClientSecret: false,
    },
  });
});
