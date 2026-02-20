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
    if (symbols.length > 200) {
      return NextResponse.json({ error: 'Maximum 200 symbols per request' }, { status: 400 });
    }

    const client = await getAuthenticatedClient(user.id);
    if (!client) {
      return NextResponse.json({ error: 'Not connected' }, { status: 401 });
    }

    console.log('[Greeks] Received symbols:', symbols.slice(0, 3), `(${symbols.length} total)`);

    const data: Record<string, any> = {};
    const expected = new Set(symbols as string[]);
    let greeksReceived = 0;

    const removeListener = client.quoteStreamer.addEventListener((events) => {
      for (const evt of events) {
        const sym = (evt['eventSymbol'] as string) || '';
        const type = (evt['eventType'] as string) || '';
        if (!expected.has(sym)) continue;

        if (!data[sym]) data[sym] = {};

        if (type === 'Greeks') {
          greeksReceived++;
          Object.assign(data[sym], {
            iv: Number(evt['volatility'] || 0),
            delta: Number(evt['delta'] || 0),
            gamma: Number(evt['gamma'] || 0),
            theta: Number(evt['theta'] || 0),
            vega: Number(evt['vega'] || 0),
            rho: Number(evt['rho'] || 0),
            theoPrice: Number(evt['price'] || 0),
          });
        } else if (type === 'Quote') {
          Object.assign(data[sym], {
            bid: Number(evt['bidPrice'] || 0),
            ask: Number(evt['askPrice'] || 0),
            bidSize: Number(evt['bidSize'] || 0),
            askSize: Number(evt['askSize'] || 0),
          });
        } else if (type === 'Trade') {
          data[sym].volume = Number(evt['dayVolume'] || evt['volume'] || 0);
        } else if (type === 'Summary') {
          data[sym].openInterest = Number(evt['openInterest'] || 0);
        }
      }
    });

    try {
      await client.quoteStreamer.connect();
      console.log('[Greeks] Streamer connected, subscribing to', symbols.length, 'symbols');
      client.quoteStreamer.subscribe(symbols, [
        MarketDataSubscriptionType.Greeks,
        MarketDataSubscriptionType.Quote,
        MarketDataSubscriptionType.Trade,
        MarketDataSubscriptionType.Summary,
      ]);

      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        if (greeksReceived >= symbols.length) break;
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    } finally {
      removeListener();
      client.quoteStreamer.disconnect();
    }

    console.log('[Greeks] Matched:', Object.keys(data).length, 'of', symbols.length, `(${greeksReceived} greeks events)`);
    if (Object.keys(data).length > 0) {
      const firstKey = Object.keys(data)[0];
      console.log('[Greeks] Sample:', firstKey, JSON.stringify(data[firstKey]));
    }

    return NextResponse.json({ greeks: data });
  } catch (error: any) {
    console.error('[Tastytrade] Greeks error:', error);
    return NextResponse.json({ error: 'Failed to fetch greeks' }, { status: 500 });
  }
}
