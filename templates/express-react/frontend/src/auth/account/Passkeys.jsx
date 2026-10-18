import { useCallback, useEffect, useState } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import { useVoult } from '@voult/react';
import { useAction } from '../../lib.jsx';

export default function Passkeys() {
  const { passkeys } = useVoult();
  const [list, setList] = useState([]);
  const [run, note] = useAction();
  const load = useCallback(() => passkeys.list().then((d) => setList(d.credentials ?? [])), [passkeys]);
  useEffect(() => { load(); }, [load]);

  return (
    <section>
      <h2>Passkeys</h2>
      <p className="muted">Sign in with Touch ID, Face ID, Windows Hello or a security key instead of a password.</p>
      <form onSubmit={run(async ({ deviceName }) => {
        const { options } = await passkeys.registrationOptions(deviceName);
        await passkeys.register(await startRegistration({ optionsJSON: options }), deviceName);
        await load();
        return 'Passkey added.';
      })}>
        <input name="deviceName" aria-label="Passkey name" placeholder="Name, e.g. MacBook" required />
        <button>Add a passkey</button>
      </form>
      <ul>
        {list.map((p) => (
          <li key={p.id}>
            {p.deviceName}{' '}
            <button onClick={run(async () => {
              const name = prompt('New name', p.deviceName);
              if (name) { await passkeys.rename(p.id, name); await load(); }
            })}>Rename</button>{' '}
            <button onClick={run(async () => { await passkeys.remove(p.id); await load(); return 'Passkey removed.'; })}>Remove</button>
          </li>
        ))}
      </ul>
      {note}
    </section>
  );
}
