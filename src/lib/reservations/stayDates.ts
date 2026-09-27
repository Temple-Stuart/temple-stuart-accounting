/**
 * SEC-02b (2026-09-27) — A STAY'S FACTS ARE THE VENDOR'S, NEVER THE LINK'S.
 *
 * The hotel book route used to store the check-in and check-out the confirm page
 * relayed from its own URL (travel/liteapi/book/route.ts :280-281 at main 0c6fedca)
 * and to fall back to the URL's hotel name (:243) — and the check-out is the date
 * the commission lock reads (applyVendorState.ts COMMISSION_LOCK_GRACE_MS). An
 * edited link moved when a commission was marked earned. Alex's ruling: the dates
 * and the name are what the vendor's BOOK answer states (liteapiClient.ts
 * parseBookResult: checkin, checkout, hotel.name), or NULL — logged by bookingId.
 * Nothing here reads a link.
 */

/**
 * A day the vendor stated: 'YYYY-MM-DD' (optionally followed by a time), and a
 * real calendar day — else null. A malformed value is not a statement of a date.
 */
export function statedStayDay(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T ])/.exec(v.trim());
  if (!m) return null;
  const day = `${m[1]}-${m[2]}-${m[3]}`;
  const at = new Date(`${day}T12:00:00Z`);
  return !Number.isNaN(at.getTime()) && at.toISOString().slice(0, 10) === day ? day : null;
}

/** The column value for a stated day — noon UTC, the route's @db.Date convention — or NULL. */
export function stayDateColumn(day: string | null): Date | null {
  return day === null ? null : new Date(`${day}T12:00:00Z`);
}

/** A stored day read back as 'YYYY-MM-DD', or null. */
export function dayOfColumn(d: Date | null): string | null {
  return d === null ? null : d.toISOString().slice(0, 10);
}

/** The hotel's name as the vendor stated it — a non-blank string, verbatim — else null. */
export function statedHotelName(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v : null;
}

/** What the booking row holds of the stay — each field the vendor's, or NULL. */
export interface BookedStay {
  hotelName: string | null;
  checkinDate: Date | null;
  checkoutDate: Date | null;
  /** The fields the answer did not state, in words — empty when it stated all three. */
  unstated: string[];
}

/**
 * The stay, from the vendor's BOOK answer and nothing else. There is no second
 * argument: the confirm page's link cannot reach it.
 */
export function bookedStay(answer: { hotelName?: unknown; checkin?: unknown; checkout?: unknown }): BookedStay {
  const hotelName = statedHotelName(answer.hotelName);
  const checkin = statedStayDay(answer.checkin);
  const checkout = statedStayDay(answer.checkout);
  const unstated = [hotelName === null ? 'hotel name' : null, checkin === null ? 'check-in date' : null, checkout === null ? 'check-out date' : null].filter((w): w is string => w !== null);
  return { hotelName, checkinDate: stayDateColumn(checkin), checkoutDate: stayDateColumn(checkout), unstated };
}

/** The named log line for a stay the vendor did not state in full — by bookingId. */
export function unstatedStayLine(bookingId: string, unstated: string[]): string {
  return `[LiteAPI book] SEC-02b the vendor stated no ${unstated.join(', ')} for booking ${bookingId} — recorded NULL, never the link's; a NULL check-out is never locked for commission`;
}
