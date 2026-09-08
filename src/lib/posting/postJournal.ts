import { randomUUID } from 'crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import { ValidationError } from '@/lib/errors/ValidationError';

/**
 * HYG-04 — NO POSTING PATH MAY REPORT SUCCESS ON A ROLLED-BACK WRITE.
 *
 * The ledger's balance check is a DEFERRABLE INITIALLY DEFERRED constraint
 * trigger (prisma/migrations/20260226000500_fix_balance_trigger_deferred): it
 * fires at COMMIT. Prisma's interactive $transaction resolves through a
 * commit-time refusal without throwing (prisma/prisma#26366 — "the
 * transaction is rolled back but no JavaScript error is thrown"; reproduced
 * on this repo's Prisma 5.22 in the COA-01 / HYG-04 probes), so every path
 * that posted through $transaction could return 200 on nothing.
 *
 * ONE discipline, carried here and nowhere else:
 *   1. `SET CONSTRAINTS ALL IMMEDIATE` is the FIRST statement of the
 *      transaction — the balance check fires at write time and throws inside
 *      the transaction, where Prisma reports it. In immediate mode the row
 *      trigger runs at the end of the STATEMENT that inserted the row, so an
 *      entry's lines go in as ONE createMany (two separate INSERTs would be
 *      refused after the first — probe case B);
 *   2. after COMMIT, every posted entry id is READ BACK; an id that is not
 *      there is a PostingNotLandedError — never a success.
 *
 * `postJournal(client, body)` opens the transaction, hands the body a `post`
 * that writes one entry (journal row + lines in one statement + the balance
 * increments the caller computed) and records its id, runs the body's other
 * writes in the same transaction, commits, reads back, and only then returns.
 * The build's posting law (scripts/assert-tool-registry.ts) fails if a
 * journal or ledger row is created anywhere else in src/.
 */

export type PostingTx = Prisma.TransactionClient;

export interface JournalEntryInput {
  userId: string;
  entity_id: string;
  date: Date;
  description: string;
  source_type: string;
  source_id?: string | null;
  status?: string;
  is_reversal?: boolean;
  reverses_entry_id?: string | null;
  request_id?: string | null;
  created_by?: string | null;
  vendor_id?: string | null;
  metadata?: Prisma.InputJsonValue;
}

export interface JournalLineInput {
  account_id: string;
  entry_type: 'D' | 'C';
  /** Cents, positive. */
  amount: bigint;
  /** What this line does to chart_of_accounts.settled_balance — the caller's rule (balanceDeltaOf). */
  balanceDelta: bigint;
  created_by?: string | null;
}

export interface PostedEntry {
  id: string;
  /** One id per line, in the order given. */
  lineIds: string[];
}

export interface PostEntryInput {
  entry: JournalEntryInput;
  lines: JournalLineInput[];
}

/** The one write a posting path makes: journal row + its lines + the balance moves, inside postJournal's transaction. */
export type PostEntry = (input: PostEntryInput) => Promise<PostedEntry>;

export interface PostJournalResult<T> {
  result: T;
  /** Every entry `post` wrote in this transaction, each read back after commit. */
  journalEntryIds: string[];
}

export type PostJournalOptions = { maxWait?: number; timeout?: number };

/** The transaction committed on the client's side, but the entry is not in the database: a commit-time refusal Prisma did not surface. */
export class PostingNotLandedError extends Error {
  readonly journalEntryIds: string[];
  constructor(missing: string[]) {
    super(`posting not landed: journal entr${missing.length === 1 ? 'y' : 'ies'} ${missing.join(', ')} absent after commit — the database refused the transaction at commit and nothing was written`);
    this.name = 'PostingNotLandedError';
    this.journalEntryIds = missing;
  }
}

/** The balance rule every writer uses: an entry of the account's own normal side adds, the other side subtracts. */
export function balanceDeltaOf(entryType: 'D' | 'C', accountBalanceType: string, amount: bigint): bigint {
  return entryType === accountBalanceType ? amount : -amount;
}

/** Structural checks before any write — the balance itself is the database's word (the trigger), not duplicated here. */
function assertLines(lines: JournalLineInput[]): void {
  if (lines.length < 2) throw new ValidationError('a journal entry needs at least two lines', { field: 'lines' });
  for (const l of lines) {
    if (l.entry_type !== 'D' && l.entry_type !== 'C') throw new ValidationError(`line entry_type must be D or C, got ${String(l.entry_type)}`, { field: 'lines' });
    if (typeof l.amount !== 'bigint' || l.amount <= BigInt(0)) throw new ValidationError('line amount must be a positive number of cents', { field: 'lines' });
    if (typeof l.balanceDelta !== 'bigint') throw new ValidationError('line balanceDelta must be cents', { field: 'lines' });
    if (!l.account_id) throw new ValidationError('line account_id is required', { field: 'lines' });
  }
}

type Client = Pick<PrismaClient, '$transaction' | 'journal_entries'>;

export async function postJournal<T>(
  client: Client,
  body: (tx: PostingTx, post: PostEntry) => Promise<T>,
  options: PostJournalOptions = {},
): Promise<PostJournalResult<T>> {
  const posted: string[] = [];

  const result = await client.$transaction(async (tx) => {
    // 1. The FIRST statement: the deferred balance trigger fires at write time from here on.
    await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');

    const post: PostEntry = async ({ entry, lines }) => {
      assertLines(lines);
      const je = await tx.journal_entries.create({
        data: {
          userId: entry.userId,
          entity_id: entry.entity_id,
          date: entry.date,
          description: entry.description,
          source_type: entry.source_type,
          source_id: entry.source_id ?? null,
          status: entry.status ?? 'posted',
          is_reversal: entry.is_reversal ?? false,
          reverses_entry_id: entry.reverses_entry_id ?? null,
          request_id: entry.request_id ?? null,
          created_by: entry.created_by ?? null,
          vendor_id: entry.vendor_id ?? null,
          metadata: entry.metadata,
        },
        select: { id: true },
      });
      const lineIds = lines.map(() => randomUUID());
      // ONE statement for every line: the immediate row trigger checks the whole entry at the end of it.
      await tx.ledger_entries.createMany({
        data: lines.map((l, i) => ({
          id: lineIds[i],
          journal_entry_id: je.id,
          account_id: l.account_id,
          entry_type: l.entry_type,
          amount: l.amount,
          created_by: l.created_by ?? entry.created_by ?? null,
        })),
      });
      for (const l of lines) {
        await tx.chart_of_accounts.update({
          where: { id: l.account_id },
          data: { settled_balance: { increment: l.balanceDelta }, version: { increment: 1 } },
        });
      }
      posted.push(je.id);
      return { id: je.id, lineIds };
    };

    return body(tx, post);
  }, options);

  // 2. READ-BACK: success is claimed from the rows, never from the transaction's promise.
  if (posted.length > 0) {
    const found = await client.journal_entries.findMany({ where: { id: { in: posted } }, select: { id: true } });
    const seen = new Set(found.map((r) => r.id));
    const missing = posted.filter((id) => !seen.has(id));
    if (missing.length > 0) throw new PostingNotLandedError(missing);
  }

  return { result, journalEntryIds: posted };
}
