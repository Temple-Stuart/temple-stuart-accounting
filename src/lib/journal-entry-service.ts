import { PrismaClient, journal_entries } from '@prisma/client';
import { ValidationError } from '@/lib/errors/ValidationError';
import { assertPeriodOpen } from '@/lib/period-close-guard';
import { balanceDeltaOf, postJournal } from '@/lib/posting/postJournal';

export type CommitResult = journal_entries & { alreadyExisted?: boolean };

/** DIM-3: one PRE-VALIDATED allocation link (the route owns validation —
 *  exactly-one target, owned by the user, 2-decimal percent, sum === 100). */
export interface CommitLink {
  project_id?: string;
  routine_id?: string;
  trip_id?: string;
  module_key?: string;
  percent: number;
}

interface CommitPlaidTransactionParams {
  userId: string;
  entityId: string;
  bankEntityId?: string;
  transactionId: string;
  accountCode: string;
  bankAccountCode: string;
  date: Date;
  amount: number; // Plaid amount in dollars (Float)
  description: string;
  merchantName?: string;
  requestId?: string;
  createdBy?: string;
  /** DIM-3: journal_entries.vendor_id — validated user-owned by the caller. */
  vendorId?: string;
  /** DIM-3: allocation links for the EXPENSE-SIDE line — pre-validated. */
  links?: CommitLink[];
}

interface ReversePlaidTransactionParams {
  userId: string;
  journalEntryId: string;
  transactionId: string;
  requestId?: string;
  createdBy?: string;
}

function dollarsToCents(amount: number): bigint {
  return BigInt(Math.round(amount * 100));
}

/**
 * HYG-04: both writers post through postJournal — SET CONSTRAINTS ALL
 * IMMEDIATE first, the lines in one statement, the entry id read back after
 * commit. The guards (idempotency, period close, account lookups) and the
 * follow-up writes (links, the transaction's status) run inside the same
 * transaction, exactly where they ran before.
 */
export async function commitPlaidTransaction(
  prisma: PrismaClient,
  params: CommitPlaidTransactionParams
): Promise<CommitResult> {
  const {
    userId,
    entityId,
    bankEntityId,
    transactionId,
    accountCode,
    bankAccountCode,
    date,
    amount,
    description,
    requestId,
    createdBy,
    vendorId,
    links,
  } = params;

  const { result } = await postJournal(prisma, async (tx, post): Promise<CommitResult> => {
    // ═══════════════════════════════════════════════════════════════════
    // IDEMPOTENCY GUARD — Prevent duplicate JEs on retry
    // If a JE with this request_id already exists, return it immediately.
    // ═══════════════════════════════════════════════════════════════════
    if (requestId) {
      const existing = await tx.journal_entries.findFirst({
        where: { request_id: requestId, userId },
      });
      if (existing) {
        return Object.assign(existing, { alreadyExisted: true });
      }
    }

    // Period close enforcement — reject if target period is closed
    await assertPeriodOpen(tx, userId, entityId, date);

    // Look up expense/income COA account
    const expenseOrIncomeAccount = await tx.chart_of_accounts.findUnique({
      where: {
        userId_entity_id_code: { userId, entity_id: entityId, code: accountCode },
      },
    });
    if (!expenseOrIncomeAccount) {
      throw new ValidationError(
        `COA account not found: code=${accountCode}, entityId=${entityId}, userId=${userId}`
      );
    }

    // Look up bank COA account — use bankEntityId (the bank account's entity)
    // which may differ from entityId (the expense COA's entity) in cross-entity
    // categorization scenarios (e.g., personal bank pays business expense).
    const resolvedBankEntityId = bankEntityId || entityId;
    const bankAccount = await tx.chart_of_accounts.findUnique({
      where: {
        userId_entity_id_code: { userId, entity_id: resolvedBankEntityId, code: bankAccountCode },
      },
    });
    if (!bankAccount) {
      throw new ValidationError(
        `Bank COA account not found: code=${bankAccountCode}, entityId=${resolvedBankEntityId}, userId=${userId}`
      );
    }

    const amountCents = dollarsToCents(Math.abs(amount));
    const isExpense = amount > 0;
    // Plaid positive = money left account = EXPENSE: DR expense, CR bank
    // Plaid negative = money entered account = INCOME: DR bank, CR income/revenue

    const debitAccount = isExpense ? expenseOrIncomeAccount : bankAccount;
    const creditAccount = isExpense ? bankAccount : expenseOrIncomeAccount;

    // Create the journal entry — one debit line, one credit line, the balance
    // moves by the rule every writer uses.
    // DIM-3: vendor_id is born WITH the entry (null = dimensionless, the
    // legacy-epoch semantic — never backfilled, never imputed).
    const posted = await post({
      entry: {
        userId,
        entity_id: entityId,
        date,
        description,
        source_type: 'plaid_txn',
        source_id: transactionId,
        status: 'posted',
        request_id: requestId ?? null,
        created_by: createdBy || null,
        vendor_id: vendorId || null,
      },
      lines: [
        { account_id: debitAccount.id, entry_type: 'D', amount: amountCents, balanceDelta: balanceDeltaOf('D', debitAccount.balance_type, amountCents), created_by: createdBy || null },
        { account_id: creditAccount.id, entry_type: 'C', amount: amountCents, balanceDelta: balanceDeltaOf('C', creditAccount.balance_type, amountCents), created_by: createdBy || null },
      ],
    });

    // ─── DIM-3: allocation links on the EXPENSE-SIDE line ────────────────────
    // The entry has exactly ONE D + ONE C line; the categorized
    // (expense/income) account rides the DEBIT when the Plaid amount is
    // positive (expense) and the CREDIT when negative (income) — so the
    // links' line is always unambiguously identifiable. Created INSIDE this
    // transaction: a link-write failure (including the DIM-1 CHECK/partial-
    // unique constraints) rolls back the WHOLE entry, loudly — the entry's
    // atomicity is sacred; dimensions are born with it or not at all.
    if (links && links.length > 0) {
      const expenseSideEntryId = isExpense ? posted.lineIds[0] : posted.lineIds[1];
      await tx.ledger_line_links.createMany({
        data: links.map((l) => ({
          ledger_entry_id: expenseSideEntryId,
          project_id: l.project_id ?? null,
          routine_id: l.routine_id ?? null,
          trip_id: l.trip_id ?? null,
          module_key: l.module_key ?? null,
          percent: l.percent,
          created_by: createdBy || null,
        })),
      });
    }

    // Update transaction status
    await tx.transactions.update({
      where: { transactionId },
      data: {
        accountCode: accountCode,
        review_status: 'committed',
      },
    });

    return tx.journal_entries.findUniqueOrThrow({ where: { id: posted.id } });
  });

  return result;
}

