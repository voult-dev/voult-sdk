import { PASSWORD_REQUIREMENTS_MESSAGE } from '@voult/react';
import { query, request, useAction } from '../lib.jsx';

// Opened from the reset email: /reset-password?token=…&appId=…
export default function ResetPassword() {
  const [run, note] = useAction();
  return (
    <>
      <h1>Choose a new password</h1>
      <form onSubmit={run(async ({ newPassword }) => {
        await request('/user/reset-password', { method: 'POST', body: { token: query('token'), appId: query('appId'), newPassword } });
        return 'Password changed. You can sign in now.';
      })}>
        <input name="newPassword" type="password" aria-label="New password" placeholder="New password" autoComplete="new-password" required />
        <button>Save</button>
      </form>
      <p className="muted">{PASSWORD_REQUIREMENTS_MESSAGE}</p>
      {note}
      <p><a href="/login">Sign in</a></p>
    </>
  );
}
