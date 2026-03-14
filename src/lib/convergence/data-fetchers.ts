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
  FredDailyObservation,
  FredDailyHistory,
  SECForm4Transaction,
  SECForm4Data,
  CompanyTextProfile,
  FinnhubEbitdaEstimateEntry,
  FinnhubEbitdaEstimate,
  FinnhubEbitEstimateEntry,
  FinnhubEbitEstimate,
  FinnhubDividendEntry,
  FinnhubDividendHistory,
  FinnhubPriceMetrics,
  FinnhubFundOwnershipEntry,
  FinnhubFundOwnership,
  SECEdgar8KEntry,
  SECEdgar8KScan,
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
      vxvShortTerm: null, vvix: null,
      fedBalanceSheet: null, treasuryGeneralAccount: null, overnightReverseRepo: null,
      bbbSpread: null, t10y3m: null, dollarIndex: null,
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
    // Vol regime
    { key: 'vxvShortTerm', id: 'VXVCLS' },
    { key: 'vvix', id: 'VVIXCLS' },
    // Fed net liquidity
    { key: 'fedBalanceSheet', id: 'WALCL' },
    { key: 'treasuryGeneralAccount', id: 'WTREGEN' },
    { key: 'overnightReverseRepo', id: 'RRPONTSYD' },
    // Credit & rates
    { key: 'bbbSpread', id: 'BAMLC0A4CBBB' },
    { key: 't10y3m', id: 'T10Y3M' },
    { key: 'dollarIndex', id: 'DTWEXBGS' },
  ];

  const result: FredMacroData = {
    vix: null, treasury10y: null, fedFunds: null, unemployment: null,
    cpi: null, gdp: null, consumerConfidence: null, nonfarmPayrolls: null, cpiMom: null,
    yieldCurveSpread: null, breakeven5y: null, hySpread: null, nfci: null, initialClaims: null,
    initialClaimsDate: null, nfciDate: null,
    vxvShortTerm: null, vvix: null,
    fedBalanceSheet: null, treasuryGeneralAccount: null, overnightReverseRepo: null,
    bbbSpread: null, t10y3m: null, dollarIndex: null,
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

// ===== FRED DAILY HISTORY FETCHER (for cross-asset correlations) =====
// Fetches N trading days of daily observations for a given FRED series.
// Used to compute rolling correlations between asset classes (Bridgewater All Weather).

let fredDailyCache: { data: Map<string, FredDailyHistory>; fetchedAt: number } | null = null;
const FRED_DAILY_CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Default series for cross-asset correlations
const CROSS_ASSET_SERIES = ['DGS10', 'SP500', 'DCOILWTICO'] as const;

export async function fetchFredDailySeries(
  seriesIds: readonly string[] = CROSS_ASSET_SERIES,
  tradingDays: number = 252,
  apiKey?: string,
): Promise<{ data: Map<string, FredDailyHistory>; cached: boolean; error: string | null }> {
  // Check cache
  if (fredDailyCache && Date.now() - fredDailyCache.fetchedAt < FRED_DAILY_CACHE_TTL) {
    // Verify all requested series are in cache
    const allCached = seriesIds.every(id => fredDailyCache!.data.has(id));
    if (allCached) {
      return { data: fredDailyCache.data, cached: true, error: null };
    }
  }

  const key = apiKey || process.env.FRED_API_KEY;
  if (!key) {
    return { data: new Map(), cached: false, error: 'FRED_API_KEY not configured' };
  }

  const result = new Map<string, FredDailyHistory>();
  const errors: string[] = [];

  // Fetch ~2x trading days of calendar days to ensure we get enough observations
  // (weekends + holidays mean ~252 trading days ≈ 365 calendar days)
  const calendarDays = Math.ceil(tradingDays * 1.5);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - calendarDays);
  const startStr = startDate.toISOString().slice(0, 10);

  for (const seriesId of seriesIds) {
    try {
      const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${key}&file_type=json&sort_order=asc&observation_start=${startStr}`;
      const resp = await fetch(url);
      if (resp.ok) {
        const json = await resp.json();
        const obs = json?.observations;
        if (Array.isArray(obs)) {
          const observations: FredDailyObservation[] = [];
          for (const o of obs) {
            if (o.value !== '.' && o.date) {
              const val = parseFloat(o.value);
              if (!isNaN(val)) {
                observations.push({ date: o.date, value: val });
              }
            }
          }
          result.set(seriesId, { seriesId, observations });
        }
      } else {
        errors.push(`${seriesId}: HTTP ${resp.status}`);
      }
    } catch (e: unknown) {
      errors.push(`${seriesId}: ${e instanceof Error ? e.message : String(e)}`);
    }
    await delay(100); // Rate limit respect
  }

  // Cache the result
  fredDailyCache = { data: result, fetchedAt: Date.now() };

  return { data: result, cached: false, error: errors.length > 0 ? errors.join('; ') : null };
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

// ===== FINNHUB INSIDER TRANSACTIONS FETCHER =====
// Uses Finnhub /stock/insider-transactions (granted under Premium Package 1) to get
// structured insider transaction data directly — same underlying SEC Form 3/4/5 data,
// already parsed. Replaces the 3-hop SEC EDGAR chain (profile2→submissions→XML).
// Cohen, Malloy & Pomorski (2012): "opportunistic" insiders (infrequent traders)
// predict +7.2% annual excess returns; "routine" traders predict nothing.

const insiderTxCache = new Map<string, { data: SECForm4Data; fetchedAt: number }>();
const INSIDER_TX_CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function fetchInsiderTransactions(
  symbol: string,
  apiKey?: string,
): Promise<{ data: SECForm4Data | null; error: string | null }> {
  const cached = insiderTxCache.get(symbol);
  if (cached && Date.now() - cached.fetchedAt < INSIDER_TX_CACHE_TTL) {
    return { data: cached.data, error: null };
  }

  const key = apiKey || process.env.FINNHUB_API_KEY;
  if (!key) return { data: null, error: 'FINNHUB_API_KEY not configured' };

  try {
    // Fetch last 90 days of insider transactions
    const fromDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const resp = await fetchWithRetry(
      `https://finnhub.io/api/v1/stock/insider-transactions?symbol=${symbol}&from=${fromDate}&token=${key}`,
    );
    if (!resp.ok) {
      return { data: null, error: `insider-transactions: HTTP ${resp.status}` };
    }

    const json = await resp.json();
    const rawTxs: Array<{
      name?: string;
      share?: number;
      change?: number;
      filingDate?: string;
      transactionDate?: string;
      transactionPrice?: number;
      transactionCode?: string;
    }> = json?.data ?? [];

    // Map Finnhub transactions to SECForm4Transaction[]
    const transactions: SECForm4Transaction[] = [];
    for (const tx of rawTxs) {
      const code = (tx.transactionCode ?? '').toUpperCase();
      const change = tx.change ?? 0;
      if (change === 0) continue;

      const price = tx.transactionPrice != null && tx.transactionPrice > 0 ? tx.transactionPrice : null;
      const shares = Math.abs(change);

      transactions.push({
        filerName: tx.name ?? 'Unknown',
        transactionDate: tx.transactionDate ?? tx.filingDate ?? 'unknown',
        transactionType: code,
        sharesTraded: shares,
        pricePerShare: price,
        sharesOwnedAfter: tx.share != null ? tx.share : null,
        // Finnhub /stock/insider-transactions does not provide role flags.
        // Conservatively mark all as false — the opportunistic scoring still works
        // based on trade frequency, and MSPR from /stock/insider-sentiment provides
        // the officer/director signal via its weighted aggregate.
        isDirector: false,
        isOfficer: false,
        isTenPercentOwner: false,
        dollarValue: price !== null ? Math.round(shares * price) : null,
      });
    }

    // Aggregate
    let totalBuyCount = 0;
    let totalSellCount = 0;
    let totalBuyDollarValue = 0;
    let totalSellDollarValue = 0;
    let officerBuyCount = 0; // Always 0 — Finnhub doesn't provide role data
    const filerNames = new Set<string>();
    let latestTransactionDate: string | null = null;

    for (const tx of transactions) {
      filerNames.add(tx.filerName);
      if (!latestTransactionDate || tx.transactionDate > latestTransactionDate) {
        latestTransactionDate = tx.transactionDate;
      }

      if (tx.transactionType === 'P') {
        totalBuyCount++;
        totalBuyDollarValue += tx.dollarValue ?? 0;
        // officerBuyCount stays 0 — role data not available from this endpoint
      } else if (tx.transactionType === 'S') {
        totalSellCount++;
        totalSellDollarValue += tx.dollarValue ?? 0;
      }
    }

    // Opportunistic score: filers with < 3 trades = likely opportunistic
    const filerTxCounts = new Map<string, { buys: number; sells: number }>();
    for (const tx of transactions) {
      const existing = filerTxCounts.get(tx.filerName) ?? { buys: 0, sells: 0 };
      if (tx.transactionType === 'P') existing.buys++;
      else if (tx.transactionType === 'S') existing.sells++;
      filerTxCounts.set(tx.filerName, existing);
    }

    let opportunisticSignal = 0;
    let totalWeight = 0;
    for (const [, counts] of filerTxCounts) {
      const totalTrades = counts.buys + counts.sells;
      // Opportunistic: < 3 trades in 90 days → weight 3x; routine: 3+ → weight 1x
      const freqWeight = totalTrades < 3 ? 3 : 1;
      const netSignal = counts.buys - counts.sells;
      opportunisticSignal += netSignal * freqWeight;
      totalWeight += freqWeight;
    }

    let opportunisticScore: number | null = null;
    if (totalWeight > 0) {
      const raw = opportunisticSignal / totalWeight;
      opportunisticScore = Math.round(Math.max(0, Math.min(100, 50 + raw * 30)));
    }

    if (transactions.length === 0) {
      // No transactions in 90 days — return empty (not an error)
      const emptyResult: SECForm4Data = {
        transactions: [],
        totalBuyCount: 0,
        totalSellCount: 0,
        totalBuyDollarValue: 0,
        totalSellDollarValue: 0,
        netDollarFlow: 0,
        uniqueFilers: 0,
        officerBuyCount: 0,
        latestTransactionDate: null,
        opportunisticScore: null,
      };
      insiderTxCache.set(symbol, { data: emptyResult, fetchedAt: Date.now() });
      return { data: emptyResult, error: null };
    }

    const result: SECForm4Data = {
      transactions,
      totalBuyCount,
      totalSellCount,
      totalBuyDollarValue: Math.round(totalBuyDollarValue),
      totalSellDollarValue: Math.round(totalSellDollarValue),
      netDollarFlow: Math.round(totalBuyDollarValue - totalSellDollarValue),
      uniqueFilers: filerNames.size,
      officerBuyCount,
      latestTransactionDate,
      opportunisticScore,
    };

    insiderTxCache.set(symbol, { data: result, fetchedAt: Date.now() });
    return { data: result, error: null };
  } catch (e: unknown) {
    return { data: null, error: `insider-transactions: ${e instanceof Error ? e.message : String(e)}` };
  }
}

