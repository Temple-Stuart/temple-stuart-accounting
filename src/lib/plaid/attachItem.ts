/**
 * BANK-03 — attach a fresh Plaid item to the account rows that already carry
 * the history; retire the item it replaces.
 *
 * A fresh OAuth link creates a NEW Plaid item with NEW Plaid account_ids for
 * the same physical accounts (exchange-token's mask+type dedup did not fire),
 * so the user ends with two account rows per mask: the old row with the
 * history (transactions, investment rows, reconciliations) and the new row
 * with what the fresh link landed. Plaid refuses the old item in update mode.
 *
 * THE MERGE, per (institutionId, mask) — never by name:
 *   plan    — the new item must be the caller's, live, with an institutionId,
 *             and the NEWEST of its institution (pointed at the old item the
 *             merge stops rather than retire the fresh one); exactly ONE live
 *             older item of the same institution; each new
 *             account with a mask must match exactly ONE old account by mask
 *             (any ambiguity stops the whole merge, nothing written); the
 *             survivor of a pair is the row with MORE history (ties → the old
 *             row, its id already referenced everywhere); a reconciliation
 *             for the same (entity, year, month) on both rows stops.
 *   execute — in ONE transaction: move every history row from the donor to
 *             the survivor (three tables, counted), assert the donor is empty,
 *             delete the donor, give the survivor the NEW row's Plaid identity
 *             (item, account_id, name, type, mask, balances) and the OLD row's
 *             bookkeeping (accountCode, subAccount, entityType, entity), then
 *             assert the total history count is unchanged; retire the old
 *             item (retired_at, retired_reason = 'replaced by <new item id>').
 *             plaid_items rows are never deleted. Any failed assertion throws
 *             → rollback.
 *   re-run  — the old item is retired, so there is no live item to merge:
 *             'nothing', no writes.
 *
 * Pure over the AttachDb port; prismaAttach.ts binds Prisma.
 */

export interface AttachItem {
  id: string;
  userId: string;
  /** Plaid's item_id. */
  itemId: string;
  institutionId: string | null;
  institutionName: string | null;
  retired_at: Date | null;
  createdAt: Date;
}

export interface AttachAccount {
  id: string;
  plaidItemId: string | null;
  /** Plaid's account_id (unique). */
  accountId: string;
  mask: string | null;
  name: string;
  officialName: string | null;
  type: string;
  subtype: string | null;
  currentBalance: number | null;
  availableBalance: number | null;
  isoCurrencyCode: string | null;
  accountCode: string | null;
  subAccount: string | null;
  entityType: string | null;
  entity_id: string | null;
}

export const HISTORY_TABLES = ['transactions', 'investment_transactions', 'bank_reconciliations'] as const;
export type HistoryTable = (typeof HISTORY_TABLES)[number];
export type HistoryCounts = Record<HistoryTable, number>;

export const ZERO: HistoryCounts = { transactions: 0, investment_transactions: 0, bank_reconciliations: 0 };
export const addCounts = (a: HistoryCounts, b: HistoryCounts): HistoryCounts => ({
  transactions: a.transactions + b.transactions,
  investment_transactions: a.investment_transactions + b.investment_transactions,
  bank_reconciliations: a.bank_reconciliations + b.bank_reconciliations,
});
export const totalOf = (c: HistoryCounts): number => c.transactions + c.investment_transactions + c.bank_reconciliations;
const sameCounts = (a: HistoryCounts, b: HistoryCounts) => HISTORY_TABLES.every((t) => a[t] === b[t]);

export interface SurvivorUpdate {
  plaidItemId: string;
  accountId: string;
  name: string;
  officialName: string | null;
  type: string;
  subtype: string | null;
  mask: string | null;
  currentBalance: number | null;
  availableBalance: number | null;
  isoCurrencyCode: string | null;
  accountCode: string | null;
  subAccount: string | null;
  entityType: string | null;
  entity_id: string | null;
  updatedAt: Date;
}

