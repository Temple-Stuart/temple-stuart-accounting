/**
 * OBSERVATORY-01 — WHAT EACH FEED COSTS, read from the code that calls it.
 *
 * The observatory's check (src/app/api/data-observatory/check/route.ts) fires
 * real upstream calls. Alex is judging a per-call spend from that screen, so
 * every row must say who it called, whether that call is metered, how many
 * calls THIS probe made, and whether the convergence scan uses the same feed.
 *
 * NO PRICES. This product does not know Finnhub's per-call rate, xAI's token
 * price, or any other vendor's schedule — the rate lives in the vendor's
 * invoice. Everything here is a COUNT, derived by reading the call sites, and
 * every count carries its file:line so it can be re-checked against the code.
 *
 * `billable` means: this call is metered by the vendor and lands on an invoice.
 * `basis` says on what evidence — never a guess dressed as a fact.
 *
 * THE LAW (feedCostLaw — module scope, re-run at build by
 * scripts/assert-tool-registry.ts): every one of the 33 feed ids carries a
 * cost row; a billable feed makes at least one upstream call; a feed that
 * makes no upstream call is not billable.
 */

export type FeedProvider = 'TastyTrade' | 'Finnhub' | 'FRED' | 'SEC' | 'xAI' | 'Internal';

export interface FeedCost {
  /** Who this probe calls. */
  provider: FeedProvider;
  /** Metered by the vendor — the call lands on an invoice. */
  billable: boolean;
  /** The evidence for `billable`. Never a guessed rate. */
  basis: string;
  /** Upstream calls THIS probe makes when it runs (not when it is skipped or market-closed). */
  upstreamCalls: number;
  /** Does the convergence scan use this same feed? */
  usedByScan: boolean;
  /** Where the scan calls it, or why it does not — file:line. */
  scanCitation: string;
  /** The symbol this probe actually asks about: the selected one, a fixed one, or none. */
  probes: 'selected' | 'AAPL' | 'SPY' | 'none';
}

const METERED_FINNHUB =
  'Finnhub is metered per call — the founder\'s COA carries B-B-5130 Finnhub (Per-Call). The rate is on Finnhub\'s invoice, not in this product.';
const METERED_XAI =
  'xAI bills per token on the completion this probe requests (model grok-3-mini, max_tokens 10 — route.ts:637-639). The rate is on xAI\'s invoice.';
const FREE_FRED = 'St. Louis Fed FRED — a free public API behind a free key (FRED_API_KEY). No invoice known to this product.';
const FREE_SEC = 'SEC EDGAR — a free public API, no key, User-Agent only (route.ts:572). No invoice known to this product.';
const TT_ACCOUNT =
  'No per-call invoice: this spends the SHARED FIRM TastyTrade session (getTastytradeClient — env credentials), which is why the route is admin-gated (route.ts:930-935).';
const NO_CALL = 'Makes no upstream call — nothing is metered.';

