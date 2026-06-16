const DUFFEL_API_URL = 'https://api.duffel.com';
const DUFFEL_TOKEN = process.env.DUFFEL_API_TOKEN;

function getHeaders(): Record<string, string> {
  if (!DUFFEL_TOKEN) {
    throw new Error('DUFFEL_API_TOKEN not configured');
  }
  return {
    'Authorization': `Bearer ${DUFFEL_TOKEN}`,
    'Duffel-Version': 'v2',
    'Content-Type': 'application/json',
  };
}

// Test vs live is determined ENTIRELY by which DUFFEL_API_TOKEN is set — Duffel
// test tokens are prefixed `duffel_test_`, live ones `duffel_live_`. This reads the
// mode from the prefix WITHOUT ever exposing the token, so routes can log/guard on
// it. STAY ON TEST for PR-Duffel-Pay-1 — switching to live is a separate, deliberate
// step (set the live token AND the explicit live-booking flag together).
export function duffelMode(): 'test' | 'live' | 'unknown' {
  if (!DUFFEL_TOKEN) return 'unknown';
  if (DUFFEL_TOKEN.startsWith('duffel_test_')) return 'test';
  if (DUFFEL_TOKEN.startsWith('duffel_live_')) return 'live';
  return 'unknown';
}

// ═══════════════════════════════════════════════════════════════════
// OFFER REQUESTS - Search for flights
// ═══════════════════════════════════════════════════════════════════
export interface SearchParams {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  passengers: number;
  cabinClass?: 'economy' | 'premium_economy' | 'business' | 'first';
}

export async function searchFlights(params: SearchParams) {
  const { origin, destination, departureDate, returnDate, passengers, cabinClass = 'economy' } = params;

  const slices = [
    { origin, destination, departure_date: departureDate },
  ];

  if (returnDate) {
    slices.push({ origin: destination, destination: origin, departure_date: returnDate });
  }

  const passengersArray = Array(passengers).fill({ type: 'adult' });

  const response = await fetch(`${DUFFEL_API_URL}/air/offer_requests`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      data: {
        slices,
        passengers: passengersArray,
        cabin_class: cabinClass,
        return_offers: true,
        max_connections: 1,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('Duffel search error:', error);
    throw new Error(error.errors?.[0]?.message || 'Flight search failed');
  }

  const data = await response.json();
  return data.data;
}

// ═══════════════════════════════════════════════════════════════════
// GET OFFERS
// ═══════════════════════════════════════════════════════════════════
export async function getOffers(offerRequestId: string) {
  const response = await fetch(
    `${DUFFEL_API_URL}/air/offers?offer_request_id=${offerRequestId}&sort=total_amount&limit=10`,
    { method: 'GET', headers: getHeaders() }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.message || 'Failed to get offers');
  }

  const data = await response.json();
  return data.data;
}

// ═══════════════════════════════════════════════════════════════════
// GET SINGLE OFFER
// ═══════════════════════════════════════════════════════════════════
export async function getOffer(offerId: string) {
  const response = await fetch(`${DUFFEL_API_URL}/air/offers/${offerId}`, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.message || 'Failed to get offer');
  }

  const data = await response.json();
  return data.data;
}

// ═══════════════════════════════════════════════════════════════════
// CREATE ORDER - Book the flight
// ═══════════════════════════════════════════════════════════════════
export interface IdentityDocument {
  type: 'passport';
  unique_identifier: string;       // passport number
  expires_on?: string;             // YYYY-MM-DD
  issuing_country_code?: string;   // ISO 3166-1 alpha-2
}

export interface PassengerDetails {
  id: string;
  title: 'mr' | 'ms' | 'mrs' | 'miss' | 'dr';
  given_name: string;
  family_name: string;
  born_on: string;
  email: string;
  phone_number: string;
  gender: 'm' | 'f';
  // Optional — required by Duffel for INTERNATIONAL itineraries. Passed through only
  // when collected (domestic test offers don't need it).
  identity_documents?: IdentityDocument[];
}

export interface PaymentDetails {
  type: 'balance';
  amount: string;
  currency: string;
}

export async function createOrder(
  offerId: string,
  passengers: PassengerDetails[],
  payment?: PaymentDetails,
  idempotencyKey?: string,
) {
  const body: any = {
    data: {
      type: 'instant',   // UNCHANGED — a Duffel Payments order finalizes as instant + balance
      selected_offers: [offerId],
      passengers,
    },
  };

  if (payment) {
    body.data.payments = [payment];
  }

  const headers = getHeaders();
  // Idempotency: an identical retry returns the SAME order instead of double-booking
  // (Duffel dedupes by this header). The order step is also naturally single-use per
  // offer — re-ordering a used offer fails loud, which the route maps to a clear error.
  if (idempotencyKey) headers['Idempotency-Key'] = `order-${idempotencyKey}`;

  const response = await fetch(`${DUFFEL_API_URL}/air/orders`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    // PCI: log the Duffel error CODE only — never the full body (it can echo the
    // submitted passenger fields) and never card / payment-secret / token data.
    console.error('Duffel order error:', error?.errors?.[0]?.code || 'unknown');
    throw new Error(error.errors?.[0]?.message || 'Booking failed');
  }

  const data = await response.json();
  return data.data;
}

