# @voult/core

The [Voult](https://github.com/voult-dev/voult) auth router on the Fetch API: `Request → Response`.

**You probably want an adapter instead:** [`@voult/express`](../express) for Express, `@voult/next` for Next.js (coming soon). They depend on this package; apps don't install it directly.

## For adapter authors

```js
import { createVoultHandler, loadConfigFromEnv } from '@voult/core';

const handle = createVoultHandler(loadConfigFromEnv());

// Any Fetch API runtime: a Next.js route handler, a Worker, Bun, Deno, Node 20+.
export async function fetch(request) {
  return handle(request, { basePath: '/api/auth' });
}
```

- `basePath`: where the routes are mounted. Requests outside it, or to paths with no route, get `notFound(request)` (default: 404 JSON; return `null` to fall through to your framework).
- The OAuth callback URL is built from the request URL, so pass the URL the browser used (or set `VOULT_OAUTH_CALLBACK_URL`).
- Cookies (httpOnly, `SameSite=Lax`, `Secure` in production) use the same names and signed format as Express + `cookie-parser`.

`getSessionFromRequest(request, config)` gives you the request's `VoultClient` with its session restored, for server-side helpers like `getSession()`.

`@voult/sdk` is a peer dependency. Node 20+ (needs `fetch` and WebCrypto).
