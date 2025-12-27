// Amadeus API Client
// Docs: https://developers.amadeus.com/self-service

interface AmadeusToken {
  access_token: string;
  expires_at: number;
}

let cachedToken: AmadeusToken | null = null;

async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && cachedToken.expires_at > Date.now() + 60000) {
    return cachedToken.access_token;
  }

  const apiKey = process.env.AMADEUS_API_KEY;
  const apiSecret = process.env.AMADEUS_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error('Amadeus API credentials not configured');
  }

  const response = await fetch('https://test.api.amadeus.com/v1/security/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: apiKey,
      client_secret: apiSecret,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Amadeus auth failed: ${error}`);
  }

  const data = await response.json();
  
  cachedToken = {
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in * 1000),
  };

  return cachedToken.access_token;
}

// Flight Offers Search
export interface FlightSearchParams {
  originLocationCode: string;      // e.g., 'LAX'
  destinationLocationCode: string; // e.g., 'NRT'
  departureDate: string;           // e.g., '2026-03-01'
  returnDate?: string;             // e.g., '2026-03-08'
  adults: number;
  travelClass?: 'ECONOMY' | 'PREMIUM_ECONOMY' | 'BUSINESS' | 'FIRST';
  maxPrice?: number;
  max?: number;                    // Max results (default 5)
}

export interface FlightOffer {
  id: string;
  price: {
    total: string;
    currency: string;
  };
  itineraries: {
    duration: string;
    segments: {
      departure: { iataCode: string; at: string };
      arrival: { iataCode: string; at: string };
      carrierCode: string;
      number: string;
    }[];
  }[];
}

export async function searchFlights(params: FlightSearchParams): Promise<FlightOffer[]> {
  const token = await getAccessToken();

  const queryParams = new URLSearchParams({
    originLocationCode: params.originLocationCode,
    destinationLocationCode: params.destinationLocationCode,
    departureDate: params.departureDate,
    adults: params.adults.toString(),
    max: (params.max || 5).toString(),
    currencyCode: 'USD',
  });

  if (params.returnDate) {
    queryParams.set('returnDate', params.returnDate);
  }
  if (params.travelClass) {
    queryParams.set('travelClass', params.travelClass);
  }
  if (params.maxPrice) {
    queryParams.set('maxPrice', params.maxPrice.toString());
  }

  const response = await fetch(
    `https://test.api.amadeus.com/v2/shopping/flight-offers?${queryParams}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error('Amadeus flight search error:', error);
    throw new Error(`Flight search failed: ${response.status}`);
  }

  const data = await response.json();
  return data.data || [];
}

// Hotel Search
export interface HotelSearchParams {
  cityCode: string;           // e.g., 'NYC' or use latitude/longitude
  latitude?: number;
  longitude?: number;
  radius?: number;            // Search radius in KM
  radiusUnit?: 'KM' | 'MILE';
  checkInDate: string;        // e.g., '2026-03-01'
  checkOutDate: string;       // e.g., '2026-03-08'
  adults: number;
  roomQuantity?: number;
  priceRange?: string;        // e.g., '100-300'
  currency?: string;
  max?: number;
}

export interface HotelOffer {
  hotel: {
    hotelId: string;
    name: string;
    rating?: string;
    address?: { cityName: string };
  };
  offers: {
    id: string;
    price: {
      total: string;
      currency: string;
    };
    room: {
      description?: { text: string };
    };
  }[];
}

export async function searchHotels(params: HotelSearchParams): Promise<HotelOffer[]> {
  const token = await getAccessToken();

  // Step 1: Search for hotels by city/location
  const hotelListParams = new URLSearchParams({
    cityCode: params.cityCode,
  });

  if (params.radius) {
    hotelListParams.set('radius', params.radius.toString());
    hotelListParams.set('radiusUnit', params.radiusUnit || 'KM');
  }

  const hotelListResponse = await fetch(
    `https://test.api.amadeus.com/v1/reference-data/locations/hotels/by-city?${hotelListParams}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!hotelListResponse.ok) {
    console.error('Hotel list search failed:', await hotelListResponse.text());
    return [];
  }

  const hotelListData = await hotelListResponse.json();
  const hotelIds = (hotelListData.data || []).slice(0, 20).map((h: any) => h.hotelId);

  if (hotelIds.length === 0) return [];

  // Step 2: Get offers for those hotels
  const offerParams = new URLSearchParams({
    hotelIds: hotelIds.join(','),
    checkInDate: params.checkInDate,
    checkOutDate: params.checkOutDate,
    adults: params.adults.toString(),
    roomQuantity: (params.roomQuantity || 1).toString(),
    currency: params.currency || 'USD',
  });

  if (params.priceRange) {
    offerParams.set('priceRange', params.priceRange);
  }

  const offersResponse = await fetch(
    `https://test.api.amadeus.com/v3/shopping/hotel-offers?${offerParams}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!offersResponse.ok) {
    console.error('Hotel offers search failed:', await offersResponse.text());
    return [];
  }

  const offersData = await offersResponse.json();
  return offersData.data || [];
}

