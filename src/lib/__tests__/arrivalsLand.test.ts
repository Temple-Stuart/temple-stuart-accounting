import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Transaction } from 'plaid';
import { MAX_RESPONSE_BODY_BYTES, ResponseTooLargeError, canonicalBytes, fingerprintOf, landObjects, landResponse, sha256 } from '../arrivals/land';
import { FakeLanding, snapshotClient } from './fakeLanding';
import { NoRuleError } from '../providers';
import { landTransactionsPage, pageFailed, recordFailedAnswer, replacedPendingIds, runTransactionsPage, type DomainDb, type TransactionsPageInput } from '../arrivals/plaidTransactionsPage';
import { failedLine, stageFailed, syncEnvelope, syncItemsEnvelope } from '../plaid/failLoud';
import { onWireError, type WireStamp } from '../plaid/wire';
import { code } from '../sourceText';

// REBUILD-01 PR-2 — landing. Hermetic: a fake LandingDb with the table's own
// rules (UNIQUE on provider + their_id + fingerprint — the same thing is the
// same provider, id and content; read / status move once) and a fake
// transaction client that discards a page's writes when the page throws.
//
// SYNC-01 (2026-11-11): a page's counts gain two — `unheld` (an object for an account the link holds no row for:
// counted, never dropped without a word) and `added` (written as a NEW row of the app; not `landed`, which counts
// first arrivals in the store). Until then the whole-count pins below read { landed, already_landed, corrected,
// synced, skipped } alone.
//
// SYNC-02 (Alex, 2026-11-11 16:25 — his first Sync on SYNC-01: both Wells Fargo links failed on "transactions page 4 …
// violates check constraint provider_responses_body_size_chk"): an answer too large to store is refused BY NAME,
// before the insert, and its bank's line says so in the product's own words with both sizes. The four tests at the
// foot of this file: the refusal and its edge; the limit held equal to the migration's CHECK; the transactions runner's
// line; every other error's words as they were.
//
// PENDING-01 (Alex, 2026-11-11): THE SYNC CLEARS A PENDING ROW ONLY ON PLAID'S OWN WORD, AND NEVER A COMMITTED ONE.
// Until then the parser deleted, for every posted transaction it parsed, every pending row of the same account and
// amount within two days (the fake domain's deleteMany counted those calls). The guess is gone: once per page the
// pending charges the page's posted objects NAME go to one port method, which the fake domain below answers over its
// own table. The tests after the SYNC-02 ones hold the rule; the statement is held in prismaDomainPlan.test.ts.

// The fake store lives in fakeLanding.ts (PR-2c shares it with the investments landing tests).

type Upsert = { where: { transactionId: string }; create: Record<string, unknown>; update: Record<string, unknown> };
type Link = { where: Record<string, unknown>; data: Record<string, unknown> };

class FakeDomain implements DomainDb {
  upserts: Upsert[] = [];
  links: Link[] = [];
  /** what the domain table would hold after the upserts, keyed by transactionId */
  rows = new Map<string, Record<string, unknown>>();
  /** PENDING-01: the transactionIds that carry a live posting (a journal entry of source plaid_txn, not a reversal, not reversed). */
  livePostings = new Set<string>();
  /** PENDING-01: every call of the page's pending step, as it was handed. */
  clearCalls: Array<{ accountIds: string[]; transactionIds: string[] }> = [];
  constructor(private throwOn: string | null = null) {}
  transactions = {
    upsert: async (args: Upsert) => {
      if (this.throwOn && args.where.transactionId === this.throwOn) {
        throw new Error('Invalid `prisma.transactions.upsert()` invocation: column "arrival_id" of relation "transactions" does not exist');
      }
      this.upserts.push(args);
      const prev = this.rows.get(args.where.transactionId);
      this.rows.set(args.where.transactionId, prev ? { ...prev, ...args.update } : { ...args.create });
      return {};
    },
    updateMany: async (args: Link) => { this.links.push(args); return {}; },
  };
  /**
   * PENDING-01: the page's pending step over the fake table — the statement's rule in TypeScript (the statement itself
   * is held by content in prismaDomainPlan.test.ts). A named row that is pending, on one of the accounts, is deleted
   * unless it is committed or carries a live posting; then it is counted as kept and nothing about it changes.
   */
  clearReplacedPending = async (args: { accountIds: string[]; transactionIds: string[] }) => {
    this.clearCalls.push(args);
    let pending_cleared = 0;
    let pending_kept = 0;
    for (const id of args.transactionIds) {
      const row = this.rows.get(id);
      if (!row || row.pending !== true || !args.accountIds.includes(String(row.accountId))) continue;
      if (row.review_status === 'committed' || this.livePostings.has(id)) { pending_kept += 1; continue; }
      this.rows.delete(id);
      pending_cleared += 1;
    }
    return { pending_cleared, pending_kept };
  };
}

