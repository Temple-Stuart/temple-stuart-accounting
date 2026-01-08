import { NextRequest, NextResponse } from 'next/server';
import openai from '@/lib/openai';
import { searchPlaces, filterPlaces, CATEGORY_SEARCHES } from '@/lib/placesSearch';

interface Recommendation {
  name: string;
  address: string;
  website: string;
  rating: number;
  reviewCount: number;
  priceLevel: string;
  viralRank: number;
  whyViral: string;
  communityFit: string;
  contentAngle: string;
}

// GPT picks the TOP 10 most viral from Google's list
async function rankByViralPotential(
  places: any[],
  category: string,
  city: string,
  priceTier: string = '$'
): Promise<Recommendation[]> {
  if (places.length === 0) return [];

  // Build place list for GPT with all details
  const placeList = places.map((p, i) => 
    `${i + 1}. ${p.name} | ⭐${p.rating} (${p.reviewCount} reviews) | ${p.priceLevelDisplay || 'Price N/A'} | ${p.address}`
  ).join('\n');

  const prompt = `You are an expert on VIRAL travel destinations for digital nomads, entrepreneurs, founders, and content creators.

CATEGORY: ${category}
LOCATION: ${city}
PRICE TIER: ${priceTier} (focus on places at this budget level)

Here are ${places.length} REAL places from Google Maps:

${placeList}

YOUR TASK: Pick the TOP 10 most likely to GO VIRAL among entrepreneurs, founders, and digital nomads.

Consider places that:
- Are FAMOUS in nomad/startup circles (you know this from your training data)
- Have been featured in YouTube vlogs, TikToks, travel blogs
- Are known influencer/content creator hotspots
- Have strong founder/entrepreneur community presence
- Are photogenic and content-worthy

For EACH of your top 10, provide:
- index: The number from the list above
- viralRank: 1-10 (1 = most viral)
- priceLevel: $, $$, $$$, or $$$$ (estimate if not shown)
- whyViral: 1-2 sentences on why this place is viral/hyped (be specific - mention if it's been in vlogs, known for X, etc.)
- communityFit: 1 sentence on the entrepreneur/founder vibe
- contentAngle: Specific content idea (e.g., "sunrise laptop shot at infinity pool")

Return JSON array ranked by viral potential (most viral first):
[{
  "index": 5,
  "viralRank": 1,
  "priceLevel": "$$",
  "whyViral": "THE iconic digital nomad coworking spot - featured in hundreds of nomad YouTube vlogs, the infinity pool shot is instantly recognizable",
  "communityFit": "Strong founder community, weekly pitch nights, attracts serious entrepreneurs",
  "contentAngle": "Golden hour laptop shot at infinity pool with rice field backdrop"
}]

BE HONEST. Only include places you genuinely believe have viral potential. If a place isn't famous, don't include it.
Return ONLY valid JSON array, no markdown.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are an expert on viral travel destinations. Return only valid JSON array.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 4000,
    });

    const content = completion.choices[0]?.message?.content || '[]';
    const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
    const rankings = JSON.parse(cleaned);

    // Merge GPT rankings with Google data
    const results: Recommendation[] = rankings.map((rank: any) => {
      const place = places[rank.index - 1];
      if (!place) return null;

      return {
        name: place.name,
        address: place.address,
        website: place.website || '',
        rating: place.rating,
        reviewCount: place.reviewCount,
        priceLevel: rank.priceLevel || place.priceLevelDisplay || 'N/A',
        viralRank: rank.viralRank,
        whyViral: rank.whyViral,
        communityFit: rank.communityFit,
        contentAngle: rank.contentAngle
      };
    }).filter(Boolean);

    return results.slice(0, 10);

  } catch (err) {
    console.error('[GPT] Viral ranking failed:', err);
    return [];
  }
}

// Get website details
async function enrichWithWebsites(places: any[]): Promise<any[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return places;

  const enriched = await Promise.all(
    places.slice(0, 33).map(async (p) => {
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
      partySize = 1,
      priceTier = '$',
      equipmentType = 'surf',
      categories = Object.keys(CATEGORY_SEARCHES)
    } = body;

    if (!city || !country) {
      return NextResponse.json({ error: 'City and country required' }, { status: 400 });
    }

    console.log('[AI] Starting viral search for ' + city + ', ' + country);

    // Process each category
    const results = await Promise.all(
      categories.map(async (cat: string) => {
        const config = CATEGORY_SEARCHES[cat];
        if (!config) {
          console.log('[AI] Unknown category: ' + cat);
          return [cat, []];
        }

        // Customize query
        let query = config.query;
        if (cat === 'equipmentRental' && equipmentType) {
          query = equipmentType + ' rental shop';
        }

        // 1. Google: Get top 33 real places
        console.log('[AI] ' + cat + ': Searching "' + query + '"');
        const places = await searchPlaces(query, city, country, 33);

        // 2. Filter: open, rated
        const filtered = filterPlaces(places, config.defaultFilters);
        console.log('[AI] ' + cat + ': ' + places.length + ' found → ' + filtered.length + ' after filter');

        if (filtered.length === 0) return [cat, []];

        // 3. Enrich with websites
        const enriched = await enrichWithWebsites(filtered);

        // 4. GPT: Pick TOP 10 most viral
        const viral = await rankByViralPotential(enriched, cat, city, priceTier);
        console.log('[AI] ' + cat + ': ' + viral.length + ' viral picks');

        return [cat, viral];
      })
    );

    const recommendations = Object.fromEntries(results);
    const monthName = new Date(year, month - 1).toLocaleString('en-US', { month: 'long' });

    return NextResponse.json({ 
      recommendations,
      context: { city, country, activity, month: monthName, year, daysTravel, partySize }
    });

  } catch (err) {
    console.error('AI Assistant error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'AI request failed' },
      { status: 500 }
    );
  }
}
