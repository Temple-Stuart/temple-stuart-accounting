import test from 'node:test';
import assert from 'node:assert/strict';
import type { Holding, Security } from 'plaid';
import type { Prisma } from '@prisma/client';
import { fingerprintOf, sha256 } from '../arrivals/land';
import {
  HOLDING, HOLDING_DATA_KEYS, asOfDate, holdingTheirId, holdingWrite, landHoldingsPage, runHoldingsPage,
  type HoldingRow, type HoldingsDomainDb, type HoldingsPageInput,
} from '../arrivals/plaidHoldingsPage';
import { PLAID } from '../arrivals/plaidTransactionsPage';
import { SECURITY } from '../arrivals/plaidInvestmentsPage';
import { UnsupportedHoldingsWriteError, holdingsSql, planHoldings, prismaHoldingsDomain } from '../arrivals/prismaHoldingsDomain';
import { latestHoldingsSnapshot, type HoldingsReadDb } from '../arrivals/holdingsSnapshot';
import { stageOk, successLine } from '../plaid/failLoud';
import { kindOf } from '../providers';
import { FakeLanding, snapshotClient } from './fakeLanding';

// REBUILD-01 PR-2d — Plaid holdings land as snapshots. Hermetic: the shared fake store
// (fakeLanding.ts), a fake domain port that records the parser's writes and what the
// holdings table would hold, the batching binding over a fake $executeRaw, and the
// snapshot reader over a fake of the two tables.

const key = (r: { accountId: string; security_id: string; as_of: string }) => `${r.accountId} ${r.security_id} ${r.as_of}`;

class FakeDomain implements HoldingsDomainDb {
  calls: string[] = [];
  secUpserts = 0;
  secLinks = 0;
  upserts: HoldingRow[] = [];
  /** what the holdings table would hold, by (accountId, security_id, as_of) */
  rows = new Map<string, HoldingRow>();
  constructor(private throwOnSecurity: string | null = null) {}
  securities = {
    upsert: async (args: { where: { securityId: string }; create: Record<string, unknown>; update: Record<string, unknown> }) => {
      if (this.throwOnSecurity === args.where.securityId) throw new Error('Invalid `prisma.securities.upsert()` invocation: column "arrival_id" of relation "securities" does not exist');
      this.calls.push(`securities.upsert ${args.where.securityId}`);
      this.secUpserts += 1;
      return {};
    },
    updateMany: async (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      this.calls.push(`securities.link ${String(args.where.securityId)}`);
      this.secLinks += 1;
      return {};
    },
  };
  holdings = {
    upsert: async (row: HoldingRow) => {
      this.calls.push(`holdings.upsert ${key(row)}`);
      this.upserts.push(row);
      const prior = this.rows.get(key(row));
      this.rows.set(key(row), prior ? { ...row, id: prior.id } : row);
      return {};
    },
  };
}

const ASKED = new Date('2026-09-08T14:00:00Z');
const ARRIVED = new Date('2026-09-08T14:00:01Z');
const NOW = new Date('2026-09-08T14:00:02Z');
const wire = (json: string, arrived = ARRIVED) => ({ body: Buffer.from(json, 'utf8'), asked: ASKED, arrived });
const sec = (id: string, over: Record<string, unknown> = {}): Security => ({
  security_id: id, isin: null, cusip: null, sedol: null, institution_security_id: null, institution_id: null, proxy_security_id: null,
  name: `Security ${id}`, ticker_symbol: id.toUpperCase(), is_cash_equivalent: false, type: 'equity', close_price: 100.5, close_price_as_of: '2026-09-05',
  iso_currency_code: 'USD', unofficial_currency_code: null, ...over,
} as unknown as Security);
/** A holding as the SDK types it (plaid 11.0.0 Holding): no id of its own, no secret. */
const hold = (account_id: string, security_id: string, over: Record<string, unknown> = {}): Holding => ({
  account_id, security_id, institution_price: 100.5, institution_price_as_of: '2026-09-05', institution_price_datetime: null,
  institution_value: 1005, cost_basis: 900, quantity: 10, iso_currency_code: 'USD', unofficial_currency_code: null, ...over,
} as unknown as Holding);
const answer = (holdings: Holding[], securities: Security[]) => JSON.stringify({ accounts: [], holdings, securities, item: { item_id: 'item_abc' }, request_id: 'req_1' });
const input = (over: Partial<HoldingsPageInput>): HoldingsPageInput => ({
  userId: 'user_1', connection: 'item_abc', accounts: [{ id: 'acc_db_1', accountId: 'acc_plaid_1' }],
  wire: wire(answer([], [])), httpStatus: 200, securities: [], holdings: [], now: () => NOW, ...over,
});
const withObjects = (holdings: Holding[], securities: Security[], arrived = ARRIVED, over: Partial<HoldingsPageInput> = {}) =>
  input({ wire: wire(answer(holdings, securities), arrived), holdings, securities, ...over });