// ===== FINNHUB PEER TICKERS FETCHER =====
// Uses Finnhub /stock/peers to get peer company tickers for expanding peer groups
// beyond hard-filter survivors. Returns tickers in the same country/sector/industry.

const peerTickerCache = new Map<string, { peers: string[]; fetchedAt: number }>();
const PEER_TICKER_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours (peer lists change slowly)

export async function fetchPeerTickers(
  symbol: string,
  apiKey?: string,
): Promise<{ data: string[] | null; error: string | null }> {
  const cached = peerTickerCache.get(symbol);
  if (cached && Date.now() - cached.fetchedAt < PEER_TICKER_CACHE_TTL) {
    return { data: cached.peers, error: null };
  }

  const key = apiKey || process.env.FINNHUB_API_KEY;
  if (!key) return { data: null, error: 'FINNHUB_API_KEY not configured' };

  try {
    const resp = await fetchWithRetry(
      `https://finnhub.io/api/v1/stock/peers?symbol=${symbol}&grouping=industry&token=${key}`,
    );
    if (!resp.ok) {
      return { data: null, error: `stock/peers: HTTP ${resp.status}` };
    }

    const json = await resp.json();
    if (!Array.isArray(json)) {
      return { data: null, error: 'stock/peers: unexpected response format' };
    }

    // Finnhub returns the symbol itself in the list — filter it out
    const peers = json.filter((t: unknown): t is string =>
      typeof t === 'string' && t !== symbol
    );

    peerTickerCache.set(symbol, { peers, fetchedAt: Date.now() });
    return { data: peers, error: null };
  } catch (e: unknown) {
    return { data: null, error: `stock/peers: ${e instanceof Error ? e.message : String(e)}` };
  }
}

