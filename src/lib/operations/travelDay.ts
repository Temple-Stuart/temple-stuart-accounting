/**
 * travelDay — THE DAY'S TRAVEL FACTS, AS STATED, PURE (TRAVEL-01a, Alex, 2026-10-31, rulings A–F).
 *
 * One GET (src/app/api/operations/travel-day/route.ts) hands the day card the travel facts of one day from
 * THREE sources, each row labelled by its source, nothing merged, guessed or converted — the card (TRAVEL-01b)
 * decides what becomes a stop; this file decides nothing of the kind:
 *
 *   · planned  — trip_itinerary rows on the day (the planner's commits, vendor-commit/route.ts): the
 *                day-blocks selection rule restated here (src/app/api/trips/day-blocks/route.ts :52-61): a
 *                once row whose homeDate is in [D 00:00Z, D+1 00:00Z); a daily row whose homeDate < D+1 and
 *                destDate ≥ D. Every column AS STORED: vendor_name null when unstated (never `||` the legacy
 *                title — both are handed over, the card says which it prints), cost as the Decimal's own
 *                two-decimal text (decimal.js toFixed, never a float — trip_itinerary.cost is Decimal(12,2),
 *                schema.prisma :1059, and carries NO currency column: `currency: null`, said).
 *   · bookings — the caller's reservations whose checkinDate is D (kind 'check-in') or whose checkoutDate is D
 *                (kind 'check-out'); a stay that checks in and out on D is two rows. The booking's row is the
 *                ONE leaf's (src/lib/reservations/bookingRow.ts bookingRowOf — imported, never a second shape)
 *                beside the stated facts the card needs raw (finalPriceCents + currency, the dates). A booking
 *                states no time: clock null, said.
 *   · segments — the calendar_events rows of source 'reservation' on the day (CAL-02: one row per flight segment
 *                the vendor stated a departure for, src/lib/calendar/bookingEvent.ts :39-58): the stated day and
 *                clock; an end only when stated; a UTC instant only when the stated value carried an offset; NO
 *                zone (nothing resolves an airport to a zone) — each absence said. The reservation behind the
 *                row (reservationIdOfCalendarSourceId) and its booking facts ride beside it.
 *
 * THE WORDS (ruling D) are constants here; a missing fact is null AND said — never defaulted, never invented.
 * THE ORDER: planned by block_start_time, then homeTime, then id; segments by start_time, then source_id;
 * bookings check-out before check-in, then displayName. Nothing here sums, converts or prints a figure.
 *
 * TRAVEL-01b (Alex, 2026-10-31, ruling B) — THE BANK FIGURE. A booking's charge carries the ACCEPTED link's bank
 * row beside matched/posted: the transaction's amount AS STORED (transactions.amount, a Float — never Number()ed,
 * never converted), the ACCOUNT's stated currency (accounts.isoCurrencyCode — NULL carried as null, bankMoneyWords
 * says 'currency not stated') and the transaction's day. null when no charge is matched. The route reads it through
 * the same join GET /api/reservations' facts come from; this leaf refuses a bank figure that contradicts the match
 * (matched without a figure, or a figure without a match) by name. The card (TRAVEL-01b) prints it through
 * bankMoneyWords — nothing is printed here.
 *
 * THIS FILE IS PURE: no Prisma, no fetch, no clock, no React. The route hands it rows; the tests hand it fixtures.
 */
import { isIsoDay } from '@/lib/budget/days';
import { clockOfTime } from '@/lib/calendar/tripItem';
import { bookingRowOf, type BookingRow, type BookingRowFacts, type BookingRowReservation } from '@/lib/reservations/bookingRow';

/** A fact the route handed over that cannot be what it says it is — the route's bug, refused by name. */
export class TravelDayError extends Error {
  constructor(message: string) {
    super(`TRAVEL DAY: ${message}`);
    this.name = 'TravelDayError';
  }
}

