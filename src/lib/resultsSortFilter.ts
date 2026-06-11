// ─── Client-side results sort + star-rating filter (PR-T-Filters) ────────────
// Pure helpers that operate on an ALREADY-FETCHED results array — NO fetch, NO
// mutation. Shared by HotelResultsView + ActivityResultsView, which pass per-view
// accessors because their price/rating field names differ (hotels:
// pricePerNight/priceTotal/price + googleRating; activities: price + googleRating).

export type SortKey = 'price-asc' | 'price-desc' | 'rating-desc';

export interface SortFilterAccessors<T> {
  /** Price used for the price sorts. May be null/undefined (→ sorts LAST). */
  getPrice: (item: T) => number | null | undefined;
  /** Rating (0–5) used for the rating sort + the star filter. */
  getRating: (item: T) => number | null | undefined;
}

export interface SortFilterOptions {
  sort: SortKey;
  /** Minimum star rating to keep; 0 = Any (keep all). */
  minRating: number;
}

/** Compare two possibly-null numbers, ALWAYS placing null/undefined last
 *  regardless of direction. `dir` = 1 ascending, -1 descending. */
function compareNullsLast(
  a: number | null | undefined,
  b: number | null | undefined,
  dir: 1 | -1,
): number {
  const an = a == null;
  const bn = b == null;
  if (an && bn) return 0;
  if (an) return 1;   // a is null → after b
  if (bn) return -1;  // b is null → a before b
  return (a - b) * dir;
}

/** Filter by minimum rating, then sort — returning a NEW array (no mutation).
 *  Items with a null/undefined rating are kept only when minRating === 0. Null
 *  prices/ratings always sort to the end, never crashing the comparator. */
export function sortAndFilterResults<T>(
  items: T[],
  { sort, minRating }: SortFilterOptions,
  { getPrice, getRating }: SortFilterAccessors<T>,
): T[] {
  const filtered =
    minRating > 0
      ? items.filter((it) => {
          const r = getRating(it);
          return typeof r === 'number' && r >= minRating;
        })
      : items.slice();

  return filtered.sort((x, y) => {
    if (sort === 'rating-desc') return compareNullsLast(getRating(x), getRating(y), -1);
    return compareNullsLast(getPrice(x), getPrice(y), sort === 'price-asc' ? 1 : -1);
  });
}
