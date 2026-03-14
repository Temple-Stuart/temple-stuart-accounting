import { getTastytradeClient } from '@/lib/tastytrade';
import { fetchFinnhubBatch, fetchFredMacro, fetchFredDailySeries, fetchTTCandlesBatch, fetchAnnualFinancials, fetchNewsSentiment, fetchFinnhubNewsSentiment, fetchFinnhubEarningsQuality, fetchFinnhubInstitutionalOwnership, fetchFinnhubRevenueBreakdown, fetchQuarterlyFinancials, fetchSECFilingData, fetchInsiderTransactions, fetchPeerTickers, fetch10KBusinessDescription, fetchFinnhubEbitdaEstimates, fetchFinnhubEbitEstimates, fetchFinnhubDividendHistory, fetchFinnhubPriceMetrics, fetchFinnhubFundOwnership, fetchSECEdgar8KScan, fetchFinnhubEarningsCalendar } from './data-fetchers';
import { computeCrossAssetCorrelations } from './cross-asset';
import type { CrossAssetCorrelations } from './types';
import type { FinnhubData, CandleBatchStats } from './data-fetchers';
import { fetchChainAndBuildCards, isMarketOpen } from './chain-fetcher';
import type { ChainFetchStats, ChainFetchResult, PerTickerChainStats } from './chain-fetcher';
import type { RejectionReason } from '@/lib/strategy-builder';
import { fetchSentimentBatch } from './sentiment';
import type { SentimentResult } from './sentiment';
import { computePeerStats, computeTextPeerGroups } from './sector-stats';
import type { PeerStatsMap, PeerGroupAssignment } from './sector-stats';
import { scoreAll } from './composite';
import type { FullScoringResult } from './composite';
import { computePreFilter } from './pre-filter';
import type { PreFilterResult } from './pre-filter';
import { logScanSnapshotBatch } from './snapshot-logger';
import type {
  TTScannerData,
  ConvergenceInput,
  FredMacroData,
  LegacyTradeCardData,
  AnnualFinancials,
  OptionsFlowData,
  NewsSentimentData,
  FinnhubNewsSentiment,
  FinnhubEarningsQuality,
  FinnhubInstitutionalOwnership,
  FinnhubRevenueBreakdown,
  QuarterlyFinancials,
  SECFilingData,
  SECForm4Data,
  CompanyTextProfile,
  TextBasedPeerGroup,
  CandleData,
  FinnhubEbitdaEstimate,
  FinnhubEbitEstimate,
  FinnhubDividendHistory,
  FinnhubPriceMetrics,
  FinnhubFundOwnership,
  SECEdgar8KScan,
  FinnhubEarningsCalendar,
} from './types';

// ===== TYPES =====

interface HardFilterStep {
  filter: string;
  passed: number;
  failed: number;
  sample_failed: string[];
}

interface HardFilterRejection {
  filter: string;
  actual_value: string;
  threshold: string;
  reason: string;
}

interface HardFilterWarning {
  filter: string;
  reason: string;
}

interface HardFiltersResult {
  input_count: number;
  output_count: number;
  filters_applied: HardFilterStep[];
  survivors: string[];
  ticker_rejections: Record<string, HardFilterRejection>;
  ticker_warnings: Record<string, HardFilterWarning>;
}

interface PreScoreRow {
  symbol: string;
  pre_score: number;
  ivp: number | null;
  iv_hv_spread: number | null;
  liquidity: number | null;
}

interface RankedRow {
  rank: number;
  symbol: string;
  composite: number;
  vol_edge: number;
  quality: number;
  regime: number;
  info_edge: number;
  convergence: string;
  direction: string;
  strategy: string;
  sector: string | null;
  ivp: number | null;
  iv_hv_spread: number | null;
  hv_trend: string;
  mspr: number | null;
  beat_streak: string;
  key_signal: string;
}

interface DiversificationResult {
  adjustments: string[];
}

export interface PipelineResult {
  pipeline_summary: {
    total_universe: number;
    after_hard_filters: number;
    pre_scored: number;
    finnhub_fetched: number;
    scored: number;
    final_9: string[];
    pipeline_runtime_ms: number;
    finnhub_calls_made: number;
    finnhub_errors: number;
    fred_cached: boolean;
    candle_symbols_fetched: number;
    candle_total_count: number;
    chain_symbols_fetched: number;
    total_trade_cards: number;
    greeks_events_received: number;
    market_open: boolean;
    market_note?: string;
    timestamp: string;
  };
  hard_filters: HardFiltersResult;
  peer_stats: PeerStatsMap;
  text_peer_groups: Record<string, TextBasedPeerGroup>;
  pre_scores: PreScoreRow[];
  rankings: {
    scored_count: number;
    top_9: RankedRow[];
    also_scored: RankedRow[];
    sector_distribution: Record<string, number>;
  };
  diversification: DiversificationResult;
  scoring_details: Record<string, FullScoringResult>;
  pre_filter: PreFilterResult[];
  social_sentiment: Record<string, SentimentResult>;
  rejection_reasons: Record<string, RejectionReason[]>;
  data_gaps: string[];
  errors: string[];
}

// ===== SYMBOL UNIVERSE (same lists as scanner/route.ts) =====

const DOW_30 = [
  'AAPL','AMGN','AMZN','AXP','BA','CAT','CRM','CSCO','CVX','DIS',
  'GS','HD','HON','IBM','JNJ','JPM','KO','MCD','MMM','MRK',
  'MSFT','NKE','NVDA','PG','SHW','TRV','UNH','V','VZ','WMT',
];

const NASDAQ_100 = [
  'AAPL','ABNB','ADBE','ADI','ADP','ADSK','AEP','ALNY','AMAT','AMGN',
  'AMZN','APP','ARM','ASML','AVGO','AXON','BKR','BKNG','CCEP','CDNS',
  'CEG','CHTR','CMCSA','COST','CPRT','CRWD','CSGP','CSCO','CSX','CTAS',
  'CTSH','DASH','DDOG','DXCM','EA','EXC','FANG','FAST','FER','FTNT',
  'GEHC','GILD','GOOG','GOOGL','HON','IDXX','INSM','INTC','INTU','ISRG',
  'KDP','KHC','KLAC','LIN','LRCX','MAR','MCHP','MDLZ','MELI','META',
  'MNST','MPWR','MRVL','MSFT','MSTR','MU','NFLX','NVDA','NXPI','ODFL',
  'ORLY','PANW','PAYX','PCAR','PDD','PEP','PLTR','PYPL','QCOM','REGN',
  'ROP','ROST','SBUX','SHOP','SNPS','STX','TEAM','TMUS','TRI','TSLA',
  'TTWO','TXN','VRSK','VRTX','WBD','WDC','WDAY','WMT','XEL','ZS',
  'AMD',
];

const SP500 = [
  'A','AAPL','ABBV','ABNB','ABT','ACGL','ACN','ADBE','ADI','ADM',
  'ADP','ADSK','AEE','AEP','AES','AFL','AIG','AIZ','AJG','AKAM',
  'ALB','ALGN','ALL','ALLE','AMAT','AMCR','AMD','AME','AMGN','AMP',
  'AMT','AMZN','ANET','ANSS','AOS','APA','APD','APH','APO','APP',
  'ARE','ATO','AVGO','AVB','AVY','AWK','AXON','AXP','BA','BAC',
  'BALL','BAX','BBWI','BBY','BDX','BEN','BFB','BG','BIIB','BK',
  'BKNG','BKR','BLDR','BLK','BMY','BR','BRO','BRKB','BSX','BX',
  'BXP','C','CAG','CAH','CARR','CAT','CB','CBOE','CCI','CCL',
  'CDNS','CDW','CEG','CF','CFG','CHD','CHRW','CHTR','CI','CIEN',
  'CINF','CL','CLX','CMS','CNC','CNP','COF','COO','COP','COR',
  'COST','CPRT','CPB','CPT','CRH','CRL','CRM','CRWD','CSCO','CSGP',
  'CSX','CTAS','CTSH','CTRA','CTVA','CVNA','CVS','CVX','D','DAL',
  'DASH','DDOG','DD','DE','DECK','DELL','DG','DGX','DHI','DHR',
  'DIS','DLTR','DOV','DOW','DPZ','DRI','DTE','DUK','DVA','DVN',
  'DXCM','EA','EBAY','ECL','ED','EFX','EG','EIX','EL','EME',
  'EMN','EMR','EQIX','EQR','EQT','ERIE','ES','ESS','ETN','ETR',
  'EW','EXC','EXE','EXPE','EXR','F','FANG','FAST','FSLR','FBHS',
  'FCX','FDS','FDX','FE','FFIV','FICO','FI','FIS','FITB','FIX',
  'FLT','FMC','FOX','FOXA','FRT','FTV','GD','GDDY','GE','GEHC',
  'GEN','GEV','GILD','GIS','GL','GLW','GM','GNRC','GOOG','GOOGL',
  'GPC','GPN','GRMN','GS','GWW','HAL','HAS','HBAN','HCA','HD',
  'HOLX','HON','HOOD','HPE','HPQ','HRL','HSIC','HST','HSY','HUBB',
  'HWM','IBM','ICE','IDXX','IEX','IFF','INCY','INTC','INTU','INVH',
  'IP','IQV','IR','IRM','ISRG','IT','ITW','IVZ','JBHT','JBL',
  'JCI','JKHY','JNJ','JPM','K','KDP','KEY','KHC','KIM','KKR',
  'KLAC','KMB','KMI','KO','KR','KVUE','L','LDOS','LEN','LH',
  'LHX','LII','LIN','LLY','LMT','LOW','LRCX','LULU','LUV','LVS',
  'LW','LYB','LYV','MA','MAA','MAR','MCD','MCHP','MCK','MCO',
  'MDLZ','MDT','MET','META','MGM','MKC','MLM','MMM','MNST','MO',
  'MOH','MOS','MPC','MPWR','MRNA','MRSH','MRVL','MS','MSCI','MSFT',
  'MSI','MTB','MTD','MU','NCLH','NDAQ','NDSN','NEE','NEM','NFLX',
  'NI','NKE','NOC','NOW','NRG','NSC','NTAP','NTRS','NUE','NVDA',
  'NVR','NWS','NWSA','NXPI','O','ODFL','OKE','OMC','ON','ORCL',
  'ORLY','OTIS','OXY','PANW','PARA','PAYC','PAYX','PCAR','PCG','PEG',
  'PEP','PFE','PFG','PG','PGR','PH','PHM','PKG','PLD','PLTR',
  'PM','PNC','PNR','PNW','PODD','POOL','PPG','PPL','PRU','PSA',
  'PSX','PTC','PVH','PWR','PYPL','QCOM','RCL','REG','REGN','RF',
  'RJF','RL','RMD','ROK','ROL','ROP','ROST','RSG','RTX','RVTY',
  'SBAC','SBUX','SCHW','SHW','SJM','SLB','SMCI','SNA','SNDK','SNPS',
  'SO','SOLV','SPG','SPGI','SRE','STE','STLD','STT','STZ','SWK',
  'SWKS','SYF','SYK','SYY','T','TAP','TDG','TDY','TER','TFC',
  'TGT','TJX','TKO','TMUS','TPL','TPR','TRGP','TRMB','TRV','TSCO',
  'TSLA','TSN','TT','TTD','TTWO','TXN','TXT','TYL','UAL','UBER',
  'UDR','UHS','ULTA','UNH','UNP','UPS','URI','USB','V','VICI',
  'VLO','VLTO','VMC','VRSK','VRSN','VRTX','VTR','VTRS','VZ','WAB',
  'WAT','WBA','WBD','WDC','WEC','WELL','WFC','WM','WMB','WMT',
  'WRB','WRK','WSM','WST','WTW','WY','WYNN','XEL','XOM','XYL',
  'XYZ','YUM','ZBH','ZBRA','ZTS',
];

const RUSSELL_2000: string[] = []; // TODO: source from iShares IWM holdings
const SP400: string[] = []; // TODO: source from iShares IJH holdings
const SP600: string[] = []; // TODO: source from iShares IJR holdings
const WILSHIRE_5000: string[] = []; // TODO: source from iShares ITOT holdings
const MSCI_USA: string[] = []; // TODO: source from iShares ITOT holdings
const RUSSELL_1000: string[] = []; // TODO: source from iShares IWB holdings

function getAllSymbols(): string[] {
  return [...new Set([
    ...SP500, ...NASDAQ_100, ...DOW_30,
  ])];
}

// ===== HELPERS =====

function round(v: number, decimals = 2): number {
  const f = Math.pow(10, decimals);
  return Math.round(v * f) / f;
}

const BATCH_SIZE = 50;

/**
 * Parse raw TT market metrics response into TTScannerData objects.
 * Same field mapping as src/app/api/tastytrade/scanner/route.ts
 */