test('the rule book names the feed (plaid · holding → snapshot); the composed id and the as-of are pure', () => {
  assert.equal(kindOf(PLAID, HOLDING), 'snapshot');
  assert.equal(holdingTheirId({ account_id: 'acc_plaid_1', security_id: 'aapl' }, '2026-09-08'), 'holding:acc_plaid_1:aapl:2026-09-08');
  assert.equal(asOfDate(new Date('2026-09-08T23:59:59Z')), '2026-09-08');
  assert.equal(asOfDate(new Date('2026-09-09T00:00:00Z')), '2026-09-09');
});

test('a holdings answer lands: the wire row (resource holding, exact bytes), the answer\'s securities as reference arrivals, one snapshot arrival per holding with a COMPOSED their_id labeled composed and kind snapshot; one holdings row per holding, from the arrival, pointed at it; read once', async () => {
  const landing = new FakeLanding();
  const dom = new FakeDomain();
  const holdings = [hold('acc_plaid_1', 'aapl'), hold('acc_plaid_1', 'msft', { quantity: 3, institution_value: 900, cost_basis: null })];
  const inp = withObjects(holdings, [sec('aapl'), sec('msft')]);
  const out = await landHoldingsPage(landing, dom, inp);
  assert.equal(out.asOf, '2026-09-08');
  assert.deepEqual(out.counts, { landed: 4, already_landed: 0, corrected: 0, holdings: 2, securities: 2, unmatched: 0 });
  // the wire row
  assert.equal(landing.responses.length, 1);
  const r = landing.responses[0];
  assert.equal(r.provider, PLAID);
  assert.equal(r.resource, HOLDING);
  assert.equal(r.http_status, 200);
  assert.equal(r.body.toString('utf8'), answer(holdings, [sec('aapl'), sec('msft')]));
  assert.deepEqual(r.body_sha256, sha256(inp.wire.body));
  assert.deepEqual(r.redactions, []);
  assert.equal(r.user_id, 'user_1');
  // the arrivals: two securities (provider id, reference), two holdings (composed id, snapshot)
  const secs = landing.rowsOf(SECURITY);
  assert.equal(secs.length, 2);
  assert.ok(secs.every((a) => a.row.their_id_kind === 'provider' && a.row.kind === 'reference' && a.row.connection === 'item_abc'));
  const snaps = landing.rowsOf(HOLDING);
  assert.equal(snaps.length, 2);
  const aapl = landing.rowsFor('holding:acc_plaid_1:aapl:2026-09-08')[0];
  assert.ok(aapl, 'their_id composed from account_id, security_id and the day the answer arrived');
  assert.equal(aapl.row.their_id_kind, 'composed');
  assert.equal(aapl.row.kind, 'snapshot');
  assert.equal(aapl.row.resource, HOLDING);
  assert.deepEqual(aapl.row.payload, holdings[0]);
  assert.equal(Buffer.compare(Buffer.from(aapl.row.fingerprint), fingerprintOf(holdings[0])), 0);
  assert.equal(aapl.row.response_id, r.id);
  assert.equal(aapl.status, 'done');
  assert.deepEqual(aapl.read, NOW);
  // the domain: securities first, then the holdings rows from the arrivals, each pointed at its arrival
  assert.deepEqual(dom.calls, ['securities.upsert aapl', 'securities.upsert msft', 'holdings.upsert acc_db_1 aapl 2026-09-08', 'holdings.upsert acc_db_1 msft 2026-09-08']);
  assert.equal(dom.rows.size, 2);
  const row = dom.rows.get('acc_db_1 aapl 2026-09-08')!;
  assert.equal(row.data.arrival_id, aapl.row.id);
  assert.equal(row.accountId, 'acc_db_1');
  assert.equal(row.security_id, 'aapl');
  assert.equal(row.as_of, '2026-09-08');
  assert.deepEqual(row.data, { quantity: 10, cost_basis: 900, institution_price: 100.5, institution_price_as_of: '2026-09-05', institution_price_datetime: null, institution_value: 1005, iso_currency_code: 'USD', unofficial_currency_code: null, arrival_id: aapl.row.id, updatedAt: NOW });
  assert.match(row.id, /^hold_/);
  const msft = dom.rows.get('acc_db_1 msft 2026-09-08')!;
  assert.equal(msft.data.cost_basis, null, 'absent stays null, never invented');
  assert.equal(msft.data.quantity, 3);
});

