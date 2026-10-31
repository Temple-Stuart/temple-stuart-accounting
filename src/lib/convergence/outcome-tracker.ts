import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { fetchTTCandlesBatch } from './data-fetchers';
import { getTastytradeClient } from '@/lib/tastytrade';

/**
 * Phase 5: Update a scan snapshot with actual outcome data.
 * Called by the outcome-closer (EDGE-5) after DTE expiry to measure
 * prediction quality.
 *
 * Enables:
 * - Hit rate per gate / sub-score
 * - Empirical threshold calibration
 * - P&L attribution to specific signal components
 * - IV mean-reversion validation
 */
export async function updateSnapshotOutcome(
  snapshotId: string,
  outcome: {
    pnl?: number;
    spotPrice?: number;
    iv?: number;
    ivCompressed?: boolean;
    stayedInRange?: boolean;
  },
  // EDGE-5 label requirement: provenance of the realized observations, merged
  // into the row's fullTrace as `outcome_meta` (no schema migration needed).
  meta?: Record<string, unknown>,
): Promise<void> {
  const data: Prisma.scan_snapshotsUpdateInput = {
    outcomeDate: new Date(),
    outcomePnl: outcome.pnl ?? null,
    outcomeSpotPrice: outcome.spotPrice ?? null,
    outcomeIV: outcome.iv ?? null,
    ivCompressed: outcome.ivCompressed ?? null,
    stayedInRange: outcome.stayedInRange ?? null,
  };

  if (meta) {
    const row = await prisma.scan_snapshots.findUnique({
      where: { id: snapshotId },
      select: { fullTrace: true },
    });
    const trace =
      row?.fullTrace && typeof row.fullTrace === 'object' && !Array.isArray(row.fullTrace)
        ? (row.fullTrace as Record<string, unknown>)
        : {};
    data.fullTrace = { ...trace, outcome_meta: meta } as Prisma.InputJsonValue;
  }

  await prisma.scan_snapshots.update({
    where: { id: snapshotId },
    data,
  });
}

// ===== EDGE-5: OUTCOME CLOSER =====

// Realized-data source labels (recorded on every closed row + run summary)
const SPOT_SOURCE = 'tastytrade-daily-candles (fetchTTCandlesBatch)';
const IV_SOURCE = 'tastytrade-market-metrics implied-volatility-30-day';

// A daily close counts as "the realized price as of the horizon" only if it
// falls on the horizon date or within this many calendar days BEFORE it
// (weekend/holiday tolerance). A larger gap means the candle feed has a hole —
// we REFUSE to close against it (tripwire: no closing against stale data).
const SPOT_CANDLE_MAX_LAG_DAYS = 5;

// There is no integrated historical-IV source — TT market-metrics only reports
// CURRENT iv30. The live observation is an honest "IV at close" only while the
// close runs shortly after the horizon; beyond this window outcomeIV stays
// null and the reason is declared. Never backfilled, never estimated.
const IV_OBSERVATION_WINDOW_DAYS = 5;

// Fields updateSnapshotOutcome accepts but that CANNOT be computed honestly
// today. updateSnapshotOutcome contains no math for them and the snapshot row
// stores no inputs for them — declared, not improvised (tripwire).
const DECLARED_NULL_FIELDS = [
  'outcomePnl: no integrated historical option-price source — cannot compute realized P&L without estimating',
  'stayedInRange: snapshot stores no explicit expected range — deriving one post-hoc would be improvised math',
] as const;

export interface OutcomeCloseSummary {
  checked: number;             // unclosed snapshots examined
  due: number;                 // past horizon at run time
  closed: number;              // outcomes written this run
  pending_not_yet_due: number; // horizon in the future — untouched
  unclosable: { reason: string; count: number }[];
  source: string;              // realized-data source label
  declared_null_fields: string[];
  timestamp: string;
}

/**
 * EDGE-5: close realized outcomes on scan snapshots whose horizon
 * (scanDate + suggestedDTE days) has passed.
 *
 * Idempotent: selects only rows with outcomeDate = null; a closed row is never
 * reselected. Rows that cannot be closed keep outcome = null (retried next
 * run) and are DECLARED in the summary with a reason — no estimated prices,
 * no interpolation, no closing against stale data.
 */
