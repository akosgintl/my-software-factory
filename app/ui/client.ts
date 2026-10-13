// Browser-side calls to the app's own API. Every read is `no-store`: the page must show what is in
// the database now, not what a cache remembered.
import type { ApiError, FormValues, Preview, Reminder, Snapshot } from './types';

export class RequestError extends Error {
  status: number;
  detail: ApiError;
  constructor(status: number, detail: ApiError) {
    super(detail.message);
    this.status = status;
    this.detail = detail;
  }
}

const TIMEOUT_MS = 8000;

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
    });
  } catch (err) {
    const timedOut = err instanceof DOMException && (err.name === 'TimeoutError' || err.name === 'AbortError');
    throw new RequestError(0, {
      code: 'network',
      message: timedOut ? `The app did not answer within ${TIMEOUT_MS / 1000} seconds.` : 'The app could not be reached. Is it still running on this computer?',
      field: null,
      fields: null,
      current: null,
    });
  }
  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    /* handled below */
  }
  if (!response.ok) {
    const detail = (data as { error?: ApiError } | null)?.error;
    throw new RequestError(response.status, detail ?? { code: 'store', message: `The app answered with an error (${response.status}).`, field: null, fields: null, current: null });
  }
  return data as T;
}

export const fetchSnapshot = () => call<Snapshot>('/api/reminders');

export type SaveResult = { reminder: Reminder; note: string; defaultTimezone: string | null; changed?: boolean };

export const createReminder = (form: FormValues, saveDefaultTimezone: boolean) =>
  call<SaveResult>('/api/reminders', { method: 'POST', body: JSON.stringify({ form, saveDefaultTimezone }) });

export const updateReminder = (id: string, body: { expectedRev: number; text?: string; schedule?: FormValues | null; saveDefaultTimezone?: boolean }) =>
  call<SaveResult>(`/api/reminders/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) });

export const removeReminder = (id: string, expectedRev: number) =>
  call<{ removed: Reminder; note: string }>(`/api/reminders/${encodeURIComponent(id)}`, { method: 'DELETE', body: JSON.stringify({ expectedRev }) });

export const previewSchedule = (form: FormValues) => call<{ preview: Preview | null }>('/api/resolve', { method: 'POST', body: JSON.stringify({ form }) });

export const saveDefaultTimezone = (timezone: string) =>
  call<{ defaultTimezone: string }>('/api/settings/timezone', { method: 'PUT', body: JSON.stringify({ timezone }) });
