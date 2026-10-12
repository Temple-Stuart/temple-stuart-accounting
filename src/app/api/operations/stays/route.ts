/**
 * /api/operations/stays — the caller's stays (STAY-01, 2026-10-12).
 *
 * GET  ?day=YYYY-MM-DD (optional) → { stays, covering }: every stay of the
 *      caller, first day first, each as { id, place, starts_on, ends_on } with
 *      both days 'YYYY-MM-DD'; and the one covering `day` (null when none, or
 *      when no day was asked). A day that is not a day is a 400 naming the field.
 * POST { place, starts_on, ends_on } → 201 { stay }: a new stay, read by the one
 *      rule (src/lib/operations/stay.ts stayInput — a 400 names the first bad
 *      field); a stay that meets another of the caller's is refused by name, 409,
 *      before any write; the migration's trigger (STAY_OVERLAP) is the backstop
 *      for a race, answered 409 too. Audited operations_stay_set after the write.
 *
 * The caller's own rows only: the verified cookie, then the user, then every
 * query by user_id. Not public.
 */

import { NextRequest, NextResponse } from 'next/server';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
import { parseDayParam } from '@/lib/operations/routineDay';
import { OVERLAP_TAG, asDate, coveringStay, meeting, overlapWords, stayInput, stayRowOf, type StayRow } from '@/lib/operations/stay';

export async function GET(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const asked = parseDayParam(request.nextUrl.searchParams.get('day'));
    if (!asked.ok) return NextResponse.json({ error: 'Validation', field: 'day', message: asked.message }, { status: 400 });

    const rows = await prisma.operations_stays.findMany({ where: { user_id: user.id }, orderBy: { starts_on: 'asc' } });
    const stays = rows.map(stayRowOf);
    return NextResponse.json({ stays, covering: asked.day === null ? null : coveringStay(stays, asked.day) });
  } catch (error) {
    return failClosedResponse('Stays GET', 'Failed to load the stays', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const read = stayInput(await request.json());
    if (!read.ok) return NextResponse.json({ error: 'Validation', field: read.field, message: read.message }, { status: 400 });
    const { place, startsOn, endsOn } = read.value;

    // Refused by name before any write; the trigger is the backstop for the race.
    const others = (await prisma.operations_stays.findMany({ where: { user_id: user.id } })).map(stayRowOf);
    const met = meeting(others, { startsOn, endsOn });
    if (met.length > 0) return NextResponse.json({ error: 'Conflict', message: overlapWords({ startsOn, endsOn }, met[0]) }, { status: 409 });

    let created: StayRow;
    try {
      created = stayRowOf(await prisma.operations_stays.create({
        data: { user_id: user.id, place, starts_on: asDate(startsOn), ends_on: asDate(endsOn) },
      }));
    } catch (error) {
      if (error instanceof Error && error.message.includes(OVERLAP_TAG)) {
        return NextResponse.json({ error: 'Conflict', message: `${startsOn} to ${endsOn} meets another stay (written moments ago)` }, { status: 409 });
      }
      throw error;
    }

    await writeAuditLog({
      actor: { user_id: user.id, email: userEmail, type: 'human_user' },
      action: { type: 'operations_stay_set', description: `Set a stay: ${place}, ${startsOn} to ${endsOn}` },
      target: { table: 'operations_stays', id: created.id },
      payload: { before: null, after: created },
    });

    return NextResponse.json({ stay: created }, { status: 201 });
  } catch (error) {
    return failClosedResponse('Stays POST', 'Failed to save the stay', error);
  }
}
