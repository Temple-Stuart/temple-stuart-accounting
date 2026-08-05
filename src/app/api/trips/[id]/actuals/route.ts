import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

// ─── GET /api/trips/[id]/actuals (PR-MATCH-3) — the travel LENS ──────────────
// Read-only per-trip rollup of REAL money against the plan:
//   • booked[]   — the trip's reservations, each with its ACCEPTED bank links
//                  (transaction_reservation_links.status='accepted' ONLY —
//                  proposed ≠ actual; a human accepted these in Runway).
//   • unplanned[] — bank transactions inside the trip's date window, outflow-
//                  signed (house: amount > 0), with NO accepted link to ANY
//                  reservation — the FX-fee/extras bucket that hit the books
//                  during the trip but was never budgeted. DISPLAY-ONLY: no
//                  trip-tagging writes (tagging is a future ruling).
// HONESTY NOTE: this is a RESERVATION-level lens. Reservations have no link
// to budget_line_items (the TripBudgetActual.tsx:22-26 gap; MATCH-0 linked
// transactions↔reservations, deliberately not reservations↔lines), so
// per-budget-line "booked" mapping is structurally impossible without a new
// gated link table — never guessed here by vendor-name heuristics.
//
// Auth: the trips/[id] house pattern — verified email → user → trip ownership
// findFirst({id, userId}) → defensive 404. Guest fence holds transitively:
// reservations are further scoped userId = user.id.
const MS_PER_DAY = 86_400_000;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tripId } = await params;
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
      select: { id: true },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const trip = await prisma.trips.findFirst({
      where: { id: tripId, userId: user.id },
      select: { id: true, startDate: true, endDate: true },
    });
    if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });

    // ── booked: the trip's reservations + their ACCEPTED links ───────────────
    const reservations = await prisma.reservations.findMany({
      where: { tripId: trip.id, userId: user.id },
      select: {
        id: true, provider: true, hotelName: true, finalPriceCents: true,
        currency: true, status: true, createdAt: true, checkinDate: true, checkoutDate: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    const acceptedForTrip = reservations.length
      ? await prisma.transaction_reservation_links.findMany({
          where: {
            userId: user.id,
            status: 'accepted',
            reservationId: { in: reservations.map((r) => r.id) },
          },
          include: { transaction: { select: { id: true, name: true, amount: true, date: true } } },
        })
      : [];
    const linksByReservation = new Map<string, typeof acceptedForTrip>();
    for (const l of acceptedForTrip) {
      const arr = linksByReservation.get(l.reservationId) ?? [];
      arr.push(l);
      linksByReservation.set(l.reservationId, arr);
    }
    const booked = reservations.map((r) => {
      const links = linksByReservation.get(r.id) ?? [];
      return {
        reservationId: r.id,
        label: r.hotelName ?? `${r.provider} booking`,
        provider: r.provider,
        status: r.status,
        finalPriceCents: r.finalPriceCents,
        currency: r.currency,
        createdAt: r.createdAt,
        checkinDate: r.checkinDate,
        checkoutDate: r.checkoutDate,
        // Bank actual ONLY from accepted links — null when none (absence is
        // honest; the UI says "not bank-confirmed yet", never fakes a match).
        actual: links.length
          ? {
              totalCents: Math.round(links.reduce((s, l) => s + l.transaction.amount, 0) * 100),
              transactions: links.map((l) => ({
                id: l.transaction.id,
                name: l.transaction.name,
                amount: l.transaction.amount,
                date: l.transaction.date,
              })),
            }
          : null,
      };
    });

    // ── unplanned: in-window outflows with no accepted link ANYWHERE ─────────
    // Excluded by ANY accepted link (user-wide), not just this trip's: a charge
    // identified as some OTHER booking is not "unplanned trip spend" either.
    let unplanned: Array<{
      id: string; name: string; merchantName: string | null;
      amount: number; date: Date; pending: boolean;
    }> = [];
    const window = trip.startDate && trip.endDate
      ? { start: trip.startDate, end: trip.endDate }
      : null;
    if (window) {
      const endExclusive = new Date(window.end.getTime() + MS_PER_DAY); // inclusive end day
      const inWindow = await prisma.transactions.findMany({
        where: {
          amount: { gt: 0 }, // house outflow semantics (MATCH-1 STEP 0)
          date: { gte: window.start, lt: endExclusive },
          accounts: { userId: user.id },
        },
        select: { id: true, name: true, merchantName: true, amount: true, date: true, pending: true },
        orderBy: { date: 'asc' },
      });
      if (inWindow.length) {
        const acceptedAll = await prisma.transaction_reservation_links.findMany({
          where: { userId: user.id, status: 'accepted', transactionId: { in: inWindow.map((t) => t.id) } },
          select: { transactionId: true },
        });
        const linkedIds = new Set(acceptedAll.map((l) => l.transactionId));
        unplanned = inWindow.filter((t) => !linkedIds.has(t.id));
      }
    }

    return NextResponse.json({ booked, unplanned, window });
  } catch (err) {
    console.error('[Trip actuals] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not load trip actuals' },
      { status: 500 }
    );
  }
}
