import type {
  CandleData,
  FinnhubFundamentals,
  FinnhubRecommendation,
  FinnhubInsiderSentiment,
  FinnhubEarnings,
  FredMacroData,
  AnnualFinancials,
  AnnualFinancialPeriod,
} from './types';
import { getTastytradeClient } from '@/lib/tastytrade';
import { CandleType } from '@tastytrade/api';

// ===== TYPES =====

export interface FinnhubData {
  fundamentals: FinnhubFundamentals | null;
  recommendations: FinnhubRecommendation[];
  insiderSentiment: FinnhubInsiderSentiment[];
  earnings: FinnhubEarnings[];
}

export interface FinnhubBatchStats {
  calls_made: number;
  errors: number;
  retries: number;
}

// ===== HELPERS =====

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchWithRetry(url: string): Promise<Response> {
  const resp = await fetch(url);
  if (resp.status === 429) {
    console.warn(`[Finnhub] 429 rate limit on ${url.split('?')[0]}, waiting 5s and retrying...`);
    await delay(5000);
    return fetch(url);
  }
  return resp;
}

// ===== FINNHUB SINGLE-TICKER FETCHER =====

export async function fetchFinnhubTicker(
  symbol: string,
  apiKey?: string,
): Promise<FinnhubData> {
  const key = apiKey || process.env.FINNHUB_API_KEY;
  if (!key) {
    return {
      fundamentals: null,
      recommendations: [],
      insiderSentiment: [],
      earnings: [],
    };
  }

  // Fetch all 4 endpoints, each resilient to failure
  let fundamentals: FinnhubFundamentals | null = null;
  let recommendations: FinnhubRecommendation[] = [];
  let insiderSentiment: FinnhubInsiderSentiment[] = [];
  let earnings: FinnhubEarnings[] = [];

  // 1. Fundamentals
  try {
    const resp = await fetchWithRetry(
      `https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${key}`,
    );
    if (resp.ok) {
      const json = await resp.json();
      const metric = json?.metric || {};
      fundamentals = { metric, fieldCount: Object.keys(metric).length };
    } else {
      console.error(`[Finnhub] fundamentals ${symbol}: HTTP ${resp.status}`);
    }
  } catch (e: unknown) {
    console.error(`[Finnhub] fundamentals ${symbol}:`, e instanceof Error ? e.message : String(e));
  }

  // 2. Recommendations
  try {
    const resp = await fetchWithRetry(
      `https://finnhub.io/api/v1/stock/recommendation?symbol=${symbol}&token=${key}`,
    );
    if (resp.ok) {
      const json = await resp.json();
      recommendations = Array.isArray(json) ? json : [];
    } else {
      console.error(`[Finnhub] recommendations ${symbol}: HTTP ${resp.status}`);
    }
  } catch (e: unknown) {
    console.error(`[Finnhub] recommendations ${symbol}:`, e instanceof Error ? e.message : String(e));
  }

  // 3. Insider sentiment
  try {
    const resp = await fetchWithRetry(
      `https://finnhub.io/api/v1/stock/insider-sentiment?symbol=${symbol}&from=2024-01-01&token=${key}`,
    );
    if (resp.ok) {
      const json = await resp.json();
      insiderSentiment = json?.data || [];
    } else {
      console.error(`[Finnhub] insider-sentiment ${symbol}: HTTP ${resp.status}`);
    }
  } catch (e: unknown) {
    console.error(`[Finnhub] insider-sentiment ${symbol}:`, e instanceof Error ? e.message : String(e));
  }

  // 4. Earnings
  try {
    const resp = await fetchWithRetry(
      `https://finnhub.io/api/v1/stock/earnings?symbol=${symbol}&token=${key}`,
    );
    if (resp.ok) {
      const json = await resp.json();
      earnings = Array.isArray(json) ? json : [];
    } else {
      console.error(`[Finnhub] earnings ${symbol}: HTTP ${resp.status}`);
    }
  } catch (e: unknown) {
    console.error(`[Finnhub] earnings ${symbol}:`, e instanceof Error ? e.message : String(e));
  }

  return { fundamentals, recommendations, insiderSentiment, earnings };
}

// ===== FINNHUB BATCH FETCHER =====

