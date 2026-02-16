import { getTastytradeClient } from '@/lib/tastytrade';
import { fetchFinnhubBatch, fetchFredMacro, fetchTTCandlesBatch } from './data-fetchers';
import type { FinnhubData, CandleBatchStats } from './data-fetchers';
import { fetchChainAndBuildCards } from './chain-fetcher';
import type { ChainFetchStats } from './chain-fetcher';
import { computeSectorStats } from './sector-stats';
import type { SectorStatsMap } from './sector-stats';
import { scoreAll } from './composite';
import type { FullScoringResult } from './composite';
import type {
  TTScannerData,
  ConvergenceInput,
  FredMacroData,
  TradeCardData,
} from './types';

// ===== TYPES =====

interface HardFilterStep {
  filter: string;
  passed: number;
  failed: number;
  sample_failed: string[];
}

interface HardFiltersResult {
  input_count: number;
  output_count: number;
  filters_applied: HardFilterStep[];
  survivors: string[];
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
    final_8: string[];
    pipeline_runtime_ms: number;
    finnhub_calls_made: number;
    finnhub_errors: number;
    fred_cached: boolean;
    candle_symbols_fetched: number;
    candle_total_count: number;
    chain_symbols_fetched: number;
    total_trade_cards: number;
    timestamp: string;
  };
  hard_filters: HardFiltersResult;
  sector_stats: SectorStatsMap;
  pre_scores: PreScoreRow[];
  rankings: {
    scored_count: number;
    top_8: RankedRow[];
    also_scored: RankedRow[];
    sector_distribution: Record<string, number>;
  };
  diversification: DiversificationResult;
  scoring_details: Record<string, FullScoringResult>;
  data_gaps: string[];
  errors: string[];
}

// ===== SYMBOL UNIVERSE (same lists as scanner/route.ts) =====

const POPULAR_SYMBOLS = [
  'SPY','QQQ','IWM','AAPL','MSFT','GOOGL','AMZN','TSLA','NVDA','META',
  'AMD','NFLX','JPM','BAC','GS','XOM','CVX','PFE','JNJ','UNH',
  'DIS','BA','COST','HD','LOW','CRM','ORCL','ADBE','INTC','MU',
  'COIN','MARA','SQ','SHOP','SNAP','PLTR','SOFI','RIVN','LCID','NIO',
  'ARM','SMCI','AVGO','MRVL','PANW','CRWD','NET','DKNG','ABNB','UBER',
];

const MEGA_CAP = [
  'AAPL','MSFT','NVDA','GOOGL','AMZN','META','TSLA','BRK.B','AVGO','LLY',
  'JPM','V','WMT','MA','UNH','XOM','COST','HD','PG','JNJ',
  'ORCL','BAC','NFLX','ABBV','CRM','AMD','CVX','MRK','KO','PEP',
];

const ETFS = [
  'SPY','QQQ','IWM','DIA','XLF','XLE','XLK','XLV','XLI','XLP',
  'XLU','XLB','XLRE','XLC','GDX','GDXJ','SLV','GLD','TLT','HYG',
  'EEM','EFA','ARKK','VXX','KWEB',
];

const SECTOR_TECH = [
  'AAPL','MSFT','NVDA','GOOGL','META','AMD','AVGO','CRM','ORCL','ADBE',
  'INTC','MU','QCOM','TXN','AMAT','LRCX','KLAC','SNPS','CDNS','NOW',
  'PANW','CRWD','NET','DDOG','ZS',
];

const SECTOR_FINANCE = [
  'JPM','BAC','GS','MS','WFC','C','BLK','SCHW','AXP','USB',
  'PNC','TFC','COF','ICE','CME','SPGI','MCO','MSCI','FIS','PYPL',
  'SQ','COIN','SOFI','HOOD','AFRM',
];

const SECTOR_ENERGY = [
  'XOM','CVX','COP','EOG','SLB','MPC','PSX','VLO','OXY','PXD',
  'DVN','HES','FANG','HAL','BKR','KMI','WMB','OKE','TRGP','ET',
];

const SECTOR_HEALTHCARE = [
  'UNH','JNJ','LLY','PFE','ABBV','MRK','TMO','ABT','DHR','BMY',
  'AMGN','GILD','VRTX','REGN','ISRG','MDT','SYK','BDX','ZTS','CI',
];

const RETAIL_FAVORITES = [
  'GME','AMC','PLTR','SOFI','RIVN','LCID','NIO','MARA','COIN','HOOD',
  'BBBY','WISH','CLOV','BB','DKNG','RBLX','SNAP','PINS','ABNB','UBER',
];

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

