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

// ─── Standard facility set (PR-13) ───────────────────────────────────────────
// LiteAPI's `hotelFacilities[]` can be a 50+ item list — too noisy for a card.
// PR-14's UI renders a small row of amenity icons, so the mapper filters down
// to this canonical six. Matching is case-insensitive + contains-style so
// LiteAPI naming variants ("Swimming Pool"→"Pool", "Free WiFi"→"Wifi") still
// resolve to the canonical label.
const STANDARD_FACILITIES = ['Pool', 'Wifi', 'Breakfast', 'Gym', 'Spa', 'Parking'];

type LiteApiMode = 'sandbox' | 'production';

function getMode(): LiteApiMode {
  return process.env.LITEAPI_MODE === 'production' ? 'production' : 'sandbox';
}

/** PR-B2: the Payment SDK's `publicKey` value, driven off the SAME env as the API
 *  key (production → 'live', sandbox → 'sandbox'). The prebook route returns this
 *  to the client so the hosted SDK inits with the right key — never hardcoded. */
export function liteApiPaymentEnv(): 'live' | 'sandbox' {
  return getMode() === 'production' ? 'live' : 'sandbox';
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
  /** PR-loc-3: an explicit ISO-2 country code. When set, it's used DIRECTLY for
   *  the /data/hotels catalog (every country resolves). When absent, the code is
   *  derived from `country` via the ~60-entry countryNameToIso2 map (legacy
   *  callers, e.g. the authed trip flow). */
  countryCode?: string;
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
    /** PR-13: amenity strings (e.g. "Swimming Pool", "Free WiFi"). Filtered to
     *  STANDARD_FACILITIES by the mapper for card display. */
    hotelFacilities?: string[];
    /** PR-13: hotel chain name (e.g. "Marriott"). Surfaced as a card chip. */
    chain?: string;
    /** PR-13: 0-10 guest review score, distinct from the star `rating`. */
    reviewScore?: number;
  };
  /** PR-13: nights in the search window (checkout − checkin). Threaded on by
   *  searchHotelRates so the mapper can pass it through without the route
   *  changing its call. PR-15 uses it to compute a true per-night price. */
  nights?: number;
  /** PR-33: the EXACT search-window dates (ISO YYYY-MM-DD) these rates were
   *  quoted for. Threaded on alongside `nights` so the commit path can write the
   *  real stay window instead of the whole-trip span (the 184-night bug). */
  checkinDate?: string;
  checkoutDate?: string;
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

// ─── Two-step search (PR-hotels-two-step) ────────────────────────────────────
// PROVEN LIVE (scripts/probe-liteapi-lisbon.ts): POSTing /hotels/rates with a
// cityName or coords filter returns {error:{code:2001,"no availability found"}}
// for every city — that single-step path is dead. The working flow is TWO calls:
//   STEP 1  GET  /v3.0/data/hotels?cityName=&countryCode=  → { data:[{id,name,…}] }
//   STEP 2  POST /v3.0/hotels/rates  { hotelIds:[…] }       → { data:[{hotelId,roomTypes}] }
// then JOIN each rate (by hotelId) with its catalog hotel (by id): the catalog
// gives name/photo/stars/coords, the rate gives price/roomTypes — both needed by
// liteApiHotelToRecommendation.

/** Hotels priced per user search (one /hotels/rates call). The catalog can return
 *  hundreds; we price the first N. A larger caller maxResults raises it, hard
 *  ceiling 100 to bound the rates body. */
const CITY_CATALOG_LIMIT = 50;

/** A /v3.0/data/hotels catalog item: `id` (the join key) + the hotel-content
 *  metadata fields liteApiHotelToRecommendation reads. Loose — LiteAPI sends more
 *  than we consume; absent fields are handled by the mapper's optionals. */
type LiteApiCatalogHotel = { id?: string } & NonNullable<LiteApiHotelRate['hotel']>;

/** STEP 1: GET /v3.0/data/hotels for a city → the hotel catalog (id + name +
 *  coords + photo + stars). Mirrors getHotelContent's GET pattern (base/auth/
 *  mode/error). Throws MissingLiteApiKeyError on no key, LiteApiError on non-2xx.
 *  Returns [] when the city has no catalog hotels (honest empty). */
