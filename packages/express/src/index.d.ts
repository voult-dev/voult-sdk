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
  session?: VoultSessionConfig;
}

export interface LoadConfigFromEnvOptions {
  env?: NodeJS.Dict<string | undefined>;
  overrides?: Partial<VoultExpressConfig>;
}

export interface CreateVoultRouterOptions extends LoadConfigFromEnvOptions {
  config?: VoultExpressConfig;
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