/** The 33 feeds the check probes, keyed by the id the route and the screen both use. */
export const FEED_COST: Readonly<Record<number, FeedCost>> = {
  // ── TastyTrade: each of these probes calls getCustomerResource() then
  //    getMarketMetrics() — two SDK calls, on a fixed symbol, market hours only.
  1:  { provider: 'TastyTrade', billable: false, basis: TT_ACCOUNT, upstreamCalls: 2, usedByScan: true,  scanCitation: 'pipeline.ts:399 getMarketMetrics — batched over all symbols, one call per batch', probes: 'AAPL' },
  23: { provider: 'TastyTrade', billable: false, basis: TT_ACCOUNT, upstreamCalls: 2, usedByScan: true,  scanCitation: 'pipeline.ts:399 — the same batched market-metrics call carries the greeks fields', probes: 'AAPL' },
  24: { provider: 'TastyTrade', billable: false, basis: TT_ACCOUNT, upstreamCalls: 2, usedByScan: true,  scanCitation: 'data-fetchers.ts:2271 fetchTTCandlesBatch — a quote-stream subscription per symbol (pipeline.ts:1221), not a REST call', probes: 'AAPL' },
  31: { provider: 'TastyTrade', billable: false, basis: TT_ACCOUNT, upstreamCalls: 2, usedByScan: true,  scanCitation: 'chain-fetcher.ts:166 getNestedOptionChain — one call per surviving symbol', probes: 'AAPL' },
  32: { provider: 'TastyTrade', billable: false, basis: TT_ACCOUNT, upstreamCalls: 2, usedByScan: true,  scanCitation: 'pipeline.ts:399 — corr-spy-3month and beta ride the same batched call', probes: 'SPY' },

  // ── Finnhub: one probe = one GET on finnhub.io, metered.
  2:  { provider: 'Finnhub', billable: true, basis: METERED_FINNHUB, upstreamCalls: 1, usedByScan: true,  scanCitation: 'data-fetchers.ts:214 /stock/metric', probes: 'selected' },
  3:  { provider: 'Finnhub', billable: true, basis: METERED_FINNHUB, upstreamCalls: 1, usedByScan: true,  scanCitation: 'data-fetchers.ts:110 /stock/eps-estimate', probes: 'selected' },
  4:  { provider: 'Finnhub', billable: true, basis: METERED_FINNHUB, upstreamCalls: 1, usedByScan: true,  scanCitation: 'data-fetchers.ts:111 /stock/revenue-estimate', probes: 'selected' },
  5:  { provider: 'Finnhub', billable: true, basis: METERED_FINNHUB, upstreamCalls: 1, usedByScan: true,  scanCitation: 'data-fetchers.ts:112 /stock/price-target', probes: 'selected' },
  6:  { provider: 'Finnhub', billable: true, basis: METERED_FINNHUB, upstreamCalls: 1, usedByScan: true,  scanCitation: 'data-fetchers.ts:113 /stock/upgrade-downgrade', probes: 'selected' },
  7:  { provider: 'Finnhub', billable: true, basis: METERED_FINNHUB, upstreamCalls: 1, usedByScan: true,  scanCitation: 'data-fetchers.ts:230 /stock/recommendation', probes: 'selected' },
  8:  { provider: 'Finnhub', billable: true, basis: METERED_FINNHUB, upstreamCalls: 1, usedByScan: true,  scanCitation: 'data-fetchers.ts:262 /stock/earnings', probes: 'selected' },
  9:  { provider: 'Finnhub', billable: true, basis: METERED_FINNHUB, upstreamCalls: 1, usedByScan: true,  scanCitation: 'data-fetchers.ts:2074 /stock/earnings-quality-score (the scan asks freq=quarterly; this probe asks freq=annual)', probes: 'selected' },
  10: { provider: 'Finnhub', billable: true, basis: METERED_FINNHUB, upstreamCalls: 1, usedByScan: true,  scanCitation: 'data-fetchers.ts:1920 /stock/revenue-breakdown2', probes: 'selected' },
  11: { provider: 'Finnhub', billable: true, basis: METERED_FINNHUB, upstreamCalls: 1, usedByScan: true,  scanCitation: 'data-fetchers.ts:1038 /stock/insider-transactions', probes: 'selected' },
  12: { provider: 'Finnhub', billable: true, basis: METERED_FINNHUB, upstreamCalls: 1, usedByScan: true,  scanCitation: 'data-fetchers.ts:247 /stock/insider-sentiment', probes: 'selected' },
  13: { provider: 'Finnhub', billable: true, basis: METERED_FINNHUB, upstreamCalls: 1, usedByScan: true,  scanCitation: 'data-fetchers.ts:1823 /stock/ownership', probes: 'selected' },
  14: { provider: 'Finnhub', billable: true, basis: METERED_FINNHUB, upstreamCalls: 1, usedByScan: true,  scanCitation: 'data-fetchers.ts:1210 /stock/peers (pipeline.ts:555)', probes: 'selected' },
  15: { provider: 'Finnhub', billable: true, basis: METERED_FINNHUB, upstreamCalls: 1, usedByScan: true,  scanCitation: 'data-fetchers.ts:389 /stock/financials-reported', probes: 'selected' },
  16: { provider: 'Finnhub', billable: true, basis: METERED_FINNHUB, upstreamCalls: 1, usedByScan: true,  scanCitation: 'data-fetchers.ts:445-447 /stock/financials — the scan asks bs, ic and cf (three calls); this probe asks ic only', probes: 'selected' },
  17: { provider: 'Finnhub', billable: true, basis: METERED_FINNHUB, upstreamCalls: 1, usedByScan: true,  scanCitation: 'data-fetchers.ts:2024 /news-sentiment', probes: 'selected' },
  18: { provider: 'Finnhub', billable: true, basis: METERED_FINNHUB, upstreamCalls: 1, usedByScan: true,  scanCitation: 'data-fetchers.ts:2143 · :2146 /company-news — the scan asks two windows (7d and 30d); this probe asks one', probes: 'selected' },
  28: { provider: 'Finnhub', billable: true, basis: METERED_FINNHUB, upstreamCalls: 1, usedByScan: true,  scanCitation: 'data-fetchers.ts:230 — the SAME endpoint feed 7 probes; this check pays for it twice', probes: 'selected' },
  30: { provider: 'Finnhub', billable: true, basis: METERED_FINNHUB, upstreamCalls: 1, usedByScan: true,  scanCitation: 'data-fetchers.ts:2074 — the SAME endpoint feed 9 probes; this check pays for it twice', probes: 'selected' },

  // ── FRED: free public API behind a free key.
  19: { provider: 'FRED', billable: false, basis: FREE_FRED, upstreamCalls: 2, usedByScan: true, scanCitation: 'data-fetchers.ts:638 · :663 · :683 fetchFredMacro (pipeline.ts:650) — 21 series, once per SCAN, 1-hour cached (:568)', probes: 'none' },
  25: { provider: 'FRED', billable: false, basis: FREE_FRED, upstreamCalls: 1, usedByScan: true, scanCitation: 'data-fetchers.ts:761 fetchFredDailySeries (pipeline.ts:651) — 3 series, once per SCAN, 1-hour cached (:725)', probes: 'none' },

  // ── SEC: free public API. Feeds 20/21/26/27 share ONE fetch pass in the route.
  20: { provider: 'SEC', billable: false, basis: FREE_SEC, upstreamCalls: 1, usedByScan: true,  scanCitation: 'data-fetchers.ts:1588 data.sec.gov/submissions (inside fetch10KBusinessDescription)', probes: 'selected' },
  21: { provider: 'SEC', billable: false, basis: FREE_SEC, upstreamCalls: 1, usedByScan: false, scanCitation: 'the scan never reads company_tickers.json — it resolves the CIK through Finnhub /stock/profile2 (data-fetchers.ts:894 lookupCIK), a METERED call this probe avoids', probes: 'selected' },
  26: { provider: 'SEC', billable: false, basis: FREE_SEC, upstreamCalls: 1, usedByScan: true,  scanCitation: 'data-fetchers.ts:931 data.sec.gov/api/xbrl/companyfacts', probes: 'selected' },
  27: { provider: 'SEC', billable: false, basis: FREE_SEC, upstreamCalls: 0, usedByScan: true,  scanCitation: 'data-fetchers.ts:1569 · :1621 · :1672 fetch10KBusinessDescription (pipeline.ts:961) — the SCAN reads the filing; this probe only reports whether the CIK resolved', probes: 'selected' },

  // ── xAI: metered per token.
  22: { provider: 'xAI', billable: true, basis: METERED_XAI, upstreamCalls: 1, usedByScan: true, scanCitation: 'sentiment.ts:152 /v1/responses · :218 /v1/chat/completions — the scan makes TWO calls per symbol (pipeline.ts:1564)', probes: 'selected' },

  // ── Internal: derived from feeds already fetched, no call of its own.
  29: { provider: 'Internal', billable: false, basis: NO_CALL, upstreamCalls: 0, usedByScan: true, scanCitation: 'news-classifier.ts — classifies the headlines feed 18 already fetched', probes: 'selected' },
  33: { provider: 'Internal', billable: false, basis: NO_CALL, upstreamCalls: 0, usedByScan: true, scanCitation: 'sector-stats.ts — computed from the peers (feed 14) and the 10-K text (feed 27)', probes: 'none' },
};