async function getCityHotelCatalog(params: SearchHotelsParams, countryCode: string): Promise<LiteApiCatalogHotel[]> {
  const useCoords = typeof params.latitude === 'number' && typeof params.longitude === 'number';
  const radius = params.radiusMeters ?? 25_000;
  const qs = new URLSearchParams(
    useCoords
      ? { latitude: String(params.latitude), longitude: String(params.longitude), radius: String(radius), countryCode }
      : { cityName: extractCityName(params.city), countryCode },
  );
  const mode = getMode();
  const keyPrefix = (mode === 'production' ? process.env.LITEAPI_PRODUCTION_KEY : process.env.LITEAPI_SANDBOX_KEY)?.slice(0, 4) ?? 'none';
  console.log(`[LiteAPI] data/hotels: mode=${mode} keyPrefix=${keyPrefix} ${useCoords ? `coords=${params.latitude},${params.longitude}` : `cityName=${extractCityName(params.city)}`} country=${countryCode}`);

  const res = await fetch(`${LITEAPI_BASE}/data/hotels?${qs.toString()}`, {
    method: 'GET',
    headers: headers(),
  });
  console.log(`[LiteAPI] data/hotels http: status=${res.status} ok=${res.ok}`);
  if (!res.ok) {
    throw new LiteApiError('/v3.0/data/hotels', res.status, await res.text());
  }
  const json = await res.json();
  const list: LiteApiCatalogHotel[] = Array.isArray(json?.data) ? json.data : [];
  console.log(`[LiteAPI] data/hotels: catalogLen=${list.length}`);
  return list;
}

/** Two-step hotel search: resolve a city → real hotelIds via /data/hotels, then
 *  price those IDs via /hotels/rates and join catalog metadata with rate pricing.
 *  Throws `MissingLiteApiKeyError` if no key set, `LiteApiError` on a real non-2xx.
 *  Returns [] (honest empty) when the city has no catalog hotels OR the rates call
 *  reports no availability (error 2001) — never a faked/default result. */
