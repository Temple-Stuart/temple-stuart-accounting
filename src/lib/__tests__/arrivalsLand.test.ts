import test from 'node:test';
import assert from 'node:assert/strict';
import type { Transaction } from 'plaid';
import { canonicalBytes, fingerprintOf, landObjects, landResponse, sha256, type ArrivalRow, type LandedArrival, type LandingDb, type ProviderResponseRow } from '../arrivals/land';
import { landTransactionsPage, recordFailedAnswer, runTransactionsPage, type DomainDb, type TransactionsPageInput } from '../arrivals/plaidTransactionsPage';
import { stageFailed, syncEnvelope } from '../plaid/failLoud';
import { onWireError, type WireStamp } from '../plaid/wire';

// REBUILD-01 PR-2 — landing. Hermetic: a fake LandingDb with the table's own
// rules (UNIQUE on provider + their_id + fingerprint — the same thing is the
// same provider, id and content; read / status move once) and a fake
// transaction client that discards a page's writes when the page throws.

class FakeLanding implements LandingDb {
  responses: ProviderResponseRow[] = [];
  arrivals = new Map<string, { row: ArrivalRow; read: Date | null; status: string }>();
  private key(provider: string, theirId: string, fingerprint: Buffer) { return `${provider} ${theirId} ${Buffer.from(fingerprint).toString('hex')}`; }
  async insertResponse(row: ProviderResponseRow) { this.responses.push(row); }
  async insertArrivalsIgnoringDuplicates(rows: ArrivalRow[]) {
    const inserted: Array<{ their_id: string; fingerprint: Buffer }> = [];
    for (const r of rows) {
      const k = this.key(r.provider, r.their_id, r.fingerprint);
      if (this.arrivals.has(k)) continue;
      this.arrivals.set(k, { row: structuredClone(r), read: null, status: 'pending' });
      inserted.push({ their_id: r.their_id, fingerprint: r.fingerprint });
    }
    return inserted;
  }
  async findArrivals(provider: string, theirIds: string[]): Promise<LandedArrival[]> {
    return [...this.arrivals.values()]
      .filter((a) => a.row.provider === provider && theirIds.includes(a.row.their_id))
      .map((a) => ({ id: a.row.id, their_id: a.row.their_id, fingerprint: Buffer.from(a.row.fingerprint), payload: structuredClone(a.row.payload), status: a.status, arrived: a.row.arrived }));
  }
  async markRead(ids: string[], at: Date) {
    for (const a of this.arrivals.values()) {
      if (!ids.includes(a.row.id)) continue;
      if (a.read !== null || a.status !== 'pending') throw new Error('arrivals promise 1: read is set once, from NULL');
      a.read = at;
      a.status = 'done';
    }
  }
  rowsFor(theirId: string) { return [...this.arrivals.values()].filter((a) => a.row.their_id === theirId); }
  snapshot() {
    return { responses: [...this.responses], arrivals: new Map([...this.arrivals].map(([k, v]) => [k, { ...v, row: structuredClone(v.row) }])) };
  }
  restore(s: ReturnType<FakeLanding['snapshot']>) { this.responses = s.responses; this.arrivals = s.arrivals; }
}

type Upsert = { where: { transactionId: string }; create: Record<string, unknown>; update: Record<string, unknown> };
type Link = { where: Record<string, unknown>; data: Record<string, unknown> };

class FakeDomain implements DomainDb {
  upserts: Upsert[] = [];
  links: Link[] = [];
  deletes = 0;
  /** what the domain table would hold after the upserts, keyed by transactionId */
  rows = new Map<string, Record<string, unknown>>();
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
    deleteMany: async () => { this.deletes++; return {}; },
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
  assert.deepEqual(p1, { landed: 1, already_landed: 0, corrected: 0, synced: 1, skipped: 0 });
  const p2 = await landTransactionsPage(landing, domain, pageInput({ page: 2, transactions: [{ ...t }] }));
  assert.deepEqual(p2, { landed: 0, already_landed: 1, corrected: 0, synced: 0, skipped: 0 });
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
  assert.deepEqual(p1, { landed: 1, already_landed: 0, corrected: 0, synced: 1, skipped: 0 });
  const firstId = landing.rowsFor('t1')[0].row.id;
  // the provider corrects the amount; the row is even marked "complete" (the skip must not apply to a correction)
  const corrected = txn('t1', { amount: 13.75, name: 'Coffee (corrected)' });
  const existing = new Map([['t1', { transactionId: 't1', personal_finance_category: { primary: 'FOOD' } }]]);
  const p2 = await landTransactionsPage(landing, domain, pageInput({ page: 2, existing, transactions: [corrected] }));
  assert.deepEqual(p2, { landed: 0, already_landed: 0, corrected: 1, synced: 1, skipped: 0 });
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
  assert.deepEqual(p3, { landed: 0, already_landed: 1, corrected: 0, synced: 0, skipped: 0 });
  assert.equal(landing.rowsFor('t1').length, 2);
});

test('the parser reads the arrival row, never the HTTP object, and every new arrival is read once', async () => {
  const landing = new FakeLanding();
  const domain = new FakeDomain();
  const t = txn('t9', { name: 'As landed' });
  const counts = await landTransactionsPage(landing, domain, pageInput({ transactions: [t] }));
  t.name = 'Mutated after landing';
  assert.deepEqual(counts, { landed: 1, already_landed: 0, corrected: 0, synced: 1, skipped: 0 });
  assert.equal(domain.upserts[0].create.name, 'As landed');
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
