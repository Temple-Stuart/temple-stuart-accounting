/**
 * /api/bank-reconciliations — A BANK ACCOUNT'S MONTH, RECONCILED TO THE BOOKS (DOCUMENTS-02, Alex, 2026-10-30).
 *
 * GET (optional ?accountId=&period=YYYY-MM): the caller's reconciliations — the CURRENT row of each
 * account-month with its superseded rows under it (read-only, "superseded <day> — final"), each current row
 * carrying the month's current statement document (source_documents kind 'statement', the caller's own) —
 * and the pipeline's word (src/lib/books/reconciliationStatus.ts): for the previous calendar month, how many
 * of the resolvable bank accounts are reconciled. Periods are months on the wire ('YYYY-MM', period_end
 * 'YYYY-MM-DD'); the account block is { id, name, mask, institution } — no balance, no 'Unknown'.
 *
 * POST { accountId, period, statementBalance, items, status, reopen? } — THE NUMBERS ARE THE SERVER'S
 * (ruling C): the book balance is the books' (readBookSide.ts — never the client's; a body carrying
 * bookBalance is refused by name), adjusted_bank / adjusted_book / difference are computed here, and
 * 'reconciled' is accepted only when the difference is under half a cent AND the month's statement is
 * current (ruling E). A reconciled month is FROZEN (ruling D — the migration's trigger; its refusal is
 * surfaced here by name, 409) and re-opened only by supersession: reopen=true inserts a new current draft
 * and marks the old row superseded by it, in one transaction. No upsert: the current row is found, then
 * created or updated, in one transaction. Nothing is deleted. No paid call.
 */
import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { requireTabAccess } from '@/lib/auth-helpers';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { dateColumnOf, documentMetaOf, SOURCE_DOCUMENT_LIST_SELECT, type ReceiptMeta, type Refusal } from '@/lib/books/sourceDocuments';
import { periodOf, periodRule, utcDayOf, type Period } from '@/lib/books/period';
import {
  ACCOUNT_REQUIRED_WORDS, REOPEN_IS_DRAFT_WORDS, attachStatementWords, bodyFieldsRule, currentMeanwhileWords, isBalanced, itemsRule,
  notReconciledWords, nothingToReopenWords, reconcile, reconciliationListOf, reconciliationRowOf, reopenRule, statementBalanceRule, statusRule,
  triggerRefusalOf, type ReconciliationAccount, type StoredReconciliation,
} from '@/lib/books/reconciliation';
import { readBookSide } from '@/lib/books/readBookSide';
import { reconciliationStatusOf } from '@/lib/books/reconciliationStatus';

const refused = (r: Refusal) => NextResponse.json({ error: r.error }, { status: r.status });
const BODY_WORDS = 'the body is a JSON object';

/** A re-open whose old row someone else superseded first — the transaction is undone and the caller told. */
class SupersededMeanwhile extends Error {}

type Row = Prisma.bank_reconciliationsGetPayload<{ include: { account: { include: { plaid_items: { select: { institutionName: true } } } } } }>;

const storedOf = (r: Row): StoredReconciliation => ({
  id: r.id, account_id: r.account_id, entity_id: r.entity_id, year: r.year, month: r.month,
  statement_balance: Number(r.statement_balance), book_balance: Number(r.book_balance),
  adjusted_bank: Number(r.adjusted_bank), adjusted_book: Number(r.adjusted_book), difference: Number(r.difference),
  status: r.status, reconciled_at: r.reconciled_at, reconciled_by: r.reconciled_by, items: r.items,
  superseded_by: r.superseded_by, created_at: r.created_at, updated_at: r.updated_at,
});

const accountOf = (r: Row): ReconciliationAccount => ({
  id: r.account.id, name: r.account.name, mask: r.account.mask, institution: r.account.plaid_items?.institutionName ?? null,
});

const ROW_INCLUDE = { account: { include: { plaid_items: { select: { institutionName: true } } } } } as const;

export async function GET(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const tabGate = await requireTabAccess(user.id, 'tab:books');
    if (tabGate) return tabGate;

    const accountId = request.nextUrl.searchParams.get('accountId');
    const periodParam = request.nextUrl.searchParams.get('period');
    const period = periodParam === null ? null : periodRule(periodParam);
    if (period !== null && !period.ok) return refused(period);

    const rows = await prisma.bank_reconciliations.findMany({
      where: {
        userId: user.id,
        ...(accountId !== null ? { account_id: accountId } : {}),
        ...(period !== null && period.ok ? { year: period.value.year, month: period.value.month } : {}),
      },
      include: ROW_INCLUDE,
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { created_at: 'desc' }],
    });
    const accounts = new Map(rows.map((r) => [r.account_id, accountOf(r)]));

    // The current rows' statements: the caller's current statement documents for those account-months.
    const current = rows.filter((r) => r.superseded_by === null);
    const statementRows = current.length === 0 ? [] : await prisma.source_documents.findMany({
      where: {
        user_id: user.id, kind: 'statement', superseded_by: null,
        account_id: { in: [...new Set(current.map((r) => r.account_id))] },
        period_month: { in: [...new Set(current.map((r) => dateColumnOf(periodOf(r.year, r.month).period_month)))] },
      },
      select: SOURCE_DOCUMENT_LIST_SELECT,
    });
    const statements = new Map<string, ReceiptMeta>();
    for (const s of statementRows) { const m = documentMetaOf(s); statements.set(`${m.account_id}:${m.period_month}`, m); }

    const list = reconciliationListOf(
      rows.map(storedOf),
      (id) => { const a = accounts.get(id); if (a === undefined) throw new Error(`DOCUMENTS-02: no account for ${id}`); return a; },
      (id, p) => statements.get(`${id}:${p}-01`) ?? null,
    );

    // The pipeline's word (ruling G): the previous calendar month, over the depository accounts the resolver resolves.
    const [depository, entities] = await Promise.all([
      prisma.accounts.findMany({ where: { userId: user.id, type: 'depository' }, select: { id: true, name: true, type: true, accountCode: true, entityType: true } }),
      prisma.entities.findMany({ where: { userId: user.id }, select: { id: true, entity_type: true } }),
    ]);
    const status = reconciliationStatusOf({
      today: utcDayOf(new Date()),
      accounts: depository,
      entities,
      current: list.map((r) => ({ accountId: r.accountId, period: r.period, status: r.status })),
    });

    return NextResponse.json({ reconciliations: list, status });
  } catch (error) {
    return failClosedResponse('Bank reconciliations GET', 'Bank reconciliations read failed', error);
  }
}

