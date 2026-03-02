import { prisma } from '@/lib/prisma';
import type { FullScoringResult } from './composite';

export interface SnapshotInput {
  userId: string;
  ticker: string;
  scoring: FullScoringResult;
  spotPrice?: number;
  iv30?: number;
  hv30?: number;
  ivPercentile?: number;
  vixLevel?: number;
}

/**
 * Persist a scan result snapshot for future outcome tracking and backtesting.
 * Fire-and-forget — errors are logged but never propagate to the caller.
 */
export async function logScanSnapshot(input: SnapshotInput): Promise<void> {
  try {
    const { scoring, ticker, userId } = input;
    const composite = scoring.composite;
    const regime = scoring.regime;
    const strategy = scoring.strategy_suggestion;

    await prisma.scan_snapshots.create({
      data: {
        userId,
        ticker,

        // Price context
        spotPrice: input.spotPrice ?? null,
        iv30: input.iv30 ?? null,
        hv30: input.hv30 ?? null,
        ivPercentile: input.ivPercentile ?? null,

        // Gate scores
        volEdgeScore: scoring.vol_edge.score,
        qualityScore: scoring.quality.score,
        regimeScore: regime.score,
        infoEdgeScore: scoring.info_edge.score,
        compositeScore: composite.score,

        // Position sizing
        gatesAbove50: composite.categories_above_50,
        positionSizePct: composite.position_size_pct,
        sizingMethod: composite.sizing_method,

        // Data confidence
        dataConfidence: composite.data_confidence.confidence,
        imputedCount: composite.data_confidence.imputed_sub_scores,

        // Regime context
        regimeLabel: regime.breakdown.dominant_regime ?? null,
        vixLevel: input.vixLevel ?? regime.breakdown.vix_overlay.vix ?? null,

        // Strategy suggested
        suggestedStrategy: strategy.suggested_strategy ?? null,
        suggestedDTE: strategy.suggested_dte ?? null,

        // Full trace for replay/analysis
        fullTrace: JSON.parse(JSON.stringify(scoring)),
      },
    });
  } catch (error) {
    // Snapshot logging is observational — never fail the scan
    console.error(`[ScanSnapshot] Failed to log snapshot for ${input.ticker}:`, error);
  }
}

/**
 * Batch-log snapshots for multiple tickers. Fire-and-forget.
 * Uses individual inserts (not createMany) so partial failures don't lose all data.
 */
export async function logScanSnapshotBatch(
  userId: string,
  tickers: {
    symbol: string;
    scoring: FullScoringResult;
    spotPrice?: number;
    iv30?: number;
    hv30?: number;
    ivPercentile?: number;
    vixLevel?: number;
  }[],
): Promise<void> {
  for (const ticker of tickers) {
    void logScanSnapshot({
      userId,
      ticker: ticker.symbol,
      scoring: ticker.scoring,
      spotPrice: ticker.spotPrice,
      iv30: ticker.iv30,
      hv30: ticker.hv30,
      ivPercentile: ticker.ivPercentile,
      vixLevel: ticker.vixLevel,
    });
  }
}
