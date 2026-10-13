// GET    /api/reminders/R-0007   one reminder, read fresh
// PATCH  /api/reminders/R-0007   change text and/or schedule; body.schedule = null stops sending
// DELETE /api/reminders/R-0007   remove it
// Changes carry `expectedRev`, the revision the browser last saw; a record that changed in between
// is not overwritten (409 with the current record).
import { getReminder, removeReminder, updateReminder } from '@/lib/reminders/ops.mjs';
import { scheduleFromForm } from '@/lib/reminders/form.mjs';
import { ReminderError } from '@/lib/reminders/errors.mjs';
import { failure, guard, json, readBody } from '@/lib/server/api';
import { withFormField } from '@/lib/server/form-errors';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

function revOf(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new ReminderError('invalid', 'the revision of the reminder being changed is missing or not a number. Nothing was saved.');
  }
  return value;
}

export async function GET(request: Request, context: Context) {
  const blocked = guard(request);
  if (blocked) return blocked;
  try {
    const { id } = await context.params;
    return json({ reminder: getReminder(id) });
  } catch (err) {
    return failure(err);
  }
}

export async function PATCH(request: Request, context: Context) {
  const blocked = guard(request, { write: true });
  if (blocked) return blocked;
  let kind = 'none';
  try {
    const { id } = await context.params;
    const body = await readBody(request);
    const changes: { text?: unknown; schedule?: unknown } = {};
    if (body.text !== undefined) changes.text = body.text;
    if (body.schedule === null) changes.schedule = null;
    else if (body.schedule !== undefined) {
      const form = body.schedule as Record<string, unknown>;
      kind = String(form.kind ?? 'none');
      changes.schedule = scheduleFromForm(form); // null when the form says "no schedule"
    }
    if (changes.text === undefined && changes.schedule === undefined) {
      throw new ReminderError('invalid', 'nothing to change was sent. Nothing was saved.');
    }
    const result = updateReminder(id, changes, { expectedRev: revOf(body.expectedRev), saveDefaultTimezone: body.saveDefaultTimezone === true });
    return json(result);
  } catch (err) {
    return failure(withFormField(err, kind));
  }
}

export async function DELETE(request: Request, context: Context) {
  const blocked = guard(request, { write: true });
  if (blocked) return blocked;
  try {
    const { id } = await context.params;
    const body = await readBody(request);
    return json(removeReminder(id, { expectedRev: revOf(body.expectedRev) }));
  } catch (err) {
    return failure(err);
  }
}
