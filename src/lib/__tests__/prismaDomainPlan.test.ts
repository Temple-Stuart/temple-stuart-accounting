import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DATA_KEYS,
  UnsupportedDomainWriteError,
  clearReplacedPendingSql,
  groupByColumns,
  linkSql,
  planDomainWrites,
  prismaDomain,
  upsertSql,
  type Intent,
} from '../arrivals/prismaDomain';
import { runTransactionsPage, type PagePorts } from '../arrivals/plaidTransactionsPage';
import type { ArrivalRow, LandedArrival, LandingDb } from '../arrivals/land';
import { code } from '../sourceText';

// PERF-01 — the batching binding replays the parser's per-row intents as one statement per
// kind with the sequential order's exact result. The parser's semantics are proven over a fake
// port (arrivalsLand.test.ts); these tests prove the replay plan and the SQL shapes.
//
// PENDING-01 (Alex, 2026-11-11): THE GUESS IS GONE. Until then these tests also pinned the parser's
// same-amount delete as the binding replayed it — the delete rule in the plan, its in-page case (a
// pending row removed by a later posted row of the same account, amount and day), the delete shape
// the binding accepted, deleteSql and deleteByIdSql. None of that exists now: the plan holds upserts
// and links only. The sync's ONE delete is the page's pending step, held here by content — ONE
// statement, by Plaid's ids, with its four conditions — and by what the binding does with it: run at
// once inside the page's transaction, counted, refused after finish().

const NOW = new Date('2026-09-05T12:00:00.000Z');
const d = (day: string) => new Date(`2026-06-${day}T00:00:00.000Z`);

function data(over: Record<string, unknown> = {}) {
  return {
    amount: 10, date: d('10'), name: 'Coffee', merchantName: 'Cafe', category: 'Food and Drink, Coffee', pending: false,
    authorized_date: null, authorized_datetime: null, counterparties: [{ name: 'X' }], location: { city: 'Austin' },
    payment_channel: 'in store', payment_meta: { reference_number: null }, personal_finance_category: { primary: 'FOOD_AND_DRINK' },
    personal_finance_category_icon_url: null, transaction_code: null, transaction_type: 'place', logo_url: null, website: null,
    // FX-01 (2026-10-30, ruling E): the parser's txnData carries Plaid's currency code — the fixture mirrors it.
    iso_currency_code: 'USD',
    arrival_id: 'arr_1', updatedAt: NOW, ...over,
  };
}
type UpsertI = Extract<Intent, { kind: 'upsert' }>;
type LinkI = Extract<Intent, { kind: 'link' }>;
type Tx = Parameters<typeof prismaDomain>[0];
function upsert(transactionId: string, accountId: string, over: Record<string, unknown> = {}, id = `txn_${transactionId}`): UpsertI {
  const dd = data(over);
  return { kind: 'upsert', args: { where: { transactionId }, create: { id, transactionId, accountId, ...dd }, update: dd } };
}
function link(transactionId: string, arrivalId: string): LinkI {
  return { kind: 'link', args: { where: { transactionId, arrival_id: null }, data: { arrival_id: arrivalId } } };
}

/** The pending step's statement, as Prisma.Sql renders it: every parameter a `?`. */
const CLEAR_STATEMENT = 'WITH named AS (SELECT t.id FROM transactions AS t WHERE t."transactionId" = ANY(?::text[]) AND t.pending = true AND t."accountId" = ANY(?::text[])), '
  + 'cleared AS (DELETE FROM transactions AS t USING named AS n WHERE t.id = n.id AND t.review_status <> \'committed\' AND NOT EXISTS (SELECT 1 FROM journal_entries AS j WHERE j.source_type = \'plaid_txn\' AND j.source_id = t."transactionId" AND j.is_reversal = false AND j.reversed_by_entry_id IS NULL) RETURNING t.id) '
  + 'SELECT (SELECT count(*) FROM cleared)::int AS pending_cleared, ((SELECT count(*) FROM named) - (SELECT count(*) FROM cleared))::int AS pending_kept';

