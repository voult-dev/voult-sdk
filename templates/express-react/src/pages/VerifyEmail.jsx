import { useEffect, useState } from 'react';
import { query, request } from '../lib.jsx';

// Opened from the verification email: /verify-email?token=…&appId=…
export default function VerifyEmail() {
  const [state, setState] = useState({ text: 'Verifying…' });
  useEffect(() => {
    const params = new URLSearchParams({ token: query('token') ?? '', appId: query('appId') ?? '' });
    request(`/user/verify-email?${params}`)
      .then(() => setState({ ok: true, text: 'Email verified. You can sign in now.' }))
      .catch((err) => setState({ ok: false, text: err.message }));
  }, []);
  return (
    <>
      <h1>Verify your email</h1>
      <p className={state.ok === undefined ? '' : state.ok ? 'ok' : 'err'}>{state.text}</p>
      <p><a href="/login">Sign in</a></p>
    </>
  );
}
