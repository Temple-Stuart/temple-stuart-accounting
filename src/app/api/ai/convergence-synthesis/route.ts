import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireTier } from '@/lib/auth-helpers';
import Anthropic from '@anthropic-ai/sdk';
import { runPipeline } from '@/lib/convergence/pipeline';
import type { PipelineResult } from '@/lib/convergence/pipeline';
import { getVerifiedEmail } from '@/lib/cookie-auth';

export const maxDuration = 300;

// ===== RETRY LOGIC (same pattern as market-brief) =====

async function callWithRetry(client: Anthropic, params: any, maxRetries = 3): Promise<any> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await client.messages.create(params);
    } catch (e: any) {
      if (e.status === 429 && i < maxRetries - 1) {
        const retryAfter = parseInt(e.headers?.get?.('retry-after') || '10');
        const wait = Math.min(retryAfter, 120) * 1000;
        console.log(`[Convergence Synthesis] Rate limited, retry ${i + 1}/${maxRetries} in ${wait / 1000}s`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      throw e;
    }
  }
}

// ===== 30-MINUTE CACHE =====

const CACHE_TTL_MS = 30 * 60 * 1000;

interface SynthesisCacheEntry {
  data: any;
  timestamp: number;
}

const synthesisCache = new Map<string, SynthesisCacheEntry>();

function getCacheKey(limit: number): string {
  return `synthesis_${limit}`;
}

function getFromCache(limit: number): SynthesisCacheEntry | null {
  const key = getCacheKey(limit);
  const entry = synthesisCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    synthesisCache.delete(key);
    return null;
  }
  return entry;
}

function setCache(limit: number, data: any): void {
  const key = getCacheKey(limit);
  synthesisCache.set(key, { data, timestamp: Date.now() });
}

// ===== SYSTEM PROMPT =====

const SYSTEM_PROMPT = `You are the quantitative convergence analyst for Temple Stuart, an institutional-grade options analytics platform. You receive the full output of a multi-ticker convergence scoring pipeline.

The pipeline scores tickers across 4 categories (each 0-100):
- Vol Edge (40%): Mispricing via VRP z-scores, IV-HV spread, term structure shape, and technical indicators
- Quality Gate (30%): Liquidity rating, fundamentals (PE, margins, FCF, Piotroski), and earnings quality (beat rate, consistency)
- Regime (20%): Macro environment (VIX regime, yields, employment), correlation context (beta, SPY correlation), volatility regime alignment
- Info Edge (10%): Analyst consensus, insider activity (MSPR), earnings momentum (surprise streaks)

Composite = weighted average of all 4. Convergence gate requires 3/4 categories above 50. Quality floor excludes quality < 40.

You receive:
- pipeline_summary: universe size, filter counts, timing
- rankings.top_8: the final selected tickers with all scores, convergence rating, strategy suggestion, sector, IVP, IV-HV spread, HV trend, insider MSPR, beat streak, key signals
- rankings.also_scored: runners-up that were scored but didn't make the final 8
- diversification.adjustments: any tickers excluded (convergence gate, quality floor, sector cap)
- sector_stats: per-sector mean/std for key metrics
- scoring_details: full scoring breakdown for each top-8 ticker (sub-scores, formulas, z-scores, regime classification)
- data_gaps and errors

You perform FOUR analyses. Every claim must be directly computable from the data provided.

1. PIPELINE SUMMARY
Summarize the funnel: how many tickers entered, how many survived hard filters, how many were scored, and which 8 made it through. Note pipeline runtime. If there were Finnhub errors or data gaps, mention them.
Write 2-3 sentences. Every sentence must contain a number.

2. CONVERGENCE ANALYSIS
For each of the top 8 tickers:
- State the composite score and convergence rating (e.g., "4/4 — all categories aligned")
- Identify the STRONGEST category and the WEAKEST category with their scores
- If vol_edge is the strongest, explain WHY (look at mispricing z-scores, term structure shape, IV-HV spread)
- If quality is weak, explain WHY (look at PE, beat rate, miss streaks, fundamentals sub-scores)
- Note the suggested strategy and direction
- If there were diversification adjustments for this ticker's sector, mention it
Write 2-3 sentences per ticker. Reference specific sub-scores and numbers.

3. RISK FLAGS
Scan the data for:
a) Sector concentration: Are multiple top-8 tickers from the same sector? What's the sector distribution?
b) Regime misalignment: Any top-8 ticker with regime < 45? What's dragging it down?
c) Quality concerns: Any ticker with quality between 40-50 that barely passed the floor?
d) Convergence weakness: Any ticker at exactly 3/4? Which category failed?
e) Insider selling: Any ticker where MSPR is negative (insider selling)?
f) Exclusions: Summarize why tickers were excluded (convergence gate failures, quality floor, sector cap drops)
List each risk found. If none for a category, omit it.

4. CROSS-TICKER INSIGHTS
Look across all 8 tickers for patterns:
- Is there a dominant regime classification? What does it mean for premium selling?
- What's the average composite score? Is the cohort strong or marginal?
- Are the strategies all the same direction, or is there a mix of bullish/bearish/neutral?
- Any notable outliers? (e.g., one ticker with much higher/lower vol_edge than the rest)
Write 3-4 sentences. Reference specific numbers.

TONE: Write like you are explaining to a smart friend over coffee. Short sentences. Plain words. No jargon beyond what appears in the data (IVP, VRP, MSPR are fine). Keep sentences under 20 words when possible.

NEVER: "exhibits", "demonstrates", "notably", "significantly", "conducive to", "characterized by", "evidenced by", "utilizing", "prevailing". Never say "you should", "we recommend", "consider", "opportunity". Never predict future movement.
ALWAYS: "shows", "has", "is", "runs", "sits", "looks", "means", "tells us".

Respond with ONLY valid JSON, no markdown, no code blocks, no preamble:
{
  "pipelineSummary": "2-3 sentences with numbers",
  "convergenceAnalysis": [
    { "symbol": "AAPL", "composite": 72.3, "convergence": "4/4", "analysis": "2-3 sentences" }
  ],
  "riskFlags": {
    "sectorConcentration": ["sentence"] or [],
    "regimeMisalignment": ["sentence"] or [],
    "qualityConcerns": ["sentence"] or [],
    "convergenceWeakness": ["sentence"] or [],
    "insiderSelling": ["sentence"] or [],
    "exclusions": ["sentence"] or []
  },
  "crossTickerInsights": "3-4 sentences with numbers"
}`;

