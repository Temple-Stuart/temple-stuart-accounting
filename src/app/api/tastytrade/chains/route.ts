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
    // chainData is an array of chain-type objects (Standard, Weekly, etc.)
    // Each has an `expirations` array with the actual expiration entries.
    const chainTypes = Array.isArray(chainData) ? chainData : [chainData];

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const expirations: any[] = [];
    const seen = new Set<string>();

    for (const chain of chainTypes) {
      const nestedExpirations = chain['expirations'] || [];

      for (const exp of nestedExpirations) {
        const expDateStr: string = exp['expiration-date'] || '';
        if (!expDateStr) continue;

        // Avoid duplicates when the same expiration appears in multiple chain types
        if (seen.has(expDateStr)) continue;

        const expDate = new Date(expDateStr + 'T00:00:00');
        const dte = Math.round((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (dte < dteMin || dte > dteMax) continue;
        seen.add(expDateStr);

        const strikeList = exp['strikes'] || [];
        const strikes: any[] = [];

        for (const s of (Array.isArray(strikeList) ? strikeList : [])) {
          strikes.push({
            strike: Number(s['strike-price'] || 0),
            call: s['call'] || null,
            put: s['put'] || null,
          });
        }

        expirations.push({
          date: expDateStr,
          dte,
          strikes,
        });
      }
    }

    // Sort by DTE ascending
    expirations.sort((a, b) => a.dte - b.dte);

    return NextResponse.json({ chain: { symbol, expirations } });
  } catch (error: any) {
    console.error('[Tastytrade] Chains error:', error);
    return NextResponse.json({ error: 'Failed to fetch option chain' }, { status: 500 });
  }
}
