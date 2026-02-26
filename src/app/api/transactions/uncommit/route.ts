import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { reversePlaidTransaction } from '@/lib/journal-entry-service';
import { getVerifiedEmail } from '@/lib/cookie-auth';

export async function POST(request: Request) {
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

    const { transactionIds } = await request.json();

    if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
      return NextResponse.json({ error: 'No transaction IDs provided' }, { status: 400 });
    }

    // SECURITY: Verify all transactions belong to this user
    const owned = await prisma.transactions.findMany({
      where: { id: { in: transactionIds }, accounts: { userId: user.id } },
      select: { id: true, transactionId: true },
    });

    if (owned.length !== transactionIds.length) {
      return NextResponse.json(
        { error: 'Some transactions do not belong to your account' },
        { status: 403 }
      );
    }

    const requestId = randomUUID();
    const results = [];
    const errors = [];

    for (const txn of owned) {
      try {
        // Find the original (non-reversed, non-reversal) journal entry for this transaction
        const originalEntry = await prisma.journal_entries.findFirst({
          where: {
            source_type: 'plaid_txn',
            source_id: txn.transactionId,
            is_reversal: false,
            reversed_by_entry_id: null,
          },
        });

        if (!originalEntry) {
          errors.push({
            txnId: txn.id,
            error: 'No committed journal entry found for this transaction',
          });
          continue;
        }

        const result = await reversePlaidTransaction(prisma, {
          userId: user.id,
          journalEntryId: originalEntry.id,
          transactionId: txn.transactionId,
          requestId,
        });

        results.push({
          txnId: txn.id,
          originalEntryId: result.originalId,
          reversalEntryId: result.reversalId,
          success: true,
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error uncommitting transaction:', txn.id, error);
        errors.push({ txnId: txn.id, error: message });
      }
    }

    return NextResponse.json({
      success: results.length > 0,
      uncommitted: results.length,
      errorCount: errors.length,
      results,
      errors,
      message: `Uncommitted ${results.length} transaction(s) with reversal entries created`,
    });
  } catch (error: unknown) {
    console.error('Uncommit error:', error);
    const message = error instanceof Error ? error.message : 'Failed to uncommit';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
