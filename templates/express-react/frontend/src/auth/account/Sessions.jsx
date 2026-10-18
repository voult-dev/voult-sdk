import { useCallback, useEffect, useState } from 'react';
import { useVoult } from '@voult/react';
import { go, useAction } from '../lib.jsx';

export default function Sessions() {
  const { sessions } = useVoult();
  const [list, setList] = useState([]);
  const [run, note] = useAction();
  const load = useCallback(() => sessions.list().then((d) => setList(d.sessions)), [sessions]);
  useEffect(() => { load(); }, [load]);

  return (
    <section>
      <h2>Where you're signed in</h2>
      <ul>
        {list.map((s) => (
          <li key={s.id}>
            {s.userAgent?.slice(0, 70) || 'Unknown device'}{s.ipAddress && ` · ${s.ipAddress}`}{' '}
            {s.isCurrent && <b>(this browser) </b>}
            <button onClick={run(async () => {
              const { current } = await sessions.revoke(s.id);
              if (current) return go('/login');
              await load();
              return 'Signed out that session.';
            })}>Sign out</button>
          </li>
        ))}
      </ul>
      {note}
    </section>
  );
}
