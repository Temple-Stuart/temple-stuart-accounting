import { PrismaClient } from '@prisma/client';

type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

interface CommitPlaidTransactionParams {
  userId: string;
  entityId: string;
  transactionId: string;
  accountCode: string;
  bankAccountCode: string;
  date: Date;
  amount: number; // Plaid amount in dollars (Float)
  description: string;
  merchantName?: string;
}

interface ReversePlaidTransactionParams {
  userId: string;
  journalEntryId: string;
  transactionId: string;
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
) {
  const {
    userId,
    entityId,
    transactionId,
    accountCode,
    bankAccountCode,
    date,
    amount,
    description,
  } = params;

  return prisma.$transaction(async (tx: Tx) => {
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

    // Look up bank COA account
    const bankAccount = await tx.chart_of_accounts.findUnique({
      where: {
        userId_entity_id_code: { userId, entity_id: entityId, code: bankAccountCode },
      },
    });
    if (!bankAccount) {
      throw new Error(
        `Bank COA account not found: code=${bankAccountCode}, entityId=${entityId}, userId=${userId}`
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
    const journalEntry = await tx.journal_entries.create({
      data: {
        userId,
        entity_id: entityId,
        date,
        description,
        source_type: 'plaid_txn',
        source_id: transactionId,
        status: 'posted',
      },
    });

    // Create debit ledger entry
    await tx.ledger_entries.create({
      data: {
        journal_entry_id: journalEntry.id,
        account_id: debitAccountId,
        entry_type: 'D',
        amount: amountCents,
      },
    });

    // Create credit ledger entry
    await tx.ledger_entries.create({
      data: {
        journal_entry_id: journalEntry.id,
        account_id: creditAccountId,
        entry_type: 'C',
        amount: amountCents,
      },
    });

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
  const { userId, journalEntryId, transactionId } = params;

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

    // Create reversal journal entry
    const reversalEntry = await tx.journal_entries.create({
      data: {
        userId,
        entity_id: original.entity_id,
        date: new Date(),
        description: `REVERSAL: ${original.description}`,
        source_type: 'reversal',
        source_id: null,
        status: 'posted',
        is_reversal: true,
        reverses_entry_id: original.id,
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
