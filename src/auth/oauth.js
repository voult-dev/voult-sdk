/**
 * OAuth sign-in and sign-up for supported providers
 */

import { ENDPOINTS, OAUTH_INTENTS, OAUTH_PROVIDERS } from '../constants.js';
import { applyAuthResponse, assertOAuthCredential, resolveClientArg } from '../utils/helpers.js';
import { ValidationError } from '../errors.js';
import { isValidUrl } from '../utils/validation.js';

function assertOAuthProvider(provider) {
  if (!provider || typeof provider !== 'string') {
    throw new ValidationError('OAuth provider is required', 'provider');
  }

  const normalized = provider.toLowerCase();
  if (!OAUTH_PROVIDERS.includes(normalized)) {
    throw new ValidationError(
      `Unsupported provider. Use one of: ${OAUTH_PROVIDERS.join(', ')}`,
      'provider'
    );
  }

  return normalized;
}

/**
 * Generate an OAuth authorization URL for redirect-based login/register/link flows.
 * @param {string} provider
 * @param {Object} options
 * @param {'register'|'login'|'link'} options.intent
 * @param {string} options.redirectUri
 * @param {string} [options.appId] - App ID (defaults to X-App-ID header via clientId context)
 * @param {string} [options.userId] - Required when intent is `link`
 * @param {import('../client.js').VoultClient} client
 */
export async function getOAuthAuthorizationUrl(provider, options = {}, client) {
  const resolved = resolveClientArg(options, client);
  client = resolved.client;
  options = resolved.options;

  const normalizedProvider = assertOAuthProvider(provider);

  if (!options.intent || !OAUTH_INTENTS.includes(options.intent)) {
    throw new ValidationError(
      `intent must be one of: ${OAUTH_INTENTS.join(', ')}`,
      'intent'
    );
  }

  if (!options.redirectUri) {
    throw new ValidationError('redirectUri is required', 'redirectUri');
  }

  if (!isValidUrl(options.redirectUri)) {
    throw new ValidationError('Invalid redirectUri format. Must be a valid URL.', 'redirectUri');
  }

  if (options.intent === 'link' && !options.userId) {
    throw new ValidationError('userId is required when intent is link', 'userId');
  }

  const body = {
    intent: options.intent,
    redirectUri: options.redirectUri,
    appId: options.appId,
    userId: options.userId,
  };

  const headers = {};
  if (options.appId) {
    headers['X-App-ID'] = options.appId;
  }

  const response = await client.post(ENDPOINTS.OAUTH_AUTHORIZE(normalizedProvider), body, {
    headers,
    includeClientSecret: false,
  });

  return {
    authUrl: response.authUrl,
    provider: response.provider ?? normalizedProvider,
    intent: response.intent ?? options.intent,
    expiresInSeconds: response.expiresInSeconds,
    deprecation: response._deprecation,
  };
}

async function oauthAuth(endpoint, credentials, client) {
  const response = await client.post(endpoint, credentials);
  return applyAuthResponse(client, response);
}

function createGoogleHandlers(loginPath, registerPath, authenticatePath) {
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
    async authenticate(credentials, client) {
      assertOAuthCredential('Google', credentials);
      if (!credentials.idToken && !credentials.accessToken) {
        throw new ValidationError('Google idToken or accessToken is required', 'credentials');
      }
      return oauthAuth(authenticatePath, credentials, client);
    },
  };
}

function buildOAuthCodeBody(credentials, redirectUriField = 'redirect_uri') {
  if (credentials.accessToken) {
    return { accessToken: credentials.accessToken };
  }

  if (!credentials.code) {
    return null;
  }

  const body = { code: credentials.code };
  if (credentials.redirectUri) {
    body[redirectUriField] = credentials.redirectUri;
  }
  return body;
}