export async function searchHotelRates(params: SearchHotelsParams): Promise<LiteApiHotelRate[]> {
  // PR-loc-3: prefer an explicit ISO-2 code (the picker already holds it → all
  // 249 countries resolve). Fall back to deriving from the country NAME for
  // callers that don't pass a code (the authed flow). This is an EXPLICIT
  // code-vs-name precedence, NOT a silent error fallback: when no code is given,
  // countryNameToIso2 still THROWS on an unmapped name exactly as before.
  const countryCode = params.countryCode?.trim().toUpperCase() || countryNameToIso2(params.country);

  // ── STEP 1: city → catalog hotelIds. ──
  const catalog = await getCityHotelCatalog(params, countryCode);
  if (catalog.length === 0) return []; // honest empty — no catalog hotels for this city

  const catalogById: Record<string, LiteApiCatalogHotel> = {};
  const hotelIds: string[] = [];
  // Cap priced hotels: max(caller maxResults, default) bounded to 100 — the
  // catalog can be large; one /hotels/rates body shouldn't be unbounded.
  const limit = Math.min(Math.max(params.maxResults ?? CITY_CATALOG_LIMIT, CITY_CATALOG_LIMIT), 100);
  for (const h of catalog) {
    if (typeof h.id === 'string' && h.id.length > 0 && !catalogById[h.id]) {
      catalogById[h.id] = h;
      if (hotelIds.length < limit) hotelIds.push(h.id);
    }
  }
  if (hotelIds.length === 0) return [];

  // ── STEP 2: price those hotelIds. /hotels/rates ONLY works with hotelIds[]
  //    (cityName/coords → error 2001). ──
  const body = {
    hotelIds,
    checkin: params.checkin,
    checkout: params.checkout,
    occupancies: params.occupancies,
    currency: params.currency || 'USD',
    guestNationality: params.guestNationality || 'US',
  };
  const mode = getMode();
  const keyPrefix = (mode === 'production' ? process.env.LITEAPI_PRODUCTION_KEY : process.env.LITEAPI_SANDBOX_KEY)?.slice(0, 4) ?? 'none';
  console.log(`[LiteAPI] rates(two-step): mode=${mode} keyPrefix=${keyPrefix} hotelIds=${hotelIds.length}`);

  const res = await fetch(`${LITEAPI_BASE}/hotels/rates`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* non-JSON body */ }
  const rawLen = Array.isArray(json?.data) ? json.data.length : 'n/a';
  const errCode = json?.error?.code ?? 'none';
  console.log(`[LiteAPI] rates http: status=${res.status} ok=${res.ok} dataLen=${rawLen} errCode=${errCode}`);

  // "no availability found" for these hotels/dates → honest empty, not a crash.
  if (json?.error?.code === 2001) return [];
  // Any other non-2xx (auth/key/quota/5xx) → fail loud so the route surfaces it.
  if (!res.ok) {
    throw new LiteApiError('/v3.0/hotels/rates', res.status, text);
  }

  const rateItems: LiteApiHotelRate[] = Array.isArray(json?.data) ? json.data : [];

  // PR-13/PR-33: all hotels share the search window — stamp nights + the exact
  // dates once so the mapper + commit path read them off each item.
  const msPerDay = 24 * 60 * 60 * 1000;
  const nights = Math.max(
    0,
    Math.round((Date.parse(params.checkout) - Date.parse(params.checkin)) / msPerDay),
  ) || undefined;
  const checkinDate = params.checkin;
  const checkoutDate = params.checkout;

  // ── JOIN: each rate (by hotelId) ⨝ its catalog hotel (by id). Catalog → the
  //    `hotel` metadata (name/photo/stars); rate → roomTypes (price). ──
  const merged: LiteApiHotelRate[] = rateItems.map(r => {
    const meta = catalogById[r.hotelId];
    if (!meta) return { ...r, nights, checkinDate, checkoutDate };
    const { id: _omitId, ...metaFields } = meta;
    return { ...r, hotel: { ...metaFields, ...(r.hotel || {}) }, nights, checkinDate, checkoutDate };
  });
  return merged;
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
  price: number | null;          // whole-stay total in USD (the booking charge fallback depends on this)
  durationMinutes: null;
  // ─── PR-13 richness (all optional — PR-14's card UI consumes these) ────────
  /** City sibling field, distinct from the flat address line. */
  city?: string;
  /** Flat street-address string from the rates response. */
  addressLine?: string;
  latitude?: number;
  longitude?: number;
  /** 0-10 guest review score, alongside the 0-5 `googleRating`. */
  reviewScore?: number;
  /** Hotel chain name. */
  chain?: string;
  /** Full image gallery (URLs), not just the single `photoUrl`. */
  images?: string[];
  /** Amenities filtered to STANDARD_FACILITIES for card icons. */
  facilities?: string[];
  /** ISO currency of the quoted rate. */
  currency?: string;
  /** Whole-stay total (NOT per-night; same value as `price`). */
  priceTotal?: number;
  /** Nights in the search window; per-night = priceTotal / nights. */
  nights?: number;
  /** PR-33: the EXACT search-window dates (ISO YYYY-MM-DD) these rates were
   *  quoted for — the booking-integrity source of truth for the commit path.
   *  checkout − checkin === nights by construction. */
  checkinDate?: string;
  checkoutDate?: string;
  /** PR-15: true per-night price (priceTotal / nights). Absent when nights<1
   *  (a date-handling bug — never in normal operation). Drives display + the
   *  per-night price-level bucketing. */
  pricePerNight?: number;
  /** PR-22: full, unfiltered facility list (the detail page renders all of them;
   *  the card keeps the filtered 6 in `facilities`). */
  facilitiesAll?: string[];
  /** PR-22: untruncated hotel description (the detail page has room; the card
   *  keeps the 300-char `summary`). */
  descriptionFull?: string;
}

/** Extract the WHOLE-STAY total the hotel returned, in the requested currency.
 *  LiteAPI V3 nests rates under roomTypes[].rates[].retailRate; `retailRate.total`
 *  is the total for the booked window, NOT a per-night rate. Returns null if the
 *  hotel didn't quote a rate (some sandbox properties return metadata-only —
 *  surface as "see pricing" rather than dropping).
 *
 *  PR-15: renamed from the misleading `extractNightlyRate` — the honest name
 *  prevents re-bucketing this stay total against per-night thresholds. Per-night
 *  is computed in the mapper as priceTotal / nights. */
