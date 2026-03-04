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
- rankings.top_9: the final selected tickers with all scores, convergence rating, strategy suggestion, sector, IVP, IV-HV spread, HV trend, insider MSPR, beat streak, key signals
- rankings.also_scored: runners-up that were scored but didn't make the final 9
- diversification.adjustments: any tickers excluded (convergence gate, quality floor, sector cap)
- peer_stats: per-industry/sector mean/std for key metrics
- scoring_details: full scoring breakdown for each top-9 ticker (sub-scores, formulas, z-scores, regime classification)
- data_gaps and errors

You perform FOUR analyses. Every claim must be directly computable from the data provided.

1. PIPELINE SUMMARY
Summarize the funnel: how many tickers entered, how many survived hard filters, how many were scored, and which 9 made it through. Note pipeline runtime. If there were Finnhub errors or data gaps, mention them.
Write 2-3 sentences. Every sentence must contain a number.

2. CONVERGENCE ANALYSIS
For each of the top 9 tickers:
- State the composite score and convergence rating (e.g., "4/4 — all categories aligned")
- Identify the STRONGEST category and the WEAKEST category with their scores
- If vol_edge is the strongest, explain WHY (look at mispricing z-scores, term structure shape, IV-HV spread)
- If quality is weak, explain WHY (look at PE, beat rate, miss streaks, fundamentals sub-scores)
- Note the suggested strategy and direction
- If there were diversification adjustments for this ticker's sector, mention it
Write 2-3 sentences per ticker. Reference specific sub-scores and numbers.

3. RISK FLAGS
Scan the data for:
a) Sector concentration: Are multiple top-9 tickers from the same sector? What's the sector distribution?
b) Regime misalignment: Any top-9 ticker with regime < 45? What's dragging it down?
c) Quality concerns: Any ticker with quality between 40-50 that barely passed the floor?
d) Convergence weakness: Any ticker at exactly 3/4? Which category failed?
e) Insider selling: Any ticker where MSPR is negative (insider selling)?
f) Exclusions: Summarize why tickers were excluded (convergence gate failures, quality floor, sector cap drops)
List each risk found. If none for a category, omit it.

4. CROSS-TICKER INSIGHTS
Look across all 9 tickers for patterns:
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

/**
 * Condense a FullScoringResult into a compact summary for the AI prompt.
 * Keeps scores, key sub-scores, and diagnostic signals. Strips raw inputs,
 * formulas, notes, full indicator arrays, news headlines, and trade card legs.
 */
function condenseScoringDetail(detail: any): any {
  const vol = detail.vol_edge?.breakdown;
  const qual = detail.quality?.breakdown;
  const reg = detail.regime?.breakdown;
  const info = detail.info_edge?.breakdown;
  const strat = detail.strategy_suggestion;

  return {
    vol_edge: {
      score: detail.vol_edge?.score,
      z_scores: vol?.mispricing?.z_scores,
      hv_trend: vol?.mispricing?.hv_trend,
      term_shape: vol?.term_structure?.shape,
      richest_tenor: vol?.term_structure?.richest_tenor,
      earnings_kink: vol?.term_structure?.earnings_kink_detected,
      technicals_sub: vol?.technicals?.sub_scores,
    },
    quality: {
      score: detail.quality?.score,
      mspr_adjustment: detail.quality?.mspr_adjustment,
      safety_sub: qual?.safety?.sub_scores,
      profitability_sub: qual?.profitability?.sub_scores,
      earnings_quality: qual?.profitability?.earnings_quality,
      growth_sub: qual?.growth?.sub_scores,
      fundamentalRisk_sub: qual?.fundamentalRisk?.sub_scores,
    },
    regime: {
      score: detail.regime?.score,
      dominant_regime: reg?.dominant_regime,
      regime_probabilities: reg?.regime_probabilities,
      vix: reg?.vix_overlay?.vix,
      vix_adjustment: reg?.vix_overlay?.adjustment_type,
      best_strategy: reg?.best_strategy,
      spy_corr: reg?.spy_correlation_modifier?.corr_spy,
      spy_multiplier: reg?.spy_correlation_modifier?.multiplier,
    },
    info_edge: {
      score: detail.info_edge?.score,
      analyst_sub: info?.analyst_consensus?.sub_scores,
      analyst_counts: info?.analyst_consensus?.raw_counts,
      insider_detail: info?.insider_activity?.insider_detail,
      earnings_momentum: info?.earnings_momentum?.momentum_detail,
      flow_sub: info?.flow_signal?.sub_scores,
      news_sub: info?.news_sentiment?.sub_scores,
      news_articles_30d: info?.news_sentiment?.news_detail?.total_articles_30d,
      news_sentiment_7d: info?.news_sentiment?.news_detail?.sentiment_7d_score,
      // Headlines intentionally omitted — too large for synthesis prompt
    },
    composite: detail.composite,
    strategy_suggestion: {
      direction: strat?.direction,
      suggested_strategy: strat?.suggested_strategy,
      suggested_dte: strat?.suggested_dte,
      regime_preferred: strat?.regime_preferred,
      vol_edge_confirms: strat?.vol_edge_confirms,
      // Condense trade cards: top card summary only, no legs/greeks/breakevens
      top_trade_card: strat?.trade_cards?.[0] ? {
        name: strat.trade_cards[0].name,
        dte: strat.trade_cards[0].dte,
        maxProfit: strat.trade_cards[0].maxProfit,
        maxLoss: strat.trade_cards[0].maxLoss,
        pop: strat.trade_cards[0].pop,
        ev: strat.trade_cards[0].ev,
        riskReward: strat.trade_cards[0].riskReward,
        netCredit: strat.trade_cards[0].netCredit,
        netDebit: strat.trade_cards[0].netDebit,
      } : null,
      trade_card_count: strat?.trade_cards?.length ?? 0,
    },
    data_gaps: detail.data_gaps,
  };
}

