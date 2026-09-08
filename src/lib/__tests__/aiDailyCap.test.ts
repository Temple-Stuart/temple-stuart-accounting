import test from 'node:test';
import assert from 'node:assert/strict';
import { RoutineBudgetError } from '../routineFireBudget';
import { withDailyCap } from '../ai/dailyCap';

// SELL-05 — Time's two AI actions gate on the AI daily cap (AI_ROUTINE_DAILY_CAP), not a tier.
// Hermetic: a fake meter with the real error class.

function meter(cap: number) {
  const counts = new Map<string, number>();
  return {
    counts,
    reserve: async (userId: string) => {
      const n = (counts.get(userId) ?? 0) + 1;
      counts.set(userId, n);
      if (n > cap) throw new RoutineBudgetError(userId, n, cap);
    },
  };
}

test('under the cap the action proceeds; at the cap it is refused with the declared 429 — per user', async () => {
  const m = meter(2);
  assert.equal(await withDailyCap(m.reserve, 'user-a'), null);
  assert.equal(await withDailyCap(m.reserve, 'user-a'), null);
  const refused = await withDailyCap(m.reserve, 'user-a');
  assert.deepEqual(refused, { status: 429, body: { error: 'Routine daily limit reached — 3/2 runs used today', kind: 'daily_cap', used: 3, cap: 2 } });
  assert.equal(await withDailyCap(m.reserve, 'user-b'), null, "another user's day is their own");
  assert.deepEqual([...m.counts.entries()], [['user-a', 3], ['user-b', 1]]);
});

test('a fault in the meter is not a refusal — it is rethrown', async () => {
  await assert.rejects(() => withDailyCap(async () => { throw new Error('db down'); }, 'u'), /db down/);
});
