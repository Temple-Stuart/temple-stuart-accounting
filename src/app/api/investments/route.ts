import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { plaidClient } from '@/lib/plaid';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { decryptToken } from '@/lib/secrets/tokenCipher';
import { failureEnvelope } from '@/lib/plaid/failLoud';
// REBUILD-01 PR-2d: holdings come from the STORED snapshot (sync-complete's holdings
// stage lands them raw-first) — Plaid is never asked for holdings here.
import { latestHoldingsSnapshot } from '@/lib/arrivals/holdingsSnapshot';

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
      where: { userId: user.id },
      include: { accounts: { select: { id: true, accountId: true } } },
    });

    const investmentData = [];

    for (const item of plaidItems) {
      // REBUILD-01 PR-2d: the latest stored snapshot per account — `as_of` null means
      // no snapshot has been stored yet (run a sync), never an empty portfolio.
      const snapshot = await latestHoldingsSnapshot(prisma, item.accounts);

      // HYG-01: STOP AND DECLARE — a failed provider call is the response, never an
      // empty list. `stage` names the call in flight.
      const stage = 'investments';
      try {
        const transactionsResponse = await plaidClient.investmentsTransactionsGet({
          access_token: decryptToken(item.accessToken),
          start_date: '2020-01-01',
          end_date: new Date().toISOString().split('T')[0]
        });

        investmentData.push({
          institution: 'Investment Account', // Default since institutionName doesn't exist
          snapshot: { as_of: snapshot.as_of, stored: snapshot.holdings.length },
          holdings: snapshot.holdings,
          securities: snapshot.securities,
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
