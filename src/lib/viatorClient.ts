// ─── Viator Partner API Client ────────────────────────────────────────────────
// Searches Viator's inventory of bookable tours, activities, and experiences.
// Auth: exp-api-key header. Base URL: https://api.viator.com/partner
// Rate limit: 150 requests per 10-second rolling window.

import { ACTIVITY_LABELS } from './activities';
import { TRAVEL_COA } from './travelCOA';

const VIATOR_BASE = 'https://api.viator.com/partner';

function getApiKey(): string {
  const key = process.env.VIATOR_API_KEY;
  if (!key) throw new Error('VIATOR_API_KEY environment variable not set');
  return key;
}

function viatorHeaders(): Record<string, string> {
  return {
    'Accept-Language': 'en-US',
    'Content-Type': 'application/json',
    'Accept': 'application/json;version=2.0',
    'exp-api-key': getApiKey(),
  };
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ViatorProduct {
  productCode: string;
  title: string;
  description?: string;
  productUrl?: string;
  duration?: {
    fixedDurationInMinutes?: number;
    variableDurationFromMinutes?: number;
    variableDurationToMinutes?: number;
  };
  pricing?: {
    summary?: {
      fromPrice?: number;
      fromPriceBeforeDiscount?: number;
    };
    currency?: string;
  };
  reviews?: {
    totalReviews?: number;
    combinedAverageRating?: number;
  };
  images?: Array<{
    imageSource?: string;
    caption?: string;
    isCover?: boolean;
    variants?: Array<{
      url: string;
      width: number;
      height: number;
    }>;
  }>;
  tags?: Array<{
    tagId: number;
    allNamesByLocale?: Record<string, string>;
  }>;
  destinations?: Array<{
    ref: string;
    primary?: boolean;
  }>;
  flags?: string[];
  translationLevel?: string;
}

export interface ViatorDestination {
  destinationId: number;
  destinationName: string;
  destinationType: string;
  parentId?: number;
  lookupId?: string;
  timeZone?: string;
  iataCode?: string;
  latitude?: number;
  longitude?: number;
}

export interface ViatorSearchResponse {
  products: ViatorProduct[];
  totalCount: number;
}

// ─── Destination Lookup ──────────────────────────────────────────────────────
// Cache the destination list in memory (rarely changes, refreshed weekly by Viator)

let cachedDestinations: ViatorDestination[] | null = null;
let destinationCacheTime = 0;
const DEST_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

async function loadDestinations(): Promise<ViatorDestination[]> {
  if (cachedDestinations && Date.now() - destinationCacheTime < DEST_CACHE_TTL) {
    return cachedDestinations;
  }

  try {
    const res = await fetch(`${VIATOR_BASE}/v1/taxonomy/destinations`, {
      headers: viatorHeaders(),
    });
    if (!res.ok) {
      console.error(`[Viator] Failed to load destinations: ${res.status}`);
      return cachedDestinations || [];
    }
    const data = await res.json();
    cachedDestinations = data.destinations || data.data || data || [];
    destinationCacheTime = Date.now();
    console.log(`[Viator] Loaded ${(cachedDestinations || []).length} destinations`);
    return cachedDestinations || [];
  } catch (err) {
    console.error('[Viator] Destination load error:', err);
    return cachedDestinations || [];
  }
}

/** Find a Viator destination ID by city name (fuzzy match) */
export async function findDestinationId(cityName: string, countryName?: string): Promise<number | null> {
  const destinations = await loadDestinations();
  const cityLower = cityName.toLowerCase();
  const countryLower = countryName?.toLowerCase() || '';

  // Exact match first
  let match = destinations.find(d =>
    d.destinationName.toLowerCase() === cityLower &&
    d.destinationType === 'CITY'
  );

  // Partial match
  if (!match) {
    match = destinations.find(d =>
      d.destinationName.toLowerCase().includes(cityLower) &&
      d.destinationType === 'CITY'
    );
  }

  // Broader match including regions
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

// ─── COA Category → Viator Search Term Mapping ──────────────────────────────

const COA_TO_VIATOR_SEARCH: Record<string, string[]> = {
  sports_fitness: ['outdoor activities', 'water sports', 'hiking', 'surfing', 'diving', 'yoga'],
  arts_culture: ['museums', 'cultural tours', 'cooking classes', 'art galleries', 'temples', 'historical tours', 'food tours'],
  nightlife: ['nightlife', 'pub crawls', 'dinner shows', 'evening tours', 'bar tours'],
  festivals: ['festivals', 'events', 'concerts', 'cultural events'],
  wellness: ['spa', 'wellness', 'yoga retreat', 'massage'],
  bucket_list: ['adventure', 'unique experiences', 'safari', 'hot air balloon', 'volcano tours'],
  ground_transport: ['airport transfers', 'private transfers', 'car rental', 'transportation'],
};

/** Build search terms for a COA category + user interests */
function buildSearchTerms(coaCategory: string, userInterests: string[]): string[] {
  const terms: string[] = [];

  // Add base search terms for this COA category
  const baseTerms = COA_TO_VIATOR_SEARCH[coaCategory];
  if (baseTerms) terms.push(...baseTerms);

  // Add user's specific interest labels
  const coaCat = TRAVEL_COA[coaCategory];
  if (coaCat?.interestSlugs) {
    const activeInCategory = userInterests.filter(s => coaCat.interestSlugs!.includes(s));
    for (const slug of activeInCategory) {
      const label = ACTIVITY_LABELS[slug];
      if (label) terms.push(label);
    }
  }

  // Fallback: use the category label itself
  if (terms.length === 0) {
    const label = TRAVEL_COA[coaCategory]?.label;
    if (label) terms.push(label);
  }

  return [...new Set(terms)];
}

// ─── Product Search ──────────────────────────────────────────────────────────

/** Search Viator products by destination + free-text terms */
export async function searchViatorProducts(
  city: string,
  country: string,
  coaCategory: string,
  userInterests: string[],
  maxResults: number = 33,
): Promise<ViatorProduct[]> {
  const searchTerms = buildSearchTerms(coaCategory, userInterests);
  if (searchTerms.length === 0) return [];

  // Find destination ID
  const destId = await findDestinationId(city, country);

  const allProducts: ViatorProduct[] = [];
  const seenCodes = new Set<string>();

  // Search using free-text endpoint for each term (more flexible than products/search with destId)
  for (const term of searchTerms.slice(0, 5)) {
    try {
      const body: Record<string, any> = {
        searchTerm: `${term} ${city}`,
        searchTypes: [
          {
            searchType: 'PRODUCTS',
            pagination: { start: 1, count: Math.min(maxResults, 50) },
          },
        ],
        currency: 'USD',
      };

      // Add destination filter if we have a destId
      if (destId) {
        body.productFiltering = {
          destination: { type: 'DESTINATION', destId },
        };
      }

      body.productSorting = { sort: 'TRAVELER_RATING', order: 'DESCENDING' };

      const res = await fetch(`${VIATOR_BASE}/search/freetext`, {
        method: 'POST',
        headers: viatorHeaders(),
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`[Viator] Search failed for "${term}": ${res.status} ${errText}`);
        continue;
      }

      const data = await res.json();
      const products: ViatorProduct[] = data.products || [];

      for (const p of products) {
        if (!seenCodes.has(p.productCode)) {
          seenCodes.add(p.productCode);
          allProducts.push(p);
        }
      }
    } catch (err) {
      console.error(`[Viator] Search error for "${term}":`, err);
    }
  }

  console.log(`[Viator] ${coaCategory}: ${allProducts.length} products found for ${city}`);

  // Sort by rating × reviewCount and return top N
  return allProducts
    .sort((a, b) => {
      const scoreA = (a.reviews?.combinedAverageRating || 0) * Math.log10(Math.max(a.reviews?.totalReviews || 1, 1));
      const scoreB = (b.reviews?.combinedAverageRating || 0) * Math.log10(Math.max(b.reviews?.totalReviews || 1, 1));
      return scoreB - scoreA;
    })
    .slice(0, maxResults);
}

// ─── Product → GrokRecommendation Mapping ────────────────────────────────────
// Normalizes Viator products to the same interface the scanner UI expects.

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
  // Viator-specific fields
  viatorProductCode: string;
  bookingUrl: string | null;
  durationMinutes: number | null;
  price: number | null;
} {
  const rating = product.reviews?.combinedAverageRating || 0;
  const reviewCount = product.reviews?.totalReviews || 0;
  const fromPrice = product.pricing?.summary?.fromPrice || null;

  // Get the best photo (prefer wider images)
  const coverImage = product.images?.find(i => i.isCover) || product.images?.[0];
  const photoVariant = coverImage?.variants
    ?.filter(v => v.width >= 400)
    ?.sort((a, b) => a.width - b.width)[0]
    || coverImage?.variants?.[0];

  // Map price to price level (1-4 scale)
  let priceLevel: number | null = null;
  if (fromPrice != null) {
    if (fromPrice < 25) priceLevel = 1;
    else if (fromPrice < 75) priceLevel = 2;
    else if (fromPrice < 200) priceLevel = 3;
    else priceLevel = 4;
  }

  // Compute sentiment from rating
  const sentiment = rating >= 4.5 ? 'positive' as const : rating >= 3.5 ? 'neutral' as const : 'negative' as const;
  const sentimentScore = Math.round(rating * 2); // 0-10 scale

  // Compute fitScore (Viator results are already category-matched so generally high)
  const fitScore = Math.min(10, Math.round(rating * 2));

  // Compute composite score
  const mandateFit = Math.min(100, fitScore * 10);
  const rawQuality = rating * Math.log10(Math.max(reviewCount, 1));
  const quality = Math.min(100, (rawQuality / 15) * 100);
  const compositeScore = Math.round(mandateFit * 0.4 + quality * 0.35 + 75 * 0.25); // budget fit defaults to 75

  const durationMins = product.duration?.fixedDurationInMinutes || null;
  const durationText = durationMins
    ? durationMins >= 60
      ? `${Math.floor(durationMins / 60)}h${durationMins % 60 ? ` ${durationMins % 60}m` : ''}`
      : `${durationMins}m`
    : '';

  const priceText = fromPrice != null ? `From $${fromPrice}` : '';
  const summaryParts = [product.description?.substring(0, 150) || '', durationText ? `Duration: ${durationText}` : '', priceText].filter(Boolean);

  return {
    name: product.title,
    address: '',
    website: product.productUrl || null,
    photoUrl: photoVariant?.url || null,
    priceLevel,
    priceLevelDisplay: fromPrice != null ? `$${fromPrice}` : null,
    googleRating: rating,
    reviewCount,
    sentimentScore,
    sentiment,
    summary: summaryParts.join('. '),
    warnings: [],
    trending: false,
    fitScore,
    valueRank: 1,
    category,
    compositeScore,
    viatorProductCode: product.productCode,
    bookingUrl: product.productUrl || null,
    durationMinutes: durationMins,
    price: fromPrice,
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
