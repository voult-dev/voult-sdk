# @voult/express

Mountable Express BFF for the [Voult Authentication API](https://github.com/voult-dev/voult).

## Install

```bash
npm install @voult/express voult-sdk express
```

`express` and `voult-sdk` are peer dependencies.

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
VOULT_SESSION_SECRET=   # cookie strategy (default)
VOULT_APP_URL=          # optional
```

Legacy aliases (`CLIENT_ID`, `CLIENT_SECRET`, `BASE_URL`, `SESSION_SECRET`, `APP_URL`) still work and emit a one-time deprecation warning at startup.

## Public API

```ts
export { createVoultRouter } from './router.js';
export { createVoultMiddleware } from './middleware.js';
export { loadConfigFromEnv } from './config.js';
```

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

Each request gets a fresh `VoultClient` on `req.voult`. Cookie strategy (default) stores tokens in httpOnly cookies; bearer strategy returns tokens in JSON.

## License

MIT
