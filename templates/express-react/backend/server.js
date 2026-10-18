import path from 'node:path';
import express from 'express';
import { createVoultMiddleware, createVoultRouter, requireAuth } from '@voult/express';

const app = express();
app.set('trust proxy', 1);                       // correct https URLs behind Render, NGINX, …
app.use(createVoultMiddleware());                // req.voult on every request
app.use('/api/auth', createVoultRouter());       // every auth route: sign-in, MFA, sessions, passkeys, …

// Your own API. requireAuth answers 401 JSON unless someone is signed in.
app.get('/api/me', requireAuth, (req, res) => res.json({ user: req.voult.getCurrentUser() }));

// In production this server also serves the built React app (npm run build).
app.use(express.static('dist'));
app.get('/{*page}', (req, res, next) => (req.path.startsWith('/api/') ? next() : res.sendFile(path.resolve('dist/index.html'))));

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`API on http://localhost:${port}`));
