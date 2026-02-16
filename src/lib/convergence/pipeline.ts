import { getTastytradeClient } from '@/lib/tastytrade';
import { fetchFinnhubBatch, fetchFredMacro } from './data-fetchers';
import type { FinnhubData } from './data-fetchers';
import { computeSectorStats } from './sector-stats';
import type { SectorStatsMap } from './sector-stats';
import { scoreAll } from './composite';
import type { FullScoringResult } from './composite';
import type {
  TTScannerData,
  ConvergenceInput,
  FredMacroData,
} from './types';

// ===== TYPES =====

interface HardFilterStep {
  filter: string;
  passed: number;
  failed: number;
  sample_failed: string[];
}

interface HardFiltersResult {
  input_count: number;
  output_count: number;
  filters_applied: HardFilterStep[];
  survivors: string[];
}

interface PreScoreRow {
  symbol: string;
  pre_score: number;
  ivp: number | null;
  iv_hv_spread: number | null;
  liquidity: number | null;
}

interface RankedRow {
  rank: number;
  symbol: string;
  composite: number;
  vol_edge: number;
  quality: number;
  regime: number;
  info_edge: number;
  convergence: string;
  direction: string;
  strategy: string;
  sector: string | null;
  ivp: number | null;
  iv_hv_spread: number | null;
  hv_trend: string;
  mspr: number | null;
  beat_streak: string;
  key_signal: string;
}

interface DiversificationResult {
  adjustments: string[];
}

export interface PipelineResult {
  pipeline_summary: {
    total_universe: number;
    after_hard_filters: number;
    pre_scored: number;
    finnhub_fetched: number;
    scored: number;
    final_8: string[];
    pipeline_runtime_ms: number;
    finnhub_calls_made: number;
    finnhub_errors: number;
    fred_cached: boolean;
    timestamp: string;
  };
  hard_filters: HardFiltersResult;
  sector_stats: SectorStatsMap;
  pre_scores: PreScoreRow[];
  rankings: {
    scored_count: number;
    top_8: RankedRow[];
    also_scored: RankedRow[];
    sector_distribution: Record<string, number>;
  };
  diversification: DiversificationResult;
  scoring_details: Record<string, FullScoringResult>;
  data_gaps: string[];
  errors: string[];
}

// ===== HELPERS =====

function round(v: number, decimals = 2): number {
  const f = Math.pow(10, decimals);
  return Math.round(v * f) / f;
}

const BATCH_SIZE = 50;

/**
 * Parse raw TT market metrics response into TTScannerData objects.
 * Same field mapping as src/app/api/tastytrade/scanner/route.ts
 */
function parseMarketMetrics(items: Record<string, unknown>[]): TTScannerData[] {
  return items
    .map((m) => {
      const earningsDate =
        (m['earnings'] as Record<string, unknown>)?.['expected-report-date'] as string ||
        m['next-earnings-date'] as string ||
        null;
      let daysTillEarnings: number | null = null;
      if (earningsDate) {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        daysTillEarnings = Math.round(
          (new Date(earningsDate + 'T00:00:00').getTime() - now.getTime()) / 86400000,
        );
      }

      const symbol = (m['symbol'] as string) || '';
      if (!symbol) return null;

      return {
        symbol,
        ivRank: Number(
          m['implied-volatility-index-rank'] ||
          m['tos-implied-volatility-index-rank'] ||
          m['tw-implied-volatility-index-rank'] ||
          0,
        ),
        ivPercentile: Number(m['implied-volatility-percentile'] || 0),
        impliedVolatility: Number(m['implied-volatility-index'] || 0),
        liquidityRating: m['liquidity-rating'] != null ? Number(m['liquidity-rating']) : null,
        earningsDate,
        daysTillEarnings,
        hv30: m['historical-volatility-30-day'] != null ? parseFloat(String(m['historical-volatility-30-day'])) : null,
        hv60: m['historical-volatility-60-day'] != null ? parseFloat(String(m['historical-volatility-60-day'])) : null,
        hv90: m['historical-volatility-90-day'] != null ? parseFloat(String(m['historical-volatility-90-day'])) : null,
        iv30: m['implied-volatility-30-day'] != null ? parseFloat(String(m['implied-volatility-30-day'])) : null,
        ivHvSpread: m['iv-hv-30-day-difference'] != null ? parseFloat(String(m['iv-hv-30-day-difference'])) : null,
        beta: m['beta'] != null ? parseFloat(String(m['beta'])) : null,
        corrSpy: m['corr-spy-3month'] != null ? parseFloat(String(m['corr-spy-3month'])) : null,
        marketCap: m['market-cap'] != null ? Number(m['market-cap']) : null,
        sector: (m['sector'] as string) || null,
        industry: (m['industry'] as string) || null,
        peRatio: m['price-earnings-ratio'] != null ? parseFloat(String(m['price-earnings-ratio'])) : null,
        eps: m['earnings-per-share'] != null ? parseFloat(String(m['earnings-per-share'])) : null,
        dividendYield: m['dividend-yield'] != null ? parseFloat(String(m['dividend-yield'])) : null,
        lendability: (m['lendability'] as string) || null,
        borrowRate: m['borrow-rate'] != null ? parseFloat(String(m['borrow-rate'])) : null,
        earningsActualEps:
          (m['earnings'] as Record<string, unknown>)?.['actual-eps'] != null
            ? parseFloat(String((m['earnings'] as Record<string, unknown>)['actual-eps']))
            : null,
        earningsEstimate:
          (m['earnings'] as Record<string, unknown>)?.['consensus-estimate'] != null
            ? parseFloat(String((m['earnings'] as Record<string, unknown>)['consensus-estimate']))
            : null,
        earningsTimeOfDay:
          ((m['earnings'] as Record<string, unknown>)?.['time-of-day'] as string) || null,
        termStructure: (
          (m['option-expiration-implied-volatilities'] as Array<Record<string, unknown>>) || []
        )
          .filter((e) => e['implied-volatility'])
          .map((e) => ({
            date: String(e['expiration-date']),
            iv: parseFloat(String(e['implied-volatility'])),
          })),
      } satisfies TTScannerData;
    })
    .filter((item): item is TTScannerData => item !== null);
}

