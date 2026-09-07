import test from 'node:test';
import assert from 'node:assert/strict';
import type { InvestmentTransaction, Security } from 'plaid';
import { fingerprintOf, sha256 } from '../arrivals/land';
import { INVESTMENT_TRANSACTION, SECURITY, investmentWrite, landInvestmentsPage, runInvestmentsPage, securityWrite, type InvestmentsDomainDb, type InvestmentsPageInput } from '../arrivals/plaidInvestmentsPage';
import { recordFailedAnswer } from '../arrivals/plaidTransactionsPage';
import { INVESTMENT_CREATE_KEYS, INVESTMENT_DATA_KEYS, SECURITY_CREATE_KEYS, SECURITY_UPDATE_KEYS, UnsupportedInvestmentsWriteError, correctionsSql, createsSql, investmentLinkSql, planInvestmentsWrites, prismaInvestmentsDomain, securitiesSql, securityLinkSql, type Intent } from '../arrivals/prismaInvestmentsDomain';
import { stageFailed, syncEnvelope } from '../plaid/failLoud';
import { onWireError, type WireStamp } from '../plaid/wire';
import { FakeLanding, snapshotClient } from './fakeLanding';

// REBUILD-01 PR-2c — the investments phase lands raw-first. Hermetic: the shared fake store
// (fakeLanding.ts) and a fake domain port that records the parser's per-row intents and what
// the two domain tables would hold; the batching binding is driven over a fake $executeRaw.

type SecUpsert = { where: { securityId: string }; create: Record<string, unknown>; update: Record<string, unknown> };
type InvUpsert = { where: { investment_transaction_id: string }; create: Record<string, unknown>; update: Record<string, unknown> };
type Link = { where: Record<string, unknown>; data: Record<string, unknown> };

class FakeDomain implements InvestmentsDomainDb {
  /** every call, in order — proves securities are written before the investment transactions that reference them */
  calls: string[] = [];
  secUpserts: SecUpsert[] = [];
  secLinks: Link[] = [];
  creates: Array<Record<string, unknown>> = [];
  invUpserts: InvUpsert[] = [];
  invLinks: Link[] = [];
  /** what the two tables would hold */
  secRows = new Map<string, Record<string, unknown>>();
  invRows = new Map<string, Record<string, unknown>>();
  constructor(private throwOn: string | null = null) {}
  securities = {
    upsert: async (args: SecUpsert) => {
      this.calls.push(`securities.upsert ${args.where.securityId}`);
      this.secUpserts.push(args);
      const prev = this.secRows.get(args.where.securityId);
      this.secRows.set(args.where.securityId, prev ? { ...prev, ...args.update } : { ...args.create });
      return {};
    },
    updateMany: async (args: Link) => {
      this.calls.push(`securities.link ${String(args.where.securityId)}`);
      this.secLinks.push(args);
      const row = this.secRows.get(args.where.securityId as string);
      if (row && row.arrival_id === null) row.arrival_id = args.data.arrival_id;
      return {};
    },
  };
  investment_transactions = {
    create: async (args: { data: Record<string, unknown> }) => {
      const id = args.data.investment_transaction_id as string;
      if (this.throwOn === id) throw new Error('Invalid `prisma.investment_transactions.create()` invocation: column "arrival_id" of relation "investment_transactions" does not exist');
      this.calls.push(`investment_transactions.create ${id}`);
      if (this.invRows.has(id)) throw new Error('Unique constraint failed on the fields: (`investment_transaction_id`)');
      this.creates.push(args.data);
      this.invRows.set(id, { ...args.data });
      return {};
    },
    upsert: async (args: InvUpsert) => {
      this.calls.push(`investment_transactions.upsert ${args.where.investment_transaction_id}`);
      this.invUpserts.push(args);
      const prev = this.invRows.get(args.where.investment_transaction_id);
      this.invRows.set(args.where.investment_transaction_id, prev ? { ...prev, ...args.update } : { ...args.create });
      return {};
    },
    updateMany: async (args: Link) => {
      this.calls.push(`investment_transactions.link ${String(args.where.investment_transaction_id)}`);
      this.invLinks.push(args);
      const row = this.invRows.get(args.where.investment_transaction_id as string);
      if (row && row.arrival_id === null) row.arrival_id = args.data.arrival_id;
      return {};
    },
  };
}

