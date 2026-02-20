import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { plaidClient } from '@/lib/plaid';
import { getCurrentUser } from '@/lib/auth-helpers';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const plaidItems = await prisma.plaid_items.findMany({
      where: { userId: user.id }
    });

    const investmentData = [];
    
    for (const item of plaidItems) {
      try {
        const holdingsResponse = await plaidClient.investmentsHoldingsGet({
          access_token: item.accessToken
        });

        const transactionsResponse = await plaidClient.investmentsTransactionsGet({
          access_token: item.accessToken,
          start_date: '2020-01-01',
          end_date: new Date().toISOString().split('T')[0]
        });

        investmentData.push({
          institution: 'Investment Account', // Default since institutionName doesn't exist
          holdings: holdingsResponse.data.holdings,
          securities: holdingsResponse.data.securities,
          transactions: transactionsResponse.data.investment_transactions,
        });
      } catch (error) {
        console.error('Error fetching investment data:', error);
      }
    }

    return NextResponse.json(investmentData);
  } catch (error) {
    console.error('Error in investments route:', error);
    return NextResponse.json({ error: 'Failed to fetch investments' }, { status: 500 });
  }
}