// ===== MAIN PIPELINE =====

export async function runPipeline(limit: number = 20): Promise<PipelineResult> {
  const pipelineStart = Date.now();
  const errors: string[] = [];
  const dataGaps: string[] = [];

  // ===== STEP A: Fetch TT Scanner (all tickers) =====
  console.log('[Pipeline] Step A: Fetching TT scanner data...');
  let allScannerData: TTScannerData[] = [];
  try {
    const client = getTastytradeClient();
    await client.accountsAndCustomersService.getCustomerResource();

    // Fetch all market metrics (no symbol filter = all watchlist tickers)
    const raw = await client.marketMetricsService.getMarketMetrics();
    const items = Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
    allScannerData = parseMarketMetrics(items);
    console.log(`[Pipeline] Step A: Got ${allScannerData.length} tickers from TT scanner`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(`Step A (TT Scanner): ${msg}`);
    console.error('[Pipeline] Step A failed:', msg);
  }

  const totalUniverse = allScannerData.length;

  // ===== STEP B: Hard Filters =====
  console.log('[Pipeline] Step B: Applying hard filters...');
  const hardFilters = applyHardFilters(allScannerData);
  console.log(`[Pipeline] Step B: ${hardFilters.input_count} → ${hardFilters.output_count} tickers`);

  // Build a map for quick lookup
  const scannerMap = new Map<string, TTScannerData>();
  for (const item of allScannerData) {
    scannerMap.set(item.symbol, item);
  }

  const survivors = hardFilters.survivors.map(s => scannerMap.get(s)!).filter(Boolean);

  // ===== STEP C: Sector Stats =====
  console.log('[Pipeline] Step C: Computing sector stats...');
  const sectorStats = computeSectorStats(survivors);

  // ===== STEP D: Pre-Score and Limit =====
  console.log('[Pipeline] Step D: Pre-scoring and limiting...');
  const preScores = computePreScores(survivors);
  const topN = preScores.slice(0, limit);
  const topSymbols = topN.map(r => r.symbol);
  console.log(`[Pipeline] Step D: Top ${topSymbols.length} selected for Finnhub fetch`);

  // ===== STEP E: Fetch Finnhub + FRED =====
  console.log('[Pipeline] Step E: Fetching Finnhub + FRED data...');
  const finnhubStart = Date.now();

  const [finnhubResult, fredResult] = await Promise.all([
    fetchFinnhubBatch(topSymbols, 200),
    fetchFredMacro(),
  ]);

  const finnhubMs = Date.now() - finnhubStart;
  console.log(`[Pipeline] Step E: Finnhub fetched in ${finnhubMs}ms, FRED cached=${fredResult.cached}`);

  if (fredResult.error) {
    errors.push(`Step E (FRED): ${fredResult.error}`);
  }

  // ===== STEP F: Score All 4 Categories =====
  console.log('[Pipeline] Step F: Scoring all categories...');
  const scoredTickers: {
    symbol: string;
    scannerData: TTScannerData;
    finnhubData: FinnhubData;
    scoring: FullScoringResult;
  }[] = [];

  for (const symbol of topSymbols) {
    const scannerData = scannerMap.get(symbol);
    if (!scannerData) continue;

    const finnhubData = finnhubResult.data.get(symbol) || {
      fundamentals: null,
      recommendations: [],
      insiderSentiment: [],
      earnings: [],
    };

    // Assemble ConvergenceInput (same structure as single-ticker route)
    const convergenceInput: ConvergenceInput = {
      symbol,
      ttScanner: scannerData,
      candles: [], // No candles in pipeline mode (too expensive for batch)
      finnhubFundamentals: finnhubData.fundamentals,
      finnhubRecommendations: finnhubData.recommendations,
      finnhubInsiderSentiment: finnhubData.insiderSentiment,
      finnhubEarnings: finnhubData.earnings,
      fredMacro: fredResult.data,
    };

    try {
      const scoring = scoreAll(convergenceInput);
      scoredTickers.push({ symbol, scannerData, finnhubData, scoring });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`Step F (score ${symbol}): ${msg}`);
    }
  }

  console.log(`[Pipeline] Step F: Scored ${scoredTickers.length} tickers`);

  // Build ranked rows
  const rankedRows = buildRankedRows(scoredTickers);

  // ===== STEP G: Rank and Diversify =====
  console.log('[Pipeline] Step G: Ranking and diversifying...');
  const { top8, alsoScored, diversification, sectorDistribution } = rankAndDiversify(rankedRows);

  // ===== STEP H: Assemble Full Result =====
  console.log('[Pipeline] Step H: Assembling result...');

  // Build scoring details for top 8 only
  const scoringDetails: Record<string, FullScoringResult> = {};
  for (const row of top8) {
    const ticker = scoredTickers.find(t => t.symbol === row.symbol);
    if (ticker) {
      scoringDetails[row.symbol] = ticker.scoring;
    }
  }

  // Data gaps
  dataGaps.push('candle_technicals: not available in pipeline mode (batch optimization — technicals scored at default 50)');
  dataGaps.push('sector_z_scores: computed at sector level, individual z-scores available via sector_stats');

  const pipelineMs = Date.now() - pipelineStart;

  const result: PipelineResult = {
    pipeline_summary: {
      total_universe: totalUniverse,
      after_hard_filters: hardFilters.output_count,
      pre_scored: preScores.length,
      finnhub_fetched: topSymbols.length,
      scored: scoredTickers.length,
      final_8: top8.map(r => r.symbol),
      pipeline_runtime_ms: pipelineMs,
      finnhub_calls_made: finnhubResult.stats.calls_made,
      finnhub_errors: finnhubResult.stats.errors,
      fred_cached: fredResult.cached,
      timestamp: new Date().toISOString(),
    },
    hard_filters: hardFilters,
    sector_stats: sectorStats,
    pre_scores: preScores,
    rankings: {
      scored_count: scoredTickers.length,
      top_8: top8,
      also_scored: alsoScored,
      sector_distribution: sectorDistribution,
    },
    diversification,
    scoring_details: scoringDetails,
    data_gaps: dataGaps,
    errors,
  };

  console.log(`[Pipeline] Complete in ${pipelineMs}ms. Final 8: ${top8.map(r => r.symbol).join(', ')}`);
  return result;
}

