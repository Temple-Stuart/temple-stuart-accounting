// ─── Viator Partner API Client ────────────────────────────────────────────────
// Searches Viator's inventory of bookable tours, activities, and experiences.
// Supports both V2 (exp-api-key) and V1 (apiKey) API patterns.
// Rate limit: 150 requests per 10-second rolling window.

import { ACTIVITY_LABELS } from './activities';
import { TRAVEL_COA } from './travelCOA';

const VIATOR_V2_BASE = 'https://api.viator.com/partner';
const VIATOR_V1_BASE = 'https://viatorapi.viator.com/service';

function getApiKey(): string {
  const key = process.env.VIATOR_API_KEY;
  if (!key) throw new Error('VIATOR_API_KEY environment variable not set');
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
const DEST_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

async function loadDestinations(): Promise<ViatorDestination[]> {
  if (cachedDestinations && Date.now() - destinationCacheTime < DEST_CACHE_TTL) {
    return cachedDestinations;
  }

  // Try V2 endpoint first
  try {
    const res = await fetch(`${VIATOR_V2_BASE}/v1/taxonomy/destinations`, {
      headers: v2Headers(),
    });
    if (res.ok) {
      const data = await res.json();
      cachedDestinations = data.destinations || data.data || [];
      destinationCacheTime = Date.now();
      console.log(`[Viator] Loaded ${cachedDestinations!.length} destinations (V2)`);
      return cachedDestinations!;
    }
  } catch (err) {
    console.error('[Viator] V2 destination load failed:', err);
  }

  // Fallback to V1
  try {
    const res = await fetch(`${VIATOR_V1_BASE}/taxonomy/destinations`, {
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      cachedDestinations = data.data || [];
      destinationCacheTime = Date.now();
      console.log(`[Viator] Loaded ${cachedDestinations!.length} destinations (V1)`);
      return cachedDestinations!;
    }
  } catch (err) {
    console.error('[Viator] V1 destination load failed:', err);
  }

  return cachedDestinations || [];
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

// ─── V1 Response Normalizer ──────────────────────────────────────────────────

function parseDurationMinutes(duration: string): number | null {
  if (!duration) return null;
  // "3 hours" → 180, "Full day (6 hours)" → 360, "1 hour 30 minutes" → 90
  const hourMatch = duration.match(/(\d+)\s*hour/i);
  const minMatch = duration.match(/(\d+)\s*min/i);
  let mins = 0;
  if (hourMatch) mins += parseInt(hourMatch[1]) * 60;
  if (minMatch) mins += parseInt(minMatch[1]);
  if (mins > 0) return mins;
  if (/full\s*day/i.test(duration)) return 480;
  if (/half\s*day/i.test(duration)) return 240;
  return null;
}

function normalizeV1Product(p: any): ViatorProduct {
  return {
    productCode: p.code || p.productCode || '',
    title: p.title || p.shortTitle || '',
    description: (p.shortDescription || '').replace(/<[^>]*>/g, ''),
    productUrl: p.webURL || '',
    price: p.price || null,
    priceFormatted: p.priceFormatted || (p.price ? `$${p.price}` : ''),
    onSale: p.onSale || false,
    originalPrice: p.rrp || null,
    rating: p.rating || 0,
    reviewCount: p.reviewCount || 0,
    thumbnailUrl: p.thumbnailHiResURL || p.thumbnailURL || '',
    duration: p.duration || '',
    durationMinutes: parseDurationMinutes(p.duration || ''),
    destinationName: p.primaryDestinationName || '',
    categoryIds: p.catIds || [],
  };
}

// ─── V2 Response Normalizer ──────────────────────────────────────────────────

function normalizeV2Product(p: any): ViatorProduct {
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

const COA_TO_VIATOR_SEARCH: Record<string, string[]> = {
  sports_fitness: ['outdoor activities', 'water sports', 'hiking', 'surfing', 'diving', 'yoga'],
  arts_culture: ['museums', 'cultural tours', 'cooking classes', 'art galleries', 'temples', 'historical tours', 'food tours'],
  nightlife: ['nightlife', 'pub crawls', 'dinner shows', 'evening tours', 'bar tours'],
  festivals: ['festivals', 'events', 'concerts', 'cultural events'],
  wellness: ['spa', 'wellness', 'yoga retreat', 'massage'],
  bucket_list: ['adventure', 'unique experiences', 'safari', 'hot air balloon', 'volcano tours'],
  ground_transport: ['airport transfers', 'private transfers', 'car rental', 'transportation'],
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

// ─── Product Search ──────────────────────────────────────────────────────────

/** V2 /products/search — best for destination-based filtering with tags */
async function searchV2Products(destId: number, maxCount: number, tagIds?: number[]): Promise<ViatorProduct[]> {
  const body: Record<string, any> = {
    filtering: {
      destination: String(destId),
    },
    sorting: { sort: 'DEFAULT' },
    pagination: { start: 1, count: Math.min(maxCount, 50) },
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
    const text = await res.text();
    console.error(`[Viator V2] /products/search failed: ${res.status} ${text.substring(0, 200)}`);
    return [];
  }

  const data = await res.json();
  return (data.products || []).map(normalizeV2Product);
}

/** V2 /search/freetext — best for keyword-based searching */
async function searchV2Freetext(searchTerm: string, destId: number | null, maxCount: number): Promise<ViatorProduct[]> {
  const body: Record<string, any> = {
    searchTerm,
    searchTypes: [{ searchType: 'PRODUCTS', pagination: { start: 1, count: Math.min(maxCount, 50) } }],
    currency: 'USD',
    productSorting: { sort: 'TRAVELER_RATING', order: 'DESCENDING' },
  };
  if (destId) {
    body.productFiltering = { destination: { type: 'DESTINATION', destId } };
  }

  const res = await fetch(`${VIATOR_V2_BASE}/search/freetext`, {
    method: 'POST',
    headers: v2Headers(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[Viator V2] Search failed: ${res.status} ${text.substring(0, 200)}`);
    return [];
  }

  const data = await res.json();
  const products = data.products || [];
  return products.map(normalizeV2Product);
}

async function searchV1Products(destId: number, searchTerm: string, maxCount: number): Promise<ViatorProduct[]> {
  const body = {
    destId,
    topX: `1-${Math.min(maxCount, 100)}`,
    sortOrder: 'REVIEW_AVG_RATING_D',
    currencyCode: 'USD',
  };

  const res = await fetch(`${VIATOR_V1_BASE}/search/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'exp-api-key': getApiKey(),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[Viator V1] Search failed: ${res.status} ${text.substring(0, 200)}`);
    return [];
  }

  const data = await res.json();
  if (!data.success && data.data?.length === 0) return [];
  const products = data.data || [];
  return products.map(normalizeV1Product);
}

/** Search Viator products by destination + category terms */
export async function searchViatorProducts(
  city: string,
  country: string,
  coaCategory: string,
  userInterests: string[],
  maxResults: number = 33,
): Promise<ViatorProduct[]> {
  const searchTerms = buildSearchTerms(coaCategory, userInterests);
  if (searchTerms.length === 0) return [];

  const destId = await findDestinationId(city, country);

  const allProducts: ViatorProduct[] = [];
  const seenCodes = new Set<string>();

  const addProducts = (products: ViatorProduct[]) => {
    for (const p of products) {
      if (p.productCode && !seenCodes.has(p.productCode)) {
        seenCodes.add(p.productCode);
        allProducts.push(p);
      }
    }
  };

  // 1. Try V2 /products/search if we have a destId (fastest, best filtering)
  if (destId) {
    try {
      const products = await searchV2Products(destId, Math.min(maxResults, 50));
      addProducts(products);
      console.log(`[Viator] V2 /products/search: ${products.length} results for destId ${destId}`);
    } catch (err) {
      console.error('[Viator] V2 /products/search error:', err);
    }
  }

  // 2. Supplement with V2 freetext for each search term (more targeted)
  if (allProducts.length < maxResults) {
    for (const term of searchTerms.slice(0, 3)) {
      if (allProducts.length >= maxResults) break;
      try {
        const searchQuery = destId ? term : `${term} ${city}`;
        const products = await searchV2Freetext(searchQuery, destId, Math.min(maxResults, 50));
        addProducts(products);
      } catch (err) {
        console.error(`[Viator] V2 freetext error for "${term}":`, err);
      }
    }
  }

  // 3. V1 fallback if still few results
  if (allProducts.length < 10 && destId) {
    try {
      const v1Products = await searchV1Products(destId, searchTerms[0], 50);
      addProducts(v1Products);
    } catch (err) {
      console.error('[Viator] V1 fallback error:', err);
    }
  }

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

  return {
    name: product.title,
    address: product.destinationName || '',
    website: product.productUrl || null,
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
    bookingUrl: product.productUrl || null,
    durationMinutes,
    price,
  };
}

// ─── Categories that use Viator vs Google Places ─────────────────────────────

export const VIATOR_CATEGORIES = new Set([
  'sports_fitness',
  'arts_culture',
  'nightlife',
  'festivals',
  'wellness',
  'bucket_list',
  'ground_transport',
]);

export function isViatorCategory(category: string): boolean {
  return VIATOR_CATEGORIES.has(category);
}
