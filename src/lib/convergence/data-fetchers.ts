import type {
  FinnhubFundamentals,
  FinnhubRecommendation,
  FinnhubInsiderSentiment,
  FinnhubEarnings,
  FredMacroData,
} from './types';

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

// ===== FRED MACRO FETCHER (with 1-hour cache) =====

let fredCache: { data: FredMacroData; fetchedAt: number } | null = null;
const FRED_CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function fetchFredMacro(apiKey?: string): Promise<{ data: FredMacroData; cached: boolean; error: string | null }> {
  // Check cache
  if (fredCache && Date.now() - fredCache.fetchedAt < FRED_CACHE_TTL) {
    return { data: fredCache.data, cached: true, error: null };
  }

  const key = apiKey || process.env.FRED_API_KEY;
  if (!key) {
    const empty: FredMacroData = {
      vix: null, treasury10y: null, fedFunds: null, unemployment: null,
      cpi: null, gdp: null, consumerConfidence: null, nonfarmPayrolls: null, sofr: null,
    };
    return { data: empty, cached: false, error: 'FRED_API_KEY not configured' };
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

  // Cache the result
  fredCache = { data: result, fetchedAt: Date.now() };

  return { data: result, cached: false, error: errors.length > 0 ? errors.join('; ') : null };
}
