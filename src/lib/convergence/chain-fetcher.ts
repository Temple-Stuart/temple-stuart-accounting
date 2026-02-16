import { getTastytradeClient } from '@/lib/tastytrade';
import { MarketDataSubscriptionType } from '@tastytrade/api';
import { buildStrikeData, generateStrategies } from '@/lib/strategy-builder';
import type { StrategyCard } from '@/lib/strategy-builder';

// ===== TYPES =====

export interface ChainTickerInput {
  symbol: string;
  suggested_dte: number;
  direction: string;
  currentPrice: number;
  ivRank: number;   // 0-1 scale
  iv30: number;     // decimal e.g. 0.42
  hv30: number;     // decimal e.g. 0.25
}

export interface ChainFetchStats {
  chain_symbols_fetched: number;
  total_trade_cards: number;
  streamer_symbols_subscribed: number;
  greeks_events_received: number;
  elapsed_ms: number;
}

// ===== HELPERS =====

// Convert OCC symbol to DXFeed format (same logic as chains/route.ts)
function occToDxFeed(occ: string): string | null {
  if (!occ || occ.length < 21) return null;
  const root = occ.slice(0, 6).trim();
  const date = occ.slice(6, 12);
  const type = occ.slice(12, 13);
  const strikeRaw = parseInt(occ.slice(13, 21), 10);
  if (isNaN(strikeRaw)) return null;
  const strike = strikeRaw / 1000;
  return `.${root}${date}${type}${strike}`;
}

// ===== MAIN FUNCTION =====

