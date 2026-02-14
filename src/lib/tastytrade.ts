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

// Exhaustive token+format matrix test against the backtester.
// Collects ALL available token types, then tries each against the backtester
// with multiple auth header formats to find what actually works.
const TT_USER_AGENT = 'TempleStuart/1.0';

export async function getTastytradeAccessToken(userId: string): Promise<string> {
  const client = await getAuthenticatedClient(userId);
  if (!client) return '';

  // Force the SDK to populate tokens by making a lightweight call
  try {
    await client.accountsAndCustomersService.getCustomerResource();
  } catch {
    // Ignore — token may already be populated
  }

  // Collect all available tokens
  const tokens: { name: string; value: string }[] = [];

  // 1. SDK session token
  if (client.session?.authToken) {
    tokens.push({ name: 'session', value: client.session.authToken });
  }

  // 2. OAuth JWT
  const jwt = client.accessToken?.token;
  if (jwt) {
    tokens.push({ name: 'jwt', value: jwt });
  }

  // 3. SDK quote token
  try {
    const quoteResult = await client.accountsAndCustomersService.getApiQuoteToken();
    const qt = (quoteResult as any)?.token;
    if (qt) {
      tokens.push({ name: 'quote', value: qt });
    }
  } catch (e: any) {
    console.log('[TT Auth] SDK quote token error:', e.message);
  }

  // 4. Try session create with JWT auth + login field
  if (jwt) {
    try {
      const resp = await fetch('https://api.tastyworks.com/sessions', {
        method: 'POST',
        headers: {
          'Authorization': jwt,
          'Content-Type': 'application/json',
          'User-Agent': TT_USER_AGENT,
        },
        body: JSON.stringify({
          login: 'stonkyoloer',
          'remember-me': true,
        }),
      });
      const text = await resp.text();
      console.log('[TT Auth] Session create (jwt auth):', resp.status, text.slice(0, 300));
      if (resp.ok) {
        try {
          const sData = JSON.parse(text);
          const st = sData?.data?.['session-token'];
          if (st) tokens.push({ name: 'session-from-jwt', value: st });
        } catch { /* ignore parse error */ }
      }
    } catch (e: any) {
      console.log('[TT Auth] Session create error:', e.message);
    }
  }

  // 5. Try session create with Bearer JWT
  if (jwt) {
    try {
      const resp = await fetch('https://api.tastyworks.com/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json',
          'User-Agent': TT_USER_AGENT,
        },
        body: JSON.stringify({
          login: 'stonkyoloer',
          'remember-me': true,
        }),
      });
      const text = await resp.text();
      console.log('[TT Auth] Session create (bearer auth):', resp.status, text.slice(0, 300));
      if (resp.ok) {
        try {
          const sData = JSON.parse(text);
          const st = sData?.data?.['session-token'];
          if (st) tokens.push({ name: 'session-from-bearer', value: st });
        } catch { /* ignore parse error */ }
      }
    } catch (e: any) {
      console.log('[TT Auth] Session create bearer error:', e.message);
    }
  }

  console.log('[TT Auth] Collected tokens:', tokens.map(t => `${t.name}(${t.value.length})`).join(', '));

  // Now try EACH token against the backtester with multiple auth formats
  for (const token of tokens) {
    const formats: { name: string; headers: Record<string, string> }[] = [
      { name: 'raw', headers: { 'Authorization': token.value } },
      { name: 'bearer', headers: { 'Authorization': `Bearer ${token.value}` } },
      { name: 'cookie', headers: { 'Cookie': `session_token=${token.value}` } },
    ];

    for (const fmt of formats) {
      try {
        const mergedHeaders: Record<string, string> = {
          ...fmt.headers,
          'Content-Type': 'application/json',
          'User-Agent': TT_USER_AGENT,
        };
        const resp = await fetch('https://backtester.vast.tastyworks.com/available-dates', {
          method: 'GET',
          headers: mergedHeaders,
        });
        const status = resp.status;
        const body = await resp.text();
        console.log(`[TT Auth] Backtester test: ${token.name}+${fmt.name} → ${status} ${body.slice(0, 100)}`);

        if (status === 200) {
          console.log(`[TT Auth] SUCCESS: ${token.name}+${fmt.name} works!`);
          return token.value;
        }
      } catch (e: any) {
        console.log(`[TT Auth] Backtester test error: ${token.name}+${fmt.name} → ${e.message}`);
      }
    }
  }

  // If nothing worked, return JWT as fallback so routes can report the error
  console.log('[TT Auth] BLOCKER: No token accepted by backtester');
  return jwt || '';
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
