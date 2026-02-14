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

// Exchange an OAuth JWT for a Tastytrade session token.
// The backtester API requires a session token, not the OAuth JWT directly.
// Flow: JWT → POST /sessions/validate or /sessions → session-token
const TT_USER_AGENT = 'TempleStuart/1.0';

async function getSessionToken(jwtToken: string): Promise<string | null> {
  const baseUrl = 'https://api.tastyworks.com';

  // Try validating existing session with the JWT
  try {
    const resp = await fetch(`${baseUrl}/sessions/validate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json',
        'User-Agent': TT_USER_AGENT,
      },
    });

    if (resp.ok) {
      const data = await resp.json();
      console.log('[TT Auth] Session validate response:', JSON.stringify(data).slice(0, 300));
      const sessionToken = data?.data?.['session-token'] || data?.['session-token'] || data?.data?.token;
      if (sessionToken) return sessionToken;
    } else {
      console.log('[TT Auth] Session validate failed:', resp.status, await resp.text().then(t => t.slice(0, 200)));
    }
  } catch (err) {
    console.log('[TT Auth] Session validate error:', err);
  }

  // Try creating a new session with the JWT
  try {
    const resp2 = await fetch(`${baseUrl}/sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json',
        'User-Agent': TT_USER_AGENT,
      },
      body: JSON.stringify({}),
    });

    if (resp2.ok) {
      const data2 = await resp2.json();
      console.log('[TT Auth] Session create response:', JSON.stringify(data2).slice(0, 300));
      const sessionToken = data2?.data?.['session-token'] || data2?.['session-token'] || data2?.data?.token;
      if (sessionToken) return sessionToken;
    } else {
      console.log('[TT Auth] Session create failed:', resp2.status, await resp2.text().then(t => t.slice(0, 200)));
    }
  } catch (err) {
    console.log('[TT Auth] Session create error:', err);
  }

  return null;
}

// Get a raw auth token string for use with external APIs (e.g. backtester).
// The SDK lazily refreshes tokens, so we trigger a lightweight call first.
// The backtester needs a session token (~44 chars), not the OAuth JWT (~1158 chars).
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

  // If the SDK already has a session token, use it
  const existingSession = client.session?.authToken;
  if (existingSession && existingSession.length > 0) {
    console.log('[TT Auth] Using existing session authToken, length:', existingSession.length);
    return existingSession;
  }

  // Exchange the OAuth JWT for a session token
  const jwt = client.accessToken?.token;
  if (jwt && jwt.length > 0) {
    const sessionToken = await getSessionToken(jwt);
    if (sessionToken) {
      console.log('[TT Auth] Got session token from JWT exchange, length:', sessionToken.length, 'starts with:', sessionToken.slice(0, 20));
      return sessionToken;
    }
    // Fall back to JWT if session token creation fails
    console.log('[TT Auth] Session token exchange failed, falling back to JWT');
    return jwt;
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
