import { Router } from 'express';
import { requireAuth } from '@voult/express';

// Your own API. requireAuth answers 401 JSON unless someone is signed in; req.voult is the
// signed-in user's client (any @voult/sdk function works on it).
export const api = Router();

api.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.voult.getCurrentUser() });
});
