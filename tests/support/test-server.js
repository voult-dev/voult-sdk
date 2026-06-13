import http from 'node:http';
import { once } from 'node:events';

const VALID_ACCESS_TOKENS = ['signup-token', 'access-1', 'access-2'];

function userFromBody(body) {
  return {
    id: body.id ?? 'user-1',
    email: body.email ?? 'user@example.com',
    fullName: body.fullName ?? body.name ?? 'Test User',
    username: body.username,
    isEmailVerified: body.isEmailVerified ?? true,
    createdAt: body.createdAt ?? '2026-01-01T00:00:00.000Z',
    updatedAt: body.updatedAt ?? '2026-01-01T00:00:00.000Z',
    isLocked: body.isLocked ?? false,
    lastLoginAt: body.lastLoginAt ?? '2026-01-01T00:00:00.000Z',
    app: body.app ?? { id: 'app-1' },
  };
}

function profile() {
  return {
    id: 'user-1',
    email: 'user@example.com',
    name: 'Profile User',
    fullName: 'Profile User',
    isEmailVerified: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    isLocked: false,
    lastLoginAt: '2026-01-01T00:00:00.000Z',
    app: { id: 'app-1' },
  };
}

function send(res, statusCode, payload, headers = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    ...headers,
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function accessTokenFrom(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
}

function requireAuth(req, res, state) {
  const token = accessTokenFrom(req);
  if (!VALID_ACCESS_TOKENS.includes(token)) {
    send(res, 401, { code: 'AUTHENTICATION_ERROR', message: 'Unauthorized' });
    return false;
  }
  return true;
}

function oauthResponse(body) {
  return {
    success: true,
    user: userFromBody(body),
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
  };
}

function handleOAuth(req, res, body, provider, action) {
  if (provider === 'google') {
    if (!body.idToken && !body.accessToken) {
      send(res, 400, { code: 'VALIDATION_ERROR', message: 'Google idToken or accessToken is required' });
      return;
    }
  } else if (provider === 'facebook') {
    if (!body.accessToken) {
      send(res, 400, { code: 'VALIDATION_ERROR', message: 'Facebook accessToken is required' });
      return;
    }
  } else if (provider === 'apple') {
    if (!body.code || !body.idToken) {
      send(res, 400, { code: 'VALIDATION_ERROR', message: 'Apple code and idToken are required' });
      return;
    }
  } else if (!body.code) {
    send(res, 400, { code: 'VALIDATION_ERROR', message: `${provider} authorization code is required` });
    return;
  }

  send(res, 200, oauthResponse({ ...body, email: `${provider.toLowerCase()}@example.com`, fullName: `${provider} User` }));
}

export async function startTestServer() {
  const state = {
    requests: [],
    refreshCount: 0,
    expiredTokenAttempts: 0,
    oauthAccountsPrimaryFails: false,
    oauthUnlinkPrimaryFails: false,
  };

  const server = http.createServer(async (req, res) => {
    try {
      const body = await readBody(req);
      const url = new URL(req.url, 'http://localhost');
      const path = url.pathname;
      const query = Object.fromEntries(url.searchParams.entries());

      state.requests.push({
        method: req.method,
        path,
        query,
        body,
        headers: req.headers,
      });

      if (path === '/api/auth/register') {
        if (body.email === 'conflict@example.com') {
          send(res, 409, { code: 'USER_EXISTS', message: 'User already exists' });
          return;
        }
        send(res, 200, { success: true, message: 'Registered', user: userFromBody(body), token: 'signup-token' });
        return;
      }

      if (path === '/api/auth/username-register') {
        send(res, 200, { success: true, message: 'Registered', user: userFromBody(body), token: 'signup-token' });
        return;
      }

      if (path === '/api/auth/email-login') {
        if (body.password === 'wrong') {
          send(res, 401, { code: 'AUTHENTICATION_ERROR', message: 'Invalid credentials' });
          return;
        }
        if (body.email === 'locked@example.com') {
          send(res, 401, { code: 'ACCOUNT_LOCKED', message: 'Account locked' });
          return;
        }
        send(res, 200, oauthResponse(body));
        return;
      }

      if (path === '/api/auth/username-login') {
        if (body.password === 'wrong') {
          send(res, 401, { code: 'AUTHENTICATION_ERROR', message: 'Invalid credentials' });
          return;
        }
        send(res, 200, oauthResponse(body));
        return;
      }

      if (path === '/api/send-magic-link') {
        send(res, 200, { success: true, message: 'Magic link sent' });
        return;
      }

      if (path === '/api/validate-magic-link') {
        send(res, 200, oauthResponse({ ...body, email: 'magic@example.com', fullName: 'Magic User' }));
        return;
      }

      if (path === '/api/user/me') {
        if (req.method === 'GET') {
          if (accessTokenFrom(req) === 'expired-token') {
            state.expiredTokenAttempts += 1;
            send(res, 401, { code: 'AUTHENTICATION_ERROR', message: 'Expired token' });
            return;
          }
          if (!requireAuth(req, res, state)) {
            return;
          }
          send(res, 200, profile());
          return;
        }

        if (req.method === 'PATCH') {
          if (!requireAuth(req, res, state)) {
            return;
          }
          const updated = { ...profile(), fullName: body.fullName };
          send(res, 200, { success: true, message: 'Profile updated', user: updated });
          return;
        }
      }

      if (path === '/api/user/forgot-password') {
        send(res, 200, { message: 'If that email exists, a reset link has been sent' });
        return;
      }

      if (path === '/api/user/reset-password') {
        send(res, 200, { message: 'Password reset successful' });
        return;
      }

      if (path === '/api/user/verify-email') {
        send(res, 200, { message: 'Email verified successfully' });
        return;
      }

      if (path === '/api/user/disable') {
        if (!requireAuth(req, res, state)) {
          return;
        }
        send(res, 200, { success: true, message: 'Account disabled successfully' });
        return;
      }

      if (path === '/api/user/reenable') {
        if (!requireAuth(req, res, state)) {
          return;
        }
        send(res, 200, { success: true, message: 'Account re-enabled successfully. Please log in again.' });
        return;
      }

      if (path === '/api/sessions') {
        if (!requireAuth(req, res, state)) {
          return;
        }
        send(res, 200, { sessions: [{ id: 'session-1', device: 'Chrome' }] });
        return;
      }

      if (path === '/api/sessions/refresh') {
        state.refreshCount += 1;
        if (body.refreshToken !== 'refresh-1') {
          send(res, 401, { code: 'AUTHENTICATION_ERROR', message: 'Invalid refresh token' });
          return;
        }
        send(res, 200, { accessToken: 'access-2', refreshToken: 'refresh-1' });
        return;
      }

      if (path.startsWith('/api/sessions/revoke/')) {
        if (!requireAuth(req, res, state)) {
          return;
        }
        send(res, 200, { message: 'Session revoked successfully' });
        return;
      }

      if (path === '/api/auth/google/login' || path === '/api/auth/google/register') {
        handleOAuth(req, res, body, 'google');
        return;
      }

      if (path === '/api/auth/github/login' || path === '/api/auth/github/register') {
        handleOAuth(req, res, body, 'GitHub');
        return;
      }

      if (path === '/api/auth/facebook/login' || path === '/api/auth/facebook/register') {
        handleOAuth(req, res, body, 'Facebook');
        return;
      }

      if (path === '/api/auth/linkedin/login' || path === '/api/auth/linkedin/register') {
        handleOAuth(req, res, body, 'LinkedIn');
        return;
      }

      if (path === '/api/auth/microsoft/login' || path === '/api/auth/microsoft/register') {
        handleOAuth(req, res, body, 'Microsoft');
        return;
      }

      if (path === '/api/auth/apple/login' || path === '/api/auth/apple/register') {
        handleOAuth(req, res, body, 'Apple');
        return;
      }

      const oauthLinkMatch = path.match(/^\/api\/oauth\/([^/]+)\/link$/);
      if (oauthLinkMatch) {
        if (!requireAuth(req, res, state)) {
          return;
        }
        send(res, 200, { redirectUrl: `https://oauth.example.test/link/${oauthLinkMatch[1]}` });
        return;
      }

      if (path === '/api/me/oauth-accounts') {
        if (!requireAuth(req, res, state)) {
          return;
        }
        if (state.oauthAccountsPrimaryFails) {
          send(res, 500, { code: 'SERVER_ERROR', message: 'Primary endpoint unavailable' });
          return;
        }
        send(res, 200, { providers: ['google', 'github'] });
        return;
      }

      if (path === '/api/me/oauth') {
        if (!requireAuth(req, res, state)) {
          return;
        }
        send(res, 200, { providers: ['facebook'] });
        return;
      }

      const oauthUnlinkMatch = path.match(/^\/api\/me\/oauth(?:-accounts)?\/([^/]+)$/);
      if (oauthUnlinkMatch) {
        if (!requireAuth(req, res, state)) {
          return;
        }
        if (state.oauthUnlinkPrimaryFails && path.includes('/oauth-accounts/')) {
          send(res, 500, { code: 'SERVER_ERROR', message: 'Primary endpoint unavailable' });
          return;
        }
        send(res, 200, { success: true });
        return;
      }

      if (path === '/api/me/set-password') {
        if (!requireAuth(req, res, state)) {
          return;
        }
        send(res, 200, { success: true });
        return;
      }

      send(res, 404, { code: 'NOT_FOUND', message: 'Not found' });
    } catch (error) {
      send(res, 500, { code: 'TEST_SERVER_ERROR', message: error.message });
    }
  });

  server.listen(0);
  await once(server, 'listening');

  const address = server.address();
  return {
    server,
    baseURL: `http://127.0.0.1:${address.port}`,
    state,
  };
}
