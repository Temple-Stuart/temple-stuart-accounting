// Google Places: Source of Truth for Facts.
// COMPLIANCE: per Google Places API terms, do NOT pipe Google Places data to
// any AI/LLM. Results flow straight to the user, ranked by Google's own
// popularity signal — no AI step.
// COST: every outbound Google call goes through `googleFetch` (monthly cap
// guard). Photos are returned as server-proxied URLs (/api/places/photo?ref=)
// so the API key never reaches the client and photo bytes can be cached.

import { googleFetch, GooglePlacesQuotaError } from '@/lib/googlePlacesQuota';
import { MissingGoogleKeyError, GooglePlacesApiError } from '@/lib/travelErrors';

/** Server-side photo proxy URL — keeps the Google key off the client and lets
 *  the proxy cache photo bytes. The browser only fetches this when a result is
 *  actually expanded/selected (lazy). */
export function photoProxyUrl(ref: string): string {
  return `/api/places/photo?ref=${encodeURIComponent(ref)}`;
}

interface PlaceResult {
  name: string;
  address: string;
  placeId: string;
  rating: number;
  reviewCount: number;
  priceLevel?: number; // 1-4
  priceLevelDisplay: string | null; // $-$$$$ or null if unknown
  website?: string;
  isOpen: boolean;
  types: string[];
  photos?: string[];
  // Real coords from the Text Search result's geometry. Optional: undefined when a result
  // genuinely lacks geometry — never defaulted/fabricated (a missing pin is honest).
  latitude?: number;
  longitude?: number;
  popularityScore: number; // rating × log(reviewCount)
}

interface FilterCriteria {
  minRating?: number;
  minReviews?: number;
  maxPriceLevel?: number; // 1-4
  mustBeOpen?: boolean;
}

// Convert price_level (1-4) to display
export function formatPriceLevel(level?: number): string | null {
  if (level == null) return null;
  return '$'.repeat(level);
}

