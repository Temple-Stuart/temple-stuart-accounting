import { NextRequest, NextResponse } from 'next/server';
import { searchTransfers } from '@/lib/amadeus';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

// Map resort names to their nearest town/city for Amadeus API
const RESORT_CITY_MAP: Record<string, string> = {
  'Mammoth Mountain': 'Mammoth Lakes',
  'Heavenly': 'South Lake Tahoe',
  'Northstar': 'Truckee',
  'Palisades Tahoe': 'Olympic Valley',
  'Sugar Bowl': 'Norden',
  'June Mountain': 'June Lake',
  'Big Bear Mountain Resort': 'Big Bear Lake',
  'Jackson Hole': 'Teton Village',
  'Big Sky': 'Big Sky',
  'Whitefish Mountain Resort': 'Whitefish',
  'Steamboat': 'Steamboat Springs',
  'Winter Park': 'Winter Park',
  'Breckenridge': 'Breckenridge',
  'Keystone': 'Keystone',
  'Copper Mountain': 'Copper Mountain',
  'Arapahoe Basin': 'Keystone',
  'Crested Butte': 'Crested Butte',
  'Aspen Snowmass': 'Aspen',
  'Park City': 'Park City',
  'Deer Valley': 'Park City',
  'Alta': 'Alta',
  'Brighton': 'Brighton',
  'Solitude': 'Solitude',
  'Taos Ski Valley': 'Taos Ski Valley',
  'Stowe': 'Stowe',
  'Killington': 'Killington',
  'Sugarbush': 'Warren',
  'Stratton': 'Stratton Mountain',
  'Loon Mountain': 'Lincoln',
  'Sunday River': 'Newry',
  'Sugarloaf': 'Carrabassett Valley',
  'Whistler Blackcomb': 'Whistler',
  'Lake Louise': 'Lake Louise',
  'Revelstoke': 'Revelstoke',
  'Fernie': 'Fernie',
  'Tremblant': 'Mont-Tremblant',
  'Chamonix': 'Chamonix-Mont-Blanc',
  'Zermatt': 'Zermatt',
  'St. Moritz': 'St. Moritz',
  'Kitzbühel': 'Kitzbühel',
  'Niseko United': 'Kutchan',
  'Hakuba Valley': 'Hakuba',
};

export async function GET(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    
    const resortId = searchParams.get('resortId');
    const airportCode = searchParams.get('airportCode');
    const cityName = searchParams.get('cityName') || '';
    const countryCode = searchParams.get('countryCode') || 'US';
    const zipCode = searchParams.get('zipCode') || '';
    const dateTime = searchParams.get('dateTime');
    const passengers = parseInt(searchParams.get('passengers') || '4');
    const transferType = searchParams.get('transferType') || 'PRIVATE';
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');

    if (!dateTime) {
      return NextResponse.json(
        { error: 'Missing required param: dateTime' },
        { status: 400 }
      );
    }

    let searchAirportCode = airportCode;
    let resortName = '';
    let destinationCity = cityName;
    let endAddressLine = cityName;
    let endZipCode = zipCode;
    let endCountryCode = countryCode;
    let geoCode: { latitude: number; longitude: number } | undefined;
    
    // Use provided lat/lng if available
    if (lat && lng) {
      geoCode = {
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
      };
    }
    
    if (resortId && resortId !== 'test') {
      const resort = await prisma.ikon_resorts.findUnique({
        where: { id: resortId }
      });
      if (resort) {
        searchAirportCode = resort.nearestAirport;
        resortName = resort.name;
        
        // Use city lookup map, fallback to resort name
        destinationCity = RESORT_CITY_MAP[resort.name] || resort.name;
        
        // Use city as address line for better API results
        endAddressLine = destinationCity;
        
        // Map country codes
        const countryMap: Record<string, string> = {
          'USA': 'US',
          'Canada': 'CA',
          'Japan': 'JP',
          'Australia': 'AU',
          'New Zealand': 'NZ',
          'France': 'FR',
          'Switzerland': 'CH',
          'Austria': 'AT',
          'Italy': 'IT',
          'Andorra': 'AD',
        };
        endCountryCode = countryMap[resort.country] || resort.country || countryCode;
        
        // Use resort coordinates if available and not overridden
        if (!geoCode && resort.latitude && resort.longitude) {
          geoCode = {
            latitude: parseFloat(resort.latitude.toString()),
            longitude: parseFloat(resort.longitude.toString()),
          };
        }
      }
    }

    if (!searchAirportCode) {
      return NextResponse.json(
        { error: 'Missing airportCode or resortId' },
        { status: 400 }
      );
    }

    // Amadeus requires geocodes for address-based searches
    if (!geoCode) {
      return NextResponse.json({
        transfers: [],
        query: {
          airportCode: searchAirportCode,
          resortName,
          endAddress: endAddressLine,
          cityName: destinationCity,
          dateTime,
          passengers,
          transferType,
        },
        debug: {
          rawCount: 0,
          note: 'Geocodes required. Resort has no lat/lng data.',
        }
      });
    }

    console.log(`Searching transfers: ${searchAirportCode} → ${endAddressLine} (${geoCode.latitude},${geoCode.longitude}), ${passengers} pax, type: ${transferType}`);

    const transfers = await searchTransfers({
      startLocationCode: searchAirportCode,
      endAddressLine: endAddressLine,
      endCityName: destinationCity,
      endCountryCode: endCountryCode,
      endGeoCode: geoCode,
      transferType: transferType as any,
      startDateTime: dateTime,
      passengers,
    });

    console.log(`Found ${transfers.length} transfer offers`);

    const simplified = transfers.map((t: any) => ({
      id: t.id,
      type: t.transferType,
      vehicle: {
        code: t.vehicle?.code,
        category: t.vehicle?.category,
        description: t.vehicle?.description,
        seats: t.vehicle?.seats?.[0]?.count || 0,
        bags: t.vehicle?.baggages?.[0]?.count || 0,
        imageURL: t.vehicle?.imageURL,
      },
      provider: {
        code: t.serviceProvider?.code,
        name: t.serviceProvider?.name,
      },
      price: parseFloat(t.quotation?.monetaryAmount || '0'),
      currency: t.quotation?.currencyCode || 'USD',
      distance: t.distance ? `${t.distance.value} ${t.distance.unit}` : null,
      pickupTime: t.start?.dateTime,
      dropoffTime: t.end?.dateTime,
    }));

    simplified.sort((a: any, b: any) => a.price - b.price);

    return NextResponse.json({
      transfers: simplified,
      query: {
        airportCode: searchAirportCode,
        resortName,
        endAddress: endAddressLine,
        cityName: destinationCity,
        geoCode,
        dateTime,
        passengers,
        transferType,
      },
      debug: {
        rawCount: transfers.length,
        note: transfers.length === 0 ? 'No transfers found for this route. Try a major airport or different transfer type.' : null,
      }
    });
  } catch (error) {
    console.error('Transfer search error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Transfer search failed', 
        transfers: [],
        debug: { errorDetails: error instanceof Error ? error.message : 'Unknown error' }
      },
      { status: 500 }
    );
  }
}