// ─── THE WORDS (ruling D) ─────────────────────────────────────────────────────

export const COST_NO_CURRENCY_WORDS = 'cost states no currency';
export const NO_END_WORDS = 'no end stated';
export const NO_INSTANT_WORDS = 'no instant — the vendor stated a local clock';
export const NO_ZONE_WORDS = 'no zone';
export const PRICE_NOT_STATED_WORDS = 'price not stated';
export const CANCELLED_WORDS = 'cancelled';
export const CANCEL_PENDING_WORDS = 'cancel pending';
export const VENDOR_NAME_NOT_STATED_WORDS = 'vendor name not stated — legacy title shown';
export const BOOKING_NO_CLOCK_WORDS = 'a booking states no time';

export const DAY_REQUIRED_WORDS = "day is required — a 'YYYY-MM-DD' day";
export const dayNotADayWords = (value: unknown): string => `day ${JSON.stringify(value)} is not a 'YYYY-MM-DD' day`;

// ─── THE DAY'S RANGE (ruling A) ──────────────────────────────────────────────

/** The day and its UTC range [from, to) as ISO instants — the day-blocks rule's window, restated. */
export interface DayRange {
  readonly day: string;
  readonly from: string;
  readonly to: string;
}

export type DayRangeResult =
  | { readonly ok: true; readonly range: DayRange }
  | { readonly ok: false; readonly field: 'day'; readonly message: string };

const DAY_MS = 24 * 60 * 60 * 1000;

/** 'YYYY-MM-DD' → [D 00:00:00.000Z, D+1 00:00:00.000Z); anything else refused by name (absent, or not a real day). */
export function dayRangeOf(day: unknown): DayRangeResult {
  if ([null, undefined, ''].some((absent) => absent === day)) return { ok: false, field: 'day', message: DAY_REQUIRED_WORDS };
  if (!isIsoDay(day)) return { ok: false, field: 'day', message: dayNotADayWords(day) };
  const from = new Date(`${day}T00:00:00.000Z`);
  const to = new Date(from.getTime() + DAY_MS);
  return { ok: true, range: { day, from: from.toISOString(), to: to.toISOString() } };
}

/** An instant window [gte, lt) as Prisma's where data. */
export interface InstantWindow {
  gte: Date;
  lt: Date;
}

/** The day-blocks selection rule (day-blocks/route.ts :52-61), as plain where data: once rows by homeDate in the range; daily rows spanning the day. */
export function plannedSelectionOf(range: DayRange): {
  OR: [
    { recurrence: 'once'; homeDate: InstantWindow },
    { recurrence: 'daily'; homeDate: { lt: Date }; destDate: { gte: Date } },
  ];
} {
  const from = new Date(range.from);
  const to = new Date(range.to);
  return {
    OR: [
      { recurrence: 'once', homeDate: { gte: from, lt: to } },
      { recurrence: 'daily', homeDate: { lt: to }, destDate: { gte: from } },
    ],
  };
}

/** The bookings on the day: a check-in or a check-out whose @db.Date (UTC midnight) is in the range. */
export function bookingsSelectionOf(range: DayRange): { OR: [{ checkinDate: InstantWindow }, { checkoutDate: InstantWindow }] } {
  const from = new Date(range.from);
  const to = new Date(range.to);
  return { OR: [{ checkinDate: { gte: from, lt: to } }, { checkoutDate: { gte: from, lt: to } }] };
}

/** The segments on the day: calendar rows whose start_date (@db.Date) is in the range — the caller's reservation keys are the route's where. */
export function segmentsSelectionOf(range: DayRange): { start_date: InstantWindow } {
  return { start_date: { gte: new Date(range.from), lt: new Date(range.to) } };
}

// ─── FIGURES AND CLOCKS, AS STORED ───────────────────────────────────────────

