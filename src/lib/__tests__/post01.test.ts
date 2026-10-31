/**
 * POST-01 (2026-09-26) — a posting carries its document: the booking behind the
 * bank row.
 *
 * One test per proof the ruling names. The writer and the reversal are driven over
 * an in-memory Prisma double that enforces the one-posted-charge index
 * (journal_entries_document_charge_key: document_reservation_id WHERE the money
 * event is NULL and status = 'posted') as a P2002 and rolls the transaction back
 * on a throw, the way Postgres does. The gate is pure and run directly. The routes,
 * the retro, the migration and the schema are read from source the way this repo
 * proves what it cannot execute without a database. No live call.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { Prisma, type PrismaClient } from '@prisma/client';
import { code, comments } from '../sourceText';
import { commitPlaidTransaction, reversePlaidTransaction } from '../journal-entry-service';
import { documentFromLinks, documentsForBatch, type GateLink } from '../posting/documentGate';
import { SOURCE_RULES, documentOf, entrySourceOf } from '../books/entrySource';
import { ValidationError } from '../errors/ValidationError';

const WRITER = 'src/lib/journal-entry-service.ts';
const PORT = 'src/lib/posting/postJournal.ts';
const GATE = 'src/lib/posting/documentGate.ts';
const ROUTE = 'src/app/api/transactions/commit-to-ledger/route.ts';
const UNCOMMIT = 'src/app/api/transactions/uncommit/route.ts';
const LEAF = 'src/lib/books/entrySource.ts';
const CELL = 'src/components/books/EntrySourceCell.tsx';
const SURFACES = ['src/components/dashboard/JournalEntryEngine.tsx', 'src/components/dashboard/GeneralLedger.tsx'];
const WIRE_ROUTES = ['src/app/api/journal-transactions/route.ts', 'src/app/api/ledger/route.ts'];
const MIGRATION = 'prisma/migrations/20260926180000_post_01_posting_document/migration.sql';
const RETRO = 'scripts/post-01-retro-documents.ts';
const LAW = 'scripts/assert-tool-registry.ts';

// ── the double ──────────────────────────────────────────────────────────────

type Row = Record<string, unknown>;

interface Tables {
  journal_entries: Row[];
  ledger_entries: Row[];
  chart_of_accounts: Row[];
  transactions: Row[];
  money_events: Row[];
  ledger_line_links: Row[];
}

function matchesWhere(row: Row, where: Row): boolean {
  for (const [k, v] of Object.entries(where)) {
    if (v !== null && typeof v === 'object' && !(v instanceof Date)) {
      const op = v as Row;
      if ('in' in op) { if (!(op.in as unknown[]).includes(row[k])) return false; continue; }
      if ('not' in op) { if (op.not === null ? (row[k] === null || row[k] === undefined) : row[k] === op.not) return false; continue; }
      throw new Error(`the double does not know the where operator ${k}=${JSON.stringify(v)}`);
    }
    if ((row[k] ?? null) !== v) return false;
  }
  return true;
}

class FakeDb {
  t: Tables = { journal_entries: [], ledger_entries: [], chart_of_accounts: [], transactions: [], money_events: [], ledger_line_links: [] };
  seq = 0;
  inside = false;
  /** Make the writer's pre-check miss the holder, so the index (a P2002 from the create) is what refuses — the race. */
  hideHolderFromPrecheck = false;

  snapshot(): Tables { return structuredClone(this.t); }
  restore(s: Tables): void { this.t = s; }

  hydrateEntry(e: Row, shape: Row | undefined): Row {
    const wantLines = shape && (('ledger_entries' in (shape.select as Row ?? {})) || ('ledger_entries' in (shape.include as Row ?? {})));
    if (!wantLines) return { ...e };
    const lines = this.t.ledger_entries.filter((l) => l.journal_entry_id === e.id).map((l) => ({
      ...l,
      account: this.t.chart_of_accounts.find((a) => a.id === l.account_id),
    }));
    return { ...e, ledger_entries: lines };
  }

  holderOf(where: Row): Row | undefined {
    return this.t.journal_entries.find((e) => e.document_reservation_id === where.document_reservation_id && (e.document_money_event_id ?? null) === null && e.status === 'posted');
  }

  client(): PrismaClient { return fakeClient(this); }
}