// ===== SEC FORM 4 INSIDER TRANSACTION FETCHER =====
// DEPRECATED: Replaced by fetchInsiderTransactions() using Finnhub /stock/insider-transactions.
// Kept for reference — will be removed after confirming the Finnhub path works in production.
// Parses real-time insider transactions from SEC EDGAR Form 4 filings.
// Cohen, Malloy & Pomorski (2012): "opportunistic" insiders (infrequent traders)
// predict +7.2% annual excess returns; "routine" traders predict nothing.

const secForm4Cache = new Map<string, { data: SECForm4Data; fetchedAt: number }>();
const SEC_FORM4_CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function fetchSECForm4Data(
  symbol: string,
  finnhubApiKey?: string,
): Promise<{ data: SECForm4Data | null; error: string | null }> {
  const cached = secForm4Cache.get(symbol);
  if (cached && Date.now() - cached.fetchedAt < SEC_FORM4_CACHE_TTL) {
    return { data: cached.data, error: null };
  }

  // Step 1: Get CIK (reuses existing CIK lookup + cache)
  const cik = await lookupCIK(symbol, finnhubApiKey);
  if (!cik) {
    return { data: null, error: 'sec-form4: CIK lookup failed' };
  }

  try {
    // Step 2: Fetch recent filings from SEC submissions endpoint
    const resp = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, {
      headers: { 'User-Agent': SEC_USER_AGENT },
    });

    if (!resp.ok) {
      return { data: null, error: `sec-form4: submissions HTTP ${resp.status}` };
    }

    const json = await resp.json();
    const recent = json?.filings?.recent;
    if (!recent || !Array.isArray(recent.form)) {
      return { data: null, error: 'sec-form4: no recent filings in response' };
    }

    // Filter to Form 4 filings in the last 90 days
    const now = Date.now();
    const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;
    const form4Indices: number[] = [];

    for (let i = 0; i < recent.form.length; i++) {
      if (recent.form[i] !== '4') continue;
      const filingDate = recent.filingDate?.[i];
      if (!filingDate) continue;
      const filingTime = new Date(filingDate + 'T00:00:00Z').getTime();
      if (filingTime < ninetyDaysAgo) continue;
      form4Indices.push(i);
    }

    if (form4Indices.length === 0) {
      // No Form 4 filings in last 90 days — return empty (not an error)
      const emptyResult: SECForm4Data = {
        transactions: [],
        totalBuyCount: 0,
        totalSellCount: 0,
        totalBuyDollarValue: 0,
        totalSellDollarValue: 0,
        netDollarFlow: 0,
        uniqueFilers: 0,
        officerBuyCount: 0,
        latestTransactionDate: null,
        opportunisticScore: null,
      };
      secForm4Cache.set(symbol, { data: emptyResult, fetchedAt: Date.now() });
      return { data: emptyResult, error: null };
    }

    // Step 3: Fetch and parse individual Form 4 XML filings (max 15 to limit API calls)
    const maxFilings = Math.min(form4Indices.length, 15);
    const transactions: SECForm4Transaction[] = [];

    for (let j = 0; j < maxFilings; j++) {
      const idx = form4Indices[j];
      const accessionNumber = recent.accessionNumber?.[idx];
      const primaryDocument = recent.primaryDocument?.[idx];

      if (!accessionNumber || !primaryDocument) continue;

      // Build URL: SEC EDGAR archives
      const accClean = accessionNumber.replace(/-/g, '');
      const xmlUrl = `https://www.sec.gov/Archives/edgar/data/${cik.replace(/^0+/, '')}/${accClean}/${primaryDocument}`;

      try {
        const xmlResp = await fetch(xmlUrl, {
          headers: { 'User-Agent': SEC_USER_AGENT },
        });
        if (!xmlResp.ok) continue;

        const xmlText = await xmlResp.text();
        const parsed = parseForm4Xml(xmlText);
        transactions.push(...parsed);
      } catch {
        // Skip individual filing parse errors
      }

      await delay(110); // SEC rate limit: 10 req/sec → 100ms between
    }

    // Step 4: Aggregate transaction data
    let totalBuyCount = 0;
    let totalSellCount = 0;
    let totalBuyDollarValue = 0;
    let totalSellDollarValue = 0;
    let officerBuyCount = 0;
    const filerNames = new Set<string>();
    let latestTransactionDate: string | null = null;

    for (const tx of transactions) {
      filerNames.add(tx.filerName);
      if (!latestTransactionDate || tx.transactionDate > latestTransactionDate) {
        latestTransactionDate = tx.transactionDate;
      }

      if (tx.transactionType === 'P') {
        totalBuyCount++;
        totalBuyDollarValue += tx.dollarValue ?? 0;
        if (tx.isOfficer || tx.isDirector) officerBuyCount++;
      } else if (tx.transactionType === 'S') {
        totalSellCount++;
        totalSellDollarValue += tx.dollarValue ?? 0;
      }
    }

    // Step 5: Compute opportunistic score
    // Approximate: filer with only 1 transaction in 90 days = likely opportunistic
    const filerTxCounts = new Map<string, { buys: number; sells: number; isOfficer: boolean }>();
    for (const tx of transactions) {
      const existing = filerTxCounts.get(tx.filerName) ?? { buys: 0, sells: 0, isOfficer: false };
      if (tx.transactionType === 'P') existing.buys++;
      else if (tx.transactionType === 'S') existing.sells++;
      if (tx.isOfficer || tx.isDirector) existing.isOfficer = true;
      filerTxCounts.set(tx.filerName, existing);
    }

    let opportunisticSignal = 0;
    let totalWeight = 0;

    for (const [, counts] of filerTxCounts) {
      const totalTrades = counts.buys + counts.sells;
      // Opportunistic: < 3 trades in 90 days → weight 3x; routine: 3+ → weight 1x
      const freqWeight = totalTrades < 3 ? 3 : 1;
      // Officer/director: 2x weight over 10% owners
      const roleWeight = counts.isOfficer ? 2 : 1;
      const weight = freqWeight * roleWeight;

      // Net signal: buys positive, sells negative
      const netSignal = counts.buys - counts.sells;
      opportunisticSignal += netSignal * weight;
      totalWeight += weight;
    }

    // Normalize to 0-100 (50 = neutral, >50 = net buying, <50 = net selling)
    let opportunisticScore: number | null = null;
    if (totalWeight > 0) {
      const raw = opportunisticSignal / totalWeight; // roughly -1 to +1
      opportunisticScore = Math.round(Math.max(0, Math.min(100, 50 + raw * 30)));
    }

    const result: SECForm4Data = {
      transactions,
      totalBuyCount,
      totalSellCount,
      totalBuyDollarValue: Math.round(totalBuyDollarValue),
      totalSellDollarValue: Math.round(totalSellDollarValue),
      netDollarFlow: Math.round(totalBuyDollarValue - totalSellDollarValue),
      uniqueFilers: filerNames.size,
      officerBuyCount,
      latestTransactionDate,
      opportunisticScore,
    };

    secForm4Cache.set(symbol, { data: result, fetchedAt: Date.now() });
    return { data: result, error: null };
  } catch (e: unknown) {
    return { data: null, error: `sec-form4: ${e instanceof Error ? e.message : String(e)}` };
  }
}

