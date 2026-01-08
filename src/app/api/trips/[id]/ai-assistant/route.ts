import { NextRequest, NextResponse } from 'next/server';
import openai from '@/lib/openai';
import { searchPlaces, filterPlaces, getPlaceDetails, CATEGORY_SEARCHES } from '@/lib/placesSearch';

interface Recommendation {
  name: string;
  address: string;
  website: string;
  price: string;
  priceDaily?: number;
  priceWeekly?: number;
  priceMonthly?: number;
  whyViral: string;
  socialProof: string;
  viralScore: number;
  menuUrl?: string;
  googleRating?: number;
  googleReviewCount?: number;
  openConfidence?: 'High' | 'Medium' | 'Low';
  verificationSource?: string;
  photos?: string[];
}

// GPT ranks real places by viral potential
async function rankByViralPotential(
  places: any[],
  category: string,
  city: string,
  filters: any
): Promise<Recommendation[]> {
  if (places.length === 0) return [];

  // Build place list for GPT
  const placeList = places.map((p, i) => 
    `${i + 1}. ${p.name} - Rating: ${p.rating}/5 (${p.reviewCount} reviews) - ${p.address}`
  ).join('\n');

  const prompt = `You are a viral travel content strategist. Here are REAL ${category} places in ${city} from Google Maps.

PLACES:
${placeList}

TASK: Rank these by VIRAL POTENTIAL for a digital nomad content creator.

For each place, estimate:
- viralScore (1-100): How likely to generate viral TikTok/Instagram content
- whyViral: Specific reason (aesthetic design, influencer hotspot, unique experience, photogenic, community vibe)
- socialProof: Your estimate of social presence (e.g., "Popular on IG, TikTok nomad favorite")
- price: Estimated price (daily/weekly/monthly if applicable)
- priceDaily: Numeric daily rate estimate

${filters.maxBudget ? `Budget constraint: Max $${filters.maxBudget}/night or /meal` : ''}

Return JSON array of top 10, ranked by viralScore (highest first):
[{
  "index": 1,
  "viralScore": 92,
  "whyViral": "Iconic nomad spot, incredible design, constant influencer content",
  "socialProof": "TikTok favorite, 50k+ IG posts",
  "price": "$70/night, $400/week, $1200/month",
  "priceDaily": 70,
  "priceWeekly": 400,
  "priceMonthly": 1200
}]

Return ONLY valid JSON array. No markdown, no explanation.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'Return only valid JSON array. No markdown.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.5,
      max_tokens: 3000,
    });

    const content = completion.choices[0]?.message?.content || '[]';
    const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
    const rankings = JSON.parse(cleaned);

    // Merge GPT rankings with Google data
    const results: Recommendation[] = rankings.slice(0, 10).map((rank: any) => {
      const place = places[rank.index - 1];
      if (!place) return null;

      return {
        name: place.name,
        address: place.address,
        website: place.website || '',
        price: rank.price || 'Contact for pricing',
        priceDaily: rank.priceDaily,
        priceWeekly: rank.priceWeekly,
        priceMonthly: rank.priceMonthly,
        whyViral: rank.whyViral,
        socialProof: rank.socialProof,
        viralScore: rank.viralScore,
        googleRating: place.rating,
        googleReviewCount: place.reviewCount,
        openConfidence: 'High',
        verificationSource: 'Google Maps',
        photos: place.photos
      };
    }).filter(Boolean);

    return results;
  } catch (err) {
    console.error(`[GPT] Ranking ${category} failed:`, err);
    
    // Fallback: return places without GPT ranking
    return places.slice(0, 10).map(p => ({
      name: p.name,
      address: p.address,
      website: p.website || '',
      price: 'Contact for pricing',
      priceDaily: 0,
      whyViral: 'Popular local spot',
      socialProof: `Google: ${p.rating}/5 (${p.reviewCount} reviews)`,
      viralScore: Math.round(p.rating * 20),
      googleRating: p.rating,
      googleReviewCount: p.reviewCount,
      openConfidence: 'High' as const,
      verificationSource: 'Google Maps',
      photos: p.photos
    }));
  }
}

// Fetch websites for top places (optional enhancement)
async function enrichWithWebsites(places: any[]): Promise<any[]> {
  const enriched = await Promise.all(
    places.slice(0, 10).map(async (p) => {
      if (p.website) return p;
      const details = await getPlaceDetails(p.placeId);
      return { ...p, website: details?.website || '' };
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
      beds = 1,
      lodgingBudget = 100,
      brunchBudget = 5,
      dinnerBudget = 15,
      equipmentType = 'surf',
      categories = Object.keys(CATEGORY_SEARCHES)
    } = body;

    if (!city || !country) {
      return NextResponse.json({ error: 'City and country required' }, { status: 400 });
    }

    console.log(`[AI] Starting search for ${city}, ${country}`);

    // Process each category: Search → Filter → Rank
    const results = await Promise.all(
      categories.map(async (cat: string) => {
        const searchConfig = CATEGORY_SEARCHES[cat];
        if (!searchConfig) {
          console.log(`[AI] Unknown category: ${cat}`);
          return [cat, []];
        }

        // Customize query based on category
        let query = searchConfig.query;
        if (cat === 'equipmentRental' && equipmentType) {
          query = `${equipmentType} rental shop`;
        }

        // 1. Search Google Places
        console.log(`[AI] Searching ${cat}: "${query}"`);
        const places = await searchPlaces(query, city, country, 20);

        // 2. Pre-filter (open, rating, reviews)
        const filtered = filterPlaces(places, searchConfig.filters);
        console.log(`[AI] ${cat}: ${places.length} found → ${filtered.length} after filter`);

        if (filtered.length === 0) {
          return [cat, []];
        }

        // 3. Enrich with websites
        const enriched = await enrichWithWebsites(filtered);

        // 4. GPT ranks by viral potential
        const filters = {
          maxBudget: cat === 'lodging' ? lodgingBudget : 
                     cat === 'brunchCoffee' ? brunchBudget :
                     cat === 'dinner' ? dinnerBudget : null
        };
        
        const ranked = await rankByViralPotential(enriched, cat, city, filters);
        console.log(`[AI] ${cat}: ${ranked.length} ranked`);

        return [cat, ranked];
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
