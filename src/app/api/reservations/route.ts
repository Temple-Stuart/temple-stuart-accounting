import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { bookingRowOf } from '@/lib/reservations/bookingRow';
import { bookingCalendarRowsWhere, reservationIdOfCalendarSourceId } from '@/lib/calendar/bookingEvent';

/**
 * BOOKINGS-01 (2026-09-27) — GET /api/reservations: every booking of the caller, newest first.
 *
 * ONE list for all of a user's bookings — attached to a trip or not — each row built
 * by ONE pure leaf (src/lib/reservations/bookingRow.ts bookingRowOf) from facts already
 * recorded: the reservation (STATUS-01's ticketing, cancel intent and last read), the
 * flight's calendar day (CAL-01), the ACCEPTED CHARGE link (MATCH), the POSTED entry
 * that documents the charge (POST-01), the owner's budget-line link (LINK-02).
 *
 * AUTH, the reservations/[id] pattern: getVerifiedEmail → 401; the user row → 404.
 * Every query is scoped to that user: reservations WHERE userId = user.id — a guest
 * row (userId null) and another user's row are never returned. READ-ONLY: zero
 * writes, and no vendor client — nothing here calls a provider.
 *
 * CAL-02 (2026-09-27): a flight now has one calendar row PER SEGMENT (source_id
 * `<id>:seg:<n>`). The rows are read through the one where (bookingCalendarRowsWhere)
 * and folded back to their reservation, so a booking with several rows is still ONE
 * booking here: its day is the earliest stated start_date among its rows (the rows
 * arrive ordered by start_date; the first one kept per reservation).
 */
export async function GET() {
  const userEmail = await getVerifiedEmail();
  if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await prisma.users.findFirst({
    where: { email: { equals: userEmail, mode: 'insensitive' } },
    select: { id: true },
  });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const reservations = await prisma.reservations.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, lane: true, displayName: true, providerConfirmationCode: true, providerBookingId: true,
      status: true, tripId: true, checkinDate: true, checkoutDate: true,
      ticketedAt: true, ticketLimitTime: true, cancelIntentAt: true, lastVendorReadAt: true,
      finalPriceCents: true, currency: true, createdAt: true,
    },
  });
  const ids = reservations.map((r) => r.id);

  const [chargeLinks, postedEntries, budgetLinks, calendarRows] = ids.length === 0
    ? [[], [], [], []]
    : await Promise.all([
        // The bank: an ACCEPTED CHARGE link (a refund's link carries its money event).
        prisma.transaction_reservation_links.findMany({
          where: { userId: user.id, status: 'accepted', moneyEventId: null, reservationId: { in: ids } },
          select: { reservationId: true },
        }),
        // The ledger: a POSTED entry that documents the charge.
        prisma.journal_entries.findMany({
          where: { userId: user.id, document_money_event_id: null, status: 'posted', document_reservation_id: { in: ids } },
          select: { document_reservation_id: true },
        }),
        // The owner's budget-line link, with the line's description.
        prisma.reservation_budget_links.findMany({
          where: { userId: user.id, reservationId: { in: ids } },
          select: { reservationId: true, budgetLineItem: { select: { description: true } } },
        }),
        // A flight's service day: its calendar rows — CAL-02: the bare key and every segment key.
        prisma.calendar_events.findMany({
          where: { user_id: user.id, ...bookingCalendarRowsWhere(ids) },
          orderBy: { start_date: 'asc' },
          select: { source_id: true, start_date: true },
        }),
      ]);

  const matched = new Set(chargeLinks.map((l) => l.reservationId));
  const posted = new Set(postedEntries.map((e) => e.document_reservation_id));
  const lineOf = new Map(budgetLinks.map((b) => [b.reservationId, { description: b.budgetLineItem.description }]));
  // CAL-02: one day per RESERVATION, never per row — the first (earliest) row of each.
  const dayOf = new Map<string, Date>();
  for (const c of calendarRows) {
    if (c.source_id === null) continue;
    const rid = reservationIdOfCalendarSourceId(c.source_id);
    if (!dayOf.has(rid)) dayOf.set(rid, c.start_date);
  }

  const bookings = reservations.map((r) =>
    bookingRowOf({
      reservation: r,
      calendarDay: dayOf.get(r.id) ?? null,
      chargeMatched: matched.has(r.id),
      chargePosted: posted.has(r.id),
      budgetLine: lineOf.get(r.id) ?? null,
    }),
  );
  return NextResponse.json({ bookings });
}
