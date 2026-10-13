// GET  /api/reminders   every reminder, read from the database at request time (never cached)
// POST /api/reminders   create one from the browser form
import { createReminder } from '@/lib/reminders/ops.mjs';
import { scheduleFromForm } from '@/lib/reminders/form.mjs';
import { failure, guard, json, readBody, snapshot } from '@/lib/server/api';
import { withFormField } from '@/lib/server/form-errors';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  try {
    return json(snapshot());
  } catch (err) {
    return failure(err);
  }
}

export async function POST(request: Request) {
  const blocked = guard(request, { write: true });
  if (blocked) return blocked;
  let kind = 'none';
  try {
    const body = await readBody(request);
    const form = (body.form ?? {}) as Record<string, unknown>;
    kind = String(form.kind ?? 'none');
    const schedule = scheduleFromForm(form) ?? undefined;
    const result = createReminder({ text: form.text, schedule, saveDefaultTimezone: body.saveDefaultTimezone === true });
    return json(result, 201);
  } catch (err) {
    return failure(withFormField(err, kind));
  }
}
