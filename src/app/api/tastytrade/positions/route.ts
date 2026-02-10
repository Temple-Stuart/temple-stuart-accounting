import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedClient, getTastytradeConnection } from '@/lib/tastytrade';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('userEmail')?.value;
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findFirst({ where: { email: userEmail } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const client = await getAuthenticatedClient(user.id);
    if (!client) {
      return NextResponse.json({ error: 'Not connected' }, { status: 401 });
    }

    const connection = await getTastytradeConnection(user.id);
    const accountNumbers = connection?.accountNumbers || [];

    const allPositions: any[] = [];

    for (const acct of accountNumbers) {
      try {
        const positions = await client.balancesAndPositionsService.getPositionsList(acct);
        const mapped = (positions || []).map((p: any) => ({
          symbol: p['symbol'] || p['underlying-symbol'] || '',
          instrumentType: p['instrument-type'] || '',
          quantity: Number(p['quantity'] || 0),
          direction: p['quantity-direction'] || '',
          averageOpenPrice: Number(p['average-open-price'] || 0),
          closePrice: Number(p['close-price'] || 0),
          marketValue: Number(p['market-value'] || 0),
          unrealizedPL: Number(p['realized-day-gain'] || 0),
          accountNumber: acct,
        }));
        allPositions.push(...mapped);
      } catch (err: any) {
        console.error(`[Tastytrade] Failed to fetch positions for ${acct}:`, err?.message);
      }
    }

    return NextResponse.json({ positions: allPositions, accounts: accountNumbers });
  } catch (error: any) {
    console.error('[Tastytrade] Positions error:', error);
    return NextResponse.json({ error: 'Failed to fetch positions' }, { status: 500 });
  }
}
