/**
 * PENDING-02 (Alex, 2026-11-11) — THE ONE READ of the postings whose bank row is gone
 * (src/lib/books/postingsWithNoBankRow.ts). GET /api/journal-entries/no-bank-row calls it; nothing else finds them.
 *
 * THE POSTINGS. The caller's LIVE bank postings — a journal entry that is
 *     je."userId" = the user · je.source_type = 'plaid_txn' · je.source_id IS NOT NULL ·
 *     je.is_reversal = false · je.reversed_by_entry_id IS NULL
 * — for which NO transactions row with that transactionId sits on an account of the same user
 * (transactions."transactionId" = je.source_id, through accounts."userId"). The last three conditions are the
 * statements' own standing filters (src/lib/books/statementsRead.ts): what this read lists is exactly what the
 * statements still count.
 *
 * ONE QUERY. It asks for the LINES of those entries — one row per ledger line, every column text — and folds them
 * here into one row per entry: nothing is fetched per row, and the list is never cut (no LIMIT, no page). The join to
 * the lines is a LEFT join so that an entry with no line is still listed, with no account and no amount. Newest
 * first: the entry's date, then when it was written, then its id.
 *
 * A line's amount arrives as text (bigint cents), is read as a number and checked whole — the statements' own rule
 * (statementsRead.ts statementRowOf); a side that is neither D nor C, or a line without its account, is a fault by
 * name. A day is the date column's own 'YYYY-MM-DD' (journal_entries.date is @db.Date; no zone arithmetic).
 *
 * Not pure: it reads through Prisma. It writes nothing.
 */
import type { PrismaClient } from '@prisma/client';
import type { LineAccount, PostingWithNoBankRow } from './postingsWithNoBankRow';

type Db = Pick<PrismaClient, '$queryRaw'>;

/** One ledger line of one posting, as the query answers it. The four line columns are NULL together for an entry with no line. */
interface LineRow {
  entry_id: string;
  day: string;
  description: string;
  bank_transaction_id: string;
  book: string;
  entry_type: string | null;
  cents: string | null;
  account_code: string | null;
  account_name: string | null;
}

interface Draft {
  id: string;
  day: string;
  description: string;
  bankTransactionId: string;
  book: string;
  debits: LineAccount[];
  credits: LineAccount[];
  cents: number;
}

const fault = (entryId: string, what: string): Error => new Error(`postings with no bank row: entry ${entryId} ${what}`);

/** The lines, folded into one row per entry, in the order the query gave the entries. */
function postingsOf(lines: readonly LineRow[]): PostingWithNoBankRow[] {
  const byEntry = new Map<string, Draft>();
  for (const line of lines) {
    let posting = byEntry.get(line.entry_id);
    if (posting === undefined) {
      posting = { id: line.entry_id, day: line.day, description: line.description, bankTransactionId: line.bank_transaction_id, book: line.book, debits: [], credits: [], cents: 0 };
      byEntry.set(line.entry_id, posting);
    }
    // The LEFT join's one empty row: an entry with no line. It is listed as it is — no account, and a sum over no line.
    if (line.entry_type === null) continue;
    if (line.entry_type !== 'D' && line.entry_type !== 'C') throw fault(line.entry_id, `has a line whose side is ${JSON.stringify(line.entry_type)}, neither D nor C`);
    if (line.account_code === null || line.account_name === null) throw fault(line.entry_id, 'has a line with no account');
    // The amount is the bigint column's own text: digits and nothing else — read as a number only then, and checked whole.
    const cents = line.cents !== null && /^-?\d+$/.test(line.cents) ? Number(line.cents) : Number.NaN;
    if (!Number.isSafeInteger(cents)) throw fault(line.entry_id, `has a line whose amount ${JSON.stringify(line.cents)} is not an integer number of cents`);
    const account: LineAccount = { code: line.account_code, name: line.account_name };
    if (line.entry_type === 'C') { posting.credits.push(account); continue; }
    posting.debits.push(account);
    posting.cents += cents;
    if (!Number.isSafeInteger(posting.cents)) throw fault(line.entry_id, 'has debit lines whose sum is not an integer number of cents');
  }
  return [...byEntry.values()];
}

/** THE READ: the caller's live bank postings whose bank row is not in the caller's accounts — one row each, newest first. */
export async function readPostingsWithNoBankRow(db: Db, userId: string): Promise<PostingWithNoBankRow[]> {
  const lines = await db.$queryRaw<LineRow[]>`
    SELECT
      je.id AS entry_id,
      to_char(je.date, 'YYYY-MM-DD') AS day,
      je.description,
      je.source_id AS bank_transaction_id,
      e.name AS book,
      le.entry_type,
      le.amount::text AS cents,
      coa.code AS account_code,
      coa.name AS account_name
    FROM journal_entries je
    JOIN entities e ON e.id = je.entity_id
    LEFT JOIN ledger_entries le ON le.journal_entry_id = je.id
    LEFT JOIN chart_of_accounts coa ON coa.id = le.account_id
    WHERE je."userId" = ${userId}
      AND je.source_type = 'plaid_txn'
      AND je.source_id IS NOT NULL
      AND je.is_reversal = false
      AND je.reversed_by_entry_id IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM transactions t
        JOIN accounts a ON a.id = t."accountId"
        WHERE t."transactionId" = je.source_id
          AND a."userId" = ${userId}
      )
    ORDER BY je.date DESC, je.created_at DESC, je.id DESC, le.entry_type DESC, le.created_at ASC, le.id ASC
  `;
  return postingsOf(lines);
}