const wire = (json: string) => ({ body: Buffer.from(json, 'utf8'), asked: new Date('2026-09-03T10:00:00Z'), arrived: new Date('2026-09-03T10:00:01Z') });
const txn = (id: string, extra: Partial<Transaction> = {}): Transaction => ({
  transaction_id: id, account_id: 'acc_plaid_1', amount: 12.5, date: '2026-09-01', name: `Coffee ${id}`, pending: false,
  iso_currency_code: 'USD', unofficial_currency_code: null, category: ['Food'], category_id: '1', location: {} as Transaction['location'],
  payment_meta: {} as Transaction['payment_meta'], account_owner: null, pending_transaction_id: null, authorized_date: null, authorized_datetime: null,
  datetime: null, payment_channel: 'in store', transaction_code: null, ...extra,
} as Transaction);
const pageInput = (over: Partial<TransactionsPageInput>): TransactionsPageInput => ({
  page: 1, userId: 'user_1', connection: 'item_abc', accounts: [{ id: 'acc_db_1', accountId: 'acc_plaid_1' }], existing: new Map(),
  wire: wire('{"transactions":[]}'), httpStatus: 200, transactions: [], now: () => new Date('2026-09-03T10:00:02Z'), ...over,
});

test('(a) JCS canonicalization is key-order independent and the fingerprint is stable', () => {
  const x = { b: 1, a: [2, { d: 'é', c: null }], z: { y: true, x: 1.5 } };
  const y = { z: { x: 1.5, y: true }, a: [2, { c: null, d: 'é' }], b: 1 };
  assert.equal(canonicalBytes(x).toString('utf8'), '{"a":[2,{"c":null,"d":"é"}],"b":1,"z":{"x":1.5,"y":true}}');
  assert.deepEqual(canonicalBytes(x), canonicalBytes(y));
  assert.deepEqual(fingerprintOf(x), fingerprintOf(y));
  assert.equal(fingerprintOf(x).length, 32);
  assert.deepEqual(fingerprintOf(x), sha256(canonicalBytes(y)));
  assert.notDeepEqual(fingerprintOf(x), fingerprintOf({ ...x, b: 2 }));
  assert.throws(() => canonicalBytes(undefined), /no JCS form/);
});

test('(b)(e) same id + same content → one row, already_landed; a repeat within the answer lands once', async () => {
  const landing = new FakeLanding();
  const resp = await landResponse(landing, { provider: 'plaid', resource: 'transaction', userId: 'u', guestRef: null, httpStatus: 200, body: Buffer.from('{}'), asked: new Date(), arrived: new Date() });
  assert.equal(landing.responses.length, 1);
  assert.deepEqual(landing.responses[0].body_sha256, sha256(Buffer.from('{}')));
  const base = { provider: 'plaid', resource: 'transaction', connection: 'item_abc', userId: 'u', guestRef: null, responseId: resp.id, asked: new Date(), arrived: new Date() };
  const first = await landObjects(landing, { ...base, objects: [{ theirId: 't1', payload: { transaction_id: 't1', amount: 1 } }, { theirId: 't1', payload: { transaction_id: 't1', amount: 1 } }] });
  assert.deepEqual([first.landed, first.alreadyLanded, first.corrected, first.repeatedInAnswer], [1, 1, 0, 1]);
  assert.equal(first.rows.length, 1);
  assert.equal(first.rows[0].outcome, 'landed');
  assert.equal(landing.arrivals.size, 1);
  // the same content in a later answer: promise 2 — one row, already landed
  const second = await landObjects(landing, { ...base, objects: [{ theirId: 't1', payload: { amount: 1, transaction_id: 't1' } }, { theirId: 't2', payload: { transaction_id: 't2', amount: 2 } }] });
  assert.deepEqual([second.landed, second.alreadyLanded, second.corrected], [1, 1, 0]);
  assert.deepEqual(second.rows.map((r) => [r.their_id, r.outcome]), [['t1', 'already_landed'], ['t2', 'landed']]);
  assert.equal(second.rows[0].id, first.rows[0].id, 'the very row the first answer landed');
  assert.equal(landing.arrivals.size, 2);
  // the page counts it as already_landed and links instead of re-parsing
  const domain = new FakeDomain();
  const counts = await landTransactionsPage(landing, domain, pageInput({ transactions: [txn('t1', { amount: 1, name: 'x' } as Partial<Transaction>), txn('t3')] }));
  assert.equal(counts.already_landed + counts.landed + counts.corrected, 2);
  assert.equal(counts.landed, 1);
  assert.equal(domain.upserts.length, 2, 'the t1 payload differs from the stored { transaction_id, amount } object, so it is a correction here');
});

test('(e) same id + same content, through the page: one row, already_landed, linked, not re-parsed', async () => {
  const landing = new FakeLanding();
  const domain = new FakeDomain();
  const t = txn('t1');
  const p1 = await landTransactionsPage(landing, domain, pageInput({ page: 1, transactions: [t] }));
  assert.deepEqual(p1, { landed: 1, already_landed: 0, corrected: 0, synced: 1, skipped: 0, unheld: 0, added: 1 });
  const p2 = await landTransactionsPage(landing, domain, pageInput({ page: 2, transactions: [{ ...t }] }));
  assert.deepEqual(p2, { landed: 0, already_landed: 1, corrected: 0, synced: 0, skipped: 0, unheld: 0, added: 0 });
  assert.equal(landing.rowsFor('t1').length, 1, 'one row');
  assert.equal(domain.upserts.length, 1, 'not re-parsed');
  assert.equal(domain.links.length, 1, 'linked');
  assert.equal(domain.links[0].data.arrival_id, landing.rowsFor('t1')[0].row.id);
});

