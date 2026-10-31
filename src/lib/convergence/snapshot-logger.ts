import type { Prisma } from '@prisma/client';
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

// MODEL-02 STEP 1 — the log never lies.
//
// Until 2026-09-16 `logScanSnapshot` wrapped its insert in a bare catch that
// console.error'd and returned; the pipeline `void`ed the batch and reported
// `saved: true` regardless. From 2026-07-08 every seller-side row failed
// (P2000: the brake-UNVERIFIED suggestion line is 163 chars, the column was
// VarChar(100)) and nothing said so — scan_snapshots holds ZERO rows since.
//
// Now: one row, one insert, no catch. The batch records every failure by
// ticker and hands the caller a SnapshotWriteResult; the pipeline AWAITS it
// and the scan response carries `snapshot: { written, reason, failed[] }`.
// Nothing is reported as recorded when it was not.

/** The width of scan_snapshots.suggestedStrategy (schema.prisma) — the longest
 * producible string is ≈272 chars (brake UNVERIFIED with both legs missing and
 * a clipped VVIX reason, composite.ts) and the column carries ≈47% margin. The
 * law in scripts/assert-tool-registry.ts holds the schema to this number and
 * modelInputs.test.ts holds the strings under it. Set 2026-09-16. */
export const SNAPSHOT_SUGGESTED_STRATEGY_MAX = 400;

export interface SnapshotWriteFailure {
  ticker: string;
  /** The store's own words — Prisma code + first line of the message, or the thrown value. */
  reason: string;
}

/** What the scan response says about its own record. `written` is true only when EVERY row landed. */
export interface SnapshotWriteResult {
  written: boolean;
  rows_attempted: number;
  rows_written: number;
  rows_failed: number;
  failed: SnapshotWriteFailure[];
  /** null when written; otherwise why not (no session, or the failures summarised). */
  reason: string | null;
}

export type SnapshotRow = Prisma.scan_snapshotsUncheckedCreateInput;

/** The store port — production is prismaSnapshotStore (snapshot-logger.prisma.ts); tests inject a failing one. This module imports no database. */
export interface SnapshotStore {
  create(row: SnapshotRow): Promise<void>;
}

/** The row a scan writes for one ticker — pure; exported so a test can measure it. */
export function buildSnapshotRow(input: SnapshotInput): SnapshotRow {
  const { scoring, ticker, userId } = input;
  const composite = scoring.composite;
  const regime = scoring.regime;
  const strategy = scoring.strategy_suggestion;
  return {
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
  };
}

/** The store's failure in one line: Prisma's code and the message's first line, or the thrown value. */
export function describeStoreError(e: unknown): string {
  if (e instanceof Error) {
    const code = (e as { code?: unknown }).code;
    const first = e.message.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 2).join(' ');
    return `${typeof code === 'string' ? `${code}: ` : ''}${first || e.name}`.slice(0, 300);
  }
  return String(e).slice(0, 300);
}

/**
 * Persist one scan result snapshot. NOT fire-and-forget and NOT caught: a
 * store failure throws to the caller, who records it (the batch below) or
 * fails loudly. MODEL-02.
 */
export async function logScanSnapshot(input: SnapshotInput, store: SnapshotStore): Promise<void> {
  await store.create(buildSnapshotRow(input));
}

/**
 * Batch-log snapshots for multiple tickers, one insert each (so one bad row
 * does not lose the rest), AWAITED in order. Every failure is recorded by
 * ticker with the store's reason and returned — the caller puts the result on
 * the scan response. MODEL-02: no catch swallows anything; the catch here
 * RECORDS (the failure is the answer, surfaced by the caller).
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
  store: SnapshotStore,
): Promise<SnapshotWriteResult> {
  const failed: SnapshotWriteFailure[] = [];
  let written = 0;
  for (const ticker of tickers) {
    try {
      await logScanSnapshot({
        userId,
        ticker: ticker.symbol,
        scoring: ticker.scoring,
        spotPrice: ticker.spotPrice,
        iv30: ticker.iv30,
        hv30: ticker.hv30,
        ivPercentile: ticker.ivPercentile,
        vixLevel: ticker.vixLevel,
      }, store);
      written += 1;
    } catch (e: unknown) {
      // Recorded, not swallowed: the ticker and the store's reason ride on the
      // result the pipeline awaits and the scan response shows.
      failed.push({ ticker: ticker.symbol, reason: describeStoreError(e) });
    }
  }
  return summariseSnapshotWrite(tickers.length, written, failed);
}

/** Pure: the result shape from the counts. `written` only when nothing failed AND something was attempted. */
export function summariseSnapshotWrite(attempted: number, written: number, failed: SnapshotWriteFailure[]): SnapshotWriteResult {
  const distinct = [...new Set(failed.map((f) => f.reason))];
  const reason = failed.length === 0
    ? (attempted === 0 ? 'nothing to write — no scored tickers' : null)
    : `${failed.length} of ${attempted} snapshot rows NOT written — ${distinct.slice(0, 2).join(' | ')}${distinct.length > 2 ? ` | +${distinct.length - 2} more` : ''} (tickers: ${failed.slice(0, 5).map((f) => f.ticker).join(', ')}${failed.length > 5 ? ', …' : ''})`;
  return {
    written: failed.length === 0 && attempted > 0,
    rows_attempted: attempted,
    rows_written: written,
    rows_failed: failed.length,
    failed,
    reason,
  };
}

/** The result when the scan had no user session: nothing was attempted, and the response says so. */
export function snapshotNotAttempted(reason: string): SnapshotWriteResult {
  return { written: false, rows_attempted: 0, rows_written: 0, rows_failed: 0, failed: [], reason };
}