// Strip parenthetical annotations from a city string before stuffing it into a
// Google Text Search `query=` parameter. Destinations like "Bali (Canggu)"
// turn into `query=brunch in Bali (Canggu) Indonesia` which Google's text
// parser sometimes rejects with INVALID_REQUEST (PR-1 surfaces those instead
// of silently swallowing them). The Geocoding API is more permissive — we
// leave the raw city alone there. Result: "Bali (Canggu)" → "Bali Canggu".
function searchableCity(city: string): string {
  return city.replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Calculate popularity score from real data
export function calculatePopularity(rating: number, reviewCount: number): number {
  if (reviewCount < 1) return 0;
  return Math.round(rating * Math.log10(reviewCount) * 10) / 10;
}

// Search Google Places - get top 60 per category
export async function searchPlaces(
  query: string,
  city: string,
  country: string,
  maxResults: number = 60,
  type?: string
): Promise<PlaceResult[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    // Fail loud — surface to the route so the user sees "GOOGLE_PLACES_API_KEY
    // is not configured" instead of "0 results."
    throw new MissingGoogleKeyError();
  }

  // Geocode city
  const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(city + ', ' + country)}&key=${apiKey}`;

  try {
    const geoRes = await googleFetch(geoUrl);
    const geoData = await geoRes.json();

    // Geocoding statuses: OK | ZERO_RESULTS | OVER_QUERY_LIMIT | REQUEST_DENIED
    // | INVALID_REQUEST | UNKNOWN_ERROR. ZERO_RESULTS = legit "no match"; the
    // others are real errors we must surface.
    if (geoData.status && geoData.status !== 'OK' && geoData.status !== 'ZERO_RESULTS') {
      throw new GooglePlacesApiError(geoData.status, geoData.error_message);
    }

    if (!geoData.results?.[0]?.geometry?.location) {
      // Legit ZERO_RESULTS — city not found. Not an error; just no places.
      console.log(`[PLACES] Geocode ZERO_RESULTS for "${city}, ${country}"`);
      return [];
    }
    
    const { lat, lng } = geoData.results[0].geometry.location;
    
    // Search with pagination to get more results (3 pages × 20 = 60 max)
    let allPlaces: PlaceResult[] = [];
    let nextPageToken: string | null = null;
    
    for (let page = 0; page < 3 && allPlaces.length < maxResults; page++) {
      const searchUrl: string = nextPageToken
        ? `https://maps.googleapis.com/maps/api/place/textsearch/json?pagetoken=${nextPageToken}&key=${apiKey}`
        : `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query + ' in ' + searchableCity(city) + ' ' + country)}&location=${lat},${lng}&radius=20000${type ? `&type=${type}` : ''}&key=${apiKey}`;

      if (page > 0 && nextPageToken) {
        // Google requires 2 second delay between page requests
        await new Promise(r => setTimeout(r, 2000));
      }
      
      const searchRes = await googleFetch(searchUrl);
      const searchData = await searchRes.json();

      // Text Search statuses: OK | ZERO_RESULTS | OVER_QUERY_LIMIT |
      // REQUEST_DENIED | INVALID_REQUEST | UNKNOWN_ERROR. ZERO_RESULTS is
      // legit (no places match query); the others are real errors. Without
      // this check, a REQUEST_DENIED (billing off, API not enabled, key
      // restricted) silently became "0 results."
      if (searchData.status && searchData.status !== 'OK' && searchData.status !== 'ZERO_RESULTS') {
        // ─── PR-7 diagnostic log ──────────────────────────────────────────
        // One observation per failure: tells us whether the request fails
        // at page 0 (real content/auth/billing issue — must surface) or
        // page 1+ (pagetoken-not-yet-active timing race — page-0 results
        // we already collected are real). Remove in a follow-up once
        // confirmed.
        console.error('[PLACES] textsearch failure', {
          page,
          query: query.substring(0, 60),
          status: searchData.status,
          error_message: searchData.error_message ?? null,
          had_pagetoken: !!nextPageToken,
          results_accumulated_so_far: allPlaces.length,
        });

        // Page 0 = real request-content failure (auth, key, malformed
        // query, billing) — surface loud and throw per PR-1 fail-loud.
        // Page 1+ failures are typically pagetoken-not-yet-active timing
        // races (Google's documented behaviour); the page-0 results we
        // already accumulated are real successful data and must NOT be
        // discarded by a timing race. This is NOT a silent swallow:
        // page-0 still throws verbatim, and the partial-success path
        // emits a console.warn naming the query.
        if (page === 0 || allPlaces.length === 0) {
          throw new GooglePlacesApiError(searchData.status, searchData.error_message);
        }
        console.warn(
          `[PLACES] pagination failed at page ${page} for "${query}" — preserving ${allPlaces.length} results from earlier pages`,
          { status: searchData.status, error_message: searchData.error_message }
        );
        break;
      }

      if (!searchData.results) break;

      const places: PlaceResult[] = searchData.results.map((p: any) => ({
        name: p.name,
        address: p.formatted_address,
        placeId: p.place_id,
        rating: p.rating || 0,
        reviewCount: p.user_ratings_total || 0,
        priceLevel: p.price_level ?? null,
        priceLevelDisplay: formatPriceLevel(p.price_level),
        isOpen: p.business_status === 'OPERATIONAL',
        types: p.types || [],
        // Server-proxied photo URLs (no API key, lazy-fetched, cacheable).
        photos: p.photos?.slice(0, 2).map((photo: any) => photoProxyUrl(photo.photo_reference)),
        // Real coords from the result's geometry (optional-chained). Undefined if a result has
        // no geometry — NEVER a fabricated/default coordinate. Existing cachePlaces() persists
        // these via its lat/lng columns automatically (placesCache.ts:109-110,126-127).
        latitude: p.geometry?.location?.lat,
        longitude: p.geometry?.location?.lng,
        popularityScore: calculatePopularity(p.rating || 0, p.user_ratings_total || 0)
      }));
      
      allPlaces = [...allPlaces, ...places];
      nextPageToken = searchData.next_page_token || null;
      
      if (!nextPageToken) break;
    }
    
    console.log(`[PLACES] "${query}" in ${city}: ${allPlaces.length} results`);
    
    // Sort by popularity score (rating × log(reviews))
    return allPlaces
      .sort((a, b) => b.popularityScore - a.popularityScore)
      .slice(0, maxResults);
      
  } catch (err) {
    // Fail loud — re-throw typed errors so the route can map them to
    // structured HTTP responses (was silently returning [] before).
    if (
      err instanceof GooglePlacesQuotaError ||
      err instanceof MissingGoogleKeyError ||
      err instanceof GooglePlacesApiError
    ) {
      throw err;
    }
    // Truly unexpected (network/DNS/timeout) — wrap as a Google API error so
    // the user still sees a real message, not "0 results."
    throw new GooglePlacesApiError(
      'NETWORK_ERROR',
      err instanceof Error ? err.message : String(err)
    );
  }
}

