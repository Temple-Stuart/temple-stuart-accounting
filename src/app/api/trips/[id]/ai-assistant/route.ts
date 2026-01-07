import { NextRequest, NextResponse } from 'next/server';
import openai from '@/lib/openai';

const EQUIPMENT_MAP: Record<string, string> = {
  snowboard: 'snowboard and ski gear',
  mtb: 'mountain bike',
  surf: 'surfboard',
  kitesurf: 'kitesurfing gear',
  sail: 'sailing equipment',
  golf: 'golf clubs',
  bike: 'road/gravel bike',
  run: 'running gear',
  triathlon: 'triathlon gear (bike, wetsuit)',
  skate: 'skateboard',
  festival: 'festival gear',
  conference: 'laptop/tech accessories',
};

interface Recommendation {
  name: string;
  address: string;
  website: string;
  price: string;
  priceNumeric: number;
  whyViral: string;
  socialProof: string;
  viralScore: number;
}

interface AIResponse {
  lodging: Recommendation[];
  coworking: Recommendation[];
  motoRental: Recommendation[];
  equipmentRental: Recommendation[];
  airportTransfers: Recommendation[];
  brunchCoffee: Recommendation[];
  dinner: Recommendation[];
  activities: Recommendation[];
  nightlife: Recommendation[];
  toiletries: Recommendation[];
  wellness: Recommendation[];
}

const systemPrompt = `You are a travel researcher. Return ONLY valid JSON - no markdown, no explanation.
CRITICAL: Only include businesses you are CONFIDENT actually exist. If unsure, skip it.
Include accurate prices. If you don't know the price, use a reasonable estimate and note it.`;

async function fetchBatch(
  city: string, 
  country: string, 
  categories: string, 
  context: string
): Promise<Record<string, Recommendation[]>> {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Location: ${city}, ${country}
${context}

Return JSON for these categories: ${categories}

Each item needs: name, address, website, price (with currency/unit), priceNumeric (number only), whyViral (why content creators love it), socialProof (TikTok/IG/Google stats), viralScore (1-100).

ONLY include places you're CONFIDENT exist. Quality over quantity.
Return valid JSON object with category keys.` }
    ],
    temperature: 0.3,
    max_tokens: 4000,
  });

  const content = completion.choices[0]?.message?.content || '{}';
  const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
  return JSON.parse(cleaned);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json();
    const { city, country, activity, month, year, daysTravel, budgetLevel, budgetTiers, partySize } = body;

    if (!city || !country) {
      return NextResponse.json({ error: 'City and country required' }, { status: 400 });
    }

    const monthName = new Date(year, month - 1).toLocaleString('en-US', { month: 'long' });
    const equipmentType = EQUIPMENT_MAP[activity] || 'activity equipment';
    const hotelBudget = budgetTiers?.[budgetLevel] || 2000;
    const dailyHotelMax = Math.floor(hotelBudget / 30);

    const baseContext = `Traveler: Content creator, ${partySize || 1} person(s), ${monthName} ${year}
Activity focus: ${activity || 'general'}
Looking for: VIRAL, Instagram/TikTok-worthy spots popular with digital nomads and influencers`;

    // Batch 1: Accommodation & Work
    const batch1 = await fetchBatch(city, country, 
      `"lodging" (5 items - max $${dailyHotelMax}/night, popular with nomads, great views/community), "coworking" (5 items - famous nomad spaces, aesthetic, good wifi)`,
      baseContext
    );

    // Batch 2: Food
    const batch2 = await fetchBatch(city, country,
      `"brunchCoffee" (7 items - most Instagrammed cafes, aesthetic, viral food), "dinner" (7 items - viral restaurants, sunset views, incredible plating)`,
      baseContext
    );

    // Batch 3: Activities & Nightlife
    const batch3 = await fetchBatch(city, country,
      `"activities" (5 items - most extreme/photogenic experiences for ${activity || 'adventure'}, THE spots that go viral), "nightlife" (5 items - rooftop bars, beach clubs, where influencers party), "wellness" (5 items - aesthetic gyms, yoga with views, creator hotspots)`,
      baseContext
    );

    // Batch 4: Transport & Essentials
    const batch4 = await fetchBatch(city, country,
      `"motoRental" (3 items - scooter/bike rentals), "equipmentRental" (3 items - ${equipmentType}), "airportTransfers" (3 items - reliable services), "toiletries" (3 items - pharmacies/stores near nomad areas)`,
      baseContext
    );

    // Combine all batches
    const recommendations: AIResponse = {
      lodging: batch1.lodging || [],
      coworking: batch1.coworking || [],
      brunchCoffee: batch2.brunchCoffee || [],
      dinner: batch2.dinner || [],
      activities: batch3.activities || [],
      nightlife: batch3.nightlife || [],
      wellness: batch3.wellness || [],
      motoRental: batch4.motoRental || [],
      equipmentRental: batch4.equipmentRental || [],
      airportTransfers: batch4.airportTransfers || [],
      toiletries: batch4.toiletries || [],
    };

    return NextResponse.json({ 
      recommendations,
      context: { city, country, activity, equipmentType, month: monthName, year, daysTravel, budgetLevel, partySize, hotelBudget }
    });

  } catch (err) {
    console.error('AI Assistant error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'AI request failed' },
      { status: 500 }
    );
  }
}
