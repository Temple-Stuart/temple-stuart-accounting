/**
 * STATUS-01 (2026-09-26) — THE ONE MAPPING FROM THE VENDOR'S HOTEL STATUS TO OURS.
 *
 * Before this leaf the hotel status word was fabricated twice: the book route
 * turned any word other than CONFIRMED into 'pending' and a missing word into
 * CONFIRMED (liteapi/book/route.ts), and parseBookResult defaulted an absent
 * status to 'CONFIRMED' (liteapiClient.ts). A status the vendor did not state
 * became CONFIRMED; a CANCELED or FAILED book answer collapsed to 'pending'.
 *
 * THE WORDS, EACH BY NAME, from the vendor's own pages:
 *   docs.liteapi.travel/reference/post_rates-book and get_bookings-bookingid:
 *     status is "CONFIRMED" or "CANCELED" (one L) — "At this point it will be
 *     CONFIRMED, the other option for this field is CANCELED".
 *   docs.liteapi.travel/reference/put_bookings-bookingid (the cancel):
 *     "CANCELLED" (fully refundable) and "CANCELLED_WITH_CHARGES".
 *   FAILED is on no hotel page's status enum; the webhook guide names a
 *     booking.book_error event, so the word is mapped by name and NEVER read as
 *     'pending' or 'confirmed'. It is listed here so that a book answer stating
 *     FAILED lands as 'failed', not as a booking that looks alive.
 *
 * A word outside this list, or no word at all, maps to NULL: the caller leaves
 * the row's status UNCHANGED (a refresh) or records 'pending' with a named log
 * (the book route — the vendor has already charged, so the row must exist, and
 * the scheduled refresh reads the truth within the hour). Nothing else in src
 * may turn a hotel status word into ours (the status law).
 */
export type MappedHotelStatus = 'confirmed' | 'cancelled' | 'failed';

export function hotelProviderStatusToReservation(providerStatus: string | null | undefined): MappedHotelStatus | null {
  const s = (providerStatus ?? '').toUpperCase();
  if (s === 'CONFIRMED') return 'confirmed';
  if (s === 'CANCELED' || s === 'CANCELLED' || s === 'CANCELLED_WITH_CHARGES') return 'cancelled';
  if (s === 'FAILED') return 'failed';
  return null;
}
