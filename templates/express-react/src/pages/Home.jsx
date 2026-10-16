import { useSession } from '@voult/react';

export default function Home() {
  const { status, user } = useSession();
  return (
    <>
      <h1>Welcome</h1>
      {status === 'authenticated'
        ? <p>Signed in as <b>{user.email}</b>. Manage MFA, passkeys and sessions on your <a href="/account">account</a> page.</p>
        : <p><a className="button" href="/login">Sign in</a> <a className="button" href="/signup">Create an account</a></p>}
      <p className="muted">Auth is handled by <code>@voult/express</code> (server.js) and <code>@voult/react</code>. There are no auth routes to write.</p>
    </>
  );
}
