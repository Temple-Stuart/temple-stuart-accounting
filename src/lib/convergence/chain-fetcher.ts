import { getTastytradeClient } from '@/lib/tastytrade';
import { MarketDataSubscriptionType } from '@tastytrade/api';
import { buildStrikeData, generateStrategies } from '@/lib/strategy-builder';
import type { StrategyCard, RejectionReason, StrikeData } from '@/lib/strategy-builder';
import type { OptionsFlowData, OptionsChainExpiration, OptionsChainStrike } from './types';

// ===== TYPES =====

export interface ChainTickerInput {
  symbol: string;
  suggested_dte: number;
  direction: string;
  currentPrice: number;
  ivRank: number;        // 0-1 scale
  iv30: number;          // decimal e.g. 0.42
  hv30: number;          // decimal e.g. 0.25
  // Risk-free rate from FRED FEDFUNDS series, converted to decimal. Required — no default.
  riskFreeRate: number;
}

export interface ChainFetchStats {
  chain_symbols_fetched: number;
  total_trade_cards: number;
  streamer_symbols_subscribed: number;
  greeks_events_received: number;
  elapsed_ms: number;
}

export interface PerTickerChainStats {
  expiration: string;
  dte: number;
  strikeCount: number;
  priceSource: 'live' | 'theo' | 'mixed' | 'none';
  strategiesBuilt: number;
  gateAFailed: number;
  gateBFailed: number;
  gateCFailed: number;
  strategiesPassed: number;
  winner: string | null;
  winnerScore: number | null;
  expirationsEvaluated: number;
  allExpirations: Array<{
    expiration: string;
    dte: number;
    strikeCount: number;
    strategiesBuilt: number;
    bestScore: number | null;
  }>;
  winningExpiration: string;
  winningDte: number;
}

export interface ChainFetchResult {
  cards: Map<string, StrategyCard[]>;
  rejections: Map<string, RejectionReason[]>;
  stats: ChainFetchStats;
  perTickerStats: Map<string, PerTickerChainStats>;
  marketOpen: boolean;
  marketNote?: string;
  optionsFlowMap: Map<string, OptionsFlowData>;
}

// ===== HELPERS =====

