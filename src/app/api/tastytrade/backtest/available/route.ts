import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedClient } from '@/lib/tastytrade';

const BACKTESTER_BASE = 'https://backtester.vast.tastyworks.com';

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

    const client = await getAuthenticatedClient(user.id);
    if (!client) {
      return NextResponse.json({ error: 'Not connected' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    if (!symbol) {
      return NextResponse.json({ error: 'symbol is required' }, { status: 400 });
    }

    // Get the access token from the authenticated client
    const token = (client as any).accessToken?.token || (client as any).accessToken;
    if (!token) {
      return NextResponse.json({ error: 'Could not retrieve access token' }, { status: 500 });
    }

    // Query the backtester for available data range for this symbol
    const resp = await fetch(`${BACKTESTER_BASE}/symbols/${encodeURIComponent(symbol.toUpperCase())}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!resp.ok) {
      // If backtester returns 404, symbol might not be available for backtesting
      if (resp.status === 404) {
        return NextResponse.json({
          available: false,
          symbol: symbol.toUpperCase(),
          message: `${symbol.toUpperCase()} is not available for backtesting`,
        });
      }
      const text = await resp.text();
      console.error('[Backtest] Available check failed:', resp.status, text);
      return NextResponse.json({ error: 'Backtester API error', details: text }, { status: resp.status });
    }

    const data = await resp.json();

    return NextResponse.json({
      available: true,
      symbol: symbol.toUpperCase(),
      startDate: data['start-date'] || data['earliest-date'] || '2010-01-01',
      endDate: data['end-date'] || data['latest-date'] || new Date().toISOString().slice(0, 10),
      strategies: data['available-strategies'] || data['strategies'] || [
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