test('the same snapshot again (the same day, the same content) is already_landed: a second wire row, no second arrival, nothing written — the row already points at that arrival', async () => {
  const landing = new FakeLanding();
  const dom = new FakeDomain();
  const holdings = [hold('acc_plaid_1', 'aapl')];
  await landHoldingsPage(landing, dom, withObjects(holdings, [sec('aapl')]));
  const again = await landHoldingsPage(landing, dom, withObjects(holdings, [sec('aapl')], new Date('2026-09-08T20:00:00Z')));
  assert.deepEqual(again.counts, { landed: 0, already_landed: 2, corrected: 0, holdings: 0, securities: 1, unmatched: 0 });
  assert.equal(landing.responses.length, 2, 'every answer is its own wire row');
  assert.equal(landing.rowsOf(HOLDING).length, 1, 'the same thing is the same provider, id and content');
  assert.equal(dom.upserts.length, 1, 'no second write');
  assert.equal(dom.secLinks, 1, 'the already-landed security is linked, never re-parsed');
  assert.equal(dom.rows.size, 1);
});

test('a new as-of (the answer arrived the next day) lands a new arrival and a NEW row — yesterday\'s snapshot is never rewritten', async () => {
  const landing = new FakeLanding();
  const dom = new FakeDomain();
  const holdings = [hold('acc_plaid_1', 'aapl')];
  const first = await landHoldingsPage(landing, dom, withObjects(holdings, [sec('aapl')]));
  const next = await landHoldingsPage(landing, dom, withObjects(holdings, [sec('aapl')], new Date('2026-09-09T14:00:01Z')));
  assert.equal(first.asOf, '2026-09-08');
  assert.equal(next.asOf, '2026-09-09');
  assert.deepEqual(next.counts, { landed: 1, already_landed: 1, corrected: 0, holdings: 1, securities: 1, unmatched: 0 });
  assert.ok(landing.rowsFor('holding:acc_plaid_1:aapl:2026-09-09')[0], 'a new composed key');
  assert.equal(dom.rows.size, 2, 'two snapshots of the position');
  assert.notEqual(dom.rows.get('acc_db_1 aapl 2026-09-08')!.data.arrival_id, dom.rows.get('acc_db_1 aapl 2026-09-09')!.data.arrival_id);
});

test('the same day, the position moved (a new content for the same composed key): corrected — a new arrival, the row takes the latest and its arrival_id moves; the earlier arrival stays', async () => {
  const landing = new FakeLanding();
  const dom = new FakeDomain();
  const first = await landHoldingsPage(landing, dom, withObjects([hold('acc_plaid_1', 'aapl')], [sec('aapl')]));
  const moved = await landHoldingsPage(landing, dom, withObjects([hold('acc_plaid_1', 'aapl', { quantity: 12, institution_value: 1206 })], [sec('aapl')], new Date('2026-09-08T21:00:00Z')));
  assert.deepEqual(moved.counts, { landed: 0, already_landed: 1, corrected: 1, holdings: 1, securities: 1, unmatched: 0 });
  const arrivals = landing.rowsFor('holding:acc_plaid_1:aapl:2026-09-08');
  assert.equal(arrivals.length, 2, 'a correction is a new row (promise 1)');
  assert.ok(arrivals.every((a) => a.status === 'done'));
  assert.equal(dom.rows.size, 1, 'one snapshot per moment');
  const row = dom.rows.get('acc_db_1 aapl 2026-09-08')!;
  assert.equal(row.data.quantity, 12);
  assert.equal(row.id, dom.upserts[0].id, 'the row keeps its identity');
  assert.notEqual(row.data.arrival_id, dom.upserts[0].data.arrival_id, 'arrival_id moved to the newest arrival');
  assert.equal(first.counts.holdings, 1);
});

