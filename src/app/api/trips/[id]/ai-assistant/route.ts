import { NextRequest, NextResponse } from 'next/server';
import { verifyTopItems } from '@/lib/verification';
import openai from '@/lib/openai';

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
  lastReviewDate?: string;
  openConfidence?: 'High' | 'Medium' | 'Low';
  verificationSource?: string;
}

interface CategoryRequest {
  category: string;
  city: string;
  country: string;
  dates: { start: string; end: string };
  filters: Record<string, any>;
}

const CATEGORY_PROMPTS: Record<string, (ctx: any) => string> = {
  lodging: (ctx) => `Find the TOP 10 VIRAL HOTELS/HOSTELS in ${ctx.city}, ${ctx.country} for a digital nomad content creator.

REQUIREMENTS:
- Party size: ${ctx.filters.partySize || 1} people
- Need: ${ctx.filters.beds || 1} private room(s) with private bathroom(s)
- Max budget: $${ctx.filters.maxBudget || 100}/night
- Dates: ${ctx.dates.start} to ${ctx.dates.end}
- MUST have: Private rooms, private bathrooms, good WiFi

TARGET CROWD: Digital nomads, entrepreneurs, startup founders, influencers, content creators. Places where I can network and level up.

VIRAL RANKING CRITERIA (viralScore 1-100):
- Instagram hashtag count and engagement
- TikTok views on location tags
- YouTube vlog features
- Facebook check-ins and reviews
- Reddit mentions in r/digitalnomad, r/travel
- Google review count + rating

Return JSON array of 10 hotels, ranked by viralScore (highest first):
[{
  "name": "Hotel name",
  "address": "Full address",
  "website": "https://...",
  "price": "$X/night, $X/week, $X/month",
  "priceDaily": 45,
  "priceWeekly": 280,
  "priceMonthly": 900,
  "whyViral": "Why this place creates viral content - specific features",
  "socialProof": "IG: #hashtag Xk posts, TikTok: Xm views, Google: X.X (Xk reviews), FB: Xk check-ins",
  "viralScore": 92
}]

CRITICAL: Only include places that are CURRENTLY OPEN. No closed businesses.`,

  coworking: (ctx) => `Find the TOP 10 VIRAL COWORKING SPACES in ${ctx.city}, ${ctx.country} for a hardcore digital nomad.

REQUIREMENTS:
- Near: ${ctx.filters.nearHotel || 'city center'}
- MUST have: Fast reliable internet (100+ Mbps)
- Prefer: 24/7 access (I work 16 hour days)
- Prefer: External monitors available
- Prefer: Cafe on-site
- Bonus: Cold plunge, hot tub, gym, yoga

TARGET CROWD: Entrepreneurs, startup founders, content creators. Looking for networking and grinding with like-minded people.

VIRAL RANKING CRITERIA (viralScore 1-100):
- Instagram presence and hashtags
- TikTok features from nomad creators
- YouTube "best coworking in ${ctx.city}" mentions
- Reddit r/digitalnomad recommendations
- Google review count + rating

Return JSON array of 10 coworking spaces, ranked by viralScore:
[{
  "name": "Space name",
  "address": "Full address",
  "website": "https://...",
  "price": "$X/day, $X/week, $X/month",
  "priceDaily": 15,
  "priceWeekly": 80,
  "priceMonthly": 200,
  "whyViral": "What makes this space iconic for content creators",
  "socialProof": "IG: Xk posts, TikTok: Xk views, Google: X.X (Xk reviews)",
  "viralScore": 88
}]

CRITICAL: Only include places that are CURRENTLY OPEN.`,

  motoRental: (ctx) => `Find the TOP 10 MOTO/SCOOTER/CAR RENTAL shops in ${ctx.city}, ${ctx.country}.

REQUIREMENTS:
- Near: ${ctx.filters.nearHotel || 'city center'}
- Types: Scooters, motos, enduro bikes, cars
- Need: Day, week, and month rates

VIRAL RANKING: Places that look good on camera, scenic route access, photogenic bikes.

Return JSON array of 10 rental shops, ranked by viralScore:
[{
  "name": "Shop name",
  "address": "Full address",
  "website": "https://...",
  "price": "$X/day, $X/week, $X/month",
  "priceDaily": 7,
  "priceWeekly": 40,
  "priceMonthly": 120,
  "whyViral": "Photogenic bikes, scenic routes nearby",
  "socialProof": "Google: X.X (Xk reviews), nomad recommended",
  "viralScore": 75
}]`,

  equipmentRental: (ctx) => `Find the TOP 10 ${ctx.filters.equipmentType || 'surf/sports'} EQUIPMENT RENTAL shops in ${ctx.city}, ${ctx.country}.

Looking for: The coolest local pro shops with quality ${ctx.filters.equipmentType || 'gear'}.

VIRAL RANKING: Places where pros rent, good for content creation.

Return JSON array of 10 shops, ranked by viralScore:
[{
  "name": "Shop name",
  "address": "Full address",
  "website": "https://...",
  "price": "$X/day, $X/week, $X/month",
  "priceDaily": 25,
  "priceWeekly": 150,
  "priceMonthly": 400,
  "whyViral": "Pro-quality gear, content-friendly",
  "socialProof": "Google: X.X (Xk reviews)",
  "viralScore": 80
}]`,

  airportTransfers: (ctx) => `Find the TOP 5 AIRPORT TRANSFER services in ${ctx.city}, ${ctx.country}.

Need: Reliable transfer from airport to hotel. No scams. Good for filming arrival content.

Return JSON array of 5 services:
[{
  "name": "Service name",
  "address": "Airport pickup",
  "website": "https://...",
  "price": "$X one-way",
  "priceDaily": 30,
  "whyViral": "Smooth arrival, good for content",
  "socialProof": "Google: X.X (Xk reviews)",
  "viralScore": 70
}]`,

  brunchCoffee: (ctx) => `Find the TOP 10 MOST VIRAL CAFES/BRUNCH spots in ${ctx.city}, ${ctx.country}.

REQUIREMENTS:
- Budget: Max $${ctx.filters.maxBudget || 5} per meal (coffee + food)
- Goal: THE BEST CUP OF COFFEE in the area
- Goal: Most Instagrammable food presentation

VIRAL RANKING: Places that have ACTUALLY gone viral on TikTok, Instagram, YouTube.

Return JSON array of 10 cafes, ranked by viralScore:
[{
  "name": "Cafe name",
  "address": "Full address",
  "website": "https://...",
  "menuUrl": "https://.../menu",
  "price": "$X average meal",
  "priceDaily": 5,
  "whyViral": "Aesthetic interior, viral latte art, instagrammable food",
  "socialProof": "TikTok: Xm views, IG: #cafe Xk posts, Google: X.X",
  "viralScore": 95
}]`,

  dinner: (ctx) => `Find the TOP 10 MOST VIRAL DINNER spots in ${ctx.city}, ${ctx.country}.

REQUIREMENTS:
- Budget: Max $${ctx.filters.maxBudget || 15} per meal (appetizer + drink + entree)
- Goal: Restaurants with VIRAL dishes, incredible plating, sunset views

VIRAL RANKING: Places featured in food TikToks, travel vlogs, food blogs.

Return JSON array of 10 restaurants, ranked by viralScore:
[{
  "name": "Restaurant name",
  "address": "Full address",
  "website": "https://...",
  "menuUrl": "https://.../menu",
  "price": "$X per person",
  "priceDaily": 15,
  "whyViral": "Viral dishes, incredible presentation, views",
  "socialProof": "TikTok: Xm views, IG: Xk posts, Google: X.X",
  "viralScore": 90
}]`,

  activities: (ctx) => `Find the TOP 10 MOST VIRAL ACTIVITIES/EXPERIENCES near ${ctx.city}, ${ctx.country}.

Looking for UNFORGETTABLE experiences:
- THE biggest waves to surf
- THE highest mountain to hike
- THE best cliff jumping spots
- THE most scenic moped routes
- THE most extreme adventures

Goal: Create a SICK reel that will go MASSIVELY VIRAL.

Return JSON array of 10 activities, ranked by viralScore:
[{
  "name": "Activity name",
  "address": "Location/meeting point",
  "website": "https://...",
  "price": "$X per person",
  "priceDaily": 50,
  "whyViral": "THE most extreme/photogenic experience - specific details",
  "socialProof": "TikTok: Xm views, YouTube features, viral reels",
  "viralScore": 98
}]`,

  nightlife: (ctx) => `Find the TOP 10 MOST VIRAL NIGHTLIFE spots in ${ctx.city}, ${ctx.country}.

Looking for: Local culture, rooftop bars, beach clubs, places that create unforgettable memories for content.

Return JSON array of 10 venues, ranked by viralScore:
[{
  "name": "Venue name",
  "address": "Full address",
  "website": "https://...",
  "price": "$X average spend",
  "priceDaily": 40,
  "whyViral": "Local culture, incredible atmosphere, content-worthy",
  "socialProof": "IG: Xk posts, TikTok: Xk views",
  "viralScore": 85
}]`,

  toiletries: (ctx) => `Find the TOP 5 STORES/PHARMACIES near ${ctx.filters.nearHotel || 'city center'} in ${ctx.city}, ${ctx.country}.

Looking for: Places to buy deodorant, toothpaste, shampoo, conditioner, bodywash, mouthwash.
Also: Any delivery services? (Grab, local apps)

Return JSON array of 5 stores:
[{
  "name": "Store name",
  "address": "Full address",
  "website": "https://...",
  "price": "$X-XX for basics",
  "priceDaily": 10,
  "whyViral": "Well-stocked, near nomad areas, delivery available",
  "socialProof": "Google: X.X stars",
  "viralScore": 50
}]`,

  wellness: (ctx) => `Find the TOP 10 MOST VIRAL WELLNESS/GYM spots in ${ctx.city}, ${ctx.country}.

MUST HAVE at least some of: Ice bath, sauna, yoga, fight classes, gym equipment.

TARGET CROWD: Expat community, entrepreneurs, content creators. Places good for filming fitness content.

Return JSON array of 10 wellness spots, ranked by viralScore:
[{
  "name": "Gym/spa name",
  "address": "Full address",
  "website": "https://...",
  "price": "$X/session, $X/week, $X/month",
  "priceDaily": 15,
  "priceWeekly": 60,
  "priceMonthly": 150,
  "whyViral": "Ice bath + sauna combo, expat community, content-friendly",
  "socialProof": "IG: Xk posts, Google: X.X (Xk reviews)",
  "viralScore": 88
}]`
};

