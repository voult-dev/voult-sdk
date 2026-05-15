/**
 * OAuth sign-in and sign-up for supported providers
 */

import { ENDPOINTS } from '../constants.js';
import { applyAuthResponse, assertOAuthCredential } from '../utils/helpers.js';
import { ValidationError } from '../errors.js';

async function oauthAuth(endpoint, credentials, client) {
  const response = await client.post(endpoint, credentials, {
    includeClientSecret: false,
  });
  return applyAuthResponse(client, response);
}

function createGoogleHandlers(loginPath, registerPath) {
  return {
    async signIn(credentials, client) {
      assertOAuthCredential('Google', credentials);
      if (!credentials.idToken && !credentials.accessToken) {
        throw new ValidationError('Google idToken or accessToken is required', 'credentials');
      }
      return oauthAuth(loginPath, credentials, client);
    },
    async signUp(credentials, client) {
      assertOAuthCredential('Google', credentials);
      if (!credentials.idToken && !credentials.accessToken) {
        throw new ValidationError('Google idToken or accessToken is required', 'credentials');
      }
      return oauthAuth(registerPath, credentials, client);
    },
  };
}

function createCodeHandlers(provider, loginPath, registerPath, options = {}) {
  const { redirectUriField = 'redirect_uri' } = options;
  return {
    async signIn(credentials, client) {
      assertOAuthCredential(provider, credentials);
      if (!credentials.code) {
        throw new ValidationError(`${provider} authorization code is required`, 'code');
      }
      const body = { code: credentials.code };
      if (credentials.redirectUri) {
        body[redirectUriField] = credentials.redirectUri;
      }
      return oauthAuth(loginPath, body, client);
    },
    async signUp(credentials, client) {
      assertOAuthCredential(provider, credentials);
      if (!credentials.code) {
        throw new ValidationError(`${provider} authorization code is required`, 'code');
      }
      const body = { code: credentials.code };
      if (credentials.redirectUri) {
        body[redirectUriField] = credentials.redirectUri;
      }
      return oauthAuth(registerPath, body, client);
    },
  };
}

function createAccessTokenHandlers(provider, loginPath, registerPath) {
  return {
    async signIn(credentials, client) {
      assertOAuthCredential(provider, credentials);
      if (!credentials.accessToken) {
        throw new ValidationError(`${provider} accessToken is required`, 'accessToken');
      }
      return oauthAuth(loginPath, { accessToken: credentials.accessToken }, client);
    },
    async signUp(credentials, client) {
      assertOAuthCredential(provider, credentials);
      if (!credentials.accessToken) {
        throw new ValidationError(`${provider} accessToken is required`, 'accessToken');
      }
      return oauthAuth(registerPath, { accessToken: credentials.accessToken }, client);
    },
  };
}

function createAppleHandlers(loginPath, registerPath) {
  return {
    async signIn(credentials, client) {
      assertOAuthCredential('Apple', credentials);
      if (!credentials.code || !credentials.idToken) {
        throw new ValidationError('Apple code and idToken are required', 'credentials');
      }
      return oauthAuth(loginPath, credentials, client);
    },
    async signUp(credentials, client) {
      assertOAuthCredential('Apple', credentials);
      if (!credentials.code || !credentials.idToken) {
        throw new ValidationError('Apple code and idToken are required', 'credentials');
      }
      return oauthAuth(registerPath, credentials, client);
    },
  };
}

const google = createGoogleHandlers(ENDPOINTS.GOOGLE_LOGIN, ENDPOINTS.GOOGLE_REGISTER);
const github = createCodeHandlers('GitHub', ENDPOINTS.GITHUB_LOGIN, ENDPOINTS.GITHUB_REGISTER);
const facebook = createAccessTokenHandlers('Facebook', ENDPOINTS.FACEBOOK_LOGIN, ENDPOINTS.FACEBOOK_REGISTER);
const linkedin = createCodeHandlers('LinkedIn', ENDPOINTS.LINKEDIN_LOGIN, ENDPOINTS.LINKEDIN_REGISTER);
const microsoft = createCodeHandlers('Microsoft', ENDPOINTS.MICROSOFT_LOGIN, ENDPOINTS.MICROSOFT_REGISTER);
const apple = createAppleHandlers(ENDPOINTS.APPLE_LOGIN, ENDPOINTS.APPLE_REGISTER);

export const signInWithGoogle = google.signIn;
export const signUpWithGoogle = google.signUp;
export const signInWithGitHub = github.signIn;
export const signUpWithGitHub = github.signUp;
export const signInWithFacebook = facebook.signIn;
export const signUpWithFacebook = facebook.signUp;
export const signInWithLinkedIn = linkedin.signIn;
export const signUpWithLinkedIn = linkedin.signUp;
export const signInWithMicrosoft = microsoft.signIn;
export const signUpWithMicrosoft = microsoft.signUp;
export const signInWithApple = apple.signIn;
export const signUpWithApple = apple.signUp;
