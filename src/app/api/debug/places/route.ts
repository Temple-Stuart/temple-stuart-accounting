import { NextRequest, NextResponse } from 'next/server';
import { searchPlaces, filterPlaces, CATEGORY_SEARCHES } from '@/lib/placesSearch';

export async function GET(request: NextRequest) {
  const city = request.nextUrl.searchParams.get('city') || 'Canggu';
  const country = request.nextUrl.searchParams.get('country') || 'Indonesia';
  
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  
  // Step 1: Check API key
  if (!apiKey) {
    return NextResponse.json({ error: 'No GOOGLE_PLACES_API_KEY', step: 1 });
  }
  
  // Step 2: Test geocoding
  const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(city + ', ' + country)}&key=${apiKey}`;
  const geoRes = await fetch(geoUrl);
  const geoData = await geoRes.json();
  
  if (geoData.status !== 'OK') {
    return NextResponse.json({ 
      error: 'Geocoding failed', 
      step: 2,
      status: geoData.status,
      errorMessage: geoData.error_message
    });
  }
  
  const location = geoData.results[0].geometry.location;
  
  // Step 3: Test raw Google Places search
  const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent('cafe brunch coffee in ' + city + ' ' + country)}&location=${location.lat},${location.lng}&radius=20000&key=${apiKey}`;
  const searchRes = await fetch(searchUrl);
  const searchData = await searchRes.json();
  
  if (searchData.status !== 'OK') {
    return NextResponse.json({
      error: 'Places search failed',
      step: 3,
      status: searchData.status,
      errorMessage: searchData.error_message
    });
  }
  
  // Step 4: Test our searchPlaces function
  const config = CATEGORY_SEARCHES['brunchCoffee'];
  const places = await searchPlaces(config.query, city, country, 20);
  
  // Step 5: Test filtering
  const { verified, unverified } = filterPlaces(places, {
    ...config.defaultFilters,
    minRating: 4.0,
    minReviews: 50,
    maxPriceLevel: 2
  });
  
  return NextResponse.json({
    success: true,
    steps: {
      1: { apiKeyPresent: true, keyPrefix: apiKey.substring(0, 10) + '...' },
      2: { geocoded: location },
      3: { rawGoogleResults: searchData.results?.length || 0, status: searchData.status },
      4: { searchPlacesResults: places.length, sample: places.slice(0, 3).map(p => ({ name: p.name, rating: p.rating, reviews: p.reviewCount, price: p.priceLevel })) },
      5: { verified: verified.length, unverified: unverified.length }
    }
  });
}