const NOW = new Date('2026-09-07T10:00:02Z');
const wire = (json: string) => ({ body: Buffer.from(json, 'utf8'), asked: new Date('2026-09-07T10:00:00Z'), arrived: new Date('2026-09-07T10:00:01Z') });
const sec = (id: string, over: Record<string, unknown> = {}): Security => ({
  security_id: id, isin: null, cusip: null, sedol: null, institution_security_id: null, institution_id: null, proxy_security_id: null,
  name: `Security ${id}`, ticker_symbol: id.toUpperCase(), is_cash_equivalent: false, type: 'equity', close_price: 100.5, close_price_as_of: '2026-09-01',
  iso_currency_code: 'USD', unofficial_currency_code: null, ...over,
} as unknown as Security);
const OPTION = { contract_type: 'call', expiration_date: '2026-12-19', strike_price: 150, underlying_security_ticker: 'AAPL' };
const inv = (id: string, over: Record<string, unknown> = {}): InvestmentTransaction => ({
  investment_transaction_id: id, account_id: 'acc_plaid_1', security_id: 'aapl', date: '2026-09-01', name: `Buy ${id}`, quantity: 10, amount: 1005, price: 100.5, fees: 0.5,
  type: 'buy', subtype: 'buy', iso_currency_code: 'USD', unofficial_currency_code: null, cancel_transaction_id: null, ...over,
} as unknown as InvestmentTransaction);
const pageInput = (over: Partial<InvestmentsPageInput>): InvestmentsPageInput => ({
  page: 1, userId: 'user_1', connection: 'item_abc', accounts: [{ id: 'acc_db_1', accountId: 'acc_plaid_1' }], existing: new Set(),
  wire: wire('{"securities":[],"investment_transactions":[]}'), httpStatus: 200, securities: [], investmentTransactions: [], now: () => NOW, ...over,
});