/** The port. `transaction` runs `fn` against a port bound to one database transaction; a throw inside rolls it back. */
export interface AttachDb {
  item(userId: string, itemRowId: string): Promise<AttachItem | null>;
  liveItemsOfInstitution(userId: string, institutionId: string, excludeItemRowId: string): Promise<AttachItem[]>;
  accountsOfItem(itemRowId: string): Promise<AttachAccount[]>;
  historyCounts(accountRowId: string): Promise<HistoryCounts>;
  /** (entity_id, year, month) reconciliation keys present on BOTH rows — a move would violate the unique key. */
  reconciliationCollisions(accountRowIdA: string, accountRowIdB: string): Promise<number>;
  /** UPDATE … SET account = to WHERE account = from, on every history table; resolves to the rows moved. */
  moveHistory(fromAccountRowId: string, toAccountRowId: string): Promise<HistoryCounts>;
  deleteAccount(accountRowId: string): Promise<void>;
  updateSurvivor(accountRowId: string, data: SurvivorUpdate): Promise<void>;
  retireItem(itemRowId: string, at: Date, reason: string): Promise<void>;
  transaction<T>(fn: (tx: AttachDb) => Promise<T>): Promise<T>;
}

export interface AttachPair {
  mask: string;
  oldRow: AttachAccount;
  newRow: AttachAccount;
  survivorIs: 'old' | 'new';
  survivor: AttachAccount;
  donor: AttachAccount;
  before: { old: HistoryCounts; new: HistoryCounts };
}

export type AttachPlan =
  | { kind: 'nothing'; reason: string }
  | { kind: 'stop'; reason: string }
  | {
      kind: 'merge';
      newItem: AttachItem;
      oldItem: AttachItem;
      pairs: AttachPair[];
      /** New-item accounts with no old twin — genuinely new, left as they are. */
      unmatchedNew: AttachAccount[];
      /** Old-item accounts no new account claimed — they stay on the retired item with their history. */
      unmatchedOld: AttachAccount[];
      retireReason: string;
      totalBefore: HistoryCounts;
    };

export class AttachIntegrityError extends Error {
  constructor(message: string) {
    super(`attach-item integrity: ${message}`);
    this.name = 'AttachIntegrityError';
  }
}

export const retireReasonFor = (newItem: AttachItem): string => `replaced by ${newItem.itemId}`;

