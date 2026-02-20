import { NextResponse } from 'next/server';
import { getAuthenticatedClient } from '@/lib/tastytrade';
import { getCurrentUser } from '@/lib/auth-helpers';

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

type Universe =
  | 'popular' | 'megacap' | 'nasdaq100' | 'dow30' | 'sp500'
  | 'etfs'
  | 'sector_tech' | 'sector_finance' | 'sector_energy' | 'sector_healthcare' | 'retail_favorites'
  | 'custom';

function getSymbolsForUniverse(universe: Universe, customSymbols?: string): string[] {
  switch (universe) {
    case 'megacap': return MEGA_CAP;
    case 'nasdaq100': return NASDAQ_100;
    case 'dow30': return DOW_30;
    case 'sp500': return SP500;
    case 'etfs': return ETFS;
    case 'sector_tech': return SECTOR_TECH;
    case 'sector_finance': return SECTOR_FINANCE;
    case 'sector_energy': return SECTOR_ENERGY;
    case 'sector_healthcare': return SECTOR_HEALTHCARE;
    case 'retail_favorites': return RETAIL_FAVORITES;
    case 'custom':
      return customSymbols
        ? customSymbols.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
        : POPULAR_SYMBOLS;
    default: return POPULAR_SYMBOLS;
  }
}

const BATCH_SIZE = 50;

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const client = await getAuthenticatedClient(user.id);
    if (!client) {
      return NextResponse.json({ error: 'Not connected' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const universe = (searchParams.get('universe') || 'popular') as Universe;
    const customSymbols = searchParams.get('customSymbols') || undefined;

    const symbols = getSymbolsForUniverse(universe, customSymbols);
    const totalSymbols = symbols.length;

    // Batch symbols into chunks of 50 and fetch concurrently
    const batches: string[][] = [];
    for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
      batches.push(symbols.slice(i, i + BATCH_SIZE));
    }

    const batchResults = await Promise.all(
      batches.map(async (batch) => {
        try {
          const raw = await client.marketMetricsService.getMarketMetrics({
            symbols: batch.join(','),
          });
          return Array.isArray(raw) ? raw : [];
        } catch (err) {
          console.error('[Scanner] Batch error:', err);
          return [];
        }
      })
    );

    const items = batchResults.flat();

    const metrics = items.map((m: any) => {
      const earningsDate = m['earnings']?.['expected-report-date'] || m['next-earnings-date'] || null;
      let daysTillEarnings: number | null = null;
      if (earningsDate) {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const ed = new Date(earningsDate + 'T00:00:00');
        daysTillEarnings = Math.round((ed.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      }

      return {
        // Existing
        symbol: m['symbol'] || '',
        ivRank: Number(m['implied-volatility-index-rank'] || m['tos-implied-volatility-index-rank'] || m['tw-implied-volatility-index-rank'] || 0),
        ivPercentile: Number(m['implied-volatility-percentile'] || 0),
        impliedVolatility: Number(m['implied-volatility-index'] || 0),
        liquidityRating: m['liquidity-rating'] != null ? Number(m['liquidity-rating']) : null,
        earningsDate,
        daysTillEarnings,

        // Volatility
        hv30: parseFloat(m['historical-volatility-30-day']) || null,
        hv60: parseFloat(m['historical-volatility-60-day']) || null,
        hv90: parseFloat(m['historical-volatility-90-day']) || null,
        iv30: parseFloat(m['implied-volatility-30-day']) || null,
        ivHvSpread: parseFloat(m['iv-hv-30-day-difference']) || null,

        // Market Context
        beta: parseFloat(m['beta']) || null,
        corrSpy: parseFloat(m['corr-spy-3month']) || null,
        marketCap: m['market-cap'] || null,
        sector: m['sector'] || null,
        industry: m['industry'] || null,

        // Fundamentals
        peRatio: parseFloat(m['price-earnings-ratio']) || null,
        eps: parseFloat(m['earnings-per-share']) || null,
        dividendYield: parseFloat(m['dividend-yield']) || null,
        lendability: m['lendability'] || null,
        borrowRate: parseFloat(m['borrow-rate']) || null,

        // Earnings Detail
        earningsActualEps: m['earnings']?.['actual-eps'] ? parseFloat(m['earnings']['actual-eps']) : null,
        earningsEstimate: m['earnings']?.['consensus-estimate'] ? parseFloat(m['earnings']['consensus-estimate']) : null,
        earningsTimeOfDay: m['earnings']?.['time-of-day'] || null,

        // Term Structure
        termStructure: (m['option-expiration-implied-volatilities'] || [])
          .filter((e: any) => e['implied-volatility'])
          .map((e: any) => ({
            date: e['expiration-date'],
            iv: parseFloat(e['implied-volatility']),
          })),
      };
    }).filter((m: any) => m.symbol);

    // Sort by IV Rank descending
    metrics.sort((a, b) => b.ivRank - a.ivRank);

    return NextResponse.json({
      metrics,
      totalScanned: totalSymbols,
      universe,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Tastytrade] Scanner error:', error);
    return NextResponse.json({ error: 'Failed to fetch scanner data' }, { status: 500 });
  }
}