// ===== PREPARE PAYLOAD =====

function prepareSynthesisPayload(pipeline: PipelineResult): object {
  // Send enough data for analysis but trim to stay under token limits
  return {
    pipeline_summary: pipeline.pipeline_summary,
    rankings: {
      scored_count: pipeline.rankings.scored_count,
      top_8: pipeline.rankings.top_8,
      // Include top 10 of also_scored for context
      also_scored_sample: pipeline.rankings.also_scored.slice(0, 10),
      sector_distribution: pipeline.rankings.sector_distribution,
    },
    diversification: pipeline.diversification,
    sector_stats_summary: Object.fromEntries(
      Object.entries(pipeline.sector_stats).map(([sector, stats]) => [
        sector,
        { ticker_count: stats.ticker_count, insufficient_peers: stats.insufficient_peers || false },
      ]),
    ),
    scoring_details: pipeline.scoring_details,
    data_gaps: pipeline.data_gaps,
    errors: pipeline.errors,
  };
}

// ===== ROUTE =====

export async function GET(request: Request) {
  try {
    const userEmail = await getVerifiedEmail();
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
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    let limit = parseInt(searchParams.get('limit') || '20', 10);
    if (isNaN(limit) || limit < 4) limit = 4;
    if (limit > 150) limit = 150;
    const refresh = searchParams.get('refresh') === 'true';

    // Check cache
    if (!refresh) {
      const cached = getFromCache(limit);
      if (cached) {
        const age = Math.round((Date.now() - cached.timestamp) / 1000);
        console.log(`[Convergence Synthesis] Cache HIT (age=${age}s)`);
        return NextResponse.json(cached.data, {
          headers: {
            'X-Cache-Hit': 'true',
            'X-Cache-Age-Seconds': String(age),
          },
        });
      }
    }

    console.log(`[Convergence Synthesis] Cache MISS — running pipeline (limit=${limit})...`);

    // Step 1: Run convergence pipeline
    const pipelineStart = Date.now();
    const pipeline = await runPipeline(limit);
    const pipelineMs = Date.now() - pipelineStart;
    console.log(`[Convergence Synthesis] Pipeline done in ${pipelineMs}ms`);

    // Step 2: Prepare payload for Claude
    const payload = prepareSynthesisPayload(pipeline);
    const payloadStr = JSON.stringify(payload);
    console.log(`[Convergence Synthesis] Payload size: ${payloadStr.length} chars (~${Math.round(payloadStr.length / 4)} tokens)`);

    // Step 3: Call Anthropic
    const client = new Anthropic({ apiKey });
    const aiStart = Date.now();

    const msg = await callWithRetry(client, {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      temperature: 0.2,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: payloadStr }],
    });

    const aiMs = Date.now() - aiStart;
    console.log(`[Convergence Synthesis] AI response in ${aiMs}ms`);

    const text = msg.content[0].type === 'text' ? msg.content[0].text : '';

    // Step 4: Parse JSON response
    let synthesis: any;
    try {
      synthesis = JSON.parse(text);
    } catch {
      console.error('[Convergence Synthesis] Failed to parse AI response as JSON, returning raw');
      synthesis = { raw: text, parse_error: true };
    }

    // Step 5: Assemble final response
    const result = {
      synthesis,
      pipeline_summary: pipeline.pipeline_summary,
      top_8: pipeline.rankings.top_8,
      sector_distribution: pipeline.rankings.sector_distribution,
      timing: {
        pipeline_ms: pipelineMs,
        ai_ms: aiMs,
        total_ms: Date.now() - pipelineStart,
      },
    };

    // Cache it
    setCache(limit, result);

    return NextResponse.json(result, {
      headers: {
        'X-Cache-Hit': 'false',
        'X-Pipeline-Runtime-Ms': String(pipelineMs),
        'X-AI-Runtime-Ms': String(aiMs),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Convergence Synthesis] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