test('a holding whose account is none of the item\'s accounts is landed and read but writes no row — counted as unmatched, declared', async () => {
  const landing = new FakeLanding();
  const dom = new FakeDomain();
  const out = await landHoldingsPage(landing, dom, withObjects([hold('acc_plaid_9', 'aapl')], [sec('aapl')]));
  assert.deepEqual(out.counts, { landed: 2, already_landed: 0, corrected: 0, holdings: 0, securities: 1, unmatched: 1 });
  const a = landing.rowsFor('holding:acc_plaid_9:aapl:2026-09-08')[0];
  assert.equal(a.status, 'done');
  assert.equal(dom.rows.size, 0);
});

test('a parser throw rolls the whole answer back and comes out as the declared failure (stage holdings): no wire row, no arrival, no row', async () => {
  const landing = new FakeLanding();
  const dom = new FakeDomain('aapl');
  let rolledBack = 0;
  const result = await runHoldingsPage(snapshotClient(landing, () => { rolledBack += 1; }), () => ({ landing, domain: dom }), withObjects([hold('acc_plaid_1', 'aapl')], [sec('aapl')]));
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.failure.stage, 'holdings');
  assert.equal(result.failure.page, undefined, 'one answer, no pages');
  assert.match(result.failure.error.message ?? '', /securities\.upsert/);
  assert.equal(rolledBack, 1);
  assert.equal(landing.responses.length, 0);
  assert.equal(landing.arrivals.size, 0);
  assert.equal(dom.rows.size, 0);
  // and the ok shape carries the counts and the moment
  const ok = await runHoldingsPage(snapshotClient(landing), () => ({ landing, domain: new FakeDomain() }), withObjects([hold('acc_plaid_1', 'aapl')], [sec('aapl')]));
  assert.equal(ok.ok, true);
  if (ok.ok) { assert.equal(ok.asOf, '2026-09-08'); assert.equal(ok.counts.holdings, 1); }
});

