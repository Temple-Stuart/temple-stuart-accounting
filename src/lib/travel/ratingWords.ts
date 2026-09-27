/**
 * LAW-02 (2026-09-27) — A RATING NOBODY STATED IS "NOT RATED", NEVER 0.
 *
 * The recommendation mappers (liteapiClient.ts liteApiHotelToRecommendation) now
 * carry an unstated rating, review count and score as NULL instead of 0. This is
 * the ONE place the planner turns them into words. A 0 is read the same as NULL:
 * on a 0-5 (or 0-10) rating scale no vendor states 0 — a 0 there is the old
 * `|| 0` default (viatorClient.ts still writes it, listed in the no-fabricated-
 * default law), so it is never printed as a rating. Pure: no import, no clock.
 */

export const RATING_WORDS = {
  notRated: 'not rated',
  reviewsNotStated: 'reviews not stated',
} as const;

/** Stated and above zero, or not a rating at all. */
function statedRating(v: number | null | undefined): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
}

/** "4.5 stars (1,203 reviews)", "4.5 stars (reviews not stated)", or "not rated". */
export function ratingLine(rating: number | null | undefined, reviewCount: number | null | undefined): string {
  const r = statedRating(rating);
  if (r === null) return RATING_WORDS.notRated;
  const reviews = typeof reviewCount === 'number' && Number.isFinite(reviewCount) ? `${reviewCount.toLocaleString('en-US')} reviews` : RATING_WORDS.reviewsNotStated;
  return `${r} stars (${reviews})`;
}

/** The bare rating for a compact card ("4.5"), or "not rated". */
export function ratingValue(rating: number | null | undefined): string {
  const r = statedRating(rating);
  return r === null ? RATING_WORDS.notRated : String(r);
}

/** A 0-10 score ("8/10"), or "not rated" when it was derived from no rating. */
export function scoreWords(score: number | null | undefined): string {
  return typeof score === 'number' && Number.isFinite(score) ? `${score}/10` : RATING_WORDS.notRated;
}
