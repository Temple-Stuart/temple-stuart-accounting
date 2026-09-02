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

    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Get investment data with proper typing
    let allTransactions: any[] = [];
    let holdings: any[] = [];
    
    const plaidItems = await prisma.plaid_items.findMany({
      where: { userId: user.id }
    });

    for (const item of plaidItems) {
      // HYG-01: STOP AND DECLARE — a failed provider call is the response, never an
      // empty page. `stage` names the call in flight.
      let stage: 'holdings' | 'investments' = 'holdings';
      try {
        // Get investment holdings
        const holdingsResponse = await plaidClient.investmentsHoldingsGet({
          access_token: decryptToken(item.accessToken)
        });
        
        if (holdingsResponse.data.holdings) {
          holdings = holdings.concat(holdingsResponse.data.holdings);
        }

        // Get investment transactions
        stage = 'investments';
        const transactionsResponse = await plaidClient.investmentsTransactionsGet({
          access_token: decryptToken(item.accessToken),
          start_date: '2020-01-01',
          end_date: new Date().toISOString().split('T')[0]
        });
        
        if (transactionsResponse.data.investment_transactions) {
          allTransactions = allTransactions.concat(transactionsResponse.data.investment_transactions);
        }
      } catch (error) {
        const { status, body } = failureEnvelope(stage, error);
        console.error('Error fetching investment data:', body.error);
        return NextResponse.json(body, { status });
      }
    }

    return NextResponse.json({
      ok: true,
      holdings,
      transactions: allTransactions,
      summary: {
        totalHoldings: holdings.length,
        totalTransactions: allTransactions.length
      }
    });
  } catch (error) {
    const { status, body } = failureEnvelope('investments', error);
    console.error('Investment analysis error:', body.error);
    return NextResponse.json(body, { status });
  }
}
