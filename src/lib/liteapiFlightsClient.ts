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
import type { LiteApiAnswer } from './arrivals/liteapiBooking';

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
  return (await postFlightsAnswer(base, path, body)).json as T;
}

/** REBUILD-01 PR-5: the same POST, the 2xx answer kept as bytes (arrayBuffer —
 *  never re-encoded) beside its parsed JSON, so the arrivals store lands the
 *  book answer exactly as received (src/lib/arrivals/liteapiBooking.ts). The
 *  non-2xx path is unchanged: typed throws, the raw body riding them. */
async function postFlightsAnswer(base: string, path: string, body: unknown): Promise<LiteApiAnswer> {
  const asked = new Date();
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  const bytes = Buffer.from(await res.arrayBuffer());
  const arrived = new Date();
  if (!res.ok) throwFlightsNon2xx(path, res.status, bytes);
  return { httpStatus: res.status, body: bytes, asked, arrived, json: JSON.parse(bytes.toString('utf8')) };
}

/** The non-2xx contract, one place for the POSTs and the GET (LANE-01): typed
 *  throws, the raw body riding them — 42004/42017 → FlightOfferExpiredError,
 *  everything else → LiteApiFlightsApiError. Never returns. */
function throwFlightsNon2xx(path: string, status: number, bytes: Buffer): never {
  const raw = bytes.toString('utf8');
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
    throw new FlightOfferExpiredError(path, status, providerCode, providerMessage, raw);
  }
  throw new LiteApiFlightsApiError(path, status, providerCode, providerMessage, raw);
}

/** LANE-01 (2026-09-25): the same contract for a GET — the 2xx answer kept as
 *  bytes beside its parsed JSON; non-2xx through the one classifier above. */
