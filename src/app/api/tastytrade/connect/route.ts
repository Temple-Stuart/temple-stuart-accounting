import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTastytradeClient } from '@/lib/tastytrade';
import { getVerifiedEmail } from '@/lib/cookie-auth';

export async function POST() {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findFirst({ where: { email: userEmail } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify OAuth env vars are configured
    if (!process.env.TASTYTRADE_CLIENT_SECRET || !process.env.TASTYTRADE_REFRESH_TOKEN) {
      return NextResponse.json(
        { error: 'Tastytrade OAuth credentials not configured on server' },
        { status: 500 }
      );
    }

    // Create OAuth client and validate it works
    const client = getTastytradeClient();
    let accountNumbers: string[] = [];
    try {
      const accounts = await client.accountsAndCustomersService.getCustomerAccounts();
      accountNumbers = accounts
        .map((a: any) => a.account?.['account-number'] || a['account-number'])
        .filter(Boolean);
    } catch (err: any) {
      console.error('[Tastytrade] OAuth validation failed:', err?.message);
      return NextResponse.json(
        { error: 'Failed to authenticate with Tastytrade. Check server OAuth configuration.' },
        { status: 401 }
      );
    }

    // Upsert connection record (no session/remember tokens needed)
    await prisma.tastytrade_connections.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        ttUsername: 'oauth',
        sessionToken: 'oauth',
        accountNumbers,
        status: 'active',
        connectedAt: new Date(),
        lastUsedAt: new Date(),
      },
      update: {
        ttUsername: 'oauth',
        sessionToken: 'oauth',
        rememberToken: null,
        accountNumbers,
        status: 'active',
        connectedAt: new Date(),
        lastUsedAt: new Date(),
      },
    });

    return NextResponse.json({
      connected: true,
      accountNumbers,
      message: 'Tastytrade account connected successfully',
    });
  } catch (error: any) {
    console.error('[Tastytrade] Connect error:', error);
    return NextResponse.json({ error: 'Failed to connect Tastytrade account' }, { status: 500 });
  }
}
