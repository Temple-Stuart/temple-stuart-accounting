import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DATA_KEYS,
  UnsupportedDomainWriteError,
  clearReplacedPendingSql,
  clearUnlistedPendingSql,
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
//
// PENDING-01 part 3 (the ruling of 2026-11-11 on the two foreign keys PENDING-01's report named): the
// delete carries a FIFTH condition — nothing points at the row: no booking link, no settled refund
// (both foreign keys are ON DELETE RESTRICT; until part 3 the statement threw on such a row) — and the
// statement answers THREE counts: pending_cleared, pending_kept, pending_linked. Until part 3 the
// pins below read four conditions and one row of two counts.
//
// PENDING-03 (Alex, 2026-11-11): A PENDING ROW THE BANK NO LONGER LISTS IS CLEARED — the pull's
// SECOND delete, a second statement in the binding (clearUnlistedPendingSql), held here by content
// like the first: pending, the link's accounts, the page's two days both strict, none of the ids
// the page accounts for, and the first statement's three conditions word for word; two counts. The
// binding runs it at once, counts it, refuses it after finish(). Until PENDING-03 the pins below
// read ONE `DELETE FROM` in the binding and "the page's one pending step" in its refusal.

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

/** The pending step's statement, as Prisma.Sql renders it: every parameter a `?`. PENDING-01 part 3: the delete's fifth condition (no booking link, no settled refund), the `linked` rows, and the third count. */
const CLEAR_STATEMENT = 'WITH named AS (SELECT t.id FROM transactions AS t WHERE t."transactionId" = ANY(?::text[]) AND t.pending = true AND t."accountId" = ANY(?::text[])), '
  + 'cleared AS (DELETE FROM transactions AS t USING named AS n WHERE t.id = n.id AND t.review_status <> \'committed\' AND NOT EXISTS (SELECT 1 FROM journal_entries AS j WHERE j.source_type = \'plaid_txn\' AND j.source_id = t."transactionId" AND j.is_reversal = false AND j.reversed_by_entry_id IS NULL) AND NOT EXISTS (SELECT 1 FROM transaction_reservation_links AS l WHERE l."transactionId" = t.id) AND NOT EXISTS (SELECT 1 FROM money_events AS m WHERE m."settledTransactionId" = t.id) RETURNING t.id), '
  + 'linked AS (SELECT t.id FROM transactions AS t JOIN named AS n ON n.id = t.id WHERE t.review_status <> \'committed\' AND NOT EXISTS (SELECT 1 FROM journal_entries AS j WHERE j.source_type = \'plaid_txn\' AND j.source_id = t."transactionId" AND j.is_reversal = false AND j.reversed_by_entry_id IS NULL) AND (EXISTS (SELECT 1 FROM transaction_reservation_links AS l WHERE l."transactionId" = t.id) OR EXISTS (SELECT 1 FROM money_events AS m WHERE m."settledTransactionId" = t.id))) '
  + 'SELECT (SELECT count(*) FROM cleared)::int AS pending_cleared, ((SELECT count(*) FROM named) - (SELECT count(*) FROM cleared) - (SELECT count(*) FROM linked))::int AS pending_kept, (SELECT count(*) FROM linked)::int AS pending_linked';
