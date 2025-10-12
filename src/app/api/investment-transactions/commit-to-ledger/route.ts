import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { journalEntryService } from '@/lib/journal-entry-service';

export async function POST(request: Request) {
  try {
    const { transactionIds, accountCode, subAccount, strategy, tradeNum } = await request.json();

    if (!transactionIds || !accountCode) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const results = {
      success: true,
      committed: 0,
      errors: [] as any[]
    };

    const BROKERAGE_CASH = 'P-1200';

    for (const txnId of transactionIds) {
      try {
        const invTxn = await prisma.investment_transactions.findUnique({
          where: { id: txnId }
        });

        if (!invTxn) {
          results.errors.push({ txnId, error: 'Transaction not found' });
          continue;
        }

        const amountCents = Math.abs(Math.round((invTxn.amount || 0) * 100));
        const isIncome = (invTxn.amount || 0) > 0;

        const lines = isIncome 
          ? [
              { accountCode: BROKERAGE_CASH, amount: amountCents, entryType: 'D' as const },
              { accountCode: accountCode, amount: amountCents, entryType: 'C' as const }
            ]
          : [
              { accountCode: accountCode, amount: amountCents, entryType: 'D' as const },
              { accountCode: BROKERAGE_CASH, amount: amountCents, entryType: 'C' as const }
            ];

        await journalEntryService.createJournalEntry({
          date: invTxn.date,
          description: `${invTxn.name} - ${strategy || 'Investment'}`,
          lines,
          externalTransactionId: invTxn.investment_transaction_id
        });

        await prisma.investment_transactions.update({
          where: { id: txnId },
          data: {
            accountCode,
            subAccount,
            strategy,
            tradeNum
          }
        });

        results.committed++;
      } catch (error) {
        console.error('Investment commit error:', error);
        results.errors.push({ txnId, error: String(error) });
      }
    }

    if (results.errors.length > 0) {
      results.success = false;
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('Investment commit error:', error);
    return NextResponse.json({ error: 'Failed to commit investments' }, { status: 500 });
  }
}
