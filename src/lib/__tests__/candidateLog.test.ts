import test from 'node:test';
import assert from 'node:assert/strict';
import {
  persistScanCandidates,
  pnlAtExpiry,
  parseLegs,
  settleCandidateOutcomes,
  PRICE_PATH_SOURCE,
  POSITION_SOURCE,
  SETTLE_MAX_LAG_DAYS,
  type CandidateLogStore,
  type CandidateRow,
  type DueCandidate,
  type OutcomeWrite,
  type ScanRunRow,
  type SettlePorts,
  type TakenOutcome,
} from '../convergence/candidate-log';
import type { TradeCardData, CandleData } from '../convergence/types';
import type { FullScoringResult } from '../convergence/composite';
import { CURRENT_MODEL_ERA } from '../edge-read/eras';

// LOG-01 STEP 4 — tests on fixtures. Pure module, no database, no vendor.

function card(symbol: string, strategy: string, legs: TradeCardData['setup']['legs'], overrides: Partial<TradeCardData['setup']> = {}): TradeCardData {
  return {
    symbol,
    label: 'A',
    setup: {
      strategy_name: strategy,
      legs,
      expiration_date: '2026-10-16',
      dte: 31,
      net_credit: 1.5,
      net_debit: null,
      max_profit: 150,
      max_loss: 350,
      breakevens: [98.5],
      probability_of_profit: 0.7,
      pop_method: 'breakeven_d2',
      hv_pop: null,
      risk_reward_ratio: 0.43,
      greeks: { delta: -0.1, gamma: 0.01, theta: 2, vega: -5 },
      theta_per_day: 2,
      ev: 40,
      ev_per_risk: 0.11,
      has_wide_spread: false,
      is_unlimited_risk: false,
      ...overrides,
    } as TradeCardData['setup'],
    why: {
      side: 'SELL',
      score_model: 'seller',
      model_era: CURRENT_MODEL_ERA.id,
      scored_by: ['vol_edge', 'quality', 'regime', 'info_edge'],
      catalysts: [],
      earnings_window: { state: 'outside', detail: 'no earnings date inside [2026-09-15, 2026-10-16] — nearest known 2026-10-28 (Finnhub calendar/earnings)', date: '2026-10-28', source: 'Finnhub calendar/earnings' },
      undefined_risk_cap: overrides.is_unlimited_risk ? 'undefined-risk structure allowed — filter Risk = Unlimited and 0 open undefined-risk position(s) < cap 1' : null,
    } as unknown as TradeCardData['why'],
    key_stats: {} as TradeCardData['key_stats'],
  };
}

function scoring(score: number, excluded: string[] = []): FullScoringResult {
  return {
    composite: {
      score,
      category_scores: { vol_edge: 60, quality: 55, regime: 50, info_edge: 45 },
      data_confidence: { confidence: 0.9, imputed_sub_scores: excluded.length, excluded_fields: excluded, imputed_fields: [], total_sub_scores: 40, active_signal_count: 40 - excluded.length },
    },
    vol_edge: { breakdown: { technicals: { indicators: { latest_close: 101.2 } } } },
  } as unknown as FullScoringResult;
}

function memoryStore() {
  const runs: ScanRunRow[] = [];
  const rows: CandidateRow[] = [];
  const store: CandidateLogStore & { runs: ScanRunRow[]; rows: CandidateRow[] } = {
    runs,
    rows,
    async write(run, candidates) {
      runs.push(run);
      rows.push(...candidates);
      return candidates.length;
    },
  };
  return store;
}

const pcs = [
  { type: 'put', side: 'sell', strike: 100, price: 2.0 },
  { type: 'put', side: 'buy', strike: 95, price: 0.5 },
];

