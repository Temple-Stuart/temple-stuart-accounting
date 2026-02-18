/**
 * Pipeline Stress Test — 20 diverse tickers, sequential, 4s delay between each.
 *
 * Tests: mega-cap tech, financials, energy, pharma, meme stocks, ETFs, small-cap.
 * Reports: success/failure, all 4 category scores, composite, strategy, data gaps.
 *
 * Self-contained: inlines fetch logic to avoid @tastytrade/api dependency.
 * TT Scanner + candles are null/empty (no TT auth in this env).
 *
 * Usage: npx tsx src/scripts/pipeline-stress-test.ts
 */

import { scoreAll } from '@/lib/convergence/composite';
import type { FullScoringResult } from '@/lib/convergence/composite';
import type {
  ConvergenceInput,
  FredMacroData,
  FinnhubFundamentals,
  FinnhubRecommendation,
  FinnhubInsiderSentiment,
  FinnhubEarnings,
  AnnualFinancials,
  OptionsFlowData,
  NewsSentimentData,
  NewsHeadlineEntry,
  NewsSentimentPeriod,
} from '@/lib/convergence/types';

const TICKERS = [
  'AAPL', 'NVDA', 'TSLA', 'JPM', 'XOM',
  'PFE', 'PLTR', 'GME', 'MSFT', 'AMZN',
  'META', 'GOOGL', 'KO', 'WMT', 'BAC',
  'AMD', 'COIN', 'SOFI', 'IWM', 'SPY',
];

const DELAY_BETWEEN_TICKERS_MS = 4000;

// ===== HELPERS =====

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchWithRetry(url: string): Promise<Response> {
  const resp = await fetch(url);
  if (resp.status === 429) {
    console.warn(`  [429] Rate limited on ${url.split('?')[0].split('/').pop()}, waiting 5s...`);
    await sleep(5000);
    return fetch(url);
  }
  return resp;
}

// ===== INLINED FETCH FUNCTIONS =====

interface FinnhubData {
  fundamentals: FinnhubFundamentals | null;
  recommendations: FinnhubRecommendation[];
  insiderSentiment: FinnhubInsiderSentiment[];
  earnings: FinnhubEarnings[];
}

async function fetchFinnhubTicker(symbol: string, apiKey: string): Promise<FinnhubData> {
  let fundamentals: FinnhubFundamentals | null = null;
  let recommendations: FinnhubRecommendation[] = [];
  let insiderSentiment: FinnhubInsiderSentiment[] = [];
  let earnings: FinnhubEarnings[] = [];

  try {
    const resp = await fetchWithRetry(`https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${apiKey}`);
    if (resp.ok) { const json = await resp.json(); const metric = json?.metric || {}; fundamentals = { metric, fieldCount: Object.keys(metric).length }; }
  } catch {}

  try {
    const resp = await fetchWithRetry(`https://finnhub.io/api/v1/stock/recommendation?symbol=${symbol}&token=${apiKey}`);
    if (resp.ok) { const json = await resp.json(); recommendations = Array.isArray(json) ? json : []; }
  } catch {}

  try {
    const resp = await fetchWithRetry(`https://finnhub.io/api/v1/stock/insider-sentiment?symbol=${symbol}&from=2024-01-01&token=${apiKey}`);
    if (resp.ok) { const json = await resp.json(); insiderSentiment = json?.data || []; }
  } catch {}

  try {
    const resp = await fetchWithRetry(`https://finnhub.io/api/v1/stock/earnings?symbol=${symbol}&token=${apiKey}`);
    if (resp.ok) { const json = await resp.json(); earnings = Array.isArray(json) ? json : []; }
  } catch {}

  return { fundamentals, recommendations, insiderSentiment, earnings };
}

