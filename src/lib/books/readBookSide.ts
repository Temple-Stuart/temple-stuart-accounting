/**
 * DOCUMENTS-02 (Alex, 2026-10-30, ruling B) — THE BOOK SIDE, READ: the one place the reconciliation's
 * book balance comes from. Both /api/bank-reconciliations (POST) and /api/bank-reconciliations/book-side
 * (GET) call this; neither computes a book balance any other way, and nothing reads accounts.currentBalance.
 *
 *   1. the account: the caller's (404), a bank (depository) account (409);
 *   2. the books' side: accounts.accountCode + the entity of accounts.entityType (bankSide.ts) — refused by
 *      name as the postings refuse it; then that entity's chart_of_accounts row for the code (409 when none);
 *   3. the GL balance of that row as of the month's last day — the commit route's own sum over
 *      ledger_entries (cents, BigInt) for posted entries that are neither reversals nor reversed, read by the
 *      account's normal balance; `je.date <= period_end::date` with period_end a 'YYYY-MM-DD' string
 *      (journal_entries.date is @db.Date; no server-zone arithmetic);
 *   4. the month's current statement document, if any (source_documents kind 'statement').
 *
 * Not pure: it reads through Prisma. Every read is the caller's own (userId / user_id).
 */
import type { Prisma, PrismaClient } from '@prisma/client';
import { bankSideOf } from './bankSide';
import type { Period } from './period';
import { bookBalanceOf, noCoaRowWords } from './reconciliation';
import { SOURCE_DOCUMENT_LIST_SELECT, dateColumnOf, documentMetaOf, statementAccountRule, type ReceiptMeta, type Refusal } from './sourceDocuments';

type Db = PrismaClient | Prisma.TransactionClient;

export interface BookSideRead {
  readonly ok: true;
  readonly account: { readonly id: string; readonly name: string; readonly type: string; readonly accountCode: string | null; readonly entityType: string | null };
  readonly entityId: string;
  readonly coa: { readonly id: string; readonly code: string; readonly name: string; readonly entity_type: string; readonly balance_type: string };
  /** The GL balance as of period_end, in dollars (cents rounded). */
  readonly book_balance: number;
  /** 'YYYY-MM-DD' — the month's last day. */
  readonly as_of: string;
  readonly statement: ReceiptMeta | null;
}

export async function readBookSide(db: Db, user: { readonly id: string }, accountId: string, period: Period): Promise<BookSideRead | Refusal> {
  const owned = statementAccountRule(await db.accounts.findFirst({
    where: { id: accountId, userId: user.id },
    select: { id: true, name: true, type: true, accountCode: true, entityType: true },
  }));
  if (!owned.ok) return owned;
  const account = owned.account;

  const entities = await db.entities.findMany({ where: { userId: user.id }, select: { id: true, entity_type: true } });
  const side = bankSideOf(account, entities);
  if (!side.ok) return side;
  const entityType = (account.entityType ?? '').trim();

  const coa = await db.chart_of_accounts.findFirst({
    where: { userId: user.id, entity_id: side.entityId, code: side.accountCode },
    select: { id: true, code: true, name: true, balance_type: true },
  });
  if (coa === null) return { ok: false, status: 409, error: noCoaRowWords(side.accountCode, entityType) };

  // The commit route's sum (commit-to-ledger), as of the month's last day — a 'YYYY-MM-DD' string cast to date.
  const sums = await db.$queryRaw<{ total_debits: string; total_credits: string }[]>`
    SELECT
      COALESCE(SUM(CASE WHEN le.entry_type = 'D' THEN le.amount ELSE 0 END), 0)::text AS total_debits,
      COALESCE(SUM(CASE WHEN le.entry_type = 'C' THEN le.amount ELSE 0 END), 0)::text AS total_credits
    FROM ledger_entries le
    JOIN journal_entries je ON le.journal_entry_id = je.id
    WHERE le.account_id = ${coa.id}::uuid
      AND je."userId" = ${user.id}
      AND je.is_reversal = false
      AND je.reversed_by_entry_id IS NULL
      AND je.date <= ${period.period_end}::date
  `;
  if (sums.length !== 1) throw new Error(`DOCUMENTS-02: the GL sum answered ${sums.length} rows`);
  const book_balance = bookBalanceOf(sums[0].total_debits, sums[0].total_credits, coa.balance_type);

  const statementRow = await db.source_documents.findFirst({
    where: { user_id: user.id, kind: 'statement', account_id: account.id, period_month: dateColumnOf(period.period_month), superseded_by: null },
    select: SOURCE_DOCUMENT_LIST_SELECT,
  });

  return {
    ok: true,
    account,
    entityId: side.entityId,
    coa: { id: coa.id, code: coa.code, name: coa.name, entity_type: entityType, balance_type: coa.balance_type },
    book_balance,
    as_of: period.period_end,
    statement: statementRow === null ? null : documentMetaOf(statementRow),
  };
}
