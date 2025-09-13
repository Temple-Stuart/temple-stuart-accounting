import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { syncTransactions } from '@/lib/plaid-service';

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };

    const plaidItems = await prisma.plaidItem.findMany({
      where: { userId: decoded.userId },
      include: { accounts: true },
    });

    const results = [];

    for (const item of plaidItems) {
      try {
        const syncResult = await syncTransactions(item.accessToken);
        
        for (const transaction of syncResult.transactions) {
          const account = item.accounts.find(a => a.accountId === transaction.account_id);
          if (!account) continue;

          await prisma.transaction.upsert({
            where: { transactionId: transaction.transaction_id },
            update: {
              amount: transaction.amount,
              date: new Date(transaction.date),
              name: transaction.name,
              merchantName: transaction.merchant_name,
              category: transaction.category || [],
              pending: transaction.pending,
            },
            create: {
              accountId: account.id,
              transactionId: transaction.transaction_id,
              amount: transaction.amount,
              date: new Date(transaction.date),
              name: transaction.name,
              merchantName: transaction.merchant_name,
              category: transaction.category || [],
              pending: transaction.pending,
            },
          });
        }
        
        results.push({
          institution: item.institutionName,
          synced: syncResult.totalFetched,
        });
      } catch (error: any) {
        results.push({
          institution: item.institutionName,
          error: error.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Synced 24 months of transactions',
      results,
    });
  } catch (error: any) {
    console.error('Error syncing transactions:', error);
    return NextResponse.json(
      { error: 'Failed to sync transactions', details: error.message },
      { status: 500 }
    );
  }
}
