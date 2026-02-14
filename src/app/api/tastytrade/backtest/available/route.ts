import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { getTastytradeAccessToken } from '@/lib/tastytrade';

const BACKTESTER_BASE = 'https://backtester.vast.tastyworks.com';
const TT_USER_AGENT = 'TempleStuart/1.0';

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

    // GET /available-dates returns all available symbols with date ranges
    const url = `${BACKTESTER_BASE}/available-dates`;
    console.log('[Backtest] Calling:', url);
    console.log('[Backtest] Token length:', token.length, 'starts with:', token.slice(0, 30));

    let resp = await fetch(url, {
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
        'User-Agent': TT_USER_AGENT,
      },
    });

    console.log('[Backtest] Response status:', resp.status);

    // If raw token fails with 401, retry with Bearer prefix
    if (resp.status === 401) {
      console.log('[Backtest] Retrying with Bearer prefix...');
      resp = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': TT_USER_AGENT,
        },
      });
      console.log('[Backtest] Bearer retry status:', resp.status);
    }

    // If still 401, try cookie-based auth
    if (resp.status === 401) {
      console.log('[Backtest] Retrying with cookie auth...');
      resp = await fetch(url, {
        headers: {
          'Cookie': `session_token=${token}`,
          'Content-Type': 'application/json',
          'User-Agent': TT_USER_AGENT,
        },
      });
      console.log('[Backtest] Cookie retry status:', resp.status);
    }

    if (!resp.ok) {
      const text = await resp.text();
      console.error('[Backtest] Available check failed:', resp.status, text.slice(0, 500));
      return NextResponse.json({ error: 'Backtester API error', details: text.slice(0, 500) }, { status: resp.status });
    }

    const data = await resp.json();
    const bodyPreview = JSON.stringify(data).slice(0, 500);
    console.log('[Backtest] Response body preview:', bodyPreview);

    // data may be an array of { symbol, start-date, end-date } or an object keyed by symbol
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
    });
  } catch (error: any) {
    console.error('[Backtest] Available error:', error);
    return NextResponse.json({ error: 'Failed to check backtest availability' }, { status: 500 });
  }
}
