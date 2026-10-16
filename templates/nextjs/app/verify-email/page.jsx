'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { request } from '../auth-request';

// Opened from the verification email: /verify-email?token=…&appId=…
export default function VerifyEmail() {
  const params = useSearchParams();
  const [state, setState] = useState({ text: 'Verifying…' });
  useEffect(() => {
    const query = new URLSearchParams({ token: params.get('token') ?? '', appId: params.get('appId') ?? '' });
    request(`/user/verify-email?${query}`)
      .then(() => setState({ ok: true, text: 'Email verified. You can sign in now.' }))
      .catch((err) => setState({ ok: false, text: err.message }));
  }, [params]);
  return (
    <main>
      <h1>Verify your email</h1>
      <p className={state.ok === undefined ? '' : state.ok ? 'ok' : 'err'}>{state.text}</p>
      <p><a href="/login">Sign in</a></p>
    </main>
  );
}