// Airport Search (for autocomplete)
export interface AirportResult {
  iataCode: string;
  name: string;
  cityName: string;
  countryCode: string;
}

export async function searchAirports(keyword: string): Promise<AirportResult[]> {
  const token = await getAccessToken();

  const response = await fetch(
    `https://test.api.amadeus.com/v1/reference-data/locations?subType=AIRPORT&keyword=${encodeURIComponent(keyword)}&page[limit]=10`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!response.ok) {
    console.error('Airport search failed:', await response.text());
    return [];
  }

  const data = await response.json();
  return (data.data || []).map((loc: any) => ({
    iataCode: loc.iataCode,
    name: loc.name,
    cityName: loc.address?.cityName || '',
    countryCode: loc.address?.countryCode || '',
  }));
}

// Flight Price Analysis (to get typical prices for a route)
export interface FlightPriceAnalysis {
  origin: string;
  destination: string;
  departureDate: string;
  priceMetrics: {
    amount: string;
    quartileRanking: 'MINIMUM' | 'FIRST' | 'MEDIUM' | 'THIRD' | 'MAXIMUM';
  }[];
}

export async function getFlightPriceAnalysis(
  origin: string,
  destination: string,
  departureDate: string
): Promise<FlightPriceAnalysis | null> {
  const token = await getAccessToken();

  const response = await fetch(
    `https://test.api.amadeus.com/v1/analytics/itinerary-price-metrics?originIataCode=${origin}&destinationIataCode=${destination}&departureDate=${departureDate}&currencyCode=USD`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!response.ok) {
    console.error('Price analysis failed:', await response.text());
    return null;
  }

  const data = await response.json();
  return data.data?.[0] || null;
}

// Transfer Search (Airport transfers, private cars, taxis)
export interface TransferSearchParams {
  startLocationCode: string;      // IATA airport code (e.g., 'SLC')
  endAddressLine?: string;        // Destination address
  endCityName: string;            // Destination city
  endCountryCode: string;         // ISO country code (e.g., 'US')
  endGeoCode?: { latitude: number; longitude: number };
  transferType: 'PRIVATE' | 'SHARED' | 'TAXI' | 'HOURLY' | 'AIRPORT_EXPRESS' | 'AIRPORT_BUS';
  startDateTime: string;          // ISO datetime (e.g., '2026-03-01T10:00:00')
  passengers: number;
  stopOvers?: { addressLine: string; duration: string }[];
}

export interface TransferOffer {
  id: string;
  transferType: string;
  start: {
    dateTime: string;
    locationCode: string;
  };
  end: {
    address: { line: string; cityName: string };
    dateTime?: string;
  };
  vehicle: {
    code: string;
    category: string;
    description: string;
    seats: { count: number };
    baggages: { count: number };
    imageURL?: string;
  };
  serviceProvider: {
    code: string;
    name: string;
  };
  quotation: {
    monetaryAmount: string;
    currencyCode: string;
  };
  converted?: {
    monetaryAmount: string;
    currencyCode: string;
  };
  distance?: {
    value: number;
    unit: string;
  };
}

export async function searchTransfers(params: TransferSearchParams): Promise<TransferOffer[]> {
  const token = await getAccessToken();

  const body: any = {
    startLocationCode: params.startLocationCode,
    transferType: params.transferType,
    startDateTime: params.startDateTime,
    passengers: params.passengers,
  };

  // Address fields - all required when using address-based destination
  if (params.endAddressLine) {
    body.endAddressLine = params.endAddressLine;
  }
  if (params.endCityName) {
    body.endCityName = params.endCityName;
  }
  if (params.endCountryCode) {
    body.endCountryCode = params.endCountryCode;
  }

  // CRITICAL: Geocode must be a comma-separated STRING "lat,lon" - NOT an object!
  if (params.endGeoCode) {
    body.endGeoCode = `${params.endGeoCode.latitude},${params.endGeoCode.longitude}`;
  }

  console.log('Transfer search request body:', JSON.stringify(body, null, 2));

  const response = await fetch(
    'https://test.api.amadeus.com/v1/shopping/transfer-offers',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  const responseText = await response.text();
  console.log('Transfer search response status:', response.status);
  console.log('Transfer search response body:', responseText.substring(0, 1000));

  if (!response.ok) {
    console.error('Amadeus transfer search error:', responseText);
    throw new Error(`Transfer search failed: ${response.status}`);
  }

  const data = JSON.parse(responseText);
  
  // Check if response contains errors (Amadeus returns 200 with errors in body)
  if (data.errors && data.errors.length > 0) {
    console.error('Amadeus returned errors:', data.errors);
    return [];
  }
  
  return data.data || [];
}
