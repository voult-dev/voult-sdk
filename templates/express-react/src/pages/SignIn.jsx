import { startAuthentication } from '@simplewebauthn/browser';
import { OAuthButton, getOAuthRedirectResult, useOAuthProviders, useSession, useVoult } from '@voult/react';
import { go, query, safePath, useAction } from '../lib.jsx';
import MfaPrompt from './MfaPrompt.jsx';

const oauthError = getOAuthRedirectResult().error;

export default function SignIn() {
  const { status } = useSession();
  const { signIn, magicLink, passkeys } = useVoult();
  const { providers } = useOAuthProviders();
  const [run, note] = useAction();
  const returnTo = safePath(query('returnTo'));
  const done = ({ mfaRequired }) => { if (!mfaRequired) go(returnTo); };

  if (status === 'authenticated') { go(returnTo); return null; }
  if (status === 'mfa_required') return <MfaPrompt returnTo={returnTo} />;

  return (
    <>
      <h1>Sign in</h1>
      {oauthError && <p className="err" role="alert">{oauthError.description ?? oauthError.code}</p>}
      <section>
        <form onSubmit={run(async ({ email, password }) => done(await signIn({ email, password })))}>
          <input name="email" type="email" aria-label="Email" placeholder="Email" autoComplete="email" required />
          <input name="password" type="password" aria-label="Password" placeholder="Password" autoComplete="current-password" required />
          <button>Sign in</button>
        </form>
        <p className="muted"><a href="/forgot-password">Forgot your password?</a> · <a href="/signup">Create an account</a></p>
      </section>
      {providers.length > 0 && (
        <section>
          {providers.map((p) => <OAuthButton key={p} provider={p} returnTo={returnTo} className="button">Continue with {p}</OAuthButton>)}
        </section>
      )}
      <section>
        <form onSubmit={run(async ({ email }) => { await magicLink.send(email, { returnTo }); return 'Check your email for a sign-in link.'; })}>
          <input name="email" type="email" aria-label="Magic link email" placeholder="Email me a sign-in link" required />
          <button>Send link</button>
        </form>
        <button onClick={run(async () => {
          const { options } = await passkeys.loginOptions();
          done(await passkeys.signIn(await startAuthentication({ optionsJSON: options })));
        })}>Sign in with a passkey</button>
      </section>
      {note}
    </>
  );
}