// ===== STEP B: Hard Filters =====

function applyHardFilters(tickers: TTScannerData[]): HardFiltersResult {
  const filtersApplied: HardFilterStep[] = [];
  let current = [...tickers];

  // Filter 1: market_cap > $2B
  {
    const passed: TTScannerData[] = [];
    const failed: string[] = [];
    for (const t of current) {
      if (t.marketCap != null && t.marketCap > 2_000_000_000) {
        passed.push(t);
      } else {
        failed.push(t.symbol);
      }
    }
    filtersApplied.push({
      filter: 'market_cap > $2B',
      passed: passed.length,
      failed: failed.length,
      sample_failed: failed.slice(0, 5),
    });
    current = passed;
  }

  // Filter 2: liquidity_rating >= 2
  {
    const passed: TTScannerData[] = [];
    const failed: string[] = [];
    for (const t of current) {
      if (t.liquidityRating != null && t.liquidityRating >= 2) {
        passed.push(t);
      } else {
        failed.push(t.symbol);
      }
    }
    filtersApplied.push({
      filter: 'liquidity_rating >= 2',
      passed: passed.length,
      failed: failed.length,
      sample_failed: failed.slice(0, 5),
    });
    current = passed;
  }

  // Filter 3: iv30 is not null/zero
  {
    const passed: TTScannerData[] = [];
    const failed: string[] = [];
    for (const t of current) {
      if (t.iv30 != null && t.iv30 > 0) {
        passed.push(t);
      } else {
        failed.push(t.symbol);
      }
    }
    filtersApplied.push({
      filter: 'iv30 is not null/zero',
      passed: passed.length,
      failed: failed.length,
      sample_failed: failed.slice(0, 5),
    });
    current = passed;
  }

  // Filter 4: borrow_rate < 50%
  {
    const passed: TTScannerData[] = [];
    const failed: string[] = [];
    for (const t of current) {
      // If borrow_rate is null, assume it's fine (not HTB)
      if (t.borrowRate == null || t.borrowRate < 50) {
        passed.push(t);
      } else {
        failed.push(t.symbol);
      }
    }
    filtersApplied.push({
      filter: 'borrow_rate < 50%',
      passed: passed.length,
      failed: failed.length,
      sample_failed: failed.slice(0, 5),
    });
    current = passed;
  }

  // Filter 5: no earnings within 7 calendar days
  {
    const passed: TTScannerData[] = [];
    const failed: string[] = [];
    for (const t of current) {
      if (t.daysTillEarnings != null && t.daysTillEarnings >= 0 && t.daysTillEarnings <= 7) {
        failed.push(t.symbol);
      } else {
        passed.push(t);
      }
    }
    filtersApplied.push({
      filter: 'no earnings within 7 days',
      passed: passed.length,
      failed: failed.length,
      sample_failed: failed.slice(0, 5),
    });
    current = passed;
  }

  return {
    input_count: tickers.length,
    output_count: current.length,
    filters_applied: filtersApplied,
    survivors: current.map(t => t.symbol),
  };
}