function parseMarketMetrics(items: Record<string, unknown>[]): TTScannerData[] {
  return items
    .map((m) => {
      const earningsDate =
        (m['earnings'] as Record<string, unknown>)?.['expected-report-date'] as string ||
        m['next-earnings-date'] as string ||
        null;
      let daysTillEarnings: number | null = null;
      if (earningsDate) {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        daysTillEarnings = Math.round(
          (new Date(earningsDate + 'T00:00:00').getTime() - now.getTime()) / 86400000,
        );
      }

      const symbol = (m['symbol'] as string) || '';
      if (!symbol) return null;

      return {
        symbol,
        ivRank: Number(
          m['implied-volatility-index-rank'] ||
          m['tos-implied-volatility-index-rank'] ||
          m['tw-implied-volatility-index-rank'] ||
          0,
        ),
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
        earningsActualEps:
          (m['earnings'] as Record<string, unknown>)?.['actual-eps'] != null
            ? parseFloat(String((m['earnings'] as Record<string, unknown>)['actual-eps']))
            : null,
        earningsEstimate:
          (m['earnings'] as Record<string, unknown>)?.['consensus-estimate'] != null
            ? parseFloat(String((m['earnings'] as Record<string, unknown>)['consensus-estimate']))
            : null,
        earningsTimeOfDay:
          ((m['earnings'] as Record<string, unknown>)?.['time-of-day'] as string) || null,
        termStructure: (
          (m['option-expiration-implied-volatilities'] as Array<Record<string, unknown>>) || []
        )
          .filter((e) => e['implied-volatility'])
          .map((e) => ({
            date: String(e['expiration-date']),
            iv: parseFloat(String(e['implied-volatility'])),
          })),
      } satisfies TTScannerData;
    })
    .filter((item): item is TTScannerData => item !== null);
}

// ===== UNIVERSE SELECTOR =====

function getUniverseSymbols(universe?: string): string[] {
  switch (universe) {
    case 'sp500': return [...SP500];
    case 'nasdaq100': return [...NASDAQ_100];
    case 'russell2000': return [...RUSSELL_2000];
    case 'sp400': return [...SP400];
    case 'dow30': return [...DOW_30];
    case 'sp600': return [...SP600];
    case 'wilshire5000': return [...WILSHIRE_5000];
    case 'msciusa': return [...MSCI_USA];
    case 'russell1000': return [...RUSSELL_1000];
    default: return [...SP500];
  }
}

// ===== REG SHO THRESHOLD LIST =====

async function fetchRegShoThreshold(): Promise<Set<string>> {
  const res = await fetch('https://www.nasdaqtrader.com/dynamic/symdir/regsho/nasdaqth.txt');
  if (!res.ok) {
    throw new Error(`Reg SHO fetch failed: HTTP ${res.status} — pipeline cannot proceed without filter 6 data`);
  }
  const text = await res.text();
  const symbols = new Set<string>();
  const lines = text.split('\n');
  for (const line of lines) {
    if (!line.trim() || line.startsWith('Date') || line.startsWith('File')) continue;
    const parts = line.split('|');
    const sym = parts[0]?.trim();
    if (sym && sym.length > 0 && sym.length <= 6 && /^[A-Z]+$/.test(sym)) {
      symbols.add(sym);
    }
  }
  console.log(`[Pipeline] Reg SHO threshold list: ${symbols.size} symbols loaded`);
  return symbols;
}

// ===== MAIN PIPELINE =====