function fakeClient(db: FakeDb): PrismaClient {
  {
    const journal_entries = {
      async findFirst(args: Row) {
        const where = args.where as Row;
        if (db.inside && db.hideHolderFromPrecheck && 'document_reservation_id' in where && where.document_money_event_id === null) return null;
        const found = db.t.journal_entries.find((e) => matchesWhere(e, where));
        return found ? db.hydrateEntry(found, args) : null;
      },
      async findUnique(args: Row) {
        const found = db.t.journal_entries.find((e) => e.id === (args.where as Row).id);
        return found ? db.hydrateEntry(found, args) : null;
      },
      async findUniqueOrThrow(args: Row) {
        const found = db.t.journal_entries.find((e) => e.id === (args.where as Row).id);
        if (!found) throw new Error('not found');
        return { ...found };
      },
      async findMany(args: Row) {
        return db.t.journal_entries.filter((e) => matchesWhere(e, args.where as Row)).map((e) => ({ ...e }));
      },
      async create(args: Row) {
        const data = args.data as Row;
        if (data.document_reservation_id && (data.document_money_event_id ?? null) === null && (data.status ?? 'posted') === 'posted' && db.holderOf({ document_reservation_id: data.document_reservation_id })) {
          throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed on the fields: (`document_reservation_id`)', { code: 'P2002', clientVersion: '5.22.0', meta: { target: 'journal_entries_document_charge_key' } });
        }
        db.seq += 1;
        const row: Row = { ...data, id: `je_${db.seq}`, is_reversal: data.is_reversal ?? false, reversed_by_entry_id: null, created_at: new Date('2026-09-26T00:00:00Z') };
        db.t.journal_entries.push(row);
        return { id: row.id };
      },
      async update(args: Row) {
        const row = db.t.journal_entries.find((e) => e.id === (args.where as Row).id);
        if (!row) throw new Error('not found');
        Object.assign(row, args.data as Row);
        return { ...row };
      },
    };
    const ledger_entries = { async createMany(args: Row) { for (const d of args.data as Row[]) db.t.ledger_entries.push({ ...d }); return { count: (args.data as Row[]).length }; } };
    const chart_of_accounts = {
      async findUnique(args: Row) {
        const key = (args.where as Row).userId_entity_id_code as Row;
        const found = db.t.chart_of_accounts.find((a) => a.userId === key.userId && a.entity_id === key.entity_id && a.code === key.code);
        return found ? { ...found } : null;
      },
      async update(args: Row) {
        const row = db.t.chart_of_accounts.find((a) => a.id === (args.where as Row).id);
        if (!row) throw new Error('account not found');
        const d = args.data as Row;
        row.settled_balance = (row.settled_balance as bigint) + ((d.settled_balance as Row).increment as bigint);
        row.version = (row.version as number) + 1;
        return { ...row };
      },
    };
    const transactions = {
      async update(args: Row) {
        const row = db.t.transactions.find((x) => x.transactionId === (args.where as Row).transactionId);
        if (!row) throw new Error('transaction not found');
        Object.assign(row, args.data as Row);
        return { ...row };
      },
    };
    const money_events = {
      async findFirst(args: Row) {
        const found = db.t.money_events.find((m) => matchesWhere(m, args.where as Row));
        return found ? { ...found } : null;
      },
    };
    const ledger_line_links = { async createMany(args: Row) { for (const d of args.data as Row[]) db.t.ledger_line_links.push({ ...d }); return { count: 1 }; } };
    const closing_periods = { async findFirst() { return null; } };
    const entities = { async findFirst() { return null; } };
    const tx = { journal_entries, ledger_entries, chart_of_accounts, transactions, money_events, ledger_line_links, closing_periods, entities, async $executeRawUnsafe() { return 0; } };
    const client = {
      ...tx,
      async $transaction<T>(fn: (t: unknown) => Promise<T>): Promise<T> {
        const snap = db.snapshot();
        db.inside = true;
        try { return await fn(tx); } catch (e) { db.restore(snap); throw e; } finally { db.inside = false; }
      },
    };
    return client as unknown as PrismaClient;
  }
}

const USER = 'u_1';
const ENTITY = 'e_1';
const RES = 'res_1';
const BANK = 'P-1000';
const STAY = 'P-9200';
const FLIGHT = 'P-9100';

