/**
 * Voult API endpoint paths
 * @see https://github.com/voult-dev/voult
 */
export const ENDPOINTS = {
  // CSRF (session-based; requires credentials when fetching)
  CSRF_TOKEN: '/csrf-token',

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

  // MFA
  MFA_VERIFY: '/api/auth/mfa/verify',
  MFA_STATUS: '/api/auth/mfa/status',
  MFA_SETUP: '/api/auth/mfa/setup',
  MFA_ENABLE: '/api/auth/mfa/enable',
  MFA_DISABLE: '/api/auth/mfa/disable',
  MFA_REGENERATE_BACKUP_CODES: '/api/auth/mfa/backup-codes/regenerate',

  // WebAuthn / passkeys
  WEBAUTHN_COMPATIBILITY: '/api/auth/webauthn/compatibility',
  WEBAUTHN_REGISTER_OPTIONS: '/api/auth/webauthn/register/options',
  WEBAUTHN_REGISTER_VERIFY: '/api/auth/webauthn/register/verify',
  WEBAUTHN_LOGIN_OPTIONS: '/api/auth/webauthn/login/options',
  WEBAUTHN_LOGIN_VERIFY: '/api/auth/webauthn/login/verify',
  WEBAUTHN_CREDENTIALS: '/api/auth/webauthn/credentials',
  WEBAUTHN_CREDENTIAL: (id) => `/api/auth/webauthn/credentials/${id}`,

  // OAuth — unified authorization URL flow
  OAUTH_AUTHORIZE: (provider) => `/api/oauth/${provider}/authorize`,

  // OAuth — provider token exchange (legacy/direct)
  GOOGLE_LOGIN: '/api/auth/google/login',
  GOOGLE_REGISTER: '/api/auth/google/register',
  GOOGLE_AUTHENTICATE: '/api/auth/google/authenticate',
  GITHUB_LOGIN: '/api/auth/github/login',
  GITHUB_REGISTER: '/api/auth/github/register',
  GITHUB_AUTHENTICATE: '/api/auth/github/authenticate',
  FACEBOOK_LOGIN: '/api/auth/facebook/login',
  FACEBOOK_REGISTER: '/api/auth/facebook/register',
  FACEBOOK_AUTHENTICATE: '/api/auth/facebook/authenticate',
  LINKEDIN_LOGIN: '/api/auth/linkedin/login',
  LINKEDIN_REGISTER: '/api/auth/linkedin/register',
  LINKEDIN_AUTHENTICATE: '/api/auth/linkedin/authenticate',
  MICROSOFT_LOGIN: '/api/auth/microsoft/login',
  MICROSOFT_REGISTER: '/api/auth/microsoft/register',
  MICROSOFT_AUTHENTICATE: '/api/auth/microsoft/authenticate',
  APPLE_LOGIN: '/api/auth/apple/login',
  APPLE_REGISTER: '/api/auth/apple/register',
  APPLE_AUTHENTICATE: '/api/auth/apple/authenticate',

  // OAuth linking
  OAUTH_LINK: (provider) => `/api/oauth/${provider}/link`,
  OAUTH_ACCOUNTS: '/api/me/oauth-accounts',
  OAUTH_ACCOUNTS_ALT: '/api/me/oauth',
  OAUTH_UNLINK: (provider) => `/api/me/oauth-accounts/${provider}`,
  OAUTH_UNLINK_ALT: (provider) => `/api/me/oauth/${provider}`,
  SET_PASSWORD: '/api/me/set-password',
};

export const DEFAULT_BASE_URL = 'https://api.voult.dev';

export const OAUTH_PROVIDERS = [
  'google',
  'github',
  'facebook',
  'linkedin',
  'microsoft',
  'apple',
];

export const OAUTH_INTENTS = ['register', 'login', 'link'];