async function fetchFredMacro(apiKey: string): Promise<{ data: FredMacroData; error: string | null }> {
  const result: FredMacroData = {
    vix: null, treasury10y: null, fedFunds: null, unemployment: null,
    cpi: null, gdp: null, consumerConfidence: null, nonfarmPayrolls: null, cpiMom: null, sofr: null,
  };
  const errors: string[] = [];

  const seriesMap: { key: keyof FredMacroData; id: string }[] = [
    { key: 'vix', id: 'VIXCLS' },
    { key: 'treasury10y', id: 'DGS10' },
    { key: 'fedFunds', id: 'FEDFUNDS' },
    { key: 'unemployment', id: 'UNRATE' },
    { key: 'gdp', id: 'A191RL1Q225SBEA' },
    { key: 'consumerConfidence', id: 'UMCSENT' },
    { key: 'sofr', id: 'SOFR' },
  ];

  for (const series of seriesMap) {
    try {
      const resp = await fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=${series.id}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=1`);
      if (resp.ok) {
        const json = await resp.json();
        const obs = json?.observations;
        if (Array.isArray(obs) && obs.length > 0 && obs[0].value !== '.') {
          result[series.key] = parseFloat(obs[0].value);
        }
      } else { errors.push(`${series.id}: HTTP ${resp.status}`); }
    } catch (e: unknown) { errors.push(`${series.id}: ${e instanceof Error ? e.message : String(e)}`); }
    await sleep(100);
  }

  // NFP
  try {
    const resp = await fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=PAYEMS&api_key=${apiKey}&file_type=json&sort_order=desc&limit=2`);
    if (resp.ok) {
      const json = await resp.json();
      const obs = json?.observations;
      if (Array.isArray(obs) && obs.length >= 2 && obs[0].value !== '.' && obs[1].value !== '.') {
        result.nonfarmPayrolls = parseFloat(obs[0].value) - parseFloat(obs[1].value);
      }
    } else { errors.push(`PAYEMS: HTTP ${resp.status}`); }
  } catch (e: unknown) { errors.push(`PAYEMS: ${e instanceof Error ? e.message : String(e)}`); }
  await sleep(100);

  // CPI
  try {
    const resp = await fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=CPIAUCSL&api_key=${apiKey}&file_type=json&sort_order=desc&limit=13`);
    if (resp.ok) {
      const json = await resp.json();
      const obs = json?.observations;
      if (Array.isArray(obs) && obs.length >= 2) {
        const current = obs[0].value !== '.' ? parseFloat(obs[0].value) : null;
        const prevMonth = obs[1].value !== '.' ? parseFloat(obs[1].value) : null;
        if (current !== null && prevMonth !== null && prevMonth !== 0) {
          result.cpiMom = parseFloat((((current - prevMonth) / prevMonth) * 100).toFixed(2));
        }
        if (obs.length >= 13) {
          const yearAgo = obs[12].value !== '.' ? parseFloat(obs[12].value) : null;
          if (current !== null && yearAgo !== null && yearAgo !== 0) {
            result.cpi = parseFloat((((current - yearAgo) / yearAgo) * 100).toFixed(2));
          }
        }
      }
    } else { errors.push(`CPIAUCSL: HTTP ${resp.status}`); }
  } catch (e: unknown) { errors.push(`CPIAUCSL: ${e instanceof Error ? e.message : String(e)}`); }

  return { data: result, error: errors.length > 0 ? errors.join('; ') : null };
}

// Minimal annual financials fetch
type ReportData = Record<string, Array<{ label?: string; value?: number; concept?: string }>>;

function findField(data: ReportData, ...labels: string[]): number | null {
  for (const section of Object.values(data)) {
    if (!Array.isArray(section)) continue;
    for (const item of section) {
      const key = (item.label || item.concept || '').toLowerCase();
      for (const label of labels) {
        if (key.includes(label.toLowerCase())) return item.value ?? null;
      }
    }
  }
  return null;
}

function parseAnnualReport(report: ReportData, year: number) {
  return {
    year,
    revenue: findField(report, 'revenue', 'sales', 'net revenue'),
    netIncome: findField(report, 'net income', 'net earnings'),
    totalAssets: findField(report, 'total assets'),
    totalLiabilities: findField(report, 'total liabilities'),
    currentAssets: findField(report, 'current assets'),
    currentLiabilities: findField(report, 'current liabilities'),
    operatingCashFlow: findField(report, 'operating cash flow', 'cash from operations', 'net cash from operating'),
    capitalExpenditures: findField(report, 'capital expenditure', 'capex', 'purchase of property'),
    grossProfit: findField(report, 'gross profit'),
    operatingIncome: findField(report, 'operating income', 'income from operations'),
    totalEquity: findField(report, 'total equity', "stockholders' equity", 'shareholders equity'),
    longTermDebt: findField(report, 'long-term debt', 'long term debt'),
    dividends: findField(report, 'dividends paid', 'cash dividends'),
    sharesOutstanding: findField(report, 'shares outstanding', 'common shares'),
    inventory: findField(report, 'inventory', 'inventories'),
    costOfRevenue: findField(report, 'cost of revenue', 'cost of goods sold', 'cost of sales'),
  };
}

async function fetchAnnualFinancials(symbol: string, apiKey: string): Promise<{ data: AnnualFinancials | null; error: string | null }> {
  try {
    const resp = await fetchWithRetry(`https://finnhub.io/api/v1/stock/financials-reported?symbol=${symbol}&freq=annual&token=${apiKey}`);
    if (!resp.ok) return { data: null, error: `financials-reported: HTTP ${resp.status}` };
    const json = await resp.json();
    const reports: { year: number; report: ReportData }[] = json?.data || [];
    if (reports.length < 2) return { data: null, error: `financials-reported: only ${reports.length} annual report(s)` };
    reports.sort((a, b) => b.year - a.year);
    return { data: { currentYear: parseAnnualReport(reports[0].report, reports[0].year), priorYear: parseAnnualReport(reports[1].report, reports[1].year) }, error: null };
  } catch (e: unknown) {
    return { data: null, error: `financials-reported: ${e instanceof Error ? e.message : String(e)}` };
  }
}

