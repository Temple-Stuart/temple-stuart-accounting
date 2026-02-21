import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

export async function POST(request: Request) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { transactionIds } = await request.json();

    if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
      return NextResponse.json({ error: 'No transaction IDs provided' }, { status: 400 });
    }

    // SECURITY: Verify all transactions belong to this user
    const owned = await prisma.transactions.findMany({
      where: { id: { in: transactionIds }, accounts: { userId: user.id } },
      select: { id: true, transactionId: true }
    });

    if (owned.length !== transactionIds.length) {
      return NextResponse.json({ error: 'Some transactions do not belong to your account' }, { status: 403 });
    }

    // Get Plaid transaction IDs to find linked journal entries
    const plaidTxnIds = owned.map(t => t.transactionId);
    const now = new Date();
    const reversalIds: string[] = [];

    await prisma.$transaction(async (tx) => {
      // Find journal entries linked to these transactions (only non-reversed, non-reversal originals)
      const journals = await tx.journal_transactions.findMany({
        where: {
          OR: [
            { plaid_transaction_id: { in: plaidTxnIds } },
            { external_transaction_id: { in: plaidTxnIds } }
          ],
          is_reversal: false,
          reversed_by_transaction_id: null,
        },
        include: {
          ledger_entries: {
            include: { chart_of_accounts: { select: { id: true, balance_type: true, code: true } } }
          }
        }
      });

      // Create reversing entries for each original journal entry
      for (const original of journals) {
        const reversalId = randomUUID();
        reversalIds.push(reversalId);

        // Create the reversing journal entry
        await tx.journal_transactions.create({
          data: {
            id: reversalId,
            transaction_date: now,
            description: `REVERSAL: ${original.description || 'No description'}`,
            plaid_transaction_id: original.plaid_transaction_id,
            external_transaction_id: original.external_transaction_id,
            account_code: original.account_code,
            amount: original.amount,
            strategy: original.strategy,
            trade_num: original.trade_num,
            posted_at: now,
            is_reversal: true,
            reverses_journal_id: original.id,
            reversal_date: now,
          }
        });

        // Create reversing ledger entries (opposite debit/credit)
        for (const entry of original.ledger_entries) {
          const oppositeType = entry.entry_type === 'D' ? 'C' : 'D';

          await tx.ledger_entries.create({
            data: {
              id: randomUUID(),
              transaction_id: reversalId,
              account_id: entry.account_id,
              amount: entry.amount,
              entry_type: oppositeType,
            }
          });

          // Update COA balance: opposite direction from original
          // If opposite type matches account's balance_type, balance goes up; otherwise down
          const balanceChange = oppositeType === entry.chart_of_accounts.balance_type
            ? entry.amount
            : -entry.amount;

          await tx.chart_of_accounts.update({
            where: { id: entry.chart_of_accounts.id },
            data: {
              settled_balance: { increment: balanceChange },
              version: { increment: 1 }
            }
          });
        }

        // Link original to its reversal
        await tx.journal_transactions.update({
          where: { id: original.id },
          data: { reversed_by_transaction_id: reversalId }
        });
      }

      // Clear accountCode, subAccount, and reset review status
      await tx.transactions.updateMany({
        where: { id: { in: transactionIds } },
        data: {
          accountCode: null,
          subAccount: null,
          review_status: 'pending_review',
          manually_overridden: false,
          overridden_at: null
        }
      });
    });

    return NextResponse.json({
      success: true,
      uncommitted: transactionIds.length,
      reversalEntryIds: reversalIds,
      message: `Uncommitted ${transactionIds.length} transaction(s) with ${reversalIds.length} reversing journal entr${reversalIds.length === 1 ? 'y' : 'ies'} created`
    });
  } catch (error) {
    console.error('Uncommit error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to uncommit'
    }, { status: 500 });
  }
}
