import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

/**
 * POST /api/admin/fix-unbalanced-entries
 *
 * Surgical fix for exactly 2 unbalanced journal entries caused by
 * independent rounding of proceeds, cost basis, and P&L in the
 * stock sell commit logic (stock-lots/commit/route.ts lines 198-200).
 *
 * Root cause: Math.round(totalProceeds*100), Math.round(totalCostBasis*100),
 * and Math.round(totalGainLoss*100) were computed independently. Since
 * round(a) - round(b) != round(a-b) for floats, the three legs could
 * differ by 1+ cents.
 *
 * Fix: adjust the P&L leg to equal (proceeds - costBasis) so debits = credits.
 *
 * Affected entries:
 *   9cd87926-a262-44dd-88d0-48cc68271f46 — LIT sell, off by $0.07
 *   4ce6f70b-9a0b-4163-bfde-ce09b0d17a54 — BTC sell, off by $1.00
 */
export async function POST() {
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

    const TARGET_IDS = [
      '9cd87926-a262-44dd-88d0-48cc68271f46',
      '4ce6f70b-9a0b-4163-bfde-ce09b0d17a54'
    ];

    const fixes: Array<{
      journalId: string;
      description: string;
      beforeDebits: string;
      beforeCredits: string;
      afterDebits: string;
      afterCredits: string;
      adjustedLegId: string;
      adjustedFrom: string;
      adjustedTo: string;
    }> = [];

    for (const journalId of TARGET_IDS) {
      // Verify the journal entry exists
      const journalTxn = await prisma.journal_transactions.findUnique({
        where: { id: journalId }
      });
      if (!journalTxn) {
        return NextResponse.json({
          error: `Journal entry ${journalId} not found`
        }, { status: 404 });
      }

      // Get all ledger entries for this journal
      const entries = await prisma.ledger_entries.findMany({
        where: { transaction_id: journalId },
        include: { chart_of_accounts: true }
      });

      // Verify user owns these accounts
      const allOwnedByUser = entries.every(
        e => e.chart_of_accounts.userId === user.id
      );
      if (!allOwnedByUser) {
        return NextResponse.json({
          error: `Unauthorized: journal ${journalId} does not belong to this user`
        }, { status: 403 });
      }

      // Sum debits and credits
      const debits = entries
        .filter(e => e.entry_type === 'D')
        .reduce((sum, e) => sum + e.amount, BigInt(0));
      const credits = entries
        .filter(e => e.entry_type === 'C')
        .reduce((sum, e) => sum + e.amount, BigInt(0));

      if (debits === credits) {
        fixes.push({
          journalId,
          description: journalTxn.description || '',
          beforeDebits: debits.toString(),
          beforeCredits: credits.toString(),
          afterDebits: debits.toString(),
          afterCredits: credits.toString(),
          adjustedLegId: 'none',
          adjustedFrom: '0',
          adjustedTo: '0'
        });
        continue; // Already balanced
      }

      // Identify the P&L leg (T-4100 or T-5100) — that's the plug
      const plEntry = entries.find(
        e => e.chart_of_accounts.code === 'T-4100' ||
             e.chart_of_accounts.code === 'T-5100'
      );
      if (!plEntry) {
        return NextResponse.json({
          error: `No P&L leg found in journal ${journalId}`
        }, { status: 500 });
      }

      // The cash leg (DR) and stock leg (CR) are the source of truth.
      // P&L must be adjusted to make debits === credits.
      // For a gain (P&L is credit): proceeds(DR) = costBasis(CR) + pl(CR)
      //   → pl should be proceeds - costBasis
      // For a loss (P&L is debit): proceeds(DR) + pl(DR) = costBasis(CR)
      //   → pl should be costBasis - proceeds

      const cashEntry = entries.find(
        e => e.chart_of_accounts.code === 'T-1010' && e.entry_type === 'D'
      );
      const stockEntry = entries.find(
        e => e.chart_of_accounts.code === 'T-1100' && e.entry_type === 'C'
      );

      if (!cashEntry || !stockEntry) {
        return NextResponse.json({
          error: `Missing cash or stock leg in journal ${journalId}`
        }, { status: 500 });
      }

      const proceedsCents = cashEntry.amount;
      const costBasisCents = stockEntry.amount;
      let correctPlAmount: bigint;

      if (plEntry.entry_type === 'C') {
        // Gain: proceeds = costBasis + pl → pl = proceeds - costBasis
        correctPlAmount = proceedsCents - costBasisCents;
      } else {
        // Loss: proceeds + pl = costBasis → pl = costBasis - proceeds
        correctPlAmount = costBasisCents - proceedsCents;
      }

      if (correctPlAmount < BigInt(0)) {
        return NextResponse.json({
          error: `Computed negative P&L for journal ${journalId} — manual review needed`
        }, { status: 500 });
      }

      const oldAmount = plEntry.amount;

      // Update the P&L ledger entry
      await prisma.ledger_entries.update({
        where: { id: plEntry.id },
        data: { amount: correctPlAmount }
      });

      // Adjust the COA settled_balance for the difference
      const amountDelta = correctPlAmount - oldAmount;
      if (amountDelta !== BigInt(0)) {
        const balanceChange = plEntry.entry_type === plEntry.chart_of_accounts.balance_type
          ? amountDelta
          : -amountDelta;

        await prisma.chart_of_accounts.update({
          where: { id: plEntry.chart_of_accounts.id },
          data: {
            settled_balance: { increment: balanceChange },
            version: { increment: 1 }
          }
        });
      }

      // Verify it's now balanced
      const updatedEntries = await prisma.ledger_entries.findMany({
        where: { transaction_id: journalId }
      });
      const newDebits = updatedEntries
        .filter(e => e.entry_type === 'D')
        .reduce((sum, e) => sum + e.amount, BigInt(0));
      const newCredits = updatedEntries
        .filter(e => e.entry_type === 'C')
        .reduce((sum, e) => sum + e.amount, BigInt(0));

      if (newDebits !== newCredits) {
        return NextResponse.json({
          error: `Fix failed for ${journalId}: debits=${newDebits} credits=${newCredits}`
        }, { status: 500 });
      }

      fixes.push({
        journalId,
        description: journalTxn.description || '',
        beforeDebits: debits.toString(),
        beforeCredits: credits.toString(),
        afterDebits: newDebits.toString(),
        afterCredits: newCredits.toString(),
        adjustedLegId: plEntry.id,
        adjustedFrom: oldAmount.toString(),
        adjustedTo: correctPlAmount.toString()
      });
    }

    return NextResponse.json({ success: true, fixes });
  } catch (error) {
    console.error('Fix unbalanced entries error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to fix entries'
    }, { status: 500 });
  }
}