test('(1) a page of securities + investment transactions lands (bytes, one arrival per object, both resources) and parses from the table', async () => {
  const landing = new FakeLanding();
  const domain = new FakeDomain();
  const body = '{"securities":[{"security_id":"aapl"},{"security_id":"opt1"}],"investment_transactions":[{"investment_transaction_id":"i1"},{"investment_transaction_id":"i2"}],"total_investment_transactions":2}';
  const securities = [sec('aapl'), sec('opt1', { type: 'derivative', option_contract: OPTION })];
  const txns = [inv('i1'), inv('i2', { security_id: 'opt1', quantity: 1, amount: 150, price: 150, type: 'buy', subtype: 'buy to open' })];
  const counts = await landInvestmentsPage(landing, domain, pageInput({ wire: wire(body), securities, investmentTransactions: txns }));
  assert.deepEqual(counts, { landed: 4, already_landed: 0, corrected: 0, synced: 2, skipped: 0, securities: 2 });

  // the wire: one response row, the exact bytes, its sha256, the resource of the ask
  assert.equal(landing.responses.length, 1);
  assert.equal(landing.responses[0].resource, INVESTMENT_TRANSACTION);
  assert.equal(landing.responses[0].http_status, 200);
  assert.equal(landing.responses[0].body.toString('utf8'), body);
  assert.deepEqual(landing.responses[0].body_sha256, sha256(Buffer.from(body)));

  // the arrivals: one per security (their_id = security_id), one per investment transaction (their_id = investment_transaction_id)
  const secRows = landing.rowsOf(SECURITY);
  const invRows = landing.rowsOf(INVESTMENT_TRANSACTION);
  assert.deepEqual(secRows.map((a) => a.row.their_id).sort(), ['aapl', 'opt1']);
  assert.deepEqual(invRows.map((a) => a.row.their_id).sort(), ['i1', 'i2']);
  for (const a of [...secRows, ...invRows]) {
    assert.equal(a.row.provider, 'plaid');
    assert.equal(a.row.their_id_kind, 'provider');
    assert.equal(a.row.connection, 'item_abc');
    assert.equal(a.row.response_id, landing.responses[0].id);
    assert.deepEqual(a.row.redactions, []);
    assert.equal(a.status, 'done');
    assert.deepEqual(a.read, NOW);
  }
  const opt = secRows.find((a) => a.row.their_id === 'opt1')!;
  assert.equal(Buffer.compare(Buffer.from(opt.row.fingerprint), fingerprintOf(securities[1])), 0);

  // the parser: securities first (the FK), every column on create, the option contract mapped, arrival_id set
  assert.deepEqual(domain.calls, ['securities.upsert aapl', 'securities.upsert opt1', 'investment_transactions.create i1', 'investment_transactions.create i2']);
  const optUpsert = domain.secUpserts.find((u) => u.where.securityId === 'opt1')!;
  assert.equal(optUpsert.create.arrival_id, opt.row.id);
  assert.equal(optUpsert.create.name, 'Security opt1');
  assert.equal(optUpsert.create.type, 'derivative');
  assert.equal(optUpsert.create.option_contract_type, 'call');
  assert.equal(optUpsert.create.option_strike_price, 150);
  assert.deepEqual(optUpsert.create.option_expiration_date, new Date('2026-12-19'));
  assert.equal(optUpsert.create.option_underlying_ticker, 'AAPL');
  assert.deepEqual(optUpsert.create.close_price_as_of, new Date('2026-09-01'));
  assert.deepEqual(Object.keys(optUpsert.update).sort(), [...SECURITY_UPDATE_KEYS].sort());
  const plain = domain.secUpserts.find((u) => u.where.securityId === 'aapl')!;
  assert.equal(plain.create.option_contract_type, null);
  assert.equal(plain.create.option_strike_price, null);
  const i2 = domain.creates.find((c) => c.investment_transaction_id === 'i2')!;
  assert.equal(i2.accountId, 'acc_db_1');
  assert.equal(i2.arrival_id, invRows.find((a) => a.row.their_id === 'i2')!.row.id);
  assert.deepEqual(i2.date, new Date('2026-09-01'));
  assert.equal(i2.security_id, 'opt1');
  assert.equal(i2.subtype, 'buy to open');
  assert.equal(i2.cancel_transaction_id, null);
  assert.deepEqual(i2.updatedAt, NOW);
  assert.deepEqual(Object.keys(i2).sort(), [...INVESTMENT_CREATE_KEYS, ...INVESTMENT_DATA_KEYS].sort());
});

test('the parser reads the arrival row, never the HTTP object', async () => {
  const landing = new FakeLanding();
  const domain = new FakeDomain();
  const s = sec('msft', { name: 'As landed' });
  const t = inv('i9', { name: 'As landed' });
  await landInvestmentsPage(landing, domain, pageInput({ securities: [s], investmentTransactions: [t] }));
  (s as { name: string | null }).name = 'Mutated after landing';
  (t as { name: string }).name = 'Mutated after landing';
  assert.equal(domain.secUpserts[0].create.name, 'As landed');
  assert.equal(domain.creates[0].name, 'As landed');
});

