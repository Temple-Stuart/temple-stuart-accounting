/**
 * The Things-to-do search's request contract (ACTIVITY-01, 2026-09-22) — the
 * vendor's own POST /products/search filter, sort and pagination fields, forwarded
 * UNCHANGED once validated by name.
 *
 * The route is a GET, so the contract is its query string. Only the names below
 * are accepted; an unknown name is refused BY NAME, a bad value is refused by
 * name, and an absent name is not sent, so the vendor's own default applies —
 * nothing is invented here. The vendor's documented contract
 * (docs.viator.com/partner-api/technical, operationId productsSearch, schema
 * ProductSearchRequest — required: filtering, currency):
 *   · filtering.lowestPrice — number ≥ 0: "products that have a fromPrice that is
 *     higher than or equal to this price"; filtering.highestPrice — number > 0:
 *     "… lower than or equal to this price".
 *   · filtering.rating { from: integer ≥ 0 ("greater than this value"), to:
 *     integer ≥ 1 ("less than this value") }.
 *   · filtering.durationInMinutes { from: integer ≥ 0 ("equal or longer"), to:
 *     integer ≥ 1 ("equal or shorter") }.
 *   · filtering.flags[] — "products that include ALL of the given attributes":
 *     NEW_ON_VIATOR · FREE_CANCELLATION · SKIP_THE_LINE · PRIVATE_TOUR ·
 *     SPECIAL_OFFER · LIKELY_TO_SELL_OUT.
 *   · sorting.sort — DEFAULT ("'featured' products appear first … What Viator gets
 *     paid impacts this sort order"; "the order field should be omitted") · PRICE
 *     (order ASCENDING by default) · TRAVELER_RATING ("can only be used with an
 *     order of DESCENDING") · ITINERARY_DURATION · DATE_ADDED.
 *   · sorting.order — ASCENDING · DESCENDING, "when sort is PRICE".
 *   · pagination.count — integer 1..50, the vendor's default 10; pagination.start
 *     — integer ≥ 1, 1-based, the vendor's default 1: the screen's "Next" press
 *     sends the same filters with start = rows shown + 1, so the vendor's pages
 *     reveal its whole totalCount (SHOW THEM ALL, the founder's ruling,
 *     2026-09-22) — no client cap narrows what the vendor states.
 *   · currency — required by the vendor; sent from the ONE constant below.
 * The query names are the documented leaf names; a nested field's parent is its
 * prefix: ratingFrom / ratingTo = filtering.rating.from / .to; durationFrom /
 * durationTo = filtering.durationInMinutes.from / .to. filtering.destination is
 * the route's own (resolved from the city). tags, attractionId, startDate,
 * endDate, confirmationType and includeAutomaticTranslations are not
 * exposed by the screen and are refused by name like any other unknown; so is
 * `currency` — the request's currency is not the caller's to choose.
 *
 * THE CURRENCY INVARIANT (ruled 2026-09-22): no plan column carries a currency —
 * trips, budget_line_items and trip_itinerary have none (prisma/schema.prisma) —
 * and every plan amount is USD by the app's convention (the hotel Save sends an
 * amount alone; the client hard-codes 'USD'). So the currency the search SENDS
 * is ACTIVITY_SEARCH_CURRENCY and nothing else, and every price the screen
 * prints names the currency the ANSWER carried (pricing.currency, per product):
 * a product answered in another currency is shown in its own, never converted.
 *
 * PURE: no imports of the client, no env, no fetch.
 */

/** What the search sends as `currency` — the one constant; see the invariant above. */
export const ACTIVITY_SEARCH_CURRENCY = 'USD';