export async function fetchChainAndBuildCards(
  tickers: ChainTickerInput[],
): Promise<{ cards: Map<string, StrategyCard[]>; stats: ChainFetchStats }> {
  const cards = new Map<string, StrategyCard[]>();
  const stats: ChainFetchStats = {
    chain_symbols_fetched: 0,
    total_trade_cards: 0,
    streamer_symbols_subscribed: 0,
    greeks_events_received: 0,
    elapsed_ms: 0,
  };
  const start = Date.now();

  if (tickers.length === 0) {
    stats.elapsed_ms = Date.now() - start;
    return { cards, stats };
  }

  try {
    const client = getTastytradeClient();
    // Force token refresh before API calls
    await client.accountsAndCustomersService.getCustomerResource();

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Per-ticker chain info
    const tickerChains = new Map<string, {
      expiration: string;
      dte: number;
      strikes: Array<{
        strike: number;
        callStreamerSymbol: string;
        putStreamerSymbol: string;
      }>;
    }>();

    // Step 1: Fetch nested option chains for all tickers in parallel
    console.log(`[ChainFetcher] Fetching option chains for ${tickers.length} tickers...`);

    const chainResults = await Promise.allSettled(
      tickers.map(async (ticker) => {
        const chainData = await client.instrumentsService.getNestedOptionChain(ticker.symbol);
        return { symbol: ticker.symbol, chainData, suggested_dte: ticker.suggested_dte };
      }),
    );

    // Collect all streamer symbols across all tickers
    const allStreamerSymbols: string[] = [];

    for (const res of chainResults) {
      if (res.status !== 'fulfilled') {
        const reason = res.reason instanceof Error ? res.reason.message : String(res.reason);
        console.error(`[ChainFetcher] Chain fetch failed:`, reason);
        continue;
      }

      const { symbol, chainData, suggested_dte } = res.value;
      const chainTypes = Array.isArray(chainData) ? chainData : [chainData];

      // Collect all expirations within 15-60 DTE range
      const candidateExps: Array<{ date: string; dte: number; strikes: unknown[] }> = [];
      const seen = new Set<string>();

      for (const chain of chainTypes) {
        const nestedExps = (chain as Record<string, unknown>)['expirations'];
        if (!Array.isArray(nestedExps)) continue;

        for (const exp of nestedExps) {
          const expObj = exp as Record<string, unknown>;
          const expDateStr = (expObj['expiration-date'] as string) || '';
          if (!expDateStr || seen.has(expDateStr)) continue;
          seen.add(expDateStr);

          const expDate = new Date(expDateStr + 'T00:00:00');
          const dte = Math.round((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

          if (dte < 15 || dte > 60) continue;

          candidateExps.push({
            date: expDateStr,
            dte,
            strikes: (expObj['strikes'] as unknown[]) || [],
          });
        }
      }

      if (candidateExps.length === 0) {
        console.warn(`[ChainFetcher] ${symbol}: No expirations in 15-60 DTE range`);
        continue;
      }

      // Find expiration closest to suggested_dte
      candidateExps.sort((a, b) => Math.abs(a.dte - suggested_dte) - Math.abs(b.dte - suggested_dte));
      const bestExp = candidateExps[0];

      // Parse strikes and collect streamer symbols
      const strikes: Array<{
        strike: number;
        callStreamerSymbol: string;
        putStreamerSymbol: string;
      }> = [];

      for (const s of Array.isArray(bestExp.strikes) ? bestExp.strikes : []) {
        const sObj = s as Record<string, unknown>;
        const strikePrice = Number(sObj['strike-price'] || 0);
        if (strikePrice <= 0) continue;

        const callOcc = (sObj['call'] as string) || '';
        const putOcc = (sObj['put'] as string) || '';
        const callStreamer = (sObj['call-streamer-symbol'] as string) || occToDxFeed(callOcc) || '';
        const putStreamer = (sObj['put-streamer-symbol'] as string) || occToDxFeed(putOcc) || '';

        if (!callStreamer && !putStreamer) continue;

        strikes.push({
          strike: strikePrice,
          callStreamerSymbol: callStreamer,
          putStreamerSymbol: putStreamer,
        });

        if (callStreamer) allStreamerSymbols.push(callStreamer);
        if (putStreamer) allStreamerSymbols.push(putStreamer);
      }

      if (strikes.length > 0) {
        tickerChains.set(symbol, {
          expiration: bestExp.date,
          dte: bestExp.dte,
          strikes,
        });
        stats.chain_symbols_fetched++;
        console.log(`[ChainFetcher] ${symbol}: ${bestExp.date} (${bestExp.dte} DTE), ${strikes.length} strikes`);
      }
    }

    if (allStreamerSymbols.length === 0) {
      console.warn('[ChainFetcher] No streamer symbols to subscribe to');
      stats.elapsed_ms = Date.now() - start;
      return { cards, stats };
    }

    stats.streamer_symbols_subscribed = allStreamerSymbols.length;
    console.log(`[ChainFetcher] Subscribing to ${allStreamerSymbols.length} streamer symbols across ${tickerChains.size} tickers...`);

    // Step 2: Open ONE WebSocket and subscribe all streamer symbols for Greeks data
    const greeksData: Record<string, Record<string, unknown>> = {};
    let greeksReceived = 0;

    const removeListener = client.quoteStreamer.addEventListener((events: unknown[]) => {
      for (const evt of events) {
        const evtObj = evt as Record<string, unknown>;
        const sym = (evtObj['eventSymbol'] as string) || '';
        const type = (evtObj['eventType'] as string) || '';
        if (!sym) continue;

        if (!greeksData[sym]) greeksData[sym] = {};

        if (type === 'Greeks') {
          greeksReceived++;
          Object.assign(greeksData[sym], {
            iv: Number(evtObj['volatility'] || 0),
            delta: Number(evtObj['delta'] || 0),
            gamma: Number(evtObj['gamma'] || 0),
            theta: Number(evtObj['theta'] || 0),
            vega: Number(evtObj['vega'] || 0),
            rho: Number(evtObj['rho'] || 0),
            theoPrice: Number(evtObj['price'] || 0),
          });
        } else if (type === 'Quote') {
          Object.assign(greeksData[sym], {
            bid: Number(evtObj['bidPrice'] || 0),
            ask: Number(evtObj['askPrice'] || 0),
            bidSize: Number(evtObj['bidSize'] || 0),
            askSize: Number(evtObj['askSize'] || 0),
          });
        } else if (type === 'Trade') {
          greeksData[sym].volume = Number(evtObj['dayVolume'] || evtObj['volume'] || 0);
        } else if (type === 'Summary') {
          greeksData[sym].openInterest = Number(evtObj['openInterest'] || 0);
        }
      }
    });

    try {
      await client.quoteStreamer.connect();
      console.log(`[ChainFetcher] Streamer connected, subscribing ${allStreamerSymbols.length} symbols`);

      client.quoteStreamer.subscribe(allStreamerSymbols, [
        MarketDataSubscriptionType.Greeks,
        MarketDataSubscriptionType.Quote,
        MarketDataSubscriptionType.Trade,
        MarketDataSubscriptionType.Summary,
      ]);

      // Stability-check loop (same pattern as candle fetcher)
      const deadline = Date.now() + 15000; // 15s total timeout
      let lastCount = 0;
      let stableFor = 0;

      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 500));
        const currentCount = greeksReceived;

        if (currentCount > 0 && currentCount === lastCount) {
          stableFor += 500;
          if (stableFor >= 3000) break; // stable for 3s
        } else {
          stableFor = 0;
        }
        lastCount = currentCount;
      }

      stats.greeks_events_received = greeksReceived;
      console.log(`[ChainFetcher] Received ${greeksReceived} Greeks events, ${Object.keys(greeksData).length} symbols with data`);
    } finally {
      removeListener();
      client.quoteStreamer.disconnect();
    }

    // Step 3: Build trade cards for each ticker
    for (const ticker of tickers) {
      const chain = tickerChains.get(ticker.symbol);
      if (!chain) {
        cards.set(ticker.symbol, []);
        continue;
      }

      try {
        const strikeData = buildStrikeData(chain.strikes, greeksData);
        const generated = generateStrategies({
          strikes: strikeData,
          currentPrice: ticker.currentPrice,
          ivRank: ticker.ivRank,
          expiration: chain.expiration,
          dte: chain.dte,
          symbol: ticker.symbol,
          iv30: ticker.iv30,
          hv30: ticker.hv30,
        });
        cards.set(ticker.symbol, generated);
        stats.total_trade_cards += generated.length;
        console.log(`[ChainFetcher] ${ticker.symbol}: ${generated.length} trade cards generated`);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[ChainFetcher] ${ticker.symbol}: Strategy generation failed:`, msg);
        cards.set(ticker.symbol, []);
      }
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[ChainFetcher] Fatal error:', msg);
    // Return empty map — pipeline continues without trade cards
  }

  stats.elapsed_ms = Date.now() - start;
  console.log(`[ChainFetcher] Complete in ${stats.elapsed_ms}ms: ${stats.chain_symbols_fetched} chains, ${stats.total_trade_cards} cards`);
  return { cards, stats };
}
