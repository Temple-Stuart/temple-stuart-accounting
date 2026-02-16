import { NextResponse } from 'next/server';

interface EndpointAudit {
  source: 'finnhub' | 'fred' | 'tastytrade';
  endpoint: string;
  description: string;
  status: number | 'error';
  tier: 'free' | 'premium' | 'unknown' | 'no_key';
  dataReturned: boolean;
  responseTimeMs: number;
  sampleFields: string[];
  fieldCount: number;
  rawSample: any;
  notes: string;
  error?: string;
}

interface RateLimitAnalysis {
  finnhub: {
    passingEndpoints: number;
    callsPerTicker: number;
    callsFor8Tickers: number;
    estimatedTimeAt60PerMin: string;
    recommendation: string;
  };
  fred: {
    totalSeries: number;
    callsNeeded: number;
    estimatedTime: string;
    recommendation: string;
  };
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function toUnix(d: Date): number {
  return Math.floor(d.getTime() / 1000);
}

function getFields(obj: any): string[] {
  if (!obj || typeof obj !== 'object') return [];
  if (Array.isArray(obj)) {
    return obj.length > 0 ? getFields(obj[0]) : [];
  }
  return Object.keys(obj);
}

function getSample(data: any): any {
  if (!data) return null;
  if (Array.isArray(data)) {
    return data.length > 0 ? data[0] : null;
  }
  const str = JSON.stringify(data);
  if (str.length > 500) return JSON.parse(str.slice(0, 500) + '..."');
  return data;
}

async function testFinnhubEndpoint(
  url: string,
  description: string,
  checkFn?: (data: any) => { dataReturned: boolean; fieldCount: number; sampleFields: string[]; rawSample: any; notes: string }
): Promise<EndpointAudit> {
  const start = Date.now();
  try {
    const resp = await fetch(url);
    const elapsed = Date.now() - start;
    const status = resp.status;

    if (status === 403 || status === 401) {
      return {
        source: 'finnhub', endpoint: url.split('?')[0].replace('https://finnhub.io/api/v1/', ''),
        description, status, tier: 'premium', dataReturned: false,
        responseTimeMs: elapsed, sampleFields: [], fieldCount: 0, rawSample: null,
        notes: `HTTP ${status} — likely premium-only endpoint`,
      };
    }

    if (!resp.ok) {
      const text = await resp.text();
      return {
        source: 'finnhub', endpoint: url.split('?')[0].replace('https://finnhub.io/api/v1/', ''),
        description, status, tier: 'unknown', dataReturned: false,
        responseTimeMs: elapsed, sampleFields: [], fieldCount: 0,
        rawSample: text.slice(0, 300), notes: `HTTP ${status}`,
      };
    }

    const data = await resp.json();

    // Check for premium indicator in response
    if (data && typeof data === 'object' && (data.error === 'You don\'t have access to this resource.' || data.s === 'no_data')) {
      return {
        source: 'finnhub', endpoint: url.split('?')[0].replace('https://finnhub.io/api/v1/', ''),
        description, status: 200, tier: 'premium', dataReturned: false,
        responseTimeMs: elapsed, sampleFields: getFields(data), fieldCount: 0,
        rawSample: getSample(data), notes: 'Returned 200 but data indicates premium tier required',
      };
    }

    if (checkFn) {
      const result = checkFn(data);
      return {
        source: 'finnhub', endpoint: url.split('?')[0].replace('https://finnhub.io/api/v1/', ''),
        description, status: 200, tier: 'free', dataReturned: result.dataReturned,
        responseTimeMs: elapsed, sampleFields: result.sampleFields, fieldCount: result.fieldCount,
        rawSample: result.rawSample, notes: result.notes,
      };
    }

    const fields = getFields(data);
    const isEmpty = Array.isArray(data) ? data.length === 0 : fields.length === 0;
    return {
      source: 'finnhub', endpoint: url.split('?')[0].replace('https://finnhub.io/api/v1/', ''),
      description, status: 200, tier: isEmpty ? 'premium' : 'free',
      dataReturned: !isEmpty, responseTimeMs: elapsed,
      sampleFields: fields.slice(0, 10), fieldCount: Array.isArray(data) ? data.length : fields.length,
      rawSample: getSample(data), notes: isEmpty ? 'Empty response — may be premium' : 'OK',
    };
  } catch (e: any) {
    return {
      source: 'finnhub', endpoint: url.split('?')[0].replace('https://finnhub.io/api/v1/', ''),
      description, status: 'error', tier: 'unknown', dataReturned: false,
      responseTimeMs: Date.now() - start, sampleFields: [], fieldCount: 0,
      rawSample: null, notes: '', error: e.message,
    };
  }
}

async function testFredEndpoint(
  seriesId: string,
  description: string,
  apiKey: string,
): Promise<EndpointAudit> {
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=5`;
  const start = Date.now();
  try {
    const resp = await fetch(url);
    const elapsed = Date.now() - start;
    if (!resp.ok) {
      const text = await resp.text();
      return {
        source: 'fred', endpoint: seriesId, description,
        status: resp.status, tier: 'unknown', dataReturned: false,
        responseTimeMs: elapsed, sampleFields: [], fieldCount: 0,
        rawSample: text.slice(0, 300), notes: `HTTP ${resp.status}`,
      };
    }
    const data = await resp.json();
    const obs = data?.observations;
    const hasData = Array.isArray(obs) && obs.length > 0;
    return {
      source: 'fred', endpoint: seriesId, description,
      status: 200, tier: 'free', dataReturned: hasData,
      responseTimeMs: elapsed,
      sampleFields: hasData ? Object.keys(obs[0]) : [],
      fieldCount: hasData ? obs.length : 0,
      rawSample: hasData ? obs[0] : null,
      notes: hasData ? `Latest value: ${obs[0].value} (${obs[0].date})` : 'No observations returned',
    };
  } catch (e: any) {
    return {
      source: 'fred', endpoint: seriesId, description,
      status: 'error', tier: 'unknown', dataReturned: false,
      responseTimeMs: Date.now() - start, sampleFields: [], fieldCount: 0,
      rawSample: null, notes: '', error: e.message,
    };
  }
}

export async function GET() {
  const finnhubKey = process.env.FINNHUB_API_KEY;
  const fredKey = process.env.FRED_API_KEY;

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400000);
  const twoHundredDaysAgo = new Date(now.getTime() - 200 * 86400000);
  const unixNow = toUnix(now);
  const unix30 = toUnix(thirtyDaysAgo);
  const unix200 = toUnix(twoHundredDaysAgo);

  // ===== FINNHUB TESTS =====
  const finnhubResults: EndpointAudit[] = [];

  if (!finnhubKey) {
    finnhubResults.push({
      source: 'finnhub', endpoint: 'ALL', description: 'All Finnhub endpoints',
      status: 'error', tier: 'no_key', dataReturned: false, responseTimeMs: 0,
      sampleFields: [], fieldCount: 0, rawSample: null,
      notes: 'FINNHUB_API_KEY not configured',
    });
  } else {
    const base = 'https://finnhub.io/api/v1';
    const tk = finnhubKey;

    // 1. Basic Financials
    finnhubResults.push(await testFinnhubEndpoint(
      `${base}/stock/metric?symbol=AAPL&metric=all&token=${tk}`,
      'Basic Financials — 117 metrics (EPS, P/E, margins, FCF, etc.)',
      (data) => {
        const metric = data?.metric || {};
        const keys = Object.keys(metric);
        return {
          dataReturned: keys.length > 0,
          fieldCount: keys.length,
          sampleFields: keys.slice(0, 10),
          rawSample: Object.fromEntries(keys.slice(0, 5).map(k => [k, metric[k]])),
          notes: `${keys.length} metrics returned`,
        };
      }
    ));
    await delay(100);

    // 2. Company News
    finnhubResults.push(await testFinnhubEndpoint(
      `${base}/company-news?symbol=AAPL&from=${fmtDate(thirtyDaysAgo)}&to=${fmtDate(now)}&token=${tk}`,
      'Company News Headlines',
      (data) => {
        const arr = Array.isArray(data) ? data : [];
        return {
          dataReturned: arr.length > 0,
          fieldCount: arr.length,
          sampleFields: arr.length > 0 ? Object.keys(arr[0]).slice(0, 10) : [],
          rawSample: arr.length > 0 ? { headline: arr[0].headline, source: arr[0].source, datetime: arr[0].datetime } : null,
          notes: `${arr.length} articles returned`,
        };
      }
    ));
    await delay(100);

    // 3. Analyst Recommendations
    finnhubResults.push(await testFinnhubEndpoint(
      `${base}/stock/recommendation?symbol=AAPL&token=${tk}`,
      'Analyst Recommendations (Buy/Hold/Sell)',
      (data) => {
        const arr = Array.isArray(data) ? data : [];
        const latest = arr[0] || {};
        return {
          dataReturned: arr.length > 0,
          fieldCount: arr.length,
          sampleFields: Object.keys(latest).slice(0, 10),
          rawSample: latest,
          notes: arr.length > 0 ? `Latest: ${latest.buy} Buy, ${latest.hold} Hold, ${latest.sell} Sell (${latest.period})` : 'Empty',
        };
      }
    ));
    await delay(100);

    // 4. Price Targets
    finnhubResults.push(await testFinnhubEndpoint(
      `${base}/stock/price-target?symbol=AAPL&token=${tk}`,
      'Analyst Price Targets',
      (data) => {
        const hasData = data && typeof data.targetMean === 'number';
        return {
          dataReturned: !!hasData,
          fieldCount: Object.keys(data || {}).length,
          sampleFields: Object.keys(data || {}).slice(0, 10),
          rawSample: data,
          notes: hasData ? `Mean: $${data.targetMean}, High: $${data.targetHigh}, Low: $${data.targetLow}` : 'No targets',
        };
      }
    ));
    await delay(100);

    // 5. Upgrades/Downgrades
    finnhubResults.push(await testFinnhubEndpoint(
      `${base}/stock/upgrade-downgrade?symbol=AAPL&from=${fmtDate(ninetyDaysAgo)}&to=${fmtDate(now)}&token=${tk}`,
      'Upgrades/Downgrades',
      (data) => {
        const arr = Array.isArray(data) ? data : [];
        return {
          dataReturned: arr.length > 0,
          fieldCount: arr.length,
          sampleFields: arr.length > 0 ? Object.keys(arr[0]).slice(0, 10) : [],
          rawSample: arr.length > 0 ? arr[0] : null,
          notes: `${arr.length} upgrade/downgrade events in last 90 days`,
        };
      }
    ));
    await delay(100);

    // 6. Insider Transactions
    finnhubResults.push(await testFinnhubEndpoint(
      `${base}/stock/insider-transactions?symbol=AAPL&token=${tk}`,
      'Insider Transactions (Form 3,4,5)',
      (data) => {
        const arr = data?.data || [];
        return {
          dataReturned: arr.length > 0,
          fieldCount: arr.length,
          sampleFields: arr.length > 0 ? Object.keys(arr[0]).slice(0, 10) : [],
          rawSample: arr.length > 0 ? arr[0] : null,
          notes: `${arr.length} insider transactions`,
        };
      }
    ));
    await delay(100);

    // 7. Insider Sentiment (may be premium)
    finnhubResults.push(await testFinnhubEndpoint(
      `${base}/stock/insider-sentiment?symbol=AAPL&from=2024-01-01&to=${fmtDate(now)}&token=${tk}`,
      'Insider Sentiment (MSPR)',
      (data) => {
        const arr = data?.data || [];
        const isEmpty = arr.length === 0;
        return {
          dataReturned: !isEmpty,
          fieldCount: arr.length,
          sampleFields: arr.length > 0 ? Object.keys(arr[0]).slice(0, 10) : [],
          rawSample: arr.length > 0 ? arr[0] : data,
          notes: isEmpty ? 'Empty — may be premium' : `${arr.length} monthly sentiment records`,
        };
      }
    ));
    await delay(100);

    // 8. Social Sentiment (may be premium)
    finnhubResults.push(await testFinnhubEndpoint(
      `${base}/stock/social-sentiment?symbol=AAPL&from=2026-02-01&to=${fmtDate(now)}&token=${tk}`,
      'Social Sentiment (Reddit/Twitter)',
      (data) => {
        const reddit = data?.reddit || [];
        const twitter = data?.twitter || [];
        const total = reddit.length + twitter.length;
        return {
          dataReturned: total > 0,
          fieldCount: total,
          sampleFields: reddit.length > 0 ? Object.keys(reddit[0]).slice(0, 10) : twitter.length > 0 ? Object.keys(twitter[0]).slice(0, 10) : [],
          rawSample: reddit.length > 0 ? reddit[0] : twitter.length > 0 ? twitter[0] : data,
          notes: total === 0 ? 'Empty — may be premium' : `Reddit: ${reddit.length}, Twitter: ${twitter.length}`,
        };
      }
    ));
    await delay(100);

    // 9. Earnings Surprises
    finnhubResults.push(await testFinnhubEndpoint(
      `${base}/stock/earnings?symbol=AAPL&token=${tk}`,
      'Earnings Surprises (actual vs estimate)',
      (data) => {
        const arr = Array.isArray(data) ? data : [];
        return {
          dataReturned: arr.length > 0,
          fieldCount: arr.length,
          sampleFields: arr.length > 0 ? Object.keys(arr[0]).slice(0, 10) : [],
          rawSample: arr.length > 0 ? arr[0] : null,
          notes: `${arr.length} earnings records`,
        };
      }
    ));
    await delay(100);

    // 10. EPS Estimates
    finnhubResults.push(await testFinnhubEndpoint(
      `${base}/stock/eps-estimate?symbol=AAPL&freq=quarterly&token=${tk}`,
      'EPS Estimates',
      (data) => {
        const arr = data?.data || [];
        return {
          dataReturned: arr.length > 0,
          fieldCount: arr.length,
          sampleFields: arr.length > 0 ? Object.keys(arr[0]).slice(0, 10) : [],
          rawSample: arr.length > 0 ? arr[0] : data,
          notes: `${arr.length} quarterly EPS estimates`,
        };
      }
    ));
    await delay(100);

    // 11. Revenue Estimates
    finnhubResults.push(await testFinnhubEndpoint(
      `${base}/stock/revenue-estimate?symbol=AAPL&freq=quarterly&token=${tk}`,
      'Revenue Estimates',
      (data) => {
        const arr = data?.data || [];
        return {
          dataReturned: arr.length > 0,
          fieldCount: arr.length,
          sampleFields: arr.length > 0 ? Object.keys(arr[0]).slice(0, 10) : [],
          rawSample: arr.length > 0 ? arr[0] : data,
          notes: `${arr.length} quarterly revenue estimates`,
        };
      }
    ));
    await delay(100);

    // 12. Institutional Ownership (may be premium)
    finnhubResults.push(await testFinnhubEndpoint(
      `${base}/institutional-ownership?symbol=AAPL&token=${tk}`,
      'Institutional Ownership (13F)',
      (data) => {
        const ownership = data?.ownership || data?.ownershipList || [];
        const arr = Array.isArray(ownership) ? ownership : [];
        return {
          dataReturned: arr.length > 0,
          fieldCount: arr.length,
          sampleFields: arr.length > 0 ? Object.keys(arr[0]).slice(0, 10) : getFields(data).slice(0, 10),
          rawSample: arr.length > 0 ? arr[0] : getSample(data),
          notes: arr.length === 0 ? 'Empty — may be premium' : `${arr.length} institutional holders`,
        };
      }
    ));
    await delay(100);

    // 13. Daily OHLCV
    finnhubResults.push(await testFinnhubEndpoint(
      `${base}/stock/candle?symbol=AAPL&resolution=D&from=${unix30}&to=${unixNow}&token=${tk}`,
      'Daily OHLCV Price Data',
      (data) => {
        const hasData = data?.s === 'ok' && Array.isArray(data?.c);
        return {
          dataReturned: !!hasData,
          fieldCount: hasData ? data.c.length : 0,
          sampleFields: Object.keys(data || {}).slice(0, 10),
          rawSample: hasData ? { s: data.s, bars: data.c.length, lastClose: data.c[data.c.length - 1] } : data,
          notes: hasData ? `${data.c.length} trading days of OHLCV` : `Status: ${data?.s || 'unknown'}`,
        };
      }
    ));
    await delay(100);

    // 14. RSI Technical Indicator
    finnhubResults.push(await testFinnhubEndpoint(
      `${base}/indicator?symbol=AAPL&resolution=D&from=${unix200}&to=${unixNow}&indicator=rsi&timeperiod=14&token=${tk}`,
      'RSI Technical Indicator',
      (data) => {
        const rsi = data?.technicalAnalysis?.rsi || data?.rsi;
        const hasData = Array.isArray(rsi) ? rsi.length > 0 : !!rsi;
        return {
          dataReturned: !!hasData,
          fieldCount: Array.isArray(rsi) ? rsi.length : Object.keys(data || {}).length,
          sampleFields: Object.keys(data || {}).slice(0, 10),
          rawSample: getSample(data),
          notes: hasData ? 'RSI data available' : 'No RSI data',
        };
      }
    ));
    await delay(100);

    // 15. MACD Technical Indicator
    finnhubResults.push(await testFinnhubEndpoint(
      `${base}/indicator?symbol=AAPL&resolution=D&from=${unix200}&to=${unixNow}&indicator=macd&fastperiod=12&slowperiod=26&signalperiod=9&token=${tk}`,
      'MACD Technical Indicator',
      (data) => {
        const macd = data?.technicalAnalysis?.macd || data?.macd;
        const hasData = Array.isArray(macd) ? macd.length > 0 : !!macd;
        return {
          dataReturned: !!hasData,
          fieldCount: Array.isArray(macd) ? macd.length : Object.keys(data || {}).length,
          sampleFields: Object.keys(data || {}).slice(0, 10),
          rawSample: getSample(data),
          notes: hasData ? 'MACD data available' : 'No MACD data',
        };
      }
    ));
    await delay(100);

    // 16. Aggregate Technical Signal
    finnhubResults.push(await testFinnhubEndpoint(
      `${base}/scan/technical-indicator?symbol=AAPL&resolution=D&token=${tk}`,
      'Aggregate Technical Indicator Signal',
      (data) => {
        const ta = data?.technicalAnalysis;
        const hasData = !!ta && typeof ta === 'object';
        return {
          dataReturned: !!hasData,
          fieldCount: hasData ? Object.keys(ta).length : 0,
          sampleFields: hasData ? Object.keys(ta).slice(0, 10) : Object.keys(data || {}).slice(0, 10),
          rawSample: hasData ? ta : getSample(data),
          notes: hasData ? `Signal counts available: ${JSON.stringify(ta).slice(0, 200)}` : 'No signal data',
        };
      }
    ));
  }

  // ===== FRED TESTS =====
  const fredResults: EndpointAudit[] = [];

  const fredSeries: { id: string; desc: string }[] = [
    { id: 'VIXCLS', desc: 'VIX (CBOE Volatility Index)' },
    { id: 'DGS10', desc: '10-Year Treasury Yield' },
    { id: 'FEDFUNDS', desc: 'Federal Funds Rate' },
    { id: 'UNRATE', desc: 'Unemployment Rate' },
    { id: 'CPIAUCSL', desc: 'CPI (Consumer Price Index)' },
    { id: 'GDP', desc: 'GDP' },
    { id: 'UMCSENT', desc: 'Consumer Confidence (U of Michigan)' },
    { id: 'PAYEMS', desc: 'Nonfarm Payrolls' },
    { id: 'SOFR', desc: 'SOFR Rate' },
  ];

  if (!fredKey) {
    for (const s of fredSeries) {
      fredResults.push({
        source: 'fred', endpoint: s.id, description: s.desc,
        status: 'error', tier: 'no_key', dataReturned: false, responseTimeMs: 0,
        sampleFields: [], fieldCount: 0, rawSample: null,
        notes: 'FRED_API_KEY not configured. User needs to add it.',
      });
    }
  } else {
    for (const s of fredSeries) {
      fredResults.push(await testFredEndpoint(s.id, s.desc, fredKey));
      await delay(100);
    }
  }

  // ===== TASTYTRADE SCANNER FIELD VALIDATION =====
  const ttRequiredFields = [
    'peRatio', 'hv30', 'hv60', 'hv90', 'iv30', 'ivHvSpread',
    'beta', 'corrSpy', 'marketCap', 'sector', 'industry',
    'dividendYield', 'lendability', 'borrowRate', 'termStructure',
    'earningsDate', 'liquidityRating',
  ];
  let ttPresent: string[] = [];
  let ttMissing: string[] = [];
  let ttTermStructureAvailable = false;
  let ttTermStructureExpirationCount = 0;

  try {
    // Call our own scanner API — use the internal base URL
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const host = process.env.VERCEL_URL || process.env.NEXTAUTH_URL?.replace(/https?:\/\//, '') || 'localhost:3000';
    const scanUrl = `${protocol}://${host}/api/tastytrade/scanner?universe=popular`;
    const scanResp = await fetch(scanUrl, {
      headers: { Cookie: 'userEmail=astuart@templestuart.com' },
    });

    if (scanResp.ok) {
      const scanData = await scanResp.json();
      const tickers = scanData?.metrics || [];
      if (tickers.length > 0) {
        const sample = tickers[0];
        for (const field of ttRequiredFields) {
          if (sample[field] !== undefined && sample[field] !== null) {
            ttPresent.push(field);
          } else {
            ttMissing.push(field);
          }
        }
        if (Array.isArray(sample.termStructure) && sample.termStructure.length > 0) {
          ttTermStructureAvailable = true;
          ttTermStructureExpirationCount = sample.termStructure.length;
        }
      }
    } else {
      ttMissing = ttRequiredFields;
    }
  } catch (e: any) {
    ttMissing = ttRequiredFields;
    console.error('[Data Audit] TT scanner test error:', e.message);
  }