test('(f) same id + changed content → two rows, corrected = 1, the domain row carries the new values and the newest arrival_id', async () => {
  const landing = new FakeLanding();
  const domain = new FakeDomain();
  const original = txn('t1', { amount: 12.5, name: 'Coffee' });
  const p1 = await landTransactionsPage(landing, domain, pageInput({ page: 1, transactions: [original] }));
  assert.deepEqual(p1, { landed: 1, already_landed: 0, corrected: 0, synced: 1, skipped: 0, unheld: 0, added: 1 });
  const firstId = landing.rowsFor('t1')[0].row.id;
  // the provider corrects the amount; the row is even marked "complete" (the skip must not apply to a correction)
  const corrected = txn('t1', { amount: 13.75, name: 'Coffee (corrected)' });
  const existing = new Map([['t1', { transactionId: 't1', personal_finance_category: { primary: 'FOOD' } }]]);
  const p2 = await landTransactionsPage(landing, domain, pageInput({ page: 2, existing, transactions: [corrected] }));
  assert.deepEqual(p2, { landed: 0, already_landed: 0, corrected: 1, synced: 1, skipped: 0, unheld: 0, added: 0 });
  const rows = landing.rowsFor('t1');
  assert.equal(rows.length, 2, 'two rows');
  const newest = rows.find((r) => r.row.id !== firstId);
  assert.ok(newest);
  assert.equal(newest.status, 'done');
  assert.notDeepEqual(Buffer.from(newest.row.fingerprint), Buffer.from(rows[0].row.fingerprint === newest.row.fingerprint ? rows[1].row.fingerprint : rows[0].row.fingerprint));
  assert.equal(domain.upserts.length, 2);
  const domainRow = domain.rows.get('t1');
  assert.ok(domainRow);
  assert.equal(domainRow.amount, 13.75);
  assert.equal(domainRow.name, 'Coffee (corrected)');
  assert.equal(domainRow.arrival_id, newest.row.id, 'arrival_id moved to the newest arrival');
  // the original content arriving again is still the same thing: already landed, no third row
  const p3 = await landTransactionsPage(landing, domain, pageInput({ page: 3, transactions: [original] }));
  assert.deepEqual(p3, { landed: 0, already_landed: 1, corrected: 0, synced: 0, skipped: 0, unheld: 0, added: 0 });
  assert.equal(landing.rowsFor('t1').length, 2);
});

test('the parser reads the arrival row, never the HTTP object, and every new arrival is read once', async () => {
  const landing = new FakeLanding();
  const domain = new FakeDomain();
  const t = txn('t9', { name: 'As landed' });
  const counts = await landTransactionsPage(landing, domain, pageInput({ transactions: [t] }));
  t.name = 'Mutated after landing';
  assert.deepEqual(counts, { landed: 1, already_landed: 0, corrected: 0, synced: 1, skipped: 0, unheld: 0, added: 1 });
  assert.equal(domain.upserts[0].create.name, 'As landed');
  // FX-01 (2026-10-30, ruling E): the landed row carries Plaid's own currency code from the arrival payload.
  assert.equal(domain.upserts[0].create.iso_currency_code, 'USD');
  const a = [...landing.arrivals.values()][0];
  assert.equal(domain.upserts[0].create.arrival_id, a.row.id);
  assert.equal(a.status, 'done');
  assert.deepEqual(a.read, new Date('2026-09-03T10:00:02Z'));
  assert.equal(a.row.their_id_kind, 'provider');
  assert.deepEqual(a.row.redactions, []);
  assert.equal(a.row.connection, 'item_abc');
  // structuredClone hands back a plain Uint8Array — compare the bytes, not the class.
  assert.equal(Buffer.compare(Buffer.from(a.row.fingerprint), fingerprintOf({ ...t, name: 'As landed' })), 0);
  assert.equal(landing.responses[0].http_status, 200);
  assert.deepEqual(landing.responses[0].redactions, [], 'PR-4b: a Plaid answer declares no redaction — the exact wire bytes');
  await assert.rejects(landing.markRead([a.row.id], new Date()), /read is set once/);
});

test("(c) a parser throw leaves the page's arrivals absent (rollback) and returns the envelope with the page", async () => {
  const landing = new FakeLanding();
  const domain = new FakeDomain('t2');
  const client = {
    async $transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
      const snap = landing.snapshot();
      try {
        return await fn({});
      } catch (e) {
        landing.restore(snap);
        throw e;
      }
    },
  };
  const result = await runTransactionsPage(client, () => ({ landing, domain }), pageInput({ page: 3, transactions: [txn('t1'), txn('t2')] }));
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.failure.stage, 'transactions');
  assert.equal(result.failure.page, 3);
  assert.equal(result.failure.ok, false);
  assert.match(result.failure.error.message ?? '', /does not exist/);
  assert.match(result.failure.message, /^Error: Invalid/);
  assert.equal(landing.arrivals.size, 0, "the page's arrivals rolled back");
  assert.equal(landing.responses.length, 0, "the page's response row rolled back");
  // earlier pages stay: a page that succeeds is untouched by a later failure
  const ok = await runTransactionsPage(client, () => ({ landing, domain: new FakeDomain() }), pageInput({ page: 2, transactions: [txn('t5')] }));
  assert.equal(ok.ok, true);
  const again = await runTransactionsPage(client, () => ({ landing, domain }), pageInput({ page: 3, transactions: [txn('t1'), txn('t2')] }));
  assert.equal(again.ok, false);
  assert.equal(landing.arrivals.size, 1);
});

