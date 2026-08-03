// ─── LiteAPI Flights Client (PR-FL-1) ────────────────────────────────────────
// Flight inventory provider — the same LiteAPI/Nuitee account as the hotel lane
// (src/lib/liteapiClient.ts), same key, same auth. FLIGHT-LITE-1 recon proved
// flights support client-card User Payment (usePaymentSdk → Stripe intent) like
// hotels; this PR ships ONLY the search side: rates + verify. No prebook, no
// book, no routes, no UI.
//
// PATTERN: mirrors src/lib/liteapiClient.ts exactly —
//   - mode switch          → liteapiClient.ts:35-37  (LITEAPI_MODE === 'production')
//   - key selection        → liteapiClient.ts:46-53  (LITEAPI_PRODUCTION_KEY /
//                            LITEAPI_SANDBOX_KEY, MissingLiteApiKeyError)
//   - X-API-Key headers    → liteapiClient.ts:55-61
//   - observability line   → liteapiClient.ts:790-792 (mode + 4-char key prefix,
//                            never the full key)
// liteapiClient.ts itself is NOT modified — its helpers are module-private, so
// they are duplicated here with the citations above rather than exported.
//
// HOSTS: the flights PRODUCTION host is documented as the same API host the
// hotel lane uses (docs.liteapi.travel/reference/post_flights-rates.md: "API
// base URL: https://api.liteapi.travel/v3.0"). The SANDBOX host was ambiguous
// in the docs (a stray "Sandbox available at https://sandbox.nuitee.flights"
// mention — FLIGHT-LITE-1 recon); the PR-FL-1 live probe settled it — see the
// verdict on FLIGHTS_HOST_SANDBOX below. One host per mode at runtime, no
// fallback chain.

import { MissingLiteApiKeyError, LiteApiError } from './travelErrors';

// Production flights host — documented on the rates reference (see header).
const FLIGHTS_HOST_PRODUCTION = 'https://api.liteapi.travel/v3.0';

/** Sandbox flights host — PROBE-VERIFIED (PR-FL-1 live probe, 2026-08-03,
 *  key-authenticated): the sandbox key against api.liteapi.travel/v3.0
 *  /flights/rates returned 200 with 158 journeys / 421 offers, Nuitée Air
 *  present, sample offer priced + expiring; the docs' other candidate,
 *  sandbox.nuitee.flights, returned 404 on both path spellings. Sandbox and
 *  production SHARE the documented host — the key selects the environment,
 *  exactly like the hotel lane (liteapiClient.ts:22,46-53). */
const FLIGHTS_HOST_SANDBOX = 'https://api.liteapi.travel/v3.0';

type LiteApiMode = 'sandbox' | 'production';

// Mirrors liteapiClient.ts:35-37.
function getMode(): LiteApiMode {
  return process.env.LITEAPI_MODE === 'production' ? 'production' : 'sandbox';
}

// Mirrors liteapiClient.ts:46-53.
function getApiKey(): string {
  const mode = getMode();
  const key = mode === 'production'
    ? process.env.LITEAPI_PRODUCTION_KEY
    : process.env.LITEAPI_SANDBOX_KEY;
  if (!key) throw new MissingLiteApiKeyError(mode);
  return key;
}

