import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { buildManualEvent, type ManualEventInput } from '@/lib/calendar/manualEvent';
import { MANUAL_EVENT_SOURCE } from '@/lib/calendar/sources';

/**
 * EVENT-01 — the ONE writer of a hand-entered calendar event.
 * ONEOFF-01 (2026-09-18) — THE CALENDAR AUTHORS NOTHING: POST IS GONE.
 *
 * Before this route, src/app/api/calendar/route.ts was GET-ONLY: no form, no
 * route and no programmatic path wrote a calendar_event by hand. EVENT-01 gave
 * it POST, PATCH and DELETE. The founder then ruled that the calendar is the
 * VIEW and nothing is authored there: a one-off is a routine that happens once
 * (cadence "once", /api/operations/routines), planned in Tasks with its lines
 * and its place, and it logs here like every other routine. So:
 *
 *   POST   — REMOVED. A method the route does not export answers 405. No new
 *            row with source 'manual' is written by anything in the repo.
 *   PATCH  correct an EXISTING hand-entered row — the owner re-states it and
 *          the row is replaced in place.
 *   DELETE remove one.
 *
 * Existing manual rows are the calendar's own; nothing here migrates or
 * deletes them, and their links (LINK-01) stay valid.
 *
 * USER-SCOPED THROUGHOUT. Every read and every write carries BOTH
 * `user_id = the caller` AND `source = 'manual'`:
 *   • another user's row is simply NOT FOUND — a defensive 404, never a 403,
 *     because confirming the row exists is itself a leak (the repo's rule);
 *   • a TRIP, AGENDA or BUDGET row is its owner path's record. This route will
 *     not edit or delete one, and says so with its reason rather than failing
 *     silently or pretending the row was not there.
 *
 * The arithmetic and the vocabulary are not here: src/lib/calendar/manualEvent.ts
 * validates the input and builds the row from the category census, so a test can
 * check both without a database.
 *
 * NO GEOCODING, NO PROVIDER, NO METERED CALL. Coordinates arrive from the form
 * as two numbers or not at all — see the PR body's STEP 0.5 finding.
 */

async function caller() {
  const email = await getVerifiedEmail();
  if (!email) return null;
  return prisma.users.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true },
  });
}

/** The row shape every verb answers with. */
const SELECT = `
  id, user_id, source, title, description, category, icon, color,
  start_date, end_date, start_time, end_time, location, latitude, longitude,
  coa_code, budget_amount, is_recurring, recurrence_rule
`;

/**
 * Why this row cannot be edited here — or null when it can. Reads the row ONCE
 * without scoping to source, so the refusal can name what the row actually is;
 * the user scope is never relaxed, so another user's row is still not found.
 */
async function refusalFor(id: string, userId: string): Promise<{ status: number; error: string } | null> {
  const rows = await prisma.$queryRaw<{ source: string }[]>`
    SELECT source FROM calendar_events WHERE id = ${id}::uuid AND user_id = ${userId}
  `;
  if (rows.length === 0) {
    // Not the caller's, or not there at all — the same answer either way.
    return { status: 404, error: 'No event with that id.' };
  }
  const source = rows[0].source;
  if (source !== MANUAL_EVENT_SOURCE) {
    return {
      status: 409,
      error: `This event came from ${source}, which owns it — it is edited or removed where it was created, not here. Only an event added by hand can be changed on the calendar.`,
    };
  }
  return null;
}

export async function PATCH(request: NextRequest) {
  const user = await caller();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: ManualEventInput & { id?: string };
  try {
    body = (await request.json()) as ManualEventInput & { id?: string };
  } catch {
    return NextResponse.json({ error: 'A JSON body is required.' }, { status: 400 });
  }
  const id = (body?.id ?? '').trim();
  if (!id) return NextResponse.json({ error: 'id is required.' }, { status: 400 });

  const refusal = await refusalFor(id, user.id);
  if (refusal) return NextResponse.json({ error: refusal.error }, { status: refusal.status });

  const built = buildManualEvent(body, user.id);
  if (!built.ok) return NextResponse.json({ error: built.reason }, { status: 400 });
  const r = built.row;

  // A correction RE-STATES the event: every field the form carries is written,
  // so clearing a cost or a time actually clears it rather than leaving the old
  // value behind. The scope is repeated on the UPDATE itself — the check above
  // is not the gate, the WHERE is.
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `UPDATE calendar_events SET
       title = $1, description = $2, category = $3, icon = $4, color = $5,
       start_date = $6::date, start_time = $7::time, end_time = $8::time,
       location = $9, latitude = $10, longitude = $11,
       coa_code = $12, budget_amount = $13, updated_at = NOW()
     WHERE id = $14::uuid AND user_id = $15 AND source = $16
     RETURNING ${SELECT}`,
    r.title, r.description, r.category, r.icon, r.color,
    r.start_date, r.start_time, r.end_time, r.location, r.latitude, r.longitude,
    r.coa_code, r.budget_amount, id, user.id, MANUAL_EVENT_SOURCE,
  );
  if (rows.length === 0) return NextResponse.json({ error: 'No event with that id.' }, { status: 404 });

  return NextResponse.json({ event: rows[0] });
}

export async function DELETE(request: NextRequest) {
  const user = await caller();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = (new URL(request.url).searchParams.get('id') ?? '').trim();
  if (!id) return NextResponse.json({ error: 'id is required.' }, { status: 400 });

  const refusal = await refusalFor(id, user.id);
  if (refusal) return NextResponse.json({ error: refusal.error }, { status: refusal.status });

  const removed = await prisma.$queryRaw<{ id: string }[]>`
    DELETE FROM calendar_events
    WHERE id = ${id}::uuid AND user_id = ${user.id} AND source = ${MANUAL_EVENT_SOURCE}
    RETURNING id
  `;
  if (removed.length === 0) return NextResponse.json({ error: 'No event with that id.' }, { status: 404 });

  return NextResponse.json({ id: removed[0].id, deleted: removed.length });
}
