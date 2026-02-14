import TastytradeClient from '@tastytrade/api';
import { prisma } from '@/lib/prisma';

// Create an OAuth-authenticated Tastytrade client using env vars.
// The SDK handles access-token refresh automatically via the refresh token.
export function getTastytradeClient(): TastytradeClient {
  return new TastytradeClient({
    ...TastytradeClient.ProdConfig,
    clientSecret: process.env.TASTYTRADE_CLIENT_SECRET,
    refreshToken: process.env.TASTYTRADE_REFRESH_TOKEN,
    oauthScopes: ['read', 'trade'],
  });
}

// Check if OAuth env vars are present AND the client can authenticate.
export async function isTastytradeConnected(userId: string): Promise<boolean> {
  if (!process.env.TASTYTRADE_CLIENT_SECRET || !process.env.TASTYTRADE_REFRESH_TOKEN) {
    return false;
  }

  // Also check DB for an active connection record for this user
  const connection = await prisma.tastytrade_connections.findUnique({
    where: { userId },
    select: { status: true },
  });

  if (!connection || connection.status !== 'active') {
    return false;
  }

  // Validate with a lightweight API call
  try {
    const client = getTastytradeClient();
    await client.accountsAndCustomersService.getCustomerResource();
    return true;
  } catch {
    return false;
  }
}

// Get connection details for a user
export async function getTastytradeConnection(userId: string) {
  return prisma.tastytrade_connections.findUnique({
    where: { userId },
  });
}

// Get a raw auth token string for use with external APIs (e.g. backtester).
// The SDK lazily refreshes tokens, so we trigger a lightweight call first.
export async function getTastytradeAccessToken(userId: string): Promise<string | null> {
  const client = await getAuthenticatedClient(userId);
  if (!client) return null;

  // Force the SDK to populate tokens by making a lightweight call
  try {
    await client.accountsAndCustomersService.getCustomerResource();
  } catch {
    // Ignore — token may already be populated
  }

  console.log('[TT Auth] accessToken.token length:', client.accessToken?.token?.length || 0);
  console.log('[TT Auth] session.authToken length:', client.session?.authToken?.length || 0);

  // Prefer session token (used by API requests) over OAuth access token
  const sessionToken = client.session?.authToken;
  if (sessionToken && sessionToken.length > 0) {
    console.log('[TT Auth] Using session authToken, starts with:', sessionToken.slice(0, 20));
    return sessionToken;
  }

  const accessTok = client.accessToken?.token;
  if (accessTok && accessTok.length > 0) {
    console.log('[TT Auth] Using accessToken.token, starts with:', accessTok.slice(0, 20));
    return accessTok;
  }

  console.error('[TT Auth] No token available');
  return null;
}

// Return an OAuth-authenticated TastytradeClient.
// The SDK auto-refreshes access tokens using the refresh token from env vars.
export async function getAuthenticatedClient(userId: string): Promise<TastytradeClient | null> {
  if (!process.env.TASTYTRADE_CLIENT_SECRET || !process.env.TASTYTRADE_REFRESH_TOKEN) {
    return null;
  }

  const connection = await prisma.tastytrade_connections.findUnique({
    where: { userId },
  });

  if (!connection || connection.status !== 'active') {
    return null;
  }

  const client = getTastytradeClient();

  // Update lastUsedAt
  await prisma.tastytrade_connections.update({
    where: { userId },
    data: { lastUsedAt: new Date() },
  });

  return client;
}
