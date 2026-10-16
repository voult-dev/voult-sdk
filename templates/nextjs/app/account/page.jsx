import { requireSession } from '@voult/next';
import AccountPanel from './panel';

export const dynamic = 'force-dynamic';

// requireSession(). Signed out → /login?returnTo=/account. Access token expired in this
// Server Component → /api/auth/session/renew?returnTo=/account, which renews and comes back.
export default async function Account() {
  const { user } = await requireSession();
  return (
    <main>
      <h1>Account</h1>
      <p>Signed in as <b>{user.email}</b></p>
      <AccountPanel />
    </main>
  );
}
