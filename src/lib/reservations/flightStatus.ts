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
 * CANCELLED · CANCELLED_WITH_CHARGES. By the ruling this maps EXACTLY as the book
 * route does, so CANCELLED_WITH_CHARGES is, today, unmapped — a refresh reports it
 * by name as unmapped and changes nothing. Adding it is a one-line ruling.
 */
export type MappedReservationStatus = 'confirmed' | 'cancelled';

export function flightProviderStatusToReservation(providerStatus: string | null | undefined): MappedReservationStatus | null {
  const s = (providerStatus ?? '').toUpperCase();
  if (s === 'CONFIRMED' || s === 'TICKETED') return 'confirmed';
  if (s === 'CANCELLED') return 'cancelled';
  return null;
}
