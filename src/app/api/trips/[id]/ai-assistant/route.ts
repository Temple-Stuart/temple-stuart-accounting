import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { analyzeWithLiveSearch, analyzeAllCategories } from '@/lib/grokAgent';
import { searchPlaces, CATEGORY_SEARCHES } from '@/lib/placesSearch';
import { getCachedPlaces, cachePlaces, isCacheFresh } from '@/lib/placesCache';

// Trip-type focused profile
interface TravelerProfile {
  tripType: 'remote_work' | 'romantic' | 'friends' | 'family' | 'solo' | 'relaxation';
  budget: 'under50' | '50to100' | '100to200' | '200to400' | 'over400';
  priorities: string[];
  dealbreakers: string[];
  groupSize: number;
}

interface PlaceResult {
  name: string;
  address: string;
  website: string | null;
  photoUrl: string | null;
  googleRating: number;
  reviewCount: number;
  sentimentScore: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  summary: string;
  warnings: string[];
  trending: boolean;
  fitScore: number;
  valueRank: number;
  category: string;
}

const BUDGET_LABELS: Record<string, string> = {
  'under50': 'Under $50/night',
  '50to100': '$50-100/night',
  '100to200': '$100-200/night', 
  '200to400': '$200-400/night',
  'over400': '$400+/night'
};

// Enrich places with website from Place Details API
async function enrichPlaceDetails(places: any[]): Promise<any[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return places;

  const enriched = await Promise.all(
    places.slice(0, 60).map(async (p) => {
      if (p.website) return p;
      try {
        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${p.placeId}&fields=website&key=${apiKey}`;
        const res = await fetch(url);
        const data = await res.json();
        return { ...p, website: data.result?.website || '' };
      } catch {
        return p;
      }
    })
  );
  return enriched;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('userEmail')?.value;
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      city, 
      country, 
      activities = [],      // NEW: array of activities from trip
      activity,             // backward compat: single activity
      month,
      year,
      daysTravel,
      minRating = 4.0,
      minReviews = 50,
      categories = Object.keys(CATEGORY_SEARCHES),
      profile
    } = body;

    if (!city || !country) {
      return NextResponse.json({ error: 'City and country required' }, { status: 400 });
    }

    // Use activities array or fall back to single activity
    const tripActivities = activities.length > 0 ? activities : (activity ? [activity] : []);

    // Default profile if not provided
    const travelerProfile: TravelerProfile = profile || {
      tripType: 'relaxation',
      budget: '100to200',
      priorities: ['best_value'],
      dealbreakers: [],
      groupSize: 1
    };

    console.log('[Grok AI] Starting analysis for ' + city + ', ' + country);
    console.log('[Grok AI] Activities: ' + tripActivities.join(', '));
    console.log('[Grok AI] Trip type: ' + travelerProfile.tripType + ', Budget: ' + travelerProfile.budget);

    // STEP 1: Gather all places from Google Places API (cached)
    // STEP 1: Gather all places from Google Places API (cached) BY CATEGORY
    const placesByCategory: Record<string, Array<{
      name: string;
      address: string;
      rating: number;
      reviewCount: number;
      website?: string;
      photoUrl?: string;
      category: string;
    }>> = {};
    for (const cat of categories) {
      const config = CATEGORY_SEARCHES[cat];
      if (!config) {
        console.log('[Grok AI] Unknown category: ' + cat);
        continue;
      }

      // Skip certain categories based on trip type
      if (travelerProfile.tripType === 'family' && cat === 'nightlife') {
        console.log('[Grok AI] Skipping nightlife for family trip');
        continue;
      }

      let query = config.query;
      
      // Customize queries based on trip type
      if (cat === 'lodging') {
        if (travelerProfile.tripType === 'family') {
          query = 'family hotel resort apartment';
        } else if (travelerProfile.tripType === 'romantic') {
          query = 'boutique hotel romantic resort';
        } else if (travelerProfile.tripType === 'solo') {
          query = 'hostel guesthouse budget hotel';
        } else if (travelerProfile.tripType === 'friends') {
          query = 'villa apartment hostel group accommodation';
        } else if (travelerProfile.tripType === 'remote_work') {
          query = 'hotel coworking coliving digital nomad';
        }
      }

      // CHECK CACHE FIRST
      let enriched: any[] = [];
      const cacheIsFresh = await isCacheFresh(city, country, cat);
      
      if (cacheIsFresh) {
        enriched = await getCachedPlaces(city, country, cat);
        console.log('[Grok AI] ' + cat + ': Using ' + enriched.length + ' CACHED places');
      } else {
        console.log('[Grok AI] ' + cat + ': Cache miss - calling Google API');
        const places = await searchPlaces(query, city, country, 60);
        enriched = await enrichPlaceDetails(places);
        await cachePlaces(enriched, city, country, cat);
        console.log('[Grok AI] ' + cat + ': Cached ' + enriched.length + ' places');
      }

      // Filter by rating and reviews
      const filtered = enriched.filter(p => {
        if (p.rating < minRating) return false;
        if (p.reviewCount < minReviews) return false;
        return true;
      });

      // Add to category group
      placesByCategory[cat] = filtered.slice(0, 20).map(p => ({
          name: p.name,
          address: p.address,
          rating: p.rating,
          reviewCount: p.reviewCount,
          website: p.website || undefined,
          photoUrl: p.photos?.[0] || undefined,
          category: cat
        }));

      console.log('[Grok AI] ' + cat + ': ' + filtered.length + ' places after filter');
    }

    const totalPlaces = Object.values(placesByCategory).flat().length;
    console.log('[Grok AI] Total places to analyze: ' + totalPlaces);

    if (totalPlaces === 0) {
      return NextResponse.json({ 
        recommendations: [],
        context: { city, country, activities: tripActivities, month, year, daysTravel }
      });
    }

    // STEP 2: Send to Grok for sentiment analysis with x_search + web_search
    const monthName = month ? new Date(year || 2025, month - 1).toLocaleString('en-US', { month: 'long' }) : undefined;
    
    const byCategory = await analyzeAllCategories({
      placesByCategory,
      destination: `${city}, ${country}`,
      activities: tripActivities,
      profile: {
        tripType: travelerProfile.tripType,
        budget: BUDGET_LABELS[travelerProfile.budget] || "$100-200/night",
        priorities: travelerProfile.priorities,
        dealbreakers: travelerProfile.dealbreakers,
        groupSize: travelerProfile.groupSize
      },
      month: monthName,
      year: year,
      maxParallel: 2  // Limit parallel requests to avoid rate limits
    });

    // Flatten for the recommendations array
    const analyzed = Object.values(byCategory).flat();
    analyzed.sort((a, b) => a.valueRank - b.valueRank);

    // Group results by category for the response
    return NextResponse.json({ 
      recommendations: analyzed,        // Flat list sorted by valueRank
      byCategory: byCategory,           // Grouped by category
      context: { 
        city, 
        country, 
        activities: tripActivities,
        month: monthName, 
        year, 
        daysTravel,
        tripType: travelerProfile.tripType,
        budget: travelerProfile.budget,
        totalAnalyzed: totalPlaces
      }
    });

  } catch (err) {
    console.error('Grok AI Assistant error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'AI request failed' },
      { status: 500 }
    );
  }
}
