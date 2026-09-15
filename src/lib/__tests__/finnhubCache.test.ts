import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  canonicalParams, finnhubCached, finnhubDirect, finnhubErrorLine, finnhubKeyOf, finnhubUrl, formatAge,
  withFinnhubMeter, type FinnhubCacheRow, type FinnhubCacheStore, type FinnhubPorts,
} from '../convergence/finnhub-cache';
import { FINNHUB_TTL, TTL_24H, TTL_7D, finnhubCallsPerSymbol, finnhubTtlLaw, slowTierEndpoints, ttlRowOf } from '../convergence/finnhub-ttl';
import { SCAN_COST, scanCostLine } from '../observatory/feedCost';

// TRADE-COST-01 — slow data is fetched once. Hermetic: the store, fetch and
// the clock are ports (Claude Code cannot reach Azure — CLAUDE.md); the vendor
// is a spy that must stay un-invoked when a row serves.

const ROOT = resolve(__dirname, '../../..');
const src = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');
const code = (p: string) => src(p).split('\n').filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l)).join('\n');

function memoryStore(): FinnhubCacheStore & { rows: Map<string, FinnhubCacheRow>; puts: number } {
  const rows = new Map<string, FinnhubCacheRow>();
  const key = (s: string, e: string, h: string) => `${s}|${e}|${h}`;
  return {
    rows, puts: 0,
    async get(s, e, h) { return rows.get(key(s, e, h)) ?? null; },
    async put(row) { this.puts += 1; rows.set(key(row.symbol, row.endpoint, row.paramsHash), row); },
  };
}

function vendor(answers: Array<{ status: number; body: unknown } | Error>) {
  const calls: string[] = [];
  const fetchImpl = async (url: string): Promise<Response> => {
    calls.push(url);
    const next = answers.shift();
    if (!next) throw new Error(`vendor spy: unexpected call ${url}`);
    if (next instanceof Error) throw next;
    return new Response(JSON.stringify(next.body), { status: next.status, headers: { 'content-type': 'application/json' } });
  };
  return { calls, fetchImpl };
}

const clock = (iso: string) => { let t = new Date(iso).getTime(); return { now: () => new Date(t), advance: (ms: number) => { t += ms; } }; };
const ports = (store: FinnhubCacheStore, fetchImpl: FinnhubPorts['fetch'], now: () => Date): FinnhubPorts => ({ store, fetch: fetchImpl, now });

test('the TTL const is lawful: 7d quarterly, 24h weekly and monthly, 0 daily; 26 cold, 8 warm; every slow-tier row cites its reason', () => {
  assert.deepEqual(finnhubTtlLaw({ throwOnFail: false }), []);
  assert.equal(finnhubCallsPerSymbol('cold'), 26);
  assert.equal(finnhubCallsPerSymbol('warm'), 8);
  assert.equal(slowTierEndpoints().length, 16, 'six quarterly, six weekly, four monthly (18 calls: stock/financials is three)');
  assert.equal(ttlRowOf('stock/financials').ttlMs, TTL_7D);
  assert.equal(ttlRowOf('stock/eps-estimate').ttlMs, TTL_24H);
  assert.equal(ttlRowOf('stock/ownership').ttlMs, TTL_24H);
  assert.equal(ttlRowOf('stock/metric').ttlMs, 0);
  // the ruled exception: the vendor calls it real-time, so it takes the faster tier
  assert.equal(ttlRowOf('stock/upgrade-downgrade').tier, 'daily');
  assert.match(ttlRowOf('stock/upgrade-downgrade').why, /Real-time/);
  // the ruling assigned calendar/earnings no slow tier — daily until ruled otherwise
  assert.equal(ttlRowOf('calendar/earnings').tier, 'daily');
  assert.throws(() => ttlRowOf('stock/profile2'), /has no tier/);
  for (const r of FINNHUB_TTL) assert.match(r.why, /\S/);
});

test('SCAN_COST reads the census: Finnhub 26 cold / 8 warm, the line prints both, and the old pins still hold', () => {
  const finnhub = SCAN_COST.find((c) => c.provider === 'Finnhub')!;
  assert.equal(finnhub.callsPerSymbol, 26);
  assert.equal(finnhub.warmCallsPerSymbol, 8);
  for (const c of SCAN_COST) assert.ok((c.warmCallsPerSymbol ?? 0) <= (c.callsPerSymbol ?? 0), `${c.provider} warm ≤ cold`);
  assert.match(scanCostLine(), /One scan of one symbol = 26 Finnhub, 1 TastyTrade, 6 SEC — plus, once per scan, 1 SEC, 23 FRED, 6 Cboe\./);
  assert.match(scanCostLine(), /Warm \(every slow-tier row within its TTL\) = 8 Finnhub, 1 TastyTrade, 6 SEC — plus, once per scan, 1 SEC, 23 FRED\./);
});

