import { getSession } from '@voult/next';

export default async function Home() {
  const session = await getSession();
  return (
    <main>
      <h1>Welcome</h1>
      {session
        ? <p>Signed in as <b>{session.user.email}</b>. Manage MFA, passkeys and sessions on your <a href="/account">account</a> page.</p>
        : <p><a href="/login">Sign in</a> · <a href="/signup">Create an account</a></p>}
      <p className="muted">Auth is one route file (<code>app/api/auth/[...voult]/route.js</code>) plus <code>@voult/react</code>. There are no auth routes to write.</p>
    </main>
  );
}
