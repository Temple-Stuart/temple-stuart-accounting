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

import { FINNHUB_TTL, finnhubCallsPerSymbol, slowTierEndpoints } from '../convergence/finnhub-ttl';

export type FeedProvider = 'TastyTrade' | 'Finnhub' | 'FRED' | 'SEC' | 'Internal';

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
const FREE_FRED = 'St. Louis Fed FRED — a free public API behind a free key (FRED_API_KEY). No invoice known to this product.';
const FREE_SEC = 'SEC EDGAR — a free public API, no key, User-Agent only (route.ts:572). No invoice known to this product.';
const TT_ACCOUNT =
  'No per-call invoice: this spends the SHARED FIRM TastyTrade session (getTastytradeClient — env credentials), which is why the route is admin-gated (route.ts:930-935).';
const NO_CALL = 'Makes no upstream call — nothing is metered.';
const SHARED_WITH_7 =
  'PIPE-01: reads the /stock/recommendation payload feed 7 already paid for — one call, two readings. Metered when it is bought, but this row does not buy it.';
const SHARED_WITH_9 =
  'PIPE-01: reads the /stock/earnings-quality-score payload feed 9 already paid for — one call, two readings. Metered when it is bought, but this row does not buy it.';

/** The 33 feeds the check probes, keyed by the id the route and the screen both use. */
export const FEED_COST: Readonly<Record<number, FeedCost>> = {
  // ── TastyTrade: each of these probes calls getCustomerResource() then
  //    getMarketMetrics() — two SDK calls, on a fixed symbol, market hours only.
  1:  { provider: 'TastyTrade', billable: false, basis: TT_ACCOUNT, upstreamCalls: 2, usedByScan: true,  scanCitation: 'pipeline.ts:399 getMarketMetrics — batched over all symbols, one call per batch', probes: 'AAPL' },
  23: { provider: 'TastyTrade', billable: false, basis: TT_ACCOUNT, upstreamCalls: 2, usedByScan: true,  scanCitation: 'pipeline.ts:399 — the same batched market-metrics call carries the greeks fields', probes: 'AAPL' },
  24: { provider: 'TastyTrade', billable: false, basis: TT_ACCOUNT, upstreamCalls: 2, usedByScan: true,  scanCitation: 'data-fetchers.ts:2271 fetchTTCandlesBatch — a quote-stream subscription per symbol (pipeline.ts:1221), not a REST call', probes: 'AAPL' },
  31: { provider: 'TastyTrade', billable: false, basis: TT_ACCOUNT, upstreamCalls: 2, usedByScan: true,  scanCitation: 'chain-fetcher.ts:166 getNestedOptionChain — one call per surviving symbol', probes: 'AAPL' },
  32: { provider: 'TastyTrade', billable: false, basis: TT_ACCOUNT, upstreamCalls: 2, usedByScan: true,  scanCitation: 'pipeline.ts:399 — corr-spy-3month and beta ride the same batched call', probes: 'SPY' },

  // ── Finnhub: one probe = one GET on finnhub.io, metered. TRADE-COST-01: a
  //    slow-tier probe reads through the tiered store; a hit costs nothing (the
  //    row declares upstreamCalls 0 at run time) — the static count is the miss.
  2:  { provider: 'Finnhub', billable: true, basis: METERED_FINNHUB, upstreamCalls: 1, usedByScan: true,  scanCitation: 'data-fetchers.ts fetchFinnhubTicker /stock/metric — daily tier, bought every scan (finnhub-cache.ts finnhubDirect)', probes: 'selected' },
  3:  { provider: 'Finnhub', billable: true, basis: METERED_FINNHUB, upstreamCalls: 1, usedByScan: true,  scanCitation: 'data-fetchers.ts fetchFinnhubEstimates /stock/eps-estimate — weekly tier, 24h in finnhub_responses (finnhubCached)', probes: 'selected' },
  4:  { provider: 'Finnhub', billable: true, basis: METERED_FINNHUB, upstreamCalls: 1, usedByScan: true,  scanCitation: 'data-fetchers.ts fetchFinnhubEstimates /stock/revenue-estimate — weekly tier, 24h in finnhub_responses (finnhubCached)', probes: 'selected' },
  5:  { provider: 'Finnhub', billable: true, basis: METERED_FINNHUB, upstreamCalls: 1, usedByScan: true,  scanCitation: 'data-fetchers.ts fetchFinnhubEstimates /stock/price-target — weekly tier, 24h in finnhub_responses (finnhubCached)', probes: 'selected' },
  6:  { provider: 'Finnhub', billable: true, basis: METERED_FINNHUB, upstreamCalls: 1, usedByScan: true,  scanCitation: 'data-fetchers.ts fetchFinnhubEstimates /stock/upgrade-downgrade — daily tier (the vendor calls it real-time), bought every scan', probes: 'selected' },
  7:  { provider: 'Finnhub', billable: true, basis: METERED_FINNHUB, upstreamCalls: 1, usedByScan: true,  scanCitation: 'data-fetchers.ts fetchFinnhubTicker /stock/recommendation — weekly tier, 24h in finnhub_responses (finnhubCached)', probes: 'selected' },
  8:  { provider: 'Finnhub', billable: true, basis: METERED_FINNHUB, upstreamCalls: 1, usedByScan: true,  scanCitation: 'data-fetchers.ts fetchFinnhubTicker /stock/earnings — quarterly tier, 7d in finnhub_responses (finnhubCached); this probe asks limit=40, the scan asks none — its own row', probes: 'selected' },
  9:  { provider: 'Finnhub', billable: true, basis: METERED_FINNHUB, upstreamCalls: 1, usedByScan: true,  scanCitation: 'data-fetchers.ts fetchFinnhubEarningsQuality /stock/earnings-quality-score — quarterly tier, 7d (the scan asks freq=quarterly; this probe asks freq=annual — its own row)', probes: 'selected' },
  10: { provider: 'Finnhub', billable: true, basis: METERED_FINNHUB, upstreamCalls: 1, usedByScan: true,  scanCitation: 'data-fetchers.ts fetchFinnhubRevenueBreakdown /stock/revenue-breakdown2 — quarterly tier, 7d in finnhub_responses (finnhubCached)', probes: 'selected' },
  11: { provider: 'Finnhub', billable: true, basis: METERED_FINNHUB, upstreamCalls: 1, usedByScan: true,  scanCitation: 'data-fetchers.ts fetchInsiderTransactions /stock/insider-transactions — monthly tier, 24h (the scan asks from=-90d; this probe asks no from — its own row)', probes: 'selected' },
  12: { provider: 'Finnhub', billable: true, basis: METERED_FINNHUB, upstreamCalls: 1, usedByScan: true,  scanCitation: 'data-fetchers.ts fetchFinnhubTicker /stock/insider-sentiment — monthly tier, 24h (the scan asks a rolling from=-540d; this probe asks a fixed 2024-01-01..2025-12-31 — its own row)', probes: 'selected' },
  13: { provider: 'Finnhub', billable: true, basis: METERED_FINNHUB, upstreamCalls: 1, usedByScan: true,  scanCitation: 'data-fetchers.ts fetchFinnhubInstitutionalOwnership /stock/ownership — monthly tier, 24h (the scan asks no limit; this probe asks limit=5 — its own row)', probes: 'selected' },
  14: { provider: 'Finnhub', billable: true, basis: METERED_FINNHUB, upstreamCalls: 1, usedByScan: true,  scanCitation: 'data-fetchers.ts fetchPeerTickers /stock/peers (pipeline.ts Step B) — daily tier, bought every scan; the scan asks grouping=industry, this probe none', probes: 'selected' },
  15: { provider: 'Finnhub', billable: true, basis: METERED_FINNHUB, upstreamCalls: 1, usedByScan: true,  scanCitation: 'data-fetchers.ts fetchAnnualFinancials /stock/financials-reported — quarterly tier, 7d in finnhub_responses (finnhubCached)', probes: 'selected' },
  16: { provider: 'Finnhub', billable: true, basis: METERED_FINNHUB, upstreamCalls: 1, usedByScan: true,  scanCitation: 'data-fetchers.ts fetchQuarterlyFinancials /stock/financials — quarterly tier, 7d; the scan asks bs, ic and cf (three rows); this probe asks ic only — the ic row the scan reads', probes: 'selected' },
  17: { provider: 'Finnhub', billable: true, basis: METERED_FINNHUB, upstreamCalls: 1, usedByScan: true,  scanCitation: 'data-fetchers.ts fetchFinnhubNewsSentiment /news-sentiment — daily tier, bought every scan', probes: 'selected' },
  18: { provider: 'Finnhub', billable: true, basis: METERED_FINNHUB, upstreamCalls: 1, usedByScan: true,  scanCitation: 'data-fetchers.ts fetchNewsSentiment /company-news — daily tier; the scan asks two windows (7d and 8–30d), this probe one', probes: 'selected' },
  28: { provider: 'Finnhub', billable: true, basis: SHARED_WITH_7, upstreamCalls: 0, usedByScan: true,  scanCitation: 'data-fetchers.ts fetchFinnhubTicker — the scan fetches /stock/recommendation ONCE; since PIPE-01 so does this check', probes: 'selected' },
  30: { provider: 'Finnhub', billable: true, basis: SHARED_WITH_9, upstreamCalls: 0, usedByScan: true,  scanCitation: 'data-fetchers.ts fetchFinnhubEarningsQuality — the scan fetches /stock/earnings-quality-score ONCE; since PIPE-01 so does this check', probes: 'selected' },

  // ── FRED: free public API behind a free key.
  19: { provider: 'FRED', billable: false, basis: FREE_FRED, upstreamCalls: 2, usedByScan: true, scanCitation: 'data-fetchers.ts:638 · :663 · :683 fetchFredMacro (pipeline.ts:650) — 21 series, once per SCAN, 1-hour cached (:568)', probes: 'none' },
  25: { provider: 'FRED', billable: false, basis: FREE_FRED, upstreamCalls: 1, usedByScan: true, scanCitation: 'data-fetchers.ts:761 fetchFredDailySeries (pipeline.ts:651) — 3 series, once per SCAN, 1-hour cached (:725)', probes: 'none' },

  // ── SEC: free public API. Feeds 20/21/26/27 share ONE fetch pass in the route.
  20: { provider: 'SEC', billable: false, basis: FREE_SEC, upstreamCalls: 1, usedByScan: true,  scanCitation: 'data-fetchers.ts:1588 data.sec.gov/submissions (inside fetch10KBusinessDescription)', probes: 'selected' },
  21: { provider: 'SEC', billable: false, basis: FREE_SEC, upstreamCalls: 1, usedByScan: false, scanCitation: 'data-fetchers.ts:927 lookupCIK — since PIPE-01 the scan resolves every CIK from this same free file, once per process, instead of buying it from Finnhub /stock/profile2', probes: 'selected' },
  26: { provider: 'SEC', billable: false, basis: FREE_SEC, upstreamCalls: 1, usedByScan: true,  scanCitation: 'data-fetchers.ts:931 data.sec.gov/api/xbrl/companyfacts', probes: 'selected' },
  27: { provider: 'SEC', billable: false, basis: FREE_SEC, upstreamCalls: 0, usedByScan: true,  scanCitation: 'data-fetchers.ts:1569 · :1621 · :1672 fetch10KBusinessDescription (pipeline.ts:961) — the SCAN reads the filing; this probe only reports whether the CIK resolved', probes: 'selected' },


  // ── Internal: derived from feeds already fetched, no call of its own.
  29: { provider: 'Internal', billable: false, basis: NO_CALL, upstreamCalls: 0, usedByScan: true, scanCitation: 'news-classifier.ts — classifies the headlines feed 18 already fetched', probes: 'selected' },
  33: { provider: 'Internal', billable: false, basis: NO_CALL, upstreamCalls: 0, usedByScan: true, scanCitation: 'sector-stats.ts — computed from the peers (feed 14) and the 10-K text (feed 27)', probes: 'none' },
};