test('(g) a 429 answer produces one provider_responses row, zero arrivals, and the 429 envelope', async () => {
  const landing = new FakeLanding();
  const body = Buffer.from('{"error_type":"RATE_LIMIT_EXCEEDED","error_code":"TRANSACTIONS_LIMIT","error_message":"slow down","request_id":"r9"}');
  const err = Object.assign(new Error('Request failed with status code 429'), { response: { data: body as unknown, status: 429, config: { wireAsked: new Date('2026-09-03T10:00:00Z') }, wire: undefined as WireStamp | undefined } });
  await assert.rejects(onWireError(err, () => new Date('2026-09-03T10:00:01Z')));
  const recorded = await recordFailedAnswer(landing, { userId: 'user_1', err });
  assert.deepEqual(recorded, { landed: true, status: 429 });
  assert.equal(landing.responses.length, 1);
  assert.equal(landing.responses[0].http_status, 429);
  assert.equal(Buffer.compare(landing.responses[0].body, body), 0, 'the exact bytes of the refusal');
  assert.deepEqual(landing.responses[0].body_sha256, sha256(body));
  assert.deepEqual(landing.responses[0].asked, new Date('2026-09-03T10:00:00Z'));
  assert.equal(landing.arrivals.size, 0, 'zero arrivals');
  const failure = stageFailed('transactions', err, 1);
  const { status, body: envelope } = syncEnvelope([failure]);
  assert.equal(status, 429);
  assert.equal(envelope.ok, false);
  assert.equal((envelope.error as { error_type: string }).error_type, 'RATE_LIMIT_EXCEEDED');
  assert.match(String(envelope.message), /transactions \(page 1\): Plaid: RATE_LIMIT_EXCEEDED \(TRANSACTIONS_LIMIT\) — try again in a few minutes/);
  // a network failure with no answer lands nothing — there was no answer to keep
  assert.deepEqual(await recordFailedAnswer(landing, { userId: 'user_1', err: new Error('ECONNRESET') }), { landed: false });
  assert.equal(landing.responses.length, 1);
});


// ── RULEBOOK-01 ──

test('a feed with no rule throws before anything is built — no response consulted, zero arrivals, the name of the missing rule', async () => {
  const landing = new FakeLanding();
  const asked = new Date('2026-09-07T10:00:00Z');
  await assert.rejects(
    landObjects(landing, { provider: 'plaid', resource: 'balance', connection: 'item_abc', userId: 'user_1', guestRef: null, responseId: 'resp_x', asked, arrived: asked, objects: [{ theirId: 'b1', payload: { account_id: 'a', current: 10 } }] }),
    (e: unknown) => e instanceof NoRuleError && /no rule for plaid · balance/.test((e as Error).message),
  );
  assert.equal(landing.arrivals.size, 0, 'nothing landed');
  // an unknown provider still fails first, as before
  await assert.rejects(landObjects(landing, { provider: 'yodlee', resource: 'transaction', connection: null, userId: 'user_1', guestRef: null, responseId: 'resp_x', asked, arrived: asked, objects: [] }), /not a provider the deck names/);
  assert.equal(landing.arrivals.size, 0);
});

test('kinds land as the book says: a transaction is an event, a security a reference, an investment transaction an event — on every row, read back from the table', async () => {
  const landing = new FakeLanding();
  const domain = new FakeDomain();
  await landTransactionsPage(landing, domain, pageInput({ transactions: [txn('t1'), txn('t2')] }));
  assert.deepEqual([...landing.arrivals.values()].map((a) => a.row.kind), ['event', 'event']);
  const asked = new Date('2026-09-07T10:00:00Z');
  const base = { provider: 'plaid', connection: 'item_abc', userId: 'user_1', guestRef: null, responseId: 'resp_x', asked, arrived: asked };
  await landObjects(landing, { ...base, resource: 'security', objects: [{ theirId: 'sec_1', payload: { security_id: 'sec_1', name: 'X' } }] });
  await landObjects(landing, { ...base, resource: 'investment_transaction', objects: [{ theirId: 'inv_1', payload: { investment_transaction_id: 'inv_1', amount: 1 } }] });
  await landObjects(landing, { ...base, resource: 'holding', objects: [{ theirId: 'h_1', payload: { account_id: 'a', quantity: 2 } }] });
  const kinds = Object.fromEntries([...landing.arrivals.values()].map((a) => [a.row.their_id, a.row.kind]));
  assert.deepEqual(kinds, { t1: 'event', t2: 'event', sec_1: 'reference', inv_1: 'event', h_1: 'snapshot' });
});


// ── SYNC-02 ──

/** The refusal's own sentence for an answer of 1,180,442 bytes — exact bytes, thousands separators, nothing rounded. */
const TOO_LARGE_WORDS = 'the answer is 1,180,442 bytes — over the 1,048,576 one stored answer may hold; nothing from it was written';
/** An answer of exactly `bytes` bytes. */
const answerOf = (bytes: number) => ({ provider: 'plaid', resource: 'transaction', userId: 'u', guestRef: null, httpStatus: 200, body: Buffer.alloc(bytes, 0x20), asked: new Date('2026-11-11T16:25:00Z'), arrived: new Date('2026-11-11T16:25:01Z') });

