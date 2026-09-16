import test from 'node:test';
import assert from 'node:assert/strict';
import {
  benchmarkIndexFor,
  familyOf,
  sideFromCardLegs,
  sideFromPositionLegs,
  STRATEGY_FAMILY_MAP,
} from '../edge-read/families';
import {
  brierScore,
  ciHalfWidth,
  clusterCount,
  decileBin,
  isoWeekKey,
  MIN_N,
  outcomeStats,
  quartileGroups,
  separationVerdict,
  tradesNeededForTenPointEdge,
} from '../edge-read/stats';
import { eraFor, MODEL_ERAS } from '../edge-read/eras';
import { parseCboeHistory, windowReturn } from '../edge-read/cboe';
import { buildReport, classifyTicket, secondaryBookReport, type Ticket, type TicketPositionLeg } from '../edge-read/report';
import { honestFrame } from '../edge-read/frame';
import { SELF_REPORTED_BIAS_NOTE } from '../tradeLog/ownership';

// EDGE-01 STEP 3 — tests on fixtures. Every fixture is built in memory; no
// database, no network.

function leg(overrides: Partial<TicketPositionLeg> = {}): TicketPositionLeg {
  return {
    positionType: 'SHORT',
    openPrice: 1.5,
    quantity: 1,
    openDate: new Date('2026-08-03T14:00:00Z'),
    expirationDate: new Date('2026-09-18T00:00:00Z'),
    closeDate: new Date('2026-08-28T15:00:00Z'),
    status: 'CLOSED',
    strategyRaw: 'put-spread',
    ...overrides,
  };
}

/** A SELL-DEFINED put credit spread ticket in era E6 (2026-08), graded. */
function ticket(i: number, overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: `t${i}`,
    symbol: 'AAPL',
    generatedAt: new Date('2026-08-03T13:00:00Z'),
    cardStrategyRaw: 'Put Credit Spread',
    cardLegs: [
      { side: 'sell', price: 2.0 },
      { side: 'buy', price: 0.5 },
    ],
    cardExpirationDate: new Date('2026-09-18T00:00:00Z'),
    positionLegs: [leg({ positionType: 'SHORT', openPrice: 2.0 }), leg({ positionType: 'LONG', openPrice: 0.5 })],
    compositeScore: 50,
    volEdgeScore: 50,
    qualityScore: 50,
    regimeScore: 50,
    infoEdgeScore: 50,
    predictedWinRatePct: 70,
    maxLoss: 350,
    actualPl: 100,
    grade: 'B',
    snapshot: { excludedFields: [], imputedCount: 0 },
    ...overrides,
  };
}

const line = (lines: string[], needle: string) => lines.find((l) => l.includes(needle));

test('family map — the ruling §3 taxonomy, and nothing else, is mapped', () => {
  assert.equal(familyOf('Put Credit Spread').family, 'SELL-DEFINED');
  assert.equal(familyOf('iron-condor').family, 'SELL-DEFINED');
  assert.equal(familyOf('Jade Lizard').family, 'SELL-DEFINED');
  assert.equal(familyOf('Short Strangle').family, 'SELL-UNDEFINED');
  assert.equal(familyOf('Long Straddle').family, 'BUY');
  assert.equal(familyOf('Bull Call Spread').family, 'BUY');
  assert.equal(familyOf('Calendar Spread').family, 'TERM');
  // The position side's own vocabulary does not say credit/debit or short/long → UNMAPPED, raw kept
  for (const raw of ['put-spread', 'call-spread', 'straddle-strangle', 'single', 'multi-leg-3', 'ITM Spread Expiration', null]) {
    const r = familyOf(raw);
    assert.equal(r.family, 'UNMAPPED', raw ?? 'null');
    assert.equal(r.raw, raw ?? '(null)');
  }
  assert.equal(Object.keys(STRATEGY_FAMILY_MAP).length, 22);
  assert.equal(benchmarkIndexFor('put credit spread'), 'PUT');
  assert.equal(benchmarkIndexFor('iron condor'), 'CMBO');
  assert.equal(benchmarkIndexFor('short strangle'), 'CMBO');
  assert.equal(benchmarkIndexFor('calendar spread'), null);
});