export function isMarketOpen(): { open: boolean; reason?: string } {
  const now = new Date();
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = et.getDay();
  const hour = et.getHours();
  const minute = et.getMinutes();
  const timeNum = hour * 100 + minute;

  if (day === 0 || day === 6) return { open: false, reason: 'weekend' };

  const holidays2026 = [
    '2026-01-01','2026-01-19','2026-02-16','2026-04-03',
    '2026-05-25','2026-07-03','2026-09-07','2026-11-26','2026-12-25',
  ];
  const dateStr = et.toISOString().slice(0, 10);
  if (holidays2026.includes(dateStr)) return { open: false, reason: `market holiday (${dateStr})` };
  if (timeNum < 930 || timeNum >= 1600) return { open: false, reason: `outside market hours (${hour}:${String(minute).padStart(2, '0')} ET)` };

  return { open: true };
}

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
): Promise<ChainFetchResult> {
  const cards = new Map<string, StrategyCard[]>();
  const rejections = new Map<string, RejectionReason[]>();
  const perTickerStats = new Map<string, PerTickerChainStats>();
  const optionsFlowMap = new Map<string, OptionsFlowData>();
  const stats: ChainFetchStats = {
    chain_symbols_fetched: 0,
    total_trade_cards: 0,
    streamer_symbols_subscribed: 0,
    greeks_events_received: 0,
    elapsed_ms: 0,
  };
  const start = Date.now();

  const market = isMarketOpen();
  const marketOpen = market.open;
  const marketNote = market.reason;
  if (!marketOpen) {
    console.log(`[ChainFetcher] Market closed: ${marketNote}. Will use exchange theo prices where available.`);
  }

  if (tickers.length === 0) {
    stats.elapsed_ms = Date.now() - start;
    return { cards, rejections, stats, perTickerStats, marketOpen, marketNote, optionsFlowMap };
  }

  try {
    const client = getTastytradeClient();
    // Force token refresh before API calls
    await client.accountsAndCustomersService.getCustomerResource();

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Per-ticker chain info — stores ALL expirations per ticker (15-60 DTE)
    type ParsedStrike = {
      strike: number;
      callStreamerSymbol: string;
      putStreamerSymbol: string;
    };
    const tickerChains = new Map<string, Array<{
      expiration: string;
      dte: number;
      strikes: ParsedStrike[];
    }>>();

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

      // Parse strikes for ALL candidate expirations and collect streamer symbols
      const allExpEntries: Array<{ expiration: string; dte: number; strikes: ParsedStrike[] }> = [];

      for (const exp of candidateExps) {
        const strikes: ParsedStrike[] = [];

        for (const s of Array.isArray(exp.strikes) ? exp.strikes : []) {
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
          allExpEntries.push({ expiration: exp.date, dte: exp.dte, strikes });
        }
      }

      if (allExpEntries.length > 0) {
        tickerChains.set(symbol, allExpEntries);
        stats.chain_symbols_fetched++;
        const totalStrikes = allExpEntries.reduce((s, e) => s + e.strikes.length, 0);
        console.log(`[ChainFetcher] ${symbol}: ${allExpEntries.length} expirations (${allExpEntries.map(e => `${e.expiration}/${e.dte}d`).join(', ')}), ${totalStrikes} total strikes`);
      }
    }

    if (allStreamerSymbols.length === 0) {
      console.warn('[ChainFetcher] No streamer symbols to subscribe to');
      stats.elapsed_ms = Date.now() - start;
      return { cards, rejections, stats, perTickerStats, marketOpen, marketNote, optionsFlowMap };
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

    // Step 3: Build trade cards for each ticker — evaluate ALL expirations, pick best composite score
    for (const ticker of tickers) {
      const expirations = tickerChains.get(ticker.symbol);
      if (!expirations || expirations.length === 0) {
        cards.set(ticker.symbol, []);
        continue;
      }

      try {
        let bestStrategies: StrategyCard[] = [];
        let bestRejections: RejectionReason[] = [];
        let bestCompositeScore = -Infinity;
        let winningExp = expirations[0];
        let winningDominantSource: StrikeData['priceSource'] = 'none';
        let winningStrikeCount = 0;

        const allExpStats: Array<{
          expiration: string;
          dte: number;
          strikeCount: number;
          strategiesBuilt: number;
          bestScore: number | null;
        }> = [];

        for (const exp of expirations) {
          const strikeData = buildStrikeData(exp.strikes, greeksData);

          const result = generateStrategies({
            strikes: strikeData,
            currentPrice: ticker.currentPrice,
            ivRank: ticker.ivRank,
            expiration: exp.expiration,
            dte: exp.dte,
            symbol: ticker.symbol,
            iv30: ticker.iv30,
            hv30: ticker.hv30,
            riskFreeRate: ticker.riskFreeRate,
          });

          const topScore = result.strategies[0]?.compositeScore ?? null;

          allExpStats.push({
            expiration: exp.expiration,
            dte: exp.dte,
            strikeCount: strikeData.length,
            strategiesBuilt: result.strategies.length + result.rejections.length,
            bestScore: topScore,
          });

          if (topScore !== null && topScore > bestCompositeScore) {
            bestCompositeScore = topScore;
            bestStrategies = result.strategies;
            bestRejections = result.rejections;
            winningExp = exp;
            winningStrikeCount = strikeData.length;

            // Determine dominant price source for winning expiration
            const sourceCounts: Record<string, number> = {};
            for (const s of strikeData) {
              sourceCounts[s.priceSource] = (sourceCounts[s.priceSource] || 0) + 1;
            }
            winningDominantSource = (Object.entries(sourceCounts)
              .sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'none') as StrikeData['priceSource'];
          }
        }

        // Fallback: if no strategies passed any gate, populate winner fields from first real expiration
        if (winningStrikeCount === 0 && allExpStats.length > 0) {
          const firstReal = allExpStats.find(e => e.strikeCount > 0);
          if (firstReal) {
            winningExp = expirations.find(e => e.expiration === firstReal.expiration) ?? expirations[0];
            winningStrikeCount = firstReal.strikeCount;

            // Recompute dominant price source from that expiration's strikeData
            const expChain = tickerChains.get(ticker.symbol)?.find(e => e.expiration === firstReal.expiration);
            if (expChain) {
              const sd = buildStrikeData(expChain.strikes, greeksData);
              const counts: Record<string, number> = {};
              for (const s of sd) {
                counts[s.priceSource] = (counts[s.priceSource] || 0) + 1;
              }
              winningDominantSource = (Object.entries(counts)
                .sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'none') as StrikeData['priceSource'];
            }
          }
        }

        cards.set(ticker.symbol, bestStrategies);
        if (bestRejections.length > 0) {
          rejections.set(ticker.symbol, bestRejections);
        }
        stats.total_trade_cards += bestStrategies.length;

        // Collect per-ticker stats with multi-expiration info
        perTickerStats.set(ticker.symbol, {
          expiration: winningExp.expiration,
          dte: winningExp.dte,
          strikeCount: winningStrikeCount,
          priceSource: winningDominantSource,
          strategiesBuilt: bestStrategies.length + bestRejections.length,
          gateAFailed: bestRejections.filter(r => r.gate === 'A').length,
          gateBFailed: bestRejections.filter(r => r.gate === 'B').length,
          gateCFailed: bestRejections.filter(r => r.gate === 'C').length,
          strategiesPassed: bestStrategies.length,
          winner: bestStrategies[0]?.name ?? null,
          winnerScore: bestStrategies[0]?.compositeScore ?? null,
          expirationsEvaluated: expirations.length,
          allExpirations: allExpStats,
          winningExpiration: winningExp.expiration,
          winningDte: winningExp.dte,
        });

        console.log(`[ChainFetcher] ${ticker.symbol}: evaluated ${expirations.length} expirations, winner=${winningExp.expiration} (${winningExp.dte} DTE, score=${bestCompositeScore.toFixed(2)}), ${bestStrategies.length} cards, ${bestRejections.length} rejections`);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[ChainFetcher] ${ticker.symbol}: Strategy generation failed:`, msg);
        cards.set(ticker.symbol, []);
      }
    }

    // Step 4: Compute OptionsFlowData per ticker from streamer data
    for (const ticker of tickers) {
      const expirations = tickerChains.get(ticker.symbol);
      if (!expirations || expirations.length === 0) continue;

      const chainDetail: OptionsChainExpiration[] = [];
      let totalCallVolume = 0;
      let totalPutVolume = 0;
      let totalCallOI = 0;
      let totalPutOI = 0;
      let strikesAnalyzed = 0;
      let highActivityStrikes = 0;

      for (const exp of expirations) {
        const strikes: OptionsChainStrike[] = [];

        for (const s of exp.strikes) {
          const callData = greeksData[s.callStreamerSymbol] || {};
          const putData = greeksData[s.putStreamerSymbol] || {};

          const callIV = callData.iv != null && Number(callData.iv) > 0 ? Number(callData.iv) : null;
          const putIV = putData.iv != null && Number(putData.iv) > 0 ? Number(putData.iv) : null;
          const callVolume = Number(callData.volume || 0);
          const putVolume = Number(putData.volume || 0);
          const callOI = Number(callData.openInterest || 0);
          const putOI = Number(putData.openInterest || 0);

          strikes.push({
            strike: s.strike,
            callIV,
            putIV,
            callOI,
            putOI,
            callVolume,
            putVolume,
          });

          totalCallVolume += callVolume;
          totalPutVolume += putVolume;
          totalCallOI += callOI;
          totalPutOI += putOI;
          strikesAnalyzed++;

          // High activity: volume exceeds open interest (unusual activity signal)
          if ((callVolume + putVolume) > (callOI + putOI) && (callOI + putOI) > 0) {
            highActivityStrikes++;
          }
        }

        chainDetail.push({
          expirationDate: exp.expiration,
          dte: exp.dte,
          strikes,
        });
      }

      const totalVolume = totalCallVolume + totalPutVolume;
      const totalOI = totalCallOI + totalPutOI;

      const flowData: OptionsFlowData = {
        put_call_ratio: totalCallVolume > 0 ? totalPutVolume / totalCallVolume : null,
        volume_bias: totalVolume > 0 ? (totalCallVolume - totalPutVolume) / totalVolume : null,
        unusual_activity_ratio: totalOI > 0 ? totalVolume / totalOI : null,
        total_call_volume: totalCallVolume,
        total_put_volume: totalPutVolume,
        total_call_oi: totalCallOI,
        total_put_oi: totalPutOI,
        strikes_analyzed: strikesAnalyzed,
        high_activity_strikes: highActivityStrikes,
        expirations_analyzed: expirations.length,
        underlyingPrice: ticker.currentPrice,
        chainDetail,
      };

      optionsFlowMap.set(ticker.symbol, flowData);
    }

    console.log(`[ChainFetcher] Computed OptionsFlowData for ${optionsFlowMap.size} tickers`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[ChainFetcher] Fatal error:', msg);
    // Return empty map — pipeline continues without trade cards
    stats.elapsed_ms = Date.now() - start;
    return { cards, rejections, stats, perTickerStats, marketOpen, marketNote, optionsFlowMap };
  }

  stats.elapsed_ms = Date.now() - start;
  console.log(`[ChainFetcher] Complete in ${stats.elapsed_ms}ms: ${stats.chain_symbols_fetched} chains, ${stats.total_trade_cards} cards`);
  return { cards, rejections, stats, perTickerStats, marketOpen, marketNote, optionsFlowMap };
}