async function fetchOptionsFlow(symbol: string, apiKey: string): Promise<{ data: OptionsFlowData | null; error: string | null }> {
  try {
    const resp = await fetchWithRetry(`https://finnhub.io/api/v1/stock/option-chain?symbol=${symbol}&token=${apiKey}`);
    if (!resp.ok) return { data: null, error: `option-chain: HTTP ${resp.status}` };
    const json = await resp.json();
    const expirations = json?.data || [];
    if (!Array.isArray(expirations) || expirations.length === 0) return { data: null, error: 'option-chain: no expirations' };

    // Find nearest expiration
    const now = new Date();
    const sorted = [...expirations].sort((a, b) => {
      const da = Math.abs(new Date(a.expirationDate).getTime() - now.getTime());
      const db = Math.abs(new Date(b.expirationDate).getTime() - now.getTime());
      return da - db;
    });
    const nearest = sorted[0];
    const options = nearest?.options?.data || [];
    if (options.length === 0) return { data: null, error: 'option-chain: no option data' };

    // Find ATM via put-call parity
    let minDiff = Infinity;
    let atmStrike = 0;
    for (const opt of options) {
      if (opt.type === 'call') {
        const matchingPut = options.find((p: Record<string, unknown>) => p.type === 'put' && p.strike === opt.strike);
        if (matchingPut) {
          const diff = Math.abs((opt.lastPrice || 0) - (matchingPut.lastPrice || 0));
          if (diff < minDiff) { minDiff = diff; atmStrike = opt.strike; }
        }
      }
    }

    let totalCallVol = 0, totalPutVol = 0, otmCallVol = 0, otmPutVol = 0;
    let totalOI = 0, maxSingleVol = 0;

    for (const opt of options) {
      const vol = opt.volume || 0;
      const oi = opt.openInterest || 0;
      totalOI += oi;
      if (vol > maxSingleVol) maxSingleVol = vol;

      if (opt.type === 'call') {
        totalCallVol += vol;
        if (opt.strike > atmStrike) otmCallVol += vol;
      } else {
        totalPutVol += vol;
        if (opt.strike < atmStrike) otmPutVol += vol;
      }
    }

    const totalVol = totalCallVol + totalPutVol;
    const pcr = totalCallVol > 0 ? Math.round((totalPutVol / totalCallVol) * 100) / 100 : null;
    const volumeBias = totalVol > 0 ? Math.round(((otmCallVol - otmPutVol) / (otmCallVol + otmPutVol)) * 10000) / 100 : 0;
    const unusualRatio = totalOI > 0 ? Math.round((totalVol / totalOI) * 100) / 100 : null;

    return {
      data: {
        expiration: nearest.expirationDate,
        total_call_volume: totalCallVol,
        total_put_volume: totalPutVol,
        put_call_ratio: pcr,
        otm_call_volume: otmCallVol,
        otm_put_volume: otmPutVol,
        volume_bias_pct: volumeBias,
        total_oi: totalOI,
        unusual_volume_ratio: unusualRatio,
        max_single_strike_volume: maxSingleVol,
        atm_strike: atmStrike,
        strikes_analyzed: options.length,
      },
      error: null,
    };
  } catch (e: unknown) {
    return { data: null, error: `option-chain: ${e instanceof Error ? e.message : String(e)}` };
  }
}