async function getFlightsAnswer(base: string, path: string): Promise<LiteApiAnswer> {
  const asked = new Date();
  const res = await fetch(`${base}${path}`, { method: 'GET', headers: headers() });
  const bytes = Buffer.from(await res.arrayBuffer());
  const arrived = new Date();
  if (!res.ok) throwFlightsNon2xx(path, res.status, bytes);
  return { httpStatus: res.status, body: bytes, asked, arrived, json: JSON.parse(bytes.toString('utf8')) };
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

// ─── Book (POST /flights/bookings) ───────────────────────────────────────────
// Completes the booking AFTER the browser confirmed the Stripe payment (FL-4
// panel): body is prebookId + payment { method: 'TRANSACTION_ID',
// transactionId } — the docs' exact TRANSACTION_ID shape ("Stripe payment
// intent id. Required when method is TRANSACTION_ID"). The CREDIT method is
// deliberately not expressible here (client-card-only is the ruled rail).

/** The five DOCUMENTED booking statuses (bookings reference). The API may add
 *  values; unknown strings pass through VERBATIM — never remapped. */
export const FLIGHT_BOOKING_STATUSES = [
  'PENDING_CONFIRMATION', 'CONFIRMED', 'CANCELLED', 'PENDING', 'TICKETED',
] as const;
export type FlightBookingStatus = (typeof FLIGHT_BOOKING_STATUSES)[number];

/** Booking completion result — raw provider truth, nullable where the response
 *  didn't carry the field (absence is honest, nothing invented). `pnr` is
 *  order.reference.provider.pnr; price prefers pricing.totalAmount, falling
 *  back to payment.amount (the captured charge). */
export interface FlightBookResult {
  bookingId: string;
  bookingRef: string | null;          // "FH-YYM-XXXXXXXX"
  status: FlightBookingStatus | (string & {}) | null;
  paymentStatus: string | null;       // 'pending' | 'completed' | 'failed' | 'not_required'
  pnr: string | null;
  price: number | null;
  currency: string | null;
}

/** The booking object inside a flights book answer — `data[0].booking` (the docs:
 *  data is an array of one `{ booking, message }`; the message says whether the
 *  booking already existed for the prebookId and stays in the wire row) — the
 *  arrival's payload (REBUILD-01 PR-5). A 2xx without booking.bookingId is the
 *  contract deviation bookFlight always threw. */
export function flightBookingObjectOf(json: unknown): Record<string, unknown> {
  const data = (json as { data?: unknown } | null)?.data;
  const first = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : undefined;
  const booking = first?.booking as Record<string, unknown> | undefined;
  const bookingId = typeof booking?.bookingId === 'string' ? booking.bookingId : '';
  if (!booking || !bookingId) {
    throw new LiteApiFlightsApiError(
      '/flights/bookings',
      200,
      null,
      'Book 2xx missing booking.bookingId — contract deviation from the documented shape',
      JSON.stringify(json).slice(0, 500),
    );
  }
  return booking;
}

/** The FlightBookResult mapping over the booking object — pure, so the landing
 *  runs it over the ARRIVAL payload (src/lib/arrivals/liteapiBooking.ts), never
 *  over the HTTP object. Field for field what bookFlight always returned. */
export function parseFlightBookResult(booking: Record<string, unknown>): FlightBookResult {
  const pricing = booking.pricing as Record<string, unknown> | undefined;
  const payment = booking.payment as Record<string, unknown> | undefined;
  const order = booking.order as Record<string, unknown> | undefined;
  const reference = order?.reference as Record<string, unknown> | undefined;
  const providerRef = reference?.provider as Record<string, unknown> | undefined;

  return {
    bookingId: booking.bookingId as string,
    bookingRef: typeof booking.bookingRef === 'string' ? booking.bookingRef : null,
    status: typeof booking.status === 'string' ? booking.status : null,
    paymentStatus: typeof booking.paymentStatus === 'string' ? booking.paymentStatus : null,
    pnr: typeof providerRef?.pnr === 'string' ? providerRef.pnr : null,
    price: typeof pricing?.totalAmount === 'number'
      ? pricing.totalAmount
      : (typeof payment?.amount === 'number' ? payment.amount : null),
    currency: typeof pricing?.currency === 'string'
      ? pricing.currency
      : (typeof payment?.currency === 'string' ? payment.currency : null),
  };
}

export interface FlightBookAnswer {
  /** The answer as received — the bytes the arrivals store lands. */
  answer: LiteApiAnswer;
  /** The booking object inside it — the arrival's payload. */
  object: Record<string, unknown>;
  /** parseFlightBookResult over that object — for the route's failure branches and ids BEFORE the landing; what is persisted and answered is parsed from the arrival. */
  booked: FlightBookResult;
}

/** Complete one flight booking. IDEMPOTENT PER THE DOCS: "Returns the existing
 *  booking if one already exists for the given `prebookId`" — a retry with the
 *  same prebookId cannot double-book. Throws typed on non-2xx (42004/42017 →
 *  FlightOfferExpiredError) and throws a contract-deviation error on a 2xx
 *  missing booking.bookingId. */
export async function bookFlight({ prebookId, transactionId }: {
  prebookId: string;
  transactionId: string;
}): Promise<FlightBookAnswer> {
  const base = flightsBaseUrl();

  const mode = getMode();
  const keyPrefix = (mode === 'production' ? process.env.LITEAPI_PRODUCTION_KEY : process.env.LITEAPI_SANDBOX_KEY)?.slice(0, 4) ?? 'none';
  console.log(`[LiteAPI flights] book: mode=${mode} keyPrefix=${keyPrefix} host=${base}`);

  const answer = await postFlightsAnswer(base, '/flights/bookings', {
    prebookId,
    payment: { method: 'TRANSACTION_ID', transactionId },
  });
  const object = flightBookingObjectOf(answer.json);
  return { answer, object, booked: parseFlightBookResult(object) };
}

// ─── Booking details (GET /flights/bookings/{bookingId}) — LANE-01 ──────────
// docs.liteapi.travel/reference/get_flights-bookings-bookingid: the same envelope
// as the book answer — data[] of one { booking } — and the booking carries its
// CURRENT status ("CREATED" | "PENDING_CONFIRMATION" | "CONFIRMED" | "CANCELLED" |
// "CANCELLED_WITH_CHARGES", "normalized dispatcher booking status") and
// journey.segments[], each with departureTime, arrivalTime, direction
// (OUTBOUND | INBOUND), originCode, destinationCode, carrier.marketingName and
// flight.marketingNumber. This is what gives a flight reservation its day, its
// name and its refreshed status (src/lib/reservations/refreshFlightReservation.ts).

/** One segment as stated — null where the answer did not carry the field. */
export interface FlightBookingSegmentDetails {
  departureTime: string | null;
  direction: string | null;
  originCode: string | null;
  destinationCode: string | null;
  carrierName: string | null;
  flightNumber: string | null;
}

export interface FlightBookingDetails {
  bookingId: string;
  bookingRef: string | null;
  status: string | null;
  /** CANCEL-01 (2026-09-26): the vendor's own timestamp — "set when a cancellation
   *  was requested and is awaiting airline confirmation (or retained after finalize
   *  as evidence)"; omitted when null. Null here when the answer did not carry it. */
  cancelIntentAt: string | null;
  segments: FlightBookingSegmentDetails[];
}

/** The details mapping over the booking object — pure; absence is honest (null),
 *  nothing is invented. A journey with no segments array maps to []. */
export function parseFlightBookingDetails(booking: Record<string, unknown>): FlightBookingDetails {
  const journey = booking.journey as Record<string, unknown> | undefined;
  const raw = Array.isArray(journey?.segments) ? (journey!.segments as unknown[]) : [];
  const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);
  const segments = raw
    .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object')
    .map((s) => {
      const carrier = s.carrier as Record<string, unknown> | undefined;
      const flight = s.flight as Record<string, unknown> | undefined;
      return {
        departureTime: str(s.departureTime),
        direction: str(s.direction),
        originCode: str(s.originCode),
        destinationCode: str(s.destinationCode),
        carrierName: str(carrier?.marketingName),
        flightNumber: str(flight?.marketingNumber),
      };
    });
  return {
    bookingId: booking.bookingId as string,
    bookingRef: str(booking.bookingRef),
    status: str(booking.status),
    cancelIntentAt: str(booking.cancelIntentAt),
    segments,
  };
}

