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

// Return a TastytradeClient authenticated with a stored session token.
// Falls back to re-login via remember token if the stored session is stale.
export async function getAuthenticatedClient(userId: string): Promise<TastytradeClient | null> {
  const connection = await prisma.tastytrade_connections.findUnique({
    where: { userId },
  });

  if (!connection || connection.status !== 'active') {
    return null;
  }

  const client = new TastytradeClient(TastytradeClient.ProdConfig);

  // Set the stored session token directly (public property on TastytradeSession)
  client.session.authToken = connection.sessionToken;

  // Quick validation: try a lightweight call to see if the token still works
  try {
    await client.accountsAndCustomersService.getCustomerResource();
  } catch {
    // Token expired — try remember token refresh
    if (!connection.rememberToken || !connection.ttUsername) {
      await prisma.tastytrade_connections.update({
        where: { userId },
        data: { status: 'expired' },
      });
      return null;
    }

    try {
      await client.sessionService.loginWithRememberToken(
        connection.ttUsername,
        connection.rememberToken
      );
    } catch {
      await prisma.tastytrade_connections.update({
        where: { userId },
        data: { status: 'expired' },
      });
      return null;
    }

    const newToken = client.session.authToken;
    if (!newToken) {
      return null;
    }

    // Persist the refreshed token
    await prisma.tastytrade_connections.update({
      where: { userId },
      data: { sessionToken: newToken, lastUsedAt: new Date() },
    });

    return client;
  }

  // Token was valid — update lastUsedAt
  await prisma.tastytrade_connections.update({
    where: { userId },
    data: { lastUsedAt: new Date() },
  });

  return client;
}
