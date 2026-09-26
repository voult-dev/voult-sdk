import { createElement, useEffect, useState } from 'react';
import { useVoultContext } from './VoultProvider.js';

const LABELS = {
  google: 'Google',
  github: 'GitHub',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  microsoft: 'Microsoft',
  apple: 'Apple',
};

/**
 * URL of @voult/express's `GET /oauth/:provider/start`.
 * @param {string} apiBase
 * @param {string} provider
 * @param {{ intent?: string, returnTo?: string }} [options]
 */
export function oauthStartUrl(apiBase, provider, { intent, returnTo } = {}) {
  const params = new URLSearchParams();
  if (intent) params.set('intent', intent);
  if (returnTo) params.set('returnTo', returnTo);
  const query = params.toString();
  return `${apiBase}/oauth/${encodeURIComponent(provider)}/start${query ? `?${query}` : ''}`;
}

/**
 * A plain link to the provider sign-in: works without JavaScript, keyboard-accessible,
 * and never holds a secret. Extra props (className, style, …) go on the <a>.
 *
 * @param {{ provider: string, intent?: 'authenticate' | 'login' | 'register' | 'link',
 *   returnTo?: string, children?: import('react').ReactNode } & Record<string, unknown>} props
 */
export function OAuthButton({ provider, intent, returnTo, children, ...anchorProps }) {
  const { apiBase } = useVoultContext();
  return createElement(
    'a',
    {
      ...anchorProps,
      href: oauthStartUrl(apiBase, provider, { intent, returnTo }),
      'data-voult-provider': provider,
    },
    children ?? `Continue with ${LABELS[provider] ?? provider}`
  );
}

/**
 * Providers that are enabled and configured for this app (from `GET /oauth/providers`),
 * so you only render buttons that work.
 * @returns {{ providers: string[], loading: boolean, error: Error | null }}
 */
export function useOAuthProviders() {
  const { call } = useVoultContext();
  const [state, setState] = useState({ providers: [], loading: true, error: null });

  useEffect(() => {
    let active = true;
    call('/oauth/providers')
      .then((data) => {
        const providers = Object.entries(data?.providers ?? {}).filter(([, on]) => on).map(([name]) => name);
        if (active) setState({ providers, loading: false, error: null });
      })
      .catch((error) => {
        if (active) setState({ providers: [], loading: false, error });
      });
    return () => {
      active = false;
    };
  }, [call]);

  return state;
}

/**
 * What the hosted-OAuth redirect put in the URL: an error (on your error page) or a
 * newly linked provider (after `intent=link`).
 * @param {string} [search] defaults to the current page's query string
 * @returns {{ error: { code: string, description: string | null } | null, linked: string | null }}
 */
export function getOAuthRedirectResult(search = globalThis.location?.search ?? '') {
  const params = new URLSearchParams(search);
  const code = params.get('voult_error');
  return {
    error: code ? { code, description: params.get('voult_error_description') } : null,
    linked: params.get('voult_linked'),
  };
}