export async function fetchFinnhubBatch(
  symbols: string[],
  delayMs = 200,
  apiKey?: string,
): Promise<{ data: Map<string, FinnhubData>; stats: FinnhubBatchStats }> {
  const data = new Map<string, FinnhubData>();
  const stats: FinnhubBatchStats = { calls_made: 0, errors: 0, retries: 0 };

  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i];
    stats.calls_made += 4; // 4 endpoints per ticker

    try {
      const result = await fetchFinnhubTicker(symbol, apiKey);
      data.set(symbol, result);

      // Count errors: null fundamentals or empty arrays when we expected data
      if (!result.fundamentals) stats.errors++;
      if (result.recommendations.length === 0) stats.errors++;
    } catch (e: unknown) {
      console.error(`[Finnhub Batch] ${symbol} failed:`, e instanceof Error ? e.message : String(e));
      stats.errors++;
      data.set(symbol, {
        fundamentals: null,
        recommendations: [],
        insiderSentiment: [],
        earnings: [],
      });
    }

    // Delay between tickers (not after the last one)
    if (i < symbols.length - 1) {
      await delay(delayMs);
    }
  }

  return { data, stats };
}

// ===== ANNUAL FINANCIALS FETCHER (for Piotroski YoY signals) =====

/** Search XBRL report items for a value matching any of the given concept names. */
function findConcept(items: { concept: string; value: number }[], ...names: string[]): number | null {
  for (const name of names) {
    const item = items.find(i => i.concept === name || i.concept === `us-gaap_${name}`);
    if (item && typeof item.value === 'number') return item.value;
  }
  return null;
}

type ReportSection = { concept: string; value: number }[];
interface ReportData { bs: ReportSection; ic: ReportSection; cf: ReportSection }

function parseAnnualReport(report: ReportData, year: number): AnnualFinancialPeriod {
  const bs = report.bs || [];
  const ic = report.ic || [];
  const cf = report.cf || [];
  return {
    grossProfit: findConcept(ic, 'GrossProfit'),
    revenue: findConcept(ic, 'Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet', 'RevenueFromContractWithCustomerIncludingAssessedTax'),
    currentAssets: findConcept(bs, 'AssetsCurrent'),
    currentLiabilities: findConcept(bs, 'LiabilitiesCurrent'),
    totalAssets: findConcept(bs, 'Assets'),
    longTermDebt: findConcept(bs, 'LongTermDebt', 'LongTermDebtNoncurrent'),
    sharesOutstanding: findConcept(bs, 'CommonStockSharesOutstanding', 'EntityCommonStockSharesOutstanding'),
    operatingCashFlow: findConcept(cf, 'NetCashProvidedByUsedInOperatingActivities', 'NetCashProvidedByOperatingActivities'),
    capitalExpenditure: findConcept(cf, 'PaymentsToAcquirePropertyPlantAndEquipment', 'PurchaseOfPropertyPlantAndEquipment', 'CapitalExpenditure'),
    netIncome: findConcept(ic, 'NetIncomeLoss'),
    year,
  };
}

export async function fetchAnnualFinancials(
  symbol: string,
  apiKey?: string,
): Promise<{ data: AnnualFinancials | null; error: string | null }> {
  const key = apiKey || process.env.FINNHUB_API_KEY;
  if (!key) return { data: null, error: 'FINNHUB_API_KEY not configured' };

  try {
    const resp = await fetchWithRetry(
      `https://finnhub.io/api/v1/stock/financials-reported?symbol=${symbol}&freq=annual&token=${key}`,
    );
    if (!resp.ok) {
      return { data: null, error: `financials-reported: HTTP ${resp.status}` };
    }

    const json = await resp.json();
    const reports: { year: number; report: ReportData }[] = json?.data || [];

    if (reports.length < 2) {
      return { data: null, error: `financials-reported: only ${reports.length} annual report(s) available` };
    }

    // Sort descending by year to get the two most recent
    reports.sort((a, b) => b.year - a.year);

    const currentYear = parseAnnualReport(reports[0].report, reports[0].year);
    const priorYear = parseAnnualReport(reports[1].report, reports[1].year);

    return { data: { currentYear, priorYear }, error: null };
  } catch (e: unknown) {
    return { data: null, error: `financials-reported: ${e instanceof Error ? e.message : String(e)}` };
  }
}

// ===== FRED MACRO FETCHER (with 1-hour cache) =====

