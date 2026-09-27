import { NextRequest, NextResponse } from 'next/server';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { reservationIdentity } from '@/lib/reservations/lane';

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
//   • lines[]    — LINK-02 (2026-09-27): each of the trip's budget lines with
//                  the bookings the OWNER linked to it (reservation_budget_links,
//                  written only by POST /api/reservations/[id]/budget-link — never
//                  a matcher, a name or an amount). Per linked booking: its name,
//                  status, the vendor price + currency AS RECORDED (null = not
//                  stated), and whether its CHARGE has an accepted bank link (a
//                  human's accept in Runway; a refund's link is not a payment).
//                  The line's status is derived by src/lib/trips/lineStatus.ts —
//                  this route computes no status, no sum across a line, no net.
// HONESTY NOTE: a line with no link is "Saved" — the planned figure alone. A
// booking is on a line only because its owner said so; nothing here infers it.
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
        // LANE-01: the one reader's inputs.
        lane: true, displayName: true, providerConfirmationCode: true, providerBookingId: true,
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
        // LANE-01: the one reader — the stated name, or the lane and the reference.
        label: reservationIdentity(r).name,
        provider: r.provider,
        status: r.status,
        // SEC-03: NULL when the vendor stated no price — the lens says so, never $0.
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

    // ── LINK-02: per budget line, the bookings the owner linked to it ─────────
    const budgetLines = await prisma.budget_line_items.findMany({
      where: { tripId: trip.id, userId: user.id },
      select: { id: true, description: true, coaCode: true, amount: true },
      orderBy: { createdAt: 'asc' },
    });
    const budgetLinks = budgetLines.length
      ? await prisma.reservation_budget_links.findMany({
          where: { userId: user.id, budgetLineItemId: { in: budgetLines.map((l) => l.id) } },
          select: {
            budgetLineItemId: true,
            linkedAt: true,
            reservation: {
              select: {
                id: true, status: true, finalPriceCents: true, currency: true,
                lane: true, displayName: true, providerConfirmationCode: true, providerBookingId: true,
              },
            },
          },
          orderBy: { linkedAt: 'asc' },
        })
      : [];
    // "Paid" = the booking's CHARGE has an accepted bank link (moneyEventId null — a refund's accepted link is not a payment).
    const chargeAccepted = budgetLinks.length
      ? await prisma.transaction_reservation_links.findMany({
          where: { userId: user.id, status: 'accepted', moneyEventId: null, reservationId: { in: budgetLinks.map((b) => b.reservation.id) } },
          select: { reservationId: true },
        })
      : [];
    const paidIds = new Set(chargeAccepted.map((c) => c.reservationId));
    const lines = budgetLines.map((l) => ({
      budgetLineItemId: l.id,
      description: l.description,
      coaCode: l.coaCode,
      // The planned amount AS RECORDED (a Decimal serializes as its string) — never netted against a booking.
      amount: l.amount,
      links: budgetLinks
        .filter((b) => b.budgetLineItemId === l.id)
        .map((b) => ({
          reservationId: b.reservation.id,
          // LANE-01: the one reader — the stated name, or the lane and the reference.
          displayName: reservationIdentity(b.reservation).name,
          status: b.reservation.status,
          // SEC-03: the vendor price AS RECORDED — null when the vendor stated none, never 0.
          finalPriceCents: b.reservation.finalPriceCents,
          currency: b.reservation.currency,
          bankConfirmed: paidIds.has(b.reservation.id),
          linkedAt: b.linkedAt,
        })),
    }));

    return NextResponse.json({ booked, unplanned, window, lines });
  } catch (err) {
    return failClosedResponse('Trip actuals', 'Could not load trip actuals', err);
  }
}
