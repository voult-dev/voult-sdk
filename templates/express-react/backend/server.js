import path from 'node:path';
import express from 'express';
import { api } from './api.js';
import { mountAuth } from './auth.js';

// .env when there is one (local dev); hosts like Render set real environment variables instead.
try { process.loadEnvFile(); } catch (err) { if (err.code !== 'ENOENT') throw err; }

const app = express();
app.set('trust proxy', 1);       // correct https URLs behind Render, NGINX, …

mountAuth(app);                  // /api/auth/*: every auth route (backend/auth.js)
app.use('/api', api);            // /api/*: your own routes (backend/api.js)

// In production this server also serves the built frontend (npm run build → dist/).
const dist = path.resolve('dist');
app.use(express.static(dist));
app.get('/{*page}', (req, res, next) => (req.path.startsWith('/api/') ? next() : res.sendFile(path.join(dist, 'index.html'))));

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`API on http://localhost:${port}`));
