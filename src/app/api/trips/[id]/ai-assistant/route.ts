import { NextRequest, NextResponse } from 'next/server';
import openai from '@/lib/openai';
import { searchPlaces, filterPlaces, getPlaceDetails, CATEGORY_SEARCHES } from '@/lib/placesSearch';

interface Recommendation {
  name: string;
  address: string;
  website: string;
  rating: number;
  reviewCount: number;
  priceLevel: string;
  popularityScore: number;
  whyHyped: string;
  communityFit: string;
  contentAngle: string;
  photos?: string[];
}

// GPT adds context: hype, community fit, content angles
async function addGPTContext(
  places: any[],
  category: string,
  city: string
): Promise<Recommendation[]> {
  if (places.length === 0) return [];

  // Build place list for GPT
  const placeList = places.slice(0, 15).map((p, i) => 
    `${i + 1}. ${p.name} - ⭐${p.rating} (${p.reviewCount} reviews) ${p.priceLevelDisplay || ''}`
  ).join('\n');

  const prompt = `You are a digital nomad and content creator expert. Here are REAL ${category} places in ${city} from Google Maps.

PLACES:
${placeList}

YOUR TASK: Add context about each place's HYPE and COMMUNITY FIT.

For each place, provide:
- whyHyped: Is this place famous/hyped in the entrepreneur, startup, founder, digital nomad community? Why? (Be honest - say "Not particularly known" if true)
- communityFit: Is this a spot where entrepreneurs, founders, content creators hang out? What's the vibe?
- contentAngle: Best content idea for this spot (be specific: "sunrise laptop shot on rooftop" not just "good for photos")

Return JSON array with index and your additions:
[{
  "index": 1,
  "whyHyped": "THE iconic nomad coworking spot in Bali - featured in hundreds of YouTube vlogs and nomad TikToks",
  "communityFit": "Strong founder community, weekly networking events, attracts startup people and content creators",
  "contentAngle": "Infinity pool laptop shot with rice field backdrop - the classic nomad flex"
}]

BE HONEST. If a place isn't famous in nomad circles, say so. Don't invent hype.
Return ONLY valid JSON array.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are an expert on digital nomad hotspots and entrepreneur communities. Be honest about what is and isnt hyped. Return only JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 3000,
    });

    const content = completion.choices[0]?.message?.content || '[]';
    const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
    const context = JSON.parse(cleaned);

    // Merge GPT context with Google data
    const results: Recommendation[] = places.slice(0, 15).map((place, i) => {
      const gptData = context.find((c: any) => c.index === i + 1) || {};
      
      return {
        name: place.name,
        address: place.address,
        website: place.website || '',
        rating: place.rating,
        reviewCount: place.reviewCount,
        priceLevel: place.priceLevelDisplay || 'N/A',
        popularityScore: place.popularityScore,
        whyHyped: gptData.whyHyped || 'No specific hype data',
        communityFit: gptData.communityFit || 'General audience',
        contentAngle: gptData.contentAngle || 'Standard travel content',
        photos: place.photos
      };
    });

    // Sort by popularity (Google data), keep GPT context
    return results.sort((a, b) => b.popularityScore - a.popularityScore).slice(0, 10);

  } catch (err) {
    console.error('[GPT] Context failed:', err);
    // Return Google data without GPT context
    return places.slice(0, 10).map(place => ({
      name: place.name,
      address: place.address,
      website: place.website || '',
      rating: place.rating,
      reviewCount: place.reviewCount,
      priceLevel: place.priceLevelDisplay || 'N/A',
      popularityScore: place.popularityScore,
      whyHyped: 'Context unavailable',
      communityFit: 'Context unavailable',
      contentAngle: 'Context unavailable',
      photos: place.photos
    }));
  }
}

// Enrich with websites
async function enrichWithWebsites(places: any[]): Promise<any[]> {
  const enriched = await Promise.all(
    places.slice(0, 15).map(async (p) => {
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
      // Price level filters (1-4)
      lodgingPriceMax = 4,
      mealPriceMax = 4,
      equipmentType = 'surf',
      categories = Object.keys(CATEGORY_SEARCHES)
    } = body;

    if (!city || !country) {
      return NextResponse.json({ error: 'City and country required' }, { status: 400 });
    }

    console.log(`[AI] Starting search for ${city}, ${country}`);

    // Process each category
    const results = await Promise.all(
      categories.map(async (cat: string) => {
        const config = CATEGORY_SEARCHES[cat];
        if (!config) {
          console.log(`[AI] Unknown category: ${cat}`);
          return [cat, []];
        }

        // Customize query
        let query = config.query;
        if (cat === 'equipmentRental' && equipmentType) {
          query = `${equipmentType} rental shop`;
        }

        // Apply price level filter
        const filters = { ...config.defaultFilters };
        if (['lodging'].includes(cat)) {
          filters.maxPriceLevel = lodgingPriceMax;
        }
        if (['brunchCoffee', 'dinner'].includes(cat)) {
          filters.maxPriceLevel = mealPriceMax;
        }

        // 1. Google: Get top 33
        console.log(`[AI] ${cat}: Searching "${query}"`);
        const places = await searchPlaces(query, city, country, 33);

        // 2. Filter by criteria
        const filtered = filterPlaces(places, filters);
        console.log(`[AI] ${cat}: ${places.length} found → ${filtered.length} after filter`);

        if (filtered.length === 0) return [cat, []];

        // 3. Enrich with websites
        const enriched = await enrichWithWebsites(filtered);

        // 4. GPT: Add context (hype, community, content angles)
        const withContext = await addGPTContext(enriched, cat, city);
        console.log(`[AI] ${cat}: ${withContext.length} with context`);

        return [cat, withContext];
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
