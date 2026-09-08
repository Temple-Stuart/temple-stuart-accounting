import test from 'node:test';
import assert from 'node:assert/strict';
import { ValidationError } from '../errors/ValidationError';
import { PostingNotLandedError, balanceDeltaOf, postJournal, type PostingTx } from '../posting/postJournal';

// HYG-04 — no posting path may report success on a rolled-back write.
// Hermetic: a fake client that records every statement in order, can drop the
// commit silently (the prisma/prisma#26366 shape), and answers the read-back.

interface Op { kind: string; detail?: unknown }

function fakeClient(opts: { landed?: boolean; failOn?: 'createMany' | 'set' } = {}) {
  const ops: Op[] = [];
  const written = new Set<string>();
  const tx = {
    $executeRawUnsafe: async (sql: string) => { ops.push({ kind: 'raw', detail: sql }); if (opts.failOn === 'set') throw new Error('SET refused'); return 0; },
    journal_entries: {
      create: async (args: { data: Record<string, unknown> }) => { const id = `je-${ops.filter((o) => o.kind === 'je.create').length + 1}`; ops.push({ kind: 'je.create', detail: args.data }); written.add(id); return { id }; },
    },
    ledger_entries: {
      createMany: async (args: { data: unknown[] }) => { ops.push({ kind: 'lines.createMany', detail: args.data }); if (opts.failOn === 'createMany') throw new Error('Transaction must be balanced: debits=100 credits=90'); return { count: args.data.length }; },
      create: async () => { throw new Error('a line must never be inserted one at a time'); },
    },
    chart_of_accounts: {
      update: async (args: { where: { id: string }; data: unknown }) => { ops.push({ kind: 'balance', detail: { id: args.where.id, data: args.data } }); return {}; },
    },
    other: { update: async (args: unknown) => { ops.push({ kind: 'other.update', detail: args }); return {}; } },
  };
  const client = {
    $transaction: async (fn: (t: PostingTx) => Promise<unknown>, options?: unknown) => {
      ops.push({ kind: 'BEGIN', detail: options });
      try {
        const r = await fn(tx as unknown as PostingTx);
        ops.push({ kind: 'COMMIT' });
        if (opts.landed === false) written.clear(); // the #26366 shape: the client resolves, the database rolled back
        return r;
      } catch (e) {
        ops.push({ kind: 'ROLLBACK' });
        written.clear();
        throw e;
      }
    },
    journal_entries: {
      findMany: async (args: { where: { id: { in: string[] } } }) => { ops.push({ kind: 'readback', detail: args.where.id.in }); return args.where.id.in.filter((id) => written.has(id)).map((id) => ({ id })); },
    },
  };
  return { client, ops, written };
}

const ENTRY = { userId: 'user-a', entity_id: 'ent-b', date: new Date('2026-09-08'), description: 'test', source_type: 'manual', request_id: 'req-1', created_by: 'alex' };
const LINES = [
  { account_id: 'acct-6220', entry_type: 'D' as const, amount: BigInt(100), balanceDelta: BigInt(100) },
  { account_id: 'acct-1010', entry_type: 'C' as const, amount: BigInt(100), balanceDelta: BigInt(-100) },
];

test('postJournal: SET CONSTRAINTS ALL IMMEDIATE is the first statement, the lines go in as ONE createMany, balances move, and the id is read back after commit', async () => {
  const { client, ops } = fakeClient();
  const out = await postJournal(client as never, async (tx, post) => {
    const posted = await post({ entry: ENTRY, lines: LINES });
    await (tx as unknown as { other: { update: (a: unknown) => Promise<unknown> } }).other.update({ after: posted.id });
    return { posted };
  }, { maxWait: 5000, timeout: 10000 });

  assert.deepEqual(ops.map((o) => o.kind), ['BEGIN', 'raw', 'je.create', 'lines.createMany', 'balance', 'balance', 'other.update', 'COMMIT', 'readback']);
  assert.equal(ops[1].detail, 'SET CONSTRAINTS ALL IMMEDIATE');
  assert.deepEqual(ops[0].detail, { maxWait: 5000, timeout: 10000 }, 'transaction options pass through');
  const lines = ops[3].detail as Array<Record<string, unknown>>;
  assert.equal(lines.length, 2);
  assert.equal(lines[0].journal_entry_id, 'je-1');
  assert.deepEqual(lines.map((l) => [l.account_id, l.entry_type, l.amount, l.created_by]), [['acct-6220', 'D', BigInt(100), 'alex'], ['acct-1010', 'C', BigInt(100), 'alex']]);
  assert.deepEqual(out.result.posted.lineIds, [lines[0].id, lines[1].id], 'the line ids are the ones written');
  assert.deepEqual(ops[4].detail, { id: 'acct-6220', data: { settled_balance: { increment: BigInt(100) }, version: { increment: 1 } } });
  assert.deepEqual(ops[5].detail, { id: 'acct-1010', data: { settled_balance: { increment: BigInt(-100) }, version: { increment: 1 } } });
  assert.deepEqual(ops[8].detail, ['je-1']);
  assert.deepEqual(out.journalEntryIds, ['je-1']);
  const je = ops[2].detail as Record<string, unknown>;
  assert.equal(je.status, 'posted');
  assert.equal(je.is_reversal, false);
  assert.equal(je.source_id, null);
});

