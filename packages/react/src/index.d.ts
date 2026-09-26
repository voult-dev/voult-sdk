import type { ReactElement, ReactNode, AnchorHTMLAttributes } from 'react';

export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'mfa_required';
export type OAuthIntent = 'authenticate' | 'login' | 'register' | 'link';

export interface VoultUser {
  id?: string;
  email?: string;
  username?: string;
  [key: string]: unknown;
}

export interface VoultProviderProps {
  /** Where createVoultRouter() is mounted. Default `/api/auth`. */
  apiBase?: string;
  /** Custom fetch (tests, SSR). Default: global fetch. */
  fetch?: typeof fetch;
  children?: ReactNode;
}

export function VoultProvider(props: VoultProviderProps): ReactElement;

export interface VoultSession {
  status: SessionStatus;
  user: VoultUser | null;
  isAuthenticated: boolean;
  /** Set when the session could not be loaded (e.g. the BFF is down). */
  error: Error | null;
  refresh(): Promise<unknown>;
}

export function useSession(): VoultSession;

export interface SignInInput {
  email?: string;
  username?: string;
  password: string;
}

export interface SignUpInput {
  email?: string;
  username?: string;
  password: string;
  fullName?: string;
}

export interface VoultActions {
  /** Resolves `{ mfaRequired: true }` when a code is needed next (session status becomes `mfa_required`). */
  signIn(input: SignInInput): Promise<{ mfaRequired: boolean; user?: VoultUser | null }>;
  signUp(input: SignUpInput): Promise<unknown>;
  signOut(): Promise<void>;
  /** Finishes MFA for password and OAuth sign-ins alike: pass only the 6-digit (or backup) code. */
  verifyMfa(code: string): Promise<unknown>;
  refresh(): Promise<unknown>;
}

export function useVoult(): VoultActions;

export interface OAuthButtonProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  provider: 'google' | 'github' | 'facebook' | 'linkedin' | 'microsoft' | 'apple' | (string & {});
  intent?: OAuthIntent;
  /** Relative path to land on after sign-in, e.g. `/account`. */
  returnTo?: string;
  children?: ReactNode;
}

export function OAuthButton(props: OAuthButtonProps): ReactElement;

export function useOAuthProviders(): { providers: string[]; loading: boolean; error: Error | null };

export function getOAuthRedirectResult(search?: string): {
  error: { code: string; description: string | null } | null;
  linked: string | null;
};

export function oauthStartUrl(
  apiBase: string,
  provider: string,
  options?: { intent?: OAuthIntent; returnTo?: string }
): string;

export class VoultRequestError extends Error {
  code: string;
  status: number;
  field?: string;
  fields?: Record<string, string>;
}

export function isValidPassword(password: string): boolean;
export function isValidEmail(email: string): boolean;
export function isValidUsername(username: string): boolean;
export const PASSWORD_REQUIREMENTS_MESSAGE: string;
