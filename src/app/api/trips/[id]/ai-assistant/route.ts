import { NextRequest, NextResponse } from 'next/server';
import openai from '@/lib/openai';
import { searchPlaces, filterPlaces, CATEGORY_SEARCHES } from '@/lib/placesSearch';

// Trip-type focused profile
interface TravelerProfile {
  tripType: 'remote_work' | 'romantic' | 'friends' | 'family' | 'solo' | 'relaxation';
  budget: 'under50' | '50to100' | '100to200' | '200to400' | 'over400';
  priorities: string[];
  dealbreakers: string[];
  groupSize: number;
}

interface Recommendation {
  name: string;
  address: string;
  website: string;
  rating: number;
  reviewCount: number;
  estimatedPrice: string;
  valueRank: number;
  fitScore: number;
  whyThisTraveler: string;
  warning: string | null;
  photoWorthy: string;
}

const BUDGET_RANGES: Record<string, string> = {
  'under50': 'Under $50/night',
  '50to100': '$50-100/night',
  '100to200': '$100-200/night', 
  '200to400': '$200-400/night',
  'over400': '$400+/night'
};

const TRIP_TYPE_DESCRIPTIONS: Record<string, string> = {
  'remote_work': 'Digital nomad/remote worker needing reliable wifi, desk space, quiet environment for calls',
  'romantic': 'Couple seeking intimate, romantic atmosphere for special getaway',
  'friends': 'Friend group looking for social atmosphere, group activities, nightlife',
  'family': 'Family with children needing safe, kid-friendly, spacious accommodations',
  'solo': 'Solo traveler wanting to meet others, stay safe, good value hostels/hotels',
  'relaxation': 'Vacationer seeking pure relaxation, spa, pool, no agenda'
};

const TRIP_TYPE_RULES: Record<string, string> = {
  'remote_work': 'PRIORITIZE: Fast wifi (50+ mbps), desk/workspace, quiet for calls, cafes nearby. AVOID: Party hostels, noisy locations.',
  'romantic': 'PRIORITIZE: Privacy, couples amenities (spa, rooftop), intimate dining, scenic views. AVOID: Hostels, party scenes, family resorts.',
  'friends': 'PRIORITIZE: Group rooms/villas, common areas, proximity to nightlife, activities. Good for splitting costs.',
  'family': 'PRIORITIZE: Safety, kid-friendly amenities, pool, space, family restaurants nearby. EXCLUDE: Adult-only venues, party hostels, bars.',
  'solo': 'PRIORITIZE: Social hostels, safety ratings, common areas to meet people, central location. Consider female safety if relevant.',
  'relaxation': 'PRIORITIZE: Spa, pool, beach access, peaceful setting, good service. AVOID: Party venues, noisy locations.'
};

