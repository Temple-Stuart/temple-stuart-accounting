// ─── Viator Partner API Client ────────────────────────────────────────────────
// Searches Viator's inventory of bookable tours, activities, and experiences
// via the V2 Partner API. Rate limit: 150 requests per 10-second rolling window.
//
// V1 fallback host (viatorapi.viator.com) has been retired and now returns
// HTTP 503 globally — all V1 paths were removed in PR-5 quickfix.

import { ACTIVITY_LABELS } from './activities';
import { TRAVEL_COA } from './travelCOA';
import { MissingViatorKeyError, ViatorApiError } from './travelErrors';

const VIATOR_V2_BASE = 'https://api.viator.com/partner';

function getApiKey(): string {
  const key = process.env.VIATOR_API_KEY;
  if (!key) throw new MissingViatorKeyError();
  return key;
}

// V2 headers (recommended, exp-api-key)
function v2Headers(): Record<string, string> {
  return {
    'Accept-Language': 'en-US',
    'Content-Type': 'application/json',
    'Accept': 'application/json;version=2.0',
    'exp-api-key': getApiKey(),
  };
}

// ─── Normalized Product Type ─────────────────────────────────────────────────
// Works with both V1 and V2 response formats

export interface ViatorProduct {
  productCode: string;
  title: string;
  description: string;
  productUrl: string;          // affiliate booking URL
  price: number | null;        // from-price in USD
  priceFormatted: string;
  onSale: boolean;
  originalPrice: number | null;
  rating: number;
  reviewCount: number;
  thumbnailUrl: string;
  duration: string;            // human-readable: "3 hours", "Full day"
  durationMinutes: number | null;
  destinationName: string;
  categoryIds: number[];
}

export interface ViatorDestination {
  destinationId: number;
  destinationName: string;
  destinationType: string;
  parentId?: number;
  latitude?: number;
  longitude?: number;
}

// ─── Destination Lookup ──────────────────────────────────────────────────────

let cachedDestinations: ViatorDestination[] | null = null;
let destinationCacheTime = 0;
// In-flight promise: when N parallel callers in the SAME lambda all see
// the cache empty at the same moment, they share one in-flight fetch
// instead of firing N concurrent /destinations requests. Module-level
// dedup — NOT cross-lambda (Vercel can spawn multiple instances; each has
// its own module state). Cross-lambda dedup needs a persistent cache or
// a static destId map (see audit `travel-viator-rate-limit-live-audit.md`
// option 2A) — queued as a follow-up PR.
let destinationLoadPromise: Promise<ViatorDestination[]> | null = null;
const DEST_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

