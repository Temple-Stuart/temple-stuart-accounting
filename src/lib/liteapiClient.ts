// ─── LiteAPI Hotel Client ────────────────────────────────────────────────────
// Hotel inventory provider. Replaces Google Places for the `accommodation`
// category — hotels are now BOOKABLE inventory (LiteAPI is merchant-of-record;
// we set margin, weekly payout, see audit-reports/travel-liteapi-pr-3.md).
//
// SCOPE: this file handles SEARCH only (populates trip_scanner_results from
// `/v3.0/hotels/rates`). The full booking flow (prebook → book → payment via
// LiteAPI's SDK + commission tracking) is a separate later PR.
//
// PATTERN: mirrors src/lib/viatorClient.ts — typed errors per PR-1, mapper into
// the same recommendation shape consumed by the UI + commit→budget spine.
//
// MODE: sandbox by default; flip LITEAPI_MODE=production once the production
// key is set (mirrors src/lib/duffel.ts's mode-by-env pattern).

import { MissingLiteApiKeyError, LiteApiError } from './travelErrors';

const LITEAPI_BASE = 'https://api.liteapi.travel/v3.0';

type LiteApiMode = 'sandbox' | 'production';

function getMode(): LiteApiMode {
  return process.env.LITEAPI_MODE === 'production' ? 'production' : 'sandbox';
}

function getApiKey(): string {
  const mode = getMode();
  const key = mode === 'production'
    ? process.env.LITEAPI_PRODUCTION_KEY
    : process.env.LITEAPI_SANDBOX_KEY;
  if (!key) throw new MissingLiteApiKeyError(mode);
  return key;
}