export const FEED_IDS: readonly number[] = Object.keys(FEED_COST).map(Number).sort((a, b) => a - b);

/**
 * PIPE-01: 32, not 33 — feed 22 (xAI/Grok Sentiment) is GONE with the provider.
 * The ids are NOT renumbered: 22 is simply absent, so every historical
 * ObservatoryHealthLog row keeps meaning what it meant.
 */
export const EXPECTED_FEED_COUNT = 32;

/**
 * What ONE SCAN of ONE SYMBOL costs upstream, counted by reading every call
 * site the pipeline reaches. Upper bounds: the pipeline gates its later stages,
 * so a symbol dropped early makes fewer.
 *
 * TRADE-COST-01 — two numbers per provider, both MEASURED by the run's meter
 * (pipeline_summary.finnhub_calls_made / finnhub_cache_hits) and pinned here:
 *   COLD = every row a miss — every call made (callsPerSymbol / callsPerScan);
 *   WARM = every slow-tier row a hit within its TTL — only the daily tier is
 *          bought (warmCallsPerSymbol / warmCallsPerScan).
 * Finnhub's numbers DERIVE from the tier census (src/lib/convergence/
 * finnhub-ttl.ts) — never typed twice. The other providers have no tiered
 * store, so their warm number is their cold number, and they say so.
 */
