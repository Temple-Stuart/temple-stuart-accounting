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

// Try multiple approaches to get a token the backtester will accept.
// The backtester is a DATA service (like DXLink) — it may need the API quote token.
const TT_USER_AGENT = 'TempleStuart/1.0';

async function getBacktesterToken(jwtToken: string): Promise<string | null> {
  // Approach 1: Get an API quote token (used by data services like DXLink/backtester)
  try {
    const quoteResp = await fetch('https://api.tastyworks.com/api-quote-tokens', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json',
        'User-Agent': TT_USER_AGENT,
      },
    });
    if (quoteResp.ok) {
      const quoteData = await quoteResp.json();
      console.log('[TT Auth] Quote token response:', JSON.stringify(quoteData).slice(0, 300));
      const quoteToken = quoteData?.data?.token || quoteData?.token || quoteData?.data?.['dxlink-url'];
      if (quoteToken && typeof quoteToken === 'string' && quoteToken.length < 200) {
        console.log('[TT Auth] Got quote token, length:', quoteToken.length);
        return quoteToken;
      }
    } else {
      const text = await quoteResp.text();
      console.log('[TT Auth] Quote token failed:', quoteResp.status, text.slice(0, 200));
    }
  } catch (e: any) {
    console.log('[TT Auth] Quote token error:', e.message);
  }

  // Approach 2: Get session token from validate response — check ALL fields and headers
  try {
    const validateResp = await fetch('https://api.tastyworks.com/sessions/validate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json',
        'User-Agent': TT_USER_AGENT,
      },
    });
    if (validateResp.ok) {
      const vData = await validateResp.json();
      const data = vData?.data || vData;
      console.log('[TT Auth] Validate full keys:', Object.keys(data).join(', '));
      const possibleToken = data?.['session-token'] || data?.['token'] || data?.['auth-token'] || data?.['api-token'];
      if (possibleToken) {
        console.log('[TT Auth] Found token in validate:', possibleToken.slice(0, 30));
        return possibleToken;
      }

      // Check response headers for session token
      const headerToken = validateResp.headers.get('session-token') ||
                          validateResp.headers.get('authorization') ||
                          validateResp.headers.get('x-session-token');
      if (headerToken) {
        console.log('[TT Auth] Found token in validate headers:', headerToken.slice(0, 30));
        return headerToken;
      }
      console.log('[TT Auth] Validate response headers:', [...validateResp.headers.entries()].map(([k, v]) => `${k}=${v.slice(0, 50)}`).join(', '));
    } else {
      console.log('[TT Auth] Validate failed:', validateResp.status, await validateResp.text().then(t => t.slice(0, 200)));
    }
  } catch (e: any) {
    console.log('[TT Auth] Validate error:', e.message);
  }

  // Approach 3: Try creating session with login field
  try {
    const resp = await fetch('https://api.tastyworks.com/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json',
        'User-Agent': TT_USER_AGENT,
      },
      body: JSON.stringify({ login: 'stonkyoloer' }),
    });
    if (resp.ok) {
      const sData = await resp.json();
      console.log('[TT Auth] Session with login response:', JSON.stringify(sData).slice(0, 300));
      const sessionToken = sData?.data?.['session-token'] || sData?.['session-token'];
      if (sessionToken) return sessionToken;
    } else {
      console.log('[TT Auth] Session with login failed:', resp.status, await resp.text().then(t => t.slice(0, 200)));
    }
  } catch (e: any) {
    console.log('[TT Auth] Session with login error:', e.message);
  }

  return null;
}

// Get a raw auth token string for use with external APIs (e.g. backtester).
// The SDK lazily refreshes tokens, so we trigger a lightweight call first.
// The backtester is a data service — it likely needs a quote token or session token.
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

  // Also try the SDK's built-in quote token method
  try {
    const quoteTokenData = await client.accountsAndCustomersService.getApiQuoteToken();
    console.log('[TT Auth] SDK getApiQuoteToken result:', JSON.stringify(quoteTokenData).slice(0, 300));
    const sdkQuoteToken = quoteTokenData?.token || quoteTokenData?.['dxlink-url'];
    if (sdkQuoteToken && typeof sdkQuoteToken === 'string' && sdkQuoteToken.length < 200) {
      console.log('[TT Auth] Using SDK quote token, length:', sdkQuoteToken.length);
      return sdkQuoteToken;
    }
  } catch (e: any) {
    console.log('[TT Auth] SDK getApiQuoteToken error:', e.message);
  }

  // Exchange the OAuth JWT for a backtester-compatible token
  const jwt = client.accessToken?.token;
  if (jwt && jwt.length > 0) {
    const backtesterToken = await getBacktesterToken(jwt);
    if (backtesterToken) {
      console.log('[TT Auth] Got backtester token, length:', backtesterToken.length, 'starts with:', backtesterToken.slice(0, 20));
      return backtesterToken;
    }
    // Fall back to JWT if all approaches fail
    console.log('[TT Auth] All token approaches failed, falling back to JWT');
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
