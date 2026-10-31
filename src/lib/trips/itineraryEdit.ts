/**
 * TRIPDATE-01 (2026-10-01) — A DATE EDIT MOVES THE DAY: the rules an itinerary edit obeys.
 *
 * The itinerary row (trip_itinerary) is the fact; its calendar row (calendar_events, source
 * 'trip', source_id trip:<tripId>:vendor:<optionId> — written once by vendor-commit) is the
 * projection the calendar grid reads. Every edit through
 * PATCH /api/trips/[id]/itinerary/[itineraryId] writes both, in one transaction. This leaf
 * holds what that route, the trip budget route, the ledger and the timeline all ask:
 *
 *   · clockIsFixed — a clock a vendor fixed with its zone at commit: a flight (its depart and
 *     arrive are the airline's, stated or not) and any row whose start_at is stated (an
 *     instant fixed with its zone — a timed tour). Such a row moves only by re-commit, so the
 *     route refuses every date and time key on it and no screen offers the edit;
 *   · tripVendorSourceId — the key vendor-commit writes its calendar row under, built from the
 *     row's own tripId and vendorOptionId (it parses back through
 *     src/lib/calendar/tripItem.ts parseTripVendorSourceId);
 *   · datesAfterEdit — the row's dates after an edit: each the body sets, every other as the
 *     row stores it (a PATCH changes only the keys it names);
 *   · rangeRefusal — a range runs forward: an end before its start is refused by name.
 *
 * THIS FILE IS PURE: no prisma, no fetch, no clock, no React, no env, no imports.
 */

/** The one sentence a fixed clock is refused and shown with — the route answers it; the screens title it. */
export const CLOCK_FIXED_WORDS =
  "this item's time was fixed by its vendor with its zone when it was committed — re-commit the item to change its dates or times";

/** The PATCH's date and time keys — every one is refused on a row whose clock is fixed. */
export const ITINERARY_DATE_TIME_KEYS = ['date', 'startDate', 'endDate', 'startTime', 'endTime', 'blockStartTime', 'blockEndTime'] as const;

/** The PATCH's date keys — the ones that can leave a range out of order. */
export const ITINERARY_DATE_KEYS = ['date', 'startDate', 'endDate'] as const;

/** The two fields that decide whether a row's clock is the vendor's. */
export interface ClockRow {
  vendorOptionType?: string | null;
  start_at?: Date | string | null;
}

/**
 * True when a vendor fixed the row's clock with its zone at commit: a flight, stated or not,
 * and any row whose start_at is stated (vendor-commit writes it only from a zone — a flight's
 * airports, a timed tour's operator). False for everything else.
 */
export function clockIsFixed(row: ClockRow): boolean {
  if (row.vendorOptionType === 'flight') return true;
  return row.start_at !== null && row.start_at !== undefined;
}

/** The calendar row's key, exactly as vendor-commit writes it: trip:<tripId>:vendor:<vendorOptionId>. */
export function tripVendorSourceId(tripId: string, vendorOptionId: string): string {
  return `trip:${tripId}:vendor:${vendorOptionId}`;
}

/** An itinerary row's two dates. */
export interface ItineraryDates {
  homeDate: Date;
  destDate: Date;
}

/** The row's dates after the edit: each date the body sets, every other date as the row stores it — nothing substituted. */
export function datesAfterEdit(stored: ItineraryDates, set: { homeDate?: Date; destDate?: Date }): ItineraryDates {
  return {
    homeDate: set.homeDate !== undefined ? set.homeDate : stored.homeDate,
    destDate: set.destDate !== undefined ? set.destDate : stored.destDate,
  };
}

/** A Date's UTC day, YYYY-MM-DD — the column is a date; the comparison is by day. */
export function utcDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Null when the range runs forward (the end on or after the start, compared as UTC days); else the refusal, naming both dates. */
export function rangeRefusal(after: ItineraryDates): string | null {
  const start = utcDay(after.homeDate);
  const end = utcDay(after.destDate);
  return end < start ? `the end date ${end} is before the start date ${start} — a range runs forward; move the start or the end` : null;
}
