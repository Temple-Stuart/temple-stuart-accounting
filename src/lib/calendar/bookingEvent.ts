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
 *
 * CAL-02 (2026-09-27) — EVERY LEG OF A FLIGHT IS ON THE CALENDAR.
 *
 * A flight had ONE row: the earliest OUTBOUND segment's departure. Its
 * connections and its whole return journey (INBOUND) never reached the day. Now
 * a FLIGHT earns one row per segment the vendor STATES a departureTime for,
 * keyed `${reservationId}:seg:${index}` — index is the vendor's segment order as
 * stated, never re-sorted — OUTBOUND and INBOUND alike. A STAY keeps the bare
 * reservation id (one stay, one row). A flight row written before CAL-02 under
 * the bare id is RE-KEYED IN PLACE to the first segment that earns a row
 * (segment 0 whenever segment 0 states a departure) — the same row, never a
 * duplicate (writeFlightSegmentRows; the retro scripts/cal-02-retro-segments.ts).
 *
 * A segment's row carries what the vendor states and nothing more: its day and
 * clock of departure; its day and clock of arrival when stated, else no end (the
 * grid draws the extent leaf's flagged marker, src/lib/calendar/extent.ts
 * blockExtent — no writer defaults an end); a UTC instant ONLY when the stated
 * value carries its own offset or Z (the documented example carries neither —
 * local clocks); and NO zone: nothing in the codebase resolves an airport code to
 * an IANA zone (PR-tz-1's zones arrive from the search provider on a trip
 * commit, never from a code), so start_zone and end_zone are left NULL.
 *
 * Every reader of a booking's rows asks with ONE where (bookingCalendarRowsWhere):
 * the bare key and every segment key of each reservation. A cancel marks them all.
 */

import { LANE_WORD } from '../reservations/lane';

/**
 * The source these rows carry — NOT vendor-commit's `trip`. See the header: a
 * planned item and a paid booking must be told apart by this column alone.
 */
export const BOOKING_CALENDAR_SOURCE = 'reservation';

/** The source_id: the reservation id itself, so the retro-map joins on it directly.
 *  CAL-02 (2026-09-27): a STAY's key — and the key a pre-CAL-02 flight row carries
 *  until it is re-keyed to its first segment. */
export function bookingCalendarSourceId(reservationId: string): string {
  return reservationId;
}

/** CAL-02: the mark between a reservation id and its segment index in a flight row's key. */
export const SEGMENT_KEY_MARK = ':seg:';

/** CAL-02: a flight SEGMENT's key — the vendor's segment order as stated, never re-sorted. */
export function flightSegmentSourceId(reservationId: string, index: number): string {
  return `${reservationId}${SEGMENT_KEY_MARK}${index}`;
}

/** CAL-02: the reservation a booking row belongs to — its bare key, or the part before ':seg:'. */
export function reservationIdOfCalendarSourceId(sourceId: string): string {
  const at = sourceId.indexOf(SEGMENT_KEY_MARK);
  return at < 0 ? sourceId : sourceId.slice(0, at);
}

/**
 * CAL-02: THE ONE WHERE every reader of a booking's calendar rows uses — each
 * reservation's bare key and every one of its segment keys. Plain data (a Prisma
 * where fragment); the caller adds its own user scope. Reservation ids are uuids
 * (schema.prisma reservations.id @db.Uuid) — hex and hyphens, no LIKE wildcard.
 */
export function bookingCalendarRowsWhere(reservationIds: readonly string[]) {
  return {
    source: BOOKING_CALENDAR_SOURCE,
    OR: [
      { source_id: { in: [...reservationIds] } },
      ...reservationIds.map((id) => ({ source_id: { startsWith: `${id}${SEGMENT_KEY_MARK}` } })),
    ],
  };
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
      /** CAL-02: the stated clock ("HH:MM") it starts at, or null — an all-day row (every stay). */
      startTime: string | null;
      /** CAL-02: the stated clock it ends at, or null — no end is ever defaulted (extent.ts draws the marker). */
      endTime: string | null;
      /** CAL-02: the UTC instant it starts — ONLY when the stated value carries its own offset or Z. */
      startAt: Date | null;
      /** CAL-02: the UTC instant it ends — the same rule. */
      endAt: Date | null;
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
    // CAL-02: a stay is an all-day span — the property's clock is the itinerary's business (HOTEL-02).
    startTime: null,
    endTime: null,
    startAt: null,
    endAt: null,
  };
}

