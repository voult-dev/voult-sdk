import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The frontend lives in frontend/; the build goes to dist/, which backend/server.js serves.
// The browser only talks to this origin: /api goes to the Express server. changeOrigin stays
// false so the Host header (localhost:5173) reaches the server and the OAuth callback URL is
// http://localhost:5173/api/auth/oauth/callback, the one on your app's allowlist.
export default defineConfig({
  root: 'frontend',
  plugins: [react()],
  build: { outDir: '../dist', emptyOutDir: true },
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/api': { target: `http://localhost:${process.env.PORT ?? 3000}`, changeOrigin: false } },
  },
});
