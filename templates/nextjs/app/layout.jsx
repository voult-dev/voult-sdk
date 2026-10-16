import Link from 'next/link';
import { getSession } from '@voult/next';
import Providers from './providers';
import './globals.css';

export const metadata = { title: 'My Voult app' };
export const dynamic = 'force-dynamic';

// getSession() in a Server Component: who is signed in, read on the server for every page.
export default async function RootLayout({ children }) {
  const session = await getSession();
  return (
    <html lang="en">
      <body>
        <nav>
          <Link href="/">Home</Link>
          <Link href="/account">Account</Link>
          <span className="who">{session ? session.user.email : <a href="/login">Sign in</a>}</span>
        </nav>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
