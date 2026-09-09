import test from 'node:test';
import assert from 'node:assert/strict';
import { FLIGHTS_LANES, FlightsLaneError, resolveFlightsLane } from '../flightsLane';

// LAUNCH-01 RETIRE-01 — one flights lane. The resolver is pure over the raw env value.

test('unset or empty FLIGHTS_LANE resolves to liteapi — the default is the one lane', () => {
  assert.equal(resolveFlightsLane(undefined), 'liteapi');
  assert.equal(resolveFlightsLane(''), 'liteapi');
});

test("'liteapi' resolves to liteapi; the lane list holds exactly that one value", () => {
  assert.equal(resolveFlightsLane('liteapi'), 'liteapi');
  assert.deepEqual([...FLIGHTS_LANES], ['liteapi']);
});

test("the retired 'duffel' throws a FlightsLaneError naming the fix — no other value is accepted", () => {
  for (const raw of ['duffel', 'Duffel', 'LITEAPI', 'liteapi ', 'amadeus']) {
    assert.throws(() => resolveFlightsLane(raw), (e: unknown) => {
      assert.ok(e instanceof FlightsLaneError, `${raw}: FlightsLaneError`);
      assert.equal(e.name, 'FlightsLaneError');
      assert.match(e.message, new RegExp(`'${raw}'`));
      assert.match(e.message, /only flights lane is 'liteapi'/);
      assert.match(e.message, /Duffel was retired/);
      return true;
    });
  }
});