export const FEED_IDS: readonly number[] = Object.keys(FEED_COST).map(Number).sort((a, b) => a - b);

/**
 * What ONE SCAN of ONE SYMBOL costs upstream, counted by reading every call
 * site the pipeline reaches. Upper bounds: the pipeline gates its later stages,
 * so a symbol dropped early makes fewer, and three caches (Finnhub estimates
 * 1h, quarterly financials 6h, CIK for the process) can serve a repeat for free.
 */
export interface ScanCost {
  provider: FeedProvider;
  callsPerSymbol: number | null;
  callsPerScan: number | null;
  note: string;
}

export const SCAN_COST: readonly ScanCost[] = [
  {
    provider: 'Finnhub', callsPerSymbol: 28, callsPerScan: null,
    note: '8 in fetchFinnhubTicker (data-fetchers.ts:214 · :230 · :247 · :262 plus the four estimate calls :110-113), then financials-reported :389, company-news ×2 :2143 · :2146, news-sentiment :2024, earnings-quality-score :2074, ownership + fund-ownership :1823 · :1824, revenue-breakdown2 :1920, financials bs/ic/cf :445-447, profile2 :894, insider-transactions :1038, ebitda-estimate :2405, ebit-estimate :2436, dividend :2470, price-metric :2506, fund-ownership again :2546, calendar/earnings :2632 and peers :1210. Ceiling, not average: a symbol dropped at an early gate makes fewer.',
  },
  {
    provider: 'xAI', callsPerSymbol: 2, callsPerScan: null,
    note: 'sentiment.ts:152 (/v1/responses, x_search) then :218 (/v1/chat/completions, scoring) — both per symbol, and only when XAI_API_KEY is set (pipeline.ts:1564).',
  },
  {
    provider: 'TastyTrade', callsPerSymbol: 1, callsPerScan: null,
    note: 'One getNestedOptionChain per surviving symbol (chain-fetcher.ts:166). The market-metrics read is BATCHED over all symbols (pipeline.ts:399), and candles arrive on a quote-stream subscription (data-fetchers.ts:2271), so neither is one call per symbol.',
  },
  {
    provider: 'SEC', callsPerSymbol: 6, callsPerScan: null,
    note: 'companyfacts :931, then the 10-K walk — efts search :1569, submissions :1588, index.json :1621, the document :1672 — and the 8-K scan :2582.',
  },
  {
    provider: 'FRED', callsPerSymbol: 0, callsPerScan: 24,
    note: 'Macro is per SCAN, not per symbol: 19 series in the seriesMap loop (:638) plus PAYEMS (:663) and CPIAUCSL (:683), and 3 cross-asset series (:761). 1-hour cached (:568, :725).',
  },
];

