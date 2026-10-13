// POST /api/resolve   what a schedule would be saved as (first occurrence, clock-change notes).
// Writes nothing. Used by the form to show the resolved time before saving.
import { resolveSchedule } from '@/lib/reminders/ops.mjs';
import { scheduleFromForm } from '@/lib/reminders/form.mjs';
import { ReminderError } from '@/lib/reminders/errors.mjs';
import { failure, guard, json, readBody } from '@/lib/server/api';
import { withFormField } from '@/lib/server/form-errors';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const blocked = guard(request, { write: true });
  if (blocked) return blocked;
  let kind = 'none';
  try {
    const body = await readBody(request);
    const form = (body.form ?? {}) as Record<string, unknown>;
    kind = String(form.kind ?? 'none');
    let schedule;
    try {
      schedule = scheduleFromForm(form);
    } catch (err) {
      if (err instanceof ReminderError) return failure(err, { incomplete: true });
      throw err;
    }
    if (schedule === null) return json({ preview: null });
    return json({ preview: resolveSchedule(schedule) });
  } catch (err) {
    return failure(withFormField(err, kind));
  }
}