// Mirrors liteapiClient.ts:55-61.
function headers(): Record<string, string> {
  return {
    'X-API-Key': getApiKey(),
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
}

/** One host per mode; no fallback chain. Both currently resolve to the same
 *  documented host (probe verdict above) — kept mode-keyed so any future host
 *  divergence is a one-line change. */
function flightsBaseUrl(): string {
  return getMode() === 'production' ? FLIGHTS_HOST_PRODUCTION : FLIGHTS_HOST_SANDBOX;
}

// ─── Typed errors ────────────────────────────────────────────────────────────
// Flights error bodies are structured (docs, rates reference):
//   { error: { code: number, message: string, description: string, key?: string } }
// unlike the hotel endpoints' looser bodies — so the flights subclass carries
// the parsed provider code/message on top of LiteApiError (which existing
// route handlers already know how to map).

/** Provider codes meaning "this offer is dead — re-search" (verify reference:
 *  42004 / 42017 = offer expired). */
export const FLIGHT_OFFER_EXPIRED_CODES: ReadonlySet<number> = new Set([42004, 42017]);

/** Non-2xx from a flights endpoint. `providerCode`/`providerMessage` are the
 *  parsed `error.code`/`error.message` when the body was the documented JSON
 *  shape, null when it wasn't (the raw body still rides on `body` either way —
 *  nothing is swallowed). */
export class LiteApiFlightsApiError extends LiteApiError {
  constructor(
    endpoint: string,
    status: number,
    public providerCode: number | null,
    public providerMessage: string | null,
    body?: string,
  ) {
    super(endpoint, status, body);
    this.name = 'LiteApiFlightsApiError';
  }
}

/** The offer expired / is no longer bookable (provider code 42004 or 42017).
 *  Callers swap "retry same offer" for "re-search" on this one. */
export class FlightOfferExpiredError extends LiteApiFlightsApiError {
  constructor(endpoint: string, status: number, providerCode: number, providerMessage: string | null, body?: string) {
    super(endpoint, status, providerCode, providerMessage, body);
    this.name = 'FlightOfferExpiredError';
  }
}

// ─── Request types (docs.liteapi.travel/reference/post_flights-rates.md) ─────

export type FlightCabinClass = 'ECONOMY' | 'PREMIUM_ECONOMY' | 'BUSINESS' | 'FIRST';
export type FlightDirection = 'OUTBOUND' | 'INBOUND';

/** Global or per-leg search filters (per-leg overrides global, per the docs). */
export interface FlightSearchFilters {
  arrivalTimeBefore?: string;      // "HH:MM"
  arrivalTimeAfter?: string;       // "HH:MM"
  departureTimeBefore?: string;    // "HH:MM"
  departureTimeAfter?: string;     // "HH:MM"
  cabinClass?: string;
  cabinClassMatch?: 'exactly' | 'at_least';
  changeableOnly?: boolean;
  excludeOvernight?: boolean;
  includesCarryOnBag?: boolean;
  includesCheckedBag?: boolean;
  refundableOnly?: boolean;
  showCheapestOfferOnly?: boolean;
  excludeConnectionAirports?: string[];
  flightNumbers?: string[];
  flightNumbersMatch?: 'any' | 'all';
  legDurations?: { direction: FlightDirection; maxMinutes: number }[];
  maxDuration?: number;
  maxStops?: number;
  maxPrice?: number;
  minPrice?: number;
}

export interface FlightLeg {
  origin: string;        // IATA, e.g. "SGN"
  destination: string;   // IATA, e.g. "BKK"
  date: string;          // "YYYY-MM-DD"
  direction?: FlightDirection;
  filters?: FlightSearchFilters;
}

export interface FlightSort {
  sortBy: 'price' | 'duration' | 'departure' | 'arrival' | 'stops';
  sortOrder?: 'asc' | 'desc';
}

export interface FlightSearchParams {
  legs: FlightLeg[];
  adults: number;          // min 1
  children?: number;
  /** Length must equal `children` (ages 2–11, per the docs). */
  childrenAges?: number[];
  infants?: number;
  /** Length must equal `infants` (ages 0–1, per the docs). */
  infantAges?: number[];
  cabinClass?: FlightCabinClass;
  currency: string;        // ISO 4217 — REQUIRED by the API
  country?: string;        // ISO 3166-1 alpha-2
  filters?: FlightSearchFilters;
  sort?: FlightSort;
}

// ─── Response types (same reference; verify shapes from post_flights-verify) ─
// Only `offerId` and the identity keys are treated as guaranteed; everything
// else is optional — the sandbox probe is still pending, so doc-vs-reality
// deviations surface as absent fields, never as runtime crashes on access.

export interface FlightDurationValue {
  iso8601?: string;        // e.g. "PT7H45M"
  minutes?: number;
}

export interface FlightSegment {
  segmentKey: string;
  originCode?: string;
  originName?: string;
  destinationCode?: string;
  destinationName?: string;
  departureTime?: string;  // ISO 8601
  arrivalTime?: string;    // ISO 8601
  direction?: FlightDirection;
  duration?: FlightDurationValue;
  flight?: { marketingNumber?: string; operatingNumber?: string };
  carrier?: {
    marketingCode?: string;
    marketingLogo?: string;
    marketingName?: string;
    operatingCode?: string;
    operatingLogo?: string;
    operatingName?: string;
  };
}

export interface FlightPassengerPricing {
  base?: number;
  currency?: string;
  fees?: number;
  taxes?: number;
  total?: number;
}

export interface FlightOfferPricing {
  display?: {
    total?: number;
    currency?: string;
    base?: number;
    fees?: number;
    taxes?: number;
    perPassenger?: {
      adult?: FlightPassengerPricing;
      child?: FlightPassengerPricing;
      infant?: FlightPassengerPricing;
    };
  };
  converted?: boolean;
}

export interface FlightOfferTerms {
  changeable?: boolean;
  refundable?: boolean;
  summary?: { level?: string; message?: string }[];
  changeFee?: unknown;
  refundFee?: unknown;
  hasChangeFee?: boolean;
  hasRefundFee?: boolean;
}

export interface FlightSegmentFare {
  segmentKey?: string;
  bookingCode?: string;
  cabin?: string;
  fareBasisCode?: string;
  fareFamily?: string;
  seatsRemaining?: number;
}

export interface FlightOffer {
  offerId: string;
  /** ISO 8601 — the fare hold; verify before prebooking (recon). */
  expiration?: string;
  pricing?: FlightOfferPricing;
  fare?: { family?: string; mixedCabin?: boolean; seatsRemaining?: number };
  baggage?: {
    hasCarryOnBag?: boolean;
    hasCheckedBag?: boolean;
    included?: {
      bagType?: 'cabin' | 'checked';
      description?: string;
      passengerType?: 'ADT' | 'CHD' | 'INF';
      pieces?: number;
      pricing?: { display?: { amount?: number; currency?: string }; converted?: boolean };
      unit?: string;
      weightKg?: number;
    }[];
  };
  terms?: FlightOfferTerms;
  segmentFares?: FlightSegmentFare[];
  segmentAmenities?: {
    segmentKey?: string;
    aircraftType?: string;
    amenities?: {
      available?: boolean;
      category?: string;
      chargeable?: boolean | null;
      details?: string | null;
      name?: string;
    }[];
  }[];
}

export interface FlightJourney {
  journeyKey: string;
  isCheapest?: boolean;
  timestamp?: string;
  totalDuration?: FlightDurationValue;
  legDurations?: {
    direction?: FlightDirection;
    duration?: FlightDurationValue;
    dayChange?: number;
    overnightFlight?: boolean;
  }[];
  parameters?: { adults?: number; children?: number; infants?: number };
  segments: FlightSegment[];
  offers: FlightOffer[];
  connections?: unknown[];
}

export interface FlightSortMetadataEntry {
  journeyKey?: string;
  offerId?: string | null;
  price?: number;
  currency?: string;
}

export interface FlightSearchResult {
  journeys: FlightJourney[];
  sortMetadata?: {
    best?: FlightSortMetadataEntry;
    price?: FlightSortMetadataEntry;
    duration?: FlightSortMetadataEntry;
    stops?: FlightSortMetadataEntry;
  };
}

// ─── Shared POST helper ──────────────────────────────────────────────────────

/** POST one flights endpoint. `base` is resolved by the caller (so the
 *  observability line can name it). No retries, no fallbacks: non-2xx parses
 *  the documented `{ error: { code, message } }` body for classification and
 *  throws typed — expired codes → FlightOfferExpiredError, everything else →
 *  LiteApiFlightsApiError. The raw body rides the throw either way. */
async function postFlights<T>(base: string, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const raw = await res.text();
    let providerCode: number | null = null;
    let providerMessage: string | null = null;
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed?.error?.code === 'number') providerCode = parsed.error.code;
      if (typeof parsed?.error?.message === 'string') providerMessage = parsed.error.message;
    } catch {
      // Body wasn't the documented JSON error shape — classification fields
      // stay null; the raw body still throws below. Nothing is swallowed.
    }
    if (providerCode !== null && FLIGHT_OFFER_EXPIRED_CODES.has(providerCode)) {
      throw new FlightOfferExpiredError(path, res.status, providerCode, providerMessage, raw);
    }
    throw new LiteApiFlightsApiError(path, res.status, providerCode, providerMessage, raw);
  }
  return res.json() as Promise<T>;
}

