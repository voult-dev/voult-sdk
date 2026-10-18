import { useSession } from '@voult/react';
import { go } from '../lib.jsx';
import MfaPrompt from './MfaPrompt.jsx';

// Hosted OAuth and magic links send accounts with MFA here (oauth.mfaPath, default /mfa).
export default function Mfa() {
  const { status } = useSession();
  if (status === 'authenticated') { go('/account'); return null; }
  if (status === 'unauthenticated') { go('/login'); return null; }
  return status === 'mfa_required' ? <><h1>Finish signing in</h1><MfaPrompt /></> : null;
}
