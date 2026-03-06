import { getTastytradeClient } from '@/lib/tastytrade';
import { fetchFinnhubBatch, fetchFredMacro, fetchFredDailySeries, fetchTTCandlesBatch, fetchAnnualFinancials, fetchNewsSentiment, fetchFinnhubNewsSentiment, fetchFinnhubEarningsQuality, fetchFinnhubInstitutionalOwnership, fetchFinnhubRevenueBreakdown, fetchQuarterlyFinancials, fetchSECFilingData, fetchInsiderTransactions, fetchPeerTickers, fetch10KBusinessDescription } from './data-fetchers';
import { computeCrossAssetCorrelations } from './cross-asset';
import type { CrossAssetCorrelations } from './types';
import type { FinnhubData, CandleBatchStats } from './data-fetchers';
import { fetchChainAndBuildCards, isMarketOpen } from './chain-fetcher';
import type { ChainFetchStats, ChainFetchResult } from './chain-fetcher';
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

interface HardFiltersResult {
  input_count: number;
  output_count: number;
  filters_applied: HardFilterStep[];
  survivors: string[];
  ticker_rejections: Record<string, HardFilterRejection>;
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

  // ===== STEP A: Fetch TT Scanner (all tickers, batched) =====
  console.log('[Pipeline] Step A: Fetching TT scanner data...');
  let allScannerData: TTScannerData[] = [];
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
    allScannerData = parseMarketMetrics(items);
    console.log(`[Pipeline] Step A: Got ${allScannerData.length} tickers from TT scanner`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(`Step A (TT Scanner): ${msg}`);
    console.error('[Pipeline] Step A failed:', msg);
  }

  const totalUniverse = allScannerData.length;
  onProgress?.({ step: 'a', label: 'TT Scanner', data: { total_universe: allScannerData.length, market_open: isMarketOpen().open, symbols: allScannerData.map(d => ({ symbol: d.symbol, ivRank: d.ivRank, ivPercentile: d.ivPercentile, iv30: d.iv30, hv30: d.hv30, hv60: d.hv60, hv90: d.hv90, liquidityRating: d.liquidityRating, earningsDate: d.earningsDate, daysTillEarnings: d.daysTillEarnings, borrowRate: d.borrowRate, lendability: d.lendability, marketCap: d.marketCap, beta: d.beta, corrSpy: d.corrSpy, sector: d.sector })) } });

  // ===== STEP A2: Pre-Filter (market-metrics-based ranking) =====
  console.log('[Pipeline] Step A2: Running market-metrics pre-filter...');
  const preFilterResults = computePreFilter(allScannerData);
  const preFilterIncluded = preFilterResults.filter(r => !r.excluded);
  const preFilterExcluded = preFilterResults.filter(r => r.excluded);
  console.log(`[Pipeline] Step A2: ${preFilterIncluded.length} included, ${preFilterExcluded.length} excluded by pre-filter`);

  // Use pre-filter to narrow the candidate set: take top (limit * 4) non-excluded
  // tickers by preScore. This reduces the universe BEFORE hard filters + Finnhub.
  const preFilterTopN = Math.min(limit * 4, preFilterIncluded.length);
  const preFilterCandidates = new Set(
    preFilterIncluded.slice(0, preFilterTopN).map(r => r.symbol)
  );
  const preFilteredScannerData = allScannerData.filter(t => preFilterCandidates.has(t.symbol));
  console.log(`[Pipeline] Step A2: Narrowed ${allScannerData.length} → ${preFilteredScannerData.length} by preScore (top ${preFilterTopN})`);
  onProgress?.({ step: 'a2', label: 'Pre-Filter', data: {
    input: allScannerData.length,
    output: preFilterIncluded.length,
    excluded: preFilterExcluded.length,
    tickers: preFilterResults.map(r => ({
      symbol: r.symbol,
      pre_score: Math.round(r.preScore * 100),
      iv_rank: r.ivRank,
      iv_percentile: r.ivPercentile,
      liquidity: r.liquidityRating,
      market_cap: r.marketCap,
      beta: r.beta,
      earnings_date: r.earningsDate,
      earnings_warning: r.earningsWarning,
      excluded: r.excluded,
      exclusion_reason: r.exclusionReason,
      reason: r.excluded
        ? (r.exclusionReason ?? 'Liquidity < 2/5 — not enough options trading activity to get reliable prices')
        : r.earningsWarning
        ? `⚠ Warning: ${r.earningsWarning} — earnings risk`
        : 'Passed — enough liquidity and no earnings risk',
    })),
  } });

