import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { scoreAll } from '../convergence/composite';
import { scoreRegime, buildCboeRegimeInputs } from '../convergence/regime';
import { CBOE_INDICES, CBOE_TTL_MS, cboeDailyUrl, fetchCboeDaily, parseCboeDaily, resetCboeCache, type CboeIndex } from '../convergence/cboe-daily';
import { SNAPSHOT_SUGGESTED_STRATEGY_MAX, buildSnapshotRow, describeStoreError, logScanSnapshotBatch, snapshotNotAttempted, summariseSnapshotWrite, type SnapshotRow, type SnapshotStore } from '../convergence/snapshot-logger';
import { AVAILABLE_STRATEGIES } from '../convergence/filter-types';
import { GATE_TITLES, NOT_BUILT_STRATEGIES, gateCardsMarkdown } from '../convergence/gateCards';
import { ETF_UNIVERSE, ETF_UNIVERSE_SET_ON, ETF_UNIVERSE_SYMBOLS, isEtfUniverseSymbol } from '../convergence/etf-universe';
import { DEEP_FETCH_MULTIPLIER, FUNNEL_SET_ON, SCAN_LIMIT_DEFAULT, STRUCTURE_CUT } from '../convergence/funnel';
import { ETF_STRUCTURE_CUT_SET_ON, STRUCTURE_CUT_CONVERGENCE_MIN, STRUCTURE_CUT_QUALITY_FLOOR, convergenceRequiredOf, structureCutEligibility, type StructureCutRow } from '../convergence/structure-cut';
import type { CboeDailyData, CboeDailyPoint, ConvergenceInput, FredMacroData } from '../convergence/types';

// MODEL-02 STEP 6 — tests on fixtures. Pure modules: no database, no vendor.

// ── fixtures ──────────────────────────────────────────────────────────────

const FRED: FredMacroData = {
  vix: 18, treasury10y: 4.1, fedFunds: 4.3, unemployment: 4.2, cpi: 2.9, gdp: 2.4, consumerConfidence: 70, nonfarmPayrolls: 150, cpiMom: 0.2,
  yieldCurveSpread: 0.3, breakeven5y: 2.3, hySpread: 3.4, nfci: -0.4, initialClaims: 230, initialClaimsDate: '2026-09-10', nfciDate: '2026-09-11',
  vxvShortTerm: 20, fedBalanceSheet: null, treasuryGeneralAccount: null, overnightReverseRepo: null, bbbSpread: null, t10y3m: null, dollarIndex: null,
};
const FETCHED = '2026-09-16T12:00:00.000Z';
function point(index: CboeIndex, value: number): CboeDailyPoint {
  return { index, value, date: '2026-09-14', fetched_at: FETCHED, source: 'Cboe daily index history (cdn.cboe.com, free, no key)', url: `https://cdn.cboe.com/api/global/us_indices/daily_prices/${index}_History.csv` };
}
function cboeFx(o: { vvix?: number | null; errors?: string[] } = {}): CboeDailyData {
  return {
    vvix: o.vvix === null ? null : point('VVIX', o.vvix ?? 94.89),
    vix9d: point('VIX9D', 15.2), vix: point('VIX', 16.1), vix3m: point('VIX3M', 18.4), vix6m: point('VIX6M', 19.7), skew: point('SKEW', 152.09),
    errors: o.errors ?? [], fetched_at: FETCHED,
  };
}
function etfInput(symbol: string, spread: number, o: { cboe?: CboeDailyData | null; fred?: FredMacroData; ivRank?: number; ivPercentile?: number } = {}): ConvergenceInput {
  return {
    symbol,
    ttScanner: { symbol, ivRank: o.ivRank ?? 0.3, ivPercentile: o.ivPercentile ?? 0.35, impliedVolatility: 0.18, liquidityRating: null, earningsDate: null, daysTillEarnings: null, hv30: 18 - spread, hv60: 17, hv90: 16, iv30: 18, ivHvSpread: spread, beta: null, corrSpy: 1, marketCap: null, sector: null, industry: null, peRatio: null, eps: null, dividendYield: 1.3, lendability: null, borrowRate: null, earningsActualEps: null, earningsEstimate: null, earningsTimeOfDay: null, termStructure: [{ date: '2026-10-16', iv: 0.18 }, { date: '2026-11-20', iv: 0.19 }] },
    candles: [],
    finnhubFundamentals: null, finnhubRecommendations: [], finnhubInsiderSentiment: [], finnhubEarnings: [], finnhubEstimates: null,
    fredMacro: o.fred ?? FRED, annualFinancials: null, quarterlyFinancials: null, optionsFlow: null, newsSentiment: null, finnhubNewsSentiment: null,
    finnhubEarningsQuality: null, finnhubInstitutionalOwnership: null, finnhubRevenueBreakdown: null, secFilingData: null, secForm4Data: null,
    finnhubFundOwnership: null, edgar8kScan: null, crossAssetCorrelations: null,
    cboeDaily: o.cboe === undefined ? cboeFx() : o.cboe,
  };
}
const quiet = <T,>(fn: () => T): T => { const log = console.log; console.log = () => {}; try { return fn(); } finally { console.log = log; } };

