/**
 * CAL-01 (2026-09-23) — A BOOKING LANDS ON THE CALENDAR.
 *
 * A paid reservation had no day. It sat in `reservations` and the calendar never
 * knew, so the founder could book a room and see nothing on the grid he books
 * everything else onto. This leaf decides the ONE calendar_events row a booking
 * earns, and writes it idempotently.
 *
 * SCOPE, FIXED BY THE RULING: the calendar ONLY. Nothing here writes
 * budget_line_items, touches `budgets`, or posts a journal entry — budget mapping
 * is deferred and will be retro-mapped from the reservation rows themselves.
 *
 * THE SOURCE IS `reservation`, AND DELIBERATELY NOT `trip`. vendor-commit writes
 * `trip` (trips/[id]/vendor-commit/route.ts:596) for an option a person PLANNED
 * onto an itinerary. This row is what they PAID FOR. The deferred budget
 * retro-map will query (source, source_id) to find the bookings it must map, and
 * a planned item is not a booking — so the two are distinguishable by this column
 * alone, which is the point.
 *
 * That required a tenth entry on the calendar's ALLOWLIST
 * (src/lib/calendar/sources.ts): the grid renders a row only when
 * isRenderedCalendarSource passes, so a distinct literal that is not on the list
 * would write rows the calendar never draws — a booking that still does not land,
 * which is the whole defect. This is a CALENDAR source, not one of DRILL-01's
 * seven entry-source kinds; those are journal-entry provenance and stay closed at
 * seven, untouched by this PR.
 *
 * source_id is the RESERVATION ID, bare. Nothing else writes `reservation` rows,
 * so the trip writers' own deletes (which match `source_id::text = <tripId>` or
 * `trip:<id>:vendor:<optionId>` under source = 'trip') cannot touch these rows,
 * and ours cannot touch theirs. Idempotency keys on (source, source_id), the pair
 * idx_calendar_events_source indexes. THAT INDEX IS NOT UNIQUE
 * (schema.prisma:1736), so the write checks for the row before inserting it —
 * the database will not do it for us.
 *
 * NO FALLBACK ANYWHERE. A booking with no date gets NO ROW and a named reason.
 * Nothing here defaults to createdAt, to today, or to anything else.
 */

/**
 * The source these rows carry — NOT vendor-commit's `trip`. See the header: a
 * planned item and a paid booking must be told apart by this column alone.
 */
export const BOOKING_CALENDAR_SOURCE = 'reservation';

/** The source_id: the reservation id itself, so the retro-map joins on it directly. */
export function bookingCalendarSourceId(reservationId: string): string {
  return reservationId;
}

/** What the row should be, or why there is none. */
export type BookingCalendarDecision =
  | {
      write: true;
      userId: string | null;
      sourceId: string;
      title: string;
      icon: string;
      /** The day it starts. NOT NULL in the table (schema.prisma:1707). */
      startDate: Date;
      /** The day it ends, or null for a single day. */
      endDate: Date | null;
    }
  | {
      write: false;
      /** Named, for the log. Never swallowed, never guessed around. */
      reason: string;
    };

/** midday UTC, the instant the hotel book route already stores its dates at
 *  (liteapi/book/route.ts:201-202) — so the row's day matches the reservation's. */