export interface ScanCost {
  provider: FeedProvider;
  callsPerSymbol: number | null;
  callsPerScan: number | null;
  /** All slow-tier rows within their TTL. */
  warmCallsPerSymbol: number | null;
  warmCallsPerScan: number | null;
  note: string;
}

const finnhubSites = (state: 'cold' | 'warm'): string =>
  FINNHUB_TTL.filter((r) => state === 'cold' || r.ttlMs === 0)
    .map((r) => `${r.endpoint}${r.callsPerSymbol > 1 ? ` ×${r.callsPerSymbol}` : ''}`)
    .join(', ');

export const SCAN_COST: readonly ScanCost[] = [
  {
    provider: 'Finnhub',
    callsPerSymbol: finnhubCallsPerSymbol('cold'), callsPerScan: null,
    warmCallsPerSymbol: finnhubCallsPerSymbol('warm'), warmCallsPerScan: null,
    note: `Every Finnhub URL is built in src/lib/convergence/finnhub-cache.ts; the call sites are the fetchers in data-fetchers.ts, one row each in src/lib/convergence/finnhub-ttl.ts. COLD (${finnhubCallsPerSymbol('cold')}): ${finnhubSites('cold')}. WARM (${finnhubCallsPerSymbol('warm')}) buys only the daily tier: ${finnhubSites('warm')}; the ${slowTierEndpoints().length} slow-tier endpoints are served from finnhub_responses inside their TTL (7 days quarterly, 24 hours weekly and monthly). PIPE-01 removed two: /stock/profile2 (the CIK now comes free from SEC) and the second /stock/fund-ownership — which TRADE-COST-01 made true: Step E6 and Step I5 read ONE store key, coalesced in flight. Ceiling, not average: a symbol dropped at an early gate makes fewer.`,
  },
  {
    provider: 'TastyTrade', callsPerSymbol: 1, callsPerScan: null, warmCallsPerSymbol: 1, warmCallsPerScan: null,
    note: 'One getNestedOptionChain per surviving symbol (chain-fetcher.ts fetchChainAndBuildCards). The market-metrics read is BATCHED over all symbols (pipeline.ts Step A), and candles arrive on a quote-stream subscription (data-fetchers.ts fetchTTCandlesBatch), so neither is one call per symbol. No tiered store: warm = cold.',
  },
  {
    provider: 'SEC', callsPerSymbol: 6, callsPerScan: 1, warmCallsPerSymbol: 6, warmCallsPerScan: 1,
    note: 'companyfacts, then the 10-K walk — efts search, submissions, index.json, the document — and the 8-K scan. PIPE-01 adds ONE per scan, not per symbol: company_tickers.json (data-fetchers.ts fetchCIKMap), the free CIK map that replaced a metered Finnhub call, fetched once per process and cached 30 days. No tiered store: warm = cold.',
  },
  {
    provider: 'FRED', callsPerSymbol: 0, callsPerScan: 24, warmCallsPerSymbol: 0, warmCallsPerScan: 24,
    note: 'Macro is per SCAN, not per symbol: 19 series in the seriesMap loop plus PAYEMS and CPIAUCSL (fetchFredMacro), and 3 cross-asset series (fetchFredDailySeries). 1-hour in-process cached. No tiered store: warm = cold.',
  },
];

