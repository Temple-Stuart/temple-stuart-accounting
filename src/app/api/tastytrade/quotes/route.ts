import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedClient } from '@/lib/tastytrade';
import { MarketDataSubscriptionType } from '@tastytrade/api';
import { getVerifiedEmail } from '@/lib/cookie-auth';

export async function POST(request: Request) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findFirst({ where: { email: userEmail } });
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
          quotes[sym] = {
            bid: Number(evt['bidPrice'] || 0),
            ask: Number(evt['askPrice'] || 0),
            mid: (Number(evt['bidPrice'] || 0) + Number(evt['askPrice'] || 0)) / 2,
            bidSize: Number(evt['bidSize'] || 0),
            askSize: Number(evt['askSize'] || 0),
          };
        } else if (type === 'Trade' && expected.has(sym.toUpperCase())) {
          if (!quotes[sym]) {
            quotes[sym] = {};
          }
          quotes[sym].last = Number(evt['price'] || 0);
          quotes[sym].volume = Number(evt['dayVolume'] || evt['volume'] || 0);
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
