import test from 'node:test';
import assert from 'node:assert/strict';
import { GOOGLE_CATEGORY_KEYS } from '../categoryKeys';
import { BURST_LINE, CATEGORY_SEARCH_PROVIDER, capRefusal, categorySearch, type CategorySearchDeps } from '../places/categorySearch';

// SELL-05 — category search over its port: a signed-in user + the caps, no tier, no category key.
// Hermetic; the cap errors carry the real classes' names and fields.

const named = (name: string, message: string, extra: Record<string, unknown> = {}) => Object.assign(new Error(message), { name, ...extra });

function harness(over: Partial<CategorySearchDeps> & { fresh?: boolean; cap?: 'daily' | 'monthly' | 'burst' } = {}) {
  const calls = { user: 0, burst: 0, cacheFresh: 0, cached: 0, reserve: 0, search: 0, store: 0 };
  const deps: CategorySearchDeps = {
    findUser: async (email) => { calls.user += 1; return email === 'nobody@x.co' ? null : { id: `id-${email}` }; },
    burst: async () => { calls.burst += 1; if (over.cap === 'burst') throw named('RateLimitError', 'burst', { retryAfterSeconds: 42 }); },
    cacheFresh: async () => { calls.cacheFresh += 1; return over.fresh === true; },
    cached: async () => { calls.cached += 1; return [{ placeId: 'c1', name: 'Café', address: 'Rua 1', rating: 4.5, reviewCount: 120, priceLevel: 2, priceLevelDisplay: '$$', latitude: 38.7, longitude: -9.1 }]; },
    reserveDaily: async () => { calls.reserve += 1; if (over.cap === 'daily') throw named('TravelSearchQuotaError', 'Travel search daily quota exceeded for googleplaces — bill protection active', { provider: 'googleplaces', callCount: 1001, cap: 1000 }); },
    queriesFor: (category) => [`${category} q1`, `${category} q2`],
    search: async () => { calls.search += 1; if (over.cap === 'monthly') throw named('GooglePlacesQuotaError', 'Google Places monthly quota exceeded — bill protection active', { callCount: 5001, cap: 5000 }); return [{ placeId: 'f1', name: 'Bar', address: 'Rua 2', rating: 4.1, reviewCount: 30, priceLevel: 1, priceLevelDisplay: '$', isOpen: true }]; },
    store: async () => { calls.store += 1; },
    ...over,
  };
  return { deps, calls };
}
const body = { category: 'dinner', city: ' Lisbon ', country: 'Portugal' };

test('a guest → 401 and nothing else runs; a signed-in user with no tier and no category key under the caps → 200', async () => {
  const guest = harness();
  assert.deepEqual(await categorySearch(guest.deps, { viewer: null, ip: '1.1.1.1', body }), { status: 401, body: { error: 'Unauthorized' } });
  assert.deepEqual(guest.calls, { user: 0, burst: 0, cacheFresh: 0, cached: 0, reserve: 0, search: 0, store: 0 });

  const h = harness();
  const out = await categorySearch(h.deps, { viewer: 'free@x.co', ip: '1.1.1.1', body });
  assert.equal(out.status, 200);
  assert.deepEqual(out.body, { results: [{ placeId: 'f1', name: 'Bar', address: 'Rua 2', rating: 4.1, reviewCount: 30, priceLevel: 1, priceLevelDisplay: '$', businessStatus: 'OPERATIONAL', location: null }], count: 1, cached: false });
  assert.deepEqual(h.calls, { user: 1, burst: 1, cacheFresh: 1, cached: 0, reserve: 1, search: 1, store: 1 }, 'one daily reservation per uncached search');
  assert.equal(CATEGORY_SEARCH_PROVIDER, 'googleplaces');
  assert.deepEqual(await categorySearch(h.deps, { viewer: 'nobody@x.co', ip: '1.1.1.1', body }), { status: 404, body: { error: 'User not found' } });
});

test('a fresh cache bucket answers with zero Google calls and no reservation', async () => {
  const h = harness({ fresh: true });
  const out = await categorySearch(h.deps, { viewer: 'u@x.co', ip: '1.1.1.1', body });
  assert.equal(out.status, 200);
  assert.deepEqual(out.body, { results: [{ placeId: 'c1', name: 'Café', address: 'Rua 1', rating: 4.5, reviewCount: 120, priceLevel: 2, priceLevelDisplay: '$$', businessStatus: null, location: { lat: 38.7, lng: -9.1 } }], count: 1, cached: true });
  assert.deepEqual(h.calls, { user: 1, burst: 1, cacheFresh: 1, cached: 1, reserve: 0, search: 0, store: 0 });
});

test('over the daily cap → a declared 429 with the cap\'s own line, nothing searched; over the monthly cap → a declared 429, nothing stored; the burst → 429 with Retry-After', async () => {
  const daily = harness({ cap: 'daily' });
  const d = await categorySearch(daily.deps, { viewer: 'u@x.co', ip: '1.1.1.1', body });
  assert.deepEqual(d, { status: 429, body: { error: 'Travel search daily quota exceeded for googleplaces — bill protection active', source: 'google', kind: 'daily_cap', provider: 'googleplaces', used: 1001, cap: 1000 } });
  assert.equal(daily.calls.search, 0);

  const monthly = harness({ cap: 'monthly' });
  const m = await categorySearch(monthly.deps, { viewer: 'u@x.co', ip: '1.1.1.1', body });
  assert.deepEqual(m, { status: 429, body: { error: 'Google Places monthly quota exceeded — bill protection active', source: 'google', kind: 'quota_exceeded', used: 5001, cap: 5000 } });
  assert.equal(monthly.calls.store, 0);

  const burst = harness({ cap: 'burst' });
  const r = await categorySearch(burst.deps, { viewer: 'u@x.co', ip: '1.1.1.1', body });
  assert.deepEqual(r, { status: 429, body: { error: BURST_LINE, kind: 'burst' }, headers: { 'Retry-After': '42' } });
  assert.equal(burst.calls.cacheFresh, 0);

  // a fault is not a refusal — rethrown for the route's fail-closed line
  assert.equal(capRefusal(new Error('boom')), null);
  await assert.rejects(() => categorySearch(harness({ search: async () => { throw new Error('REQUEST_DENIED'); } }).deps, { viewer: 'u@x.co', ip: '1', body }), /REQUEST_DENIED/);
});

test('the input rules: the nine keys only; city and country; radius positive — and they say nothing about any account', async () => {
  const h = harness();
  const at = (b: unknown) => categorySearch(h.deps, { viewer: 'u@x.co', ip: '1', body: b });
  assert.equal((await at({ ...body, category: 'casinos' })).status, 400);
  assert.match(String((await at({ ...body, category: 'casinos' })).body.error), new RegExp(GOOGLE_CATEGORY_KEYS.join(', ')));
  assert.equal((await at({ category: 'dinner', city: 'Lisbon' })).status, 400);
  assert.equal((await at({ ...body, radius: -1 })).status, 400);
  assert.equal((await at(null)).status, 400);
  assert.equal(h.calls.reserve, 0, 'a refused input reserves nothing');
  for (const k of GOOGLE_CATEGORY_KEYS) assert.equal((await at({ ...body, category: k })).status, 200, k);
});
