/**
 * TRADE-COST-01 — COST IS MEASURED, NOT ASSERTED.
 *
 * Runs the per-symbol Finnhub fetchers the scan runs — the same nineteen
 * functions in src/lib/convergence/data-fetchers.ts that pipeline.ts calls for
 * every symbol in topSymbols — TWICE over the symbols given, on the run's meter
 * (src/lib/convergence/finnhub-cache.ts), and prints the upstream calls and the
 * store hits of each run, by endpoint. Run 1 against an empty store is the COLD
 * number; run 2 inside every TTL is the WARM number. Those two numbers are what
 * SCAN_COST pins (src/lib/observatory/feedCost.ts) and what the build prints.
 *
 *   DATABASE_URL=… FINNHUB_API_KEY=… npx tsx scripts/measure-finnhub-scan-cost.ts AAPL,MSFT,NVDA,AMZN,GOOGL,META,BRK.B,LLY,AVGO,JPM
 *
 * Against the vendor this spends 26 metered calls per symbol on run 1 and 8 on
 * run 2. It touches nothing but finnhub_responses. It is not the scan: no
 * TastyTrade, no SEC, no FRED, no scoring — only the Finnhub call sites.
 */
import { pathToFileURL } from 'node:url';
import {
  fetchAnnualFinancials, fetchFinnhubBatch, fetchFinnhubDividendHistory, fetchFinnhubEarningsCalendar,
  fetchFinnhubEarningsQuality, fetchFinnhubEbitEstimates, fetchFinnhubEbitdaEstimates, fetchFinnhubFundOwnership,
  fetchFinnhubInstitutionalOwnership, fetchFinnhubNewsSentiment, fetchFinnhubPriceMetrics, fetchFinnhubRevenueBreakdown,
  fetchInsiderTransactions, fetchNewsSentiment, fetchPeerTickers, fetchQuarterlyFinancials,
} from '../src/lib/convergence/data-fetchers';
import { withFinnhubMeter, type FinnhubMeter } from '../src/lib/convergence/finnhub-cache';
import { FINNHUB_TTL, finnhubCallsPerSymbol } from '../src/lib/convergence/finnhub-ttl';

/** One scan's Finnhub work for these symbols, in the pipeline's own shape: the batch, then the per-endpoint loops concurrently (pipeline.ts Step E → I7). */
export async function oneScanOfFinnhub(symbols: string[]): Promise<{ errors: string[] }> {
  const errors: string[] = [];
  const note = (label: string, r: { error: string | null }) => { if (r.error) errors.push(`${label}: ${r.error}`); };

  await Promise.all(symbols.map(async (s) => { const r = await fetchPeerTickers(s); note(`peers ${s}`, r); }));
  const batch = await fetchFinnhubBatch(symbols, 0);
  errors.push(...batch.stats.error_messages, ...batch.stats.store_errors);
  for (const s of symbols) note(`annual ${s}`, await fetchAnnualFinancials(s));

  const loops: Array<[string, (s: string) => Promise<{ error: string | null }>]> = [
    ['news', fetchNewsSentiment], ['finbert', fetchFinnhubNewsSentiment], ['earnings-quality', fetchFinnhubEarningsQuality],
    ['ownership', fetchFinnhubInstitutionalOwnership], ['revenue-breakdown', fetchFinnhubRevenueBreakdown],
    ['quarterly', fetchQuarterlyFinancials], ['insider-tx', fetchInsiderTransactions],
    ['ebitda', fetchFinnhubEbitdaEstimates], ['ebit', fetchFinnhubEbitEstimates], ['dividend', fetchFinnhubDividendHistory],
    ['price-metric', fetchFinnhubPriceMetrics], ['fund-ownership', fetchFinnhubFundOwnership], ['calendar', fetchFinnhubEarningsCalendar],
  ];
  await Promise.all(loops.map(async ([label, fn]) => {
    for (const s of symbols) note(`${label} ${s}`, await fn(s));
  }));
  return { errors };
}

function print(label: string, symbols: string[], meter: FinnhubMeter, errors: string[]): void {
  console.log(`\n${label} — ${symbols.length} symbol(s)`);
  console.log(`  upstream Finnhub calls: ${meter.upstream}   store hits: ${meter.hits}   per symbol: ${(meter.upstream / symbols.length).toFixed(2)} calls, ${(meter.hits / symbols.length).toFixed(2)} hits`);
  const rows = FINNHUB_TTL.map((r) => ({ endpoint: r.endpoint, tier: r.tier, ...(meter.byEndpoint[r.endpoint] ?? { upstream: 0, hits: 0 }) }));
  for (const r of rows) console.log(`  ${r.endpoint.padEnd(30)} ${r.tier.padEnd(9)} calls ${String(r.upstream).padStart(4)}   hits ${String(r.hits).padStart(4)}`);
  const unknown = Object.keys(meter.byEndpoint).filter((e) => !FINNHUB_TTL.some((r) => r.endpoint === e));
  if (unknown.length) console.log(`  endpoints outside the census: ${unknown.join(', ')}`);
  if (errors.length) { console.log(`  declared errors (${errors.length}):`); for (const e of errors.slice(0, 40)) console.log(`    ${e}`); }
}

export async function measure(symbols: string[]): Promise<{ cold: FinnhubMeter; warm: FinnhubMeter }> {
  const run1 = await withFinnhubMeter(() => oneScanOfFinnhub(symbols));
  print('RUN 1 (cold — every slow-tier row a miss)', symbols, run1.meter, run1.result.errors);
  const run2 = await withFinnhubMeter(() => oneScanOfFinnhub(symbols));
  print('RUN 2 (warm — every slow-tier row within its TTL)', symbols, run2.meter, run2.result.errors);
  console.log(`\nThe census says: COLD ${finnhubCallsPerSymbol('cold')} / symbol · WARM ${finnhubCallsPerSymbol('warm')} / symbol.`);
  console.log(`Measured:        RUN 1 ${(run1.meter.upstream / symbols.length).toFixed(2)} / symbol · RUN 2 ${(run2.meter.upstream / symbols.length).toFixed(2)} / symbol.`);
  return { cold: run1.meter, warm: run2.meter };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const symbols = (process.argv[2] ?? '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
  if (symbols.length === 0) { console.error('usage: DATABASE_URL=… FINNHUB_API_KEY=… npx tsx scripts/measure-finnhub-scan-cost.ts AAPL,MSFT,…'); process.exit(2); }
  if (!process.env.FINNHUB_API_KEY) { console.error('FINNHUB_API_KEY is not set — nothing to measure against the vendor'); process.exit(2); }
  if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is not set — the store is finnhub_responses'); process.exit(2); }
  measure(symbols).then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
}
