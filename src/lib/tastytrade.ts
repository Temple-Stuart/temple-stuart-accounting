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

// Get a fresh OAuth JWT for use with Tastytrade APIs.
// Forces token refresh via SDK call, returns Bearer JWT.
// Routes handle endpoint discovery themselves.
const TT_USER_AGENT = 'TempleStuart/1.0';

export async function getTastytradeAccessToken(userId: string): Promise<string> {
  const client = await getAuthenticatedClient(userId);
  if (!client) return '';

  // Force token refresh by making a lightweight SDK call
  try {
    await client.accountsAndCustomersService.getCustomerResource();
  } catch (e: any) {
    console.log('[TT Auth] Customer resource call failed:', e.message);
  }

  const jwt = client.accessToken?.token;
  if (!jwt) {
    console.error('[TT Auth] No access token available after SDK call');
    return '';
  }

  // Log token freshness
  const accessToken = client.accessToken;
  const expiration = (accessToken as any)?.expiration;
  console.log('[TT Auth] Token length:', jwt.length, 'expires:', expiration?.toISOString?.() || 'unknown');

  return jwt;
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
