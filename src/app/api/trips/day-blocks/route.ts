/**
 * GET /api/trips/day-blocks?date=YYYY-MM-DD
 *
 * The travel SOURCE for the CE-8B day timeline (sibling to
 * /api/operations/daily-plan/items, which feeds task blocks). Day-scoped,
 * CROSS-TRIP (user-scoped — trips have no entity), auth identical to the task
 * sibling (getVerifiedEmail → user). Returns the trip_itinerary rows that fall
 * on `date`:
 *   • once  rows → the block's date (homeDate) is `date`.
 *   • daily rows → homeDate <= date <= destDate (the SCENE pattern: a daily
 *     template shows on every day its range covers).
 *
 * Per-row payload carries vendor_name (fallback vendor), the @db.Time block
 * window (raw ISO so the client reuses minuteOfDayFromTime, exactly as scenes
 * read routine_step.time_of_day), cost, coa_code, recurrence, tripId, and the
 * itinerary row id. No render, no behavior change to commit/uncommit.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

/** YYYY-MM-DD → UTC-midnight Date, or null if malformed. */
function parseDayUtc(v: string | null): Date | null {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const dayStart = parseDayUtc(searchParams.get('date'));
    if (!dayStart) {
      return NextResponse.json(
        { error: 'Validation', field: 'date', message: 'date must be a valid YYYY-MM-DD date' },
        { status: 400 }
      );
    }
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    // Selection rule for date D (homeDate/destDate are DateTime @ UTC midnight):
    //   once : homeDate in [D, D+1)
    //   daily: homeDate < D+1  AND  destDate >= D   (homeDate <= D <= destDate)
    const rows = await prisma.trip_itinerary.findMany({
      where: {
        trip: { userId: user.id },
        OR: [
          { recurrence: 'once', homeDate: { gte: dayStart, lt: dayEnd } },
          { recurrence: 'daily', homeDate: { lt: dayEnd }, destDate: { gte: dayStart } },
        ],
      },
      select: {
        id: true,
        tripId: true,
        vendor: true,
        vendor_name: true,
        cost: true,
        coa_code: true,
        recurrence: true,
        block_start_time: true,
        block_end_time: true,
      },
      orderBy: [{ block_start_time: 'asc' }, { id: 'asc' }],
    });

    const blocks = rows.map((r) => ({
      id: r.id,
      tripId: r.tripId,
      // Clean vendor name (PR 3 capture) with the legacy vendor as fallback.
      vendorName: r.vendor_name || r.vendor,
      cost: Number(r.cost),
      coaCode: r.coa_code,
      recurrence: r.recurrence,
      // Raw @db.Time ISO ("1970-01-01T22:00:00.000Z") — the client extracts the
      // minute with minuteOfDayFromTime, the SAME path scenes use for time_of_day.
      blockStartTime: r.block_start_time ? r.block_start_time.toISOString() : null,
      blockEndTime: r.block_end_time ? r.block_end_time.toISOString() : null,
    }));

    return NextResponse.json({ blocks });
  } catch (error) {
    console.error('Travel day-blocks load error:', error);
    return NextResponse.json({ error: 'Failed to load travel day blocks' }, { status: 500 });
  }
}
