// Your own API, protected: getSession() in a route handler (it renews an expired access token
// and saves the new cookies here).
import { getSession } from '@voult/next';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: { code: 'AUTHENTICATION_ERROR', message: 'Authentication required', status: 401 } }, { status: 401 });
  return Response.json({ user: session.user });
}