// ═══════════════════════════════════════════════════════════════════
// DUFFEL PAYMENTS — Payment Intents
// Collect the customer's card (via Duffel's PCI component) into our Duffel balance;
// the order is then paid FROM that balance. The card NEVER touches our server — the
// frontend Card component (PR-2) uses the per-intent `client_token` returned here.
// Flow: createPaymentIntent → (component collects card) → confirmPaymentIntent →
// createOrder(instant, balance). This PR wires the server pieces; PR-2 adds the UI.
// ═══════════════════════════════════════════════════════════════════
export interface PaymentIntent {
  id: string;
  client_token: string;   // for the frontend Card component (PR-2) — treat as a secret
  status: string;         // 'requires_action' → 'succeeded' once confirmed
  amount: string;
  currency: string;
}

// MARKUP CONFIG POINT. Duffel Payments lets the intent amount EXCEED the offer total;
// the delta stays in our balance after the order is paid (our margin). Intentionally
// NO markup yet — this returns the base amount unchanged. Pricing is a separate,
// deliberate decision finance owns; when set, compute it from config/env HERE and
// mind currency minor-unit rounding. Do NOT hardcode a number.
export function applyMarkup(baseAmount: string): string {
  return baseAmount;
}

export async function createPaymentIntent(
  amount: string,
  currency: string,
  idempotencyKey?: string,
): Promise<PaymentIntent> {
  const headers = getHeaders();
  // Idempotency: a double-submit reuses the same intent rather than charging twice.
  if (idempotencyKey) headers['Idempotency-Key'] = `intent-${idempotencyKey}`;

  const response = await fetch(`${DUFFEL_API_URL}/payments/payment_intents`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ data: { amount, currency } }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    // PCI-safe: error CODE only — never the client_token / payment secret or full body.
    console.error('Duffel payment intent error:', error?.errors?.[0]?.code || 'unknown');
    throw new Error(error.errors?.[0]?.message || 'Payment setup failed');
  }

  const data = await response.json();
  return data.data;
}

export async function confirmPaymentIntent(intentId: string): Promise<PaymentIntent> {
  const response = await fetch(
    `${DUFFEL_API_URL}/payments/payment_intents/${intentId}/actions/confirm`,
    { method: 'POST', headers: getHeaders() },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error('Duffel payment confirm error:', error?.errors?.[0]?.code || 'unknown');
    throw new Error(error.errors?.[0]?.message || 'Payment confirmation failed');
  }

  const data = await response.json();
  return data.data;
}

// Read a Payment Intent's status. Used by the book route to VERIFY (server-side) that
// the frontend Card component (PR-2) actually confirmed the payment before an order is
// created — we never trust the client's word that money moved.
export async function getPaymentIntent(intentId: string): Promise<PaymentIntent> {
  const response = await fetch(
    `${DUFFEL_API_URL}/payments/payment_intents/${intentId}`,
    { method: 'GET', headers: getHeaders() },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error('Duffel payment intent fetch error:', error?.errors?.[0]?.code || 'unknown');
    throw new Error(error.errors?.[0]?.message || 'Payment lookup failed');
  }

  const data = await response.json();
  return data.data;
}

// ═══════════════════════════════════════════════════════════════════
// HELPERS - Parse Duffel data for UI
// ═══════════════════════════════════════════════════════════════════
export function parseOffer(offer: any) {
  const slices = offer.slices || [];
  const outbound = slices[0];
  const returnFlight = slices[1];

  const parseSlice = (slice: any) => {
    if (!slice) return null;

    const segments = slice.segments || [];
    const firstSeg = segments[0];
    const lastSeg = segments[segments.length - 1];

    const carriers = [...new Set(segments.map((s: any) => s.marketing_carrier?.name || s.operating_carrier?.name))];

    const duration = slice.duration || '';
    const durationMatch = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
    const hours = parseInt(durationMatch?.[1] || '0');
    const mins = parseInt(durationMatch?.[2] || '0');
    const durationFormatted = `${hours}h ${mins}m`;

    return {
      departure: {
        airport: firstSeg?.origin?.iata_code || '',
        airportName: firstSeg?.origin?.name || '',
        localTime: firstSeg?.departing_at?.substring(11, 16) || '',
        date: firstSeg?.departing_at?.substring(0, 10) || '',
      },
      arrival: {
        airport: lastSeg?.destination?.iata_code || '',
        airportName: lastSeg?.destination?.name || '',
        localTime: lastSeg?.arriving_at?.substring(11, 16) || '',
        date: lastSeg?.arriving_at?.substring(0, 10) || '',
      },
      duration: durationFormatted,
      durationMinutes: hours * 60 + mins,
      stops: segments.length - 1,
      carriers,
      segments: segments.map((seg: any) => ({
        carrier: seg.marketing_carrier?.name || seg.operating_carrier?.name || '',
        carrierCode: seg.marketing_carrier?.iata_code || '',
        flightNumber: seg.marketing_carrier_flight_number || '',
        aircraft: seg.aircraft?.name || '',
        departure: {
          airport: seg.origin?.iata_code || '',
          localTime: seg.departing_at?.substring(11, 16) || '',
        },
        arrival: {
          airport: seg.destination?.iata_code || '',
          localTime: seg.arriving_at?.substring(11, 16) || '',
        },
      })),
    };
  };

  return {
    id: offer.id,
    price: parseFloat(offer.total_amount),
    currency: offer.total_currency,
    baseAmount: parseFloat(offer.base_amount),
    taxAmount: parseFloat(offer.tax_amount),
    passengers: offer.passengers,
    outbound: parseSlice(outbound),
    return: parseSlice(returnFlight),
    expiresAt: offer.expires_at,
    owner: offer.owner?.name || '',
    conditions: {
      refundable: offer.conditions?.refund_before_departure?.allowed || false,
      changeable: offer.conditions?.change_before_departure?.allowed || false,
    },
  };
}
