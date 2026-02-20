import { NextResponse } from 'next/server';
import { getTastytradeClient } from '@/lib/tastytrade';
import { CandleType } from '@tastytrade/api';
import { getCurrentUser } from '@/lib/auth-helpers';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol') || 'AAPL';
  const days = parseInt(searchParams.get('days') || '90', 10);

  const fromTime = Date.now() - days * 24 * 60 * 60 * 1000;
  const candles: any[] = [];
  let rawEvents: any[] = [];

  try {
    const client = getTastytradeClient();
    // Force token refresh
    await client.accountsAndCustomersService.getCustomerResource();

    const removeListener = client.quoteStreamer.addEventListener((events) => {
      for (const evt of events) {
        const type = (evt['eventType'] as string) || '';
        if (type === 'Candle') {
          rawEvents.push(evt);
          candles.push({
            time: evt['time'],
            date: evt['time'] ? new Date(Number(evt['time'])).toISOString().slice(0, 10) : null,
            open: evt['open'] != null ? Number(evt['open']) : null,
            high: evt['high'] != null ? Number(evt['high']) : null,
            low: evt['low'] != null ? Number(evt['low']) : null,
            close: evt['close'] != null ? Number(evt['close']) : null,
            volume: evt['volume'] != null ? Number(evt['volume']) : null,
            vwap: evt['vwap'] != null ? Number(evt['vwap']) : null,
            count: evt['count'] != null ? Number(evt['count']) : null,
          });
        }
      }
    });

    try {
      await client.quoteStreamer.connect();
      console.log(`[TT Candles] Connected, subscribing to ${symbol} daily candles from ${new Date(fromTime).toISOString()}`);

      client.quoteStreamer.subscribeCandles(symbol, fromTime, 1, CandleType.Day);

      // Wait up to 8s for candle data to arrive
      const deadline = Date.now() + 8000;
      let lastCount = 0;
      let stableFor = 0;
      while (Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 500));
        if (candles.length > 0 && candles.length === lastCount) {
          stableFor += 500;
          // If count is stable for 2s, assume all data arrived
          if (stableFor >= 2000) break;
        } else {
          stableFor = 0;
        }
        lastCount = candles.length;
      }
    } finally {
      removeListener();
      client.quoteStreamer.disconnect();
    }

    // Sort by time ascending
    candles.sort((a, b) => (a.time || 0) - (b.time || 0));

    // Filter out candles with no valid OHLC
    const validCandles = candles.filter(c => c.open != null && c.close != null && c.open > 0);

    const oldestDate = validCandles.length > 0 ? validCandles[0].date : null;
    const newestDate = validCandles.length > 0 ? validCandles[validCandles.length - 1].date : null;

    return NextResponse.json({
      answer: validCandles.length > 0 ? 'YES — Tastytrade provides historical OHLCV candles' : 'NO — No candle data received',
      symbol,
      requestedDays: days,
      fromTime: new Date(fromTime).toISOString(),
      totalCandlesReceived: candles.length,
      validCandles: validCandles.length,
      oldestDate,
      newestDate,
      sampleCandle: validCandles.length > 0 ? validCandles[0] : null,
      latestCandle: validCandles.length > 0 ? validCandles[validCandles.length - 1] : null,
      // First raw event for debugging field names
      rawEventFields: rawEvents.length > 0 ? Object.keys(rawEvents[0]).sort() : [],
      rawEventSample: rawEvents.length > 0 ? rawEvents[0] : null,
    });
  } catch (error: any) {
    return NextResponse.json({
      answer: 'ERROR — Could not test candle subscription',
      symbol,
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 5),
    }, { status: 500 });
  }
}
