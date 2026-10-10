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
  mfa: {
    status(): Promise<{ mfaEnabled: boolean; [key: string]: unknown }>;
    /** Start enrolment: `{ secret, qrCode, backupCodes }`. Confirm with `enable(code)`. */
    setup(): Promise<{ secret: string; qrCode: string; backupCodes: string[]; [key: string]: unknown }>;
    enable(code: string): Promise<unknown>;
    /** `password` can be left out for accounts created with Google/GitHub. */
    disable(input: { code: string; password?: string }): Promise<unknown>;
    regenerateBackupCodes(code: string): Promise<{ backupCodes: string[]; [key: string]: unknown }>;
    /** Abandon a sign-in waiting for its MFA code. */
    cancel(): Promise<void>;
  };
  sessions: {
    list(): Promise<{ sessions: Array<{ id: string; isCurrent?: boolean; [key: string]: unknown }> }>;
    /** Revoking this browser's own session signs it out (`current: true`). */
    revoke(sessionId: string): Promise<{ success: boolean; current: boolean; message?: string }>;
  };
  linkedAccounts: {
    list(): Promise<{ providers: unknown[] }>;
    unlink(provider: string): Promise<{ success: boolean }>;
  };
  passkeys: {
    list(): Promise<unknown>;
    /** WebAuthn creation options for `navigator.credentials.create()` / @simplewebauthn/browser. */
    registrationOptions(deviceName?: string): Promise<{ options: unknown; [key: string]: unknown }>;
    register(credential: unknown, deviceName?: string): Promise<unknown>;
    rename(credentialId: string, deviceName: string): Promise<unknown>;
    remove(credentialId: string): Promise<unknown>;
    loginOptions(email?: string): Promise<{ options: unknown; [key: string]: unknown }>;
    /** Finishes a passkey sign-in; like signIn(). */
    signIn(credential: unknown): Promise<{ mfaRequired: boolean; user?: VoultUser | null }>;
  };
  magicLink: {
    /** Always `{ sent: true }` for a well-formed email, whether or not it has an account. */
    send(email: string, options?: { returnTo?: string }): Promise<{ sent: true }>;
  };
  /** Voult disables the account (it can be re-enabled); this browser is signed out. */
  deleteAccount(): Promise<unknown>;
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