// ─── Search (POST /flights/rates) ────────────────────────────────────────────

/** Search flight rates. Returns the response's `data[]` (each entry: journeys
 *  with segments + offers, plus sortMetadata). Throws MissingLiteApiKeyError
 *  before any network call, LiteApiFlightsApiError (or
 *  FlightOfferExpiredError) on non-2xx, and a contract-deviation error when
 *  2xx arrives without `data[]`. */
export async function searchFlightRates(
  params: FlightSearchParams,
): Promise<FlightSearchResult[]> {
  const base = flightsBaseUrl();

  // Observability, mirroring liteapiClient.ts:790-792 — mode + 4-char key
  // prefix (never the full key) + the route being priced.
  const mode = getMode();
  const keyPrefix = (mode === 'production' ? process.env.LITEAPI_PRODUCTION_KEY : process.env.LITEAPI_SANDBOX_KEY)?.slice(0, 4) ?? 'none';
  const legsLabel = params.legs.map((l) => `${l.origin}-${l.destination}@${l.date}`).join(',');
  console.log(`[LiteAPI flights] rates: mode=${mode} keyPrefix=${keyPrefix} host=${base} legs=${legsLabel}`);

  const json = await postFlights<{ data?: unknown }>(base, '/flights/rates', params);
  if (!Array.isArray(json?.data)) {
    // 2xx without the documented envelope is a contract deviation — fail loud
    // with the actual payload (and the real HTTP status), never return [] as
    // if the search were empty.
    throw new LiteApiFlightsApiError(
      '/flights/rates',
      200,
      null,
      'Response missing data[] — contract deviation from the documented shape',
      JSON.stringify(json).slice(0, 500),
    );
  }
  return json.data as FlightSearchResult[];
}