test('persist — every card the scan returns is the card the log wrote, stamped with its candidate_id (one list)', async () => {
  const store = memoryStore();
  const cards = { AAPL: [card('AAPL', 'Put Credit Spread', pcs), card('AAPL', 'Iron Condor', [...pcs, { type: 'call', side: 'sell', strike: 110, price: 1.8 }, { type: 'call', side: 'buy', strike: 115, price: 0.4 }])], MSFT: [card('MSFT', 'Short Strangle', [{ type: 'put', side: 'sell', strike: 380, price: 4 }, { type: 'call', side: 'sell', strike: 440, price: 3.5 }], { is_unlimited_risk: true, max_loss: null })] };
  const now = new Date('2026-09-15T14:30:00Z');
  const r = await persistScanCandidates({ userId: 'u1', universe: 'sp500', limit: 20, side: 'BOTH', tickersScored: 40, cards, context: { AAPL: { scoring: scoring(72, ['vol_edge.gex']), spotAtScan: 101.2, iv30AtScan: 28.5 }, MSFT: { scoring: scoring(61), spotAtScan: 410, iv30AtScan: 24 } }, now }, store);
  assert.equal(r.written, 3);
  assert.equal(store.runs.length, 1);
  assert.equal(store.runs[0].candidates_written, 3);
  assert.equal(store.runs[0].tickers_scored, 40);
  // MODEL-01: the era is the running model's (CURRENT_MODEL_ERA), not the calendar's
  assert.equal(store.runs[0].model_era, CURRENT_MODEL_ERA.id);
  assert.equal(store.runs[0].side, 'BOTH');
  const returned = [...r.cards.AAPL, ...r.cards.MSFT];
  assert.equal(returned.length, 3);
  const ids = new Set(returned.map((c) => c.candidate_id));
  assert.equal(ids.size, 3);
  for (const row of store.rows) assert.ok(ids.has(row.id), 'every written row is a returned card');
  const aapl = store.rows.find((x) => x.symbol === 'AAPL' && x.strategy_name === 'Put Credit Spread') as CandidateRow;
  assert.deepEqual(aapl.legs, pcs);
  assert.equal(aapl.composite_score, 72);
  assert.equal(aapl.vol_edge_score, 60);
  assert.deepEqual(aapl.excluded_fields, ['vol_edge.gex']);
  assert.equal(aapl.pop, 0.7);
  assert.equal(aapl.max_loss, 350);
  assert.equal(aapl.spot_at_scan, 101.2);
  assert.equal(aapl.taken, false);
  assert.equal(aapl.side, 'SELL');
  assert.equal(aapl.score_model, 'seller');
  assert.deepEqual(aapl.catalyst, []);
  assert.match(aapl.earnings_window, /no earnings date inside/);
  assert.equal(aapl.undefined_risk_cap, null);
  const msft = store.rows.find((x) => x.symbol === 'MSFT') as CandidateRow;
  assert.equal(msft.is_unlimited, true);
  assert.match(msft.undefined_risk_cap ?? '', /cap 1/);
  assert.equal(aapl.expiration.toISOString(), '2026-10-16T00:00:00.000Z');
  assert.equal(aapl.generated_at, now);
  // the original list is not mutated — the stamped list is what the caller must adopt
  assert.equal(cards.AAPL[0].candidate_id, undefined);
});

test('persist — a store that writes fewer rows than cards throws (never an unpersisted candidate)', async () => {
  const short: CandidateLogStore = { async write() { return 0; } };
  await assert.rejects(
    persistScanCandidates({ userId: 'u1', universe: undefined, limit: 20, side: 'SELL', tickersScored: 1, cards: { AAPL: [card('AAPL', 'Put Credit Spread', pcs)] }, context: { AAPL: { scoring: scoring(50), spotAtScan: null, iv30AtScan: null } }, now: new Date() }, short),
    /wrote 0 candidate rows for 1 cards/,
  );
});

test('persist — an empty scan writes one run with zero candidates and returns an empty list', async () => {
  const store = memoryStore();
  const r = await persistScanCandidates({ userId: 'u1', universe: undefined, limit: 20, side: 'SELL', tickersScored: 0, cards: {}, context: {}, now: new Date() }, store);
  assert.equal(r.written, 0);
  assert.deepEqual(r.cards, {});
  assert.equal(store.runs[0].candidates_written, 0);
});

test('pnlAtExpiry — the payoff at expiry per contract (strategy-builder computePnlPoints arithmetic)', () => {
  const legs = parseLegs(pcs) as NonNullable<ReturnType<typeof parseLegs>>;
  assert.equal(pnlAtExpiry(legs, 105), 150); // both puts expire worthless: full credit 1.5 × 100
  assert.equal(pnlAtExpiry(legs, 90), -350); // max loss: 5-wide − 1.5 credit
  assert.equal(pnlAtExpiry(legs, 98.5), 0); // breakeven
  assert.equal(pnlAtExpiry([{ type: 'call', side: 'buy', strike: 100, price: 3 }], 110), 700);
  assert.equal(parseLegs([{ type: 'put', side: 'short', strike: 1, price: 1 }]), null);
  assert.equal(parseLegs([]), null);
});

function fakePorts(opts: { due: DueCandidate[]; pending?: number; candles?: Record<string, CandleData[]>; taken?: Record<string, TakenOutcome>; now?: Date }) {
  const writes = new Map<string, OutcomeWrite>();
  let candleCalls = 0;
  const ports: SettlePorts = {
    now: () => opts.now ?? new Date('2026-10-19T12:00:00Z'),
    async loadDue() { return { due: opts.due, pending: opts.pending ?? 0 }; },
    async loadTakenOutcome(id) { return opts.taken?.[id] ?? { state: 'no_card' }; },
    async fetchCandles(symbols) {
      candleCalls += 1;
      const m = new Map<string, CandleData[]>();
      for (const s of symbols) if (opts.candles?.[s]) m.set(s, opts.candles[s]);
      return m;
    },
    async writeOutcome(id, data) { writes.set(id, data); },
  };
  return { ports, writes, candleCalls: () => candleCalls };
}

