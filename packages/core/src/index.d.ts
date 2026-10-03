/** The per-request `@voult/sdk` VoultClient (the parts adapters use). */
export interface VoultClient {
  accessToken: string | null;
  refreshToken: string | null;
  user: unknown;
  isAuthenticated(): boolean;
  getCurrentUser(): unknown;
  setSession(user: unknown, accessToken: string, refreshToken?: string | null): void;
  clearSession(): void;
}

export type SessionStrategy = 'cookie' | 'bearer';

/** Where hosted OAuth sends the browser, relative to `appUrl`. Each must start with "/". */
export interface VoultOAuthPaths {
  /** Default `/`. After sign-in (unless `returnTo` was given) or linking. */
  successPath?: string;
  /** Default `/mfa`. User has MFA: prompt for a code and POST /mfa/verify { mfaToken }. */
  mfaPath?: string;
  /** Default `/login`. Receives `?voult_error=<CODE>&voult_error_description=<text>`. */
  errorPath?: string;
}

export interface VoultConfig {
  baseURL?: string;
  clientId: string;
  clientSecret: string;
  sessionSecret?: string;
  appUrl?: string;
  /** Override the computed hosted-OAuth callback URL (e.g. behind a proxy). */
  oauthCallbackUrl?: string;
  oauth?: VoultOAuthPaths;
  session?: { strategy?: SessionStrategy };
}

export interface LoadConfigFromEnvOptions {
  env?: Record<string, string | undefined>;
  overrides?: Partial<VoultConfig>;
}

export interface ResolveConfigOptions extends LoadConfigFromEnvOptions {
  config?: VoultConfig;
  oauth?: VoultOAuthPaths;
}

export interface CookieToSet {
  name: string;
  value: string;
  options: Record<string, unknown>;
}

export type ReadCookie = (name: string) => unknown;

export interface IncomingSession {
  accessToken: string | null;
  refreshToken: string | null;
}

export interface HandleOptions {
  /** Where the router is mounted, e.g. `/api/auth`. */
  basePath?: string;
  /** Answer for paths with no route. Default: 404 JSON. Return null to fall through. */
  notFound?: (request: Request) => Response | null;
}

export type VoultHandler = (request: Request, options?: HandleOptions) => Promise<Response | null>;

export function createVoultHandler(config: VoultConfig): VoultHandler;
export function loadConfigFromEnv(options?: LoadConfigFromEnvOptions): VoultConfig;
export function resolveConfig(options?: ResolveConfigOptions): VoultConfig;
export function normalizeVoultError(err: unknown): { error: { code: string; message: string; status: number; field?: string; fields?: unknown } };

export const COOKIE_ACCESS: 'voult_access';
export const COOKIE_REFRESH: 'voult_refresh';
export const COOKIE_USER: 'voult_user';
export const COOKIE_OAUTH: 'voult_oauth';
export const COOKIE_MFA_PENDING: 'voult_mfa_pending';

export function createVoultClient(config: VoultConfig): VoultClient;
export function getSessionFromRequest(
  request: Request,
  config: VoultConfig,
  options?: { body?: Record<string, unknown> }
): Promise<{ client: VoultClient; incoming: IncomingSession; read: ReadCookie }>;
export function restoreSession(
  client: VoultClient,
  incoming: { read: ReadCookie; authorization?: string | null; refreshToken?: unknown },
  config: VoultConfig
): IncomingSession;
export function sessionCookies(client: VoultClient, incoming: IncomingSession, config: VoultConfig): CookieToSet[];
export function renewSession(client: VoultClient, read: ReadCookie, config: VoultConfig): Promise<CookieToSet[]>;

export function readCookieHeader(header: string | null | undefined, secret?: string): Promise<{
  cookies: Record<string, string>;
  signedCookies: Record<string, string | false>;
}>;
export function serializeCookie(name: string, value: string, options?: Record<string, unknown>): string;
export function setCookieHeader(cookie: CookieToSet, secret?: string): Promise<string>;
export function sign(value: string, secret: string): Promise<string>;
export function unsign(signed: string, secret: string): Promise<string | false>;
