import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { plaidClient } from '@/lib/plaid';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { decryptToken } from '@/lib/secrets/tokenCipher';
import { summarizePlaidError } from '@/lib/plaid/summarizeError';

export async function GET() {
  try {
    const userEmail = await getVerifiedEmail();

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findUnique({
      where: { email: userEmail }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const plaidItems = await prisma.plaid_items.findMany({
      where: { userId: user.id }
    });

    const investmentData = [];
    
    for (const item of plaidItems) {
      try {
        const holdingsResponse = await plaidClient.investmentsHoldingsGet({
          access_token: decryptToken(item.accessToken)
        });

        const transactionsResponse = await plaidClient.investmentsTransactionsGet({
          access_token: decryptToken(item.accessToken),
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
        console.error('Error fetching investment data:', summarizePlaidError(error));
      }
    }

    return NextResponse.json(investmentData);
  } catch (error) {
    console.error('Error in investments route:', summarizePlaidError(error));
    return NextResponse.json({ error: 'Failed to fetch investments' }, { status: 500 });
  }
}
