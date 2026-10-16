# My Voult app (Express + React)

Sign-up, sign-in (password, Google/GitHub, magic link, passkey), MFA, sessions, linked accounts and password reset, with **no auth code to write**: `server.js` mounts `@voult/express`, the React app uses `@voult/react`.

## Run it

```bash
npm run dev        # API on :3000, React app on http://localhost:5173
```

No `.env` yet? `npx voult init` writes one (Client ID and Secret from your app in the Voult dashboard).

In the Voult dashboard, add this under **Callback URLs** (it also covers magic links):

```
http://localhost:5173/api/auth/oauth/callback
```

Then `npm run doctor` checks your setup, and turn on Google or GitHub under **Sign-in providers** to get those buttons.

## Where things are

| File | What |
|---|---|
| `server.js` | Express: the Voult router at `/api/auth`, `requireAuth` on your own routes (see `/api/me`), and the built app in production |
| `vite.config.js` | Dev server; proxies `/api` to Express and keeps the `Host` header, so cookies and the OAuth callback stay on one origin |
| `src/pages/` | Home, sign-in, sign-up, MFA prompt, account, password reset, email verification |
| `src/account/` | Account sections: MFA, passkeys, sessions, linked accounts, sign out / delete |

## Production

```bash
npm run build && npm start   # one server on $PORT serves the API and the app
```

Set the same variables on your host plus `NODE_ENV=production`, add your real `https://…/api/auth/oauth/callback` under Callback URLs, and run `npx voult doctor`.
