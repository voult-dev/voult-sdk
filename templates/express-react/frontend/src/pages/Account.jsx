import { useSession } from '@voult/react';
import { go } from '../lib.jsx';
import Danger from '../auth/account/Danger.jsx';
import LinkedAccounts from '../auth/account/LinkedAccounts.jsx';
import MfaSettings from '../auth/account/MfaSettings.jsx';
import Passkeys from '../auth/account/Passkeys.jsx';
import Sessions from '../auth/account/Sessions.jsx';

export default function Account() {
  const { status, user } = useSession();
  if (status === 'loading') return null;
  if (status !== 'authenticated') { go(`/login?returnTo=${encodeURIComponent('/account')}`); return null; }
  return (
    <>
      <h1>Account</h1>
      <p>Signed in as <b>{user.email}</b>.</p>
      <MfaSettings />
      <Passkeys />
      <Sessions />
      <LinkedAccounts />
      <Danger />
    </>
  );
}
