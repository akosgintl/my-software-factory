// Runs before every request (pages, API routes and static files; there is deliberately no matcher).
// It refuses any request whose Host header is not this app's local address, so that another website
// whose name was pointed at 127.0.0.1 cannot read the server-rendered page, which contains every
// reminder. The API routes repeat this check and add their same-origin rules (lib/server/api.ts).
import type { NextRequest } from 'next/server';
import { isLocalHost, NOT_LOCAL_MESSAGE } from '@/lib/server/local-host';

export function proxy(request: NextRequest) {
  if (isLocalHost(request.headers.get('host'))) return undefined;
  const headers = { 'Cache-Control': 'no-store, max-age=0' };
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return Response.json({ error: { code: 'invalid', message: NOT_LOCAL_MESSAGE, field: null, fields: null, current: null } }, { status: 403, headers });
  }
  return new Response(`${NOT_LOCAL_MESSAGE}\n`, { status: 403, headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8' } });
}
