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

Auth routes will be added in a later step. A valid config currently mounts an empty router.

## License

MIT
