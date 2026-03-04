import type {
  CandleData,
  FinnhubFundamentals,
  FinnhubRecommendation,
  FinnhubInsiderSentiment,
  FinnhubEarnings,
  FinnhubEstimateData,
  FinnhubEpsEstimate,
  FinnhubRevenueEstimate,
  FinnhubPriceTarget,
  FinnhubUpgradeDowngrade,
  FredMacroData,
  AnnualFinancials,
  AnnualFinancialPeriod,
  OptionsFlowData,
  NewsSentimentData,
  NewsHeadlineEntry,
  NewsSentimentPeriod,
  FinnhubNewsSentiment,
  FinnhubEarningsQuality,
  FinnhubInstitutionalOwnership,
  FinnhubRevenueBreakdown,
  QuarterlyFinancials,
  SECFilingData,
  QuarterlyFinancialPeriod,
} from './types';
import { classifyNewsHeadlines } from './news-classifier';
import { getTastytradeClient } from '@/lib/tastytrade';
import { CandleType } from '@tastytrade/api';

// ===== TYPES =====

export interface FinnhubData {
  fundamentals: FinnhubFundamentals | null;
  recommendations: FinnhubRecommendation[];
  insiderSentiment: FinnhubInsiderSentiment[];
  earnings: FinnhubEarnings[];
  estimateData: FinnhubEstimateData | null;
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

// ===== FINNHUB ESTIMATE CACHE (1-hour TTL) =====

const estimateCache = new Map<string, { data: FinnhubEstimateData; timestamp: number }>();
const ESTIMATE_CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function fetchFinnhubEstimates(symbol: string, key: string): Promise<FinnhubEstimateData> {
  const cached = estimateCache.get(symbol);
  if (cached && Date.now() - cached.timestamp < ESTIMATE_CACHE_TTL) {
    return cached.data;
  }

  let epsEstimates: FinnhubEpsEstimate[] = [];
  let revenueEstimates: FinnhubRevenueEstimate[] = [];
  let priceTarget: FinnhubPriceTarget | null = null;
  let upgradeDowngrade: FinnhubUpgradeDowngrade[] = [];

  const [epsResp, revResp, ptResp, udResp] = await Promise.all([
    fetchWithRetry(`https://finnhub.io/api/v1/stock/eps-estimate?symbol=${symbol}&freq=quarterly&token=${key}`).catch((e) => { console.error(`[Finnhub] eps-estimate ${symbol} fetch error:`, e instanceof Error ? e.message : String(e)); return null; }),
    fetchWithRetry(`https://finnhub.io/api/v1/stock/revenue-estimate?symbol=${symbol}&freq=quarterly&token=${key}`).catch((e) => { console.error(`[Finnhub] revenue-estimate ${symbol} fetch error:`, e instanceof Error ? e.message : String(e)); return null; }),
    fetchWithRetry(`https://finnhub.io/api/v1/stock/price-target?symbol=${symbol}&token=${key}`).catch((e) => { console.error(`[Finnhub] price-target ${symbol} fetch error:`, e instanceof Error ? e.message : String(e)); return null; }),
    fetchWithRetry(`https://finnhub.io/api/v1/stock/upgrade-downgrade?symbol=${symbol}&token=${key}`).catch((e) => { console.error(`[Finnhub] upgrade-downgrade ${symbol} fetch error:`, e instanceof Error ? e.message : String(e)); return null; }),
  ]);

  if (epsResp?.ok) {
    try {
      const json = await epsResp.json();
      epsEstimates = Array.isArray(json?.data) ? json.data : [];
    } catch (e: unknown) {
      console.error(`[Finnhub] eps-estimate ${symbol}:`, e instanceof Error ? e.message : String(e));
    }
  } else if (epsResp) {
    console.error(`[Finnhub] eps-estimate ${symbol}: HTTP ${epsResp.status}`);
  }

  if (revResp?.ok) {
    try {
      const json = await revResp.json();
      revenueEstimates = Array.isArray(json?.data) ? json.data : [];
    } catch (e: unknown) {
      console.error(`[Finnhub] revenue-estimate ${symbol}:`, e instanceof Error ? e.message : String(e));
    }
  } else if (revResp) {
    console.error(`[Finnhub] revenue-estimate ${symbol}: HTTP ${revResp.status}`);
  }

  if (ptResp?.ok) {
    try {
      const json = await ptResp.json();
      if (json && typeof json.targetMedian === 'number') {
        priceTarget = json as FinnhubPriceTarget;
      }
    } catch (e: unknown) {
      console.error(`[Finnhub] price-target ${symbol}:`, e instanceof Error ? e.message : String(e));
    }
  } else if (ptResp) {
    console.error(`[Finnhub] price-target ${symbol}: HTTP ${ptResp.status}`);
  }

  if (udResp?.ok) {
    try {
      const json = await udResp.json();
      upgradeDowngrade = Array.isArray(json) ? json : [];
    } catch (e: unknown) {
      console.error(`[Finnhub] upgrade-downgrade ${symbol}:`, e instanceof Error ? e.message : String(e));
    }
  } else if (udResp) {
    console.error(`[Finnhub] upgrade-downgrade ${symbol}: HTTP ${udResp.status}`);
  }

  const result: FinnhubEstimateData = { epsEstimates, revenueEstimates, priceTarget, upgradeDowngrade };

  // Only cache if we got meaningful data — prevents poisoning cache with empty results from rate limits / network errors
  const hasData = epsEstimates.length > 0 || revenueEstimates.length > 0 || priceTarget !== null || upgradeDowngrade.length > 0;
  if (hasData) {
    estimateCache.set(symbol, { data: result, timestamp: Date.now() });
  } else {
    // Clear any stale cached empty entry so next call retries
    estimateCache.delete(symbol);
  }

  console.log(`[DEBUG-ESTIMATES] ${symbol}: eps=${epsEstimates.length}, rev=${revenueEstimates.length}, pt=${priceTarget !== null}, ud=${upgradeDowngrade.length}, cached=${hasData}`);

  return result;
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
      estimateData: null,
    };
  }

  // Fetch all 5 endpoints, each resilient to failure
  let fundamentals: FinnhubFundamentals | null = null;
  let recommendations: FinnhubRecommendation[] = [];
  let insiderSentiment: FinnhubInsiderSentiment[] = [];
  let earnings: FinnhubEarnings[] = [];
  let estimateData: FinnhubEstimateData | null = null;

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
  // Rolling 18-month window for insider sentiment data
  const insiderFrom = new Date(Date.now() - 18 * 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  try {
    const resp = await fetchWithRetry(
      `https://finnhub.io/api/v1/stock/insider-sentiment?symbol=${symbol}&from=${insiderFrom}&token=${key}`,
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

  // 5. Premium estimates (EPS, revenue, price target, upgrade/downgrade)
  try {
    estimateData = await fetchFinnhubEstimates(symbol, key);
  } catch (e: unknown) {
    console.error(`[Finnhub] estimates ${symbol}:`, e instanceof Error ? e.message : String(e));
  }

  return { fundamentals, recommendations, insiderSentiment, earnings, estimateData };
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
    stats.calls_made += 8; // 4 free + 4 premium endpoints per ticker

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
        estimateData: null,
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
    operatingIncome: findConcept(ic, 'OperatingIncomeLoss'),
    incomeTaxExpense: findConcept(ic, 'IncomeTaxExpenseBenefit'),
    preTaxIncome: findConcept(ic, 'IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest', 'IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments'),
    stockholdersEquity: findConcept(bs, 'StockholdersEquity'),
    longTermDebtCurrent: findConcept(bs, 'LongTermDebtCurrent'),
    longTermDebtNoncurrent: findConcept(bs, 'LongTermDebtNoncurrent'),
    cashAndEquivalents: findConcept(bs, 'CashAndCashEquivalentsAtCarryingValue', 'CashCashEquivalentsAndShortTermInvestments'),
    weightedAvgShares: findConcept(ic, 'WeightedAverageNumberOfSharesOutstandingBasic', 'WeightedAverageNumberOfDilutedSharesOutstanding'),
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

// ===== QUARTERLY FINANCIALS FETCHER (bs/ic/cf, up to 40 quarters) =====

const quarterlyFinancialsCache = new Map<string, { data: QuarterlyFinancials; fetchedAt: number }>();
const QUARTERLY_FINANCIALS_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

/**
 * Fetches up to 40 quarters of balance sheet, income statement, and cash flow
 * from Finnhub's /stock/financials endpoint (standardized, not reported).
 */
export async function fetchQuarterlyFinancials(
  symbol: string,
  apiKey?: string,
): Promise<{ data: QuarterlyFinancials | null; error: string | null }> {
  const cached = quarterlyFinancialsCache.get(symbol);
  if (cached && Date.now() - cached.fetchedAt < QUARTERLY_FINANCIALS_CACHE_TTL) {
    return { data: cached.data, error: null };
  }

  const key = apiKey || process.env.FINNHUB_API_KEY;
  if (!key) return { data: null, error: 'FINNHUB_API_KEY not configured' };

  try {
    // Three calls: balance sheet, income statement, cash flow
    const [bsResp, icResp, cfResp] = await Promise.all([
      fetchWithRetry(`https://finnhub.io/api/v1/stock/financials?symbol=${symbol}&statement=bs&freq=quarterly&token=${key}`).catch(() => null),
      fetchWithRetry(`https://finnhub.io/api/v1/stock/financials?symbol=${symbol}&statement=ic&freq=quarterly&token=${key}`).catch(() => null),
      fetchWithRetry(`https://finnhub.io/api/v1/stock/financials?symbol=${symbol}&statement=cf&freq=quarterly&token=${key}`).catch(() => null),
    ]);

    type FinRow = Record<string, number | string | null | undefined>;
    type FinResp = { financials?: FinRow[] };

    const bsData: FinRow[] = bsResp?.ok ? ((await bsResp.json()) as FinResp)?.financials ?? [] : [];
    const icData: FinRow[] = icResp?.ok ? ((await icResp.json()) as FinResp)?.financials ?? [] : [];
    const cfData: FinRow[] = cfResp?.ok ? ((await cfResp.json()) as FinResp)?.financials ?? [] : [];

    if (bsData.length === 0 && icData.length === 0 && cfData.length === 0) {
      return { data: null, error: 'quarterly-financials: no data from any statement endpoint' };
    }

    // Index by period string for cross-statement join
    const bsByPeriod = new Map<string, FinRow>();
    for (const row of bsData) {
      const p = String(row['period'] ?? '');
      if (p) bsByPeriod.set(p, row);
    }
    const icByPeriod = new Map<string, FinRow>();
    for (const row of icData) {
      const p = String(row['period'] ?? '');
      if (p) icByPeriod.set(p, row);
    }
    const cfByPeriod = new Map<string, FinRow>();
    for (const row of cfData) {
      const p = String(row['period'] ?? '');
      if (p) cfByPeriod.set(p, row);
    }

    // Collect all unique periods
    const allPeriods = new Set([...bsByPeriod.keys(), ...icByPeriod.keys(), ...cfByPeriod.keys()]);
    const periods: QuarterlyFinancialPeriod[] = [];

    const num = (row: FinRow | undefined, ...keys: string[]): number | null => {
      if (!row) return null;
      for (const k of keys) {
        const v = row[k];
        if (typeof v === 'number' && isFinite(v)) return v;
      }
      return null;
    };

    for (const period of allPeriods) {
      const bs = bsByPeriod.get(period);
      const ic = icByPeriod.get(period);
      const cf = cfByPeriod.get(period);

      const d = new Date(period);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const quarter = month <= 3 ? 1 : month <= 6 ? 2 : month <= 9 ? 3 : 4;

      const totalCurrentAssets = num(bs, 'totalCurrentAssets', 'currentAssets');
      const totalCurrentLiabilities = num(bs, 'totalCurrentLiabilities', 'currentLiabilities');
      const workingCapital = totalCurrentAssets !== null && totalCurrentLiabilities !== null
        ? totalCurrentAssets - totalCurrentLiabilities : null;
      const operatingCashFlow = num(cf, 'netCashProvidedByOperatingActivities', 'operatingCashflow', 'cashFromOperatingActivities');
      const capitalExpenditure = num(cf, 'capitalExpenditure', 'capitalExpenditures', 'purchaseOfPropertyPlantAndEquipment');
      const capexAbs = capitalExpenditure !== null ? Math.abs(capitalExpenditure) : null;
      const freeCashFlow = operatingCashFlow !== null && capexAbs !== null
        ? operatingCashFlow - capexAbs : null;

      periods.push({
        period,
        year,
        quarter,
        totalAssets: num(bs, 'totalAssets'),
        totalCurrentAssets,
        totalCurrentLiabilities,
        totalLiabilities: num(bs, 'totalLiabilities'),
        stockholdersEquity: num(bs, 'totalStockholderEquity', 'stockholdersEquity', 'totalEquity'),
        retainedEarnings: num(bs, 'retainedEarnings'),
        longTermDebt: num(bs, 'longTermDebt', 'longTermDebtNoncurrent'),
        cashAndEquivalents: num(bs, 'cashAndCashEquivalents', 'cashAndShortTermInvestments', 'cash'),
        totalDebt: num(bs, 'totalDebt', 'netDebt'),
        workingCapital,
        sharesOutstanding: num(bs, 'commonStockSharesOutstanding', 'sharesOutstanding'),
        revenue: num(ic, 'revenue', 'totalRevenue', 'netRevenue'),
        netIncome: num(ic, 'netIncome', 'netIncomeLoss'),
        operatingIncome: num(ic, 'operatingIncome', 'operatingIncomeLoss'),
        ebit: num(ic, 'ebit', 'operatingIncome', 'operatingIncomeLoss'),
        grossProfit: num(ic, 'grossProfit'),
        operatingCashFlow,
        capitalExpenditure: capexAbs,
        freeCashFlow,
      });
    }

    // Sort newest first
    periods.sort((a, b) => b.period.localeCompare(a.period));

    const result: QuarterlyFinancials = {
      symbol,
      periods,
      quarterCount: periods.length,
    };

    quarterlyFinancialsCache.set(symbol, { data: result, fetchedAt: Date.now() });
    return { data: result, error: null };
  } catch (e: unknown) {
    return { data: null, error: `quarterly-financials: ${e instanceof Error ? e.message : String(e)}` };
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
      cpi: null, gdp: null, consumerConfidence: null, nonfarmPayrolls: null, cpiMom: null,
      yieldCurveSpread: null, breakeven5y: null, hySpread: null, nfci: null, initialClaims: null,
      initialClaimsDate: null, nfciDate: null,
    };
    return { data: empty, cached: false, error: 'FRED_API_KEY not configured' };
  }

  // Simple series: single latest observation is the correct value
  // GDP, NFP, and CPI are handled separately below (need rate-of-change computation)
  const seriesMap: { key: keyof FredMacroData; id: string; trackDate?: boolean }[] = [
    { key: 'vix', id: 'VIXCLS' },
    { key: 'treasury10y', id: 'DGS10' },
    { key: 'fedFunds', id: 'FEDFUNDS' },
    { key: 'unemployment', id: 'UNRATE' },
    { key: 'gdp', id: 'A191RL1Q225SBEA' },  // Real GDP growth rate (quarterly annualized %)
    { key: 'consumerConfidence', id: 'UMCSENT' },
    // Institutional-grade series for regime classification
    { key: 'yieldCurveSpread', id: 'T10Y2Y' },         // 10Y-2Y Treasury spread (daily)
    { key: 'breakeven5y', id: 'T5YIE' },                // 5-Year breakeven inflation (daily)
    { key: 'hySpread', id: 'BAMLH0A0HYM2' },            // ICE BofA HY credit spread (daily)
    { key: 'nfci', id: 'NFCI', trackDate: true },        // Chicago Fed Financial Conditions (weekly)
    { key: 'initialClaims', id: 'ICSA', trackDate: true }, // Initial jobless claims (weekly)
  ];

  const result: FredMacroData = {
    vix: null, treasury10y: null, fedFunds: null, unemployment: null,
    cpi: null, gdp: null, consumerConfidence: null, nonfarmPayrolls: null, cpiMom: null,
    yieldCurveSpread: null, breakeven5y: null, hySpread: null, nfci: null, initialClaims: null,
    initialClaimsDate: null, nfciDate: null,
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
          (result as unknown as Record<string, number | string | null>)[series.key] = parseFloat(obs[0].value);
          // Track observation date for weekly series (staleness detection)
          if (series.trackDate && obs[0].date) {
            const dateKey = series.key === 'initialClaims' ? 'initialClaimsDate' : 'nfciDate';
            (result as unknown as Record<string, number | string | null>)[dateKey] = obs[0].date;
          }
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

// ===== FINNHUB OPTIONS FLOW FETCHER (with 1-hour cache) =====

interface FinnhubOptionEntry {
  contractName?: string;
  strike?: number;
  lastPrice?: number;
  volume?: number;
  openInterest?: number;
  impliedVolatility?: number;
}

interface FinnhubOptionChainExpiration {
  expirationDate: string;
  options: {
    CALL?: FinnhubOptionEntry[];
    PUT?: FinnhubOptionEntry[];
  };
}

const optionsFlowCache = new Map<string, { data: OptionsFlowData; fetchedAt: number }>();
const OPTIONS_FLOW_CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function fetchOptionsFlow(
  symbol: string,
  apiKey?: string,
): Promise<{ data: OptionsFlowData | null; error: string | null }> {
  // Check cache
  const cached = optionsFlowCache.get(symbol);
  if (cached && Date.now() - cached.fetchedAt < OPTIONS_FLOW_CACHE_TTL) {
    return { data: cached.data, error: null };
  }

  const key = apiKey || process.env.FINNHUB_API_KEY;
  if (!key) return { data: null, error: 'FINNHUB_API_KEY not configured' };

  try {
    const resp = await fetchWithRetry(
      `https://finnhub.io/api/v1/stock/option-chain?symbol=${symbol}&token=${key}`,
    );
    if (!resp.ok) {
      return { data: null, error: `option-chain: HTTP ${resp.status}` };
    }

    const json = await resp.json();
    const expirations: FinnhubOptionChainExpiration[] = json?.data || [];

    if (expirations.length === 0) {
      return { data: null, error: 'option-chain: no expirations returned' };
    }

    // Filter to expirations within 60 days (exclude LEAPS)
    const now = new Date();
    const maxDate = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    const nearTermExps = expirations.filter(exp => {
      const expDate = new Date(exp.expirationDate);
      return expDate >= now && expDate <= maxDate;
    });

    if (nearTermExps.length === 0) {
      return { data: null, error: 'option-chain: no expirations within 60 DTE' };
    }

    // Determine underlying price from ATM strikes
    // Use the first expiration's smallest |call - put| price as ATM proxy
    let underlyingPrice: number | null = null;
    for (const exp of nearTermExps) {
      const calls = exp.options.CALL || [];
      const puts = exp.options.PUT || [];
      let bestStrike: number | null = null;
      let smallestDiff = Infinity;
      for (const call of calls) {
        if (call.strike == null || call.lastPrice == null) continue;
        const matchingPut = puts.find(p => p.strike === call.strike);
        if (!matchingPut?.lastPrice) continue;
        const diff = Math.abs(call.lastPrice - matchingPut.lastPrice);
        if (diff < smallestDiff) {
          smallestDiff = diff;
          bestStrike = call.strike;
        }
      }
      if (bestStrike !== null) {
        underlyingPrice = bestStrike;
        break;
      }
    }

    // Aggregate across all near-term expirations
    let totalCallVolume = 0;
    let totalPutVolume = 0;
    let totalCallOI = 0;
    let totalPutOI = 0;
    let otmCallVolume = 0;
    let otmPutVolume = 0;
    let highActivityStrikes = 0;
    let strikesWithOI = 0;
    let strikesAnalyzed = 0;

    for (const exp of nearTermExps) {
      const calls = exp.options.CALL || [];
      const puts = exp.options.PUT || [];

      for (const call of calls) {
        const vol = call.volume || 0;
        const oi = call.openInterest || 0;
        totalCallVolume += vol;
        totalCallOI += oi;
        strikesAnalyzed++;

        if (underlyingPrice !== null && call.strike != null && call.strike > underlyingPrice) {
          otmCallVolume += vol;
        }

        if (oi > 0) {
          strikesWithOI++;
          if (vol > 2 * oi) highActivityStrikes++;
        }
      }

      for (const put of puts) {
        const vol = put.volume || 0;
        const oi = put.openInterest || 0;
        totalPutVolume += vol;
        totalPutOI += oi;
        strikesAnalyzed++;

        if (underlyingPrice !== null && put.strike != null && put.strike < underlyingPrice) {
          otmPutVolume += vol;
        }

        if (oi > 0) {
          strikesWithOI++;
          if (vol > 2 * oi) highActivityStrikes++;
        }
      }
    }

    // Put/Call Ratio
    const putCallRatio = totalCallVolume > 0
      ? Math.round((totalPutVolume / totalCallVolume) * 1000) / 1000
      : null;

    // Volume Bias: (otmCallVol - otmPutVol) / (otmCallVol + otmPutVol) * 100
    const totalOtm = otmCallVolume + otmPutVolume;
    const volumeBias = totalOtm > 0
      ? Math.round(((otmCallVolume - otmPutVolume) / totalOtm) * 10000) / 100
      : null;

    // Unusual Activity Ratio: high_activity_count / total_strikes_with_oi
    const unusualActivityRatio = strikesWithOI > 0
      ? Math.round((highActivityStrikes / strikesWithOI) * 1000) / 1000
      : null;

    const result: OptionsFlowData = {
      put_call_ratio: putCallRatio,
      volume_bias: volumeBias,
      unusual_activity_ratio: unusualActivityRatio,
      total_call_volume: totalCallVolume,
      total_put_volume: totalPutVolume,
      total_call_oi: totalCallOI,
      total_put_oi: totalPutOI,
      strikes_analyzed: strikesAnalyzed,
      high_activity_strikes: highActivityStrikes,
      expirations_analyzed: nearTermExps.length,
    };

    // Cache
    optionsFlowCache.set(symbol, { data: result, fetchedAt: Date.now() });

    return { data: result, error: null };
  } catch (e: unknown) {
    return { data: null, error: `option-chain: ${e instanceof Error ? e.message : String(e)}` };
  }
}

// ===== FINNHUB NEWS SENTIMENT FETCHER (with 30-minute cache) =====

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
  const matchedKeywords: string[] = [];
  let bullishCount = 0;
  let bearishCount = 0;

  for (const kw of BULLISH_KEYWORDS) {
    // Word boundary matching: keyword must appear as a whole word
    const pattern = new RegExp(`\\b${kw}\\b`, 'i');
    if (pattern.test(lower)) {
      bullishCount++;
      matchedKeywords.push(kw);
    }
  }

  for (const kw of BEARISH_KEYWORDS) {
    const pattern = new RegExp(`\\b${kw}\\b`, 'i');
    if (pattern.test(lower)) {
      bearishCount++;
      matchedKeywords.push(kw);
    }
  }

  let sentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  if (bullishCount > bearishCount) sentiment = 'bullish';
  else if (bearishCount > bullishCount) sentiment = 'bearish';

  return { sentiment, keywords: matchedKeywords };
}

function computePeriodSentiment(headlines: NewsHeadlineEntry[]): NewsSentimentPeriod {
  let bullish = 0;
  let bearish = 0;
  let neutral = 0;
  let bullishWeight = 0;
  let bearishWeight = 0;

  for (const h of headlines) {
    const conf = h.confidence ?? 1.0;
    if (h.sentiment === 'bullish') { bullish++; bullishWeight += conf; }
    else if (h.sentiment === 'bearish') { bearish++; bearishWeight += conf; }
    else neutral++;
  }

  const total = headlines.length;
  // Confidence-weighted sentiment: 50 + ((bullishWeight - bearishWeight) / total) × 50
  // When all confidence=1.0: identical to old formula ((bullish - bearish + total) / (2*total)) * 100
  // With LLM confidence: high-confidence classifications count more than low-confidence
  const score = total > 0
    ? Math.round(Math.max(0, Math.min(100, 50 + ((bullishWeight - bearishWeight) / total) * 50)) * 100) / 100
    : 50;

  return { bullish_matches: bullish, bearish_matches: bearish, neutral, score };
}

// ===== SEC EDGAR XBRL FILING FETCHER =====

const SEC_USER_AGENT = 'TempleStuart/1.0 (astuart@templestuart.com)';

// CIK cache: CIK never changes, cache 30 days
const cikCache = new Map<string, { cik: string; fetchedAt: number }>();
const CIK_CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

async function lookupCIK(
  symbol: string,
  finnhubApiKey?: string,
): Promise<string | null> {
  const cached = cikCache.get(symbol);
  if (cached && Date.now() - cached.fetchedAt < CIK_CACHE_TTL) {
    return cached.cik;
  }

  const key = finnhubApiKey || process.env.FINNHUB_API_KEY;
  if (!key) return null;

  try {
    const resp = await fetchWithRetry(
      `https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${key}`,
    );
    if (!resp.ok) return null;
    const json = await resp.json();
    const cik = json?.cik;
    if (!cik) return null;

    // Pad CIK to 10 digits (SEC format)
    const paddedCik = String(cik).padStart(10, '0');
    cikCache.set(symbol, { cik: paddedCik, fetchedAt: Date.now() });
    return paddedCik;
  } catch {
    return null;
  }
}

// SEC filing data cache: 1 hour
const secFilingCache = new Map<string, { data: SECFilingData; fetchedAt: number }>();
const SEC_FILING_CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function fetchSECFilingData(
  symbol: string,
  finnhubApiKey?: string,
): Promise<{ data: SECFilingData | null; error: string | null }> {
  const cached = secFilingCache.get(symbol);
  if (cached && Date.now() - cached.fetchedAt < SEC_FILING_CACHE_TTL) {
    return { data: cached.data, error: null };
  }

  // Step 1: Look up CIK
  const cik = await lookupCIK(symbol, finnhubApiKey);
  if (!cik) {
    return { data: null, error: 'sec-edgar: CIK lookup failed' };
  }

  try {
    // Step 2: Fetch company facts from EDGAR XBRL
    const resp = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, {
      headers: { 'User-Agent': SEC_USER_AGENT },
    });

    if (!resp.ok) {
      return { data: null, error: `sec-edgar: HTTP ${resp.status}` };
    }

    const json = await resp.json();
    const facts = json?.facts;
    if (!facts) {
      return { data: null, error: 'sec-edgar: no facts in response' };
    }

    // Parse US-GAAP facts (prefer over DEI for financial data)
    const usGaap = facts['us-gaap'] ?? {};
    const dei = facts['dei'] ?? {};

    // Helper: get the most recent filing unit value for a concept
    type FactUnit = { end?: string; val?: number; form?: string; filed?: string; fy?: number; fp?: string };
    const getLatest = (concept: Record<string, { units?: Record<string, FactUnit[]> }> | undefined, ...names: string[]): FactUnit | null => {
      if (!concept) return null;
      for (const name of names) {
        const entry = concept[name];
        const units = entry?.units;
        if (!units) continue;
        // Try USD first, then shares, then any
        const values = units['USD'] ?? units['USD/shares'] ?? units['shares'] ?? Object.values(units)[0];
        if (!Array.isArray(values) || values.length === 0) continue;
        // Sort by filed date descending, filter to 10-Q/10-K
        const filings = values
          .filter((v: FactUnit) => v.form === '10-Q' || v.form === '10-K')
          .sort((a: FactUnit, b: FactUnit) => (b.filed ?? '').localeCompare(a.filed ?? ''));
        if (filings.length > 0) return filings[0];
      }
      return null;
    };

    // Find the most recent filing
    const latestEps = getLatest(usGaap, 'EarningsPerShareBasic', 'EarningsPerShareDiluted');
    const latestRevenue = getLatest(usGaap, 'Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet', 'RevenueFromContractWithCustomerIncludingAssessedTax');
    const latestNetIncome = getLatest(usGaap, 'NetIncomeLoss');

    // Determine the most recent filing date across all facts
    const allLatest = [latestEps, latestRevenue, latestNetIncome].filter(Boolean) as FactUnit[];
    if (allLatest.length === 0) {
      return { data: null, error: 'sec-edgar: no 10-Q/10-K filings found in XBRL data' };
    }

    allLatest.sort((a, b) => (b.filed ?? '').localeCompare(a.filed ?? ''));
    const mostRecent = allLatest[0];
    const filedDate = mostRecent.filed ?? '';
    const filingType = mostRecent.form ?? 'unknown';

    // Compute filing age in hours
    const filedTime = new Date(filedDate).getTime();
    const filingAgeHours = isNaN(filedTime) ? Infinity : Math.round((Date.now() - filedTime) / (60 * 60 * 1000));

    // Determine fiscal period
    const fy = mostRecent.fy ?? 0;
    const fp = mostRecent.fp ?? '';
    const fiscalPeriod = filingType === '10-K' ? `FY ${fy}` : `${fp} ${fy}`;

    const result: SECFilingData = {
      cik,
      latestFilingDate: filedDate,
      latestFilingType: filingType,
      filingAgeHours,
      epsActual: latestEps?.val ?? null,
      revenueActual: latestRevenue?.val ?? null,
      netIncomeActual: latestNetIncome?.val ?? null,
      fiscalPeriod,
    };

    secFilingCache.set(symbol, { data: result, fetchedAt: Date.now() });
    return { data: result, error: null };
  } catch (e: unknown) {
    return { data: null, error: `sec-edgar: ${e instanceof Error ? e.message : String(e)}` };
  }
}

// ===== FINNHUB INSTITUTIONAL OWNERSHIP FETCHER =====

const institutionalOwnershipCache = new Map<string, { data: FinnhubInstitutionalOwnership; fetchedAt: number }>();
const INSTITUTIONAL_OWNERSHIP_CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function fetchFinnhubInstitutionalOwnership(
  symbol: string,
  apiKey?: string,
): Promise<{ data: FinnhubInstitutionalOwnership | null; error: string | null }> {
  const cached = institutionalOwnershipCache.get(symbol);
  if (cached && Date.now() - cached.fetchedAt < INSTITUTIONAL_OWNERSHIP_CACHE_TTL) {
    return { data: cached.data, error: null };
  }

  const key = apiKey || process.env.FINNHUB_API_KEY;
  if (!key) return { data: null, error: 'FINNHUB_API_KEY not configured' };

  try {
    // Fetch both ownership endpoints in parallel
    const [ownershipResp, fundResp] = await Promise.all([
      fetchWithRetry(`https://finnhub.io/api/v1/stock/ownership?symbol=${symbol}&token=${key}`).catch(() => null),
      fetchWithRetry(`https://finnhub.io/api/v1/stock/fund-ownership?symbol=${symbol}&token=${key}`).catch(() => null),
    ]);

    type OwnershipEntry = { share?: number; change?: number; filingDate?: string };

    let holders: OwnershipEntry[] = [];

    if (ownershipResp?.ok) {
      try {
        const json = await ownershipResp.json();
        if (Array.isArray(json?.ownership)) holders.push(...(json.ownership as OwnershipEntry[]));
      } catch { /* ignore parse errors */ }
    }

    if (fundResp?.ok) {
      try {
        const json = await fundResp.json();
        if (Array.isArray(json?.ownership)) holders.push(...(json.ownership as OwnershipEntry[]));
      } catch { /* ignore parse errors */ }
    }

    if (holders.length === 0) {
      return { data: null, error: 'institutional-ownership: no data from either endpoint' };
    }

    let totalShares = 0;
    let totalChange = 0;
    let netBuyers = 0;
    let netSellers = 0;
    let latestFilingDate: string | null = null;

    for (const h of holders) {
      totalShares += h.share ?? 0;
      const change = h.change ?? 0;
      totalChange += change;
      if (change > 0) netBuyers++;
      else if (change < 0) netSellers++;
      if (h.filingDate && (!latestFilingDate || h.filingDate > latestFilingDate)) {
        latestFilingDate = h.filingDate;
      }
    }

    const result: FinnhubInstitutionalOwnership = {
      totalInstitutionalShares: totalShares,
      totalInstitutionalChange: totalChange,
      topHolderCount: holders.length,
      netBuyerCount: netBuyers,
      netSellerCount: netSellers,
      latestFilingDate,
    };

    institutionalOwnershipCache.set(symbol, { data: result, fetchedAt: Date.now() });
    return { data: result, error: null };
  } catch (e: unknown) {
    return { data: null, error: `institutional-ownership: ${e instanceof Error ? e.message : String(e)}` };
  }
}

// ===== FINNHUB REVENUE BREAKDOWN FETCHER =====

const revenueBreakdownCache = new Map<string, { data: FinnhubRevenueBreakdown; fetchedAt: number }>();
const REVENUE_BREAKDOWN_CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function fetchFinnhubRevenueBreakdown(
  symbol: string,
  apiKey?: string,
): Promise<{ data: FinnhubRevenueBreakdown | null; error: string | null }> {
  const cached = revenueBreakdownCache.get(symbol);
  if (cached && Date.now() - cached.fetchedAt < REVENUE_BREAKDOWN_CACHE_TTL) {
    return { data: cached.data, error: null };
  }

  const key = apiKey || process.env.FINNHUB_API_KEY;
  if (!key) return { data: null, error: 'FINNHUB_API_KEY not configured' };

  try {
    const resp = await fetchWithRetry(
      `https://finnhub.io/api/v1/stock/revenue-breakdown?symbol=${symbol}&token=${key}`,
    );
    if (!resp.ok) {
      return { data: null, error: `revenue-breakdown: HTTP ${resp.status}` };
    }

    const json = await resp.json();
    // Finnhub returns { data: [{ period, revenue: [{ name, value }] }] }
    const entries = json?.data;
    if (!Array.isArray(entries) || entries.length === 0) {
      return { data: null, error: 'revenue-breakdown: no data returned' };
    }

    // Use most recent period
    const latest = entries.sort((a: { period?: string }, b: { period?: string }) =>
      (b.period ?? '').localeCompare(a.period ?? ''),
    )[0];

    const rawSegments: Array<{ name?: string; value?: number }> = latest.revenue ?? [];
    if (!Array.isArray(rawSegments) || rawSegments.length === 0) {
      return { data: null, error: 'revenue-breakdown: no segments in latest period' };
    }

    const segments: Array<{ name: string; revenue: number }> = [];
    let totalRevenue = 0;

    for (const seg of rawSegments) {
      const revenue = typeof seg.value === 'number' ? seg.value : 0;
      if (revenue > 0) {
        segments.push({ name: seg.name ?? 'Unknown', revenue });
        totalRevenue += revenue;
      }
    }

    if (totalRevenue <= 0 || segments.length === 0) {
      return { data: null, error: 'revenue-breakdown: no positive revenue segments' };
    }

    // Compute HHI: sum of (segment_share²)
    let hhi = 0;
    for (const seg of segments) {
      const share = seg.revenue / totalRevenue;
      hhi += share * share;
    }
    hhi = Math.round(hhi * 10000) / 10000; // 4 decimal places

    const result: FinnhubRevenueBreakdown = {
      segments,
      totalRevenue,
      hhi,
    };

    revenueBreakdownCache.set(symbol, { data: result, fetchedAt: Date.now() });
    return { data: result, error: null };
  } catch (e: unknown) {
    return { data: null, error: `revenue-breakdown: ${e instanceof Error ? e.message : String(e)}` };
  }
}

// ===== FINNHUB FINBERT SENTIMENT FETCHER =====

const finbertCache = new Map<string, { data: FinnhubNewsSentiment; fetchedAt: number }>();
const FINBERT_CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function fetchFinnhubNewsSentiment(
  symbol: string,
  apiKey?: string,
): Promise<{ data: FinnhubNewsSentiment | null; error: string | null }> {
  const cached = finbertCache.get(symbol);
  if (cached && Date.now() - cached.fetchedAt < FINBERT_CACHE_TTL) {
    return { data: cached.data, error: null };
  }

  const key = apiKey || process.env.FINNHUB_API_KEY;
  if (!key) return { data: null, error: 'FINNHUB_API_KEY not configured' };

  try {
    const resp = await fetchWithRetry(
      `https://finnhub.io/api/v1/news-sentiment?symbol=${symbol}&token=${key}`,
    );
    if (!resp.ok) {
      return { data: null, error: `news-sentiment: HTTP ${resp.status}` };
    }

    const json = await resp.json();
    // Finnhub returns { buzz: {}, sentiment: {}, companyNewsScore, ... }
    const sentiment = json?.sentiment;
    const buzz = json?.buzz;

    if (!sentiment || typeof json.companyNewsScore !== 'number') {
      return { data: null, error: 'news-sentiment: no data or missing companyNewsScore' };
    }

    const result: FinnhubNewsSentiment = {
      companyNewsScore: json.companyNewsScore,
      sectorAverageNewsScore: typeof json.sectorAverageNewsScore === 'number' ? json.sectorAverageNewsScore : null,
      sectorAverageBullishPercent: typeof json.sectorAverageBullishPercent === 'number' ? json.sectorAverageBullishPercent : null,
      buzz: typeof buzz?.buzz === 'number' ? buzz.buzz : null,
      bullishPercent: typeof sentiment?.bullishPercent === 'number' ? sentiment.bullishPercent : null,
      bearishPercent: typeof sentiment?.bearishPercent === 'number' ? sentiment.bearishPercent : null,
    };

    finbertCache.set(symbol, { data: result, fetchedAt: Date.now() });
    return { data: result, error: null };
  } catch (e: unknown) {
    return { data: null, error: `news-sentiment: ${e instanceof Error ? e.message : String(e)}` };
  }
}

// ===== FINNHUB EARNINGS QUALITY SCORE FETCHER =====

const earningsQualityCache = new Map<string, { data: FinnhubEarningsQuality; fetchedAt: number }>();
const EARNINGS_QUALITY_CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function fetchFinnhubEarningsQuality(
  symbol: string,
  apiKey?: string,
): Promise<{ data: FinnhubEarningsQuality | null; error: string | null }> {
  const cached = earningsQualityCache.get(symbol);
  if (cached && Date.now() - cached.fetchedAt < EARNINGS_QUALITY_CACHE_TTL) {
    return { data: cached.data, error: null };
  }

  const key = apiKey || process.env.FINNHUB_API_KEY;
  if (!key) return { data: null, error: 'FINNHUB_API_KEY not configured' };

  try {
    const resp = await fetchWithRetry(
      `https://finnhub.io/api/v1/stock/earnings-quality-score?symbol=${symbol}&freq=quarterly&token=${key}`,
    );
    if (!resp.ok) {
      return { data: null, error: `earnings-quality-score: HTTP ${resp.status}` };
    }

    const json = await resp.json();
    // Finnhub returns { data: [{ period, score, letterScore }], symbol }
    const entries = json?.data;
    if (!Array.isArray(entries) || entries.length === 0) {
      return { data: null, error: 'earnings-quality-score: no data returned' };
    }

    // Use most recent entry (sorted by period descending)
    const latest = entries.sort((a: { period?: string }, b: { period?: string }) =>
      (b.period ?? '').localeCompare(a.period ?? ''),
    )[0];

    if (typeof latest.score !== 'number') {
      return { data: null, error: 'earnings-quality-score: missing score field' };
    }

    const result: FinnhubEarningsQuality = {
      score: latest.score,
      letterScore: typeof latest.letterScore === 'string' ? latest.letterScore : 'N/A',
    };

    earningsQualityCache.set(symbol, { data: result, fetchedAt: Date.now() });
    return { data: result, error: null };
  } catch (e: unknown) {
    return { data: null, error: `earnings-quality-score: ${e instanceof Error ? e.message : String(e)}` };
  }
}

// ===== NEWS SENTIMENT FETCHER (company-news + keyword/LLM classification) =====

const newsSentimentCache = new Map<string, { data: NewsSentimentData; fetchedAt: number }>();
const NEWS_SENTIMENT_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export async function fetchNewsSentiment(
  symbol: string,
  apiKey?: string,
): Promise<{ data: NewsSentimentData | null; error: string | null }> {
  // Check cache
  const cached = newsSentimentCache.get(symbol);
  if (cached && Date.now() - cached.fetchedAt < NEWS_SENTIMENT_CACHE_TTL) {
    return { data: cached.data, error: null };
  }

  const key = apiKey || process.env.FINNHUB_API_KEY;
  if (!key) return { data: null, error: 'FINNHUB_API_KEY not configured' };

  try {
    const now = new Date();
    const toDate = now.toISOString().slice(0, 10);

    // Split into two API calls to avoid Finnhub's per-request result cap.
    // High-volume tickers (AAPL, TSLA) can return 200+ articles in 7 days alone,
    // filling the entire response and leaving zero articles for the 8-30d period.
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const from7d = sevenDaysAgo.toISOString().slice(0, 10);
    const from30d = thirtyDaysAgo.toISOString().slice(0, 10);
    const to8d = eightDaysAgo.toISOString().slice(0, 10);

    type RawArticle = {
      headline?: string;
      source?: string;
      datetime?: number;
      url?: string;
      summary?: string;
    };

    // Fetch both periods in parallel
    const [resp7d, resp8_30d] = await Promise.all([
      fetchWithRetry(
        `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${from7d}&to=${toDate}&token=${key}`,
      ),
      fetchWithRetry(
        `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${from30d}&to=${to8d}&token=${key}`,
      ),
    ]);

    if (!resp7d.ok) {
      return { data: null, error: `company-news 7d: HTTP ${resp7d.status}` };
    }
    if (!resp8_30d.ok) {
      return { data: null, error: `company-news 8-30d: HTTP ${resp8_30d.status}` };
    }

    const articles7dRaw: RawArticle[] = await resp7d.json();
    const articles8_30dRaw: RawArticle[] = await resp8_30d.json();

    if (!Array.isArray(articles7dRaw) || !Array.isArray(articles8_30dRaw)) {
      return { data: null, error: 'company-news: invalid response format' };
    }

    // Classify articles into headline entries, split by period
    const headlines7d: NewsHeadlineEntry[] = [];
    const headlines8_30d: NewsHeadlineEntry[] = [];
    const allHeadlines: NewsHeadlineEntry[] = [];
    const sourceDistribution: Record<string, number> = {};

    function classifyArticle(article: RawArticle): NewsHeadlineEntry {
      const headline = article.headline || '';
      const source = article.source || '';
      const datetime = article.datetime || 0;
      const url = article.url || '';
      const { sentiment, keywords } = classifyHeadline(headline);
      return { datetime, headline, source, url, sentiment_keywords: keywords, sentiment, confidence: 1.0 };
    }

    for (const article of articles7dRaw) {
      const entry = classifyArticle(article);
      headlines7d.push(entry);
      allHeadlines.push(entry);
      sourceDistribution[entry.source] = (sourceDistribution[entry.source] || 0) + 1;
    }

    for (const article of articles8_30dRaw) {
      const entry = classifyArticle(article);
      headlines8_30d.push(entry);
      allHeadlines.push(entry);
      sourceDistribution[entry.source] = (sourceDistribution[entry.source] || 0) + 1;
    }

    // Sort all headlines by datetime descending (most recent first)
    allHeadlines.sort((a, b) => b.datetime - a.datetime);

    // Attempt LLM classification for improved accuracy (Kirtac & Germano 2024)
    // ~$0.01-0.05 per scan of 50-200 headlines via Haiku
    let classificationMethod: 'llm-haiku' | 'keyword-fallback' = 'keyword-fallback';
    if (allHeadlines.length > 0) {
      try {
        const llmResults = await classifyNewsHeadlines(
          allHeadlines.map(h => h.headline),
          symbol,
        );
        if (llmResults) {
          classificationMethod = 'llm-haiku';
          for (let i = 0; i < allHeadlines.length && i < llmResults.length; i++) {
            allHeadlines[i].sentiment = llmResults[i].sentiment;
            allHeadlines[i].confidence = llmResults[i].confidence;
          }
        }
      } catch {
        // Keep keyword fallback — already classified
      }
    }

    const articles7d = headlines7d.length;
    const articles8_30d = headlines8_30d.length;
    const totalArticles = articles7d + articles8_30d;

    // Buzz ratio: articles_7d / (articles_8_30d / 3.29) — normalized weekly rate comparison
    // 3.29 = 23 days / 7 days (the 8-30d period is ~3.29 weeks)
    const weeklyBaseline = articles8_30d > 0 ? articles8_30d / 3.29 : null;
    const buzzRatio = weeklyBaseline !== null && weeklyBaseline > 0
      ? Math.round((articles7d / weeklyBaseline) * 100) / 100
      : null;

    // Compute sentiment per period
    const sentiment7d = computePeriodSentiment(headlines7d);
    const sentiment8_30d = computePeriodSentiment(headlines8_30d);

    // Sentiment momentum: 7d score - 8-30d score
    const sentimentMomentum = Math.round((sentiment7d.score - sentiment8_30d.score) * 100) / 100;

    // Tier-1 source ratio
    let tier1Count = 0;
    for (const [source, count] of Object.entries(sourceDistribution)) {
      const sourceLower = source.toLowerCase();
      if (TIER1_SOURCES.some(t1 => sourceLower.includes(t1))) {
        tier1Count += count;
      }
    }
    const tier1Ratio = totalArticles > 0
      ? Math.round((tier1Count / totalArticles) * 1000) / 1000
      : 0;

    const result: NewsSentimentData = {
      total_articles_30d: totalArticles,
      articles_7d: articles7d,
      articles_8_30d: articles8_30d,
      buzz_ratio: buzzRatio,
      sentiment_7d: sentiment7d,
      sentiment_8_30d: sentiment8_30d,
      sentiment_momentum: sentimentMomentum,
      source_distribution: sourceDistribution,
      tier1_ratio: tier1Ratio,
      headlines: allHeadlines,
      classification_method: classificationMethod,
    };

    // Cache (LLM classification cached with the result — classify once per 30 min)
    newsSentimentCache.set(symbol, { data: result, fetchedAt: Date.now() });

    return { data: result, error: null };
  } catch (e: unknown) {
    return { data: null, error: `company-news: ${e instanceof Error ? e.message : String(e)}` };
  }
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
