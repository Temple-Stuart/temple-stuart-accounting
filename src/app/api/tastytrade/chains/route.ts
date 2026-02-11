import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedClient } from '@/lib/tastytrade';

// Convert OCC symbol (e.g. "SPY   260221P00690000") to DXFeed format (".SPY260221P690")
function occToDxFeed(occ: string): string | null {
  if (!occ || occ.length < 21) return null;
  const root = occ.slice(0, 6).trim();
  const date = occ.slice(6, 12);
  const type = occ.slice(12, 13);
  const strikeRaw = parseInt(occ.slice(13, 21), 10);
  if (isNaN(strikeRaw)) return null;
  const strike = strikeRaw / 1000;
  const strikeStr = strike % 1 === 0 ? String(strike) : String(strike);
  return `.${root}${date}${type}${strikeStr}`;
}

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
          const callOcc: string = s['call'] || '';
          const putOcc: string = s['put'] || '';
          strikes.push({
            strike: Number(s['strike-price'] || 0),
            call: callOcc || null,
            put: putOcc || null,
            callStreamerSymbol: s['call-streamer-symbol'] || occToDxFeed(callOcc),
            putStreamerSymbol: s['put-streamer-symbol'] || occToDxFeed(putOcc),
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
