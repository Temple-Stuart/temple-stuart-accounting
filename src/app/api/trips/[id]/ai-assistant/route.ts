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

  // Build place list for GPT with all details - show [PRICE UNVERIFIED] for missing
  const placeList = places.map((p, i) => {
    const priceTag = p.priceLevelDisplay ? p.priceLevelDisplay : '[PRICE UNVERIFIED]';
    return `${i + 1}. ${p.name} | ⭐${p.rating} (${p.reviewCount} reviews) | ${priceTag} | ${p.address}`;
  }).join('\n');

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
- priceLevel: $, $$, $$$, or $$$$ (estimate if not shown, mark with ~ if unverified)
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

// Enrich places with website AND price_level from Place Details API
async function enrichPlaceDetails(places: any[]): Promise<any[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return places;

  const enriched = await Promise.all(
    places.slice(0, 60).map(async (p) => {
      // Skip if already has both website and price
      if (p.website && p.priceLevel != null) return p;
      try {
        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${p.placeId}&fields=website,price_level&key=${apiKey}`;
        const res = await fetch(url);
        const data = await res.json();
        const newPrice = p.priceLevel ?? data.result?.price_level ?? null;
        return { 
          ...p, 
          website: p.website || data.result?.website || '',
          priceLevel: newPrice,
          priceLevelDisplay: newPrice != null ? '$'.repeat(newPrice) : null
        };
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
      priceTier = '$$',
      minRating = 4.0,
      minReviews = 50,
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

        // 1. Google: Get top 60 real places
        console.log('[AI] ' + cat + ': Searching "' + query + '"');
        const places = await searchPlaces(query, city, country, 60);

        // 2. Enrich ALL places with price_level first (before filtering)
        const enriched = await enrichPlaceDetails(places);

        // 3. Filter: open, rated, price tier (returns verified + unverified)
        const maxPrice = priceTier === '$' ? 1 : priceTier === '$$' ? 2 : priceTier === '$$$' ? 3 : 4;
        const { verified, unverified } = filterPlaces(enriched, {
          ...config.defaultFilters,
          minRating,
          minReviews,
          maxPriceLevel: maxPrice
        });

        // Combine: verified first (price filtered), then unverified (no price data)
        const filtered = [...verified, ...unverified];
        console.log('[AI] ' + cat + ': ' + verified.length + ' verified, ' + unverified.length + ' unverified price');

        if (filtered.length === 0) return [cat, []];

        // 4. GPT: Pick TOP 10 most viral from filtered list
        const viral = await rankByViralPotential(filtered, cat, city, priceTier);
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