test('premium direction — read from legs independently of the string; missing data is UNKNOWN', () => {
  assert.equal(sideFromCardLegs([{ side: 'sell', price: 2 }, { side: 'buy', price: 0.5 }]), 'SELL');
  assert.equal(sideFromCardLegs([{ side: 'buy', price: 3 }, { side: 'sell', price: 1 }]), 'BUY');
  assert.equal(sideFromCardLegs([{ side: 'sell', price: null }]), 'UNKNOWN');
  assert.equal(sideFromCardLegs([{ side: 'sell', price: 1 }, { side: 'buy', price: 1 }]), 'UNKNOWN');
  assert.equal(sideFromPositionLegs([{ positionType: 'SHORT', openPrice: 2, quantity: 1 }, { positionType: 'LONG', openPrice: 0.5, quantity: 1 }]), 'SELL');
  assert.equal(sideFromPositionLegs([{ positionType: 'LONG', openPrice: 2, quantity: 2 }]), 'BUY');
  assert.equal(sideFromPositionLegs([{ positionType: 'WEIRD', openPrice: 2, quantity: 1 }]), 'UNKNOWN');
  assert.equal(sideFromPositionLegs([]), 'UNKNOWN');
});

test('statistics — CI half-width, the 194-trade line, quartiles, deciles, weeks, clusters', () => {
  assert.equal(Number(ciHalfWidth(0.5, 100).toFixed(4)), 0.098);
  assert.equal(tradesNeededForTenPointEdge(), 194);
  const g = quartileGroups([5, 1, 4, 2, 3, 6, 7, 8], (x) => x);
  assert.deepEqual([g.q1, g.q2, g.q3, g.q4], [[1, 2], [3, 4], [5, 6], [7, 8]]);
  assert.equal(quartileGroups([1, null, 2], (x) => x).unscored.length, 1);
  assert.equal(decileBin(0), 0);
  assert.equal(decileBin(0.7), 7);
  assert.equal(decileBin(1), 9);
  assert.equal(isoWeekKey(new Date('2026-01-01T00:00:00Z')), '2026-W01');
  assert.equal(isoWeekKey(new Date('2026-08-03T00:00:00Z')), '2026-W32');
  assert.deepEqual(clusterCount([1, 2, 3], (x) => (x === 3 ? null : 'same')), { clusters: 1, unresolved: 1 });
});

test('a zero-P&L trade lands in scratches, not wins', () => {
  const s = outcomeStats([0, 5, -5, 0]);
  assert.equal(s.wins, 1);
  assert.equal(s.losses, 1);
  assert.equal(s.scratches, 2);
  assert.equal(s.winRate, null); // n=4 < 30 — no rate
  const tickets = [
    ...Array.from({ length: 30 }, (_, i) => ticket(i, { actualPl: i < 10 ? 0 : 100 })),
  ];
  const r = buildReport(tickets);
  const b = r.buckets[0];
  assert.equal(b.stats.scratches, 10);
  assert.equal(b.stats.wins, 20);
  assert.equal(b.stats.winRate, 20 / 30);
  assert.ok(line(b.lines, '(b) realized P&L')?.includes('scratches 10'));
});

test('a bucket under 30 prints insufficient with its n, and no percentage', () => {
  const tickets = Array.from({ length: 11 }, (_, i) => ticket(i, { actualPl: 100 }));
  const r = buildReport(tickets);
  assert.equal(r.buckets.length, 1);
  const a = line(r.buckets[0].lines, 'win rate:') as string;
  assert.ok(a.includes('insufficient (n=11)'), a);
  assert.ok(!/\d+\.\d%/.test(a), a);
  assert.equal(r.buckets[0].compositeVerdict.verdict, 'insufficient');
  assert.ok(line(r.buckets[0].lines, 'Brier score')?.includes('insufficient (n=11)'));
});

