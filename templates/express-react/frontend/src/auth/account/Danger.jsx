import { useVoult } from '@voult/react';
import { go } from '../lib.jsx';

export default function Danger() {
  const { signOut, deleteAccount } = useVoult();
  return (
    <section>
      <h2>Session</h2>
      <button onClick={async () => { await signOut(); go('/'); }}>Sign out</button>{' '}
      <button onClick={async () => { if (confirm('Delete your account? You will be signed out.')) { await deleteAccount(); go('/'); } }}>Delete account</button>
    </section>
  );
}
