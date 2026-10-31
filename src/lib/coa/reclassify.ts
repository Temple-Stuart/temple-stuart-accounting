import { ValidationError } from '@/lib/errors/ValidationError';
import { renderCode } from './scheme';
import type { ChartAccountRow } from './accounts';

/**
 * COA-01 — reclassify: move a balance from one account to another by POSTING
 * A NEW JOURNAL ENTRY with a memo. Nothing old is edited: the prior entries,
 * lines and transactions stay exactly as posted (the no_ledger_updates trigger
 * would refuse an edit anyway — src/lib/journal-entry-service.ts's doctrine).
 * Used for Finnhub B-5130 → B-6250 once the fixed-cost family exists.
 *
 * planReclassification is pure and fails loud: same entity, same family (an
 * expense balance moves to an expense account — across families is a manual
 * entry, not a reclass), the target active, a memo, an amount within the
 * source balance. The entry it plans is balanced by construction — one debit
 * and one credit of the same amount — and the balance deltas follow the same
 * rule every writer uses (journal-entry-service.ts:50-53, manual/route.ts:98-100):
 * an entry of the account's own balance_type adds, the other subtracts.
 */

export interface ReclassInput {
  from: ChartAccountRow;
  to: ChartAccountRow;
  /** Cents to move; omitted → the whole balance. */
  amountCents?: bigint | number | string | null;
  memo: unknown;
  date: Date;
}

export interface ReclassLine {
  account_id: string;
  entry_type: 'D' | 'C';
  amount: bigint;
  /** What the line does to chart_of_accounts.settled_balance. */
  balanceDelta: bigint;
}

export interface ReclassPlan {
  amount: bigint;
  memo: string;
  date: Date;
  description: string;
  lines: [ReclassLine, ReclassLine];
  metadata: { reclass: { from_id: string; from_code: string; to_id: string; to_code: string; amount_cents: string; memo: string } };
}

function toCents(input: ReclassInput['amountCents'], whole: bigint): bigint {
  if (input === undefined || input === null || input === '') return whole;
  let n: bigint;
  try {
    n = typeof input === 'bigint' ? input : BigInt(typeof input === 'number' ? Math.round(input) : String(input).trim());
  } catch {
    throw new ValidationError(`amountCents "${String(input)}" is not a whole number of cents`, { field: 'amountCents' });
  }
  return n;
}

const other = (t: 'D' | 'C'): 'D' | 'C' => (t === 'D' ? 'C' : 'D');

export function planReclassification(input: ReclassInput): ReclassPlan {
  const { from, to } = input;
  const fromCode = renderCode(from.code, from.entity_type, from.sub_type);
  const toCode = renderCode(to.code, to.entity_type, to.sub_type);
  if (from.id === to.id) throw new ValidationError(`${fromCode} cannot be reclassified into itself`, { field: 'toCode' });
  if (from.entity_id !== to.entity_id) throw new ValidationError(`${fromCode} and ${toCode} are in different entities — a reclass stays inside one chart`, { field: 'toCode' });
  if (from.account_type !== to.account_type) {
    throw new ValidationError(
      `a reclass moves a balance within one family — ${fromCode} is ${from.account_type}, ${toCode} is ${to.account_type}; use a manual journal entry across families`,
      { field: 'toCode' },
    );
  }
  if (from.balance_type !== to.balance_type) {
    throw new ValidationError(`${fromCode} (${from.balance_type}) and ${toCode} (${to.balance_type}) carry different normal balances — not a reclass`, { field: 'toCode' });
  }
  if (to.is_archived) throw new ValidationError(`${toCode} is retired — restore it before moving a balance into it`, { field: 'toCode' });
  const memo = typeof input.memo === 'string' ? input.memo.trim().replace(/\s+/g, ' ') : '';
  if (!memo) throw new ValidationError('a memo is required — say why the balance moves', { field: 'memo' });
  if (!(input.date instanceof Date) || Number.isNaN(input.date.getTime())) throw new ValidationError('date is not a date', { field: 'date' });

  const balance = BigInt(from.settled_balance);
  if (balance === BigInt(0)) throw new ValidationError(`${fromCode} has a zero balance — nothing to move`, { field: 'fromCode' });
  const whole = balance < BigInt(0) ? -balance : balance;
  const amount = toCents(input.amountCents, whole);
  if (amount <= BigInt(0)) throw new ValidationError('amountCents must be more than zero', { field: 'amountCents' });
  if (amount > whole) throw new ValidationError(`amountCents ${amount} is more than ${fromCode}'s balance of ${whole} cents`, { field: 'amountCents' });

  const normal = from.balance_type as 'D' | 'C';
  // A positive balance sits on the account's normal side: take it OFF with the
  // other side and put it ON the target with the normal side. A negative
  // balance is the mirror image.
  const fromType: 'D' | 'C' = balance > BigInt(0) ? other(normal) : normal;
  const toType: 'D' | 'C' = other(fromType);
  const delta = (entryType: 'D' | 'C', balanceType: string) => (entryType === balanceType ? amount : -amount);
  const lines: [ReclassLine, ReclassLine] = [
    { account_id: from.id, entry_type: fromType, amount, balanceDelta: delta(fromType, from.balance_type) },
    { account_id: to.id, entry_type: toType, amount, balanceDelta: delta(toType, to.balance_type) },
  ];
  return {
    amount,
    memo,
    date: input.date,
    description: `Reclassify ${fromCode} → ${toCode}: ${memo}`,
    lines,
    metadata: { reclass: { from_id: from.id, from_code: from.code, to_id: to.id, to_code: to.code, amount_cents: amount.toString(), memo } },
  };
}

/**
 * The write port a reclass needs — ONE posting of the whole entry (HYG-04:
 * postJournal's `post` in production — the journal row, every line in one
 * statement, the balance moves, the id read back after commit). There is no
 * way to edit a prior row through it.
 */
export interface PostingDb {
  postEntry(input: {
    entry: {
      userId: string;
      entity_id: string;
      date: Date;
      description: string;
      source_type: 'reclass';
      status: 'posted';
      request_id: string;
      created_by: string | null;
      metadata: ReclassPlan['metadata'];
    };
    lines: Array<{ account_id: string; entry_type: 'D' | 'C'; amount: bigint; balanceDelta: bigint; created_by: string | null }>;
  }): Promise<{ id: string }>;
}

export interface PostingContext {
  userId: string;
  entityId: string;
  requestId: string;
  createdBy: string | null;
}

export async function postReclassification(db: PostingDb, ctx: PostingContext, plan: ReclassPlan): Promise<{ journalEntryId: string }> {
  const je = await db.postEntry({
    entry: {
      userId: ctx.userId,
      entity_id: ctx.entityId,
      date: plan.date,
      description: plan.description,
      source_type: 'reclass',
      status: 'posted',
      request_id: ctx.requestId,
      created_by: ctx.createdBy,
      metadata: plan.metadata,
    },
    lines: plan.lines.map((line) => ({ account_id: line.account_id, entry_type: line.entry_type, amount: line.amount, balanceDelta: line.balanceDelta, created_by: ctx.createdBy })),
  });
  return { journalEntryId: je.id };
}
