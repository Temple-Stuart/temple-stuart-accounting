import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTastytradeClient } from '@/lib/tastytrade';
import { CandleType } from '@tastytrade/api';
import { scoreAll } from '@/lib/convergence/composite';
import { fetchFredMacro, fetchAnnualFinancials, fetchOptionsFlow, fetchNewsSentiment, fetchFinnhubTicker, type FinnhubData } from '@/lib/convergence/data-fetchers';
import { fetchChainAndBuildCards } from '@/lib/convergence/chain-fetcher';
import type { ChainTickerInput } from '@/lib/convergence/chain-fetcher';
import { generateTradeCards } from '@/lib/convergence/trade-cards';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import type {
  CandleData,
  TTScannerData,
  FredMacroData,
  ConvergenceInput,
  ConvergenceResponse,
  TradeCard,
} from '@/lib/convergence/types';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// ===== DATA FETCHERS =====

async function fetchTTScanner(symbol: string): Promise<{ data: TTScannerData | null; raw: Record<string, unknown> | null; error: string | null }> {
  try {
    const client = getTastytradeClient();
    await client.accountsAndCustomersService.getCustomerResource();

    const raw = await client.marketMetricsService.getMarketMetrics({ symbols: symbol });
    const items = Array.isArray(raw) ? raw : [];
    if (items.length === 0) return { data: null, raw: null, error: 'No items returned' };

    const m = items[0] as Record<string, unknown>;

    const earningsDate = (m['earnings'] as Record<string, unknown>)?.['expected-report-date'] as string
      || m['next-earnings-date'] as string
      || null;
    let daysTillEarnings: number | null = null;
    if (earningsDate) {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      daysTillEarnings = Math.round((new Date(earningsDate + 'T00:00:00').getTime() - now.getTime()) / 86400000);
    }

    const data: TTScannerData = {
      symbol: (m['symbol'] as string) || symbol,
      ivRank: Number(m['implied-volatility-index-rank'] || m['tos-implied-volatility-index-rank'] || m['tw-implied-volatility-index-rank'] || 0),
      ivPercentile: Number(m['implied-volatility-percentile'] || 0),
      impliedVolatility: Number(m['implied-volatility-index'] || 0),
      liquidityRating: m['liquidity-rating'] != null ? Number(m['liquidity-rating']) : null,
      earningsDate,
      daysTillEarnings,
      hv30: m['historical-volatility-30-day'] != null ? parseFloat(String(m['historical-volatility-30-day'])) : null,
      hv60: m['historical-volatility-60-day'] != null ? parseFloat(String(m['historical-volatility-60-day'])) : null,
      hv90: m['historical-volatility-90-day'] != null ? parseFloat(String(m['historical-volatility-90-day'])) : null,
      iv30: m['implied-volatility-30-day'] != null ? parseFloat(String(m['implied-volatility-30-day'])) : null,
      ivHvSpread: m['iv-hv-30-day-difference'] != null ? parseFloat(String(m['iv-hv-30-day-difference'])) : null,
      beta: m['beta'] != null ? parseFloat(String(m['beta'])) : null,
      corrSpy: m['corr-spy-3month'] != null ? parseFloat(String(m['corr-spy-3month'])) : null,
      marketCap: m['market-cap'] != null ? Number(m['market-cap']) : null,
      sector: (m['sector'] as string) || null,
      industry: (m['industry'] as string) || null,
      peRatio: m['price-earnings-ratio'] != null ? parseFloat(String(m['price-earnings-ratio'])) : null,
      eps: m['earnings-per-share'] != null ? parseFloat(String(m['earnings-per-share'])) : null,
      dividendYield: m['dividend-yield'] != null ? parseFloat(String(m['dividend-yield'])) : null,
      lendability: (m['lendability'] as string) || null,
      borrowRate: m['borrow-rate'] != null ? parseFloat(String(m['borrow-rate'])) : null,
      earningsActualEps: (m['earnings'] as Record<string, unknown>)?.['actual-eps'] != null
        ? parseFloat(String((m['earnings'] as Record<string, unknown>)['actual-eps']))
        : null,
      earningsEstimate: (m['earnings'] as Record<string, unknown>)?.['consensus-estimate'] != null
        ? parseFloat(String((m['earnings'] as Record<string, unknown>)['consensus-estimate']))
        : null,
      earningsTimeOfDay: ((m['earnings'] as Record<string, unknown>)?.['time-of-day'] as string) || null,
      termStructure: ((m['option-expiration-implied-volatilities'] as Array<Record<string, unknown>>) || [])
        .filter((e) => e['implied-volatility'])
        .map((e) => ({
          date: String(e['expiration-date']),
          iv: parseFloat(String(e['implied-volatility'])),
        })),
    };

    return { data, raw: m, error: null };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { data: null, raw: null, error: msg };
  }
}