// GPT ranks by VALUE for this specific traveler
async function rankByValue(
  places: any[],
  category: string,
  city: string,
  profile: TravelerProfile
): Promise<Recommendation[]> {
  if (places.length === 0) return [];

  const placeList = places.map((p, i) => {
    return `${i + 1}. ${p.name} | ⭐${p.rating} (${p.reviewCount} reviews) | ${p.address}`;
  }).join('\n');

  const budgetRange = BUDGET_RANGES[profile.budget] || '$100-200/night';
  const tripTypeDesc = TRIP_TYPE_DESCRIPTIONS[profile.tripType] || 'General traveler';
  const tripTypeRules = TRIP_TYPE_RULES[profile.tripType] || '';

  const prompt = `You are a travel expert helping find the BEST VALUE ${category} options.

LOCATION: ${city}
CATEGORY: ${category}

TRAVELER PROFILE:
- Trip Type: ${tripTypeDesc}
- Group Size: ${profile.groupSize} ${profile.groupSize === 1 ? 'person' : 'people'}
- Budget: ${budgetRange}
- Priorities: ${profile.priorities.length > 0 ? profile.priorities.join(', ') : 'Best overall value'}
- Dealbreakers: ${profile.dealbreakers.length > 0 ? profile.dealbreakers.join(', ') : 'None specified'}

TRIP-SPECIFIC RULES:
${tripTypeRules}

Here are ${places.length} REAL places from Google Maps:

${placeList}

YOUR TASK:
1. Using your training data (Booking.com, TripAdvisor, Google reviews, travel blogs), ESTIMATE the typical price for each place
2. FILTER OUT places that violate the traveler's dealbreakers or trip-type rules
3. FILTER OUT places clearly outside their budget range
4. Calculate VALUE SCORE = (Quality × Fit for Trip Type) ÷ Price
5. Return TOP 10 ranked by best value for THIS specific traveler

For EACH of your top 10, provide:
- index: The number from the list above (1-indexed)
- valueRank: 1-10 (1 = best value for this traveler)
- estimatedPrice: Your best estimate like "$80-120/night" or "$15-25/meal" based on category
- fitScore: 1-10 how well this matches their trip type and priorities
- whyThisTraveler: 2 sentences explaining why this is great for THEIR specific situation
- warning: Any potential concern for this traveler type, or null if none
- photoWorthy: Best photo opportunity or memorable experience here

CRITICAL: 
- Be HONEST about pricing - use your knowledge of ${city} prices
- A place can have high ratings but low fit score if it doesn't match the trip type
- Family trips should NEVER include party hostels or adult venues
- Romantic trips should prioritize intimacy over social scenes
- Remote work trips need WIFI reliability above all else

Return ONLY a valid JSON array, no markdown:
[{
  "index": 3,
  "valueRank": 1,
  "estimatedPrice": "$85-110/night",
  "fitScore": 9,
  "whyThisTraveler": "Perfect for remote work with dedicated coworking space and 100mbps wifi. The rooftop cafe is ideal for taking calls with a view.",
  "warning": "Can get busy during digital nomad high season (Jan-Mar)",
  "photoWorthy": "Sunrise laptop shot from the rooftop workspace"
}]`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a travel value expert. Estimate real prices from your training data. Return only valid JSON array.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 4000,
    });

    const content = completion.choices[0]?.message?.content || '[]';
    const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
    const rankings = JSON.parse(cleaned);

    const results: Recommendation[] = rankings.map((rank: any) => {
      const place = places[rank.index - 1];
      if (!place) return null;

      return {
        name: place.name,
        address: place.address,
        website: place.website || '',
        rating: place.rating,
        reviewCount: place.reviewCount,
        estimatedPrice: rank.estimatedPrice || 'Price varies',
        valueRank: rank.valueRank,
        fitScore: rank.fitScore,
        whyThisTraveler: rank.whyThisTraveler,
        warning: rank.warning || null,
        photoWorthy: rank.photoWorthy
      };
    }).filter(Boolean);

    return results.slice(0, 10);

  } catch (err) {
    console.error('[GPT] Value ranking failed:', err);
    return [];
  }
}

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
    const body = await request.json();
    const { 
      city, 
      country, 
      activity,
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

    // Default profile if not provided
    const travelerProfile: TravelerProfile = profile || {
      tripType: 'relaxation',
      budget: '100to200',
      priorities: ['best_value'],
      dealbreakers: [],
      groupSize: 1
    };

    console.log('[AI] Starting value search for ' + city + ', ' + country);
    console.log('[AI] Trip type: ' + travelerProfile.tripType + ', Budget: ' + travelerProfile.budget);

    const results = await Promise.all(
      categories.map(async (cat: string) => {
        const config = CATEGORY_SEARCHES[cat];
        if (!config) {
          console.log('[AI] Unknown category: ' + cat);
          return [cat, []];
        }

        // Skip certain categories based on trip type
        if (travelerProfile.tripType === 'family' && cat === 'nightlife') {
          console.log('[AI] Skipping nightlife for family trip');
          return [cat, []];
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
          }
        }

        console.log('[AI] ' + cat + ': Searching "' + query + '"');
        const places = await searchPlaces(query, city, country, 60);
        const enriched = await enrichPlaceDetails(places);

        // Filter by rating and reviews only (price filtering done by GPT)
        const filtered = enriched.filter(p => {
          if (p.rating < minRating) return false;
          if (p.reviewCount < minReviews) return false;
          return true;
        });

        console.log('[AI] ' + cat + ': ' + filtered.length + ' places after rating/review filter');

        if (filtered.length === 0) return [cat, []];

        const ranked = await rankByValue(filtered, cat, city, travelerProfile);
        console.log('[AI] ' + cat + ': ' + ranked.length + ' value picks');

        return [cat, ranked];
      })
    );

    const recommendations = Object.fromEntries(results);
    const monthName = new Date(year, month - 1).toLocaleString('en-US', { month: 'long' });

    return NextResponse.json({ 
      recommendations,
      context: { 
        city, 
        country, 
        activity, 
        month: monthName, 
        year, 
        daysTravel,
        tripType: travelerProfile.tripType,
        budget: travelerProfile.budget
      }
    });

  } catch (err) {
    console.error('AI Assistant error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'AI request failed' },
      { status: 500 }
    );
  }
}
