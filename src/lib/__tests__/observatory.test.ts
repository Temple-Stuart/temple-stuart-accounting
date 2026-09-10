import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// tsconfig sets jsx: "preserve" for Next, so tsx compiles the component's JSX
// with the CLASSIC runtime (React.createElement) — which expects a global React
// that Next's automatic runtime makes unnecessary in the app. Supplying it here
// is a harness detail; the component under test is unchanged.
Object.assign(globalThis, { React });
import {
  EXPECTED_FEED_COUNT, FEED_COST, FEED_IDS, SCAN_COST, FeedCostLawError,
  callsMade, callsMadeLine, feedCostLaw, scanCostLine,
} from '../observatory/feedCost';
import DataObservatory from '@/components/data-observatory/DataObservatory';

// OBSERVATORY-01 — the observatory measures or says nothing, and every feed
// carries its cost. These pin the two halves: the cost facts are complete and
// count-only, and the screen renders nothing it did not measure.

test('every one of the 32 feeds carries provider, metered, calls and scan use — and the law holds on the real map', () => {
  assert.deepEqual(feedCostLaw({ throwOnFail: false }), []);
  assert.equal(FEED_IDS.length, EXPECTED_FEED_COUNT);
  assert.equal(EXPECTED_FEED_COUNT, 32);
  // PIPE-01: 22 is ABSENT, not renumbered — every historical health-log row
  // keeps meaning what it meant.
  assert.equal(FEED_IDS.includes(22), false, 'feed 22 (xAI/Grok) is gone with the provider');
  assert.deepEqual(FEED_IDS, Array.from({ length: 33 }, (_, i) => i + 1).filter(i => i !== 22));
  for (const id of FEED_IDS) {
    const c = FEED_COST[id];
    assert.ok(c.basis.trim().length > 0, `feed ${id} states its basis`);
    assert.ok(c.scanCitation.trim().length > 0, `feed ${id} cites the scan`);
    // PIPE-01: a metered row makes a call of its own, UNLESS it reads a payload
    // another feed already bought (28 reads 7, 30 reads 9) and says so.
    if (c.billable && c.upstreamCalls === 0) {
      assert.match(c.basis, /PIPE-01: reads the/, `feed ${id}: metered with no call must say whose payload it reads`);
    }
  }
  // PIPE-01: Finnhub is the ONLY metered provider left. SEC and FRED are public
  // APIs, TastyTrade is a brokerage session, and xAI is gone.
  const billableProviders = new Set(FEED_IDS.filter(id => FEED_COST[id].billable).map(id => FEED_COST[id].provider));
  assert.deepEqual([...billableProviders].sort(), ['Finnhub']);
});

test('the law rejects: a missing feed, a billable feed that calls nothing, an unmetered Finnhub call, a basis-less row', () => {
  const without = { ...FEED_COST };
  delete (without as Record<number, unknown>)[9];
  assert.match(feedCostLaw({ throwOnFail: false, cost: without, ids: FEED_IDS.filter(i => i !== 9) }).join('\n'), /feed 9 has no cost row/);

  // A metered row with no call of its own must say whose payload it reads.
  const unexplainedZero = { ...FEED_COST, 3: { ...FEED_COST[3], upstreamCalls: 0 } };
  assert.match(feedCostLaw({ throwOnFail: false, cost: unexplainedZero }).join('\n'),
    /feed 3: metered with no call of its own and no basis saying whose payload it reads/);
  // …and feeds 28 and 30 legitimately do: they read what 7 and 9 bought.
  assert.equal(FEED_COST[28].upstreamCalls, 0);
  assert.equal(FEED_COST[30].upstreamCalls, 0);
  assert.match(FEED_COST[28].basis, /reads the \/stock\/recommendation payload feed 7 already paid for/);
  assert.match(FEED_COST[30].basis, /reads the \/stock\/earnings-quality-score payload feed 9 already paid for/);

  const unmetered = { ...FEED_COST, 2: { ...FEED_COST[2], billable: false } };
  assert.match(feedCostLaw({ throwOnFail: false, cost: unmetered }).join('\n'), /feed 2: a Finnhub call is metered — billable must be true/);

  const noBasis = { ...FEED_COST, 5: { ...FEED_COST[5], basis: '  ' } };
  assert.match(feedCostLaw({ throwOnFail: false, cost: noBasis }).join('\n'), /feed 5: billable=true with no basis/);

  assert.throws(() => feedCostLaw({ cost: unexplainedZero }), FeedCostLawError);
});

