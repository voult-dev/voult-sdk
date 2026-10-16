import { useVoult } from '@voult/react';
import { go, useAction } from '../lib.jsx';

/** The second step of any sign-in (password, OAuth, magic link) when the account has MFA. */
export default function MfaPrompt({ returnTo = '/account' }) {
  const { verifyMfa, mfa } = useVoult();
  const [run, note] = useAction();
  return (
    <section>
      <h2>Two-factor code</h2>
      <form onSubmit={run(async ({ code }) => { await verifyMfa(code.trim()); go(returnTo); })}>
        <input name="code" aria-label="MFA code" inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit or backup code" required />
        <button>Verify</button>
        <button type="button" onClick={run(async () => { await mfa.cancel(); go('/login'); })}>Cancel</button>
      </form>
      {note}
    </section>
  );
}