export async function reversePlaidTransaction(
  prisma: PrismaClient,
  params: ReversePlaidTransactionParams
) {
  const { userId, journalEntryId, transactionId, requestId, createdBy } = params;

  const { result } = await postJournal(prisma, async (tx, post) => {
    // Look up original journal entry with its ledger entries and linked accounts
    const original = await tx.journal_entries.findUnique({
      where: { id: journalEntryId },
      include: {
        ledger_entries: {
          include: {
            account: { select: { id: true, balance_type: true, code: true } },
          },
        },
      },
    });

    if (!original) {
      throw new ValidationError(`Journal entry not found: ${journalEntryId}`, { status: 404 });
    }

    if (original.userId !== userId) {
      throw new Error('Journal entry does not belong to this user');
    }

    if (original.reversed_by_entry_id) {
      throw new ValidationError('Journal entry has already been reversed');
    }

    if (original.is_reversal) {
      throw new ValidationError('Cannot reverse a reversal entry');
    }

    // Period close enforcement — reversals are dated today
    const reversalDate = new Date();
    await assertPeriodOpen(tx, userId, original.entity_id, reversalDate);

    // Create the reversal: the opposite line for every original line, the
    // balances moved back by the same rule.
    const reversal = await post({
      entry: {
        userId,
        entity_id: original.entity_id,
        date: reversalDate,
        description: `REVERSAL: ${original.description}`,
        source_type: 'reversal',
        source_id: null,
        status: 'posted',
        is_reversal: true,
        reverses_entry_id: original.id,
        request_id: requestId ?? null,
        created_by: createdBy || null,
      },
      lines: original.ledger_entries.map((entry) => {
        const oppositeType: 'D' | 'C' = entry.entry_type === 'D' ? 'C' : 'D';
        return {
          account_id: entry.account_id,
          entry_type: oppositeType,
          amount: entry.amount,
          balanceDelta: balanceDeltaOf(oppositeType, entry.account.balance_type, entry.amount),
          created_by: createdBy || null,
        };
      }),
    });

    // Mark original as reversed
    await tx.journal_entries.update({
      where: { id: original.id },
      data: {
        status: 'reversed',
        reversed_by_entry_id: reversal.id,
      },
    });

    // Reset transaction
    await tx.transactions.update({
      where: { transactionId },
      data: {
        accountCode: null,
        review_status: 'pending_review',
      },
    });

    return { originalId: original.id, reversalId: reversal.id };
  });

  return result;
}