// ── STEP 2: the Cboe read ─────────────────────────────────────────────────

test('parseCboeDaily reads the last row of both file shapes (DATE,<INDEX> and DATE,OPEN,HIGH,LOW,CLOSE)', () => {
  assert.deepEqual(parseCboeDaily('DATE,VVIX\n09/11/2026,93.10\n09/14/2026,94.89\n'), { date: '2026-09-14', value: 94.89 });
  assert.deepEqual(parseCboeDaily('DATE,OPEN,HIGH,LOW,CLOSE\n09/11/2026,15.1,16.9,14.8,16.20\n09/14/2026,16.0,17.1,15.5,16.10\n'), { date: '2026-09-14', value: 16.1 });
  assert.deepEqual(parseCboeDaily('DATE,SKEW\n09/14/2026,152.09'), { date: '2026-09-14', value: 152.09 });
  assert.equal(parseCboeDaily('DATE,VVIX\n'), null);
  assert.equal(parseCboeDaily(''), null);
});

test('fetchCboeDaily: one fetch per file per day (24h TTL), a failed file is an ERROR on the result — declared, never substituted', async () => {
  resetCboeCache();
  const calls: string[] = [];
  let clock = Date.parse('2026-09-16T12:00:00Z');
  const body = (url: string): { ok: boolean; status: number; csv: string } => {
    const idx = url.match(/\/([A-Z0-9]+)_History\.csv$/)?.[1] ?? '';
    if (idx === 'SKEW') return { ok: false, status: 403, csv: '' };
    return { ok: true, status: 200, csv: idx === 'VVIX' ? 'DATE,VVIX\n09/14/2026,94.89' : 'DATE,OPEN,HIGH,LOW,CLOSE\n09/14/2026,1,2,0.5,16.1' };
  };
  const ports = {
    fetch: async (url: string) => { calls.push(url); const b = body(url); return { ok: b.ok, status: b.status, text: async () => b.csv }; },
    now: () => new Date(clock),
  };
  const first = await fetchCboeDaily(ports);
  assert.equal(calls.length, CBOE_INDICES.length);
  assert.equal(first.vvix?.value, 94.89);
  assert.equal(first.vvix?.fetched_at, '2026-09-16T12:00:00.000Z');
  assert.equal(first.vvix?.url, cboeDailyUrl('VVIX'));
  assert.equal(first.vix?.value, 16.1);
  assert.equal(first.skew, null);
  assert.deepEqual(first.errors, [`SKEW: HTTP 403 from ${cboeDailyUrl('SKEW')}`]);
  // within the TTL: the five good files are served from the cache; the failed one is retried (a failure is never cached)
  clock += CBOE_TTL_MS - 1000;
  const second = await fetchCboeDaily(ports);
  assert.equal(calls.length, CBOE_INDICES.length + 1);
  assert.equal(second.vvix?.value, 94.89);
  // past the TTL: every file is fetched again
  clock += 2000;
  await fetchCboeDaily(ports);
  assert.equal(calls.length, 2 * CBOE_INDICES.length + 1);
  resetCboeCache();
});