/** The three facts the statement reads of a row `t`, as it writes them. */
const LIVE_POSTING = 'EXISTS (SELECT 1 FROM journal_entries AS j WHERE j.source_type = \'plaid_txn\' AND j.source_id = t."transactionId" AND j.is_reversal = false AND j.reversed_by_entry_id IS NULL)';
const BOOKING_LINK = 'EXISTS (SELECT 1 FROM transaction_reservation_links AS l WHERE l."transactionId" = t.id)';
const SETTLED_REFUND = 'EXISTS (SELECT 1 FROM money_events AS m WHERE m."settledTransactionId" = t.id)';
/** PENDING-03: the unlisted step's statement, as Prisma.Sql renders it: every parameter a `?` — the accounts, the oldest day, the newest day, the ids. */
const UNLISTED_STATEMENT = 'WITH unlisted AS (SELECT t.id FROM transactions AS t WHERE t.pending = true AND t."accountId" = ANY(?::text[]) AND t."date"::date > ?::date AND t."date"::date < ?::date AND t."transactionId" <> ALL(?::text[])), '
  + 'cleared AS (DELETE FROM transactions AS t USING unlisted AS u WHERE t.id = u.id AND t.review_status <> \'committed\' AND NOT EXISTS (SELECT 1 FROM journal_entries AS j WHERE j.source_type = \'plaid_txn\' AND j.source_id = t."transactionId" AND j.is_reversal = false AND j.reversed_by_entry_id IS NULL) AND NOT EXISTS (SELECT 1 FROM transaction_reservation_links AS l WHERE l."transactionId" = t.id) AND NOT EXISTS (SELECT 1 FROM money_events AS m WHERE m."settledTransactionId" = t.id) RETURNING t.id) '
  + 'SELECT (SELECT count(*) FROM cleared)::int AS pending_unlisted, ((SELECT count(*) FROM unlisted) - (SELECT count(*) FROM cleared))::int AS pending_unlisted_left';

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
    /the batching binding replays only the parser's two intents \(upsert by transactionId, the arrival_id link\) and runs the page's two pending steps; nothing else is issued$/,
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
  // by content: the binding holds TWO deletes — the two pending steps', one statement each (PENDING-01's replaced
  // step; PENDING-03's unlisted step) — both of transactions rows, and nothing of the guess
  const binding = code('src/lib/arrivals/prismaDomain.ts');
  assert.equal(binding.split('DELETE FROM').length - 1, 2, 'two DELETEs in the file: one in each pending step\'s statement');
  assert.equal(binding.split('DELETE FROM transactions AS t USING').length - 1, 2, 'each deletes transactions rows, among the rows its own statement names');
  assert.equal(/deleteMany|DeleteIntent|assertDelete|deleteSql|deleteByIdSql|deleteInPageIds|pageIds|v\.lo\b|v\.hi\b/.test(binding), false, 'the delete rule, its in-page bookkeeping and its two statements are gone');
});