const candle = (date: string, close: number): CandleData => ({ time: Date.parse(`${date}T20:00:00Z`), date, open: close, high: close, low: close, close, volume: 1 });
const exp = new Date('2026-10-16T00:00:00Z');

test('settle — an UNTAKEN candidate settles from the price path; a TAKEN one from its position; never confused', async () => {
  const due: DueCandidate[] = [
    { id: 'c-untaken', symbol: 'AAPL', legs: pcs, expiration: exp, taken: false },
    { id: 'c-taken', symbol: 'AAPL', legs: pcs, expiration: exp, taken: true },
  ];
  const f = fakePorts({ due, candles: { AAPL: [candle('2026-10-15', 104), candle('2026-10-16', 106.5)] }, taken: { 'c-taken': { state: 'closed', pl: 88 } } });
  const s = await settleCandidateOutcomes('u1', f.ports);
  assert.equal(s.settled_from_price_path, 1);
  assert.equal(s.settled_from_position, 1);
  const u = f.writes.get('c-untaken') as OutcomeWrite;
  assert.equal(u.outcome_pl, 150);
  assert.equal(u.settle_price, 106.5);
  assert.equal(u.settle_price_date?.toISOString(), '2026-10-16T00:00:00.000Z');
  assert.equal(u.outcome_source, PRICE_PATH_SOURCE);
  assert.ok(u.outcome_at);
  const t = f.writes.get('c-taken') as OutcomeWrite;
  assert.equal(t.outcome_pl, 88);
  assert.equal(t.outcome_source, POSITION_SOURCE);
  assert.equal(t.settle_price, null);
  assert.equal(f.candleCalls(), 1);
});

test('settle — a missing expiry price leaves outcome_pl null with its reason, and outcome_at null so it is retried', async () => {
  const due: DueCandidate[] = [
    { id: 'no-candles', symbol: 'NVDA', legs: pcs, expiration: exp, taken: false },
    { id: 'stale', symbol: 'AMZN', legs: pcs, expiration: exp, taken: false },
    { id: 'bad-legs', symbol: 'AAPL', legs: { not: 'legs' }, expiration: exp, taken: false },
    { id: 'taken-open', symbol: 'AAPL', legs: pcs, expiration: exp, taken: true },
  ];
  const f = fakePorts({ due, pending: 7, candles: { AMZN: [candle('2026-10-01', 180)], AAPL: [candle('2026-10-16', 100)] }, taken: { 'taken-open': { state: 'open' } } });
  const s = await settleCandidateOutcomes('u1', f.ports);
  assert.equal(s.settled_from_price_path, 0);
  assert.equal(s.settled_from_position, 0);
  assert.equal(s.pending_not_yet_expired, 7);
  assert.equal(s.checked, 11);
  for (const id of ['no-candles', 'stale', 'bad-legs', 'taken-open']) {
    const w = f.writes.get(id) as OutcomeWrite;
    assert.equal(w.outcome_pl, null, id);
    assert.equal(w.outcome_at, null, id);
    assert.equal(w.outcome_source, null, id);
    assert.ok(w.outcome_reason && w.outcome_reason.length > 10, id);
  }
  assert.match((f.writes.get('no-candles') as OutcomeWrite).outcome_reason as string, /no candle data/);
  assert.match((f.writes.get('stale') as OutcomeWrite).outcome_reason as string, new RegExp(`> ${SETTLE_MAX_LAG_DAYS}d before expiration`));
  assert.match((f.writes.get('bad-legs') as OutcomeWrite).outcome_reason as string, /legs unreadable/);
  assert.match((f.writes.get('taken-open') as OutcomeWrite).outcome_reason as string, /still open/);
  assert.equal(s.unsettled.reduce((a, b) => a + b.count, 0), 4);
});

test('settle — a close within the lag tolerance before expiry is accepted and dated', async () => {
  const f = fakePorts({ due: [{ id: 'fri', symbol: 'AAPL', legs: pcs, expiration: exp, taken: false }], candles: { AAPL: [candle('2026-10-14', 97)] } });
  await settleCandidateOutcomes('u1', f.ports);
  const w = f.writes.get('fri') as OutcomeWrite;
  assert.equal(w.outcome_pl, -150); // 100 put 3 ITM (−300 + 200 credit), 95 put worthless (−50): (2−3)×100 + (0−0.5)×100 = −150
  assert.equal(w.settle_price_date?.toISOString(), '2026-10-14T00:00:00.000Z');
});
