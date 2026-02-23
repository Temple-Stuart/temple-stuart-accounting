/**
 * Social sentiment analysis via xAI Grok with native x_search.
 *
 * Two-stage pipeline:
 * 1. Grok 4.1 Fast + x_search: Fetch recent X/Twitter posts about $TICKER
 * 2. Grok 4.1 Fast (non-reasoning): Score sentiment with structured JSON output
 *
 * Returns a sentiment score (-1 to +1), post count, key themes, and sample posts.
 * Designed to be OPTIONAL — scanner works without it.
 */

// ── Types ────────────────────────────────────────────────────────────

export interface SentimentResult {
  symbol: string;
  score: number;            // -1 (very bearish) to +1 (very bullish)
  magnitude: number;        // 0-1, how strong/confident the signal is
  postCount: number;        // how many relevant posts were found
  bullishCount: number;     // posts classified as bullish
  bearishCount: number;     // posts classified as bearish
  neutralCount: number;     // posts classified as neutral
  themes: string[];         // top 3-5 themes
  samplePosts: {
    text: string;           // truncated to ~100 chars
    sentiment: 'bullish' | 'bearish' | 'neutral';
    author: string;         // @handle
  }[];
  dataAge: string;          // ISO timestamp of when this was fetched
  error?: string;           // if sentiment fetch failed, why
}