// DEPRECATED: Replaced by fetchInsiderTransactions() using Finnhub /stock/insider-transactions.
// Parse Form 4 XML to extract transactions
// SEC Form 4 XML uses a specific schema: ownershipDocument > nonDerivativeTable > nonDerivativeTransaction
function parseForm4Xml(xml: string): SECForm4Transaction[] {
  const transactions: SECForm4Transaction[] = [];

  // Extract filer info (reportingOwner section)
  const filerName = extractXmlValue(xml, 'rptOwnerName') ?? 'Unknown';
  const isDirector = extractXmlValue(xml, 'isDirector') === '1' || extractXmlValue(xml, 'isDirector') === 'true';
  const isOfficer = extractXmlValue(xml, 'isOfficer') === '1' || extractXmlValue(xml, 'isOfficer') === 'true';
  const isTenPercentOwner = extractXmlValue(xml, 'isTenPercentOwner') === '1' || extractXmlValue(xml, 'isTenPercentOwner') === 'true';

  // Parse non-derivative transactions
  const txBlocks = xml.split(/<nonDerivativeTransaction>/gi).slice(1);
  for (const block of txBlocks) {
    const endIdx = block.indexOf('</nonDerivativeTransaction>');
    const txXml = endIdx >= 0 ? block.slice(0, endIdx) : block;

    const transactionDate = extractXmlValue(txXml, 'transactionDate>.*?<value') ??
      extractXmlValue(txXml, 'value', /<transactionDate>[\s\S]*?<value>(.*?)<\/value>/);
    const sharesStr = extractXmlValue(txXml, 'transactionAmounts>.*?transactionShares>.*?<value') ??
      extractNestedValue(txXml, 'transactionShares', 'value');
    const priceStr = extractXmlValue(txXml, 'transactionPricePerShare>.*?<value') ??
      extractNestedValue(txXml, 'transactionPricePerShare', 'value');
    const codeStr = extractXmlValue(txXml, 'transactionCode');
    const sharesAfterStr = extractNestedValue(txXml, 'sharesOwnedFollowingTransaction', 'value');

    const shares = sharesStr ? parseFloat(sharesStr) : 0;
    const price = priceStr ? parseFloat(priceStr) : null;
    const sharesAfter = sharesAfterStr ? parseFloat(sharesAfterStr) : null;

    if (shares === 0 || !codeStr) continue;
    // Only include P (purchase) and S (sale) — skip A (award), M (exercise), G (gift) for scoring
    // but include all types in the data for completeness
    const txType = codeStr.toUpperCase();

    transactions.push({
      filerName,
      transactionDate: transactionDate ?? 'unknown',
      transactionType: txType,
      sharesTraded: Math.abs(shares),
      pricePerShare: price !== null && !isNaN(price) ? price : null,
      sharesOwnedAfter: sharesAfter !== null && !isNaN(sharesAfter) ? sharesAfter : null,
      isDirector,
      isOfficer,
      isTenPercentOwner,
      dollarValue: price !== null && !isNaN(price) ? Math.round(Math.abs(shares) * price) : null,
    });
  }

  return transactions;
}

// XML helpers — simple regex extraction (no DOM parser dependency)
function extractXmlValue(xml: string, tag: string, customRegex?: RegExp): string | null {
  if (customRegex) {
    const m = xml.match(customRegex);
    return m?.[1]?.trim() ?? null;
  }
  const regex = new RegExp(`<${tag}>\\s*([^<]+)\\s*<`, 'i');
  const match = xml.match(regex);
  return match?.[1]?.trim() ?? null;
}

function extractNestedValue(xml: string, parentTag: string, childTag: string): string | null {
  const parentRegex = new RegExp(`<${parentTag}>[\\s\\S]*?<${childTag}>\\s*([^<]+)\\s*<\\/`, 'i');
  const match = xml.match(parentRegex);
  return match?.[1]?.trim() ?? null;
}

// ===== SEC 10-K BUSINESS DESCRIPTION FETCHER (Hoberg & Phillips 2010, 2016) =====
// Fetches Item 1 (Business Description) from the most recent 10-K filing.
// Text-based peer classification uses TF-IDF cosine similarity on business descriptions
// to identify economic peers that static GICS codes miss.

