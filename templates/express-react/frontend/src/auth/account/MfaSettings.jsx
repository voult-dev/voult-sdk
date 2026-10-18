import { useCallback, useEffect, useState } from 'react';
import { useVoult } from '@voult/react';
import { useAction } from '../../lib.jsx';

export default function MfaSettings() {
  const { mfa } = useVoult();
  const [status, setStatus] = useState(null);
  const [setup, setSetup] = useState(null);
  const [codes, setCodes] = useState(null);
  const [run, note] = useAction();
  const load = useCallback(() => mfa.status().then(setStatus), [mfa]);
  useEffect(() => { load(); }, [load]);
  if (!status) return null;

  return (
    <section>
      <h2>Two-factor authentication: {status.mfaEnabled ? 'on' : 'off'}</h2>
      {status.mfaEnabled ? (
        <>
          <form onSubmit={run(async ({ code }) => { setCodes((await mfa.regenerateBackupCodes(code)).backupCodes); return 'New backup codes below. The old ones no longer work.'; })}>
            <input name="code" aria-label="Code for new backup codes" inputMode="numeric" placeholder="Current code" required />
            <button>New backup codes</button>
          </form>
          {codes && <pre>{codes.join('\n')}</pre>}
          <form onSubmit={run(async ({ code, password }) => { await mfa.disable({ code, password }); await load(); return 'Two-factor authentication is off.'; })}>
            <input name="password" type="password" aria-label="Password" placeholder="Password (if you have one)" autoComplete="current-password" />
            <input name="code" aria-label="Code to turn off MFA" inputMode="numeric" placeholder="Current code" required />
            <button>Turn off</button>
          </form>
        </>
      ) : setup ? (
        <>
          <p>Scan with your authenticator app, or enter <code>{setup.secret}</code>.</p>
          <img src={setup.qrCode} alt="QR code for your authenticator app" width="180" height="180" />
          <p>Save these backup codes somewhere safe. Each works once if you lose your phone:</p>
          <pre>{setup.backupCodes.join('\n')}</pre>
          <form onSubmit={run(async ({ code }) => { await mfa.enable(code.trim()); setSetup(null); await load(); return 'Two-factor authentication is on.'; })}>
            <input name="code" aria-label="Code to turn on MFA" inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" required />
            <button>Turn on</button>
          </form>
        </>
      ) : (
        <button onClick={run(async () => { setSetup(await mfa.setup()); })}>Set up two-factor authentication</button>
      )}
      {note}
    </section>
  );
}