export interface FlightBookingDetailsAnswer {
  /** The answer as received. */
  answer: LiteApiAnswer;
  /** data[0].booking. */
  object: Record<string, unknown>;
  details: FlightBookingDetails;
}

/** Read one flight booking's current state. Throws MissingLiteApiKeyError before
 *  any network call, LiteApiFlightsApiError on non-2xx, and a contract-deviation
 *  error on a 2xx missing booking.bookingId (flightBookingObjectOf). Not a
 *  booking call: it moves no money and holds nothing — it READS what the vendor
 *  states. Its cost is undocumented, so callers meter it
 *  (travelSearchQuota 'liteapiflightbookingread'). */
export async function getFlightBooking(bookingId: string): Promise<FlightBookingDetailsAnswer> {
  const base = flightsBaseUrl();
  const answer = await getFlightsAnswer(base, `/flights/bookings/${encodeURIComponent(bookingId)}`);
  const object = flightBookingObjectOf(answer.json);
  return { answer, object, details: parseFlightBookingDetails(object) };
}

// ─── Cancellation — CANCEL-01 (2026-09-26) ───────────────────────────────────
// Two endpoints, from docs.liteapi.travel/reference:
//   get_flights-bookings-bookingid-cancellations  — THE QUOTE. { data: [ {
//     confidence ("confirmed" | "estimated" | "heuristic" | "unknown"), timestamp,
//     isRefundable, isVoidable, refund { display { amount, currency } }, penalty
//     { display { amount, currency } }, penalties[] { type, description, pricing
//     { display { amount, currency } } }, tickets[], destination ("original_payment"
//     | "agency_deposit" | "voucher" | "bsp_settlement" | "manual" | "unknown"),
//     vouchers[] { voucherId, code, airline, pricing { display }, validFrom,
//     expiresAt, passengerNames[], notes }, pnr, expiresAt } ] } — "always a
//     single-item array". The refund is "the potential maximum ... not granted or
//     guaranteed": a QUOTE, read before a customer is asked to confirm. 409 49006
//     = cannot be quoted in its current state; 409 49007 = a cancellation is
//     already in progress.
//   post_flights-bookings-bookingid-cancellations — THE ACTION, no body. 200 =
//     final: { data: { bookingId, status ("CANCELLED" | "CANCELLED_WITH_CHARGES"),
//     cancellation_fee, refund_amount, currency, destination, vouchers[] } }.
//     202 = accepted, awaiting the airline: the same shape with status "CONFIRMED"
//     (the booking is unchanged until the airline finalizes; GET /flights/bookings
//     then carries cancelIntentAt). 409 = refused, nothing changed.
// Both read the raw answer beside the parsed result, and every field the vendor
// did not state is null — never 0, never a default.

