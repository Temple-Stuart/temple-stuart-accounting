// xAI Grok client - with x_search and web_search for real-time intelligence

const XAI_API_URL = 'https://api.x.ai/v1';

interface GrokMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GrokChatResponse {
  id: string;
  choices: {
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Chat completion (OpenAI-compatible)
export async function grokChat(options: {
  model?: string;
  messages: GrokMessage[];
  temperature?: number;
  max_tokens?: number;
}): Promise<GrokChatResponse> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error('XAI_API_KEY not configured');
  }

  const body = {
    model: options.model || 'grok-3-latest',
    messages: options.messages,
    temperature: options.temperature ?? 0.3,
    max_tokens: options.max_tokens ?? 8000,
  };

  const response = await fetch(XAI_API_URL + '/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[Grok] API error:', response.status, error);
    throw new Error('Grok API error: ' + response.status);
  }

  return response.json();
}

// Analyze places with Grok (no x_search/web_search for now - use prompt-based)
export async function analyzePlacesWithSentiment(options: {
  places: Array<{
    name: string;
    address: string;
    rating: number;
    reviewCount: number;
    website?: string;
    photoUrl?: string;
    category: string;
  }>;
  destination: string;
  activities: string[];
  profile: {
    tripType: string;
    budget: string;
    priorities: string[];
    dealbreakers: string[];
    groupSize: number;
  };
  month?: string;
  year?: number;
}): Promise<Array<{
  name: string;
  address: string;
  website: string | null;
  photoUrl: string | null;
  googleRating: number;
  reviewCount: number;
  sentimentScore: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  summary: string;
  warnings: string[];
  trending: boolean;
  fitScore: number;
  valueRank: number;
  category: string;
}>> {
  const { places, destination, activities, profile, month, year } = options;
  
  if (places.length === 0) return [];

  // Build the place list for Grok
  const placeList = places.map((p, i) => 
    (i + 1) + '. ' + p.name + ' | ' + p.category + ' | Rating: ' + p.rating + ' (' + p.reviewCount + ' reviews) | ' + p.address
  ).join('\n');

  const activitiesStr = activities.join(', ');
  const timeframe = month && year ? month + ' ' + year : 'upcoming trip';

  const prompt = `You are a travel intelligence analyst helping plan a trip.

DESTINATION: ${destination}
TRAVELER ACTIVITIES: ${activitiesStr || 'General tourism'}
TRIP TYPE: ${profile.tripType}
BUDGET: ${profile.budget}
GROUP SIZE: ${profile.groupSize}
PRIORITIES: ${(profile.priorities || []).join(', ') || 'Best value'}
DEALBREAKERS: ${(profile.dealbreakers || []).join(', ') || 'None'}
TIMEFRAME: ${timeframe}

Here are ${places.length} places from Google Maps to analyze:

${placeList}

YOUR TASK:
1. Based on your knowledge of ${destination}, analyze each place
2. Consider what travelers typically say about these places
3. Determine how well each place fits the traveler's activities and profile
4. Rank all places by combined value (Google rating x fit for this traveler)

For EACH place, return:
- index: The number from the list (1-indexed)
- sentimentScore: 1-10 based on general reputation (10 = excellent reputation)
- sentiment: "positive" | "neutral" | "negative"
- summary: 2-3 sentences about this place and why it might work for this traveler
- warnings: Array of potential concerns (empty array if none)
- trending: true if this is a popular/buzzy spot, false otherwise
- fitScore: 1-10 how well this matches the traveler's activities and profile
- valueRank: Final ranking 1 to ${places.length} (1 = best overall value for this traveler)

IMPORTANT:
- Be specific in summaries based on the place type and traveler needs
- Warnings should be actionable - specific issues travelers should know
- Consider the activities: ${activitiesStr || 'general tourism'}

Return ONLY a valid JSON array, no markdown:
[{"index": 1, "sentimentScore": 8, "sentiment": "positive", "summary": "...", "warnings": [], "trending": true, "fitScore": 9, "valueRank": 1}]`;

  try {
    const response = await grokChat({
      model: 'grok-3-latest',
      messages: [
        { 
          role: 'system', 
          content: 'You are a travel analyst. Return only valid JSON array with no markdown formatting.' 
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 12000,
    });

    const content = response.choices[0]?.message?.content || '[]';
    const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
    
    let rankings: any[];
    try {
      rankings = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('[Grok] JSON parse error:', parseErr);
      console.error('[Grok] Raw content:', content.substring(0, 500));
      return [];
    }

    // Merge Grok analysis with original place data
    const results = rankings.map((rank: any) => {
      const place = places[rank.index - 1];
      if (!place) return null;

      return {
        name: place.name,
        address: place.address,
        website: place.website || null,
        photoUrl: place.photoUrl || null,
        googleRating: place.rating,
        reviewCount: place.reviewCount,
        sentimentScore: rank.sentimentScore || 5,
        sentiment: rank.sentiment || 'neutral',
        summary: rank.summary || 'No analysis available.',
        warnings: rank.warnings || [],
        trending: rank.trending || false,
        fitScore: rank.fitScore || 5,
        valueRank: rank.valueRank || 99,
        category: place.category
      };
    }).filter((x): x is NonNullable<typeof x> => x !== null);

    // Sort by valueRank
    results.sort((a, b) => a.valueRank - b.valueRank);

    return results;

  } catch (err) {
    console.error('[Grok] Analysis failed:', err);
    return [];
  }
}

export default { grokChat, analyzePlacesWithSentiment };
