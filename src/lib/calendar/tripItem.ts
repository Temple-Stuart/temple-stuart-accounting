/**
 * tripItem — A COMMITTED TRIP ITEM TAKES ITS TIME ON THE DAY (TRAVEL-01, 2026-09-19).
 *
 * vendor-commit writes two rows per committed option: the trip_itinerary row
 * (the item — its vendor, place, cost, and for a date-only category its block
 * window, block_start_time / block_end_time) and a calendar_events row for the
 * grid (source 'trip', source_id `trip:<tripId>:vendor:<optionId>`), which
 * carries a time of day for a FLIGHT only. So a flight drew by its duration
 * while an activity with a 14:00–16:00 window drew as an all-day chip.
 *
 * This leaf is the overlay the calendar feed applies: for every trip vendor row
 * it finds the item behind it and copies onto the row what the item knows —
 * its id, its vendor, its place, the provider it was booked through, and, for a
 * DATE-ONLY category (not a flight), its block window as the row's
 * start_time / end_time. GRID-01's extent leaf then draws it true, and a window
 * with a start and no end is the flagged marker it already is. A flight is
 * untouched: it keeps its duration geometry. HOTEL-01 (2026-09-22): a stay is
 * timed the same way — a stated check-in / check-out window draws on its days,
 * an unstated one leaves the stay all-day and the panel says the property did
 * not state it. Nothing is written; no time is defaulted; an item with no
 * window stays all-day.
 */

import { SOURCE_BY_CATEGORY } from '@/lib/travelSourceRegistry';

/** The categories whose calendar row carries no clock of its own — the ones the overlay times.
 *  HOTEL-01 (2026-09-22): a STAY joins them — its row carries no clock (vendor-commit
 *  writes none for lodging), so a stated check-in / check-out window is copied onto it
 *  exactly like an activity's, and a stay with no stated window stays all-day; the
 *  15:00 / 11:00 a stay used to be given is gone, so nothing is drawn at an invented clock. */
export const DATE_ONLY_TRIP_TYPES = ['activity', 'transfer', 'vehicle', 'lodging'] as const;
/** The categories the overlay never times: a flight draws by its duration. */
export const TIMED_BY_THEMSELVES = ['flight'] as const;

export function isDateOnlyTripType(vendorOptionType: string | null | undefined): boolean {
  return (DATE_ONLY_TRIP_TYPES as readonly string[]).includes(vendorOptionType ?? '');
}

/** `trip:<tripId>:vendor:<optionId>` → its two keys, or null for any other source_id. */
export function parseTripVendorSourceId(sourceId: string | null | undefined): { tripId: string; optionId: string } | null {
  const m = /^trip:([^:]+):vendor:(.+)$/.exec(sourceId ?? '');
  return m ? { tripId: m[1], optionId: m[2] } : null;
}

const SOURCE_LABEL: Record<string, string> = {
  liteapi: 'LiteAPI',
  viator: 'Viator',
  mozio: 'Mozio',
  google: 'Google Places',
};

/**
 * The provider a committed item was booked through, named the way the
 * registry names it (src/lib/travelSourceRegistry.ts SOURCE_BY_CATEGORY), or
 * null when the item did not come through a booking provider. A synthetic
 * `place-` id is a place picked on the map (Google Places), never a booking.
 */
export function providerOfTripItem(vendorOptionType: string | null | undefined, vendorOptionId: string | null | undefined): string | null {
  const id = vendorOptionId ?? '';
  if (id.startsWith('place-')) return SOURCE_LABEL.google;
  switch (vendorOptionType) {
    case 'flight': return `${SOURCE_LABEL[SOURCE_BY_CATEGORY.flights.source] ?? SOURCE_BY_CATEGORY.flights.source} flights`;
    case 'lodging': return SOURCE_LABEL[SOURCE_BY_CATEGORY.accommodation.source] ?? SOURCE_BY_CATEGORY.accommodation.source;
    case 'activity': return SOURCE_LABEL[SOURCE_BY_CATEGORY.activities.source] ?? SOURCE_BY_CATEGORY.activities.source;
    default: return null; // a transfer or a vehicle from the scanner: no booking provider connected
  }
}

/** The trip_itinerary columns the overlay reads. */
export interface TripItemRow {
  id: string;
  tripId: string;
  vendorOptionId: string | null;
  vendorOptionType: string | null;
  category: string;
  vendor: string;
  vendor_name: string | null;
  location: string | null;
  block_start_time: Date | string | null;
  block_end_time: Date | string | null;
}

/** The calendar_events columns the overlay reads and the fields it adds. */
export interface TripOverlayEvent {
  source: string;
  source_id?: string | null;
  start_time?: Date | string | null;
  end_time?: Date | string | null;
  location?: string | null;
  trip_item_id?: string | null;
  vendor_name?: string | null;
  item_category?: string | null;
  /** The item's vendorOptionType — the grid draws a DATE-ONLY type by its window, a flight by its duration. */
  item_type?: string | null;
  provider?: string | null;
}

/** A @db.Time value (a 1970-anchored Date or its ISO string) → 'HH:MM', or null. */
export function clockOfTime(v: Date | string | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  const s = v instanceof Date ? v.toISOString() : String(v);
  const m = /(\d{2}):(\d{2})/.exec(s.includes('T') ? s.split('T')[1] : s);
  return m ? `${m[1]}:${m[2]}` : null;
}

/**
 * The overlay. Pure: returns new event objects, the input untouched. A trip
 * vendor row whose item is not among `items` is returned as it was.
 */
export function overlayTripItems<E extends TripOverlayEvent>(events: readonly E[], items: readonly TripItemRow[]): E[] {
  const byKey = new Map<string, TripItemRow>();
  for (const it of items) if (it.vendorOptionId) byKey.set(`${it.tripId}:${it.vendorOptionId}`, it);
  return events.map((e) => {
    if (e.source !== 'trip') return e;
    const key = parseTripVendorSourceId(e.source_id);
    if (!key) return e;
    const item = byKey.get(`${key.tripId}:${key.optionId}`);
    if (!item) return e;
    const timed = isDateOnlyTripType(item.vendorOptionType) && e.start_time == null;
    const start = timed ? clockOfTime(item.block_start_time) : null;
    const end = timed && start ? clockOfTime(item.block_end_time) : null;
    return {
      ...e,
      trip_item_id: item.id,
      vendor_name: item.vendor_name ?? null,
      item_category: item.category,
      item_type: item.vendorOptionType ?? null,
      provider: providerOfTripItem(item.vendorOptionType, item.vendorOptionId),
      location: e.location ?? item.location ?? null,
      // A window is copied only where the row has no clock of its own and the
      // category is date-only; a start alone stays a start alone (GRID-01 flags it).
      ...(start ? { start_time: start, end_time: end } : {}),
    };
  });
}
