# @voult/react

Session state, sign-in actions and "Continue with Google" buttons for React apps whose server uses
[`@voult/express`](../express). The browser only ever talks to **your** server; tokens stay in
httpOnly cookies and no Voult secret reaches the bundle.

```bash
npm install @voult/react
```

## Quick start

```jsx
import { VoultProvider, useSession, useVoult, OAuthButton } from '@voult/react';

function Account() {
  const { status, user } = useSession();
  const { signOut } = useVoult();
  if (status === 'loading') return <p>Loading…</p>;
  if (status !== 'authenticated') return <OAuthButton provider="google" returnTo="/account" />;
  return <button onClick={signOut}>Sign out {user.email}</button>;
}

export default function App() {
  return <VoultProvider apiBase="/api/auth"><Account /></VoultProvider>;
}
```

`apiBase` is where `createVoultRouter()` is mounted (default `/api/auth`). If the frontend runs on a
different origin in development (e.g. Vite on :5173), proxy `/api` to your server so cookies are
same-site.

## API

| Export | What it does |
|---|---|
| `<VoultProvider apiBase fetch>` | Loads `GET {apiBase}/session` and shares it. `fetch` is optional (tests/SSR) |
| `useSession()` | `{ status, user, isAuthenticated, error, refresh }`. `status`: `loading`, `authenticated`, `unauthenticated`, `mfa_required` |
| `useVoult()` | `signIn({ email or username, password })` → `{ mfaRequired }`, `signUp({ email, password, fullName })`, `signOut()`, `verifyMfa(code)`, `refresh()` |
| `<OAuthButton provider intent returnTo>` | A plain link to `{apiBase}/oauth/:provider/start`. Other props go on the `<a>` |
| `useOAuthProviders()` | `{ providers: ['google', …], loading, error }`: only providers that will work |
| `getOAuthRedirectResult()` | `{ error: { code, description } \| null, linked }` from the URL after an OAuth redirect |
| `VoultRequestError` | What actions throw: `code`, `status`, `message`, `field(s)` |
| `isValidPassword`, `PASSWORD_REQUIREMENTS_MESSAGE`, … | Same rules the API enforces |

### MFA

`signIn` resolves `{ mfaRequired: true }` and `status` becomes `mfa_required`; after an OAuth sign-in
the server sends the browser to `/mfa` and `status` is `mfa_required` too. Either way:

```jsx
const { verifyMfa } = useVoult();
await verifyMfa(code); // then status → 'authenticated'
```

### OAuth errors

The server redirects failures to your error page (`/login` by default) with `?voult_error=`:

```jsx
const { error } = getOAuthRedirectResult();
if (error?.code === 'access_denied') { /* the user cancelled */ }
```

## License

MIT
