import Anthropic from '@anthropic-ai/sdk';

export interface ClassifiedHeadline {
  sentiment: 'bullish' | 'bearish' | 'neutral';
  confidence: number; // 0-1
}

// ~$0.01-0.05 per scan of 50-200 headlines via Haiku
// Kirtac & Germano (2024): LLM Sharpe 3.05 vs dictionary 1.59
export async function classifyNewsHeadlines(
  headlines: string[],
  ticker: string,
): Promise<(ClassifiedHeadline | null)[] | null> {
  if (headlines.length === 0) return [];

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const client = new Anthropic({ apiKey, timeout: 5000 });

    const headlineList = headlines.map((h, i) => `${i}: ${h}`).join('\n');

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      system: [
        `You are a financial news sentiment classifier for options trading.`,
        `For each headline about ${ticker}, classify the sentiment as 'bullish', 'bearish', or 'neutral' with a confidence score 0-1.`,
        ``,
        `Context: These classifications inform premium-selling options strategies.`,
        `'Bullish' means the headline suggests positive price pressure.`,
        `'Bearish' means negative price pressure.`,
        `'Neutral' means no clear directional implication.`,
        ``,
        `Respond ONLY with a JSON array. No explanation.`,
        `Example: [{"idx":0,"s":"bullish","c":0.85},{"idx":1,"s":"neutral","c":0.6}]`,
      ].join('\n'),
      messages: [{ role: 'user', content: headlineList }],
    });

    const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
    const clean = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = JSON.parse(clean) as { idx: number; s: string; c: number }[];
    if (!Array.isArray(parsed)) return null;

    const results: (ClassifiedHeadline | null)[] = new Array(headlines.length).fill(null);

    for (const item of parsed) {
      if (item.idx >= 0 && item.idx < headlines.length) {
        const validSentiments = ['bullish', 'bearish', 'neutral'] as const;
        if (!validSentiments.includes(item.s as typeof validSentiments[number])) continue;
        if (item.c == null || typeof item.c !== 'number') continue;
        results[item.idx] = {
          sentiment: item.s as 'bullish' | 'bearish' | 'neutral',
          confidence: Math.max(0, Math.min(1, item.c)),
        };
      }
    }

    return results;
  } catch (e) {
    console.warn(
      `[NewsClassifier] Claude API failed for ${ticker}:`,
      e instanceof Error ? e.message : String(e),
    );
    return null; // Caller falls back to keyword method
  }
}
