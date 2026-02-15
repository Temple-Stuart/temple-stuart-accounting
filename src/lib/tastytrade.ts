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

// Get a session token via POST /sessions using stored credentials.
// The backtester requires session tokens (~56 chars), NOT OAuth JWTs.
// Cached for 23 hours (sessions last 24h).
let cachedSessionToken: { token: string; expiresAt: number } | null = null;

export async function getTastytradeSessionToken(): Promise<string> {
  // Return cached token if still valid (session tokens last 24h, refresh at 23h)
  if (cachedSessionToken && Date.now() < cachedSessionToken.expiresAt) {
    return cachedSessionToken.token;
  }

  const username = process.env.TT_USERNAME;
  const password = process.env.TT_PASSWORD;

  if (!username || !password) {
    throw new Error('TT_USERNAME and TT_PASSWORD env vars required for backtester');
  }

  const resp = await fetch('https://api.tastyworks.com/sessions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': TT_USER_AGENT,
    },
    body: JSON.stringify({
      login: username,
      password: password,
      'remember-me': true,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    console.log('[TT Auth] Session login failed:', resp.status, text.slice(0, 200));
    throw new Error(`TT session login failed: ${resp.status}`);
  }

  const data = await resp.json();
  const sessionToken = data?.data?.['session-token'];

  if (!sessionToken) {
    console.log('[TT Auth] No session-token in response:', JSON.stringify(data).slice(0, 300));
    throw new Error('No session-token in login response');
  }

  console.log('[TT Auth] Session token obtained, length:', sessionToken.length);

  // Cache for 23 hours (sessions last 24h)
  cachedSessionToken = {
    token: sessionToken,
    expiresAt: Date.now() + 23 * 60 * 60 * 1000,
  };

  return sessionToken;
}
