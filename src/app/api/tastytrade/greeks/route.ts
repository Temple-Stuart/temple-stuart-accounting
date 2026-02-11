import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedClient } from '@/lib/tastytrade';
import { MarketDataSubscriptionType } from '@tastytrade/api';

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

    const { symbols } = await request.json();
    if (!Array.isArray(symbols) || symbols.length === 0) {
      return NextResponse.json({ error: 'symbols array is required' }, { status: 400 });
    }
    if (symbols.length > 100) {
      return NextResponse.json({ error: 'Maximum 100 symbols per request' }, { status: 400 });
    }

    const client = await getAuthenticatedClient(user.id);
    if (!client) {
      return NextResponse.json({ error: 'Not connected' }, { status: 401 });
    }

    const greeks: Record<string, any> = {};
    const expected = new Set(symbols as string[]);

    const removeListener = client.quoteStreamer.addEventListener((events) => {
      for (const evt of events) {
        const sym = (evt['eventSymbol'] as string) || '';
        const type = (evt['eventType'] as string) || '';
        if (type === 'Greeks' && expected.has(sym)) {
          greeks[sym] = {
            iv: Number(evt['volatility'] || 0),
            delta: Number(evt['delta'] || 0),
            gamma: Number(evt['gamma'] || 0),
            theta: Number(evt['theta'] || 0),
            vega: Number(evt['vega'] || 0),
          };
        }
      }
    });

    try {
      await client.quoteStreamer.connect();
      client.quoteStreamer.subscribe(symbols, [MarketDataSubscriptionType.Greeks]);

      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        if (Object.keys(greeks).length >= symbols.length) break;
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    } finally {
      removeListener();
      client.quoteStreamer.disconnect();
    }

    return NextResponse.json({ greeks });
  } catch (error: any) {
    console.error('[Tastytrade] Greeks error:', error);
    return NextResponse.json({ error: 'Failed to fetch greeks' }, { status: 500 });
  }
}
