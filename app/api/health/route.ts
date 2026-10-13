// GET /api/health   is the app up, and which database is it reading? Used by the app controls
// (scripts/app-control.mjs status) and by checks that chat and browser share one database path.
import { failure, guard, health, json } from '@/lib/server/api';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  try {
    return json(health());
  } catch (err) {
    return failure(err);
  }
}