function headers(): Record<string, string> {
  return {
    'X-API-Key': getApiKey(),
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
}

// ─── Country name → ISO 3166-1 alpha-2 ───────────────────────────────────────
// LiteAPI requires `countryCode` as a 2-letter ISO code, but the trip stores
// human country names. This map covers the destinations currently present in
// `src/lib/destinations.ts` plus common travel countries. Unknown country
// names throw — never silently default (we don't want to search the wrong
// country when the user typed something unsupported).

const COUNTRY_NAME_TO_ISO2: Record<string, string> = {
  // Asia-Pacific
  'thailand': 'TH', 'indonesia': 'ID', 'japan': 'JP', 'singapore': 'SG',
  'malaysia': 'MY', 'vietnam': 'VN', 'philippines': 'PH', 'south korea': 'KR',
  'taiwan': 'TW', 'hong kong': 'HK', 'china': 'CN', 'india': 'IN',
  'sri lanka': 'LK', 'nepal': 'NP', 'cambodia': 'KH', 'laos': 'LA',
  'australia': 'AU', 'new zealand': 'NZ', 'fiji': 'FJ',
  // Americas
  'united states': 'US', 'usa': 'US', 'canada': 'CA', 'mexico': 'MX',
  'brazil': 'BR', 'argentina': 'AR', 'chile': 'CL', 'peru': 'PE',
  'colombia': 'CO', 'costa rica': 'CR', 'panama': 'PA', 'ecuador': 'EC',
  'cuba': 'CU', 'jamaica': 'JM', 'dominican republic': 'DO',
  'puerto rico': 'PR',
  // Europe
  'france': 'FR', 'spain': 'ES', 'italy': 'IT', 'germany': 'DE',
  'united kingdom': 'GB', 'uk': 'GB', 'great britain': 'GB',
  'netherlands': 'NL', 'belgium': 'BE', 'switzerland': 'CH', 'austria': 'AT',
  'portugal': 'PT', 'greece': 'GR', 'ireland': 'IE',
  'czech republic': 'CZ', 'czechia': 'CZ', 'poland': 'PL', 'hungary': 'HU',
  'sweden': 'SE', 'norway': 'NO', 'denmark': 'DK', 'finland': 'FI',
  'iceland': 'IS', 'croatia': 'HR', 'slovenia': 'SI', 'slovakia': 'SK',
  'romania': 'RO', 'bulgaria': 'BG', 'serbia': 'RS', 'turkey': 'TR',
  // Middle East / Africa
  'united arab emirates': 'AE', 'uae': 'AE', 'saudi arabia': 'SA',
  'israel': 'IL', 'jordan': 'JO', 'egypt': 'EG', 'morocco': 'MA',
  'south africa': 'ZA', 'kenya': 'KE', 'tanzania': 'TZ', 'mauritius': 'MU',
  'seychelles': 'SC', 'maldives': 'MV',
};

export function countryNameToIso2(name: string): string {
  const key = name.trim().toLowerCase();
  const code = COUNTRY_NAME_TO_ISO2[key];
  if (!code) {
    // Fail loud — never default to a random country.
    throw new LiteApiError(
      'countryNameToIso2',
      400,
      `Unsupported country "${name}" — add an entry to COUNTRY_NAME_TO_ISO2 in src/lib/liteapiClient.ts`
    );
  }
  return code;
}

// ─── Search ──────────────────────────────────────────────────────────────────

export interface LiteApiOccupancy {
  adults: number;
  children?: number[]; // ages
}

export interface SearchHotelsParams {
  city: string;
  country: string;
  /** ISO date YYYY-MM-DD */
  checkin: string;
  /** ISO date YYYY-MM-DD */
  checkout: string;
  occupancies: LiteApiOccupancy[];
  /** ISO 4217 currency code; defaults to USD. */
  currency?: string;
  /** Guest's nationality (ISO-2). Defaults to US for sandbox. */
  guestNationality?: string;
  /** Cap on results returned by this client. */
  maxResults?: number;
}

/** Raw hotel + rate as LiteAPI returns it. Keep loose — LiteAPI's V3 response
 *  groups rooms and rate plans; we read the minimum we need to map. */
interface LiteApiHotelRate {
  hotelId: string;
  hotel?: {
    name?: string;
    address?: string;
    city?: string;
    country?: string;
    stars?: number;
    rating?: number;
    reviewCount?: number;
    main_photo?: string;
    thumbnail?: string;
    hotelDescription?: string;
    starRating?: number;
    latitude?: number;
    longitude?: number;
  };
  roomTypes?: Array<{
    rates?: Array<{
      retailRate?: { total?: Array<{ amount: number; currency: string }>; suggestedSellingPrice?: Array<{ amount: number; currency: string }> };
      offerRetailRate?: { amount: number; currency: string };
      name?: string;
      cancellationPolicies?: { refundableTag?: string };
      boardName?: string;
    }>;
  }>;
}

/** Hit `/v3.0/hotels/rates` and return the normalised hotel list.
 *  Throws `MissingLiteApiKeyError` if no key set, `LiteApiError` on non-2xx. */
export async function searchHotelRates(params: SearchHotelsParams): Promise<LiteApiHotelRate[]> {
  const countryCode = countryNameToIso2(params.country);
  const body = {
    cityName: params.city,
    countryCode,
    checkin: params.checkin,
    checkout: params.checkout,
    occupancies: params.occupancies,
    currency: params.currency || 'USD',
    guestNationality: params.guestNationality || 'US',
  };

  const url = `${LITEAPI_BASE}/hotels/rates`;
  const res = await fetch(url, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new LiteApiError('/v3.0/hotels/rates', res.status, await res.text());
  }

  const data = await res.json();
  const hotels: LiteApiHotelRate[] = data.data || data.hotels || [];
  const max = params.maxResults || 33;
  return hotels.slice(0, max);
}

// ─── Mapping into the canonical recommendation shape ─────────────────────────
// Mirrors src/lib/viatorClient.ts:426-512 (viatorProductToRecommendation).
// Same keys → so the UI + commit→budget spine consume LiteAPI hotels exactly
// like Viator products / Google places. The `bookingUrl` field signals
// bookable inventory to the UI's "Bookable Experiences" filter.

interface HotelRecommendation {
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
  // Bookable signal — generalise to providerProductId in a later refactor.
  liteapiHotelId: string;
  bookingUrl: string | null;
  price: number | null;          // nightly rate in USD
  durationMinutes: null;
}

/** Extract the lowest nightly rate the hotel returned, in the requested
 *  currency. LiteAPI V3 nests rates under roomTypes[].rates[].retailRate.
 *  Returns null if the hotel didn't quote a rate (some sandbox properties
 *  return metadata-only — surface as "see pricing" rather than dropping). */
function extractNightlyRate(hotel: LiteApiHotelRate): number | null {
  for (const room of hotel.roomTypes || []) {
    for (const rate of room.rates || []) {
      const total = rate.retailRate?.total?.[0]?.amount;
      if (typeof total === 'number' && total > 0) return total;
      const suggested = rate.retailRate?.suggestedSellingPrice?.[0]?.amount;
      if (typeof suggested === 'number' && suggested > 0) return suggested;
      const offer = rate.offerRetailRate?.amount;
      if (typeof offer === 'number' && offer > 0) return offer;
    }
  }
  return null;
}

/** Map nightly USD rate to a Google-style 1-4 price level. Tuned for the
 *  global hotel market: $-$80, $$-$200, $$$-$400, $$$$-above. */
function nightlyToPriceLevel(usd: number | null): { level: number | null; display: string | null } {
  if (usd == null) return { level: null, display: null };
  if (usd < 80) return { level: 1, display: '$' };
  if (usd < 200) return { level: 2, display: '$$' };
  if (usd < 400) return { level: 3, display: '$$$' };
  return { level: 4, display: '$$$$' };
}

/** LiteAPI hotel + rate → the same recommendation object the UI consumes for
 *  Viator products and Google places. Same shape contract, different source. */
export function liteApiHotelToRecommendation(
  hotel: LiteApiHotelRate,
  idx: number,
  category: string,
): HotelRecommendation {
  const h = hotel.hotel || {};
  const nightlyUsd = extractNightlyRate(hotel);
  const { level: priceLevel, display: priceLevelDisplay } = nightlyToPriceLevel(nightlyUsd);

  // Prefer guest rating (0-10 scale, normalise to 0-5) over star rating;
  // either is usable — fall back through the options.
  const rawRating = h.rating ?? h.starRating ?? h.stars ?? 0;
  const googleRating = rawRating > 5 ? Math.round((rawRating / 2) * 10) / 10 : rawRating;
  const reviewCount = h.reviewCount ?? 0;

  const sentiment = googleRating >= 4.5 ? 'positive' as const
    : googleRating >= 3.5 ? 'neutral' as const
    : 'negative' as const;
  const sentimentScore = Math.round(googleRating * 2);
  const fitScore = Math.min(10, Math.round(googleRating * 2));

  // Composite score: rating × log(reviews) blended with rating-based score —
  // identical formula to Viator's so ranking is consistent across sources.
  const mandateFit = Math.min(100, fitScore * 10);
  const rawQuality = googleRating * Math.log10(Math.max(reviewCount, 1));
  const quality = Math.min(100, (rawQuality / 15) * 100);
  const compositeScore = Math.round(mandateFit * 0.4 + quality * 0.35 + 75 * 0.25);

  return {
    name: h.name || 'Hotel',
    address: h.address || h.city || '',
    website: null, // we only expose the booking URL — direct site comes from the booking flow
    photoUrl: h.main_photo || h.thumbnail || null,
    priceLevel,
    priceLevelDisplay,
    googleRating,
    reviewCount,
    sentimentScore,
    sentiment,
    summary: (h.hotelDescription || '').replace(/<[^>]*>/g, '').substring(0, 300),
    warnings: [],
    trending: false,
    fitScore,
    valueRank: idx + 1,
    category,
    compositeScore,
    liteapiHotelId: hotel.hotelId,
    // Booking URL stays null for SCAN-only PR-3; the booking flow PR adds
    // prebook → book → checkout deeplink. The presence of `liteapiHotelId`
    // alone is enough for the UI to surface a "Book" CTA in the next PR.
    bookingUrl: null,
    price: nightlyUsd,
    durationMinutes: null,
  };
}