function createCodeHandlers(provider, loginPath, registerPath, authenticatePath, options = {}) {
  const { redirectUriField = 'redirect_uri' } = options;

  function assertCodeOrToken(credentials) {
    assertOAuthCredential(provider, credentials);
    if (!credentials.code && !credentials.accessToken) {
      throw new ValidationError(
        `${provider} authorization code or accessToken is required`,
        'credentials'
      );
    }
  }

  return {
    async signIn(credentials, client) {
      assertCodeOrToken(credentials);
      const body = buildOAuthCodeBody(credentials, redirectUriField);
      return oauthAuth(loginPath, body, client);
    },
    async signUp(credentials, client) {
      assertCodeOrToken(credentials);
      const body = buildOAuthCodeBody(credentials, redirectUriField);
      return oauthAuth(registerPath, body, client);
    },
    async authenticate(credentials, client) {
      assertCodeOrToken(credentials);
      const body = buildOAuthCodeBody(credentials, redirectUriField);
      return oauthAuth(authenticatePath, body, client);
    },
  };
}

function createAccessTokenHandlers(provider, loginPath, registerPath, authenticatePath) {
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
    async authenticate(credentials, client) {
      assertOAuthCredential(provider, credentials);
      if (!credentials.accessToken) {
        throw new ValidationError(`${provider} accessToken is required`, 'accessToken');
      }
      return oauthAuth(authenticatePath, { accessToken: credentials.accessToken }, client);
    },
  };
}

function createAppleHandlers(loginPath, registerPath, authenticatePath) {
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
    async authenticate(credentials, client) {
      assertOAuthCredential('Apple', credentials);
      if (!credentials.code || !credentials.idToken) {
        throw new ValidationError('Apple code and idToken are required', 'credentials');
      }
      return oauthAuth(authenticatePath, credentials, client);
    },
  };
}

const google = createGoogleHandlers(
  ENDPOINTS.GOOGLE_LOGIN,
  ENDPOINTS.GOOGLE_REGISTER,
  ENDPOINTS.GOOGLE_AUTHENTICATE,
);
const github = createCodeHandlers(
  'GitHub',
  ENDPOINTS.GITHUB_LOGIN,
  ENDPOINTS.GITHUB_REGISTER,
  ENDPOINTS.GITHUB_AUTHENTICATE,
);
const facebook = createAccessTokenHandlers(
  'Facebook',
  ENDPOINTS.FACEBOOK_LOGIN,
  ENDPOINTS.FACEBOOK_REGISTER,
  ENDPOINTS.FACEBOOK_AUTHENTICATE,
);
const linkedin = createCodeHandlers(
  'LinkedIn',
  ENDPOINTS.LINKEDIN_LOGIN,
  ENDPOINTS.LINKEDIN_REGISTER,
  ENDPOINTS.LINKEDIN_AUTHENTICATE,
);
const microsoft = createCodeHandlers(
  'Microsoft',
  ENDPOINTS.MICROSOFT_LOGIN,
  ENDPOINTS.MICROSOFT_REGISTER,
  ENDPOINTS.MICROSOFT_AUTHENTICATE,
);
const apple = createAppleHandlers(
  ENDPOINTS.APPLE_LOGIN,
  ENDPOINTS.APPLE_REGISTER,
  ENDPOINTS.APPLE_AUTHENTICATE,
);

export const signInWithGoogle = google.signIn;
export const signUpWithGoogle = google.signUp;
export const authenticateWithGoogle = google.authenticate;
export const signInWithGitHub = github.signIn;
export const signUpWithGitHub = github.signUp;
export const authenticateWithGitHub = github.authenticate;
export const signInWithFacebook = facebook.signIn;
export const signUpWithFacebook = facebook.signUp;
export const authenticateWithFacebook = facebook.authenticate;
export const signInWithLinkedIn = linkedin.signIn;
export const signUpWithLinkedIn = linkedin.signUp;
export const authenticateWithLinkedIn = linkedin.authenticate;
export const signInWithMicrosoft = microsoft.signIn;
export const signUpWithMicrosoft = microsoft.signUp;
export const authenticateWithMicrosoft = microsoft.authenticate;
export const signInWithApple = apple.signIn;
export const signUpWithApple = apple.signUp;
export const authenticateWithApple = apple.authenticate;
