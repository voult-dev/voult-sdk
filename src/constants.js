/**
 * Voult API endpoint paths
 */
export const ENDPOINTS = {
  // Password auth
  REGISTER: '/api/auth/register',
  USERNAME_REGISTER: '/api/auth/username-register',
  EMAIL_LOGIN: '/api/auth/email-login',
  USERNAME_LOGIN: '/api/auth/username-login',
  LOGOUT: '/api/auth/logout',

  // Magic link
  SEND_MAGIC_LINK: '/api/send-magic-link',
  VALIDATE_MAGIC_LINK: '/api/validate-magic-link',

  // User
  ME: '/api/user/me',
  FORGOT_PASSWORD: '/api/user/forgot-password',
  RESET_PASSWORD: '/api/user/reset-password',
  VERIFY_EMAIL: '/api/user/verify-email',
  DISABLE_ACCOUNT: '/api/user/disable',
  REENABLE_ACCOUNT: '/api/user/reenable',

  // Sessions
  SESSIONS: '/api/sessions',
  SESSION_REFRESH: '/api/sessions/refresh',
  SESSION_REVOKE: (sessionId) => `/api/sessions/revoke/${sessionId}`,

  // OAuth providers
  GOOGLE_LOGIN: '/api/auth/google/login',
  GOOGLE_REGISTER: '/api/auth/google/register',
  GITHUB_LOGIN: '/api/auth/github/login',
  GITHUB_REGISTER: '/api/auth/github/register',
  FACEBOOK_LOGIN: '/api/auth/facebook/login',
  FACEBOOK_REGISTER: '/api/auth/facebook/register',
  LINKEDIN_LOGIN: '/api/auth/linkedin/login',
  LINKEDIN_REGISTER: '/api/auth/linkedin/register',
  MICROSOFT_LOGIN: '/api/auth/microsoft/login',
  MICROSOFT_REGISTER: '/api/auth/microsoft/register',
  APPLE_LOGIN: '/api/auth/apple/login',
  APPLE_REGISTER: '/api/auth/apple/register',

  // OAuth linking
  OAUTH_LINK: (provider) => `/api/oauth/${provider}/link`,
  OAUTH_ACCOUNTS: '/api/me/oauth-accounts',
  OAUTH_ACCOUNTS_ALT: '/api/me/oauth',
  OAUTH_UNLINK: (provider) => `/api/me/oauth-accounts/${provider}`,
  OAUTH_UNLINK_ALT: (provider) => `/api/me/oauth/${provider}`,
  SET_PASSWORD: '/api/me/set-password',
};

export const DEFAULT_BASE_URL = 'https://api.voult.dev';