// Get website for a place
export async function getPlaceDetails(placeId: string): Promise<{ website?: string; priceLevel?: number } | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;
  
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=website,price_level&key=${apiKey}`;

  try {
    const res = await googleFetch(url);
    const data = await res.json();
    return { 
      website: data.result?.website,
      priceLevel: data.result?.price_level
    };
  } catch {
    return null;
  }
}

// Pre-filter places - returns verified (has price) and unverified (no price) buckets
export function filterPlaces(
  places: PlaceResult[],
  criteria: FilterCriteria
): { verified: PlaceResult[]; unverified: PlaceResult[] } {
  const verified: PlaceResult[] = [];
  const unverified: PlaceResult[] = [];
  
  for (const p of places) {
    // Basic filters
    if (criteria.mustBeOpen && !p.isOpen) continue;
    if (criteria.minRating && p.rating < criteria.minRating) continue;
    if (criteria.minReviews && p.reviewCount < criteria.minReviews) continue;
    
    // Price filter with verified/unverified split
    if (p.priceLevel != null) {
      // Has price data - apply price filter
      if (criteria.maxPriceLevel && p.priceLevel > criteria.maxPriceLevel) continue;
      verified.push(p);
    } else {
      // No price data - put in unverified bucket (passes other filters)
      unverified.push(p);
    }
  }
  
  return { verified, unverified };
}

// Category search configs — multiple queries per category for diverse results
export const CATEGORY_SEARCHES: Record<string, { queries: string[]; defaultFilters: FilterCriteria }> = {
  lodging: {
    queries: ['boutique hotel hostel guesthouse'],
    defaultFilters: { mustBeOpen: true, minRating: 4.0, minReviews: 50 }
  },
  coworking: {
    queries: [
      'coworking space shared office',
      'coliving coworking digital nomad',
      'cafe wifi laptop friendly workspace',
      'library study space quiet work',
    ],
    defaultFilters: { mustBeOpen: true, minRating: 4.0, minReviews: 20 }
  },
  motoRental: {
    queries: [
      'motorbike scooter rental',
      'car rental vehicle hire',
      'electric scooter ebike rental',
    ],
    defaultFilters: { mustBeOpen: true, minRating: 3.5, minReviews: 10 }
  },
  equipmentRental: {
    queries: [
      'surfboard rental surf shop',
      'bike bicycle rental cycling',
      'diving snorkel equipment rental',
      'kayak paddleboard SUP rental',
      'sports equipment rental outdoor gear',
      'camera drone rental photography',
      'sailing boat charter rental',
    ],
    defaultFilters: { mustBeOpen: true, minRating: 3.5, minReviews: 10 }
  },
  airportTransfers: {
    queries: ['airport transfer taxi service'],
    defaultFilters: { mustBeOpen: true, minRating: 4.0, minReviews: 20 }
  },
  brunchCoffee: {
    queries: [
      'cafe brunch coffee specialty',
      'brunch breakfast restaurant morning',
      'specialty coffee roaster third wave',
      'bakery pastry patisserie',
      'juice smoothie acai bowl healthy',
    ],
    defaultFilters: { mustBeOpen: true, minRating: 4.0, minReviews: 50 }
  },
  dinner: {
    queries: [
      'restaurant dinner dining',
      'fine dining restaurant tasting menu',
      'seafood restaurant fresh fish',
      'local cuisine traditional food authentic',
      'steakhouse grill BBQ smokehouse',
      'vegetarian vegan plant based restaurant',
      'street food night market food court',
    ],
    defaultFilters: { mustBeOpen: true, minRating: 4.0, minReviews: 50 }
  },
  activities: {
    queries: [
      'museum art gallery cultural center',
      'temple historical site monument',
      'cooking class workshop experience',
      'adventure tour excursion day trip',
      'water sports diving snorkeling kayak',
      'yoga retreat meditation wellness class',
      'nature hiking waterfall rice terrace',
      'festival event concert',
      'amusement park theme park attraction',
      'photography tour art walk',
    ],
    defaultFilters: { mustBeOpen: true, minRating: 4.0, minReviews: 20 }
  },
  nightlife: {
    queries: [
      'bar cocktail lounge speakeasy',
      'nightclub dance club DJ',
      'rooftop bar sky lounge',
      'beach club sunset bar',
      'live music venue jazz blues',
      'brewery craft beer taproom',
      'wine bar wine tasting',
      'karaoke comedy club entertainment',
    ],
    defaultFilters: { mustBeOpen: true, minRating: 3.5, minReviews: 30 }
  },
  toiletries: {
    queries: ['pharmacy convenience store supermarket'],
    defaultFilters: { mustBeOpen: true, minRating: 3.0, minReviews: 10 }
  },
  wellness: {
    queries: [
      'gym fitness center crossfit',
      'yoga studio pilates reformer',
      'spa massage wellness center',
      'ice bath cold plunge recovery',
      'martial arts muay thai boxing',
      'swimming pool lap pool aquatic',
      'meditation retreat sound healing',
      'sauna steam room hot spring',
    ],
    defaultFilters: { mustBeOpen: true, minRating: 4.0, minReviews: 20 }
  }
};

// Run multiple queries for a category, merge & deduplicate results.
// Per-query isolation: one query's failure (e.g. INVALID_REQUEST on an
// awkward search term) does NOT kill the whole category. We only surface a
// typed error to the caller when EVERY query failed — otherwise we return
// the union of what succeeded and log the rest.
export async function searchPlacesMultiQuery(
  queries: string[],
  city: string,
  country: string,
  maxResults: number = 60,
  type?: string
): Promise<PlaceResult[]> {
  const settled = await Promise.allSettled(
    queries.map(q => searchPlaces(q, city, country, 60, type))
  );

  const fulfilled = settled.filter(
    (r): r is PromiseFulfilledResult<PlaceResult[]> => r.status === 'fulfilled'
  );
  const rejected = settled.filter(
    (r): r is PromiseRejectedResult => r.status === 'rejected'
  );

  for (const r of rejected) {
    console.error('[PLACES] Multi-query: one query failed —', r.reason);
  }

  // Every query in this category failed → re-throw the first error so the
  // route surfaces a real banner (still fail-loud at the category level).
  if (rejected.length > 0 && fulfilled.length === 0) {
    throw rejected[0].reason;
  }

  // Merge and deduplicate by placeId (keep first occurrence — highest quality from its query)
  const seen = new Set<string>();
  const merged: PlaceResult[] = [];
  for (const r of fulfilled) {
    for (const place of r.value) {
      if (!seen.has(place.placeId)) {
        seen.add(place.placeId);
        merged.push(place);
      }
    }
  }

  console.log(`[PLACES] Multi-query: ${queries.length} queries (${fulfilled.length} OK, ${rejected.length} failed), ${merged.length} unique places for ${city}`);

  // Sort by popularity score and take top N
  return merged
    .sort((a, b) => b.popularityScore - a.popularityScore)
    .slice(0, maxResults);
}
