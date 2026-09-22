/**
 * The hotel search's request contract (HOTEL-01, 2026-09-22) — the vendor's own
 * filter and sort fields, forwarded UNCHANGED once validated by name.
 *
 * The route is a GET, so the contract is its query string. Only the names below
 * are accepted; an unknown name is refused BY NAME, a bad value is refused by
 * name, and an absent name is simply not sent, so the vendor's own default
 * applies — nothing is invented here. The vendor's documented contract
 * (docs.liteapi.travel/reference/post_hotels-rates, get_data-hotels): starRating
 * takes ".0 and .5 only" values; refundableRatesOnly keeps RFN rates; boardType is a comma list of RO · BI · HB ·
 * FB · AI; sort is a field (top_picks · price · revenue) with a direction. The
 * vendor documents NO price range and NO rating or distance sort — those are not
 * in this contract and the screen says so where it narrows on the page. Its
 * minRating is documented on TWO scales (0–5 on /hotels/rates, out of 10 on the
 * catalog), so one number cannot honestly ride both calls: it is not accepted.
 *
 * PURE: no imports of the client, no env, no fetch.
 */

/** The search's own required and optional names (the pre-HOTEL-01 set). */
export const HOTEL_SEARCH_BASE_PARAMS = ['city', 'country', 'countryCode', 'checkin', 'checkout', 'adults', 'currency', 'guestNationality', 'latitude', 'longitude', 'radiusMeters'] as const;
/** The vendor's filter and sort names the route forwards. */
export const HOTEL_FILTER_PARAMS = ['starRating', 'refundableRatesOnly', 'boardType', 'sort', 'sortDirection'] as const;
export const HOTEL_BOARD_TYPES = ['RO', 'BI', 'HB', 'FB', 'AI'] as const;
export const HOTEL_SORT_FIELDS = ['top_picks', 'price', 'revenue'] as const;
export const HOTEL_SORT_DIRECTIONS = ['ascending', 'descending'] as const;
/** The star values the vendor admits: whole and half stars from 1 to 5. */
export const HOTEL_STAR_VALUES = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] as const;

export type HotelSortField = (typeof HOTEL_SORT_FIELDS)[number];
export type HotelSortDirection = (typeof HOTEL_SORT_DIRECTIONS)[number];

/** What the route forwards to the client's search — the vendor's field names, verbatim. */
export interface HotelSearchFilters {
  starRating?: number[];
  refundableRatesOnly?: boolean;
  boardType?: string;
  sort?: Array<{ field: HotelSortField; direction: HotelSortDirection }>;
}

const supported = () => `${HOTEL_SEARCH_BASE_PARAMS.join(', ')}, ${HOTEL_FILTER_PARAMS.join(', ')}`;

/**
 * Validate the query string's filter and sort names. `names` is every name the
 * request carried (so an unknown one is refused by name); `get` reads a value.
 */
export function parseHotelFilters(names: readonly string[], get: (name: string) => string | null): { filters: HotelSearchFilters } | { error: string } {
  const known = new Set<string>([...HOTEL_SEARCH_BASE_PARAMS, ...HOTEL_FILTER_PARAMS]);
  for (const n of names) {
    if (!known.has(n)) return { error: `${n} is not a supported search parameter (supported: ${supported()})` };
  }
  const filters: HotelSearchFilters = {};
  const starRaw = get('starRating');
  if (starRaw !== null) {
    const stars = starRaw.split(',').map((s) => s.trim()).filter((s) => s !== '').map(Number);
    if (stars.length === 0 || stars.some((n) => !(HOTEL_STAR_VALUES as readonly number[]).includes(n))) {
      return { error: `starRating must be a comma list of ${HOTEL_STAR_VALUES.join(', ')}` };
    }
    filters.starRating = [...new Set(stars)].sort((a, b) => a - b);
  }
  const refRaw = get('refundableRatesOnly');
  if (refRaw !== null) {
    if (refRaw !== 'true' && refRaw !== 'false') return { error: 'refundableRatesOnly must be true or false' };
    filters.refundableRatesOnly = refRaw === 'true';
  }
  const boardRaw = get('boardType');
  if (boardRaw !== null) {
    const codes = boardRaw.split(',').map((s) => s.trim().toUpperCase()).filter((s) => s !== '');
    if (codes.length === 0 || codes.some((c) => !(HOTEL_BOARD_TYPES as readonly string[]).includes(c))) {
      return { error: `boardType must be a comma list of ${HOTEL_BOARD_TYPES.join(', ')}` };
    }
    filters.boardType = [...new Set(codes)].join(',');
  }
  const sortRaw = get('sort');
  const dirRaw = get('sortDirection');
  if (sortRaw !== null) {
    if (!(HOTEL_SORT_FIELDS as readonly string[]).includes(sortRaw)) return { error: `sort must be one of ${HOTEL_SORT_FIELDS.join(', ')}` };
    if (dirRaw !== null && !(HOTEL_SORT_DIRECTIONS as readonly string[]).includes(dirRaw)) return { error: `sortDirection must be one of ${HOTEL_SORT_DIRECTIONS.join(', ')}` };
    filters.sort = [{ field: sortRaw as HotelSortField, direction: (dirRaw ?? 'ascending') as HotelSortDirection }];
  } else if (dirRaw !== null) {
    return { error: 'sortDirection needs a sort field' };
  }
  return { filters };
}
