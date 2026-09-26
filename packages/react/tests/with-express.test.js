// Contract test: @voult/react against the real @voult/express router over HTTP
// (Voult itself is the SDK's fake test server). Catches response-shape drift between the two.
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { createElement as h } from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { VoultProvider, useSession, useVoult } from '../src/index.js';

const children = [];
afterEach(() => {
  cleanup();
  children.splice(0).forEach((child) => child.kill('SIGTERM'));
});

/** Real @voult/express + fake Voult in a Node child process; resolves the BFF's apiBase. */
function startBff() {
  const child = spawn(process.execPath, [join(process.cwd(), 'tests/support/bff-server.mjs')], { stdio: ['ignore', 'pipe', 'inherit'] });
  children.push(child);
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.stdout.once('data', (chunk) => {
      const { port } = JSON.parse(String(chunk));
      resolve(`http://127.0.0.1:${port}/api/auth`);
    });
  });
}

/** fetch with a cookie jar, like a browser talking to its own BFF. */
function browserFetch() {
  const jar = new Map();
  return async (url, init = {}) => {
    const cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
    const res = await fetch(url, { ...init, headers: { ...init.headers, ...(cookie && { cookie }) } });
    for (const line of res.headers.getSetCookie()) {
      const [pair] = line.split(';');
      const [name, ...rest] = pair.split('=');
      const value = rest.join('=');
      if (!value || /expires=Thu, 01 Jan 1970/i.test(line)) jar.delete(name);
      else jar.set(name, value);
    }
    return res;
  };
}

it('signs in, reads the session and signs out through a real @voult/express router', async () => {
  const apiBase = await startBff();

  const wrapper = ({ children }) => h(VoultProvider, { apiBase, fetch: browserFetch() }, children);
  const { result } = renderHook(() => ({ session: useSession(), actions: useVoult() }), { wrapper });
  await waitFor(() => expect(result.current.session.status).toBe('unauthenticated'));

  await act(() => result.current.actions.signIn({ email: 'user@example.com', password: 'StrongPass123!' }));
  expect(result.current.session.status).toBe('authenticated');
  expect(result.current.session.user.email).toBe('user@example.com');

  await act(() => result.current.actions.signOut());
  expect(result.current.session.status).toBe('unauthenticated');
});

it('password MFA round trip through the real router', async () => {
  const apiBase = await startBff();

  const wrapper = ({ children }) => h(VoultProvider, { apiBase, fetch: browserFetch() }, children);
  const { result } = renderHook(() => ({ session: useSession(), actions: useVoult() }), { wrapper });
  await waitFor(() => expect(result.current.session.status).toBe('unauthenticated'));

  let outcome;
  await act(async () => { outcome = await result.current.actions.signIn({ email: 'mfa@example.com', password: 'StrongPass123!' }); });
  expect(outcome.mfaRequired).toBe(true);
  expect(result.current.session.status).toBe('mfa_required');

  await act(() => result.current.actions.verifyMfa('123456'));
  expect(result.current.session.status).toBe('authenticated');
});