test('holdingWrite maps every SDK field to a column — null, never undefined; the batching binding replays one statement per kind, refuses a malformed row and a write after finish', async () => {
  const w = holdingWrite(hold('acc_plaid_1', 'aapl', { institution_price_as_of: null, iso_currency_code: null, unofficial_currency_code: 'BTC' }), 'acc_db_1', '2026-09-08', 'arr_1', NOW);
  for (const k of HOLDING_DATA_KEYS) assert.notEqual(w.data[k], undefined, `${k} present`);
  assert.equal(w.data.institution_price_as_of, null);
  assert.equal(w.data.unofficial_currency_code, 'BTC');
  // the plan: one row per key — the first id, the last values
  const a = holdingWrite(hold('acc_plaid_1', 'aapl'), 'acc_db_1', '2026-09-08', 'arr_1', NOW);
  const b = holdingWrite(hold('acc_plaid_1', 'aapl', { quantity: 11 }), 'acc_db_1', '2026-09-08', 'arr_2', NOW);
  const c = holdingWrite(hold('acc_plaid_1', 'msft'), 'acc_db_1', '2026-09-08', 'arr_3', NOW);
  const plan = planHoldings([a, b, c]);
  assert.equal(plan.length, 2);
  assert.equal(plan[0].id, a.id);
  assert.equal(plan[0].data.quantity, 11);
  assert.equal(plan[0].data.arrival_id, 'arr_2');
  // the SQL: one INSERT … ON CONFLICT on the snapshot key, the dates cast, the values bound
  const sql = holdingsSql(plan);
  assert.match(sql.sql, /^INSERT INTO holdings \("id","accountId","security_id","as_of","quantity","cost_basis","institution_price","institution_price_as_of","institution_price_datetime","institution_value","iso_currency_code","unofficial_currency_code","arrival_id","updatedAt"\) VALUES /);
  assert.match(sql.sql, /ON CONFLICT \("accountId", security_id, as_of\) DO UPDATE SET "quantity" = EXCLUDED\."quantity"/);
  assert.match(sql.sql, /VALUES \(\?,\?,\?,\?::date,\?::float8,\?::float8,\?::float8,\?::date,\?::timestamp,\?::float8,\?,\?,\?,\?::timestamp\)/, 'the dates and floats cast, every value bound');
  assert.equal(sql.values[3], '2026-09-08');
  assert.equal(sql.values.length, 2 * 14);
  // the binding over a fake executor: securities first, then holdings — one statement each
  const ran: string[] = [];
  const dom = prismaHoldingsDomain({ $executeRaw: async (q: Prisma.Sql) => { ran.push(q.sql.slice(0, 30)); return 1; } });
  await dom.securities.upsert({ where: { securityId: 'aapl' }, create: { id: 'sec_1', securityId: 'aapl', isin: null, cusip: null, sedol: null, ticker_symbol: 'AAPL', name: 'Apple', type: 'equity', updatedAt: NOW, close_price: 1, close_price_as_of: null, option_contract_type: null, option_strike_price: null, option_expiration_date: null, option_underlying_ticker: null, arrival_id: 'arr_s' }, update: { close_price: 1, close_price_as_of: null, option_contract_type: null, option_strike_price: null, option_expiration_date: null, option_underlying_ticker: null, arrival_id: 'arr_s' } });
  await dom.holdings.upsert(a);
  await dom.holdings.upsert(b);
  await dom.finish();
  assert.deepEqual(ran.map((s) => s.split(' ').slice(0, 3).join(' ')), ['INSERT INTO securities', 'INSERT INTO holdings']);
  assert.deepEqual(dom.stats(), { intents: 3, statements: 2 });
  await assert.rejects(dom.holdings.upsert(c), UnsupportedHoldingsWriteError);
  const bad = prismaHoldingsDomain({ $executeRaw: async () => 1 });
  await assert.rejects(bad.holdings.upsert({ ...a, as_of: '2026/09/08' }), /as_of must be YYYY-MM-DD/);
  await assert.rejects(bad.holdings.upsert({ ...a, data: { ...a.data, quantity: undefined as unknown as number } }), /quantity is undefined/);
  const { arrival_id: _dropped, ...missing } = a.data;
  void _dropped;
  await assert.rejects(bad.holdings.upsert({ ...a, data: missing as HoldingRow['data'] }), /must carry exactly/);
});