function seeded(): FakeDb {
  const db = new FakeDb();
  db.t.chart_of_accounts.push(
    { id: 'acct_bank', userId: USER, entity_id: ENTITY, code: BANK, balance_type: 'D', settled_balance: BigInt(0), version: 0 },
    { id: 'acct_stay', userId: USER, entity_id: ENTITY, code: STAY, balance_type: 'D', settled_balance: BigInt(0), version: 0 },
    { id: 'acct_flight', userId: USER, entity_id: ENTITY, code: FLIGHT, balance_type: 'D', settled_balance: BigInt(0), version: 0 },
  );
  db.t.transactions.push(
    { id: 't_charge', transactionId: 'plaid_charge', amount: 250, accountCode: null, review_status: 'pending_review' },
    { id: 't_refund', transactionId: 'plaid_refund', amount: -250, accountCode: null, review_status: 'pending_review' },
    { id: 't_out', transactionId: 'plaid_out', amount: 40, accountCode: null, review_status: 'pending_review' },
    { id: 't_again', transactionId: 'plaid_again', amount: 250, accountCode: null, review_status: 'pending_review' },
  );
  db.t.money_events.push(
    { id: 'me_refund', reservationId: RES, kind: 'refund', amountCents: 25000, currency: 'USD' },
    { id: 'me_fee', reservationId: RES, kind: 'cancellation_fee', amountCents: 5000, currency: 'USD' },
    { id: 'me_other', reservationId: 'res_2', kind: 'refund', amountCents: 100, currency: 'USD' },
  );
  return db;
}

function params(over: Partial<Parameters<typeof commitPlaidTransaction>[1]> & { transactionId: string; amount: number }) {
  return {
    userId: USER, entityId: ENTITY, accountCode: STAY, bankAccountCode: BANK,
    date: new Date('2026-09-20'), description: 'HOTEL TEMPLE', createdBy: 'alex@x.test',
    ...over,
  };
}

const link = (over: Partial<GateLink> & { status: string }): GateLink => ({ id: 'l1', transactionId: 't_charge', reservationId: RES, moneyEventId: null, ...over });

async function refused(p: Promise<unknown>): Promise<ValidationError> {
  try { await p; } catch (e) { assert.ok(e instanceof ValidationError, `a ValidationError, got ${String(e)}`); return e; }
  assert.fail('did not refuse');
}

// ── the gate ─────────────────────────────────────────────────────────────────

test('gate: a proposed link → refused by name with transaction and link ids; two accepted → refused; one accepted → its document; rejected or none → no document', () => {
  const p = documentsForBatch(['t_charge', 't_out'], [link({ status: 'proposed', id: 'l_p' }), link({ status: 'accepted', id: 'l_a', transactionId: 't_out' })]);
  assert.equal(p.ok, false);
  if (p.ok) return;
  assert.equal(p.refusal.reason, 'proposed');
  assert.deepEqual(p.refusal.transactionIds, ['t_charge']);
  assert.deepEqual(p.refusal.linkIds, ['l_p']);
  assert.match(p.refusal.message, /^POST-01 a proposed booking match is undecided/);
  assert.match(p.refusal.message, /t_charge/); assert.match(p.refusal.message, /l_p/); assert.match(p.refusal.message, /Nothing was posted\.$/);

  const m = documentsForBatch(['t_charge'], [link({ status: 'accepted', id: 'l_a1' }), link({ status: 'accepted', id: 'l_a2', reservationId: 'res_2' })]);
  assert.equal(m.ok, false);
  if (m.ok) return;
  assert.equal(m.refusal.reason, 'many_accepted');
  assert.deepEqual(m.refusal.linkIds, ['l_a1', 'l_a2']);
  assert.match(m.refusal.message, /more than one accepted booking match/);

  const ok = documentsForBatch(['t_charge', 't_out', 't_refund'], [link({ status: 'accepted' }), link({ status: 'rejected', id: 'l_r', transactionId: 't_out' }), link({ status: 'accepted', id: 'l_f', transactionId: 't_refund', moneyEventId: 'me_refund' })]);
  assert.equal(ok.ok, true);
  if (!ok.ok) return;
  assert.deepEqual(ok.documents.get('t_charge'), { reservationId: RES, moneyEventId: null });
  assert.equal(ok.documents.get('t_out'), null, 'only rejected → a posting of no booking');
  assert.deepEqual(ok.documents.get('t_refund'), { reservationId: RES, moneyEventId: 'me_refund' });
  assert.equal(documentFromLinks([]).kind, 'none');
});

// ── the writer ───────────────────────────────────────────────────────────────

