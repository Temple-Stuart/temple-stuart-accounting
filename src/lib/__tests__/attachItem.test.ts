import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AttachIntegrityError,
  ZERO,
  attachItem,
  describePlan,
  executeAttach,
  planAttach,
  totalOf,
  type AttachAccount,
  type AttachDb,
  type AttachItem,
  type HistoryCounts,
  type SurvivorUpdate,
} from '../plaid/attachItem';

// BANK-03 — attach the new item to the account rows that carry the history; retire the old item.
// An in-memory database with the three history tables; `transaction` snapshots and rolls back on a throw.

const USER = 'user-a';
const INS = 'ins_116995';
const NOW = new Date('2026-09-05T12:00:00.000Z');

interface Rec { id: string; account_id: string; entity_id: string; year: number; month: number }
interface Row { id: string; accountId: string }

class MemoryDb implements AttachDb {
  items: AttachItem[] = [];
  accounts: AttachAccount[] = [];
  transactions: Row[] = [];
  investment_transactions: Row[] = [];
  bank_reconciliations: Rec[] = [];
  retirements: Array<{ itemRowId: string; at: Date; reason: string }> = [];
  deleted: string[] = [];
  updates: Array<{ id: string; data: SurvivorUpdate }> = [];
  /** A fault injected into moveHistory — "the move missed rows" — to prove the assert and the rollback. */
  moveDropsInvestments = false;

  async item(userId: string, itemRowId: string) { return this.items.find((i) => i.id === itemRowId && i.userId === userId) ?? null; }
  async liveItemsOfInstitution(userId: string, institutionId: string, exclude: string) {
    return this.items.filter((i) => i.userId === userId && i.institutionId === institutionId && i.retired_at === null && i.id !== exclude);
  }
  async accountsOfItem(itemRowId: string) { return this.accounts.filter((a) => a.plaidItemId === itemRowId); }
  async historyCounts(id: string): Promise<HistoryCounts> {
    return {
      transactions: this.transactions.filter((r) => r.accountId === id).length,
      investment_transactions: this.investment_transactions.filter((r) => r.accountId === id).length,
      bank_reconciliations: this.bank_reconciliations.filter((r) => r.account_id === id).length,
    };
  }
  async reconciliationCollisions(a: string, b: string) {
    const key = (r: Rec) => `${r.entity_id} ${r.year} ${r.month}`;
    const ka = new Set(this.bank_reconciliations.filter((r) => r.account_id === a).map(key));
    return this.bank_reconciliations.filter((r) => r.account_id === b && ka.has(key(r))).length;
  }
  async moveHistory(from: string, to: string): Promise<HistoryCounts> {
    const moved = { ...ZERO };
    for (const r of this.transactions) if (r.accountId === from) { r.accountId = to; moved.transactions++; }
    for (const r of this.investment_transactions) if (r.accountId === from) { if (this.moveDropsInvestments) break; r.accountId = to; moved.investment_transactions++; }
    for (const r of this.bank_reconciliations) if (r.account_id === from) { r.account_id = to; moved.bank_reconciliations++; }
    return moved;
  }
  async deleteAccount(id: string) {
    const left = totalOf(await this.historyCounts(id));
    if (left) throw new Error(`FK violation: ${left} rows still reference ${id}`);
    this.accounts = this.accounts.filter((a) => a.id !== id);
    this.deleted.push(id);
  }
  async updateSurvivor(id: string, data: SurvivorUpdate) {
    const a = this.accounts.find((x) => x.id === id);
    if (!a) throw new Error('no such account');
    if (this.accounts.some((x) => x.id !== id && x.accountId === data.accountId)) throw new Error(`unique violation: accountId ${data.accountId}`);
    const { updatedAt, ...rest } = data;
    void updatedAt;
    Object.assign(a, rest);
    this.updates.push({ id, data });
  }
  async retireItem(itemRowId: string, at: Date, reason: string) {
    const i = this.items.find((x) => x.id === itemRowId);
    if (!i) throw new Error('no such item');
    i.retired_at = at;
    this.retirements.push({ itemRowId, at, reason });
  }
  async transaction<T>(fn: (tx: AttachDb) => Promise<T>): Promise<T> {
    const snapshot = structuredClone({ items: this.items, accounts: this.accounts, transactions: this.transactions, investment_transactions: this.investment_transactions, bank_reconciliations: this.bank_reconciliations, retirements: this.retirements, deleted: this.deleted, updates: this.updates });
    try {
      return await fn(this);
    } catch (e) {
      Object.assign(this, snapshot);
      throw e;
    }
  }
}