async function loadDestinations(): Promise<ViatorDestination[]> {
  if (cachedDestinations && cachedDestinations.length > 0 && Date.now() - destinationCacheTime < DEST_CACHE_TTL) {
    return cachedDestinations;
  }
  // In-flight de-dup: if another caller in this lambda already kicked off
  // the load, await its promise instead of firing our own /destinations.
  if (destinationLoadPromise) return destinationLoadPromise;

  destinationLoadPromise = (async (): Promise<ViatorDestination[]> => {
    try {
      const res = await fetch(`${VIATOR_V2_BASE}/destinations`, {
        headers: v2Headers(),
      });
      if (res.status === 429) {
        // FAIL LOUD on rate-limit — never degrade to an empty list (that, plus caching the
        // [], was the poisoned-cache bug). The route's try/catch maps this to an error response.
        throw new ViatorApiError('V2 /destinations rate-limited (429)', 429, await res.text());
      }
      if (!res.ok) {
        throw new ViatorApiError('V2 /destinations', res.status, await res.text());
      }
      const data = await res.json();
      // Filter at load time: Viator's V2 destinations catalog includes a few
      // taxonomic nodes (regions, "areas") where `destinationName` is null or
      // missing. The downstream `findDestinationId` calls `.toLowerCase()` on
      // every row during `Array.find()` iteration — one bad row crashes the
      // whole search with "Cannot read properties of undefined (reading
      // 'toLowerCase')". Drop the unusable rows here, log the count for
      // visibility, and never assume `destinationName` is a string downstream.
      // VERIFIED /destinations 200 shape (captured via the live destProbe): { destinations: [ {
      // destinationId:number, name:string, type:"CITY"|… }, … ], totalCount:number }. The array is
      // at data.destinations (data.data kept as a harmless legacy secondary). Accept ONLY an array.
      const arr: unknown[] | null =
        Array.isArray(data?.destinations) ? data.destinations
        : Array.isArray(data?.data) ? data.data
        : null;
      if (arr === null) {
        // The shape is now KNOWN — a 200 with no array at .destinations is a genuine regression.
        // FAIL LOUD (the route maps it to an error); never silently return [] / poison the cache.
        throw new ViatorApiError(
          `V2 /destinations unexpected shape (200, no array at .destinations/.data) — keys: ${
            data && typeof data === 'object' ? Object.keys(data).join(',') : typeof data
          }`,
          res.status,
        );
      }
      // DATA-COMPLETENESS: the verified response is a SINGLE page — totalCount === destinations.length
      // (both 3389), so the full catalog loads in one call. If Viator ever paginates (totalCount >
      // returned), DECLARE it loud rather than silently using a partial set (paging is a later PR).
      const totalCount = typeof data?.totalCount === 'number' ? data.totalCount : null;
      if (totalCount !== null && totalCount > arr.length) {
        console.warn(`[VIATOR] /destinations PAGINATED: totalCount=${totalCount} > returned=${arr.length} — using a PARTIAL set (single-page parse).`);
      }
      // Map the VERIFIED API fields (destinationId / name / type) into our internal
      // ViatorDestination shape (destinationId / destinationName / destinationType). The OLD code
      // filtered on `d.destinationName` — a field the API does NOT return (it returns `name`) — so
      // it dropped EVERY row → an empty list even on a valid 200. THIS was the original 0-match
      // root cause (alongside the 429/poisoned-cache fixed in PR-1).
      const usable: ViatorDestination[] = arr
        .filter((d): d is { destinationId: number; name: string; type?: unknown } =>
          typeof d === 'object' && d !== null &&
          typeof (d as { name?: unknown }).name === 'string' &&
          typeof (d as { destinationId?: unknown }).destinationId === 'number'
        )
        .map((d) => ({
          destinationId: d.destinationId,
          destinationName: d.name,
          destinationType: typeof d.type === 'string' ? d.type : '',
        }));
      const skipped = arr.length - usable.length;
      // Only cache a NON-EMPTY result — never poison the 24h cache with [] (an empty array is
      // truthy, so a cached [] was being served for 24h with no live call). On empty, leave the
      // cache untouched so the next call retries the live fetch.
      if (usable.length > 0) {
        cachedDestinations = usable;
        destinationCacheTime = Date.now();
      }
      console.log(
        `[Viator] Loaded ${usable.length} destinations (V2 /destinations)` +
        (skipped > 0 ? ` — skipped ${skipped} rows with missing name/destinationId` : '')
      );
      return usable;
    } catch (err) {
      if (err instanceof MissingViatorKeyError) throw err;
      // V1 fallback host has been retired (returns 503 globally). Fail loud — no
      // dead-fallback attempt. The V2 error has the auth context the user needs.
      throw err;
    }
  })();

  try {
    return await destinationLoadPromise;
  } finally {
    // Clear the in-flight slot. On success, the populated `cachedDestinations`
    // serves the next caller. On failure, the next caller will retry the
    // fetch (fail-loud is preserved — the rejection above bubbled up to the
    // first caller; we just don't pin a rejected promise on the module
    // forever).
    destinationLoadPromise = null;
  }
}

