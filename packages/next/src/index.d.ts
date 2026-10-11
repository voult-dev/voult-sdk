import type { ResolveConfigOptions } from '@voult/core';

/** Config is read from the `VOULT_*` env vars unless `config` is given (same options as `@voult/express`). */
export interface VoultNextOptions extends ResolveConfigOptions {
  /** Where `app/api/auth/[...voult]/route.js` lives. Default `/api/auth`. */
  basePath?: string;
}

export type RouteHandler = (request: Request) => Promise<Response>;

/** `export const { GET, POST, PATCH, DELETE } = createVoultRouteHandlers();` */
export function createVoultRouteHandlers(options?: VoultNextOptions): {
  GET: RouteHandler;
  POST: RouteHandler;
  PATCH: RouteHandler;
  PUT: RouteHandler;
  DELETE: RouteHandler;
};

export interface VoultSession {
  user: { id?: string; email?: string; [key: string]: unknown };
  /**
   * `true`: Voult confirmed the session on this request. `false` (Server Components only): the
   * access token expired and couldn't be renewed here; `user` is from the signed session cookie.
   */
  verified: boolean;
}

export function getSession(options?: ResolveConfigOptions): Promise<VoultSession | null>;

export interface RequireSessionOptions extends ResolveConfigOptions {
  /** Default `/login`. */
  signInPath?: string;
  /** Default `/api/auth`. */
  basePath?: string;
  /** Where to come back to. Default: the path `voultMiddleware` recorded. */
  returnTo?: string;
}

/** A verified session, or a redirect (to `/session/renew` or the sign-in page). */
export function requireSession(options?: RequireSessionOptions): Promise<VoultSession & { verified: true }>;
