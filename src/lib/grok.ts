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

// Chat completion with optional tools (x_search, web_search)
export async function grokChat(options: {
  model?: string;
  messages: GrokMessage[];
  temperature?: number;
  max_tokens?: number;
  tools?: Array<{ type: string }>;
}): Promise<GrokChatResponse> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error('XAI_API_KEY not configured');
  }

  const body: any = {
    model: options.model || 'grok-4',
    messages: options.messages,
    temperature: options.temperature ?? 0.3,
    max_tokens: options.max_tokens ?? 8000,
  };

  // Add tools if specified
  if (options.tools && options.tools.length > 0) {
    body.tools = options.tools;
  }

  const response = await fetch(`${XAI_API_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[Grok] API error:', response.status, error);
    throw new Error(`Grok API error: ${response.status}`);
  }

  return response.json();
}

// Analyze places with real-time X + web search
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
    `${i + 1}. ${p.name} | ${p.category} | ⭐${p.rating} (${p.reviewCount} reviews) | ${p.address}`
  ).join('\n');

  const activitiesStr = activities.join(', ');
  const timeframe = month && year ? `${month} ${year}` : 'upcoming trip';

  const prompt = `You are a travel intelligence analyst with access to real-time X (Twitter) and web data.

DESTINATION: ${destination}
TRAVELER ACTIVITIES: ${activitiesStr}
TRIP TYPE: ${profile.tripType}
BUDGET: ${profile.budget}
GROUP SIZE: ${profile.groupSize}
PRIORITIES: ${profile.priorities.join(', ') || 'Best value'}
DEALBREAKERS: ${profile.dealbreakers.join(', ') || 'None'}
TIMEFRAME: ${timeframe}

Here are ${places.length} places from Google Maps to analyze:

${placeList}

YOUR TASK:
1. Use x_search to find recent X/Twitter posts, mentions, and discussions about EACH place
2. Use web_search to find recent reviews, news, and travel blog mentions
3. Analyze sentiment from real posts and reviews you find
4. Determine how well each place fits the traveler's activities and profile
5. Rank all places by combined value (Google rating × sentiment × fit)

For EACH place, return:
- index: The number from the list (1-indexed)
- sentimentScore: 1-10 based on what you found on X and web (10 = overwhelmingly positive)
- sentiment: "positive" | "neutral" | "negative"
- summary: 2-3 sentences summarizing what real people are saying (quote specific themes you found)
- warnings: Array of specific concerns found (empty array if none) - things like "wifi issues", "closed for renovation", "overpriced", "sketchy area"
- trending: true if you see increased buzz/mentions recently, false otherwise
- fitScore: 1-10 how well this matches the traveler's activities and profile
- valueRank: Final ranking 1 to ${places.length} (1 = best overall value for this traveler)

IMPORTANT:
- Base sentiment on ACTUAL posts and reviews you find, not assumptions
- If you can't find much about a place, say so in the summary and give neutral sentiment
- Be specific in summaries - "nomads praise the 100mbps fiber" not "good wifi"
- Warnings should be actionable - specific issues travelers should know
- Trending means recent buzz (last 30 days), not just popular overall

Return ONLY a valid JSON array, no markdown:
[{
  "index": 1,
  "sentimentScore": 8,
  "sentiment": "positive",
  "summary": "Digital nomads on X consistently praise the dedicated workspace and community events. Recent posts mention new outdoor seating area. Some complaints about AC in main room during peak hours.",
  "warnings": ["Gets crowded 10am-2pm", "AC issues reported in main room"],
  "trending": true,
  "fitScore": 9,
  "valueRank": 1
}]`;

  try {
    const response = await grokChat({
      model: 'grok-4',
      messages: [
        { 
          role: 'system', 
          content: 'You are a travel analyst with real-time access to X and web data. Search for actual recent posts and reviews about each place. Return only valid JSON array.' 
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 12000,
      tools: [
        { type: 'x_search' },
        { type: 'web_search' }
      ]
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
        summary: rank.summary || 'No recent reviews found.',
        warnings: rank.warnings || [],
        trending: rank.trending || false,
        fitScore: rank.fitScore || 5,
        valueRank: rank.valueRank || 99,
        category: place.category
      };
    }).filter((x): x is NonNullable<typeof x> => x !== null);

    // Sort by valueRank
    results.sort((a: any, b: any) => a.valueRank - b.valueRank);

    return results;

  } catch (err) {
    console.error('[Grok] Analysis failed:', err);
    return [];
  }
}

export default { grokChat, analyzePlacesWithSentiment };
