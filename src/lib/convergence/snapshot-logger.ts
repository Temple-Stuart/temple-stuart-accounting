import { prisma } from '@/lib/prisma';
import type { FullScoringResult } from './composite';
import type { VrpHistoryData } from './types';

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

// EDGE-4: the ticker's own historical VRP distribution. One observation per
// distinct scan day (latest snapshot of the day), 365-day window, minimum 20
// distinct days — below that the ticker gets NO entry (vrp_z null → excluded →
// renormalized). No proxy distribution, no default std, ever.
const VRP_HISTORY_WINDOW_DAYS = 365;
const VRP_HISTORY_MIN_DISTINCT_DAYS = 20;

/**
 * Fetch each ticker's own VRP (iv30 − hv30) series from its scan_snapshots
 * history. User-scoped. Tickers without >= 20 distinct scan days of iv30+hv30
 * observations in the window are omitted from the map entirely.
 *
 * NOT fire-and-forget: DB errors propagate — the caller must surface them
 * loudly (the honest outcome is "VRP excluded this run", never a substitute).
 */
export async function fetchVrpHistoryBatch(
  userId: string,
  tickers: string[],
): Promise<Map<string, VrpHistoryData>> {
  const result = new Map<string, VrpHistoryData>();
  if (tickers.length === 0) return result;

  const windowStart = new Date(Date.now() - VRP_HISTORY_WINDOW_DAYS * 86400000);
  const rows = await prisma.scan_snapshots.findMany({
    where: {
      userId,
      ticker: { in: tickers },
      scanDate: { gte: windowStart },
      iv30: { not: null },
      hv30: { not: null },
    },
    select: { ticker: true, scanDate: true, iv30: true, hv30: true },
    orderBy: { scanDate: 'asc' },
  });

  // Per ticker: keep the LAST observation of each distinct calendar day (UTC)
  const perTickerByDay = new Map<string, Map<string, number>>();
  for (const row of rows) {
    if (row.iv30 == null || row.hv30 == null) continue;
    const day = row.scanDate.toISOString().slice(0, 10);
    let byDay = perTickerByDay.get(row.ticker);
    if (!byDay) {
      byDay = new Map<string, number>();
      perTickerByDay.set(row.ticker, byDay);
    }
    // rows are scanDate-ascending, so a later same-day row overwrites
    byDay.set(day, row.iv30 - row.hv30);
  }

  for (const [ticker, byDay] of perTickerByDay) {
    if (byDay.size < VRP_HISTORY_MIN_DISTINCT_DAYS) continue;
    result.set(ticker, {
      values: [...byDay.values()],
      distinct_days: byDay.size,
      window_days: VRP_HISTORY_WINDOW_DAYS,
      source: 'scan_snapshots',
    });
  }

  return result;
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