test('the plan: one upsert per id (first create, last data), links only for ids the page does not upsert — and the plan holds upserts and links only', () => {
  const plan = planDomainWrites([
    upsert('t1', 'acc_1', { amount: 1 }, 'txn_first'),
    link('t2', 'arr_2'),
    link('t2', 'arr_2b'),
    link('t1', 'arr_9'),
    upsert('t1', 'acc_1', { amount: 2, name: 'Coffee (corrected)', arrival_id: 'arr_1b' }, 'txn_second'),
    upsert('t3', 'acc_2', { pending: true }),
  ]);
  assert.deepEqual(Object.keys(plan).sort(), ['links', 'upserts'], 'PENDING-01: no delete rule, no in-page delete, no list of page ids — nothing in the plan deletes');
  assert.deepEqual(plan.upserts.map((u) => u.transactionId), ['t1', 't3']);
  const t1 = plan.upserts[0];
  assert.equal(t1.id, 'txn_first', 'the FIRST upsert creates the row — its id stays');
  assert.equal(t1.data.amount, 2);
  assert.equal(t1.data.name, 'Coffee (corrected)');
  assert.equal(t1.data.arrival_id, 'arr_1b', 'the LAST upsert\'s data wins (latest-arrived)');
  assert.deepEqual(plan.links, [{ transactionId: 't2', arrivalId: 'arr_2' }], 'the first link per id (arrival_id IS NULL makes later ones no-ops); t1\'s link is a no-op because its upsert sets arrival_id');
});

test('the plan: a pending row and a posted row of the same account, amount and day are BOTH written, whichever came first — the plan drops no row', () => {
  // Until PENDING-01 the plan removed B here: a pending row followed by a posted one of the same account, amount and
  // day (and kept C, which came after its posted twin, and D, re-upserted after). Nothing in the plan removes a row now.
  const plan = planDomainWrites([
    upsert('B', 'acc_1', { amount: 77.25, date: d('10'), pending: true }),
    upsert('A', 'acc_1', { amount: 77.25, date: d('10'), pending: false }),
    upsert('A2', 'acc_2', { amount: 55.5, date: d('20'), pending: false }),
    upsert('C', 'acc_2', { amount: 55.5, date: d('20'), pending: true }),
    upsert('D', 'acc_1', { amount: 9, date: d('05'), pending: true }),
    upsert('A3', 'acc_1', { amount: 9, date: d('06'), pending: false }),
    upsert('D', 'acc_1', { amount: 9, date: d('05'), pending: true }),
  ]);
  assert.deepEqual(plan.upserts.map((u) => u.transactionId), ['B', 'A', 'A2', 'C', 'D', 'A3'], 'every id the page wrote, once, in the order it first appeared — B among them');
  assert.deepEqual(plan.upserts.filter((u) => u.data.pending === true).map((u) => u.transactionId), ['B', 'C', 'D'], 'the three pending rows are written as pending');
  assert.deepEqual(plan.links, []);
});

test('the binding: an intent shape the parser never issues is a throw, not a per-row fallback; it holds no deleteMany; a write after finish is refused', async () => {
  const fake = { $executeRaw: async () => 0 } as unknown as Tx;
  const domain = prismaDomain(fake);
  await assert.rejects(domain.transactions.updateMany({ where: { transactionId: 't1' }, data: { name: 'x' } }), UnsupportedDomainWriteError);
  assert.equal('deleteMany' in domain.transactions, false, 'PENDING-01: the binding has no deleteMany — the parser issues no delete');
  await assert.rejects(domain.transactions.upsert({ where: { transactionId: 't1' }, create: { id: 'x', transactionId: 't1', accountId: 'a', bogus: 1 }, update: {} }), UnsupportedDomainWriteError);
  await assert.rejects(domain.transactions.upsert({ where: { transactionId: 't1' }, create: { id: 'x', transactionId: 't1', accountId: 'a' }, update: { bogus: 1 } }), UnsupportedDomainWriteError);
  // the refusal's words say what the binding does now
  await assert.rejects(
    domain.transactions.updateMany({ where: { transactionId: 't1' }, data: { name: 'x' } }),
    /the batching binding replays only the parser's two intents \(upsert by transactionId, the arrival_id link\) and runs the page's one pending step; nothing else is issued$/,
  );
  // the parser's real shapes are accepted and buffered — nothing runs until finish()
  let ran = 0;
  const counting = prismaDomain({ $executeRaw: async () => { ran += 1; return 1; } } as unknown as Tx);
  await counting.transactions.upsert(upsert('t1', 'acc_1').args);
  await counting.transactions.updateMany(link('t2', 'arr_2').args);
  assert.equal(ran, 0, 'buffered');
  assert.deepEqual(counting.stats(), { intents: 2, statements: 0 });
  await counting.finish();
  assert.equal(ran, 2, 'one upsert statement, one link statement — and no other');
  assert.deepEqual(counting.stats(), { intents: 2, statements: 2 });
  await assert.rejects(counting.transactions.upsert(upsert('t9', 'acc_1').args), UnsupportedDomainWriteError, 'a write after finish is refused');
});

