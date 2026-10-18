// Calls the router directly, for the few routes @voult/react has no helper for, and turns errors into words for users.
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
 * failures in the browser get plain words; anything else is logged to the console for you and
 * shown as a generic line (with the real error too while `npm run dev` runs).
 */
export function userMessage(err) {
  const code = err?.code ?? err?.name;
  if (code === 'ERROR_CEREMONY_ABORTED' || code === 'NotAllowedError') return 'The passkey prompt was closed. Try again when you are ready.';
  if (code === 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED' || code === 'InvalidStateError') return 'This device already has a passkey for your account.';
  if (USER_FIXABLE.has(err?.status) && err.message) return err.message;

  console.error(err); // for you, the developer
  const passkeySetup = typeof code === 'string' && (code.startsWith('ERROR_INVALID_RP_ID') || code === 'SecurityError' || code.startsWith('WEBAUTHN_'));
  const text = passkeySetup ? 'Passkeys are not available on this site yet.' : GENERIC;
  return process.env.NODE_ENV !== 'production' ? `${text} (dev: ${err?.message ?? err})` : text;
}
