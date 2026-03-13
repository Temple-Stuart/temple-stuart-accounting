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
  excluded: boolean;               // true if filtered out
  exclusionReason: string | null;  // why excluded
  earningsWarning: string | null;  // non-null if earnings within 3 calendar days
}

// ===== PRE-FILTER FUNCTION =====

/**
 * Score and rank all tickers from market-metrics data BEFORE
 * any expensive chain/Finnhub fetches. One batch API call → smarter selection.
 *
 * preScore = ivPercentile * 0.40 + clamp(ivHvSpread/30, 0, 1) * 0.30 + (liquidityRating/5) * 0.30
 *   - If ivPercentile is null or ≤ 0 → excluded
 *   - If ivHvSpread is null or ≤ 0 → excluded
 *   - If liquidityRating is null or < 2 → excluded
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

    if (t.ivHvSpread == null) {
      excluded = true;
      exclusionReason = 'IV-HV spread unavailable — cannot assess vol premium';
    } else if (t.ivHvSpread <= 0) {
      excluded = true;
      exclusionReason = `No vol premium — IV-HV spread is ${t.ivHvSpread.toFixed(1)} (realized vol exceeds implied)`;
    }

    if (ivPercentile == null) {
      excluded = true;
      exclusionReason = exclusionReason ?? 'IV percentile unavailable — cannot score vol elevation';
    }

    if (liquidityRating == null) {
      excluded = true;
      exclusionReason = exclusionReason ?? 'Liquidity rating unavailable — cannot score liquidity';
    }

    // All three components required — no fallbacks.
    // Excluded tickers skip the formula and get preScore = 0.
    let preScore = 0;
    if (!excluded) {
      const ivPctNorm = ivPercentile!; // already 0-1 from TastyTrade
      const ivHvNorm = Math.min(Math.max(t.ivHvSpread! / 30, 0), 1);
      const liqNorm = liquidityRating! / 5;
      preScore = Math.round(
        (ivPctNorm * 0.40 + ivHvNorm * 0.30 + liqNorm * 0.30) * 1000
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
