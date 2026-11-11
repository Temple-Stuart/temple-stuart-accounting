/**
 * BOOKS-01 (Alex, 2026-11-11 12:08: "get bookkeeping full proof") — THE ONE READ under the statements
 * (src/lib/books/statements.ts). /api/statements and /api/cpa-export both call readStatements; no route sums a
 * statement's rows any other way.
 *
 * Rows of summed debits and credits from ledger_entries × journal_entries × chart_of_accounts, grouped by ACCOUNT
 * only — never by month, never by entry-book — under the standing filters:
 *     je."userId" = the user · je.is_reversal = false · je.reversed_by_entry_id IS NULL ·
 *     je.entity_id = the book, when one is asked for (the ENTRY's book — see statements.ts, WHY IT BALANCES).
 * Two row sets for a year:
 *     toDate   — je.date <= Dec 31.
 *     inPeriod — Jan 1 <= je.date <= Dec 31 AND je.source_type <> 'year_end_close'. A closing entry is dated Dec 31
 *                of the year it closes (src/app/api/year-end-close/route.ts) and would zero that year's income
 *                statement; the budget report leaves it out the same way (src/lib/budget/reportReads.ts readActuals).
 *                It STAYS in toDate — that is how a closed year's earnings reach equity.
 * A day is a 'YYYY-MM-DD' string cast to date (journal_entries.date is @db.Date; no server-zone arithmetic).
 *
 * Not pure: it reads through Prisma. Every read is the caller's own — je."userId", and the book by id AND userId.
 * The routes keep their gates and their own book-belongs-to-the-user checks; this read asks for the book's name
 * again by the same two columns, and a book it cannot find is a fault, by name — never an empty statement.
 */
import { Prisma, type PrismaClient } from '@prisma/client';
import type { StatementRow } from './statements';

type Db = Pick<PrismaClient, '$queryRaw' | 'entities'>;

/** What a statement covers: the year, the last day its balance sheet runs through, and the book (null and null: all books). */
export interface StatementScope {
  readonly year: number;
  /** 'YYYY-12-31' */
  readonly through: string;
  readonly entityId: string | null;
  readonly entityName: string | null;
}

export interface StatementsRead {
  readonly scope: StatementScope;
  /** Every live entry through the year's last day — closing entries in. */
  readonly toDate: StatementRow[];
  /** The year's live entries — closing entries out. */
  readonly inPeriod: StatementRow[];
}

interface SummedRow {
  code: string;
  name: string;
  type: string;
  debits: string;
  credits: string;
}

/** The words a book that is not the caller's throws with. */
export const BOOK_NOT_FOUND_WORDS = 'statements: the book asked for is not one of the caller\'s books';

/** One account per row: its summed debits and credits over the entries the WHERE keeps. */
function summedRows(db: Db, where: Prisma.Sql): Promise<SummedRow[]> {
  return db.$queryRaw<SummedRow[]>`
    SELECT
      coa.code,
      coa.name,
      coa.account_type AS type,
      COALESCE(SUM(CASE WHEN le.entry_type = 'D' THEN le.amount ELSE 0 END), 0)::text AS debits,
      COALESCE(SUM(CASE WHEN le.entry_type = 'C' THEN le.amount ELSE 0 END), 0)::text AS credits
    FROM ledger_entries le
    JOIN journal_entries je ON le.journal_entry_id = je.id
    JOIN chart_of_accounts coa ON le.account_id = coa.id
    WHERE ${where}
    GROUP BY coa.id, coa.code, coa.name, coa.account_type
    ORDER BY coa.code ASC, coa.name ASC
  `;
}

/** The sums arrive as text (bigint cents); each is read as a number and checked whole by the statements' own rule. */
const statementRowOf = (r: SummedRow): StatementRow => ({ code: r.code, name: r.name, type: r.type, debits: Number(r.debits), credits: Number(r.credits) });

/**
 * THE READ. `year` is a whole year the route has checked (2000–2100); `entityId` null is all books.
 * Answers the scope and the two row sets the statements are built from.
 */
export async function readStatements(db: Db, input: { readonly userId: string; readonly entityId: string | null; readonly year: number }): Promise<StatementsRead> {
  const { userId, entityId, year } = input;
  if (!Number.isSafeInteger(year)) throw new Error(`statements: ${String(year)} is not a year`);
  const firstDay = `${year}-01-01`;
  const lastDay = `${year}-12-31`;

  let entityName: string | null = null;
  if (entityId !== null) {
    const book = await db.entities.findFirst({ where: { id: entityId, userId }, select: { name: true } });
    if (book === null) throw new Error(BOOK_NOT_FOUND_WORDS);
    entityName = book.name;
  }

  // The standing filters — the caller's entries, live ones only (not a reversal, not reversed), the entry's book when asked.
  const standing: Prisma.Sql[] = [
    Prisma.sql`je."userId" = ${userId}`,
    Prisma.sql`je.is_reversal = false`,
    Prisma.sql`je.reversed_by_entry_id IS NULL`,
  ];
  if (entityId !== null) standing.push(Prisma.sql`je.entity_id = ${entityId}`);

  const [toDate, inPeriod] = await Promise.all([
    // toDate: everything through the last day — closing entries stay in.
    summedRows(db, Prisma.join([...standing, Prisma.sql`je.date <= ${lastDay}::date`], ' AND ')),
    // inPeriod: the year's entries — a closing entry is left out, by name.
    summedRows(db, Prisma.join([
      ...standing,
      Prisma.sql`je.date >= ${firstDay}::date`,
      Prisma.sql`je.date <= ${lastDay}::date`,
      Prisma.sql`je.source_type <> 'year_end_close'`,
    ], ' AND ')),
  ]);

  return {
    scope: { year, through: lastDay, entityId, entityName },
    toDate: toDate.map(statementRowOf),
    inPeriod: inPeriod.map(statementRowOf),
  };
}