// News sentiment
const BULLISH_KEYWORDS = [
  'upgrade', 'upgrades', 'upgraded', 'raises', 'raised', 'record', 'record-breaking',
  'beats', 'beat', 'surpass', 'surpasses', 'growth', 'expands', 'expansion',
  'approved', 'approval', 'partnership', 'deal', 'acquisition', 'acquires',
  'outperform', 'buy', 'bullish', 'strong', 'exceeds', 'exceeded',
  'positive', 'optimistic', 'breakthrough', 'innovation', 'launch', 'launches',
];

const BEARISH_KEYWORDS = [
  'downgrade', 'downgrades', 'downgraded', 'lawsuit', 'sued', 'investigation', 'probe',
  'recall', 'layoffs', 'layoff', 'restructuring', 'misses', 'missed',
  'warning', 'warns', 'fraud', 'scandal', 'violation', 'penalty', 'fine', 'fined',
  'decline', 'declining', 'weak', 'bearish', 'underperform', 'sell',
  'negative', 'risk', 'concern', 'fears', 'crisis', 'cuts', 'slashes',
];

const TIER1_SOURCES = [
  'reuters', 'bloomberg', 'cnbc', 'wall street journal', 'wsj',
  'financial times', 'ft', "barron's", 'marketwatch', 'ap news',
  'associated press', 'new york times', 'nyt', 'washington post',
];

function classifyHeadline(headline: string): { sentiment: 'bullish' | 'bearish' | 'neutral'; keywords: string[] } {
  const lower = headline.toLowerCase();
  const bullish = BULLISH_KEYWORDS.filter(kw => new RegExp(`\\b${kw}\\b`).test(lower));
  const bearish = BEARISH_KEYWORDS.filter(kw => new RegExp(`\\b${kw}\\b`).test(lower));
  if (bullish.length > bearish.length) return { sentiment: 'bullish', keywords: bullish };
  if (bearish.length > bullish.length) return { sentiment: 'bearish', keywords: bearish };
  return { sentiment: 'neutral', keywords: [] };
}

function computePeriodSentiment(headlines: NewsHeadlineEntry[]): NewsSentimentPeriod {
  const total = headlines.length;
  if (total === 0) return { bullish_matches: 0, bearish_matches: 0, neutral: 0, score: 50 };
  const bullish = headlines.filter(h => h.sentiment === 'bullish').length;
  const bearish = headlines.filter(h => h.sentiment === 'bearish').length;
  const neutral = total - bullish - bearish;
  const score = Math.round(((bullish - bearish + total) / (2 * total)) * 10000) / 100;
  return { bullish_matches: bullish, bearish_matches: bearish, neutral, score };
}

