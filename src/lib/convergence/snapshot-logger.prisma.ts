/**
 * MODEL-02 — the Prisma-backed ports for snapshot-logger.ts (the store the
 * scan writes scan_snapshots through, and EDGE-4's own-history read). Kept
 * apart so the pure logic and its tests import no database.
 */
import { prisma } from '@/lib/prisma';
import type { SnapshotStore } from './snapshot-logger';
import type { VrpHistoryData } from './types';

export const prismaSnapshotStore: SnapshotStore = {
  async create(row) {
    await prisma.scan_snapshots.create({ data: row });
  },
};

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