/** What a Decimal column hands over (Prisma.Decimal is decimal.js: toFixed is exact decimal arithmetic). */
export interface DecimalLike {
  toFixed(decimalPlaces: number): string;
}

const TWO_DECIMALS = /^-?\d+\.\d{2}$/;

/** A Decimal(12,2) column's own text with its two decimals — never through a float; anything else refused by name. */
export function decimalStringOf(value: DecimalLike): string {
  const text = value.toFixed(2);
  if (!TWO_DECIMALS.test(text)) throw new TravelDayError(`${JSON.stringify(text)} is not a two-decimal figure`);
  return text;
}

const iso = (d: Date | string): string => (typeof d === 'string' ? new Date(d).toISOString() : d.toISOString());
/** A @db.Date (UTC midnight) or a date-time → its UTC day 'YYYY-MM-DD'. */
export const dayOf = (d: Date | string): string => iso(d).slice(0, 10);
/** A nullable instant → its ISO text, or null. */
const instantOf = (d: Date | string | null): string | null => (d === null ? null : iso(d));
/** A nullable @db.Time → 'HH:MM' (the one reader, tripItem.ts clockOfTime), or null. */
const clockOf = (t: Date | string | null): string | null => (t === null ? null : clockOfTime(t));

// ─── 1. PLANNED ──────────────────────────────────────────────────────────────

/** A trip_itinerary row as the route selects it (every column the card may need, as stored). */
export interface PlannedIn {
  readonly id: string;
  readonly tripId: string;
  readonly category: string;
  readonly vendor: string;
  readonly vendor_name: string | null;
  readonly cost: DecimalLike;
  readonly coa_code: string | null;
  readonly recurrence: string;
  readonly homeDate: Date | string;
  readonly homeTime: string | null;
  readonly destDate: Date | string;
  readonly destTime: string | null;
  readonly duration_minutes: number | null;
  readonly start_zone: string | null;
  readonly end_zone: string | null;
  readonly start_at: Date | string | null;
  readonly end_at: Date | string | null;
  readonly block_start_time: Date | string | null;
  readonly block_end_time: Date | string | null;
  readonly vendorOptionId: string | null;
  readonly vendorOptionType: string | null;
  readonly note: string | null;
}

export interface PlannedRow {
  readonly source: 'planned';
  readonly id: string;
  readonly tripId: string;
  readonly category: string;
  /** The clean name as captured, or null when none was stated — the legacy title is `vendor`, its own field. */
  readonly vendorName: string | null;
  readonly vendor: string;
  /** The Decimal's own two-decimal text. */
  readonly cost: string;
  /** trip_itinerary carries no currency column — null, and said. */
  readonly currency: null;
  readonly coaCode: string | null;
  readonly recurrence: string;
  readonly homeDate: string;
  readonly homeTime: string | null;
  readonly destDate: string;
  readonly destTime: string | null;
  readonly durationMinutes: number | null;
  readonly startZone: string | null;
  readonly endZone: string | null;
  readonly startAt: string | null;
  readonly endAt: string | null;
  readonly blockStartTime: string | null;
  readonly blockEndTime: string | null;
  readonly vendorOptionId: string | null;
  readonly vendorOptionType: string | null;
  readonly note: string | null;
  readonly said: readonly string[];
}

/** Whether a planned row states an end: a daily row by its window, a once row by its destination clock. */
const plannedEndStated = (r: PlannedIn): boolean => (r.recurrence === 'daily' ? r.block_end_time !== null : r.destTime !== null);

