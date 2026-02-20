import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('userEmail')?.value;
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

    await prisma.$transaction(async (tx) => {
      // Find journal entries linked to these transactions
      const journals = await tx.journal_transactions.findMany({
        where: {
          OR: [
            { plaid_transaction_id: { in: plaidTxnIds } },
            { external_transaction_id: { in: plaidTxnIds } }
          ]
        },
        select: { id: true }
      });

      const journalIds = journals.map(j => j.id);

      if (journalIds.length > 0) {
        // Fetch ledger entries so we can reverse COA balances
        const ledgerEntries = await tx.ledger_entries.findMany({
          where: { transaction_id: { in: journalIds } },
          include: { chart_of_accounts: { select: { id: true, balance_type: true } } }
        });

        // Reverse the balance changes on each COA account
        for (const entry of ledgerEntries) {
          const reversal = entry.entry_type === entry.chart_of_accounts.balance_type
            ? -entry.amount
            : entry.amount;

          await tx.chart_of_accounts.update({
            where: { id: entry.chart_of_accounts.id },
            data: {
              settled_balance: { increment: reversal },
              version: { increment: 1 }
            }
          });
        }

        // Delete ledger entries
        await tx.ledger_entries.deleteMany({
          where: { transaction_id: { in: journalIds } }
        });

        // Delete journal transactions
        await tx.journal_transactions.deleteMany({
          where: { id: { in: journalIds } }
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
      message: `Uncommitted ${transactionIds.length} transaction(s) with journal entries reversed`
    });
  } catch (error) {
    console.error('Uncommit error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to uncommit'
    }, { status: 500 });
  }
}