test('(2) the same page again → already_landed for every object, zero new rows, linked, not re-parsed', async () => {
  const landing = new FakeLanding();
  const domain = new FakeDomain();
  const securities = [sec('aapl'), sec('opt1', { type: 'derivative', option_contract: OPTION })];
  const txns = [inv('i1'), inv('i2', { security_id: 'opt1' })];
  const p1 = await landInvestmentsPage(landing, domain, pageInput({ page: 1, securities, investmentTransactions: txns }));
  assert.deepEqual(p1, { landed: 4, already_landed: 0, corrected: 0, synced: 2, skipped: 0, securities: 2 });
  const before = landing.arrivals.size;
  const p2 = await landInvestmentsPage(landing, domain, pageInput({ page: 2, securities: securities.map((x) => ({ ...x })), investmentTransactions: txns.map((x) => ({ ...x })) }));
  assert.deepEqual(p2, { landed: 0, already_landed: 4, corrected: 0, synced: 0, skipped: 0, securities: 2 });
  assert.equal(landing.arrivals.size, before, 'zero new rows');
  assert.equal(landing.responses.length, 2, 'the second answer is still evidence of the ask');
  assert.equal(domain.secUpserts.length, 2, 'securities not re-parsed');
  assert.equal(domain.creates.length, 2, 'investment transactions not re-created');
  assert.equal(domain.invUpserts.length, 0);
  assert.equal(domain.secLinks.length, 2);
  assert.equal(domain.invLinks.length, 2);
  assert.equal(domain.invLinks[0].data.arrival_id, landing.rowsFor('i1')[0].row.id, 'linked to the very row the first page landed');
  assert.deepEqual(domain.invLinks[0].where, { investment_transaction_id: 'i1', arrival_id: null });
});

test('(3) a corrected security and a corrected investment transaction → a new arrival each, the domain rows take the latest and the newest arrival_id', async () => {
  const landing = new FakeLanding();
  const domain = new FakeDomain();
  const original = { securities: [sec('aapl', { close_price: 100.5 })], investmentTransactions: [inv('i1', { amount: 1005 })] };
  const p1 = await landInvestmentsPage(landing, domain, pageInput({ page: 1, ...original }));
  assert.deepEqual(p1, { landed: 2, already_landed: 0, corrected: 0, synced: 1, skipped: 0, securities: 1 });
  const firstSec = landing.rowsFor('aapl')[0].row.id;
  const firstInv = landing.rowsFor('i1')[0].row.id;
  // the provider corrects the price and the amount; the domain row for i1 is even "existing" (a correction never takes the skip)
  const corrected = { securities: [sec('aapl', { close_price: 101.25, close_price_as_of: '2026-09-02' })], investmentTransactions: [inv('i1', { amount: 1010, fees: 1 })] };
  const p2 = await landInvestmentsPage(landing, domain, pageInput({ page: 2, existing: new Set(['i1']), ...corrected }));
  assert.deepEqual(p2, { landed: 0, already_landed: 0, corrected: 2, synced: 1, skipped: 0, securities: 1 });
  assert.equal(landing.rowsFor('aapl').length, 2, 'two rows for the security');
  assert.equal(landing.rowsFor('i1').length, 2, 'two rows for the investment transaction');
  const newestSec = landing.rowsFor('aapl').find((r) => r.row.id !== firstSec)!;
  const newestInv = landing.rowsFor('i1').find((r) => r.row.id !== firstInv)!;
  assert.equal(newestSec.status, 'done');
  assert.equal(newestInv.status, 'done');
  assert.equal(domain.secUpserts.length, 2);
  assert.equal(domain.secUpserts[1].update.close_price, 101.25);
  assert.equal(domain.secUpserts[1].update.arrival_id, newestSec.row.id);
  assert.equal(domain.invUpserts.length, 1, 'a correction is an upsert, never a second create');
  assert.equal(domain.creates.length, 1);
  const row = domain.invRows.get('i1')!;
  assert.equal(row.amount, 1010);
  assert.equal(row.fees, 1);
  assert.equal(row.arrival_id, newestInv.row.id, 'arrival_id moved to the newest arrival');
  assert.equal(domain.secRows.get('aapl')!.close_price, 101.25);
  assert.equal(domain.secRows.get('aapl')!.arrival_id, newestSec.row.id);
  // the original content arriving again is still the same thing: already landed, no third row
  const p3 = await landInvestmentsPage(landing, domain, pageInput({ page: 3, ...original }));
  assert.deepEqual(p3, { landed: 0, already_landed: 2, corrected: 0, synced: 0, skipped: 0, securities: 1 });
  assert.equal(landing.rowsFor('aapl').length, 2);
  assert.equal(landing.rowsFor('i1').length, 2);
});

