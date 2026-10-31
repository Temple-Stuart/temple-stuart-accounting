/**
 * TRADE-COST-01 — THE TIERED TTL: how long one Finnhub answer may serve.
 *
 * ONE const, one row per endpoint the scan calls, with the calls it makes per
 * symbol per scan and a citation per tier. Read by the cache helper
 * (src/lib/convergence/finnhub-cache.ts), by the cost census
 * (src/lib/observatory/feedCost.ts — cold vs warm), by the build assert
 * (scripts/assert-tool-registry.ts — a slow-tier URL outside the helper throws)
 * and by the tests. NO IMPORTS: feedCost.ts and the build's assert step read
 * this file, and neither may drag Prisma or the TastyTrade SDK in.
 *
 * THE RULING (TRADE-COST-01): quarterly-moving → refetch after 7 days;
 * weekly-moving → 24 hours; monthly-moving → 24 hours; daily/intraday → NO
 * cache. An endpoint the evidence shows moving faster than its ruled tier takes
 * the faster tier. A row older than its TTL is a MISS — refetched, overwritten,
 * fetched_at updated. Nothing is ever presented as fresher than it is:
 * fetched_at rides with every value.
 *
 * WHAT THE VENDOR SAYS ABOUT CADENCE: nothing. Finnhub's API reference
 * (https://finnhub.io/docs/api — the Swagger spec embedded as window.docSchema,
 * read 2026-09-15) states NO refresh frequency for ANY of these endpoints; the
 * only cadence words are /stock/financials' "Set preliminary param to true for
 * faster updates", /company-news' "latest company news", and the
 * /stock/upgrade-downgrade entry's title "Real-time Stocks Upgrade/Downgrade".
 * So each tier below cites (1) the cadence of the SOURCE the vendor names
 * (the SEC form the data is derived from) and (2) the cadence the scoring code
 * assumes when it reads the value — never a vendor refresh promise it does not
 * make.
 *
 * WINDOWED PARAMS: five endpoints send a from/to computed from today. The
 * cache KEY normalizes that window to a relative spec (from=-540d) so the row
 * is reusable within its TTL; the ABSOLUTE dates actually sent are stored on
 * the row (sent_params). A row served on day N+1 therefore covers a window
 * that ended on day N — inside the TTL by construction, and dated by
 * fetched_at, never presented as today's.
 */

export type FinnhubTier = 'quarterly' | 'weekly' | 'monthly' | 'daily';

export interface FinnhubTtlRow {
  /** The path after https://finnhub.io/api/v1/ — no leading slash. */
  endpoint: string;
  tier: FinnhubTier;
  /** 0 = no cache (daily tier): every scan buys it. */
  ttlMs: number;
  /** Calls ONE scan of ONE symbol makes to this endpoint (stock/financials is bs + ic + cf). */
  callsPerSymbol: number;
  /** The scan's call site, and the reader that consumes the answer. */
  code: string;
  /** Why this tier — the source's cadence and the code's assumption, never a vendor refresh promise. */
  why: string;
}

const DAY = 24 * 60 * 60 * 1000;
export const TTL_7D = 7 * DAY;
export const TTL_24H = DAY;

const SEC_10Q = 'Form 10-Q is filed quarterly and 10-K annually (17 CFR 240.13a-13, 240.13a-1)';
const SEC_13F = 'Form 13F is filed quarterly, within 45 days of quarter end (17 CFR 240.13f-1)';
const SEC_FORM4 = 'Form 4 is filed within two business days of the trade (Exchange Act §16(a)(2))';