/** The one-line answer the screen prints above the table. Counts only — the rate is the vendor's. */
export function scanCostLine(cost: readonly ScanCost[] = SCAN_COST): string {
  const perSymbol = cost
    .filter((c) => c.callsPerSymbol !== null && c.callsPerSymbol > 0)
    .map((c) => `${c.callsPerSymbol} ${c.provider}`);
  const perScan = cost
    .filter((c) => c.callsPerScan !== null && c.callsPerScan > 0)
    .map((c) => `${c.callsPerScan} ${c.provider}`);
  return `One scan of one symbol = ${perSymbol.join(', ')} — plus, once per scan, ${perScan.join(', ')}.`;
}

/** What THIS check spent, by provider, counted from the rows it actually ran. */
export interface ProviderSpend {
  provider: FeedProvider;
  calls: number;
  billable: boolean;
  feeds: number;
}

/**
 * A row counts its calls only when it RAN. A skipped feed and a market-closed
 * feed made no call, so neither is charged — the status is the evidence.
 */
export function callsMade(
  rows: readonly { id: number; status: string; upstreamCalls?: number }[],
  cost: Readonly<Record<number, FeedCost>> = FEED_COST,
): ProviderSpend[] {
  const by = new Map<FeedProvider, ProviderSpend>();
  for (const row of rows) {
    const c = cost[row.id];
    if (!c) continue;
    // A probe that stopped at one of its OWN guards reports its own 0 — a
    // TastyTrade feed with no credentials returns BROKEN having called nothing.
    const ran = row.status !== 'SKIPPED' && row.status !== 'MKT-HRS';
    const made = row.upstreamCalls ?? (ran ? c.upstreamCalls : 0);
    const entry = by.get(c.provider) ?? { provider: c.provider, calls: 0, billable: c.billable, feeds: 0 };
    entry.calls += made;
    entry.feeds += 1;
    by.set(c.provider, entry);
  }
  return [...by.values()].sort((a, b) => b.calls - a.calls || a.provider.localeCompare(b.provider));
}

