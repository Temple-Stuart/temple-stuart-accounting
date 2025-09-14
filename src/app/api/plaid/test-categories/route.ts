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
      take: 1
    });
    
    if (!plaidItems.length) {
      return NextResponse.json({ error: 'No plaid items' });
    }

    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const response = await plaidClient.transactionsGet({
      access_token: plaidItems[0].accessToken,
      start_date: startDate,
      end_date: endDate,
      options: { count: 5, offset: 0 }
    });
    
    return NextResponse.json({ 
      sample: response.data.transactions[0],
      categories: response.data.transactions.map(t => ({
        name: t.name,
        category: t.category,
        personal_finance_category: t.personal_finance_category
      }))
    });
    
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
