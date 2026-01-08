// Google Places: Source of Truth for Facts

interface PlaceResult {
  name: string;
  address: string;
  placeId: string;
  rating: number;
  reviewCount: number;
  priceLevel?: number; // 1-4
  priceLevelDisplay: string; // $-$$$$
  website?: string;
  isOpen: boolean;
  types: string[];
  photos?: string[];
  popularityScore: number; // rating × log(reviewCount)
}

interface FilterCriteria {
  minRating?: number;
  minReviews?: number;
  maxPriceLevel?: number; // 1-4
  mustBeOpen?: boolean;
}

// Convert price_level (1-4) to display
export function formatPriceLevel(level?: number): string {
  if (!level) return 'N/A';
  return '$'.repeat(level);
}

// Calculate popularity score from real data
export function calculatePopularity(rating: number, reviewCount: number): number {
  if (reviewCount < 1) return 0;
  return Math.round(rating * Math.log10(reviewCount) * 10) / 10;
}

// Search Google Places - get top 33 per category
export async function searchPlaces(
  query: string,
  city: string,
  country: string,
  maxResults: number = 33
): Promise<PlaceResult[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.error('[PLACES] No API key');
    return [];
  }

  // Geocode city
  const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(city + ', ' + country)}&key=${apiKey}`;
  
  try {
    const geoRes = await fetch(geoUrl);
    const geoData = await geoRes.json();
    
    if (!geoData.results?.[0]?.geometry?.location) {
      console.error('[PLACES] Could not geocode city');
      return [];
    }
    
    const { lat, lng } = geoData.results[0].geometry.location;
    
    // Search with pagination to get more results
    let allPlaces: PlaceResult[] = [];
    let nextPageToken: string | null = null;
    
    for (let page = 0; page < 2 && allPlaces.length < maxResults; page++) {
      const searchUrl: string = nextPageToken 
        ? `https://maps.googleapis.com/maps/api/place/textsearch/json?pagetoken=${nextPageToken}&key=${apiKey}`
        : `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query + ' in ' + city + ' ' + country)}&location=${lat},${lng}&radius=20000&key=${apiKey}`;
      
      if (page > 0 && nextPageToken) {
        // Google requires 2 second delay between page requests
        await new Promise(r => setTimeout(r, 2000));
      }
      
      const searchRes = await fetch(searchUrl);
      const searchData = await searchRes.json();
      
      if (!searchData.results) break;
      
      const places: PlaceResult[] = searchData.results.map((p: any) => ({
        name: p.name,
        address: p.formatted_address,
        placeId: p.place_id,
        rating: p.rating || 0,
        reviewCount: p.user_ratings_total || 0,
        priceLevel: p.price_level,
        priceLevelDisplay: formatPriceLevel(p.price_level),
        isOpen: p.business_status === 'OPERATIONAL',
        types: p.types || [],
        photos: p.photos?.slice(0, 2).map((photo: any) => 
          `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photo.photo_reference}&key=${apiKey}`
        ),
        popularityScore: calculatePopularity(p.rating || 0, p.user_ratings_total || 0)
      }));
      
      allPlaces = [...allPlaces, ...places];
      nextPageToken = searchData.next_page_token || null;
      
      if (!nextPageToken) break;
    }
    
    console.log(`[PLACES] "${query}" in ${city}: ${allPlaces.length} results`);
    
    // Sort by popularity score (rating × log(reviews))
    return allPlaces
      .sort((a, b) => b.popularityScore - a.popularityScore)
      .slice(0, maxResults);
      
  } catch (err) {
    console.error('[PLACES] Search error:', err);
    return [];
  }
}

// Get website for a place
export async function getPlaceDetails(placeId: string): Promise<{ website?: string } | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;
  
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=website&key=${apiKey}`;
  
  try {
    const res = await fetch(url);
    const data = await res.json();
    return { website: data.result?.website };
  } catch {
    return null;
  }
}

// Pre-filter places
export function filterPlaces(
  places: PlaceResult[],
  criteria: FilterCriteria
): PlaceResult[] {
  return places.filter(p => {
    if (criteria.mustBeOpen && !p.isOpen) return false;
    if (criteria.minRating && p.rating < criteria.minRating) return false;
    if (criteria.minReviews && p.reviewCount < criteria.minReviews) return false;
    if (criteria.maxPriceLevel && p.priceLevel && p.priceLevel > criteria.maxPriceLevel) return false;
    return true;
  });
}

// Category search configs
export const CATEGORY_SEARCHES: Record<string, { query: string; defaultFilters: FilterCriteria }> = {
  lodging: {
    query: 'boutique hotel hostel guesthouse',
    defaultFilters: { mustBeOpen: true, minRating: 4.0, minReviews: 50 }
  },
  coworking: {
    query: 'coworking space shared office',
    defaultFilters: { mustBeOpen: true, minRating: 4.0, minReviews: 20 }
  },
  motoRental: {
    query: 'motorbike scooter rental',
    defaultFilters: { mustBeOpen: true, minRating: 3.5, minReviews: 10 }
  },
  equipmentRental: {
    query: 'surf rental sports equipment',
    defaultFilters: { mustBeOpen: true, minRating: 3.5, minReviews: 10 }
  },
  airportTransfers: {
    query: 'airport transfer taxi service',
    defaultFilters: { mustBeOpen: true, minRating: 4.0, minReviews: 20 }
  },
  brunchCoffee: {
    query: 'cafe brunch coffee specialty',
    defaultFilters: { mustBeOpen: true, minRating: 4.0, minReviews: 50 }
  },
  dinner: {
    query: 'restaurant dinner dining',
    defaultFilters: { mustBeOpen: true, minRating: 4.0, minReviews: 50 }
  },
  activities: {
    query: 'tours activities adventures experiences',
    defaultFilters: { mustBeOpen: true, minRating: 4.0, minReviews: 20 }
  },
  nightlife: {
    query: 'bar nightclub rooftop beach club',
    defaultFilters: { mustBeOpen: true, minRating: 3.5, minReviews: 30 }
  },
  toiletries: {
    query: 'pharmacy convenience store supermarket',
    defaultFilters: { mustBeOpen: true, minRating: 3.0, minReviews: 10 }
  },
  wellness: {
    query: 'gym fitness yoga spa ice bath',
    defaultFilters: { mustBeOpen: true, minRating: 4.0, minReviews: 20 }
  }
};