function account(over: Partial<AttachAccount> & { id: string; plaidItemId: string; accountId: string }): AttachAccount {
  return {
    mask: null, name: 'Account', officialName: null, type: 'investment', subtype: 'brokerage', currentBalance: 0, availableBalance: 0,
    isoCurrencyCode: 'USD', accountCode: null, subAccount: null, entityType: null, entity_id: null, ...over,
  };
}

/** The case: the old TastyTrade item with history; the fresh tastytrade item with the same three masks and 716 fresh investment rows. */
function theCase(): MemoryDb {
  const db = new MemoryDb();
  db.items.push(
    { id: 'pi_old', userId: USER, itemId: '4Ad9BaBDXDI8B7gNgpjMsXV8pyOVqpHknKKQp', institutionId: INS, institutionName: 'TastyTrade', retired_at: null, createdAt: new Date('2026-01-01T00:00:00Z') },
    { id: 'pi_new', userId: USER, itemId: 'NEWITEMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', institutionId: INS, institutionName: 'tastytrade', retired_at: null, createdAt: new Date('2026-09-04T00:00:00Z') },
  );
  const masks = ['2518', '3062', '9689'];
  for (const m of masks) {
    db.accounts.push(account({ id: `acc_old_${m}`, plaidItemId: 'pi_old', accountId: `plaid_old_${m}`, mask: m, name: `TastyTrade ${m}`, currentBalance: 25, accountCode: `1200-${m}`, entityType: 'trading', entity_id: 'ent-1' }));
    db.accounts.push(account({ id: `acc_new_${m}`, plaidItemId: 'pi_new', accountId: `plaid_new_${m}`, mask: m, name: `tastytrade ${m}`, currentBalance: 31.5 }));
  }
  // history on the old rows: transactions + investment rows + one reconciliation; fresh investment rows on the new rows
  let n = 0;
  for (const m of masks) {
    for (let i = 0; i < 40; i++) db.transactions.push({ id: `t${n++}`, accountId: `acc_old_${m}` });
    for (let i = 0; i < 120; i++) db.investment_transactions.push({ id: `i${n++}`, accountId: `acc_old_${m}` });
    for (let i = 0; i < 238; i++) db.investment_transactions.push({ id: `i${n++}`, accountId: `acc_new_${m}` });
  }
  db.investment_transactions.push({ id: `i${n++}`, accountId: 'acc_new_2518' }, { id: `i${n++}`, accountId: 'acc_new_3062' }); // 716 total on the new rows
  db.bank_reconciliations.push({ id: 'r1', account_id: 'acc_old_2518', entity_id: 'ent-1', year: 2026, month: 7 });
  return db;
}

const totals = async (db: MemoryDb) => ({
  transactions: db.transactions.length, investment_transactions: db.investment_transactions.length, bank_reconciliations: db.bank_reconciliations.length,
});