export const FINNHUB_TTL: readonly FinnhubTtlRow[] = [
  // ── quarterly-moving → 7 days ─────────────────────────────────────────────
  { endpoint: 'stock/financials', tier: 'quarterly', ttlMs: TTL_7D, callsPerSymbol: 3,
    code: 'data-fetchers.ts fetchQuarterlyFinancials (bs · ic · cf, freq=quarterly) → quality-gate.ts Piotroski/Altman read periods[0..7] positionally',
    why: `standardized statements from the filings — ${SEC_10Q}; the docs: "sourced from original filings"; the code picks the latest quarter by period sort, never by today` },
  { endpoint: 'stock/financials-reported', tier: 'quarterly', ttlMs: TTL_7D, callsPerSymbol: 1,
    code: 'data-fetchers.ts fetchAnnualFinancials (freq=annual) → quality-gate.ts ROIC / FCF fallbacks read the two newest years',
    why: `as-reported 10-K financials — ${SEC_10Q}; a 7-day row lags a new 10-K row by at most 7 days` },
  { endpoint: 'stock/earnings', tier: 'quarterly', ttlMs: TTL_7D, callsPerSymbol: 1,
    code: 'data-fetchers.ts fetchFinnhubTicker → info-edge.ts earnings[0].actual and surprise streak; quality-gate.ts beat rate',
    why: 'one row per quarterly report ("historical quarterly earnings surprise" — the docs); the code reads positionally, no today comparison' },
  { endpoint: 'stock/earnings-quality-score', tier: 'quarterly', ttlMs: TTL_7D, callsPerSymbol: 1,
    code: 'data-fetchers.ts fetchFinnhubEarningsQuality (freq=quarterly) → quality-gate.ts ML-vs-SUE agreement modifier',
    why: 'a per-quarter score; the fetcher picks the newest period by label — a response age inside a quarter changes nothing' },
  { endpoint: 'stock/revenue-breakdown2', tier: 'quarterly', ttlMs: TTL_7D, callsPerSymbol: 1,
    code: 'data-fetchers.ts fetchFinnhubRevenueBreakdown → quality-gate.ts HHI safety modifier',
    why: `segment disclosure from the annual/quarterly filings — ${SEC_10Q}; latest period picked by label` },
  { endpoint: 'stock/dividend', tier: 'quarterly', ttlMs: TTL_7D, callsPerSymbol: 1,
    code: 'data-fetchers.ts fetchFinnhubDividendHistory (from=-365d to=+0d) → the step_i progress payload only (dividend_count, next_ex_date); no gate scores it',
    why: 'declared dividends are quarterly events; the window is keyed relatively (from=-365d&to=+0d) and dated by fetched_at' },
  // ── weekly-moving → 24 hours ─────────────────────────────────────────────
  { endpoint: 'stock/eps-estimate', tier: 'weekly', ttlMs: TTL_24H, callsPerSymbol: 1,
    code: 'data-fetchers.ts fetchFinnhubEstimates (freq=quarterly) → info-edge.ts next-quarter consensus, dispersion, breadth',
    why: 'analyst consensus revised as estimates are published; the forward quarter is selected at score time against a fresh today, so a ≤24h-old array selects the same quarter' },
  { endpoint: 'stock/revenue-estimate', tier: 'weekly', ttlMs: TTL_24H, callsPerSymbol: 1,
    code: 'data-fetchers.ts fetchFinnhubEstimates (freq=quarterly) → info-edge.ts revenue direction next vs trailing',
    why: 'as eps-estimate: date selection happens at score time over the full array' },
  { endpoint: 'stock/ebit-estimate', tier: 'weekly', ttlMs: TTL_24H, callsPerSymbol: 1,
    code: 'data-fetchers.ts fetchFinnhubEbitEstimates (freq=quarterly) → the step_i progress payload only; no gate scores it',
    why: 'analyst consensus; nothing scored, positional read only' },
  { endpoint: 'stock/ebitda-estimate', tier: 'weekly', ttlMs: TTL_24H, callsPerSymbol: 1,
    code: 'data-fetchers.ts fetchFinnhubEbitdaEstimates (freq=quarterly) → the step_i progress payload only; no gate scores it',
    why: 'analyst consensus; nothing scored, positional read only' },
  { endpoint: 'stock/price-target', tier: 'weekly', ttlMs: TTL_24H, callsPerSymbol: 1,
    code: 'data-fetchers.ts fetchFinnhubEstimates → info-edge.ts targetMedian against the latest candle close',
    why: '"latest price target consensus" (the docs) with a lastUpdated field; the spot side is refreshed from candles every scan, so a ≤24h-old target only lags analyst revisions' },
  { endpoint: 'stock/recommendation', tier: 'weekly', ttlMs: TTL_24H, callsPerSymbol: 1,
    code: 'data-fetchers.ts fetchFinnhubTicker → info-edge.ts newest period row as the current stance; revision vs the prior month',
    why: 'the rows are month-stamped ("period" — the docs\' sample shows first-of-month dates); a 24h row can only miss the newest month on its publication day' },
  // ── monthly-moving → 24 hours ────────────────────────────────────────────
  { endpoint: 'stock/ownership', tier: 'monthly', ttlMs: TTL_24H, callsPerSymbol: 1,
    code: 'data-fetchers.ts fetchFinnhubInstitutionalOwnership → info-edge.ts ownership flow, filingDate aged against today',
    why: `${SEC_13F} (the docs: "sourced from 13F form, Schedule 13D and 13G"); staleness is computed from the filing date carried in the data, not from fetch time` },
  { endpoint: 'stock/fund-ownership', tier: 'monthly', ttlMs: TTL_24H, callsPerSymbol: 1,
    code: 'data-fetchers.ts fetchFinnhubInstitutionalOwnership buys it (Step E6); fetchFinnhubFundOwnership (Step I5) reads the SAME key — one call, coalesced in flight',
    why: `${SEC_13F}; nothing in the flow signal is clock-relative` },
  { endpoint: 'stock/insider-transactions', tier: 'monthly', ttlMs: TTL_24H, callsPerSymbol: 1,
    code: 'data-fetchers.ts fetchInsiderTransactions (from=-90d) → info-edge.ts opportunistic-vs-routine insider signal',
    why: `${SEC_FORM4}; a 24h row drifts the 90-day window by one day at the far edge and misses at most one day of new Form 4s` },
  { endpoint: 'stock/insider-sentiment', tier: 'monthly', ttlMs: TTL_24H, callsPerSymbol: 1,
    code: 'data-fetchers.ts fetchFinnhubTicker (from=-540d) → info-edge.ts MSPR latest month, 3-month average, trend',
    why: 'month-stamped MSPR rows (the docs: computed monthly from Form 3/4/5); the only drift a 24h row can carry is a new month row on its publication day' },
  // ── daily / intraday → NO cache ──────────────────────────────────────────
  { endpoint: 'stock/metric', tier: 'daily', ttlMs: 0, callsPerSymbol: 1,
    code: 'data-fetchers.ts fetchFinnhubTicker (metric=all) → quality-gate.ts, vol-edge.ts',
    why: 'marketCapitalization, 52WeekHigh/Low, P/S, EV/EBITDA and P/E move with every session and are paired with same-day spot (vol-edge.ts, quality-gate.ts)' },
  { endpoint: 'stock/price-metric', tier: 'daily', ttlMs: 0, callsPerSymbol: 1,
    code: 'data-fetchers.ts fetchFinnhubPriceMetrics (date=today) → priceMetricsMap; READ BY NOTHING (pipeline.ts sets it, no consumer)',
    why: 'the request is pinned to today\'s date; a paid answer no gate or panel reads — reported, not changed here' },
  { endpoint: 'stock/peers', tier: 'daily', ttlMs: 0, callsPerSymbol: 1,
    code: 'data-fetchers.ts fetchPeerTickers (grouping=industry) → sector-stats.ts peer-group membership',
    why: 'ruled daily; the 24h in-process Map it had is retired with the others — an in-process cache serves no fetched_at' },
  { endpoint: 'company-news', tier: 'daily', ttlMs: 0, callsPerSymbol: 2,
    code: 'data-fetchers.ts fetchNewsSentiment (7d window + 8–30d baseline) → info-edge.ts buzz, momentum, tier-1 ratio',
    why: 'the from/to windows ARE the signal (articles in the last 7 days vs the prior weeks); a cached window is the wrong period' },
  { endpoint: 'news-sentiment', tier: 'daily', ttlMs: 0, callsPerSymbol: 1,
    code: 'data-fetchers.ts fetchFinnhubNewsSentiment → info-edge.ts FinBERT leg, agreement with the 7-day keyword leg',
    why: 'a current sentiment snapshot paired with a 7-day news window' },
  { endpoint: 'stock/upgrade-downgrade', tier: 'daily', ttlMs: 0, callsPerSymbol: 1,
    code: 'data-fetchers.ts fetchFinnhubEstimates → info-edge.ts 90-day window with daily decay from gradeTime',
    why: 'RULED weekly (24h); TAKES THE FASTER TIER: the vendor\'s own entry is titled "Real-time Stocks Upgrade/Downgrade" (docs, window.docSchema paths[/stock/upgrade-downgrade].title) — an analyst action lands intraday and the decayed signal reads gradeTime against now' },
  { endpoint: 'calendar/earnings', tier: 'daily', ttlMs: 0, callsPerSymbol: 1,
    code: 'data-fetchers.ts fetchFinnhubEarningsCalendar (from=today to=+90d) → the step_i progress payload only; no gate scores it',
    why: 'the ruling assigns it no slow tier; the window looks forward from today and earnings dates are confirmed and moved day to day — no cache until ruled otherwise' },
];

