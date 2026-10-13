// How saved values are worded on screen. Times are always shown in the reminder's own timezone,
// exactly as chat reports them (weekday, ISO date, 24-hour time, UTC offset, zone name).
import { splitLocal } from '@/lib/reminders/format.mjs';
import type { Reminder } from './types';

export type StatusKey = 'uncertain' | 'sending' | 'waiting' | 'scheduled' | 'unscheduled' | 'delivered';

export function statusOf(rec: Reminder, nowMs: number): { key: StatusKey; label: string; explain: string } {
  if (rec.state === 'unscheduled') return { key: 'unscheduled', label: 'Not scheduled', explain: 'Kept as text. It is never sent.' };
  if (rec.state === 'completed') return { key: 'delivered', label: 'Delivered', explain: 'This one-off was sent and acknowledged. It will not be sent again unless you give it a new time.' };
  if (rec.pending?.uncertain) {
    return {
      key: 'uncertain',
      label: 'Delivery uncertain',
      explain: 'A check selected this occurrence but never confirmed the message. It is not resent automatically. Tell the chat whether you received it: it will acknowledge it or release it to be sent once more.',
    };
  }
  if (rec.pending) return { key: 'sending', label: 'Being delivered', explain: 'The reminder checker has selected this occurrence and is writing its message in the chat.' };
  if (rec.nextDue && Date.parse(rec.nextDue) <= nowMs) {
    return { key: 'waiting', label: 'Due now', explain: 'Its time has come. It is sent at the reminder checker’s next check, which runs about once a minute while the checker is running and idle.' };
  }
  return { key: 'scheduled', label: 'Scheduled', explain: 'It will be sent in the chat by the reminder checker when its time comes.' };
}

export function dueText(rec: Reminder): { when: string; offset: string } | null {
  const parts = splitLocal(rec.nextLocal);
  if (!parts) return null;
  return { when: `${parts.weekday} ${parts.date} ${parts.time}`, offset: `UTC${parts.offset}` };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "in 3 hours", "in 6 days", "2 minutes ago" — a rough guide beside the exact time, never instead of it. */
export function relativeTime(iso: string | null, nowMs: number): string {
  if (!iso) return '';
  const diff = Date.parse(iso) - nowMs;
  const abs = Math.abs(diff);
  const minutes = Math.round(abs / 60000);
  let amount: string;
  if (minutes < 1) amount = 'less than a minute';
  else if (minutes < 60) amount = plural(minutes, 'minute', 'minutes');
  else if (minutes < 60 * 36) amount = plural(Math.round(minutes / 60), 'hour', 'hours');
  else amount = plural(Math.round(minutes / 1440), 'day', 'days');
  return diff >= 0 ? `in ${amount}` : `${amount} ago`;
}

/** "2026-10-12T06:30:00Z" on the reminder's own clock is shown elsewhere; this is the plain UTC form. */
export const utcText = (iso: string | null) => (iso ? iso.replace('T', ' ').replace(/:00Z$/, ' UTC').replace(/Z$/, ' UTC') : '');

export type GroupKey = 'attention' | 'scheduled' | 'unscheduled' | 'delivered';

export const GROUPS: { key: GroupKey; title: string; empty: string }[] = [
  { key: 'attention', title: 'Needs your attention', empty: '' },
  { key: 'scheduled', title: 'Scheduled', empty: 'Nothing is scheduled.' },
  { key: 'unscheduled', title: 'Not scheduled', empty: 'No unscheduled notes.' },
  { key: 'delivered', title: 'Delivered', empty: 'No delivered one-offs.' },
];

export function groupOf(rec: Reminder): GroupKey {
  if (rec.state === 'unscheduled') return 'unscheduled';
  if (rec.state === 'completed') return 'delivered';
  return rec.pending?.uncertain ? 'attention' : 'scheduled';
}

export function grouped(reminders: Reminder[]): Record<GroupKey, Reminder[]> {
  const out: Record<GroupKey, Reminder[]> = { attention: [], scheduled: [], unscheduled: [], delivered: [] };
  for (const rec of reminders) out[groupOf(rec)].push(rec);
  const byDue = (a: Reminder, b: Reminder) => (a.nextDue ?? '').localeCompare(b.nextDue ?? '') || a.n - b.n;
  out.attention.sort(byDue);
  out.scheduled.sort(byDue);
  out.unscheduled.sort((a, b) => b.n - a.n);
  out.delivered.sort((a, b) => (b.lastDelivered ?? '').localeCompare(a.lastDelivered ?? '') || b.n - a.n);
  return out;
}

/**
 * The notes of a committed change ("NOTE: that local time does not exist…", one per line) as plain
 * sentences for a result notice: the label is dropped and each sentence starts with a capital,
 * as the form's preview shows the same note. Empty when there is no note.
 */
export function noteSentences(note: string | null | undefined): string {
  return (note ?? '')
    .split('\n')
    .map((line) => line.trim().replace(/^NOTE: /, '').replace(/^./, (c) => c.toUpperCase()))
    .filter(Boolean)
    .join(' ');
}

/** One sentence describing a saved reminder, used to confirm a change from the committed record. */
export function savedSentence(rec: Reminder): string {
  if (rec.state === 'unscheduled') return `${rec.id} is saved without a schedule. It is kept as text and never sent.`;
  const due = dueText(rec);
  const when = due ? `${due.when} (${due.offset}, ${rec.tz})` : '';
  if (rec.state === 'completed') return `${rec.id} is saved. It was already delivered${when ? `; it was due ${when}` : ''}.`;
  return `${rec.id} is saved. Next due ${when}. ${rec.ruleLabel}.`;
}