// ===== STEP D: Pre-Score =====

function computePreScores(survivors: TTScannerData[]): PreScoreRow[] {
  const rows: PreScoreRow[] = [];

  for (const t of survivors) {
    // Normalize IVP: if <= 1.0, multiply by 100
    let ivp = t.ivPercentile;
    if (ivp != null && ivp <= 1.0) ivp = round(ivp * 100, 1);

    // Normalize IV-HV spread
    const ivHvSpread = t.ivHvSpread;
    const liquidityRating = t.liquidityRating;

    // pre_score = 0.40 * (IVP * 100) + 0.30 * min(IV_HV_spread / 20 * 100, 100) + 0.30 * (liquidity_rating / 5 * 100)
    const ivpComponent = ivp != null ? ivp : 0; // already 0-100 after normalization
    const ivHvComponent = ivHvSpread != null ? Math.min((Math.abs(ivHvSpread) / 20) * 100, 100) : 0;
    const liqComponent = liquidityRating != null ? (liquidityRating / 5) * 100 : 0;

    const preScore = round(0.40 * ivpComponent + 0.30 * ivHvComponent + 0.30 * liqComponent, 1);

    rows.push({
      symbol: t.symbol,
      pre_score: preScore,
      ivp: ivp != null ? round(ivp, 1) : null,
      iv_hv_spread: ivHvSpread != null ? round(ivHvSpread, 2) : null,
      liquidity: liquidityRating,
    });
  }

  // Sort descending by pre_score
  rows.sort((a, b) => b.pre_score - a.pre_score);
  return rows;
}

// ===== STEP F/G: Build Ranked Rows =====

