/**
 * /api/operations/travel-day — THE DAY'S TRAVEL FACTS, AS STATED (TRAVEL-01a, Alex, 2026-10-31).
 *
 * GET ?day=YYYY-MM-DD → { day, planned, bookings, segments, counts }: the travel facts of one day from three
 * sources, each row labelled by its source, nothing merged, guessed or converted (src/lib/operations/travelDay.ts
 * decides every shape, word and order; this route keeps the gate, the reads and the answer):
 *   · planned  — the caller's trip_itinerary rows on the day (through the trip's owner), by the day-blocks
 *                selection rule restated in the leaf — this route does NOT read /api/trips/day-blocks, which
 *                stays as it is until CLEAN-SHOP retires it;
 *   · bookings — the caller's reservations checking in or out on the day (userId = user.id: a guest row, userId
 *                null, is never returned), each with the ACCEPTED charge link, the POSTED entry and the budget-line
 *                link when present — the same four facts GET /api/reservations loads (BOOKINGS-01), read the same
 *                way, handed to the same leaf (bookingRowOf);
 *   · segments — the calendar_events rows of source 'reservation' on the day, read ONLY through
 *                bookingCalendarRowsWhere over the ids of the caller's own reservations (never by trip, never by
 *                source alone), each with its reservation's facts as above.
 *
 * THE GATE, the order of its /api/operations siblings (operations/stays/route.ts :28-36): getVerifiedEmail → 401;
 * the users row → 404; then `day`, a 'YYYY-MM-DD' day or a 400 naming the field. The middleware answers a guest
 * before this runs (src/middleware.ts :223-226, a 307 to the landing: /api/operations is not a public path).
 * Every query names user.id. Another user's day answers the caller's OWN facts — three empty lists at most —
 * never a 404 that confirms anything. No paid call, no vendor client, no write.
 *
 * READ BY NOTHING YET. The day card takes this read in TRAVEL-01b (dayReads.ts — its eight reads become nine);
 * until then no component or module calls it. No `$`, no conversion, no `||`, no `?? <default>` here: a missing
 * fact is null and the leaf says so.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { bookingCalendarRowsWhere, reservationIdOfCalendarSourceId } from '@/lib/calendar/bookingEvent';
import {
  bookingsSelectionOf, dayRangeOf, plannedSelectionOf, segmentsSelectionOf, travelDayOf,
  type BookingIn, type PlannedIn, type SegmentIn,
} from '@/lib/operations/travelDay';

/** The reservation columns the one leaf reads (bookingRow.ts BookingRowReservation), plus the provider the card names. */
const RESERVATION_SELECT = {
  id: true, lane: true, displayName: true, provider: true, providerConfirmationCode: true, providerBookingId: true,
  status: true, tripId: true, checkinDate: true, checkoutDate: true,
  ticketedAt: true, ticketLimitTime: true, cancelIntentAt: true, lastVendorReadAt: true,
  finalPriceCents: true, currency: true, createdAt: true,
} as const;

/** Every trip_itinerary column the leaf hands over, as stored. */
const PLANNED_SELECT = {
  id: true, tripId: true, category: true, vendor: true, vendor_name: true, cost: true, coa_code: true, recurrence: true,
  homeDate: true, homeTime: true, destDate: true, destTime: true, duration_minutes: true,
  start_zone: true, end_zone: true, start_at: true, end_at: true, block_start_time: true, block_end_time: true,
  vendorOptionId: true, vendorOptionType: true, note: true,
} as const;

/** The calendar_events columns a segment row hands over, as stated. */
const SEGMENT_SELECT = {
  source_id: true, title: true, status: true, start_date: true, end_date: true, start_time: true, end_time: true,
  start_at: true, end_at: true, start_zone: true, end_zone: true,
} as const;

export async function GET(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } }, select: { id: true } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const read = dayRangeOf(request.nextUrl.searchParams.get('day'));
    if (!read.ok) return NextResponse.json({ error: 'Validation', field: read.field, message: read.message }, { status: 400 });
    const range = read.range;

    const [planned, dayBookings, ownReservations] = await Promise.all([
      // 1. The planner's rows on the day, through the trip's owner.
      prisma.trip_itinerary.findMany({ where: { trip: { userId: user.id }, ...plannedSelectionOf(range) }, select: PLANNED_SELECT }),
      // 2. The caller's bookings checking in or out on the day.
      prisma.reservations.findMany({ where: { userId: user.id, ...bookingsSelectionOf(range) }, select: RESERVATION_SELECT }),
      // 3. The keys the segments are read through: every reservation of the caller's own.
      prisma.reservations.findMany({ where: { userId: user.id }, select: { id: true } }),
    ]);

    const ownIds = ownReservations.map((r) => r.id);
    const segments: SegmentIn[] = ownIds.length === 0
      ? []
      : await prisma.calendar_events.findMany({
          where: { user_id: user.id, ...bookingCalendarRowsWhere(ownIds), ...segmentsSelectionOf(range) },
          select: SEGMENT_SELECT,
        });

    // The booking facts behind the day's bookings AND the segments' reservations — one set, each reservation once.
    const loaded = new Map(dayBookings.map((r) => [r.id, r]));
    const segmentIds = segments.map((s) => s.source_id).filter((id): id is string => id !== null).map(reservationIdOfCalendarSourceId);
    const missing = [...new Set(segmentIds.filter((id) => !loaded.has(id)))];
    const extra = missing.length === 0
      ? []
      : await prisma.reservations.findMany({ where: { userId: user.id, id: { in: missing } }, select: RESERVATION_SELECT });
    for (const r of extra) loaded.set(r.id, r);
    const reservations = [...loaded.values()];
    const ids = reservations.map((r) => r.id);

    // The four facts GET /api/reservations loads for a booking (reservations/route.ts :48-83), read the same way.
    const [chargeLinks, postedEntries, budgetLinks, calendarRows] = ids.length === 0
      ? [[], [], [], []]
      : await Promise.all([
          prisma.transaction_reservation_links.findMany({
            where: { userId: user.id, status: 'accepted', moneyEventId: null, reservationId: { in: ids } },
            select: { reservationId: true },
          }),
          prisma.journal_entries.findMany({
            where: { userId: user.id, document_money_event_id: null, status: 'posted', document_reservation_id: { in: ids } },
            select: { document_reservation_id: true },
          }),
          prisma.reservation_budget_links.findMany({
            where: { userId: user.id, reservationId: { in: ids } },
            select: { reservationId: true, budgetLineItem: { select: { description: true } } },
          }),
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

    const bookings: BookingIn[] = reservations.map((r) => ({
      reservation: r,
      calendarDay: dayOf.has(r.id) ? dayOf.get(r.id)! : null,
      chargeMatched: matched.has(r.id),
      chargePosted: posted.has(r.id),
      budgetLine: lineOf.has(r.id) ? lineOf.get(r.id)! : null,
    }));

    const plannedIn: PlannedIn[] = planned;
    return NextResponse.json(travelDayOf({ range, planned: plannedIn, bookings, segments }));
  } catch (error) {
    return failClosedResponse('Travel day GET', "Failed to load the day's travel facts", error);
  }
}