  // ===== RATE LIMIT ANALYSIS =====
  const passingFinnhub = finnhubResults.filter(r => r.dataReturned && r.tier === 'free').length;
  const rateLimits: RateLimitAnalysis = {
    finnhub: {
      passingEndpoints: passingFinnhub,
      callsPerTicker: passingFinnhub,
      callsFor8Tickers: passingFinnhub * 8,
      estimatedTimeAt60PerMin: `${Math.ceil((passingFinnhub * 8) / 60)} minutes`,
      recommendation: passingFinnhub <= 10
        ? `${passingFinnhub} calls/ticker × 8 tickers = ${passingFinnhub * 8} calls. At 60/min, completes in ~${Math.ceil((passingFinnhub * 8) / 60)} min. Batch with 1s delays.`
        : `${passingFinnhub} calls/ticker is high. Consider trimming to essential endpoints or caching aggressively.`,
    },
    fred: {
      totalSeries: fredSeries.length,
      callsNeeded: fredSeries.length,
      estimatedTime: `${Math.ceil(fredSeries.length / 60)} minutes`,
      recommendation: 'Cache for 1 hour — macro data updates daily at most. Single batch on page load.',
    },
  };

  // ===== SUMMARY =====
  const allResults = [...finnhubResults, ...fredResults];
  const passing = allResults.filter(r => r.status === 200 && r.dataReturned).length;
  const premium = allResults.filter(r => r.tier === 'premium').length;
  const noKey = allResults.filter(r => r.tier === 'no_key').length;
  const failing = allResults.length - passing - premium - noKey;