let fredCache: { data: FredMacroData; fetchedAt: number } | null = null;
const FRED_CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function fetchFredMacro(apiKey?: string): Promise<{ data: FredMacroData; cached: boolean; error: string | null }> {
  // Check cache
  if (fredCache && Date.now() - fredCache.fetchedAt < FRED_CACHE_TTL) {
    // Bust stale cache if GDP looks like a raw level instead of a growth rate
    if (fredCache.data.gdp !== null && fredCache.data.gdp > 100) {
      fredCache = null;
    } else {
      return { data: fredCache.data, cached: true, error: null };
    }
  }

  const key = apiKey || process.env.FRED_API_KEY;
  if (!key) {
    const empty: FredMacroData = {
      vix: null, treasury10y: null, fedFunds: null, unemployment: null,
      cpi: null, gdp: null, consumerConfidence: null, nonfarmPayrolls: null, cpiMom: null, sofr: null,
    };
    return { data: empty, cached: false, error: 'FRED_API_KEY not configured' };
  }

  // Simple series: single latest observation is the correct value
  // GDP, NFP, and CPI are handled separately below (need rate-of-change computation)
  const seriesMap: { key: keyof FredMacroData; id: string }[] = [
    { key: 'vix', id: 'VIXCLS' },
    { key: 'treasury10y', id: 'DGS10' },
    { key: 'fedFunds', id: 'FEDFUNDS' },
    { key: 'unemployment', id: 'UNRATE' },
    { key: 'gdp', id: 'A191RL1Q225SBEA' },  // Real GDP growth rate (quarterly annualized %)
    { key: 'consumerConfidence', id: 'UMCSENT' },
    { key: 'sofr', id: 'SOFR' },
  ];

  const result: FredMacroData = {
    vix: null, treasury10y: null, fedFunds: null, unemployment: null,
    cpi: null, gdp: null, consumerConfidence: null, nonfarmPayrolls: null, cpiMom: null, sofr: null,
  };

  const errors: string[] = [];

  for (const series of seriesMap) {
    try {
      const resp = await fetch(
        `https://api.stlouisfed.org/fred/series/observations?series_id=${series.id}&api_key=${key}&file_type=json&sort_order=desc&limit=1`,
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

  // FIX 2: NFP — fetch last 2 observations, compute monthly change (thousands)
  try {
    const resp = await fetch(
      `https://api.stlouisfed.org/fred/series/observations?series_id=PAYEMS&api_key=${key}&file_type=json&sort_order=desc&limit=2`,
    );
    if (resp.ok) {
      const json = await resp.json();
      const obs = json?.observations;
      if (Array.isArray(obs) && obs.length >= 2 && obs[0].value !== '.' && obs[1].value !== '.') {
        // sort_order=desc: obs[0] = most recent, obs[1] = previous month
        result.nonfarmPayrolls = parseFloat(obs[0].value) - parseFloat(obs[1].value);
      }
    } else {
      errors.push(`PAYEMS: HTTP ${resp.status}`);
    }
  } catch (e: unknown) {
    errors.push(`PAYEMS: ${e instanceof Error ? e.message : String(e)}`);
  }
  await delay(100);

  // FIX 3 & 4: CPI — fetch last 13 observations, compute YoY % and MoM %
  try {
    const resp = await fetch(
      `https://api.stlouisfed.org/fred/series/observations?series_id=CPIAUCSL&api_key=${key}&file_type=json&sort_order=desc&limit=13`,
    );
    if (resp.ok) {
      const json = await resp.json();
      const obs = json?.observations;
      if (Array.isArray(obs) && obs.length >= 2) {
        // sort_order=desc: obs[0] = most recent, obs[1] = previous month, obs[12] = 12 months ago
        const current = obs[0].value !== '.' ? parseFloat(obs[0].value) : null;
        const prevMonth = obs[1].value !== '.' ? parseFloat(obs[1].value) : null;

        // CPI MoM %
        if (current !== null && prevMonth !== null && prevMonth !== 0) {
          result.cpiMom = parseFloat((((current - prevMonth) / prevMonth) * 100).toFixed(2));
        }

        // CPI YoY % (need 13 observations for 12-month lookback)
        if (obs.length >= 13) {
          const yearAgo = obs[12].value !== '.' ? parseFloat(obs[12].value) : null;
          if (current !== null && yearAgo !== null && yearAgo !== 0) {
            result.cpi = parseFloat((((current - yearAgo) / yearAgo) * 100).toFixed(2));
          }
        }
      }
    } else {
      errors.push(`CPIAUCSL: HTTP ${resp.status}`);
    }
  } catch (e: unknown) {
    errors.push(`CPIAUCSL: ${e instanceof Error ? e.message : String(e)}`);
  }
  await delay(100);

  // Cache the result
  fredCache = { data: result, fetchedAt: Date.now() };

  return { data: result, cached: false, error: errors.length > 0 ? errors.join('; ') : null };
}

// ===== TASTYTRADE CANDLE BATCH FETCHER =====

export interface CandleBatchStats {
  total_candles: number;
  symbols_with_data: number;
  symbols_failed: string[];
  elapsed_ms: number;
}

export async function fetchTTCandlesBatch(
  symbols: string[],
  days = 90,
): Promise<{ data: Map<string, CandleData[]>; stats: CandleBatchStats }> {
  const start = Date.now();
  const data = new Map<string, CandleData[]>();
  const stats: CandleBatchStats = { total_candles: 0, symbols_with_data: 0, symbols_failed: [], elapsed_ms: 0 };

  if (symbols.length === 0) {
    stats.elapsed_ms = Date.now() - start;
    return { data, stats };
  }

  const fromTime = Date.now() - days * 24 * 60 * 60 * 1000;

  // Pre-populate map so every symbol has an array
  for (const sym of symbols) {
    data.set(sym, []);
  }

  try {
    const client = getTastytradeClient();
    // Force token refresh before WebSocket
    await client.accountsAndCustomersService.getCustomerResource();

    const removeListener = client.quoteStreamer.addEventListener((events: any[]) => {
      for (const evt of events) {
        const type = (evt['eventType'] as string) || '';
        if (type !== 'Candle') continue;

        // eventSymbol format: "AAPL{=d}" for daily candles — parse symbol
        const eventSymbol = (evt['eventSymbol'] as string) || '';
        const sym = eventSymbol.replace(/\{.*\}$/, '');
        if (!sym || !data.has(sym)) continue;

        const time = Number(evt['time'] || 0);
        const open = evt['open'] != null ? Number(evt['open']) : 0;
        const close = evt['close'] != null ? Number(evt['close']) : 0;
        if (open <= 0 || close <= 0) continue;

        data.get(sym)!.push({
          time,
          date: new Date(time).toISOString().slice(0, 10),
          open,
          high: evt['high'] != null ? Number(evt['high']) : open,
          low: evt['low'] != null ? Number(evt['low']) : open,
          close,
          volume: evt['volume'] != null ? Number(evt['volume']) : 0,
        });
      }
    });

    try {
      await client.quoteStreamer.connect();
      console.log(`[CandleBatch] Connected, subscribing ${symbols.length} symbols...`);

      // Subscribe all symbols on the same connection
      for (const sym of symbols) {
        client.quoteStreamer.subscribeCandles(sym, fromTime, 1, CandleType.Day);
      }

      // Stability-check loop: wait until candle count stops increasing
      const deadline = Date.now() + 15000; // 15s total timeout
      let lastCount = 0;
      let stableFor = 0;

      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 500));
        let totalCount = 0;
        for (const arr of data.values()) totalCount += arr.length;

        if (totalCount > 0 && totalCount === lastCount) {
          stableFor += 500;
          if (stableFor >= 3000) break; // stable for 3s
        } else {
          stableFor = 0;
        }
        lastCount = totalCount;
      }
    } finally {
      removeListener();
      client.quoteStreamer.disconnect();
    }

    // Sort each symbol's candles by time ascending and deduplicate by date
    for (const [sym, candles] of data.entries()) {
      candles.sort((a, b) => a.time - b.time);
      // Deduplicate by date (keep last occurrence for each date)
      const byDate = new Map<string, CandleData>();
      for (const c of candles) byDate.set(c.date, c);
      const deduped = Array.from(byDate.values());
      data.set(sym, deduped);

      if (deduped.length > 0) {
        stats.symbols_with_data++;
        stats.total_candles += deduped.length;
      } else {
        stats.symbols_failed.push(sym);
      }
    }

    console.log(`[CandleBatch] Done: ${stats.symbols_with_data}/${symbols.length} symbols, ${stats.total_candles} total candles`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[CandleBatch] Connection failed:`, msg);
    // All symbols failed
    stats.symbols_failed = [...symbols];
  }

  stats.elapsed_ms = Date.now() - start;
  return { data, stats };
}
