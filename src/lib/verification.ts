// Google Places + Yelp verification for business data

interface VerificationResult {
  isOpen: boolean;
  googleRating?: number;
  googleReviewCount?: number;
  yelpRating?: number;
  yelpReviewCount?: number;
  lastReviewDate?: string;
  openConfidence: 'High' | 'Medium' | 'Low';
  verificationSource: string;
  placeId?: string;
  photos?: string[];
}

// Search Google Places for a business
export async function searchGooglePlace(
  name: string,
  city: string,
  country: string
): Promise<{ placeId: string; name: string } | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;

  const query = encodeURIComponent(`${name} ${city} ${country}`);
  const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${query}&inputtype=textquery&fields=place_id,name,business_status&key=${apiKey}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    
    if (data.candidates && data.candidates.length > 0) {
      const candidate = data.candidates[0];
      // Skip if permanently closed
      if (candidate.business_status === 'CLOSED_PERMANENTLY') {
        return null;
      }
      return { placeId: candidate.place_id, name: candidate.name };
    }
    return null;
  } catch (err) {
    console.error('Google Places search error:', err);
    return null;
  }
}

// Get detailed info from Google Places
export async function getGooglePlaceDetails(placeId: string): Promise<{
  rating?: number;
  reviewCount?: number;
  isOpen?: boolean;
  businessStatus?: string;
  photos?: string[];
} | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;

  const fields = 'rating,user_ratings_total,business_status,opening_hours,photos';
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${apiKey}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    
    if (data.result) {
      const r = data.result;
      return {
        rating: r.rating,
        reviewCount: r.user_ratings_total,
        isOpen: r.opening_hours?.open_now,
        businessStatus: r.business_status,
        photos: r.photos?.slice(0, 3).map((p: any) => 
          `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${p.photo_reference}&key=${apiKey}`
        )
      };
    }
    return null;
  } catch (err) {
    console.error('Google Places details error:', err);
    return null;
  }
}

// Search Yelp for a business (good for restaurants)
export async function searchYelp(
  name: string,
  city: string,
  country: string
): Promise<{
  rating?: number;
  reviewCount?: number;
  isClosed?: boolean;
  url?: string;
} | null> {
  const apiKey = process.env.YELP_API_KEY;
  if (!apiKey) return null;

  const term = encodeURIComponent(name);
  const location = encodeURIComponent(`${city}, ${country}`);
  const url = `https://api.yelp.com/v3/businesses/search?term=${term}&location=${location}&limit=1`;

  try {
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    const data = await res.json();
    
    if (data.businesses && data.businesses.length > 0) {
      const biz = data.businesses[0];
      return {
        rating: biz.rating,
        reviewCount: biz.review_count,
        isClosed: biz.is_closed,
        url: biz.url
      };
    }
    return null;
  } catch (err) {
    console.error('Yelp search error:', err);
    return null;
  }
}

// Full verification for a business
export async function verifyBusiness(
  name: string,
  city: string,
  country: string,
  category: string
): Promise<VerificationResult> {
  const result: VerificationResult = {
    isOpen: true,
    openConfidence: 'Low',
    verificationSource: 'GPT only'
  };

  // Search Google Places
  const googleSearch = await searchGooglePlace(name, city, country);
  
  if (googleSearch) {
    result.placeId = googleSearch.placeId;
    
    // Get detailed info
    const details = await getGooglePlaceDetails(googleSearch.placeId);
    if (details) {
      result.googleRating = details.rating;
      result.googleReviewCount = details.reviewCount;
      result.photos = details.photos;
      
      if (details.businessStatus === 'CLOSED_PERMANENTLY') {
        result.isOpen = false;
        result.openConfidence = 'High';
        result.verificationSource = 'Google Maps (CLOSED)';
        return result;
      }
      
      result.isOpen = details.businessStatus !== 'CLOSED_TEMPORARILY';
      result.openConfidence = details.reviewCount && details.reviewCount > 50 ? 'High' : 'Medium';
      result.verificationSource = 'Google Maps';
    }
  }

  // For restaurants/cafes, also check Yelp
  const foodCategories = ['brunchCoffee', 'dinner', 'nightlife'];
  if (foodCategories.includes(category)) {
    const yelpData = await searchYelp(name, city, country);
    if (yelpData) {
      result.yelpRating = yelpData.rating;
      result.yelpReviewCount = yelpData.reviewCount;
      
      if (yelpData.isClosed) {
        result.isOpen = false;
        result.openConfidence = 'High';
        result.verificationSource = 'Yelp (CLOSED)';
      } else if (!result.googleRating) {
        result.openConfidence = 'Medium';
        result.verificationSource = 'Yelp';
      } else {
        result.verificationSource = 'Google Maps + Yelp';
        result.openConfidence = 'High';
      }
    }
  }

  return result;
}

// Verify top N items from a category
export async function verifyTopItems(
  items: any[],
  city: string,
  country: string,
  category: string,
  topN: number = 3
): Promise<any[]> {
  // Only verify top N to save API costs
  const toVerify = items.slice(0, topN);
  const rest = items.slice(topN);
  
  const verifiedPromises = toVerify.map(async (item) => {
    const verification = await verifyBusiness(item.name, city, country, category);
    
    // Skip if confirmed closed
    if (!verification.isOpen) {
      console.log(`[SKIP] ${item.name} - CLOSED`);
      return null;
    }
    
    return {
      ...item,
      googleRating: verification.googleRating,
      googleReviewCount: verification.googleReviewCount,
      yelpRating: verification.yelpRating,
      yelpReviewCount: verification.yelpReviewCount,
      openConfidence: verification.openConfidence,
      verificationSource: verification.verificationSource,
      verified: true
    };
  });
  
  const verified = (await Promise.all(verifiedPromises)).filter(Boolean);
  
  // Add unverified items (marked as such)
  const unverified = rest.map(item => ({
    ...item,
    openConfidence: 'Low',
    verificationSource: 'Not verified',
    verified: false
  }));
  
  return [...verified, ...unverified];
}
