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
Recommend places RANKED BY SOCIAL MEDIA PRESENCE - TikTok views, Instagram posts, YouTube features, Google reviews.
Return ONLY valid JSON. No markdown, no code fences.
Include priceNumeric as a number (extract from price string, e.g. "$50/day" -> 50).`;

    const userPrompt = `Trip context:
- Traveler: 33-year-old male content creator
- Party size: ${partySize || 1} person(s)
- Destination: ${city}, ${country}
- Trip length: ${daysTravel || 7} days
- Dates: ${monthName} ${year}
- Primary activity: ${activity || 'general travel'}
- Budget: ${budgetLevel || 'mid'} (lodging max $${dailyHotelMax}/night)
- Equipment needed: ${equipmentType}

Return JSON with these 11 categories, each with exactly 5 recommendations RANKED by viralScore (highest first):

{
  "lodging": [
    {
      "name": "Hotel/Airbnb name",
      "address": "Full address",
      "website": "https://...",
      "price": "$X/night",
      "priceNumeric": X,
      "whyViral": "Why photogenic/instagrammable",
      "socialProof": "TikTok Xk views, IG #hashtag Xk, Google X.X stars",
      "viralScore": 85
    }
  ],
  "coworking": [
    {
      "name": "Space name",
      "address": "Full address",
      "website": "https://...",
      "price": "$X/day or $X/month",
      "priceNumeric": X,
      "whyViral": "Aesthetic, famous visitors",
      "socialProof": "Social media presence",
      "viralScore": 80
    }
  ],
  "motoRental": [
    {
      "name": "Rental shop",
      "address": "Full address",
      "website": "https://...",
      "price": "$X/day or $X/month",
      "priceNumeric": X,
      "whyViral": "Photogenic bikes, scenic routes",
      "socialProof": "Reviews, nomad recommendations",
      "viralScore": 70
    }
  ],
  "equipmentRental": [
    {
      "name": "Shop for ${equipmentType}",
      "address": "Full address",
      "website": "https://...",
      "price": "$X/day or $X/week",
      "priceNumeric": X,
      "whyViral": "Quality gear, content opportunities",
      "socialProof": "Reviews",
      "viralScore": 75
    }
  ],
  "airportTransfers": [
    {
      "name": "Transfer service",
      "address": "Airport pickup",
      "website": "https://...",
      "price": "$X one-way",
      "priceNumeric": X,
      "whyViral": "Reliable, good for arrival content",
      "socialProof": "Reviews",
      "viralScore": 60
    }
  ],
  "brunchCoffee": [
    {
      "name": "Cafe name",
      "address": "Full address",
      "website": "https://...",
      "price": "$X/meal",
      "priceNumeric": X,
      "whyViral": "Aesthetic interior, latte art, food presentation",
      "socialProof": "TikTok features, IG tags",
      "viralScore": 90
    }
  ],
  "dinner": [
    {
      "name": "Restaurant",
      "address": "Full address",
      "website": "https://...",
      "price": "$X/person",
      "priceNumeric": X,
      "whyViral": "Ambiance, plating, views",
      "socialProof": "Viral dishes, reviews",
      "viralScore": 85
    }
  ],
  "activities": [
    {
      "name": "Tour/experience",
      "address": "Meeting point",
      "website": "https://...",
      "price": "$X/person",
      "priceNumeric": X,
      "whyViral": "Scenic, unique content angle",
      "socialProof": "Viral videos",
      "viralScore": 95
    }
  ],
  "nightlife": [
    {
      "name": "Bar/club",
      "address": "Full address",
      "website": "https://...",
      "price": "$X average spend",
      "priceNumeric": X,
      "whyViral": "Atmosphere, events, crowd",
      "socialProof": "IG presence",
      "viralScore": 80
    }
  ],
  "toiletries": [
    {
      "name": "Store/pharmacy",
      "address": "Full address",
      "website": "https://...",
      "price": "$X-X for basics",
      "priceNumeric": X,
      "whyViral": "Convenient, near nomad areas",
      "socialProof": "Nomad recommendations",
      "viralScore": 50
    }
  ],
  "wellness": [
    {
      "name": "Gym/spa/yoga",
      "address": "Full address",
      "website": "https://...",
      "price": "$X/session or $X/month",
      "priceNumeric": X,
      "whyViral": "Aesthetic, popular with creators",
      "socialProof": "IG presence",
      "viralScore": 75
    }
  ]
}

IMPORTANT: 
- All prices MUST stay under budget level
- Lodging MUST be under $${dailyHotelMax}/night
- Include real business names and addresses for ${city}
- priceNumeric should be the main price as a number (for daily items use per-day price)
- Rank by viralScore descending`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 4000,
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
