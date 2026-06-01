import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedClient, getTastytradeConnection } from '@/lib/tastytrade';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { requireAdmin } from '@/lib/require-admin';

export async function GET() {
  try {
    // SECURITY-PR-SEC4: TastyTrade uses a SHARED FIRM account (env creds via
    // getTastytradeClient — NOT per-user OAuth; the tastytrade_connections row is
    // just a flag that unlocks the shared session). So any caller spends/reads
    // ALEX'S brokerage. Gate to admin BEFORE any TT call or data read — 403 for
    // non-admins, 401 for guests. (Same requireAdmin pattern as /trading/convergence.)
    const adminGate = await requireAdmin();
    if (adminGate instanceof NextResponse) return adminGate;
    const userEmail = await getVerifiedEmail();
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
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