test('accepted link → the entry carries document_reservation_id, source_type still plaid_txn, source_id the transaction, the account the user picked', async () => {
  const db = seeded();
  const je = await commitPlaidTransaction(db.client(), params({ transactionId: 'plaid_charge', amount: 250, requestId: 'b1-plaid_charge', document: { reservationId: RES, moneyEventId: null } }));
  assert.equal(je.source_type, 'plaid_txn');
  assert.equal(je.source_id, 'plaid_charge');
  assert.equal(je.document_reservation_id, RES);
  assert.equal(je.document_money_event_id, null);
  assert.equal(je.status, 'posted');
  const lines = db.t.ledger_entries.filter((l) => l.journal_entry_id === je.id);
  assert.deepEqual(lines.map((l) => [l.entry_type, l.account_id]), [['D', 'acct_stay'], ['C', 'acct_bank']], 'DR the user’s account / CR bank — the document chose nothing');
  assert.equal(db.t.transactions.find((t) => t.transactionId === 'plaid_charge')?.review_status, 'committed');
  assert.equal(entrySourceOf(je).kind, 'opens', 'the source is still the bank transaction');
});

test('rejected or no link → posts without a document (both columns null)', async () => {
  const db = seeded();
  const je = await commitPlaidTransaction(db.client(), params({ transactionId: 'plaid_out', amount: 40 }));
  assert.equal(je.document_reservation_id, null);
  assert.equal(je.document_money_event_id, null);
  assert.equal(je.source_type, 'plaid_txn');
});

test('a second charge posting for the same booking → named 409 before the write, and the same name when the index refuses it (P2002, the race) — never a 500', async () => {
  const db = seeded();
  const first = await commitPlaidTransaction(db.client(), params({ transactionId: 'plaid_charge', amount: 250, document: { reservationId: RES, moneyEventId: null } }));
  const pre = await refused(commitPlaidTransaction(db.client(), params({ transactionId: 'plaid_again', amount: 250, document: { reservationId: RES, moneyEventId: null } })));
  assert.equal(pre.status, 409);
  assert.equal(pre.message, `POST-01 this booking already has a posted charge entry ${first.id} — booking ${RES} documents one posted charge; uncommit that entry first if this bank row is the charge`);
  assert.equal(db.t.journal_entries.length, 1, 'nothing written');

  db.hideHolderFromPrecheck = true;
  const race = await refused(commitPlaidTransaction(db.client(), params({ transactionId: 'plaid_again', amount: 250, document: { reservationId: RES, moneyEventId: null } })));
  assert.equal(race.status, 409);
  assert.match(race.message, new RegExp(`^POST-01 this booking already has a posted charge entry ${first.id}`));
  assert.equal(db.t.journal_entries.length, 1, 'the transaction rolled back');
  assert.equal(db.t.ledger_entries.length, 2, 'no orphan lines');
});

test('inflow with a refund link and NO posted charge → refused by name ("the charge is not posted; post it first"), nothing written', async () => {
  const db = seeded();
  const err = await refused(commitPlaidTransaction(db.client(), params({ transactionId: 'plaid_refund', amount: -250, document: { reservationId: RES, moneyEventId: 'me_refund' } })));
  assert.match(err.message, /^POST-01 the charge is not posted; post it first/);
  assert.match(err.message, new RegExp(RES));
  assert.equal(db.t.journal_entries.length, 0);
});

test('inflow with a refund link and a posted charge → DR bank / CR the charge’s account, both document ids set; the caller’s account must equal the derived one', async () => {
  const db = seeded();
  const charge = await commitPlaidTransaction(db.client(), params({ transactionId: 'plaid_charge', amount: 250, document: { reservationId: RES, moneyEventId: null } }));
  // The caller names another account: refused by name, nothing written.
  const other = await refused(commitPlaidTransaction(db.client(), params({ transactionId: 'plaid_refund', amount: -250, accountCode: FLIGHT, document: { reservationId: RES, moneyEventId: 'me_refund' } })));
  assert.match(other.message, new RegExp(`^POST-01 a refund posts against the charge's own account ${STAY} \\(entry ${charge.id}\\), not ${FLIGHT}`));
  assert.equal(db.t.journal_entries.length, 1);
  // The caller's account equals the derived one: posted.
  const refund = await commitPlaidTransaction(db.client(), params({ transactionId: 'plaid_refund', amount: -250, accountCode: STAY, document: { reservationId: RES, moneyEventId: 'me_refund' } }));
  assert.equal(refund.document_reservation_id, RES);
  assert.equal(refund.document_money_event_id, 'me_refund');
  assert.equal(refund.source_type, 'plaid_txn');
  assert.equal(refund.source_id, 'plaid_refund');
  const lines = db.t.ledger_entries.filter((l) => l.journal_entry_id === refund.id);
  assert.deepEqual(lines.map((l) => [l.entry_type, l.account_id]), [['D', 'acct_bank'], ['C', 'acct_stay']], 'DR bank / CR the charge’s expense account');
  assert.equal(db.t.chart_of_accounts.find((a) => a.id === 'acct_stay')?.settled_balance, BigInt(0), 'the stay account nets to zero: charge 25000 − refund 25000');
  // A second posted charge is still refused while the refund sits beside it (the refund is not in the charge index).
  const again = await refused(commitPlaidTransaction(db.client(), params({ transactionId: 'plaid_again', amount: 250, document: { reservationId: RES, moneyEventId: null } })));
  assert.equal(again.status, 409);
});

