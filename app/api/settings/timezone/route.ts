// PUT /api/settings/timezone   save the user's confirmed default timezone (used for new reminders).
import { setDefaultTimezone } from '@/lib/reminders/ops.mjs';
import { failure, guard, json, readBody } from '@/lib/server/api';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request) {
  const blocked = guard(request, { write: true });
  if (blocked) return blocked;
  try {
    const body = await readBody(request);
    return json({ defaultTimezone: setDefaultTimezone(body.timezone) });
  } catch (err) {
    return failure(err);
  }
}