function buildRankedRows(
  scoredTickers: {
    symbol: string;
    scannerData: TTScannerData;
    finnhubData: FinnhubData;
    scoring: FullScoringResult;
  }[],
): RankedRow[] {
  // Sort by composite score descending
  const sorted = [...scoredTickers].sort(
    (a, b) => b.scoring.composite.score - a.scoring.composite.score,
  );

  return sorted.map((t, idx) => {
    const s = t.scoring;
    const tt = t.scannerData;

    // Normalize IVP for display
    let ivp = tt.ivPercentile;
    if (ivp != null && ivp <= 1.0) ivp = round(ivp * 100, 1);

    // Extract hv_trend from vol_edge breakdown
    const hvTrend = s.vol_edge.breakdown.mispricing.hv_trend;

    // Extract MSPR from info_edge breakdown
    const mspr = s.info_edge.breakdown.insider_activity.insider_detail.latest_mspr;

    // Extract beat streak from quality breakdown
    const beatStreak = s.quality.breakdown.earnings_quality.earnings_detail.streak;

    // Build convergence string
    const convergence = `${s.composite.categories_above_50}/4`;

    // Build key_signal summary
    const signals: string[] = [];
    if (ivp != null) signals.push(`IVP=${round(ivp, 0)}%`);
    if (tt.iv30 != null && tt.hv30 != null) {
      const vrp = round(tt.iv30 ** 2 - tt.hv30 ** 2, 0);
      signals.push(`VRP=${vrp}`);
    }
    if (hvTrend && !hvTrend.startsWith('UNKNOWN')) {
      const hvLabel = hvTrend.split(' ')[0];
      signals.push(`HV ${hvLabel.toLowerCase()}`);
    }
    if (beatStreak && beatStreak !== 'UNKNOWN' && beatStreak !== 'MIXED') {
      signals.push(beatStreak.toLowerCase());
    }
    if (mspr != null) {
      if (mspr > 5) signals.push('insider buying');
      else if (mspr < -5) signals.push('insider selling');
    }

    return {
      rank: idx + 1,
      symbol: t.symbol,
      composite: s.composite.score,
      vol_edge: s.vol_edge.score,
      quality: s.quality.score,
      regime: s.regime.score,
      info_edge: s.info_edge.score,
      convergence,
      direction: s.composite.direction,
      strategy: s.strategy_suggestion.suggested_strategy,
      sector: tt.sector,
      ivp: ivp != null ? round(ivp, 1) : null,
      iv_hv_spread: tt.ivHvSpread != null ? round(tt.ivHvSpread, 2) : null,
      hv_trend: hvTrend,
      mspr: mspr != null ? round(mspr, 2) : null,
      beat_streak: beatStreak,
      key_signal: signals.join(', '),
    };
  });
}

// ===== STEP G: Rank and Diversify =====

function rankAndDiversify(rankedRows: RankedRow[]): {
  top8: RankedRow[];
  alsoScored: RankedRow[];
  diversification: DiversificationResult;
  sectorDistribution: Record<string, number>;
} {
  const MAX_PER_SECTOR = 2;
  const TOP_N = 8;
  const adjustments: string[] = [];

  const final: RankedRow[] = [];
  const sectorCounts: Record<string, number> = {};
  const remaining = [...rankedRows];
  const skipped: RankedRow[] = [];

  for (const row of remaining) {
    if (final.length >= TOP_N) break;

    const sector = row.sector || 'Unknown';
    const count = sectorCounts[sector] || 0;

    if (count >= MAX_PER_SECTOR) {
      // Find next ticker from a different sector that hasn't been added yet
      skipped.push(row);
      continue;
    }

    sectorCounts[sector] = count + 1;
    final.push(row);
  }

  // If we haven't filled 8 slots due to skipping, promote from remaining
  if (final.length < TOP_N) {
    const notYetAdded = remaining.filter(
      r => !final.some(f => f.symbol === r.symbol) && !skipped.some(s => s.symbol === r.symbol),
    );
    for (const row of notYetAdded) {
      if (final.length >= TOP_N) break;
      const sector = row.sector || 'Unknown';
      const count = sectorCounts[sector] || 0;
      if (count < MAX_PER_SECTOR) {
        sectorCounts[sector] = count + 1;
        final.push(row);
      }
    }
  }

  // Log diversification adjustments
  for (const dropped of skipped) {
    if (final.length >= TOP_N) {
      const sector = dropped.sector || 'Unknown';
      const promoted = final[final.length - 1];
      if (promoted && promoted.symbol !== dropped.symbol) {
        adjustments.push(
          `Dropped ${dropped.symbol} (rank ${dropped.rank}, ${sector}, composite=${dropped.composite}) — sector cap of ${MAX_PER_SECTOR} reached. Promoted ${promoted.symbol} (rank ${promoted.rank}, ${promoted.sector || 'Unknown'}).`,
        );
      }
    }
  }

  // Re-rank final
  final.forEach((row, i) => {
    row.rank = i + 1;
  });

  // Everything else is "also scored"
  const finalSymbols = new Set(final.map(r => r.symbol));
  const alsoScored = rankedRows
    .filter(r => !finalSymbols.has(r.symbol))
    .map((r, i) => ({ ...r, rank: TOP_N + 1 + i }));

  // Sector distribution of final 8
  const sectorDistribution: Record<string, number> = {};
  for (const row of final) {
    const sector = row.sector || 'Unknown';
    sectorDistribution[sector] = (sectorDistribution[sector] || 0) + 1;
  }

  return {
    top8: final,
    alsoScored,
    diversification: { adjustments },
    sectorDistribution,
  };
}