test('(4) an investment transaction whose domain row predates the store is linked and counted skipped — the insert-only skip, never a rewrite; an unknown account writes nothing but the arrival is read', async () => {
  const landing = new FakeLanding();
  const domain = new FakeDomain();
  domain.invRows.set('i1', { investment_transaction_id: 'i1', amount: 999, arrival_id: null });
  const counts = await landInvestmentsPage(landing, domain, pageInput({ existing: new Set(['i1']), investmentTransactions: [inv('i1'), inv('i7', { account_id: 'acc_plaid_unknown' })] }));
  assert.deepEqual(counts, { landed: 2, already_landed: 0, corrected: 0, synced: 1, skipped: 1, securities: 0 });
  assert.equal(domain.creates.length, 0);
  assert.equal(domain.invUpserts.length, 0);
  assert.equal(domain.invLinks.length, 1);
  assert.equal(domain.invRows.get('i1')!.amount, 999, 'not rewritten');
  assert.equal(domain.invRows.get('i1')!.arrival_id, landing.rowsFor('i1')[0].row.id, 'pointed at its arrival');
  assert.equal(landing.rowsFor('i7')[0].status, 'done', 'read — the parser chose to write nothing');
});

test("(5) a parser throw leaves the page's arrivals and response absent (rollback), declares stage 'investments' with the page; earlier pages stay", async () => {
  const landing = new FakeLanding();
  const domain = new FakeDomain('i2');
  const client = snapshotClient(landing);
  const result = await runInvestmentsPage(client, () => ({ landing, domain }), pageInput({ page: 3, securities: [sec('aapl')], investmentTransactions: [inv('i1'), inv('i2')] }));
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.failure.stage, 'investments');
  assert.equal(result.failure.page, 3);
  assert.match(result.failure.error.message ?? '', /does not exist/);
  assert.equal(landing.arrivals.size, 0, "the page's arrivals rolled back");
  assert.equal(landing.responses.length, 0, "the page's response row rolled back");
  const ok = await runInvestmentsPage(client, () => ({ landing, domain: new FakeDomain() }), pageInput({ page: 2, securities: [sec('aapl')], investmentTransactions: [inv('i5')] }));
  assert.equal(ok.ok, true);
  const again = await runInvestmentsPage(client, () => ({ landing, domain }), pageInput({ page: 3, securities: [sec('aapl')], investmentTransactions: [inv('i1'), inv('i2')] }));
  assert.equal(again.ok, false);
  assert.equal(landing.arrivals.size, 2, 'page 2 stays: its security and its transaction');
});

test('(6) a non-2xx investments answer lands as a response row with the investments resource, zero arrivals, and the envelope names the stage', async () => {
  const landing = new FakeLanding();
  const body = Buffer.from('{"error_type":"RATE_LIMIT_EXCEEDED","error_code":"INVESTMENTS_LIMIT","error_message":"slow down","request_id":"r9"}');
  const err = Object.assign(new Error('Request failed with status code 429'), { response: { data: body as unknown, status: 429, config: { wireAsked: new Date('2026-09-07T10:00:00Z') }, wire: undefined as WireStamp | undefined } });
  await assert.rejects(onWireError(err, () => new Date('2026-09-07T10:00:01Z')));
  assert.deepEqual(await recordFailedAnswer(landing, { userId: 'user_1', err, resource: INVESTMENT_TRANSACTION }), { landed: true, status: 429 });
  assert.equal(landing.responses[0].resource, INVESTMENT_TRANSACTION);
  assert.equal(landing.responses[0].http_status, 429);
  assert.equal(Buffer.compare(landing.responses[0].body, body), 0);
  assert.equal(landing.arrivals.size, 0);
  const { status, body: envelope } = syncEnvelope([stageFailed('investments', err, 2)]);
  assert.equal(status, 429);
  assert.match(String(envelope.message), /investments \(page 2\): Plaid: RATE_LIMIT_EXCEEDED \(INVESTMENTS_LIMIT\)/);
  // the transactions phase keeps its resource when none is named
  await recordFailedAnswer(landing, { userId: 'user_1', err });
  assert.equal(landing.responses[1].resource, 'transaction');
});

