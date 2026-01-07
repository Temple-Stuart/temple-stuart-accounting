import { NextRequest, NextResponse } from 'next/server';
import openai from '@/lib/openai';

interface LodgingRecommendation {
  name: string;
  neighborhood: string;
  whyGoodForNomads: string;
  priceRange: string;
  wifiNotes: string;
  distanceToCoworking: string;
  distanceToActivity: string;
  socialProof: string[];
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json();
    const { city, country, activity, month, year, budgetLevel, minPrice, maxPrice, currency } = body;

    if (!city || !country) {
      return NextResponse.json({ error: 'City and country required' }, { status: 400 });
    }

    const monthName = new Date(year, month - 1).toLocaleString('en-US', { month: 'long' });

    const systemPrompt = `You are a trip-planning and budgeting assistant for digital nomads.
Return ONLY valid JSON with no markdown, no code fences, no explanation.
Return an array of exactly 5 lodging recommendation objects.`;

    const userPrompt = `Trip context:
- Traveler: 33-year-old male, English speaker
- Destination city: ${city}, ${country}
- Dates: ${monthName} ${year}
- Primary activity interest: ${activity || 'general travel'}
- Budget level: ${budgetLevel || 'mid'} (target nightly range: ${minPrice || 80}-${maxPrice || 200} ${currency || 'USD'})
- Must-haves: private room + private bathroom, reliable Wi-Fi, safe area, walkable to food/coffee

Goal: Recommend the top 5 lodging options that maximize:
- Strong digital nomad / expat presence
- English-speaking community
- Easy community-building (social spaces, events, coworking nearby, walkable neighborhood)
- Proximity to ${activity || 'local attractions'} (or easy transport)

For each lodging option, return this exact JSON structure:
{
  "name": "string",
  "neighborhood": "string", 
  "whyGoodForNomads": "string (specific signals)",
  "priceRange": "string (e.g. $80-120/night)",
  "wifiNotes": "string (work suitability)",
  "distanceToCoworking": "string (e.g. 5 min walk to WeWork)",
  "distanceToActivity": "string (e.g. 15 min to ski lift)",
  "socialProof": ["string array of 2-3 signals"]
}

Return ONLY a JSON array of 5 objects. No markdown, no explanation.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const content = completion.choices[0]?.message?.content || '[]';
    
    // Parse JSON response
    let recommendations: LodgingRecommendation[] = [];
    try {
      // Strip any markdown code fences if present
      const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
      recommendations = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('Failed to parse GPT response:', content);
      return NextResponse.json({ error: 'Failed to parse AI response', raw: content }, { status: 500 });
    }

    return NextResponse.json({ 
      recommendations,
      context: { city, country, activity, month: monthName, year, budgetLevel }
    });

  } catch (err) {
    console.error('AI Assistant error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'AI request failed' },
      { status: 500 }
    );
  }
}
