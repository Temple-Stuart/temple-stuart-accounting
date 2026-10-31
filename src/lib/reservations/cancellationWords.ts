/**
 * CANCEL-01 (2026-09-26) — THE VENDOR'S WORDS, IN PLAIN WORDS.
 *
 * LiteAPI's cancellation quote states a `confidence` and a refund `destination`
 * from two closed vocabularies (docs.liteapi.travel/reference/
 * get_flights-bookings-bookingid-cancellations). A customer is asked to confirm a
 * cancellation on those words, so each is rendered as what it MEANS — "estimated"
 * is not "confirmed", and a refund to an agency deposit is not money back on a
 * card. A word outside the vocabulary is shown verbatim, never mapped to a
 * friendlier one. Pure; safe for the browser and the server alike.
 */

export const CANCELLATION_CONFIDENCE = ['confirmed', 'estimated', 'heuristic', 'unknown'] as const;
export const REFUND_DESTINATIONS = ['original_payment', 'agency_deposit', 'voucher', 'bsp_settlement', 'manual', 'unknown'] as const;

/** What the confidence word means for the figures beside it. */
export function confidenceWords(confidence: string | null): string {
  switch (confidence) {
    case 'confirmed': return 'Confirmed by the airline — these figures are what you will get.';
    case 'estimated': return 'Estimated — the airline has not confirmed these figures; the final refund may differ.';
    case 'heuristic': return 'A heuristic — derived from the fare rules, not confirmed by the airline; the final refund may differ.';
    case 'unknown': return 'The airline did not state how reliable these figures are.';
    case null: return 'The airline stated no confidence for these figures.';
    default: return `Confidence "${confidence}" — a word the airline uses that this app does not translate.`;
  }
}

/** Where a refund goes, in plain words. */
export function destinationWords(destination: string | null): string {
  switch (destination) {
    case 'original_payment': return 'back to the card you paid with';
    case 'agency_deposit': return 'to the agency deposit, not to your card — support settles it with you';
    case 'voucher': return 'as an airline voucher, not cash';
    case 'bsp_settlement': return 'through airline settlement (BSP), not directly to your card';
    case 'manual': return 'handled manually by the airline';
    case 'unknown': return 'the airline did not state where the refund goes';
    case null: return 'not stated';
    default: return `"${destination}" — a destination the airline uses that this app does not translate`;
  }
}

/** A money figure, or the honest absence. */
export function moneyWords(amount: number | null, currency: string | null): string {
  if (amount === null) return 'not stated by the airline';
  return `${currency ? `${currency} ` : ''}${amount.toFixed(2)}`;
}
