/**
 * SELL-05 — THE DEAD GATES: category search, gated on a SIGNED-IN USER and
 * the existing caps — no tier, no per-category key. Pure, over a small port,
 * so the ruled cases run in node:test:
 *
 *   guest                         → 401, nothing else runs;
 *   per-IP burst (SEARCH_RATE_*)  → 429 with the limiter's Retry-After (unchanged);
 *   bad input                     → 400 (category ∉ the nine keys; city/country);
 *   a fresh places_cache bucket   → 200 with ZERO Google calls and NO cap reservation;
 *   a cache miss                  → ONE reservation against the travel-search
 *                                   daily cap (TRAVEL_SEARCH_DAILY_CAP, provider
 *                                   'googleplaces'), then the query set through
 *                                   the monthly-capped googleFetch; over either
 *                                   cap → a DECLARED 429 carrying the cap's own
 *                                   line and kind, never a 500.
 *
 * What stood here and is gone (the audit): requireTier('placesSearch') — a
 * tier nothing sells, so every customer was 403 forever — and the per-category
 * entitlement gate, whose keys nothing sells either since SELL-02 (the offer
 * law keeps the nine Google keys out of the purchasable set). The caps are
 * the cost control: cache-first, one daily reservation per uncached search,
 * every Google call counted against the monthly cap.
 *
 * The cap errors are matched by NAME (RateLimitError, TravelSearchQuotaError,
 * GooglePlacesQuotaError all set it) — their modules import prisma, and this
 * one imports nothing that does.
 */
import { GOOGLE_CATEGORY_KEYS } from '@/lib/categoryKeys';

/** The provider bucket the daily cap meters this search under (TRAVEL_SEARCH_DAILY_CAP_GOOGLEPLACES overrides the global cap). */
export const CATEGORY_SEARCH_PROVIDER = 'googleplaces';

/** Top-N after dedup/sort — the same arg the trip scan passes to searchPlacesMultiQuery. */
export const MAX_RESULTS = 60;

export const BURST_LINE = 'Too many searches — please slow down and try again shortly.';

export interface CategoryCard {
  placeId: string;
  name: string;
  address: string;
  rating: number | null;
  reviewCount: number | null;
  priceLevel: number | null;
  priceLevelDisplay: string | null;
  /** 'OPERATIONAL' from a fresh result; null from the cache, which does not persist business_status. */
  businessStatus: string | null;
  /** From the cache when it holds lat/lng; a fresh result carries no geometry. Never fabricated. */
  location: { lat: number; lng: number } | null;
}

/** The cache row shape this reads (placesCache.ts CachedPlace, the fields the card needs). */
export interface CachedPlaceRow {
  placeId: string;
  name: string;
  address: string;
  rating: number | null;
  reviewCount: number | null;
  priceLevel: number | null;
  priceLevelDisplay: string | null;
  latitude: number | null;
  longitude: number | null;
}

/** The fresh result shape this reads (placesSearch.ts PlaceResult, the fields the card needs). */
export interface FreshPlace {
  placeId: string;
  name: string;
  address: string;
  rating: number;
  reviewCount: number;
  priceLevel?: number;
  priceLevelDisplay: string | null;
  isOpen: boolean;
}

export function cachedToCard(p: CachedPlaceRow): CategoryCard {
  return {
    placeId: p.placeId,
    name: p.name,
    address: p.address,
    rating: p.rating,
    reviewCount: p.reviewCount,
    priceLevel: p.priceLevel,
    priceLevelDisplay: p.priceLevelDisplay,
    businessStatus: null,
    location: p.latitude != null && p.longitude != null ? { lat: p.latitude, lng: p.longitude } : null,
  };
}

export function freshToCard(p: FreshPlace): CategoryCard {
  return {
    placeId: p.placeId,
    name: p.name,
    address: p.address,
    rating: p.rating ?? null,
    reviewCount: p.reviewCount ?? null,
    priceLevel: p.priceLevel ?? null,
    priceLevelDisplay: p.priceLevelDisplay ?? null,
    businessStatus: p.isOpen ? 'OPERATIONAL' : null,
    location: null,
  };
}

