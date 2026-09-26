# @voult/express

Mountable Express BFF for the [Voult Authentication API](https://github.com/voult-dev/voult).

## Install

```bash
npm install @voult/express @voult/sdk express
```

`express` and `@voult/sdk` are peer dependencies.

## Quick start

```js
import express from 'express';
import { createVoultRouter, loadConfigFromEnv } from '@voult/express';

const app = express();
const config = loadConfigFromEnv();

app.use('/api/auth', createVoultRouter({ config }));
app.listen(3000);
```

## Environment

```bash
VOULT_BASE_URL=
VOULT_CLIENT_ID=
VOULT_CLIENT_SECRET=
VOULT_SESSION_STRATEGY= # cookie (default) or bearer
VOULT_SESSION_SECRET=   # cookie strategy only
VOULT_APP_URL=          # your frontend, e.g. http://localhost:5173 — where OAuth sends users back
VOULT_OAUTH_CALLBACK_URL= # optional; override the computed OAuth callback URL (proxies)
```

Legacy aliases (`CLIENT_ID`, `CLIENT_SECRET`, `BASE_URL`, `SESSION_SECRET`, `APP_URL`) still work and emit a one-time deprecation warning at startup.

## Public API

```ts
export { createVoultRouter } from './router.js';
export { createVoultMiddleware } from './middleware.js';
export { loadConfigFromEnv } from './config.js';
export { requireAuth } from './requireAuth.js';
```

### Protect your own routes

```js
import { createVoultMiddleware, createVoultRouter, requireAuth } from '@voult/express';

app.use(createVoultMiddleware());              // req.voult on every request
app.use('/api/auth', createVoultRouter());
app.get('/api/orders', requireAuth, (req, res) => {
  const user = req.voult.getCurrentUser();     // { id, email, … }
  res.json({ orders: [], user });
});
```

`requireAuth` answers `401` JSON when nobody is signed in, and renews an expired access cookie from the refresh cookie first.

Auth routes (mount wherever you want, e.g. `/api/auth`):

| Method | Path |
|--------|------|
| GET | `/session` |
| POST | `/register` |
| POST | `/username-register` |
| POST | `/email-login` |
| POST | `/username-login` |
| POST | `/logout` |
| POST | `/sessions/refresh` |
| GET | `/user/me` |
| PATCH | `/user/me` |
| POST | `/user/forgot-password` |
| POST | `/user/reset-password` |
| GET | `/user/verify-email` |
| POST | `/mfa/verify` |
| GET | `/mfa/status` |
| GET | `/oauth/providers` |
| GET | `/oauth/:provider/start` |
| GET | `/oauth/callback` |

Each request gets a fresh `VoultClient` on `req.voult`. Cookie strategy (default) stores tokens in httpOnly cookies; bearer strategy returns tokens in JSON.

## Sign in with Google, GitHub, …

No provider keys in your `.env`, and no extra server code: the routes above are already mounted.

1. **Voult dashboard → your app → Sign-in providers:** paste the provider's Client ID and Secret, and register the callback URL shown there with the provider.
2. **Voult dashboard → your app → Callback URLs:** add this server's callback, e.g. `http://localhost:3000/api/auth/oauth/callback` (and your production one).
3. **Link to it from your frontend:**

```html
<a href="/api/auth/oauth/google/start?returnTo=/account">Continue with Google</a>
```

`GET /oauth/:provider/start` query options:

| Param | Default | |
|---|---|---|
| `intent` | `authenticate` | `authenticate` (sign in or create), `login`, `register`, or `link` (adds the provider to the signed-in user) |
| `returnTo` | `oauth.successPath` | Where to land after sign-in. Relative paths only; anything else is ignored |

Where users land (on `VOULT_APP_URL`, or this server's origin if unset), configurable with `createVoultRouter({ oauth: { … } })`:

| Option | Default | When |
|---|---|---|
| `successPath` | `/` | Signed in (unless `returnTo` was given). After linking, `?voult_linked=<provider>` is added |
| `mfaPath` | `/mfa` | The user has MFA on: show a code prompt and `POST /mfa/verify { mfaToken }`. The pending token is in a cookie, so you don't pass it. `GET /session` returns `mfaPending: true` meanwhile |
| `errorPath` | `/login` | Anything failed: `?voult_error=<CODE>&voult_error_description=<text>` (e.g. `access_denied` when the user cancels) |

`GET /oauth/providers` returns `{ providers: { google: true, github: false, … } }` (enabled **and** configured; cached for 60s) so you can render only the buttons that work.

**Security built in:** each sign-in is tied to the browser that started it (a signed, httpOnly nonce cookie Voult echoes back as `state`), so a callback link opened elsewhere is rejected; `returnTo` can't point at another site.

**Behind a proxy (Render, NGINX, …)** set `app.set('trust proxy', 1)` so the computed callback URL uses `https`, or set `VOULT_OAUTH_CALLBACK_URL`. Hosted OAuth needs the cookie session strategy.

## License

MIT
