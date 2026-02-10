import TastytradeClient from '@tastytrade/api';
import { prisma } from '@/lib/prisma';

// Create a production Tastytrade client instance
export function getTastytradeClient(): TastytradeClient {
  return new TastytradeClient(TastytradeClient.ProdConfig);
}

// Check if a user has an active Tastytrade connection
export async function isTastytradeConnected(userId: string): Promise<boolean> {
  const connection = await prisma.tastytrade_connections.findUnique({
    where: { userId },
    select: { status: true, expiresAt: true },
  });

  if (!connection || connection.status !== 'active') {
    return false;
  }

  // If there's an expiration and it's passed, mark as expired
  if (connection.expiresAt && connection.expiresAt < new Date()) {
    await prisma.tastytrade_connections.update({
      where: { userId },
      data: { status: 'expired' },
    });
    return false;
  }

  return true;
}

// Get connection details for a user
export async function getTastytradeConnection(userId: string) {
  return prisma.tastytrade_connections.findUnique({
    where: { userId },
  });
}