// ── the batching binding ──

const secIntent = (id: string, arrival: string, over: Record<string, unknown> = {}): Intent => ({ kind: 'security', args: securityWrite({ ...sec(id), ...over } as Parameters<typeof securityWrite>[0], arrival, NOW) });
const createIntent = (id: string, arrival: string, over: Record<string, unknown> = {}): Intent => { const w = investmentWrite(inv(id, over), 'acc_db_1', arrival, NOW); return { kind: 'create', args: { data: { id: w.id, investment_transaction_id: w.investment_transaction_id, accountId: w.accountId, ...w.data } } }; };
const upsertIntent = (id: string, arrival: string, over: Record<string, unknown> = {}): Intent => { const w = investmentWrite(inv(id, over), 'acc_db_1', arrival, NOW); return { kind: 'upsert', args: { where: { investment_transaction_id: id }, create: { id: w.id, investment_transaction_id: w.investment_transaction_id, accountId: w.accountId, ...w.data }, update: w.data } }; };
const linkIntent = (id: string, arrival: string): Intent => ({ kind: 'link', args: { where: { investment_transaction_id: id, arrival_id: null }, data: { arrival_id: arrival } } });
const secLinkIntent = (id: string, arrival: string): Intent => ({ kind: 'securityLink', args: { where: { securityId: id, arrival_id: null }, data: { arrival_id: arrival } } });

test('the plan: one securities row per id (first identity, last values), creates apart from corrections (a created-then-corrected id is one correction), links only for ids the page does not write', () => {
  const plan = planInvestmentsWrites([
    secIntent('aapl', 'arr_s1', { close_price: 100 }),
    secIntent('aapl', 'arr_s2', { close_price: 101 }),
    secLinkIntent('msft', 'arr_s3'),
    secLinkIntent('aapl', 'arr_s9'),
    createIntent('A', 'arr_a'),
    createIntent('B', 'arr_b1'),
    upsertIntent('B', 'arr_b2', { amount: 2000 }),
    linkIntent('C', 'arr_c'),
    linkIntent('A', 'arr_a9'),
    upsertIntent('D', 'arr_d'),
  ]);
  assert.equal(plan.securities.length, 1);
  assert.equal(plan.securities[0].update.close_price, 101, 'the last update wins');
  assert.equal(plan.securities[0].update.arrival_id, 'arr_s2');
  assert.deepEqual(plan.securityLinks, [{ securityId: 'msft', arrivalId: 'arr_s3' }], 'a link for an upserted security is a no-op either way');
  assert.deepEqual(plan.creates.map((r) => r.investment_transaction_id), ['A']);
  assert.deepEqual(plan.upserts.map((r) => r.investment_transaction_id), ['B', 'D']);
  const b = plan.upserts.find((r) => r.investment_transaction_id === 'B')!;
  assert.equal(b.data.amount, 2000);
  assert.equal(b.data.arrival_id, 'arr_b2');
  assert.deepEqual(plan.links, [{ investmentTransactionId: 'C', arrivalId: 'arr_c' }]);
});

