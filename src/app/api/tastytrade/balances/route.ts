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

    const balances: any[] = [];

    for (const acct of accountNumbers) {
      try {
        const bal = await client.balancesAndPositionsService.getAccountBalanceValues(acct);
        balances.push({
          accountNumber: acct,
          cashBalance: Number(bal?.['cash-balance'] || 0),
          buyingPower: Number(bal?.['derivative-buying-power'] || 0),
          netLiq: Number(bal?.['net-liquidating-value'] || 0),
          maintenanceRequirement: Number(bal?.['maintenance-requirement'] || 0),
          equityBuyingPower: Number(bal?.['equity-buying-power'] || 0),
        });
      } catch (err: any) {
        console.error(`[Tastytrade] Failed to fetch balances for ${acct}:`, err?.message);
      }
    }

    return NextResponse.json({ balances });
  } catch (error: any) {
    console.error('[Tastytrade] Balances error:', error);
    return NextResponse.json({ error: 'Failed to fetch balances' }, { status: 500 });
  }
}
