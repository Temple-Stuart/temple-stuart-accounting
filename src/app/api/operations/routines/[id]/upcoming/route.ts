/**
 * /api/operations/routines/[id]/upcoming
 *
 * GET — return the next N occurrences of this routine, expanded server-side.
 *       ?count=5 (default 5, max 30). Returns ISO strings in the routine's
 *       timezone-shifted UTC instants.
 *
 *       Used by Section E for forward-looking display. UI never expands
 *       RRULE itself — server is the single source of truth.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { expandForward } from '@/lib/operations/rruleHelpers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { id } = await params;
    const routine = await prisma.operations_routines.findFirst({
      where: { id, user_id: user.id },
    });
    if (!routine) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const sp = request.nextUrl.searchParams;
    const countParam = sp.get('count');
    let count = countParam ? parseInt(countParam, 10) : 5;
    if (!Number.isInteger(count) || count < 1) count = 5;
    if (count > 30) count = 30;

    let upcoming: Date[] = [];
    try {
      upcoming = expandForward(routine.schedule_rrule, routine.timezone, new Date(), count);
    } catch (e) {
      return NextResponse.json(
        { error: 'RRULE', message: e instanceof Error ? e.message : 'failed to expand' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      routine_id: routine.id,
      timezone: routine.timezone,
      occurrences: upcoming.map((d) => d.toISOString()),
    });
  } catch (error) {
    console.error('[Upcoming GET]', error);
    return NextResponse.json(
      { error: 'Failed to expand upcoming', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}
