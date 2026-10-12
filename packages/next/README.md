# @voult/next

[Voult](https://github.com/voult-dev/voult) authentication for the Next.js App Router (Next 14.2+): every auth route from one file, `getSession()` / `requireSession()` for Server Components, and an optional guard that redirects signed-out visitors.

## Install

```bash
npm install @voult/next @voult/sdk @voult/react
```

`.env.local` (the same variables as `@voult/express`; `npx voult init` writes them):

```bash
VOULT_CLIENT_ID=
VOULT_CLIENT_SECRET=
VOULT_SESSION_SECRET=   # 32+ random characters: openssl rand -hex 32
```

Add `http://localhost:3000/api/auth/oauth/callback` under **Callback URLs** in the Voult dashboard (it also covers magic links).

## 1. The routes: one file

```js
// app/api/auth/[...voult]/route.js
import { createVoultRouteHandlers } from '@voult/next';

export const { GET, POST, PATCH, DELETE } = createVoultRouteHandlers();
```

That serves the whole router at `/api/auth`: sign-up/in, sign-out, MFA, sessions, linked accounts, passkeys, magic links, hosted OAuth (`/api/auth/oauth/google/start`). It runs on the Node.js runtime (the default for route handlers). Mounted elsewhere? `createVoultRouteHandlers({ basePath: '/auth' })`.

## 2. The browser: `@voult/react`

```jsx
// app/providers.jsx
'use client';
import { VoultProvider } from '@voult/react';
export default function Providers({ children }) {
  return <VoultProvider apiBase="/api/auth">{children}</VoultProvider>;
}
```

Wrap `app/layout.jsx`'s body in `<Providers>`, then use `useSession()`, `useVoult()` and `<OAuthButton>` in client components as with any React app.

## 3. Server Components: `getSession()` / `requireSession()`

```jsx
// app/account/page.jsx
import { requireSession } from '@voult/next';

export default async function Account() {
  const { user } = await requireSession(); // signed out → /login?returnTo=/account
  return <p>Signed in as {user.email}</p>;
}
```

- `getSession()` → `{ user, verified }` or `null`. `verified: true` means Voult confirmed the session on this request, so a revoked session is caught.
- **Why `verified` exists:** access tokens live 15 minutes and Voult rotates the refresh token every time it's used. A Server Component can't write cookies, so it must not renew (the rotated token would be lost and Voult's reuse detection would then end the session). When the access token has expired there, `getSession()` returns the user from the signed session cookie with `verified: false`, and `requireSession()` sends the browser through `/api/auth/session/renew`, which renews in a route handler and comes straight back.
- In route handlers and server actions, `getSession()` renews and sets the cookies itself.
- `requireSession({ signInPath: '/login' })`: change the sign-in page.

**After signing in or out, navigate with a full page load** (`window.location.assign(path)`), not `router.push()`. In production Next prefetches links, so its client router may hold a response fetched while the visitor was signed out (such as the proxy's redirect to `/login`) and replay it after sign-in.

## 4. Optional: redirect signed-out visitors early

```js
// proxy.js on Next 16 (middleware.js on Next 14–15)
import { voultMiddleware } from '@voult/next/middleware';

export default voultMiddleware({ publicPaths: ['/', '/login', '/blog/*'], signInPath: '/login' });
export const config = { matcher: ['/((?!_next/|favicon.ico|.*\\..*).*)'] };
```

Import it from **`@voult/next/middleware`**, not `@voult/next`: that entry point is Edge-safe (WebCrypto only, no `@voult/sdk`).

It only checks that a correctly **signed** session cookie exists, so it is a UX guard, not the authority: it can't see a revoked session. Pages that must be protected call `requireSession()`. It also records the request path so `requireSession()` can send users back after signing in. The auth routes and the sign-in page are always public.

## License

MIT