test('SYNC-02 an answer too large to store is refused by name before the insert — the error carries both sizes and nothing is inserted; at exactly the limit it lands', async () => {
  const landing = new FakeLanding();
  await assert.rejects(landResponse(landing, answerOf(1_180_442)), (e: unknown) => {
    assert.ok(e instanceof ResponseTooLargeError, 'the named error');
    assert.equal(e.name, 'ResponseTooLargeError');
    assert.equal(e.bytes, 1_180_442, 'the answer\'s bytes');
    assert.equal(e.limit, 1_048_576, 'the limit');
    assert.equal(e.message, TOO_LARGE_WORDS);
    return true;
  });
  assert.equal(landing.responses.length, 0, 'thrown BEFORE insertResponse — the store was never handed the row');
  // one byte over is over, said to the byte
  await assert.rejects(landResponse(landing, answerOf(MAX_RESPONSE_BODY_BYTES + 1)), (e: unknown) => e instanceof ResponseTooLargeError && e.bytes === 1_048_577 && e.message === 'the answer is 1,048,577 bytes — over the 1,048,576 one stored answer may hold; nothing from it was written');
  assert.equal(landing.responses.length, 0);
  // exactly the limit is not over it: the table's CHECK is <=, and so is this
  const atLimit = answerOf(MAX_RESPONSE_BODY_BYTES);
  const landed = await landResponse(landing, atLimit);
  assert.equal(landing.responses.length, 1, 'it lands');
  assert.equal(landing.responses[0].id, landed.id);
  assert.equal(landing.responses[0].body.length, 1_048_576);
  assert.deepEqual(landing.responses[0].body_sha256, sha256(atLimit.body));
});

test('SYNC-02 the limit is the table\'s own: MAX_RESPONSE_BODY_BYTES equals the number in the migration\'s CHECK, read from the migration\'s text — and no other migration names that CHECK', () => {
  const ARRIVALS = 'prisma/migrations/20260903000000_arrivals/migration.sql';
  const check = /CONSTRAINT provider_responses_body_size_chk CHECK \(octet_length\(body\) <= (\d+)\)/.exec(code(ARRIVALS));
  assert.ok(check, `${ARRIVALS} holds the CHECK by its name`);
  assert.equal(MAX_RESPONSE_BODY_BYTES, Number(check[1]), 'the constant is the number the table enforces');
  assert.equal(MAX_RESPONSE_BODY_BYTES, 1_048_576);
  // A migration is never edited, so the table's limit can only move in a NEWER one. This holds the arrivals migration
  // as the only one that names the CHECK: a migration that drops or re-adds it turns this red, by name.
  const naming = readdirSync(resolve(process.cwd(), 'prisma/migrations')).filter((d) => /^\d{14}_/.test(d)).sort()
    .map((d) => `prisma/migrations/${d}/migration.sql`)
    .filter((file) => code(file).includes('provider_responses_body_size_chk'));
  assert.deepEqual(naming, [ARRIVALS], 'another migration names provider_responses_body_size_chk — the table\'s limit moved; MAX_RESPONSE_BODY_BYTES must be the number the newest one states');
});

test('SYNC-02 the transactions runner turns the refusal into the bank\'s line in the product\'s own words — no error-class name in front; the page rolls back whole, the page before it stays', async () => {
  const landing = new FakeLanding();
  const domain = new FakeDomain();
  // page 6 fits and lands
  const before = await runTransactionsPage(snapshotClient(landing), () => ({ landing, domain }), pageInput({ page: 6, transactions: [txn('t_page6')] }));
  assert.equal(before.ok, true);
  // page 7's answer is 1,180,442 bytes
  let rolledBack = 0;
  const result = await runTransactionsPage(snapshotClient(landing, () => { rolledBack += 1; }), () => ({ landing, domain }), pageInput({ page: 7, wire: wire(' '.repeat(1_180_442)), transactions: [txn('t1'), txn('t2')] }));
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.failure.stage, 'transactions');
  assert.equal(result.failure.page, 7);
  assert.equal(result.failure.message, TOO_LARGE_WORDS, 'the failure\'s message is the refusal\'s own sentence');
  assert.deepEqual(result.failure.error, { name: 'ResponseTooLargeError', message: TOO_LARGE_WORDS }, 'the summary the server logs still names the class');
  // the bank's line, as the banner writes it — and as the route's envelope carries it
  const LINE = `Wells Fargo — transactions page 7: ${TOO_LARGE_WORDS}`;
  assert.equal(failedLine('Wells Fargo', result.failure), LINE);
  assert.equal(LINE, 'Wells Fargo — transactions page 7: the answer is 1,180,442 bytes — over the 1,048,576 one stored answer may hold; nothing from it was written');
  const envelope = syncItemsEnvelope([{ institution: 'Wells Fargo', key: 'link_wf', stages: [result.failure] }]);
  assert.deepEqual(envelope.body.lines, [LINE]);
  assert.equal(envelope.status, 500, 'the same failure it was: a local throw, declared — every stage of the only link failed');
  // the page rolled back whole: nothing from the answer was written, the parser never ran; page 6 stays
  assert.equal(rolledBack, 1, 'the page\'s own transaction rolled back');
  assert.equal(landing.responses.length, 1, 'only page 6\'s answer is held');
  assert.equal(landing.arrivals.size, 1);
  assert.equal(landing.rowsFor('t1').length + landing.rowsFor('t2').length, 0);
  assert.deepEqual(domain.upserts.map((u) => u.where.transactionId), ['t_page6']);
});

