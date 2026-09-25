/**
 * LANE-01 (2026-09-25) — A RESERVATION KNOWS WHAT IT IS.
 *
 * THE DEFECT. reservations had no lane column, so three routes each carried their
 * own PROVIDER_TYPE map (reservations/[id], reservations/unattached,
 * trips/[id]/reservations) deriving a type from `provider` — every one mapping
 * liteapi → 'hotel'. LiteAPI is now both rails, so every FLIGHT rendered as a
 * hotel. And each named a row `hotelName ?? provider`: a flight writes hotelName
 * null, so a paid flight was named "liteapi" on a customer-facing ledger — a
 * fallback emitting an internal vendor slug.
 *
 * THE RULE. Type comes from `reservations.lane` — the value the book route already
 * held and now writes — and NEVER from `provider`. The name comes from stated
 * fields only: `displayName` when the lane has stated one (a stay's hotel name; a
 * flight's carrier + route once GET /flights/bookings has answered), otherwise the
 * lane word and the row's own booking reference. Nothing displays "liteapi".
 *
 * ONE reader, pure, used by every route and component that puts a reservation's
 * kind or name in front of a customer.
 */

export const RESERVATION_LANES = ['hotel', 'flight', 'activity'] as const;
export type ReservationLane = (typeof RESERVATION_LANES)[number];

export function isReservationLane(v: unknown): v is ReservationLane {
  return typeof v === 'string' && (RESERVATION_LANES as readonly string[]).includes(v);
}

/** The lane's customer-facing word. */
export const LANE_WORD: Record<ReservationLane, string> = {
  hotel: 'Hotel',
  flight: 'Flight',
  activity: 'Activity',
};

/** The columns the reader needs — exactly the row's own stated fields. */
export interface ReservationIdentityRow {
  lane: string;
  displayName: string | null;
  providerConfirmationCode: string | null;
  providerBookingId: string;
}

export interface ReservationIdentity {
  /** The lane, verbatim. */
  type: ReservationLane;
  /** The stated name, or the lane word and the booking reference. Never a provider slug. */
  name: string;
}

/**
 * What a row IS and what it is CALLED, from the fields it actually carries.
 *
 * A lane the column does not admit is a programming error (the database CHECK
 * refuses it), and is thrown, not guessed around.
 *
 * THE NAME, by the ruling: a row displays the fields it actually carries; a flight
 * with no stated route displays as a flight with its booking reference. So: the
 * stated displayName when there is one; otherwise "<Lane> booking <reference>",
 * where the reference is the human confirmation code the vendor gave
 * (providerConfirmationCode — a PNR, an "FH-…" ref, a hotel confirmation) and,
 * when the vendor gave none, the provider's own booking id. Both are the row's
 * own identifiers; neither is the provider's name.
 */
export function reservationIdentity(row: ReservationIdentityRow): ReservationIdentity {
  if (!isReservationLane(row.lane)) {
    throw new Error(`reservation lane "${String(row.lane)}" is not one of ${RESERVATION_LANES.join(' | ')} — the column admits nothing else`);
  }
  const stated = typeof row.displayName === 'string' ? row.displayName.trim() : '';
  if (stated.length > 0) return { type: row.lane, name: stated };
  const code = typeof row.providerConfirmationCode === 'string' ? row.providerConfirmationCode.trim() : '';
  const reference = code.length > 0 ? code : row.providerBookingId;
  return { type: row.lane, name: `${LANE_WORD[row.lane]} booking ${reference}` };
}

/**
 * A flight's customer-facing name, from the vendor's STATED fields only:
 * carrier.marketingName + originCode → destinationCode. Any of the three absent →
 * null, and the caller leaves the name as it was. Nothing is abbreviated, guessed
 * or filled in.
 */
export function flightDisplayName(input: {
  carrierName: string | null | undefined;
  originCode: string | null | undefined;
  destinationCode: string | null | undefined;
}): string | null {
  const carrier = typeof input.carrierName === 'string' ? input.carrierName.trim() : '';
  const origin = typeof input.originCode === 'string' ? input.originCode.trim() : '';
  const destination = typeof input.destinationCode === 'string' ? input.destinationCode.trim() : '';
  if (!carrier || !origin || !destination) return null;
  return `${carrier} ${origin} → ${destination}`;
}
