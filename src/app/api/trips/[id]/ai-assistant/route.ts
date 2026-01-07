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
Your goal is to recommend places RANKED BY SOCIAL MEDIA ATTENTION - prioritize locations with the most TikTok views, Instagram posts, YouTube features, and Google reviews.
Return ONLY valid JSON with no markdown, no code fences, no explanation.`;

    const userPrompt = `Trip context:
- Traveler: 33-year-old male content creator, English speaker
- Party size: ${partySize || 1} person(s)
- Destination: ${city}, ${country}
- Dates: ${monthName} ${year}
- Primary activity: ${activity || 'general travel'}
- Budget level: ${budgetLevel || 'mid'}
- Hotel budget: MAX $${hotelBudget}/month ($${dailyHotelMax}/night)
- Equipment needed: ${equipmentType}

CRITICAL RANKING CRITERIA - Rank ALL recommendations by COMBINED social attention:
1. TikTok views/engagement on location
2. Instagram hashtag count and engagement
3. YouTube video features
4. Google review count and rating
5. Known influencer/creator visits

Each recommendation MUST include:
- "priceNumeric": number extracted from price (e.g. "$50/night" -> 50)
- "viralScore": 1-100 based on combined social media presence

${partySize && partySize > 1 ? `PARTY SIZE NOTE: Recommend places suitable for groups of ${partySize}.` : ''}

Return a JSON object with these 11 categories. Item counts: lodging(5), coworking(5), motoRental(3), equipmentRental(3), airportTransfers(3), brunchCoffee(7), dinner(7), activities(5), nightlife(5), toiletries(3), wellness(5).

{
  "lodging": [
    {
      "name": "Hotel/resort name (suitable for ${partySize || 1} guests)",
      "address": "Full address",
      "website": "https://...",
      "price": "$XX/night (MUST be under $${dailyHotelMax}/night)",
      "priceNumeric": 45,
      "whyViral": "Photogenic features, rooftop pool, ocean views, community vibe",
      "socialProof": "TikTok: Xk views, Instagram: Xk posts, Google: X.X stars (Xk reviews)",
      "viralScore": 85
    }
  ],
  "coworking": [
    {
      "name": "Coworking space name",
      "address": "Full street address",
      "website": "https://...",
      "price": "$XX/day or $XXX/month",
      "priceNumeric": 20,
      "whyViral": "Famous nomad spot, aesthetic design, community events",
      "socialProof": "TikTok: Xk views, Instagram: #hashtag Xk posts, Google: X.X stars",
      "viralScore": 90
    }
  ],
  "motoRental": [
    {
      "name": "Scooter/motorcycle rental",
      "address": "Full address",
      "website": "https://...",
      "price": "$X/day or $XX/month",
      "priceNumeric": 5,
      "whyViral": "Photogenic bikes, scenic routes nearby",
      "socialProof": "Google: X.X stars, nomad recommendations",
      "viralScore": 70
    }
  ],
  "equipmentRental": [
    {
      "name": "Rental shop for ${equipmentType}",
      "address": "Full address",
      "website": "https://...",
      "price": "$XX/day or $XX/week",
      "priceNumeric": 25,
      "whyViral": "Quality gear, where pros rent",
      "socialProof": "Google: X.X stars, known among creators",
      "viralScore": 75
    }
  ],
  "airportTransfers": [
    {
      "name": "Transfer service",
      "address": "Airport pickup",
      "website": "https://...",
      "price": "$XX one-way",
      "priceNumeric": 30,
      "whyViral": "Reliable, no scams",
      "socialProof": "Google: X.X stars (Xk reviews)",
      "viralScore": 60
    }
  ],
  "brunchCoffee": [
    {
      "name": "Cafe/brunch spot",
      "address": "Full address",
      "website": "https://...",
      "price": "$XX average meal",
      "priceNumeric": 15,
      "whyViral": "Aesthetic interior, latte art, instagrammable food",
      "socialProof": "TikTok: Xk views, Instagram: #location Xk posts",
      "viralScore": 92
    }
  ],
  "dinner": [
    {
      "name": "Restaurant name",
      "address": "Full address",
      "website": "https://...",
      "price": "$XX per person",
      "priceNumeric": 35,
      "whyViral": "Sunset views, viral dishes, incredible plating",
      "socialProof": "TikTok: Xk views, Google: X.X stars (Xk reviews)",
      "viralScore": 88
    }
  ],
  "activities": [
    {
      "name": "Activity/experience near ${city}",
      "address": "Location/meeting point",
      "website": "https://...",
      "price": "$XX per person",
      "priceNumeric": 50,
      "whyViral": "THE most viral spot for ${activity || 'adventure'}, incredible backdrop",
      "socialProof": "TikTok: Xm views, YouTube features",
      "viralScore": 95
    }
  ],
  "nightlife": [
    {
      "name": "Bar/club name",
      "address": "Full address",
      "website": "https://...",
      "price": "$XX average spend",
      "priceNumeric": 40,
      "whyViral": "Rooftop views, beach club vibes, where influencers party",
      "socialProof": "Instagram: Xk posts, known DJ nights",
      "viralScore": 85
    }
  ],
  "toiletries": [
    {
      "name": "Pharmacy/store name",
      "address": "Full address",
      "website": "https://...",
      "price": "$X-XX for basics",
      "priceNumeric": 10,
      "whyViral": "Well-stocked, near nomad areas",
      "socialProof": "Google: X.X stars, nomad recommended",
      "viralScore": 50
    }
  ],
  "wellness": [
    {
      "name": "Gym/yoga/spa name",
      "address": "Full address",
      "website": "https://...",
      "price": "$XX/session or $XX/month",
      "priceNumeric": 15,
      "whyViral": "Aesthetic space, ocean/jungle views, creator hotspot",
      "socialProof": "Instagram: Xk posts, influencer visits",
      "viralScore": 80
    }
  ]
}

Return ONLY the JSON object. Rank each category by viralScore descending.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 8000,
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