test('SYNC-02 every other error keeps the words it had: a Prisma-shaped error still prints as `<error name>: <error message>`, a Plaid error as Plaid\'s code', async () => {
  // In shape, what the screen printed on 2026-11-11: an error class's name, then the database's own refusal. The name
  // below stands for whichever class the driver raises — this holds the SHAPE of the words, not which class it was.
  const refusal = Object.assign(new Error('Invalid `prisma.provider_responses.create()` invocation: new row for relation "provider_responses" violates check constraint "provider_responses_body_size_chk"'), { name: 'PrismaClientUnknownRequestError' });
  const landing = new FakeLanding();
  landing.insertResponse = async () => { throw refusal; };
  const result = await runTransactionsPage(snapshotClient(landing), () => ({ landing, domain: new FakeDomain() }), pageInput({ page: 4, transactions: [txn('t1')] }));
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.failure.message, 'PrismaClientUnknownRequestError: Invalid `prisma.provider_responses.create()` invocation: new row for relation "provider_responses" violates check constraint "provider_responses_body_size_chk"');
  assert.deepEqual(result.failure, { ...stageFailed('transactions', refusal, 4), page: 4 }, 'exactly what stageFailed declares');
  assert.equal(failedLine('Wells Fargo', result.failure), `Wells Fargo — transactions page 4: PrismaClientUnknownRequestError: ${refusal.message}`);
  // the helper itself: for anything but the named refusal it IS stageFailed — a plain Error, a Plaid answer, a thrown string
  const rateLimited = Object.assign(new Error('Request failed with status code 429'), { response: { status: 429, data: { error_type: 'RATE_LIMIT_EXCEEDED', error_code: 'TRANSACTIONS_LIMIT', error_message: 'slow down', request_id: 'r9' } } });
  for (const thrown of [new Error('parser: amount is not a number'), rateLimited, 'offline', refusal]) {
    assert.deepEqual(pageFailed('transactions', thrown, 2), stageFailed('transactions', thrown, 2));
    assert.deepEqual(pageFailed('holdings', thrown), stageFailed('holdings', thrown));
  }
  assert.equal(pageFailed('transactions', rateLimited, 2).message, 'Plaid: RATE_LIMIT_EXCEEDED (TRANSACTIONS_LIMIT) — try again in a few minutes');
  // and for the named refusal: the same failure, its message the refusal's own sentence — with the page, and with none
  const tooLarge = new ResponseTooLargeError(1_180_442);
  assert.deepEqual(pageFailed('investments', tooLarge, 3), { ...stageFailed('investments', tooLarge, 3), message: TOO_LARGE_WORDS });
  assert.deepEqual(pageFailed('holdings', tooLarge), { stage: 'holdings', ok: false, error: { name: 'ResponseTooLargeError', message: TOO_LARGE_WORDS }, message: TOO_LARGE_WORDS });
  assert.equal(stageFailed('investments', tooLarge, 3).message, `ResponseTooLargeError: ${TOO_LARGE_WORDS}`, 'what the line would have read without the helper — the class name in front');
});


// ── PENDING-01 ──

/** A pending bank row the app holds, as the domain table would hold it — the same account, amount and day as txn()'s. */
const heldPending = (domain: FakeDomain, id: string, over: Record<string, unknown> = {}) => {
  const row = { id: `txn_${id}`, transactionId: id, accountId: 'acc_db_1', amount: 12.5, date: new Date('2026-09-01'), name: `Coffee ${id}`, pending: true, review_status: 'pending_review', ...over };
  domain.rows.set(id, row);
  return row;
};
/** The page's counts when nothing is named: the seven it always carries, and neither pending count. */
const NO_PENDING_STEP = ['landed', 'already_landed', 'corrected', 'synced', 'skipped', 'unheld', 'added'];

test('PENDING-01 a posted object that names a held, uncommitted pending row calls the step once — with that id and the link\'s account row ids, after the page is parsed and before it is marked read — and the page\'s counts carry what it answered', async () => {
  const landing = new FakeLanding();
  const domain = new FakeDomain();
  heldPending(domain, 'p1');
  // the order of the page's three moves
  const order: string[] = [];
  const upsert = domain.transactions.upsert;
  domain.transactions.upsert = async (args: Upsert) => { order.push(`parse ${args.where.transactionId}`); return upsert(args); };
  const clear = domain.clearReplacedPending;
  domain.clearReplacedPending = async (args) => { order.push('pending step'); return clear(args); };
  const markRead = landing.markRead.bind(landing);
  landing.markRead = async (ids: string[], at: Date) => { order.push('mark read'); return markRead(ids, at); };

  const counts = await landTransactionsPage(landing, domain, pageInput({ transactions: [txn('t1', { pending_transaction_id: 'p1' })] }));
  assert.deepEqual(domain.clearCalls, [{ accountIds: ['acc_db_1'], transactionIds: ['p1'] }], 'once: Plaid\'s own id for the pending charge, and the row ids of the link\'s accounts');
  assert.deepEqual(counts, { landed: 1, already_landed: 0, corrected: 0, synced: 1, skipped: 0, unheld: 0, added: 1, pending_cleared: 1, pending_kept: 0 }, 'the page carries the step\'s answer');
  assert.deepEqual(order, ['parse t1', 'pending step', 'mark read']);
  assert.equal(domain.rows.has('p1'), false, 'the pending row is gone');
  assert.equal(domain.rows.has('t1'), true, 'the posted charge that replaced it is written');
  assert.equal(landing.rowsFor('t1')[0].status, 'done', 'and its arrival is read');

  // two posted objects of one page name two rows: ONE call, both ids, in the page's order
  const second = new FakeDomain();
  heldPending(second, 'p2');
  heldPending(second, 'p3');
  const more = await landTransactionsPage(new FakeLanding(), second, pageInput({ transactions: [txn('t3', { pending_transaction_id: 'p3' }), txn('t9'), txn('t2', { pending_transaction_id: 'p2' })] }));
  assert.deepEqual(second.clearCalls, [{ accountIds: ['acc_db_1'], transactionIds: ['p3', 'p2'] }]);
  assert.equal(more.pending_cleared, 2);
  assert.equal(more.pending_kept, 0);
});

