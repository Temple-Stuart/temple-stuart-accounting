import { NextResponse } from 'next/server';
import { getTastytradeSessionToken } from '@/lib/tastytrade';
import { requireAdmin } from '@/lib/require-admin';
import { numOrNull } from '@/lib/parse-num';
import type { BacktestManagement } from '@/lib/backtest-translator';

const BACKTESTER_BASE = 'https://backtester.vast.tastyworks.com';
const TT_USER_AGENT = 'TempleStuart/1.0';

// Single trade simulation — tests one specific entry date
export async function POST(request: Request) {
  try {
    // SECURITY (PR-Trade-SEC): PAID TastyTrade backtester — gate to admin/owner BEFORE any
    // session token / paid call, mirroring /api/trading/convergence (route.ts:51-52).
    const adminResult = await requireAdmin();
    if (adminResult instanceof NextResponse) return adminResult;

    const token = await getTastytradeSessionToken();
    console.log('[Backtest Simulate] Session token obtained, length:', token.length);

    const body = await request.json();
    const { symbol, strategyType, legs, dte, management, entryDate } = body;

    if (!symbol || !legs || legs.length === 0 || !entryDate) {
      return NextResponse.json({ error: 'symbol, legs, and entryDate are required' }, { status: 400 });
    }

    const mgmt = (management as BacktestManagement) || {
      profitTargetPercent: 50,
      stopLossPercent: 200,
      exitDte: 21,
    };

    const reqBody = {
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
    };

    const url = `${BACKTESTER_BASE}/backtests/simulate`;
    console.log('[Backtest Simulate] Calling:', url, 'body:', JSON.stringify(reqBody).slice(0, 300));

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': token,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': TT_USER_AGENT,
      },
      body: JSON.stringify(reqBody),
    });

    console.log('[Backtest Simulate] Response status:', resp.status);

    if (!resp.ok) {
      const text = await resp.text();
      console.error('[Backtest Simulate] Failed:', resp.status, text.slice(0, 500));
      return NextResponse.json({ error: 'Simulation failed', details: text.slice(0, 500) }, { status: resp.status });
    }

    const data = await resp.json();
    console.log('[Backtest Simulate] Response body preview:', JSON.stringify(data).slice(0, 500));

    // KILL-7: a backtest that reports $0 where the backtester sent nothing is
    // a FAKE result. Missing fields are null and DECLARED in missing_fields;
    // daily rows without a pnl are EXCLUDED and counted, never $0 rows.
    const entryPrice = numOrNull(data['entry-price']);
    const exitPrice = numOrNull(data['exit-price']);
    const pnl = numOrNull(data['pnl']) ?? numOrNull(data['profit-loss']);
    const pnlPercent = numOrNull(data['pnl-percent']) ?? numOrNull(data['return-percent']);
    const holdingDaysRaw = numOrNull(data['holding-days']) ?? numOrNull(data['days-held']);
    const holdingDays = holdingDaysRaw != null ? Math.trunc(holdingDaysRaw) : null;

    const rawDaily: any[] = Array.isArray(data['daily-pnl']) ? data['daily-pnl'] : [];
    const dailyPnl = rawDaily
      .map((d: any) => ({ date: d['date'], pnl: numOrNull(d['pnl']), underlyingPrice: numOrNull(d['underlying-price']) }))
      .filter((d: any) => d.date && d.pnl != null);
    const dailyRowsExcluded = rawDaily.length - dailyPnl.length;

    const missingFields = [
      entryPrice == null ? 'entry_price' : null,
      exitPrice == null ? 'exit_price' : null,
      pnl == null ? 'pnl' : null,
      pnlPercent == null ? 'pnl_percent' : null,
      holdingDays == null ? 'holding_days' : null,
    ].filter((f): f is string => f != null);

    return NextResponse.json({
      trade: {
        entryDate: data['entry-date'] || entryDate,
        exitDate: data['exit-date'] || '',
        entryPrice,
        exitPrice,
        pnl,
        pnlPercent,
        holdingDays,
        exitReason: data['exit-reason'] || data['close-reason'] || 'expiration',
        dailyPnl,
      },
      // KILL-7 declaration: what the backtester did NOT deliver
      missing_fields: missingFields,
      daily_rows_excluded_missing_pnl: dailyRowsExcluded,
    });

  } catch (error: any) {
    console.error('[Backtest Simulate] Error:', error);
    return NextResponse.json({ error: 'Failed to simulate trade' }, { status: 500 });
  }
}
