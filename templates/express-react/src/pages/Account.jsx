import { useSession } from '@voult/react';
import { go } from '../lib.jsx';
import Danger from '../account/Danger.jsx';
import LinkedAccounts from '../account/LinkedAccounts.jsx';
import MfaSettings from '../account/MfaSettings.jsx';
import Passkeys from '../account/Passkeys.jsx';
import Sessions from '../account/Sessions.jsx';

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