/** The one-line answer the screen prints above the table. Counts only — the rate is the vendor's. COLD first, then WARM. */
export function scanCostLine(cost: readonly ScanCost[] = SCAN_COST): string {
  const perSymbol = cost
    .filter((c) => c.callsPerSymbol !== null && c.callsPerSymbol > 0)
    .map((c) => `${c.callsPerSymbol} ${c.provider}`);
  const perScan = cost
    .filter((c) => c.callsPerScan !== null && c.callsPerScan > 0)
    .map((c) => `${c.callsPerScan} ${c.provider}`);
  const warmSymbol = cost
    .filter((c) => c.warmCallsPerSymbol !== null && c.warmCallsPerSymbol > 0)
    .map((c) => `${c.warmCallsPerSymbol} ${c.provider}`);
  const warmScan = cost
    .filter((c) => c.warmCallsPerScan !== null && c.warmCallsPerScan > 0)
    .map((c) => `${c.warmCallsPerScan} ${c.provider}`);
  return `One scan of one symbol = ${perSymbol.join(', ')} — plus, once per scan, ${perScan.join(', ')}. Warm (every slow-tier row within its TTL) = ${warmSymbol.join(', ')} — plus, once per scan, ${warmScan.join(', ')}.`;
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

  if (ids.length !== EXPECTED_FEED_COUNT) violations.push(`${ids.length} feeds carry a cost row, expected ${EXPECTED_FEED_COUNT} — every feed the check probes says what it costs`);
  for (const id of FEED_IDS) {
    if (!(id in cost)) violations.push(`feed ${id} has no cost row — no row may render without one`);
  }
  for (const id of ids) {
    const c = cost[id];
    if (!c) continue;
    if (!c.basis.trim()) violations.push(`feed ${id}: billable=${c.billable} with no basis — say on what evidence`);
    if (!c.billable && c.provider === 'Finnhub') violations.push(`feed ${id}: a Finnhub call is metered — billable must be true`);
    // PIPE-01: a metered row may make ZERO calls when it reads a payload another
    // feed bought — but it must say which, or the zero is unexplained.
    if (c.billable && c.upstreamCalls === 0 && !/PIPE-01: reads the/.test(c.basis)) {
      violations.push(`feed ${id}: metered with no call of its own and no basis saying whose payload it reads`);
    }
    if (c.upstreamCalls < 0) violations.push(`feed ${id}: negative call count`);
    if (!c.scanCitation.trim()) violations.push(`feed ${id}: usedByScan=${c.usedByScan} with no citation — say where the scan calls it, or why it does not`);
  }
  // TRADE-COST-01: a warm scan never costs more than a cold one, and Finnhub's
  // two numbers are the tier census's, never typed here.
  for (const c of SCAN_COST) {
    if ((c.warmCallsPerSymbol ?? 0) > (c.callsPerSymbol ?? 0)) violations.push(`${c.provider}: warm per-symbol (${c.warmCallsPerSymbol}) exceeds cold (${c.callsPerSymbol})`);
    if ((c.warmCallsPerScan ?? 0) > (c.callsPerScan ?? 0)) violations.push(`${c.provider}: warm per-scan (${c.warmCallsPerScan}) exceeds cold (${c.callsPerScan})`);
    if (c.provider === 'Finnhub' && (c.callsPerSymbol !== finnhubCallsPerSymbol('cold') || c.warmCallsPerSymbol !== finnhubCallsPerSymbol('warm'))) {
      violations.push('Finnhub: SCAN_COST must read the tier census (finnhub-ttl.ts), never a typed number');
    }
  }
  if (violations.length && opts.throwOnFail !== false) throw new FeedCostLawError(violations.join('\n  '));
  return violations;
}

feedCostLaw();
