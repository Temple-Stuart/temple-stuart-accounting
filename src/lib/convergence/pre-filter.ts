import type { TTScannerData } from './types';

// ===== PRE-FILTER RESULT =====

export interface PreFilterResult {
  symbol: string;
  ivRank: number | null;           // 0-100, from implied-volatility-index-rank
  ivPercentile: number | null;     // 0-100, from implied-volatility-percentile
  liquidityRating: number | null;  // 1-5 stars
  liquidityValue: number | null;   // raw liquidity value (same as rating for TT)
  beta: number | null;
  marketCap: number | null;
  earningsDate: string | null;     // next earnings date
  corrSpy3Month: number | null;    // SPY correlation
  preScore: number;                // composite score for ranking
  ivHvSpread: number | null;       // IV minus HV spread — primary vol edge signal
}

// ===== PRE-FILTER FUNCTION =====

/**
 * Score and rank all tickers from market-metrics data BEFORE
 * any expensive chain/Finnhub fetches. One batch API call → smarter selection.
 *
 * preScore = ivRank * 0.40 + clamp(ivHvSpread/30, 0, 1) * 0.35 + (liquidityRating/5) * 0.25
 *   - If any required input (ivRank, ivHvSpread, liquidityRating) is null → preScore = 0
 *   - Step B ranks only — it does not eliminate.
 */
export function computePreFilter(scannerData: TTScannerData[]): PreFilterResult[] {
  const results: PreFilterResult[] = [];

  for (const t of scannerData) {
    const ivRank = t.ivRank > 0 ? t.ivRank : null;
    const ivPercentile = t.ivPercentile > 0 ? t.ivPercentile : null;
    const liquidityRating = t.liquidityRating;

    // All three components required — null inputs score 0.
    let preScore = 0;
    if (ivRank != null && t.ivHvSpread != null && liquidityRating != null) {
      const ivRankNorm = ivRank; // 0-100 from TastyTrade
      const ivHvNorm = Math.min(Math.max(t.ivHvSpread / 30, 0), 1);
      const liqNorm = liquidityRating / 5;
      preScore = Math.round(
        (ivRankNorm * 0.40 + ivHvNorm * 0.35 + liqNorm * 0.25) * 1000
      ) / 1000;
    }

    results.push({
      symbol: t.symbol,
      ivRank,
      ivPercentile,
      liquidityRating,
      liquidityValue: liquidityRating, // TT returns rating directly as the value
      beta: t.beta,
      marketCap: t.marketCap,
      earningsDate: t.earningsDate,
      corrSpy3Month: t.corrSpy,
      ivHvSpread: t.ivHvSpread ?? null,
      preScore,
    });
  }

  // Sort by preScore descending
  results.sort((a, b) => b.preScore - a.preScore);

  return results;
}
