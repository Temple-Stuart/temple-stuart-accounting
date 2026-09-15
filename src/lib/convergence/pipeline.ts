import { getTastytradeClient } from '@/lib/tastytrade';
import { fetchFinnhubBatch, fetchFredMacro, fetchFredDailySeries, fetchTTCandlesBatch, fetchAnnualFinancials, fetchNewsSentiment, fetchFinnhubNewsSentiment, fetchFinnhubEarningsQuality, fetchFinnhubInstitutionalOwnership, fetchFinnhubRevenueBreakdown, fetchQuarterlyFinancials, fetchSECFilingData, fetchInsiderTransactions, fetchPeerTickers, fetch10KBusinessDescription, fetchFinnhubEbitdaEstimates, fetchFinnhubEbitEstimates, fetchFinnhubDividendHistory, fetchFinnhubPriceMetrics, fetchFinnhubFundOwnership, fetchSECEdgar8KScan, fetchFinnhubEarningsCalendar } from './data-fetchers';
import { computeCrossAssetCorrelations } from './cross-asset';
import type { CrossAssetCorrelations, PremiumSide, ScanSide, ScoreModel } from './types';
import type { FinnhubData, CandleBatchStats } from './data-fetchers';
import { finnhubMeterSnapshot, withFinnhubMeter } from './finnhub-cache';
import type { FinnhubFetchedAt } from './types';
import { fetchChainAndBuildCards, isMarketOpen } from './chain-fetcher';
import type { ChainFetchStats, ChainFetchResult, PerTickerChainStats } from './chain-fetcher';
import type { RejectionReason, StrategyCard } from '@/lib/strategy-builder';
import { computePeerStats, computeTextPeerGroups } from './sector-stats';
import type { PeerStatsMap, PeerGroupAssignment } from './sector-stats';
import { scoreAll } from './composite';
import type { FullScoringResult } from './composite';
import { computePreFilter } from './pre-filter';
import type { PreFilterResult } from './pre-filter';
import { earningsDateSources, sideOf, stepCReason } from './side-rules';
import { fetchCboeDaily } from './cboe-daily';
import type { CboeDailyData } from './types';
import { checkUndefinedRiskCap } from './undefined-risk';
import type { UndefinedRiskCapCheck } from './undefined-risk';
import { countUserOpenUndefinedRiskPositions } from './undefined-risk.prisma';
import { logScanSnapshotBatch, snapshotNotAttempted, type SnapshotWriteResult } from './snapshot-logger';
import { prismaSnapshotStore, fetchVrpHistoryBatch } from './snapshot-logger.prisma';
import { STRUCTURE_CUT, DEEP_FETCH_MULTIPLIER } from './funnel';
import { ETF_UNIVERSE_KEY, ETF_UNIVERSE_SET_ON, ETF_UNIVERSE_SYMBOLS, isEtfUniverseSymbol } from './etf-universe';
import { structureCutEligibility } from './structure-cut';
import { persistScanCandidates } from './candidate-log';
import { prismaCandidateLogStore } from './candidate-log.prisma';
import { numOrNull, firstNumOrNull } from '@/lib/parse-num';
import { generateTradeCards, computeCloseToCloseHV } from './trade-cards';
import type {
  TTScannerData,
  ConvergenceInput,
  FredMacroData,
  LegacyTradeCardData,
  TradeCardData,
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
  VrpHistoryData,
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
  // TRADE-COST-01: when each Finnhub answer behind this row was fetched (endpoint?params → meta).
  // Read by nothing that scores; carried so the card can say how old each value is.
  data_age: FinnhubFetchedAt;
  // MIG-1: null = gate EXCLUDED (zero computable signals) — rendered '—', never 0
  composite: number | null;
  vol_edge: number | null;
  quality: number | null;
  regime: number | null;
  info_edge: number | null;
  convergence: string;
  /** MODEL-02 addendum: the composite's count of gates above 50 and how many of the four gates scored — Step G reads these, never the string. */
  categories_above_50: number;
  scored_gates: number;
  direction: string;
  strategy: string;
  sector: string | null;
  ivp: number | null;
  iv_hv_spread: number | null;
  hv_trend: string;
  mspr: number | null;
  beat_streak: string;
  key_signal: string;
  // MODEL-01: the funnel side and the model that scored this row — never null
  side: PremiumSide;
  score_model: ScoreModel;
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
    // TRADE-COST-01: MEASURED by the run's meter — every upstream Finnhub call this
    // run actually made (the batch's 8×N ceiling is no longer reported as a count).
    finnhub_calls_made: number;
    // TRADE-COST-01: slow-tier answers served from finnhub_responses within their TTL.
    finnhub_cache_hits: number;
    /** LOG-01: the scan_runs row this run's candidates were written under; null = withheld */
    scan_run_id: string | null;
    candidates_logged: number;
    candidates_withheld: boolean;
    /** MODEL-02: what the scan_snapshots write actually did — `written` only when every row landed; the reason otherwise. */
    snapshot: SnapshotWriteResult;
    /** MODEL-01: the mode the scan ran in, the undefined-risk cap check, and the cards per side */
    scan_side: ScanSide;
    allow_undefined_risk: boolean;
    undefined_risk_cap: UndefinedRiskCapCheck;
    cards_by_side: { SELL: number; BUY: number };
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
  full_trade_cards_per_ticker: Record<string, TradeCardData[]>;
  chain_stats_per_ticker: Record<string, PerTickerChainStats>;
  pre_filter: PreFilterResult[];
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
        // KILL-2: absent/unparseable → null, never 0 — these reach scoring
        // (vol-edge IVR/IVP), peer stats, chain pricing, and scan_snapshots.
        // A true source 0 stays 0.
        ivRank: firstNumOrNull(
          m['implied-volatility-index-rank'],
          m['tos-implied-volatility-index-rank'],
          m['tw-implied-volatility-index-rank'],
        ),
        ivPercentile: numOrNull(m['implied-volatility-percentile']),
        impliedVolatility: numOrNull(m['implied-volatility-index']),
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
    // MODEL-02 STEP 4: the index & sector ETF layer, its own selectable set (etf-universe.ts, dated).
    case ETF_UNIVERSE_KEY: return [...new Set(ETF_UNIVERSE_SYMBOLS)];
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

/**
 * MODEL-01: what the scan runs as. `side` is the premium direction — SELL and
 * BUY are separate funnels with separate models; BOTH runs both and labels
 * every candidate with its side. `allowUndefinedRisk` is the scan filter's
 * Risk = Unlimited state (default false = defined risk only, filter-types.ts
 * DEFAULT_FILTERS); an unbounded structure also needs the per-user cap.
 */
export interface ScanOptions {
  side: ScanSide;
  allowUndefinedRisk: boolean;
}

export const DEFAULT_SCAN_OPTIONS: ScanOptions = { side: 'BOTH', allowUndefinedRisk: false };

export async function runPipeline(
  limit: number = 20,
  userId?: string,
  universe?: string,
  onProgress?: (event: { step: string; label: string; data: Record<string, unknown> }) => void,
  options: ScanOptions = DEFAULT_SCAN_OPTIONS,
): Promise<PipelineResult> {
  // TRADE-COST-01: every Finnhub call the run makes is counted on ONE meter
  // (finnhub-cache.ts) — pipeline_summary.finnhub_calls_made is measured, not asserted.
  const { result } = await withFinnhubMeter(() => runPipelineMetered(limit, userId, universe, onProgress, options));
  return result;
}

async function runPipelineMetered(
  limit: number = 20,
  userId?: string,
  universe?: string,
  onProgress?: (event: { step: string; label: string; data: Record<string, unknown> }) => void,
  options: ScanOptions = DEFAULT_SCAN_OPTIONS,
): Promise<PipelineResult> {
  const pipelineStart = Date.now();
  if (options.side !== 'SELL' && options.side !== 'BUY' && options.side !== 'BOTH') {
    throw new Error(`MODEL-01: unknown scan side ${String(options.side)} — SELL, BUY or BOTH`);
  }
  const scanDateIso = new Date().toISOString().slice(0, 10);
  // TRADE-COST-01: fetched_at of every Finnhub answer, per symbol, merged from
  // every fetcher's result as it lands — read by nothing that scores.
  const finnhubAgeMap = new Map<string, FinnhubFetchedAt>();
  const noteAge = (symbol: string, r: { fetchedAt?: FinnhubFetchedAt }): void => {
    if (!r.fetchedAt) return;
    finnhubAgeMap.set(symbol, { ...(finnhubAgeMap.get(symbol) ?? {}), ...r.fetchedAt });
  };
  const errors: string[] = [];
  const dataGaps: string[] = [];

  // ===== PRE-STEP: Fetch Reg SHO threshold list =====
  const regShoSymbols = await fetchRegShoThreshold();

  // ===== STEP A: Fetch TT Scanner (all tickers, batched) =====
  console.log('[Pipeline] Step A: Fetching TT scanner data...');
  let allScannerData: TTScannerData[] = [];
  let stepAFetchedAt = new Date().toISOString();
  let stepAMissing: string[] = [];
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
    // MODEL-02 STEP 4: a requested symbol TastyTrade returned no row for is
    // REPORTED — an ETF_UNIVERSE member by name on the errors list — never
    // silently absent from the funnel.
    const returned = new Set(allScannerData.map(d => d.symbol));
    stepAMissing = allSymbols.filter(sym => !returned.has(sym));
    if (stepAMissing.length > 0) {
      dataGaps.push(`Step A: ${stepAMissing.length} of ${allSymbols.length} requested symbols returned no TastyTrade market-metrics row (${stepAMissing.slice(0, 20).join(', ')}${stepAMissing.length > 20 ? `, +${stepAMissing.length - 20} more` : ''})`);
      const etfMissing = stepAMissing.filter(isEtfUniverseSymbol);
      if (etfMissing.length > 0) errors.push(`Step A (ETF universe ${ETF_UNIVERSE_SET_ON}): TastyTrade returned no market-metrics row for ${etfMissing.join(', ')} — reported, not dropped`);
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(`Step A (TT Scanner): ${msg}`);
    console.error('[Pipeline] Step A failed:', msg);
  }

  const totalUniverse = allScannerData.length;
  onProgress?.({ step: 'step_a', label: 'TT Scanner', data: {
    total_universe: allScannerData.length,
    /** MODEL-02: requested symbols TastyTrade returned no market-metrics row for (ETF members are also on errors[]). */
    missing_symbols: stepAMissing,
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
  // MODEL-01: one ranking per side — a buy-side symbol is ranked by the buyer's
  // pre-score, never by a seller's that zeroes its own edge. The SELL ranking
  // keeps its place in the step_b payload (today's shape); BUY rides alongside.
  const preFilterResults = computePreFilter(allScannerData, 'SELL');
  const preFilterResultsBuy = computePreFilter(allScannerData, 'BUY');
  const preFilterBySide: Record<PremiumSide, Map<string, PreFilterResult>> = {
    SELL: new Map(preFilterResults.map(r => [r.symbol, r])),
    BUY: new Map(preFilterResultsBuy.map(r => [r.symbol, r])),
  };
  console.log(`[Pipeline] Step A2: ${preFilterResults.length} tickers ranked by preScore (mode=${options.side})`);

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

  // ===== STEP C (new): Hard Exclusions — per premium direction (MODEL-01) =====
  // SELL keeps today's rule (IV ≤ HV excluded — no vol premium); BUY requires
  // the opposite (HV above IV by the stated margin, side-rules.ts). BOTH runs
  // both branches; the two rules are mutually exclusive on the spread, so every
  // survivor has exactly one side. Every exclusion reason names the side.
  const stepCExcluded: { symbol: string; side: ScanSide; reason: string }[] = [];
  const stepCIncluded: (PreFilterResult & { side: PremiumSide })[] = [];
  const symbolSide = new Map<string, PremiumSide>();

  for (const r of preFilterResults) {
    const t = allScannerData.find(s => s.symbol === r.symbol)!;
    const inputs = { ivHvSpread: t.ivHvSpread, liquidityRating: r.liquidityRating };
    if (options.side === 'BOTH') {
      const { side, reasons } = sideOf(inputs);
      if (side === null) {
        stepCExcluded.push({ symbol: r.symbol, side: 'BOTH', reason: `${reasons.SELL} | ${reasons.BUY}` });
      } else {
        stepCIncluded.push({ ...(preFilterBySide[side].get(r.symbol) ?? r), side });
        symbolSide.set(r.symbol, side);
      }
    } else {
      const reason = stepCReason(options.side, inputs);
      if (reason !== null) {
        stepCExcluded.push({ symbol: r.symbol, side: options.side, reason });
      } else {
        stepCIncluded.push({ ...(preFilterBySide[options.side].get(r.symbol) ?? r), side: options.side });
        symbolSide.set(r.symbol, options.side);
      }
    }
  }
  // Rank within side by the side's own pre-score
  stepCIncluded.sort((a, b) => b.preScore - a.preScore);

  const earningsWarnings = stepCIncluded
    .filter(r => {
      const t = allScannerData.find(s => s.symbol === r.symbol);
      return t != null && t.daysTillEarnings != null && t.daysTillEarnings >= 0 && t.daysTillEarnings <= 3;
    })
    .map(r => ({ symbol: r.symbol, days_to_earnings: allScannerData.find(t => t.symbol === r.symbol)?.daysTillEarnings ?? null }));

  const stepCBySide = { SELL: stepCIncluded.filter(r => r.side === 'SELL').length, BUY: stepCIncluded.filter(r => r.side === 'BUY').length };
  console.log(`[Pipeline] Step C: ${stepCIncluded.length} survived (SELL ${stepCBySide.SELL}, BUY ${stepCBySide.BUY}), ${stepCExcluded.length} excluded`);

  onProgress?.({ step: 'step_c', label: 'Hard Exclusions', data: {
    side_mode: options.side,
    survivors: stepCIncluded.length,
    survivors_by_side: stepCBySide,
    excluded: stepCExcluded.length,
    exclusions: stepCExcluded,
    earnings_warnings: earningsWarnings,
  } });

  // Use pre-filter to narrow the candidate set: take top (limit × DEEP_FETCH_MULTIPLIER) non-excluded
  // tickers by preScore. This reduces the universe BEFORE hard filters + Finnhub.
  // MODEL-01: in BOTH mode the limit*2 seats split evenly between the sides
  // (each ranked by its own pre-score); a side with fewer eligible symbols
  // yields its unused seats to the other. The total never exceeds limit*2, so
  // the Finnhub fetch that follows costs the same as a one-sided run.
  const allocateBySide = <T extends { side: PremiumSide }>(rows: T[], seats: number): T[] => {
    const sell = rows.filter(r => r.side === 'SELL');
    const buy = rows.filter(r => r.side === 'BUY');
    if (options.side !== 'BOTH') return rows.slice(0, seats);
    const half = Math.ceil(seats / 2);
    const sellTake = Math.min(sell.length, Math.max(half, seats - buy.length));
    const buyTake = Math.min(buy.length, seats - sellTake);
    return [...sell.slice(0, sellTake), ...buy.slice(0, buyTake)];
  };
  const preFilterTopN = Math.min(limit * DEEP_FETCH_MULTIPLIER, stepCIncluded.length);
  const preFilterSelected = allocateBySide(stepCIncluded, preFilterTopN);
  const preFilterCandidates = new Set(preFilterSelected.map(r => r.symbol));
  const preFilteredScannerData = allScannerData.filter(t => preFilterCandidates.has(t.symbol));
  console.log(`[Pipeline] Step D: Narrowed ${stepCIncluded.length} → ${preFilteredScannerData.length} by preScore (top ${preFilterTopN}, per side)`);

  // ===== STEP D (new): Top-N Selection =====
  const cutoffScore = preFilterSelected[preFilterSelected.length - 1]?.preScore ?? 0;
  onProgress?.({ step: 'step_d', label: 'Top-N Selection', data: {
    input: stepCIncluded.length,
    selected: preFilterSelected.length,
    selected_by_side: { SELL: preFilterSelected.filter(r => r.side === 'SELL').length, BUY: preFilterSelected.filter(r => r.side === 'BUY').length },
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
      noteAge(item.symbol, result);
      if (result.data && result.data.length > 0) {
        finnhubPeersMap[item.symbol] = result.data;
      }
    } catch (e: unknown) {
      // KILL-4: still falls through to GICS grouping, but the failure is
      // DECLARED — a degraded peer tier must not be silent.
      errors.push(`Step E11a (finnhub-peers ${item.symbol}) FAILED: ${e instanceof Error ? e.message : String(e)} — peer grouping degraded to GICS tier`);
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
  const preScores = computePreScores(survivors, symbolSide);
  // Overfetch: fetch 2x the desired final count so convergence gate + quality floor
  // exclusions don't leave us short on tickers for the final 9
  // MODEL-01: seats split per side in BOTH mode (see allocateBySide) — the
  // Finnhub fetch count is unchanged.
  // MODEL-02: this second cut never binds — preScores derives from the survivors of the first (reported, kept for the shape of pre_scores).
  const fetchCount = Math.min(limit * DEEP_FETCH_MULTIPLIER, preScores.length);
  const topN = allocateBySide(preScores.map(r => ({ ...r, side: symbolSide.get(r.symbol) as PremiumSide })), fetchCount);
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
  // MODEL-02: Cboe's daily VVIX / VIX term structure / SKEW ride alongside FRED —
  // free, no key, 24 h in-process TTL (cboe-daily.ts). A file that fails is an
  // error line here and a declared null on the regime trace, never imputed.
  const [fredResult, fredDailyResult, cboeDaily] = await Promise.all([
    fetchFredMacro(),
    fetchFredDailySeries(),
    fetchCboeDaily(),
  ]);
  const fredMs = Date.now() - fredStart;

  if (fredResult.error) {
    errors.push(`Step H (FRED macro): ${fredResult.error}`);
  }
  if (fredDailyResult.error) {
    errors.push(`Step H (FRED daily): ${fredDailyResult.error}`);
  }
  for (const e of cboeDaily.errors) {
    errors.push(`Step H (Cboe daily): ${e}`);
    dataGaps.push(`cboe_daily: ${e} — the regime input is null this run (declared on the brake / vol_conditioners trace, never imputed)`);
  }
  const cboeRow = (name: string, key: string, p: CboeDailyData['vvix'], file: string) => ({
    name, key, value: p?.value ?? null, source: 'Cboe', series_id: file,
    fetched_at: p?.fetched_at ?? null, data_date: p?.date ?? null,
    null_reason: p ? null : (cboeDaily.errors.find(e => e.startsWith(`${file.replace('_History.csv', '')}:`)) ?? 'absent from the Cboe read'),
  });

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
      // Label fix (EDGE-6): VXVCLS is the CBOE 3-MONTH VIX (VIX3M, formerly
      // VXV) — the prior "Short-Term (9d)" label was factually wrong.
      { name: 'VIX 3-Month (VIX3M)', key: 'vxvShortTerm', value: fredResult.data.vxvShortTerm,
        source: 'FRED', series_id: 'VXVCLS', null_reason: fredResult.data.vxvShortTerm == null ? 'FRED returned null' : null },
      // MODEL-02: VVIX and the term structure / SKEW from Cboe (FRED never had VVIXCLS)
      cboeRow('VVIX', 'vvix', cboeDaily.vvix, 'VVIX_History.csv'),
      cboeRow('VIX 9-Day (Cboe)', 'vix9d', cboeDaily.vix9d, 'VIX9D_History.csv'),
      cboeRow('VIX (Cboe)', 'vix_cboe', cboeDaily.vix, 'VIX_History.csv'),
      cboeRow('VIX 3-Month (Cboe)', 'vix3m_cboe', cboeDaily.vix3m, 'VIX3M_History.csv'),
      cboeRow('VIX 6-Month (Cboe)', 'vix6m', cboeDaily.vix6m, 'VIX6M_History.csv'),
      cboeRow('SKEW', 'skew', cboeDaily.skew, 'SKEW_History.csv'),
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

  // KILL-4: per-endpoint Finnhub failures are DECLARED — a failed feed is
  // "feed unavailable", never "fetched, empty". Affected signals are already
  // excluded + renormalized by the gates; this surfaces the CAUSE.
  if (finnhubResult.stats.error_messages.length > 0) {
    const msgs = finnhubResult.stats.error_messages;
    dataGaps.push(`finnhub: ${msgs.length} feed failure(s) — affected signals excluded per gate (feed unavailable). First ${Math.min(5, msgs.length)}: ${msgs.slice(0, 5).join(' | ')}`);
    errors.push(...msgs.slice(0, 50).map(m => `Step E (finnhub feed) FAILED: ${m}`));
    if (msgs.length > 50) errors.push(`Step E (finnhub feed): ${msgs.length - 50} further feed failure(s) truncated — see server logs`);
  }
  // TRADE-COST-01: an answer the vendor gave that could NOT be stored is declared
  // on its own line — the feed was available, the cache row was not written.
  if (finnhubResult.stats.store_errors.length > 0) {
    errors.push(...finnhubResult.stats.store_errors.slice(0, 20).map(m => `Step E (finnhub cache store) FAILED: ${m}`));
  }

  // Fetch annual financials per symbol (for Piotroski YoY signals)
  const annualFinancialsMap = new Map<string, AnnualFinancials | null>();
  for (const symbol of topSymbols) {
    try {
      const result = await fetchAnnualFinancials(symbol);
      annualFinancialsMap.set(symbol, result.data);
      noteAge(symbol, result);
      if (result.error) errors.push(`Step E (annual-financials ${symbol}): ${result.error}`);
    } catch (e: unknown) {
      // KILL-4: a thrown fetch is DECLARED like the result.error path above —
      // null still flows to exclusion, the cause reaches errors[].
      annualFinancialsMap.set(symbol, null);
      errors.push(`Step E (annual-financials ${symbol}) FAILED: ${e instanceof Error ? e.message : String(e)}`);
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
          noteAge(symbol, result);
          if (result.error) errors.push(`Step E3 (news-sentiment ${symbol}): ${result.error}`);
        } catch (e: unknown) {
          // KILL-4: a thrown fetch is DECLARED like the result.error path above
          newsSentimentMap.set(symbol, null);
          errors.push(`Step E3 (news-sentiment ${symbol}) FAILED: ${e instanceof Error ? e.message : String(e)}`);
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
          noteAge(symbol, result);
          if (result.error) errors.push(`Step E4 (finbert ${symbol}): ${result.error}`);
        } catch (e: unknown) {
          // KILL-4: a thrown fetch is DECLARED like the result.error path above
          finbertMap.set(symbol, null);
          errors.push(`Step E4 (finbert ${symbol}) FAILED: ${e instanceof Error ? e.message : String(e)}`);
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
          noteAge(symbol, result);
          if (result.error) errors.push(`Step E5 (earnings-quality ${symbol}): ${result.error}`);
        } catch (e: unknown) {
          // KILL-4: a thrown fetch is DECLARED like the result.error path above
          earningsQualityMap.set(symbol, null);
          errors.push(`Step E5 (earnings-quality ${symbol}) FAILED: ${e instanceof Error ? e.message : String(e)}`);
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
          noteAge(symbol, result);
          if (result.error) errors.push(`Step E6 (institutional-ownership ${symbol}): ${result.error}`);
        } catch (e: unknown) {
          // KILL-4: a thrown fetch is DECLARED like the result.error path above
          institutionalOwnershipMap.set(symbol, null);
          errors.push(`Step E6 (institutional-ownership ${symbol}) FAILED: ${e instanceof Error ? e.message : String(e)}`);
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
          noteAge(symbol, result);
          if (result.error) errors.push(`Step E7 (revenue-breakdown ${symbol}): ${result.error}`);
        } catch (e: unknown) {
          // KILL-4: a thrown fetch is DECLARED like the result.error path above
          revenueBreakdownMap.set(symbol, null);
          errors.push(`Step E7 (revenue-breakdown ${symbol}) FAILED: ${e instanceof Error ? e.message : String(e)}`);
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
          noteAge(symbol, result);
          if (result.error) errors.push(`Step E8 (quarterly-financials ${symbol}): ${result.error}`);
        } catch (e: unknown) {
          // KILL-4: a thrown fetch is DECLARED like the result.error path above
          quarterlyFinancialsMap.set(symbol, null);
          errors.push(`Step E8 (quarterly-financials ${symbol}) FAILED: ${e instanceof Error ? e.message : String(e)}`);
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
          // KILL-4: a thrown fetch is DECLARED like the result.error path above
          secFilingMap.set(symbol, null);
          errors.push(`Step E9 (sec-edgar ${symbol}) FAILED: ${e instanceof Error ? e.message : String(e)}`);
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
          noteAge(symbol, result);
          if (result.error) errors.push(`Step E10 (insider-tx ${symbol}): ${result.error}`);
        } catch (e: unknown) {
          // KILL-4: a thrown fetch is DECLARED like the result.error path above
          secForm4Map.set(symbol, null);
          errors.push(`Step E10 (insider-tx ${symbol}) FAILED: ${e instanceof Error ? e.message : String(e)}`);
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
          // KILL-4: non-fatal (text peers are an enhancement) but DECLARED —
          // the symbol silently missing from textProfiles hid the cause.
          errors.push(`Step E11 (10k-text ${symbol}) FAILED: ${e instanceof Error ? e.message : String(e)}`);
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
        noteAge(symbol, result);
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
        noteAge(symbol, result);
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
        noteAge(symbol, result);
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
        noteAge(symbol, result);
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
        noteAge(symbol, result);
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
        noteAge(symbol, result);
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

  // ===== STEP E12: Fetch own-history VRP distributions (EDGE-4) =====
  // Each ticker's VRP series (iv30 − hv30, one obs per distinct scan day,
  // 365d, >= 20 days) from its own scan_snapshots. Tickers without enough
  // history get NO entry → vrp_z null → VRP excluded → weights renormalized.
  // No proxy distribution is ever substituted.
  let vrpHistoryMap = new Map<string, VrpHistoryData>();
  if (userId) {
    try {
      vrpHistoryMap = await fetchVrpHistoryBatch(userId, topSymbols);
      console.log(`[Pipeline] Step E12: VRP own-history available for ${vrpHistoryMap.size}/${topSymbols.length} tickers (>= 20 distinct scan days, 365d)`);
      if (vrpHistoryMap.size < topSymbols.length) {
        dataGaps.push(`vrp_history: ${topSymbols.length - vrpHistoryMap.size}/${topSymbols.length} tickers lack >= 20 distinct scan days in 365d of scan_snapshots — their VRP sub-score is excluded and mispricing weights renormalized (no proxy distribution)`);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`Step E12 (VRP history fetch): ${msg}`);
      dataGaps.push('vrp_history: scan_snapshots query FAILED — VRP sub-score excluded for ALL tickers this run and mispricing weights renormalized (no proxy distribution)');
      console.error('[Pipeline] Step E12 failed:', msg);
    }
  } else {
    dataGaps.push('vrp_history: no userId — scan_snapshots history unavailable, VRP sub-score excluded for all tickers and mispricing weights renormalized');
  }

  // ===== STEP F: Score All 4 Categories =====
  console.log('[Pipeline] Step F: Scoring all categories...');
  const scoredTickers: {
    symbol: string;
    side: PremiumSide;
    scannerData: TTScannerData;
    finnhubData: FinnhubData;
    scoring: FullScoringResult;
    dataAge: FinnhubFetchedAt;
  }[] = [];
  // MODEL-01: every scored symbol came through Step C on exactly one side; a
  // symbol without a side cannot be scored on "its side's model" — refused.
  const sideOfSymbol = (symbol: string): PremiumSide => {
    const side = symbolSide.get(symbol);
    if (!side) throw new Error(`MODEL-01: ${symbol} reached scoring with no premium side — it did not pass Step C on either side`);
    return side;
  };

  for (const symbol of topSymbols) {
    const scannerData = scannerMap.get(symbol);
    if (!scannerData) continue;

    const finnhubData: FinnhubData = finnhubResult.data.get(symbol) || {
      fundamentals: null,
      recommendations: [],
      insiderSentiment: [],
      earnings: [],
      estimateData: null,
      feedErrors: [],
      fetchedAt: {},
      storeErrors: [],
    };
    noteAge(symbol, finnhubData);

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
      cboeDaily,
      peerStats,
      peerGroupAssignment,
      textPeerGroups: Object.keys(textPeerGroups).length > 0 ? textPeerGroups : undefined,
      vrpHistory: vrpHistoryMap.get(symbol) ?? null,
      finnhubFetchedAt: finnhubAgeMap.get(symbol) ?? null,
    };

    try {
      const side = sideOfSymbol(symbol);
      const scoring = scoreAll(convergenceInput, side);
      scoredTickers.push({ symbol, side, scannerData, finnhubData, scoring, dataAge: finnhubAgeMap.get(symbol) ?? {} });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`Step F (score ${symbol}): ${msg}`);
    }
  }

  console.log(`[Pipeline] Step F: Scored ${scoredTickers.length} tickers`);

  // ===== STEP F2: Fetch candle data and re-score with real technicals =====
  console.log('[Pipeline] Step F2: Fetching candle data for scored tickers...');
  let candleStats: CandleBatchStats = { total_candles: 0, symbols_with_data: 0, symbols_failed: [], elapsed_ms: 0, malformed_candles: 0 };
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
        cboeDaily,
        peerStats,
        peerGroupAssignment,
        textPeerGroups: Object.keys(textPeerGroups).length > 0 ? textPeerGroups : undefined,
        vrpHistory: vrpHistoryMap.get(ticker.symbol) ?? null,
        finnhubFetchedAt: finnhubAgeMap.get(ticker.symbol) ?? null,
      };

      try {
        ticker.scoring = scoreAll(convergenceInput, ticker.side);
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
        symbol: r.symbol, composite: r.composite, vol_edge: r.vol_edge, quality: r.quality, regime: r.regime, info_edge: r.info_edge, sector: r.sector, convergence: r.convergence, selection_status: r.composite === null ? 'not_scored — all gates excluded' : r.composite >= 50 ? 'eligible' : 'below_threshold',
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
          // EDGE-4: how many vol-edge sub-scores were computed from real data
          // (excluded signals — e.g. VRP without an own-history distribution —
          // are dropped and the weights re-normalized).
          active_signal_count: scoring.vol_edge.data_confidence.active_signal_count ?? null,
          total_signal_count: scoring.vol_edge.data_confidence.total_sub_scores,
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
          // KILL-3: how many quality sub-scores were computed from real data
          // (the rest were excluded and the weights re-normalized).
          active_signal_count: scoring.quality.data_confidence.active_signal_count ?? null,
          total_signal_count: scoring.quality.data_confidence.total_sub_scores,
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
          // KILL-3: how many regime signals were computed from real data
          // (the rest were excluded and the weights re-normalized).
          active_signal_count: scoring.regime.data_confidence.active_signal_count ?? null,
          total_signal_count: scoring.regime.data_confidence.total_sub_scores,
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
          // EDGE-6: wired vol-regime conditioners + survival brake (declared)
          vix_term_structure: scoring.regime.breakdown.vol_conditioners.vix_term_structure.score ?? null,
          vix_term_structure_raw: scoring.regime.breakdown.vol_conditioners.vix_term_structure.raw_value ?? null,
          vvix: scoring.regime.breakdown.vol_conditioners.vvix.score ?? null,
          vvix_raw: scoring.regime.breakdown.vol_conditioners.vvix.raw_value ?? null,
          survival_brake: scoring.regime.breakdown.survival_brake.state,
          survival_brake_declaration: scoring.regime.breakdown.survival_brake.declaration,
        } : null,
        info_edge_detail: scoring ? {
          // KILL-5: null score/weight = analyst signal excluded (no data)
          analyst_consensus: {
            score: scoring.info_edge.breakdown.analyst_consensus?.score ?? null,
            weight: scoring.info_edge.breakdown.analyst_consensus?.weight ?? null,
          },
          // EDGE-2b: null score/weight = signal excluded (no data) and weights
          // renormalized — never a number invented for display.
          price_target: {
            score: scoring.info_edge.breakdown.price_target_signal?.score ?? null,
            weight: scoring.info_edge.breakdown.price_target_signal?.weight ?? null,
          },
          upgrade_downgrade: {
            score: scoring.info_edge.breakdown.upgrade_downgrade_signal?.score ?? null,
            weight: scoring.info_edge.breakdown.upgrade_downgrade_signal?.weight ?? null,
          },
          insider_activity: {
            score: scoring.info_edge.breakdown.insider_activity?.score ?? null,
            weight: scoring.info_edge.breakdown.insider_activity?.weight ?? null,
          },
          earnings_momentum: {
            score: scoring.info_edge.breakdown.earnings_momentum?.score ?? null,
            weight: scoring.info_edge.breakdown.earnings_momentum?.weight ?? null,
          },
          flow_signal: {
            score: scoring.info_edge.breakdown.flow_signal?.score ?? null,
            weight: scoring.info_edge.breakdown.flow_signal?.weight ?? null,
          },
          news_sentiment: scoring.info_edge.breakdown.news_sentiment != null ? {
            score: scoring.info_edge.breakdown.news_sentiment.score,
            weight: scoring.info_edge.breakdown.news_sentiment.weight,
          } : null,
          institutional_ownership: {
            score: scoring.info_edge.breakdown.institutional_ownership?.score ?? null,
            weight: scoring.info_edge.breakdown.institutional_ownership?.weight ?? null,
          },
          fund_flow: {
            score: scoring.info_edge.breakdown.fund_ownership_flow?.score ?? null,
            weight: scoring.info_edge.breakdown.fund_ownership_flow?.weight ?? null,
          },
          material_event: {
            score: scoring.info_edge.breakdown.material_event_flag?.score ?? null,
            weight: scoring.info_edge.breakdown.material_event_flag?.weight ?? null,
          },
          // EDGE-7b: null score/weight = < 2 usable months — excluded + renormalized
          recommendation_revision: {
            score: scoring.info_edge.breakdown.recommendation_revision?.score ?? null,
            weight: scoring.info_edge.breakdown.recommendation_revision?.weight ?? null,
          },
          data_confidence: scoring.info_edge.data_confidence.confidence,
          // EDGE-2: how many of the 11 sub-scores were computed from real data (EDGE-7b added recommendation_revision)
          // (the rest were excluded and the weights re-normalized).
          active_signal_count: scoring.info_edge.data_confidence.active_signal_count ?? null,
          total_signal_count: scoring.info_edge.data_confidence.total_sub_scores,
          filing_recency: scoring.info_edge.filing_recency ?? null,
        } : null,
      };
    }),
  } });

  // ===== STEP G: Rank and Diversify =====
  console.log('[Pipeline] Step G: Ranking and diversifying...');
  // MODEL-01: SELL and BUY are ranked as separate books — a seller score and a
  // buyer score are not comparable, so each side takes its own top N.
  const { top9, alsoScored, diversification, sectorDistribution } = rankAndDiversifyBySide(rankedRows);

  onProgress?.({ step: 'step_m', label: 'Final Selection', data: {
    fetched_at: new Date().toISOString(),
    total_scored: rankedRows.length,
    // MODEL-02 addendum: the same rule as rankAndDiversify (structure-cut.ts), never a retyped copy.
    eligible: top9.length + alsoScored.filter(r => structureCutEligibility(r, isEtfUniverseSymbol(r.symbol)).eligible).length,
    selected: top9.length,
    sector_distribution: sectorDistribution,
    adjustments: diversification.adjustments,
    top9: top9.map(r => ({
      symbol: r.symbol,
      side: r.side,
      score_model: r.score_model,
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
        // MODEL-02 addendum: the reason is the rule's own verdict (structure-cut.ts) — an ETF member is judged on the gates that can score.
        const verdict = structureCutEligibility(r, isEtfUniverseSymbol(r.symbol));
        const reason = verdict.eligible ? 'sector cap or rank' : verdict.reason;
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

  // PIPE-01: STEP G1.5 (xAI/Grok social sentiment) is DELETED. It cost 2 metered
  // xAI calls per symbol and fed no score — scoreAll (composite.ts:118-137)
  // scores four gates from ConvergenceInput, and social_sentiment was never one
  // of them. Sentiment that DOES score comes from Finnhub: news sentiment
  // (info-edge.ts:907 scoreNewsSentiment) over /company-news and /news-sentiment.

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
  let rawStrategyCards = new Map<string, StrategyCard[]>();

  // MODEL-01 STEP 5: the undefined-risk cap, checked ONCE per run against the
  // user's OPEN positions. A count that cannot be obtained blocks the build
  // (fail-safe) and is declared here and on every blocked candidate.
  let openUndefinedRisk: number | null = null;
  if (userId) {
    try {
      openUndefinedRisk = await countUserOpenUndefinedRiskPositions(userId);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`MODEL-01 (undefined-risk cap): open positions could not be counted — ${msg}; unbounded structures NOT built this run`);
    }
  }
  const undefinedRiskCap = checkUndefinedRiskCap(options.allowUndefinedRisk, openUndefinedRisk);
  if (!undefinedRiskCap.allowed) dataGaps.push(`trade_cards: ${undefinedRiskCap.reason}`);

  const marketStatus = isMarketOpen();
  if (!marketStatus.open) {
    chainMarketOpen = false;
    chainMarketNote = marketStatus.reason;
    dataGaps.push('trade_cards: market closed — using exchange theo prices. Rerun during market hours (Mon-Fri 9:30-16:00 ET) for live quotes.');
    console.log(`[Pipeline] Step G2: Market closed (${marketStatus.reason}), will use theo prices`);
  }
  try {
    // Build input for chain fetcher from top 9 tickers
    const chainSkippedNoIvp: string[] = [];
    const chainSkippedNoIv30: string[] = [];
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

      // Exclude ticker if IV_percentile is null — no fallback. KILL-2: with
      // honest nulls at the parse boundary this path is now reachable
      // (missing IVP used to arrive imputed as 0 and slip through as rank 0);
      // the exclusion is declared in data_gaps after the filter below.
      if (s.vol_edge.breakdown.mispricing.inputs.IV_percentile == null) {
        chainSkippedNoIvp.push(row.symbol);
        return null;
      }

      // KILL-5: iv30 drives σ in every breakeven_d2 PoP — without it nothing
      // can be priced honestly. Skip + declare (hard Filter 3 makes this
      // near-unreachable, but the old path fabricated a 30-vol here).
      if (tt.iv30 == null) {
        chainSkippedNoIv30.push(row.symbol);
        return null;
      }

      // EDGE-3: 10-day realized vol for the HV10>IV sanity gate — same
      // computation as the displayed vol cone (computeCloseToCloseHV, percent),
      // converted to decimal. null when candle history is insufficient; the
      // gate then declares itself not-evaluated (never imputed).
      const hv10Pct = computeCloseToCloseHV(candleDataMap.get(row.symbol) ?? [], 10);

      return {
        symbol: row.symbol,
        suggested_dte: s.strategy_suggestion.suggested_dte,
        direction: s.strategy_suggestion.direction,
        currentPrice: latestClose,
        ivRank: (s.vol_edge.breakdown.mispricing.inputs.IV_percentile as number) / 100,
        // KILL-5: no fabricated vols. iv30 is guaranteed non-null by hard
        // Filter 3 for pipeline tickers, but verified — a null skips the
        // ticker with a declaration, never a fabricated 30-vol. hv30 and
        // dividendYield pass through as null when the source did not deliver
        // them; the strategy builder declares and excludes per consumer.
        iv30: tt.iv30 / 100,
        hv30: tt.hv30 != null ? tt.hv30 / 100 : null,
        // TT delivers dividend-yield in percentage points (UI renders it with
        // toFixed(2) + '%'); q wants a decimal. A true 0 stays 0 (non-payer).
        dividendYield: tt.dividendYield != null && Number.isFinite(tt.dividendYield) ? tt.dividendYield / 100 : null,
        hv10: hv10Pct != null ? hv10Pct / 100 : null,
        riskFreeRate: fedFundsRate,
        // MODEL-01: the side, the named earnings dates (Finnhub calendar, already
        // fetched at Step I7, + TastyTrade), the raw spread and the cap check
        side: ticker.side,
        scanDate: scanDateIso,
        earningsDates: earningsDateSources(
          (earningsCalendarMap.get(row.symbol)?.earningsCalendar ?? []).map(e => e.date),
          tt.earningsDate,
        ),
        ivHvSpread: tt.ivHvSpread,
        undefinedRisk: undefinedRiskCap,
      };
    }).filter((input): input is NonNullable<typeof input> => input !== null);

    if (chainSkippedNoIvp.length > 0) {
      dataGaps.push(`trade_cards: ${chainSkippedNoIvp.length} ticker(s) skipped — IV percentile unavailable, cannot select the vol-regime strategy menu (no imputed rank): ${chainSkippedNoIvp.join(', ')}`);
    }
    if (chainSkippedNoIv30.length > 0) {
      dataGaps.push(`trade_cards: ${chainSkippedNoIv30.length} ticker(s) skipped — IV30 unavailable, cannot price strategies (no fabricated vol): ${chainSkippedNoIv30.join(', ')}`);
    }

    if (chainInputs.length > 0) {
      const chainResult = await fetchChainAndBuildCards(chainInputs);
      // KILL-4: a fatal chain failure is DECLARED — the empty card set is a
      // failure, not a quiet no-strategies day.
      if (chainResult.fatal_error) {
        errors.push(`Step G2 (chain fetch) FAILED: ${chainResult.fatal_error}`);
        dataGaps.push(`trade_cards: chain fetch FAILED (${chainResult.fatal_error}) — no trade cards this run is a feed failure, not "no strategies passed"`);
      }
      chainStats = chainResult.stats;
      chainRejections = chainResult.rejections;
      perTickerStats = chainResult.perTickerStats;
      rawStrategyCards = chainResult.cards;
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

      onProgress?.({ step: 'step_q', label: 'Live Options Flow & GEX', data: {
        fetched_at: new Date().toISOString(),
        tickers_with_flow: chainResult.optionsFlowMap.size,
        tickers: Array.from(chainResult.optionsFlowMap.entries()).map(([symbol, flow]) => ({
          symbol,
          put_call_ratio: flow?.put_call_ratio ?? null,
          volume_bias: flow?.volume_bias ?? null,
          unusual_activity_ratio: flow?.unusual_activity_ratio ?? null,
          total_call_volume: flow?.total_call_volume ?? null,
          total_put_volume: flow?.total_put_volume ?? null,
          total_call_oi: flow?.total_call_oi ?? null,
          total_put_oi: flow?.total_put_oi ?? null,
          strikes_analyzed: flow?.strikes_analyzed ?? null,
          source: 'TastyTrade',
          endpoint: 'Greeks WebSocket',
        })),
      } });

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
            cboeDaily,
            peerStats,
            peerGroupAssignment,
            textPeerGroups: Object.keys(textPeerGroups).length > 0 ? textPeerGroups : undefined,
            vrpHistory: vrpHistoryMap.get(ticker.symbol) ?? null,
            finnhubFetchedAt: finnhubAgeMap.get(ticker.symbol) ?? null,
          };

          try {
            // Preserve trade cards from G2 (they're attached to strategy_suggestion)
            const existingTradeCards = ticker.scoring.strategy_suggestion.trade_cards;
            ticker.scoring = scoreAll(convergenceInput, ticker.side);
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
        onProgress?.({ step: 'step_r', label: 'Re-Score With Live Data', data: {
          fetched_at: new Date().toISOString(),
          flow_re_scored: flowReScored,
          total: scoredTickers.length,
          tickers: scoredTickers.map(ticker => ({
            symbol: ticker.symbol,
            composite: ticker.scoring?.composite.score ?? null,
            vol_edge: ticker.scoring?.vol_edge.score ?? null,
            info_edge: ticker.scoring?.info_edge.score ?? null,
            has_flow_data: optionsFlowMap.has(ticker.symbol),
            source: 'Steps L + Q',
            endpoint: 'composite re-score',
          })),
        } });
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

  onProgress?.({ step: 'step_s', label: 'Trade Cards', data: {
    fetched_at: new Date().toISOString(),
    trade_cards: chainStats.total_trade_cards,
    top_9: top9.map(r => r.symbol),
    rejections: Object.fromEntries(chainRejections),
    tickers: top9.map(r => ({
      symbol: r.symbol,
      rank: r.rank,
      composite: r.composite,
      has_trade_card: chainStats.total_trade_cards > 0,
      source: 'All prior steps',
      endpoint: 'Composite — see Steps A–J',
    })),
  } });

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

  // Generate full TradeCardData (setup + why + key_stats) for each top-9 ticker
  // This is the single source of truth — no second chain fetch needed
  let fullTradeCardsPerTicker: Record<string, TradeCardData[]> = {};
  for (const row of top9) {
    const ticker = scoredTickers.find(t => t.symbol === row.symbol);
    const stratCards = rawStrategyCards.get(row.symbol);
    if (!ticker || !stratCards || stratCards.length === 0) {
      fullTradeCardsPerTicker[row.symbol] = [];
      continue;
    }

    // Rebuild ConvergenceInput for generateTradeCards (same shape used in re-scoring)
    const tt = ticker.scannerData;
    const input: ConvergenceInput = {
      symbol: row.symbol,
      ttScanner: tt,
      candles: candleDataMap.get(row.symbol) ?? [],
      finnhubFundamentals: ticker.finnhubData.fundamentals,
      finnhubRecommendations: ticker.finnhubData.recommendations,
      finnhubInsiderSentiment: ticker.finnhubData.insiderSentiment,
      finnhubEarnings: ticker.finnhubData.earnings,
      finnhubEstimates: ticker.finnhubData.estimateData ?? null,
      fredMacro: fredResult.data,
      annualFinancials: annualFinancialsMap.get(row.symbol) ?? null,
      quarterlyFinancials: quarterlyFinancialsMap.get(row.symbol) ?? null,
      optionsFlow: optionsFlowMap.get(row.symbol) ?? null,
      newsSentiment: newsSentimentMap.get(row.symbol) ?? null,
      finnhubNewsSentiment: finbertMap.get(row.symbol) ?? null,
      finnhubEarningsQuality: earningsQualityMap.get(row.symbol) ?? null,
      finnhubInstitutionalOwnership: institutionalOwnershipMap.get(row.symbol) ?? null,
      finnhubRevenueBreakdown: revenueBreakdownMap.get(row.symbol) ?? null,
      secFilingData: secFilingMap.get(row.symbol) ?? null,
      secForm4Data: secForm4Map.get(row.symbol) ?? null,
      finnhubFundOwnership: fundOwnershipMap.get(row.symbol) ?? null,
      edgar8kScan: edgar8kMap.get(row.symbol) ?? null,
      crossAssetCorrelations,
      cboeDaily,
      peerStats,
      peerGroupAssignment,
      textPeerGroups: Object.keys(textPeerGroups).length > 0 ? textPeerGroups : undefined,
      vrpHistory: vrpHistoryMap.get(row.symbol) ?? null,
      finnhubFetchedAt: finnhubAgeMap.get(row.symbol) ?? null,
    };

    try {
      const fullCards = generateTradeCards(stratCards, ticker.scoring, input);
      fullTradeCardsPerTicker[row.symbol] = fullCards;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[Pipeline] generateTradeCards failed for ${row.symbol}:`, msg);
      // KILL-4: an exception-emptied card list must be distinguishable from a
      // legitimate "no strategies passed" — declare on both surfaces.
      fullTradeCardsPerTicker[row.symbol] = [];
      errors.push(`Step H (trade-cards ${row.symbol}) FAILED: ${msg}`);
      dataGaps.push(`trade_cards: ${row.symbol} card generation FAILED (${msg}) — empty card list is a failure, not "no strategies passed"`);
    }
  }

  // Build chain stats per ticker for result
  const chainStatsPerTicker: Record<string, PerTickerChainStats> = {};
  for (const [sym, stats] of perTickerStats) {
    chainStatsPerTicker[sym] = stats;
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

  // ===== LOG-01: EVERY SCORED CANDIDATE IS PERSISTED BEFORE IT IS RETURNED =====
  // The write and the response are ONE list: persistScanCandidates stamps a
  // candidate_id on every card and returns the same list, which is assigned
  // back to fullTradeCardsPerTicker — the variable the response is built from
  // (the candidate log law, scripts/assert-tool-registry.ts). If the write
  // fails, every candidate is WITHHELD and the gap declared: the scan never
  // returns a scored candidate it did not persist.
  let scanRunId: string | null = null;
  let candidatesLogged = 0;
  let candidatesWithheld = false;
  const candidateContext: Record<string, { scoring: FullScoringResult; spotAtScan: number | null; iv30AtScan: number | null }> = {};
  for (const symbol of Object.keys(fullTradeCardsPerTicker)) {
    const t = scoredTickers.find(x => x.symbol === symbol);
    if (t) candidateContext[symbol] = { scoring: t.scoring, spotAtScan: t.scoring.vol_edge.breakdown.technicals.indicators.latest_close ?? null, iv30AtScan: t.scannerData.iv30 ?? null };
  }
  if (!userId) {
    candidatesWithheld = true;
    fullTradeCardsPerTicker = {};
    dataGaps.push('LOG-01: no userId — candidates cannot be keyed to a scan run; every scored candidate WITHHELD from this response (never returned unpersisted)');
  } else {
    try {
      const persisted = await persistScanCandidates(
        { userId, universe, limit, side: options.side, tickersScored: scoredTickers.length, cards: fullTradeCardsPerTicker, context: candidateContext, now: new Date() },
        prismaCandidateLogStore,
      );
      fullTradeCardsPerTicker = persisted.cards;
      scanRunId = persisted.runId;
      candidatesLogged = persisted.written;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      candidatesWithheld = true;
      fullTradeCardsPerTicker = {};
      errors.push(`LOG-01 (candidate persistence): ${msg}`);
      dataGaps.push(`LOG-01: candidate persistence FAILED (${msg}) — every scored candidate WITHHELD from this response (the scan never returns a candidate it did not persist)`);
    }
  }

  if (chainStats.chain_symbols_fetched > 0 && chainStats.total_trade_cards === 0) {
    dataGaps.push('trade_cards: option chains fetched but no strategies passed quality gates');
  } else if (chainStats.chain_symbols_fetched === 0 && top9.length > 0) {
    dataGaps.push('trade_cards: chain fetch failed or no valid expirations found');
  }

  // ===== SNAPSHOT LOGGING (MODEL-02: awaited — the log never lies) =====
  // Every scored ticker is written to scan_snapshots, one insert each, and the
  // write's result is part of the scan: `pipeline_summary.snapshot` says how
  // many rows landed and, per ticker, why any did not. A failed write is an
  // error line and a data gap on the response — never `saved: true` by
  // assumption. Until 2026-09-16 this was `void`ed and reported as saved.
  let snapshot: SnapshotWriteResult;
  if (userId) {
    snapshot = await logScanSnapshotBatch(
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
      prismaSnapshotStore,
    );
    if (!snapshot.written) {
      errors.push(`Step T (snapshot): ${snapshot.reason}`);
      dataGaps.push(`scan_snapshots: ${snapshot.rows_written} of ${snapshot.rows_attempted} rows written — ${snapshot.reason}`);
      console.error(`[Pipeline] scan_snapshots write incomplete: ${snapshot.reason}`);
    }
  } else {
    snapshot = snapshotNotAttempted('no user session — snapshot not attempted');
    dataGaps.push('scan_snapshots: not attempted (no user session)');
  }

  const pipelineMs = Date.now() - pipelineStart;
  const meter = finnhubMeterSnapshot();
  if (!meter) throw new Error('runPipelineMetered ran outside withFinnhubMeter — the Finnhub call count would be unmeasured');

  const result: PipelineResult = {
    pipeline_summary: {
      total_universe: totalUniverse,
      after_hard_filters: hardFilters.output_count,
      pre_scored: preScores.length,
      finnhub_fetched: topSymbols.length,
      scored: scoredTickers.length,
      final_9: top9.map(r => r.symbol),
      pipeline_runtime_ms: pipelineMs,
      finnhub_calls_made: meter.upstream,
      finnhub_cache_hits: meter.hits,
      scan_run_id: scanRunId,
      candidates_logged: candidatesLogged,
      candidates_withheld: candidatesWithheld,
      snapshot,
      scan_side: options.side,
      allow_undefined_risk: options.allowUndefinedRisk,
      undefined_risk_cap: undefinedRiskCap,
      cards_by_side: {
        SELL: Object.values(fullTradeCardsPerTicker).flat().filter(c => c.why.side === 'SELL').length,
        BUY: Object.values(fullTradeCardsPerTicker).flat().filter(c => c.why.side === 'BUY').length,
      },
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
    full_trade_cards_per_ticker: fullTradeCardsPerTicker,
    chain_stats_per_ticker: chainStatsPerTicker,
    pre_filter: preFilterResults,
    rejection_reasons: Object.fromEntries(chainRejections),
    data_gaps: dataGaps,
    errors,
  };

  console.log(`[Pipeline] Complete in ${pipelineMs}ms. Structure cut (${STRUCTURE_CUT} per side): ${top9.length} — ${top9.map(r => r.symbol).join(', ')}`);

  onProgress?.({ step: 'step_t', label: 'Save & Return', data: {
    fetched_at: new Date().toISOString(),
    // MODEL-02: `saved` is the write's own verdict, never the presence of a session.
    saved: snapshot.written,
    user_id_present: userId != null,
    symbols_logged: snapshot.rows_written,
    snapshot,
    pipeline_runtime_ms: pipelineMs,
    final_9: top9.map(r => r.symbol),
    source: 'Azure PostgreSQL',
    endpoint: 'logScanSnapshotBatch',
  } });

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
      } else if (t.marketCap == null && isEtfUniverseSymbol(t.symbol)) {
        // MODEL-02 STEP 4: an index/sector ETF has no issuer market cap — the
        // $2B floor is an issuer-size test and is DECLARED not applicable to an
        // ETF_UNIVERSE member (dated const, 15 names), never imputed. Passes with
        // a warning on the record; a null cap on any other symbol still fails.
        passed.push(t);
        warningTickers.set(t.symbol, {
          filter: 'Market Cap',
          reason: `ETF_UNIVERSE member (${ETF_UNIVERSE_SET_ON}): issuer market cap is not applicable to an index/sector ETF — the $2B floor was not evaluated, declared`,
        });
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
        // Borrow rate data unavailable — pass but flag warning (MODEL-02: merged
        // with an earlier warning on the same symbol, never overwriting it)
        passed.push(t);
        const prior = warningTickers.get(t.symbol);
        warningTickers.set(t.symbol, {
          filter: prior ? `${prior.filter} + Borrow Rate` : 'Borrow Rate',
          reason: prior ? `${prior.reason}; borrow rate data unavailable — flagged for review` : 'Borrow rate data unavailable — flagged for review',
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

function computePreScores(survivors: TTScannerData[], symbolSide: Map<string, PremiumSide>): PreScoreRow[] {
  const rows: PreScoreRow[] = [];

  for (const t of survivors) {
    // Normalize IVP: if <= 1.0, multiply by 100
    let ivp = t.ivPercentile;
    if (ivp != null && ivp <= 1.0) ivp = round(ivp * 100, 1);
    // MODEL-01: on the BUY side a low IV percentile is the edge — inverted.
    // (The |spread| term below is direction-blind and serves both sides.)
    if (ivp != null && symbolSide.get(t.symbol) === 'BUY') ivp = round(100 - ivp, 1);

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
    side: PremiumSide;
    scannerData: TTScannerData;
    finnhubData: FinnhubData;
    scoring: FullScoringResult;
    dataAge: FinnhubFetchedAt;
  }[],
): RankedRow[] {
  // Sort by composite score descending. MIG-1: a null composite (all gates
  // excluded) sorts LAST — it has no score, it is not a low score.
  const sorted = [...scoredTickers].sort((a, b) => {
    const as = a.scoring.composite.score;
    const bs = b.scoring.composite.score;
    if (as === null && bs === null) return 0;
    if (as === null) return 1;
    if (bs === null) return -1;
    return bs - as;
  });

  return sorted.map((t, idx) => {
    const s = t.scoring;
    const tt = t.scannerData;

    // Normalize IVP for display
    let ivp = tt.ivPercentile;
    if (ivp != null && ivp <= 1.0) ivp = round(ivp * 100, 1);

    // Extract hv_trend from vol_edge breakdown
    const hvTrend = s.vol_edge.breakdown.mispricing.hv_trend;

    // Extract MSPR from info_edge breakdown (null when insider signal excluded — no data)
    const mspr = s.info_edge.breakdown.insider_activity?.insider_detail.latest_mspr ?? null;

    // Extract beat streak from quality breakdown
    const beatStreak = s.quality.breakdown.profitability.earnings_quality.earnings_detail.streak;

    // Build convergence string. MODEL-02 addendum: an ETF_UNIVERSE member is
    // judged on the gates that can score, and the string says so.
    const scoredGates = s.composite.scored_by.length;
    const convergence = isEtfUniverseSymbol(t.symbol) && scoredGates < 4
      ? `${s.composite.categories_above_50}/${scoredGates} (scored on ${scoredGates} of 4 gates)`
      : `${s.composite.categories_above_50}/4`;

    // Build key_signal summary
    const signals: string[] = [];
    if (ivp != null) signals.push(`IVP=${round(ivp, 0)}%`);
    if (tt.iv30 != null && tt.hv30 != null) {
      // KILL-5 no-drift: ONE VRP definition everywhere — the simple difference
      // iv30 − hv30 the scorer uses (Goyal & Saretto 2009; vol-edge). The old
      // display showed the variance form iv30² − hv30² with no stated rationale.
      const vrp = round(tt.iv30 - tt.hv30, 1);
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
      data_age: t.dataAge,
      composite: s.composite.score,
      vol_edge: s.vol_edge.score,
      quality: s.quality.score,
      regime: s.regime.score,
      info_edge: s.info_edge.score,
      convergence,
      categories_above_50: s.composite.categories_above_50,
      scored_gates: scoredGates,
      direction: s.composite.direction,
      strategy: s.strategy_suggestion.suggested_strategy,
      sector: tt.sector,
      ivp: ivp != null ? round(ivp, 1) : null,
      iv_hv_spread: tt.ivHvSpread != null ? round(tt.ivHvSpread, 2) : null,
      hv_trend: hvTrend,
      mspr: mspr != null ? round(mspr, 2) : null,
      beat_streak: beatStreak,
      key_signal: signals.join(', '),
      side: t.side,
      score_model: s.composite.score_model,
    };
  });
}

/**
 * MODEL-01: rank each side as its own book. A seller score and a buyer score
 * live on different models and are never ranked against each other; each
 * side takes its own top N (rankAndDiversify, unchanged) and the two lists
 * are concatenated, SELL first, every row labelled with its side.
 */
function rankAndDiversifyBySide(rankedRows: RankedRow[]): ReturnType<typeof rankAndDiversify> {
  const sides: PremiumSide[] = ['SELL', 'BUY'];
  const top9: RankedRow[] = [];
  const alsoScored: RankedRow[] = [];
  const adjustments: string[] = [];
  const sectorDistribution: Record<string, number> = {};
  for (const side of sides) {
    const rows = rankedRows.filter(r => r.side === side).map((r, i) => ({ ...r, rank: i + 1 }));
    if (rows.length === 0) continue;
    const res = rankAndDiversify(rows);
    top9.push(...res.top9);
    alsoScored.push(...res.alsoScored);
    adjustments.push(...res.diversification.adjustments.map(a => `[${side}] ${a}`));
    for (const [sector, n] of Object.entries(res.sectorDistribution)) sectorDistribution[sector] = (sectorDistribution[sector] ?? 0) + n;
  }
  return { top9, alsoScored, diversification: { adjustments }, sectorDistribution };
}

// ===== STEP G: Rank and Diversify =====

function rankAndDiversify(rankedRows: RankedRow[]): {
  top9: RankedRow[];
  alsoScored: RankedRow[];
  diversification: DiversificationResult;
  sectorDistribution: Record<string, number>;
} {
  const MAX_PER_SECTOR = 2;
  // MODEL-02 STEP 3: the structure cut is the named, dated const in funnel.ts (was a bare 9 here).
  const TOP_N = STRUCTURE_CUT;
  const adjustments: string[] = [];

  // BUG 4 fix: Enforce convergence gate — exclude tickers with < 3/4 categories above 50
  // BUG 5 fix: Enforce quality floor — exclude quality < 40, or quality 40-50 with 3+ miss streak
  // MODEL-02 addendum: the four rules live in structure-cut.ts (pure, tested).
  // Single names read exactly as before; an ETF_UNIVERSE member is judged on
  // the gates that can score and the quality-null rule does not bar it.
  const eligible: RankedRow[] = [];
  for (const row of rankedRows) {
    const verdict = structureCutEligibility(row, isEtfUniverseSymbol(row.symbol));
    if (!verdict.eligible) {
      adjustments.push(verdict.reason);
      continue;
    }
    if (verdict.note) adjustments.push(verdict.note);
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