test('outflow with a refund link → refused by name; a money event of another booking → 404 by name; a fee is not a refund', async () => {
  const db = seeded();
  await commitPlaidTransaction(db.client(), params({ transactionId: 'plaid_charge', amount: 250, document: { reservationId: RES, moneyEventId: null } }));
  const out = await refused(commitPlaidTransaction(db.client(), params({ transactionId: 'plaid_out', amount: 40, document: { reservationId: RES, moneyEventId: 'me_refund' } })));
  assert.match(out.message, /^POST-01 a refund is money that came back: transaction plaid_out has Plaid amount 40 \(money left the account\)/);
  const foreign = await refused(commitPlaidTransaction(db.client(), params({ transactionId: 'plaid_refund', amount: -250, document: { reservationId: RES, moneyEventId: 'me_other' } })));
  assert.equal(foreign.status, 404);
  assert.match(foreign.message, /^POST-01 money event me_other is not a money event of booking res_1/);
  const fee = await refused(commitPlaidTransaction(db.client(), params({ transactionId: 'plaid_refund', amount: -250, document: { reservationId: RES, moneyEventId: 'me_fee' } })));
  assert.match(fee.message, /^POST-01 money event me_fee is a cancellation_fee, not a refund/);
  assert.equal(db.t.journal_entries.length, 1, 'only the charge');
});

test('uncommit → the reversal carries no document, the original keeps it; a re-commit after the uncommit posts the charge again', async () => {
  const db = seeded();
  const client = db.client();
  const original = await commitPlaidTransaction(client, params({ transactionId: 'plaid_charge', amount: 250, document: { reservationId: RES, moneyEventId: null } }));
  const r = await reversePlaidTransaction(client, { userId: USER, journalEntryId: original.id, transactionId: 'plaid_charge', createdBy: 'alex@x.test' });
  const rev = db.t.journal_entries.find((e) => e.id === r.reversalId);
  const orig = db.t.journal_entries.find((e) => e.id === original.id);
  assert.ok(rev && orig);
  assert.equal(rev.source_type, 'reversal');
  assert.equal(rev.document_reservation_id, null, 'the reversal carries no document');
  assert.equal(rev.document_money_event_id, null);
  assert.equal(orig.document_reservation_id, RES, 'the original keeps its own');
  assert.equal(orig.status, 'reversed');
  // Re-commit: the reversed entry is out of the one-posted-charge index.
  const again = await commitPlaidTransaction(client, params({ transactionId: 'plaid_charge', amount: 250, requestId: 'b2-plaid_charge', document: { reservationId: RES, moneyEventId: null } }));
  assert.equal(again.document_reservation_id, RES);
  assert.equal(again.status, 'posted');
  assert.equal(db.t.journal_entries.filter((e) => e.document_reservation_id === RES && e.status === 'posted').length, 1);
});

test('idempotency on request_id stands: a retried commit returns the existing entry, document and all', async () => {
  const db = seeded();
  const a = await commitPlaidTransaction(db.client(), params({ transactionId: 'plaid_charge', amount: 250, requestId: 'b1-plaid_charge', document: { reservationId: RES, moneyEventId: null } }));
  const b = await commitPlaidTransaction(db.client(), params({ transactionId: 'plaid_charge', amount: 250, requestId: 'b1-plaid_charge', document: { reservationId: RES, moneyEventId: null } }));
  assert.equal(b.id, a.id);
  assert.equal(b.alreadyExisted, true);
  assert.equal(b.document_reservation_id, RES);
});

// ── the route, the port, the uncommit: read from source ─────────────────────

