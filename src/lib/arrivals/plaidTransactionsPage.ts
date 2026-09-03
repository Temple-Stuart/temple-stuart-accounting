/**
 * REBUILD-01 PR-2 — one page of /transactions/get, raw-first, in ONE database
 * transaction:
 *
 *   landResponse → landObjects → the parser writes transactions rows FROM THE
 *   ARRIVAL PAYLOADS (never from response.data) and sets transactions.arrival_id
 *   → each new arrival's read = now, status = done.
 *
 * A parser throw rolls the whole page back (the response row, the page's
 * arrivals, its domain writes) and the caller answers with the HYG-01 envelope
 * carrying stage 'transactions', the page number and the summarized error; the
 * landed rows of earlier pages stay. An arrival the table already held is
 * LINKED (transactions.arrival_id), not re-parsed, and counted as
 * already_landed — promise 2 working, not an error.
 *
 * The parser itself is sync-complete's existing domain logic, moved here
 * unchanged in behavior: the "complete data" skip, the upsert, the pending
 * delete (promise 1 on the domain table is PR-2b).
 */
import type { Transaction } from 'plaid';
import { stageFailed, type StageFailed } from '@/lib/plaid/failLoud';
import type { WireStamp } from '@/lib/plaid/wire';
import { landObjects, landResponse, markRead, type JsonObject, type LandingDb } from './land';

export const PLAID = 'plaid';
export const TRANSACTION = 'transaction';

export interface ExistingTxn {
  transactionId: string;
  personal_finance_category: unknown;
}

export interface PageAccount {
  id: string;
  accountId: string;
}

/** The subset of the Prisma transaction client the parser writes through (typed loosely so a fake can stand in). */
export interface DomainDb {
  transactions: {
    upsert(args: { where: { transactionId: string }; create: Record<string, unknown>; update: Record<string, unknown> }): Promise<unknown>;
    updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<unknown>;
    deleteMany(args: { where: Record<string, unknown> }): Promise<unknown>;
  };
}

export interface TransactionsPageInput {
  page: number;
  userId: string;
  /** The Plaid item this page belongs to — its item_id is the arrival's `connection`. */
  connection: string;
  accounts: PageAccount[];
  existing: Map<string, ExistingTxn>;
  /** The answer as it came off the wire. */
  wire: WireStamp;
  httpStatus: number;
  /** The objects in the answer — landed as they are; the parser never reads them. */
  transactions: Transaction[];
  now?: () => Date;
}

export interface PageCounts {
  landed: number;
  already_landed: number;
  synced: number;
  skipped: number;
}

/** The existing domain write, from an arrival's payload. */
async function parseTransaction(domain: DomainDb, ctx: TransactionsPageInput, arrivalId: string, txn: Transaction, counts: PageCounts, now: Date): Promise<void> {
  const account = ctx.accounts.find((acc) => acc.accountId === txn.account_id);
  if (!account) return;

  const existing = ctx.existing.get(txn.transaction_id);
  if (existing && existing.personal_finance_category !== null) {
    // Already has complete data — skip expensive update; still point the row at its arrival.
    await domain.transactions.updateMany({ where: { transactionId: txn.transaction_id, arrival_id: null }, data: { arrival_id: arrivalId } });
    counts.skipped++;
    counts.synced++;
    return;
  }

  const t = txn as Transaction & Record<string, unknown>;
  const txnData = {
    amount: txn.amount,
    date: new Date(txn.date),
    name: txn.name,
    merchantName: txn.merchant_name,
    category: txn.category?.join(', ') || null,
    pending: txn.pending || false,
    authorized_date: txn.authorized_date ? new Date(txn.authorized_date) : null,
    authorized_datetime: txn.authorized_datetime ? new Date(txn.authorized_datetime) : null,
    counterparties: t.counterparties || null,
    location: t.location || null,
    payment_channel: txn.payment_channel,
    payment_meta: t.payment_meta || null,
    personal_finance_category: t.personal_finance_category || null,
    personal_finance_category_icon_url: t.personal_finance_category_icon_url,
    transaction_code: txn.transaction_code,
    transaction_type: t.transaction_type,
    logo_url: t.logo_url,
    website: t.website,
    arrival_id: arrivalId,
    updatedAt: now,
  };

  await domain.transactions.upsert({
    where: { transactionId: txn.transaction_id },
    create: {
      id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      transactionId: txn.transaction_id,
      accountId: account.id,
      ...txnData,
    },
    update: txnData,
  });
  counts.synced++;

  // If this is a posted transaction, delete any matching pending duplicates
  if (!txn.pending) {
    const twoDaysAgo = new Date(txn.date);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const twoDaysAfter = new Date(txn.date);
    twoDaysAfter.setDate(twoDaysAfter.getDate() + 2);

    await domain.transactions.deleteMany({
      where: {
        accountId: account.id,
        amount: txn.amount,
        pending: true,
        date: { gte: twoDaysAgo, lte: twoDaysAfter },
        transactionId: { not: txn.transaction_id },
      },
    });
  }
}

