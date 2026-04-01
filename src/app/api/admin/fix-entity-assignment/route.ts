import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { ADMIN_USER_ID } from '@/lib/tiers';
import { assertPeriodOpen, PeriodClosedError } from '@/lib/period-close-guard';

function dollarsToCents(amount: number): bigint {
  return BigInt(Math.round(amount * 100));
}

function updateBalance(entryType: string, accountBalanceType: string, amountCents: bigint): bigint {
  return entryType === accountBalanceType ? amountCents : -amountCents;
}

/**
 * POST /api/admin/fix-entity-assignment
 *
 * Moves committed Plaid transactions from one entity to another by:
 * 1. Reversing the original journal entry on the old entity
 * 2. Creating a new journal entry on the target entity
 * 3. Updating the transaction's entity_id
 *
 * Admin-only endpoint.
 */
export async function POST(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Admin-only
    if (user.id !== ADMIN_USER_ID) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { transactionIds, targetEntityId, targetAccountCode } = await request.json();

    if (!transactionIds?.length || !targetEntityId || !targetAccountCode) {
      return NextResponse.json(
        { error: 'Required: transactionIds, targetEntityId, targetAccountCode' },
        { status: 400 }
      );
    }

    // Verify target entity belongs to user
    const targetEntity = await prisma.entities.findFirst({
      where: { id: targetEntityId, userId: user.id },
    });
    if (!targetEntity) {
      return NextResponse.json({ error: 'Target entity not found' }, { status: 404 });
    }

    // Verify target COA account exists
    const targetCoaAccount = await prisma.chart_of_accounts.findUnique({
      where: { userId_entity_id_code: { userId: user.id, entity_id: targetEntityId, code: targetAccountCode } },
    });
    if (!targetCoaAccount) {
      return NextResponse.json(
        { error: `Target COA account ${targetAccountCode} not found on entity ${targetEntityId}` },
        { status: 404 }
      );
    }

    // Verify transactions belong to user
    const ownedTxns = await prisma.transactions.findMany({
      where: { id: { in: transactionIds }, accounts: { userId: user.id } },
      include: { accounts: true },
    });
    if (ownedTxns.length !== transactionIds.length) {
      return NextResponse.json({ error: 'Some transactions not found or not owned' }, { status: 403 });
    }

    const batchId = randomUUID();
    const results: { txnId: string; reversalId: string; newJeId: string }[] = [];
    const errors: string[] = [];

    for (const txn of ownedTxns) {
      try {
        await prisma.$transaction(async (tx) => {
          // 1. Find the original journal entry
          const original = await tx.journal_entries.findFirst({
            where: {
              source_type: 'plaid_txn',
              source_id: txn.transactionId,
              is_reversal: false,
              reversed_by_entry_id: null,
            },
            include: {
              ledger_entries: {
                include: { account: { select: { id: true, balance_type: true, code: true, entity_id: true } } },
              },
            },
          });

          if (!original) {
            throw new Error(`No committed journal entry found for txn ${txn.transactionId}`);
          }

          // 2. Period close check
          const now = new Date();
          await assertPeriodOpen(tx, user.id, original.entity_id, now);
          await assertPeriodOpen(tx, user.id, targetEntityId, new Date(txn.date));

          // 3. Create reversal for original
          const reversalEntry = await tx.journal_entries.create({
            data: {
              userId: user.id,
              entity_id: original.entity_id,
              date: now,
              description: `REVERSAL (entity fix): ${original.description}`,
              source_type: 'reversal',
              source_id: null,
              status: 'posted',
              is_reversal: true,
              reverses_entry_id: original.id,
              request_id: `${batchId}-rev-${txn.transactionId}`,
              created_by: userEmail,
            },
          });

          // Reverse ledger entries and COA balances
          for (const entry of original.ledger_entries) {
            const oppositeType = entry.entry_type === 'D' ? 'C' : 'D';

            await tx.ledger_entries.create({
              data: {
                journal_entry_id: reversalEntry.id,
                account_id: entry.account_id,
                entry_type: oppositeType,
                amount: entry.amount,
                created_by: userEmail,
              },
            });

            await tx.chart_of_accounts.update({
              where: { id: entry.account.id },
              data: {
                settled_balance: { increment: updateBalance(oppositeType, entry.account.balance_type, entry.amount) },
                version: { increment: 1 },
              },
            });
          }

          // Mark original as reversed
          await tx.journal_entries.update({
            where: { id: original.id },
            data: { status: 'reversed', reversed_by_entry_id: reversalEntry.id },
          });

          // 4. Look up bank COA account for the target entity
          const bankAccountCode = txn.accounts.accountCode;
          let bankEntityId = targetEntityId;
          if (txn.accounts.entityType) {
            const bankEntity = await tx.entities.findFirst({
              where: { userId: user.id, entity_type: txn.accounts.entityType },
            });
            if (bankEntity) bankEntityId = bankEntity.id;
          }
          const bankAccount = bankAccountCode
            ? await tx.chart_of_accounts.findUnique({
                where: { userId_entity_id_code: { userId: user.id, entity_id: bankEntityId, code: bankAccountCode } },
              })
            : null;

          if (!bankAccount) {
            throw new Error(`Bank COA account ${bankAccountCode} not found on entity ${bankEntityId}`);
          }

          // 5. Create new journal entry on target entity
          const amountCents = dollarsToCents(Math.abs(txn.amount));
          const isExpense = txn.amount > 0;
          const debitAccountId = isExpense ? targetCoaAccount.id : bankAccount.id;
          const creditAccountId = isExpense ? bankAccount.id : targetCoaAccount.id;
          const debitBalanceType = isExpense ? targetCoaAccount.balance_type : bankAccount.balance_type;
          const creditBalanceType = isExpense ? bankAccount.balance_type : targetCoaAccount.balance_type;

          const newJe = await tx.journal_entries.create({
            data: {
              userId: user.id,
              entity_id: targetEntityId,
              date: new Date(txn.date),
              description: txn.name,
              source_type: 'plaid_txn',
              source_id: txn.transactionId,
              status: 'posted',
              request_id: `${batchId}-new-${txn.transactionId}`,
              created_by: userEmail,
            },
          });

          await tx.ledger_entries.create({
            data: { journal_entry_id: newJe.id, account_id: debitAccountId, entry_type: 'D', amount: amountCents, created_by: userEmail },
          });
          await tx.ledger_entries.create({
            data: { journal_entry_id: newJe.id, account_id: creditAccountId, entry_type: 'C', amount: amountCents, created_by: userEmail },
          });

          await tx.chart_of_accounts.update({
            where: { id: debitAccountId },
            data: { settled_balance: { increment: updateBalance('D', debitBalanceType, amountCents) }, version: { increment: 1 } },
          });
          await tx.chart_of_accounts.update({
            where: { id: creditAccountId },
            data: { settled_balance: { increment: updateBalance('C', creditBalanceType, amountCents) }, version: { increment: 1 } },
          });

          // 6. Update transaction's entity_id and accountCode
          await tx.transactions.update({
            where: { id: txn.id },
            data: { entity_id: targetEntityId, accountCode: targetAccountCode },
          });

          results.push({ txnId: txn.id, reversalId: reversalEntry.id, newJeId: newJe.id });
        });
      } catch (err) {
        if (err instanceof PeriodClosedError) {
          errors.push(`Txn ${txn.id}: ${err.message}`);
          continue;
        }
        const msg = err instanceof Error ? err.message : 'Unknown error';
        console.error(`Fix entity error for txn ${txn.id}:`, err);
        errors.push(`Txn ${txn.id}: ${msg}`);
      }
    }

    return NextResponse.json({
      success: results.length > 0,
      fixed: results.length,
      errors,
      results,
    });
  } catch (error) {
    console.error('Fix entity assignment error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