test('the commit route: the gate runs over EVERY transaction (user-scoped) before the batch id and before any commitPlaidTransaction(); a refusal is 409 by name with the ids; the decision is passed, never defaulted', () => {
  const r = code(ROUTE);
  const gate = r.indexOf('const gate = documentsForBatch(transactionIds, batchLinks);');
  assert.ok(gate > 0);
  assert.ok(gate < r.indexOf('const batchRequestId = randomUUID();'), 'before the batch id');
  assert.ok(gate < r.indexOf('commitPlaidTransaction(prisma, {'), 'before any posting');
  assert.ok(gate > r.indexOf("{ error: 'Some transactions do not belong to your account' }"), 'after ownership');
  assert.ok(r.includes("where: { userId: user.id, transactionId: { in: transactionIds }, status: { in: ['proposed', 'accepted'] } },"), 'user-scoped over the batch');
  assert.match(r, /if \(!gate\.ok\) \{\s*return NextResponse\.json\(\s*\{\s*error: gate\.refusal\.message,\s*reason: gate\.refusal\.reason,\s*transactionIds: gate\.refusal\.transactionIds,\s*linkIds: gate\.refusal\.linkIds,\s*committed: 0,\s*\},\s*\{ status: 409 \}/);
  assert.ok(r.includes('const document = gate.documents.get(txnId);'));
  assert.ok(r.includes('if (document === undefined) throw new Error(`POST-01 the document gate decided nothing for transaction ${txnId}`);'), 'an undecided row is a fault, not a default');
  assert.ok(r.includes('document: document === null ? undefined : document,'), 'the decision reaches the writer');
  assert.ok(!/document\s*\?\?/.test(r), 'never defaulted');
});

test('the port passes the two columns through and decides nothing; the uncommit route finds the entry by source_type + source_id and the reversal carries no document', () => {
  const p = code(PORT);
  assert.ok(p.includes('document_reservation_id: entry.document_reservation_id ?? null,'));
  assert.ok(p.includes('document_money_event_id: entry.document_money_event_id ?? null,'));
  const u = code(UNCOMMIT);
  assert.ok(u.includes("source_type: 'plaid_txn',") && u.includes('source_id: txn.transactionId,'), 'the retro’s join: source_type plaid_txn AND source_id = transactions.transactionId');
  assert.ok(!/document_/.test(u), 'the uncommit route names no document column');
  const w = code(WRITER);
  const reversal = w.slice(w.indexOf('export async function reversePlaidTransaction('));
  assert.ok(!/document_(reservation|money_event)_id\s*:/.test(reversal), 'the reversal writes no document');
  assert.ok(code(GATE).length > 0);
  for (const impure of [/\bfetch\s*\(/, /process\.env/, /new Date\s*\(|Date\.now\s*\(/, /prisma|PrismaClient/]) assert.ok(!impure.test(code(GATE)), `the gate is pure (${impure})`);
});

// ── the retro ────────────────────────────────────────────────────────────────

test('the retro: LANE-01 shape, --dry-run, the join, the one gate; one accepted link fills, two accepted printed by name and left as is, a refund link left to the writer; P2002 named; idempotent by its selection', () => {
  assert.ok(existsSync(RETRO), 'scripts/post-01-retro-documents.ts is tracked (git add -f past the scripts/ ignore)');
  const r = code(RETRO);
  const c = comments(RETRO);
  assert.match(c, /Alex runs this; a session never does/);
  assert.match(c, /IDEMPOTENT BY CONSTRUCTION/);
  assert.match(c, /NO FALLBACK/);
  assert.ok(r.includes("process.argv.includes('--dry-run')"));
  assert.ok(r.includes("where: { source_type: 'plaid_txn', status: 'posted', document_reservation_id: null, source_id: { not: null } },"), 'selects only entries without a document — a second run finds the set ones gone');
  assert.ok(r.includes('where: { transactionId: e.source_id as string },'), 'entry.source_id → transactions.transactionId');
  assert.ok(r.includes('where: { transactionId: txn.id, userId: e.userId },'), 'transactions.id → links.transactionId, the entry’s own user');
  assert.ok(r.includes('const decision = documentFromLinks(links);'), 'the one gate');
  assert.match(r, /if \(decision\.kind === 'many_accepted'\) \{\s*leftAsIs \+= 1;\s*console\.log\(`✖ left as is[^`]*TWO ACCEPTED LINKS/);
  assert.match(r, /if \(decision\.document\.moneyEventId !== null\) \{\s*leftAsIs \+= 1;/);
  assert.ok(r.includes('data: { document_reservation_id: reservationId, document_money_event_id: null },'));
  assert.ok(r.includes("err.code === 'P2002'"));
  assert.match(r, /already has a posted charge entry/);
  assert.ok(!/reservationId\s*\?\?/.test(r), 'no default');
  assert.ok(!/liteapi|fetch\(/.test(r), 'no vendor read');
});

// ── the drill leaf, the cell, the surfaces, the wire ────────────────────────

test('KINDS stay seven; the document is one rule in the leaf: charge and refund words, NULL renders nothing', () => {
  assert.equal(SOURCE_RULES.length, 7);
  assert.deepEqual(SOURCE_RULES.map((r) => r.type), ['plaid_txn', 'manual', 'reversal', 'investment_txn', 'trading_position', 'reclass', 'year_end_close']);
  const facts = { displayName: 'Hotel Temple', providerBookingId: 'hSq2gVDrf', providerConfirmationCode: 'HCC-4421' };
  assert.deepEqual(documentOf({ document_reservation_id: RES, document_money_event_id: null, document_reservation: facts }), { kind: 'charge', reservationId: RES, words: 'Booking: Hotel Temple · HCC-4421' });
  assert.equal(documentOf({ document_reservation_id: RES, document_money_event_id: null, document_reservation: { ...facts, providerConfirmationCode: null } }).kind === 'charge' && (documentOf({ document_reservation_id: RES, document_money_event_id: null, document_reservation: { ...facts, providerConfirmationCode: null } }) as { words: string }).words, 'Booking: Hotel Temple · hSq2gVDrf', 'no confirmation code → the booking id');
  const unnamed = documentOf({ document_reservation_id: RES, document_money_event_id: null, document_reservation: { ...facts, displayName: null } });
  assert.equal(unnamed.kind === 'charge' && unnamed.words, 'Booking: HCC-4421', 'a name the lane has not stated is left out, never invented');
  const bare = documentOf({ document_reservation_id: RES, document_money_event_id: null });
  assert.equal(bare.kind === 'charge' && bare.words, `Booking: ${RES}`, 'no joined facts → the reservation id itself');
  assert.deepEqual(documentOf({ document_reservation_id: RES, document_money_event_id: 'me_refund', document_reservation: facts, document_money_event: { kind: 'refund', amountCents: 25000, currency: 'USD' } }), { kind: 'refund', reservationId: RES, moneyEventId: 'me_refund', words: 'Refund of booking: Hotel Temple · 250.00 USD' });
  const unstated = documentOf({ document_reservation_id: RES, document_money_event_id: 'me_refund', document_reservation: facts, document_money_event: { kind: 'refund', amountCents: null, currency: null } });
  assert.equal(unstated.kind === 'refund' && unstated.words, 'Refund of booking: Hotel Temple · amount not stated');
  assert.deepEqual(documentOf({ source_type: 'plaid_txn', source_id: 'x', document_reservation_id: null, document_money_event_id: null }), { kind: 'none' });
  assert.deepEqual(documentOf({ source_type: 'manual' }), { kind: 'none' });
  // The leaf stays pure.
  const leaf = code(LEAF);
  for (const impure of [/\bfetch\s*\(/, /process\.env/, /new Date\s*\(|Date\.now\s*\(/, /from 'react'/, /prisma|PrismaClient/]) assert.ok(!impure.test(leaf), `pure (${impure})`);
});

test('the cell renders the leaf’s document words only, and nothing for NULL; both surfaces hand the document; both wire routes carry it with the booking’s and the money event’s stated fields', () => {
  const cell = code(CELL);
  assert.ok(cell.includes('const document: EntryDocument = documentOf(entry);'));
  assert.ok(cell.includes("{document.kind !== 'none' && ("), 'NULL renders nothing');
  assert.ok(cell.includes('{document.words}'));
  for (const typed of ["'Booking", '"Booking', '`Booking', "'Refund", '"Refund', '`Refund']) assert.ok(!cell.includes(typed), `the cell types no document word (${typed})`);
  for (const f of SURFACES) {
    const s = code(f);
    const handed = [...s.matchAll(/entry=\{\{([^}]*)\}\}/g)].map((m) => m[1]);
    assert.ok(handed.some((props) => /document_reservation_id:\s*\w+\.document_reservation_id\b/.test(props) && /document_money_event:\s*\w+\.document_money_event\b/.test(props)), `${f} hands the document`);
    assert.ok(/document_reservation_id: string \| null;/.test(s) && /document_reservation: DocumentReservationFacts \| null;/.test(s), `${f} types the four fields`);
  }
  for (const f of WIRE_ROUTES) {
    const s = code(f);
    assert.ok(/document_reservation_id:\s*\w+(\.\w+)*\.document_reservation_id\b/.test(s), `${f} puts document_reservation_id on the wire`);
    assert.ok(/document_money_event_id:\s*\w+(\.\w+)*\.document_money_event_id\b/.test(s), `${f} puts document_money_event_id on the wire`);
    assert.ok(s.includes('document_reservation: { select: { displayName: true, providerBookingId: true, providerConfirmationCode: true } }'), `${f} joins the booking’s stated fields`);
    assert.ok(s.includes('document_money_event: { select: { kind: true, amountCents: true, currency: true } }'), `${f} joins the money event’s kind and amount`);
  }
});

// ── the migration, the schema, the law ───────────────────────────────────────

test('the migration: two nullable UUID columns, both FKs RESTRICT, the CHECK, the partial unique (money event NULL AND status posted), the indexes, links.moneyEventId; the schema moves with it', () => {
  const m = code(MIGRATION);
  assert.ok(m.includes('ALTER TABLE "journal_entries" ADD COLUMN "document_reservation_id" UUID;'));
  assert.ok(m.includes('ALTER TABLE "journal_entries" ADD COLUMN "document_money_event_id" UUID;'));
  assert.equal((m.match(/ON DELETE RESTRICT ON UPDATE CASCADE;/g) ?? []).length, 3, 'three FKs, all RESTRICT');
  assert.ok(m.includes('CHECK ("document_money_event_id" IS NULL OR "document_reservation_id" IS NOT NULL)'));
  assert.ok(m.includes('CREATE UNIQUE INDEX "journal_entries_document_charge_key"\n    ON "journal_entries"("document_reservation_id")\n    WHERE "document_money_event_id" IS NULL AND "status" = \'posted\';'));
  assert.ok(m.includes('CREATE INDEX "journal_entries_document_reservation_id_idx"') && m.includes('CREATE INDEX "journal_entries_document_money_event_id_idx"') && m.includes('CREATE INDEX "transaction_reservation_links_moneyEventId_idx"'));
  assert.ok(m.includes('ALTER TABLE "transaction_reservation_links" ADD COLUMN "moneyEventId" UUID;'));
  assert.ok(!/ADD COLUMN[^;]*(DEFAULT|NOT NULL)/.test(m) && !/DEFAULT/.test(m) && !/UPDATE "journal_entries"/.test(m), 'no default, no backfill, no column NOT NULL (the CHECK\u2019s IS NOT NULL is the constraint, not a column)');
  const c = comments(MIGRATION);
  assert.match(c, /never a posting of its own/);
  assert.match(c, /The trigger is NOT changed here/);
  const s = code('prisma/schema.prisma');
  assert.ok(s.includes('document_reservation_id String? @db.Uuid') && s.includes('document_money_event_id String? @db.Uuid'));
  assert.ok(s.includes('@relation("posting_document", fields: [document_reservation_id], references: [id], onDelete: Restrict, onUpdate: Cascade)'));
  assert.ok(s.includes('@relation("posting_document_event", fields: [document_money_event_id], references: [id], onDelete: Restrict, onUpdate: Cascade)'));
  assert.ok(s.includes('moneyEventId   String?   @db.Uuid'));
  assert.ok(s.includes('@relation("link_money_event", fields: [moneyEventId], references: [id], onDelete: Restrict, onUpdate: Cascade)'));
  assert.ok(s.includes('document_entries  journal_entries[]   @relation("posting_document")'));
  assert.ok(s.includes('@@index([document_reservation_id])') && s.includes('@@index([document_money_event_id])') && s.includes('@@index([moneyEventId])'));
});

test('the law suite carries the posting-document law with its six named clauses, and the entry-source law’s KINDS are still the seven', () => {
  const law = code(LAW);
  assert.ok(law.includes("lawGuard('The posting-document law', () => {"));
  for (const clause of ['IS THE ONE WRITER OF THE TWO DOCUMENT COLUMNS', 'REFUSES A PROPOSED LINK AT 409 BEFORE ANY POSTING', 'AN ACCEPTED LINK IS NEVER POSTED WITHOUT ITS DOCUMENT', 'A REFUND ENTRY REQUIRES THE POSTED CHARGE AND DERIVES ITS ACCOUNT', 'KINDS STAY SEVEN', 'THE DOCUMENT WORDS COME FROM THE DRILL LEAF ONLY']) {
    assert.ok(comments(LAW).includes(clause), clause);
  }
  assert.ok(law.includes("const KINDS = ['plaid_txn', 'manual', 'reversal', 'investment_txn', 'trading_position', 'reclass', 'year_end_close'];"));
  assert.ok(existsSync('scripts/proofs/post01.seeds.ts'));
});
