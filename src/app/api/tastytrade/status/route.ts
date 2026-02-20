import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isTastytradeConnected } from '@/lib/tastytrade';
import { getCurrentUser } from '@/lib/auth-helpers';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