/** Find a Viator destination ID by city name */
export async function findDestinationId(cityName: string, countryName?: string): Promise<number | null> {
  const destinations = await loadDestinations();
  const cityLower = cityName.toLowerCase();

  // Exact city match
  let match = destinations.find(d =>
    d.destinationName.toLowerCase() === cityLower &&
    d.destinationType === 'CITY'
  );
  // Partial match on city type
  if (!match) {
    match = destinations.find(d =>
      d.destinationName.toLowerCase().includes(cityLower) &&
      d.destinationType === 'CITY'
    );
  }
  // Any type match
  if (!match) {
    match = destinations.find(d =>
      d.destinationName.toLowerCase().includes(cityLower)
    );
  }

  if (match) {
    console.log(`[Viator] Matched "${cityName}" → destId ${match.destinationId} (${match.destinationName})`);
    return match.destinationId;
  }

  console.warn(`[Viator] No destination match for "${cityName}"`);
  return null;
}

// ─── V2 Response Normalizer ──────────────────────────────────────────────────

function normalizeV2Product(p: any): ViatorProduct {
  console.log('[Viator V2] Raw product fields:', JSON.stringify({
    productCode: p.productCode, code: p.code, productUrl: p.productUrl,
    title: p.title?.substring(0, 50),
    allKeys: Object.keys(p).join(','),
  }));
  const coverImage = p.images?.find((i: any) => i.isCover) || p.images?.[0];
  const photoVariant = coverImage?.variants
    ?.filter((v: any) => v.width >= 400)
    ?.sort((a: any, b: any) => a.width - b.width)[0]
    || coverImage?.variants?.[0];

  const fromPrice = p.pricing?.summary?.fromPrice || null;
  const rating = p.reviews?.combinedAverageRating || 0;
  const reviewCount = p.reviews?.totalReviews || 0;
  const durationMins = p.duration?.fixedDurationInMinutes || null;

  return {
    productCode: p.productCode || '',
    title: p.title || '',
    description: (p.description || '').replace(/<[^>]*>/g, '').substring(0, 300),
    productUrl: p.productUrl || '',
    price: fromPrice,
    priceFormatted: fromPrice ? `$${fromPrice}` : '',
    onSale: (p.pricing?.summary?.fromPriceBeforeDiscount || 0) > (fromPrice || 0),
    originalPrice: p.pricing?.summary?.fromPriceBeforeDiscount || null,
    rating,
    reviewCount,
    thumbnailUrl: photoVariant?.url || '',
    duration: durationMins ? (durationMins >= 60 ? `${Math.floor(durationMins / 60)} hours` : `${durationMins} minutes`) : '',
    durationMinutes: durationMins,
    destinationName: '',
    categoryIds: [],
  };
}

// ─── COA Category → Search Terms ─────────────────────────────────────────────

// PR-9 Fix 3: tightened, intent-specific, non-overlapping search terms — three
// per category, chosen so each Viator carousel returns distinct inventory
// rather than the same generic "city tour" pool. See
// audit-reports/travel-viator-category-filter-audit.md.
const COA_TO_VIATOR_SEARCH: Record<string, string[]> = {
  adventure: ['surfing lesson', 'diving snorkeling', 'hiking trek'],
  arts_culture: ['temple tour', 'cultural show', 'traditional dance'],
  wellness: ['yoga class', 'spa massage', 'meditation retreat'],
  bucket_list: ['private day tour', 'luxury experience', 'multi day tour'],
};

function buildSearchTerms(coaCategory: string, userInterests: string[]): string[] {
  const terms: string[] = [];

  const baseTerms = COA_TO_VIATOR_SEARCH[coaCategory];
  if (baseTerms) terms.push(...baseTerms);

  const coaCat = TRAVEL_COA[coaCategory];
  if (coaCat?.interestSlugs) {
    const activeInCategory = userInterests.filter(s => coaCat.interestSlugs!.includes(s));
    for (const slug of activeInCategory) {
      const label = ACTIVITY_LABELS[slug];
      if (label) terms.push(label);
    }
  }

  if (terms.length === 0) {
    const label = TRAVEL_COA[coaCategory]?.label;
    if (label) terms.push(label);
  }

  return [...new Set(terms)];
}

