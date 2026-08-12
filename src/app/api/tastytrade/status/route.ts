import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isTastytradeConnected } from '@/lib/tastytrade';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { requireTabAccess } from '@/lib/auth-helpers';

export async function GET() {
  try {
    // SECURITY-PR-SEC4: TastyTrade uses a SHARED FIRM account (env creds via
    // getTastytradeClient — NOT per-user OAuth; the tastytrade_connections row is
    // just a flag that unlocks the shared session). So any caller spends/reads
    // ALEX'S brokerage session. TRADE-GATE (2026-08-11): market-data reads are
    // entitlement-gated below (tab:trade); the connection itself stays owner-scoped.
    const userEmail = await getVerifiedEmail();
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    // TRADE-GATE: entitlement-gated — the paid tab:trade key (or bundle)
    // unlocks this endpoint; admin passes via hasTabAccess's ADMIN_USER_ID
    // bypass (entitlements.ts:48). Market/pipeline data only — the broker
    // CONNECTION and the shared account's balances/positions stay
    // owner-scoped (see connect/callback + balances/positions routes).
    const tabGate = await requireTabAccess(user.id, 'tab:trade');
    if (tabGate) return tabGate;

    const connected = await isTastytradeConnected(user.id);

    if (!connected) {
      return NextResponse.json({ connected: false });
    }

    // Get connection details
    const connection = await prisma.tastytrade_connections.findUnique({
      where: { userId: user.id },
      select: {
        accountNumbers: true,
        status: true,
        connectedAt: true,
        lastUsedAt: true,
      },
    });

    return NextResponse.json({
      connected: true,
      accountNumbers: connection?.accountNumbers || [],
      connectedAt: connection?.connectedAt,
      lastUsedAt: connection?.lastUsedAt,
    });
  } catch (error: any) {
    console.error('[Tastytrade] Status error:', error);
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 });
  }
}
