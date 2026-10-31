/**
 * LANE-01 (2026-09-25) — THE ONE MAPPING FROM THE VENDOR'S FLIGHT STATUS TO OURS.
 *
 * The flights book route has always mapped the provider's booking status this way
 * (flights/book/route.ts, PR-FL-5): CONFIRMED / TICKETED → 'confirmed';
 * CANCELLED → 'cancelled'; anything else is NOT mapped. At creation the route
 * writes 'pending' for an unmapped status (PENDING_CONFIRMATION and PENDING are
 * success-shaped — the provider is finalizing). On a REFRESH (GET
 * /flights/bookings/{id}) an unmapped status leaves the row's status UNCHANGED —
 * the vendor is the only source that may change a reservation's status, and a
 * status it has not mapped changes nothing.
 *
 * One leaf, both callers, so the two can never drift.
 *
 * The GET reference documents CREATED · PENDING_CONFIRMATION · CONFIRMED ·
 * CANCELLED · CANCELLED_WITH_CHARGES. SEC-03 (2026-09-25) is the one-line ruling
 * LANE-01 said this would take: CANCELLED_WITH_CHARGES → 'cancelled'. A booking
 * the vendor cancelled and charged for is cancelled; the charge is the bank's
 * business, reconciled against the ledger, and a row that read "pending" for it
 * was wrong.
 *
 * STATUS-01 (2026-09-26): EVERY DOCUMENTED WORD MAPS BY NAME. CREATED and
 * PENDING_CONFIRMATION (the GET enum) and PENDING (the book answer's enum,
 * liteapiFlightsClient.ts FLIGHT_BOOKING_STATUSES) are 'pending' — the vendor's
 * own word for "not yet confirmed", and a refresh that finds it writes it. FAILED
 * and EXPIRED are on no GET enum; the webhook guide names flight.book.failed and
 * flight.book.expired, so both are mapped by name to 'failed' (an expired booking
 * will never be ticketed) and NEVER read as 'pending' or 'confirmed'. TICKETED is
 * the book answer's word (the GET states ticketing as ticketData.ticketedAt, a
 * timestamp, not a status word). A word outside this list maps to NULL and the
 * caller leaves the row unchanged with a named log; nothing else in src may turn
 * a flight status word into ours (the status law).
 */
export type MappedReservationStatus = 'pending' | 'confirmed' | 'cancelled' | 'failed';

export function flightProviderStatusToReservation(providerStatus: string | null | undefined): MappedReservationStatus | null {
  const s = (providerStatus ?? '').toUpperCase();
  if (s === 'CREATED' || s === 'PENDING_CONFIRMATION' || s === 'PENDING') return 'pending';
  if (s === 'CONFIRMED' || s === 'TICKETED') return 'confirmed';
  if (s === 'CANCELLED' || s === 'CANCELLED_WITH_CHARGES') return 'cancelled';
  if (s === 'FAILED' || s === 'EXPIRED') return 'failed';
  return null;
}
