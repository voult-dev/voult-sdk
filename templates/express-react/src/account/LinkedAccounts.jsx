import { useCallback, useEffect, useState } from 'react';
import { OAuthButton, getOAuthRedirectResult, useOAuthProviders, useVoult } from '@voult/react';
import { useAction } from '../lib.jsx';

const redirect = getOAuthRedirectResult();

export default function LinkedAccounts() {
  const { linkedAccounts } = useVoult();
  const { providers } = useOAuthProviders();
  const [linked, setLinked] = useState([]);
  const [run, note] = useAction();
  // Voult returns provider names or { provider, … } objects depending on its version.
  const load = useCallback(() => linkedAccounts.list().then((d) => setLinked(d.providers.map((p) => (typeof p === 'string' ? p : p.provider)))), [linkedAccounts]);
  useEffect(() => { load(); }, [load]);

  return (
    <section>
      <h2>Linked accounts</h2>
      {redirect.linked && <p className="ok">Linked {redirect.linked}.</p>}
      {redirect.error && <p className="err">{redirect.error.description ?? redirect.error.code}</p>}
      <ul>
        {linked.map((p) => (
          <li key={p}>{p} <button onClick={run(async () => { await linkedAccounts.unlink(p); await load(); return `Unlinked ${p}.`; })}>Unlink</button></li>
        ))}
      </ul>
      {providers.filter((p) => !linked.includes(p)).map((p) => (
        <OAuthButton key={p} provider={p} intent="link" returnTo="/account" className="button">Link {p}</OAuthButton>
      ))}
      {note}
    </section>
  );
}
