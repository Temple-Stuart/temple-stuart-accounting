import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedClient } from '@/lib/tastytrade';
import { MarketDataSubscriptionType } from '@tastytrade/api';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { requireAdmin } from '@/lib/require-admin';
import { numOrNull, firstNumOrNull } from '@/lib/parse-num';

export async function POST(request: Request) {
  try {
    // SECURITY-PR-SEC4: TastyTrade uses a SHARED FIRM account (env creds via
    // getTastytradeClient — NOT per-user OAuth; the tastytrade_connections row is
    // just a flag that unlocks the shared session). So any caller spends/reads
    // ALEX'S brokerage. Gate to admin BEFORE any TT call or data read — 403 for
    // non-admins, 401 for guests. (Same requireAdmin pattern as /trading/convergence.)
    const adminGate = await requireAdmin();
    if (adminGate instanceof NextResponse) return adminGate;
    const userEmail = await getVerifiedEmail();
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { symbols } = await request.json();
    if (!Array.isArray(symbols) || symbols.length === 0) {
      return NextResponse.json({ error: 'symbols array is required' }, { status: 400 });
    }
    if (symbols.length > 50) {
      return NextResponse.json({ error: 'Maximum 50 symbols per request' }, { status: 400 });
    }

    const client = await getAuthenticatedClient(user.id);
    if (!client) {
      return NextResponse.json({ error: 'Not connected' }, { status: 401 });
    }

    const quotes: Record<string, any> = {};
    const expected = new Set(symbols.map((s: string) => s.toUpperCase()));

    // Set up event listener before connecting
    const removeListener = client.quoteStreamer.addEventListener((events) => {
      for (const evt of events) {
        const sym = (evt['eventSymbol'] as string) || '';
        const type = (evt['eventType'] as string) || '';
        if (type === 'Quote' && expected.has(sym.toUpperCase())) {
          // KILL-7: absent/unparseable → null, never 0 — and the mid exists
          // only when BOTH sides are live (a one-sided quote used to silently
          // halve the mid). A true source 0 stays 0.
          const bid = numOrNull(evt['bidPrice']);
          const ask = numOrNull(evt['askPrice']);
          quotes[sym] = {
            bid,
            ask,
            mid: bid != null && ask != null ? (bid + ask) / 2 : null,
            bidSize: numOrNull(evt['bidSize']),
            askSize: numOrNull(evt['askSize']),
          };
        } else if (type === 'Trade' && expected.has(sym.toUpperCase())) {
          if (!quotes[sym]) {
            quotes[sym] = {};
          }
          quotes[sym].last = numOrNull(evt['price']);
          quotes[sym].volume = firstNumOrNull(evt['dayVolume'], evt['volume']);
        }
      }
    });

    try {
      await client.quoteStreamer.connect();
      client.quoteStreamer.subscribe(symbols, [
        MarketDataSubscriptionType.Quote,
        MarketDataSubscriptionType.Trade,
      ]);

      // Collect quotes for up to 5 seconds or until all symbols received
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        const received = Object.keys(quotes).length;
        if (received >= symbols.length) break;
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    } finally {
      removeListener();
      client.quoteStreamer.disconnect();
    }

    return NextResponse.json({ quotes });
  } catch (error: any) {
    console.error('[Tastytrade] Quotes error:', error);
    return NextResponse.json({ error: 'Failed to fetch quotes' }, { status: 500 });
  }
}
