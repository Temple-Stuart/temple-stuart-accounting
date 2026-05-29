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

// LiteAPI uses two hosts:
//   - api.liteapi.travel  → search + prebook
//   - book.liteapi.travel → final book call (per their docs, /rates/book takes
//     5-10s and lives on a separate book host).
const LITEAPI_BASE      = 'https://api.liteapi.travel/v3.0';
const LITEAPI_BOOK_BASE = 'https://book.liteapi.travel/v3.0';

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

/** Our destinations.ts uses "Region (City)" labels (e.g. "Bali (Canggu)") for
 *  user-facing clarity. LiteAPI's catalog keys on the actual city ("Canggu").
 *  Prefer the parenthesised value when present; otherwise pass through. */
export function extractCityName(name: string): string {
  const m = name.match(/\(([^)]+)\)/);
  return (m ? m[1] : name).trim();
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
  /** PR-9 Fix 5: when provided, coordinate-radius search is preferred over
   *  cityName matching. LiteAPI accepts (latitude, longitude, radius) on
   *  `/hotels/rates` and the result is more tolerant of city-name spelling
   *  variants ("Bali (Canggu)" vs "Canggu") + neighborhood ambiguity. */
  latitude?: number;
  longitude?: number;
  /** Search radius in meters. Defaults to 25_000 (25km) — covers a metro
   *  area plus its nearby beach towns / suburbs. */
  radiusMeters?: number;
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
    /** Canonical image gallery from /data/hotel; used as fallback when
     *  `main_photo`/`thumbnail` aren't populated. Each entry has `url`
     *  plus caption/order/defaultImage. */
    hotelImages?: Array<{ url: string; caption?: string; order?: number; defaultImage?: boolean }>;
    hotelDescription?: string;
    starRating?: number;
    latitude?: number;
    longitude?: number;
  };
  roomTypes?: Array<{
    offerId?: string;          // present on roomType in some response shapes
    rates?: Array<{
      offerId?: string;        // per-rate offerId — what `/rates/prebook` needs
      rateId?: string;
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
  // PR-9 Fix 5: prefer coordinate-radius search when lat/lng are on file.
  // LiteAPI's `cityName` filter is brittle for parenthesised labels (e.g.
  // "Bali (Canggu)") and city/neighborhood ambiguity. When the catalog has
  // coords we send (latitude, longitude, radius); otherwise fall back to
  // cityName so long-tail user-typed destinations still work.
  const useCoords = typeof params.latitude === 'number' && typeof params.longitude === 'number';
  const radius = params.radiusMeters ?? 25_000;
  const body: Record<string, unknown> = useCoords
    ? {
        latitude: params.latitude,
        longitude: params.longitude,
        radius,
        countryCode,
        checkin: params.checkin,
        checkout: params.checkout,
        occupancies: params.occupancies,
        currency: params.currency || 'USD',
        guestNationality: params.guestNationality || 'US',
        includeHotelData: true,
      }
    : {
        cityName: extractCityName(params.city),
        countryCode,
        checkin: params.checkin,
        checkout: params.checkout,
        occupancies: params.occupancies,
        currency: params.currency || 'USD',
        guestNationality: params.guestNationality || 'US',
        // Per LiteAPI's docs (Rate-and-Hotel-Query guide), hotel metadata
        // (name, photo, address, rating, tags) is included when this flag is
        // true. Auto-enabled for cityName filter, but we pass it explicitly
        // so behaviour never silently changes if LiteAPI flips the default.
        includeHotelData: true,
      };
  console.log(`[LiteAPI rates] mode=${useCoords ? `coords lat=${params.latitude} lng=${params.longitude} radius=${radius}m` : `cityName=${extractCityName(params.city)}`} country=${countryCode}`);

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

  // ─── PR-7 diagnostic log ────────────────────────────────────────────────
  // One-time observability: reveals the actual top-level + hotels[] field
  // shape on the next deploy so we can confirm/deny the hotelId-vs-id
  // hypothesis without further guessing. Pure observation, no behaviour
  // change. Remove in a follow-up PR once the shape is confirmed.
  console.log('[LiteAPI rates] response shape:', {
    topKeys: Object.keys(data || {}),
    dataLen: Array.isArray(data?.data) ? data.data.length : null,
    hotelsLen: Array.isArray(data?.hotels) ? data.hotels.length : null,
    hotelsKeys: Array.isArray(data?.hotels) && data.hotels[0] ? Object.keys(data.hotels[0]) : null,
    firstRateKeys: Array.isArray(data?.data) && data.data[0] ? Object.keys(data.data[0]) : null,
  });

  // LiteAPI returns rate items in `data.data[]` (each carries `hotelId` +
  // `roomTypes[]` only) and hotel metadata in a PARALLEL `data.hotels[]`
  // array. PR-6 assumed metadata items were keyed by `id`; in practice they
  // may be keyed by `hotelId` (consistent with the rate side). Accept either
  // so the merge works whichever LiteAPI uses.
  const rateItems: LiteApiHotelRate[] = data.data || [];
  const hotelMetaById: Record<string, NonNullable<LiteApiHotelRate['hotel']>> = {};
  for (const h of (data.hotels || []) as Array<{ id?: string; hotelId?: string } & NonNullable<LiteApiHotelRate['hotel']>>) {
    const id = h?.hotelId ?? h?.id;
    if (id && typeof id === 'string') hotelMetaById[id] = h;
  }
  const merged: LiteApiHotelRate[] = rateItems.map(r => {
    const meta = hotelMetaById[r.hotelId];
    if (!meta) return r;
    // Merge: keep any sub-fields already present on `r.hotel`, but fill in
    // the metadata we just looked up.
    return { ...r, hotel: { ...meta, ...(r.hotel || {}) } };
  });

  const max = params.maxResults || 33;
  return merged.slice(0, max);
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
  /** Rate-level offer ID for `/rates/prebook`. Null when no bookable rate
   *  was returned for this hotel (sandbox metadata-only properties). */
  liteapiOfferId: string | null;
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

/** Pick the first non-empty offerId we can find on this hotel — what `/rates/
 *  prebook` requires. Returns null when LiteAPI didn't quote a bookable rate
 *  (some sandbox properties are metadata-only). */
function extractOfferId(hotel: LiteApiHotelRate): string | null {
  for (const room of hotel.roomTypes || []) {
    if (room.offerId) return room.offerId;
    for (const rate of room.rates || []) {
      if (rate.offerId) return rate.offerId;
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
    // Fallback chain: `main_photo` is the documented hero photo field;
    // `thumbnail` is a smaller variant some sandbox properties return; the
    // `hotelImages[0].url` path is LiteAPI's canonical image-gallery field
    // (per /data/hotel docs) — used when the hero fields aren't populated
    // but the gallery is.
    photoUrl: h.main_photo || h.thumbnail || h.hotelImages?.[0]?.url || null,
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
    // Offer ID is what `/rates/prebook` needs (rate-level, not hotel-level).
    // Hotels without a bookable rate quote → null; UI hides the Reserve button.
    liteapiOfferId: extractOfferId(hotel),
    // Booking URL stays null — bookings happen via prebook → SDK → book.
    bookingUrl: null,
    price: nightlyUsd,
    durationMinutes: null,
  };
}

// ─── Prebook (checkout session creation) ─────────────────────────────────────
// `POST /v3.0/rates/prebook` — Locks an offer for booking, returns final price,
// cancellation policy, and the SDK payment context (`transactionId`+
// `secretKey`) the browser uses to collect payment via LiteAPI's hosted SDK.
// `usePaymentSdk: true` keeps card data OFF our servers — PCI scope minimised
// (we never see PAN/CVV; LiteAPI handles tokenisation in the browser).

export interface PrebookParams {
  /** The `offerId` field returned on a hotel rate during search. */
  offerId: string;
  /** When true, LiteAPI returns SDK payment context for hosted card capture.
   *  Defaults to true — keeps PCI scope out of our stack. */
  usePaymentSdk?: boolean;
}

export interface PrebookResult {
  prebookId: string;
  hotelId: string;
  offerId: string;
  /** Final guest-paid price (in `currency`). */
  price: number;
  currency: string;
  /** Our margin (set by the LiteAPI markup config). */
  commission: number;
  /** SDK payment context — the browser uses these to render LiteAPI's hosted
   *  payment form. `transactionId` is what we send back to `/rates/book`. */
  transactionId: string;
  secretKey: string;
  paymentTypes?: string[];
  /** Cancellation policy snapshot (refundable tag + windows). Persisted onto
   *  the reservation so we can show it to the user after booking. */
  cancellationPolicies?: unknown;
}

/** Hit `/v3.0/rates/prebook`. Throws MissingLiteApiKeyError on no key,
 *  LiteApiError on non-2xx. */
export async function prebookRate(params: PrebookParams): Promise<PrebookResult> {
  const body = {
    offerId: params.offerId,
    usePaymentSdk: params.usePaymentSdk ?? true,
  };
  const res = await fetch(`${LITEAPI_BASE}/rates/prebook`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new LiteApiError('/v3.0/rates/prebook', res.status, await res.text());
  }
  const json = await res.json();
  // LiteAPI returns either { data: {...} } or the prebook flat at the root
  // depending on plan/version — accept both.
  const d = json.data ?? json;
  return {
    prebookId: d.prebookId,
    hotelId: d.hotelId,
    offerId: d.offerId ?? params.offerId,
    price: d.price ?? 0,
    currency: d.currency ?? 'USD',
    commission: d.commission ?? 0,
    transactionId: d.transactionId,
    secretKey: d.secretKey,
    paymentTypes: d.paymentTypes,
    cancellationPolicies: d.roomTypes?.[0]?.rates?.[0]?.cancellationPolicies ?? d.cancellationPolicies ?? null,
  };
}

// ─── Book (complete reservation) ─────────────────────────────────────────────
// `POST /v3.0/rates/book` — finalises the booking after the user paid via the
// LiteAPI SDK. We pass `payment.method = "TRANSACTION_ID"` + the
// `transactionId` returned from prebook; LiteAPI charges the card, books the
// hotel, returns a confirmation code.

export interface BookGuest {
  occupancyNumber: number;
  firstName: string;
  lastName: string;
  email: string;
}

export interface BookHolder {
  firstName: string;
  lastName: string;
  email: string;
}

export interface BookParams {
  prebookId: string;
  holder: BookHolder;
  guests: BookGuest[];
  /** `transactionId` returned by prebook + payment via the SDK. In sandbox,
   *  LiteAPI accepts the prebook's transactionId without real card capture. */
  paymentTransactionId: string;
}

export interface BookResult {
  bookingId: string;
  status: string;
  hotelConfirmationCode?: string;
  supplierConfirmationNum?: string;
  checkin?: string;
  checkout?: string;
  hotelName?: string;
  price?: number;
  commission?: number;
  currency?: string;
  cancellationPolicies?: unknown;
}

/** Hit `/v3.0/rates/book`. Throws MissingLiteApiKeyError on no key,
 *  LiteApiError on non-2xx. */
export async function bookRate(params: BookParams): Promise<BookResult> {
  const body = {
    prebookId: params.prebookId,
    holder: params.holder,
    payment: {
      method: 'TRANSACTION_ID',
      transactionId: params.paymentTransactionId,
    },
    guests: params.guests,
  };
  const res = await fetch(`${LITEAPI_BOOK_BASE}/rates/book`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new LiteApiError('/v3.0/rates/book', res.status, await res.text());
  }
  const json = await res.json();
  const d = json.data ?? json;
  return {
    bookingId: d.bookingId,
    status: d.status ?? 'CONFIRMED',
    hotelConfirmationCode: d.hotelConfirmationCode,
    supplierConfirmationNum: d.supplierConfirmationNum,
    checkin: d.checkin,
    checkout: d.checkout,
    hotelName: d.hotel?.name,
    price: d.price,
    commission: d.commission,
    currency: d.currency,
    cancellationPolicies: d.cancellationPolicies,
  };
}
