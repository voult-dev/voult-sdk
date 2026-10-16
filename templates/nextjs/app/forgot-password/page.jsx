'use client';
import { useState } from 'react';
import { request } from '../auth-request';

export default function ForgotPassword() {
  const [message, setMessage] = useState(null);
  return (
    <main>
      <h1>Reset your password</h1>
      <form onSubmit={async (event) => {
        event.preventDefault();
        const { email } = Object.fromEntries(new FormData(event.currentTarget));
        try {
          const data = await request('/user/forgot-password', { method: 'POST', body: { email } });
          setMessage({ ok: true, text: data.message ?? 'Check your email.' });
        } catch (err) { setMessage({ ok: false, text: err.message }); }
      }}>
        <input name="email" type="email" aria-label="Email" placeholder="Email" required />
        <button>Email me a reset link</button>
      </form>
      {message && <p className={message.ok ? 'ok' : 'err'}>{message.text}</p>}
    </main>
  );
}
