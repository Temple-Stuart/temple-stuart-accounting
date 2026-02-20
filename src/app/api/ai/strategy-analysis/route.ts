import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { requireTier } from '@/lib/auth-helpers';
import Anthropic from '@anthropic-ai/sdk';

async function callWithRetry(client: Anthropic, params: any, maxRetries = 3): Promise<any> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await client.messages.create(params);
    } catch (e: any) {
      if (e.status === 429 && i < maxRetries - 1) {
        const retryAfter = parseInt(e.headers?.get?.('retry-after') || '10');
        const wait = Math.min(retryAfter, 120) * 1000;
        console.log(`[Strategy Analysis] Rate limited, retry ${i + 1}/${maxRetries} in ${wait / 1000}s`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      throw e;
    }
  }
}

const SYSTEM_PROMPT = `You analyze specific options strategies for Temple Stuart, an institutional-grade analytics platform.

You receive: a symbol with its scanner data (IV-HV spread, HV trend, earnings timing, sector) plus 1-3 generated strategy cards with full details (legs, strikes, prices, max profit/loss, breakevens, PoP, Greeks, DTE). You may also receive Finnhub data (news count, analyst ratings, price targets).

For EACH strategy, write 2-4 sentences. Every sentence must reference a specific number from the data.

What to cover in each analysis:

SENTENCE 1 -- What the strategy is doing in plain English:
- For credit strategies: how much credit collected vs max risk, and what PoP means
- For debit strategies: what you are paying for and what the max payoff is
- Reference the actual dollar amounts

SENTENCE 2 -- How the Greeks work for/against this position:
- Theta: how much the position earns (credit) or loses (debit) per day
- Delta: directional exposure (near zero = market neutral)
- Vega: is high IV helping or hurting this position?
- Keep it to the most important Greek for THIS strategy

SENTENCE 3 (if relevant) -- Context from scanner data:
- If IV-HV spread is wide: note that IV is Nx realized movement
- If earnings are within the DTE window: flag that earnings fall inside this trade
- If hasWideSpread is true: note that fill prices may differ from displayed prices
- If PoP is below 50% for a credit strategy: note that is below typical threshold
- Only include this sentence if there is something worth flagging. Skip it if not.

SENTENCE 4 (if Finnhub data is provided) -- Market context:
Include ONE sentence covering the most relevant data points:

If news articles exist:
- State the count: "N articles in the last 7 days"
- Mention the most recent headline and source if notable

If analyst data exists:
- State the consensus: "Analysts: N Buy, N Hold, N Sell"

If price target exists and current price is provided:
- State: "Mean analyst target is $X vs current $Y" (only if the gap is significant -- more than 10%)

Combine into ONE sentence. Examples:
GOOD: "3 news articles this week, analysts sit at 24 Buy / 7 Hold / 0 Sell with a mean target of $74.50 -- 55% above the current $48.21."
GOOD: "No recent news. 18 analysts rate Buy with a $95 mean target, 12% above current price."
GOOD: "1 article from Reuters 2 days ago. Analyst consensus is mixed at 8 Buy / 12 Hold / 3 Sell."

If no Finnhub data at all, skip this sentence entirely. Do NOT mention the absence of data.

RULES for Finnhub data:
- State ONLY what the data shows. No interpretation.
- Never say "news explains the IV" or "this is priced in" or "bullish signal"
- Never summarize article content -- just count and most recent headline
- Analyst data is factual: just report the numbers
- Price target vs current price: state the gap as a percentage, nothing more

TONE -- NON-NEGOTIABLE:
Write like a sharp trader explaining the trade to a friend. Short sentences. Plain words.

GOOD: "You collect $1.85 up front and risk $3.15 if the stock blows through either wing. PoP sits at 68% -- roughly 2 out of 3 times this expires worthless. Theta earns $4.20/day, so time is on your side."

BAD: "This iron condor strategy demonstrates a favorable risk-reward profile characterized by elevated probability of profit metrics and beneficial theta decay characteristics."

No "exhibits", "demonstrates", "favorable", "characteristics", "conducive", "utilizing".
Use: "collects", "risks", "earns", "costs", "pays", "sits at", "means".

ABSOLUTE RULES:
- Every sentence must have a specific number from the strategy data
- Never say "you should", "we recommend", "this is a good trade"
- Never predict: "IV will compress", "stock will stay in range"
- Say what IS: "PoP is 68%", "theta earns $4.20/day", "breakevens sit at $62 and $74"
- If hasWideSpread is true, always mention it -- fill prices matter
- Keep total response per strategy to 2-4 sentences max. No more.

Respond with ONLY a JSON array of objects, one per strategy in the same order as input:
[
  { "strategy": "Iron Condor", "analysis": "2-4 sentences" },
  { "strategy": "Put Credit Spread", "analysis": "2-4 sentences" }
]

No markdown. No code blocks. No preamble. Just the JSON array.`;

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('userEmail')?.value;
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const tierGate = requireTier(user.tier, 'ai');
    if (tierGate) return tierGate;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    const body = await request.json();
    const client = new Anthropic({ apiKey });

    const msg = await callWithRetry(client, {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      temperature: 0.2,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: JSON.stringify(body) }],
    });

    const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
    const parsed = JSON.parse(text);
    return NextResponse.json(parsed);
  } catch (error: any) {
    console.error('[Strategy Analysis]', error);
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}
