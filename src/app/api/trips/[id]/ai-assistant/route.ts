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
      budgetLevel,
      budgetTiers,
      partySize 
    } = body;

    if (!city || !country) {
      return NextResponse.json({ error: 'City and country required' }, { status: 400 });
    }

    const monthName = new Date(year, month - 1).toLocaleString('en-US', { month: 'long' });
    const equipmentType = EQUIPMENT_MAP[activity] || 'activity equipment';
    
    const hotelBudget = budgetTiers?.[budgetLevel] || 2000;
    const dailyHotelMax = Math.floor(hotelBudget / 30);

    const systemPrompt = `You are a viral content trip-planning assistant for digital nomad content creators.
Return ONLY valid JSON. No markdown, no code fences, no explanation.
Include priceNumeric as a number extracted from the price string.
socialProof MUST include specific numbers: TikTok views, Instagram hashtag counts, YouTube features, Google review count and rating.`;

    const userPrompt = `Trip context:
- Traveler: 33-year-old male content creator
- Party size: ${partySize || 1} person(s)
- Destination: ${city}, ${country}
- Trip length: ${daysTravel || 7} days
- Dates: ${monthName} ${year}
- Primary activity: ${activity || 'general travel'}
- Budget: ${budgetLevel || 'mid'} (lodging max $${dailyHotelMax}/night)
- Equipment needed: ${equipmentType}

Return JSON with these 11 categories. IMPORTANT: Follow the exact item count for each category.

{
  "lodging": [ /* EXACTLY 5 items */ ],
  "coworking": [ /* EXACTLY 5 items */ ],
  "motoRental": [ /* EXACTLY 3 items */ ],
  "equipmentRental": [ /* EXACTLY 3 items */ ],
  "airportTransfers": [ /* EXACTLY 3 items */ ],
  "brunchCoffee": [ /* EXACTLY 7 items */ ],
  "dinner": [ /* EXACTLY 7 items */ ],
  "activities": [ /* EXACTLY 5 items */ ],
  "nightlife": [ /* EXACTLY 5 items */ ],
  "toiletries": [ /* EXACTLY 3 items */ ],
  "wellness": [ /* EXACTLY 3 items */ ]
}

Each item must have this structure:
{
  "name": "Business name",
  "address": "Full street address in ${city}",
  "website": "https://actualwebsite.com",
  "price": "$X/unit (night, day, visit, etc)",
  "priceNumeric": 50,
  "whyViral": "Specific visual/content appeal",
  "socialProof": "TikTok: Xk views, IG: #hashtag Xk posts, Google: X.X stars (Xk reviews)",
  "viralScore": 85
}

CRITICAL REQUIREMENTS:
1. lodging MUST be under $${dailyHotelMax}/night
2. socialProof MUST have specific numbers for TikTok, Instagram, Google
3. viralScore 1-100 based on combined social media presence
4. Rank each category by viralScore descending
5. Use REAL businesses with accurate addresses for ${city}, ${country}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 10000,
    });

    const content = completion.choices[0]?.message?.content || '{}';
    
    let recommendations: AIResponse;
    try {
      const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
      recommendations = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('Failed to parse GPT response:', content);
      return NextResponse.json({ error: 'Failed to parse AI response', raw: content }, { status: 500 });
    }

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
