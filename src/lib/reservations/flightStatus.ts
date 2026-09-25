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
 * was wrong. CREATED and the two PENDING statuses stay unmapped on purpose: at
 * creation they persist as 'pending', on a refresh they change nothing.
 */
export type MappedReservationStatus = 'confirmed' | 'cancelled';

export function flightProviderStatusToReservation(providerStatus: string | null | undefined): MappedReservationStatus | null {
  const s = (providerStatus ?? '').toUpperCase();
  if (s === 'CONFIRMED' || s === 'TICKETED') return 'confirmed';
  if (s === 'CANCELLED' || s === 'CANCELLED_WITH_CHARGES') return 'cancelled';
  return null;
}