test('PENDING-01 never a committed one: a named pending row that is committed, or that carries a live posting, is left exactly as it was and counted as kept', async () => {
  const domain = new FakeDomain();
  const committed = { ...heldPending(domain, 'p_committed', { review_status: 'committed', accountCode: '6110' }) };
  const postedFrom = { ...heldPending(domain, 'p_posted_from') };
  domain.livePostings.add('p_posted_from');
  heldPending(domain, 'p_free');
  const counts = await landTransactionsPage(new FakeLanding(), domain, pageInput({ transactions: [
    txn('t1', { pending_transaction_id: 'p_committed' }), txn('t2', { pending_transaction_id: 'p_posted_from' }), txn('t3', { pending_transaction_id: 'p_free' }),
  ] }));
  assert.deepEqual(domain.clearCalls, [{ accountIds: ['acc_db_1'], transactionIds: ['p_committed', 'p_posted_from', 'p_free'] }]);
  assert.equal(counts.pending_cleared, 1, 'only the uncommitted row with no posting');
  assert.equal(counts.pending_kept, 2, 'the committed row and the one a posting was made from');
  assert.deepEqual(domain.rows.get('p_committed'), committed, 'nothing about a kept row changes');
  assert.deepEqual(domain.rows.get('p_posted_from'), postedFrom);
  assert.equal(domain.rows.has('p_free'), false);
  // a step that ran and found nothing to clear still says so: both counts, at zero
  const none = new FakeDomain();
  const empty = await landTransactionsPage(new FakeLanding(), none, pageInput({ transactions: [txn('t4', { pending_transaction_id: 'p_never_held' })] }));
  assert.equal(none.clearCalls.length, 1);
  assert.deepEqual([empty.pending_cleared, empty.pending_kept], [0, 0]);
});

test('PENDING-01 a page that names nothing does not call the step and carries neither count', async () => {
  const domain = new FakeDomain();
  heldPending(domain, 'p1');
  const counts = await landTransactionsPage(new FakeLanding(), domain, pageInput({ transactions: [txn('t1'), txn('t2', { pending: true }), txn('t3', { pending_transaction_id: null })] }));
  assert.deepEqual(domain.clearCalls, [], 'not called');
  assert.deepEqual(Object.keys(counts), NO_PENDING_STEP, 'neither pending_cleared nor pending_kept — not even at zero');
  assert.deepEqual(counts, { landed: 3, already_landed: 0, corrected: 0, synced: 3, skipped: 0, unheld: 0, added: 3 });
  assert.equal(domain.rows.has('p1'), true);
  // an empty page: the same
  const blank = await landTransactionsPage(new FakeLanding(), new FakeDomain(), pageInput({ transactions: [] }));
  assert.deepEqual(Object.keys(blank), NO_PENDING_STEP);
});

test('PENDING-01 an ALREADY-LANDED posted object that names a pending row still calls the step — it is linked, never parsed again, and its pending twin is cleared', async () => {
  const landing = new FakeLanding();
  const posted = txn('t1', { pending_transaction_id: 'p1' });
  // an earlier pull landed and parsed the posted charge
  const earlier = new FakeDomain();
  await landTransactionsPage(landing, earlier, pageInput({ page: 1, transactions: [posted] }));
  // today the same object arrives again, word for word, and the app still holds the pending row it names
  const domain = new FakeDomain();
  domain.rows.set('t1', { ...earlier.rows.get('t1') });
  heldPending(domain, 'p1');
  const counts = await landTransactionsPage(landing, domain, pageInput({ page: 2, transactions: [{ ...posted }] }));
  assert.deepEqual(counts, { landed: 0, already_landed: 1, corrected: 0, synced: 0, skipped: 0, unheld: 0, added: 0, pending_cleared: 1, pending_kept: 0 });
  assert.equal(domain.upserts.length, 0, 'not parsed again');
  assert.equal(domain.links.length, 1, 'linked, as an already-landed object always is');
  assert.deepEqual(domain.clearCalls, [{ accountIds: ['acc_db_1'], transactionIds: ['p1'] }], 'the step reads the object as the table holds it');
  assert.equal(domain.rows.has('p1'), false, 'the pending row that waited is cleared');
  assert.equal(landing.rowsFor('t1').length, 1, 'still one arrival');
});