function getAllSymbols(): string[] {
  return [...new Set([
    ...POPULAR_SYMBOLS, ...MEGA_CAP, ...ETFS, ...SECTOR_TECH,
    ...SECTOR_FINANCE, ...SECTOR_ENERGY, ...SECTOR_HEALTHCARE,
    ...RETAIL_FAVORITES, ...DOW_30, ...NASDAQ_100, ...SP500,
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

// ===== MAIN PIPELINE =====

export async function runPipeline(limit: number = 20): Promise<PipelineResult> {
  const pipelineStart = Date.now();
  const errors: string[] = [];
  const dataGaps: string[] = [];

  // ===== STEP A: Fetch TT Scanner (all tickers, batched) =====
  console.log('[Pipeline] Step A: Fetching TT scanner data...');
  let allScannerData: TTScannerData[] = [];
  try {
    const client = getTastytradeClient();
    await client.accountsAndCustomersService.getCustomerResource();

    const allSymbols = getAllSymbols();
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

  // ===== STEP B: Hard Filters =====
  console.log('[Pipeline] Step B: Applying hard filters...');
  const hardFilters = applyHardFilters(allScannerData);
  console.log(`[Pipeline] Step B: ${hardFilters.input_count} → ${hardFilters.output_count} tickers`);

  // Build a map for quick lookup
  const scannerMap = new Map<string, TTScannerData>();
  for (const item of allScannerData) {
    scannerMap.set(item.symbol, item);
  }

  const survivors = hardFilters.survivors.map(s => scannerMap.get(s)!).filter(Boolean);

  // ===== STEP C: Sector Stats =====
  console.log('[Pipeline] Step C: Computing sector stats...');
  const sectorStats = computeSectorStats(survivors);

  // ===== STEP D: Pre-Score and Limit =====
  console.log('[Pipeline] Step D: Pre-scoring and limiting...');
  const preScores = computePreScores(survivors);
  // Overfetch: fetch 2x the desired final count so convergence gate + quality floor
  // exclusions don't leave us short on tickers for the final 8
  const fetchCount = Math.min(limit * 2, preScores.length);
  const topN = preScores.slice(0, fetchCount);
  const topSymbols = topN.map(r => r.symbol);
  console.log(`[Pipeline] Step D: Top ${topSymbols.length} selected for Finnhub fetch (limit=${limit}, fetch=2x)`);

  // ===== STEP E: Fetch Finnhub + FRED =====
  console.log('[Pipeline] Step E: Fetching Finnhub + FRED data...');
  const finnhubStart = Date.now();

  const [finnhubResult, fredResult] = await Promise.all([
    fetchFinnhubBatch(topSymbols, 200),
    fetchFredMacro(),
  ]);

  const finnhubMs = Date.now() - finnhubStart;
  console.log(`[Pipeline] Step E: Finnhub fetched in ${finnhubMs}ms, FRED cached=${fredResult.cached}`);

  if (fredResult.error) {
    errors.push(`Step E (FRED): ${fredResult.error}`);
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
      fredMacro: fredResult.data,
      sectorStats,
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
        fredMacro: fredResult.data,
        sectorStats,
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

  // ===== STEP G: Rank and Diversify =====
  console.log('[Pipeline] Step G: Ranking and diversifying...');
  const { top8, alsoScored, diversification, sectorDistribution } = rankAndDiversify(rankedRows);

  // ===== STEP G2: Fetch chain data and build trade cards =====
  console.log('[Pipeline] Step G2: Fetching option chains and building trade cards...');
  let chainStats: ChainFetchStats = {
    chain_symbols_fetched: 0,
    total_trade_cards: 0,
    streamer_symbols_subscribed: 0,
    greeks_events_received: 0,
    elapsed_ms: 0,
  };

  try {
    // Build input for chain fetcher from top 8 tickers
    const chainInputs = top8.map(row => {
      const ticker = scoredTickers.find(t => t.symbol === row.symbol);
      if (!ticker) return null;

      const s = ticker.scoring;
      const tt = ticker.scannerData;

      // Get currentPrice from technicals (latest close from candle data)
      const latestClose = s.vol_edge.breakdown.technicals.indicators.latest_close;
      if (latestClose == null || latestClose <= 0) return null;

      return {
        symbol: row.symbol,
        suggested_dte: s.strategy_suggestion.suggested_dte,
        direction: s.strategy_suggestion.direction,
        currentPrice: latestClose,
        ivRank: tt.ivRank,
        iv30: tt.iv30 ?? 0.30,
        hv30: tt.hv30 ?? 0.25,
      };
    }).filter((input): input is NonNullable<typeof input> => input !== null);

    if (chainInputs.length > 0) {
      const chainResult = await fetchChainAndBuildCards(chainInputs);
      chainStats = chainResult.stats;

      // Attach trade cards to each ticker's strategy_suggestion
      for (const ticker of scoredTickers) {
        const tickerCards = chainResult.cards.get(ticker.symbol);
        if (tickerCards && tickerCards.length > 0) {
          // Convert StrategyCard to serializable TradeCardData
          const tradeCards: TradeCardData[] = tickerCards.map(card => ({
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

  // ===== STEP H: Assemble Full Result =====
  console.log('[Pipeline] Step H: Assembling result...');

  // Build scoring details for top 8 only
  const scoringDetails: Record<string, FullScoringResult> = {};
  for (const row of top8) {
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
  dataGaps.push('sector_z_scores: computed per-ticker using sector peer stats from hard-filter survivors');

  if (chainStats.chain_symbols_fetched > 0 && chainStats.total_trade_cards === 0) {
    dataGaps.push('trade_cards: option chains fetched but no strategies passed quality gates');
  } else if (chainStats.chain_symbols_fetched === 0 && top8.length > 0) {
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
      final_8: top8.map(r => r.symbol),
      pipeline_runtime_ms: pipelineMs,
      finnhub_calls_made: finnhubResult.stats.calls_made,
      finnhub_errors: finnhubResult.stats.errors,
      fred_cached: fredResult.cached,
      candle_symbols_fetched: candleStats.symbols_with_data,
      candle_total_count: candleStats.total_candles,
      chain_symbols_fetched: chainStats.chain_symbols_fetched,
      total_trade_cards: chainStats.total_trade_cards,
      timestamp: new Date().toISOString(),
    },
    hard_filters: hardFilters,
    sector_stats: sectorStats,
    pre_scores: preScores,
    rankings: {
      scored_count: scoredTickers.length,
      top_8: top8,
      also_scored: alsoScored,
      sector_distribution: sectorDistribution,
    },
    diversification,
    scoring_details: scoringDetails,
    data_gaps: dataGaps,
    errors,
  };

  console.log(`[Pipeline] Complete in ${pipelineMs}ms. Final 8: ${top8.map(r => r.symbol).join(', ')}`);
  return result;
}

// ===== STEP B: Hard Filters =====

function applyHardFilters(tickers: TTScannerData[]): HardFiltersResult {
  const filtersApplied: HardFilterStep[] = [];
  let current = [...tickers];

  // Filter 1: market_cap > $2B
  {
    const passed: TTScannerData[] = [];
    const failed: string[] = [];
    for (const t of current) {
      if (t.marketCap != null && t.marketCap > 2_000_000_000) {
        passed.push(t);
      } else {
        failed.push(t.symbol);
      }
    }
    filtersApplied.push({
      filter: 'market_cap > $2B',
      passed: passed.length,
      failed: failed.length,
      sample_failed: failed.slice(0, 5),
    });
    current = passed;
  }

  // Filter 2: liquidity_rating >= 2
  {
    const passed: TTScannerData[] = [];
    const failed: string[] = [];
    for (const t of current) {
      if (t.liquidityRating != null && t.liquidityRating >= 2) {
        passed.push(t);
      } else {
        failed.push(t.symbol);
      }
    }
    filtersApplied.push({
      filter: 'liquidity_rating >= 2',
      passed: passed.length,
      failed: failed.length,
      sample_failed: failed.slice(0, 5),
    });
    current = passed;
  }

  // Filter 3: iv30 is not null/zero
  {
    const passed: TTScannerData[] = [];
    const failed: string[] = [];
    for (const t of current) {
      if (t.iv30 != null && t.iv30 > 0) {
        passed.push(t);
      } else {
        failed.push(t.symbol);
      }
    }
    filtersApplied.push({
      filter: 'iv30 is not null/zero',
      passed: passed.length,
      failed: failed.length,
      sample_failed: failed.slice(0, 5),
    });
    current = passed;
  }

  // Filter 4: borrow_rate < 50%
  {
    const passed: TTScannerData[] = [];
    const failed: string[] = [];
    for (const t of current) {
      // If borrow_rate is null, assume it's fine (not HTB)
      if (t.borrowRate == null || t.borrowRate < 50) {
        passed.push(t);
      } else {
        failed.push(t.symbol);
      }
    }
    filtersApplied.push({
      filter: 'borrow_rate < 50%',
      passed: passed.length,
      failed: failed.length,
      sample_failed: failed.slice(0, 5),
    });
    current = passed;
  }

  // Filter 5: no earnings within 7 calendar days
  {
    const passed: TTScannerData[] = [];
    const failed: string[] = [];
    for (const t of current) {
      if (t.daysTillEarnings != null && t.daysTillEarnings >= 0 && t.daysTillEarnings <= 7) {
        failed.push(t.symbol);
      } else {
        passed.push(t);
      }
    }
    filtersApplied.push({
      filter: 'no earnings within 7 days',
      passed: passed.length,
      failed: failed.length,
      sample_failed: failed.slice(0, 5),
    });
    current = passed;
  }

  return {
    input_count: tickers.length,
    output_count: current.length,
    filters_applied: filtersApplied,
    survivors: current.map(t => t.symbol),
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
    const beatStreak = s.quality.breakdown.earnings_quality.earnings_detail.streak;

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
  top8: RankedRow[];
  alsoScored: RankedRow[];
  diversification: DiversificationResult;
  sectorDistribution: Record<string, number>;
} {
  const MAX_PER_SECTOR = 2;
  const TOP_N = 8;
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

  // Sector distribution of final 8
  const sectorDistribution: Record<string, number> = {};
  for (const row of final) {
    const sector = row.sector || 'Unknown';
    sectorDistribution[sector] = (sectorDistribution[sector] || 0) + 1;
  }

  return {
    top8: final,
    alsoScored,
    diversification: { adjustments },
    sectorDistribution,
  };
}
