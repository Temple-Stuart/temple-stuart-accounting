import { NextResponse } from 'next/server';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { tripIcs } from '@/lib/calendar/icsExport';
import { prismaIcsPorts } from '@/lib/calendar/prismaIcsPorts';

/**
 * CAL-02 (2026-09-27) — GET /api/trips/[id]/ics: a trip's bookings, as one iCalendar file.
 *
 * The house auth + ownership pattern (verified email → 401; the user → 404; the
 * trip by { id, userId: the caller } → 404), decided in src/lib/calendar/icsExport.ts;
 * the caller's own bookings on that trip ({ tripId, userId } — a guest booking,
 * userId null, is never one of them), their calendar rows, and the ONE pure builder
 * (src/lib/calendar/ics.ts). READ-ONLY: zero writes, no vendor call.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const answer = await tripIcs(prismaIcsPorts(), { userEmail: await getVerifiedEmail(), tripId: id });
    if (answer.status !== 200) return NextResponse.json({ error: answer.error }, { status: answer.status });
    return new NextResponse(answer.ics, {
      status: 200,
      headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': `attachment; filename="${answer.filename}"` },
    });
  } catch (err) {
    return failClosedResponse('Trip calendar export', 'Could not export the trip to a calendar file', err);
  }
}
