// Helpers shared by the route handlers: fresh (never cached) JSON responses, one error shape, and
// a same-origin guard. The app has no accounts and listens on 127.0.0.1 only, so the guard exists
// to stop another website open in the same browser from reading or changing reminders. Its Host
// check is also applied to every other route, the page included, by proxy.ts.
import { ReminderError, HTTP_STATUS } from '@/lib/reminders/errors.mjs';
import { listReminders, storeStatus } from '@/lib/reminders/ops.mjs';
import { dbLocation, pollSeconds } from '@/lib/reminders/paths.mjs';
import type { Snapshot } from '@/app/ui/types';
import { isLocalHost, NOT_LOCAL_MESSAGE } from './local-host';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' };

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: NO_STORE });
}

const sentence = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Turns any thrown value into the API's error response. */
export function failure(err: unknown, extra: Record<string, unknown> = {}): Response {
  if (err instanceof ReminderError) {
    const status = (HTTP_STATUS as Record<string, number>)[err.code] ?? 500;
    return json({ error: { code: err.code, message: sentence(err.message), field: err.field ?? null, fields: err.fields ?? null, current: err.current ?? null, ...extra } }, status);
  }
  const message = err instanceof Error ? err.message : String(err);
  console.error('[reminders] unexpected error:', err);
  return json({ error: { code: 'store', message: `The reminder database could not be used: ${message}`, field: null, fields: null, current: null } }, 500);
}

/** Rejects requests that do not come from this app's own pages (or a local tool such as curl). */
export function guard(request: Request, { write = false } = {}): Response | null {
  const host = request.headers.get('host') ?? '';
  if (!isLocalHost(host)) {
    return json({ error: { code: 'invalid', message: NOT_LOCAL_MESSAGE, field: null, fields: null, current: null } }, 403);
  }
  const site = request.headers.get('sec-fetch-site');
  const origin = request.headers.get('origin');
  const foreignOrigin = origin !== null && origin !== 'null' && (() => {
    try {
      return new URL(origin).host.toLowerCase() !== host.toLowerCase();
    } catch {
      return true;
    }
  })();
  if ((site !== null && site !== 'same-origin' && site !== 'none') || foreignOrigin || origin === 'null') {
    return json({ error: { code: 'invalid', message: 'Requests from other sites are not accepted.', field: null, fields: null, current: null } }, 403);
  }
  if (write && !(request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) {
    return json({ error: { code: 'invalid', message: 'Send changes as JSON.', field: null, fields: null, current: null } }, 415);
  }
  return null;
}

/** Reads a JSON object body; anything else is an input error. */
export async function readBody(request: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ReminderError('invalid', 'the request body is not valid JSON. Nothing was saved.');
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new ReminderError('invalid', 'the request body must be a JSON object. Nothing was saved.');
  }
  return body as Record<string, unknown>;
}

/** Everything the page shows, read from the database at this moment. */
export function snapshot(): Snapshot {
  const data = listReminders();
  return { ...data, pollSeconds: pollSeconds(), isolated: dbLocation().isolated } as Snapshot;
}

export function health() {
  return { ok: true, app: 'reminders', ...storeStatus() };
}
