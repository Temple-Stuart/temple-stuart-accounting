/**
 * stayTimes — THE STAY'S TIMES ARE THE PROPERTY'S, NOT OURS (HOTEL-02, 2026-09-22).
 *
 * The vendor states a property's check-in and check-out only in its per-hotel
 * content (GET /data/hotel → checkinCheckoutTimes { checkin_start "04:00 PM",
 * checkin_end, checkout "11:00 AM" }) — never in the rates answer a search
 * joins. So the ONE place that call is made for a stay is the commit
 * (vendor-commit), once per booking, and this leaf reads what came back:
 *
 *   · a clock the property stated → 'HH:MM' (the 12-hour text read to the
 *     24-hour clock @db.Time and the ledger store);
 *   · a clock the property did not state → null — the row stays all-day and the
 *     calendar flags it (HOTEL-01's marker), never a time nobody stated;
 *   · a clock the property stated in words this reader cannot read → NOT null:
 *     the commit refuses, quoting the text, because a silently nulled time is a
 *     time somebody stated and we dropped.
 *
 * The window is checkin_start → checkout: the earliest check-in and the standard
 * check-out. checkin_end (the latest check-in) bounds nothing on the day and is
 * carried, not drawn. The vendor's clock is 12-hour text; hhmmOf is the ONE
 * reader of it (HOTEL-01's, moved here — the rates answer never carries a clock).
 *
 * PURE: no fetch, no env. The one tri-state helper is src/lib/travel/stated.ts.
 */

import { type Stated, statedString } from '@/lib/travel/stated';

/** The vendor's documented object on GET /data/hotel (docs.liteapi.travel/reference/get_data-hotel). */
export interface CheckinCheckoutTimes {
  /** "Earliest time a guest can check in." — e.g. "04:00 PM". */
  checkin_start?: string;
  /** "Latest time a guest can check in." — e.g. "12:00 AM". */
  checkin_end?: string;
  /** "Standard check-out time for guests." — e.g. "11:00 AM". */
  checkout?: string;
  instructions?: Array<{ id?: number; instruction?: string }>;
  special_instructions?: string;
}

/** The property's clock as the commit stores it: 'HH:MM' when stated, null when not. */
export interface PropertyClock {
  checkin: Stated<string>;
  checkout: Stated<string>;
}

/** The vendor's clock ("04:00 PM", "16:00", "11:00 AM") → "HH:MM", or null when it is not a clock. */
export function hhmmOf(v: Stated<string>): Stated<string> {
  if (v === null) return null;
  const m = /^\s*(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?\s*$/.exec(v);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const ap = m[3]?.toUpperCase();
  if (min > 59) return null;
  if (ap) {
    if (h < 1 || h > 12) return null;
    if (ap === 'AM') h = h === 12 ? 0 : h;
    else h = h === 12 ? 12 : h + 12;
  } else if (h > 23) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/**
 * The property's clock from its content. `{ clock }` when every stated time reads;
 * `{ unreadable }` naming the field and quoting the text when the property stated
 * a time this reader cannot read — the caller refuses, never nulls.
 */
export function propertyClockOf(times: CheckinCheckoutTimes | null | undefined): { clock: PropertyClock } | { unreadable: string } {
  const read = (field: 'checkin_start' | 'checkout'): Stated<string> | { unreadable: string } => {
    const text = statedString(times?.[field]);
    if (text === null) return null;
    const hhmm = hhmmOf(text);
    return hhmm === null ? { unreadable: `the property stated a ${field === 'checkin_start' ? 'check-in' : 'check-out'} time this reader cannot read: "${text}"` } : hhmm;
  };
  const checkin = read('checkin_start');
  if (checkin !== null && typeof checkin === 'object') return checkin;
  const checkout = read('checkout');
  if (checkout !== null && typeof checkout === 'object') return checkout;
  return { clock: { checkin, checkout } };
}

/** The words the commit's answer carries about the clock it stored. */
export function propertyClockStatement(clock: PropertyClock): string {
  const c = clock.checkin === null ? 'check-in time not stated by the property' : `check-in ${clock.checkin} stated by the property`;
  const o = clock.checkout === null ? 'check-out time not stated by the property' : `check-out ${clock.checkout} stated by the property`;
  return `${c}; ${o}`;
}
