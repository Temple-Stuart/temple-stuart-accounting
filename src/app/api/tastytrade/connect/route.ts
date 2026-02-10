import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { getTastytradeClient } from '@/lib/tastytrade';

export async function POST(request: Request) {
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

    const { username, password } = await request.json();
    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }

    // Login to Tastytrade
    const client = getTastytradeClient();
    let loginResponse;
    try {
      loginResponse = await client.sessionService.login(username, password, true);
    } catch (loginErr: any) {
      console.error('[Tastytrade] Login failed:', loginErr?.message);
      return NextResponse.json({ error: 'Invalid Tastytrade credentials' }, { status: 401 });
    }

    // Get session token from the client
    const sessionToken = client.session.authToken;
    if (!sessionToken) {
      return NextResponse.json({ error: 'Failed to obtain session token' }, { status: 500 });
    }

    // Get the remember token from login response
    const rememberToken = loginResponse?.['remember-token'] || null;

    // Fetch account numbers
    let accountNumbers: string[] = [];
    try {
      const accounts = await client.accountsAndCustomersService.getCustomerAccounts();
      accountNumbers = accounts.map((a: any) => a.account?.['account-number'] || a['account-number']).filter(Boolean);
    } catch (accErr: any) {
      console.error('[Tastytrade] Failed to fetch accounts:', accErr?.message);
    }

    // Upsert connection record
    await prisma.tastytrade_connections.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        ttUsername: username,
        sessionToken,
        rememberToken,
        accountNumbers,
        status: 'active',
        connectedAt: new Date(),
        lastUsedAt: new Date(),
      },
      update: {
        ttUsername: username,
        sessionToken,
        rememberToken,
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