test('the SQL: one INSERT … ON CONFLICT DO UPDATE per column group and one UPDATE … FROM VALUES — neither deletes', () => {
  const plan = planDomainWrites([
    upsert('t1', 'acc_1'),
    upsert('t2', 'acc_1', { merchantName: undefined, logo_url: undefined }),
    upsert('t3', 'acc_2', { pending: true }),
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

  assert.equal(/\bDELETE\b/.test(up.sql) || /\bDELETE\b/.test(ln.sql), false, 'the flush deletes nothing');
  // by content: the binding holds ONE delete — the pending step's — and nothing of the guess
  const binding = code('src/lib/arrivals/prismaDomain.ts');
  assert.equal(binding.split('DELETE FROM').length - 1, 1, 'one DELETE in the file');
  assert.equal(/deleteMany|DeleteIntent|assertDelete|deleteSql|deleteByIdSql|deleteInPageIds|pageIds|v\.lo\b|v\.hi\b/.test(binding), false, 'the delete rule, its in-page bookkeeping and its two statements are gone');
});

test('PENDING-01 the pending step is ONE statement, by Plaid\'s own ids, carrying its four conditions — pending, the link\'s accounts, not committed, no live posting — and answering both counts', () => {
  const st = clearReplacedPendingSql(['acc_db_1', 'acc_db_2'], ['p1', 'p2', 'p3']);
  assert.equal(st.sql, CLEAR_STATEMENT);
  assert.deepEqual(st.values, [['p1', 'p2', 'p3'], ['acc_db_1', 'acc_db_2']], 'the ids and the accounts ride as one array parameter each — a page of any size is one statement');
  // the rows it may name: Plaid's ids, still pending, on the link's own accounts
  assert.ok(st.sql.includes('t."transactionId" = ANY(?::text[])'), 'named by transactionId — Plaid\'s own id for the pending charge');
  assert.ok(st.sql.includes('AND t.pending = true'), 'condition 1 — pending');
  assert.ok(st.sql.includes('AND t."accountId" = ANY(?::text[])'), 'condition 2 — the accounts handed to the step');
  // of those, the rows it deletes
  assert.ok(st.sql.includes("AND t.review_status <> 'committed'"), 'condition 3 — not committed');
  assert.ok(st.sql.includes("AND NOT EXISTS (SELECT 1 FROM journal_entries AS j WHERE j.source_type = 'plaid_txn' AND j.source_id = t.\"transactionId\" AND j.is_reversal = false AND j.reversed_by_entry_id IS NULL)"), 'condition 4 — no live posting: a plaid_txn entry on this row that is neither a reversal nor reversed');
  assert.equal(st.sql.split('DELETE FROM').length - 1, 1, 'one delete');
  assert.match(st.sql, /cleared AS \(DELETE FROM transactions AS t USING named AS n WHERE t\.id = n\.id AND /, 'it deletes only among the named rows');
  // the two counts: what it deleted, and the named rows it left — which only a committed or posted-from row can be
  assert.match(st.sql, /SELECT \(SELECT count\(\*\) FROM cleared\)::int AS pending_cleared, \(\(SELECT count\(\*\) FROM named\) - \(SELECT count\(\*\) FROM cleared\)\)::int AS pending_kept$/);
  // the guess is gone: nothing is matched by amount or by day, and no value is written into the text
  assert.equal(/amount|\bdate\b|timestamp|float8/.test(st.sql), false, 'no amount, no day');
  assert.equal(/p1|acc_db_1/.test(st.sql), false, 'every value is a bound parameter');
});

test('PENDING-01 the binding runs the step at once — not buffered — counts its statement, hands back the two counts, and refuses a call after finish()', async () => {
  const ran: string[] = [];
  const asked: unknown[][] = [];
  const tx = {
    $executeRaw: async (q: { sql: string }) => { ran.push(`flush: ${q.sql.slice(0, 24)}`); return 1; },
    $queryRaw: async (q: { sql: string; values: unknown[] }) => { ran.push(`step: ${q.sql.slice(0, 13)}`); asked.push(q.values); return [{ pending_cleared: 16, pending_kept: 27 }]; },
  } as unknown as Tx;
  const domain = prismaDomain(tx);
  await domain.transactions.upsert(upsert('t1', 'acc_1').args);
  const answer = await domain.clearReplacedPending({ accountIds: ['acc_db_1'], transactionIds: ['p1', 'p2'] });
  assert.deepEqual(answer, { pending_cleared: 16, pending_kept: 27 }, 'the statement\'s own answer');
  assert.deepEqual(ran, ['step: WITH named AS'], 'run at once — the upsert buffered before it has not run');
  assert.deepEqual(asked, [[['p1', 'p2'], ['acc_db_1']]], 'handed the ids and the accounts it was given');
  assert.deepEqual(domain.stats(), { intents: 1, statements: 1 }, 'its statement is counted for the log line; it is no buffered intent');
  await domain.finish();
  assert.deepEqual(ran, ['step: WITH named AS', 'flush: INSERT INTO transactions'], 'the flush comes after');
  assert.deepEqual(domain.stats(), { intents: 1, statements: 2 });
  await assert.rejects(domain.clearReplacedPending({ accountIds: ['acc_db_1'], transactionIds: ['p1'] }), UnsupportedDomainWriteError, 'a call after finish is refused, like its siblings');
  assert.equal(ran.length, 2, 'and nothing ran for it');

  // arguments that are not { accountIds, transactionIds }, each a list of at least one id, are refused before anything runs
  let queries = 0;
  const strict = () => prismaDomain({ $executeRaw: async () => 1, $queryRaw: async () => { queries += 1; return [{ pending_cleared: 0, pending_kept: 0 }]; } } as unknown as Tx);
  for (const bad of [
    { accountIds: [], transactionIds: ['p1'] }, { accountIds: ['a'], transactionIds: [] }, { accountIds: 'a', transactionIds: ['p1'] },
    { accountIds: ['a'], transactionIds: [7] }, { accountIds: ['a'], transactionIds: [''] }, { accountIds: ['a'] }, { accountIds: ['a'], transactionIds: ['p1'], amount: 12.5 },
  ]) {
    await assert.rejects(strict().clearReplacedPending(bad as never), UnsupportedDomainWriteError, JSON.stringify(bad));
  }
  assert.equal(queries, 0);

  // an answer that is not exactly one row of two counts is the table not answering — thrown, never read as none
  for (const answered of [[], [{ pending_cleared: 1 }], [{ pending_cleared: '1', pending_kept: 0 }], [{ pending_cleared: -1, pending_kept: 0 }], [{ pending_cleared: 1.5, pending_kept: 0 }], [{ pending_cleared: BigInt(1), pending_kept: 0 }], [{ pending_cleared: 1, pending_kept: 0 }, { pending_cleared: 1, pending_kept: 0 }]]) {
    const odd = prismaDomain({ $executeRaw: async () => 1, $queryRaw: async () => answered } as unknown as Tx);
    await assert.rejects(odd.clearReplacedPending({ accountIds: ['a'], transactionIds: ['p1'] }), /the pending step answered no count — the table is not answering/);
  }
});

test('runTransactionsPage finishes a buffering port inside the page transaction, after the parser — and the pending step runs inside it too, before the flush', async () => {
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
  let stepped = 0;
  const tx = {
    $executeRaw: async () => { executed += 1; order.push('flush'); return 1; },
    $queryRaw: async () => { stepped += 1; order.push('pending step'); return [{ pending_cleared: 1, pending_kept: 0 }]; },
  };
  const client = { $transaction: async <T,>(fn: (tx: unknown) => Promise<T>) => { order.push('BEGIN'); const r = await fn(tx); order.push('COMMIT'); return r; } };
  const ports = (handed: unknown): PagePorts => {
    const domain = prismaDomain(handed as Tx);
    return { landing, domain, finish: () => domain.finish() };
  };
  const page = (transactions: unknown[]) => ({
    page: 1, userId: 'u', connection: 'item', accounts: [{ id: 'acc_db', accountId: 'acc_p1' }], existing: new Map(),
    wire: { body: Buffer.from('{}'), asked: NOW, arrived: NOW }, httpStatus: 200,
    transactions: transactions as never[],
    now: () => NOW,
  });

  // a posted row that names no pending charge: one statement — its upsert — and no step
  const result = await runTransactionsPage(client, ports, page([{ transaction_id: 't1', account_id: 'acc_p1', amount: 5, date: '2026-06-10', name: 'x', pending: false }]));
  assert.equal(result.ok, true);
  assert.deepEqual(order, ['BEGIN', 'response', 'arrivals', 'markRead', 'flush', 'COMMIT'], 'the flush ran before COMMIT');
  assert.equal(executed, 1, 'one upsert statement — PENDING-01: a posted row no longer brings a delete of its own');
  assert.equal(stepped, 0, 'nothing named, so the step did not run');
  if (result.ok) assert.equal('pending_cleared' in result.counts, false);

  // a posted row that names a pending charge: the step, inside the transaction, after the parse and before the flush
  order.length = 0;
  const named = await runTransactionsPage(client, ports, page([{ transaction_id: 't2', account_id: 'acc_p1', amount: 5, date: '2026-06-10', name: 'x', pending: false, pending_transaction_id: 'p2' }]));
  assert.equal(named.ok, true);
  assert.deepEqual(order, ['BEGIN', 'response', 'arrivals', 'pending step', 'markRead', 'flush', 'COMMIT']);
  assert.equal(stepped, 1);
  if (named.ok) assert.deepEqual([named.counts.pending_cleared, named.counts.pending_kept], [1, 0], 'the page\'s counts carry the statement\'s answer');
});
