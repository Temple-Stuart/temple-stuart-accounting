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
  whyViral: string;
  socialProof: string;
  viralScore: number;
}

interface AIResponse {
  coworking: Recommendation[];
  hotels: Recommendation[];
  equipmentRental: Recommendation[];
  motorcycleRental: Recommendation[];
  brunchCoffee: Recommendation[];
  dinner: Recommendation[];
  activities: Recommendation[];
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
      budgetLevel,
      budgetTiers,
      partySize 
    } = body;

    if (!city || !country) {
      return NextResponse.json({ error: 'City and country required' }, { status: 400 });
    }

    const monthName = new Date(year, month - 1).toLocaleString('en-US', { month: 'long' });
    const equipmentType = EQUIPMENT_MAP[activity] || 'activity equipment';
    
    // Get the right budget cap based on tier
    const hotelBudget = budgetTiers 
      ? budgetTiers[budgetLevel] 
      : (budgetLevel === 'low' ? 1250 : budgetLevel === 'high' ? 2500 : 2000);
    
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

Each recommendation MUST include a "viralScore" (1-100) based on combined social media presence.
Rank results from highest to lowest viralScore.

${partySize && partySize > 1 ? `PARTY SIZE NOTE: Recommend places suitable for groups of ${partySize}. For hotels, consider rooms/villas that accommodate ${partySize} people. For activities, ensure group bookings are available.` : ''}

Return a JSON object with these 7 categories, each containing exactly 5 recommendations RANKED by viralScore:

{
  "coworking": [
    {
      "name": "Business name",
      "address": "Full street address",
      "website": "https://...",
      "price": "Day pass / monthly price",
      "whyViral": "Specific viral features (aesthetic, unique design, famous visitors)",
      "socialProof": "TikTok: Xk views, Instagram: #hashtag Xk posts, Google: X.X stars (Xk reviews)",
      "viralScore": 85
    }
  ],
  "hotels": [
    {
      "name": "Hotel/resort name (suitable for ${partySize || 1} guests)",
      "address": "Full address",
      "website": "https://...",
      "price": "Per night (MUST be under $${dailyHotelMax}/night)",
      "whyViral": "Photogenic features, rooftop, pool, views, viral moments",
      "socialProof": "TikTok: Xk views, Instagram: Xk posts, YouTube: X features",
      "viralScore": 80
    }
  ],
  "equipmentRental": [
    {
      "name": "Rental shop name (for ${equipmentType})",
      "address": "Full address",
      "website": "https://...",
      "price": "Daily/weekly rate",
      "whyViral": "Quality gear, photogenic shop, content opportunities",
      "socialProof": "Google: X.X stars, known among creators",
      "viralScore": 70
    }
  ],
  "motorcycleRental": [
    {
      "name": "Scooter/motorcycle rental",
      "address": "Full address",
      "website": "https://...",
      "price": "Daily/monthly rate",
      "whyViral": "Photogenic bikes, good for vlogs, scenic routes nearby",
      "socialProof": "Google reviews, nomad community recommendations",
      "viralScore": 65
    }
  ],
  "brunchCoffee": [
    {
      "name": "Cafe/brunch spot",
      "address": "Full address",
      "website": "https://...",
      "price": "Average meal cost",
      "whyViral": "Aesthetic interior, latte art, instagrammable food presentation",
      "socialProof": "TikTok: Xk views, Instagram: #location Xk posts",
      "viralScore": 90
    }
  ],
  "dinner": [
    {
      "name": "Restaurant name",
      "address": "Full address",
      "website": "https://...",
      "price": "Average dinner cost per person",
      "whyViral": "Ambiance, plating, views, unique concept, viral dishes",
      "socialProof": "TikTok features, Google: X.X stars (Xk reviews)",
      "viralScore": 85
    }
  ],
  "activities": [
    {
      "name": "Activity/experience (within 1 hour of ${city})",
      "address": "Location/meeting point",
      "website": "https://...",
      "price": "Cost per person",
      "whyViral": "Why this films well, unique angle, scenic backdrop",
      "socialProof": "Viral videos, TikTok Xk views, YouTube features",
      "viralScore": 95
    }
  ]
}

Return ONLY the JSON object. No markdown, no explanation. Rank each category by viralScore descending.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 4500,
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
      context: { city, country, activity, equipmentType, month: monthName, year, budgetLevel, partySize, hotelBudget }
    });

  } catch (err) {
    console.error('AI Assistant error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'AI request failed' },
      { status: 500 }
    );
  }
}