/** CAL-02: one segment, as the vendor states it — null where the answer did not carry the field. */
export interface StatedFlightSegment {
  departureTime: string | null;
  arrivalTime: string | null;
  originCode: string | null;
  destinationCode: string | null;
  carrierName: string | null;
  flightNumber: string | null;
}

/** CAL-02: one decision per stated segment, in the vendor's order. */
export interface SegmentCalendarDecision {
  /** The vendor's segment order as stated. */
  index: number;
  decision: BookingCalendarDecision;
  /** Named when the segment has a row but the vendor stated no usable arrival — the row has no end. */
  noEnd: string | null;
}

const STATED_DATE = /^(\d{4}-\d{2}-\d{2})/;
const STATED_CLOCK = /^\d{4}-\d{2}-\d{2}T(\d{2}:\d{2})/;
/** A stated value that carries its own offset or Z — the only kind that names an instant. */
const STATED_OFFSET = /T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/i;

/** The clock as written ("HH:MM"), or null when the value carries none. */
function statedClock(value: string): string | null {
  const m = STATED_CLOCK.exec(value);
  return m ? m[1] : null;
}

/** The instant the value names — only when it carries its own offset or Z; a bare local clock names none. */
function statedInstant(value: string): Date | null {
  if (!STATED_OFFSET.test(value)) return null;
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? null : at;
}

/**
 * CAL-02: a segment's title — "<carrier> <flightNo> <ORG> → <DST>" from the stated
 * fields. A missing field is LEFT OUT, never guessed; a route with one end stated
 * keeps its arrow on the side it has. A segment stating none of the four is titled
 * by its lane word alone (LANE_WORD.flight) — what the row is, nothing about the leg.
 */
export function flightSegmentTitle(segment: StatedFlightSegment): string {
  const stated = (v: string | null) => (typeof v === 'string' ? v.trim() : '');
  const carrier = stated(segment.carrierName);
  const number = stated(segment.flightNumber);
  const origin = stated(segment.originCode);
  const destination = stated(segment.destinationCode);
  const route = origin && destination ? `${origin} → ${destination}` : origin ? `${origin} →` : destination ? `→ ${destination}` : '';
  const parts = [carrier, number, route].filter((p) => p.length > 0);
  return parts.length > 0 ? parts.join(' ') : LANE_WORD.flight;
}

/**
 * A FLIGHT — CAL-02 (2026-09-27): ONE ROW PER STATED SEGMENT.
 *
 * LANE-01 (2026-09-25) gave a flight its day from the vendor's GET
 * /flights/bookings/{bookingId} (journey.segments[], each with departureTime,
 * arrivalTime, direction, originCode, destinationCode, carrier.marketingName,
 * flight.marketingNumber — liteapiFlightsClient.ts parseFlightBookingDetails),
 * after CAL-01 STEP 1.5 found the BOOK payload carries no date of travel —
 * NOT FOUND: data[0].booking holds bookingId, bookingRef, status, paymentStatus,
 * pricing, payment, order, passengers, and no departure. That finding stands.
 * What CAL-02 changes is HOW MANY rows: every segment WITH a stated departureTime
 * earns one, in the vendor's order, OUTBOUND and INBOUND alike. A segment without
 * one gets NO ROW and a named reason. No createdAt, no today, no default.
 */