/** One money figure as the vendor displays it. */
export interface FlightMoney {
  amount: number;
  currency: string | null;
}

export interface FlightVoucher {
  vendorVoucherId: string | null;
  code: string | null;
  airline: string | null;
  amount: FlightMoney | null;
  validFrom: string | null;
  expiresAt: string | null;
  passengerNames: string[] | null;
  notes: string | null;
}

export interface FlightCancellationPenalty {
  type: string | null;
  description: string | null;
  amount: FlightMoney | null;
}

export interface FlightCancellationQuote {
  confidence: string;
  timestamp: string | null;
  isRefundable: boolean | null;
  isVoidable: boolean | null;
  refund: FlightMoney | null;
  penalty: FlightMoney | null;
  penalties: FlightCancellationPenalty[];
  currency: string | null;
  destination: string | null;
  vouchers: FlightVoucher[];
  pnr: string | null;
  expiresAt: string | null;
}

const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);
const boolOrNull = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null);

/** `{ display: { amount, currency } }` → the figure, or null when no amount was stated. */
function displayMoneyOf(v: unknown): FlightMoney | null {
  const display = (v as { display?: unknown } | null | undefined)?.display as Record<string, unknown> | undefined;
  if (!display || typeof display.amount !== 'number') return null;
  return { amount: display.amount, currency: strOrNull(display.currency) };
}

/** A voucher as documented — every absent field null, never invented. */
export function parseFlightVoucher(v: unknown): FlightVoucher {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const names = Array.isArray(o.passengerNames) ? o.passengerNames.filter((n): n is string => typeof n === 'string') : null;
  return {
    vendorVoucherId: strOrNull(o.voucherId),
    code: strOrNull(o.code),
    airline: strOrNull(o.airline),
    amount: displayMoneyOf(o.pricing),
    validFrom: strOrNull(o.validFrom),
    expiresAt: strOrNull(o.expiresAt),
    passengerNames: names,
    notes: strOrNull(o.notes),
  };
}

function vouchersOf(v: unknown): FlightVoucher[] {
  return Array.isArray(v) ? v.map(parseFlightVoucher) : [];
}

/** The quote object: data[0] — "always a single-item array". A 2xx without it is a contract deviation. */
export function flightCancellationQuoteObjectOf(json: unknown): Record<string, unknown> {
  const data = (json as { data?: unknown } | null)?.data;
  const first = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : undefined;
  if (!first || typeof first.confidence !== 'string') {
    throw new LiteApiFlightsApiError(
      '/flights/bookings/{id}/cancellations (quote)',
      200,
      null,
      'Cancellation quote 2xx missing data[0].confidence — contract deviation from the documented shape',
      JSON.stringify(json).slice(0, 500),
    );
  }
  return first;
}

/** The quote mapping — pure. */
export function parseFlightCancellationQuote(q: Record<string, unknown>): FlightCancellationQuote {
  const penalties = Array.isArray(q.penalties)
    ? q.penalties.map((p) => {
        const o = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
        return { type: strOrNull(o.type), description: strOrNull(o.description), amount: displayMoneyOf(o.pricing) };
      })
    : [];
  return {
    confidence: q.confidence as string,
    timestamp: strOrNull(q.timestamp),
    isRefundable: boolOrNull(q.isRefundable),
    isVoidable: boolOrNull(q.isVoidable),
    refund: displayMoneyOf(q.refund),
    penalty: displayMoneyOf(q.penalty),
    penalties,
    currency: strOrNull(q.currency),
    destination: strOrNull(q.destination),
    vouchers: vouchersOf(q.vouchers),
    pnr: strOrNull(q.pnr),
    expiresAt: strOrNull(q.expiresAt),
  };
}

export interface FlightCancellationQuoteAnswer {
  answer: LiteApiAnswer;
  object: Record<string, unknown>;
  quote: FlightCancellationQuote;
}

