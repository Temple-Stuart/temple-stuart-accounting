import { PrismaClient, journal_entries } from '@prisma/client';
import { assertPeriodOpen } from '@/lib/period-close-guard';

type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

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

function updateBalance(entryType: string, accountBalanceType: string, amountCents: bigint): bigint {
  // If entry_type matches account's balance_type, ADD; otherwise SUBTRACT
  return entryType === accountBalanceType ? amountCents : -amountCents;
}

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

  return prisma.$transaction(async (tx: Tx) => {
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
      throw new Error(
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
      throw new Error(
        `Bank COA account not found: code=${bankAccountCode}, entityId=${resolvedBankEntityId}, userId=${userId}`
      );
    }

    const amountCents = dollarsToCents(Math.abs(amount));
    const isExpense = amount > 0;
    // Plaid positive = money left account = EXPENSE: DR expense, CR bank
    // Plaid negative = money entered account = INCOME: DR bank, CR income/revenue

    const debitAccountId = isExpense ? expenseOrIncomeAccount.id : bankAccount.id;
    const creditAccountId = isExpense ? bankAccount.id : expenseOrIncomeAccount.id;
    const debitBalanceType = isExpense ? expenseOrIncomeAccount.balance_type : bankAccount.balance_type;
    const creditBalanceType = isExpense ? bankAccount.balance_type : expenseOrIncomeAccount.balance_type;

    // Create journal entry
    // DIM-3: vendor_id is born WITH the entry (null = dimensionless, the
    // legacy-epoch semantic — never backfilled, never imputed).
    const journalEntry = await tx.journal_entries.create({
      data: {
        userId,
        entity_id: entityId,
        date,
        description,
        source_type: 'plaid_txn',
        source_id: transactionId,
        status: 'posted',
        request_id: requestId,
        created_by: createdBy || null,
        vendor_id: vendorId || null,
      },
    });

    // Create debit ledger entry
    const debitEntry = await tx.ledger_entries.create({
      data: {
        journal_entry_id: journalEntry.id,
        account_id: debitAccountId,
        entry_type: 'D',
        amount: amountCents,
        created_by: createdBy || null,
      },
    });

    // Create credit ledger entry
    const creditEntry = await tx.ledger_entries.create({
      data: {
        journal_entry_id: journalEntry.id,
        account_id: creditAccountId,
        entry_type: 'C',
        amount: amountCents,
        created_by: createdBy || null,
      },
    });

    // ─── DIM-3: allocation links on the EXPENSE-SIDE line ────────────────────
    // This service builds exactly ONE D + ONE C line; the categorized
    // (expense/income) account rides the DEBIT when the Plaid amount is
    // positive (expense) and the CREDIT when negative (income) — so the
    // links' line is always unambiguously identifiable. Created INSIDE this
    // $transaction: a link-write failure (including the DIM-1 CHECK/partial-
    // unique constraints) rolls back the WHOLE entry, loudly — the entry's
    // atomicity is sacred; dimensions are born with it or not at all.
    if (links && links.length > 0) {
      const expenseSideEntryId = isExpense ? debitEntry.id : creditEntry.id;
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

    // Update settled_balance on debit account
    await tx.chart_of_accounts.update({
      where: { id: debitAccountId },
      data: {
        settled_balance: { increment: updateBalance('D', debitBalanceType, amountCents) },
        version: { increment: 1 },
      },
    });

    // Update settled_balance on credit account
    await tx.chart_of_accounts.update({
      where: { id: creditAccountId },
      data: {
        settled_balance: { increment: updateBalance('C', creditBalanceType, amountCents) },
        version: { increment: 1 },
      },
    });

    // Update transaction status
    await tx.transactions.update({
      where: { transactionId },
      data: {
        accountCode: accountCode,
        review_status: 'committed',
      },
    });

    return journalEntry;
  });
}

export async function reversePlaidTransaction(
  prisma: PrismaClient,
  params: ReversePlaidTransactionParams
) {
  const { userId, journalEntryId, transactionId, requestId, createdBy } = params;

  return prisma.$transaction(async (tx: Tx) => {
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
      throw new Error(`Journal entry not found: ${journalEntryId}`);
    }

    if (original.userId !== userId) {
      throw new Error('Journal entry does not belong to this user');
    }

    if (original.reversed_by_entry_id) {
      throw new Error('Journal entry has already been reversed');
    }

    if (original.is_reversal) {
      throw new Error('Cannot reverse a reversal entry');
    }

    // Period close enforcement — reversals are dated today
    const reversalDate = new Date();
    await assertPeriodOpen(tx, userId, original.entity_id, reversalDate);

    // Create reversal journal entry
    const reversalEntry = await tx.journal_entries.create({
      data: {
        userId,
        entity_id: original.entity_id,
        date: reversalDate,
        description: `REVERSAL: ${original.description}`,
        source_type: 'reversal',
        source_id: null,
        status: 'posted',
        is_reversal: true,
        reverses_entry_id: original.id,
        request_id: requestId,
        created_by: createdBy || null,
      },
    });

    // Create opposite ledger entries and reverse COA balances
    for (const entry of original.ledger_entries) {
      const oppositeType = entry.entry_type === 'D' ? 'C' : 'D';

      await tx.ledger_entries.create({
        data: {
          journal_entry_id: reversalEntry.id,
          account_id: entry.account_id,
          entry_type: oppositeType,
          amount: entry.amount,
          created_by: createdBy || null,
        },
      });

      // Reverse the balance: opposite entry type applied to account
      await tx.chart_of_accounts.update({
        where: { id: entry.account.id },
        data: {
          settled_balance: {
            increment: updateBalance(oppositeType, entry.account.balance_type, entry.amount),
          },
          version: { increment: 1 },
        },
      });
    }

    // Mark original as reversed
    await tx.journal_entries.update({
      where: { id: original.id },
      data: {
        status: 'reversed',
        reversed_by_entry_id: reversalEntry.id,
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

    return { originalId: original.id, reversalId: reversalEntry.id };
  });
}
