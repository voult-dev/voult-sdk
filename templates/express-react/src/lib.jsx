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
      setMessage({ ok: false, text: err.message });
    }
  };
  const note = message && <p role={message.ok ? 'status' : 'alert'} className={message.ok ? 'ok' : 'err'}>{message.text}</p>;
  return [run, note];
}
