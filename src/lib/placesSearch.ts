// Google Places Search → Pre-filter → GPT Rank

interface PlaceResult {
  name: string;
  address: string;
  placeId: string;
  rating: number;
  reviewCount: number;
  priceLevel?: number;
  website?: string;
  isOpen: boolean;
  types: string[];
  photos?: string[];
  lat: number;
  lng: number;
}

interface FilterCriteria {
  minRating?: number;
  minReviews?: number;
  maxPriceLevel?: number;
  mustBeOpen?: boolean;
}

// Search Google Places for a category
export async function searchPlaces(
  query: string,
  city: string,
  country: string,
  maxResults: number = 20
): Promise<PlaceResult[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.error('[PLACES] No API key');
    return [];
  }

  // First, get location coordinates for the city
  const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(city + ', ' + country)}&key=${apiKey}`;
  
  try {
    const geoRes = await fetch(geoUrl);
    const geoData = await geoRes.json();
    
    if (!geoData.results?.[0]?.geometry?.location) {
      console.error('[PLACES] Could not geocode city');
      return [];
    }
    
    const { lat, lng } = geoData.results[0].geometry.location;
    
    // Text search for the category
    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query + ' in ' + city)}&location=${lat},${lng}&radius=15000&key=${apiKey}`;
    
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    
    if (!searchData.results) {
      console.error('[PLACES] No results for:', query);
      return [];
    }
    
    console.log(`[PLACES] "${query}" in ${city}: ${searchData.results.length} results`);
    
    // Map to our format
    const places: PlaceResult[] = searchData.results.slice(0, maxResults).map((p: any) => ({
      name: p.name,
      address: p.formatted_address,
      placeId: p.place_id,
      rating: p.rating || 0,
      reviewCount: p.user_ratings_total || 0,
      priceLevel: p.price_level,
      isOpen: p.business_status === 'OPERATIONAL',
      types: p.types || [],
      lat: p.geometry?.location?.lat,
      lng: p.geometry?.location?.lng,
      photos: p.photos?.slice(0, 2).map((photo: any) => 
        `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photo.photo_reference}&key=${apiKey}`
      )
    }));
    
    return places;
  } catch (err) {
    console.error('[PLACES] Search error:', err);
    return [];
  }
}

// Get website and more details for a place
export async function getPlaceDetails(placeId: string): Promise<{ website?: string; phone?: string } | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;
  
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=website,formatted_phone_number&key=${apiKey}`;
  
  try {
    const res = await fetch(url);
    const data = await res.json();
    return {
      website: data.result?.website,
      phone: data.result?.formatted_phone_number
    };
  } catch {
    return null;
  }
}

// Pre-filter places before sending to GPT
export function filterPlaces(
  places: PlaceResult[],
  criteria: FilterCriteria
): PlaceResult[] {
  return places.filter(p => {
    // Must be open
    if (criteria.mustBeOpen && !p.isOpen) return false;
    
    // Minimum rating
    if (criteria.minRating && p.rating < criteria.minRating) return false;
    
    // Minimum reviews
    if (criteria.minReviews && p.reviewCount < criteria.minReviews) return false;
    
    // Max price level (1-4)
    if (criteria.maxPriceLevel && p.priceLevel && p.priceLevel > criteria.maxPriceLevel) return false;
    
    return true;
  });
}

// Category-specific search queries
export const CATEGORY_SEARCHES: Record<string, { query: string; filters: FilterCriteria }> = {
  lodging: {
    query: 'boutique hotel hostel',
    filters: { mustBeOpen: true, minRating: 4.0, minReviews: 20 }
  },
  coworking: {
    query: 'coworking space',
    filters: { mustBeOpen: true, minRating: 4.0, minReviews: 10 }
  },
  motoRental: {
    query: 'motorbike scooter rental',
    filters: { mustBeOpen: true, minRating: 3.5, minReviews: 5 }
  },
  equipmentRental: {
    query: 'surf rental shop sports equipment',
    filters: { mustBeOpen: true, minRating: 3.5, minReviews: 5 }
  },
  airportTransfers: {
    query: 'airport transfer taxi service',
    filters: { mustBeOpen: true, minRating: 4.0, minReviews: 10 }
  },
  brunchCoffee: {
    query: 'cafe brunch coffee shop',
    filters: { mustBeOpen: true, minRating: 4.0, minReviews: 20 }
  },
  dinner: {
    query: 'restaurant dinner',
    filters: { mustBeOpen: true, minRating: 4.0, minReviews: 20 }
  },
  activities: {
    query: 'tours activities adventures',
    filters: { mustBeOpen: true, minRating: 4.0, minReviews: 10 }
  },
  nightlife: {
    query: 'bar nightclub rooftop beach club',
    filters: { mustBeOpen: true, minRating: 3.5, minReviews: 15 }
  },
  toiletries: {
    query: 'pharmacy convenience store supermarket',
    filters: { mustBeOpen: true, minRating: 3.0, minReviews: 5 }
  },
  wellness: {
    query: 'gym fitness yoga spa',
    filters: { mustBeOpen: true, minRating: 4.0, minReviews: 10 }
  }
};