async function fetchNewsSentiment(symbol: string, apiKey: string): Promise<{ data: NewsSentimentData | null; error: string | null }> {
  try {
    const now = new Date();
    const toDate = now.toISOString().slice(0, 10);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const from7d = sevenDaysAgo.toISOString().slice(0, 10);
    const from30d = thirtyDaysAgo.toISOString().slice(0, 10);
    const to8d = eightDaysAgo.toISOString().slice(0, 10);

    type RawArticle = { headline?: string; source?: string; datetime?: number; url?: string };

    const [resp7d, resp8_30d] = await Promise.all([
      fetchWithRetry(`https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${from7d}&to=${toDate}&token=${apiKey}`),
      fetchWithRetry(`https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${from30d}&to=${to8d}&token=${apiKey}`),
    ]);

    if (!resp7d.ok) return { data: null, error: `company-news 7d: HTTP ${resp7d.status}` };
    if (!resp8_30d.ok) return { data: null, error: `company-news 8-30d: HTTP ${resp8_30d.status}` };

    const articles7dRaw: RawArticle[] = await resp7d.json();
    const articles8_30dRaw: RawArticle[] = await resp8_30d.json();
    if (!Array.isArray(articles7dRaw) || !Array.isArray(articles8_30dRaw)) return { data: null, error: 'company-news: invalid response' };

    const headlines7d: NewsHeadlineEntry[] = [];
    const headlines8_30d: NewsHeadlineEntry[] = [];
    const allHeadlines: NewsHeadlineEntry[] = [];
    const sourceDistribution: Record<string, number> = {};

    function classify(article: RawArticle): NewsHeadlineEntry {
      const headline = article.headline || '';
      const source = article.source || '';
      const { sentiment, keywords } = classifyHeadline(headline);
      return { datetime: article.datetime || 0, headline, source, url: article.url || '', sentiment_keywords: keywords, sentiment };
    }

    for (const a of articles7dRaw) { const e = classify(a); headlines7d.push(e); allHeadlines.push(e); sourceDistribution[e.source] = (sourceDistribution[e.source] || 0) + 1; }
    for (const a of articles8_30dRaw) { const e = classify(a); headlines8_30d.push(e); allHeadlines.push(e); sourceDistribution[e.source] = (sourceDistribution[e.source] || 0) + 1; }
    allHeadlines.sort((a, b) => b.datetime - a.datetime);

    const articles7d = headlines7d.length;
    const articles8_30d = headlines8_30d.length;
    const totalArticles = articles7d + articles8_30d;

    const weeklyBaseline = articles8_30d > 0 ? articles8_30d / 3.29 : null;
    const buzzRatio = weeklyBaseline !== null && weeklyBaseline > 0 ? Math.round((articles7d / weeklyBaseline) * 100) / 100 : null;

    const sentiment7d = computePeriodSentiment(headlines7d);
    const sentiment8_30d = computePeriodSentiment(headlines8_30d);
    const sentimentMomentum = Math.round((sentiment7d.score - sentiment8_30d.score) * 100) / 100;

    let tier1Count = 0;
    for (const [source, count] of Object.entries(sourceDistribution)) {
      if (TIER1_SOURCES.some(t1 => source.toLowerCase().includes(t1))) tier1Count += count;
    }
    const tier1Ratio = totalArticles > 0 ? Math.round((tier1Count / totalArticles) * 1000) / 1000 : 0;

    return {
      data: {
        total_articles_30d: totalArticles, articles_7d: articles7d, articles_8_30d: articles8_30d,
        buzz_ratio: buzzRatio, sentiment_7d: sentiment7d, sentiment_8_30d: sentiment8_30d,
        sentiment_momentum: sentimentMomentum, source_distribution: sourceDistribution,
        tier1_ratio: tier1Ratio, headlines: allHeadlines,
      },
      error: null,
    };
  } catch (e: unknown) {
    return { data: null, error: `company-news: ${e instanceof Error ? e.message : String(e)}` };
  }
}

// ===== RESULT TYPE =====

interface TickerResult {
  symbol: string;
  status: 'SUCCESS' | 'FAILURE';
  composite: number | null;
  vol_edge: number | null;
  quality: number | null;
  regime: number | null;
  info_edge: number | null;
  strategy: string | null;
  data_gaps: string[];
  fetch_errors: Record<string, string>;
  error: string | null;
  failed_component: string | null;
  runtime_ms: number;
}

// ===== SINGLE TICKER RUNNER =====

