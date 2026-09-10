import test from 'node:test';
import assert from 'node:assert/strict';
import { FEED_COST, FEED_IDS, SCAN_COST, scanCostLine } from '../observatory/feedCost';
import { combineWeighted } from '../convergence/weighted-combiner';

// PIPE-01 — two things this file exists to stop:
//   1. a future PR quietly adding a metered call to the scan;
//   2. an absent signal ever being scored as a neutral 50 instead of excluded.

// ─── STEP 3: the scan's per-symbol cost is PINNED ───────────────────────────

test('one scan of one symbol costs exactly this, by provider — a new metered call fails here first', () => {
  const perSymbol = Object.fromEntries(SCAN_COST.map(c => [c.provider, c.callsPerSymbol]));
  const perScan = Object.fromEntries(SCAN_COST.map(c => [c.provider, c.callsPerScan]));

  // Finnhub is the only METERED provider. 26, not the 28 of OBSERVATORY-01:
  // PIPE-01 removed /stock/profile2 (the CIK is now SEC's, free) and the second
  // /stock/fund-ownership (Step I5 reads what Step E6 bought).
  assert.equal(perSymbol.Finnhub, 26, 'raise this ONLY with the call sites that justify it');
  assert.equal(perSymbol.xAI, undefined, 'xAI is not a provider of this product');

  assert.equal(perSymbol.TastyTrade, 1);
  assert.equal(perSymbol.SEC, 6);
  assert.equal(perSymbol.FRED, 0);

  // Per SCAN, not per symbol.
  assert.equal(perScan.FRED, 24);
  assert.equal(perScan.SEC, 1, 'company_tickers.json — one free CIK map for every symbol');

  assert.match(scanCostLine(), /One scan of one symbol = 26 Finnhub, 1 TastyTrade, 6 SEC/);
  assert.doesNotMatch(scanCostLine(), /xAI/);
});

test('every scan-cost note cites the call sites it counted, and no note prices anything', () => {
  for (const c of SCAN_COST) {
    assert.ok(c.note.trim().length > 0, `${c.provider} says how it was counted`);
    assert.doesNotMatch(c.note, /\$[0-9]/, `${c.provider}: counts, never dollars`);
  }
  assert.match(SCAN_COST.find(c => c.provider === 'Finnhub')!.note, /PIPE-01 removed two/);
});

test('one observatory check costs 17 Finnhub calls for 19 Finnhub rows — 19 calls before PIPE-01', () => {
  const finnhubRows = FEED_IDS.filter(id => FEED_COST[id].provider === 'Finnhub');
  const finnhubCalls = finnhubRows.reduce((n, id) => n + FEED_COST[id].upstreamCalls, 0);
  assert.equal(finnhubRows.length, 19, 'nineteen rows read Finnhub');
  assert.equal(finnhubCalls, 17, 'but only seventeen of them buy anything');
  // The two that buy nothing are the duplicates the production run caught: feed
  // 28 read the same /stock/recommendation as feed 7 (identical Buy 64 / Hold 5)
  // and feed 30 the same earnings-quality-score as feed 9 (identical 67.717926).
  assert.deepEqual(finnhubRows.filter(id => FEED_COST[id].upstreamCalls === 0), [28, 30]);

  // And nothing metered is bought outside Finnhub any more.
  const meteredCalls = FEED_IDS
    .filter(id => FEED_COST[id].billable && FEED_COST[id].provider !== 'Finnhub')
    .reduce((n, id) => n + FEED_COST[id].upstreamCalls, 0);
  assert.equal(meteredCalls, 0, 'Finnhub is the only meter left');
});

// ─── STEP 1: dropping a signal RENORMALIZES; it never scores 50 ─────────────

test('dropping an input renormalizes the remaining weights — the absent one is excluded, never scored 50', () => {
  // The shape Info-Edge uses (info-edge.ts:154-158, :1385): weighted components,
  // any of which may be null. This is the same combiner every gate runs through.
  const withExtra = [
    { key: 'msp', weight: 0.40, score: 80 },
    { key: 'form4', weight: 0.30, score: 60 },
    { key: 'dropped', weight: 0.30, score: 20 },
  ];
  const withoutExtra = [
    { key: 'msp', weight: 0.40, score: 80 },
    { key: 'form4', weight: 0.30, score: 60 },
    { key: 'dropped', weight: 0.30, score: null },
  ];

  const before = combineWeighted(withExtra);
  const after = combineWeighted(withoutExtra);

  // Before: (0.40×80 + 0.30×60 + 0.30×20) / 1.00 = 56
  assert.equal(before.score, 56);
  // After: (0.40×80 + 0.30×60) / 0.70 = 71.4 — the SAME two scores over the
  // SAME two weights, divided by their own sum. Nothing was imputed.
  assert.equal(after.score, 71.4);
  assert.equal(after.activeWeight, 0.7);
  assert.deepEqual(after.excludedKeys, ['dropped']);

  // The proof that matters: the result is the renormalized mean of what is
  // present, and it is NOT what a neutral-50 substitution would have given.
  const renormalized = Math.round(((0.40 * 80 + 0.30 * 60) / 0.70) * 10) / 10;
  assert.equal(after.score, renormalized);
  const ifImputedFifty = Math.round((0.40 * 80 + 0.30 * 60 + 0.30 * 50) * 10) / 10;
  assert.equal(ifImputedFifty, 65); // 32 + 18 + 15
  assert.notEqual(after.score, ifImputedFifty, 'a missing input is never scored 50');
});

test('when every input is absent the score is null — an honest nothing, not a middling something', () => {
  const none = combineWeighted([
    { key: 'a', weight: 0.5, score: null },
    { key: 'b', weight: 0.5, score: null },
  ]);
  assert.equal(none.score, null);
  assert.equal(none.activeCount, 0);
  assert.deepEqual(none.excludedKeys, ['a', 'b']);
});