function extractStayTotal(hotel: LiteApiHotelRate): number | null {
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

/** PR-13: pull the whole-stay total + its currency off the same rate
 *  extractStayTotal picks. Returns nulls when no bookable rate was quoted.
 *  Mirrors extractStayTotal's fallback chain so `priceTotal` and `price`
 *  stay consistent. */
function extractRateMeta(hotel: LiteApiHotelRate): { total: number | null; currency: string | null } {
  for (const room of hotel.roomTypes || []) {
    for (const rate of room.rates || []) {
      const t = rate.retailRate?.total?.[0];
      if (t && typeof t.amount === 'number' && t.amount > 0) return { total: t.amount, currency: t.currency ?? null };
      const s = rate.retailRate?.suggestedSellingPrice?.[0];
      if (s && typeof s.amount === 'number' && s.amount > 0) return { total: s.amount, currency: s.currency ?? null };
      const o = rate.offerRetailRate;
      if (o && typeof o.amount === 'number' && o.amount > 0) return { total: o.amount, currency: o.currency ?? null };
    }
  }
  return { total: null, currency: null };
}

/** PR-13: filter a hotel's facility list to STANDARD_FACILITIES. Preserves the
 *  hotel's original ordering, emits the canonical label, and dedups. Matching
 *  is case-insensitive + contains-style ("Swimming Pool"→"Pool"). */
function filterStandardFacilities(facilities?: string[]): string[] {
  if (!facilities?.length) return [];
  const out: string[] = [];
  for (const f of facilities) {
    const lower = String(f).toLowerCase();
    const match = STANDARD_FACILITIES.find(std => lower.includes(std.toLowerCase()));
    if (match && !out.includes(match)) out.push(match);
  }
  return out;
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
  // `price` stays the WHOLE-STAY total (unchanged meaning — the booking charge
  // fallback in ReserveHotelButton depends on it). Sourced from extractStayTotal
  // exactly as before the PR-15 rename.
  const stayTotal = extractStayTotal(hotel);
  // PR-13 richness pass-through (UI renders these in PR-14/15).
  const { total: priceTotal, currency } = extractRateMeta(hotel);
  const nights = hotel.nights;

  // PR-15: true per-night price. `nights` is date-derived (checkout − checkin),
  // so for any real stay nights >= 1 by construction — there is no missing-nights
  // runtime state and therefore NO fallback. If nights < 1 ever appears it is a
  // date-handling bug upstream: fail loud (console.error) and render no price,
  // never a synthesized/defaulted value. This assertion must never fire normally.
  let pricePerNight: number | undefined;
  if (priceTotal != null) {
    if (typeof nights === 'number' && nights >= 1) {
      pricePerNight = Math.round(priceTotal / nights);
    } else {
      console.error(`[LiteAPI] pricePerNight: invalid nights=${nights} for hotelId=${hotel.hotelId} (priceTotal=${priceTotal}) — rendering no per-night`);
    }
  }

  // Bucketing is PER-NIGHT (PR-15 fix): nightlyToPriceLevel's thresholds are
  // per-night ($80/$200/$400), so it must see the per-night value, not the
  // whole-stay total. Undefined per-night → no price level (mirror PR-14).
  const { level: priceLevel, display: priceLevelDisplay } = nightlyToPriceLevel(pricePerNight ?? null);

  const images = h.hotelImages?.map(img => img.url).filter(Boolean) ?? [];
  const facilities = filterStandardFacilities(h.hotelFacilities);
  // PR-22: full passthroughs for the institutional detail page. The card still
  // uses the filtered `facilities` (6) + truncated `summary` (300) above.
  const facilitiesAll = h.hotelFacilities?.length ? h.hotelFacilities : undefined;
  const descriptionFull = h.hotelDescription
    ? h.hotelDescription.replace(/<[^>]*>/g, '') || undefined
    : undefined;

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
    price: stayTotal,
    durationMinutes: null,
    // ─── PR-13 richness ───────────────────────────────────────────────────
    city: h.city || undefined,
    addressLine: h.address || undefined,
    latitude: h.latitude,
    longitude: h.longitude,
    reviewScore: h.reviewScore,
    chain: h.chain || undefined,
    images,
    facilities,
    currency: currency || undefined,
    priceTotal: priceTotal ?? undefined,
    nights: hotel.nights,
    checkinDate: hotel.checkinDate,
    checkoutDate: hotel.checkoutDate,
    pricePerNight,
    facilitiesAll,
    descriptionFull,
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

// ─── Individual guest reviews (Travel-PR-23) ─────────────────────────────────
// `GET /v3.0/data/reviews` — real written guest reviews for a hotel. PAID call
// (B-5100 COGS — see getHotelReviews note). Reuses the SAME mode/key/X-API-Key
// path as searchHotelRates. Live response shape (per LiteAPI docs):
//   { data: [ { averageScore, country, type, name, date, headline,
//               language, pros, cons } ] }

/** One written guest review, exactly as `/v3.0/data/reviews` returns it. All
 *  fields optional except the score — we render only what's present, never
 *  fabricate. */
export interface HotelReview {
  averageScore?: number;       // numeric rating, e.g. 9 (out of 10)
  country?: string;            // 2-letter reviewer country, e.g. "us"
  type?: string;               // guest category, e.g. "family with young children"
  name?: string;               // reviewer first name
  date?: string;               // "YYYY-MM-DD HH:MM:SS"
  headline?: string;
  language?: string;           // ISO-639-1
  pros?: string;
  cons?: string;
}

/** Hit `GET /v3.0/data/reviews?hotelId=…`. Throws MissingLiteApiKeyError on no
 *  key, LiteApiError on non-2xx (fail-loud — an API error is NEVER returned as
 *  an empty list, so callers can tell "errored" from "no reviews"). */
export async function getHotelReviews(
  hotelId: string,
  opts?: { limit?: number; offset?: number; getSentiment?: boolean; timeout?: number },
): Promise<HotelReview[]> {
  const params = new URLSearchParams({ hotelId, limit: String(opts?.limit ?? 8) });
  if (opts?.offset) params.set('offset', String(opts.offset));
  if (opts?.getSentiment) params.set('getSentiment', 'true');
  if (opts?.timeout) params.set('timeout', String(opts.timeout));

  // PR-20-style observability: env mode + key prefix (4 chars only, never the
  // full key) + the hotelId being priced.
  const mode = getMode();
  const keyPrefix = (mode === 'production' ? process.env.LITEAPI_PRODUCTION_KEY : process.env.LITEAPI_SANDBOX_KEY)?.slice(0, 4) ?? 'none';
  console.log(`[LiteAPI] reviews: mode=${mode} keyPrefix=${keyPrefix} hotelId=${hotelId}`);

  const res = await fetch(`${LITEAPI_BASE}/data/reviews?${params.toString()}`, {
    method: 'GET',
    headers: headers(),
  });
  console.log(`[LiteAPI] reviews http: status=${res.status} ok=${res.ok}`);
  if (!res.ok) {
    throw new LiteApiError('/v3.0/data/reviews', res.status, await res.text());
  }
  const json = await res.json();
  const data: HotelReview[] = Array.isArray(json?.data) ? json.data : [];
  // B-5100 COGS: this is a PAID LiteAPI call. Per-call cost is NOT yet ledgered
  // (the rates/prebook/book calls don't track per-call COGS either — they only
  // log). PR-23 matches that pattern (log, no ledger write on this read path);
  // a unified LiteAPI COGS-tracking PR should ledger all paid calls to B-5100.
  console.log(`[LiteAPI] reviews: dataLen=${data.length} (B-5100 COGS — paid call)`);
  return data;
}

// ─── Hotel content / details (Travel-PR-28c) ─────────────────────────────────
// `GET /v3.0/data/hotel` — the RICH content endpoint. `/hotels/rates` returns
// thin metadata (price+photo+address); the full gallery, full amenities, coords,
// guest-review aggregate, and full description live here. PAID call (B-5100
// COGS). Called ON DETAIL-VIEW ONLY (one hotel the user opened) — never on scan.
// Live response shape (per LiteAPI docs):
//   { data: { id, name, hotelDescription, hotelImportantInformation,
//             hotelImages:[{url,urlHd,caption,order,defaultImage}],
//             hotelFacilities:[str], facilities:[{facilityId,name}],
//             address, city, country, zip, location:{latitude,longitude},
//             starRating, rating, reviewCount, stars } }

export interface HotelContent {
  id?: string;
  name?: string;
  hotelDescription?: string;
  hotelImportantInformation?: string;
  hotelImages?: Array<{ url: string; urlHd?: string; caption?: string; order?: number; defaultImage?: boolean }>;
  hotelFacilities?: string[];
  facilities?: Array<{ facilityId: number; name: string }>;
  address?: string;
  city?: string;
  country?: string;
  zip?: string;
  location?: { latitude?: number; longitude?: number };
  starRating?: number;
  rating?: number;       // guest review score (0-5 in observed responses)
  reviewCount?: number;
  stars?: number;
}

/** Hit `GET /v3.0/data/hotel?hotelId=…`. Throws MissingLiteApiKeyError on no key,
 *  LiteApiError on non-2xx (fail-loud). Returns the `data` object, or null. */
export async function getHotelContent(hotelId: string): Promise<HotelContent | null> {
  const params = new URLSearchParams({ hotelId });

  const mode = getMode();
  const keyPrefix = (mode === 'production' ? process.env.LITEAPI_PRODUCTION_KEY : process.env.LITEAPI_SANDBOX_KEY)?.slice(0, 4) ?? 'none';
  console.log(`[LiteAPI] hotel-content: mode=${mode} keyPrefix=${keyPrefix} hotelId=${hotelId}`);

  const res = await fetch(`${LITEAPI_BASE}/data/hotel?${params.toString()}`, {
    method: 'GET',
    headers: headers(),
  });
  console.log(`[LiteAPI] hotel-content http: status=${res.status} ok=${res.ok}`);
  if (!res.ok) {
    throw new LiteApiError('/v3.0/data/hotel', res.status, await res.text());
  }
  const json = await res.json();
  const data: HotelContent | null = json?.data ?? null;
  const imgLen = Array.isArray(data?.hotelImages) ? data!.hotelImages!.length : 0;
  // B-5100 COGS: paid call. Per-detail-view only (one hotel) — never on scan.
  // Per-call cost not yet ledgered (matches rates/reviews pattern); a unified
  // LiteAPI COGS PR should ledger all paid calls to B-5100.
  console.log(`[LiteAPI] hotel-content: imagesLen=${imgLen} (B-5100 COGS — paid call, per detail-view)`);
  return data;
}

// ─── Location lists (PR-loc-1) — for the hotel picker's country→city dropdown ──
// LiteAPI's static-ish location catalogs. Mirrors getHotelContent's /data/* GET
// pattern (base/auth/mode/error). PROVEN live (scripts/probe-liteapi-cities.ts):
//   GET /data/countries            → { data: [ {code:'PT', name:'Portugal'}, … ] }
//   GET /data/cities?countryCode=PT → { data: [ {city:'Lisbon'}, … ] }
// Fail-loud on non-2xx (LiteApiError) — never a faked/partial list.

export interface LiteApiCountry { code: string; name: string }
export interface LiteApiCity { city: string }

/** GET /v3.0/data/countries → the country list ([{code,name}]). Throws
 *  MissingLiteApiKeyError on no key, LiteApiError on non-2xx. */
export async function getCountries(): Promise<LiteApiCountry[]> {
  const mode = getMode();
  const keyPrefix = (mode === 'production' ? process.env.LITEAPI_PRODUCTION_KEY : process.env.LITEAPI_SANDBOX_KEY)?.slice(0, 4) ?? 'none';
  console.log(`[LiteAPI] data/countries: mode=${mode} keyPrefix=${keyPrefix}`);
  const res = await fetch(`${LITEAPI_BASE}/data/countries`, { method: 'GET', headers: headers() });
  console.log(`[LiteAPI] data/countries http: status=${res.status} ok=${res.ok}`);
  if (!res.ok) {
    throw new LiteApiError('/v3.0/data/countries', res.status, await res.text());
  }
  const json = await res.json();
  return Array.isArray(json?.data) ? json.data : [];
}

/** GET /v3.0/data/cities?countryCode=XX → the city list ([{city}]). LiteAPI
 *  REQUIRES countryCode (400 without it). Throws MissingLiteApiKeyError on no key,
 *  LiteApiError on non-2xx. */
export async function getCities(countryCode: string): Promise<LiteApiCity[]> {
  const qs = new URLSearchParams({ countryCode });
  const mode = getMode();
  const keyPrefix = (mode === 'production' ? process.env.LITEAPI_PRODUCTION_KEY : process.env.LITEAPI_SANDBOX_KEY)?.slice(0, 4) ?? 'none';
  console.log(`[LiteAPI] data/cities: mode=${mode} keyPrefix=${keyPrefix} countryCode=${countryCode}`);
  const res = await fetch(`${LITEAPI_BASE}/data/cities?${qs.toString()}`, { method: 'GET', headers: headers() });
  console.log(`[LiteAPI] data/cities http: status=${res.status} ok=${res.ok}`);
  if (!res.ok) {
    throw new LiteApiError('/v3.0/data/cities', res.status, await res.text());
  }
  const json = await res.json();
  return Array.isArray(json?.data) ? json.data : [];
}