async function runSingleTicker(
  symbol: string,
  fredData: FredMacroData,
  finnhubKey: string | null,
): Promise<TickerResult> {
  const start = Date.now();
  const fetchErrors: Record<string, string> = {};

  let finnhubData: FinnhubData = { fundamentals: null, recommendations: [], insiderSentiment: [], earnings: [] };
  let annualFinancials: AnnualFinancials | null = null;
  let optionsFlow: OptionsFlowData | null = null;
  let newsSentiment: NewsSentimentData | null = null;

  if (finnhubKey) {
    // Fetch Finnhub data with small delays between endpoints
    try { finnhubData = await fetchFinnhubTicker(symbol, finnhubKey); } catch (e: unknown) { fetchErrors.finnhub = e instanceof Error ? e.message : String(e); }

    await sleep(300);
    try { const r = await fetchAnnualFinancials(symbol, finnhubKey); annualFinancials = r.data; if (r.error) fetchErrors.annual_financials = r.error; } catch (e: unknown) { fetchErrors.annual_financials = e instanceof Error ? e.message : String(e); }

    await sleep(300);
    try { const r = await fetchOptionsFlow(symbol, finnhubKey); optionsFlow = r.data; if (r.error) fetchErrors.options_flow = r.error; } catch (e: unknown) { fetchErrors.options_flow = e instanceof Error ? e.message : String(e); }

    await sleep(300);
    try { const r = await fetchNewsSentiment(symbol, finnhubKey); newsSentiment = r.data; if (r.error) fetchErrors.news_sentiment = r.error; } catch (e: unknown) { fetchErrors.news_sentiment = e instanceof Error ? e.message : String(e); }
  } else {
    fetchErrors.finnhub = 'FINNHUB_API_KEY not configured';
  }

  const input: ConvergenceInput = {
    symbol,
    ttScanner: null,
    candles: [],
    finnhubFundamentals: finnhubData.fundamentals,
    finnhubRecommendations: finnhubData.recommendations,
    finnhubInsiderSentiment: finnhubData.insiderSentiment,
    finnhubEarnings: finnhubData.earnings,
    fredMacro: fredData,
    annualFinancials,
    optionsFlow,
    newsSentiment,
  };

  let scoring: FullScoringResult;
  try {
    scoring = scoreAll(input);
  } catch (e: unknown) {
    return {
      symbol, status: 'FAILURE', composite: null, vol_edge: null, quality: null, regime: null, info_edge: null,
      strategy: null, data_gaps: [], fetch_errors: fetchErrors, error: e instanceof Error ? e.message : String(e),
      failed_component: 'scoring', runtime_ms: Date.now() - start,
    };
  }

  return {
    symbol, status: 'SUCCESS',
    composite: scoring.composite.score, vol_edge: scoring.vol_edge.score,
    quality: scoring.quality.score, regime: scoring.regime.score, info_edge: scoring.info_edge.score,
    strategy: scoring.strategy_suggestion.suggested_strategy,
    data_gaps: scoring.data_gaps, fetch_errors: fetchErrors, error: null, failed_component: null,
    runtime_ms: Date.now() - start,
  };
}

// ===== FORMATTING =====

function pad(s: string, len: number): string {
  return s.length >= len ? s.slice(0, len) : s + ' '.repeat(len - s.length);
}

function padNum(n: number | null, len: number): string {
  const s = n != null ? n.toFixed(1) : 'NULL';
  return s.length >= len ? s.slice(0, len) : ' '.repeat(len - s.length) + s;
}

// ===== MAIN =====

