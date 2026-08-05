import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

// ─── GET /api/runway/match/queue (PR-MATCH-2) ────────────────────────────────
// The user's PROPOSED transaction↔reservation links with the display fields
// the review UI renders, confidence-desc. Auth required (the
// api/runway/route.ts:71-82 pattern); user-scoped by the link's own userId.
// DB-only read — no external calls, so auth + scoping are the whole bar.
export async function GET() {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
      select: { id: true },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const links = await prisma.transaction_reservation_links.findMany({
      where: { userId: user.id, status: 'proposed' },
      orderBy: [{ confidence: 'desc' }, { proposedAt: 'asc' }],
      include: {
        transaction: {
          select: { name: true, merchantName: true, amount: true, date: true, pending: true },
        },
        reservation: {
          select: {
            provider: true, hotelName: true, finalPriceCents: true, currency: true,
            createdAt: true, checkinDate: true, checkoutDate: true,
          },
        },
      },
    });

    // POLISH-4: the UI's collapse-when-empty needs to say "no bookings yet"
    // TRUTHFULLY — one user-scoped count keeps the claim real instead of
    // inferred from an empty proposal queue.
    const reservationCount = await prisma.reservations.count({ where: { userId: user.id } });

    return NextResponse.json({
      reservationCount,
      queue: links.map((l) => ({
        id: l.id,
        confidence: l.confidence,
        rationale: l.matchRationale,
        proposedAt: l.proposedAt,
        transaction: l.transaction,
        reservation: l.reservation,
      })),
    });
  } catch (err) {
    // Includes the MATCH-0-table-missing case — declared, never hidden.
    console.error('[Runway match queue] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not load the match queue' },
      { status: 500 }
    );
  }
}
