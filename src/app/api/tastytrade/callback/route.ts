import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { getTastytradeClient } from '@/lib/tastytrade';

// With OAuth, the SDK auto-refreshes access tokens.
// This endpoint validates the OAuth client still works and updates lastUsedAt.
export async function POST() {
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

    const connection = await prisma.tastytrade_connections.findUnique({
      where: { userId: user.id },
    });

    if (!connection) {
      return NextResponse.json({ error: 'No Tastytrade connection found' }, { status: 404 });
    }

    // Validate OAuth client still works
    try {
      const client = getTastytradeClient();
      await client.accountsAndCustomersService.getCustomerResource();
    } catch {
      await prisma.tastytrade_connections.update({
        where: { userId: user.id },
        data: { status: 'expired' },
      });
      return NextResponse.json({ error: 'OAuth session invalid. Please reconnect.' }, { status: 401 });
    }

    // Update lastUsedAt
    await prisma.tastytrade_connections.update({
      where: { userId: user.id },
      data: {
        status: 'active',
        lastUsedAt: new Date(),
      },
    });

    return NextResponse.json({
      refreshed: true,
      message: 'Session refreshed successfully',
    });
  } catch (error: any) {
    console.error('[Tastytrade] Callback error:', error);
    return NextResponse.json({ error: 'Failed to refresh session' }, { status: 500 });
  }
}
