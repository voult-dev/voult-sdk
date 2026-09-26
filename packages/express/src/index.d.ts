import type { RequestHandler, Router } from 'express';

export type SessionStrategy = 'cookie' | 'bearer';

export interface VoultSessionConfig {
  strategy?: SessionStrategy;
}

export interface VoultExpressConfig {
  baseURL?: string;
  clientId: string;
  clientSecret: string;
  sessionSecret?: string;
  appUrl?: string;
  /** Override the computed hosted-OAuth callback URL (e.g. behind a proxy). */
  oauthCallbackUrl?: string;
  oauth?: VoultOAuthPaths;
  session?: VoultSessionConfig;
}

/** Where hosted OAuth sends the browser, relative to `appUrl`. Each must start with "/". */
export interface VoultOAuthPaths {
  /** Default `/`. After sign-in (unless `returnTo` was given) or linking. */
  successPath?: string;
  /** Default `/mfa`. User has MFA: prompt for a code and POST /mfa/verify { mfaToken }. */
  mfaPath?: string;
  /** Default `/login`. Receives `?voult_error=<CODE>&voult_error_description=<text>`. */
  errorPath?: string;
}

export interface LoadConfigFromEnvOptions {
  env?: NodeJS.Dict<string | undefined>;
  overrides?: Partial<VoultExpressConfig>;
}

export interface CreateVoultRouterOptions extends LoadConfigFromEnvOptions {
  config?: VoultExpressConfig;
  oauth?: VoultOAuthPaths;
}

export function loadConfigFromEnv(options?: LoadConfigFromEnvOptions): VoultExpressConfig;
export function createVoultRouter(options?: CreateVoultRouterOptions): Router;
export function createVoultMiddleware(options?: CreateVoultRouterOptions): RequestHandler;

declare module 'express-serve-static-core' {
  interface Request {
    voultConfig?: VoultExpressConfig;
    voult?: {
      accessToken: string | null;
      refreshToken: string | null;
      user: unknown;
      isAuthenticated(): boolean;
      getCurrentUser(): unknown;
      setSession(user: unknown, accessToken: string, refreshToken?: string | null): void;
      clearSession(): void;
    };
  }
}