async function fetchTTCandles(symbol: string, days: number): Promise<{ candles: CandleData[]; error: string | null }> {
  const fromTime = Date.now() - days * 24 * 60 * 60 * 1000;
  const candles: CandleData[] = [];

  try {
    const client = getTastytradeClient();
    await client.accountsAndCustomersService.getCustomerResource();

    const removeListener = client.quoteStreamer.addEventListener((events) => {
      for (const evt of events) {
        const type = (evt['eventType'] as string) || '';
        if (type === 'Candle') {
          const time = Number(evt['time'] || 0);
          const open = evt['open'] != null ? Number(evt['open']) : 0;
          const close = evt['close'] != null ? Number(evt['close']) : 0;
          if (open > 0 && close > 0) {
            candles.push({
              time,
              date: new Date(time).toISOString().slice(0, 10),
              open,
              high: evt['high'] != null ? Number(evt['high']) : open,
              low: evt['low'] != null ? Number(evt['low']) : open,
              close,
              volume: evt['volume'] != null ? Number(evt['volume']) : 0,
            });
          }
        }
      }
    });

    try {
      await client.quoteStreamer.connect();
      client.quoteStreamer.subscribeCandles(symbol, fromTime, 1, CandleType.Day);

      const deadline = Date.now() + 8000;
      let lastCount = 0;
      let stableFor = 0;
      while (Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 500));
        if (candles.length > 0 && candles.length === lastCount) {
          stableFor += 500;
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

    candles.sort((a, b) => a.time - b.time);
    return { candles, error: null };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { candles: [], error: msg };
  }
}


// ===== MAIN ROUTE =====

export async function GET(request: Request) {
  const userEmail = await getVerifiedEmail();
  if (!userEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const user = await prisma.users.findFirst({
    where: { email: { equals: userEmail, mode: 'insensitive' } }
  });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const pipelineStart = Date.now();
  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get('symbol') || 'AAPL').toUpperCase();

  const finnhubKey = process.env.FINNHUB_API_KEY;
  const fredKey = process.env.FRED_API_KEY;

  const fetchErrors: Record<string, string> = {};

  // ===== PARALLEL DATA FETCHING =====
  // TT candles take 5-8s via WebSocket — start first
  // All other fetches run in parallel

  const [
    ttScannerResult,
    ttCandleResult,
    finnhubResult,
    fredResult,
    annualFinancialsResult,
    optionsFlowResult,
    newsSentimentResult,
  ] = await Promise.all([
    fetchTTScanner(symbol).catch(e => {
      fetchErrors.tt_scanner = e instanceof Error ? e.message : String(e);
      return { data: null, raw: null, error: String(e) } as Awaited<ReturnType<typeof fetchTTScanner>>;
    }),
    fetchTTCandles(symbol, 120).catch(e => {
      fetchErrors.tt_candles = e instanceof Error ? e.message : String(e);
      return { candles: [] as CandleData[], error: String(e) };
    }),
    fetchFinnhubTicker(symbol, finnhubKey || undefined).catch((e): FinnhubData => {
      fetchErrors.finnhub = e instanceof Error ? e.message : String(e);
      return { fundamentals: null, recommendations: [], insiderSentiment: [], earnings: [], estimateData: null };
    }),
    fredKey
      ? fetchFredMacro(fredKey).catch(e => ({
          data: { vix: null, treasury10y: null, fedFunds: null, unemployment: null, cpi: null, gdp: null, consumerConfidence: null, nonfarmPayrolls: null, cpiMom: null, yieldCurveSpread: null, breakeven5y: null, hySpread: null, nfci: null, initialClaims: null, initialClaimsDate: null, nfciDate: null } as FredMacroData,
          cached: false,
          error: String(e),
        }))
      : Promise.resolve({
          data: { vix: null, treasury10y: null, fedFunds: null, unemployment: null, cpi: null, gdp: null, consumerConfidence: null, nonfarmPayrolls: null, cpiMom: null, yieldCurveSpread: null, breakeven5y: null, hySpread: null, nfci: null, initialClaims: null, initialClaimsDate: null, nfciDate: null } as FredMacroData,
          cached: false,
          error: 'FRED_API_KEY not configured',
        }),
    finnhubKey
      ? fetchAnnualFinancials(symbol, finnhubKey).catch(e => ({ data: null, error: String(e) }))
      : Promise.resolve({ data: null, error: 'FINNHUB_API_KEY not configured' }),
    finnhubKey
      ? delay(200).then(() => fetchOptionsFlow(symbol, finnhubKey)).catch(e => ({ data: null, error: String(e) }))
      : Promise.resolve({ data: null, error: 'FINNHUB_API_KEY not configured' }),
    finnhubKey
      ? delay(400).then(() => fetchNewsSentiment(symbol, finnhubKey)).catch(e => ({ data: null, error: String(e) }))
      : Promise.resolve({ data: null, error: 'FINNHUB_API_KEY not configured' }),
  ]);

  // Collect fetch errors (Finnhub per-endpoint errors logged internally by fetchFinnhubTicker)
  if (ttScannerResult.error) fetchErrors.tt_scanner = ttScannerResult.error;
  if (ttCandleResult.error) fetchErrors.tt_candles = ttCandleResult.error;
  if (fredResult.error) fetchErrors.fred_macro = fredResult.error;
  if (annualFinancialsResult.error) fetchErrors.annual_financials = annualFinancialsResult.error;
  if (optionsFlowResult.error) fetchErrors.options_flow = optionsFlowResult.error;
  if (newsSentimentResult.error) fetchErrors.news_sentiment = newsSentimentResult.error;

  // ===== ASSEMBLE INPUT =====
  const convergenceInput: ConvergenceInput = {
    symbol,
    ttScanner: ttScannerResult.data,
    candles: ttCandleResult.candles,
    finnhubFundamentals: finnhubResult.fundamentals,
    finnhubRecommendations: finnhubResult.recommendations,
    finnhubInsiderSentiment: finnhubResult.insiderSentiment,
    finnhubEarnings: finnhubResult.earnings,
    finnhubEstimates: finnhubResult.estimateData,
    fredMacro: fredResult.data,
    annualFinancials: annualFinancialsResult.data,
    optionsFlow: optionsFlowResult.data,
    newsSentiment: newsSentimentResult.data,
    finnhubNewsSentiment: null, // Single-ticker route: FinBERT fetched separately in pipeline batch mode
  };

  // ===== RUN SCORING =====
  const scoringResult = scoreAll(convergenceInput);

  // ===== FETCH CHAIN & BUILD TRADE CARDS =====
  let tradeCards: TradeCard[] = [];
  let chainStats: Record<string, unknown> | null = null;
  let chainRejections: unknown[] = [];

  // Derive current price from latest candle
  const latestCandle = ttCandleResult.candles.length > 0
    ? ttCandleResult.candles[ttCandleResult.candles.length - 1]
    : null;
  const currentPrice = latestCandle?.close ?? 0;

  if (currentPrice > 0 && ttScannerResult.data) {
    try {
      // TT scanner returns iv30/hv30 as percentages (e.g. 27.16 for 27.16%)
      // Chain fetcher / strategy builder expects decimals (e.g. 0.2716)
      const rawIv30 = ttScannerResult.data.iv30 ?? 30;
      const rawHv30 = ttScannerResult.data.hv30 ?? 25;
      const chainInput: ChainTickerInput[] = [{
        symbol,
        suggested_dte: scoringResult.strategy_suggestion.suggested_dte,
        direction: scoringResult.composite.direction,
        currentPrice,
        ivRank: ttScannerResult.data.ivRank,
        iv30: rawIv30 / 100,
        hv30: rawHv30 / 100,
      }];

      const chainResult = await fetchChainAndBuildCards(chainInput);
      const strategyCards = chainResult.cards.get(symbol) || [];
      chainRejections = chainResult.rejections.get(symbol) || [];

      chainStats = {
        chain_symbols_fetched: chainResult.stats.chain_symbols_fetched,
        total_strategy_cards: chainResult.stats.total_trade_cards,
        streamer_symbols_subscribed: chainResult.stats.streamer_symbols_subscribed,
        greeks_events_received: chainResult.stats.greeks_events_received,
        chain_elapsed_ms: chainResult.stats.elapsed_ms,
        market_open: chainResult.marketOpen,
        market_note: chainResult.marketNote ?? null,
      };

      if (strategyCards.length > 0) {
        tradeCards = generateTradeCards(strategyCards, scoringResult, convergenceInput);
        scoringResult.strategy_suggestion.full_trade_cards = tradeCards;
        console.log(`[TestRoute] Generated ${tradeCards.length} trade cards for ${symbol}`);
      } else {
        console.log(`[TestRoute] No strategy cards generated for ${symbol} (chain fetch returned 0 cards)`);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      fetchErrors.chain_fetch = msg;
      console.error(`[TestRoute] Chain fetch failed for ${symbol}:`, msg);
    }
  } else {
    if (currentPrice <= 0) fetchErrors.chain_fetch = 'No candle data available for current price';
    if (!ttScannerResult.data) fetchErrors.chain_fetch = 'No TT scanner data for IV/HV parameters';
  }

  const pipelineMs = Date.now() - pipelineStart;

  // ===== BUILD RESPONSE =====
  const candles = ttCandleResult.candles;
  const latestRec = finnhubResult.recommendations.length > 0 ? finnhubResult.recommendations[0] : null;
  const latestEarnings = finnhubResult.earnings.length > 0 ? finnhubResult.earnings[0] : null;
  const insiderSorted = [...finnhubResult.insiderSentiment].sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });
  const latestMspr = insiderSorted.length > 0 ? insiderSorted[0].mspr : null;

  // Build sample fields from Finnhub fundamentals (first 15 fields)
  const sampleFields: Record<string, number | string | null> = {};
  if (finnhubResult.fundamentals) {
    const keys = Object.keys(finnhubResult.fundamentals.metric).slice(0, 15);
    for (const k of keys) {
      sampleFields[k] = finnhubResult.fundamentals.metric[k];
    }
  }

  const response: ConvergenceResponse = {
    symbol,
    timestamp: new Date().toISOString(),
    pipeline_runtime_ms: pipelineMs,
    raw_data: {
      tastytrade_scanner: ttScannerResult.data,
      tastytrade_candles: {
        count: candles.length,
        oldest: candles.length > 0 ? candles[0].date : null,
        newest: candles.length > 0 ? candles[candles.length - 1].date : null,
        sample: candles.length > 0 ? candles[candles.length - 1] : null,
      },
      finnhub_fundamentals: finnhubResult.fundamentals
        ? { field_count: finnhubResult.fundamentals.fieldCount, sample_fields: sampleFields }
        : null,
      finnhub_recommendations: {
        latest: latestRec,
        history_count: finnhubResult.recommendations.length,
      },
      finnhub_insider_sentiment: {
        latest_mspr: latestMspr,
        months_available: finnhubResult.insiderSentiment.length,
      },
      finnhub_earnings: {
        latest: latestEarnings,
        quarters_available: finnhubResult.earnings.length,
      },
      fred_macro: fredResult.data,
    },
    scores: {
      vol_edge: scoringResult.vol_edge,
      quality: scoringResult.quality,
      regime: scoringResult.regime,
      info_edge: scoringResult.info_edge,
      composite: scoringResult.composite,
    },
    strategy_suggestion: scoringResult.strategy_suggestion,
    data_gaps: scoringResult.data_gaps,
  };

  // DEBUG: Dump Finnhub metric fields matching ROIC/EV-EBITDA/P-S substrings
  const debugFinnhubFields: Record<string, unknown> = {};
  if (finnhubResult.fundamentals) {
    const patterns = [/roic/i, /return/i, /invested/i, /capital/i, /ebitda/i, /ev\b/i, /enterprise/i, /\bps\b/i, /sale/i, /revenue/i];
    for (const [key, value] of Object.entries(finnhubResult.fundamentals.metric)) {
      if (patterns.some(p => p.test(key))) {
        debugFinnhubFields[key] = value;
      }
    }
  }

  // DEBUG: Dump ALL XBRL fields from most recent annual financials-reported
  // This tells us exactly what building blocks are available for ROIC calculation
  let debugFinnhubFinancials: Record<string, unknown> = { error: 'not fetched' };
  if (finnhubKey) {
    try {
      const fResp = await fetch(
        `https://finnhub.io/api/v1/stock/financials-reported?symbol=${symbol}&freq=annual&token=${finnhubKey}`,
      );
      if (fResp.ok) {
        const fJson = await fResp.json();
        const reports = fJson?.data || [];
        if (reports.length > 0) {
          // Sort descending by year, take most recent
          reports.sort((a: { year: number }, b: { year: number }) => b.year - a.year);
          const latest = reports[0];
          const report = latest.report || {};

          // Dump all concepts from income statement (ic) and balance sheet (bs)
          const icItems: { concept: string; value: number }[] = report.ic || [];
          const bsItems: { concept: string; value: number }[] = report.bs || [];
          const cfItems: { concept: string; value: number }[] = report.cf || [];

          const icFields: Record<string, number> = {};
          for (const item of icItems) icFields[item.concept] = item.value;

          const bsFields: Record<string, number> = {};
          for (const item of bsItems) bsFields[item.concept] = item.value;

          const cfFields: Record<string, number> = {};
          for (const item of cfItems) cfFields[item.concept] = item.value;

          // Also filter for ROIC-relevant concepts
          const roicRelevant: Record<string, number> = {};
          const roicPatterns = [/operat/i, /tax/i, /income/i, /asset/i, /liabilit/i, /debt/i, /equity/i, /cash/i, /invest/i, /capital/i, /ebitda/i, /goodwill/i];
          for (const items of [icItems, bsItems, cfItems]) {
            for (const item of items) {
              if (roicPatterns.some(p => p.test(item.concept))) {
                roicRelevant[item.concept] = item.value;
              }
            }
          }

          debugFinnhubFinancials = {
            year: latest.year,
            filed_date: latest.filedDate || latest.acceptedDate || null,
            ic_field_count: icItems.length,
            bs_field_count: bsItems.length,
            cf_field_count: cfItems.length,
            ic_all_fields: icFields,
            bs_all_fields: bsFields,
            cf_all_fields: cfFields,
            roic_relevant_fields: roicRelevant,
          };
        } else {
          debugFinnhubFinancials = { error: 'no annual reports returned' };
        }
      } else {
        debugFinnhubFinancials = { error: `HTTP ${fResp.status}` };
      }
    } catch (e: unknown) {
      debugFinnhubFinancials = { error: e instanceof Error ? e.message : String(e) };
    }
  }

  return NextResponse.json({
    ...response,
    trade_cards: tradeCards.length > 0 ? tradeCards : undefined,
    _chain_stats: chainStats ?? undefined,
    _fetch_errors: Object.keys(fetchErrors).length > 0 ? fetchErrors : undefined,
    _rejection_reasons: chainRejections.length > 0 ? chainRejections : undefined,
    _raw_tt_fields: ttScannerResult.raw ? Object.keys(ttScannerResult.raw as object).sort() : undefined,
    _debug_finnhub_fields: Object.keys(debugFinnhubFields).length > 0 ? debugFinnhubFields : 'NO_MATCHING_FIELDS',
    _debug_finnhub_financials: debugFinnhubFinancials,
  });
}