export function flightSegmentsCalendarDecision(input: {
  reservationId: string;
  userId: string | null;
  /** journey.segments[] as stated — in the vendor's order, NEVER re-sorted. */
  segments: readonly StatedFlightSegment[];
}): SegmentCalendarDecision[] {
  return input.segments.map((segment, index) => {
    const where = `reservation ${input.reservationId} segment ${index}`;
    const departure = segment.departureTime;
    if (typeof departure !== 'string' || departure.length === 0) {
      return { index, noEnd: null, decision: { write: false, reason: `${where}: the vendor states no departureTime — no row, and a time is never invented` } };
    }
    const departureDay = STATED_DATE.exec(departure);
    if (!departureDay) {
      return { index, noEnd: null, decision: { write: false, reason: `${where}: the vendor's departureTime "${departure}" does not open with a date — no row, and a date is never invented` } };
    }
    const arrival = typeof segment.arrivalTime === 'string' ? segment.arrivalTime : null;
    const arrivalDay = arrival === null ? null : STATED_DATE.exec(arrival);
    return {
      index,
      noEnd: arrivalDay ? null : `${where}: the vendor states ${arrival === null ? 'no arrivalTime' : `an arrivalTime "${arrival}" that does not open with a date`} — the row has no end (the grid draws the flagged marker, extent.ts)`,
      decision: {
        write: true,
        userId: input.userId,
        sourceId: flightSegmentSourceId(input.reservationId, index),
        title: flightSegmentTitle(segment),
        icon: '\u2708\uFE0F',
        startDate: dayOf(departureDay[1]),
        endDate: arrivalDay ? dayOf(arrivalDay[1]) : null,
        startTime: statedClock(departure),
        endTime: arrival !== null && arrivalDay ? statedClock(arrival) : null,
        startAt: statedInstant(departure),
        endAt: arrival !== null && arrivalDay ? statedInstant(arrival) : null,
      },
    };
  });
}

/** One row as written. CAL-02 (2026-09-27): with its stated clocks and instants (null where none is stated). */
export interface BookingCalendarRow {
  userId: string | null;
  source: string;
  sourceId: string;
  title: string;
  icon: string;
  startDate: Date;
  endDate: Date | null;
  startTime: string | null;
  endTime: string | null;
  startAt: Date | null;
  endAt: Date | null;
}

/** The two calls this leaf needs of a database, so it can be driven without one. */
export interface BookingCalendarPort {
  /** Is there already a row for this (source, source_id)? */
  find(source: string, sourceId: string): Promise<boolean>;
  insert(row: BookingCalendarRow): Promise<void>;
}

/**
 * CAL-02 (2026-09-27): the one more call a FLIGHT's rows need — move the row keyed
 * `fromSourceId` to a segment's key and fields IN PLACE (the same row: its id, its
 * owner and its status kept), answering how many rows moved (0 or 1).
 */
export interface BookingCalendarSegmentPort extends BookingCalendarPort {
  rekey(source: string, fromSourceId: string, row: BookingCalendarRow): Promise<number>;
}

/**
 * CANCEL-01 (2026-09-26): the one extra call a CANCEL needs — mark the row a
 * cancelled reservation earned. Separate from BookingCalendarPort so the refresh
 * and the book routes (and their fakes) are untouched.
 */
export interface BookingCalendarCancelPort {
  /** Mark every row for (source, source_id) cancelled; answer how many were.
   *  CAL-02 (2026-09-27): every row OF THE RESERVATION — the bare key AND every
   *  `${key}:seg:<n>` key (prismaBookingCalendar matches the prefix). */
  markCancelled(source: string, sourceId: string): Promise<number>;
}

/**
 * CANCEL-01 (2026-09-26): A CANCELLED BOOKING'S ROW IS MARKED, NOT REMOVED.
 *
 * The reservation row is never deleted — the financial record lives forever
 * (reservations/[id]/cancel/route.ts) — and its calendar row is the day-side of
 * that same record: it was keyed (source='reservation', source_id=reservation.id)
 * by CAL-01 exactly so the deferred budget retro-map can find the bookings it
 * must map. Removing the row would make the day read as if nothing had ever been
 * booked and would take the key away from that retro-map. Marking keeps the key
 * and the day and tells the truth on the grid: the title becomes
 * "Cancelled: <title>" (the grid renders the title; it renders nothing from
 * `status`, HubCalendar.tsx) and calendar_events.status becomes 'cancelled' so a
 * reader that does look at the column sees it too. A cancelled flight never
 * reads as booked on its day.
 */
export const CANCELLED_TITLE_PREFIX = 'Cancelled: ';

/** CAL-02 (2026-09-27): a flight's rows are several — one call marks every one (the port matches the
 *  reservation's bare key and its segment prefix); still idempotent, still mark-never-delete. */
export async function markBookingCalendarCancelled(port: BookingCalendarCancelPort, reservationId: string): Promise<{ marked: number }> {
  const marked = await port.markCancelled(BOOKING_CALENDAR_SOURCE, bookingCalendarSourceId(reservationId));
  return { marked };
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
  await port.insert(rowOf(decision));
  return { landed: 'inserted' };
}

