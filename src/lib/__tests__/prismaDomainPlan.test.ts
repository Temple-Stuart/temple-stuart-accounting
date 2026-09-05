import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DATA_KEYS,
  UnsupportedDomainWriteError,
  deleteByIdSql,
  deleteSql,
  groupByColumns,
  linkSql,
  planDomainWrites,
  prismaDomain,
  upsertSql,
  type Intent,
} from '../arrivals/prismaDomain';
import { runTransactionsPage, type PagePorts } from '../arrivals/plaidTransactionsPage';
import type { ArrivalRow, LandedArrival, LandingDb } from '../arrivals/land';

// PERF-01 — the batching binding replays the parser's per-row intents as one statement per
// kind with the sequential order's exact result. The parser and its per-row port are untouched
// (arrivalsLand.test.ts proves them); these tests prove the replay plan and the SQL shapes.

const NOW = new Date('2026-09-05T12:00:00.000Z');
const d = (day: string) => new Date(`2026-06-${day}T00:00:00.000Z`);

function data(over: Record<string, unknown> = {}) {
  return {
    amount: 10, date: d('10'), name: 'Coffee', merchantName: 'Cafe', category: 'Food and Drink, Coffee', pending: false,
    authorized_date: null, authorized_datetime: null, counterparties: [{ name: 'X' }], location: { city: 'Austin' },
    payment_channel: 'in store', payment_meta: { reference_number: null }, personal_finance_category: { primary: 'FOOD_AND_DRINK' },
    personal_finance_category_icon_url: null, transaction_code: null, transaction_type: 'place', logo_url: null, website: null,
    arrival_id: 'arr_1', updatedAt: NOW, ...over,
  };
}
type UpsertI = Extract<Intent, { kind: 'upsert' }>;
type LinkI = Extract<Intent, { kind: 'link' }>;
type DeleteI = Extract<Intent, { kind: 'delete' }>;
function upsert(transactionId: string, accountId: string, over: Record<string, unknown> = {}, id = `txn_${transactionId}`): UpsertI {
  const dd = data(over);
  return { kind: 'upsert', args: { where: { transactionId }, create: { id, transactionId, accountId, ...dd }, update: dd } };
}
function link(transactionId: string, arrivalId: string): LinkI {
  return { kind: 'link', args: { where: { transactionId, arrival_id: null }, data: { arrival_id: arrivalId } } };
}
function del(accountId: string, amount: number, day: string, notTransactionId: string): DeleteI {
  const gte = d(day); gte.setDate(gte.getDate() - 2);
  const lte = d(day); lte.setDate(lte.getDate() + 2);
  return { kind: 'delete', args: { where: { accountId, amount, pending: true, date: { gte, lte }, transactionId: { not: notTransactionId } } } };
}

test('the plan: one upsert per id (first create, last data), links only for ids the page does not upsert, every delete rule kept', () => {
  const plan = planDomainWrites([
    upsert('t1', 'acc_1', { amount: 1 }, 'txn_first'),
    del('acc_1', 1, '10', 't1'),
    link('t2', 'arr_2'),
    link('t2', 'arr_2b'),
    link('t1', 'arr_9'),
    upsert('t1', 'acc_1', { amount: 2, name: 'Coffee (corrected)', arrival_id: 'arr_1b' }, 'txn_second'),
    del('acc_1', 2, '10', 't1'),
    upsert('t3', 'acc_2', { pending: true }),
  ]);
  assert.deepEqual(plan.pageIds, ['t1', 't3']);
  assert.equal(plan.upserts.length, 2);
  const t1 = plan.upserts[0];
  assert.equal(t1.id, 'txn_first', 'the FIRST upsert creates the row — its id stays');
  assert.equal(t1.data.amount, 2);
  assert.equal(t1.data.name, 'Coffee (corrected)');
  assert.equal(t1.data.arrival_id, 'arr_1b', 'the LAST upsert\'s data wins (latest-arrived)');
  assert.deepEqual(plan.links, [{ transactionId: 't2', arrivalId: 'arr_2' }], 'the first link per id (arrival_id IS NULL makes later ones no-ops); t1\'s link is a no-op because its upsert sets arrival_id');
  assert.equal(plan.deletes.length, 2, 'every posted row\'s rule, in order, for rows outside the page');
  assert.deepEqual(plan.deleteInPageIds, []);
});

