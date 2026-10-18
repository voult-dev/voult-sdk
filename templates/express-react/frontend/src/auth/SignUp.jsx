import { PASSWORD_REQUIREMENTS_MESSAGE, useVoult } from '@voult/react';
import { go, useAction } from '../lib.jsx';

export default function SignUp() {
  const { signUp } = useVoult();
  const [run, note] = useAction();
  return (
    <>
      <h1>Create an account</h1>
      <form onSubmit={run(async (values) => {
        const result = await signUp(values);
        if (result?.emailVerificationRequired) return 'Account created. Check your email to verify it, then sign in.';
        go('/account');
      })}>
        <input name="fullName" aria-label="Full name" placeholder="Full name" autoComplete="name" required />
        <input name="email" type="email" aria-label="Email" placeholder="Email" autoComplete="email" required />
        <input name="password" type="password" aria-label="Password" placeholder="Password" autoComplete="new-password" required />
        <button>Create account</button>
      </form>
      <p className="muted">{PASSWORD_REQUIREMENTS_MESSAGE}</p>
      {note}
      <p>Already have an account? <a href="/login">Sign in</a></p>
    </>
  );
}