function dayOf(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`);
}

/**
 * A STAY. It spans check-in to check-out, the two dates the hotel book route
 * requires before it will book at all (liteapi/book/route.ts:89-92), so they are
 * present by the time this is called — and if either is somehow not, that is
 * named rather than filled in.
 */
export function stayCalendarDecision(input: {
  reservationId: string;
  userId: string | null;
  hotelName: string | null;
  checkinDate: string | null | undefined;
  checkoutDate: string | null | undefined;
}): BookingCalendarDecision {
  if (!input.checkinDate || !input.checkoutDate) {
    return {
      write: false,
      reason: `reservation ${input.reservationId}: a stay with no ${!input.checkinDate ? 'check-in' : 'check-out'} date — no day to sit on, and a date is never invented`,
    };
  }
  return {
    write: true,
    userId: input.userId,
    sourceId: bookingCalendarSourceId(input.reservationId),
    title: `${input.hotelName ?? 'Hotel booking'} (stay)`,
    icon: '\u{1F3E8}',
    startDate: dayOf(input.checkinDate),
    endDate: dayOf(input.checkoutDate),
  };
}

/**
 * A FLIGHT — LANE-01 (2026-09-25): ITS DAY IS THE VENDOR'S STATED DEPARTURE.
 *
 * CAL-01 STEP 1.5 found the BOOK payload carries no date of travel (NOT FOUND:
 * data[0].booking holds bookingId, bookingRef, status, paymentStatus, pricing,
 * payment, order, passengers — and no departure). That finding stands, and this
 * leaf still invents nothing from it. What changed is WHERE the day comes from:
 * the vendor documents GET /flights/bookings/{bookingId} answering
 * journey.segments[] with each segment's departureTime and direction, and
 * LANE-01's refresh (src/lib/reservations/refreshFlightReservation.ts) reads the
 * OUTBOUND segment's departureTime and hands it here. No createdAt, no today,
 * no default: a flight whose outbound departure the vendor has not stated gets
 * NO ROW and a named reason from the refresh, never from a guess.
 *
 * One day, not a span: the row sits on the day the outbound leg departs
 * (endDate null), at the same midday-UTC instant every booking row uses.
 */
export function flightStatedCalendarDecision(input: {
  reservationId: string;
  userId: string | null;
  /** The row's customer-facing name (the stated route, or the lane word and the reference). */
  name: string;
  /** The OUTBOUND segment's departureTime as the vendor stated it (ISO 8601). */
  departureTime: string;
}): BookingCalendarDecision {
  if (!/^\d{4}-\d{2}-\d{2}/.test(input.departureTime)) {
    return {
      write: false,
      reason: `reservation ${input.reservationId}: the vendor's departureTime "${input.departureTime}" does not open with a date — no day to sit on, and a date is never invented`,
    };
  }
  return {
    write: true,
    userId: input.userId,
    sourceId: bookingCalendarSourceId(input.reservationId),
    title: `${input.name} (flight)`,
    icon: '\u2708\uFE0F',
    startDate: dayOf(input.departureTime),
    endDate: null,
  };
}

/** The two calls this leaf needs of a database, so it can be driven without one. */
export interface BookingCalendarPort {
  /** Is there already a row for this (source, source_id)? */
  find(source: string, sourceId: string): Promise<boolean>;
  insert(row: {
    userId: string | null;
    source: string;
    sourceId: string;
    title: string;
    icon: string;
    startDate: Date;
    endDate: Date | null;
  }): Promise<void>;
}

export type BookingCalendarOutcome =
  | { landed: 'inserted' }
  | { landed: 'already_there' }
  | { landed: 'no_row'; reason: string };

/**
 * Write the row, once. A retry finds what the first call wrote and inserts
 * nothing — the upstream book call is idempotent per prebookId, so the same
 * reservation comes back and this is asked the same question again.
 *
 * GUESTS GET A ROW, AND THE CLAIM IS DEFERRED — BOTH DECLARED.
 *
 * calendar_events.user_id is NULLABLE (schema.prisma:1699) and its relation is
 * optional (:1734), so a guest booking (userId null) writes its row like any
 * other. Nothing is skipped silently.
 *
 * What that row does NOT do is appear on anyone's grid: the calendar reads by
 * user_id (idx_calendar_events_user_date, schema.prisma:1737), and a null user
 * matches nobody. The row exists, keyed to its reservation, waiting.
 *
 * A LATER ACCOUNT-CLAIM OF A GUEST BOOKING IS OUT OF SCOPE HERE and deferred to
 * the MATCH-4 claim flow. When a guest later signs up and claims the booking,
 * whatever sets reservations.userId must set this row's user_id in the same
 * breath — and that is MATCH-4's job, not this PR's. Nothing in CAL-01 guesses at
 * an owner, back-fills one, or matches on an email.
 */
export async function writeBookingCalendarEvent(
  port: BookingCalendarPort,
  decision: BookingCalendarDecision,
): Promise<BookingCalendarOutcome> {
  if (!decision.write) return { landed: 'no_row', reason: decision.reason };
  if (await port.find(BOOKING_CALENDAR_SOURCE, decision.sourceId)) return { landed: 'already_there' };
  await port.insert({
    userId: decision.userId,
    source: BOOKING_CALENDAR_SOURCE,
    sourceId: decision.sourceId,
    title: decision.title,
    icon: decision.icon,
    startDate: decision.startDate,
    endDate: decision.endDate,
  });
  return { landed: 'inserted' };
}