export function plannedRowOf(r: PlannedIn): PlannedRow {
  const said: string[] = [COST_NO_CURRENCY_WORDS];
  if (r.vendor_name === null) said.push(VENDOR_NAME_NOT_STATED_WORDS);
  if (!plannedEndStated(r)) said.push(NO_END_WORDS);
  // A clock with no zone: the planner stated a wall-clock and no zone (vendor-commit writes a zone for a flight or a tour only).
  const hasClock = r.homeTime !== null ? true : r.block_start_time !== null;
  if (hasClock && r.start_zone === null) said.push(NO_ZONE_WORDS);
  return {
    source: 'planned',
    id: r.id,
    tripId: r.tripId,
    category: r.category,
    vendorName: r.vendor_name,
    vendor: r.vendor,
    cost: decimalStringOf(r.cost),
    currency: null,
    coaCode: r.coa_code,
    recurrence: r.recurrence,
    homeDate: dayOf(r.homeDate),
    homeTime: r.homeTime,
    destDate: dayOf(r.destDate),
    destTime: r.destTime,
    durationMinutes: r.duration_minutes,
    startZone: r.start_zone,
    endZone: r.end_zone,
    startAt: instantOf(r.start_at),
    endAt: instantOf(r.end_at),
    blockStartTime: clockOf(r.block_start_time),
    blockEndTime: clockOf(r.block_end_time),
    vendorOptionId: r.vendorOptionId,
    vendorOptionType: r.vendorOptionType,
    note: r.note,
    said,
  };
}

/** Nulls last, then the text; equal texts fall through. */
const byNullableText = (a: string | null, b: string | null): number => {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? -1 : a > b ? 1 : 0;
};

/** The first comparison that decides, in order — a comparator chain with no default in it. */
const firstDeciding = (comparisons: readonly number[]): number => {
  for (const c of comparisons) if (c !== 0) return c;
  return 0;
};

/** block_start_time, then homeTime, then id. */
export const plannedOrder = (a: PlannedRow, b: PlannedRow): number =>
  firstDeciding([byNullableText(a.blockStartTime, b.blockStartTime), byNullableText(a.homeTime, b.homeTime), byNullableText(a.id, b.id)]);

// ─── 2. BOOKINGS ─────────────────────────────────────────────────────────────

/** TRAVEL-01b (ruling B): the ACCEPTED charge link's bank row — the amount as stored, the account's stated currency (null when it states none), the transaction's day. */
export interface BankFigure {
  readonly amount: number;
  readonly currency: string | null;
  readonly date: string;
}

/** The facts the route loaded for one reservation of the caller: the one leaf's input, plus the provider and (TRAVEL-01b) the matched charge's bank row. */
export interface BookingIn extends BookingRowFacts {
  readonly reservation: BookingRowReservation & { readonly provider: string };
  /** The accepted charge link's bank row; null when no charge is matched. */
  readonly chargeBank: BankFigure | null;
}

/** The booking's stated facts the card prints raw (its figure through bankMoneyWords in 01b — nothing printed here). */
export interface BookingFacts {
  readonly id: string;
  readonly lane: string;
  readonly displayName: string | null;
  readonly provider: string;
  readonly status: string;
  readonly tripId: string | null;
  readonly finalPriceCents: number | null;
  readonly currency: string;
  readonly checkinDate: string | null;
  readonly checkoutDate: string | null;
}

export interface BookingLinks {
  /** An ACCEPTED charge link exists (MATCH); a posted entry documents the charge (POST-01); TRAVEL-01b: the link's bank row, null when not matched. */
  readonly charge: { readonly matched: boolean; readonly posted: boolean; readonly bank: BankFigure | null };
  /** The owner's budget-line link, with the line's description — or null. */
  readonly budgetLine: { readonly description: string | null } | null;
  /** The one leaf's words for the booking (bookingRowOf). */
  readonly row: BookingRow;
}

export type BookingKind = 'check-in' | 'check-out';

export interface TravelBookingRow extends BookingLinks {
  readonly source: 'booking';
  readonly kind: BookingKind;
  /** A booking states no time. */
  readonly clock: null;
  readonly reservation: BookingFacts;
  readonly said: readonly string[];
}

