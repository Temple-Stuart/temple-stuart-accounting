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
