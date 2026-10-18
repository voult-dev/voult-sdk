import { useState } from 'react';

/** Query string values for the current page. */
export const query = (name) => new URLSearchParams(location.search).get(name);

/** A same-site path (`/x`), never `//other.site` or a full URL. */
export const safePath = (value, fallback = '/account') =>
  typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') ? value : fallback;

/** Full page load: right after signing in or out, so every part of the page starts fresh. */
export const go = (path) => location.assign(path);

/** Calls the router directly, for the few routes @voult/react has no helper for. */
export async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api/auth${path}`, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error?.message ?? `Request failed (${res.status})`), data.error);
  return data;
}

const GENERIC = 'Something went wrong. Please try again.';
// Errors the person in front of the screen can fix: wrong password, email taken, account locked…
const USER_FIXABLE = new Set([400, 401, 403, 404, 409, 422, 423, 429]);

/**
 * The words to show the user for an error. Their own mistakes keep the server's message; passkey
 * failures in the browser get plain words; anything else (a bug, a misconfiguration, Voult
 * unreachable) is logged to the console for you and shown as a generic line. In development
 * (`npm run dev`) the real error is shown on the page too, so you don't have to hunt for it.
 */
export function userMessage(err) {
  const code = err?.code ?? err?.name;
  if (code === 'ERROR_CEREMONY_ABORTED' || code === 'NotAllowedError') return 'The passkey prompt was closed. Try again when you are ready.';
  if (code === 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED' || code === 'InvalidStateError') return 'This device already has a passkey for your account.';
  if (USER_FIXABLE.has(err?.status) && err.message) return err.message;

  console.error(err); // for you, the developer
  const passkeySetup = typeof code === 'string' && (code.startsWith('ERROR_INVALID_RP_ID') || code === 'SecurityError' || code.startsWith('WEBAUTHN_'));
  const text = passkeySetup ? 'Passkeys are not available on this site yet.' : GENERIC;
  return import.meta.env.DEV ? `${text} (dev: ${err?.message ?? err})` : text;
}

/**
 * Form/button handler with a result line: `const [run, note] = useAction();`
 * `run(async (formValues) => 'Done.')` shows the returned text, or the error.
 */
export function useAction() {
  const [message, setMessage] = useState(null);
  const run = (fn) => async (event) => {
    event?.preventDefault?.();
    setMessage(null);
    try {
      const form = event?.currentTarget instanceof HTMLFormElement ? Object.fromEntries(new FormData(event.currentTarget)) : {};
      const text = await fn(form);
      if (text) setMessage({ ok: true, text });
    } catch (err) {
      setMessage({ ok: false, text: userMessage(err) });
    }
  };
  const note = message && <p role={message.ok ? 'status' : 'alert'} className={message.ok ? 'ok' : 'err'}>{message.text}</p>;
  return [run, note];
}