export interface CategorySearchDeps<C extends CachedPlaceRow = CachedPlaceRow, F extends FreshPlace = FreshPlace> {
  findUser(email: string): Promise<{ id: string } | null>;
  /** Per-IP burst limiter (rateLimit.ts) — throws RateLimitError. */
  burst(ip: string): Promise<void>;
  cacheFresh(city: string, country: string, category: string): Promise<boolean>;
  cached(city: string, country: string, category: string): Promise<C[]>;
  /** One reservation against the travel-search daily cap for CATEGORY_SEARCH_PROVIDER — throws TravelSearchQuotaError. */
  reserveDaily(): Promise<void>;
  /** The category's proven query set (travelCOA getCOAScanQueries). */
  queriesFor(category: string): string[];
  /** The engine (searchPlacesMultiQuery) — every underlying Google call is monthly-capped; throws GooglePlacesQuotaError. */
  search(queries: string[], city: string, country: string): Promise<F[]>;
  store(results: F[], city: string, country: string, category: string): Promise<void>;
}

export interface CategorySearchInput {
  /** The verified cookie's email, or null for a guest. */
  viewer: string | null;
  ip: string;
  body: unknown;
}

export interface Outcome {
  status: number;
  body: Record<string, unknown>;
  headers?: Record<string, string>;
}

type CapError = Error & { callCount?: number; cap?: number; retryAfterSeconds?: number; provider?: string };

/** The declared 429 for a cap that was hit — the cap's own line, the kind, the count. */
export function capRefusal(err: unknown): Outcome | null {
  if (!(err instanceof Error)) return null;
  const e = err as CapError;
  if (e.name === 'RateLimitError') {
    return { status: 429, body: { error: BURST_LINE, kind: 'burst' }, headers: { 'Retry-After': String(e.retryAfterSeconds ?? 0) } };
  }
  if (e.name === 'TravelSearchQuotaError') {
    return { status: 429, body: { error: e.message, source: 'google', kind: 'daily_cap', provider: e.provider ?? CATEGORY_SEARCH_PROVIDER, used: e.callCount ?? 0, cap: e.cap ?? 0 } };
  }
  if (e.name === 'GooglePlacesQuotaError') {
    return { status: 429, body: { error: e.message, source: 'google', kind: 'quota_exceeded', used: e.callCount ?? 0, cap: e.cap ?? 0 } };
  }
  return null;
}

export async function categorySearch<C extends CachedPlaceRow, F extends FreshPlace>(deps: CategorySearchDeps<C, F>, input: CategorySearchInput): Promise<Outcome> {
  // 1 · a signed-in user — the one gate.
  if (!input.viewer) return { status: 401, body: { error: 'Unauthorized' } };
  const user = await deps.findUser(input.viewer);
  if (!user) return { status: 404, body: { error: 'User not found' } };

  try {
    // 2 · per-IP burst defense (unchanged).
    await deps.burst(input.ip);

    // 3 · the input.
    const b = (input.body && typeof input.body === 'object' ? input.body : {}) as Record<string, unknown>;
    const category = b.category;
    const city = typeof b.city === 'string' ? b.city.trim() : '';
    const country = typeof b.country === 'string' ? b.country.trim() : '';
    const radius = b.radius;
    if (typeof category !== 'string' || !(GOOGLE_CATEGORY_KEYS as readonly string[]).includes(category)) {
      return { status: 400, body: { error: `Invalid category. Allowed: ${GOOGLE_CATEGORY_KEYS.join(', ')}` } };
    }
    if (!city || !country) return { status: 400, body: { error: 'Missing required params: city, country' } };
    if (radius !== undefined && (typeof radius !== 'number' || !Number.isFinite(radius) || radius <= 0)) {
      return { status: 400, body: { error: 'radius must be a positive number' } };
    }

    // 4 · cache-first — a fresh bucket costs nothing and reserves nothing.
    if (await deps.cacheFresh(city, country, category)) {
      const rows = await deps.cached(city, country, category);
      return { status: 200, body: { results: rows.map(cachedToCard), count: rows.length, cached: true } };
    }

    // 5 · a miss: one daily reservation, then the query set (monthly-capped inside).
    await deps.reserveDaily();
    const results = await deps.search(deps.queriesFor(category), city, country);
    await deps.store(results, city, country, category);
    return { status: 200, body: { results: results.map(freshToCard), count: results.length, cached: false } };
  } catch (err) {
    const refused = capRefusal(err);
    if (refused) return refused;
    throw err;
  }
}