/** The search's own required names. */
export const ACTIVITY_SEARCH_BASE_PARAMS = ['city', 'country'] as const;
/** The vendor's filter, sort and pagination names the route forwards. */
export const ACTIVITY_FILTER_PARAMS = ['lowestPrice', 'highestPrice', 'ratingFrom', 'ratingTo', 'durationFrom', 'durationTo', 'flags', 'sort', 'order', 'count', 'start'] as const;
export const ACTIVITY_FLAGS = ['NEW_ON_VIATOR', 'FREE_CANCELLATION', 'SKIP_THE_LINE', 'PRIVATE_TOUR', 'SPECIAL_OFFER', 'LIKELY_TO_SELL_OUT'] as const;
export const ACTIVITY_SORTS = ['DEFAULT', 'PRICE', 'TRAVELER_RATING', 'ITINERARY_DURATION', 'DATE_ADDED'] as const;
export const ACTIVITY_ORDERS = ['ASCENDING', 'DESCENDING'] as const;
/** pagination.count's documented bounds, and the vendor's documented default when no count is sent. */
export const ACTIVITY_COUNT_MIN = 1;
export const ACTIVITY_COUNT_MAX = 50;
export const VENDOR_DEFAULT_COUNT = 10;
/** pagination.start's documented floor (1-based). */
export const ACTIVITY_START_MIN = 1;

export type ActivityFlag = (typeof ACTIVITY_FLAGS)[number];
export type ActivitySort = (typeof ACTIVITY_SORTS)[number];
export type ActivityOrder = (typeof ACTIVITY_ORDERS)[number];

/** What the route forwards — the vendor's field names, verbatim, only when sent. */
export interface ActivitySearchFilters {
  lowestPrice?: number;
  highestPrice?: number;
  rating?: { from?: number; to?: number };
  durationInMinutes?: { from?: number; to?: number };
  flags?: ActivityFlag[];
  sort?: ActivitySort;
  order?: ActivityOrder;
  count?: number;
  start?: number;
}

/** The documented request body, exactly as it is posted. */
export interface ProductSearchBody {
  filtering: {
    destination: string;
    lowestPrice?: number;
    highestPrice?: number;
    rating?: { from?: number; to?: number };
    durationInMinutes?: { from?: number; to?: number };
    flags?: ActivityFlag[];
  };
  sorting?: { sort: ActivitySort; order?: ActivityOrder };
  pagination?: { start?: number; count?: number };
  currency: string;
}

const supported = () => `${ACTIVITY_SEARCH_BASE_PARAMS.join(', ')}, ${ACTIVITY_FILTER_PARAMS.join(', ')}`;