export async function runPipeline(
  limit: number = 20,
  userId?: string,
  universe?: string,
  onProgress?: (event: { step: string; label: string; data: Record<string, unknown> }) => void,
): Promise<PipelineResult> {
  const pipelineStart = Date.now();
  const errors: string[] = [];
  const dataGaps: string[] = [];

  // ===== PRE-STEP: Fetch Reg SHO threshold list =====
  const regShoSymbols = await fetchRegShoThreshold();

  // ===== STEP A: Fetch TT Scanner (all tickers, batched) =====
  console.log('[Pipeline] Step A: Fetching TT scanner data...');
  let allScannerData: TTScannerData[] = [];
  let stepAFetchedAt = new Date().toISOString();
  try {
    const client = getTastytradeClient();
    await client.accountsAndCustomersService.getCustomerResource();

    const allSymbols = getUniverseSymbols(universe);
    console.log(`[Pipeline] Step A: Fetching ${allSymbols.length} symbols in batches of ${BATCH_SIZE}...`);

    // Batch symbols into chunks and fetch (same pattern as scanner/route.ts)
    const batches: string[][] = [];
    for (let i = 0; i < allSymbols.length; i += BATCH_SIZE) {
      batches.push(allSymbols.slice(i, i + BATCH_SIZE));
    }

    const batchResults = await Promise.all(
      batches.map(async (batch) => {
        try {
          const raw = await client.marketMetricsService.getMarketMetrics({
            symbols: batch.join(','),
          });
          return Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[Pipeline] Step A batch error:`, msg);
          errors.push(`Step A batch error: ${msg}`);
          return [];
        }
      }),
    );

    const items = batchResults.flat();
    stepAFetchedAt = new Date().toISOString();
    allScannerData = parseMarketMetrics(items);
    console.log(`[Pipeline] Step A: Got ${allScannerData.length} tickers from TT scanner`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(`Step A (TT Scanner): ${msg}`);
    console.error('[Pipeline] Step A failed:', msg);
  }

  const totalUniverse = allScannerData.length;
  onProgress?.({ step: 'step_a', label: 'TT Scanner', data: {
    total_universe: allScannerData.length,
    market_open: isMarketOpen().open,
    fetched_at: stepAFetchedAt,
    source: 'TastyTrade',
    symbols: allScannerData.map(d => ({
      symbol: d.symbol,
      ivRank: d.ivRank,
      ivPercentile: d.ivPercentile,
      impliedVolatility: d.impliedVolatility,
      iv30: d.iv30,
      hv30: d.hv30,
      hv60: d.hv60,
      hv90: d.hv90,
      ivHvSpread: d.ivHvSpread,
      liquidityRating: d.liquidityRating,
      earningsDate: d.earningsDate,
      daysTillEarnings: d.daysTillEarnings,
      borrowRate: d.borrowRate,
      lendability: d.lendability,
      marketCap: d.marketCap,
      beta: d.beta,
      corrSpy: d.corrSpy,
      sector: d.sector,
      industry: d.industry,
      peRatio: d.peRatio,
      eps: d.eps,
      dividendYield: d.dividendYield,
      earningsActualEps: d.earningsActualEps,
      earningsEstimate: d.earningsEstimate,
      earningsTimeOfDay: d.earningsTimeOfDay,
      termStructure: d.termStructure,
    })),
  } });

  // ===== STEP A2: Pre-Filter (market-metrics-based ranking) =====
  console.log('[Pipeline] Step A2: Running market-metrics pre-filter...');
  const preFilterResults = computePreFilter(allScannerData);
  console.log(`[Pipeline] Step A2: ${preFilterResults.length} tickers ranked by preScore`);

  onProgress?.({ step: 'step_b', label: 'Pre-Filter', data: {
    input: allScannerData.length,
    output: preFilterResults.length,
    tickers: preFilterResults.map(r => ({
      symbol: r.symbol,
      pre_score: Math.round(r.preScore * 100),
      iv_rank: r.ivRank,
      iv_hv_spread: r.ivHvSpread,
      liquidity: r.liquidityRating,
    })),
  } });

  // ===== STEP C (new): Hard Exclusions =====
  // Step C applies exclusion rules that Step B (ranking) does not.
  const stepCExcluded: { symbol: string; reason: string }[] = [];
  const stepCIncluded: typeof preFilterResults = [];

  for (const r of preFilterResults) {
    const t = allScannerData.find(s => s.symbol === r.symbol)!;
    let excludeReason: string | null = null;

    if (t.ivHvSpread == null) {
      excludeReason = 'IV-HV spread unavailable — cannot assess vol premium';
    } else if (t.ivHvSpread <= 0) {
      excludeReason = `No vol premium — IV-HV spread is ${t.ivHvSpread.toFixed(1)} (realized vol exceeds implied)`;
    }

    if (excludeReason == null && r.liquidityRating == null) {
      excludeReason = 'Liquidity rating unavailable — cannot score liquidity';
    } else if (excludeReason == null && r.liquidityRating != null && r.liquidityRating < 2) {
      excludeReason = `Low liquidity rating (${r.liquidityRating}/5)`;
    }

    if (excludeReason != null) {
      stepCExcluded.push({ symbol: r.symbol, reason: excludeReason });
    } else {
      stepCIncluded.push(r);
    }
  }

  const earningsWarnings = stepCIncluded
    .filter(r => {
      const t = allScannerData.find(s => s.symbol === r.symbol);
      return t != null && t.daysTillEarnings != null && t.daysTillEarnings >= 0 && t.daysTillEarnings <= 3;
    })
    .map(r => ({ symbol: r.symbol, days_to_earnings: allScannerData.find(t => t.symbol === r.symbol)?.daysTillEarnings ?? null }));

  console.log(`[Pipeline] Step C: ${stepCIncluded.length} survived, ${stepCExcluded.length} excluded`);

  onProgress?.({ step: 'step_c', label: 'Hard Exclusions', data: {
    survivors: stepCIncluded.length,
    excluded: stepCExcluded.length,
    exclusions: stepCExcluded,
    earnings_warnings: earningsWarnings,
  } });

  // Use pre-filter to narrow the candidate set: take top (limit * 2) non-excluded
  // tickers by preScore. This reduces the universe BEFORE hard filters + Finnhub.
  const preFilterTopN = Math.min(limit * 2, stepCIncluded.length);
  const preFilterCandidates = new Set(
    stepCIncluded.slice(0, preFilterTopN).map(r => r.symbol)
  );
  const preFilteredScannerData = allScannerData.filter(t => preFilterCandidates.has(t.symbol));
  console.log(`[Pipeline] Step D: Narrowed ${stepCIncluded.length} → ${preFilteredScannerData.length} by preScore (top ${preFilterTopN})`);

  // ===== STEP D (new): Top-N Selection =====
  const cutoffScore = stepCIncluded[preFilterTopN - 1]?.preScore ?? 0;
  onProgress?.({ step: 'step_d', label: 'Top-N Selection', data: {
    input: stepCIncluded.length,
    selected: preFilterTopN,
    cutoff_score: Math.round(cutoffScore * 100),
  } });

  // ===== STEP B: Hard Filters =====
  console.log('[Pipeline] Step B: Applying hard filters...');
  const hardFilters = applyHardFilters(preFilteredScannerData, regShoSymbols);
  console.log(`[Pipeline] Step B: ${hardFilters.input_count} → ${hardFilters.output_count} tickers`);
  onProgress?.({ step: 'step_e', label: 'Hard Filters', data: { input: hardFilters.input_count, output: hardFilters.output_count, filters: hardFilters.filters_applied, survivors: hardFilters.survivors, ticker_rejections: hardFilters.ticker_rejections, ticker_warnings: hardFilters.ticker_warnings, ticker_details: Object.fromEntries(preFilteredScannerData.map(t => [t.symbol, { market_cap: t.marketCap, liquidity_rating: t.liquidityRating, iv30: t.iv30, borrow_rate: t.borrowRate, days_till_earnings: t.daysTillEarnings, reg_sho: regShoSymbols.has(t.symbol), borrow_warning: hardFilters.ticker_warnings[t.symbol] != null }])) } });

  // Build a map for quick lookup
  const scannerMap = new Map<string, TTScannerData>();
  for (const item of allScannerData) {
    scannerMap.set(item.symbol, item);
  }

  const survivors = hardFilters.survivors.map(s => scannerMap.get(s)!).filter(Boolean);

  // ===== STEP C1: Fetch Finnhub peer tickers for each survivor =====
  console.log('[Pipeline] Step C1: Fetching Finnhub /stock/peers for survivors...');
  const finnhubPeersMap: Record<string, string[]> = {};
  const peerFetchPromises = survivors.map(async (item) => {
    try {
      const result = await fetchPeerTickers(item.symbol);
      if (result.data && result.data.length > 0) {
        finnhubPeersMap[item.symbol] = result.data;
      }
    } catch {
      // Non-critical — fall through to GICS grouping
    }
  });
  // Hard 10-second cap on entire peers fetch step
  await Promise.race([
    Promise.all(peerFetchPromises),
    new Promise(r => setTimeout(r, 10000)),
  ]);
  const peersFound = Object.values(finnhubPeersMap).filter(p => p.length > 0).length;
  console.log(`[Pipeline] Step C1: Finnhub peers fetched for ${peersFound}/${survivors.length} survivors`);

  // ===== STEP C2: Initial Peer Stats (will be enhanced with text peers in Step E11) =====
  console.log('[Pipeline] Step C2: Computing initial peer stats (finnhub-peers → industry → sector fallback)...');
  let { stats: peerStats, assignment: peerGroupAssignment } = computePeerStats(
    survivors, undefined, finnhubPeersMap, scannerMap,
  );
  let textPeerGroups: Record<string, TextBasedPeerGroup> = {};
  onProgress?.({ step: 'step_f', label: 'Peer Grouping', data: {
    groups: survivors.map(s => {
      const groupKey = peerGroupAssignment[s.symbol];
      const ps = groupKey ? peerStats[groupKey] : undefined;
      const zScore = (value: number | null | undefined, metric: keyof NonNullable<typeof ps>['metrics']) => {
        if (!ps || value == null) return null;
        const m = ps.metrics[metric];
        if (!m || m.std === 0) return null;
        return ((value - m.mean) / m.std).toFixed(2);
      };
      return {
        symbol: s.symbol,
        peer_group: ps?.peer_group_name ?? 'No peer group found',
        peer_count: ps?.ticker_count ?? 0,
        group_type: ps?.peer_group_type ?? 'unknown',
        group_key: groupKey ?? null,
        insufficient_peers: ps?.insufficient_peers ?? false,
        peer_mean_iv: ps?.metrics?.iv_percentile?.mean != null ? ps.metrics.iv_percentile.mean.toFixed(1) : null,
        peer_mean_iv30: ps?.metrics?.iv30?.mean != null ? ps.metrics.iv30.mean.toFixed(1) : null,
        z_iv_percentile: zScore(s.ivPercentile, 'iv_percentile'),
        z_iv30: zScore(s.iv30, 'iv30'),
        z_iv_hv_spread: zScore(s.iv30 != null && s.hv30 != null ? s.iv30 - s.hv30 : undefined, 'iv_hv_spread'),
        z_beta: zScore(s.beta, 'beta'),
        my_iv_percentile: s.ivPercentile ?? null,
        my_iv30: s.iv30 ?? null,
        my_beta: s.beta ?? null,
        peer_stdev_iv: ps?.metrics?.iv_percentile?.std != null
          ? round(ps.metrics.iv_percentile.std, 2)
          : null,
        peer_stdev_iv30: ps?.metrics?.iv30?.std != null
          ? round(ps.metrics.iv30.std, 2)
          : null,
        peer_mean_beta: ps?.metrics?.beta?.mean != null
          ? round(ps.metrics.beta.mean, 2)
          : null,
        peer_stdev_beta: ps?.metrics?.beta?.std != null
          ? round(ps.metrics.beta.std, 2)
          : null,
      };
    }),
  } });

  // ===== STEP D: Pre-Score and Limit =====
  console.log('[Pipeline] Step D: Pre-scoring and limiting...');
  const preScores = computePreScores(survivors);
  // Overfetch: fetch 2x the desired final count so convergence gate + quality floor
  // exclusions don't leave us short on tickers for the final 9
  const fetchCount = Math.min(limit * 2, preScores.length);
  const topN = preScores.slice(0, fetchCount);
  const topSymbols = topN.map(r => r.symbol);
  console.log(`[Pipeline] Step D: Top ${topSymbols.length} selected for Finnhub fetch (limit=${limit}, fetch=2x)`);
  onProgress?.({ step: 'step_g', label: 'Pre-Score', data: {
    candidates: topSymbols.length,
    total: preScores.length,
    pre_scores: preScores.map((r, i) => ({
      symbol: r.symbol,
      pre_score: Math.round(r.pre_score),
      ivp: r.ivp,
      iv_hv_spread: r.iv_hv_spread ? Math.round(r.iv_hv_spread * 10) / 10 : null,
      liquidity: r.liquidity,
      selected: i < fetchCount,
      rank: i + 1,
      reason: i < fetchCount
        ? `✓ Ranked #${i + 1} — selected for full data enrichment`
        : `✗ Ranked #${i + 1} — below top ${fetchCount} cutoff. Score ${Math.round(r.pre_score)} vs cutoff ${Math.round(preScores[fetchCount - 1]?.pre_score ?? 0)}`,
    })),
  } });

  // ===== STEP H: Macro & Regime Data =====
  const fredStart = Date.now();
  const [fredResult, fredDailyResult] = await Promise.all([
    fetchFredMacro(),
    fetchFredDailySeries(),
  ]);
  const fredMs = Date.now() - fredStart;

  if (fredResult.error) {
    errors.push(`Step H (FRED macro): ${fredResult.error}`);
  }
  if (fredDailyResult.error) {
    errors.push(`Step H (FRED daily): ${fredDailyResult.error}`);
  }

  const crossAssetCorrelations: CrossAssetCorrelations | null = computeCrossAssetCorrelations(fredDailyResult.data);

  const fedNetLiquidity = (
    fredResult.data.fedBalanceSheet != null &&
    fredResult.data.treasuryGeneralAccount != null &&
    fredResult.data.overnightReverseRepo != null
  )
    ? fredResult.data.fedBalanceSheet
      - fredResult.data.treasuryGeneralAccount
      - fredResult.data.overnightReverseRepo
    : null;

  const vixTermStructureSlope = (
    fredResult.data.vix != null &&
    fredResult.data.vxvShortTerm != null &&
    fredResult.data.vxvShortTerm > 0
  )
    ? fredResult.data.vix / fredResult.data.vxvShortTerm
    : null;

  onProgress?.({ step: 'step_h', label: 'Macro & Regime Data', data: {
    fetched_at: new Date().toISOString(),
    fetch_ms: fredMs,
    cached: fredResult.cached,
    series: [
      { name: 'VIX', key: 'vix', value: fredResult.data.vix,
        source: 'FRED', series_id: 'VIXCLS', null_reason: fredResult.data.vix == null ? 'FRED returned null' : null },
      { name: 'VIX Short-Term (9d)', key: 'vxvShortTerm', value: fredResult.data.vxvShortTerm,
        source: 'FRED', series_id: 'VXVCLS', null_reason: fredResult.data.vxvShortTerm == null ? 'FRED returned null' : null },
      { name: 'VVIX', key: 'vvix', value: fredResult.data.vvix,
        source: 'FRED', series_id: 'VVIXCLS', null_reason: fredResult.data.vvix == null ? 'FRED returned null' : null },
      { name: 'Fed Funds Rate', key: 'fedFunds', value: fredResult.data.fedFunds,
        source: 'FRED', series_id: 'FEDFUNDS', null_reason: fredResult.data.fedFunds == null ? 'FRED returned null' : null },
      { name: '10Y Treasury', key: 'treasury10y', value: fredResult.data.treasury10y,
        source: 'FRED', series_id: 'DGS10', null_reason: fredResult.data.treasury10y == null ? 'FRED returned null' : null },
      { name: 'Yield Curve (10Y-2Y)', key: 'yieldCurveSpread', value: fredResult.data.yieldCurveSpread,
        source: 'FRED', series_id: 'T10Y2Y', null_reason: fredResult.data.yieldCurveSpread == null ? 'FRED returned null' : null },
      { name: '10Y-3M Spread', key: 't10y3m', value: fredResult.data.t10y3m,
        source: 'FRED', series_id: 'T10Y3M', null_reason: fredResult.data.t10y3m == null ? 'FRED returned null' : null },
      { name: 'CPI YoY', key: 'cpi', value: fredResult.data.cpi,
        source: 'FRED', series_id: 'CPIAUCSL', null_reason: fredResult.data.cpi == null ? 'FRED returned null' : null },
      { name: 'CPI MoM', key: 'cpiMom', value: fredResult.data.cpiMom,
        source: 'FRED', series_id: 'CPIAUCSL_MOM', null_reason: fredResult.data.cpiMom == null ? 'FRED returned null' : null },
      { name: '5Y Breakeven Inflation', key: 'breakeven5y', value: fredResult.data.breakeven5y,
        source: 'FRED', series_id: 'T5YIE', null_reason: fredResult.data.breakeven5y == null ? 'FRED returned null' : null },
      { name: 'Unemployment', key: 'unemployment', value: fredResult.data.unemployment,
        source: 'FRED', series_id: 'UNRATE', null_reason: fredResult.data.unemployment == null ? 'FRED returned null' : null },
      { name: 'Nonfarm Payrolls', key: 'nonfarmPayrolls', value: fredResult.data.nonfarmPayrolls,
        source: 'FRED', series_id: 'PAYEMS', null_reason: fredResult.data.nonfarmPayrolls == null ? 'FRED returned null' : null },
      { name: 'Initial Claims', key: 'initialClaims', value: fredResult.data.initialClaims,
        source: 'FRED', series_id: 'ICSA', null_reason: fredResult.data.initialClaims == null ? 'FRED returned null' : null },
      { name: 'GDP', key: 'gdp', value: fredResult.data.gdp,
        source: 'FRED', series_id: 'GDPC1', null_reason: fredResult.data.gdp == null ? 'FRED returned null' : null },
      { name: 'Consumer Confidence', key: 'consumerConfidence', value: fredResult.data.consumerConfidence,
        source: 'FRED', series_id: 'UMCSENT', null_reason: fredResult.data.consumerConfidence == null ? 'FRED returned null' : null },
      { name: 'NFCI', key: 'nfci', value: fredResult.data.nfci,
        source: 'FRED', series_id: 'NFCI', null_reason: fredResult.data.nfci == null ? 'FRED returned null' : null },
      { name: 'HY Credit Spread', key: 'hySpread', value: fredResult.data.hySpread,
        source: 'FRED', series_id: 'BAMLH0A0HYM2', null_reason: fredResult.data.hySpread == null ? 'FRED returned null' : null },
      { name: 'BBB Credit Spread', key: 'bbbSpread', value: fredResult.data.bbbSpread,
        source: 'FRED', series_id: 'BAMLC0A4CBBB', null_reason: fredResult.data.bbbSpread == null ? 'FRED returned null' : null },
      { name: 'Fed Balance Sheet', key: 'fedBalanceSheet', value: fredResult.data.fedBalanceSheet,
        source: 'FRED', series_id: 'WALCL', null_reason: fredResult.data.fedBalanceSheet == null ? 'FRED returned null' : null },
      { name: 'Treasury General Account', key: 'treasuryGeneralAccount', value: fredResult.data.treasuryGeneralAccount,
        source: 'FRED', series_id: 'WTREGEN', null_reason: fredResult.data.treasuryGeneralAccount == null ? 'FRED returned null' : null },
      { name: 'Overnight Reverse Repo', key: 'overnightReverseRepo', value: fredResult.data.overnightReverseRepo,
        source: 'FRED', series_id: 'RRPONTSYD', null_reason: fredResult.data.overnightReverseRepo == null ? 'FRED returned null' : null },
      { name: 'Dollar Index', key: 'dollarIndex', value: fredResult.data.dollarIndex,
        source: 'FRED', series_id: 'DTWEXBGS', null_reason: fredResult.data.dollarIndex == null ? 'FRED returned null' : null },
    ],
    computed: {
      fed_net_liquidity: {
        value: fedNetLiquidity,
        formula: 'WALCL − WTREGEN − RRPONTSYD',
        inputs: {
          walcl: fredResult.data.fedBalanceSheet,
          wtregen: fredResult.data.treasuryGeneralAccount,
          rrpontsyd: fredResult.data.overnightReverseRepo,
        },
        null_reason: fedNetLiquidity == null
          ? 'One or more inputs (WALCL, WTREGEN, RRPONTSYD) returned null from FRED'
          : null,
      },
      vix_term_structure_slope: {
        value: vixTermStructureSlope,
        formula: 'VIXCLS / VXVCLS — < 1 = contango = favorable for vol selling',
        inputs: {
          vix: fredResult.data.vix,
          vxv: fredResult.data.vxvShortTerm,
        },
        null_reason: vixTermStructureSlope == null
          ? 'VIX or VXV returned null from FRED'
          : null,
      },
    },
  } });

  // ===== STEP E: Fetch Finnhub =====
  console.log('[Pipeline] Step E: Fetching Finnhub data...');
  const finnhubStart = Date.now();

  const finnhubResult = await fetchFinnhubBatch(topSymbols, 200);

  const finnhubMs = Date.now() - finnhubStart;
  console.log(`[Pipeline] Step E: Finnhub fetched in ${finnhubMs}ms`);

  // Fetch annual financials per symbol (for Piotroski YoY signals)
  const annualFinancialsMap = new Map<string, AnnualFinancials | null>();
  for (const symbol of topSymbols) {
    try {
      const result = await fetchAnnualFinancials(symbol);
      annualFinancialsMap.set(symbol, result.data);
      if (result.error) errors.push(`Step E (annual-financials ${symbol}): ${result.error}`);
    } catch (e: unknown) {
      annualFinancialsMap.set(symbol, null);
    }
  }

  // Options flow: populated from TastyTrade chain data in Step G2.
  // Before G2, all tickers score with null optionsFlow (neutral imputation).
  // After G2, tickers are re-scored with real OptionsFlowData.
  const optionsFlowMap = new Map<string, OptionsFlowData | null>();

  // Steps E3-E11: Fetch enrichment data in parallel (each step loops over topSymbols with its own rate-limit delays)
  console.log('[Pipeline] Steps E3-E11: Fetching enrichment data in parallel...');
  const newsSentimentMap = new Map<string, NewsSentimentData | null>();
  const finbertMap = new Map<string, FinnhubNewsSentiment | null>();
  const earningsQualityMap = new Map<string, FinnhubEarningsQuality | null>();
  const institutionalOwnershipMap = new Map<string, FinnhubInstitutionalOwnership | null>();
  const revenueBreakdownMap = new Map<string, FinnhubRevenueBreakdown | null>();
  const quarterlyFinancialsMap = new Map<string, QuarterlyFinancials | null>();
  const secFilingMap = new Map<string, SECFilingData | null>();
  const secForm4Map = new Map<string, SECForm4Data | null>();
  const textProfiles: CompanyTextProfile[] = [];
  const ebitdaEstimateMap = new Map<string, FinnhubEbitdaEstimate | null>();
  const ebitEstimateMap = new Map<string, FinnhubEbitEstimate | null>();
  const dividendHistoryMap = new Map<string, FinnhubDividendHistory | null>();
  const priceMetricsMap = new Map<string, FinnhubPriceMetrics | null>();
  const fundOwnershipMap = new Map<string, FinnhubFundOwnership | null>();
  const edgar8kMap = new Map<string, SECEdgar8KScan | null>();
  const earningsCalendarMap = new Map<string, FinnhubEarningsCalendar | null>();

  await Promise.all([
    // E3: News Sentiment
    (async () => {
      console.log('[Pipeline] Step E3: Fetching news sentiment data...');
      for (const symbol of topSymbols) {
        try {
          const result = await fetchNewsSentiment(symbol);
          newsSentimentMap.set(symbol, result.data);
          if (result.error) errors.push(`Step E3 (news-sentiment ${symbol}): ${result.error}`);
        } catch (e: unknown) {
          newsSentimentMap.set(symbol, null);
        }
        await new Promise(r => setTimeout(r, 800)); // Finnhub rate limit
      }
      console.log(`[Pipeline] Step E3: News sentiment fetched for ${topSymbols.length} symbols`);
    })(),
    // E4: FinBERT
    (async () => {
      console.log('[Pipeline] Step E4: Fetching Finnhub FinBERT sentiment...');
      for (const symbol of topSymbols) {
        try {
          const result = await fetchFinnhubNewsSentiment(symbol);
          finbertMap.set(symbol, result.data);
          if (result.error) errors.push(`Step E4 (finbert ${symbol}): ${result.error}`);
        } catch (e: unknown) {
          finbertMap.set(symbol, null);
        }
        await new Promise(r => setTimeout(r, 200)); // Finnhub rate limit
      }
      console.log(`[Pipeline] Step E4: FinBERT sentiment fetched for ${topSymbols.length} symbols`);
    })(),
    // E5: Earnings Quality
    (async () => {
      console.log('[Pipeline] Step E5: Fetching Finnhub earnings quality scores...');
      for (const symbol of topSymbols) {
        try {
          const result = await fetchFinnhubEarningsQuality(symbol);
          earningsQualityMap.set(symbol, result.data);
          if (result.error) errors.push(`Step E5 (earnings-quality ${symbol}): ${result.error}`);
        } catch (e: unknown) {
          earningsQualityMap.set(symbol, null);
        }
        await new Promise(r => setTimeout(r, 200)); // Finnhub rate limit
      }
      console.log(`[Pipeline] Step E5: Earnings quality fetched for ${topSymbols.length} symbols`);
    })(),
    // E6: Institutional Ownership
    (async () => {
      console.log('[Pipeline] Step E6: Fetching institutional ownership data...');
      for (const symbol of topSymbols) {
        try {
          const result = await fetchFinnhubInstitutionalOwnership(symbol);
          institutionalOwnershipMap.set(symbol, result.data);
          if (result.error) errors.push(`Step E6 (institutional-ownership ${symbol}): ${result.error}`);
        } catch (e: unknown) {
          institutionalOwnershipMap.set(symbol, null);
        }
        await new Promise(r => setTimeout(r, 200)); // Finnhub rate limit
      }
      console.log(`[Pipeline] Step E6: Institutional ownership fetched for ${topSymbols.length} symbols`);
    })(),
    // E7: Revenue Breakdown
    (async () => {
      console.log('[Pipeline] Step E7: Fetching revenue breakdown data...');
      for (const symbol of topSymbols) {
        try {
          const result = await fetchFinnhubRevenueBreakdown(symbol);
          revenueBreakdownMap.set(symbol, result.data);
          if (result.error) errors.push(`Step E7 (revenue-breakdown ${symbol}): ${result.error}`);
        } catch (e: unknown) {
          revenueBreakdownMap.set(symbol, null);
        }
        await new Promise(r => setTimeout(r, 200)); // Finnhub rate limit
      }
      console.log(`[Pipeline] Step E7: Revenue breakdown fetched for ${topSymbols.length} symbols`);
    })(),
    // E8: Quarterly Financials
    (async () => {
      console.log('[Pipeline] Step E8: Fetching quarterly financials (bs/ic/cf)...');
      for (const symbol of topSymbols) {
        try {
          const result = await fetchQuarterlyFinancials(symbol);
          quarterlyFinancialsMap.set(symbol, result.data);
          if (result.error) errors.push(`Step E8 (quarterly-financials ${symbol}): ${result.error}`);
        } catch (e: unknown) {
          quarterlyFinancialsMap.set(symbol, null);
        }
        await new Promise(r => setTimeout(r, 200)); // Finnhub rate limit (3 calls per symbol already batched)
      }
      console.log(`[Pipeline] Step E8: Quarterly financials fetched for ${topSymbols.length} symbols`);
    })(),
    // E9: SEC EDGAR
    (async () => {
      console.log('[Pipeline] Step E9: Fetching SEC EDGAR filing data...');
      for (const symbol of topSymbols) {
        try {
          const result = await fetchSECFilingData(symbol);
          secFilingMap.set(symbol, result.data);
          if (result.error) errors.push(`Step E9 (sec-edgar ${symbol}): ${result.error}`);
        } catch (e: unknown) {
          secFilingMap.set(symbol, null);
        }
        await new Promise(r => setTimeout(r, 150)); // SEC rate limit: 10 req/sec → 150ms between
      }
      console.log(`[Pipeline] Step E9: SEC EDGAR filing data fetched for ${topSymbols.length} symbols`);
    })(),
    // E10: Insider Transactions
    (async () => {
      console.log('[Pipeline] Step E10: Fetching insider transactions (Finnhub)...');
      for (const symbol of topSymbols) {
        try {
          const result = await fetchInsiderTransactions(symbol);
          secForm4Map.set(symbol, result.data);
          if (result.error) errors.push(`Step E10 (insider-tx ${symbol}): ${result.error}`);
        } catch (e: unknown) {
          secForm4Map.set(symbol, null);
        }
        await new Promise(r => setTimeout(r, 200)); // Finnhub rate limit
      }
      console.log(`[Pipeline] Step E10: Insider transactions fetched for ${topSymbols.length} symbols`);
    })(),
    // E11: 10-K Text
    (async () => {
      console.log('[Pipeline] Step E11: Fetching 10-K business descriptions for text peer classification...');
      for (const symbol of topSymbols) {
        try {
          const result = await fetch10KBusinessDescription(symbol);
          if (result.data) {
            textProfiles.push(result.data);
          }
          if (result.error) errors.push(`Step E11 (10k-text ${symbol}): ${result.error}`);
        } catch (e: unknown) {
          // Non-fatal: text peer classification is an enhancement, not required
        }
        await new Promise(r => setTimeout(r, 150)); // SEC rate limit: 10 req/sec → 150ms between
      }
      console.log(`[Pipeline] Step E11: 10-K text profiles fetched for ${textProfiles.length}/${topSymbols.length} symbols`);
    })(),
    // I1: EBITDA Estimates
    (async () => {
      console.log('[Pipeline] Step I1: Fetching EBITDA estimates...');
      for (const symbol of topSymbols) {
        const result = await fetchFinnhubEbitdaEstimates(symbol);
        ebitdaEstimateMap.set(symbol, result.data);
        if (result.error) errors.push(`Step I1 (ebitda-estimate ${symbol}): ${result.error}`);
        await new Promise(r => setTimeout(r, 200));
      }
      console.log(`[Pipeline] Step I1: EBITDA estimates fetched for ${topSymbols.length} symbols`);
    })(),
    // I2: EBIT Estimates
    (async () => {
      console.log('[Pipeline] Step I2: Fetching EBIT estimates...');
      for (const symbol of topSymbols) {
        const result = await fetchFinnhubEbitEstimates(symbol);
        ebitEstimateMap.set(symbol, result.data);
        if (result.error) errors.push(`Step I2 (ebit-estimate ${symbol}): ${result.error}`);
        await new Promise(r => setTimeout(r, 200));
      }
      console.log(`[Pipeline] Step I2: EBIT estimates fetched for ${topSymbols.length} symbols`);
    })(),
    // I3: Dividend History
    (async () => {
      console.log('[Pipeline] Step I3: Fetching dividend history...');
      for (const symbol of topSymbols) {
        const result = await fetchFinnhubDividendHistory(symbol);
        dividendHistoryMap.set(symbol, result.data);
        if (result.error) errors.push(`Step I3 (dividend ${symbol}): ${result.error}`);
        await new Promise(r => setTimeout(r, 200));
      }
      console.log(`[Pipeline] Step I3: Dividend history fetched for ${topSymbols.length} symbols`);
    })(),
    // I4: Price Metrics
    (async () => {
      console.log('[Pipeline] Step I4: Fetching price metrics...');
      for (const symbol of topSymbols) {
        const result = await fetchFinnhubPriceMetrics(symbol);
        priceMetricsMap.set(symbol, result.data);
        if (result.error) errors.push(`Step I4 (price-metric ${symbol}): ${result.error}`);
        await new Promise(r => setTimeout(r, 200));
      }
      console.log(`[Pipeline] Step I4: Price metrics fetched for ${topSymbols.length} symbols`);
    })(),
    // I5: Fund Ownership
    (async () => {
      console.log('[Pipeline] Step I5: Fetching fund ownership...');
      for (const symbol of topSymbols) {
        const result = await fetchFinnhubFundOwnership(symbol);
        fundOwnershipMap.set(symbol, result.data);
        if (result.error) errors.push(`Step I5 (fund-ownership ${symbol}): ${result.error}`);
        await new Promise(r => setTimeout(r, 200));
      }
      console.log(`[Pipeline] Step I5: Fund ownership fetched for ${topSymbols.length} symbols`);
    })(),
    // I6: SEC EDGAR 8-K Scan
    (async () => {
      console.log('[Pipeline] Step I6: Fetching SEC EDGAR 8-K filings...');
      for (const symbol of topSymbols) {
        const result = await fetchSECEdgar8KScan(symbol);
        edgar8kMap.set(symbol, result.data);
        if (result.error) errors.push(`Step I6 (sec-8k-scan ${symbol}): ${result.error}`);
        await new Promise(r => setTimeout(r, 150));
      }
      console.log(`[Pipeline] Step I6: SEC EDGAR 8-K scan fetched for ${topSymbols.length} symbols`);
    })(),
    // I7: Finnhub Earnings Calendar
    (async () => {
      console.log('[Pipeline] Step I7: Fetching earnings calendar...');
      for (const symbol of topSymbols) {
        const result = await fetchFinnhubEarningsCalendar(symbol);
        earningsCalendarMap.set(symbol, result.data);
        if (result.error) errors.push(`Step I7 (earnings-calendar ${symbol}): ${result.error}`);
        await new Promise(r => setTimeout(r, 200));
      }
      console.log(`[Pipeline] Step I7: Earnings calendar fetched for ${topSymbols.length} symbols`);
    })(),
  ]);
  console.log('[Pipeline] Steps E3-I7: All enrichment data fetched');
  onProgress?.({
    step: 'step_i',
    label: 'Data Enrichment',
    data: {
      fetched_at: new Date().toISOString(),
      finnhub_calls: finnhubResult.stats.calls_made,
      finnhub_errors: finnhubResult.stats.errors,
      data_gaps: dataGaps,
      tickers: topSymbols.map(symbol => {
        const fh = finnhubResult.data.get(symbol);
        const earnings = fh?.earnings ?? [];
        const beatCount = earnings.filter(
          e => (e.actual ?? 0) > (e.estimate ?? 0)
        ).length;
        const recs = fh?.recommendations ?? [];
        const latestRec = recs[0];
        const insider = fh?.insiderSentiment ?? [];
        const latestInsider = insider[0];
        const news = newsSentimentMap.get(symbol);
        const institutional = institutionalOwnershipMap.get(symbol);
        const earningsQuality = earningsQualityMap.get(symbol);
        return {
          symbol,
          earnings_quarters: earnings.length,
          beat_count: beatCount,
          beat_rate: earnings.length > 0
            ? Math.round(beatCount / earnings.length * 100)
            : null,
          analyst_rating: latestRec
            ? `Buy:${latestRec.buy} Hold:${latestRec.hold} Sell:${latestRec.sell}`
            : null,
          insider_sentiment: latestInsider
            ? latestInsider.mspr
            : null,
          news_sentiment: news?.sentiment_7d?.score ?? null,
          institutional_holders: institutional?.topHolderCount ?? null,
          earnings_quality_score: earningsQuality?.score ?? null,
          earnings_quality_letter: earningsQuality?.letterScore ?? null,
          pe_ratio: (fh?.fundamentals?.metric?.['peBasicExclExtraTTM'] as number) ?? null,
          market_cap: (fh?.fundamentals?.metric?.['marketCapitalization'] as number) ?? null,
          ebitda_estimates: ebitdaEstimateMap.get(symbol)?.estimates?.slice(0, 4) ?? null,
          ebitda_estimate_count: ebitdaEstimateMap.get(symbol)?.estimates?.length ?? null,
          ebit_estimates: ebitEstimateMap.get(symbol)?.estimates?.slice(0, 4) ?? null,
          ebit_estimate_count: ebitEstimateMap.get(symbol)?.estimates?.length ?? null,
          dividend_count: dividendHistoryMap.get(symbol)?.dividends?.length ?? null,
          next_ex_date: dividendHistoryMap.get(symbol)?.dividends?.[0]?.exDate ?? null,
          week52_high: (fh?.fundamentals?.metric?.['52WeekHigh'] as number) ?? null,
          week52_low: (fh?.fundamentals?.metric?.['52WeekLow'] as number) ?? null,
          fund_count: fundOwnershipMap.get(symbol)?.totalFunds ?? null,
          top_fund: fundOwnershipMap.get(symbol)?.funds?.[0]?.name ?? null,
          edgar_8k_count: edgar8kMap.get(symbol)?.totalHits ?? null,
          edgar_8k_latest: edgar8kMap.get(symbol)?.filings?.[0]?.filedAt ?? null,
          earnings_calendar_count: earningsCalendarMap.get(symbol)?.earningsCalendar?.length ?? null,
          next_earnings_date: earningsCalendarMap.get(symbol)?.earningsCalendar?.[0]?.date ?? null,
        };
      }),
      finbert_available: finbertMap.size > 0,
      revenue_breakdown_available: revenueBreakdownMap.size > 0,
      quarterly_financials_available: quarterlyFinancialsMap.size > 0,
      form4_available: secForm4Map.size > 0,
    }
  });

  // Compute text-based peer groups from 10-K descriptions
  if (textProfiles.length >= 2) {
    textPeerGroups = computeTextPeerGroups(textProfiles);
    // Re-compute peer stats with text-based peer groups (3-tier: text_nlp → industry → sector)
    console.log('[Pipeline] Step E11b: Re-computing peer stats with text-based peer groups...');
    const enhanced = computePeerStats(survivors, textPeerGroups, finnhubPeersMap, scannerMap);
    peerStats = enhanced.stats;
    peerGroupAssignment = enhanced.assignment;
  }

  // ===== STEP F: Score All 4 Categories =====
  console.log('[Pipeline] Step F: Scoring all categories...');
  const scoredTickers: {
    symbol: string;
    scannerData: TTScannerData;
    finnhubData: FinnhubData;
    scoring: FullScoringResult;
  }[] = [];

  for (const symbol of topSymbols) {
    const scannerData = scannerMap.get(symbol);
    if (!scannerData) continue;

    const finnhubData = finnhubResult.data.get(symbol) || {
      fundamentals: null,
      recommendations: [],
      insiderSentiment: [],
      earnings: [],
      estimateData: null,
    };

    // Assemble ConvergenceInput (same structure as single-ticker route)
    const convergenceInput: ConvergenceInput = {
      symbol,
      ttScanner: scannerData,
      candles: [], // Candles added in Step F2 after initial scoring
      finnhubFundamentals: finnhubData.fundamentals,
      finnhubRecommendations: finnhubData.recommendations,
      finnhubInsiderSentiment: finnhubData.insiderSentiment,
      finnhubEarnings: finnhubData.earnings,
      finnhubEstimates: finnhubData.estimateData ?? null,
      fredMacro: fredResult.data,
      annualFinancials: annualFinancialsMap.get(symbol) ?? null,
      quarterlyFinancials: quarterlyFinancialsMap.get(symbol) ?? null,
      optionsFlow: optionsFlowMap.get(symbol) ?? null,
      newsSentiment: newsSentimentMap.get(symbol) ?? null,
      finnhubNewsSentiment: finbertMap.get(symbol) ?? null,
      finnhubEarningsQuality: earningsQualityMap.get(symbol) ?? null,
      finnhubInstitutionalOwnership: institutionalOwnershipMap.get(symbol) ?? null,
      finnhubRevenueBreakdown: revenueBreakdownMap.get(symbol) ?? null,
      secFilingData: secFilingMap.get(symbol) ?? null,
      secForm4Data: secForm4Map.get(symbol) ?? null,
      finnhubFundOwnership: fundOwnershipMap.get(symbol) ?? null,
      edgar8kScan: edgar8kMap.get(symbol) ?? null,
      crossAssetCorrelations,
      peerStats,
      peerGroupAssignment,
      textPeerGroups: Object.keys(textPeerGroups).length > 0 ? textPeerGroups : undefined,
    };

    try {
      const scoring = scoreAll(convergenceInput);
      scoredTickers.push({ symbol, scannerData, finnhubData, scoring });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`Step F (score ${symbol}): ${msg}`);
    }
  }

  console.log(`[Pipeline] Step F: Scored ${scoredTickers.length} tickers`);

  // ===== STEP F2: Fetch candle data and re-score with real technicals =====
  console.log('[Pipeline] Step F2: Fetching candle data for scored tickers...');
  let candleStats: CandleBatchStats = { total_candles: 0, symbols_with_data: 0, symbols_failed: [], elapsed_ms: 0 };
  const scoredSymbols = scoredTickers.map(t => t.symbol);
  // Hoist candle data so G2.5 re-scoring can access it
  const candleDataMap = new Map<string, CandleData[]>();

  try {
    const candleResult = await fetchTTCandlesBatch(scoredSymbols, 90);
    candleStats = candleResult.stats;
    // Preserve candle data for later re-scoring steps
    for (const [sym, candles] of candleResult.data) {
      candleDataMap.set(sym, candles);
    }

    // Re-score tickers that got candle data
    let reScored = 0;
    for (const ticker of scoredTickers) {
      const candles = candleResult.data.get(ticker.symbol);
      if (!candles || candles.length < 20) continue;

      // Rebuild input with real candles and re-score
      const convergenceInput: ConvergenceInput = {
        symbol: ticker.symbol,
        ttScanner: ticker.scannerData,
        candles,
        finnhubFundamentals: ticker.finnhubData.fundamentals,
        finnhubRecommendations: ticker.finnhubData.recommendations,
        finnhubInsiderSentiment: ticker.finnhubData.insiderSentiment,
        finnhubEarnings: ticker.finnhubData.earnings,
        finnhubEstimates: ticker.finnhubData.estimateData ?? null,
        fredMacro: fredResult.data,
        annualFinancials: annualFinancialsMap.get(ticker.symbol) ?? null,
        quarterlyFinancials: quarterlyFinancialsMap.get(ticker.symbol) ?? null,
        optionsFlow: optionsFlowMap.get(ticker.symbol) ?? null,
        newsSentiment: newsSentimentMap.get(ticker.symbol) ?? null,
        finnhubNewsSentiment: finbertMap.get(ticker.symbol) ?? null,
        finnhubEarningsQuality: earningsQualityMap.get(ticker.symbol) ?? null,
        finnhubInstitutionalOwnership: institutionalOwnershipMap.get(ticker.symbol) ?? null,
        finnhubRevenueBreakdown: revenueBreakdownMap.get(ticker.symbol) ?? null,
        secFilingData: secFilingMap.get(ticker.symbol) ?? null,
        secForm4Data: secForm4Map.get(ticker.symbol) ?? null,
        finnhubFundOwnership: fundOwnershipMap.get(ticker.symbol) ?? null,
        edgar8kScan: edgar8kMap.get(ticker.symbol) ?? null,
        crossAssetCorrelations,
        peerStats,
        peerGroupAssignment,
        textPeerGroups: Object.keys(textPeerGroups).length > 0 ? textPeerGroups : undefined,
      };

      try {
        ticker.scoring = scoreAll(convergenceInput);
        reScored++;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`Step F2 (re-score ${ticker.symbol}): ${msg}`);
      }
    }

    onProgress?.({ step: 'step_l', label: 'Re-Score With Technicals', data: {
      fetched_at: new Date().toISOString(),
      re_scored: reScored,
      total: scoredTickers.length,
      tickers: scoredTickers.map(ticker => {
        const tech = ticker.scoring?.vol_edge.breakdown.technicals;
        return {
          symbol: ticker.symbol,
          candles_used: tech?.candles_used ?? null,
          vol_edge_score: ticker.scoring?.vol_edge.score ?? null,
          composite_score: ticker.scoring?.composite.score ?? null,
          technicals_score: tech?.score ?? null,
          technicals_formula: tech?.formula ?? null,
          rsi_14: tech?.indicators.rsi_14 ?? null,
          sma_20: tech?.indicators.sma_20 ?? null,
          sma_50: tech?.indicators.sma_50 ?? null,
          bb_position: tech?.indicators.bb_position ?? null,
          volume_ratio: tech?.indicators.volume_ratio ?? null,
          high52w_ratio: tech?.indicators.high52w_ratio ?? null,
          sub_scores: tech?.sub_scores ?? null,
          source: 'TastyTrade',
          endpoint: 'candle',
        };
      }),
    } });

    console.log(`[Pipeline] Step F2: Fetched candles for ${candleStats.symbols_with_data}/${scoredSymbols.length} symbols (${candleStats.total_candles} candles) in ${candleStats.elapsed_ms}ms, re-scored ${reScored}`);

    onProgress?.({ step: 'step_j', label: 'Candle Data & Cross-Asset Correlations', data: {
      fetched_at: new Date().toISOString(),
      symbols_requested: scoredSymbols.length,
      symbols_with_data: candleStats.symbols_with_data,
      symbols_failed: candleStats.symbols_failed,
      total_candles: candleStats.total_candles,
      elapsed_ms: candleStats.elapsed_ms,
      candles_per_symbol: scoredSymbols.map(sym => ({
        symbol: sym,
        candle_count: candleDataMap.get(sym)?.length ?? null,
        source: 'TastyTrade',
        endpoint: 'candle',
      })),
      cross_asset_correlations: crossAssetCorrelations != null ? {
        available: true,
        source: 'FRED',
        endpoint: 'daily series',
      } : {
        available: false,
        null_reason: 'FRED daily series returned no data',
      },
    } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(`Step F2 (candle fetch): ${msg}`);
    console.error('[Pipeline] Step F2 failed:', msg);
  }

  // Build ranked rows
  const rankedRows = buildRankedRows(scoredTickers);
  const _gwt = scoredTickers[0]?.scoring?.composite?.gate_weight_trace;
  const _gw = _gwt?.gate_weights;
  const scoringMap = new Map(
    scoredTickers.map(t => [t.symbol, t.scoring])
  );
  onProgress?.({ step: 'step_k', label: '4-Gate Scoring', data: {
    scored: scoredTickers.length,
    fetched_at: new Date().toISOString(),
    regime: _gwt?.regime_used ?? 'UNKNOWN',
    weights: {
      vol_edge: Math.round((_gw?.vol_edge ?? 0.25) * 100),
      quality: Math.round((_gw?.quality ?? 0.25) * 100),
      regime: Math.round((_gw?.regime ?? 0.25) * 100),
      info_edge: Math.round((_gw?.info_edge ?? 0.25) * 100),
    },
    rankings: rankedRows.map(r => {
      const scoring = scoringMap.get(r.symbol);
      return {
        symbol: r.symbol, composite: r.composite, vol_edge: r.vol_edge, quality: r.quality, regime: r.regime, info_edge: r.info_edge, sector: r.sector, convergence: r.convergence, selection_status: r.composite >= 50 ? 'eligible' : 'below_threshold',
        data_confidence: scoring?.composite.data_confidence.confidence ?? null,
        position_size_pct: scoring?.composite.position_size_pct ?? null,
        vol_edge_detail: scoring ? {
          mispricing: {
            score: scoring.vol_edge.breakdown.mispricing.score,
            weight: scoring.vol_edge.breakdown.mispricing.weight,
            formula: scoring.vol_edge.breakdown.mispricing.formula,
          },
          term_structure: {
            score: scoring.vol_edge.breakdown.term_structure.score,
            weight: scoring.vol_edge.breakdown.term_structure.weight,
            formula: scoring.vol_edge.breakdown.term_structure.formula,
          },
          technicals: {
            score: scoring.vol_edge.breakdown.technicals.score,
            weight: scoring.vol_edge.breakdown.technicals.weight,
            formula: scoring.vol_edge.breakdown.technicals.formula,
          },
          skew: {
            score: scoring.vol_edge.breakdown.skew.score,
            weight: scoring.vol_edge.breakdown.skew.weight,
            formula: scoring.vol_edge.breakdown.skew.formula,
          },
          gex: {
            score: scoring.vol_edge.breakdown.gex.score,
            weight: scoring.vol_edge.breakdown.gex.weight,
            formula: scoring.vol_edge.breakdown.gex.formula,
          },
          data_confidence: scoring.vol_edge.data_confidence.confidence,
        } : null,
        quality_detail: scoring ? {
          safety: {
            score: scoring.quality.breakdown.safety.score,
            weight: scoring.quality.breakdown.safety.weight,
            formula: scoring.quality.breakdown.safety.formula,
          },
          profitability: {
            score: scoring.quality.breakdown.profitability.score,
            weight: scoring.quality.breakdown.profitability.weight,
            formula: scoring.quality.breakdown.profitability.formula,
          },
          growth: {
            score: scoring.quality.breakdown.growth.score,
            weight: scoring.quality.breakdown.growth.weight,
            formula: scoring.quality.breakdown.growth.formula,
          },
          fundamental_risk: {
            score: scoring.quality.breakdown.fundamentalRisk.score,
            weight: scoring.quality.breakdown.fundamentalRisk.weight,
            formula: scoring.quality.breakdown.fundamentalRisk.formula,
          },
          mspr_adjustment: scoring.quality.mspr_adjustment,
          data_confidence: scoring.quality.data_confidence.confidence,
        } : null,
        regime_detail: scoring ? {
          dominant_regime: scoring.regime.breakdown.dominant_regime,
          growth_score: scoring.regime.breakdown.growth_signal.score,
          inflation_score: scoring.regime.breakdown.inflation_signal.score,
          spy_multiplier: scoring.regime.breakdown.spy_correlation_modifier.multiplier,
          base_score: scoring.regime.breakdown.spy_correlation_modifier.base_regime_score,
          formula: scoring.regime.breakdown.spy_correlation_modifier.formula,
          note: scoring.regime.breakdown.spy_correlation_modifier.note,
          raw_values: {
            gdp: scoring.regime.breakdown.growth_signal.raw_values.gdp,
            unemployment: scoring.regime.breakdown.growth_signal.raw_values.unemployment,
            cpi_yoy: scoring.regime.breakdown.inflation_signal.raw_values.cpi_yoy,
            fed_funds: scoring.regime.breakdown.inflation_signal.raw_values.fed_funds,
            treasury_10y: scoring.regime.breakdown.inflation_signal.raw_values.treasury_10y,
            vix: scoring.regime.breakdown.vix_overlay.vix,
          },
          data_confidence: scoring.regime.data_confidence.confidence,
          yield_curve_spread: scoring.regime.breakdown.regime_signals.yield_curve_spread ?? null,
          hy_spread: scoring.regime.breakdown.regime_signals.hy_spread ?? null,
          cross_asset_available: scoring.regime.breakdown.cross_asset_correlations != null,
          bbb_spread: scoring.regime.breakdown.bbb_spread_signal.score ?? null,
          bbb_spread_raw: scoring.regime.breakdown.bbb_spread_signal.raw_value ?? null,
          t10y3m: scoring.regime.breakdown.t10y3m_signal.score ?? null,
          t10y3m_raw: scoring.regime.breakdown.t10y3m_signal.raw_value ?? null,
          dollar_index: scoring.regime.breakdown.dollar_index_signal.score ?? null,
          dollar_index_raw: scoring.regime.breakdown.dollar_index_signal.raw_value ?? null,
          fed_net_liquidity: scoring.regime.breakdown.fed_net_liquidity_signal.score ?? null,
          fed_net_liquidity_raw: scoring.regime.breakdown.fed_net_liquidity_signal.raw_value ?? null,
        } : null,
        info_edge_detail: scoring ? {
          analyst_consensus: {
            score: scoring.info_edge.breakdown.analyst_consensus.score,
            weight: scoring.info_edge.breakdown.analyst_consensus.weight,
          },
          price_target: {
            score: scoring.info_edge.breakdown.price_target_signal.score,
            weight: scoring.info_edge.breakdown.price_target_signal.weight,
          },
          upgrade_downgrade: {
            score: scoring.info_edge.breakdown.upgrade_downgrade_signal.score,
            weight: scoring.info_edge.breakdown.upgrade_downgrade_signal.weight,
          },
          insider_activity: {
            score: scoring.info_edge.breakdown.insider_activity.score,
            weight: scoring.info_edge.breakdown.insider_activity.weight,
          },
          earnings_momentum: {
            score: scoring.info_edge.breakdown.earnings_momentum.score,
            weight: scoring.info_edge.breakdown.earnings_momentum.weight,
          },
          flow_signal: {
            score: scoring.info_edge.breakdown.flow_signal.score,
            weight: scoring.info_edge.breakdown.flow_signal.weight,
          },
          news_sentiment: scoring.info_edge.breakdown.news_sentiment != null ? {
            score: scoring.info_edge.breakdown.news_sentiment.score,
            weight: scoring.info_edge.breakdown.news_sentiment.weight,
          } : null,
          institutional_ownership: {
            score: scoring.info_edge.breakdown.institutional_ownership.score,
            weight: scoring.info_edge.breakdown.institutional_ownership.weight,
          },
          fund_flow: {
            score: scoring.info_edge.breakdown.fund_ownership_flow?.score ?? null,
            weight: scoring.info_edge.breakdown.fund_ownership_flow?.weight ?? null,
          },
          material_event: {
            score: scoring.info_edge.breakdown.material_event_flag?.score ?? null,
            weight: scoring.info_edge.breakdown.material_event_flag?.weight ?? null,
          },
          data_confidence: scoring.info_edge.data_confidence.confidence,
          filing_recency: scoring.info_edge.filing_recency ?? null,
        } : null,
      };
    }),
  } });

  // ===== STEP G: Rank and Diversify =====
  console.log('[Pipeline] Step G: Ranking and diversifying...');
  const { top9, alsoScored, diversification, sectorDistribution } = rankAndDiversify(rankedRows);

  onProgress?.({ step: 'step_m', label: 'Final Selection', data: {
    fetched_at: new Date().toISOString(),
    total_scored: rankedRows.length,
    eligible: top9.length + alsoScored.filter(
      (r: any) => parseInt(r.convergence.split('/')[0], 10) >= 3 && r.quality >= 40
    ).length,
    selected: top9.length,
    sector_distribution: sectorDistribution,
    adjustments: diversification.adjustments,
    top9: top9.map(r => ({
      symbol: r.symbol,
      rank: r.rank,
      composite: r.composite,
      vol_edge: r.vol_edge,
      quality: r.quality,
      regime: r.regime,
      info_edge: r.info_edge,
      convergence: r.convergence,
      sector: r.sector,
      status: 'selected',
    })),
    excluded: rankedRows
      .filter(r => !top9.find(t => t.symbol === r.symbol))
      .map(r => {
        const catAbove50 = parseInt(r.convergence.split('/')[0], 10);
        const reason = catAbove50 < 3
          ? `convergence ${r.convergence} — below 3/4 minimum`
          : r.quality < 40
          ? `quality ${r.quality} — below floor of 40`
          : `sector cap or rank`;
        return {
          symbol: r.symbol,
          composite: r.composite,
          convergence: r.convergence,
          quality: r.quality,
          sector: r.sector,
          reason,
          status: 'excluded',
        };
      }),
  } });

  // ===== STEP G1.5: Fetch social sentiment (parallel with G2) =====
  const top9Symbols = top9.map(r => r.symbol);
  const sentimentPromise = (async (): Promise<Map<string, SentimentResult>> => {
    if (!process.env.XAI_API_KEY) {
      console.log('[Pipeline] Step G1.5: XAI_API_KEY not set — skipping social sentiment');
      return new Map();
    }
    try {
      console.log(`[Pipeline] Step G1.5: Fetching social sentiment for ${top9Symbols.length} symbols...`);
      const startMs = Date.now();
      const results = await fetchSentimentBatch(top9Symbols, 5);
      console.log(`[Pipeline] Step G1.5: Sentiment fetched in ${Date.now() - startMs}ms`);
      return results;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`Step G1.5 (sentiment): ${msg}`);
      console.error('[Pipeline] Step G1.5 sentiment failed:', msg);
      return new Map();
    }
  })();

  // ===== STEP G2: Fetch chain data and build trade cards =====
  console.log('[Pipeline] Step G2: Fetching option chains and building trade cards...');
  let chainRejections = new Map<string, RejectionReason[]>();
  let chainStats: ChainFetchStats = {
    chain_symbols_fetched: 0,
    total_trade_cards: 0,
    streamer_symbols_subscribed: 0,
    greeks_events_received: 0,
    elapsed_ms: 0,
  };
  let chainMarketOpen = true;
  let chainMarketNote: string | undefined;
  let perTickerStats = new Map<string, PerTickerChainStats>();

  const marketStatus = isMarketOpen();
  if (!marketStatus.open) {
    chainMarketOpen = false;
    chainMarketNote = marketStatus.reason;
    dataGaps.push('trade_cards: market closed — using exchange theo prices. Rerun during market hours (Mon-Fri 9:30-16:00 ET) for live quotes.');
    console.log(`[Pipeline] Step G2: Market closed (${marketStatus.reason}), will use theo prices`);
  }
  try {
    // Build input for chain fetcher from top 9 tickers
    const chainInputs = top9.map(row => {
      const ticker = scoredTickers.find(t => t.symbol === row.symbol);
      if (!ticker) return null;

      const s = ticker.scoring;
      const tt = ticker.scannerData;

      // Get currentPrice from technicals (latest close from candle data)
      const latestClose = s.vol_edge.breakdown.technicals.indicators.latest_close;
      if (latestClose == null || latestClose <= 0) return null;

      // Risk-free rate from FRED FEDFUNDS series, converted to decimal
      if (fredResult.data.fedFunds == null) {
        throw new Error(
          'Step H: FRED FEDFUNDS rate is null — cannot compute PoP. ' +
          'Risk-free rate is required for Black-Scholes calculation.'
        );
      }
      const fedFundsRate = fredResult.data.fedFunds / 100;

      // Exclude ticker if IV_percentile is null — no fallback
      if (s.vol_edge.breakdown.mispricing.inputs.IV_percentile == null) return null;

      return {
        symbol: row.symbol,
        suggested_dte: s.strategy_suggestion.suggested_dte,
        direction: s.strategy_suggestion.direction,
        currentPrice: latestClose,
        ivRank: (s.vol_edge.breakdown.mispricing.inputs.IV_percentile as number) / 100,
        iv30: (tt.iv30 ?? 30) / 100,
        hv30: (tt.hv30 ?? 25) / 100,
        riskFreeRate: fedFundsRate,
      };
    }).filter((input): input is NonNullable<typeof input> => input !== null);

    if (chainInputs.length > 0) {
      const chainResult = await fetchChainAndBuildCards(chainInputs);
      chainStats = chainResult.stats;
      chainRejections = chainResult.rejections;
      perTickerStats = chainResult.perTickerStats;
      chainMarketOpen = chainResult.marketOpen;
      chainMarketNote = chainResult.marketNote;

      onProgress?.({ step: 'step_o', label: 'Live Greeks Subscription', data: {
        fetched_at: new Date().toISOString(),
        streamer_symbols_subscribed: chainStats.streamer_symbols_subscribed,
        greeks_events_received: chainStats.greeks_events_received,
        market_open: chainMarketOpen,
        market_note: chainMarketNote ?? null,
        tickers: top9.map(r => r.symbol).map(sym => ({
          symbol: sym,
          strike_count: perTickerStats.get(sym)?.strikeCount ?? null,
          expiration: perTickerStats.get(sym)?.expiration ?? null,
          dte: perTickerStats.get(sym)?.dte ?? null,
          source: 'TastyTrade',
          endpoint: 'Greeks WebSocket',
        })),
      } });

      if (!chainResult.marketOpen) {
        dataGaps.push(`trade_cards: priced from exchange theo values (${chainResult.marketNote}) — rerun during market hours for live quotes`);
      }

      // Attach trade cards to each ticker's strategy_suggestion
      for (const ticker of scoredTickers) {
        const tickerCards = chainResult.cards.get(ticker.symbol);
        if (tickerCards && tickerCards.length > 0) {
          // Convert StrategyCard to serializable LegacyTradeCardData
          const tradeCards: LegacyTradeCardData[] = tickerCards.map(card => ({
            name: card.name,
            legs: card.legs.map(leg => ({
              type: leg.type,
              side: leg.side,
              strike: leg.strike,
              price: leg.price,
            })),
            expiration: card.expiration,
            dte: card.dte,
            netCredit: card.netCredit,
            netDebit: card.netDebit,
            maxProfit: card.maxProfit,
            maxLoss: card.maxLoss,
            breakevens: card.breakevens,
            pop: card.pop,
            riskReward: card.riskReward,
            ev: card.ev,
          }));
          ticker.scoring.strategy_suggestion.trade_cards = tradeCards;
        } else if (chainResult.cards.has(ticker.symbol)) {
          // Chain was fetched but no cards generated
          ticker.scoring.strategy_suggestion.trade_cards = [];
        }
      }

      // ===== STEP G2.5: Re-score tickers with real OptionsFlowData =====
      // Populate optionsFlowMap from chain fetch results
      for (const [symbol, flowData] of chainResult.optionsFlowMap) {
        optionsFlowMap.set(symbol, flowData);
      }

      if (chainResult.optionsFlowMap.size > 0) {
        let flowReScored = 0;
        for (const ticker of scoredTickers) {
          const flowData = optionsFlowMap.get(ticker.symbol);
          if (!flowData) continue;

          // Rebuild ConvergenceInput with real optionsFlow (same pattern as Step F2)
          const convergenceInput: ConvergenceInput = {
            symbol: ticker.symbol,
            ttScanner: ticker.scannerData,
            candles: candleDataMap.get(ticker.symbol) ?? [],
            finnhubFundamentals: ticker.finnhubData.fundamentals,
            finnhubRecommendations: ticker.finnhubData.recommendations,
            finnhubInsiderSentiment: ticker.finnhubData.insiderSentiment,
            finnhubEarnings: ticker.finnhubData.earnings,
            finnhubEstimates: ticker.finnhubData.estimateData ?? null,
            fredMacro: fredResult.data,
            annualFinancials: annualFinancialsMap.get(ticker.symbol) ?? null,
            quarterlyFinancials: quarterlyFinancialsMap.get(ticker.symbol) ?? null,
            optionsFlow: flowData,
            newsSentiment: newsSentimentMap.get(ticker.symbol) ?? null,
            finnhubNewsSentiment: finbertMap.get(ticker.symbol) ?? null,
            finnhubEarningsQuality: earningsQualityMap.get(ticker.symbol) ?? null,
            finnhubInstitutionalOwnership: institutionalOwnershipMap.get(ticker.symbol) ?? null,
            finnhubRevenueBreakdown: revenueBreakdownMap.get(ticker.symbol) ?? null,
            secFilingData: secFilingMap.get(ticker.symbol) ?? null,
            secForm4Data: secForm4Map.get(ticker.symbol) ?? null,
            finnhubFundOwnership: fundOwnershipMap.get(ticker.symbol) ?? null,
            edgar8kScan: edgar8kMap.get(ticker.symbol) ?? null,
            crossAssetCorrelations,
            peerStats,
            peerGroupAssignment,
            textPeerGroups: Object.keys(textPeerGroups).length > 0 ? textPeerGroups : undefined,
          };

          try {
            // Preserve trade cards from G2 (they're attached to strategy_suggestion)
            const existingTradeCards = ticker.scoring.strategy_suggestion.trade_cards;
            ticker.scoring = scoreAll(convergenceInput);
            if (existingTradeCards) {
              ticker.scoring.strategy_suggestion.trade_cards = existingTradeCards;
            }
            flowReScored++;
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            errors.push(`Step G2.5 (flow re-score ${ticker.symbol}): ${msg}`);
          }
        }
        console.log(`[Pipeline] Step G2.5: Re-scored ${flowReScored} tickers with real OptionsFlowData`);
      }

      console.log(`[Pipeline] Step G2: ${chainStats.chain_symbols_fetched} chains fetched, ${chainStats.total_trade_cards} trade cards in ${chainStats.elapsed_ms}ms`);
    } else {
      console.warn('[Pipeline] Step G2: No tickers with valid currentPrice for chain fetch');
      dataGaps.push('trade_cards: no tickers had valid latest_close price from candle data');
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(`Step G2 (chain fetch): ${msg}`);
    console.error('[Pipeline] Step G2 failed:', msg);
  }

  // Await sentiment (launched in parallel with G2)
  const sentimentMap = await sentimentPromise;
  const socialSentiment: Record<string, SentimentResult> = Object.fromEntries(sentimentMap);
  if (sentimentMap.size > 0) {
    const withData = [...sentimentMap.values()].filter(s => !s.error).length;
    console.log(`[Pipeline] Sentiment: ${withData}/${sentimentMap.size} symbols with data`);
    if (withData === 0) {
      dataGaps.push('social_sentiment: xAI returned no results (API may be unavailable or no posts found)');
    }
  } else if (process.env.XAI_API_KEY) {
    dataGaps.push('social_sentiment: fetch failed or returned empty');
  } else {
    dataGaps.push('social_sentiment: XAI_API_KEY not configured — social sentiment disabled');
  }

  const top9Syms = top9.map(r => r.symbol);

  onProgress?.({ step: 'step_n', label: 'Chain Fetch', data: {
    tickers: top9Syms.map(sym => ({
      symbol: sym,
      expiration: perTickerStats.get(sym)?.expiration,
      dte: perTickerStats.get(sym)?.dte,
      strikeCount: perTickerStats.get(sym)?.strikeCount,
      priceSource: perTickerStats.get(sym)?.priceSource,
      expirationsEvaluated: perTickerStats.get(sym)?.expirationsEvaluated,
      allExpirations: perTickerStats.get(sym)?.allExpirations,
      winningExpiration: perTickerStats.get(sym)?.winningExpiration,
      winningDte: perTickerStats.get(sym)?.winningDte,
    })),
    fetched_at: new Date().toISOString(),
    source: 'TastyTrade',
    endpoint: 'options-chain',
    totalStrikes: top9Syms.reduce((sum, sym) => sum + (perTickerStats.get(sym)?.strikeCount ?? 0), 0),
    streamerSymbols: chainStats.streamer_symbols_subscribed,
    greeksEvents: chainStats.greeks_events_received,
  } });

  onProgress?.({ step: 'step_p', label: 'Strategy Scoring', data: {
    tickers: top9Syms.map(sym => ({
      symbol: sym,
      strategiesBuilt: perTickerStats.get(sym)?.strategiesBuilt,
      gateAFailed: perTickerStats.get(sym)?.gateAFailed,
      gateBFailed: perTickerStats.get(sym)?.gateBFailed,
      gateCFailed: perTickerStats.get(sym)?.gateCFailed,
      strategiesPassed: perTickerStats.get(sym)?.strategiesPassed,
      winner: perTickerStats.get(sym)?.winner,
      winnerScore: perTickerStats.get(sym)?.winnerScore,
    })),
    fetched_at: new Date().toISOString(),
    source: 'TastyTrade',
    endpoint: 'Greeks WebSocket',
    totalPassed: chainStats.total_trade_cards,
  } });

  onProgress?.({ step: 'step_s', label: 'Trade Cards', data: { trade_cards: chainStats.total_trade_cards, top_9: top9.map(r => r.symbol), rejections: Object.fromEntries(chainRejections) } });

  // ===== STEP H: Assemble Full Result =====
  console.log('[Pipeline] Step H: Assembling result...');

  // Build scoring details for top 9 only
  const scoringDetails: Record<string, FullScoringResult> = {};
  for (const row of top9) {
    const ticker = scoredTickers.find(t => t.symbol === row.symbol);
    if (ticker) {
      scoringDetails[row.symbol] = ticker.scoring;
    }
  }

  // Data gaps
  if (candleStats.symbols_with_data === scoredSymbols.length) {
    // All symbols got candles — no gap
  } else if (candleStats.symbols_with_data > 0) {
    const noData = scoredSymbols.length - candleStats.symbols_with_data;
    dataGaps.push(`candle_technicals: fetched for ${candleStats.symbols_with_data}/${scoredSymbols.length} symbols, ${noData} symbols had insufficient data (technicals excluded for those, weights renormalized)`);
  } else {
    dataGaps.push('candle_technicals: TastyTrade connection failed — technicals excluded from scoring (no fake data)');
  }
  dataGaps.push('peer_z_scores: computed per-ticker using industry peers (>=5) or sector fallback from hard-filter survivors');

  if (chainStats.chain_symbols_fetched > 0 && chainStats.total_trade_cards === 0) {
    dataGaps.push('trade_cards: option chains fetched but no strategies passed quality gates');
  } else if (chainStats.chain_symbols_fetched === 0 && top9.length > 0) {
    dataGaps.push('trade_cards: chain fetch failed or no valid expirations found');
  }

  const pipelineMs = Date.now() - pipelineStart;

  const result: PipelineResult = {
    pipeline_summary: {
      total_universe: totalUniverse,
      after_hard_filters: hardFilters.output_count,
      pre_scored: preScores.length,
      finnhub_fetched: topSymbols.length,
      scored: scoredTickers.length,
      final_9: top9.map(r => r.symbol),
      pipeline_runtime_ms: pipelineMs,
      finnhub_calls_made: finnhubResult.stats.calls_made,
      finnhub_errors: finnhubResult.stats.errors,
      fred_cached: fredResult.cached,
      candle_symbols_fetched: candleStats.symbols_with_data,
      candle_total_count: candleStats.total_candles,
      chain_symbols_fetched: chainStats.chain_symbols_fetched,
      total_trade_cards: chainStats.total_trade_cards,
      greeks_events_received: chainStats.greeks_events_received,
      market_open: chainMarketOpen,
      market_note: chainMarketNote,
      timestamp: new Date().toISOString(),
    },
    hard_filters: hardFilters,
    peer_stats: peerStats,
    text_peer_groups: textPeerGroups,
    pre_scores: preScores,
    rankings: {
      scored_count: scoredTickers.length,
      top_9: top9,
      also_scored: alsoScored,
      sector_distribution: sectorDistribution,
    },
    diversification,
    scoring_details: scoringDetails,
    pre_filter: preFilterResults,
    social_sentiment: socialSentiment,
    rejection_reasons: Object.fromEntries(chainRejections),
    data_gaps: dataGaps,
    errors,
  };

  console.log(`[Pipeline] Complete in ${pipelineMs}ms. Final 9: ${top9.map(r => r.symbol).join(', ')}`);

  // ===== SNAPSHOT LOGGING (fire-and-forget) =====
  // Persist scored results for outcome tracking / backtesting (Phase 5).
  // Does not block the response; errors logged but never propagate.
  if (userId) {
    void logScanSnapshotBatch(
      userId,
      scoredTickers.map(t => ({
        symbol: t.symbol,
        scoring: t.scoring,
        spotPrice: t.scoring.vol_edge.breakdown.technicals.indicators.latest_close ?? undefined,
        iv30: t.scannerData.iv30 ?? undefined,
        hv30: t.scannerData.hv30 ?? undefined,
        ivPercentile: t.scannerData.ivPercentile ?? undefined,
        vixLevel: fredResult.data.vix ?? undefined,
      })),
    );
  }

  return result;
}

