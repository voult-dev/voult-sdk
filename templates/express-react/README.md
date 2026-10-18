# My Voult app (Express + React)

Sign-up, sign-in (password, Google/GitHub, magic link, passkey), MFA, sessions, linked accounts and password reset, with **no auth code to write**: `backend/auth.js` mounts `@voult/express`, the React app in `frontend/` uses `@voult/react`.

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

```
backend/
  server.js          Express app: mounts the auth routes and your API, serves the built frontend
  auth.js            the auth routes (@voult/express): nothing to write here
  api.js             your own API: requireAuth protects a route (see /api/me)
frontend/
  index.html
  src/pages/         your app's pages (Home, Account)
  src/auth/          sign-in, sign-up, MFA prompt, password reset, email verification
  src/auth/account/  account sections: MFA, passkeys, sessions, linked accounts, sign out / delete
  src/lib.jsx        small helpers, including userMessage() for errors
vite.config.js       dev server: proxies /api to Express and keeps the Host header, so cookies
                     and the OAuth callback stay on one origin
```

One package, one `npm install`, one `npm run dev`: the backend and frontend are separate folders, not separate apps, so the browser only ever talks to one origin (cookies just work).

**Errors.** The pages show users only what they can fix (wrong password, email taken, too many attempts). Anything else is logged (the browser console here, the terminal for the server) and the user sees "Something went wrong". During `npm run dev` the real error is shown on the page too.

## Production

```bash
npm run build && npm start   # one server on $PORT serves the API and the app
```

Set the same variables on your host plus `NODE_ENV=production`, add your real `https://…/api/auth/oauth/callback` under Callback URLs, and run `npx voult doctor`.