/** Read-only: decide the merge, or why not. Nothing is written here. */
export async function planAttach(db: AttachDb, input: { userId: string; newItemRowId: string }): Promise<AttachPlan> {
  const newItem = await db.item(input.userId, input.newItemRowId);
  if (!newItem) return { kind: 'stop', reason: 'Bank connection not found' };
  if (newItem.retired_at) return { kind: 'stop', reason: `the item ${newItem.itemId} is itself retired (${newItem.retired_at.toISOString()})` };
  if (!newItem.institutionId || newItem.institutionId === 'unknown') return { kind: 'stop', reason: `the item ${newItem.itemId} has no institutionId — matching is by institutionId + mask, never by name` };

  const olderLive = await db.liveItemsOfInstitution(input.userId, newItem.institutionId, newItem.id);
  if (olderLive.length === 0) return { kind: 'nothing', reason: `no live item of institution ${newItem.institutionId} to retire — nothing to attach` };
  if (olderLive.length > 1) return { kind: 'stop', reason: `${olderLive.length} live items of institution ${newItem.institutionId} besides ${newItem.itemId} (${olderLive.map((i) => i.itemId).join(', ')}) — one replacement at a time` };
  const oldItem = olderLive[0];
  // Direction: the item given must be the NEWER one — the fresh link. Pointed at the old
  // item, the merge would retire the fresh one; that is a stop, not a guess.
  if (oldItem.createdAt.getTime() >= newItem.createdAt.getTime()) {
    return { kind: 'stop', reason: `the item ${newItem.itemId} (created ${newItem.createdAt.toISOString()}) is not the newest of institution ${newItem.institutionId}: ${oldItem.itemId} was created ${oldItem.createdAt.toISOString()} — run the merge on the newest item` };
  }

  const newAccounts = await db.accountsOfItem(newItem.id);
  const oldAccounts = await db.accountsOfItem(oldItem.id);
  if (newAccounts.length === 0) return { kind: 'stop', reason: `the item ${newItem.itemId} has no account rows` };

  const pairs: AttachPair[] = [];
  const unmatchedNew: AttachAccount[] = [];
  const claimedOld = new Map<string, string>();
  for (const n of newAccounts) {
    const mask = n.mask?.trim();
    if (!mask) { unmatchedNew.push(n); continue; }
    const twins = oldAccounts.filter((o) => (o.mask?.trim() ?? '') === mask);
    if (twins.length === 0) { unmatchedNew.push(n); continue; }
    if (twins.length > 1) return { kind: 'stop', reason: `mask ${mask}: ${twins.length} old accounts carry it (${twins.map((t) => t.id).join(', ')}) — ambiguous, nothing merged` };
    const o = twins[0];
    const already = claimedOld.get(o.id);
    if (already) return { kind: 'stop', reason: `mask ${mask}: two new accounts (${already}, ${n.accountId}) claim old account ${o.id} — ambiguous, nothing merged` };
    claimedOld.set(o.id, n.accountId);
    const before = { old: await db.historyCounts(o.id), new: await db.historyCounts(n.id) };
    const survivorIs: 'old' | 'new' = totalOf(before.new) > totalOf(before.old) ? 'new' : 'old';
    const survivor = survivorIs === 'old' ? o : n;
    const donor = survivorIs === 'old' ? n : o;
    const collisions = await db.reconciliationCollisions(donor.id, survivor.id);
    if (collisions > 0) return { kind: 'stop', reason: `mask ${mask}: ${collisions} reconciliation(s) for the same entity/year/month on both rows — a move would collide, nothing merged` };
    pairs.push({ mask, oldRow: o, newRow: n, survivorIs, survivor, donor, before });
  }
  if (pairs.length === 0) return { kind: 'stop', reason: `no new account's mask matches an old account of ${oldItem.itemId} — nothing to attach` };

  const unmatchedOld = oldAccounts.filter((o) => !claimedOld.has(o.id));
  const totalBefore = pairs.reduce((sum, p) => addCounts(sum, addCounts(p.before.old, p.before.new)), ZERO);
  return { kind: 'merge', newItem, oldItem, pairs, unmatchedNew, unmatchedOld, retireReason: retireReasonFor(newItem), totalBefore };
}

export interface AttachReport {
  pairs: Array<{ mask: string; survivorId: string; survivorWas: 'old' | 'new'; deletedAccountId: string; moved: HistoryCounts; after: HistoryCounts }>;
  retired: { itemRowId: string; itemId: string; institutionName: string | null; reason: string };
  unmatchedNew: string[];
  unmatchedOld: string[];
  totalBefore: HistoryCounts;
  totalAfter: HistoryCounts;
}

/** The survivor's row after the merge: the NEW row's Plaid identity, the OLD row's bookkeeping. */
export function survivorUpdate(pair: AttachPair, newItemRowId: string, now: Date): SurvivorUpdate {
  const { oldRow, newRow, survivor } = pair;
  return {
    plaidItemId: newItemRowId,
    accountId: newRow.accountId,
    name: newRow.name,
    officialName: newRow.officialName,
    type: newRow.type,
    subtype: newRow.subtype,
    mask: newRow.mask,
    currentBalance: newRow.currentBalance,
    availableBalance: newRow.availableBalance,
    isoCurrencyCode: newRow.isoCurrencyCode,
    accountCode: oldRow.accountCode ?? survivor.accountCode,
    subAccount: oldRow.subAccount ?? survivor.subAccount,
    entityType: oldRow.entityType ?? survivor.entityType,
    entity_id: oldRow.entity_id ?? survivor.entity_id,
    updatedAt: now,
  };
}

