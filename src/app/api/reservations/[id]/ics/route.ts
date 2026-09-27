import { NextResponse } from 'next/server';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { reservationIcs } from '@/lib/calendar/icsExport';
import { prismaIcsPorts } from '@/lib/calendar/prismaIcsPorts';

/**
 * CAL-02 (2026-09-27) — GET /api/reservations/[id]/ics: one booking, as an iCalendar file.
 *
 * The house auth + ownership pattern (verified email → 401; the user → 404; the
 * booking by { id, userId: the caller } → 404 — another user's booking and a guest
 * booking alike), decided in src/lib/calendar/icsExport.ts; the text is built by the
 * ONE pure builder (src/lib/calendar/ics.ts) from the caller's own calendar rows for
 * this booking — a stay's one row, a flight's one per stated segment. READ-ONLY:
 * zero writes, no vendor call.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const answer = await reservationIcs(prismaIcsPorts(), { userEmail: await getVerifiedEmail(), reservationId: id });
    if (answer.status !== 200) return NextResponse.json({ error: answer.error }, { status: answer.status });
    return new NextResponse(answer.ics, {
      status: 200,
      headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': `attachment; filename="${answer.filename}"` },
    });
  } catch (err) {
    return failClosedResponse('Booking calendar export', 'Could not export the booking to a calendar file', err);
  }
}