// ===== STEP B: Hard Filters =====

function applyHardFilters(tickers: TTScannerData[], regShoSymbols: Set<string>): HardFiltersResult {
  const filtersApplied: HardFilterStep[] = [];
  const tickerRejections = new Map<string, HardFilterRejection>();
  const warningTickers = new Map<string, HardFilterWarning>();
  let current = [...tickers];

  // Filter 1: market_cap > $2B
  {
    const passed: TTScannerData[] = [];
    const failedTickers: TTScannerData[] = [];
    for (const t of current) {
      if (t.marketCap != null && t.marketCap > 2_000_000_000) {
        passed.push(t);
      } else {
        failedTickers.push(t);
      }
    }
    for (const t of failedTickers) {
      tickerRejections.set(t.symbol, {
        filter: 'Market Cap',
        actual_value: t.marketCap ? `$${(t.marketCap / 1e9).toFixed(1)}B` : 'unknown',
        threshold: '$2B minimum',
        reason: t.marketCap
          ? `Market cap $${(t.marketCap / 1e9).toFixed(1)}B is below the $2B minimum. Small companies have less liquid options markets.`
          : 'Market cap data unavailable',
      });
    }
    filtersApplied.push({
      filter: 'market_cap > $2B',
      passed: passed.length,
      failed: failedTickers.length,
      sample_failed: failedTickers.slice(0, 5).map(t => t.symbol),
    });
    current = passed;
  }

  // Filter 2: liquidity_rating >= 2
  {
    const passed: TTScannerData[] = [];
    const failedTickers: TTScannerData[] = [];
    for (const t of current) {
      if (t.liquidityRating != null && t.liquidityRating >= 2) {
        passed.push(t);
      } else {
        failedTickers.push(t);
      }
    }
    for (const t of failedTickers) {
      tickerRejections.set(t.symbol, {
        filter: 'Options Liquidity',
        actual_value: `${t.liquidityRating ?? 0}/5`,
        threshold: '2/5 minimum',
        reason: `Liquidity score ${t.liquidityRating ?? 0}/5 is too low. Low liquidity means wide bid-ask spreads — you lose money just entering and exiting the trade.`,
      });
    }
    filtersApplied.push({
      filter: 'liquidity_rating >= 2',
      passed: passed.length,
      failed: failedTickers.length,
      sample_failed: failedTickers.slice(0, 5).map(t => t.symbol),
    });
    current = passed;
  }

  // Filter 3: iv30 is not null/zero
  {
    const passed: TTScannerData[] = [];
    const failedTickers: TTScannerData[] = [];
    for (const t of current) {
      if (t.iv30 != null && t.iv30 > 0) {
        passed.push(t);
      } else {
        failedTickers.push(t);
      }
    }
    for (const t of failedTickers) {
      tickerRejections.set(t.symbol, {
        filter: 'IV Data',
        actual_value: 'no data',
        threshold: 'IV data required',
        reason: 'No implied volatility data available. IV is required to price options and calculate expected value.',
      });
    }
    filtersApplied.push({
      filter: 'iv30 is not null/zero',
      passed: passed.length,
      failed: failedTickers.length,
      sample_failed: failedTickers.slice(0, 5).map(t => t.symbol),
    });
    current = passed;
  }

  // Filter 4: borrow_rate < 50%
  {
    const passed: TTScannerData[] = [];
    const failedTickers: TTScannerData[] = [];
    for (const t of current) {
      if (t.borrowRate == null) {
        // Borrow rate data unavailable — pass but flag warning
        passed.push(t);
        warningTickers.set(t.symbol, {
          filter: 'Borrow Rate',
          reason: 'Borrow rate data unavailable — flagged for review',
        });
      } else if (t.borrowRate < 50) {
        passed.push(t);
      } else {
        failedTickers.push(t);
      }
    }
    for (const t of failedTickers) {
      tickerRejections.set(t.symbol, {
        filter: 'Borrow Rate',
        actual_value: `${t.borrowRate}%`,
        threshold: '< 50%',
        reason: `Borrow rate ${t.borrowRate}% is too high. Hard-to-borrow stocks have unpredictable short squeeze risk that breaks option pricing models.`,
      });
    }
    filtersApplied.push({
      filter: 'borrow_rate < 50%',
      passed: passed.length,
      failed: failedTickers.length,
      sample_failed: failedTickers.slice(0, 5).map(t => t.symbol),
    });
    current = passed;
  }

  // Filter 5: no earnings within 7 calendar days
  {
    const passed: TTScannerData[] = [];
    const failedTickers: TTScannerData[] = [];
    for (const t of current) {
      if (t.daysTillEarnings != null && t.daysTillEarnings >= 0 && t.daysTillEarnings <= 7) {
        failedTickers.push(t);
      } else {
        passed.push(t);
      }
    }
    for (const t of failedTickers) {
      tickerRejections.set(t.symbol, {
        filter: 'Earnings Timing',
        actual_value: `${t.daysTillEarnings} days`,
        threshold: '> 7 days away',
        reason: `Earnings in ${t.daysTillEarnings} days. Options pricing becomes unreliable right before earnings — IV spikes then collapses unpredictably after the report.`,
      });
    }
    filtersApplied.push({
      filter: 'no earnings within 7 days',
      passed: passed.length,
      failed: failedTickers.length,
      sample_failed: failedTickers.slice(0, 5).map(t => t.symbol),
    });
    current = passed;
  }

  // Filter 6: symbol must NOT be on Reg SHO threshold list
  {
    const passed: TTScannerData[] = [];
    const failedTickers: TTScannerData[] = [];
    for (const t of current) {
      if (regShoSymbols.has(t.symbol)) {
        failedTickers.push(t);
      } else {
        passed.push(t);
      }
    }
    for (const t of failedTickers) {
      tickerRejections.set(t.symbol, {
        filter: 'Reg SHO',
        actual_value: 'threshold list',
        threshold: 'not on Reg SHO threshold list',
        reason: `${t.symbol} is on the FINRA Reg SHO threshold list — persistent failures to deliver indicate severe short squeeze risk.`,
      });
    }
    filtersApplied.push({
      filter: 'not on Reg SHO threshold list',
      passed: passed.length,
      failed: failedTickers.length,
      sample_failed: failedTickers.slice(0, 5).map(t => t.symbol),
    });
    current = passed;
  }

  return {
    input_count: tickers.length,
    output_count: current.length,
    filters_applied: filtersApplied,
    survivors: current.map(t => t.symbol),
    ticker_rejections: Object.fromEntries(tickerRejections),
    ticker_warnings: Object.fromEntries(warningTickers),
  };
}

