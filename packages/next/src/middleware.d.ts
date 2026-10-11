import type { NextRequest, NextResponse } from 'next/server';

export interface VoultMiddlewareOptions {
  /** Paths anyone can open: exact (`/about`) or a prefix (`/blog/*`). Default `['/']`. The sign-in path and the auth routes are always public. */
  publicPaths?: string[];
  /** Default `/login`. Signed-out visitors land here with `?returnTo=`. */
  signInPath?: string;
  /** Where the auth routes live. Default `/api/auth`. */
  basePath?: string;
  /** Default `process.env.VOULT_SESSION_SECRET`. */
  sessionSecret?: string;
}

export function voultMiddleware(options?: VoultMiddlewareOptions): (request: NextRequest) => Promise<NextResponse>;