// ─── Verify (POST /flights/verify) ───────────────────────────────────────────
// Recon note preserved: "the offerId is not returned in the JSON body (use the
// same id you sent on the verify request for prebook/book)" — the CALLER
// retains the offerId; this function's result carries re-pricing + changes.

export interface FlightVerifyChanges {
  cabinChanged?: boolean;
  fareChanged?: boolean;
  priceChanged?: boolean;
  messages?: string[];
  /** Full old/new pricing comparison (the docs deprecate the scalar fields). */
  pricing?: { old?: FlightOfferPricing; new?: FlightOfferPricing };
  [key: string]: unknown;
}

export interface FlightVerifyJourney {
  journeyKey?: string;
  /** ISO 8601 — offer validity; verify before prebooking. */
  expiration?: string;
  timestamp?: string;
  provider?: { code?: string; logo?: string };
  pricing?: FlightOfferPricing;
  baggage?: FlightOffer['baggage'];
  fare?: { family?: string; mixedCabin?: boolean; seatsRemaining?: number };
  segments?: FlightSegment[];
  segmentFares?: FlightSegmentFare[];
  terms?: FlightOfferTerms;
}

export interface FlightVerifyResult {
  journey: FlightVerifyJourney;
  /** Present only when something changed since search — check `priceChanged` /
   *  `fareChanged` before prebooking at the searched price. */
  changes?: FlightVerifyChanges | null;
}

/** Re-price + availability-check one offer before prebook. Same typed-error
 *  contract as searchFlightRates; 42004/42017 arrive as
 *  FlightOfferExpiredError (dead offer → re-search, don't retry). */
export async function verifyFlightOffer(
  { offerId }: { offerId: string },
): Promise<FlightVerifyResult[]> {
  const base = flightsBaseUrl();

  const mode = getMode();
  const keyPrefix = (mode === 'production' ? process.env.LITEAPI_PRODUCTION_KEY : process.env.LITEAPI_SANDBOX_KEY)?.slice(0, 4) ?? 'none';
  console.log(`[LiteAPI flights] verify: mode=${mode} keyPrefix=${keyPrefix} host=${base}`);

  const json = await postFlights<{ data?: unknown }>(base, '/flights/verify', { offerId });
  if (!Array.isArray(json?.data)) {
    throw new LiteApiFlightsApiError(
      '/flights/verify',
      200,
      null,
      'Response missing data[] — contract deviation from the documented shape',
      JSON.stringify(json).slice(0, 500),
    );
  }
  return json.data as FlightVerifyResult[];
}