/** The sentence the screen prints for what this check itself spent. */
export function callsMadeLine(spend: readonly ProviderSpend[]): string {
  const spent = spend.filter((s) => s.calls > 0);
  if (spent.length === 0) return 'This check made no upstream call.';
  const parts = spent.map((s) => `${s.calls} ${s.provider}${s.billable ? ' (metered)' : ''}`);
  return `This check made ${parts.join(', ')}. Counts only — the rate lives in the vendor's invoice.`;
}

export class FeedCostLawError extends Error {
  constructor(message: string) {
    super(`FEED COST LAW: ${message}`);
    this.name = 'FeedCostLawError';
  }
}

/** THE LAW. Throws on the first violation; returns the list when asked not to throw. */
export function feedCostLaw(opts: { throwOnFail?: boolean; cost?: Readonly<Record<number, FeedCost>>; ids?: readonly number[] } = {}): string[] {
  const cost = opts.cost ?? FEED_COST;
  const ids = opts.ids ?? FEED_IDS;
  const violations: string[] = [];

  if (ids.length !== 33) violations.push(`${ids.length} feeds carry a cost row, expected 33 — every feed the check probes says what it costs`);
  for (let i = 1; i <= 33; i += 1) {
    if (!(i in cost)) violations.push(`feed ${i} has no cost row — no row may render without one`);
  }
  for (const id of ids) {
    const c = cost[id];
    if (!c) continue;
    if (!c.basis.trim()) violations.push(`feed ${id}: billable=${c.billable} with no basis — say on what evidence`);
    if (c.billable && c.upstreamCalls === 0) violations.push(`feed ${id}: billable but makes no upstream call`);
    if (!c.billable && c.provider === 'Finnhub') violations.push(`feed ${id}: a Finnhub call is metered — billable must be true`);
    if (c.upstreamCalls === 0 && c.billable) violations.push(`feed ${id}: no call, so nothing can be metered`);
    if (c.upstreamCalls < 0) violations.push(`feed ${id}: negative call count`);
    if (!c.scanCitation.trim()) violations.push(`feed ${id}: usedByScan=${c.usedByScan} with no citation — say where the scan calls it, or why it does not`);
  }
  if (violations.length && opts.throwOnFail !== false) throw new FeedCostLawError(violations.join('\n  '));
  return violations;
}

feedCostLaw();