// ===== STEP D: Pre-Score =====

function computePreScores(survivors: TTScannerData[]): PreScoreRow[] {
  const rows: PreScoreRow[] = [];

  for (const t of survivors) {
    // Normalize IVP: if <= 1.0, multiply by 100
    let ivp = t.ivPercentile;
    if (ivp != null && ivp <= 1.0) ivp = round(ivp * 100, 1);

    // Normalize IV-HV spread
    const ivHvSpread = t.ivHvSpread;
    const liquidityRating = t.liquidityRating;

    // pre_score = (ivPercentile × 40%) + (ivHvSpread × 30%) + (liquidityRating/5 × 30%)
    const ivpComponent = ivp != null ? ivp : 0; // already 0-100 after normalization
    const ivHvComponent = ivHvSpread != null ? Math.min((Math.abs(ivHvSpread) / 20) * 100, 100) : 0;
    const liqComponent = liquidityRating != null ? (liquidityRating / 5) * 100 : 0;

    const preScore = round(0.40 * ivpComponent + 0.30 * ivHvComponent + 0.30 * liqComponent, 1);

    rows.push({
      symbol: t.symbol,
      pre_score: preScore,
      ivp: ivp != null ? round(ivp, 1) : null,
      iv_hv_spread: ivHvSpread != null ? round(ivHvSpread, 2) : null,
      liquidity: liquidityRating,
    });
  }

  // Sort descending by pre_score
  rows.sort((a, b) => b.pre_score - a.pre_score);
  return rows;
}

