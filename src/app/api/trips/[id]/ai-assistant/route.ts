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
    const { city, country, activity, month, year, budgetLevel } = body;

    if (!city || !country) {
      return NextResponse.json({ error: 'City and country required' }, { status: 400 });
    }

    const monthName = new Date(year, month - 1).toLocaleString('en-US', { month: 'long' });
    const equipmentType = EQUIPMENT_MAP[activity] || 'activity equipment';

    const systemPrompt = `You are a viral content trip-planning assistant for digital nomad content creators.
Your goal is to recommend places that are HIGHLY PHOTOGENIC and likely to perform well on TikTok/Instagram.
Return ONLY valid JSON with no markdown, no code fences, no explanation.`;

    const userPrompt = `Trip context:
- Traveler: 33-year-old male content creator, English speaker
- Destination: ${city}, ${country}
- Dates: ${monthName} ${year}
- Primary activity: ${activity || 'general travel'}
- Budget level: ${budgetLevel || 'mid'}
- Hotel budget (MAX per month): ${budgetLevel === 'low' ? '$1,250' : budgetLevel === 'high' ? '$2,500' : '$2,000'}
- Equipment needed: ${equipmentType}

CRITICAL: All recommendations must be REAL businesses with accurate addresses and websites. Focus on places that are:
1. Highly aesthetic / Instagram-worthy
2. Popular with influencers and content creators
3. Likely to go viral when filmed
4. Known in the digital nomad community

Return a JSON object with these 7 categories, each containing exactly 5 recommendations:

{
  "coworking": [
    {
      "name": "Business name",
      "address": "Full street address",
      "website": "https://...",
      "price": "Day pass / monthly price",
      "whyViral": "Why this is great for content (aesthetic, unique features, famous visitors)",
      "socialProof": "TikTok views, Instagram tags, famous nomads who work here"
    }
  ],
  "hotels": [
    {
      "name": "Hotel/resort name",
      "address": "Full address",
      "website": "https://...",
      "price": "Per night (MUST be under monthly cap above when x30)",
      "whyViral": "Photogenic features, rooftop, pool, views",
      "socialProof": "Instagram presence, influencer stays, viral posts"
    }
  ],
  "equipmentRental": [
    {
      "name": "Rental shop name (for ${equipmentType})",
      "address": "Full address",
      "website": "https://...",
      "price": "Daily/weekly rate",
      "whyViral": "Quality gear, photogenic shop, good for content",
      "socialProof": "Reviews, known among nomads"
    }
  ],
  "motorcycleRental": [
    {
      "name": "Scooter/motorcycle rental",
      "address": "Full address",
      "website": "https://...",
      "price": "Daily/monthly rate",
      "whyViral": "Reliable, photogenic bikes, good for vlogs",
      "socialProof": "Nomad recommendations, Google reviews"
    }
  ],
  "brunchCoffee": [
    {
      "name": "Cafe/brunch spot",
      "address": "Full address",
      "website": "https://...",
      "price": "Average meal cost",
      "whyViral": "Aesthetic interior, latte art, brunch presentation",
      "socialProof": "Instagram tags, TikTok features, influencer visits"
    }
  ],
  "dinner": [
    {
      "name": "Restaurant name",
      "address": "Full address",
      "website": "https://...",
      "price": "Average dinner cost",
      "whyViral": "Ambiance, plating, views, unique concept",
      "socialProof": "Reviews, viral dishes, celebrity visits"
    }
  ],
  "activities": [
    {
      "name": "Activity/experience name (within 1 hour of ${city})",
      "address": "Location/meeting point",
      "website": "https://...",
      "price": "Cost per person",
      "whyViral": "Why this films well, unique angle, scenic",
      "socialProof": "Viral videos, popular tours, view counts"
    }
  ]
}

Return ONLY the JSON object. No markdown, no explanation.`;

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
      context: { city, country, activity, equipmentType, month: monthName, year, budgetLevel }
    });

  } catch (err) {
    console.error('AI Assistant error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'AI request failed' },
      { status: 500 }
    );
  }
}
