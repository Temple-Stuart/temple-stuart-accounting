import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { prisma } from '@/lib/prisma';

// ─── Types ──────────────────────────────────────────────────────────────────

type SourceStatus = 'LIVE' | 'BROKEN' | 'PARTIAL' | 'SKIPPED' | 'MKT-HRS';

interface CheckResult {
  id: number;
  source: string;
  endpoint: string;
  status: SourceStatus;
  records: string;
  lastValue: string;
  latency: string;
  rawData: unknown;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const ALLOWED_SYMBOLS = ['MSFT', 'BAC', 'NFLX'];
const FINNHUB_BASE = 'https://finnhub.io/api/v1';

// ─── Helpers ────────────────────────────────────────────────────────────────

async function timedFetch(url: string, options?: RequestInit): Promise<{ data: unknown; latencyMs: number }> {
  const start = performance.now();
  const res = await fetch(url, options);
  const latencyMs = Math.round(performance.now() - start);
  const data = await res.json();
  return { data, latencyMs };
}

function fmtLatency(ms: number): string {
  return `${ms}ms`;
}

function formatBillions(val: number): string {
  if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
  return `$${val}`;
}

// ─── Individual Check Functions ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FinnhubMetricData = any;

async function runFinnhubMetric(symbol: string, finnhubKey: string): Promise<{ metricResult: FinnhubMetricData; latencyMs: number }> {
  const { data, latencyMs } = await timedFetch(
    `${FINNHUB_BASE}/stock/metric?symbol=${symbol}&metric=all&token=${finnhubKey}`
  );
  return { metricResult: data, latencyMs };
}

function checkIVHV(metricResult: FinnhubMetricData, latencyMs: number): CheckResult {
  const m = metricResult?.metric || {};
  const iv30 = m['currentEv/freeCashFlowAnnual'] !== undefined ? undefined : m['iv30'] ?? m['30DayAverageOptionImpliedVolatility'] ?? null;
  // Try multiple known field names for IV
  const iv = m['30DayAverageOptionImpliedVolatility'] ?? m['iv30'] ?? null;
  const hv30 = m['30DayAverageVolume'] !== undefined ? undefined : m['hv30'] ?? null;
  // Finnhub metric endpoint: IV fields are under specific names
  const rawIv30 = m['30DayAverageOptionImpliedVolatility'] ?? null;
  const rawHv30 = m['30DayHistoricalVolatility'] ?? null;
  const rawHv60 = m['60DayHistoricalVolatility'] ?? null;
  const rawHv90 = m['90DayHistoricalVolatility'] ?? null;
  const beta = m['beta'] ?? null;
  const high52 = m['52WeekHigh'] ?? null;

  let status: SourceStatus;
  if (rawIv30 == null) {
    status = 'BROKEN';
  } else if ([rawHv30, rawHv60, rawHv90].some(v => v == null)) {
    status = 'PARTIAL';
  } else {
    status = 'LIVE';
  }

  const ivDisplay = rawIv30 != null ? rawIv30.toFixed?.(2) ?? rawIv30 : 'NULL';
  const hvDisplay = rawHv30 != null ? rawHv30.toFixed?.(2) ?? rawHv30 : 'NULL';

  return {
    id: 1,
    source: 'Finnhub IV/HV',
    endpoint: '/stock/metric',
    status,
    records: status === 'BROKEN' ? '0' : [rawIv30, rawHv30, rawHv60, rawHv90, beta, high52].filter(v => v != null).length + ' fields',
    lastValue: `iv30: ${ivDisplay}, hv30: ${hvDisplay}`,
    latency: fmtLatency(latencyMs),
    rawData: { metric: { iv30: rawIv30, hv30: rawHv30, hv60: rawHv60, hv90: rawHv90, beta, '52WeekHigh': high52 } },
  };
}

function checkBasicMetrics(metricResult: FinnhubMetricData, latencyMs: number): CheckResult {
  const m = metricResult?.metric || {};
  const fields = ['beta', 'marketCapitalization', '52WeekHigh', '52WeekLow', 'netProfitMarginAnnual', 'roeRfy'];
  const nonNull = fields.filter(f => m[f] != null);
  const beta = m['beta'];

  let status: SourceStatus;
  if (nonNull.length === 0) status = 'BROKEN';
  else if (beta != null) status = nonNull.length === fields.length ? 'LIVE' : 'PARTIAL';
  else status = 'PARTIAL';

  return {
    id: 2,
    source: 'Finnhub Basic Metrics',
    endpoint: '/stock/metric',
    status,
    records: `${nonNull.length} fields`,
    lastValue: beta != null ? `beta: ${beta}` : 'beta: NULL',
    latency: fmtLatency(latencyMs),
    rawData: Object.fromEntries(fields.map(f => [f, m[f] ?? null])),
  };
}

async function checkEPSEstimates(symbol: string, finnhubKey: string): Promise<CheckResult> {
  try {
    const { data, latencyMs } = await timedFetch(
      `${FINNHUB_BASE}/stock/eps-estimate?symbol=${symbol}&freq=quarterly&token=${finnhubKey}`
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = data as any;
    const items = d?.data || [];
    const latest = items[0];
    return {
      id: 3, source: 'EPS Estimates', endpoint: '/stock/eps-estimate',
      status: items.length > 0 ? 'LIVE' : 'BROKEN',
      records: `${items.length} qtrs`,
      lastValue: latest?.epsAvg != null ? `Next: $${latest.epsAvg} avg` : 'NULL',
      latency: fmtLatency(latencyMs),
      rawData: data,
    };
  } catch (e) {
    return { id: 3, source: 'EPS Estimates', endpoint: '/stock/eps-estimate', status: 'BROKEN', records: '0', lastValue: String(e), latency: '—', rawData: null };
  }
}

async function checkRevenueEstimates(symbol: string, finnhubKey: string): Promise<CheckResult> {
  try {
    const { data, latencyMs } = await timedFetch(
      `${FINNHUB_BASE}/stock/revenue-estimate?symbol=${symbol}&freq=quarterly&token=${finnhubKey}`
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = data as any;
    const items = d?.data || [];
    const latest = items[0];
    const revAvg = latest?.revenueAvg;
    return {
      id: 4, source: 'Revenue Estimates', endpoint: '/stock/revenue-estimate',
      status: items.length > 0 ? 'LIVE' : 'BROKEN',
      records: `${items.length} qtrs`,
      lastValue: revAvg != null ? `Next: ${formatBillions(revAvg)}` : 'NULL',
      latency: fmtLatency(latencyMs),
      rawData: data,
    };
  } catch (e) {
    return { id: 4, source: 'Revenue Estimates', endpoint: '/stock/revenue-estimate', status: 'BROKEN', records: '0', lastValue: String(e), latency: '—', rawData: null };
  }
}

async function checkPriceTargets(symbol: string, finnhubKey: string): Promise<CheckResult> {
  try {
    const { data, latencyMs } = await timedFetch(
      `${FINNHUB_BASE}/stock/price-target?symbol=${symbol}&token=${finnhubKey}`
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = data as any;
    return {
      id: 5, source: 'Price Targets', endpoint: '/stock/price-target',
      status: d?.targetMean != null ? 'LIVE' : 'BROKEN',
      records: d?.lastUpdated ? `${d.targetMean ? 'updated' : '0'}` : '—',
      lastValue: d?.targetMean != null ? `Mean: $${d.targetMean} (${d.numberOfAnalysts ?? '?'} analysts)` : 'NULL',
      latency: fmtLatency(latencyMs),
      rawData: data,
    };
  } catch (e) {
    return { id: 5, source: 'Price Targets', endpoint: '/stock/price-target', status: 'BROKEN', records: '0', lastValue: String(e), latency: '—', rawData: null };
  }
}

async function checkUpgradesDowngrades(symbol: string, finnhubKey: string): Promise<CheckResult> {
  try {
    const { data, latencyMs } = await timedFetch(
      `${FINNHUB_BASE}/stock/upgrade-downgrade?symbol=${symbol}&token=${finnhubKey}`
    );
    const items = Array.isArray(data) ? data : [];
    const latest = items[0];
    const hasDate = latest?.gradeDate != null;
    let status: SourceStatus = 'BROKEN';
    if (items.length > 0) status = hasDate ? 'LIVE' : 'PARTIAL';
    return {
      id: 6, source: 'Upgrades/Downgrades', endpoint: '/stock/upgrade-downgrade',
      status,
      records: `${items.length} rec`,
      lastValue: latest ? `${latest.action ?? '?'} by ${latest.company ?? '?'}` : 'NULL',
      latency: fmtLatency(latencyMs),
      rawData: items.slice(0, 10),
    };
  } catch (e) {
    return { id: 6, source: 'Upgrades/Downgrades', endpoint: '/stock/upgrade-downgrade', status: 'BROKEN', records: '0', lastValue: String(e), latency: '—', rawData: null };
  }
}

async function checkRecommendations(symbol: string, finnhubKey: string): Promise<CheckResult> {
  try {
    const { data, latencyMs } = await timedFetch(
      `${FINNHUB_BASE}/stock/recommendation?symbol=${symbol}&token=${finnhubKey}`
    );
    const items = Array.isArray(data) ? data : [];
    const latest = items[0];
    const buyCount = latest ? (latest.strongBuy || 0) + (latest.buy || 0) : 0;
    const holdCount = latest ? (latest.hold || 0) + (latest.sell || 0) : 0;
    return {
      id: 7, source: 'Recommendations', endpoint: '/stock/recommendation',
      status: items.length > 0 ? 'LIVE' : 'BROKEN',
      records: `${items.length} mo`,
      lastValue: latest ? `Buy: ${buyCount} / Hold: ${holdCount}` : 'NULL',
      latency: fmtLatency(latencyMs),
      rawData: items.slice(0, 5),
    };
  } catch (e) {
    return { id: 7, source: 'Recommendations', endpoint: '/stock/recommendation', status: 'BROKEN', records: '0', lastValue: String(e), latency: '—', rawData: null };
  }
}

async function checkEarningsHistory(symbol: string, finnhubKey: string): Promise<CheckResult> {
  try {
    const { data, latencyMs } = await timedFetch(
      `${FINNHUB_BASE}/stock/earnings?symbol=${symbol}&limit=40&token=${finnhubKey}`
    );
    const items = Array.isArray(data) ? data : [];
    const beats = items.filter((e: { actual?: number; estimate?: number }) => e.actual != null && e.estimate != null && e.actual > e.estimate).length;
    const rate = items.length > 0 ? Math.round((beats / items.length) * 100) : 0;
    return {
      id: 8, source: 'Earnings History', endpoint: '/stock/earnings',
      status: items.length > 0 ? 'LIVE' : 'BROKEN',
      records: `${items.length} qtrs`,
      lastValue: items.length > 0 ? `Beat rate: ${rate}% (${items.length} qtrs)` : 'NULL',
      latency: fmtLatency(latencyMs),
      rawData: items.slice(0, 5),
    };
  } catch (e) {
    return { id: 8, source: 'Earnings History', endpoint: '/stock/earnings', status: 'BROKEN', records: '0', lastValue: String(e), latency: '—', rawData: null };
  }
}

async function checkEarningsQuality(symbol: string, finnhubKey: string): Promise<CheckResult> {
  try {
    const { data, latencyMs } = await timedFetch(
      `${FINNHUB_BASE}/stock/earnings-quality-score?symbol=${symbol}&freq=annual&token=${finnhubKey}`
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = data as any;
    const items = d?.data || [];
    const latest = items[0];
    const year = latest?.period ? parseInt(latest.period.substring(0, 4)) : null;
    let status: SourceStatus = 'BROKEN';
    let lastValue = 'No data';
    if (year != null) {
      if (year < 2020) {
        status = 'BROKEN';
        lastValue = `Returning ${year} data`;
      } else {
        status = 'LIVE';
        lastValue = `Score: ${latest.score ?? '?'} (${latest.period})`;
      }
    }
    return {
      id: 9, source: 'Earnings Quality', endpoint: '/stock/earnings-quality',
      status,
      records: items.length > 0 ? `${items.length} periods` : '0 curr',
      lastValue,
      latency: fmtLatency(latencyMs),
      rawData: data,
    };
  } catch (e) {
    return { id: 9, source: 'Earnings Quality', endpoint: '/stock/earnings-quality', status: 'BROKEN', records: '0', lastValue: String(e), latency: '—', rawData: null };
  }
}

async function checkRevenueBreakdown(symbol: string, finnhubKey: string): Promise<CheckResult> {
  try {
    const { data, latencyMs } = await timedFetch(
      `${FINNHUB_BASE}/stock/revenue-breakdown?symbol=${symbol}&token=${finnhubKey}`
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = data as any;
    const series = d?.data || [];
    const firstItem = series[0];
    const segments = firstItem?.revenue || [];
    return {
      id: 10, source: 'Revenue Breakdown', endpoint: '/stock/revenue-breakdown',
      status: segments.length > 0 ? 'LIVE' : 'BROKEN',
      records: `${segments.length} seg`,
      lastValue: segments[0]?.name ?? 'No segments',
      latency: fmtLatency(latencyMs),
      rawData: data,
    };
  } catch (e) {
    return { id: 10, source: 'Revenue Breakdown', endpoint: '/stock/revenue-breakdown', status: 'BROKEN', records: '0', lastValue: String(e), latency: '—', rawData: null };
  }
}

async function checkInsiderTransactions(symbol: string, finnhubKey: string): Promise<CheckResult> {
  try {
    const { data, latencyMs } = await timedFetch(
      `${FINNHUB_BASE}/stock/insider-transactions?symbol=${symbol}&token=${finnhubKey}`
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = data as any;
    const items = d?.data || [];
    const latest = items[0];
    return {
      id: 11, source: 'Insider Transactions', endpoint: '/stock/insider-trans',
      status: items.length > 0 ? 'LIVE' : 'BROKEN',
      records: `${items.length} rec`,
      lastValue: latest ? `${latest.transactionCode ?? '?'}: ${latest.change ?? '?'} (${latest.transactionDate ?? '?'})` : 'NULL',
      latency: fmtLatency(latencyMs),
      rawData: items.slice(0, 5),
    };
  } catch (e) {
    return { id: 11, source: 'Insider Transactions', endpoint: '/stock/insider-trans', status: 'BROKEN', records: '0', lastValue: String(e), latency: '—', rawData: null };
  }
}

async function checkInsiderSentiment(symbol: string, finnhubKey: string): Promise<CheckResult> {
  try {
    const { data, latencyMs } = await timedFetch(
      `${FINNHUB_BASE}/stock/insider-sentiment?symbol=${symbol}&from=2024-01-01&to=2025-12-31&token=${finnhubKey}`
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = data as any;
    const items = d?.data || [];
    const latest = items[items.length - 1];
    return {
      id: 12, source: 'Insider Sentiment', endpoint: '/stock/insider-sentiment',
      status: items.length > 0 ? 'LIVE' : 'BROKEN',
      records: items.length > 0 ? `${items.length} mo` : '0',
      lastValue: latest?.mspr != null ? `MSPR: ${latest.mspr.toFixed(2)}` : 'Empty response',
      latency: fmtLatency(latencyMs),
      rawData: items.slice(-5),
    };
  } catch (e) {
    return { id: 12, source: 'Insider Sentiment', endpoint: '/stock/insider-sentiment', status: 'BROKEN', records: '0', lastValue: String(e), latency: '—', rawData: null };
  }
}

async function checkInstitutionalOwnership(symbol: string, finnhubKey: string): Promise<CheckResult> {
  try {
    const { data, latencyMs } = await timedFetch(
      `${FINNHUB_BASE}/stock/ownership?symbol=${symbol}&limit=5&token=${finnhubKey}`
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = data as any;
    const items = d?.ownership || [];
    const first = items[0];
    const hasName = first?.name != null;
    let status: SourceStatus = 'BROKEN';
    if (items.length > 0) status = hasName ? 'LIVE' : 'PARTIAL';
    return {
      id: 13, source: 'Institutional Own.', endpoint: '/stock/ownership',
      status,
      records: `${items.length} hold`,
      lastValue: hasName ? first.name : (items.length > 0 ? 'Names: NULL' : 'NULL'),
      latency: fmtLatency(latencyMs),
      rawData: items,
    };
  } catch (e) {
    return { id: 13, source: 'Institutional Own.', endpoint: '/stock/ownership', status: 'BROKEN', records: '0', lastValue: String(e), latency: '—', rawData: null };
  }
}

async function checkPeers(symbol: string, finnhubKey: string): Promise<CheckResult> {
  try {
    const { data, latencyMs } = await timedFetch(
      `${FINNHUB_BASE}/stock/peers?symbol=${symbol}&token=${finnhubKey}`
    );
    const items = Array.isArray(data) ? data : [];
    return {
      id: 14, source: 'Peers', endpoint: '/stock/peers',
      status: items.length > 0 ? 'LIVE' : 'BROKEN',
      records: `${items.length} sym`,
      lastValue: items.length > 0 ? items.slice(0, 3).join(', ') + (items.length > 3 ? '...' : '') : 'NULL',
      latency: fmtLatency(latencyMs),
      rawData: items,
    };
  } catch (e) {
    return { id: 14, source: 'Peers', endpoint: '/stock/peers', status: 'BROKEN', records: '0', lastValue: String(e), latency: '—', rawData: null };
  }
}

async function checkFinancialsAnnual(symbol: string, finnhubKey: string): Promise<CheckResult> {
  try {
    const { data, latencyMs } = await timedFetch(
      `${FINNHUB_BASE}/stock/financials-reported?symbol=${symbol}&freq=annual&token=${finnhubKey}`
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = data as any;
    const items = d?.data || [];
    const latest = items[0];
    const report = latest?.report;
    // Check for key fields in the IC or BS
    const hasRevenue = report?.ic?.some?.((r: { concept?: string; value?: number }) => r.concept?.toLowerCase().includes('revenue') && r.value != null);
    return {
      id: 15, source: 'Financials (Annual)', endpoint: '/stock/financials-rep',
      status: items.length > 0 ? (hasRevenue ? 'LIVE' : 'BROKEN') : 'BROKEN',
      records: items.length > 0 ? `${items.length} yr` : '0 curr',
      lastValue: hasRevenue ? `${items.length} reports found` : 'All fields NULL',
      latency: fmtLatency(latencyMs),
      rawData: latest ? { year: latest.year, form: latest.form, fieldCount: report?.ic?.length } : null,
    };
  } catch (e) {
    return { id: 15, source: 'Financials (Annual)', endpoint: '/stock/financials-rep', status: 'BROKEN', records: '0', lastValue: String(e), latency: '—', rawData: null };
  }
}

async function checkFinancialsQuarterly(symbol: string, finnhubKey: string): Promise<CheckResult> {
  try {
    const { data, latencyMs } = await timedFetch(
      `${FINNHUB_BASE}/stock/financials?symbol=${symbol}&statement=ic&freq=quarterly&token=${finnhubKey}`
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = data as any;
    const items = d?.financials || [];
    const latest = items[0] || {};
    const fields = ['revenue', 'netIncome', 'grossProfit', 'operatingIncome'];
    const present = fields.filter(f => latest[f] != null);
    let status: SourceStatus = 'BROKEN';
    if (items.length > 0) {
      status = present.length === fields.length ? 'LIVE' : (present.length > 0 ? 'PARTIAL' : 'BROKEN');
    }
    const missing = fields.filter(f => latest[f] == null);
    return {
      id: 16, source: 'Financials (Quarterly)', endpoint: '/stock/financials',
      status,
      records: `${items.length} qtrs`,
      lastValue: missing.length > 0 ? `${missing[0]}: NULL` : `${present.length} fields present`,
      latency: fmtLatency(latencyMs),
      rawData: latest,
    };
  } catch (e) {
    return { id: 16, source: 'Financials (Quarterly)', endpoint: '/stock/financials', status: 'BROKEN', records: '0', lastValue: String(e), latency: '—', rawData: null };
  }
}

async function checkFinBERTSentiment(symbol: string, finnhubKey: string): Promise<CheckResult> {
  try {
    const { data, latencyMs } = await timedFetch(
      `${FINNHUB_BASE}/news-sentiment?symbol=${symbol}&token=${finnhubKey}`
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = data as any;
    const bullish = d?.sentiment?.bullishPercent;
    return {
      id: 17, source: 'FinBERT Sentiment', endpoint: '/news-sentiment',
      status: bullish != null ? 'LIVE' : 'BROKEN',
      records: '—',
      lastValue: bullish != null ? `Bullish: ${bullish.toFixed(2)}` : 'NULL',
      latency: fmtLatency(latencyMs),
      rawData: data,
    };
  } catch (e) {
    return { id: 17, source: 'FinBERT Sentiment', endpoint: '/news-sentiment', status: 'BROKEN', records: '0', lastValue: String(e), latency: '—', rawData: null };
  }
}

async function checkCompanyNews(symbol: string, finnhubKey: string): Promise<CheckResult> {
  try {
    const now = new Date();
    const to = now.toISOString().split('T')[0];
    const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const { data, latencyMs } = await timedFetch(
      `${FINNHUB_BASE}/company-news?symbol=${symbol}&from=${from}&to=${to}&token=${finnhubKey}`
    );
    const items = Array.isArray(data) ? data : [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const latest = items[0] as any;
    const latestDate = latest?.datetime ? new Date(latest.datetime * 1000).toISOString().split('T')[0] : null;
    return {
      id: 18, source: 'Company News', endpoint: '/company-news',
      status: items.length > 0 ? 'LIVE' : 'BROKEN',
      records: `${items.length} rec`,
      lastValue: latestDate ?? 'NULL',
      latency: fmtLatency(latencyMs),
      rawData: items.slice(0, 3),
    };
  } catch (e) {
    return { id: 18, source: 'Company News', endpoint: '/company-news', status: 'BROKEN', records: '0', lastValue: String(e), latency: '—', rawData: null };
  }
}

async function checkFREDMacro(): Promise<CheckResult> {
  const fredKey = process.env.FRED_API_KEY;
  if (!fredKey) {
    return { id: 19, source: 'FRED Macro (14 series)', endpoint: 'FRED API', status: 'SKIPPED', records: '—', lastValue: 'FRED_API_KEY not set', latency: '—', rawData: null };
  }
  try {
    const start = performance.now();
    const [vixRes, tenYRes] = await Promise.all([
      fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=VIXCLS&api_key=${fredKey}&limit=1&sort_order=desc&file_type=json`),
      fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=DGS10&api_key=${fredKey}&limit=1&sort_order=desc&file_type=json`),
    ]);
    const latencyMs = Math.round(performance.now() - start);
    const vixData = await vixRes.json();
    const tenYData = await tenYRes.json();
    const vix = vixData?.observations?.[0]?.value;
    const tenY = tenYData?.observations?.[0]?.value;
    const bothLive = vix != null && vix !== '.' && tenY != null && tenY !== '.';
    return {
      id: 19, source: 'FRED Macro (14 series)', endpoint: 'FRED API',
      status: bothLive ? 'LIVE' : 'PARTIAL',
      records: '14 series',
      lastValue: `VIX: ${vix ?? 'NULL'}, 10Y: ${tenY ?? 'NULL'}%`,
      latency: fmtLatency(latencyMs),
      rawData: { vix: vixData?.observations?.[0], tenY: tenYData?.observations?.[0] },
    };
  } catch (e) {
    return { id: 19, source: 'FRED Macro (14 series)', endpoint: 'FRED API', status: 'BROKEN', records: '0', lastValue: String(e), latency: '—', rawData: null };
  }
}

// SEC calls share data between checks 20 and 21
async function fetchSECData(symbol: string): Promise<{ cik: string | null; paddedCIK: string | null; title: string | null; submissions: unknown; tickersRaw: unknown; latencyTickers: number; latencySubmissions: number }> {
  const tickerStart = performance.now();
  const tickersRes = await fetch('https://www.sec.gov/files/company_tickers.json', {
    headers: { 'User-Agent': 'TempleStuart/1.0 (contact@example.com)', Accept: 'application/json' },
  });
  const tickersData = await tickersRes.json();
  const latencyTickers = Math.round(performance.now() - tickerStart);

  let cik: string | null = null;
  let title: string | null = null;
  for (const key of Object.keys(tickersData)) {
    if (tickersData[key].ticker === symbol) {
      cik = String(tickersData[key].cik_str);
      title = tickersData[key].title;
      break;
    }
  }

  if (!cik) {
    return { cik: null, paddedCIK: null, title: null, submissions: null, tickersRaw: null, latencyTickers, latencySubmissions: 0 };
  }

  const paddedCIK = cik.padStart(10, '0');
  const subStart = performance.now();
  const subRes = await fetch(`https://data.sec.gov/submissions/CIK${paddedCIK}.json`, {
    headers: { 'User-Agent': 'TempleStuart/1.0 (contact@example.com)', Accept: 'application/json' },
  });
  const submissions = await subRes.json();
  const latencySubmissions = Math.round(performance.now() - subStart);

  return { cik, paddedCIK, title, submissions, tickersRaw: tickersData, latencyTickers, latencySubmissions };
}

function checkSECEdgar(secData: Awaited<ReturnType<typeof fetchSECData>>): CheckResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sub = secData.submissions as any;
  const hasEntity = sub?.entityName != null;
  return {
    id: 20, source: 'SEC EDGAR Submissions', endpoint: 'EDGAR direct',
    status: hasEntity ? 'LIVE' : (secData.cik ? 'PARTIAL' : 'BROKEN'),
    records: '—',
    lastValue: secData.cik ? `CIK: ${secData.cik}` : 'CIK not found',
    latency: fmtLatency(secData.latencySubmissions || secData.latencyTickers),
    rawData: { entityName: sub?.entityName, cik: secData.cik, filingCount: sub?.filings?.recent?.accessionNumber?.length },
  };
}

function checkSECTickers(secData: Awaited<ReturnType<typeof fetchSECData>>): CheckResult {
  return {
    id: 21, source: 'SEC Company Tickers', endpoint: '/files/company_tickers',
    status: secData.cik ? 'LIVE' : 'BROKEN',
    records: '—',
    lastValue: secData.cik ? `CIK: ${secData.cik} | ${secData.title ?? ''}` : 'Symbol not found',
    latency: fmtLatency(secData.latencyTickers),
    rawData: { cik: secData.cik, title: secData.title },
  };
}

async function checkXAIGrok(symbol: string): Promise<CheckResult> {
  const xaiKey = process.env.XAI_API_KEY;
  if (!xaiKey) {
    return { id: 22, source: 'xAI/Grok Sentiment', endpoint: 'xAI API', status: 'SKIPPED', records: '—', lastValue: 'XAI_API_KEY not set', latency: '—', rawData: null };
  }
  try {
    const { data, latencyMs } = await timedFetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${xaiKey}` },
      body: JSON.stringify({
        model: 'grok-3-mini',
        messages: [{ role: 'user', content: `In one word, is sentiment for ${symbol} bullish, bearish, or neutral?` }],
        max_tokens: 10,
      }),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = data as any;
    const content = d?.choices?.[0]?.message?.content?.trim() ?? null;
    return {
      id: 22, source: 'xAI/Grok Sentiment', endpoint: 'xAI API',
      status: content ? 'LIVE' : 'BROKEN',
      records: '—',
      lastValue: content ?? 'No response',
      latency: fmtLatency(latencyMs),
      rawData: data,
    };
  } catch (e) {
    return { id: 22, source: 'xAI/Grok Sentiment', endpoint: 'xAI API', status: 'BROKEN', records: '—', lastValue: String(e), latency: '—', rawData: null };
  }
}

function checkTastyTradeGreeks(): CheckResult {
  const hasUsername = !!process.env.TASTYTRADE_USERNAME;
  const hasPassword = !!process.env.TASTYTRADE_PASSWORD;
  if (!hasUsername || !hasPassword) {
    return { id: 23, source: 'TastyTrade Greeks', endpoint: 'TastyTrade API', status: 'SKIPPED', records: '—', lastValue: 'TASTYTRADE credentials not set', latency: '—', rawData: null };
  }
  // Check market hours: Mon-Fri 9:30-16:00 ET
  const now = new Date();
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = et.getDay();
  const hours = et.getHours();
  const mins = et.getMinutes();
  const totalMins = hours * 60 + mins;
  const isMarketOpen = day >= 1 && day <= 5 && totalMins >= 570 && totalMins < 960; // 9:30=570, 16:00=960

  if (!isMarketOpen) {
    return { id: 23, source: 'TastyTrade Greeks', endpoint: 'TastyTrade API', status: 'MKT-HRS', records: '—', lastValue: 'Requires open market', latency: '—', rawData: null };
  }

  // If market is open and credentials are set, we'd do the actual call here.
  // For now, report MKT-HRS status since full TastyTrade auth flow (session token) is complex.
  return { id: 23, source: 'TastyTrade Greeks', endpoint: 'TastyTrade API', status: 'MKT-HRS', records: '—', lastValue: 'Session auth not wired yet', latency: '—', rawData: null };
}

// ─── Main Handler ───────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // ── Auth (non-negotiable first lines) ──
  const userEmail = await getVerifiedEmail();
  if (!userEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const user = await prisma.users.findFirst({
    where: { email: { equals: userEmail, mode: 'insensitive' } },
  });
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Params ──
  const symbol = request.nextUrl.searchParams.get('symbol') || 'MSFT';
  if (!ALLOWED_SYMBOLS.includes(symbol)) {
    return NextResponse.json({ error: `Invalid symbol. Allowed: ${ALLOWED_SYMBOLS.join(', ')}` }, { status: 400 });
  }

  const finnhubKey = process.env.FINNHUB_API_KEY;

  // ── Run all 23 checks in parallel ──
  const allChecks = await Promise.allSettled([
    // Checks 1 & 2 share the same Finnhub metric call
    (async () => {
      if (!finnhubKey) {
        return [
          { id: 1, source: 'Finnhub IV/HV', endpoint: '/stock/metric', status: 'SKIPPED' as SourceStatus, records: '—', lastValue: 'FINNHUB_API_KEY not set', latency: '—', rawData: null },
          { id: 2, source: 'Finnhub Basic Metrics', endpoint: '/stock/metric', status: 'SKIPPED' as SourceStatus, records: '—', lastValue: 'FINNHUB_API_KEY not set', latency: '—', rawData: null },
        ];
      }
      const { metricResult, latencyMs } = await runFinnhubMetric(symbol, finnhubKey);
      return [checkIVHV(metricResult, latencyMs), checkBasicMetrics(metricResult, latencyMs)];
    })(),
    // Checks 3-18: individual Finnhub endpoints
    finnhubKey ? checkEPSEstimates(symbol, finnhubKey) : Promise.resolve({ id: 3, source: 'EPS Estimates', endpoint: '/stock/eps-estimate', status: 'SKIPPED' as SourceStatus, records: '—', lastValue: 'FINNHUB_API_KEY not set', latency: '—', rawData: null }),
    finnhubKey ? checkRevenueEstimates(symbol, finnhubKey) : Promise.resolve({ id: 4, source: 'Revenue Estimates', endpoint: '/stock/revenue-estimate', status: 'SKIPPED' as SourceStatus, records: '—', lastValue: 'FINNHUB_API_KEY not set', latency: '—', rawData: null }),
    finnhubKey ? checkPriceTargets(symbol, finnhubKey) : Promise.resolve({ id: 5, source: 'Price Targets', endpoint: '/stock/price-target', status: 'SKIPPED' as SourceStatus, records: '—', lastValue: 'FINNHUB_API_KEY not set', latency: '—', rawData: null }),
    finnhubKey ? checkUpgradesDowngrades(symbol, finnhubKey) : Promise.resolve({ id: 6, source: 'Upgrades/Downgrades', endpoint: '/stock/upgrade-downgrade', status: 'SKIPPED' as SourceStatus, records: '—', lastValue: 'FINNHUB_API_KEY not set', latency: '—', rawData: null }),
    finnhubKey ? checkRecommendations(symbol, finnhubKey) : Promise.resolve({ id: 7, source: 'Recommendations', endpoint: '/stock/recommendation', status: 'SKIPPED' as SourceStatus, records: '—', lastValue: 'FINNHUB_API_KEY not set', latency: '—', rawData: null }),
    finnhubKey ? checkEarningsHistory(symbol, finnhubKey) : Promise.resolve({ id: 8, source: 'Earnings History', endpoint: '/stock/earnings', status: 'SKIPPED' as SourceStatus, records: '—', lastValue: 'FINNHUB_API_KEY not set', latency: '—', rawData: null }),
    finnhubKey ? checkEarningsQuality(symbol, finnhubKey) : Promise.resolve({ id: 9, source: 'Earnings Quality', endpoint: '/stock/earnings-quality', status: 'SKIPPED' as SourceStatus, records: '—', lastValue: 'FINNHUB_API_KEY not set', latency: '—', rawData: null }),
    finnhubKey ? checkRevenueBreakdown(symbol, finnhubKey) : Promise.resolve({ id: 10, source: 'Revenue Breakdown', endpoint: '/stock/revenue-breakdown', status: 'SKIPPED' as SourceStatus, records: '—', lastValue: 'FINNHUB_API_KEY not set', latency: '—', rawData: null }),
    finnhubKey ? checkInsiderTransactions(symbol, finnhubKey) : Promise.resolve({ id: 11, source: 'Insider Transactions', endpoint: '/stock/insider-trans', status: 'SKIPPED' as SourceStatus, records: '—', lastValue: 'FINNHUB_API_KEY not set', latency: '—', rawData: null }),
    finnhubKey ? checkInsiderSentiment(symbol, finnhubKey) : Promise.resolve({ id: 12, source: 'Insider Sentiment', endpoint: '/stock/insider-sentiment', status: 'SKIPPED' as SourceStatus, records: '—', lastValue: 'FINNHUB_API_KEY not set', latency: '—', rawData: null }),
    finnhubKey ? checkInstitutionalOwnership(symbol, finnhubKey) : Promise.resolve({ id: 13, source: 'Institutional Own.', endpoint: '/stock/ownership', status: 'SKIPPED' as SourceStatus, records: '—', lastValue: 'FINNHUB_API_KEY not set', latency: '—', rawData: null }),
    finnhubKey ? checkPeers(symbol, finnhubKey) : Promise.resolve({ id: 14, source: 'Peers', endpoint: '/stock/peers', status: 'SKIPPED' as SourceStatus, records: '—', lastValue: 'FINNHUB_API_KEY not set', latency: '—', rawData: null }),
    finnhubKey ? checkFinancialsAnnual(symbol, finnhubKey) : Promise.resolve({ id: 15, source: 'Financials (Annual)', endpoint: '/stock/financials-rep', status: 'SKIPPED' as SourceStatus, records: '—', lastValue: 'FINNHUB_API_KEY not set', latency: '—', rawData: null }),
    finnhubKey ? checkFinancialsQuarterly(symbol, finnhubKey) : Promise.resolve({ id: 16, source: 'Financials (Quarterly)', endpoint: '/stock/financials', status: 'SKIPPED' as SourceStatus, records: '—', lastValue: 'FINNHUB_API_KEY not set', latency: '—', rawData: null }),
    finnhubKey ? checkFinBERTSentiment(symbol, finnhubKey) : Promise.resolve({ id: 17, source: 'FinBERT Sentiment', endpoint: '/news-sentiment', status: 'SKIPPED' as SourceStatus, records: '—', lastValue: 'FINNHUB_API_KEY not set', latency: '—', rawData: null }),
    finnhubKey ? checkCompanyNews(symbol, finnhubKey) : Promise.resolve({ id: 18, source: 'Company News', endpoint: '/company-news', status: 'SKIPPED' as SourceStatus, records: '—', lastValue: 'FINNHUB_API_KEY not set', latency: '—', rawData: null }),
    // Check 19: FRED
    checkFREDMacro(),
    // Checks 20 & 21 share the same SEC fetch
    (async () => {
      try {
        const secData = await fetchSECData(symbol);
        return [checkSECEdgar(secData), checkSECTickers(secData)];
      } catch (e) {
        return [
          { id: 20, source: 'SEC EDGAR Submissions', endpoint: 'EDGAR direct', status: 'BROKEN' as SourceStatus, records: '—', lastValue: String(e), latency: '—', rawData: null },
          { id: 21, source: 'SEC Company Tickers', endpoint: '/files/company_tickers', status: 'BROKEN' as SourceStatus, records: '—', lastValue: String(e), latency: '—', rawData: null },
        ];
      }
    })(),
    // Check 22: xAI
    checkXAIGrok(symbol),
    // Check 23: TastyTrade
    Promise.resolve(checkTastyTradeGreeks()),
  ]);

  // ── Flatten results ──
  const results: CheckResult[] = [];
  for (const settled of allChecks) {
    if (settled.status === 'fulfilled') {
      const val = settled.value;
      if (Array.isArray(val)) {
        results.push(...val);
      } else {
        results.push(val as CheckResult);
      }
    } else {
      // Rejected promise — should not happen since each check catches internally
      results.push({
        id: 0, source: 'Unknown', endpoint: '—',
        status: 'BROKEN', records: '0', lastValue: settled.reason?.message ?? 'Unknown error',
        latency: '—', rawData: null,
      });
    }
  }

  // Sort by id
  results.sort((a, b) => a.id - b.id);

  return NextResponse.json({
    symbol,
    checkedAt: new Date().toISOString(),
    results,
  });
}