test('the key: symbol uppercased, params sorted and token-free, a rolling window keyed relatively; the URL keeps the sent order', () => {
  assert.equal(canonicalParams({ statement: 'bs', freq: 'quarterly', token: 'SECRET' }), 'freq=quarterly&statement=bs');
  assert.equal(finnhubKeyOf('stock/financials', { statement: 'bs', freq: 'quarterly' }), 'stock/financials?freq=quarterly&statement=bs');
  assert.equal(finnhubKeyOf('stock/recommendation', undefined), 'stock/recommendation');
  assert.equal(finnhubUrl('stock/financials', 'AAPL', { statement: 'bs', freq: 'quarterly' }, 'K'), 'https://finnhub.io/api/v1/stock/financials?symbol=AAPL&statement=bs&freq=quarterly&token=K');
  assert.equal(formatAge(6 * 86400e3 + 21 * 3600e3 + 5e3), '6d 21h');
  assert.equal(formatAge(3 * 3600e3 + 10 * 60e3), '3h 10m');
});

test('a hit within TTL makes ZERO upstream calls and carries the ORIGINAL fetched_at', async () => {
  const store = memoryStore();
  const t = clock('2026-09-15T12:00:00Z');
  const v = vendor([{ status: 200, body: { data: [{ period: '2026-06-30', epsAvg: 1.5 }] } }]);
  const p = ports(store, v.fetchImpl, t.now);

  const first = await finnhubCached({ endpoint: 'stock/eps-estimate', symbol: 'aapl', params: { freq: 'quarterly' }, apiKey: 'K', ports: p });
  assert.ok(first.ok);
  assert.equal(first.meta.servedFromCache, false);
  assert.equal(first.meta.fetchedAt, '2026-09-15T12:00:00.000Z');
  assert.equal(v.calls.length, 1);
  assert.match(v.calls[0], /symbol=AAPL&freq=quarterly&token=K$/, 'uppercased on the wire, token last');
  assert.equal(store.puts, 1);

  t.advance(23 * 3600e3); // 23h later — inside the 24h weekly tier
  const second = await finnhubCached({ endpoint: 'stock/eps-estimate', symbol: 'AAPL', params: { freq: 'quarterly' }, apiKey: 'K', ports: p });
  assert.ok(second.ok);
  assert.equal(second.meta.servedFromCache, true);
  assert.equal(second.meta.fetchedAt, '2026-09-15T12:00:00.000Z', 'a hit is dated when it was fetched, not when it was read');
  assert.deepEqual(second.data, first.data);
  assert.equal(v.calls.length, 1, 'the vendor spy stayed un-invoked');
  assert.equal(second.meta.key, 'stock/eps-estimate?freq=quarterly');
});

test('a row past its TTL is a MISS: refetched once, overwritten, fetched_at updated', async () => {
  const store = memoryStore();
  const t = clock('2026-09-01T00:00:00Z');
  const v = vendor([
    { status: 200, body: { financials: [{ period: '2026-06-30', revenue: 1 }] } },
    { status: 200, body: { financials: [{ period: '2026-09-30', revenue: 2 }] } },
  ]);
  const p = ports(store, v.fetchImpl, t.now);
  const req = { endpoint: 'stock/financials', symbol: 'MSFT', params: { statement: 'ic', freq: 'quarterly' }, apiKey: 'K', ports: p };

  const a = await finnhubCached<{ financials: { revenue: number }[] }>(req);
  assert.ok(a.ok);
  t.advance(TTL_7D + 1);
  const b = await finnhubCached<{ financials: { revenue: number }[] }>(req);
  assert.ok(b.ok);
  assert.equal(b.meta.servedFromCache, false);
  assert.equal(b.meta.fetchedAt, new Date(new Date('2026-09-01T00:00:00Z').getTime() + TTL_7D + 1).toISOString());
  assert.equal(b.data.financials[0].revenue, 2, 'the fresh answer, not the stale one');
  assert.equal(v.calls.length, 2, 'exactly one refetch');
  assert.equal(store.rows.size, 1, 'overwritten, not appended');
  assert.equal(store.puts, 2);
});