test('match by institutionId + mask, one-to-one; the name is never consulted', async () => {
  const db = theCase();
  // a same-mask account at ANOTHER institution is never a twin
  db.items.push({ id: 'pi_other', userId: USER, itemId: 'OTHER', institutionId: 'ins_3', institutionName: 'TastyTrade', retired_at: null, createdAt: new Date('2026-02-01T00:00:00Z') });
  db.accounts.push(account({ id: 'acc_other_2518', plaidItemId: 'pi_other', accountId: 'plaid_other_2518', mask: '2518', name: 'TastyTrade 2518' }));
  const plan = await planAttach(db, { userId: USER, newItemRowId: 'pi_new' });
  assert.equal(plan.kind, 'merge');
  if (plan.kind !== 'merge') return;
  assert.equal(plan.oldItem.id, 'pi_old');
  assert.deepEqual(plan.pairs.map((p) => [p.mask, p.oldRow.id, p.newRow.id, p.survivorIs]), [
    ['2518', 'acc_old_2518', 'acc_new_2518', 'new'], // 239 fresh investment rows > 160 old rows + 1 reconciliation
    ['3062', 'acc_old_3062', 'acc_new_3062', 'new'],
    ['9689', 'acc_old_9689', 'acc_new_9689', 'new'], // 238 > 160
  ]);
  assert.deepEqual(plan.unmatchedNew, []);
  assert.deepEqual(plan.unmatchedOld, []);
  assert.equal(plan.retireReason, 'replaced by NEWITEMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
  assert.deepEqual(plan.totalBefore, { transactions: 120, investment_transactions: 1076, bank_reconciliations: 1 });
  assert.match(describePlan(plan), /^tastytrade ← TastyTrade: ••••2518 \(new row survives\), ••••3062 \(new row survives\), ••••9689 \(new row survives\); 1197 history rows$/);

  // pointed at the OLD item, the merge stops — it would retire the fresh one
  const backwards = await planAttach(db, { userId: USER, newItemRowId: 'pi_old' });
  assert.equal(backwards.kind, 'stop');
  assert.match((backwards as { reason: string }).reason, /is not the newest of institution ins_116995: NEWITEM\S+ was created 2026-09-04T00:00:00.000Z — run the merge on the newest item/);

  // a foreign user's item is a 'Bank connection not found' stop; a retired new item stops; no institutionId stops
  assert.deepEqual(await planAttach(db, { userId: 'user-b', newItemRowId: 'pi_new' }), { kind: 'stop', reason: 'Bank connection not found' });
  db.items[1].institutionId = 'unknown';
  assert.match((await planAttach(db, { userId: USER, newItemRowId: 'pi_new' }) as { reason: string }).reason, /has no institutionId — matching is by institutionId \+ mask, never by name/);
});

test('the survivor is the row with more history; the old row wins a tie and keeps its id', async () => {
  const db = theCase();
  // give ••••9689's old row more history than the new row: 300 more transactions
  for (let i = 0; i < 300; i++) db.transactions.push({ id: `x${i}`, accountId: 'acc_old_9689' });
  // ••••3062: make it a tie (160 old = 160 new) by trimming the new row's investment rows to 160
  db.investment_transactions = db.investment_transactions.filter((r, idx) => !(r.accountId === 'acc_new_3062' && idx % 3 === 0));
  const plan = await planAttach(db, { userId: USER, newItemRowId: 'pi_new' });
  assert.equal(plan.kind, 'merge');
  if (plan.kind !== 'merge') return;
  const by = Object.fromEntries(plan.pairs.map((p) => [p.mask, p]));
  assert.equal(by['9689'].survivorIs, 'old');
  assert.equal(totalOf(by['3062'].before.new), 160);
  assert.equal(by['3062'].survivorIs, 'old', 'a tie keeps the old row');
  assert.equal(by['2518'].survivorIs, 'new');
});

test('ambiguity stops the whole merge with nothing written: two old rows with one mask; two new rows claiming one old row; two live old items', async () => {
  const twoOld = theCase();
  twoOld.accounts.push(account({ id: 'acc_old_dup', plaidItemId: 'pi_old', accountId: 'plaid_old_dup', mask: '2518' }));
  const p1 = await attachItem(twoOld, { userId: USER, newItemRowId: 'pi_new', now: NOW });
  assert.equal(p1.plan.kind, 'stop');
  assert.match((p1.plan as { reason: string }).reason, /mask 2518: 2 old accounts carry it .* — ambiguous, nothing merged/);
  assert.equal(p1.report, null);
  assert.deepEqual(twoOld.deleted, []);
  assert.deepEqual(twoOld.retirements, []);

  const twoNew = theCase();
  twoNew.accounts.push(account({ id: 'acc_new_dup', plaidItemId: 'pi_new', accountId: 'plaid_new_dup', mask: '2518' }));
  const p2 = await planAttach(twoNew, { userId: USER, newItemRowId: 'pi_new' });
  assert.match((p2 as { reason: string }).reason, /mask 2518: two new accounts .* claim old account acc_old_2518 — ambiguous/);

  const twoItems = theCase();
  twoItems.items.push({ id: 'pi_older', userId: USER, itemId: 'OLDER', institutionId: INS, institutionName: 'TastyTrade', retired_at: null, createdAt: new Date('2025-06-01T00:00:00Z') });
  const p3 = await planAttach(twoItems, { userId: USER, newItemRowId: 'pi_new' });
  assert.match((p3 as { reason: string }).reason, /2 live items of institution ins_116995 besides .* — one replacement at a time/);

  // a reconciliation for the same entity/year/month on both rows would collide on the unique key → stop
  const collide = theCase();
  collide.bank_reconciliations.push({ id: 'r2', account_id: 'acc_new_2518', entity_id: 'ent-1', year: 2026, month: 7 });
  const p4 = await planAttach(collide, { userId: USER, newItemRowId: 'pi_new' });
  assert.match((p4 as { reason: string }).reason, /mask 2518: 1 reconciliation\(s\) for the same entity\/year\/month on both rows/);
});

test('no history row is orphaned; the donor is deleted only when empty; the survivor carries both sides and the old bookkeeping', async () => {
  const db = theCase();
  const before = await totals(db);
  const { plan, report } = await attachItem(db, { userId: USER, newItemRowId: 'pi_new', now: NOW });
  assert.equal(plan.kind, 'merge');
  assert.ok(report);
  assert.deepEqual(await totals(db), before, 'not one history row lost');
  assert.deepEqual(report.totalAfter, report.totalBefore);
  assert.deepEqual(db.deleted.sort(), ['acc_old_2518', 'acc_old_3062', 'acc_old_9689'], 'the donors (the old rows here) are gone — after their history moved');
  assert.equal(db.accounts.filter((a) => a.plaidItemId === 'pi_new').length, 3, 'one row per mask, on the new item');
  assert.equal(db.accounts.filter((a) => a.plaidItemId === 'pi_old').length, 0);
  for (const a of db.accounts) {
    assert.ok(['acc_new_2518', 'acc_new_3062', 'acc_new_9689'].includes(a.id));
    assert.equal(a.accountCode, `1200-${a.mask}`, "the OLD row's bookkeeping rides on the survivor");
    assert.equal(a.entityType, 'trading');
    assert.equal(a.entity_id, 'ent-1');
    assert.equal(a.accountId, `plaid_new_${a.mask}`, "the NEW row's Plaid identity");
    assert.equal(a.name, `tastytrade ${a.mask}`);
    assert.equal(a.currentBalance, 31.5);
  }
  // every history row now points at a surviving account
  const live = new Set(db.accounts.map((a) => a.id));
  assert.ok(db.transactions.every((r) => live.has(r.accountId)));
  assert.ok(db.investment_transactions.every((r) => live.has(r.accountId)));
  assert.ok(db.bank_reconciliations.every((r) => live.has(r.account_id)));
  const r2518 = report.pairs.find((p) => p.mask === '2518')!;
  assert.deepEqual(r2518.moved, { transactions: 40, investment_transactions: 120, bank_reconciliations: 1 });
  assert.deepEqual(r2518.after, { transactions: 40, investment_transactions: 359, bank_reconciliations: 1 });
  assert.deepEqual(db.retirements, [{ itemRowId: 'pi_old', at: NOW, reason: 'replaced by NEWITEMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' }]);
  assert.equal(db.items.length, 2, 'plaid_items rows are never deleted');
  assert.equal(db.items[0].retired_at, NOW);

  // Re-run: the old item is retired → nothing to attach, nothing written.
  const again = await attachItem(db, { userId: USER, newItemRowId: 'pi_new', now: NOW });
  assert.deepEqual(again.plan, { kind: 'nothing', reason: 'no live item of institution ins_116995 to retire — nothing to attach' });
  assert.equal(again.report, null);
  assert.deepEqual(await totals(db), before);
  assert.equal(db.deleted.length, 3);
});

test('a move that leaves history on the donor throws and rolls the whole transaction back — no delete, no retire', async () => {
  const db = theCase();
  db.moveDropsInvestments = true;
  const before = structuredClone({ totals: await totals(db), accounts: db.accounts.map((a) => a.id).sort() });
  const plan = await planAttach(db, { userId: USER, newItemRowId: 'pi_new' });
  assert.equal(plan.kind, 'merge');
  if (plan.kind !== 'merge') return;
  await assert.rejects(executeAttach(db, plan, NOW), (e: unknown) => e instanceof AttachIntegrityError && /moved .* but the donor held/.test(e.message));
  assert.deepEqual(await totals(db), before.totals);
  assert.deepEqual(db.accounts.map((a) => a.id).sort(), before.accounts, 'no row deleted');
  assert.deepEqual(db.retirements, []);
  assert.equal(db.items.every((i) => i.retired_at === null), true);
  assert.equal(db.transactions.every((r) => r.accountId.startsWith('acc_old_')), true, 'the partial move was rolled back');
});

test('an unmatched new account is left alone; an unclaimed old account stays on the retired item with its history', async () => {
  const db = theCase();
  db.accounts.push(account({ id: 'acc_new_extra', plaidItemId: 'pi_new', accountId: 'plaid_new_extra', mask: '0001' }));
  db.accounts.push(account({ id: 'acc_old_gone', plaidItemId: 'pi_old', accountId: 'plaid_old_gone', mask: '0002' }));
  db.transactions.push({ id: 'g1', accountId: 'acc_old_gone' });
  const { plan, report } = await attachItem(db, { userId: USER, newItemRowId: 'pi_new', now: NOW });
  assert.equal(plan.kind, 'merge');
  assert.deepEqual(report?.unmatchedNew, ['acc_new_extra']);
  assert.deepEqual(report?.unmatchedOld, ['acc_old_gone']);
  assert.ok(db.accounts.find((a) => a.id === 'acc_old_gone')?.plaidItemId === 'pi_old', 'still attached to the retired item');
  assert.equal(db.transactions.filter((r) => r.accountId === 'acc_old_gone').length, 1, 'its history untouched');
  assert.match(describePlan(plan), /1 new account\(s\) without a twin; 1 old account\(s\) unclaimed, staying on the retired item/);
});
