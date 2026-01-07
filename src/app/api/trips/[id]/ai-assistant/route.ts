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

    const systemPrompt = `You are a viral content strategist who has helped creators get millions of views. You know EXACTLY which locations, spots, and experiences CREATE VIRAL MOMENTS.

You don't recommend "nice" places. You recommend places that will make people STOP SCROLLING. Places with:
- THE biggest waves, THE best views, THE most insane experiences
- Proven viral track records - places that have launched creators to millions of followers
- Community hotspots where successful nomads and creators actually network
- Hidden gems that are about to blow up
- Extreme, unique, one-of-a-kind experiences that make people say "WHERE IS THIS?!"

You think like a content strategist: "What will make this person's video go viral?"

CRITICAL: Return ONLY valid JSON. No markdown, no code fences, no explanation.`;

    const userPrompt = `I NEED TO GO VIRAL. I'm a content creator going to ${city}, ${country} in ${monthName} ${year}.

Party size: ${partySize || 1}
Trip length: ${daysTravel || 7} days
Primary activity: ${activity || 'general travel'}
Max lodging: $${dailyHotelMax}/night
Equipment: ${equipmentType}

Give me the spots that will make my content EXPLODE. Not tourist traps. Not "nice" places. I want:

🏨 LODGING (5 items):
- Where do the SUCCESSFUL creators and digital nomads actually stay?
- Places with INSANE views, rooftop infinity pools, jungle treehouse vibes
- Hotels/hostels known for their COMMUNITY - where you meet other creators
- The spots that look UNREAL on camera

🏢 COWORKING (5 items):
- THE most famous nomad coworking spaces in ${city}
- Where do people with 100k+ followers actually work?
- Spaces that have been featured in "digital nomad" viral videos
- Best for networking with other successful creators

🏍️ MOTO RENTAL (3 items):
- Rentals with the most photogenic bikes/scooters
- Access to the best scenic routes for content

🏄 EQUIPMENT - ${equipmentType} (3 items):
- THE best gear for ${activity} in ${city}
- Where the pros rent from

🚕 AIRPORT TRANSFERS (3 items):
- Reliable pickups that won't scam tourists

☕ BRUNCH & COFFEE (7 items):
- THE most Instagrammed cafes in ${city} - the ones you've seen in every nomad's feed
- Places with insane latte art, photogenic food, aesthetic interiors
- Cafes that have literally gone viral on TikTok
- The "you HAVE to go here" spots that every creator posts about

🍽️ DINNER (7 items):
- Restaurants with VIRAL dishes - the ones people film eating
- Insane sunset views, unique dining concepts
- Places where the presentation makes people STOP and film
- The dinner spots that get millions of views on food TikTok

🎯 ACTIVITIES (5 items):
- THE most extreme, photogenic experiences near ${city}
- For ${activity}: Where are THE biggest waves? THE best trails? THE most insane spots?
- Experiences that make viewers say "I NEED to do this"
- Activities that have gone viral - cliff jumps, hidden waterfalls, secret spots
- Things you can ONLY do in ${city} that will make people jealous

🎉 NIGHTLIFE (5 items):
- THE beach clubs and rooftop bars creators post about
- Places with incredible atmosphere that films well
- Where do influencers actually party in ${city}?
- Sunset spots that are GUARANTEED good content

🛒 TOILETRIES (3 items):
- Best stocked stores near nomad areas

💆 WELLNESS (5 items):
- THE gym where fit creators work out in ${city}
- Yoga studios with INSANE views that go viral
- Wellness experiences that look incredible on camera
- Places where you'll see other creators

VIRAL SCORE (1-100) based on:
- Has this place actually gone viral? (TikToks with 1M+ views?)
- How likely is content from here to blow up?
- Is this a "must-post" location that creators are known for?

Return this exact JSON structure:
{
  "lodging": [{name, address, website, price, priceNumeric, whyViral, socialProof, viralScore}],
  "coworking": [...],
  "motoRental": [...],
  "equipmentRental": [...],
  "airportTransfers": [...],
  "brunchCoffee": [...],
  "dinner": [...],
  "activities": [...],
  "nightlife": [...],
  "toiletries": [...],
  "wellness": [...]
}

socialProof format: "TikTok: Xm views on #location, IG: #hashtag Xk posts, Google: X.X (Xk reviews)"

REQUIREMENTS:
1. Lodging under $${dailyHotelMax}/night
2. ONLY REAL businesses in ${city} - accurate names, addresses, websites
3. Rank by viralScore (highest potential to go viral = first)
4. I want places that will make my content BLOW UP, not generic recommendations`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.8,
      max_tokens: 12000,
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
