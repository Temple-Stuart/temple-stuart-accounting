import { NextRequest, NextResponse } from 'next/server';
import { plaidClient } from '@/lib/plaid';
import { verifyAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const userId = await verifyAuth(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const plaidItems = await prisma.plaid_items.findMany({
      where: { userId },
      include: { accounts: true }
    });

    const investmentData = [];

    for (const item of plaidItems) {
      try {
        // Get investment holdings
        const holdingsResponse = await plaidClient.investmentsHoldingsGet({
          access_token: item.accessToken
        });

        // Get investment transactions
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        const transactionsResponse = await plaidClient.investmentsTransactionsGet({
          access_token: item.accessToken,
          start_date: startDate,
          end_date: endDate
        });

        investmentData.push({
          institution: item.institutionName,
          holdings: holdingsResponse.data.holdings,
          securities: holdingsResponse.data.securities,
          transactions: transactionsResponse.data.investment_transactions,
          accounts: holdingsResponse.data.accounts
        });
      } catch (error) {
        console.log(`No investment data for ${item.institutionName}`);
      }
    }

    return NextResponse.json({ investmentData });
  } catch (error: any) {
    console.error('Error fetching investments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch investments', details: error.message },
      { status: 500 }
    );
  }
}