test('a null VVIX read leaves the brake UNVERIFIED with the reason and does not throw; the four Cboe inputs ride the trace at weight 0 with fetched_at', () => {
  // no Cboe read at all
  const none = scoreRegime(etfInput('SPY', 2, { cboe: null }));
  assert.equal(none.breakdown.survival_brake.state, 'UNVERIFIED');
  assert.match(none.breakdown.survival_brake.declaration, /VVIX \(Cboe daily file not fetched this run\)/);
  assert.equal(none.breakdown.vol_conditioners.vvix.score, null);
  assert.equal(none.breakdown.vol_conditioners.vvix.null_reason, 'Cboe daily file not fetched this run');
  assert.equal(none.breakdown.vol_conditioners.cboe_inputs.length, 4);
  for (const c of none.breakdown.vol_conditioners.cboe_inputs) {
    assert.equal(c.weight, 0);
    assert.ok('fetched_at' in c);
    assert.equal(c.fetched_at, null);
    assert.equal(c.raw_value, null);
    assert.equal(c.null_reason, 'Cboe daily file not fetched this run');
  }
  // a read where the VVIX file failed: the file's own error is the reason
  const failed = scoreRegime(etfInput('SPY', 2, { cboe: cboeFx({ vvix: null, errors: ['VVIX: HTTP 404 from https://cdn.cboe.com/api/global/us_indices/daily_prices/VVIX_History.csv'] }) }));
  assert.equal(failed.breakdown.survival_brake.state, 'UNVERIFIED');
  assert.match(failed.breakdown.survival_brake.declaration, /VVIX \(VVIX: HTTP 404 from https:\/\/cdn\.cboe\.com/);
  assert.equal(failed.breakdown.vol_conditioners.vvix.null_reason, 'VVIX: HTTP 404 from https://cdn.cboe.com/api/global/us_indices/daily_prices/VVIX_History.csv');
  assert.equal(failed.breakdown.vol_conditioners.vvix.fetched_at, null);
  // the term structure still read fine — present, dated, weight 0
  const ts = failed.breakdown.vol_conditioners.cboe_inputs.find((c) => c.key === 'vix9d_over_vix');
  assert.ok(ts);
  assert.equal(ts.weight, 0);
  assert.equal(ts.fetched_at, FETCHED);
  assert.equal(ts.raw_value, Math.round((15.2 / 16.1) * 10000) / 10000);
  assert.equal(ts.null_reason, null);
  // a full read: the brake is OFF (contango, calm) and VVIX is scored, dated, sourced
  const full = scoreRegime(etfInput('SPY', 2));
  assert.equal(full.breakdown.survival_brake.state, 'OFF');
  assert.equal(full.breakdown.survival_brake.vvix, 94.89);
  assert.equal(full.breakdown.vol_conditioners.vvix.raw_value, 94.89);
  assert.equal(full.breakdown.vol_conditioners.vvix.fetched_at, FETCHED);
  assert.match(full.breakdown.vol_conditioners.vvix.source, /Cboe/);
  assert.ok(full.breakdown.vol_conditioners.vvix.score !== null);
  const skew = full.breakdown.vol_conditioners.cboe_inputs.find((c) => c.key === 'skew');
  assert.equal(skew?.raw_value, 152.09);
  assert.equal(skew?.weight, 0);
  assert.equal(skew?.fetched_at, FETCHED);
  // an elevated VVIX trips the brake, from the Cboe read
  const hot = scoreRegime(etfInput('SPY', 2, { cboe: cboeFx({ vvix: 118 }) }));
  assert.equal(hot.breakdown.survival_brake.state, 'ON');
  assert.match(hot.breakdown.survival_brake.declaration, /VVIX = 118 ≥ 110/);
  // the builder never puts a weight above 0 on a new input
  assert.ok(buildCboeRegimeInputs(cboeFx()).every((c) => c.weight === 0));
  assert.deepEqual(buildCboeRegimeInputs(cboeFx()).map((c) => c.key), ['vix9d_over_vix', 'vix_over_vix3m_cboe', 'vix3m_over_vix6m', 'skew']);
});

// ── STEP 1: the log never lies ────────────────────────────────────────────

function storeThat(fail: (row: SnapshotRow) => Error | null): SnapshotStore & { rows: SnapshotRow[] } {
  const rows: SnapshotRow[] = [];
  return { rows, async create(row) { const e = fail(row); if (e) throw e; rows.push(row); } };
}
function p2000(): Error {
  const e = new Error('\nInvalid `prisma.scan_snapshots.create()` invocation:\n\n\nThe provided value for the column is too long for the column\'s type. Column: suggestedStrategy');
  (e as { code?: string }).code = 'P2000';
  return e;
}

test('a failed snapshot write surfaces in the scan result: written false, the ticker and the store\'s reason — nothing recorded as saved when it was not', async () => {
  const sell = quiet(() => scoreAll(etfInput('SPY', 2), 'SELL'));
  const rows = [{ symbol: 'SPY', scoring: sell }, { symbol: 'QQQ', scoring: sell }, { symbol: 'IWM', scoring: sell }];
  // every row fails (the 2026-07-08 → 2026-09-16 state: P2000 on every seller row)
  const allFail = await logScanSnapshotBatch('user-1', rows, storeThat(() => p2000()));
  assert.equal(allFail.written, false);
  assert.equal(allFail.rows_attempted, 3);
  assert.equal(allFail.rows_written, 0);
  assert.equal(allFail.rows_failed, 3);
  assert.deepEqual(allFail.failed.map((f) => f.ticker), ['SPY', 'QQQ', 'IWM']);
  assert.match(allFail.failed[0].reason, /^P2000: Invalid `prisma\.scan_snapshots\.create\(\)` invocation: The provided value for the column is too long/);
  assert.match(allFail.reason ?? '', /^3 of 3 snapshot rows NOT written — P2000: .*\(tickers: SPY, QQQ, IWM\)$/);
  // one row fails: the others land, the result still says NOT written
  const oneFails = await logScanSnapshotBatch('user-1', rows, storeThat((r) => (r.ticker === 'QQQ' ? new Error('connection reset') : null)));
  assert.equal(oneFails.written, false);
  assert.equal(oneFails.rows_written, 2);
  assert.deepEqual(oneFails.failed, [{ ticker: 'QQQ', reason: 'connection reset' }]);
  assert.match(oneFails.reason ?? '', /^1 of 3 snapshot rows NOT written — connection reset \(tickers: QQQ\)$/);
  // every row lands
  const store = storeThat(() => null);
  const good = await logScanSnapshotBatch('user-1', rows, store);
  assert.equal(good.written, true);
  assert.equal(good.reason, null);
  assert.equal(good.rows_written, 3);
  assert.equal(store.rows.length, 3);
  assert.equal(store.rows[0].userId, 'user-1');
  assert.equal(store.rows[0].ticker, 'SPY');
  // nothing to write is not "written"
  const empty = await logScanSnapshotBatch('user-1', [], store);
  assert.equal(empty.written, false);
  assert.equal(empty.reason, 'nothing to write — no scored tickers');
  assert.deepEqual(snapshotNotAttempted('no user session — snapshot not attempted'), { written: false, rows_attempted: 0, rows_written: 0, rows_failed: 0, failed: [], reason: 'no user session — snapshot not attempted' });
  assert.equal(summariseSnapshotWrite(2, 2, []).written, true);
  assert.equal(describeStoreError('boom'), 'boom');
  assert.equal(describeStoreError(new Error('plain')), 'plain');
});

test('the longest producible suggestion line fits the widened column with margin; the schema and the migration carry the same width', () => {
  // the worst case: brake UNVERIFIED with BOTH legs missing and a full clipped VVIX reason, NEUTRAL direction
  const noBrakeLegs: FredMacroData = { ...FRED, vix: null, vxvShortTerm: null };
  const longReason = `VVIX: HTTP 503 from ${cboeDailyUrl('VVIX')} — upstream proxy timed out after the retry budget was exhausted on every attempt`;
  // NEUTRAL direction needs an info-edge read (balanced analyst consensus) — the ETF fixture alone is direction UNKNOWN, a shorter line
  const neutral: ConvergenceInput = { ...etfInput('SPY', 2, { fred: noBrakeLegs, cboe: cboeFx({ vvix: null, errors: [longReason] }) }), finnhubRecommendations: [{ buy: 5, hold: 10, sell: 5, strongBuy: 1, strongSell: 1, period: '2026-09-01' }] as unknown as ConvergenceInput['finnhubRecommendations'] };
  const worst = quiet(() => scoreAll(neutral, 'SELL'));
  assert.equal(worst.composite.direction, 'NEUTRAL');
  const line = worst.strategy_suggestion.suggested_strategy;
  assert.match(line, /^REGIME BRAKE UNVERIFIED: brake inputs unavailable \(VIX\/VIX3M term structure, VVIX \(VVIX: HTTP 503 from/);
  assert.ok(line.length > 100, `the line (${line.length}) is longer than the old VarChar(100) — this is the row that failed silently from 2026-07-08`);
  assert.ok(line.length <= SNAPSHOT_SUGGESTED_STRATEGY_MAX, `${line.length} > ${SNAPSHOT_SUGGESTED_STRATEGY_MAX}`);
  assert.ok(line.length <= SNAPSHOT_SUGGESTED_STRATEGY_MAX * 0.75, `${line.length} leaves less than 25% margin under ${SNAPSHOT_SUGGESTED_STRATEGY_MAX}`);
  const row = buildSnapshotRow({ userId: 'u', ticker: 'SPY', scoring: worst });
  assert.equal(row.suggestedStrategy, line);
  // the buyer's lines too
  const buy = quiet(() => scoreAll(etfInput('SPY', -6, { fred: noBrakeLegs, cboe: null }), 'BUY'));
  assert.ok((buy.strategy_suggestion.suggested_strategy ?? '').length <= SNAPSHOT_SUGGESTED_STRATEGY_MAX);
  // the schema and the migration
  const schema = readFileSync(resolve(__dirname, '../../../prisma/schema.prisma'), 'utf8');
  const width = schema.match(/suggestedStrategy String\? @db\.VarChar\((\d+)\)/);
  assert.equal(Number(width?.[1]), SNAPSHOT_SUGGESTED_STRATEGY_MAX);
  const migration = readFileSync(resolve(__dirname, '../../../prisma/migrations/20260916000000_model_02_snapshot_width/migration.sql'), 'utf8');
  assert.match(migration, new RegExp(`ALTER TABLE "scan_snapshots" ALTER COLUMN "suggestedStrategy" TYPE VARCHAR\\(${SNAPSHOT_SUGGESTED_STRATEGY_MAX}\\);`));
});

// ── STEP 4: the ETF layer ─────────────────────────────────────────────────

test('SPY produces a scored snapshot row with Quality and Info-Edge null and the gate list on the trace', () => {
  const sell = quiet(() => scoreAll(etfInput('SPY', 2), 'SELL'));
  assert.equal(sell.quality.score, null);
  assert.equal(sell.info_edge.score, null);
  assert.deepEqual(sell.composite.scored_by, ['vol_edge', 'regime']);
  const row = buildSnapshotRow({ userId: 'u', ticker: 'SPY', scoring: sell, iv30: 18, hv30: 16 });
  assert.equal(row.qualityScore, null);
  assert.equal(row.infoEdgeScore, null);
  assert.ok(row.volEdgeScore !== null && row.regimeScore !== null && row.compositeScore !== null);
  assert.deepEqual((row.fullTrace as { composite: { scored_by: string[] } }).composite.scored_by, ['vol_edge', 'regime']);
  assert.equal(GATE_TITLES.vol_edge, 'Vol Edge');
  assert.equal(GATE_TITLES.info_edge, 'Info Edge');
});

test('the ETF universe: one dated const of the 15 ruled symbols, unique, selectable by key', () => {
  const ruled = ['SPY', 'QQQ', 'IWM', 'DIA', 'XLF', 'XLE', 'XLK', 'XLV', 'XLY', 'XLI', 'XLP', 'XLU', 'XLB', 'XLRE', 'XLC'];
  assert.deepEqual([...ETF_UNIVERSE_SYMBOLS], ruled);
  assert.equal(new Set(ETF_UNIVERSE_SYMBOLS).size, 15);
  assert.equal(ETF_UNIVERSE_SET_ON, '2026-09-16');
  assert.equal(ETF_UNIVERSE.filter((e) => e.kind === 'index').length, 4);
  assert.equal(ETF_UNIVERSE.filter((e) => e.kind === 'sector').length, 11);
  assert.ok(ETF_UNIVERSE.every((e) => e.name.length > 10));
  assert.equal(isEtfUniverseSymbol('XLRE'), true);
  assert.equal(isEtfUniverseSymbol('AAPL'), false);
});

// ── STEP 3 + 5: the funnel constants; the panel and the builders agree ───

test('the funnel constants are named and dated; the panel offers exactly the strategies with a builder and every builder is offered', () => {
  assert.equal(STRUCTURE_CUT, 40);
  assert.equal(DEEP_FETCH_MULTIPLIER, 2);
  assert.equal(SCAN_LIMIT_DEFAULT, 20);
  assert.equal(FUNNEL_SET_ON, '2026-09-16');
  const builder = readFileSync(resolve(__dirname, '../strategy-builder.ts'), 'utf8');
  const built = [...new Set([...builder.matchAll(/buildCard\('([^']+)'/g)].map((m) => m[1]))].sort();
  assert.deepEqual([...AVAILABLE_STRATEGIES].sort(), built);
  assert.equal(AVAILABLE_STRATEGIES.length, 6);
  for (const n of NOT_BUILT_STRATEGIES) {
    assert.ok(!AVAILABLE_STRATEGIES.includes(n.name), `${n.name} is offered AND listed as not built`);
    assert.ok(!built.includes(n.name), `${n.name} has a builder but is listed as not built`);
    assert.ok(n.reason.length > 40, `${n.name}: reason too short`);
  }
  assert.equal(NOT_BUILT_STRATEGIES.length, 10);
  assert.match(gateCardsMarkdown(), /\| Not built \| Why \|/);
  assert.match(gateCardsMarkdown(), /offers exactly the 6 strategies the builder makes/);
});

// ── the addendum (ruled 2026-09-16): the ETF-only Step G amendment ─────────

function cutRow(o: Partial<StructureCutRow> & { symbol: string }): StructureCutRow {
  return { rank: 1, composite: 61, quality: null, beat_streak: 'UNKNOWN', categories_above_50: 2, scored_gates: 2, ...o };
}

test('SPY reaches the structure cut on the gates that can score (2 of 2, quality null); a single name with a null quality gate still does not', () => {
  assert.equal(ETF_STRUCTURE_CUT_SET_ON, '2026-09-16');
  assert.equal(STRUCTURE_CUT_CONVERGENCE_MIN, 3);
  assert.equal(STRUCTURE_CUT_QUALITY_FLOOR, 40);
  // the ETF-shaped composite: Vol-Edge + Regime score, Quality and Info-Edge excluded. A rich SPY
  // (IV rank 0.7, IV percentile 0.8, IV 6 pts over HV) scores both gates above 50 — 2 of 2.
  const spyScoring = quiet(() => scoreAll(etfInput('SPY', 6, { ivRank: 0.7, ivPercentile: 0.8 }), 'SELL'));
  assert.deepEqual(spyScoring.composite.scored_by, ['vol_edge', 'regime']);
  assert.equal(spyScoring.quality.score, null);
  assert.equal(spyScoring.info_edge.score, null);
  assert.equal(spyScoring.composite.categories_above_50, 2);
  const spy = cutRow({ symbol: 'SPY', quality: spyScoring.quality.score, composite: spyScoring.composite.score, categories_above_50: spyScoring.composite.categories_above_50, scored_gates: spyScoring.composite.scored_by.length });
  const spyVerdict = structureCutEligibility(spy, true);
  assert.equal(spyVerdict.eligible, true);
  // the same instrument with compressed premium scores Vol-Edge below 50 — 1 of 2 — and is honestly NOT admitted
  const spyCheap = quiet(() => scoreAll(etfInput('SPY', 2), 'SELL'));
  assert.equal(spyCheap.composite.categories_above_50, 1);
  assert.equal(structureCutEligibility(cutRow({ symbol: 'SPY', categories_above_50: spyCheap.composite.categories_above_50, scored_gates: spyCheap.composite.scored_by.length }), true).eligible, false);
  assert.match(spyVerdict.eligible ? spyVerdict.note ?? '' : '', /^Admitted SPY .* ETF member \(set 2026-09-16\): convergence 2\/2 over the gates that can score \(scored on 2 of 4 gates\); quality gate EXCLUDED — the 40-floor is not applicable to an index\/sector ETF, declared\.$/);
  // the same row as a single name: MIG-1 still bars it (and BUG 4 before that — 2 of 4)
  const aapl = structureCutEligibility(cutRow({ symbol: 'AAPL' }), false);
  assert.equal(aapl.eligible, false);
  assert.match(aapl.eligible ? '' : aapl.reason, /convergence 2\/4, below 3\/4 minimum/);
  const aaplConverged = structureCutEligibility(cutRow({ symbol: 'AAPL', categories_above_50: 3, scored_gates: 3 }), false);
  assert.equal(aaplConverged.eligible, false);
  assert.match(aaplConverged.eligible ? '' : aaplConverged.reason, /quality gate EXCLUDED \(zero computable signals\); 40-quality floor not evaluable, missing is not treated as passing/);
  // a single name with quality scored and 3 of 4 above 50 is admitted with no note — unchanged
  const msft = structureCutEligibility(cutRow({ symbol: 'MSFT', quality: 58, categories_above_50: 3, scored_gates: 4 }), false);
  assert.deepEqual(msft, { eligible: true, note: null });
  // an ETF member is still held to the fraction over the gates that scored
  assert.equal(convergenceRequiredOf(2), 2);
  assert.equal(convergenceRequiredOf(3), 3);
  assert.equal(convergenceRequiredOf(4), 3);
  const oneOfTwo = structureCutEligibility(cutRow({ symbol: 'QQQ', categories_above_50: 1 }), true);
  assert.equal(oneOfTwo.eligible, false);
  assert.match(oneOfTwo.eligible ? '' : oneOfTwo.reason, /ETF member: convergence 1\/2 over the gates that can score, below the 2\/2 minimum \(scored on 2 of 4 gates/);
  const twoOfFour = structureCutEligibility(cutRow({ symbol: 'XLF', quality: 76, categories_above_50: 2, scored_gates: 4 }), true);
  assert.equal(twoOfFour.eligible, false);
  const threeOfFour = structureCutEligibility(cutRow({ symbol: 'XLK', quality: 76, categories_above_50: 3, scored_gates: 4 }), true);
  assert.equal(threeOfFour.eligible, true);
  assert.match(threeOfFour.eligible ? threeOfFour.note ?? '' : '', /convergence 3\/4 over the gates that can score \(scored on 4 of 4 gates\)\.$/);
  // the quality floor and the miss streak still bind an ETF member whose quality gate DID score
  const lowQuality = structureCutEligibility(cutRow({ symbol: 'XLE', quality: 32 }), true);
  assert.equal(lowQuality.eligible, false);
  assert.match(lowQuality.eligible ? '' : lowQuality.reason, /quality below 40 floor/);
  const streak = structureCutEligibility(cutRow({ symbol: 'XLU', quality: 45, beat_streak: '3Q MISS STREAK' }), true);
  assert.equal(streak.eligible, false);
  // nothing scored at all is not "converged"
  const nothing = structureCutEligibility(cutRow({ symbol: 'DIA', categories_above_50: 0, scored_gates: 0 }), true);
  assert.equal(nothing.eligible, false);
});
