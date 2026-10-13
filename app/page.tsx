import { connection } from 'next/server';
import { snapshot } from '@/lib/server/api';
import { formatId, parseId } from '@/lib/reminders/format.mjs';
import { RemindersApp } from './ui/RemindersApp';
import type { Snapshot } from './ui/types';

// The page is rendered for every request from the database as it is at that moment: connection()
// keeps it out of the build-time prerender, and nothing here is cached. After that the browser keeps
// it fresh by rereading /api/reminders (see app/ui/RemindersApp.tsx).
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const params = await searchParams;
  const requested = typeof params.r === 'string' ? parseId(params.r) : null;

  let initial: Snapshot | null = null;
  let initialError: string | null = null;
  try {
    initial = snapshot();
  } catch (err) {
    initialError = err instanceof Error ? err.message.charAt(0).toUpperCase() + err.message.slice(1) : 'The reminder database could not be read.';
  }

  return <RemindersApp initial={initial} initialError={initialError} initialSelected={requested ? formatId(requested) : null} />;
}
