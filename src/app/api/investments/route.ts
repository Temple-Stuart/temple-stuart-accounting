import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { plaidClient } from '@/lib/plaid';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { decryptToken } from '@/lib/secrets/tokenCipher';
import { failureEnvelope } from '@/lib/plaid/failLoud';

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
      // HYG-01: STOP AND DECLARE — a failed provider call is the response, never an
      // empty list. `stage` names the call in flight.
      let stage: 'holdings' | 'investments' = 'holdings';
      try {
        const holdingsResponse = await plaidClient.investmentsHoldingsGet({
          access_token: decryptToken(item.accessToken)
        });

        stage = 'investments';
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
        const { status, body } = failureEnvelope(stage, error);
        console.error('Error fetching investment data:', body.error);
        return NextResponse.json(body, { status });
      }
    }

    return NextResponse.json(investmentData);
  } catch (error) {
    const { status, body } = failureEnvelope('investments', error);
    console.error('Error in investments route:', body.error);
    return NextResponse.json(body, { status });
  }
}
