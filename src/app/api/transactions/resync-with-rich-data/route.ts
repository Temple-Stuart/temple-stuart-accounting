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
    
    let updated = 0;
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    for (const item of plaidItems) {
      const response = await plaidClient.transactionsGet({
        access_token: item.accessToken,
        start_date: startDate,
        end_date: endDate,
        options: { 
          count: 500, 
          offset: 0,
          include_personal_finance_category: true
        }
      });
      
      for (const txn of response.data.transactions) {
        await prisma.$executeRaw`
          UPDATE transactions 
          SET 
            personal_finance_category = ${JSON.stringify(txn.personal_finance_category || null)}::jsonb,
            counterparties = ${JSON.stringify(txn.counterparties || null)}::jsonb,
            payment_channel = ${txn.payment_channel || null},
            location = ${JSON.stringify(txn.location || null)}::jsonb,
            "merchantName" = ${txn.merchant_name || null},
            category = ${txn.category || []}
          WHERE "transactionId" = ${txn.transaction_id}
        `;
        updated++;
      }
    }
    
    return NextResponse.json({ 
      success: true,
      updated,
      message: `Updated ${updated} transactions with rich data!`
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
