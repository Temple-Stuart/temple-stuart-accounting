import { NextResponse } from 'next/server';
import { getTastytradeSessionToken } from '@/lib/tastytrade';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { requireTabAccess } from '@/lib/auth-helpers';

export async function GET(request: Request) {
  try {
    // SECURITY (PR-Trade-SEC): PAID TastyTrade backtester — gate to admin/owner BEFORE any
    // session token / paid call, mirroring /api/trading/convergence (route.ts:51-52).
    // TRADE-GATE: entitlement-gated (was requireAdmin) — login, then the
    // paid tab:trade key; admin passes via hasTabAccess's ADMIN_USER_ID
    // bypass (entitlements.ts:48).
    const userEmail = await getVerifiedEmail();
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const tabGate = await requireTabAccess(user.id, 'tab:trade');
    if (tabGate) return tabGate;

    const token = await getTastytradeSessionToken();

    const resp = await fetch('https://backtester.vast.tastyworks.com/available-dates', {
      method: 'GET',
      headers: {
        'Authorization': token,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'TempleStuart/1.0',
      },
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.log('[Backtest] available-dates failed:', resp.status, text.slice(0, 200));
      return NextResponse.json({ error: 'Backtester request failed', status: resp.status }, { status: resp.status });
    }

    const data = await resp.json();
    const url = new URL(request.url);
    const symbol = url.searchParams.get('symbol')?.toUpperCase();

    if (symbol && Array.isArray(data)) {
      const entry = data.find((d: any) => d.symbol === symbol);
      if (entry) {
        return NextResponse.json({ available: true, ...entry });
      }
      return NextResponse.json({ available: false, symbol });
    }

    return NextResponse.json({ available: true, data });
  } catch (e: any) {
    console.error('[Backtest] Error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