test('a vendor error on refetch surfaces the STALE ROW\'S AGE and never returns the stale data as fresh', async () => {
  const store = memoryStore();
  const t = clock('2026-09-01T00:00:00Z');
  const v = vendor([
    { status: 200, body: { ownership: [{ name: 'Fund A', share: 10 }] } },
    { status: 429, body: { error: 'API limit reached' } },
    new Error('ECONNRESET'),
  ]);
  const p = ports(store, v.fetchImpl, t.now);
  const req = { endpoint: 'stock/ownership', symbol: 'NFLX', apiKey: 'K', ports: p };

  assert.ok((await finnhubCached(req)).ok);
  t.advance(TTL_24H + 6 * 3600e3 + 5e3); // 1d 6h past the fetch
  const refused = await finnhubCached(req);
  assert.equal(refused.ok, false);
  if (refused.ok) return;
  assert.equal(refused.error, 'HTTP 429');
  assert.equal(refused.status, 429);
  assert.ok(refused.stale, 'the stale row is named');
  assert.equal(refused.stale!.fetchedAt, '2026-09-01T00:00:00.000Z');
  assert.equal(finnhubErrorLine(refused), 'HTTP 429 — a cached row from 2026-09-01T00:00:00.000Z (1d 6h old) was NOT served');
  assert.ok(!('data' in refused), 'no data field on a refusal — the caller cannot fall back');
  assert.equal(refused.meta, null);
  assert.equal(store.rows.size, 1, 'the stale row is kept for the age report, the 429 body is not stored');

  const dropped = await finnhubCached(req);
  assert.equal(dropped.ok, false);
  if (dropped.ok) return;
  assert.equal(dropped.error, 'ECONNRESET');
  assert.equal(dropped.status, null);
  assert.ok(dropped.stale);
  assert.equal(v.calls.length, 3);
});