  const readyToBuild = allResults.filter(r => r.dataReturned && r.tier === 'free').map(r => `${r.source}/${r.endpoint}: ${r.description}`);
  const premiumBlocked = allResults.filter(r => r.tier === 'premium').map(r => `${r.source}/${r.endpoint}: ${r.description}`);
  const needsKey = allResults.filter(r => r.tier === 'no_key').map(r => `${r.source}/${r.endpoint}: ${r.description}`);
  const needsInvestigation = allResults.filter(r => r.tier === 'unknown' || (r.status !== 200 && r.tier !== 'premium' && r.tier !== 'no_key')).map(r => `${r.source}/${r.endpoint}: ${r.description} (${r.error || r.notes})`);

  return NextResponse.json({
    timestamp: now.toISOString(),
    testTicker: 'AAPL',

    summary: {
      totalEndpoints: allResults.length,
      passing,
      premium,
      failing,
      noKey,
      passRate: `${passing}/${allResults.length} (${Math.round(passing / allResults.length * 100)}%)`,
    },

    finnhub: {
      keyPresent: !!finnhubKey,
      results: finnhubResults,
    },

    fred: {
      keyPresent: !!fredKey,
      results: fredResults,
    },

    tastytrade: {
      scannerFieldsPresent: ttPresent,
      scannerFieldsMissing: ttMissing,
      termStructureAvailable: ttTermStructureAvailable,
      termStructureExpirationCount: ttTermStructureExpirationCount,
    },

    rateLimits,

    readyToBuild,
    premiumBlocked,
    needsKey,
    needsInvestigation,
  });
}