// ===== STEP F/G: Build Ranked Rows =====

function buildRankedRows(
  scoredTickers: {
    symbol: string;
    scannerData: TTScannerData;
    finnhubData: FinnhubData;
    scoring: FullScoringResult;
  }[],
): RankedRow[] {
  // Sort by composite score descending
  const sorted = [...scoredTickers].sort(
    (a, b) => b.scoring.composite.score - a.scoring.composite.score,
  );

  return sorted.map((t, idx) => {
    const s = t.scoring;
    const tt = t.scannerData;

    // Normalize IVP for display
    let ivp = tt.ivPercentile;
    if (ivp != null && ivp <= 1.0) ivp = round(ivp * 100, 1);

    // Extract hv_trend from vol_edge breakdown
    const hvTrend = s.vol_edge.breakdown.mispricing.hv_trend;

    // Extract MSPR from info_edge breakdown
    const mspr = s.info_edge.breakdown.insider_activity.insider_detail.latest_mspr;

    // Extract beat streak from quality breakdown
    const beatStreak = s.quality.breakdown.profitability.earnings_quality.earnings_detail.streak;

    // Build convergence string
    const convergence = `${s.composite.categories_above_50}/4`;

    // Build key_signal summary
    const signals: string[] = [];
    if (ivp != null) signals.push(`IVP=${round(ivp, 0)}%`);
    if (tt.iv30 != null && tt.hv30 != null) {
      const vrp = round(tt.iv30 ** 2 - tt.hv30 ** 2, 0);
      signals.push(`VRP=${vrp}`);
    }
    if (hvTrend && !hvTrend.startsWith('UNKNOWN')) {
      const hvLabel = hvTrend.split(' ')[0];
      signals.push(`HV ${hvLabel.toLowerCase()}`);
    }
    if (beatStreak && beatStreak !== 'UNKNOWN' && beatStreak !== 'MIXED') {
      signals.push(beatStreak.toLowerCase());
    }
    if (mspr != null) {
      if (mspr > 5) signals.push('insider buying');
      else if (mspr < -5) signals.push('insider selling');
    }

    return {
      rank: idx + 1,
      symbol: t.symbol,
      composite: s.composite.score,
      vol_edge: s.vol_edge.score,
      quality: s.quality.score,
      regime: s.regime.score,
      info_edge: s.info_edge.score,
      convergence,
      direction: s.composite.direction,
      strategy: s.strategy_suggestion.suggested_strategy,
      sector: tt.sector,
      ivp: ivp != null ? round(ivp, 1) : null,
      iv_hv_spread: tt.ivHvSpread != null ? round(tt.ivHvSpread, 2) : null,
      hv_trend: hvTrend,
      mspr: mspr != null ? round(mspr, 2) : null,
      beat_streak: beatStreak,
      key_signal: signals.join(', '),
    };
  });
}