test('a 2xx vendor-error envelope and an unparseable body are refusals, not rows; a 2xx empty answer IS a row', async () => {
  const store = memoryStore();
  const t = clock('2026-09-01T00:00:00Z');
  const v = vendor([{ status: 200, body: { error: "You don't have access to this resource." } }, { status: 200, body: [] }]);
  const p = ports(store, v.fetchImpl, t.now);
  const refused = await finnhubCached({ endpoint: 'stock/earnings', symbol: 'BAC', apiKey: 'K', ports: p });
  assert.equal(refused.ok, false);
  if (!refused.ok) assert.match(refused.error, /vendor error: You don't have access/);
  assert.equal(store.rows.size, 0);
  const empty = await finnhubCached({ endpoint: 'stock/earnings', symbol: 'BAC', apiKey: 'K', ports: p });
  assert.ok(empty.ok);
  assert.deepEqual(empty.data, []);
  assert.equal(store.rows.size, 1, 'what the vendor said, dated');
});

test('two callers for one key in the same tick share ONE upstream call (Step E6 and Step I5, stock/fund-ownership)', async () => {
  const store = memoryStore();
  const t = clock('2026-09-01T00:00:00Z');
  const v = vendor([{ status: 200, body: { ownership: [{ name: 'A' }] } }]);
  const p = ports(store, v.fetchImpl, t.now);
  const [e6, i5] = await Promise.all([
    finnhubCached({ endpoint: 'stock/fund-ownership', symbol: 'AAPL', apiKey: 'K', ports: p }),
    finnhubCached({ endpoint: 'stock/fund-ownership', symbol: 'AAPL', apiKey: 'K', ports: p }),
  ]);
  assert.ok(e6.ok && i5.ok);
  assert.equal(v.calls.length, 1, 'coalesced in flight');
  assert.equal(store.puts, 1);
});

test('a store that cannot be read is neither hit nor miss: the failure is the answer and NO upstream call is made', async () => {
  const broken: FinnhubCacheStore = { async get() { throw new Error('connection refused'); }, async put() { /* unreachable */ } };
  const v = vendor([]);
  const ans = await finnhubCached({ endpoint: 'stock/earnings', symbol: 'AAPL', apiKey: 'K', ports: ports(broken, v.fetchImpl, () => new Date()) });
  assert.equal(ans.ok, false);
  if (!ans.ok) assert.match(ans.error, /finnhub cache read failed: connection refused/);
  assert.equal(v.calls.length, 0, 'a paid call is not a fallback for a broken store');
});

test('a store that cannot be written returns the paid answer WITH the failure declared — never swallowed, never refetched', async () => {
  const store = memoryStore();
  store.put = async () => { throw new Error('disk full'); };
  const v = vendor([{ status: 200, body: { data: [] } }]);
  const ans = await finnhubCached({ endpoint: 'stock/revenue-estimate', symbol: 'AAPL', params: { freq: 'quarterly' }, apiKey: 'K', ports: ports(store, v.fetchImpl, () => new Date()) });
  assert.ok(ans.ok);
  assert.match(ans.storeError ?? '', /finnhub cache write failed: disk full/);
  assert.equal(v.calls.length, 1);
});

test('the daily tier never touches the store, and each helper refuses the other tier\'s endpoint', async () => {
  const store = memoryStore();
  const v = vendor([{ status: 200, body: { metric: { beta: 1.1 } } }]);
  const p = ports(store, v.fetchImpl, () => new Date('2026-09-01T00:00:00Z'));
  const ans = await finnhubDirect({ endpoint: 'stock/metric', symbol: 'AAPL', params: { metric: 'all' }, apiKey: 'K', ports: p });
  assert.ok(ans.ok);
  assert.equal(ans.meta.servedFromCache, false);
  assert.equal(ans.meta.ttlMs, 0);
  assert.equal(store.rows.size, 0);
  await assert.rejects(() => finnhubCached({ endpoint: 'stock/metric', symbol: 'AAPL', apiKey: 'K', ports: p }), /daily-tier/);
  await assert.rejects(() => finnhubDirect({ endpoint: 'stock/financials', symbol: 'AAPL', apiKey: 'K', ports: p }), /goes through finnhubCached/);
});

test('the meter measures a run: upstream calls and hits, by endpoint — cold then warm', async () => {
  const store = memoryStore();
  const t = clock('2026-09-01T00:00:00Z');
  const v = vendor([{ status: 200, body: [] }, { status: 200, body: { metric: {} } }, { status: 200, body: { metric: {} } }]);
  const p = ports(store, v.fetchImpl, t.now);
  const run = () => Promise.all([
    finnhubCached({ endpoint: 'stock/earnings', symbol: 'AAPL', apiKey: 'K', ports: p }),
    finnhubDirect({ endpoint: 'stock/metric', symbol: 'AAPL', params: { metric: 'all' }, apiKey: 'K', ports: p }),
  ]);
  const cold = await withFinnhubMeter(run);
  assert.deepEqual([cold.meter.upstream, cold.meter.hits], [2, 0]);
  const warm = await withFinnhubMeter(run);
  assert.deepEqual([warm.meter.upstream, warm.meter.hits], [1, 1]);
  assert.deepEqual(warm.meter.byEndpoint['stock/earnings'], { upstream: 0, hits: 1 });
  assert.deepEqual(warm.meter.byEndpoint['stock/metric'], { upstream: 1, hits: 0 });
});

test('without a key nothing is called and nothing is read', async () => {
  const saved = process.env.FINNHUB_API_KEY;
  delete process.env.FINNHUB_API_KEY;
  try {
    const v = vendor([]);
    const store = memoryStore();
    const ans = await finnhubCached({ endpoint: 'stock/earnings', symbol: 'AAPL', ports: ports(store, v.fetchImpl, () => new Date()) });
    assert.equal(ans.ok, false);
    if (!ans.ok) assert.equal(ans.error, 'FINNHUB_API_KEY not configured');
    assert.equal(v.calls.length, 0);
  } finally {
    if (saved !== undefined) process.env.FINNHUB_API_KEY = saved;
  }
});

test('the fetchers build no Finnhub URL of their own and keep no Finnhub Map: every call is the helper\'s', () => {
  const fetchers = code('src/lib/convergence/data-fetchers.ts');
  assert.doesNotMatch(fetchers, /finnhub\.io/, 'no Finnhub URL outside finnhub-cache.ts');
  for (const gone of ['estimateCache', 'quarterlyFinancialsCache', 'insiderTxCache', 'peerTickerCache', 'fundOwnershipRawCache', 'institutionalOwnershipCache', 'revenueBreakdownCache', 'finbertCache', 'earningsQualityCache']) {
    assert.ok(!fetchers.includes(gone), `${gone} is retired`);
  }
  for (const ep of slowTierEndpoints()) {
    assert.ok(fetchers.includes(`endpoint: '${ep}'`), `${ep} is requested through finnhubCached`);
  }
  // the pipeline hands fetched_at to the composite at every assembly site and measures the run
  const pipeline = code('src/lib/convergence/pipeline.ts');
  assert.equal((pipeline.match(/finnhubFetchedAt: finnhubAgeMap\.get\(/g) ?? []).length, 4);
  assert.match(pipeline, /finnhub_calls_made: meter\.upstream/);
  assert.match(pipeline, /withFinnhubMeter\(\(\) => runPipelineMetered\(/);
  // the schema and its migration carry no user column — market data is not user-scoped
  const model = src('prisma/schema.prisma').match(/model finnhub_responses \{[\s\S]*?\n\}/)![0];
  assert.doesNotMatch(model, /userId|user_id/);
  assert.match(model, /@@id\(\[symbol, endpoint, params_hash\]\)/);
  const migration = src('prisma/migrations/20260915000000_trade_cost_01_finnhub_responses/migration.sql');
  assert.match(migration, /PRIMARY KEY \("symbol","endpoint","params_hash"\)/);
  const ddl = migration.split('\n').filter((l) => !l.startsWith('--')).join('\n');
  assert.doesNotMatch(ddl, /user/i, 'the DDL carries no user column');
});