function prepareSynthesisPayload(pipeline: PipelineResult, maxTickers = 9): object {
  // Condense scoring details — the main source of prompt bloat
  const condensedScoring: Record<string, any> = {};
  const top9Symbols = pipeline.rankings.top_9.slice(0, maxTickers).map(r => r.symbol);
  for (const symbol of top9Symbols) {
    const detail = pipeline.scoring_details[symbol];
    if (detail) {
      condensedScoring[symbol] = condenseScoringDetail(detail);
    }
  }

  return {
    pipeline_summary: pipeline.pipeline_summary,
    rankings: {
      scored_count: pipeline.rankings.scored_count,
      top_9: pipeline.rankings.top_9.slice(0, maxTickers),
      // Limit also_scored to top 5 for context (down from 10)
      also_scored_sample: pipeline.rankings.also_scored.slice(0, 5).map(r => ({
        symbol: r.symbol, composite: r.composite, convergence: r.convergence,
        sector: r.sector, direction: r.direction,
      })),
      sector_distribution: pipeline.rankings.sector_distribution,
    },
    diversification: {
      // Limit adjustment strings to 20 to cap verbosity
      adjustments: pipeline.diversification.adjustments.slice(0, 20),
    },
    peer_stats_summary: Object.fromEntries(
      Object.entries(pipeline.peer_stats).map(([group, stats]) => [
        group,
        { ticker_count: stats.ticker_count, peer_group_type: stats.peer_group_type, peer_group_name: stats.peer_group_name, insufficient_peers: stats.insufficient_peers || false },
      ]),
    ),
    scoring_details: condensedScoring,
    pre_filter_summary: {
      total: pipeline.pre_filter.length,
      included: pipeline.pre_filter.filter(r => !r.excluded).length,
      excluded: pipeline.pre_filter.filter(r => r.excluded).length,
      earnings_warnings: pipeline.pre_filter.filter(r => r.earningsWarning != null).slice(0, 10).map(r => ({
        symbol: r.symbol,
        warning: r.earningsWarning,
      })),
    },
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

    // Step 2: Prepare payload for Claude (trimmed to stay under token limits)
    let maxTickers = 9;
    let payload = prepareSynthesisPayload(pipeline, maxTickers);
    let payloadStr = JSON.stringify(payload);

    // Rough token estimate: ~4 chars per token
    const MAX_PROMPT_TOKENS = 150000; // Leave 50K headroom below 200K limit
    let estimatedTokens = Math.ceil(payloadStr.length / 4);

    if (estimatedTokens > MAX_PROMPT_TOKENS) {
      console.warn(`[Convergence Synthesis] Prompt estimated at ${estimatedTokens} tokens (${payloadStr.length} chars), trimming to 5 tickers...`);
      maxTickers = 5;
      payload = prepareSynthesisPayload(pipeline, maxTickers);
      payloadStr = JSON.stringify(payload);
      estimatedTokens = Math.ceil(payloadStr.length / 4);
    }

    if (estimatedTokens > MAX_PROMPT_TOKENS) {
      console.warn(`[Convergence Synthesis] Still at ${estimatedTokens} tokens after ticker trim, truncating payload...`);
      payloadStr = payloadStr.slice(0, MAX_PROMPT_TOKENS * 4);
    }

    console.log(`[Convergence Synthesis] Payload size: ${payloadStr.length} chars (~${estimatedTokens} tokens, ${maxTickers} tickers)`);

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
      top_9: pipeline.rankings.top_9,
      pre_filter: pipeline.pre_filter,
      sector_distribution: pipeline.rankings.sector_distribution,
      social_sentiment: pipeline.social_sentiment,
      rejection_reasons: pipeline.rejection_reasons,
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
