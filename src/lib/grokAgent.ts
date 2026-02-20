// Grok Agent with LIVE X and Web Search via REST API
// Uses the /v1/responses endpoint with Agent Tools

import { models } from '@/lib/ai';

interface TravelerProfile {
  tripType: string;
  budget: string;
  priorities: string[];
  dealbreakers: string[];
  groupSize: number;
  vibe?: string;
  pace?: string;
}

interface PlaceToAnalyze {
  name: string;
  address: string;
  rating: number;
  reviewCount: number;
  category: string;
  website?: string;
  photoUrl?: string;
}

interface GrokAnalysis {
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
  xEvidence?: string;
  citations?: string[];
}

interface XAIResponse {
  id: string;
  output: Array<{
    type: string;
    content?: Array<{
      type: string;
      text?: string;
      annotations?: Array<{
        type: string;
        url: string;
        title: string;
      }>;
    }>;
  }>;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

// Map trip types to human-readable descriptions
const TRIP_TYPE_LABELS: Record<string, string> = {
  digital_nomad: 'digital nomad',
  remote_work: 'remote worker',
  surf_trip: 'surf trip traveler',
  ski_trip: 'ski/snowboard enthusiast',
  wellness: 'wellness retreat seeker',
  adventure: 'adventure traveler',
  romantic: 'couple on a romantic getaway',
  friends: 'friend group',
  family: 'family',
  solo: 'solo traveler',
  backpacker: 'budget backpacker',
  luxury: 'luxury traveler',
};

// Build activity-specific questions
function buildActivityQuestions(activities: string[]): string {
  const questions: string[] = [];
  
  if (activities.some(a => ['nomad', 'coworking', 'remote_work'].includes(a))) {
    questions.push('- WiFi speed and reliability?');
    questions.push('- Quality of workspace/desk?');
    questions.push('- AC and power outlets?');
  }
  
  if (activities.includes('surf')) {
    questions.push('- Proximity to surf spots?');
    questions.push('- Board storage available?');
  }
  
  if (activities.includes('yoga') || activities.includes('wellness')) {
    questions.push('- On-site yoga or wellness?');
    questions.push('- Healthy food options?');
  }
  
  if (activities.includes('nightlife')) {
    questions.push('- Nightlife scene nearby?');
    questions.push('- Late checkout available?');
  }
  
  if (activities.includes('foodtour')) {
    questions.push('- Walking distance to restaurants?');
    questions.push('- Local food scene quality?');
  }
  
  return questions.length > 0 ? questions.join('\n') : '- General quality and value?';
}

export async function analyzeWithLiveSearch(options: {
  places: PlaceToAnalyze[];
  destination: string;
  activities: string[];
  profile: TravelerProfile;
  category: string;
  month?: string;
  year?: number;
}): Promise<GrokAnalysis[]> {
  const { places, destination, activities, profile, category, month, year } = options;
  
  if (places.length === 0) return [];
  
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    console.error('[GrokAgent] XAI_API_KEY not configured');
    throw new Error('XAI_API_KEY not configured');
  }

  const tripTypeLabel = TRIP_TYPE_LABELS[profile.tripType] || profile.tripType;
  const activitiesStr = activities.join(', ');
  const prioritiesStr = (profile.priorities || []).join(', ') || 'best value';
  const dealbreakersStr = (profile.dealbreakers || []).join(', ') || 'none';
  const timeframe = month && year ? `${month} ${year}` : 'upcoming trip';
  const activityQuestions = buildActivityQuestions(activities);

  // Build the place list
  const placeList = places.map((p, i) => 
    `${i + 1}. ${p.name} | Rating: ${p.rating} (${p.reviewCount} reviews) | ${p.address}`
  ).join('\n');

  const prompt = `You are a travel intelligence agent with access to live X (Twitter) and web search.

## TRAVELER PROFILE
- Trip Type: ${tripTypeLabel}
- Destination: ${destination}
- Activities: ${activitiesStr || 'general tourism'}
- Priorities: ${prioritiesStr}
- Dealbreakers: ${dealbreakersStr}
- Budget: ${profile.budget}
- Group Size: ${profile.groupSize}
- Timeframe: ${timeframe}

## CATEGORY: ${category.toUpperCase()}

## PLACES TO ANALYZE (${places.length} total)
${placeList}

## YOUR TASK
Search X and the web for recent reviews of these ${category} places in ${destination}. For each place:

${activityQuestions}
- Any recent complaints or issues?
- Is it recommended by ${tripTypeLabel}s?
- Is it trending or declining?

## OUTPUT FORMAT
Return ONLY a valid JSON array with this exact structure:
[
  {
    "index": 1,
    "sentimentScore": 8,
    "sentiment": "positive",
    "summary": "2-3 sentences based on X posts and web reviews",
    "warnings": [],
    "trending": true,
    "fitScore": 9,
    "valueRank": 1,
    "xEvidence": "Quote or summary from X posts"
  }
]

IMPORTANT:
- index: matches the place number (1-indexed)
- sentimentScore: 1-10 based on X/web sentiment
- fitScore: 1-10 how well it matches THIS traveler's activities
- valueRank: 1 to ${places.length} (1 = best for this traveler)
- Include real evidence from your X/web searches in xEvidence`;