const tenKTextCache = new Map<string, { data: CompanyTextProfile; fetchedAt: number }>();
const TEN_K_TEXT_CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days (10-K only changes annually)

// Common stop words + legal boilerplate terms to filter from TF-IDF
const STOP_WORDS = new Set([
  // Standard English stop words
  'the','be','to','of','and','a','in','that','have','i','it','for','not','on','with','he',
  'as','you','do','at','this','but','his','by','from','they','we','her','she','or','an',
  'will','my','one','all','would','there','their','what','so','up','out','if','about','who',
  'get','which','go','me','when','make','can','like','time','no','just','him','know','take',
  'people','into','year','your','good','some','could','them','see','other','than','then',
  'now','look','only','come','its','over','think','also','back','after','use','two','how',
  'our','work','first','well','way','even','new','want','because','any','these','give',
  'day','most','us','are','is','was','were','been','being','has','had','does','did','may',
  'might','shall','should','must','need','such','each','every','both','few','more','many',
  'very','own','same','much','through','during','before','between','under','above','below',
  // SEC / 10-K boilerplate terms
  'company','corporation','incorporated','llc','inc','ltd','pursuant','herein','thereof',
  'foregoing','fiscal','quarter','annual','report','filing','securities','exchange',
  'commission','act','section','item','form','filed','registrant','subsidiary','subsidiaries',
  'respectively','approximately','certain','significant','various','following','described',
  'including','related','primarily','generally','operations','business','financial',
  'statements','management','results','period','ended','year','ended','december','january',
  'february','march','april','june','july','august','september','october','november',
  'million','billion','thousand','percent','total','net','gross','operating',
]);

// Product/service indicator terms for extracting productTerms
const PRODUCT_INDICATORS = new Set([
  'platform','software','service','product','solution','technology','system','application',
  'device','equipment','tool','engine','network','infrastructure','cloud','data','analytics',
  'ai','machine','learning','automation','semiconductor','chip','processor','sensor',
  'pharmaceutical','drug','therapy','treatment','vaccine','diagnostic','medical','device',
  'energy','oil','gas','renewable','solar','wind','electric','battery','power',
  'financial','banking','insurance','lending','payment','trading','investment','asset',
  'retail','commerce','marketplace','delivery','logistics','shipping','warehouse',
  'media','content','streaming','advertising','entertainment','gaming','social',
  'automotive','vehicle','mobility','transportation','aerospace','defense',
  'food','beverage','restaurant','consumer','healthcare','biotech','genomics',
  'telecom','wireless','broadband','satellite','cybersecurity','security',
]);