  // ===== STEP B: Hard Filters =====
  console.log('[Pipeline] Step B: Applying hard filters...');
  const hardFilters = applyHardFilters(preFilteredScannerData);
  console.log(`[Pipeline] Step B: ${hardFilters.input_count} → ${hardFilters.output_count} tickers`);
  onProgress?.({ step: 'b', label: 'Hard Filters', data: { input: hardFilters.input_count, output: hardFilters.output_count, filters: hardFilters.filters_applied, survivors: hardFilters.survivors, ticker_rejections: hardFilters.ticker_rejections } });

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
  onProgress?.({ step: 'c', label: 'Peer Grouping', data: {
    groups: survivors.map(s => {
      const groupKey = peerGroupAssignment[s.symbol];
      const ps = groupKey ? peerStats[groupKey] : undefined;
      return {
        symbol: s.symbol,
        peer_group: ps?.peer_group_name ?? 'No peer group found',
        peer_count: ps?.ticker_count ?? 0,
        group_type: ps?.peer_group_type ?? 'unknown',
        group_key: groupKey ?? null,
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
  onProgress?.({ step: 'd', label: 'Pre-Score', data: {
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

  // ===== STEP E: Fetch Finnhub + FRED =====
  console.log('[Pipeline] Step E: Fetching Finnhub + FRED data...');
  const finnhubStart = Date.now();

  const [finnhubResult, fredResult, fredDailyResult] = await Promise.all([
    fetchFinnhubBatch(topSymbols, 200),
    fetchFredMacro(),
    fetchFredDailySeries(),
  ]);

  const finnhubMs = Date.now() - finnhubStart;
  console.log(`[Pipeline] Step E: Finnhub fetched in ${finnhubMs}ms, FRED cached=${fredResult.cached}, FRED daily cached=${fredDailyResult.cached}`);

  if (fredResult.error) {
    errors.push(`Step E (FRED): ${fredResult.error}`);
  }
  if (fredDailyResult.error) {
    errors.push(`Step E (FRED daily): ${fredDailyResult.error}`);
  }

  // Compute cross-asset correlations from daily FRED history (shared across all tickers)
  const crossAssetCorrelations: CrossAssetCorrelations | null = computeCrossAssetCorrelations(fredDailyResult.data);

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

  // Options flow: Finnhub /stock/option-chain does not exist in their API.
  // Scoring handles null optionsFlow gracefully (imputes neutral values).
  // Real chain data comes from TastyTrade in Step G2.
  const optionsFlowMap = new Map<string, OptionsFlowData | null>();
  for (const symbol of topSymbols) {
    optionsFlowMap.set(symbol, null);
  }

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
  ]);
  console.log('[Pipeline] Steps E3-E11: All enrichment data fetched');
  onProgress?.({
    step: 'e',
    label: 'Data Enrichment',
    data: {
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
          earnings_quality: earningsQuality ? 'available' : 'missing',
          pe_ratio: (fh?.fundamentals?.metric?.['peBasicExclExtraTTM'] as number) ?? null,
          market_cap: (fh?.fundamentals?.metric?.['marketCapitalization'] as number) ?? null,
        };
      }),
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

  try {
    const candleResult = await fetchTTCandlesBatch(scoredSymbols, 90);
    candleStats = candleResult.stats;

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

    console.log(`[Pipeline] Step F2: Fetched candles for ${candleStats.symbols_with_data}/${scoredSymbols.length} symbols (${candleStats.total_candles} candles) in ${candleStats.elapsed_ms}ms, re-scored ${reScored}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(`Step F2 (candle fetch): ${msg}`);
    console.error('[Pipeline] Step F2 failed:', msg);
  }

  // Build ranked rows
  const rankedRows = buildRankedRows(scoredTickers);
  const _gwt = scoredTickers[0]?.scoring?.composite?.gate_weight_trace;
  const _gw = _gwt?.gate_weights;
  onProgress?.({ step: 'f', label: '4-Gate Scoring', data: {
    scored: scoredTickers.length,
    regime: _gwt?.regime_used ?? 'UNKNOWN',
    weights: {
      vol_edge: Math.round((_gw?.vol_edge ?? 0.25) * 100),
      quality: Math.round((_gw?.quality ?? 0.25) * 100),
      regime: Math.round((_gw?.regime ?? 0.25) * 100),
      info_edge: Math.round((_gw?.info_edge ?? 0.25) * 100),
    },
    rankings: rankedRows.map(r => ({ symbol: r.symbol, composite: r.composite, vol_edge: r.vol_edge, quality: r.quality, regime: r.regime, info_edge: r.info_edge, selection_status: r.composite >= 50 ? 'eligible' : 'below_threshold' })),
  } });

  // ===== STEP G: Rank and Diversify =====
  console.log('[Pipeline] Step G: Ranking and diversifying...');
  const { top9, alsoScored, diversification, sectorDistribution } = rankAndDiversify(rankedRows);

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

      // Risk-free rate from FRED FEDFUNDS series, converted to decimal. Fallback: 0.045
      const fedFundsRate = fredResult.data.fedFunds != null
        ? fredResult.data.fedFunds / 100
        : undefined;

      return {
        symbol: row.symbol,
        suggested_dte: s.strategy_suggestion.suggested_dte,
        direction: s.strategy_suggestion.direction,
        currentPrice: latestClose,
        ivRank: (s.vol_edge.breakdown.mispricing.inputs.IV_percentile as number ?? 50) / 100,
        iv30: tt.iv30 ?? 0.30,
        hv30: tt.hv30 ?? 0.25,
        riskFreeRate: fedFundsRate,
      };
    }).filter((input): input is NonNullable<typeof input> => input !== null);

    if (chainInputs.length > 0) {
      const chainResult = await fetchChainAndBuildCards(chainInputs);
      chainStats = chainResult.stats;
      chainRejections = chainResult.rejections;
      chainMarketOpen = chainResult.marketOpen;
      chainMarketNote = chainResult.marketNote;

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

  onProgress?.({ step: 'g', label: 'Trade Cards', data: { trade_cards: chainStats.total_trade_cards, top_9: top9.map(r => r.symbol), rejections: Object.fromEntries(chainRejections) } });

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

function applyHardFilters(tickers: TTScannerData[]): HardFiltersResult {
  const filtersApplied: HardFilterStep[] = [];
  const tickerRejections = new Map<string, HardFilterRejection>();
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
      // If borrow_rate is null, assume it's fine (not HTB)
      if (t.borrowRate == null || t.borrowRate < 50) {
        passed.push(t);
      } else {
        failedTickers.push(t);
      }
    }
    for (const t of failedTickers) {
      tickerRejections.set(t.symbol, {
        filter: 'Borrow Rate',
        actual_value: `${t.borrowRate ?? 0}%`,
        threshold: '< 50%',
        reason: `Borrow rate ${t.borrowRate ?? 0}% is too high. Hard-to-borrow stocks have unpredictable short squeeze risk that breaks option pricing models.`,
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

  return {
    input_count: tickers.length,
    output_count: current.length,
    filters_applied: filtersApplied,
    survivors: current.map(t => t.symbol),
    ticker_rejections: Object.fromEntries(tickerRejections),
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

    // pre_score = 0.40 * (IVP * 100) + 0.30 * min(IV_HV_spread / 20 * 100, 100) + 0.30 * (liquidity_rating / 5 * 100)
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