/** Read what cancelling a flight booking would do. Throws MissingLiteApiKeyError
 *  before any network call, LiteApiFlightsApiError on non-2xx (409 49006/49007 =
 *  cannot be quoted / already in progress — the caller names it), and a
 *  contract-deviation error on a 2xx without data[0]. Moves no money. Its cost is
 *  undocumented, so callers meter it (travelSearchQuota 'liteapiflightcancelquote'). */
export async function getFlightCancellationQuote(bookingId: string): Promise<FlightCancellationQuoteAnswer> {
  const base = flightsBaseUrl();
  const mode = getMode();
  const keyPrefix = (mode === 'production' ? process.env.LITEAPI_PRODUCTION_KEY : process.env.LITEAPI_SANDBOX_KEY)?.slice(0, 4) ?? 'none';
  console.log(`[LiteAPI flights] cancellation quote: mode=${mode} keyPrefix=${keyPrefix} host=${base}`);
  const answer = await getFlightsAnswer(base, `/flights/bookings/${encodeURIComponent(bookingId)}/cancellations`);
  const object = flightCancellationQuoteObjectOf(answer.json);
  return { answer, object, quote: parseFlightCancellationQuote(object) };
}

export interface FlightCancellationResult {
  bookingId: string;
  /** "CANCELLED" | "CANCELLED_WITH_CHARGES" on a 200; "CONFIRMED" on a 202 (awaiting the airline). Verbatim. */
  status: string | null;
  /** `cancellation_fee`, verbatim — null when not stated. */
  cancellationFee: number | null;
  /** `refund_amount`, verbatim — null when not stated. */
  refundAmount: number | null;
  currency: string | null;
  /** The vendor's refund destination word, verbatim — null when not stated. */
  destination: string | null;
  vouchers: FlightVoucher[];
}

/** The action's object: `data`, an object carrying bookingId and status. A 2xx without it is a contract deviation. */
export function flightCancellationObjectOf(json: unknown): Record<string, unknown> {
  const data = (json as { data?: unknown } | null)?.data as Record<string, unknown> | undefined;
  if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data.bookingId !== 'string' || typeof data.status !== 'string') {
    throw new LiteApiFlightsApiError(
      '/flights/bookings/{id}/cancellations',
      200,
      null,
      'Cancellation 2xx missing data.bookingId / data.status — contract deviation from the documented shape',
      JSON.stringify(json).slice(0, 500),
    );
  }
  return data;
}

/** The action mapping — pure, so the landing runs it over the ARRIVAL payload. */
export function parseFlightCancellationResult(d: Record<string, unknown>): FlightCancellationResult {
  return {
    bookingId: d.bookingId as string,
    status: strOrNull(d.status),
    cancellationFee: typeof d.cancellation_fee === 'number' ? d.cancellation_fee : null,
    refundAmount: typeof d.refund_amount === 'number' ? d.refund_amount : null,
    currency: strOrNull(d.currency),
    destination: strOrNull(d.destination),
    vouchers: vouchersOf(d.vouchers),
  };
}

export interface FlightCancellationAnswer {
  /** The answer as received — httpStatus 200 (final) or 202 (awaiting the airline). */
  answer: LiteApiAnswer;
  object: Record<string, unknown>;
  cancelled: FlightCancellationResult;
}

/** Cancel a flight booking. Throws MissingLiteApiKeyError before any network
 *  call, LiteApiFlightsApiError on non-2xx (a 409 is the vendor's refusal — nothing
 *  changed — and the caller names it), and a contract-deviation error on a 2xx
 *  without data.bookingId. No body: the reference documents none. The
 *  httpStatus on the answer is the outcome: 200 final, 202 accepted and awaiting
 *  the airline. */
