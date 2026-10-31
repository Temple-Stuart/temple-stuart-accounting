/**
 * MODEL-02 STEP 2 — THE INPUTS ARE REAL: Cboe's free daily index histories.
 *
 * Cboe publishes the daily history of every index it computes as a CSV at
 *   https://cdn.cboe.com/api/global/us_indices/daily_prices/<INDEX>_History.csv
 * — no key, no login, no meter (confirmed 2026-09-16 by name for VVIX, VIX9D,
 * VIX, VIX3M, VIX6M, VIX1Y, SKEW, and LOG-01's PUT and CMBO; the file is
 * updated once a day after the close and the last row was the prior session).
 * Two shapes: `DATE,<INDEX>` (VVIX, SKEW, PUT, CMBO) and
 * `DATE,OPEN,HIGH,LOW,CLOSE` (the VIX family) — this reads the CLOSE.
 *
 * ONE fetch per file per process per 24 h (CBOE_TTL_MS, the same in-process
 * shape as data-fetchers.ts' FRED cache; EDGE-01's scripts/edge-read.ts
 * fetches PUT/CMBO at run time with no cache — there was no cached Cboe path
 * to share, so this is it). Every point carries the file, the row date and
 * fetched_at; a file that cannot be fetched or parsed is an ERROR on the
 * result — declared by the regime gate (the brake reads UNVERIFIED with the
 * reason), never imputed, never served from a stale row as if fresh.
 *
 * Ports (fetch, clock) are injectable so the tests are hermetic.
 */
import { parseCboeHistory, CBOE_BASE } from '../edge-read/cboe';
import type { CboeDailyData, CboeDailyPoint } from './types';

export type CboeIndex = 'VVIX' | 'VIX9D' | 'VIX' | 'VIX3M' | 'VIX6M' | 'SKEW';
export const CBOE_INDICES: readonly CboeIndex[] = ['VVIX', 'VIX9D', 'VIX', 'VIX3M', 'VIX6M', 'SKEW'];
/** MODEL-02: the day the weight-0 Cboe regime inputs (term structure, SKEW) were set — present, logged, tuned by nobody. */
export const CBOE_INPUTS_SET_ON = '2026-09-16';

/** One fetch per file per process per day — the file itself moves once a day. Set 2026-09-16. */
export const CBOE_TTL_MS = 24 * 60 * 60 * 1000;
export const CBOE_SOURCE = 'Cboe daily index history (cdn.cboe.com, free, no key)';

export function cboeDailyUrl(index: CboeIndex): string {
  return `${CBOE_BASE}/${index}_History.csv`;
}

/** The VIX family carries OHLC; the read is the CLOSE. VVIX/SKEW carry one value. */
export function parseCboeDaily(csv: string): { date: string; value: number } | null {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return null;
  const header = lines[0].split(',').map((h) => h.trim().toUpperCase());
  const closeIdx = header.indexOf('CLOSE');
  if (closeIdx >= 0) {
    // DATE,OPEN,HIGH,LOW,CLOSE — reduce to DATE,CLOSE and reuse the EDGE-01 parser
    const reduced = ['DATE,CLOSE', ...lines.slice(1).map((l) => { const c = l.split(','); return `${c[0]},${c[closeIdx] ?? ''}`; })].join('\n');
    const { series } = parseCboeHistory(reduced);
    const last = series[series.length - 1];
    return last ? { date: last.date, value: last.value } : null;
  }
  const { series } = parseCboeHistory(csv);
  const last = series[series.length - 1];
  return last ? { date: last.date, value: last.value } : null;
}

export interface CboePorts {
  fetch: (url: string) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;
  now: () => Date;
}

const defaultPorts: CboePorts = {
  fetch: (url) => fetch(url, { headers: { accept: 'text/csv,*/*' } }),
  now: () => new Date(),
};

interface CacheEntry { point: CboeDailyPoint; fetchedAtMs: number }
const cache = new Map<CboeIndex, CacheEntry>();

/** Test hook — drops the in-process cache. */
export function resetCboeCache(): void {
  cache.clear();
}

async function fetchOne(index: CboeIndex, ports: CboePorts): Promise<CboeDailyPoint> {
  const nowMs = ports.now().getTime();
  const hit = cache.get(index);
  if (hit && nowMs - hit.fetchedAtMs < CBOE_TTL_MS) return hit.point;
  const url = cboeDailyUrl(index);
  const res = await ports.fetch(url);
  if (!res.ok) throw new Error(`${index}: HTTP ${res.status} from ${url}`);
  const text = await res.text();
  const last = parseCboeDaily(text);
  if (!last) throw new Error(`${index}: no parsable row in ${url}`);
  const point: CboeDailyPoint = { index, value: last.value, date: last.date, fetched_at: ports.now().toISOString(), source: CBOE_SOURCE, url };
  cache.set(index, { point, fetchedAtMs: nowMs });
  return point;
}

/**
 * Every index the regime gate reads, fetched (or served within the 24 h TTL)
 * and dated. A failure is recorded per index in `errors` and the point is
 * null — the gate declares it; nothing substitutes.
 */
export async function fetchCboeDaily(ports: CboePorts = defaultPorts): Promise<CboeDailyData> {
  const out: CboeDailyData = { vvix: null, vix9d: null, vix: null, vix3m: null, vix6m: null, skew: null, errors: [], fetched_at: ports.now().toISOString() };
  const keyOf: Record<CboeIndex, keyof Omit<CboeDailyData, 'errors' | 'fetched_at'>> = { VVIX: 'vvix', VIX9D: 'vix9d', VIX: 'vix', VIX3M: 'vix3m', VIX6M: 'vix6m', SKEW: 'skew' };
  const results = await Promise.allSettled(CBOE_INDICES.map((i) => fetchOne(i, ports)));
  results.forEach((r, n) => {
    const index = CBOE_INDICES[n];
    if (r.status === 'fulfilled') out[keyOf[index]] = r.value;
    else out.errors.push(r.reason instanceof Error ? r.reason.message : `${index}: ${String(r.reason)}`);
  });
  return out;
}
