const DUFFEL_API_URL = 'https://api.duffel.com';
const DUFFEL_TOKEN = process.env.DUFFEL_API_TOKEN;

interface DuffelHeaders {
  'Authorization': string;
  'Duffel-Version': string;
  'Content-Type': string;
}

function getHeaders(): DuffelHeaders {
  if (!DUFFEL_TOKEN) {
    throw new Error('DUFFEL_API_TOKEN not configured');
  }
  return {
    'Authorization': `Bearer ${DUFFEL_TOKEN}`,
    'Duffel-Version': 'v2',
    'Content-Type': 'application/json',
  };
}

// ═══════════════════════════════════════════════════════════════════
// OFFER REQUESTS - Search for flights
// ═══════════════════════════════════════════════════════════════════
export interface SearchParams {
  origin: string;           // IATA code (LAX)
  destination: string;      // IATA code (DEN)
  departureDate: string;    // YYYY-MM-DD
  returnDate?: string;      // YYYY-MM-DD (optional for one-way)
  passengers: number;       // Number of adult passengers
  cabinClass?: 'economy' | 'premium_economy' | 'business' | 'first';
}

export async function searchFlights(params: SearchParams) {
  const { origin, destination, departureDate, returnDate, passengers, cabinClass = 'economy' } = params;

  // Build slices (legs of the journey)
  const slices = [
    {
      origin,
      destination,
      departure_date: departureDate,
    },
  ];

  // Add return slice if round-trip
  if (returnDate) {
    slices.push({
      origin: destination,
      destination: origin,
      departure_date: returnDate,
    });
  }

  // Build passengers array
  const passengersArray = Array(passengers).fill({ type: 'adult' });

  // Create offer request
  const response = await fetch(`${DUFFEL_API_URL}/air/offer_requests`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      data: {
        slices,
        passengers: passengersArray,
        cabin_class: cabinClass,
        return_offers: true, // Return offers immediately (sync)
        max_connections: 1,  // Limit to 1 stop max
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
// GET OFFERS - Retrieve offers from an offer request
// ═══════════════════════════════════════════════════════════════════
export async function getOffers(offerRequestId: string) {
  const response = await fetch(
    `${DUFFEL_API_URL}/air/offers?offer_request_id=${offerRequestId}&sort=total_amount&limit=10`,
    {
      method: 'GET',
      headers: getHeaders(),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.message || 'Failed to get offers');
  }

  const data = await response.json();
  return data.data;
}

// ═══════════════════════════════════════════════════════════════════
// GET SINGLE OFFER - Get details for a specific offer
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
export interface PassengerDetails {
  id: string;              // From the offer
  title: 'mr' | 'ms' | 'mrs' | 'miss' | 'dr';
  given_name: string;
  family_name: string;
  born_on: string;         // YYYY-MM-DD
  email: string;
  phone_number: string;    // E.164 format (+1234567890)
  gender: 'm' | 'f';
}

export interface PaymentDetails {
  type: 'balance';         // Use Duffel balance (test mode)
  amount: string;
  currency: string;
}

export async function createOrder(
  offerId: string,
  passengers: PassengerDetails[],
  payment?: PaymentDetails
) {
  const body: any = {
    data: {
      type: 'instant',
      selected_offers: [offerId],
      passengers,
    },
  };

  // In test mode, we can use balance payment
  if (payment) {
    body.data.payments = [payment];
  }

  const response = await fetch(`${DUFFEL_API_URL}/air/orders`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('Duffel booking error:', error);
    throw new Error(error.errors?.[0]?.message || 'Booking failed');
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
    
    // Get unique carriers
    const carriers = [...new Set(segments.map((s: any) => s.marketing_carrier?.name || s.operating_carrier?.name))];
    
    // Parse duration (ISO 8601 duration to readable)
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
