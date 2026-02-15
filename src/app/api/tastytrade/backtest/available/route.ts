import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { getTastytradeAccessToken } from '@/lib/tastytrade';

const TT_USER_AGENT = 'TempleStuart/1.0';

// Try multiple endpoint/header combos to discover what the backtester accepts.
// First 200 wins. Each attempt is logged for diagnostics.
interface EndpointAttempt {
  label: string;
  url: string;
  headers: Record<string, string>;
}

function buildAttempts(token: string): EndpointAttempt[] {
  return [
    // 0a. tastytrade.com domain (new domain, OAuth-native)
    {
      label: 'backtester-tastytrade-bearer',
      url: 'https://backtester.vast.tastytrade.com/available-dates',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': TT_USER_AGENT,
      },
    },
    // 0b. Main API on tastytrade.com domain
    {
      label: 'main-api-tastytrade-bearer',
      url: 'https://api.tastytrade.com/available-dates',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': TT_USER_AGENT,
      },
    },
    // 0c. Main API on tastytrade.com with backtests path
    {
      label: 'main-api-tastytrade-backtests',
      url: 'https://api.tastytrade.com/backtests/available-dates',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': TT_USER_AGENT,
      },
    },
    {
      label: 'main-api-bearer',
      url: 'https://api.tastyworks.com/available-dates',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': TT_USER_AGENT,
      },
    },
    {
      label: 'main-api-backtests',
      url: 'https://api.tastyworks.com/backtests/available-dates',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': TT_USER_AGENT,
      },
    },
    {
      label: 'backtester-sdk-ua',
      url: 'https://backtester.vast.tastyworks.com/available-dates',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': TT_USER_AGENT,
      },
    },
    {
      label: 'backtester-raw-accept',
      url: 'https://backtester.vast.tastyworks.com/available-dates',
      headers: {
        'Authorization': token,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': TT_USER_AGENT,
      },
    },
    // Try "Token" prefix (some internal APIs use this)
    {
      label: 'backtester-token-prefix',
      url: 'https://backtester.vast.tastyworks.com/available-dates',
      headers: {
        'Authorization': `Token ${token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': TT_USER_AGENT,
      },
    },
    // Try X-Authorization header (some proxied services)
    {
      label: 'backtester-x-auth',
      url: 'https://backtester.vast.tastyworks.com/available-dates',
      headers: {
        'X-Authorization': token,
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': TT_USER_AGENT,
      },
    },
  ];
}

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('userEmail')?.value;
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findFirst({ where: { email: userEmail } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const token = await getTastytradeAccessToken(user.id);
    if (!token) {
      return NextResponse.json({ error: 'Not connected or could not retrieve access token' }, { status: 401 });
    }
    console.log('[Backtest] Token obtained, length:', token.length);

    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    if (!symbol) {
      return NextResponse.json({ error: 'symbol is required' }, { status: 400 });
    }

    // Decode JWT to inspect claims (JWTs are base64url, not encrypted)
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
        console.log('[Backtest] JWT header:', JSON.stringify(header));
        console.log('[Backtest] JWT payload:', JSON.stringify(payload));
        console.log('[Backtest] JWT aud:', payload.aud);
        console.log('[Backtest] JWT sub:', payload.sub);
        console.log('[Backtest] JWT scope:', payload.scope);
        console.log('[Backtest] JWT iss:', payload.iss);
        console.log('[Backtest] JWT exp:', payload.exp, 'iat:', payload.iat);
      }
    } catch (e: any) {
      console.log('[Backtest] JWT decode error:', e.message);
    }

    // Try each endpoint/header combo — first 200 wins
    const attempts = buildAttempts(token);
    let data: any = null;
    let winningLabel = '';

    for (const attempt of attempts) {
      try {
        console.log(`[Backtest] Trying ${attempt.label}: ${attempt.url}`);
        const resp = await fetch(attempt.url, { headers: attempt.headers });
        const bodyText = await resp.text();
        console.log(`[Backtest] ${attempt.label} → ${resp.status}, body preview: ${bodyText.slice(0, 300)}`);

        if (resp.ok) {
          try {
            data = JSON.parse(bodyText);
            winningLabel = attempt.label;
            console.log(`[Backtest] SUCCESS via ${attempt.label}`);
            break;
          } catch {
            console.log(`[Backtest] ${attempt.label} returned 200 but body is not JSON`);
          }
        }
      } catch (e: any) {
        console.log(`[Backtest] ${attempt.label} fetch error: ${e.message}`);
      }
    }

    if (!data) {
      return NextResponse.json({
        error: 'All backtester endpoints failed',
        message: 'Could not reach backtester with any endpoint/auth combo. Check server logs for details.',
      }, { status: 502 });
    }

    console.log(`[Backtest] Parsing response from ${winningLabel}`);

    // Parse response — handle various shapes
    const upperSymbol = symbol.toUpperCase();
    let match: any = null;

    if (Array.isArray(data)) {
      match = data.find((item: any) => (item.symbol || item.ticker || '').toUpperCase() === upperSymbol);
    } else if (data.items && Array.isArray(data.items)) {
      match = data.items.find((item: any) => (item.symbol || item.ticker || '').toUpperCase() === upperSymbol);
    } else if (data[upperSymbol]) {
      match = data[upperSymbol];
    } else if (data['available-dates']) {
      const dates = data['available-dates'];
      if (Array.isArray(dates)) {
        match = dates.find((item: any) => (item.symbol || item.ticker || '').toUpperCase() === upperSymbol);
      } else if (dates[upperSymbol]) {
        match = dates[upperSymbol];
      }
    }

    if (!match) {
      return NextResponse.json({
        available: false,
        symbol: upperSymbol,
        message: `${upperSymbol} is not available for backtesting`,
        endpoint: winningLabel,
      });
    }

    return NextResponse.json({
      available: true,
      symbol: upperSymbol,
      startDate: match['start-date'] || match['earliest-date'] || match['startDate'] || '2010-01-01',
      endDate: match['end-date'] || match['latest-date'] || match['endDate'] || new Date().toISOString().slice(0, 10),
      strategies: match['available-strategies'] || match['strategies'] || [
        'iron_condor', 'short_put_vertical', 'short_call_vertical',
        'short_strangle', 'short_straddle', 'long_call_vertical',
        'long_put_vertical', 'long_straddle', 'long_strangle',
      ],
      endpoint: winningLabel,
    });
  } catch (error: any) {
    console.error('[Backtest] Available error:', error);
    return NextResponse.json({ error: 'Failed to check backtest availability' }, { status: 500 });
  }
}
