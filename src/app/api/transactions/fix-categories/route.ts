import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { plaidClient } from '@/lib/plaid';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const userId = await verifyAuth(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const plaidItems = await prisma.plaid_items.findMany({
      where: { userId },
      include: { accounts: true }
    });
    
    let fixed = 0;
    
    for (const item of plaidItems) {
      try {
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        const response = await plaidClient.transactionsGet({
          access_token: item.accessToken,
          start_date: startDate,
          end_date: endDate,
          options: { count: 500, offset: 0 }
        });
        
        for (const plaidTxn of response.data.transactions) {
          await prisma.transactions.updateMany({
            where: { transactionId: plaidTxn.transaction_id },
            data: { 
              category: plaidTxn.category || [],
              merchantName: plaidTxn.merchant_name
            }
          });
          fixed++;
        }
      } catch (error) {
        console.error(`Failed to fix categories for ${item.institutionName}:`, error);
      }
    }
    
    return NextResponse.json({ 
      success: true,
      fixed,
      message: `Updated categories for ${fixed} transactions`
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fix categories', details: error.message },
      { status: 500 }
    );
  }
}
