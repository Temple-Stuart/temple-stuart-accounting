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
  excluded: boolean;               // true if filtered out
  exclusionReason: string | null;  // why excluded
  earningsWarning: string | null;  // non-null if earnings within 3 calendar days
}

// ===== PRE-FILTER FUNCTION =====

/**
 * Score and rank all tickers from market-metrics data BEFORE
 * any expensive chain/Finnhub fetches. One batch API call → smarter selection.
 *
 * preScore = (ivRank / 100) * 0.6 + (liquidityRating / 5) * 0.4
 *   - If ivRank is null → use 0.5 (neutral)
 *   - If liquidityRating is null → use 0.5 (neutral)
 *   - If liquidityRating < 2 → excluded with reason
 *   - If earningsDate within 3 calendar days → flagged (not excluded)
 */
export function computePreFilter(scannerData: TTScannerData[]): PreFilterResult[] {
  const results: PreFilterResult[] = [];

  for (const t of scannerData) {
    const ivRank = t.ivRank > 0 ? t.ivRank : null;
    const ivPercentile = t.ivPercentile > 0 ? t.ivPercentile : null;
    const liquidityRating = t.liquidityRating;

    // Compute earnings warning
    let earningsWarning: string | null = null;
    if (t.daysTillEarnings != null && t.daysTillEarnings >= 0 && t.daysTillEarnings <= 3) {
      earningsWarning = `Earnings in ${t.daysTillEarnings} day${t.daysTillEarnings !== 1 ? 's' : ''} (${t.earningsDate})`;
    }

    // Check exclusion
    let excluded = false;
    let exclusionReason: string | null = null;

    if (liquidityRating != null && liquidityRating < 2) {
      excluded = true;
      exclusionReason = `Low liquidity rating (${liquidityRating}/5)`;
    }

    // Compute preScore
    const ivRankComponent = ivRank != null ? ivRank / 100 : 0.5;
    const liqComponent = liquidityRating != null ? liquidityRating / 5 : 0.5;
    const preScore = Math.round((ivRankComponent * 0.6 + liqComponent * 0.4) * 1000) / 1000;

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
      preScore,
      excluded,
      exclusionReason,
      earningsWarning,
    });
  }

  // Sort by preScore descending (non-excluded first, then excluded)
  results.sort((a, b) => {
    if (a.excluded !== b.excluded) return a.excluded ? 1 : -1;
    return b.preScore - a.preScore;
  });

  return results;
}