const bookingFactsOf = (r: BookingIn['reservation']): BookingFacts => ({
  id: r.id,
  lane: r.lane,
  displayName: r.displayName,
  provider: r.provider,
  status: r.status,
  tripId: r.tripId,
  finalPriceCents: r.finalPriceCents,
  currency: r.currency,
  checkinDate: r.checkinDate === null ? null : dayOf(r.checkinDate),
  checkoutDate: r.checkoutDate === null ? null : dayOf(r.checkoutDate),
});

const bookingLinksOf = (b: BookingIn): BookingLinks => {
  // TRAVEL-01b: a bank figure rides an accepted charge and nothing else — either without the other is the route's bug.
  if (b.chargeMatched !== (b.chargeBank !== null)) {
    throw new TravelDayError(`reservation ${b.reservation.id} is ${b.chargeMatched ? 'matched with no bank figure' : 'not matched but carries a bank figure'}`);
  }
  return {
    charge: { matched: b.chargeMatched, posted: b.chargePosted, bank: b.chargeBank },
    budgetLine: b.budgetLine,
    row: bookingRowOf(b),
  };
};

/** The words a booking's status and price add — the same on its booking rows and on its segments. */
function bookingSaid(r: BookingIn['reservation']): string[] {
  const said: string[] = [];
  if (r.finalPriceCents === null) said.push(PRICE_NOT_STATED_WORDS);
  if (r.status === 'cancelled') said.push(CANCELLED_WORDS);
  if (r.status === 'cancel_pending') said.push(CANCEL_PENDING_WORDS);
  return said;
}

/** The booking's rows on the day: a check-in when checkinDate is the day, a check-out when checkoutDate is — none, one or both. */
export function bookingRowsOf(b: BookingIn, day: string): TravelBookingRow[] {
  const r = b.reservation;
  const kinds: BookingKind[] = [];
  if (r.checkinDate !== null && dayOf(r.checkinDate) === day) kinds.push('check-in');
  if (r.checkoutDate !== null && dayOf(r.checkoutDate) === day) kinds.push('check-out');
  return kinds.map((kind) => ({
    source: 'booking',
    kind,
    clock: null,
    reservation: bookingFactsOf(r),
    ...bookingLinksOf(b),
    said: [BOOKING_NO_CLOCK_WORDS, ...bookingSaid(r)],
  }));
}

/** Check-out before check-in, then displayName (null last), then the reservation id. */
export const bookingOrder = (a: TravelBookingRow, b: TravelBookingRow): number => {
  if (a.kind !== b.kind) return a.kind === 'check-out' ? -1 : 1;
  return firstDeciding([byNullableText(a.reservation.displayName, b.reservation.displayName), byNullableText(a.reservation.id, b.reservation.id)]);
};

// ─── 3. SEGMENTS ─────────────────────────────────────────────────────────────

/** A calendar_events row of source 'reservation' as the route selects it. */
export interface SegmentIn {
  readonly source_id: string | null;
  readonly title: string;
  readonly status: string | null;
  readonly start_date: Date | string;
  readonly end_date: Date | string | null;
  readonly start_time: Date | string | null;
  readonly end_time: Date | string | null;
  readonly start_at: Date | string | null;
  readonly end_at: Date | string | null;
  readonly start_zone: string | null;
  readonly end_zone: string | null;
}

export interface TravelSegmentRow extends BookingLinks {
  readonly source: 'segment';
  readonly sourceId: string;
  readonly reservationId: string;
  readonly title: string;
  /** calendar_events.status — 'committed', or 'cancelled' once the booking's rows were marked. */
  readonly status: string | null;
  readonly startDate: string;
  readonly startTime: string | null;
  readonly endDate: string | null;
  readonly endTime: string | null;
  readonly startAt: string | null;
  readonly endAt: string | null;
  readonly startZone: string | null;
  readonly endZone: string | null;
  readonly reservation: BookingFacts;
  readonly said: readonly string[];
}

