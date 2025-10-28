import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('userEmail')?.value;

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user to filter transactions
    const user = await prisma.users.findUnique({
      where: { email: userEmail }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

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
      predictedCoaCode: txn.predictedCoaCode,
      predictionConfidence: txn.predictionConfidence ? Number(txn.predictionConfidence) : null,
      accountCode: txn.accountCode,
      accountName: txn.account?.name,
      institutionName: txn.account?.plaid_items?.institutionName
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