/** Inside the caller's transaction: land, parse from the table, mark read. Throws to roll the page back. */
export async function landTransactionsPage(landing: LandingDb, domain: DomainDb, input: TransactionsPageInput): Promise<PageCounts> {
  const now = input.now ?? (() => new Date());
  const counts: PageCounts = { landed: 0, already_landed: 0, synced: 0, skipped: 0 };

  const response = await landResponse(landing, {
    provider: PLAID,
    resource: TRANSACTION,
    userId: input.userId,
    guestRef: null,
    httpStatus: input.httpStatus,
    body: input.wire.body,
    asked: input.wire.asked,
    arrived: input.wire.arrived,
  });

  const landed = await landObjects(landing, {
    provider: PLAID,
    resource: TRANSACTION,
    connection: input.connection,
    userId: input.userId,
    guestRef: null,
    responseId: response.id,
    asked: input.wire.asked,
    arrived: input.wire.arrived,
    objects: input.transactions.map((t) => ({ theirId: t.transaction_id, payload: t as unknown as JsonObject })),
  });
  counts.landed = landed.newIds.size;
  counts.already_landed = landed.existingIds.size + landed.repeatedInAnswer;

  const at = now();
  for (const row of landed.rows) {
    if (landed.existingIds.has(row.their_id)) {
      // Promise 2: the table already holds this object — link the domain row, never re-parse.
      await domain.transactions.updateMany({ where: { transactionId: row.their_id, arrival_id: null }, data: { arrival_id: row.id } });
      continue;
    }
    // The parser reads the arrival, never the HTTP object.
    await parseTransaction(domain, input, row.id, row.payload as Transaction, counts, at);
  }

  await markRead(landing, [...landed.newIds.values()], at);
  return counts;
}

export interface PageClient {
  $transaction<T>(fn: (tx: unknown) => Promise<T>, options?: { maxWait?: number; timeout?: number }): Promise<T>;
}

export type PageResult = { ok: true; counts: PageCounts } | { ok: false; failure: StageFailed & { page: number } };

/** One page, one transaction. A throw inside rolls the page back and comes out as the declared failure. */
export async function runTransactionsPage(
  client: PageClient,
  ports: (tx: unknown) => { landing: LandingDb; domain: DomainDb },
  input: TransactionsPageInput,
): Promise<PageResult> {
  try {
    const counts = await client.$transaction(async (tx) => {
      const { landing, domain } = ports(tx);
      return landTransactionsPage(landing, domain, input);
    }, { maxWait: 10_000, timeout: 120_000 });
    return { ok: true, counts };
  } catch (error) {
    return { ok: false, failure: { ...stageFailed('transactions', error, input.page), page: input.page } };
  }
}