/** The reservation a 'reservation' row belongs to — the bare key, or the part before ':seg:' (bookingEvent.ts reservationIdOfCalendarSourceId's rule, restated for a pure leaf). */
export function reservationIdOfSegment(sourceId: string): string {
  const at = sourceId.indexOf(':seg:');
  return at < 0 ? sourceId : sourceId.slice(0, at);
}

export function segmentRowOf(s: SegmentIn, booking: BookingIn): TravelSegmentRow {
  if (s.source_id === null) throw new TravelDayError('a reservation calendar row with no source_id was handed over — the where names the keys');
  const reservationId = reservationIdOfSegment(s.source_id);
  if (reservationId !== booking.reservation.id) throw new TravelDayError(`segment ${s.source_id} was handed booking ${booking.reservation.id}`);
  const said: string[] = [];
  if (s.end_time === null && s.end_date === null) said.push(NO_END_WORDS);
  if (s.start_at === null) said.push(NO_INSTANT_WORDS);
  if (s.start_zone === null) said.push(NO_ZONE_WORDS);
  said.push(...bookingSaid(booking.reservation));
  return {
    source: 'segment',
    sourceId: s.source_id,
    reservationId,
    title: s.title,
    status: s.status,
    startDate: dayOf(s.start_date),
    startTime: clockOf(s.start_time),
    endDate: s.end_date === null ? null : dayOf(s.end_date),
    endTime: clockOf(s.end_time),
    startAt: instantOf(s.start_at),
    endAt: instantOf(s.end_at),
    startZone: s.start_zone,
    endZone: s.end_zone,
    reservation: bookingFactsOf(booking.reservation),
    ...bookingLinksOf(booking),
    said,
  };
}

/** start_time (null last), then source_id. */
export const segmentOrder = (a: TravelSegmentRow, b: TravelSegmentRow): number =>
  firstDeciding([byNullableText(a.startTime, b.startTime), byNullableText(a.sourceId, b.sourceId)]);

// ─── THE ANSWER ──────────────────────────────────────────────────────────────

export interface TravelDayIn {
  readonly range: DayRange;
  readonly planned: readonly PlannedIn[];
  /** Every reservation of the caller the route loaded facts for: the day's check-ins and check-outs, and the segments' reservations. */
  readonly bookings: readonly BookingIn[];
  readonly segments: readonly SegmentIn[];
}

export interface TravelDay {
  readonly day: string;
  readonly planned: readonly PlannedRow[];
  readonly bookings: readonly TravelBookingRow[];
  readonly segments: readonly TravelSegmentRow[];
  readonly counts: { readonly planned: number; readonly bookings: number; readonly segments: number };
}

/** The answer: three labelled lists in their orders and their counts — no cross-source merge, no stop. */
export function travelDayOf(input: TravelDayIn): TravelDay {
  const byId = new Map<string, BookingIn>();
  for (const b of input.bookings) {
    if (byId.has(b.reservation.id)) throw new TravelDayError(`reservation ${b.reservation.id} was handed over twice`);
    byId.set(b.reservation.id, b);
  }
  const planned = input.planned.map(plannedRowOf).sort(plannedOrder);
  const bookings = input.bookings.flatMap((b) => bookingRowsOf(b, input.range.day)).sort(bookingOrder);
  const segments = input.segments
    .map((s) => {
      if (s.source_id === null) throw new TravelDayError('a reservation calendar row with no source_id was handed over — the where names the keys');
      const id = reservationIdOfSegment(s.source_id);
      const booking = byId.get(id);
      if (booking === undefined) throw new TravelDayError(`segment ${s.source_id} names reservation ${id}, whose facts were not handed over`);
      return segmentRowOf(s, booking);
    })
    .sort(segmentOrder);
  return {
    day: input.range.day,
    planned,
    bookings,
    segments,
    counts: { planned: planned.length, bookings: bookings.length, segments: segments.length },
  };
}