/** The row a writable decision stands for — every field as decided, nothing added. */
function rowOf(decision: Extract<BookingCalendarDecision, { write: true }>): BookingCalendarRow {
  return {
    userId: decision.userId,
    source: BOOKING_CALENDAR_SOURCE,
    sourceId: decision.sourceId,
    title: decision.title,
    icon: decision.icon,
    startDate: decision.startDate,
    endDate: decision.endDate,
    startTime: decision.startTime,
    endTime: decision.endTime,
    startAt: decision.startAt,
    endAt: decision.endAt,
  };
}

/** CAL-02: what became of one segment's row. */
export interface SegmentLanding {
  index: number;
  landed: 'inserted' | 'already_there' | 'rekeyed' | 'no_row';
  /** The row's key, or null when the segment earned none. */
  sourceId: string | null;
  /** The day it sits on (YYYY-MM-DD), or null. */
  day: string | null;
  /** Named: why there is no row, or why the row has no end. */
  reason: string | null;
}

export interface FlightSegmentRowsOutcome {
  segments: SegmentLanding[];
  /** The pre-CAL-02 row under the bare key: none; moved to a segment; or left as is — beside segment rows
   *  already there, or with no segment earning a row now (named, never deleted). */
  legacy: 'none' | 'rekeyed' | 'left_as_is';
  /** When the reservation is already cancelled: how many of its rows were marked now; else null. */
  marked: number | null;
}

/**
 * CAL-02 (2026-09-27): WRITE A FLIGHT'S ROWS — one per stated segment, once each.
 *
 * In the vendor's order: a segment with no row is named; a segment whose key is
 * already there is left alone (a second run inserts nothing); otherwise, while a
 * pre-CAL-02 row sits under the reservation's BARE key, THAT row is re-keyed to
 * this segment in place (the first segment that earns a row — segment 0 whenever
 * it states a departure), never duplicated; every other segment is inserted.
 * A bare-key row that remains — beside segment rows already there, or because no
 * segment earns a row now — is left as is and named: nothing here deletes a row.
 *
 * A reservation ALREADY cancelled has every row marked after the write (the apply
 * leaf marks on the transition only — a leg first written after the cancel would
 * otherwise read as booked). Idempotent: markCancelled skips a row already marked.
 */
export async function writeFlightSegmentRows(
  port: BookingCalendarSegmentPort & BookingCalendarCancelPort,
  input: { reservationId: string; reservationCancelled: boolean; decisions: readonly SegmentCalendarDecision[] },
): Promise<FlightSegmentRowsOutcome> {
  const bareKey = bookingCalendarSourceId(input.reservationId);
  let bare = await port.find(BOOKING_CALENDAR_SOURCE, bareKey);
  let legacy: FlightSegmentRowsOutcome['legacy'] = 'none';
  const segments: SegmentLanding[] = [];
  for (const { index, decision, noEnd } of input.decisions) {
    if (!decision.write) {
      segments.push({ index, landed: 'no_row', sourceId: null, day: null, reason: decision.reason });
      continue;
    }
    const day = decision.startDate.toISOString().slice(0, 10);
    if (await port.find(BOOKING_CALENDAR_SOURCE, decision.sourceId)) {
      segments.push({ index, landed: 'already_there', sourceId: decision.sourceId, day, reason: noEnd });
      continue;
    }
    if (bare && (await port.rekey(BOOKING_CALENDAR_SOURCE, bareKey, rowOf(decision))) > 0) {
      bare = false;
      legacy = 'rekeyed';
      segments.push({ index, landed: 'rekeyed', sourceId: decision.sourceId, day, reason: noEnd });
      continue;
    }
    // The bare row, if one was seen, is gone (moved or removed by another writer) — nothing to re-key.
    bare = false;
    await port.insert(rowOf(decision));
    segments.push({ index, landed: 'inserted', sourceId: decision.sourceId, day, reason: noEnd });
  }
  if (bare) legacy = 'left_as_is';
  const marked = input.reservationCancelled ? await port.markCancelled(BOOKING_CALENDAR_SOURCE, bareKey) : null;
  return { segments, legacy, marked };
}
