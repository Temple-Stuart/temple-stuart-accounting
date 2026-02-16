import { NextResponse } from 'next/server';
import { getTastytradeClient } from '@/lib/tastytrade';
import { CandleType } from '@tastytrade/api';
import { scoreAll } from '@/lib/convergence/composite';
import type {
  CandleData,
  TTScannerData,
  FinnhubFundamentals,
  FinnhubRecommendation,
  FinnhubInsiderSentiment,
  FinnhubEarnings,
  FredMacroData,
  ConvergenceInput,
  ConvergenceResponse,
} from '@/lib/convergence/types';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// ===== FRED CACHE (1 hour) =====
let fredCache: { data: FredMacroData; fetchedAt: number } | null = null;
const FRED_CACHE_TTL = 60 * 60 * 1000; // 1 hour

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

async function fetchFinnhubFundamentals(symbol: string, apiKey: string): Promise<{ data: FinnhubFundamentals | null; error: string | null }> {
  try {
    const resp = await fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${apiKey}`);
    if (!resp.ok) return { data: null, error: `HTTP ${resp.status}` };
    const json = await resp.json();
    const metric = json?.metric || {};
    return { data: { metric, fieldCount: Object.keys(metric).length }, error: null };
  } catch (e: unknown) {
    return { data: null, error: e instanceof Error ? e.message : String(e) };
  }
}

async function fetchFinnhubRecommendations(symbol: string, apiKey: string): Promise<{ data: FinnhubRecommendation[]; error: string | null }> {
  try {
    const resp = await fetch(`https://finnhub.io/api/v1/stock/recommendation?symbol=${symbol}&token=${apiKey}`);
    if (!resp.ok) return { data: [], error: `HTTP ${resp.status}` };
    const json = await resp.json();
    return { data: Array.isArray(json) ? json : [], error: null };
  } catch (e: unknown) {
    return { data: [], error: e instanceof Error ? e.message : String(e) };
  }
}

async function fetchFinnhubInsiderSentiment(symbol: string, apiKey: string): Promise<{ data: FinnhubInsiderSentiment[]; error: string | null }> {
  try {
    const now = new Date().toISOString().slice(0, 10);
    const resp = await fetch(`https://finnhub.io/api/v1/stock/insider-sentiment?symbol=${symbol}&from=2024-01-01&to=${now}&token=${apiKey}`);
    if (!resp.ok) return { data: [], error: `HTTP ${resp.status}` };
    const json = await resp.json();
    return { data: json?.data || [], error: null };
  } catch (e: unknown) {
    return { data: [], error: e instanceof Error ? e.message : String(e) };
  }
}

async function fetchFinnhubEarnings(symbol: string, apiKey: string): Promise<{ data: FinnhubEarnings[]; error: string | null }> {
  try {
    const resp = await fetch(`https://finnhub.io/api/v1/stock/earnings?symbol=${symbol}&token=${apiKey}`);
    if (!resp.ok) return { data: [], error: `HTTP ${resp.status}` };
    const json = await resp.json();
    return { data: Array.isArray(json) ? json : [], error: null };
  } catch (e: unknown) {
    return { data: [], error: e instanceof Error ? e.message : String(e) };
  }
}