export async function fetch10KBusinessDescription(
  symbol: string,
  finnhubApiKey?: string,
): Promise<{ data: CompanyTextProfile | null; error: string | null }> {
  const cached = tenKTextCache.get(symbol);
  if (cached && Date.now() - cached.fetchedAt < TEN_K_TEXT_CACHE_TTL) {
    return { data: cached.data, error: null };
  }

  // Step 1: Get CIK (reuses existing CIK lookup + cache)
  const cik = await lookupCIK(symbol, finnhubApiKey);
  if (!cik) {
    return { data: null, error: 'sec-10k-text: CIK lookup failed' };
  }

  try {
    // Step 2: Search for most recent 10-K filing via EFTS full-text search
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const startDt = twoYearsAgo.toISOString().slice(0, 10);
    const endDt = new Date().toISOString().slice(0, 10);

    const searchUrl = `https://efts.sec.gov/LATEST/search-index?q=%22${encodeURIComponent(symbol)}%22&dateRange=custom&startdt=${startDt}&enddt=${endDt}&forms=10-K`;
    const searchResp = await fetch(searchUrl, {
      headers: { 'User-Agent': SEC_USER_AGENT },
    });

    let accessionNumber: string | null = null;
    let filingDate: string = '';

    if (searchResp.ok) {
      const searchJson = await searchResp.json();
      const hits = searchJson?.hits?.hits;
      if (Array.isArray(hits) && hits.length > 0) {
        accessionNumber = hits[0]?._source?.file_num || hits[0]?._id;
        filingDate = hits[0]?._source?.file_date || '';
      }
    }

    // Fallback: use submissions endpoint to find 10-K accession number
    if (!accessionNumber) {
      const subsResp = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, {
        headers: { 'User-Agent': SEC_USER_AGENT },
      });

      if (!subsResp.ok) {
        return { data: null, error: `sec-10k-text: submissions HTTP ${subsResp.status}` };
      }

      const subsJson = await subsResp.json();
      const recent = subsJson?.filings?.recent;
      if (!recent || !Array.isArray(recent.form)) {
        return { data: null, error: 'sec-10k-text: no recent filings' };
      }

      // Find most recent 10-K
      for (let i = 0; i < recent.form.length; i++) {
        if (recent.form[i] === '10-K' || recent.form[i] === '10-K/A') {
          accessionNumber = recent.accessionNumber?.[i];
          filingDate = recent.filingDate?.[i] || '';
          break;
        }
      }
    }

    if (!accessionNumber) {
      return { data: null, error: 'sec-10k-text: no 10-K filing found' };
    }

    await delay(150); // SEC rate limit

    // Step 3: Fetch filing index to find the primary document
    const accClean = accessionNumber.replace(/-/g, '');
    const cikTrimmed = cik.replace(/^0+/, '');
    const indexUrl = `https://www.sec.gov/Archives/edgar/data/${cikTrimmed}/${accClean}/index.json`;
    const indexResp = await fetch(indexUrl, {
      headers: { 'User-Agent': SEC_USER_AGENT },
    });

    if (!indexResp.ok) {
      return { data: null, error: `sec-10k-text: filing index HTTP ${indexResp.status}` };
    }

    const indexJson = await indexResp.json();
    const items = indexJson?.directory?.item;
    if (!Array.isArray(items)) {
      return { data: null, error: 'sec-10k-text: no items in filing index' };
    }

    // Find the primary .htm document (usually the largest .htm file, not R9999.htm)
    let primaryDoc: string | null = null;
    let maxSize = 0;
    for (const item of items) {
      const name = item?.name as string;
      if (!name) continue;
      const lowerName = name.toLowerCase();
      // Look for .htm files that aren't exhibits (ex*) or R-files
      if ((lowerName.endsWith('.htm') || lowerName.endsWith('.html')) &&
          !lowerName.startsWith('r') && !lowerName.startsWith('ex')) {
        const size = Number(item?.size ?? 0);
        if (size > maxSize) {
          maxSize = size;
          primaryDoc = name;
        }
      }
    }

    if (!primaryDoc) {
      // Fallback: just pick the first .htm file
      for (const item of items) {
        const name = item?.name as string;
        if (name && (name.toLowerCase().endsWith('.htm') || name.toLowerCase().endsWith('.html'))) {
          primaryDoc = name;
          break;
        }
      }
    }

    if (!primaryDoc) {
      return { data: null, error: 'sec-10k-text: no primary document found' };
    }

    await delay(150); // SEC rate limit

    // Step 4: Fetch the primary document and extract business description
    const docUrl = `https://www.sec.gov/Archives/edgar/data/${cikTrimmed}/${accClean}/${primaryDoc}`;
    const docResp = await fetch(docUrl, {
      headers: { 'User-Agent': SEC_USER_AGENT },
    });

    if (!docResp.ok) {
      return { data: null, error: `sec-10k-text: document HTTP ${docResp.status}` };
    }

    const htmlText = await docResp.text();

    // Extract business description from Item 1
    const businessDescription = extractBusinessDescription(htmlText);

    if (!businessDescription || businessDescription.split(/\s+/).length < 50) {
      return { data: null, error: 'sec-10k-text: business description too short or not found' };
    }

    // Extract keywords and product terms
    const words = tokenize(businessDescription);
    const keywords = extractTopTerms(words, 20);
    const productTerms = words.filter(w => PRODUCT_INDICATORS.has(w));
    const uniqueProductTerms = [...new Set(productTerms)].slice(0, 20);

    const result: CompanyTextProfile = {
      symbol,
      businessDescription,
      filingDate,
      keywords,
      productTerms: uniqueProductTerms,
    };

    tenKTextCache.set(symbol, { data: result, fetchedAt: Date.now() });
    return { data: result, error: null };
  } catch (e: unknown) {
    return { data: null, error: `sec-10k-text: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/**
 * Extract Item 1 (Business Description) from a 10-K HTML filing.
 * Strips HTML tags and extracts the section between Item 1 and Item 1A (or Item 2).
 * Returns at most 2000 words of text content.
 */
function extractBusinessDescription(html: string): string {
  // Strip HTML tags to get raw text
  const text = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#\d+;/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Try to locate Item 1 / Business section boundaries
  // Common patterns: "Item 1." "ITEM 1." "Item\s+1\b" followed by "Business"
  const item1Pattern = /item\s*1[\.\s]*[\-–—]?\s*(?:business|overview|general)/i;
  const item1SimplePattern = /item\s*1[\.\s]+(?!a\b|b\b)/i;
  const item1APattern = /item\s*1a[\.\s]*[\-–—]?\s*risk\s*factors/i;
  const item2Pattern = /item\s*2[\.\s]*[\-–—]?\s*properties/i;

  let startIdx = text.search(item1Pattern);
  if (startIdx === -1) {
    startIdx = text.search(item1SimplePattern);
  }

  // Find end boundary (Item 1A or Item 2)
  let endIdx = -1;
  if (startIdx >= 0) {
    const afterStart = text.slice(startIdx + 20); // skip past "Item 1. Business" header
    const endMatch1A = afterStart.search(item1APattern);
    const endMatch2 = afterStart.search(item2Pattern);

    if (endMatch1A >= 0 && endMatch2 >= 0) {
      endIdx = startIdx + 20 + Math.min(endMatch1A, endMatch2);
    } else if (endMatch1A >= 0) {
      endIdx = startIdx + 20 + endMatch1A;
    } else if (endMatch2 >= 0) {
      endIdx = startIdx + 20 + endMatch2;
    }
  }

  let rawSection: string;
  if (startIdx >= 0 && endIdx > startIdx) {
    rawSection = text.slice(startIdx, endIdx);
  } else if (startIdx >= 0) {
    // No clear end boundary: take next 15000 chars
    rawSection = text.slice(startIdx, startIdx + 15000);
  } else {
    // Could not find Item 1 — take a chunk from early in the document
    // Skip the first 2000 chars (usually cover page / TOC)
    rawSection = text.slice(2000, 17000);
  }

  // Limit to 2000 words
  const words = rawSection.split(/\s+/).filter(w => w.length > 0);
  return words.slice(0, 2000).join(' ');
}

/** Tokenize text into lowercase words, removing stop words and short tokens */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

/** Extract top N terms by frequency (simple TF for a single document) */
function extractTopTerms(words: string[], n: number): string[] {
  const freq = new Map<string, number>();
  for (const w of words) {
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([word]) => word);
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
    // v2 endpoint — granted under Premium Package 1 (v1 /stock/revenue-breakdown is NOT granted)
    const resp = await fetchWithRetry(
      `https://finnhub.io/api/v1/stock/revenue-breakdown2?symbol=${symbol}&token=${key}`,
    );
    if (!resp.ok) {
      return { data: null, error: `revenue-breakdown2: HTTP ${resp.status}` };
    }

    const json = await resp.json();
    // v2 returns { symbol, currency, data: <object> } where data has dynamic keys.
    // Known structures:
    //   A) { "segmentName": number, ... }  — flat segment→revenue map
    //   B) { "period": { "segmentName": number, ... }, ... }  — periods containing segments
    //   C) { "segmentName": [{ period, v }, ...], ... }  — segments containing period arrays
    const dataObj = json?.data;
    if (!dataObj || typeof dataObj !== 'object' || Object.keys(dataObj).length === 0) {
      return { data: null, error: 'revenue-breakdown2: no data returned' };
    }

    const segments: Array<{ name: string; revenue: number }> = [];
    let totalRevenue = 0;

    const values = Object.values(dataObj) as unknown[];
    const keys = Object.keys(dataObj);

    if (typeof values[0] === 'number') {
      // Case A: flat { segmentName: revenue }
      for (let i = 0; i < keys.length; i++) {
        const rev = values[i] as number;
        if (rev > 0) {
          segments.push({ name: keys[i], revenue: rev });
          totalRevenue += rev;
        }
      }
    } else if (Array.isArray(values[0])) {
      // Case C: { segmentName: [{ period, v }, ...] } — use most recent entry per segment
      for (let i = 0; i < keys.length; i++) {
        const arr = values[i] as Array<Record<string, unknown>>;
        if (!Array.isArray(arr) || arr.length === 0) continue;
        // Sort by period descending, pick latest
        const sorted = [...arr].sort((a, b) =>
          String(b.period ?? '').localeCompare(String(a.period ?? '')),
        );
        const rev = Number(sorted[0].v ?? sorted[0].value ?? sorted[0].revenue ?? 0);
        if (rev > 0) {
          segments.push({ name: keys[i], revenue: rev });
          totalRevenue += rev;
        }
      }
    } else if (typeof values[0] === 'object' && values[0] !== null) {
      // Case B: { period: { segmentName: value } } — pick most recent period
      const sortedPeriods = keys.sort((a, b) => b.localeCompare(a));
      const latestPeriodData = dataObj[sortedPeriods[0]] as Record<string, unknown>;
      for (const [segName, segVal] of Object.entries(latestPeriodData)) {
        const rev = Number(segVal);
        if (!isNaN(rev) && rev > 0) {
          segments.push({ name: segName, revenue: rev });
          totalRevenue += rev;
        }
      }
    }

    if (totalRevenue <= 0 || segments.length === 0) {
      return { data: null, error: 'revenue-breakdown2: no positive revenue segments' };
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
    return { data: null, error: `revenue-breakdown2: ${e instanceof Error ? e.message : String(e)}` };
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

export async function fetchNewsSentiment(
  symbol: string,
  apiKey?: string,
): Promise<{ data: NewsSentimentData | null; error: string | null }> {
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

// ===== FINNHUB EBITDA ESTIMATES FETCHER =====

export async function fetchFinnhubEbitdaEstimates(
  symbol: string,
  apiKey?: string,
): Promise<{ data: FinnhubEbitdaEstimate | null; error: string | null }> {
  const key = apiKey || process.env.FINNHUB_API_KEY;
  if (!key) return { data: null, error: 'FINNHUB_API_KEY not configured' };

  try {
    const resp = await fetchWithRetry(
      `https://finnhub.io/api/v1/stock/ebitda-estimate?symbol=${symbol}&freq=quarterly&token=${key}`,
    );
    if (!resp.ok) return { data: null, error: `ebitda-estimate ${symbol}: HTTP ${resp.status}` };

    const json = await resp.json();
    const raw = Array.isArray(json?.data) ? json.data : [];
    const estimates: FinnhubEbitdaEstimateEntry[] = raw.map((e: Record<string, unknown>) => ({
      period: String(e.period ?? ''),
      ebitdaAvg: typeof e.ebitdaAvg === 'number' ? e.ebitdaAvg : null,
      ebitdaHigh: typeof e.ebitdaHigh === 'number' ? e.ebitdaHigh : null,
      ebitdaLow: typeof e.ebitdaLow === 'number' ? e.ebitdaLow : null,
      numberAnalysts: typeof e.numberAnalysts === 'number' ? e.numberAnalysts : null,
    }));

    return { data: { symbol, estimates }, error: null };
  } catch (e: unknown) {
    return { data: null, error: `ebitda-estimate ${symbol}: ${e instanceof Error ? e.message : String(e)}` };
  }
}

// ===== FINNHUB EBIT ESTIMATES FETCHER =====

export async function fetchFinnhubEbitEstimates(
  symbol: string,
  apiKey?: string,
): Promise<{ data: FinnhubEbitEstimate | null; error: string | null }> {
  const key = apiKey || process.env.FINNHUB_API_KEY;
  if (!key) return { data: null, error: 'FINNHUB_API_KEY not configured' };

  try {
    const resp = await fetchWithRetry(
      `https://finnhub.io/api/v1/stock/ebit-estimate?symbol=${symbol}&freq=quarterly&token=${key}`,
    );
    if (!resp.ok) return { data: null, error: `ebit-estimate ${symbol}: HTTP ${resp.status}` };

    const json = await resp.json();
    const raw = Array.isArray(json?.data) ? json.data : [];
    const estimates: FinnhubEbitEstimateEntry[] = raw.map((e: Record<string, unknown>) => ({
      period: String(e.period ?? ''),
      ebitAvg: typeof e.ebitAvg === 'number' ? e.ebitAvg : null,
      ebitHigh: typeof e.ebitHigh === 'number' ? e.ebitHigh : null,
      ebitLow: typeof e.ebitLow === 'number' ? e.ebitLow : null,
      numberAnalysts: typeof e.numberAnalysts === 'number' ? e.numberAnalysts : null,
    }));

    return { data: { symbol, estimates }, error: null };
  } catch (e: unknown) {
    return { data: null, error: `ebit-estimate ${symbol}: ${e instanceof Error ? e.message : String(e)}` };
  }
}

// ===== FINNHUB DIVIDEND HISTORY FETCHER =====

export async function fetchFinnhubDividendHistory(
  symbol: string,
  apiKey?: string,
): Promise<{ data: FinnhubDividendHistory | null; error: string | null }> {
  const key = apiKey || process.env.FINNHUB_API_KEY;
  if (!key) return { data: null, error: 'FINNHUB_API_KEY not configured' };

  const today = new Date().toISOString().slice(0, 10);
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  try {
    const resp = await fetchWithRetry(
      `https://finnhub.io/api/v1/stock/dividend?symbol=${symbol}&from=${oneYearAgo}&to=${today}&token=${key}`,
    );
    if (!resp.ok) return { data: null, error: `dividend ${symbol}: HTTP ${resp.status}` };

    const json = await resp.json();
    const raw = Array.isArray(json) ? json : [];
    const dividends: FinnhubDividendEntry[] = raw.map((d: Record<string, unknown>) => ({
      date: String(d.date ?? ''),
      amount: typeof d.amount === 'number' ? d.amount : null,
      adjustedAmount: typeof d.adjustedAmount === 'number' ? d.adjustedAmount : null,
      currency: typeof d.currency === 'string' ? d.currency : null,
      exDate: typeof d.exDate === 'string' ? d.exDate : null,
      payDate: typeof d.payDate === 'string' ? d.payDate : null,
    }));

    return { data: { symbol, dividends }, error: null };
  } catch (e: unknown) {
    return { data: null, error: `dividend ${symbol}: ${e instanceof Error ? e.message : String(e)}` };
  }
}

// ===== FINNHUB PRICE METRICS FETCHER =====

export async function fetchFinnhubPriceMetrics(
  symbol: string,
  apiKey?: string,
): Promise<{ data: FinnhubPriceMetrics | null; error: string | null }> {
  const key = apiKey || process.env.FINNHUB_API_KEY;
  if (!key) return { data: null, error: 'FINNHUB_API_KEY not configured' };

  const today = new Date().toISOString().slice(0, 10);

  try {
    const resp = await fetchWithRetry(
      `https://finnhub.io/api/v1/stock/price-metric?symbol=${symbol}&date=${today}&token=${key}`,
    );
    if (!resp.ok) return { data: null, error: `price-metric ${symbol}: HTTP ${resp.status}` };

    const json = await resp.json();
    const m = json?.metric ?? {};

    return {
      data: {
        symbol,
        week52High: typeof m['52WeekHigh'] === 'number' ? m['52WeekHigh'] : null,
        week52Low: typeof m['52WeekLow'] === 'number' ? m['52WeekLow'] : null,
        week52HighDate: typeof m['52WeekHighDate'] === 'string' ? m['52WeekHighDate'] : null,
        week52LowDate: typeof m['52WeekLowDate'] === 'string' ? m['52WeekLowDate'] : null,
        priceRelativeToSMA10: typeof m.priceRelativeToSMA10 === 'number' ? m.priceRelativeToSMA10 : null,
        priceRelativeToSMA20: typeof m.priceRelativeToSMA20 === 'number' ? m.priceRelativeToSMA20 : null,
        priceRelativeToSMA50: typeof m.priceRelativeToSMA50 === 'number' ? m.priceRelativeToSMA50 : null,
        priceRelativeToSMA100: typeof m.priceRelativeToSMA100 === 'number' ? m.priceRelativeToSMA100 : null,
        priceRelativeToSMA200: typeof m.priceRelativeToSMA200 === 'number' ? m.priceRelativeToSMA200 : null,
      },
      error: null,
    };
  } catch (e: unknown) {
    return { data: null, error: `price-metric ${symbol}: ${e instanceof Error ? e.message : String(e)}` };
  }
}

// ===== FINNHUB FUND OWNERSHIP FETCHER =====

export async function fetchFinnhubFundOwnership(
  symbol: string,
  apiKey?: string,
): Promise<{ data: FinnhubFundOwnership | null; error: string | null }> {
  const key = apiKey || process.env.FINNHUB_API_KEY;
  if (!key) return { data: null, error: 'FINNHUB_API_KEY not configured' };

  try {
    const resp = await fetchWithRetry(
      `https://finnhub.io/api/v1/stock/fund-ownership?symbol=${symbol}&limit=10&token=${key}`,
    );
    if (!resp.ok) return { data: null, error: `fund-ownership ${symbol}: HTTP ${resp.status}` };

    const json = await resp.json();
    const raw = Array.isArray(json?.ownership) ? json.ownership : [];
    const funds: FinnhubFundOwnershipEntry[] = raw.map((f: Record<string, unknown>) => ({
      name: String(f.name ?? ''),
      share: typeof f.share === 'number' ? f.share : null,
      change: typeof f.change === 'number' ? f.change : null,
      filingDate: typeof f.filingDate === 'string' ? f.filingDate : null,
    }));

    return {
      data: {
        symbol,
        funds,
        totalFunds: typeof json?.totalFunds === 'number' ? json.totalFunds : null,
      },
      error: null,
    };
  } catch (e: unknown) {
    return { data: null, error: `fund-ownership ${symbol}: ${e instanceof Error ? e.message : String(e)}` };
  }
}

// ===== SEC EDGAR 8-K SCAN FETCHER =====

export async function fetchSECEdgar8KScan(
  symbol: string,
): Promise<{ data: SECEdgar8KScan | null; error: string | null }> {
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  try {
    const resp = await fetch(
      `https://efts.sec.gov/LATEST/search-index?q=%22${encodeURIComponent(symbol)}%22&dateRange=custom&startdt=${thirtyDaysAgo}&enddt=${today}&forms=8-K`,
      {
        headers: {
          'User-Agent': 'TempleStudart/1.0 (temple-stuart-accounting; contact@example.com)',
          'Accept': 'application/json',
        },
      },
    );
    if (!resp.ok) return { data: null, error: `sec-8k-scan ${symbol}: HTTP ${resp.status}` };

    const json = await resp.json();
    const hits = Array.isArray(json?.hits?.hits) ? json.hits.hits : [];
    const filings: SECEdgar8KEntry[] = hits.map((h: Record<string, unknown>) => {
      const src = (h._source ?? {}) as Record<string, unknown>;
      return {
        filedAt: String(src.file_date ?? src.filed_at ?? ''),
        formType: String(src.form_type ?? '8-K'),
        description: typeof src.display_description === 'string' ? src.display_description : null,
        entityName: typeof src.entity_name === 'string' ? src.entity_name : null,
      };
    });

    return {
      data: {
        symbol,
        filings,
        totalHits: typeof json?.hits?.total?.value === 'number' ? json.hits.total.value : null,
      },
      error: null,
    };
  } catch (e: unknown) {
    return { data: null, error: `sec-8k-scan ${symbol}: ${e instanceof Error ? e.message : String(e)}` };
  }
}