/** The slow-tier endpoints — the ones the cache helper serves and the build law guards. */
export function slowTierEndpoints(): string[] {
  return FINNHUB_TTL.filter((r) => r.ttlMs > 0).map((r) => r.endpoint);
}

export function ttlRowOf(endpoint: string): FinnhubTtlRow {
  const row = FINNHUB_TTL.find((r) => r.endpoint === endpoint);
  if (!row) throw new Error(`finnhub-ttl: ${endpoint} has no tier — every Finnhub endpoint the scan calls is a row of FINNHUB_TTL`);
  return row;
}

export function isSlowTier(endpoint: string): boolean {
  return ttlRowOf(endpoint).ttlMs > 0;
}

/**
 * One scan of one symbol, by reading the census: COLD = every row a miss
 * (every call made); WARM = every slow-tier row a hit within its TTL (only the
 * daily tier is bought).
 */
export function finnhubCallsPerSymbol(state: 'cold' | 'warm'): number {
  return FINNHUB_TTL.reduce((n, r) => n + (state === 'cold' || r.ttlMs === 0 ? r.callsPerSymbol : 0), 0);
}

/** The law over the const itself — module scope, again at build. */
export function finnhubTtlLaw(opts: { throwOnFail?: boolean } = {}): string[] {
  const v: string[] = [];
  const seen = new Set<string>();
  for (const r of FINNHUB_TTL) {
    if (seen.has(r.endpoint)) v.push(`${r.endpoint} appears twice`);
    seen.add(r.endpoint);
    if (r.endpoint.startsWith('/') || r.endpoint.includes('finnhub.io')) v.push(`${r.endpoint}: an endpoint is the path after /api/v1/, no slash, no host`);
    const expected = r.tier === 'quarterly' ? TTL_7D : r.tier === 'daily' ? 0 : TTL_24H;
    if (r.ttlMs !== expected) v.push(`${r.endpoint}: tier ${r.tier} means ${expected}ms, not ${r.ttlMs}`);
    if (!Number.isInteger(r.callsPerSymbol) || r.callsPerSymbol < 1) v.push(`${r.endpoint}: callsPerSymbol must be a positive integer`);
    if (!r.why.trim() || !r.code.trim()) v.push(`${r.endpoint}: every tier carries its code site and its reason`);
    if (/\$[0-9]/.test(r.why + r.code)) v.push(`${r.endpoint}: counts and cadences, never prices`);
  }
  if (v.length && opts.throwOnFail !== false) throw new Error(`FINNHUB TTL LAW failed:\n  ${v.join('\n  ')}`);
  return v;
}

finnhubTtlLaw();