export async function closeSnapshotOutcomes(userId: string): Promise<OutcomeCloseSummary> {
  const now = new Date();
  const nowMs = now.getTime();

  // Idempotency guard: only unclosed rows, user-scoped.
  const candidates = await prisma.scan_snapshots.findMany({
    where: { userId, outcomeDate: null },
    select: {
      id: true,
      ticker: true,
      scanDate: true,
      suggestedDTE: true,
      iv30: true,
    },
    orderBy: { scanDate: 'asc' },
  });

  const unclosableCounts = new Map<string, number>();
  const addUnclosable = (reason: string) =>
    unclosableCounts.set(reason, (unclosableCounts.get(reason) ?? 0) + 1);

  type DueRow = (typeof candidates)[number] & { horizonMs: number };
  const due: DueRow[] = [];
  let pending = 0;

  for (const row of candidates) {
    if (row.suggestedDTE == null) {
      // No horizon can be derived — permanently unclosable, declared each run.
      addUnclosable('no horizon (suggestedDTE null)');
      continue;
    }
    const horizonMs = row.scanDate.getTime() + row.suggestedDTE * 86400000;
    if (horizonMs > nowMs) {
      pending++;
      continue;
    }
    due.push({ ...row, horizonMs });
  }

  let closed = 0;

  if (due.length > 0) {
    // ---- Realized spot: TT daily candles covering every due row's horizon ----
    const tickers = [...new Set(due.map(r => r.ticker))];
    const oldestScanMs = Math.min(...due.map(r => r.scanDate.getTime()));
    const lookbackDays = Math.ceil((nowMs - oldestScanMs) / 86400000) + 7;
    const candleResult = await fetchTTCandlesBatch(tickers, lookbackDays);

    // ---- Realized IV: live market-metrics, valid only near the horizon ----
    // Only fetched if at least one due row is within the observation window.
    const ivEligible = due.filter(
      r => nowMs - r.horizonMs <= IV_OBSERVATION_WINDOW_DAYS * 86400000,
    );
    const liveIvByTicker = new Map<string, number>();
    let ivFetchError: string | null = null;
    if (ivEligible.length > 0) {
      try {
        const client = getTastytradeClient();
        await client.accountsAndCustomersService.getCustomerResource();
        const ivTickers = [...new Set(ivEligible.map(r => r.ticker))];
        const raw = await client.marketMetricsService.getMarketMetrics({
          symbols: ivTickers.join(','),
        });
        const items = Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
        for (const m of items) {
          const sym = (m['symbol'] as string) || '';
          const iv30 =
            m['implied-volatility-30-day'] != null
              ? parseFloat(String(m['implied-volatility-30-day']))
              : null;
          if (sym && iv30 != null && !isNaN(iv30)) liveIvByTicker.set(sym, iv30);
        }
      } catch (e: unknown) {
        // Fail loud in the summary; affected rows close with outcomeIV null +
        // declared reason. Never a substituted IV.
        ivFetchError = e instanceof Error ? e.message : String(e);
        console.error('[OutcomeCloser] market-metrics IV fetch failed:', ivFetchError);
      }
    }

    for (const row of due) {
      const candles = candleResult.data.get(row.ticker) ?? [];
      if (candles.length === 0) {
        addUnclosable('no candle data for ticker (TT candle fetch returned none)');
        continue;
      }

      // Latest daily close ON or BEFORE the horizon, within the lag tolerance.
      // This is the actual market close as of the horizon — not an estimate.
      const horizonDateStr = new Date(row.horizonMs).toISOString().slice(0, 10);
      let spotCandle: (typeof candles)[number] | null = null;
      for (const c of candles) {
        if (c.date <= horizonDateStr && (spotCandle === null || c.date > spotCandle.date)) {
          spotCandle = c;
        }
      }
      if (!spotCandle) {
        addUnclosable('no candle at/before horizon (candle history does not reach back that far)');
        continue;
      }
      const lagDays = (row.horizonMs - spotCandle.time) / 86400000;
      if (lagDays > SPOT_CANDLE_MAX_LAG_DAYS) {
        addUnclosable(`nearest candle > ${SPOT_CANDLE_MAX_LAG_DAYS}d before horizon (refused: stale close)`);
        continue;
      }

      // Realized IV — only when observed within the window after the horizon.
      const withinIvWindow = nowMs - row.horizonMs <= IV_OBSERVATION_WINDOW_DAYS * 86400000;
      const liveIv = withinIvWindow ? liveIvByTicker.get(row.ticker) ?? null : null;
      const ivNullReason = liveIv != null
        ? null
        : !withinIvWindow
          ? `horizon passed > ${IV_OBSERVATION_WINDOW_DAYS}d ago — live IV is no longer the IV at close; no historical IV source`
          : ivFetchError
            ? `market-metrics fetch failed: ${ivFetchError}`
            : 'market-metrics returned no iv30 for ticker';

      // IV mean-reversion check: direct comparison of two real observations
      // (scan-time iv30 vs realized iv30, same TT field). Only when both exist.
      const ivCompressed =
        liveIv != null && row.iv30 != null ? liveIv < row.iv30 : undefined;

      await updateSnapshotOutcome(
        row.id,
        {
          spotPrice: spotCandle.close,
          iv: liveIv ?? undefined,
          ivCompressed,
          // outcomePnl / stayedInRange: intentionally absent — declared null
          // (see DECLARED_NULL_FIELDS). No estimation.
        },
        {
          source_spot: SPOT_SOURCE,
          source_iv: liveIv != null ? IV_SOURCE : null,
          horizon_date: horizonDateStr,
          horizon_basis: 'scanDate + suggestedDTE days',
          spot_candle_date: spotCandle.date,
          iv_observed_at: liveIv != null ? now.toISOString() : null,
          iv_null_reason: ivNullReason,
          declared_null_fields: [...DECLARED_NULL_FIELDS],
          closed_at: now.toISOString(),
        },
      );
      closed++;
    }
  }

  const summary: OutcomeCloseSummary = {
    checked: candidates.length,
    due: due.length,
    closed,
    pending_not_yet_due: pending,
    unclosable: [...unclosableCounts.entries()].map(([reason, count]) => ({ reason, count })),
    source: `${SPOT_SOURCE}; ${IV_SOURCE} (within ${IV_OBSERVATION_WINDOW_DAYS}d of horizon only)`,
    declared_null_fields: [...DECLARED_NULL_FIELDS],
    timestamp: now.toISOString(),
  };

  console.log(
    `[OutcomeCloser] checked=${summary.checked} due=${summary.due} closed=${summary.closed} pending=${summary.pending_not_yet_due} unclosable=${JSON.stringify(summary.unclosable)}`,
  );

  return summary;
}