test('the plan: an in-page pending row is deleted only by a LATER posted row\'s rule; a later re-upsert revives it', () => {
  // B (pending) before A (posted, same account/amount/day) → sequentially deleted by A.
  // C (pending) after A2 (posted) → survives. D (pending) before A3, re-upserted after → survives.
  const plan = planDomainWrites([
    upsert('B', 'acc_1', { amount: 77.25, date: d('10'), pending: true }),
    upsert('A', 'acc_1', { amount: 77.25, date: d('10'), pending: false }),
    del('acc_1', 77.25, '10', 'A'),
    upsert('A2', 'acc_2', { amount: 55.5, date: d('20'), pending: false }),
    del('acc_2', 55.5, '20', 'A2'),
    upsert('C', 'acc_2', { amount: 55.5, date: d('20'), pending: true }),
    upsert('D', 'acc_1', { amount: 9, date: d('05'), pending: true }),
    upsert('A3', 'acc_1', { amount: 9, date: d('06'), pending: false }),
    del('acc_1', 9, '06', 'A3'),
    upsert('D', 'acc_1', { amount: 9, date: d('05'), pending: true }),
    // a different account or amount, or outside ±2 days, is not a duplicate
    upsert('E', 'acc_2', { amount: 77.25, date: d('10'), pending: true }),
    upsert('F', 'acc_1', { amount: 77.26, date: d('10'), pending: true }),
    upsert('G', 'acc_1', { amount: 77.25, date: d('20'), pending: true }),
    upsert('A4', 'acc_1', { amount: 77.25, date: d('10'), pending: false }),
    del('acc_1', 77.25, '10', 'A4'),
  ]);
  assert.deepEqual(plan.deleteInPageIds.sort(), ['B'], 'only B: C came after its posted twin, D was re-upserted, E/F/G do not match');
  assert.equal(plan.deletes.length, 4);
  assert.ok(plan.pageIds.includes('B') && plan.pageIds.includes('C'));
});

test('the plan: an intent shape the parser never issues is a throw, not a per-row fallback', async () => {
  const fake = { $executeRaw: async () => 0 } as unknown as Parameters<typeof prismaDomain>[0];
  const domain = prismaDomain(fake);
  await assert.rejects(domain.transactions.updateMany({ where: { transactionId: 't1' }, data: { name: 'x' } }), UnsupportedDomainWriteError);
  await assert.rejects(domain.transactions.deleteMany({ where: { transactionId: 't1' } }), UnsupportedDomainWriteError);
  await assert.rejects(domain.transactions.upsert({ where: { transactionId: 't1' }, create: { id: 'x', transactionId: 't1', accountId: 'a', bogus: 1 }, update: {} }), UnsupportedDomainWriteError);
  await assert.rejects(domain.transactions.upsert({ where: { transactionId: 't1' }, create: { id: 'x', transactionId: 't1', accountId: 'a' }, update: { bogus: 1 } }), UnsupportedDomainWriteError);
  // the parser's real shapes are accepted and buffered — nothing runs until finish()
  let ran = 0;
  const counting = prismaDomain({ $executeRaw: async () => { ran += 1; return 1; } } as unknown as Parameters<typeof prismaDomain>[0]);
  await counting.transactions.upsert(upsert('t1', 'acc_1').args);
  await counting.transactions.updateMany(link('t2', 'arr_2').args);
  await counting.transactions.deleteMany(del('acc_1', 10, '10', 't1').args);
  assert.equal(ran, 0, 'buffered');
  assert.deepEqual(counting.stats(), { intents: 3, statements: 0 });
  await counting.finish();
  assert.equal(ran, 3, 'one upsert statement, one link statement, one delete statement');
  assert.deepEqual(counting.stats(), { intents: 3, statements: 3 });
  await assert.rejects(counting.transactions.upsert(upsert('t9', 'acc_1').args), UnsupportedDomainWriteError, 'a write after finish is refused');
});