test('PENDING-01 an id the same page still lists as a pending object is dropped — wherever it sits in the page — and only that id', async () => {
  // Plaid lists the pending charge and the posted one that names it on one page: the pending row stays
  for (const page of [
    [txn('p1', { pending: true }), txn('t1', { pending_transaction_id: 'p1' })],
    [txn('t1', { pending_transaction_id: 'p1' }), txn('p1', { pending: true })],
  ]) {
    const domain = new FakeDomain();
    const counts = await landTransactionsPage(new FakeLanding(), domain, pageInput({ transactions: page }));
    assert.deepEqual(domain.clearCalls, [], 'no id is left, so the step does not run');
    assert.deepEqual(Object.keys(counts), NO_PENDING_STEP);
    assert.equal(domain.rows.get('p1')?.pending, true, 'the pending row is written and kept');
  }
  // another id named on the same page still goes
  const domain = new FakeDomain();
  heldPending(domain, 'p2');
  const counts = await landTransactionsPage(new FakeLanding(), domain, pageInput({ transactions: [txn('p1', { pending: true }), txn('t1', { pending_transaction_id: 'p1' }), txn('t2', { pending_transaction_id: 'p2' })] }));
  assert.deepEqual(domain.clearCalls, [{ accountIds: ['acc_db_1'], transactionIds: ['p2'] }]);
  assert.deepEqual([counts.pending_cleared, counts.pending_kept], [1, 0]);
  assert.equal(domain.rows.get('p1')?.pending, true);
});

test('PENDING-01 an object for an account the link does not hold gives no id', async () => {
  const domain = new FakeDomain();
  heldPending(domain, 'p1');
  const counts = await landTransactionsPage(new FakeLanding(), domain, pageInput({ transactions: [txn('t_other', { account_id: 'acc_plaid_other', pending_transaction_id: 'p1' })] }));
  assert.deepEqual(domain.clearCalls, [], 'the step does not run');
  assert.deepEqual(counts, { landed: 1, already_landed: 0, corrected: 0, synced: 0, skipped: 0, unheld: 1, added: 0 });
  assert.equal(domain.rows.has('p1'), true, 'the row another account\'s object names is left alone');
});

test('PENDING-01 the guess is gone: a pending row of the same account, amount and day that nothing names is left alone, and neither the parser nor its port holds a delete', async () => {
  const domain = new FakeDomain();
  const same = { ...heldPending(domain, 'p_same') };
  // a posted charge on the same account, for the same amount, on the same day — and it names no pending charge
  const counts = await landTransactionsPage(new FakeLanding(), domain, pageInput({ transactions: [txn('t1', { amount: 12.5, date: '2026-09-01' })] }));
  assert.deepEqual(domain.clearCalls, []);
  assert.deepEqual(Object.keys(counts), NO_PENDING_STEP);
  assert.deepEqual(domain.rows.get('p_same'), same, 'left exactly as it was');
  assert.equal(domain.rows.size, 2, 'the pending row and the posted one both stand');
  // by content
  const page = code('src/lib/arrivals/plaidTransactionsPage.ts');
  assert.equal(/deleteMany|\.delete\(|twoDays|setDate\(/.test(page), false, 'no delete by account, amount and day is left in the parser');
  assert.equal(page.split('domain.clearReplacedPending(').length - 1, 1, 'the one delete of the sync is asked for in one place');
  const at = (needle: string) => { const i = page.indexOf(needle); assert.ok(i > -1, `the page holds ${needle}`); return i; };
  const steps = ['await parseTransaction(domain, input,', 'const replaced = replacedPendingIds(landed.rows, input.accounts);', 'if (replaced.length > 0) {', 'await domain.clearReplacedPending({ accountIds: input.accounts.map((account) => account.id), transactionIds: replaced });', 'await markRead(landing, newRowIds, at);'].map(at);
  assert.deepEqual(steps, [...steps].sort((a, b) => a - b), 'parsed → the ids Plaid names → the step, only when any are left → marked read');
});

test('PENDING-01 the ids a page names: each posted object\'s pending_transaction_id, once, in the page\'s order — Plaid\'s word only', () => {
  const HELD = [{ id: 'acc_db_1', accountId: 'acc_plaid_1' }, { id: 'acc_db_2', accountId: 'acc_plaid_2' }];
  const rows = (objects: unknown[]) => objects.map((payload) => ({ payload }));
  assert.deepEqual(replacedPendingIds(rows([txn('t1', { pending_transaction_id: 'p1' }), txn('t2', { account_id: 'acc_plaid_2', pending_transaction_id: 'p2' }), txn('t3', { pending_transaction_id: 'p1' })]), HELD), ['p1', 'p2'], 'each id once, in the page\'s order, over every account the link holds');
  assert.deepEqual(replacedPendingIds([], HELD), []);
  assert.deepEqual(replacedPendingIds(rows([txn('t1')]), HELD), [], 'a posted object that names none');
  assert.deepEqual(replacedPendingIds(rows([txn('t1', { pending_transaction_id: '' })]), HELD), [], 'an empty id is no id');
  // only a POSTED object names a replaced charge: a pending one is itself still listed, and names nothing
  assert.deepEqual(replacedPendingIds(rows([txn('t1', { pending: true, pending_transaction_id: 'p1' })]), HELD), []);
  // "posted" is Plaid saying pending: false — an object that states no `pending` is not read as posted
  const unstated = { ...txn('t1', { pending_transaction_id: 'p1' }) } as Record<string, unknown>;
  delete unstated.pending;
  assert.deepEqual(replacedPendingIds(rows([unstated]), HELD), []);
  // a payload that is no object, or an id that is no string, gives nothing
  assert.deepEqual(replacedPendingIds(rows([null, 'text', 7, { pending: false, account_id: 'acc_plaid_1', pending_transaction_id: 42 }]), HELD), []);
  // a link that holds no account names nothing
  assert.deepEqual(replacedPendingIds(rows([txn('t1', { pending_transaction_id: 'p1' })]), []), []);
});