async function main() {
  console.log('='.repeat(120));
  console.log('PIPELINE STRESS TEST — 20 tickers, sequential, 4s delay');
  console.log('='.repeat(120));
  console.log();

  const finnhubKey = process.env.FINNHUB_API_KEY || null;
  const fredKey = process.env.FRED_API_KEY || null;

  console.log(`[Config] FINNHUB_API_KEY: ${finnhubKey ? 'set' : 'NOT SET'}`);
  console.log(`[Config] FRED_API_KEY: ${fredKey ? 'set' : 'NOT SET'}`);
  console.log();

  // Fetch FRED macro data once (shared across all tickers)
  console.log('[FRED] Fetching macro data...');
  let fredData: FredMacroData;
  let fredError: string | null = null;
  if (fredKey) {
    try {
      const result = await fetchFredMacro(fredKey);
      fredData = result.data;
      fredError = result.error;
      console.log(`[FRED] Done.${fredError ? ` Errors: ${fredError}` : ''}`);
      console.log(`[FRED] Values: VIX=${fredData.vix} T10Y=${fredData.treasury10y} FedFunds=${fredData.fedFunds} Unemp=${fredData.unemployment} GDP=${fredData.gdp} CPI=${fredData.cpi} CPI_MoM=${fredData.cpiMom} CC=${fredData.consumerConfidence} NFP=${fredData.nonfarmPayrolls}`);
    } catch (e: unknown) {
      fredError = e instanceof Error ? e.message : String(e);
      fredData = { vix: null, treasury10y: null, fedFunds: null, unemployment: null, cpi: null, gdp: null, consumerConfidence: null, nonfarmPayrolls: null, cpiMom: null, sofr: null };
      console.log(`[FRED] FAILED: ${fredError}`);
    }
  } else {
    fredData = { vix: null, treasury10y: null, fedFunds: null, unemployment: null, cpi: null, gdp: null, consumerConfidence: null, nonfarmPayrolls: null, cpiMom: null, sofr: null };
    fredError = 'FRED_API_KEY not configured';
    console.log(`[FRED] Skipped: ${fredError}`);
  }
  console.log();

  const results: TickerResult[] = [];

  for (let i = 0; i < TICKERS.length; i++) {
    const symbol = TICKERS[i];
    console.log(`[${i + 1}/${TICKERS.length}] Running ${symbol}...`);

    const result = await runSingleTicker(symbol, fredData, finnhubKey);
    results.push(result);

    if (result.status === 'SUCCESS') {
      console.log(`  OK ${symbol}: composite=${result.composite} vol=${result.vol_edge} qual=${result.quality} reg=${result.regime} info=${result.info_edge} strat="${result.strategy}" gaps=${result.data_gaps.length} (${result.runtime_ms}ms)`);
    } else {
      console.log(`  FAIL ${symbol}: [${result.failed_component}] ${result.error} (${result.runtime_ms}ms)`);
    }

    const errorKeys = Object.keys(result.fetch_errors);
    if (errorKeys.length > 0) {
      for (const src of errorKeys) {
        console.log(`    warn ${src}: ${result.fetch_errors[src]}`);
      }
    }

    if (i < TICKERS.length - 1) {
      await sleep(DELAY_BETWEEN_TICKERS_MS);
    }
  }

  // ===== SUMMARY TABLE =====
  console.log();
  console.log('='.repeat(130));
  console.log('SUMMARY TABLE');
  console.log('='.repeat(130));
  const header =
    pad('Ticker', 8) + pad('Status', 10) +
    padNum(null, 0) + pad('Composite', 11) +
    pad('Vol-Edge', 10) + pad('Quality', 10) +
    pad('Regime', 10) + pad('Info-Edge', 11) +
    pad('Strategy', 22) + pad('Gaps', 6) + pad('Runtime', 10);
  console.log(header);
  console.log('-'.repeat(130));

  for (const r of results) {
    console.log(
      pad(r.symbol, 8) + pad(r.status, 10) +
      padNum(r.composite, 11) + padNum(r.vol_edge, 10) +
      padNum(r.quality, 10) + padNum(r.regime, 10) +
      padNum(r.info_edge, 11) + pad(r.strategy || 'N/A', 22) +
      padNum(r.data_gaps.length, 6) + padNum(r.runtime_ms, 10)
    );
  }

  // ===== FAILURE REPORT =====
  const failures = results.filter(r => r.status === 'FAILURE');
  console.log();
  console.log('='.repeat(130));
  console.log(`FAILURE REPORT (${failures.length}/${results.length} failed)`);
  console.log('='.repeat(130));
  if (failures.length === 0) {
    console.log('No failures.');
  } else {
    for (const f of failures) {
      console.log(`  ${f.symbol}: [${f.failed_component}] ${f.error}`);
      for (const [src, err] of Object.entries(f.fetch_errors)) {
        console.log(`    fetch_error: ${src} = ${err}`);
      }
    }
  }

  // ===== PARTIAL FAILURES =====
  const partials = results.filter(r =>
    r.status === 'SUCCESS' && (
      r.composite === 0 || r.vol_edge === 0 || r.quality === 0 || r.regime === 0 || r.info_edge === 0 ||
      r.composite == null || r.vol_edge == null || r.quality == null || r.regime == null || r.info_edge == null
    )
  );
  console.log();
  console.log('='.repeat(130));
  console.log(`PARTIAL FAILURES — tickers with any category score = 0 or null (${partials.length}/${results.length})`);
  console.log('='.repeat(130));
  if (partials.length === 0) {
    console.log('None.');
  } else {
    for (const p of partials) {
      const issues: string[] = [];
      if (p.composite === 0 || p.composite == null) issues.push(`composite=${p.composite}`);
      if (p.vol_edge === 0 || p.vol_edge == null) issues.push(`vol_edge=${p.vol_edge}`);
      if (p.quality === 0 || p.quality == null) issues.push(`quality=${p.quality}`);
      if (p.regime === 0 || p.regime == null) issues.push(`regime=${p.regime}`);
      if (p.info_edge === 0 || p.info_edge == null) issues.push(`info_edge=${p.info_edge}`);
      console.log(`  ${p.symbol}: ${issues.join(', ')}`);
    }
  }

  // ===== DATA GAPS REPORT =====
  console.log();
  console.log('='.repeat(130));
  console.log('DATA GAPS REPORT');
  console.log('='.repeat(130));
  const gapCounts = new Map<string, string[]>();
  for (const r of results) {
    for (const gap of r.data_gaps) {
      const existing = gapCounts.get(gap) || [];
      existing.push(r.symbol);
      gapCounts.set(gap, existing);
    }
  }
  if (gapCounts.size === 0) {
    console.log('No data gaps.');
  } else {
    for (const [gap, tickers] of gapCounts) {
      console.log(`  [${tickers.length}/${results.length} tickers] ${gap}`);
      if (tickers.length <= 5) {
        console.log(`    Affected: ${tickers.join(', ')}`);
      }
    }
  }

  // ===== FETCH ERRORS REPORT =====
  console.log();
  console.log('='.repeat(130));
  console.log('FETCH ERRORS REPORT');
  console.log('='.repeat(130));
  const errorCounts = new Map<string, { error: string; tickers: string[] }>();
  for (const r of results) {
    for (const [src, err] of Object.entries(r.fetch_errors)) {
      const key = `${src}: ${err}`;
      const existing = errorCounts.get(key) || { error: err, tickers: [] };
      existing.tickers.push(r.symbol);
      errorCounts.set(key, existing);
    }
  }
  if (errorCounts.size === 0) {
    console.log('No fetch errors.');
  } else {
    for (const [key, { tickers }] of errorCounts) {
      console.log(`  [${tickers.length}/${results.length} tickers] ${key}`);
      if (tickers.length <= 5) {
        console.log(`    Affected: ${tickers.join(', ')}`);
      }
    }
  }

  if (fredError) {
    console.log(`  [FRED global] ${fredError}`);
  }

  // ===== RATE LIMIT CHECK =====
  console.log();
  console.log('='.repeat(130));
  console.log('RATE LIMIT CHECK');
  console.log('='.repeat(130));
  const rateLimitErrors = results.filter(r =>
    Object.values(r.fetch_errors).some(e => /429|rate.limit/i.test(e))
  );
  if (rateLimitErrors.length > 0) {
    console.log(`  WARNING: ${rateLimitErrors.length} tickers hit rate limits: ${rateLimitErrors.map(r => r.symbol).join(', ')}`);
  } else {
    console.log('  No rate limit errors detected.');
  }

  // ===== FINAL SUMMARY =====
  console.log();
  console.log('='.repeat(130));
  const successCount = results.filter(r => r.status === 'SUCCESS').length;
  console.log(`DONE: ${successCount}/${results.length} succeeded, ${failures.length} failed, ${partials.length} partial.`);
  const totalRuntime = results.reduce((sum, r) => sum + r.runtime_ms, 0);
  console.log(`Total scoring runtime: ${totalRuntime}ms (excludes 4s inter-ticker delays)`);
  console.log('='.repeat(130));
}

main().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