test('the stored snapshot, read: each account\'s latest moment and every row of it (a position sold since an older day is not shown), Plaid field names, the securities named; nothing stored is declared as as_of null', async () => {
  const d = (s: string) => new Date(`${s}T00:00:00Z`);
  const stored = [
    { id: 'h1', accountId: 'acc_db_1', security_id: 'aapl', as_of: d('2026-09-07'), quantity: 10, cost_basis: 900, institution_price: 100, institution_price_as_of: d('2026-09-05'), institution_price_datetime: null, institution_value: 1000, iso_currency_code: 'USD', unofficial_currency_code: null, arrival_id: 'arr_1', createdAt: new Date('2026-09-07T14:00:00Z'), updatedAt: NOW },
    { id: 'h2', accountId: 'acc_db_1', security_id: 'msft', as_of: d('2026-09-07'), quantity: 3, cost_basis: null, institution_price: 300, institution_price_as_of: null, institution_price_datetime: new Date('2026-09-07T20:00:00Z'), institution_value: 900, iso_currency_code: 'USD', unofficial_currency_code: null, arrival_id: 'arr_2', createdAt: new Date('2026-09-07T14:00:00Z'), updatedAt: NOW },
    { id: 'h3', accountId: 'acc_db_1', security_id: 'aapl', as_of: d('2026-09-08'), quantity: 12, cost_basis: 1100, institution_price: 101, institution_price_as_of: d('2026-09-08'), institution_price_datetime: null, institution_value: 1212, iso_currency_code: 'USD', unofficial_currency_code: null, arrival_id: 'arr_3', createdAt: new Date('2026-09-08T14:00:00Z'), updatedAt: NOW },
    { id: 'h4', accountId: 'acc_db_2', security_id: 'btc', as_of: d('2026-09-06'), quantity: 0.5, cost_basis: 20000, institution_price: 60000, institution_price_as_of: null, institution_price_datetime: null, institution_value: 30000, iso_currency_code: null, unofficial_currency_code: 'BTC', arrival_id: 'arr_4', createdAt: new Date('2026-09-06T14:00:00Z'), updatedAt: NOW },
  ];
  const asked: unknown[] = [];
  const db = {
    holdings: { findMany: async (args: unknown) => { asked.push(args); return [...stored].sort((x, y) => y.as_of.getTime() - x.as_of.getTime()); } },
    securities: { findMany: async (args: { where: { securityId: { in: string[] } } }) => args.where.securityId.in.map((id) => ({ id: `sec_${id}`, securityId: id, isin: null, cusip: null, sedol: null, ticker_symbol: id.toUpperCase(), name: `Security ${id}`, type: 'equity', close_price: 1, close_price_as_of: d('2026-09-08'), option_contract_type: null, option_strike_price: null, option_expiration_date: null, option_underlying_ticker: null, createdAt: NOW, updatedAt: NOW, arrival_id: null })) },
  } as unknown as HoldingsReadDb;
  const snap = await latestHoldingsSnapshot(db, [{ id: 'acc_db_1', accountId: 'acc_plaid_1' }, { id: 'acc_db_2', accountId: 'acc_plaid_2' }]);
  assert.equal(snap.as_of, '2026-09-08');
  assert.deepEqual(snap.holdings.map((h) => [h.account_id, h.security_id, h.as_of, h.quantity]), [['acc_plaid_1', 'aapl', '2026-09-08', 12], ['acc_plaid_2', 'btc', '2026-09-06', 0.5]], 'msft (sold since 09-07) is not shown as held; each account at its own latest moment');
  assert.deepEqual(snap.holdings[0], { account_id: 'acc_plaid_1', security_id: 'aapl', quantity: 12, cost_basis: 1100, institution_price: 101, institution_price_as_of: '2026-09-08', institution_price_datetime: null, institution_value: 1212, iso_currency_code: 'USD', unofficial_currency_code: null, as_of: '2026-09-08', arrival_id: 'arr_3' });
  assert.deepEqual(snap.securities.map((s) => s.security_id).sort(), ['aapl', 'btc']);
  assert.deepEqual(snap.securities.find((s) => s.security_id === 'aapl'), { security_id: 'aapl', name: 'Security aapl', ticker_symbol: 'AAPL', type: 'equity', isin: null, cusip: null, sedol: null, close_price: 1, close_price_as_of: '2026-09-08' });
  assert.deepEqual((asked[0] as { where: unknown }).where, { accountId: { in: ['acc_db_1', 'acc_db_2'] } }, 'scoped to the accounts given');
  const none = await latestHoldingsSnapshot({ holdings: { findMany: async () => [] }, securities: { findMany: async () => [] } } as unknown as HoldingsReadDb, [{ id: 'acc_db_1', accountId: 'acc_plaid_1' }]);
  assert.deepEqual(none, { as_of: null, holdings: [], securities: [] }, 'nothing stored yet is declared, never dressed as an empty portfolio');
  assert.deepEqual(await latestHoldingsSnapshot(db, []), { as_of: null, holdings: [], securities: [] });
});

test('the banner counts holdings written this run, after the securities; a run that wrote none says nothing about them', () => {
  const items = [{ institution: 'Robinhood', stages: [stageOk('transactions', { synced: 3, skipped: 0, landed: 3, already_landed: 0, corrected: 0 }), stageOk('investments', { synced: 7, skipped: 0, securities: 2 }), stageOk('holdings', { landed: 14, already_landed: 0, corrected: 0, holdings: 12, securities: 12, unmatched: 0 })] }];
  assert.equal(successLine(items), 'Robinhood synced: 3 landed, 7 investment transactions, 2 securities, 12 holdings');
  const quiet = [{ institution: 'Robinhood', stages: [stageOk('transactions', { synced: 0, skipped: 0, landed: 0, already_landed: 3, corrected: 0 }), stageOk('holdings', { landed: 0, already_landed: 14, corrected: 0, holdings: 0, securities: 12, unmatched: 0 })] }];
  assert.equal(successLine(quiet), 'Robinhood synced: 0 landed, 3 already landed');
});
