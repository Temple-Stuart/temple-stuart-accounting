import test from 'node:test';
import assert from 'node:assert/strict';
import { RoutineBudgetError } from '../routineFireBudget';
import { AI_ACCESS_LINE, aiCaps, aiViewer } from '../ai/caps';

// SELL-05b — the former tier routes' gate: a guest → 401; a signed-in user under the caps
// proceeds; over the daily cap → the declared 429; the hourly cap → its 429. Hermetic.

const users: Record<string, { id: string }> = { 'a@x.co': { id: 'u_a' } };
const findUser = async (email: string) => users[email] ?? null;

test('a guest → 401; a cookie naming no user → 404; a signed-in user → the user', async () => {
  assert.deepEqual(await aiViewer(findUser, null), { ok: false, refusal: { status: 401, body: { error: 'Unauthorized' } } });
  assert.deepEqual(await aiViewer(findUser, ''), { ok: false, refusal: { status: 401, body: { error: 'Unauthorized' } } });
  assert.deepEqual(await aiViewer(findUser, 'ghost@x.co'), { ok: false, refusal: { status: 404, body: { error: 'User not found' } } });
  assert.deepEqual(await aiViewer(findUser, 'a@x.co'), { ok: true, user: { id: 'u_a' } });
});

test('under the caps the request may spend; over the daily cap it is refused with the declared 429, per user; the hourly cap answers first', async () => {
  const counts = new Map<string, number>();
  const deps = {
    hourly: async () => null,
    reserveDaily: async (userId: string) => { const n = (counts.get(userId) ?? 0) + 1; counts.set(userId, n); if (n > 2) throw new RoutineBudgetError(userId, n, 2); },
  };
  assert.equal(await aiCaps(deps, 'u_a'), null);
  assert.equal(await aiCaps(deps, 'u_a'), null);
  assert.deepEqual(await aiCaps(deps, 'u_a'), { status: 429, body: { error: 'Routine daily limit reached — 3/2 runs used today', kind: 'daily_cap', used: 3, cap: 2 } });
  assert.equal(await aiCaps(deps, 'u_b'), null, "another user's day");
  const hourly = { ...deps, hourly: async () => ({ status: 429 as const, body: { error: 'AI request limit reached — please wait before trying again.' }, headers: { 'Retry-After': '60' } }) };
  assert.deepEqual(await aiCaps(hourly, 'u_c'), { status: 429, body: { error: 'AI request limit reached — please wait before trying again.' }, headers: { 'Retry-After': '60' } });
  assert.equal(counts.get('u_c'), undefined, 'the hourly refusal reserves no daily budget');
  await assert.rejects(() => aiCaps({ ...deps, reserveDaily: async () => { throw new Error('db down'); } }, 'u_d'), /db down/, 'a meter fault is not a refusal');
  assert.match(AI_ACCESS_LINE, /free with an account/);
});