interface XAIResponsesOutput {
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

interface Stage1Post {
  text: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  author: string;
  summary: string;
}

interface Stage1Result {
  posts: Stage1Post[];
  overall_sentiment: string;
  key_themes: string[];
}

// ── Helpers ──────────────────────────────────────────────────────────

function emptyResult(symbol: string, error?: string): SentimentResult {
  return {
    symbol,
    score: 0,
    magnitude: 0,
    postCount: 0,
    bullishCount: 0,
    bearishCount: 0,
    neutralCount: 0,
    themes: [],
    samplePosts: [],
    dataAge: new Date().toISOString(),
    error,
  };
}

function extractTextFromResponses(data: XAIResponsesOutput): string {
  for (const output of data.output || []) {
    if (output.content) {
      for (const content of output.content) {
        if (content.type === 'output_text' && content.text) {
          return content.text;
        }
      }
    }
  }
  return '';
}

function parseJSON<T>(text: string): T | null {
  // Remove markdown code blocks if present
  const codeBlockMatch = text.match(/```(?:json)?\n?([\s\S]*?)```/);
  const jsonStr = codeBlockMatch ? codeBlockMatch[1] : text;

  // Try to find a JSON object or array
  const objMatch = jsonStr.match(/\{[\s\S]*\}/);
  const arrMatch = jsonStr.match(/\[[\s\S]*\]/);
  const candidate = objMatch?.[0] || arrMatch?.[0];
  if (!candidate) return null;

  try {
    return JSON.parse(candidate) as T;
  } catch {
    return null;
  }
}

// ── Stage 1: Fetch posts via x_search ────────────────────────────────

async function fetchPostsViaXSearch(
  symbol: string,
  apiKey: string,
): Promise<Stage1Result | null> {
  const prompt = `Search X/Twitter for recent posts about $${symbol} stock in the last 24 hours.

Find 10-20 relevant posts that discuss:
- Price action, trading activity, or market sentiment
- Earnings, revenue, or financial results
- Product launches, partnerships, or business developments
- Analyst upgrades/downgrades or price targets
- Insider buying/selling

IGNORE posts that are:
- Spam, bots, or promotional content
- Unrelated to the stock/company
- Just sharing a stock price without commentary

For each relevant post, extract:
- The key sentiment (bullish, bearish, or neutral)
- A brief summary of what they're saying (under 100 chars)
- The author handle

Respond with JSON only, no other text:
{
  "posts": [
    { "text": "...", "sentiment": "bullish", "author": "@handle", "summary": "..." }
  ],
  "overall_sentiment": "bullish|bearish|neutral|mixed",
  "key_themes": ["theme1", "theme2", "theme3"]
}`;

  const response = await fetch('https://api.x.ai/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'grok-4-1-fast',
      input: [{ role: 'user', content: prompt }],
      tools: [
        { type: 'x_search' },
      ],
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    console.error(`[Sentiment] Stage 1 API error ${response.status} for ${symbol}:`, errorText.substring(0, 500));
    return null;
  }

  const data: XAIResponsesOutput = await response.json();
  const textContent = extractTextFromResponses(data);

  if (!textContent) {
    console.warn(`[Sentiment] Stage 1: No text content for ${symbol}`);
    return null;
  }

  const parsed = parseJSON<Stage1Result>(textContent);
  if (!parsed || !Array.isArray(parsed.posts)) {
    console.warn(`[Sentiment] Stage 1: Could not parse JSON for ${symbol}`);
    return null;
  }

  return parsed;
}

// ── Stage 2: Score sentiment ─────────────────────────────────────────

async function scoreSentiment(
  symbol: string,
  stage1: Stage1Result,
  apiKey: string,
): Promise<{ score: number; magnitude: number } | null> {
  const postsJson = JSON.stringify(stage1.posts.slice(0, 15));

  const prompt = `Given these classified social media posts about $${symbol}:

${postsJson}

Overall sentiment from search: ${stage1.overall_sentiment}
Key themes: ${stage1.key_themes.join(', ')}

Compute a sentiment score:
- Score: -1.0 (extremely bearish) to +1.0 (extremely bullish), 0 = neutral
- Magnitude: 0.0 (no signal/low confidence) to 1.0 (very strong/high confidence signal)
- Consider: post count, agreement between posts, credibility of sources, recency

Respond with JSON only:
{ "score": 0.35, "magnitude": 0.7 }`;

  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'grok-4-1-fast-non-reasoning',
      messages: [
        { role: 'system', content: 'You are a financial sentiment analyst. Return only valid JSON, no markdown.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 200,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    console.error(`[Sentiment] Stage 2 API error ${response.status} for ${symbol}`);
    return null;
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  const parsed = parseJSON<{ score: number; magnitude: number }>(content);

  if (!parsed || typeof parsed.score !== 'number' || typeof parsed.magnitude !== 'number') {
    console.warn(`[Sentiment] Stage 2: Could not parse score for ${symbol}`);
    return null;
  }

  // Clamp values
  return {
    score: Math.max(-1, Math.min(1, parsed.score)),
    magnitude: Math.max(0, Math.min(1, parsed.magnitude)),
  };
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Fetch social sentiment for a single ticker.
 * Uses two-stage Grok pipeline: x_search -> sentiment scoring.
 * Never throws — returns empty result with error field on failure.
 */
export async function fetchSentiment(symbol: string): Promise<SentimentResult> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    console.warn('[Sentiment] XAI_API_KEY not configured — skipping sentiment');
    return emptyResult(symbol, 'XAI_API_KEY not configured');
  }

  try {
    const startTime = Date.now();
    console.log(`[Sentiment] Fetching for ${symbol}...`);

    // Stage 1: Fetch and classify posts via x_search
    const stage1 = await fetchPostsViaXSearch(symbol, apiKey);
    if (!stage1 || stage1.posts.length === 0) {
      console.log(`[Sentiment] ${symbol}: No posts found`);
      return emptyResult(symbol, 'No relevant posts found');
    }

    const posts = stage1.posts;
    const bullishCount = posts.filter(p => p.sentiment === 'bullish').length;
    const bearishCount = posts.filter(p => p.sentiment === 'bearish').length;
    const neutralCount = posts.filter(p => p.sentiment === 'neutral').length;

    // Stage 2: Compute numerical score
    const scoreResult = await scoreSentiment(symbol, stage1, apiKey);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Sentiment] ${symbol}: ${posts.length} posts, score=${scoreResult?.score ?? 'N/A'} in ${elapsed}s`);

    return {
      symbol,
      score: scoreResult?.score ?? 0,
      magnitude: scoreResult?.magnitude ?? 0,
      postCount: posts.length,
      bullishCount,
      bearishCount,
      neutralCount,
      themes: (stage1.key_themes || []).slice(0, 5),
      samplePosts: posts.slice(0, 5).map(p => ({
        text: (p.text || p.summary || '').substring(0, 100),
        sentiment: p.sentiment || 'neutral',
        author: p.author || '@unknown',
      })),
      dataAge: new Date().toISOString(),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Sentiment] ${symbol} failed:`, msg);
    return emptyResult(symbol, msg);
  }
}

/**
 * Fetch social sentiment for multiple tickers in parallel.
 * Uses semaphore to respect rate limits (480 RPM).
 * Never throws — individual failures produce empty results.
 */
export async function fetchSentimentBatch(
  symbols: string[],
  concurrency: number = 10,
): Promise<Map<string, SentimentResult>> {
  const results = new Map<string, SentimentResult>();
  let active = 0;
  let index = 0;

  return new Promise((resolve) => {
    function next() {
      while (active < concurrency && index < symbols.length) {
        const sym = symbols[index++];
        active++;
        fetchSentiment(sym).then(result => {
          results.set(sym, result);
          active--;
          if (results.size === symbols.length) {
            resolve(results);
          } else {
            next();
          }
        });
      }
    }
    if (symbols.length === 0) resolve(results);
    else next();
  });
}
