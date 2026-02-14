import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedClient } from '@/lib/tastytrade';
import type { BacktestConfig, BacktestManagement } from '@/lib/backtest-translator';

const BACKTESTER_BASE = 'https://backtester.vast.tastyworks.com';

// Single trade simulation — tests one specific entry date
export async function POST(request: Request) {
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

    const body = await request.json();
    const { symbol, strategyType, legs, dte, management, entryDate } = body;

    if (!symbol || !legs || legs.length === 0 || !entryDate) {
      return NextResponse.json({ error: 'symbol, legs, and entryDate are required' }, { status: 400 });
    }

    const token = (client as any).accessToken?.token || (client as any).accessToken;
    if (!token) {
      return NextResponse.json({ error: 'Could not retrieve access token' }, { status: 500 });
    }

    const mgmt = management as BacktestManagement || {
      profitTargetPercent: 50,
      stopLossPercent: 200,
      exitDte: 21,
    };

    const resp = await fetch(`${BACKTESTER_BASE}/backtests/simulate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        symbol: symbol.toUpperCase(),
        'strategy-type': strategyType || 'custom',
        legs: legs.map((leg: any) => ({
          side: leg.side,
          'option-type': leg.type,
          delta: leg.delta,
        })),
        'target-dte': dte || 45,
        'entry-date': entryDate,
        management: {
          'profit-target-percent': mgmt.profitTargetPercent,
          'stop-loss-percent': mgmt.stopLossPercent,
          'exit-dte': mgmt.exitDte,
        },
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error('[Backtest] Simulate failed:', resp.status, text);
      return NextResponse.json({ error: 'Simulation failed', details: text }, { status: resp.status });
    }

    const data = await resp.json();

    return NextResponse.json({
      trade: {
        entryDate: data['entry-date'] || entryDate,
        exitDate: data['exit-date'] || '',
        entryPrice: parseFloat(data['entry-price'] || 0),
        exitPrice: parseFloat(data['exit-price'] || 0),
        pnl: parseFloat(data['pnl'] || data['profit-loss'] || 0),
        pnlPercent: parseFloat(data['pnl-percent'] || data['return-percent'] || 0),
        holdingDays: parseInt(data['holding-days'] || data['days-held'] || 0, 10),
        exitReason: data['exit-reason'] || data['close-reason'] || 'expiration',
        dailyPnl: (data['daily-pnl'] || []).map((d: any) => ({
          date: d['date'],
          pnl: parseFloat(d['pnl'] || 0),
          underlyingPrice: parseFloat(d['underlying-price'] || 0),
        })),
      },
    });

  } catch (error: any) {
    console.error('[Backtest] Simulate error:', error);
    return NextResponse.json({ error: 'Failed to simulate trade' }, { status: 500 });
  }
}