async function fetchFredMacro(apiKey: string): Promise<{ data: FredMacroData; error: string | null }> {
  // Check cache
  if (fredCache && Date.now() - fredCache.fetchedAt < FRED_CACHE_TTL) {
    return { data: fredCache.data, error: null };
  }

  const seriesMap: { key: keyof FredMacroData; id: string }[] = [
    { key: 'vix', id: 'VIXCLS' },
    { key: 'treasury10y', id: 'DGS10' },
    { key: 'fedFunds', id: 'FEDFUNDS' },
    { key: 'unemployment', id: 'UNRATE' },
    { key: 'cpi', id: 'CPIAUCSL' },
    { key: 'gdp', id: 'GDP' },
    { key: 'consumerConfidence', id: 'UMCSENT' },
    { key: 'nonfarmPayrolls', id: 'PAYEMS' },
    { key: 'sofr', id: 'SOFR' },
  ];

  const result: FredMacroData = {
    vix: null, treasury10y: null, fedFunds: null, unemployment: null,
    cpi: null, gdp: null, consumerConfidence: null, nonfarmPayrolls: null, sofr: null,
  };

  const errors: string[] = [];

  for (const series of seriesMap) {
    try {
      const resp = await fetch(
        `https://api.stlouisfed.org/fred/series/observations?series_id=${series.id}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=1`,
      );
      if (resp.ok) {
        const json = await resp.json();
        const obs = json?.observations;
        if (Array.isArray(obs) && obs.length > 0 && obs[0].value !== '.') {
          result[series.key] = parseFloat(obs[0].value);
        }
      } else {
        errors.push(`${series.id}: HTTP ${resp.status}`);
      }
    } catch (e: unknown) {
      errors.push(`${series.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
    await delay(100); // Rate limit respect
  }

  // Cache successful result
  fredCache = { data: result, fetchedAt: Date.now() };

  return { data: result, error: errors.length > 0 ? errors.join('; ') : null };
}

// ===== MAIN ROUTE =====

export async function GET(request: Request) {
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
    fhFundamentalsResult,
    fhRecsResult,
    fhInsiderResult,
    fhEarningsResult,
    fredResult,
  ] = await Promise.all([
    fetchTTScanner(symbol).catch(e => {
      fetchErrors.tt_scanner = e instanceof Error ? e.message : String(e);
      return { data: null, raw: null, error: String(e) } as Awaited<ReturnType<typeof fetchTTScanner>>;
    }),
    fetchTTCandles(symbol, 120).catch(e => {
      fetchErrors.tt_candles = e instanceof Error ? e.message : String(e);
      return { candles: [] as CandleData[], error: String(e) };
    }),
    finnhubKey
      ? fetchFinnhubFundamentals(symbol, finnhubKey).catch(e => ({ data: null, error: String(e) }))
      : Promise.resolve({ data: null, error: 'FINNHUB_API_KEY not configured' }),
    finnhubKey
      ? delay(200).then(() => fetchFinnhubRecommendations(symbol, finnhubKey)).catch(e => ({ data: [] as FinnhubRecommendation[], error: String(e) }))
      : Promise.resolve({ data: [] as FinnhubRecommendation[], error: 'FINNHUB_API_KEY not configured' }),
    finnhubKey
      ? delay(400).then(() => fetchFinnhubInsiderSentiment(symbol, finnhubKey)).catch(e => ({ data: [] as FinnhubInsiderSentiment[], error: String(e) }))
      : Promise.resolve({ data: [] as FinnhubInsiderSentiment[], error: 'FINNHUB_API_KEY not configured' }),
    finnhubKey
      ? delay(600).then(() => fetchFinnhubEarnings(symbol, finnhubKey)).catch(e => ({ data: [] as FinnhubEarnings[], error: String(e) }))
      : Promise.resolve({ data: [] as FinnhubEarnings[], error: 'FINNHUB_API_KEY not configured' }),
    fredKey
      ? fetchFredMacro(fredKey).catch(e => ({
          data: { vix: null, treasury10y: null, fedFunds: null, unemployment: null, cpi: null, gdp: null, consumerConfidence: null, nonfarmPayrolls: null, sofr: null } as FredMacroData,
          error: String(e),
        }))
      : Promise.resolve({
          data: { vix: null, treasury10y: null, fedFunds: null, unemployment: null, cpi: null, gdp: null, consumerConfidence: null, nonfarmPayrolls: null, sofr: null } as FredMacroData,
          error: 'FRED_API_KEY not configured',
        }),
  ]);

  // Collect fetch errors
  if (ttScannerResult.error) fetchErrors.tt_scanner = ttScannerResult.error;
  if (ttCandleResult.error) fetchErrors.tt_candles = ttCandleResult.error;
  if (fhFundamentalsResult.error) fetchErrors.finnhub_fundamentals = fhFundamentalsResult.error;
  if (fhRecsResult.error) fetchErrors.finnhub_recommendations = fhRecsResult.error;
  if (fhInsiderResult.error) fetchErrors.finnhub_insider_sentiment = fhInsiderResult.error;
  if (fhEarningsResult.error) fetchErrors.finnhub_earnings = fhEarningsResult.error;
  if (fredResult.error) fetchErrors.fred_macro = fredResult.error;

  // ===== ASSEMBLE INPUT =====
  const convergenceInput: ConvergenceInput = {
    symbol,
    ttScanner: ttScannerResult.data,
    candles: ttCandleResult.candles,
    finnhubFundamentals: fhFundamentalsResult.data,
    finnhubRecommendations: fhRecsResult.data,
    finnhubInsiderSentiment: fhInsiderResult.data,
    finnhubEarnings: fhEarningsResult.data,
    fredMacro: fredResult.data,
  };

  // ===== RUN SCORING =====
  const scoringResult = scoreAll(convergenceInput);

  const pipelineMs = Date.now() - pipelineStart;

  // ===== BUILD RESPONSE =====
  const candles = ttCandleResult.candles;
  const latestRec = fhRecsResult.data.length > 0 ? fhRecsResult.data[0] : null;
  const latestEarnings = fhEarningsResult.data.length > 0 ? fhEarningsResult.data[0] : null;
  const insiderSorted = [...fhInsiderResult.data].sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });
  const latestMspr = insiderSorted.length > 0 ? insiderSorted[0].mspr : null;

  // Build sample fields from Finnhub fundamentals (first 15 fields)
  const sampleFields: Record<string, number | string | null> = {};
  if (fhFundamentalsResult.data) {
    const keys = Object.keys(fhFundamentalsResult.data.metric).slice(0, 15);
    for (const k of keys) {
      sampleFields[k] = fhFundamentalsResult.data.metric[k];
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
      finnhub_fundamentals: fhFundamentalsResult.data
        ? { field_count: fhFundamentalsResult.data.fieldCount, sample_fields: sampleFields }
        : null,
      finnhub_recommendations: {
        latest: latestRec,
        history_count: fhRecsResult.data.length,
      },
      finnhub_insider_sentiment: {
        latest_mspr: latestMspr,
        months_available: fhInsiderResult.data.length,
      },
      finnhub_earnings: {
        latest: latestEarnings,
        quarters_available: fhEarningsResult.data.length,
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

  return NextResponse.json({
    ...response,
    _fetch_errors: Object.keys(fetchErrors).length > 0 ? fetchErrors : undefined,
    _raw_tt_fields: ttScannerResult.raw ? Object.keys(ttScannerResult.raw as object).sort() : undefined,
  });
}
