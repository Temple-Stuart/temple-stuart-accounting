import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-helpers';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Get user to filter transactions
    // Fetch transactions pending review
    const pendingTransactions = await prisma.transactions.findMany({
      where: {
        review_status: 'pending_review',
        accounts: {
          userId: user.id
        }
      },
      include: {
        accounts: {
          include: {
            plaid_items: true
          }
        }
      },
      orderBy: {
        date: 'desc'
      }
    });

    // Format for frontend
    const formatted = pendingTransactions.map(txn => ({
      id: txn.id,
      date: txn.date,
      merchantName: txn.merchantName || txn.name,
      amount: txn.amount,
      category: (txn.personal_finance_category as any)?.primary || null,
      predictedCoaCode: txn.predicted_coa_code,
      predictionConfidence: txn.prediction_confidence ? Number(txn.prediction_confidence) : null,
      accountCode: txn.accountCode,
      accountName: txn.accounts?.name,
      institutionName: txn.accounts?.plaid_items?.institutionName
    }));

    return NextResponse.json({
      transactions: formatted,
      count: formatted.length
    });

  } catch (error: any) {
    console.error('Review queue error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