export async function cancelFlightBooking(bookingId: string): Promise<FlightCancellationAnswer> {
  const base = flightsBaseUrl();
  const mode = getMode();
  const keyPrefix = (mode === 'production' ? process.env.LITEAPI_PRODUCTION_KEY : process.env.LITEAPI_SANDBOX_KEY)?.slice(0, 4) ?? 'none';
  console.log(`[LiteAPI flights] cancellation: mode=${mode} keyPrefix=${keyPrefix} host=${base}`);
  const answer = await postFlightsAnswer(base, `/flights/bookings/${encodeURIComponent(bookingId)}/cancellations`, undefined);
  const object = flightCancellationObjectOf(answer.json);
  return { answer, object, cancelled: parseFlightCancellationResult(object) };
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

// ─── Prebook (POST /flights/prebooks) ────────────────────────────────────────
// Creates the flight checkout session: reserves the offer and — because
// usePaymentSdk is HARDCODED true below — mints a Stripe PaymentIntent on
// Nuitee's account. The response's transactionId/secretKey/publishableKey are
// the browser-side card-collection context (FL-4 mounts Stripe Elements with
// them); /flights/bookings later completes with payment.method TRANSACTION_ID.
// Docs (FLIGHT-LITE-1 recon + the prebooks reference): response nests under
// data[0]; passengerType is an INTEGER (0=adult, 1=child, 2=infant).

export interface FlightPrebookContact {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  phoneCountryCode?: string;
  middleName?: string;
}

/** Documented integer enum: 0 = adult, 1 = child, 2 = infant. */
export type FlightPassengerType = 0 | 1 | 2;

export interface FlightPrebookPassenger {
  passengerType: FlightPassengerType;
  firstName: string;
  lastName: string;
  /** "YYYY-MM-DD" */
  birthday: string;
  middleName?: string;
  gender?: 'M' | 'F';
  nationality?: string;
  documentType?: string;
  documentNumber?: string;
  documentIssueCountry?: string;
  /** "YYYY-MM-DD" */
  documentExpiry?: string;
}

export interface FlightPrebookParams {
  offerId: string;
  contact: FlightPrebookContact;
  passengers: FlightPrebookPassenger[];
}

/** The card-collection context + price. publishableKey is nullable in the
 *  documented response; price/currency/paymentTypes are normalized to null
 *  when absent (absence is honest — never invented). */
export interface FlightPrebookResult {
  prebookId: string;
  transactionId: string;
  secretKey: string;
  publishableKey: string | null;
  price: number | null;
  currency: string | null;
  paymentTypes: string[] | null;
}

/** Create the flight checkout session. usePaymentSdk is NOT a parameter —
 *  it is hardcoded true: client-card User Payment is the RULED rail
 *  (PR-FL-3), so the account-side CREDIT path deliberately cannot be
 *  expressed through our code. Throws typed on non-2xx (42004/42017 →
 *  FlightOfferExpiredError), and throws a contract-deviation error on a 2xx
 *  missing prebookId/transactionId/secretKey — the checkout cannot proceed
 *  without them, so a quiet partial return would just fail later and darker. */
export async function prebookFlight(params: FlightPrebookParams): Promise<FlightPrebookResult> {
  const base = flightsBaseUrl();

  const mode = getMode();
  const keyPrefix = (mode === 'production' ? process.env.LITEAPI_PRODUCTION_KEY : process.env.LITEAPI_SANDBOX_KEY)?.slice(0, 4) ?? 'none';
  console.log(`[LiteAPI flights] prebook: mode=${mode} keyPrefix=${keyPrefix} host=${base} passengers=${params.passengers.length}`);

  const json = await postFlights<{ data?: unknown }>(base, '/flights/prebooks', {
    offerId: params.offerId,
    contact: params.contact,
    passengers: params.passengers,
    usePaymentSdk: true,
  });

  const first = Array.isArray(json?.data) ? (json.data[0] as Record<string, unknown> | undefined) : undefined;
  const prebookId = typeof first?.prebookId === 'string' ? first.prebookId : '';
  const transactionId = typeof first?.transactionId === 'string' ? first.transactionId : '';
  const secretKey = typeof first?.secretKey === 'string' ? first.secretKey : '';
  if (!prebookId || !transactionId || !secretKey) {
    throw new LiteApiFlightsApiError(
      '/flights/prebooks',
      200,
      null,
      'Prebook 2xx missing prebookId/transactionId/secretKey — contract deviation from the documented shape',
      JSON.stringify(json).slice(0, 500),
    );
  }
  return {
    prebookId,
    transactionId,
    secretKey,
    publishableKey: typeof first?.publishableKey === 'string' ? first.publishableKey : null,
    price: typeof first?.price === 'number' ? first.price : null,
    currency: typeof first?.currency === 'string' ? first.currency : null,
    paymentTypes: Array.isArray(first?.paymentTypes)
      ? (first.paymentTypes as unknown[]).filter((t): t is string => typeof t === 'string')
      : null,
  };
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
