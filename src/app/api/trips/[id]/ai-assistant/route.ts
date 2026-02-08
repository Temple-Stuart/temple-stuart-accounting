import { requireTier } from '@/lib/auth-helpers';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { analyzeWithLiveSearch } from '@/lib/grokAgent';
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

// Accepts a single category per request. Client iterates categories and
// calls this endpoint once per category, updating UI as each returns.
// This keeps each request under the serverless function timeout.
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

    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const tierGate = requireTier(user.tier, 'tripAI');
    if (tierGate) return tierGate;

    const body = await request.json();
    const {
      city,
      country,
      activities = [],
      activity,
      month,
      year,
      daysTravel,
      minRating = 4.0,
      minReviews = 50,
      category,
      profile
    } = body;

    if (!city || !country) {
      return NextResponse.json({ error: 'City and country required' }, { status: 400 });
    }
    if (!category || !CATEGORY_SEARCHES[category]) {
      return NextResponse.json({ error: 'Valid category required' }, { status: 400 });
    }

    const tripActivities = activities.length > 0 ? activities : (activity ? [activity] : []);

    const travelerProfile: TravelerProfile = profile || {
      tripType: 'relaxation',
      budget: '100to200',
      priorities: ['best_value'],
      dealbreakers: [],
      groupSize: 1
    };

    // Skip nightlife for family trips
    if (travelerProfile.tripType === 'family' && category === 'nightlife') {
      return NextResponse.json({ category, recommendations: [] });
    }

    console.log(`[Grok AI] ${category}: Starting analysis for ${city}, ${country}`);

    // Customize lodging query based on trip type
    let query = CATEGORY_SEARCHES[category].query;
    if (category === 'lodging') {
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

    // Fetch places from Google (cached)
    let enriched: any[] = [];
    const cacheIsFresh = await isCacheFresh(city, country, category);

    if (cacheIsFresh) {
      enriched = await getCachedPlaces(city, country, category);
      console.log(`[Grok AI] ${category}: ${enriched.length} cached places`);
    } else {
      console.log(`[Grok AI] ${category}: Cache miss — calling Google`);
      const places = await searchPlaces(query, city, country, 60);
      enriched = await enrichPlaceDetails(places);
      await cachePlaces(enriched, city, country, category);
      console.log(`[Grok AI] ${category}: Cached ${enriched.length} places`);
    }

    const filtered = enriched.filter(p => p.rating >= minRating && p.reviewCount >= minReviews);

    const placesToAnalyze = filtered.slice(0, 10).map(p => ({
      name: p.name,
      address: p.address,
      rating: p.rating,
      reviewCount: p.reviewCount,
      website: p.website || undefined,
      photoUrl: p.photos?.[0] || undefined,
      category
    }));

    console.log(`[Grok AI] ${category}: ${placesToAnalyze.length} places after filter`);

    if (placesToAnalyze.length === 0) {
      return NextResponse.json({ category, recommendations: [] });
    }

    // Single Grok call for this one category
    const monthName = month ? new Date(year || 2025, month - 1).toLocaleString('en-US', { month: 'long' }) : undefined;

    const recommendations = await analyzeWithLiveSearch({
      places: placesToAnalyze,
      destination: `${city}, ${country}`,
      activities: tripActivities,
      profile: {
        tripType: travelerProfile.tripType,
        budget: BUDGET_LABELS[travelerProfile.budget] || "$100-200/night",
        priorities: travelerProfile.priorities,
        dealbreakers: travelerProfile.dealbreakers,
        groupSize: travelerProfile.groupSize
      },
      category,
      month: monthName,
      year: year,
    });

    console.log(`[Grok AI] ${category}: ${recommendations.length} results`);

    return NextResponse.json({ category, recommendations });

  } catch (err) {
    console.error('Grok AI Assistant error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'AI request failed' },
      { status: 500 }
    );
  }
}