function numberOf(raw: string): number | null {
  if (raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function integerOf(raw: string): number | null {
  const n = numberOf(raw);
  return n !== null && Number.isInteger(n) ? n : null;
}

/**
 * Validate the query string's filter, sort and pagination names. `names` is every
 * name the request carried (so an unknown one is refused by name); `get` reads a
 * value. Runs between the route's two guards, so a refusal never spends a slot.
 */
export function parseActivityFilters(names: readonly string[], get: (name: string) => string | null): { filters: ActivitySearchFilters } | { error: string } {
  const known = new Set<string>([...ACTIVITY_SEARCH_BASE_PARAMS, ...ACTIVITY_FILTER_PARAMS]);
  for (const n of names) {
    if (!known.has(n)) return { error: `${n} is not a supported search parameter (supported: ${supported()})` };
  }
  const filters: ActivitySearchFilters = {};

  const lowRaw = get('lowestPrice');
  if (lowRaw !== null) {
    const n = numberOf(lowRaw);
    if (n === null || n < 0) return { error: 'lowestPrice must be a number of 0 or more' };
    filters.lowestPrice = n;
  }
  const highRaw = get('highestPrice');
  if (highRaw !== null) {
    const n = numberOf(highRaw);
    if (n === null || n <= 0) return { error: 'highestPrice must be a number above 0' };
    filters.highestPrice = n;
  }

  const ratingFromRaw = get('ratingFrom');
  const ratingToRaw = get('ratingTo');
  if (ratingFromRaw !== null || ratingToRaw !== null) {
    const rating: { from?: number; to?: number } = {};
    if (ratingFromRaw !== null) {
      const n = integerOf(ratingFromRaw);
      if (n === null || n < 0) return { error: 'ratingFrom must be an integer of 0 or more' };
      rating.from = n;
    }
    if (ratingToRaw !== null) {
      const n = integerOf(ratingToRaw);
      if (n === null || n < 1) return { error: 'ratingTo must be an integer of 1 or more' };
      rating.to = n;
    }
    filters.rating = rating;
  }

  const durFromRaw = get('durationFrom');
  const durToRaw = get('durationTo');
  if (durFromRaw !== null || durToRaw !== null) {
    const duration: { from?: number; to?: number } = {};
    if (durFromRaw !== null) {
      const n = integerOf(durFromRaw);
      if (n === null || n < 0) return { error: 'durationFrom must be a whole number of minutes, 0 or more' };
      duration.from = n;
    }
    if (durToRaw !== null) {
      const n = integerOf(durToRaw);
      if (n === null || n < 1) return { error: 'durationTo must be a whole number of minutes, 1 or more' };
      duration.to = n;
    }
    filters.durationInMinutes = duration;
  }

  const flagsRaw = get('flags');
  if (flagsRaw !== null) {
    const flags = flagsRaw.split(',').map((s) => s.trim().toUpperCase()).filter((s) => s !== '');
    if (flags.length === 0 || flags.some((f) => !(ACTIVITY_FLAGS as readonly string[]).includes(f))) {
      return { error: `flags must be a comma list of ${ACTIVITY_FLAGS.join(', ')}` };
    }
    filters.flags = [...new Set(flags)] as ActivityFlag[];
  }

  const sortRaw = get('sort');
  const orderRaw = get('order');
  if (sortRaw !== null) {
    if (!(ACTIVITY_SORTS as readonly string[]).includes(sortRaw)) return { error: `sort must be one of ${ACTIVITY_SORTS.join(', ')}` };
    const sort = sortRaw as ActivitySort;
    if (orderRaw !== null) {
      if (!(ACTIVITY_ORDERS as readonly string[]).includes(orderRaw)) return { error: `order must be one of ${ACTIVITY_ORDERS.join(', ')}` };
      if (sort === 'DEFAULT') return { error: 'order may not be sent with sort DEFAULT — the vendor documents no ordering for it' };
      if (sort === 'TRAVELER_RATING' && orderRaw !== 'DESCENDING') return { error: 'sort TRAVELER_RATING takes only order DESCENDING' };
      filters.order = orderRaw as ActivityOrder;
    }
    filters.sort = sort;
  } else if (orderRaw !== null) {
    return { error: 'order needs a sort' };
  }

  const countRaw = get('count');
  if (countRaw !== null) {
    const n = integerOf(countRaw);
    if (n === null || n < ACTIVITY_COUNT_MIN || n > ACTIVITY_COUNT_MAX) return { error: `count must be a whole number from ${ACTIVITY_COUNT_MIN} to ${ACTIVITY_COUNT_MAX}` };
    filters.count = n;
  }

  const startRaw = get('start');
  if (startRaw !== null) {
    const n = integerOf(startRaw);
    if (n === null || n < ACTIVITY_START_MIN) return { error: `start must be a whole number of ${ACTIVITY_START_MIN} or more (1-based)` };
    filters.start = n;
  }

  return { filters };
}

/**
 * The body the route posts: the vendor's documented shape, holding only what was
 * sent. No sorting object when no sort was sent (the vendor's DEFAULT applies); no
 * pagination object when neither count nor start was sent (the vendor's 10 from 1
 * applies), and inside it only the field(s) sent; the currency is the one constant.
 */
export function activitySearchBodyOf(destination: string, f: ActivitySearchFilters): ProductSearchBody {
  const body: ProductSearchBody = { filtering: { destination }, currency: ACTIVITY_SEARCH_CURRENCY };
  if (f.lowestPrice !== undefined) body.filtering.lowestPrice = f.lowestPrice;
  if (f.highestPrice !== undefined) body.filtering.highestPrice = f.highestPrice;
  if (f.rating !== undefined) body.filtering.rating = { ...f.rating };
  if (f.durationInMinutes !== undefined) body.filtering.durationInMinutes = { ...f.durationInMinutes };
  if (f.flags !== undefined) body.filtering.flags = [...f.flags];
  if (f.sort !== undefined) body.sorting = f.order !== undefined ? { sort: f.sort, order: f.order } : { sort: f.sort };
  if (f.count !== undefined || f.start !== undefined) {
    body.pagination = {};
    if (f.start !== undefined) body.pagination.start = f.start;
    if (f.count !== undefined) body.pagination.count = f.count;
  }
  return body;
}