test('the SQL: one INSERT … ON CONFLICT DO UPDATE per column group, one UPDATE … FROM VALUES, one DELETE … USING VALUES', () => {
  const plan = planDomainWrites([
    upsert('t1', 'acc_1'),
    upsert('t2', 'acc_1', { merchantName: undefined, logo_url: undefined }),
    upsert('t3', 'acc_2', { pending: true }),
    del('acc_1', 10, '10', 't1'),
    link('t8', 'arr_8'),
  ]);
  const groups = groupByColumns(plan.upserts);
  assert.equal(groups.length, 2, 'rows with an omitted (undefined) column form their own statement — Prisma\'s create defaults it, its update skips it');
  assert.equal(groups[0].rows.length, 2);
  assert.deepEqual(groups[0].columns, [...DATA_KEYS]);
  assert.deepEqual(groups[1].columns, DATA_KEYS.filter((k) => k !== 'merchantName' && k !== 'logo_url'));

  const up = upsertSql(groups[0].columns, groups[0].rows);
  // Prisma.Sql renders parameters as `?` and joins with `,`; the values ride beside it.
  assert.match(up.sql, /^INSERT INTO transactions \("id","accountId","transactionId","amount","date","name","merchantName","category","pending"/);
  assert.match(up.sql, /ON CONFLICT \("transactionId"\) DO UPDATE SET "amount" = EXCLUDED\."amount","date" = EXCLUDED\."date"/);
  assert.match(up.sql, /"updatedAt" = EXCLUDED\."updatedAt"$/);
  assert.ok(!/"id" = EXCLUDED|"accountId" = EXCLUDED|"transactionId" = EXCLUDED/.test(up.sql), 'create-only columns are never updated');
  assert.equal(up.values.length, 2 * (3 + DATA_KEYS.length), 'every value is a bound parameter');
  assert.match(up.sql, /VALUES \(\?,\?,\?,\?::float8,\?::timestamp,/, 'amount cast to float8, timestamps to timestamp (UTC wall clock, as Prisma stores DateTime)');
  assert.match(up.sql, /::jsonb/);
  assert.equal(up.values[4], '2026-06-10T00:00:00.000Z', 'a Date rides as its ISO text');
  assert.equal(up.values[11], '[{"name":"X"}]', 'JSON rides as text into ::jsonb');

  const ln = linkSql(plan.links);
  assert.equal(ln.sql, 'UPDATE transactions AS t SET arrival_id = v.arrival_id FROM (VALUES (?, ?)) AS v(transaction_id, arrival_id) WHERE t."transactionId" = v.transaction_id AND t.arrival_id IS NULL');
  assert.deepEqual(ln.values, ['t8', 'arr_8']);

  const dl = deleteSql(plan.deletes, plan.pageIds);
  assert.equal(dl.sql, 'DELETE FROM transactions AS t USING (VALUES (?, ?::float8, ?::timestamp, ?::timestamp, ?)) AS v(account_id, amount, lo, hi, transaction_id) WHERE t."accountId" = v.account_id AND t.amount = v.amount AND t.pending = true AND t.date >= v.lo AND t.date <= v.hi AND t."transactionId" <> v.transaction_id AND NOT (t."transactionId" = ANY(?::text[]))');
  assert.deepEqual(dl.values.slice(0, 5), ['acc_1', 10, '2026-06-08T00:00:00.000Z', '2026-06-12T00:00:00.000Z', 't1']);
  assert.deepEqual(dl.values[5], ['t1', 't2', 't3']);

  assert.equal(deleteByIdSql(['B']).sql, 'DELETE FROM transactions WHERE "transactionId" = ANY(?::text[])');
});

test('runTransactionsPage finishes a buffering port inside the page transaction, after the parser', async () => {
  const order: string[] = [];
  const table: ArrivalRow[] = [];
  const landing: LandingDb = {
    async insertResponse() { order.push('response'); },
    async insertArrivalsIgnoringDuplicates(rows: ArrivalRow[]) { order.push('arrivals'); table.push(...rows); return rows.map((r) => ({ their_id: r.their_id, fingerprint: r.fingerprint })); },
    async findArrivals(_provider: string, theirIds: string[]): Promise<LandedArrival[]> {
      return table.filter((r) => theirIds.includes(r.their_id)).map((r) => ({ id: r.id, their_id: r.their_id, fingerprint: r.fingerprint, payload: r.payload, status: 'pending', arrived: r.arrived }));
    },
    async markRead() { order.push('markRead'); },
  };
  let executed = 0;
  const client = { $transaction: async <T,>(fn: (tx: unknown) => Promise<T>) => { order.push('BEGIN'); const r = await fn({ $executeRaw: async () => { executed += 1; return 1; } }); order.push('COMMIT'); return r; } };
  const ports = (tx: unknown): PagePorts => {
    const domain = prismaDomain(tx as Parameters<typeof prismaDomain>[0]);
    return { landing, domain, finish: () => domain.finish() };
  };
  const result = await runTransactionsPage(client, ports, {
    page: 1, userId: 'u', connection: 'item', accounts: [{ id: 'acc_db', accountId: 'acc_p1' }], existing: new Map(),
    wire: { body: Buffer.from('{}'), asked: NOW, arrived: NOW }, httpStatus: 200,
    transactions: [{ transaction_id: 't1', account_id: 'acc_p1', amount: 5, date: '2026-06-10', name: 'x', pending: false } as never],
    now: () => NOW,
  });
  assert.equal(result.ok, true);
  assert.deepEqual(order, ['BEGIN', 'response', 'arrivals', 'markRead', 'COMMIT'], 'the flush ran before COMMIT');
  assert.equal(executed, 2, 'one upsert statement + one delete statement (a posted row)');
});