export async function POST(request: NextRequest) {
  // The month the body names — for the words of a concurrent-save refusal, after the body is consumed.
  let named: Period | null = null;
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const tabGate = await requireTabAccess(user.id, 'tab:books');
    if (tabGate) return tabGate;

    const raw: unknown = await request.json();
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return NextResponse.json({ error: BODY_WORDS }, { status: 400 });
    const body = raw as Record<string, unknown>;
    const fields = bodyFieldsRule(body);
    if (!fields.ok) return refused(fields);
    const accountId = typeof body.accountId === 'string' ? body.accountId.trim() : '';
    if (accountId === '') return NextResponse.json({ error: ACCOUNT_REQUIRED_WORDS }, { status: 400 });
    const period = periodRule(body.period);
    if (!period.ok) return refused(period);
    named = period.value;
    const statement = statementBalanceRule(body.statementBalance);
    if (!statement.ok) return refused(statement);
    const items = itemsRule(body.items);
    if (!items.ok) return refused(items);
    const status = statusRule(body.status);
    if (!status.ok) return refused(status);
    const reopen = reopenRule(body.reopen);
    if (!reopen.ok) return refused(reopen);
    if (reopen.value && status.value === 'reconciled') return NextResponse.json({ error: REOPEN_IS_DRAFT_WORDS }, { status: 400 });

    // THE BOOK SIDE IS THE BOOKS (ruling B): the account, its chart-of-accounts row, the GL as of the month's last day.
    const side = await readBookSide(prisma, user, accountId, period.value);
    if (!side.ok) return refused(side);
    const figures = reconcile(statement.value, side.book_balance, items.value);
    if (status.value === 'reconciled') {
      if (!isBalanced(figures.difference)) return NextResponse.json({ error: notReconciledWords(figures.difference) }, { status: 409 });
      if (side.statement === null) return NextResponse.json({ error: attachStatementWords(period.value) }, { status: 409 });
    }

    const { year, month } = period.value;
    // The items as JSON — the rule's plain shape, nothing more.
    const itemsJson: Prisma.InputJsonValue = items.value.map((i) => ({ type: i.type, description: i.description, amount: i.amount, cleared: i.cleared }));
    const data = {
      entity_id: side.entityId,
      statement_balance: statement.value,
      book_balance: side.book_balance,
      adjusted_bank: figures.adjustedBank,
      adjusted_book: figures.adjustedBook,
      difference: figures.difference,
      status: status.value,
      reconciled_at: status.value === 'reconciled' ? new Date() : null,
      reconciled_by: status.value === 'reconciled' ? userEmail : null,
      items: itemsJson,
    };

    const saved = await prisma.$transaction(async (tx) => {
      const current = await tx.bank_reconciliations.findFirst({
        where: { userId: user.id, account_id: accountId, year, month, superseded_by: null },
        include: ROW_INCLUDE,
      });
      if (reopen.value) {
        if (current === null || current.status !== 'reconciled') return { ok: false as const, status: 409 as const, error: nothingToReopenWords(period.value) };
        const id = randomUUID();
        // The old row leaves the one-current index first — the one change the freeze allows; its reference to the new id is checked at commit.
        const marked = await tx.bank_reconciliations.updateMany({ where: { id: current.id, userId: user.id, superseded_by: null }, data: { superseded_by: id } });
        if (marked.count !== 1) throw new SupersededMeanwhile();
        const row = await tx.bank_reconciliations.create({ data: { id, userId: user.id, account_id: accountId, year, month, ...data }, include: ROW_INCLUDE });
        return { ok: true as const, row };
      }
      if (current === null) {
        const row = await tx.bank_reconciliations.create({ data: { userId: user.id, account_id: accountId, year, month, ...data }, include: ROW_INCLUDE });
        return { ok: true as const, row };
      }
      // A draft is saved over; a reconciled row is frozen — the database refuses this update by name (surfaced below).
      const row = await tx.bank_reconciliations.update({ where: { id: current.id }, data, include: ROW_INCLUDE });
      return { ok: true as const, row };
    });
    if (!saved.ok) return refused(saved);
    return NextResponse.json({ reconciliation: reconciliationRowOf(storedOf(saved.row), accountOf(saved.row), side.statement, []) });
  } catch (error) {
    if (error instanceof SupersededMeanwhile) return NextResponse.json({ error: 'the month was re-opened by someone else meanwhile — read it again' }, { status: 409 });
    // Two first saves of one month at once: the one-current index refuses the second, by the month's name.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' && named !== null) {
      return NextResponse.json({ error: currentMeanwhileWords(named) }, { status: 409 });
    }
    // The database's freeze or no-delete (the migration's triggers), surfaced in its own words.
    if (error instanceof Error) {
      const words = triggerRefusalOf(error.message);
      if (words !== null) return NextResponse.json({ error: words }, { status: 409 });
    }
    return failClosedResponse('Bank reconciliations POST', 'Bank reconciliations write failed', error);
  }
}