async function fetchCategory(category: string, ctx: any): Promise<Recommendation[]> {
  const promptFn = CATEGORY_PROMPTS[category];
  if (!promptFn) {
    console.error(`No prompt for category: ${category}`);
    return [];
  }

  const prompt = promptFn(ctx);
  
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: `You are a viral travel content strategist. Return ONLY a valid JSON array. No markdown, no code fences.

CRITICAL EXCLUSION RULES:
- EXCLUDE any business that is permanently closed
- EXCLUDE any business marked "temporarily closed" 
- EXCLUDE any business with no reviews in the last 90 days
- EXCLUDE any business you are not confident is currently operating

Each item MUST include these verification fields:
- lastReviewDate: "Month Year" of most recent Google/TripAdvisor review
- openConfidence: "High" | "Medium" | "Low" based on your confidence it's open
- verificationSource: "Google Maps", "Official Website", "TripAdvisor", etc.

Only include businesses with openConfidence of "High" or "Medium".` },
        { role: 'user', content: prompt }
      ],
      temperature: 0.5,
      max_tokens: 4000,
    });

    const content = completion.choices[0]?.message?.content || '[]';
    console.log(`[AI] ${category}: ${content.length} chars`);
    
    const cleaned = content.replace(/\`\`\`json\n?|\n?\`\`\`/g, '').trim();
    const parsed = JSON.parse(cleaned);
    console.log(`[AI] ${category}: ${parsed.length} items`);
    return parsed;
  } catch (err) {
    console.error(`[AI] ${category} FAILED:`, err);
    return [];
  }
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
      nearHotel = '',
      equipmentType = 'surf gear',
      categories = ['lodging', 'coworking', 'motoRental', 'equipmentRental', 'airportTransfers', 'brunchCoffee', 'dinner', 'activities', 'nightlife', 'toiletries', 'wellness']
    } = body;

    if (!city || !country) {
      return NextResponse.json({ error: 'City and country required' }, { status: 400 });
    }

    const monthName = new Date(year, month - 1).toLocaleString('en-US', { month: 'long' });
    const startDate = `${monthName} 1, ${year}`;
    const endDate = `${monthName} ${daysTravel}, ${year}`;

    const ctx = {
      city,
      country,
      dates: { start: startDate, end: endDate },
      filters: {
        partySize,
        beds,
        maxBudget: lodgingBudget,
        nearHotel,
        equipmentType,
        brunchBudget,
        dinnerBudget
      }
    };

    // Fetch all categories in parallel
    const results = await Promise.all(
      categories.map(async (cat: string) => {
        // Adjust budget per category
        const catCtx = { ...ctx };
        if (cat === 'brunchCoffee') catCtx.filters.maxBudget = brunchBudget;
        if (cat === 'dinner') catCtx.filters.maxBudget = dinnerBudget;
        if (cat === 'lodging') catCtx.filters.maxBudget = lodgingBudget;
        
        const items = await fetchCategory(cat, catCtx);
        
        // Verify top 3 items per category
        const verifiedItems = await verifyTopItems(items, city, country, cat, 3);
        return [cat, verifiedItems];
      })
    );

    const recommendations = Object.fromEntries(results);

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
