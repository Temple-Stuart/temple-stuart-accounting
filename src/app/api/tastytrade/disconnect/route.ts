import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-helpers';

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Check if connection exists
    const connection = await prisma.tastytrade_connections.findUnique({
      where: { userId: user.id },
    });

    if (!connection) {
      return NextResponse.json({ error: 'No Tastytrade connection found' }, { status: 404 });
    }

    // Delete the connection
    await prisma.tastytrade_connections.delete({
      where: { userId: user.id },
    });

    return NextResponse.json({
      disconnected: true,
      message: 'Tastytrade account disconnected',
    });
  } catch (error: any) {
    console.error('[Tastytrade] Disconnect error:', error);
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
  }
}