test('a probe that did not run is charged nothing — SKIPPED and MKT-HRS make no call', () => {
  const rows = [
    { id: 2, status: 'LIVE' },       // Finnhub, 1 call
    { id: 3, status: 'BROKEN' },     // Finnhub, still called — BROKEN means it answered badly
    { id: 5, status: 'SKIPPED' },    // no key — no call
    { id: 1, status: 'MKT-HRS' },    // market closed — no call
    { id: 23, status: 'LIVE' },      // TastyTrade, 2 calls
  ];
  const spend = callsMade(rows);
  const finnhub = spend.find(s => s.provider === 'Finnhub');
  assert.equal(finnhub?.calls, 2, 'the two that answered are charged; the skipped one is not');
  assert.equal(finnhub?.billable, true);
  assert.equal(spend.find(s => s.provider === 'TastyTrade')?.calls, 2);
  assert.match(callsMadeLine(spend), /2 Finnhub \(metered\)/);
  assert.match(callsMadeLine(spend), /rate lives in the vendor's invoice/);
  assert.equal(callsMadeLine(callsMade([{ id: 5, status: 'SKIPPED' }])), 'This check made no upstream call.');
});

test('a probe stopped at its OWN guard is charged nothing, even when it reports BROKEN', () => {
  // The five TastyTrade probes return BROKEN "Missing credentials — market is
  // OPEN" BEFORE touching getTastytradeClient (check/route.ts:88 · :663 · :696
  // · :731 · :762). They declare upstreamCalls: 0 on the spot, and that wins
  // over the cost row's 2 — a BROKEN status alone is not evidence of a call.
  const guarded = [1, 23, 24, 31, 32].map(id => ({ id, status: 'BROKEN', upstreamCalls: 0 }));
  assert.equal(callsMade(guarded).find(s => s.provider === 'TastyTrade')?.calls, 0);
  // …while a BROKEN row that does NOT declare one DID call and got a bad answer.
  const answeredBadly = [{ id: 1, status: 'BROKEN' }];
  assert.equal(callsMade(answeredBadly).find(s => s.provider === 'TastyTrade')?.calls, 2);
});

test('the cost lines are COUNTS — no currency symbol, no rate, anywhere in the cost facts', () => {
  const everything = [
    scanCostLine(), callsMadeLine(callsMade([{ id: 2, status: 'LIVE' }])),
    ...SCAN_COST.map(c => c.note),
    ...FEED_IDS.map(id => FEED_COST[id].basis),
    ...FEED_IDS.map(id => FEED_COST[id].scanCitation),
  ].join('\n');
  assert.doesNotMatch(everything, /\$[0-9]/, 'no price is ever printed — the product does not know one');
  assert.doesNotMatch(everything, /\bper (call|token) (rate|price)\b/i);
  assert.match(scanCostLine(), /One scan of one symbol = 26 Finnhub, 1 TastyTrade, 6 SEC/);
  assert.match(scanCostLine(), /once per scan, 1 SEC, 24 FRED/);
});

test('the screen with no results renders the not-measured state and ZERO rows', () => {
  const html = renderToStaticMarkup(createElement(DataObservatory));

  // the not-measured state is there, by its marker and by its words
  assert.match(html, /data-not-measured/);
  assert.match(html, /Not measured yet/);
  assert.match(html, /renders no\s+status, no latency and no value it did not measure/);

  // and NOT ONE row
  assert.equal((html.match(/data-feed-row=/g) ?? []).length, 0, 'no row renders without a measurement');
  assert.doesNotMatch(html, /data-measured-at/, 'no "measured at" header without a measurement');

  // none of the deleted fabrications survive
  assert.ok(!html.includes('xAI'), 'the screen names no provider the product no longer calls');
  for (const lie of ['beta: 1.09', '12ms', 'Returning 1983 data', '2026-03-02', 'Bullish: 0.93', 'CIK: 789019']) {
    assert.ok(!html.includes(lie), `the screen must not print "${lie}" — it measured nothing`);
  }

  // the button that would measure, and the cost of pressing it
  assert.match(html, /data-run-check/);
  assert.match(html, /RUN CHECK/);
  assert.match(html, /data-cost-summary/);
  assert.match(html, /has spent nothing/);
});