test('Q4 clearly beats Q1 → the verdict says so; a tie → no separation', () => {
  const strong = Array.from({ length: 120 }, (_, i) =>
    ticket(i, { compositeScore: i, actualPl: i >= 90 ? 100 : i < 30 ? -100 : i % 2 === 0 ? 60 : -60 }),
  );
  const rs = buildReport(strong);
  assert.equal(rs.buckets.length, 1);
  assert.equal(rs.buckets[0].compositeVerdict.verdict, 'Q4 beats Q1');
  assert.ok(line(rs.buckets[0].lines, 'verdict: Q4 beats Q1'));

  const tie = Array.from({ length: 120 }, (_, i) => ticket(i, { compositeScore: i, actualPl: i % 2 === 0 ? 100 : -100 }));
  const rt = buildReport(tie);
  assert.equal(rt.buckets[0].compositeVerdict.verdict, 'no separation');
  assert.ok(line(rt.buckets[0].lines, 'verdict: no separation'));

  // conservative: a 10-point gap on 30 vs 30 is inside the intervals → no separation, never a claim
  const q4 = outcomeStats(Array.from({ length: 30 }, (_, i) => (i < 18 ? 1 : -1)));
  const q1 = outcomeStats(Array.from({ length: 30 }, (_, i) => (i < 15 ? 1 : -1)));
  assert.equal(separationVerdict(q4, q1).verdict, 'no separation');
});

test('an unmapped strategy string lands in UNMAPPED with its raw value — never guessed', () => {
  const tickets = [ticket(1, { cardStrategyRaw: 'multi-leg-3' }), ticket(2)];
  const r = buildReport(tickets);
  const keys = r.buckets.map((b) => b.key);
  assert.ok(keys.some((k) => k.includes('UNMAPPED')), keys.join(' | '));
  assert.ok(line(r.lines, 'trade_cards.strategy_name "multi-leg-3" → UNMAPPED ×1'));
  assert.ok(line(r.lines, 'trading_positions.strategy "put-spread" → UNMAPPED ×2'));
});

test('a missing sub-score is counted in (f) as an absent input', () => {
  const tickets = Array.from({ length: 35 }, (_, i) => ticket(i, { qualityScore: i < 5 ? null : 50 }));
  const r = buildReport(tickets);
  const absent = line(r.buckets[0].lines, 'an input absent') as string;
  assert.ok(absent.endsWith('(n=5)'), absent);
  const complete = line(r.buckets[0].lines, 'every sub-score present') as string;
  assert.ok(complete.endsWith('(n=30)'), complete);
  assert.ok(line(r.buckets[0].lines, 'most-missing inputs')?.includes('quality (gate null) ×5'));
  // an excluded input recorded on the same-day snapshot counts too
  const r2 = buildReport(Array.from({ length: 30 }, (_, i) => ticket(i, { snapshot: { excludedFields: i < 3 ? ['vol_edge.gex'] : [], imputedCount: 0 } })));
  assert.ok((line(r2.buckets[0].lines, 'an input absent') as string).endsWith('(n=3)'));
  // no same-day snapshot → presence unknown, not assumed
  const r3 = buildReport(Array.from({ length: 30 }, (_, i) => ticket(i, { snapshot: null })));
  assert.ok((line(r3.buckets[0].lines, 'presence unknown') as string).endsWith('(n=30)'));
});

test('Brier is ~0 on a perfectly calibrated (and sharp) fixture; a calibrated-but-unsharp 70% forecast scores 0.21', () => {
  const perfect = Array.from({ length: 40 }, (_, i) => ({ p: i % 2 === 0 ? 1 : 0, y: (i % 2 === 0 ? 1 : 0) as 0 | 1 }));
  assert.equal(brierScore(perfect), 0);
  const unsharp = Array.from({ length: 100 }, (_, i) => ({ p: 0.7, y: (i < 70 ? 1 : 0) as 0 | 1 }));
  assert.equal(Number((brierScore(unsharp) as number).toFixed(4)), 0.21);
  assert.equal(brierScore(perfect.slice(0, MIN_N - 1)), null);
  const tickets = Array.from({ length: 40 }, (_, i) => ticket(i, { predictedWinRatePct: i % 2 === 0 ? 100 : 0, actualPl: i % 2 === 0 ? 50 : -50 }));
  const r = buildReport(tickets);
  assert.equal(r.buckets[0].brier, 0);
  assert.ok(line(r.buckets[0].lines, 'Brier score: 0.0000'));
});