test('PENDING-01 the pending step is ONE statement, by Plaid\'s own ids, carrying its five conditions — pending, the link\'s accounts, not committed, no live posting, nothing pointing at the row — and answering the three counts', () => {
  const st = clearReplacedPendingSql(['acc_db_1', 'acc_db_2'], ['p1', 'p2', 'p3']);
  assert.equal(st.sql, CLEAR_STATEMENT);
  assert.deepEqual(st.values, [['p1', 'p2', 'p3'], ['acc_db_1', 'acc_db_2']], 'the ids and the accounts ride as one array parameter each — a page of any size is one statement');
  // the statement's four parts, in the order it writes them
  const at = (needle: string) => { const i = st.sql.indexOf(needle); assert.ok(i > -1, `the statement holds ${needle}`); return i; };
  const parts = ['WITH named AS (', ', cleared AS (', ', linked AS (', ' SELECT (SELECT count(*) FROM cleared)::int AS pending_cleared'].map(at);
  assert.deepEqual(parts, [...parts].sort((a, b) => a - b), 'named → cleared → linked → the answer');
  const named = st.sql.slice(parts[0], parts[1]);
  const cleared = st.sql.slice(parts[1], parts[2]);
  const linked = st.sql.slice(parts[2], parts[3]);
  // the rows it may name: Plaid's ids, still pending, on the link's own accounts
  assert.ok(named.includes('t."transactionId" = ANY(?::text[])'), 'named by transactionId — Plaid\'s own id for the pending charge');
  assert.ok(named.includes('AND t.pending = true'), 'condition 1 — pending');
  assert.ok(named.includes('AND t."accountId" = ANY(?::text[])'), 'condition 2 — the accounts handed to the step');
  // of those, the rows it deletes
  assert.ok(cleared.includes("AND t.review_status <> 'committed'"), 'condition 3 — not committed');
  assert.ok(cleared.includes(`AND NOT ${LIVE_POSTING}`), 'condition 4 — no live posting: a plaid_txn entry on this row that is neither a reversal nor reversed');
  // PENDING-01 part 3 — condition 5: nothing points at the row. Both foreign keys hold the row's id (t.id), not Plaid's transactionId.
  assert.ok(cleared.includes(`AND NOT ${BOOKING_LINK}`), 'condition 5 — no booking link points at the row');
  assert.ok(cleared.includes(`AND NOT ${SETTLED_REFUND}`), 'condition 5 — no settled refund points at the row');
  assert.equal(BOOKING_LINK, 'EXISTS (SELECT 1 FROM transaction_reservation_links AS l WHERE l."transactionId" = t.id)', 'whatever the link\'s status: the condition reads none — a proposed or a rejected link holds the row as an accepted one does');
  assert.equal(SETTLED_REFUND, 'EXISTS (SELECT 1 FROM money_events AS m WHERE m."settledTransactionId" = t.id)');
  assert.ok(cleared.endsWith(`AND NOT ${SETTLED_REFUND} RETURNING t.id)`), 'the fifth condition is the delete\'s own — it never tries a row something points at');
  assert.equal(st.sql.split('DELETE FROM').length - 1, 1, 'one delete');
  assert.match(st.sql, /cleared AS \(DELETE FROM transactions AS t USING named AS n WHERE t\.id = n\.id AND /, 'it deletes only among the named rows');
  // PENDING-01 part 3 — the rows left in place because something points at them: named, NOT committed, no live posting, and a booking link or a settled refund
  assert.equal(linked, `, linked AS (SELECT t.id FROM transactions AS t JOIN named AS n ON n.id = t.id WHERE t.review_status <> 'committed' AND NOT ${LIVE_POSTING} AND (${BOOKING_LINK} OR ${SETTLED_REFUND}))`);
  assert.equal(/\b(DELETE|UPDATE|INSERT)\b/.test(linked), false, 'the linked rows are read, never written — nothing about them changes');
  // the delete and the count of what it left read the same three facts, word for word: a row is in `cleared` or in `linked`, never in both
  for (const fact of [LIVE_POSTING, BOOKING_LINK, SETTLED_REFUND]) assert.equal(st.sql.split(fact).length - 1, 2, `once in the delete, once in linked: ${fact}`);
  assert.equal(st.sql.split("t.review_status <> 'committed'").length - 1, 2);
  // the three counts: what it deleted; the named rows it left because something points at them; and every other
  // named row — which only a committed or posted-from row can be. By their arithmetic the three add up to the named rows.
  assert.match(st.sql, / SELECT \(SELECT count\(\*\) FROM cleared\)::int AS pending_cleared, \(\(SELECT count\(\*\) FROM named\) - \(SELECT count\(\*\) FROM cleared\) - \(SELECT count\(\*\) FROM linked\)\)::int AS pending_kept, \(SELECT count\(\*\) FROM linked\)::int AS pending_linked$/);
  // the guess is gone: nothing is matched by amount or by day, and no value is written into the text
  assert.equal(/amount|\bdate\b|timestamp|float8/.test(st.sql), false, 'no amount, no day');
  assert.equal(/p1|acc_db_1/.test(st.sql), false, 'every value is a bound parameter');
  assert.equal(st.sql.split('?').length - 1, 2, 'two parameters — the ids and the accounts, each once');
});

test('PENDING-01 the binding runs the step at once — not buffered — counts its statement, hands back the three counts, and refuses a call after finish()', async () => {
  const ran: string[] = [];
  const asked: unknown[][] = [];
  const tx = {
    $executeRaw: async (q: { sql: string }) => { ran.push(`flush: ${q.sql.slice(0, 24)}`); return 1; },
    $queryRaw: async (q: { sql: string; values: unknown[] }) => { ran.push(`step: ${q.sql.slice(0, 13)}`); asked.push(q.values); return [{ pending_cleared: 16, pending_kept: 27, pending_linked: 3 }]; },
  } as unknown as Tx;
  const domain = prismaDomain(tx);
  await domain.transactions.upsert(upsert('t1', 'acc_1').args);
  const answer = await domain.clearReplacedPending({ accountIds: ['acc_db_1'], transactionIds: ['p1', 'p2'] });
  assert.deepEqual(answer, { pending_cleared: 16, pending_kept: 27, pending_linked: 3 }, 'the statement\'s own answer — all three counts, each as it was answered');
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
  const strict = () => prismaDomain({ $executeRaw: async () => 1, $queryRaw: async () => { queries += 1; return [{ pending_cleared: 0, pending_kept: 0, pending_linked: 0 }]; } } as unknown as Tx);
  for (const bad of [
    { accountIds: [], transactionIds: ['p1'] }, { accountIds: ['a'], transactionIds: [] }, { accountIds: 'a', transactionIds: ['p1'] },
    { accountIds: ['a'], transactionIds: [7] }, { accountIds: ['a'], transactionIds: [''] }, { accountIds: ['a'] }, { accountIds: ['a'], transactionIds: ['p1'], amount: 12.5 },
  ]) {
    await assert.rejects(strict().clearReplacedPending(bad as never), UnsupportedDomainWriteError, JSON.stringify(bad));
  }
  assert.equal(queries, 0);

  // an answer that is not exactly one row of three counts is the table not answering — thrown, never read as none
  const whole = { pending_cleared: 1, pending_kept: 0, pending_linked: 0 };
  for (const answered of [
    [], [whole, whole],
    // PENDING-01 part 3: an answer that lacks ONE of the three — whichever one — is refused; a count nobody stated is never read as 0
    [{ pending_cleared: 1, pending_kept: 0 }], [{ pending_cleared: 1, pending_linked: 0 }], [{ pending_kept: 0, pending_linked: 0 }], [{ pending_cleared: 1 }],
    // a count that is not a non-negative safe integer, in each of the three places
    [{ ...whole, pending_cleared: '1' }], [{ ...whole, pending_cleared: -1 }], [{ ...whole, pending_cleared: 1.5 }], [{ ...whole, pending_cleared: BigInt(1) }],
    [{ ...whole, pending_kept: '0' }], [{ ...whole, pending_kept: null }],
    [{ ...whole, pending_linked: '0' }], [{ ...whole, pending_linked: -1 }], [{ ...whole, pending_linked: 0.5 }], [{ ...whole, pending_linked: BigInt(0) }], [{ ...whole, pending_linked: null }], [{ ...whole, pending_linked: undefined }],
  ]) {
    const odd = prismaDomain({ $executeRaw: async () => 1, $queryRaw: async () => answered } as unknown as Tx);
    await assert.rejects(odd.clearReplacedPending({ accountIds: ['a'], transactionIds: ['p1'] }), /^Error: prismaDomain: the pending step answered no count — the table is not answering$/, JSON.stringify(answered, (_k, v) => (typeof v === 'bigint' ? `${v}n` : v)));
  }
  // and the whole answer, alone, is taken as it is
  const good = prismaDomain({ $executeRaw: async () => 1, $queryRaw: async () => [whole] } as unknown as Tx);
  assert.deepEqual(await good.clearReplacedPending({ accountIds: ['a'], transactionIds: ['p1'] }), whole);
});

test('PENDING-03 the unlisted step is ONE statement, carrying its conditions — pending, the link\'s accounts, the two days both strict, not one of the ids, not committed, no live posting, nothing pointing at the row — and answering both counts', () => {
  const st = clearUnlistedPendingSql(['acc_db_1', 'acc_db_2'], '2026-09-10', '2026-09-01', ['t1', 't2', 'p9']);
  assert.equal(st.sql, UNLISTED_STATEMENT);
  assert.deepEqual(st.values, [['acc_db_1', 'acc_db_2'], '2026-09-01', '2026-09-10', ['t1', 't2', 'p9']], 'the accounts, the OLDEST day, the NEWEST day, the ids — each list one array parameter, so a page of any size is one statement');
  // the statement's three parts, in the order it writes them
  const at = (needle: string) => { const i = st.sql.indexOf(needle); assert.ok(i > -1, `the statement holds ${needle}`); return i; };
  const parts = ['WITH unlisted AS (', ', cleared AS (', ' SELECT (SELECT count(*) FROM cleared)::int AS pending_unlisted'].map(at);
  assert.deepEqual(parts, [...parts].sort((a, b) => a - b), 'unlisted → cleared → the answer');
  const unlisted = st.sql.slice(parts[0], parts[1]);
  const cleared = st.sql.slice(parts[1], parts[2]);
  // the rows the bank no longer lists, read off one page
  assert.ok(unlisted.includes('WHERE t.pending = true'), 'pending — a posted row is never judged');
  assert.ok(unlisted.includes('AND t."accountId" = ANY(?::text[])'), 'the accounts handed to the step');
  assert.ok(unlisted.includes('AND t."date"::date > ?::date'), 'strictly after the oldest day — the row\'s day, compared as a day');
  assert.ok(unlisted.includes('AND t."date"::date < ?::date'), 'strictly before the newest day');
  assert.ok(unlisted.indexOf('> ?::date') < unlisted.indexOf('< ?::date'), 'the oldest day is the first of the two day parameters, the newest the second — as the values ride');
  assert.equal(/>=|<=|BETWEEN/i.test(st.sql), false, 'both strict: a row dated on either edge day is not judged');
  assert.ok(unlisted.endsWith('AND t."transactionId" <> ALL(?::text[]))'), 'none of the ids the page accounts for');
  // of those, the rows it deletes: the first statement's three conditions, word for word
  const three = `AND t.review_status <> 'committed' AND NOT ${LIVE_POSTING} AND NOT ${BOOKING_LINK} AND NOT ${SETTLED_REFUND} RETURNING t.id)`;
  assert.ok(cleared.endsWith(three), 'not committed · no live posting · no booking link, whatever its status · no settled refund');
  assert.ok(clearReplacedPendingSql(['a'], ['p']).sql.includes(three), 'the same three, in the same words, as the replaced step\'s delete');
  assert.equal(st.sql.split('DELETE FROM').length - 1, 1, 'one delete');
  assert.match(st.sql, /cleared AS \(DELETE FROM transactions AS t USING unlisted AS u WHERE t\.id = u\.id AND /, 'it deletes transactions rows only, and only among the unlisted rows');
  assert.equal(/\b(UPDATE|INSERT)\b/.test(st.sql), false, 'nothing about a row that is left changes');
  // the two counts: what it deleted, and the unlisted rows it left — which only a committed, posted-from or pointed-at row can be
  assert.match(st.sql, / SELECT \(SELECT count\(\*\) FROM cleared\)::int AS pending_unlisted, \(\(SELECT count\(\*\) FROM unlisted\) - \(SELECT count\(\*\) FROM cleared\)\)::int AS pending_unlisted_left$/);
  // nothing is matched by amount, by name or by nearness of date; no value is written into the text
  assert.equal(/amount|\bname\b|merchant|interval|timestamp|float8/.test(st.sql), false, 'no amount, no name, no span of days');
  assert.equal(/2026|acc_db_1|t1|p9/.test(st.sql), false, 'every value is a bound parameter');
  assert.equal(st.sql.split('?').length - 1, 4, 'four parameters — the accounts, the two days, the ids');
});

test('PENDING-03 the binding runs the unlisted step at once — not buffered — counts its statement, hands back both counts, and refuses a call after finish(), malformed arguments and an answer that lacks a count', async () => {
  const ran: string[] = [];
  const asked: unknown[][] = [];
  const tx = {
    $executeRaw: async (q: { sql: string }) => { ran.push(`flush: ${q.sql.slice(0, 24)}`); return 1; },
    $queryRaw: async (q: { sql: string; values: unknown[] }) => {
      ran.push(`step: ${q.sql.slice(0, 16)}`);
      asked.push(q.values);
      return q.sql.startsWith('WITH unlisted AS') ? [{ pending_unlisted: 35, pending_unlisted_left: 2 }] : [{ pending_cleared: 1, pending_kept: 0, pending_linked: 0 }];
    },
  } as unknown as Tx;
  const args = { accountIds: ['acc_db_1'], newestDay: '2026-09-10', oldestDay: '2026-09-01', accountedIds: ['t1', 't2'] };
  const domain = prismaDomain(tx);
  await domain.transactions.upsert(upsert('t1', 'acc_1').args);
  const answer = await domain.clearUnlistedPending(args);
  assert.deepEqual(answer, { pending_unlisted: 35, pending_unlisted_left: 2 }, 'the statement\'s own answer — both counts, each as it was answered');
  assert.deepEqual(ran, ['step: WITH unlisted AS'], 'run at once — the upsert buffered before it has not run');
  assert.deepEqual(asked, [[['acc_db_1'], '2026-09-01', '2026-09-10', ['t1', 't2']]], 'handed the accounts, the two days and the ids it was given');
  assert.deepEqual(domain.stats(), { intents: 1, statements: 1 }, 'its statement is counted for the log line; it is no buffered intent');
  await domain.finish();
  assert.deepEqual(ran, ['step: WITH unlisted AS', 'flush: INSERT INTO transactions'], 'the flush comes after');
  assert.deepEqual(domain.stats(), { intents: 1, statements: 2 });
  await assert.rejects(domain.clearUnlistedPending(args), UnsupportedDomainWriteError, 'a call after finish is refused, like its siblings');
  assert.equal(ran.length, 2, 'and nothing ran for it');

  // both steps on one page: each is its own statement, run at once, in the order they are called, each counted
  ran.length = 0;
  const both = prismaDomain(tx);
  await both.clearReplacedPending({ accountIds: ['acc_db_1'], transactionIds: ['p1'] });
  await both.clearUnlistedPending(args);
  assert.deepEqual(ran, ['step: WITH named AS (S', 'step: WITH unlisted AS'], 'the replaced step\'s statement, then the unlisted step\'s');
  assert.deepEqual(both.stats(), { intents: 0, statements: 2 });

  // arguments that are not { accountIds, newestDay, oldestDay, accountedIds } — two lists of at least one id, two
  // calendar days, the oldest strictly before the newest — are refused before anything runs
  let queries = 0;
  const strict = () => prismaDomain({ $executeRaw: async () => 1, $queryRaw: async () => { queries += 1; return [{ pending_unlisted: 0, pending_unlisted_left: 0 }]; } } as unknown as Tx);
  for (const bad of [
    { ...args, accountIds: [] }, { ...args, accountedIds: [] }, { ...args, accountIds: 'a' }, { ...args, accountedIds: [7] }, { ...args, accountedIds: [''] },
    { accountIds: ['a'], newestDay: '2026-09-10', oldestDay: '2026-09-01' }, { ...args, amount: 12.5 },
    // the two days: one day is no window; the oldest after the newest; not the form; not a calendar day; not text
    { ...args, newestDay: '2026-09-01' }, { ...args, newestDay: '2026-08-31' }, { ...args, newestDay: '2026-9-10' }, { ...args, oldestDay: '2026-02-30' }, { ...args, oldestDay: null },
    { ...args, newestDay: new Date('2026-09-10') }, { ...args, oldestDay: '2026-09-01T00:00:00Z' }, { ...args, newestDay: "2026-09-10'::date; --" },
  ]) {
    await assert.rejects(strict().clearUnlistedPending(bad as never), UnsupportedDomainWriteError, JSON.stringify(bad));
  }
  assert.equal(queries, 0);
  await assert.rejects(strict().clearUnlistedPending({ ...args, accountIds: [] }), /^UnsupportedDomainWriteError: prismaDomain: clearUnlistedPending must be \{ accountIds, newestDay, oldestDay, accountedIds \} — each list of at least one id, the two days calendar days \(YYYY-MM-DD\) with the oldest strictly before the newest — /);
  assert.equal(queries, 0);

  // an answer that is not exactly one row of two counts is the table not answering — thrown, never read as none
  const whole = { pending_unlisted: 1, pending_unlisted_left: 0 };
  for (const answered of [
    [], [whole, whole],
    // an answer that lacks either count is refused; a count nobody stated is never read as 0
    [{ pending_unlisted: 1 }], [{ pending_unlisted_left: 0 }], [{}], [{ pending_cleared: 1, pending_kept: 0, pending_linked: 0 }],
    // a count that is not a non-negative safe integer, in each of the two places
    [{ ...whole, pending_unlisted: '1' }], [{ ...whole, pending_unlisted: -1 }], [{ ...whole, pending_unlisted: 1.5 }], [{ ...whole, pending_unlisted: BigInt(1) }], [{ ...whole, pending_unlisted: null }],
    [{ ...whole, pending_unlisted_left: '0' }], [{ ...whole, pending_unlisted_left: -1 }], [{ ...whole, pending_unlisted_left: 0.5 }], [{ ...whole, pending_unlisted_left: BigInt(0) }], [{ ...whole, pending_unlisted_left: null }], [{ ...whole, pending_unlisted_left: undefined }],
  ]) {
    const odd = prismaDomain({ $executeRaw: async () => 1, $queryRaw: async () => answered } as unknown as Tx);
    await assert.rejects(odd.clearUnlistedPending(args), /^Error: prismaDomain: the unlisted step answered no count — the table is not answering$/, JSON.stringify(answered, (_k, v) => (typeof v === 'bigint' ? `${v}n` : v)));
  }
  // and the whole answer, alone, is taken as it is
  const good = prismaDomain({ $executeRaw: async () => 1, $queryRaw: async () => [whole] } as unknown as Tx);
  assert.deepEqual(await good.clearUnlistedPending(args), whole);
});

test('runTransactionsPage finishes a buffering port inside the page transaction, after the parser — and the two pending steps run inside it too, the replaced step then the unlisted step, before the flush', async () => {
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
  let unlistedStepped = 0;
  const unlistedAsked: unknown[][] = [];
  const tx = {
    $executeRaw: async () => { executed += 1; order.push('flush'); return 1; },
    // PENDING-03: the binding runs two statements through $queryRaw now — told apart by their own first words
    $queryRaw: async (q: { sql: string; values: unknown[] }) => {
      if (q.sql.startsWith('WITH unlisted AS')) { unlistedStepped += 1; unlistedAsked.push(q.values); order.push('unlisted step'); return [{ pending_unlisted: 4, pending_unlisted_left: 1 }]; }
      stepped += 1;
      order.push('pending step');
      return [{ pending_cleared: 1, pending_kept: 0, pending_linked: 2 }];
    },
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
  if (result.ok) for (const name of ['pending_cleared', 'pending_kept', 'pending_linked']) assert.equal(name in result.counts, false, `${name} is not carried by a page where the step did not run`);

  // a posted row that names a pending charge: the step, inside the transaction, after the parse and before the flush
  order.length = 0;
  const named = await runTransactionsPage(client, ports, page([{ transaction_id: 't2', account_id: 'acc_p1', amount: 5, date: '2026-06-10', name: 'x', pending: false, pending_transaction_id: 'p2' }]));
  assert.equal(named.ok, true);
  assert.deepEqual(order, ['BEGIN', 'response', 'arrivals', 'pending step', 'markRead', 'flush', 'COMMIT']);
  assert.equal(stepped, 1);
  if (named.ok) assert.deepEqual([named.counts.pending_cleared, named.counts.pending_kept, named.counts.pending_linked], [1, 0, 2], 'the page\'s counts carry the statement\'s answer — all three');
  // PENDING-03: both pages above are pages of one object — they have no window, so the unlisted step ran on neither
  assert.equal(unlistedStepped, 0, 'a page with no window runs no unlisted step');
  if (named.ok) for (const name of ['pending_unlisted', 'pending_unlisted_left']) assert.equal(name in named.counts, false, `${name} is not carried by a page where the unlisted step did not run`);

  // PENDING-03 — a page of two days whose posted row names a pending charge: BOTH steps, inside the transaction, the
  // replaced step then the unlisted step, after the parse and before the flush — three statements in all
  order.length = 0;
  executed = 0;
  const spanned = await runTransactionsPage(client, ports, page([
    { transaction_id: 't3', account_id: 'acc_p1', amount: 5, date: '2026-06-12', name: 'x', pending: false, pending_transaction_id: 'p3' },
    { transaction_id: 't4', account_id: 'acc_other', amount: 7, date: '2026-06-10', name: 'y', pending: false },
  ]));
  assert.equal(spanned.ok, true);
  assert.deepEqual(order, ['BEGIN', 'response', 'arrivals', 'pending step', 'unlisted step', 'markRead', 'flush', 'COMMIT']);
  assert.deepEqual([stepped, unlistedStepped, executed], [2, 1, 1], 'one statement for each pending step, one for the flush');
  assert.deepEqual(unlistedAsked, [[['acc_db'], '2026-06-10', '2026-06-12', ['t3', 't4', 'p3']]], 'the link\'s account row ids · the page\'s oldest day (an unheld account\'s object) · its newest · every id it lists, then the id the replaced step was handed');
  if (spanned.ok) {
    assert.deepEqual([spanned.counts.pending_cleared, spanned.counts.pending_kept, spanned.counts.pending_linked], [1, 0, 2], 'the replaced step\'s three counts are what they were');
    assert.deepEqual([spanned.counts.pending_unlisted, spanned.counts.pending_unlisted_left], [4, 1], 'the page\'s counts carry the second statement\'s answer — both');
  }
});
