/**
 * EDGE-01 ruling §5 — the seller benchmark. Cboe publishes the PUT (S&P 500
 * PutWrite) and CMBO (S&P 500 Covered Combo) daily index histories free, no
 * key, no login:
 *   https://cdn.cboe.com/api/global/us_indices/daily_prices/PUT_History.csv
 *   https://cdn.cboe.com/api/global/us_indices/daily_prices/CMBO_History.csv
 * (index page https://www.cboe.com/tradable_products/vix/vix_historical_data/;
 * format observed 2026-09-15: header `DATE,PUT` / `DATE,CMBO`, rows
 * `MM/DD/YYYY,level`). The script fetches at run time and keeps nothing in
 * the database. A failed fetch prints "unavailable" — never a substitute.
 */
export type BenchmarkIndex = 'PUT' | 'CMBO';

export const CBOE_BASE = 'https://cdn.cboe.com/api/global/us_indices/daily_prices';

export function cboeHistoryUrl(index: BenchmarkIndex): string {
  return `${CBOE_BASE}/${index}_History.csv`;
}

export interface SeriesPoint { date: string; value: number }

/** Parse the Cboe CSV into ascending ISO-dated points; malformed rows are skipped and counted. */
export function parseCboeHistory(csv: string): { series: SeriesPoint[]; skipped: number } {
  const lines = csv.split(/\r?\n/);
  const series: SeriesPoint[] = [];
  let skipped = 0;
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const [d, v] = line.split(',');
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((d ?? '').trim());
    const value = Number(v);
    if (!m || !Number.isFinite(value)) {
      skipped += 1;
      continue;
    }
    series.push({ date: `${m[3]}-${m[1]}-${m[2]}`, value });
  }
  series.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return { series, skipped };
}

export interface WindowReturn {
  startDate: string;
  endDate: string;
  startLevel: number;
  endLevel: number;
  /** endLevel ÷ startLevel − 1 */
  ret: number;
}

/** Return over [startISO, endISO]: first close on/after start to last close on/before end. */
export function windowReturn(series: readonly SeriesPoint[], startISO: string, endISO: string): WindowReturn | null {
  if (startISO > endISO) return null;
  const start = series.find((p) => p.date >= startISO);
  let end: SeriesPoint | undefined;
  for (const p of series) {
    if (p.date <= endISO) end = p;
    else break;
  }
  if (!start || !end || end.date < start.date || start.value <= 0) return null;
  return { startDate: start.date, endDate: end.date, startLevel: start.value, endLevel: end.value, ret: end.value / start.value - 1 };
}

export type FetchedSeries = { ok: true; index: BenchmarkIndex; series: SeriesPoint[]; skipped: number } | { ok: false; index: BenchmarkIndex; error: string };

export async function fetchCboeHistory(index: BenchmarkIndex, fetchImpl: typeof fetch = fetch): Promise<FetchedSeries> {
  try {
    const resp = await fetchImpl(cboeHistoryUrl(index));
    if (!resp.ok) return { ok: false, index, error: `HTTP ${resp.status}` };
    const { series, skipped } = parseCboeHistory(await resp.text());
    if (series.length === 0) return { ok: false, index, error: 'no rows parsed' };
    return { ok: true, index, series, skipped };
  } catch (e: unknown) {
    return { ok: false, index, error: e instanceof Error ? e.message : String(e) };
  }
}