test('buckets never pool across direction: a SELL and a BUY ticket of one family and era are two buckets', () => {
  const sell = ticket(1);
  const buy = ticket(2, {
    cardStrategyRaw: 'Bull Call Spread',
    cardLegs: [{ side: 'buy', price: 3 }, { side: 'sell', price: 1 }],
    positionLegs: [leg({ positionType: 'LONG', openPrice: 3, strategyRaw: 'call-spread' }), leg({ positionType: 'SHORT', openPrice: 1, strategyRaw: 'call-spread' })],
  });
  const r = buildReport([sell, buy]);
  assert.deepEqual(r.buckets.map((b) => b.key).sort(), ['BUY × BUY × E6', 'SELL × SELL-DEFINED × E6']);
});

test('direction checks are reported, not resolved', () => {
  // card says SELL (credit), the position legs say BUY
  const mismatch = ticket(1, { positionLegs: [leg({ positionType: 'LONG', openPrice: 2.0 }), leg({ positionType: 'SHORT', openPrice: 0.5 })] });
  const c = classifyTicket(mismatch);
  assert.equal(c.direction, 'BUY');
  assert.equal(c.cardSide, 'SELL');
  assert.equal(c.family, 'SELL-DEFINED');
  const r = buildReport([mismatch, ticket(2)]);
  assert.ok(line(r.lines, 'disagree on premium direction: 1 of 2'));
  assert.ok(line(r.lines, 'position_type contradicts: 1 of 2'));
  assert.ok(r.buckets.some((b) => b.key === 'BUY × SELL-DEFINED × E6'));
});

test('eras — merge dates on main; a card is bucketed by generated_at', () => {
  assert.equal(eraFor(new Date('2026-06-19T23:59:59Z')).id, 'E0');
  assert.equal(eraFor(new Date('2026-06-20T00:00:00Z')).id, 'E1');
  assert.equal(eraFor(new Date('2026-07-05T12:00:00Z')).id, 'E3');
  assert.equal(eraFor(new Date('2026-07-06T00:00:00Z')).id, 'E4');
  assert.equal(eraFor(new Date('2026-07-07T00:00:00Z')).id, 'E5');
  assert.equal(eraFor(new Date('2026-08-03T13:00:00Z')).id, 'E6');
  assert.equal(eraFor(new Date('2026-09-15T00:00:00Z')).id, 'E8');
  assert.equal(eraFor(new Date('2026-09-16T00:00:00Z')).id, 'E9');
  assert.ok(MODEL_ERAS.every((e, i) => i === 0 || e.from > MODEL_ERAS[i - 1].from));
  const old = ticket(1, { generatedAt: new Date('2026-06-01T00:00:00Z') });
  assert.equal(buildReport([old]).buckets[0].key, 'SELL × SELL-DEFINED × E0');
});

test('CBOE — parse the published CSV shape and take the return over a window; nothing is substituted', () => {
  const csv = 'DATE,PUT\n08/03/2026,3500.000000\n08/04/2026,3510.000000\nbad,row\n08/28/2026,3570.000000\n';
  const { series, skipped } = parseCboeHistory(csv);
  assert.equal(series.length, 3);
  assert.equal(skipped, 1);
  const w = windowReturn(series, '2026-08-01', '2026-08-31');
  assert.ok(w);
  assert.equal(w.startDate, '2026-08-03');
  assert.equal(w.endDate, '2026-08-28');
  assert.equal(Number(w.ret.toFixed(4)), 0.02);
  assert.equal(windowReturn(series, '2026-09-01', '2026-09-30'), null);
  assert.equal(windowReturn(series, '2026-08-31', '2026-08-01'), null);
});

test('(h) prints the benchmark beside a SELL bucket, and "unavailable" when the series is missing', () => {
  const tickets = Array.from({ length: 30 }, (_, i) => ticket(i));
  const withSeries = buildReport(tickets, {
    benchmarks: { PUT: [{ date: '2026-08-03', value: 3500 }, { date: '2026-08-28', value: 3570 }], errors: {} },
  });
  const h = line(withSeries.buckets[0].lines, '(h) PUT benchmark') as string;
  assert.ok(h.includes('benchmark PUT 2.0% over 2026-08-03 → 2026-08-28'), h);
  assert.ok(h.includes('return on Σ max_loss (n=30'), h);
  const without = buildReport(tickets, { benchmarks: { errors: { PUT: 'HTTP 503' } } });
  assert.ok((line(without.buckets[0].lines, '(h) PUT benchmark') as string).includes('unavailable (PUT: HTTP 503)'));
  const none = buildReport(tickets);
  assert.ok((line(none.buckets[0].lines, '(h) PUT benchmark') as string).includes('benchmark unavailable'));
});