test('the SQL: securities INSERT … ON CONFLICT ("securityId") DO UPDATE on the price/option/arrival columns only; a plain INSERT for creates; corrections ON CONFLICT DO UPDATE never touching identity; links WHERE arrival_id IS NULL', () => {
  const plan = planInvestmentsWrites([secIntent('aapl', 'arr_s1'), secLinkIntent('msft', 'arr_s3'), createIntent('A', 'arr_a'), upsertIntent('B', 'arr_b'), linkIntent('C', 'arr_c')]);
  const s = securitiesSql(plan.securities);
  assert.match(s.sql, /^INSERT INTO securities \("id","securityId","isin","cusip","sedol","ticker_symbol","name","type","updatedAt","close_price","close_price_as_of","option_contract_type","option_strike_price","option_expiration_date","option_underlying_ticker","arrival_id"\) VALUES/);
  assert.match(s.sql, /ON CONFLICT \("securityId"\) DO UPDATE SET "close_price" = EXCLUDED\."close_price","close_price_as_of" = EXCLUDED\."close_price_as_of","option_contract_type" = EXCLUDED\."option_contract_type","option_strike_price" = EXCLUDED\."option_strike_price","option_expiration_date" = EXCLUDED\."option_expiration_date","option_underlying_ticker" = EXCLUDED\."option_underlying_ticker","arrival_id" = EXCLUDED\."arrival_id"$/);
  assert.ok(!/"name" = EXCLUDED|"isin" = EXCLUDED|"updatedAt" = EXCLUDED|"id" = EXCLUDED/.test(s.sql), 'create-only columns are never updated (the sync updated prices and options only)');
  assert.equal(s.values.length, SECURITY_CREATE_KEYS.length + SECURITY_UPDATE_KEYS.length);
  assert.match(s.sql, /\?::timestamp,\?::text|\?::timestamp/, 'timestamps are cast');
  const c = createsSql(plan.creates);
  assert.match(c.sql, /^INSERT INTO investment_transactions \("id","investment_transaction_id","accountId","amount","cancel_transaction_id","date","fees","iso_currency_code","name","price","quantity","security_id","subtype","type","unofficial_currency_code","arrival_id","updatedAt"\) VALUES \(/);
  assert.ok(!/ON CONFLICT/.test(c.sql), 'a conflict on a create is the fault the sync raised, never ignored');
  const u = correctionsSql(plan.upserts);
  assert.match(u.sql, /ON CONFLICT \("investment_transaction_id"\) DO UPDATE SET "amount" = EXCLUDED\."amount","cancel_transaction_id" = EXCLUDED\."cancel_transaction_id","date" = EXCLUDED\."date"/);
  assert.match(u.sql, /"arrival_id" = EXCLUDED\."arrival_id","updatedAt" = EXCLUDED\."updatedAt"$/);
  assert.ok(!/"id" = EXCLUDED|"accountId" = EXCLUDED|"investment_transaction_id" = EXCLUDED/.test(u.sql));
  assert.equal(u.values.length, INVESTMENT_CREATE_KEYS.length + INVESTMENT_DATA_KEYS.length);
  assert.match(u.sql, /\?::float8/);
  assert.equal(investmentLinkSql(plan.links).sql, 'UPDATE investment_transactions AS t SET arrival_id = v.arrival_id FROM (VALUES (?, ?)) AS v(investment_transaction_id, arrival_id) WHERE t.investment_transaction_id = v.investment_transaction_id AND t.arrival_id IS NULL');
  assert.equal(securityLinkSql(plan.securityLinks).sql, 'UPDATE securities AS s SET arrival_id = v.arrival_id FROM (VALUES (?, ?)) AS v(security_id, arrival_id) WHERE s."securityId" = v.security_id AND s.arrival_id IS NULL');
});

test('the binding: buffers the parser\'s shapes, replays one statement per kind at finish(), refuses any other shape, an undefined value, or a write after finish', async () => {
  const ran: string[] = [];
  const tx = { $executeRaw: async (q: { sql: string }) => { ran.push(q.sql.slice(0, 30)); return 1; } } as unknown as Parameters<typeof prismaInvestmentsDomain>[0];
  const domain = prismaInvestmentsDomain(tx);
  await domain.securities.upsert(secIntent('aapl', 'arr_s1').args as SecUpsert);
  await domain.securities.updateMany(secLinkIntent('msft', 'arr_s3').args as Link);
  await domain.investment_transactions.create(createIntent('A', 'arr_a').args as { data: Record<string, unknown> });
  await domain.investment_transactions.upsert(upsertIntent('B', 'arr_b').args as InvUpsert);
  await domain.investment_transactions.updateMany(linkIntent('C', 'arr_c').args as Link);
  assert.equal(ran.length, 0, 'buffered');
  assert.deepEqual(domain.stats(), { intents: 5, statements: 0 });
  await domain.finish();
  assert.deepEqual(ran, ['INSERT INTO securities ("id","', 'UPDATE securities AS s SET arr', 'INSERT INTO investment_transac', 'INSERT INTO investment_transac', 'UPDATE investment_transactions'], 'securities before the transactions that reference them');
  assert.deepEqual(domain.stats(), { intents: 5, statements: 5 });
  await assert.rejects(domain.securities.upsert(secIntent('x', 'arr').args as SecUpsert), UnsupportedInvestmentsWriteError, 'a write after finish is refused');

  const fresh = () => prismaInvestmentsDomain(tx);
  await assert.rejects(fresh().securities.upsert({ where: { securityId: 's' }, create: { id: 'x' }, update: {} }), UnsupportedInvestmentsWriteError);
  const bad = createIntent('A', 'arr_a').args as { data: Record<string, unknown> };
  await assert.rejects(fresh().investment_transactions.create({ data: { ...bad.data, bogus: 1 } }), UnsupportedInvestmentsWriteError);
  await assert.rejects(fresh().investment_transactions.create({ data: { ...bad.data, fees: undefined } }), /is undefined/);
  await assert.rejects(fresh().investment_transactions.updateMany({ where: { investment_transaction_id: 'A' }, data: { arrival_id: 'x' } }), UnsupportedInvestmentsWriteError);
  await assert.rejects(fresh().securities.updateMany({ where: { securityId: 's', arrival_id: null }, data: { arrival_id: 'x', name: 'n' } }), UnsupportedInvestmentsWriteError);
  const up = upsertIntent('B', 'arr_b').args as InvUpsert;
  await assert.rejects(fresh().investment_transactions.upsert({ ...up, update: { ...up.update, bogus: 1 } }), UnsupportedInvestmentsWriteError);
});

test('runInvestmentsPage finishes a buffering port inside the page transaction, after the parser', async () => {
  const landing = new FakeLanding();
  const ran: string[] = [];
  let inside = false;
  let ranInside = 0;
  const client = {
    async $transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> { inside = true; try { return await fn({}); } finally { inside = false; } },
  };
  const tx = { $executeRaw: async (q: { sql: string }) => { ran.push(q.sql.slice(0, 22)); if (inside) ranInside += 1; return 1; } } as unknown as Parameters<typeof prismaInvestmentsDomain>[0];
  const result = await runInvestmentsPage(client, () => { const d = prismaInvestmentsDomain(tx); return { landing, domain: d, finish: () => d.finish() }; }, pageInput({ securities: [sec('aapl')], investmentTransactions: [inv('i1'), inv('i2')] }));
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.counts, { landed: 3, already_landed: 0, corrected: 0, synced: 2, skipped: 0, securities: 1 });
  assert.deepEqual(ran, ['INSERT INTO securities', 'INSERT INTO investment'], 'one statement for the security, one for both transactions');
  assert.equal(ranInside, 2, 'both ran inside the transaction');
  assert.equal(landing.rowsFor('i2')[0].status, 'done', 'marked read before the flush, inside the same transaction');
});
