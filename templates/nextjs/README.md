# My Voult app (Next.js)

Sign-up, sign-in (password, Google/GitHub, magic link, passkey), MFA, sessions and linked accounts in the App Router, with **no auth code to write**: one route file serves every auth route, `@voult/react` does the UI, and `requireSession()` protects pages on the server.

## Run it

```bash
npm run dev        # http://localhost:3000
```

No `.env` yet? `npx voult init` writes one (Client ID and Secret from your app in the Voult dashboard).

In the Voult dashboard, add this under **Callback URLs** (it also covers magic links):

```
http://localhost:3000/api/auth/oauth/callback
```

Then `npm run doctor` checks your setup, and turn on Google or GitHub under **Sign-in providers** to get those buttons.

## Where things are

| File | What |
|---|---|
| `app/api/auth/[...voult]/route.js` | Every auth route (`@voult/next`) |
| `app/layout.jsx` | `getSession()` in a Server Component: the nav knows who's signed in |
| `app/account/page.jsx` | `requireSession()`: signed-out visitors go to `/login?returnTo=/account` |
| `app/api/me/route.js` | Your own protected API route |
| `proxy.js` | Optional: redirects signed-out visitors before the page renders (`middleware.js` on Next 14–15) |
| `app/sign-in.jsx`, `app/account/panel.jsx` | Client components using `@voult/react` |

After signing in or out, navigate with a full page load (`window.location.assign`), as these pages do: Next's router may hold pages it prefetched while you were signed out.

## Production

```bash
npm run build && npm start
```

Set the same variables on your host (Vercel: Project → Settings → Environment Variables), add your real `https://…/api/auth/oauth/callback` under Callback URLs, and run `npx voult doctor --production` with your production settings.

## Updating Voult

`npx voult upgrade` moves every `@voult/*` package to the latest set released together, lists what changed (breaking changes first) and runs `voult doctor`. Add `--dry-run` to look first. It never edits your code.
