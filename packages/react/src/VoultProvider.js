import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { request } from './request.js';

export const VoultContext = createContext(null);

const INITIAL_SESSION = { status: 'loading', user: null, error: null };

/**
 * Session state for everything below it. Talks only to your @voult/express routes
 * (default `/api/auth`); no secrets or tokens ever reach the browser.
 *
 * @param {{ apiBase?: string, fetch?: typeof fetch, children?: import('react').ReactNode }} props
 */
export function VoultProvider({ apiBase = '/api/auth', fetch: fetchImpl, children }) {
  const [session, setSession] = useState(INITIAL_SESSION);
  // Password sign-in returns the MFA pending token in JSON; hosted OAuth keeps it in a cookie.
  const pendingMfaToken = useRef(null);
  const mounted = useRef(true);

  const call = useCallback(
    (path, options = {}) => request(apiBase, path, {
      ...options,
      fetchImpl: fetchImpl ?? ((...args) => globalThis.fetch(...args)),
    }),
    [apiBase, fetchImpl]
  );

  const refresh = useCallback(async () => {
    let next;
    try {
      const data = await call('/session');
      let status = 'unauthenticated';
      if (data?.authenticated) status = 'authenticated';
      else if (data?.mfaPending || pendingMfaToken.current) status = 'mfa_required';
      next = { status, user: data?.authenticated ? data.user ?? null : null, error: null };
    } catch (error) {
      next = { status: 'unauthenticated', user: null, error };
    }
    if (mounted.current) setSession(next);
    return next;
  }, [call]);

  useEffect(() => {
    mounted.current = true;
    refresh();
    return () => {
      mounted.current = false;
    };
  }, [refresh]);

  // After any sign-in response: stop at MFA, or load the new session.
  const finishSignIn = useCallback(async (data) => {
    if (data?.mfaRequired) {
      pendingMfaToken.current = data.mfaPendingToken ?? null;
      if (mounted.current) setSession({ status: 'mfa_required', user: null, error: null });
      return { mfaRequired: true };
    }
    pendingMfaToken.current = null;
    const next = await refresh();
    return { mfaRequired: false, user: next.user };
  }, [refresh]);

  const signIn = useCallback(async ({ email, username, password }) => finishSignIn(
    await call(username && !email ? '/username-login' : '/email-login', {
      method: 'POST',
      body: username && !email ? { username, password } : { email, password },
    })
  ), [call, finishSignIn]);

  const signUp = useCallback(async ({ email, username, password, fullName }) => {
    const data = await call(username && !email ? '/username-register' : '/register', {
      method: 'POST',
      body: { email, username, password, fullName },
    });
    await refresh();
    return data;
  }, [call, refresh]);

  const verifyMfa = useCallback(async (code) => {
    const body = { mfaToken: code };
    if (pendingMfaToken.current) body.mfaPendingToken = pendingMfaToken.current;
    const data = await call('/mfa/verify', { method: 'POST', body });
    pendingMfaToken.current = null;
    await refresh();
    return data;
  }, [call, refresh]);

  const signOut = useCallback(async () => {
    pendingMfaToken.current = null;
    try {
      await call('/logout', { method: 'POST' });
    } finally {
      // The BFF clears its cookies even when Voult fails to revoke; reflect that, then rethrow.
      await refresh();
    }
  }, [call, refresh]);

  // Everything else the router serves, so pages never build URLs. Each returns the router's JSON.
  const features = useMemo(() => {
    const post = (path, body) => call(path, { method: 'POST', body });
    const id = encodeURIComponent;
    return {
      mfa: {
        status: () => call('/mfa/status'),
        setup: () => post('/mfa/setup'),
        enable: (code) => post('/mfa/enable', { code }),
        disable: ({ code, password } = {}) => post('/mfa/disable', { code, password }),
        regenerateBackupCodes: (code) => post('/mfa/backup-codes', { code }),
        /** Abandon a sign-in waiting for its MFA code. */
        cancel: async () => {
          pendingMfaToken.current = null;
          await post('/mfa/cancel');
          await refresh();
        },
      },
      sessions: {
        list: () => call('/sessions'),
        /** Revoking this browser's own session signs it out. */
        revoke: async (sessionId) => {
          const data = await call(`/sessions/${id(sessionId)}`, { method: 'DELETE' });
          if (data?.current) await refresh();
          return data;
        },
      },
      linkedAccounts: {
        list: () => call('/oauth/linked'),
        unlink: (provider) => call(`/oauth/linked/${id(provider)}`, { method: 'DELETE' }),
      },
      passkeys: {
        list: () => call('/passkeys'),
        /** WebAuthn options for `navigator.credentials.create()` / @simplewebauthn/browser. */
        registrationOptions: (deviceName) => post('/passkeys/register/options', { deviceName }),
        register: (credential, deviceName) => post('/passkeys/register/verify', { credential, deviceName }),
        rename: (credentialId, deviceName) => call(`/passkeys/${id(credentialId)}`, { method: 'PATCH', body: { deviceName } }),
        remove: (credentialId) => call(`/passkeys/${id(credentialId)}`, { method: 'DELETE' }),
        loginOptions: (email) => post('/passkeys/login/options', email ? { email } : {}),
        /** Finish a passkey sign-in; like signIn(), resolves `{ mfaRequired }`. */
        signIn: async (credential) => finishSignIn(await post('/passkeys/login/verify', { credential })),
      },
      magicLink: {
        /** Always resolves `{ sent: true }` for a well-formed email, account or not. */
        send: (email, { returnTo } = {}) => post('/magic-link', { email, returnTo }),
      },
      /** Voult disables the account (it can be re-enabled); this browser is signed out. */
      deleteAccount: async () => {
        const data = await call('/user/me', { method: 'DELETE' });
        await refresh();
        return data;
      },
    };
  }, [call, refresh, finishSignIn]);

  const value = useMemo(
    () => ({ ...session, apiBase, call, refresh, signIn, signUp, signOut, verifyMfa, ...features }),
    [session, apiBase, call, refresh, signIn, signUp, signOut, verifyMfa, features]
  );

  return createElement(VoultContext.Provider, { value }, children);
}

export function useVoultContext() {
  const context = useContext(VoultContext);
  if (!context) {
    throw new Error('Voult hooks and components must be used inside <VoultProvider>.');
  }
  return context;
}

/**
 * @returns {{ status: 'loading' | 'authenticated' | 'unauthenticated' | 'mfa_required', user: object | null,
 *   isAuthenticated: boolean, error: Error | null, refresh: () => Promise<unknown> }}
 */
export function useSession() {
  const { status, user, error, refresh } = useVoultContext();
  return { status, user, error, refresh, isAuthenticated: status === 'authenticated' };
}

/**
 * Sign-in actions plus every account feature the router serves (mfa, sessions, linkedAccounts,
 * passkeys, magicLink, deleteAccount). Actions that change who is signed in update the session;
 * failures throw VoultRequestError.
 */
export function useVoult() {
  const { signIn, signUp, signOut, verifyMfa, refresh, mfa, sessions, linkedAccounts, passkeys, magicLink, deleteAccount } =
    useVoultContext();
  return { signIn, signUp, signOut, verifyMfa, refresh, mfa, sessions, linkedAccounts, passkeys, magicLink, deleteAccount };
}
