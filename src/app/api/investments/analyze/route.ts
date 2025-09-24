import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { plaidClient } from '@/lib/plaid';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('userEmail')?.value;

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findUnique({ where: { email: userEmail } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Get investment data with proper typing
    let allTransactions: any[] = [];
    let holdings: any[] = [];
    
    const plaidItems = await prisma.plaid_items.findMany({
      where: { userId: user.id }
    });

    for (const item of plaidItems) {
      try {
        // Get investment holdings
        const holdingsResponse = await plaidClient.investmentsHoldingsGet({
          access_token: item.accessToken
        });
        
        if (holdingsResponse.data.holdings) {
          holdings = holdings.concat(holdingsResponse.data.holdings);
        }

        // Get investment transactions
        const transactionsResponse = await plaidClient.investmentsTransactionsGet({
          access_token: item.accessToken,
          start_date: '2020-01-01',
          end_date: new Date().toISOString().split('T')[0]
        });
        
        if (transactionsResponse.data.investment_transactions) {
          allTransactions = allTransactions.concat(transactionsResponse.data.investment_transactions);
        }
      } catch (error) {
        console.error('Error fetching investment data:', error);
      }
    }

    return NextResponse.json({
      holdings,
      transactions: allTransactions,
      summary: {
        totalHoldings: holdings.length,
        totalTransactions: allTransactions.length
      }
    });
  } catch (error) {
    console.error('Investment analysis error:', error);
    return NextResponse.json({ error: 'Failed to analyze investments' }, { status: 500 });
  }
}
