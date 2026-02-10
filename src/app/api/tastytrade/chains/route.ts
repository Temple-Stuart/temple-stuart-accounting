import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedClient } from '@/lib/tastytrade';

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

    const body = await request.json();
    const symbol = body.symbol as string;
    if (!symbol) {
      return NextResponse.json({ error: 'symbol is required' }, { status: 400 });
    }

    const dteMin = Number(body.dte_min ?? 0);
    const dteMax = Number(body.dte_max ?? 45);

    const client = await getAuthenticatedClient(user.id);
    if (!client) {
      return NextResponse.json({ error: 'Not connected' }, { status: 401 });
    }

    const chainData = await client.instrumentsService.getNestedOptionChain(symbol);
    const items = Array.isArray(chainData) ? chainData : chainData?.items || [chainData];

    const now = new Date();
    const expirations: any[] = [];

    for (const item of items) {
      const expDateStr = item['expiration-date'] || item['expirationDate'] || '';
      if (!expDateStr) continue;

      const expDate = new Date(expDateStr);
      const dte = Math.round((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (dte < dteMin || dte > dteMax) continue;

      const strikeList = item['strikes'] || item['strike-prices'] || [];
      const strikes: any[] = [];

      for (const s of (Array.isArray(strikeList) ? strikeList : [])) {
        const strikePrice = Number(s['strike-price'] || s['strikePrice'] || 0);
        strikes.push({
          strike: strikePrice,
          call: s['call'] || s['call-option'] || null,
          put: s['put'] || s['put-option'] || null,
        });
      }

      expirations.push({
        date: expDateStr,
        dte,
        strikes,
      });
    }

    // Sort by DTE ascending
    expirations.sort((a, b) => a.dte - b.dte);

    return NextResponse.json({ chain: { symbol, expirations } });
  } catch (error: any) {
    console.error('[Tastytrade] Chains error:', error);
    return NextResponse.json({ error: 'Failed to fetch option chain' }, { status: 500 });
  }
}
