import test from 'node:test';
import assert from 'node:assert/strict';
import type { Transaction } from 'plaid';
import { canonicalBytes, fingerprintOf, landObjects, landResponse, sha256, type ArrivalRow, type LandedArrival, type LandingDb, type ProviderResponseRow } from '../arrivals/land';
import { landTransactionsPage, runTransactionsPage, type DomainDb, type TransactionsPageInput } from '../arrivals/plaidTransactionsPage';

// REBUILD-01 PR-2 — landing. Hermetic: a fake LandingDb with the table's own
// rules (UNIQUE on provider + their_id; read / status move once) and a fake
// transaction client that discards a page's writes when the page throws.

class FakeLanding implements LandingDb {
  responses: ProviderResponseRow[] = [];
  arrivals = new Map<string, { row: ArrivalRow; read: Date | null; status: string }>();
  private key(provider: string, theirId: string) { return `${provider} ${theirId}`; }
  async insertResponse(row: ProviderResponseRow) { this.responses.push(row); }
  async insertArrivalsIgnoringDuplicates(rows: ArrivalRow[]) {
    const inserted: string[] = [];
    for (const r of rows) {
      const k = this.key(r.provider, r.their_id);
      if (this.arrivals.has(k)) continue;
      this.arrivals.set(k, { row: structuredClone(r), read: null, status: 'pending' });
      inserted.push(r.their_id);
    }
    return inserted;
  }
  async findArrivals(provider: string, theirIds: string[]): Promise<LandedArrival[]> {
    return theirIds.flatMap((t) => {
      const a = this.arrivals.get(this.key(provider, t));
      return a ? [{ id: a.row.id, their_id: t, payload: structuredClone(a.row.payload), status: a.status }] : [];
    });
  }
  async markRead(ids: string[], at: Date) {
    for (const a of this.arrivals.values()) {
      if (!ids.includes(a.row.id)) continue;
      if (a.read !== null || a.status !== 'pending') throw new Error('arrivals promise 1: read is set once, from NULL');
      a.read = at;
      a.status = 'done';
    }
  }
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
  constructor(private throwOn: string | null = null) {}
  transactions = {
    upsert: async (args: Upsert) => {
      if (this.throwOn && args.where.transactionId === this.throwOn) {
        throw new Error('Invalid `prisma.transactions.upsert()` invocation: column "arrival_id" of relation "transactions" does not exist');
      }
      this.upserts.push(args);
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

test('(b) two objects with the same transaction_id produce one row and one already_landed', async () => {
  const landing = new FakeLanding();
  const resp = await landResponse(landing, { provider: 'plaid', resource: 'transaction', userId: 'u', guestRef: null, httpStatus: 200, body: Buffer.from('{}'), asked: new Date(), arrived: new Date() });
  assert.equal(landing.responses.length, 1);
  assert.deepEqual(landing.responses[0].body_sha256, sha256(Buffer.from('{}')));
  const base = { provider: 'plaid', resource: 'transaction', connection: 'item_abc', userId: 'u', guestRef: null, responseId: resp.id, asked: new Date(), arrived: new Date() };
  const first = await landObjects(landing, { ...base, objects: [{ theirId: 't1', payload: { transaction_id: 't1', amount: 1 } }, { theirId: 't1', payload: { transaction_id: 't1', amount: 1 } }] });
  assert.equal(first.newIds.size, 1);
  assert.equal(first.existingIds.size, 0);
  assert.equal(first.repeatedInAnswer, 1);
  assert.equal(landing.arrivals.size, 1);
  // the same object in a later answer: promise 2 — one row, reported as already existing
  const second = await landObjects(landing, { ...base, objects: [{ theirId: 't1', payload: { transaction_id: 't1', amount: 1 } }, { theirId: 't2', payload: { transaction_id: 't2', amount: 2 } }] });
  assert.equal(second.newIds.size, 1);
  assert.deepEqual([...second.existingIds.keys()], ['t1']);
  assert.equal(second.existingIds.get('t1'), first.newIds.get('t1'));
  assert.equal(landing.arrivals.size, 2);
  // the page counts it as already_landed and links instead of re-parsing
  const domain = new FakeDomain();
  const counts = await landTransactionsPage(landing, domain, pageInput({ transactions: [txn('t1'), txn('t3')] }));
  assert.deepEqual(counts, { landed: 1, already_landed: 1, synced: 1, skipped: 0 });
  assert.equal(domain.upserts.length, 1);
  assert.equal(domain.upserts[0].where.transactionId, 't3');
  assert.equal(domain.links.length, 1);
  assert.deepEqual(domain.links[0].where, { transactionId: 't1', arrival_id: null });
  assert.equal(domain.links[0].data.arrival_id, first.newIds.get('t1'));
});

test('the parser reads the arrival row, never the HTTP object, and every new arrival is read once', async () => {
  const landing = new FakeLanding();
  const domain = new FakeDomain();
  const t = txn('t9', { name: 'As landed' });
  const counts = await landTransactionsPage(landing, domain, pageInput({ transactions: [t] }));
  t.name = 'Mutated after landing';
  assert.deepEqual(counts, { landed: 1, already_landed: 0, synced: 1, skipped: 0 });
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
