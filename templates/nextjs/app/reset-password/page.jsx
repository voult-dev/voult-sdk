'use client';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PASSWORD_REQUIREMENTS_MESSAGE } from '@voult/react';
import { request, userMessage } from '../auth-request';

// Opened from the reset email: /reset-password?token=…&appId=…
export default function ResetPassword() {
  const params = useSearchParams();
  const [message, setMessage] = useState(null);
  return (
    <main>
      <h1>Choose a new password</h1>
      <form onSubmit={async (event) => {
        event.preventDefault();
        const { newPassword } = Object.fromEntries(new FormData(event.currentTarget));
        try {
          await request('/user/reset-password', { method: 'POST', body: { token: params.get('token'), appId: params.get('appId'), newPassword } });
          setMessage({ ok: true, text: 'Password changed. You can sign in now.' });
        } catch (err) { setMessage({ ok: false, text: userMessage(err) }); }
      }}>
        <input name="newPassword" type="password" aria-label="New password" placeholder="New password" autoComplete="new-password" required />
        <button>Save</button>
      </form>
      <p className="muted">{PASSWORD_REQUIREMENTS_MESSAGE}</p>
      {message && <p className={message.ok ? 'ok' : 'err'}>{message.text}</p>}
      <p><a href="/login">Sign in</a></p>
    </main>
  );
}