test('(g) counts entry-week and expiration clusters beside tickets', () => {
  const tickets = Array.from({ length: 30 }, (_, i) =>
    ticket(i, {
      positionLegs: [leg({ openDate: new Date(Date.UTC(2026, 7, 3 + (i % 3) * 7)) })],
      cardExpirationDate: new Date(Date.UTC(2026, 8, i % 2 === 0 ? 18 : 25)),
    }),
  );
  const g = line(buildReport(tickets).buckets[0].lines, '(g) effective sample size') as string;
  assert.ok(g.includes('30 tickets → 3 entry-week clusters'), g);
  assert.ok(g.includes('2 expiration clusters'), g);
});

test('the secondary book buckets closed trades by direction × position-string family × era and counts the unlinked', () => {
  const trades = [
    { tradeNum: 'T1', legs: [leg({ positionType: 'SHORT', openPrice: 2 }), leg({ positionType: 'LONG', openPrice: 0.5 })], realizedPl: 120, linked: true },
    { tradeNum: 'T2', legs: [leg({ positionType: 'SHORT', openPrice: 2, strategyRaw: 'iron-condor' })], realizedPl: -40, linked: false },
    { tradeNum: 'T3', legs: [leg({ positionType: 'LONG', openPrice: 3, strategyRaw: 'single' })], realizedPl: 0, linked: false },
  ];
  const lines = secondaryBookReport(trades);
  assert.ok(line(lines, 'SECONDARY BOOK — every CLOSED trade (3 trades; linked to a card 1; never linked 2)'));
  assert.ok(line(lines, 'BUCKET SELL × UNMAPPED × E6'));
  assert.ok(line(lines, 'BUCKET SELL × SELL-DEFINED × E6'));
  assert.ok(line(lines, 'BUCKET BUY × UNMAPPED × E6'));
  assert.ok(line(lines, '"put-spread" → UNMAPPED ×1'));
});

test('the honest frame names the four biases and the 194-trade line', () => {
  const f = honestFrame().join('\n');
  assert.ok(f.includes('Selection'));
  assert.ok(f.includes('Survivorship'));
  assert.ok(f.includes('Small and correlated'));
  assert.ok(f.includes('About 194 INDEPENDENT trades'));
  // TRADE-LOG-01: the fourth bias — a hand-entered book is entered by the
  // person being measured, and the frame says so in the leaf's own words.
  assert.ok(f.includes('Self-reported entry'));
  assert.ok(f.includes(SELF_REPORTED_BIAS_NOTE));
  assert.ok(f.includes('Four biases'));
});

test('LOG-01 — the candidate book reads direction from the card legs when told to, and TAKEN/UNTAKEN is one more bucket split', () => {
  const untaken = ticket(1, { positionLegs: [], directionSource: 'card_legs', split: 'UNTAKEN' });
  const taken = ticket(2, { directionSource: 'position_legs', split: 'TAKEN' });
  const r = buildReport([untaken, taken]);
  assert.deepEqual(r.buckets.map((b) => b.key).sort(), ['SELL × SELL-DEFINED × E6 × TAKEN', 'SELL × SELL-DEFINED × E6 × UNTAKEN']);
  // without the flag an empty position list is UNKNOWN — never silently read from the card
  const plain = classifyTicket(ticket(3, { positionLegs: [] }));
  assert.equal(plain.direction, 'UNKNOWN');
  // no position strings are listed for tickets without positions
  assert.ok(!line(r.lines, 'trading_positions.strategy "(null)"'));
});

test('LOG-01 — explicit entry/close dates are used when given; otherwise the position legs decide', () => {
  const c = classifyTicket(ticket(1, { positionLegs: [], directionSource: 'card_legs', entryDate: new Date('2026-09-15T14:00:00Z'), closeDate: new Date('2026-10-16T00:00:00Z') }));
  assert.equal(c.entryDate?.toISOString(), '2026-09-15T14:00:00.000Z');
  assert.equal(c.closeDate?.toISOString(), '2026-10-16T00:00:00.000Z');
  const d = classifyTicket(ticket(2));
  assert.equal(d.entryDate?.toISOString(), '2026-08-03T14:00:00.000Z');
});