  try {
    const promptLen = prompt.length;
    console.log(`[GrokAgent] Analyzing ${places.length} ${category} places (prompt: ${promptLen} chars)...`);
    const startTime = Date.now();

    const baseUrl = process.env.XAI_BASE_URL || 'https://api.x.ai/v1';
    const response = await fetch(`${baseUrl}/responses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: models.xai,
        input: [{ role: 'user', content: prompt }],
        tools: [
          { type: 'web_search' },
          { type: 'x_search' },
        ],
      }),
      signal: AbortSignal.timeout(90_000), // 90s timeout per call
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[GrokAgent] ${category} response: ${response.status} in ${elapsed}s`);

    const responseText = await response.text();

    if (!response.ok) {
      console.error(`[GrokAgent] API error ${response.status} for ${category}:`, responseText.substring(0, 1000));
      throw new Error(`Grok API error: ${response.status}`);
    }

    let data: XAIResponse;
    try {
      data = JSON.parse(responseText);
    } catch (jsonErr) {
      console.error(`[GrokAgent] ${category}: API returned non-JSON (${responseText.length} chars):`);
      console.error(`[GrokAgent] Full response: ${responseText.substring(0, 2000)}`);
      throw new Error(`Grok API returned non-JSON for ${category}: "${responseText.substring(0, 100)}"`);
    }
    
    // Extract text content and citations
    let textContent = '';
    let citations: string[] = [];
    
    for (const output of data.output || []) {
      if (output.content) {
        for (const content of output.content) {
          if (content.type === 'output_text' && content.text) {
            textContent = content.text;
          }
          if (content.annotations) {
            citations = content.annotations
              .filter(a => a.type === 'url_citation')
              .map(a => a.url);
          }
        }
      }
    }

    console.log("[GrokAgent] Response received. Citations: " + citations.length);
    
    // Extract JSON from response
    let jsonStr = textContent;
    
    // Remove markdown code blocks if present
    const codeBlockMatch = textContent.match(/```(?:json)?\n?([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1];
    }
    
    // Find JSON array
    const jsonMatch = jsonStr.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (!jsonMatch) {
      console.error("[GrokAgent] No JSON array found in response");
      console.error("[GrokAgent] Content preview:", textContent.substring(0, 1000));
      return [];
    }
    
    let rankings: any[];
    try {
      rankings = JSON.parse(jsonMatch[0]);
      console.log("[GrokAgent] Parsed " + rankings.length + " rankings");
    } catch (parseErr) {
      console.error("[GrokAgent] JSON parse error:", parseErr);
      console.error("[GrokAgent] Attempted to parse:", jsonMatch[0].substring(0, 500));
      return [];
    }
    // Merge analysis with original place data
    const results: GrokAnalysis[] = rankings.map((rank: any) => {
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
        category: place.category,
        xEvidence: rank.xEvidence || '',
        citations: citations.slice(0, 5),
      };
    }).filter((x): x is NonNullable<typeof x> => x !== null);

    // Sort by valueRank
    results.sort((a, b) => a.valueRank - b.valueRank);

    console.log("[GrokAgent] Analysis complete: " + results.length + " places ranked for " + category);
    return results;

  } catch (err) {
    console.error('[GrokAgent] Analysis failed:', err);
    throw err;
  }
}

// Analyze categories sequentially to avoid overwhelming Grok's agent tools.
// Each call triggers multi-turn web_search + x_search internally, so parallel
// calls cause rate limits and "An error occurred" text responses.
export async function analyzeAllCategories(options: {
  placesByCategory: Record<string, PlaceToAnalyze[]>;
  destination: string;
  activities: string[];
  profile: TravelerProfile;
  month?: string;
  year?: number;
  maxPlacesPerCall?: number;
}): Promise<Record<string, GrokAnalysis[]>> {
  const { placesByCategory, destination, activities, profile, month, year, maxPlacesPerCall = 10 } = options;

  const categories = Object.keys(placesByCategory);
  const totalPlaces = Object.values(placesByCategory).flat().length;
  console.log(`[GrokAgent] Starting sequential analysis: ${categories.length} categories, ${totalPlaces} total places (max ${maxPlacesPerCall}/call)`);

  const results: Record<string, GrokAnalysis[]> = {};

  // Process one category at a time — Grok agent tools can't handle parallel calls
  for (let i = 0; i < categories.length; i++) {
    const category = categories[i];
    const places = placesByCategory[category];

    if (!places || places.length === 0) {
      results[category] = [];
      continue;
    }

    console.log(`[GrokAgent] [${i + 1}/${categories.length}] Analyzing ${category}...`);

    try {
      const analyses = await analyzeWithLiveSearch({
        places: places.slice(0, maxPlacesPerCall),
        destination,
        activities,
        profile,
        category,
        month,
        year,
      });
      results[category] = analyses;
    } catch (err) {
      console.error(`[GrokAgent] Failed ${category} (continuing):`, err instanceof Error ? err.message : err);
      results[category] = [];
    }

    // Brief pause between calls to avoid rate limits
    if (i < categories.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  const totalResults = Object.values(results).flat().length;
  console.log(`[GrokAgent] Done: ${totalResults} results across ${categories.length} categories`);
  return results;
}

export default { analyzeWithLiveSearch, analyzeAllCategories };