test('postJournal: a commit the database rolled back is NEVER a success — the read-back throws PostingNotLandedError', async () => {
  const { client, ops } = fakeClient({ landed: false });
  await assert.rejects(
    () => postJournal(client as never, async (_tx, post) => post({ entry: ENTRY, lines: LINES })),
    (err: unknown) => {
      assert.ok(err instanceof PostingNotLandedError);
      assert.deepEqual(err.journalEntryIds, ['je-1']);
      assert.match(err.message, /absent after commit/);
      return true;
    },
  );
  assert.deepEqual(ops.map((o) => o.kind).slice(-2), ['COMMIT', 'readback']);
});

test('postJournal: an unbalanced entry is refused INSIDE the transaction (the immediate trigger throws on the createMany), the transaction rolls back, nothing is read back as landed', async () => {
  const { client, ops } = fakeClient({ failOn: 'createMany' });
  await assert.rejects(
    () => postJournal(client as never, async (_tx, post) => post({ entry: ENTRY, lines: [LINES[0], { ...LINES[1], amount: BigInt(90) }] })),
    /Transaction must be balanced: debits=100 credits=90/,
  );
  assert.deepEqual(ops.map((o) => o.kind), ['BEGIN', 'raw', 'je.create', 'lines.createMany', 'ROLLBACK']);
});

test('postJournal: the structural refusals happen before any write; a body that posts nothing reads nothing back', async () => {
  const { client, ops } = fakeClient();
  await assert.rejects(() => postJournal(client as never, async (_tx, post) => post({ entry: ENTRY, lines: [LINES[0]] })), (e: unknown) => e instanceof ValidationError && /at least two lines/.test(e.message));
  await assert.rejects(() => postJournal(client as never, async (_tx, post) => post({ entry: ENTRY, lines: [LINES[0], { ...LINES[1], amount: BigInt(0) }] })), (e: unknown) => e instanceof ValidationError && /positive number of cents/.test(e.message));
  assert.equal(ops.filter((o) => o.kind === 'je.create').length, 0, 'no journal row was written by a refusal');
  ops.length = 0;
  const out = await postJournal(client as never, async () => 'nothing to post');
  assert.equal(out.result, 'nothing to post');
  assert.deepEqual(out.journalEntryIds, []);
  assert.deepEqual(ops.map((o) => o.kind), ['BEGIN', 'raw', 'COMMIT'], 'no read-back when nothing was posted');
});

test('postJournal: several entries in one transaction are each read back; one missing fails the whole call', async () => {
  const { client, ops, written } = fakeClient();
  const out = await postJournal(client as never, async (_tx, post) => {
    const a = await post({ entry: { ...ENTRY, description: 'reversal', is_reversal: true, reverses_entry_id: 'je-old' }, lines: LINES });
    const b = await post({ entry: { ...ENTRY, description: 'new' }, lines: LINES });
    return [a.id, b.id];
  });
  assert.deepEqual(out.result, ['je-1', 'je-2']);
  assert.deepEqual(out.journalEntryIds, ['je-1', 'je-2']);
  assert.deepEqual(ops[ops.length - 1].detail, ['je-1', 'je-2']);
  const je1 = ops.find((o) => o.kind === 'je.create')!.detail as Record<string, unknown>;
  assert.equal(je1.is_reversal, true);
  assert.equal(je1.reverses_entry_id, 'je-old');

  // one of two missing after commit
  const partial = fakeClient();
  const origTx = partial.client.$transaction;
  partial.client.$transaction = async (fn, options) => { const r = await origTx(fn, options); partial.written.delete('je-2'); return r; };
  await assert.rejects(
    () => postJournal(partial.client as never, async (_tx, post) => { await post({ entry: ENTRY, lines: LINES }); await post({ entry: ENTRY, lines: LINES }); }),
    (err: unknown) => err instanceof PostingNotLandedError && err.journalEntryIds.length === 1 && err.journalEntryIds[0] === 'je-2',
  );
  assert.equal(written.size, 2);
});

test('balanceDeltaOf is the rule every writer used: the account\'s own side adds, the other subtracts', () => {
  assert.equal(balanceDeltaOf('D', 'D', BigInt(500)), BigInt(500));
  assert.equal(balanceDeltaOf('C', 'D', BigInt(500)), BigInt(-500));
  assert.equal(balanceDeltaOf('C', 'C', BigInt(500)), BigInt(500));
  assert.equal(balanceDeltaOf('D', 'C', BigInt(500)), BigInt(-500));
});