/** One transaction. Every assertion that fails throws AttachIntegrityError → rollback. */
export async function executeAttach(db: AttachDb, plan: Extract<AttachPlan, { kind: 'merge' }>, now: Date = new Date()): Promise<AttachReport> {
  return db.transaction(async (tx) => {
    const pairs: AttachReport['pairs'] = [];
    for (const pair of plan.pairs) {
      const { survivor, donor } = pair;
      const donorBefore = pair.survivorIs === 'old' ? pair.before.new : pair.before.old;
      const moved = await tx.moveHistory(donor.id, survivor.id);
      if (!sameCounts(moved, donorBefore)) throw new AttachIntegrityError(`mask ${pair.mask}: moved ${JSON.stringify(moved)} but the donor held ${JSON.stringify(donorBefore)}`);
      const left = await tx.historyCounts(donor.id);
      if (totalOf(left) !== 0) throw new AttachIntegrityError(`mask ${pair.mask}: ${totalOf(left)} history row(s) still on the donor ${donor.id} after the move — not deleting`);
      await tx.deleteAccount(donor.id);
      await tx.updateSurvivor(survivor.id, survivorUpdate(pair, plan.newItem.id, now));
      const after = await tx.historyCounts(survivor.id);
      const expected = addCounts(pair.before.old, pair.before.new);
      if (!sameCounts(after, expected)) throw new AttachIntegrityError(`mask ${pair.mask}: the survivor holds ${JSON.stringify(after)}, expected ${JSON.stringify(expected)}`);
      pairs.push({ mask: pair.mask, survivorId: survivor.id, survivorWas: pair.survivorIs, deletedAccountId: donor.id, moved, after });
    }
    const totalAfter = pairs.reduce((sum, p) => addCounts(sum, p.after), ZERO);
    if (!sameCounts(totalAfter, plan.totalBefore)) throw new AttachIntegrityError(`history total changed: before ${JSON.stringify(plan.totalBefore)}, after ${JSON.stringify(totalAfter)}`);
    await tx.retireItem(plan.oldItem.id, now, plan.retireReason);
    return {
      pairs,
      retired: { itemRowId: plan.oldItem.id, itemId: plan.oldItem.itemId, institutionName: plan.oldItem.institutionName, reason: plan.retireReason },
      unmatchedNew: plan.unmatchedNew.map((a) => a.id),
      unmatchedOld: plan.unmatchedOld.map((a) => a.id),
      totalBefore: plan.totalBefore,
      totalAfter,
    };
  });
}

/** Plan, then execute unless dryRun. */
export async function attachItem(db: AttachDb, input: { userId: string; newItemRowId: string; now?: Date; dryRun?: boolean }): Promise<{ plan: AttachPlan; report: AttachReport | null }> {
  const plan = await planAttach(db, input);
  if (plan.kind !== 'merge' || input.dryRun) return { plan, report: null };
  return { plan, report: await executeAttach(db, plan, input.now ?? new Date()) };
}

/** The one-line summary for a route answer or a script. */
export function describePlan(plan: AttachPlan): string {
  if (plan.kind !== 'merge') return plan.reason;
  const masks = plan.pairs.map((p) => `••••${p.mask} (${p.survivorIs} row survives)`).join(', ');
  const extra = [
    plan.unmatchedNew.length ? `${plan.unmatchedNew.length} new account(s) without a twin` : '',
    plan.unmatchedOld.length ? `${plan.unmatchedOld.length} old account(s) unclaimed, staying on the retired item` : '',
  ].filter(Boolean).join('; ');
  return `${plan.newItem.institutionName ?? 'the new item'} ← ${plan.oldItem.institutionName ?? 'the old item'}: ${masks}; ${totalOf(plan.totalBefore)} history rows${extra ? `; ${extra}` : ''}`;
}
