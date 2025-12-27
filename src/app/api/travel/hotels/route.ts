import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Amadeus Hotel Search
async function getAccessToken(): Promise<string> {
  const apiKey = process.env.AMADEUS_API_KEY;
  const apiSecret = process.env.AMADEUS_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error('Amadeus API credentials not configured');
  }

  const response = await fetch('https://test.api.amadeus.com/v1/security/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: apiKey,
      client_secret: apiSecret,
    }),
  });

  if (!response.ok) {
    throw new Error('Amadeus auth failed');
  }

  const data = await response.json();
  return data.access_token;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    const resortId = searchParams.get('resortId');
    const cityCode = searchParams.get('cityCode');
    const checkInDate = searchParams.get('checkInDate');
    const checkOutDate = searchParams.get('checkOutDate');
    const adults = parseInt(searchParams.get('adults') || '4');
    const rooms = parseInt(searchParams.get('rooms') || '2');
    const radiusMiles = parseInt(searchParams.get('radius') || '30'); // Increased to 30

    if (!checkInDate || !checkOutDate) {
      return NextResponse.json(
        { error: 'Missing required params: checkInDate, checkOutDate' },
        { status: 400 }
      );
    }

    // If resortId provided, get the airport code from resort
    let searchCityCode = cityCode;
    let resortName = '';
    
    if (resortId) {
      const resort = await prisma.ikon_resorts.findUnique({
        where: { id: resortId }
      });
      if (resort) {
        searchCityCode = resort.nearestAirport;
        resortName = resort.name;
      }
    }

    if (!searchCityCode) {
      return NextResponse.json(
        { error: 'Missing cityCode or resortId' },
        { status: 400 }
      );
    }

    const token = await getAccessToken();

    // Step 1: Search for hotels by city code
    const hotelListParams = new URLSearchParams({
      cityCode: searchCityCode,
      radius: String(radiusMiles),
      radiusUnit: 'MILE',
    });

    console.log(`Searching hotels near ${searchCityCode} (${resortName}), radius: ${radiusMiles}mi`);

    const hotelListResponse = await fetch(
      `https://test.api.amadeus.com/v1/reference-data/locations/hotels/by-city?${hotelListParams}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!hotelListResponse.ok) {
      const errText = await hotelListResponse.text();
      console.error('Hotel list search failed:', errText);
      return NextResponse.json({ 
        hotels: [], 
        error: 'Hotel search failed',
        debug: { step: 1, cityCode: searchCityCode, response: errText }
      });
    }

    const hotelListData = await hotelListResponse.json();
    const allHotelIds = (hotelListData.data || []).map((h: any) => h.hotelId);
    
    console.log(`Found ${allHotelIds.length} hotels in area`);

    if (allHotelIds.length === 0) {
      return NextResponse.json({ 
        hotels: [], 
        message: 'No hotels found in area',
        debug: { cityCode: searchCityCode, radius: radiusMiles }
      });
    }

    // Query up to 50 hotels (API limit may vary)
    const hotelIds = allHotelIds.slice(0, 50);

    // Step 2: Get offers for those hotels
    const offerParams = new URLSearchParams({
      hotelIds: hotelIds.join(','),
      checkInDate,
      checkOutDate,
      adults: String(adults),
      roomQuantity: String(rooms),
      currency: 'USD',
    });

    console.log(`Fetching offers for ${hotelIds.length} hotels, dates: ${checkInDate} to ${checkOutDate}`);

    const offersResponse = await fetch(
      `https://test.api.amadeus.com/v3/shopping/hotel-offers?${offerParams}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!offersResponse.ok) {
      const errText = await offersResponse.text();
      console.error('Hotel offers search failed:', errText);
      return NextResponse.json({ 
        hotels: [], 
        error: 'Hotel offers search failed',
        debug: { step: 2, hotelCount: hotelIds.length, response: errText }
      });
    }

    const offersData = await offersResponse.json();
    const hotels = offersData.data || [];

    console.log(`Got ${hotels.length} hotels with availability`);

    // Calculate nights
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

    // Simplify and enrich response
    const simplified = hotels
      .filter((h: any) => h.offers && h.offers.length > 0)
      .map((h: any) => {
        const offer = h.offers[0];
        const totalPrice = parseFloat(offer.price.total);
        
        return {
          hotelId: h.hotel.hotelId,
          name: h.hotel.name,
          rating: h.hotel.rating,
          cityName: h.hotel.address?.cityName || '',
          totalPrice,
          currency: offer.price.currency,
          perNight: totalPrice / nights,
          perPersonPerNight: totalPrice / nights / adults,
          nights,
          roomDescription: offer.room?.description?.text || '',
          bedType: offer.room?.typeEstimated?.bedType || '',
          beds: offer.room?.typeEstimated?.beds || 0,
        };
      })
      // Sort by total price (cheapest first)
      .sort((a: any, b: any) => a.totalPrice - b.totalPrice)
      // Return top 15
      .slice(0, 15);

    return NextResponse.json({ 
      hotels: simplified,
      query: {
        cityCode: searchCityCode,
        resortName,
        checkInDate,
        checkOutDate,
        nights,
        adults,
        rooms,
        radiusMiles,
        hotelsFound: allHotelIds.length,
        hotelsWithOffers: hotels.length,
      }
    });
  } catch (error) {
    console.error('Hotel search error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Hotel search failed', hotels: [] },
      { status: 500 }
    );
  }
}
