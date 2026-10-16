import { request, useAction } from '../lib.jsx';

export default function ForgotPassword() {
  const [run, note] = useAction();
  return (
    <>
      <h1>Reset your password</h1>
      <form onSubmit={run(async ({ email }) => (await request('/user/forgot-password', { method: 'POST', body: { email } })).message ?? 'Check your email.')}>
        <input name="email" type="email" aria-label="Email" placeholder="Email" required />
        <button>Email me a reset link</button>
      </form>
      {note}
    </>
  );
}