// ─── Affiliate URL Construction ──────────────────────────────────────────────
const VIATOR_PARTNER_ID = 'P00294427';
const VIATOR_MCID = '42383';

function buildAffiliateUrl(productCode: string): string {
  return `https://www.viator.com/tours/${productCode}?pid=${VIATOR_PARTNER_ID}&mcid=${VIATOR_MCID}&medium=api`;
}

// ─── Product Search ──────────────────────────────────────────────────────────

/** V2 /products/search — best for destination-based filtering with tags */
async function searchV2Products(destId: number, maxCount: number, tagIds?: number[], start: number = 1): Promise<ViatorProduct[]> {
  const body: Record<string, any> = {
    filtering: {
      destination: String(destId),
    },
    sorting: { sort: 'DEFAULT' },
    pagination: { start, count: Math.min(maxCount, 50) },
    currency: 'USD',
  };
  if (tagIds && tagIds.length > 0) {
    body.filtering.tags = tagIds;
  }

  const res = await fetch(`${VIATOR_V2_BASE}/products/search`, {
    method: 'POST',
    headers: v2Headers(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new ViatorApiError('V2 /products/search', res.status, await res.text());
  }

  const data = await res.json();
  return (data.products || []).map(normalizeV2Product);
}

/** V2 /search/freetext — best for keyword-based searching */
async function searchV2Freetext(searchTerm: string, destId: number | null, maxCount: number, start: number = 1): Promise<ViatorProduct[]> {
  const body: Record<string, any> = {
    searchTerm,
    searchTypes: [{ searchType: 'PRODUCTS', pagination: { start, count: Math.min(maxCount, 50) } }],
    currency: 'USD',
    // /search/freetext accepts REVIEW_AVG_RATING (per Viator's documented
    // enum); TRAVELER_RATING is only valid on /products/search. Using the
    // wrong value returns "Invalid sort: TRAVELER_RATING".
    productSorting: { sort: 'REVIEW_AVG_RATING', order: 'DESCENDING' },
  };
  if (destId) {
    // PR-10 Fix 1: Viator /search/freetext expects `destination` as a plain
    // destId value, not the `{ type, destId }` shape used by /products/search.
    // Sending the nested object returned BAD_REQUEST "Invalid value format
    // for field: destination" on every freetext call — exposed once PR-9
    // promoted freetext to the primary search path.
    body.productFiltering = { destination: destId };
  }

  const res = await fetch(`${VIATOR_V2_BASE}/search/freetext`, {
    method: 'POST',
    headers: v2Headers(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new ViatorApiError('V2 /search/freetext', res.status, await res.text());
  }

  const data = await res.json();

  // Freetext response shape varies: the products array may sit at a top-level key, inside a
  // paginated wrapper (e.g. { results: [...] }), or nested under the searchTypes entry (the
  // request asks for searchTypes:[{searchType:'PRODUCTS'}]). Resolve it DEFENSIVELY — try the
  // plausible ARRAY locations in order and use the FIRST that is actually an array. NEVER call
  // .map on a non-array: that was the production crash
  // "(j.products || j.data || []).map is not a function" (data.products was a truthy non-array).
  const firstSearchType = Array.isArray(data?.searchTypes) ? data.searchTypes[0] : undefined;
  const candidates: unknown[] = [
    data?.products,
    data?.data,
    data?.results,
    data?.products?.results,
    data?.data?.results,
    data?.data?.products,
    firstSearchType?.products,
    firstSearchType?.products?.results,
    firstSearchType?.results,
  ];
  const productsArr = candidates.find((c): c is any[] => Array.isArray(c));
  if (!productsArr) {
    // No products array in the freetext response — return TRUE empty (never fabricated data),
    // loud (not silent) so an unexpected shape stays visible.
    console.warn('[Viator] freetext: no products array in response — returning empty.');
  }
  return (productsArr ?? []).map(normalizeV2Product);
}

/** Search Viator products by destination + category terms */
export async function searchViatorProducts(
  city: string,
  country: string,
  coaCategory: string,
  userInterests: string[],
  maxResults: number = 33,
  /** Pre-resolved Viator destination ID (e.g. from
   *  `findViatorDestIdFor()` in destinations.ts). When provided, we skip
   *  the rate-limited `/partner/destinations` lookup entirely — the durable
   *  fix for cross-lambda 429s identified in audit `travel-viator-rate-
   *  limit-live-audit.md`. Pass `null`/`undefined` to fall back to the
   *  dynamic lookup (with PR-7's in-lambda memo). */
  preResolvedDestId?: number | null,
): Promise<ViatorProduct[]> {
  const searchTerms = buildSearchTerms(coaCategory, userInterests);
  if (searchTerms.length === 0) return [];

  // Skip-direct path: when a pre-resolved destId is on file, NEVER call
  // /partner/destinations. Fall back to the dynamic lookup only when it
  // isn't (long-tail destinations that haven't been added to the static
  // map yet).
  const destId = preResolvedDestId ?? await findDestinationId(city, country);

  const allProducts: ViatorProduct[] = [];
  const seenCodes = new Set<string>();

  const addProducts = (products: ViatorProduct[]) => {
    for (const p of products) {
      const key = p.productCode || p.title;
      if (key && !seenCodes.has(key)) {
        seenCodes.add(key);
        allProducts.push(p);
      }
    }
  };

  // Re-throw missing-key + 4xx errors so the route surfaces them; swallow
  // 5xx/network errors and try the next step (transient — the next endpoint
  // might still work).
  const rethrowIfHardFailure = (err: unknown): void => {
    if (err instanceof MissingViatorKeyError) throw err;
    if (err instanceof ViatorApiError && err.status >= 400 && err.status < 500) throw err;
  };

  // PR-9 Fix 1+4: PRIMARY path is /search/freetext per intent-specific term,
  // paginated up to maxResults. This is what surfaces distinct inventory per
  // carousel — the prior `/products/search`-first path returned the same
  // destination-wide pool for every category. See
  // audit-reports/travel-viator-category-filter-audit.md. Per-term pagination
  // budget: ~5 pages × 3 terms × 4 categories ≈ 60 calls per scan, well
  // inside Viator's 150-req/10s window.
  const PAGE_SIZE = 50;

  // PR-11: 'activities' is the unified bucket — every Viator product for the
  // destination, no intent partitioning. Skip the per-term freetext loop and
  // hit /products/search directly (paginated). Cuts the Viator call budget
  // for activities from ~60 (4 cats × 3 terms × 5 pages) to ~5 pages × 1 call,
  // and avoids the per-category dedupe problem entirely. Other COA keys
  // (legacy adventure / arts_culture / wellness / bucket_list when they're
  // still invoked from non-carousel code paths) keep the freetext orchestration.
  if (destId && coaCategory === 'activities') {
    let start = 1;
    while (allProducts.length < maxResults) {
      try {
        const page = await searchV2Products(destId, PAGE_SIZE, undefined, start);
        if (page.length === 0) break;
        const beforeCount = allProducts.length;
        addProducts(page);
        console.log(`[Viator] /products/search activities page start=${start}: +${allProducts.length - beforeCount} new (${page.length} returned)`);
        if (page.length < PAGE_SIZE) break;
        start += PAGE_SIZE;
      } catch (err) {
        rethrowIfHardFailure(err);
        console.error(`[Viator] V2 /products/search activities transient error start=${start}:`, err);
        break;
      }
    }
  } else if (destId) {
    for (const term of searchTerms) {
      if (allProducts.length >= maxResults) break;
      let start = 1;
      // Paginate this term until we hit maxResults, an empty page, or a short page.
      while (allProducts.length < maxResults) {
        try {
          const page = await searchV2Freetext(term, destId, PAGE_SIZE, start);
          if (page.length === 0) break;
          const beforeCount = allProducts.length;
          addProducts(page);
          console.log(`[Viator] freetext "${term}" page start=${start}: +${allProducts.length - beforeCount} new (${page.length} returned)`);
          if (page.length < PAGE_SIZE) break;
          start += PAGE_SIZE;
        } catch (err) {
          rethrowIfHardFailure(err);
          console.error(`[Viator] V2 freetext transient error for "${term}" start=${start}:`, err);
          break;
        }
      }
    }
  } else {
    // No destId — city-suffixed freetext (legacy path for long-tail cities).
    for (const term of searchTerms) {
      if (allProducts.length >= maxResults) break;
      try {
        const products = await searchV2Freetext(`${term} ${city}`, null, PAGE_SIZE, 1);
        addProducts(products);
      } catch (err) {
        rethrowIfHardFailure(err);
        console.error(`[Viator] V2 freetext transient error for "${term} ${city}":`, err);
      }
    }
  }

  // FALLBACK: when intent-specific freetext yielded nothing (e.g. niche
  // category with no inventory for this destination), broadcast-fetch the
  // destination via /products/search so the UI isn't empty for popular cities
  // that do have generic tours. Paginated to the same maxResults cap. The
  // 'activities' bucket already used /products/search as the primary, so
  // skipping the fallback for it avoids a redundant call.
  if (destId && coaCategory !== 'activities' && allProducts.length === 0) {
    let start = 1;
    while (allProducts.length < maxResults) {
      try {
        const page = await searchV2Products(destId, PAGE_SIZE, undefined, start);
        if (page.length === 0) break;
        addProducts(page);
        if (page.length < PAGE_SIZE) break;
        start += PAGE_SIZE;
      } catch (err) {
        rethrowIfHardFailure(err);
        console.error(`[Viator] V2 /products/search fallback transient error start=${start}:`, err);
        break;
      }
    }
    console.log(`[Viator] /products/search fallback for destId ${destId}: ${allProducts.length} results`);
  }

  // V1 fallback paths were removed in PR-5 — the V1 host (viatorapi.viator.com)
  // has been retired and returns 503 globally.

  console.log(`[Viator] ${coaCategory}: ${allProducts.length} products found for ${city}`);

  // Sort by rating × log(reviewCount) and return top N
  return allProducts
    .filter(p => p.rating > 0) // exclude unrated products
    .sort((a, b) => {
      const scoreA = a.rating * Math.log10(Math.max(a.reviewCount, 1));
      const scoreB = b.rating * Math.log10(Math.max(b.reviewCount, 1));
      return scoreB - scoreA;
    })
    .slice(0, maxResults);
}

/**
 * Search Viator products filtered by TAG ids — the verified mechanism for category-specific
 * inventory like ground transfers (tags 21745 "Transfers" + 12044 "Airport & Hotel Transfers").
 * Resolves destId exactly like searchViatorProducts (static map via preResolvedDestId → dynamic
 * findDestinationId), then queries EACH tag and MERGES + DEDUPES by productCode (some products
 * carry both tags). Unlike searchViatorProducts (activities) it does NOT apply a rating>0 filter —
 * transfers are bookable regardless of review count, so we surface every REAL product. Returns []
 * HONESTLY when the city has no destId or no products — never fabricated/sample data.
 */
export async function searchViatorProductsByTags(
  city: string,
  country: string,
  tagIds: number[],
  maxResults: number = 12,
  preResolvedDestId?: number | null,
): Promise<ViatorProduct[]> {
  if (tagIds.length === 0) return [];
  const destId = preResolvedDestId ?? await findDestinationId(city, country);
  if (!destId) {
    console.warn(`[Viator] tag search: no destId for "${city}, ${country}" — returning empty (honest, no fabricated data).`);
    return [];
  }
  const byCode = new Map<string, ViatorProduct>();
  for (const tagId of tagIds) {
    if (byCode.size >= maxResults) break;
    try {
      const page = await searchV2Products(destId, maxResults, [tagId]);
      for (const p of page) {
        const key = p.productCode || p.title;
        if (key && !byCode.has(key)) byCode.set(key, p); // MERGE + DEDUPE by productCode
      }
    } catch (err) {
      // Re-throw HARD failures (missing key, 4xx incl 429) so the route surfaces them as
      // 429/5xx; swallow a transient 5xx for one tag so the other tag can still return.
      if (err instanceof MissingViatorKeyError) throw err;
      if (err instanceof ViatorApiError && err.status >= 400 && err.status < 500) throw err;
      console.error(`[Viator] tag ${tagId} search transient error:`, err);
    }
  }
  return [...byCode.values()].slice(0, maxResults);
}

// ─── Product → GrokRecommendation Mapping ────────────────────────────────────

export function viatorProductToRecommendation(
  product: ViatorProduct,
  category: string,
  budgetKey: string,
): {
  name: string;
  address: string;
  website: string | null;
  photoUrl: string | null;
  priceLevel: number | null;
  priceLevelDisplay: string | null;
  googleRating: number;
  reviewCount: number;
  sentimentScore: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  summary: string;
  warnings: string[];
  trending: boolean;
  fitScore: number;
  valueRank: number;
  category: string;
  compositeScore: number;
  viatorProductCode: string;
  bookingUrl: string | null;
  durationMinutes: number | null;
  price: number | null;
} {
  const { rating, reviewCount, price, durationMinutes } = product;

  // Map price to price level (1-4 scale)
  let priceLevel: number | null = null;
  if (price != null) {
    if (price < 25) priceLevel = 1;
    else if (price < 75) priceLevel = 2;
    else if (price < 200) priceLevel = 3;
    else priceLevel = 4;
  }

  const sentiment = rating >= 4.5 ? 'positive' as const : rating >= 3.5 ? 'neutral' as const : 'negative' as const;
  const sentimentScore = Math.round(rating * 2);
  const fitScore = Math.min(10, Math.round(rating * 2));

  // Composite score
  const mandateFit = Math.min(100, fitScore * 10);
  const rawQuality = rating * Math.log10(Math.max(reviewCount, 1));
  const quality = Math.min(100, (rawQuality / 15) * 100);
  const compositeScore = Math.round(mandateFit * 0.4 + quality * 0.35 + 75 * 0.25);

  const durationText = product.duration || '';
  const priceText = price != null ? `From $${price}` : '';
  const summaryParts = [product.description || '', durationText ? `Duration: ${durationText}` : '', priceText].filter(Boolean);

  const affiliateUrl = product.productCode
    ? buildAffiliateUrl(product.productCode)
    : product.productUrl || null;

  console.log('[Viator] URL resolution:', JSON.stringify({
    productCode: product.productCode,
    productUrl: product.productUrl?.substring(0, 80),
    affiliateUrl: affiliateUrl?.substring(0, 80),
    title: product.title?.substring(0, 40),
  }));

  return {
    name: product.title,
    address: product.destinationName || '',
    website: affiliateUrl || product.productUrl || null,
    photoUrl: product.thumbnailUrl || null,
    priceLevel,
    priceLevelDisplay: price != null ? `$${price}` : null,
    googleRating: rating,
    reviewCount,
    sentimentScore,
    sentiment,
    summary: summaryParts.join('. ').substring(0, 400),
    warnings: product.onSale && product.originalPrice ? [`Was $${product.originalPrice}, now $${price}`] : [],
    trending: false,
    fitScore,
    valueRank: 1,
    category,
    compositeScore,
    viatorProductCode: product.productCode,
    bookingUrl: affiliateUrl || product.productUrl || null,
    durationMinutes,
    price,
  };
}

// ─── Categories that use Viator vs Google Places ─────────────────────────────

// Mirrors SOURCE_BY_CATEGORY in travelSourceRegistry.ts — these are the four
// COA categories actually routed to Viator. Kept in sync with the registry.
export const VIATOR_CATEGORIES = new Set([
  'adventure',
  'arts_culture',
  'wellness',
  'bucket_list',
]);

export function isViatorCategory(category: string): boolean {
  return VIATOR_CATEGORIES.has(category);
}
