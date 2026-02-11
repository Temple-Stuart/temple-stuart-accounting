import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { getTastytradeClient } from '@/lib/tastytrade';

// Callback route: refresh a session using a stored remember token
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

    // Get existing connection
    const connection = await prisma.tastytrade_connections.findUnique({
      where: { userId: user.id },
    });

    if (!connection || !connection.rememberToken) {
      return NextResponse.json({ error: 'No Tastytrade connection found' }, { status: 404 });
    }

    // Re-authenticate using remember token
    const client = getTastytradeClient();
    try {
      await client.sessionService.loginWithRememberToken(
        connection.ttUsername,
        connection.rememberToken
      );
    } catch (refreshErr: any) {
      console.error('[Tastytrade] Token refresh failed:', refreshErr?.message);
      // Mark connection as expired
      await prisma.tastytrade_connections.update({
        where: { userId: user.id },
        data: { status: 'expired' },
      });
      return NextResponse.json({ error: 'Session expired. Please reconnect.' }, { status: 401 });
    }

    const newSessionToken = client.session.authToken;
    if (!newSessionToken) {
      return NextResponse.json({ error: 'Failed to refresh session' }, { status: 500 });
    }

    // Update stored session token
    await prisma.tastytrade_connections.update({
      where: { userId: user.id },
      data: {
        sessionToken: newSessionToken,
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