// ===== STEP G: Rank and Diversify =====

function rankAndDiversify(rankedRows: RankedRow[]): {
  top9: RankedRow[];
  alsoScored: RankedRow[];
  diversification: DiversificationResult;
  sectorDistribution: Record<string, number>;
} {
  const MAX_PER_SECTOR = 2;
  const TOP_N = 9;
  const adjustments: string[] = [];

  // BUG 4 fix: Enforce convergence gate — exclude tickers with < 3/4 categories above 50
  // BUG 5 fix: Enforce quality floor — exclude quality < 40, or quality 40-50 with 3+ miss streak
  const eligible: RankedRow[] = [];
  for (const row of rankedRows) {
    const catAbove50 = parseInt(row.convergence.split('/')[0], 10);
    if (catAbove50 < 3) {
      adjustments.push(
        `Excluded ${row.symbol} (rank ${row.rank}, composite=${row.composite}) — convergence ${row.convergence}, below 3/4 minimum.`,
      );
      continue;
    }
    if (row.quality < 40) {
      adjustments.push(
        `Excluded ${row.symbol} (rank ${row.rank}, quality=${row.quality}) — quality below 40 floor.`,
      );
      continue;
    }
    if (row.quality < 50 && /\d+Q MISS STREAK/.test(row.beat_streak)) {
      const missCount = parseInt(row.beat_streak, 10);
      if (missCount >= 3) {
        adjustments.push(
          `Excluded ${row.symbol} (rank ${row.rank}, quality=${row.quality}, ${row.beat_streak}) — quality <50 with consecutive miss streak ≥3.`,
        );
        continue;
      }
    }
    eligible.push(row);
  }

  const final: RankedRow[] = [];
  const sectorCounts: Record<string, number> = {};
  const finalSyms = new Set<string>();

  // Pass 1: fill from eligible, respecting sector cap, deferring capped tickers
  for (const row of eligible) {
    const sector = row.sector || 'Unknown';
    const count = sectorCounts[sector] || 0;

    if (count >= MAX_PER_SECTOR) {
      continue; // skip sector-capped tickers
    }

    if (final.length >= TOP_N) break;
    sectorCounts[sector] = count + 1;
    final.push(row);
    finalSyms.add(row.symbol);
  }

  // Pass 2: if still short, scan entire eligible for any uncapped-sector tickers
  // that weren't reached (e.g., ranked lower but from a fresh sector)
  if (final.length < TOP_N) {
    for (const row of eligible) {
      if (final.length >= TOP_N) break;
      if (finalSyms.has(row.symbol)) continue;
      const sector = row.sector || 'Unknown';
      if ((sectorCounts[sector] || 0) < MAX_PER_SECTOR) {
        sectorCounts[sector] = (sectorCounts[sector] || 0) + 1;
        final.push(row);
        finalSyms.add(row.symbol);
      }
    }
  }

  // Pass 3 (absolute last resort): relax sector cap ONLY if no uncapped options remain
  if (final.length < TOP_N) {
    for (const row of eligible) {
      if (final.length >= TOP_N) break;
      if (finalSyms.has(row.symbol)) continue;
      const sector = row.sector || 'Unknown';
      sectorCounts[sector] = (sectorCounts[sector] || 0) + 1;
      final.push(row);
      finalSyms.add(row.symbol);
      adjustments.push(
        `Promoted ${row.symbol} (rank ${row.rank}, ${sector}, composite=${row.composite}) — sector cap relaxed, no uncapped-sector candidates remain.`,
      );
    }
  }

  // Log sector-cap drops for tickers that didn't make it
  for (const row of eligible) {
    if (finalSyms.has(row.symbol)) continue;
    const sector = row.sector || 'Unknown';
    adjustments.push(
      `Dropped ${row.symbol} (rank ${row.rank}, ${sector}, composite=${row.composite}) — sector cap of ${MAX_PER_SECTOR} reached.`,
    );
  }

  // Re-rank final
  final.forEach((row, i) => {
    row.rank = i + 1;
  });

  // Everything else is "also scored"
  const finalSymbols = new Set(final.map(r => r.symbol));
  const alsoScored = rankedRows
    .filter(r => !finalSymbols.has(r.symbol))
    .map((r, i) => ({ ...r, rank: TOP_N + 1 + i }));

  // Sector distribution of final 9
  const sectorDistribution: Record<string, number> = {};
  for (const row of final) {
    const sector = row.sector || 'Unknown';
    sectorDistribution[sector] = (sectorDistribution[sector] || 0) + 1;
  }

  return {
    top9: final,
    alsoScored,
    diversification: { adjustments },
    sectorDistribution,
  };
}
