import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedClient } from '@/lib/tastytrade';
import { MarketDataSubscriptionType } from '@tastytrade/api';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { requireTabAccess } from '@/lib/auth-helpers';
import { numOrNull, firstNumOrNull } from '@/lib/parse-num';

export async function POST(request: Request) {
  try {
    // SECURITY-PR-SEC4: TastyTrade uses a SHARED FIRM account (env creds via
    // getTastytradeClient — NOT per-user OAuth; the tastytrade_connections row is
    // just a flag that unlocks the shared session). So any caller spends/reads
    // ALEX'S brokerage session. TRADE-GATE (2026-08-11): market-data reads are
    // entitlement-gated below (tab:trade); the connection itself stays owner-scoped.
    const userEmail = await getVerifiedEmail();
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    // TRADE-GATE: entitlement-gated — the paid tab:trade key (or bundle)
    // unlocks this endpoint; admin passes via hasTabAccess's ADMIN_USER_ID
    // bypass (entitlements.ts:48). Market/pipeline data only — the broker
    // CONNECTION and the shared account's balances/positions stay
    // owner-scoped (see connect/callback + balances/positions routes).
    const tabGate = await requireTabAccess(user.id, 'tab:trade');
    if (tabGate) return tabGate;

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

        // KILL-2: absent/unparseable (incl. DXFeed "NaN") → null, never 0.
        // A true source 0 stays 0.
        if (type === 'Greeks') {
          greeksReceived++;
          Object.assign(data[sym], {
            iv: numOrNull(evt['volatility']),
            delta: numOrNull(evt['delta']),
            gamma: numOrNull(evt['gamma']),
            theta: numOrNull(evt['theta']),
            vega: numOrNull(evt['vega']),
            rho: numOrNull(evt['rho']),
            theoPrice: numOrNull(evt['price']),
          });
        } else if (type === 'Quote') {
          Object.assign(data[sym], {
            bid: numOrNull(evt['bidPrice']),
            ask: numOrNull(evt['askPrice']),
            bidSize: numOrNull(evt['bidSize']),
            askSize: numOrNull(evt['askSize']),
          });
        } else if (type === 'Trade') {
          data[sym].volume = firstNumOrNull(evt['dayVolume'], evt['volume']);
        } else if (type === 'Summary') {
          data[sym].openInterest = numOrNull(evt['openInterest']);
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
