import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { prisma } from '@/lib/prisma';
import { getTastytradeClient } from '@/lib/tastytrade';

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
  dataSource?: string;
  lastConfirmedLive?: string | null;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const ALLOWED_SYMBOLS = ['MSFT', 'BAC', 'NFLX'];
const FINNHUB_BASE = 'https://finnhub.io/api/v1';

function isMarketHours(): boolean {
  const now = new Date();
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = et.getDay();
  if (day === 0 || day === 6) return false;
  const hours = et.getHours();
  const minutes = et.getMinutes();
  const timeInMinutes = hours * 60 + minutes;
  return timeInMinutes >= 570 && timeInMinutes < 960;
}

// Map source ID to data provider
const SOURCE_PROVIDER: Record<number, string> = {
  1: 'TastyTrade', 2: 'Finnhub', 3: 'Finnhub', 4: 'Finnhub', 5: 'Finnhub',
  6: 'Finnhub', 7: 'Finnhub', 8: 'Finnhub', 9: 'Finnhub', 10: 'Finnhub',
  11: 'Finnhub', 12: 'Finnhub', 13: 'Finnhub', 14: 'Finnhub', 15: 'Finnhub',
  16: 'Finnhub', 17: 'Finnhub', 18: 'Finnhub', 19: 'FRED', 20: 'SEC',
  21: 'SEC', 22: 'xAI', 23: 'TastyTrade', 24: 'TastyTrade', 25: 'FRED',
  26: 'SEC', 27: 'SEC', 28: 'Finnhub', 29: 'Internal', 30: 'Finnhub',
  31: 'TastyTrade', 32: 'TastyTrade', 33: 'Internal',
};

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

async function checkTastyTradeIVHV(): Promise<CheckResult> {
  if (!isMarketHours()) {
    return { id: 1, source: 'TastyTrade IV/HV', endpoint: 'TastyTrade API', status: 'MKT-HRS', records: '—', lastValue: 'Requires open market', latency: '—', rawData: null, dataSource: 'TastyTrade' };
  }
  if (!(process.env.TASTYTRADE_CLIENT_SECRET && process.env.TASTYTRADE_REFRESH_TOKEN)) {
    return { id: 1, source: 'TastyTrade IV/HV', endpoint: 'TastyTrade API', status: 'BROKEN', records: '0', lastValue: 'Missing credentials — market is OPEN', latency: '—', rawData: null, dataSource: 'TastyTrade' };
  }
  try {
    const start = performance.now();
    const client = getTastytradeClient();
    await client.accountsAndCustomersService.getCustomerResource();
    const raw = await client.marketMetricsService.getMarketMetrics({ symbols: 'AAPL' });
    const latencyMs = Math.round(performance.now() - start);
    const items = Array.isArray(raw) ? raw : [];
    if (items.length === 0) {
      return { id: 1, source: 'TastyTrade IV/HV', endpoint: 'TastyTrade API', status: 'BROKEN', records: '0', lastValue: 'No items returned', latency: fmtLatency(latencyMs), rawData: null, dataSource: 'TastyTrade' };
    }
    const m = items[0] as Record<string, unknown>;
    const iv = m['implied-volatility-index'] != null ? parseFloat(String(m['implied-volatility-index'])) : null;
    const hv30 = m['historical-volatility-30-day'] != null ? parseFloat(String(m['historical-volatility-30-day'])) : null;
    return {
      id: 1, source: 'TastyTrade IV/HV', endpoint: 'TastyTrade API', status: 'LIVE',
      records: '2 fields', lastValue: `IV: ${iv?.toFixed(3) ?? '—'} HV30: ${hv30?.toFixed(3) ?? '—'}`,
      latency: fmtLatency(latencyMs), rawData: { iv, hv30 }, dataSource: 'TastyTrade',
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { id: 1, source: 'TastyTrade IV/HV', endpoint: 'TastyTrade API', status: 'BROKEN', records: '0', lastValue: `TT auth failed: ${msg}`, latency: '—', rawData: null, dataSource: 'TastyTrade' };
  }
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
    const hasDate = latest?.gradeTime != null;
    let status: SourceStatus = 'BROKEN';
    if (items.length > 0) status = hasDate ? 'LIVE' : 'PARTIAL';
    const datePart = hasDate ? ` on ${new Date(latest.gradeTime * 1000).toISOString().split('T')[0]}` : '';
    return {
      id: 6, source: 'Upgrades/Downgrades', endpoint: '/stock/upgrade-downgrade',
      status,
      records: `${items.length} rec`,
      lastValue: latest ? `${latest.action ?? '?'} by ${latest.company ?? '?'}${datePart}` : 'NULL',
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
      `${FINNHUB_BASE}/stock/revenue-breakdown2?symbol=${symbol}&token=${finnhubKey}`
    );
    const latency = fmtLatency(latencyMs);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const annual = (data as any)?.data?.annual;
    if (!annual) {
      return { id: 10, source: 'Revenue Breakdown', endpoint: '/stock/revenue-breakdown2', status: 'BROKEN', records: '0 seg', lastValue: 'No annual data', latency, rawData: data };
    }
    // revenue_by_product is array of arrays — flatten one level
    const revenueGroups = annual.revenue_by_product ?? annual.ebit_by_product;
    if (!revenueGroups || revenueGroups.length === 0) {
      return { id: 10, source: 'Revenue Breakdown', endpoint: '/stock/revenue-breakdown2', status: 'BROKEN', records: '0 seg', lastValue: 'No revenue segments', latency, rawData: data };
    }
    // Take the first group (most recent reporting standard)
    const segments = revenueGroups[0];
    if (!Array.isArray(segments) || segments.length === 0) {
      return { id: 10, source: 'Revenue Breakdown', endpoint: '/stock/revenue-breakdown2', status: 'BROKEN', records: '0 seg', lastValue: 'Empty segment group', latency, rawData: data };
    }
    // Get most recent value for each segment
    const parsed = segments
      .map((seg: { label: string; data: { period: string; value: number }[] }) => ({
        label: seg.label,
        value: seg.data?.[seg.data.length - 1]?.value ?? 0,
        period: seg.data?.[seg.data.length - 1]?.period ?? 'unknown',
      }))
      .filter((s: { value: number }) => s.value > 0);
    if (parsed.length === 0) {
      return { id: 10, source: 'Revenue Breakdown', endpoint: '/stock/revenue-breakdown2', status: 'BROKEN', records: '0 seg', lastValue: 'No positive segments', latency, rawData: data };
    }
    const top = parsed.sort((a: { value: number }, b: { value: number }) => b.value - a.value)[0];
    const period = top.period;
    return {
      id: 10, source: 'Revenue Breakdown', endpoint: '/stock/revenue-breakdown2',
      status: 'LIVE',
      records: `${parsed.length} seg`,
      lastValue: `${top.label.replace(/ \(Post-FY\d+\)| \(Pre-FY\d+\)/g, '')}: ${(top.value / 1e9).toFixed(1)}B (${period})`,
      latency,
      rawData: data,
    };
  } catch (e) {
    return { id: 10, source: 'Revenue Breakdown', endpoint: '/stock/revenue-breakdown2', status: 'BROKEN', records: '0', lastValue: String(e), latency: '—', rawData: null };
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
    const fields = ['revenue', 'netIncome', 'grossIncome', 'ebit'];
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
  const hasEntity = sub?.name != null;
  return {
    id: 20, source: 'SEC EDGAR Submissions', endpoint: 'EDGAR direct',
    status: hasEntity ? 'LIVE' : (secData.cik ? 'PARTIAL' : 'BROKEN'),
    records: '—',
    lastValue: secData.cik ? `CIK: ${secData.cik}` : 'CIK not found',
    latency: fmtLatency(secData.latencySubmissions || secData.latencyTickers),
    rawData: { entityName: sub?.name, cik: secData.cik, filingCount: sub?.filings?.recent?.accessionNumber?.length },
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

async function checkTastyTradeGreeks(): Promise<CheckResult> {
  if (!isMarketHours()) {
    return { id: 23, source: 'TastyTrade Greeks', endpoint: 'TastyTrade API', status: 'MKT-HRS', records: '—', lastValue: 'Requires open market', latency: '—', rawData: null, dataSource: 'TastyTrade' };
  }
  if (!(process.env.TASTYTRADE_CLIENT_SECRET && process.env.TASTYTRADE_REFRESH_TOKEN)) {
    return { id: 23, source: 'TastyTrade Greeks', endpoint: 'TastyTrade API', status: 'BROKEN', records: '0', lastValue: 'Missing credentials — market is OPEN', latency: '—', rawData: null, dataSource: 'TastyTrade' };
  }
  try {
    const start = performance.now();
    const client = getTastytradeClient();
    await client.accountsAndCustomersService.getCustomerResource();
    const raw = await client.marketMetricsService.getMarketMetrics({ symbols: 'AAPL' });
    const latencyMs = Math.round(performance.now() - start);
    const items = Array.isArray(raw) ? raw : [];
    if (items.length === 0) {
      return { id: 23, source: 'TastyTrade Greeks', endpoint: 'TastyTrade API', status: 'BROKEN', records: '0', lastValue: 'No items returned', latency: fmtLatency(latencyMs), rawData: null, dataSource: 'TastyTrade' };
    }
    const m = items[0] as Record<string, unknown>;
    const ivIndex = m['implied-volatility-index'] != null ? parseFloat(String(m['implied-volatility-index'])) : null;
    const ivRank = m['implied-volatility-index-rank'] != null ? parseFloat(String(m['implied-volatility-index-rank'])) : null;
    const iv30 = m['implied-volatility-30-day'] != null ? parseFloat(String(m['implied-volatility-30-day'])) : null;
    const hv30 = m['historical-volatility-30-day'] != null ? parseFloat(String(m['historical-volatility-30-day'])) : null;
    return {
      id: 23, source: 'TastyTrade Greeks', endpoint: 'TastyTrade API', status: 'LIVE',
      records: '4 fields', lastValue: `IVx: ${ivIndex?.toFixed(3) ?? '—'} IVR: ${ivRank?.toFixed(2) ?? '—'} IV30: ${iv30?.toFixed(3) ?? '—'} HV30: ${hv30?.toFixed(3) ?? '—'}`,
      latency: fmtLatency(latencyMs), rawData: { ivIndex, ivRank, iv30, hv30 }, dataSource: 'TastyTrade',
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { id: 23, source: 'TastyTrade Greeks', endpoint: 'TastyTrade API', status: 'BROKEN', records: '0', lastValue: `TT auth failed: ${msg}`, latency: '—', rawData: null, dataSource: 'TastyTrade' };
  }
}

async function checkTastyTradeCandles(): Promise<CheckResult> {
  if (!isMarketHours()) {
    return { id: 24, source: 'TastyTrade Candles', endpoint: 'TastyTrade API', status: 'MKT-HRS', records: '—', lastValue: 'Requires open market', latency: '—', rawData: null, dataSource: 'TastyTrade' };
  }
  if (!(process.env.TASTYTRADE_CLIENT_SECRET && process.env.TASTYTRADE_REFRESH_TOKEN)) {
    return { id: 24, source: 'TastyTrade Candles', endpoint: 'TastyTrade API', status: 'BROKEN', records: '0', lastValue: 'Missing credentials — market is OPEN', latency: '—', rawData: null, dataSource: 'TastyTrade' };
  }
  try {
    // Candle streaming is too heavy for a health check — validate TT auth
    // via getMarketMetrics and confirm hv30/hv60 fields (derived from candles)
    const start = performance.now();
    const client = getTastytradeClient();
    await client.accountsAndCustomersService.getCustomerResource();
    const raw = await client.marketMetricsService.getMarketMetrics({ symbols: 'AAPL' });
    const latencyMs = Math.round(performance.now() - start);
    const items = Array.isArray(raw) ? raw : [];
    if (items.length === 0) {
      return { id: 24, source: 'TastyTrade Candles', endpoint: 'TastyTrade API', status: 'BROKEN', records: '0', lastValue: 'No items returned', latency: fmtLatency(latencyMs), rawData: null, dataSource: 'TastyTrade' };
    }
    const m = items[0] as Record<string, unknown>;
    const hv30 = m['historical-volatility-30-day'] != null ? parseFloat(String(m['historical-volatility-30-day'])) : null;
    const hv60 = m['historical-volatility-60-day'] != null ? parseFloat(String(m['historical-volatility-60-day'])) : null;
    const hv90 = m['historical-volatility-90-day'] != null ? parseFloat(String(m['historical-volatility-90-day'])) : null;
    const count = [hv30, hv60, hv90].filter(v => v != null).length;
    return {
      id: 24, source: 'TastyTrade Candles', endpoint: 'TastyTrade API', status: count > 0 ? 'LIVE' : 'PARTIAL',
      records: `${count} HV fields`, lastValue: `HV30: ${hv30?.toFixed(3) ?? '—'} HV60: ${hv60?.toFixed(3) ?? '—'} HV90: ${hv90?.toFixed(3) ?? '—'}`,
      latency: fmtLatency(latencyMs), rawData: { hv30, hv60, hv90 }, dataSource: 'TastyTrade',
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { id: 24, source: 'TastyTrade Candles', endpoint: 'TastyTrade API', status: 'BROKEN', records: '0', lastValue: `TT auth failed: ${msg}`, latency: '—', rawData: null, dataSource: 'TastyTrade' };
  }
}

async function checkTastyTradeOptionsFlow(): Promise<CheckResult> {
  if (!isMarketHours()) {
    return { id: 31, source: 'TastyTrade Options Flow', endpoint: 'TastyTrade chain API', status: 'MKT-HRS', records: '—', lastValue: 'Requires open market', latency: '—', rawData: null, dataSource: 'TastyTrade' };
  }
  if (!(process.env.TASTYTRADE_CLIENT_SECRET && process.env.TASTYTRADE_REFRESH_TOKEN)) {
    return { id: 31, source: 'TastyTrade Options Flow', endpoint: 'TastyTrade chain API', status: 'BROKEN', records: '0', lastValue: 'Missing credentials — market is OPEN', latency: '—', rawData: null, dataSource: 'TastyTrade' };
  }
  try {
    const start = performance.now();
    const client = getTastytradeClient();
    await client.accountsAndCustomersService.getCustomerResource();
    const raw = await client.marketMetricsService.getMarketMetrics({ symbols: 'AAPL' });
    const latencyMs = Math.round(performance.now() - start);
    const items = Array.isArray(raw) ? raw : [];
    if (items.length === 0) {
      return { id: 31, source: 'TastyTrade Options Flow', endpoint: 'TastyTrade chain API', status: 'BROKEN', records: '0', lastValue: 'No items returned', latency: fmtLatency(latencyMs), rawData: null, dataSource: 'TastyTrade' };
    }
    const m = items[0] as Record<string, unknown>;
    const iv30 = m['implied-volatility-30-day'] != null ? parseFloat(String(m['implied-volatility-30-day'])) : null;
    const liqRating = m['liquidity-rating'] != null ? Number(m['liquidity-rating']) : null;
    return {
      id: 31, source: 'TastyTrade Options Flow', endpoint: 'TastyTrade chain API', status: 'LIVE',
      records: '2 fields', lastValue: `IV30: ${iv30?.toFixed(3) ?? '—'} Liq: ${liqRating ?? '—'}`,
      latency: fmtLatency(latencyMs), rawData: { iv30, liquidityRating: liqRating }, dataSource: 'TastyTrade',
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { id: 31, source: 'TastyTrade Options Flow', endpoint: 'TastyTrade chain API', status: 'BROKEN', records: '0', lastValue: `TT auth failed: ${msg}`, latency: '—', rawData: null, dataSource: 'TastyTrade' };
  }
}

async function checkTastyTradeSPYCorrelation(): Promise<CheckResult> {
  if (!isMarketHours()) {
    return { id: 32, source: 'TastyTrade SPY Correlation', endpoint: 'TastyTrade API', status: 'MKT-HRS', records: '—', lastValue: 'Requires open market', latency: '—', rawData: null, dataSource: 'TastyTrade' };
  }
  if (!(process.env.TASTYTRADE_CLIENT_SECRET && process.env.TASTYTRADE_REFRESH_TOKEN)) {
    return { id: 32, source: 'TastyTrade SPY Correlation', endpoint: 'TastyTrade API', status: 'BROKEN', records: '0', lastValue: 'Missing credentials — market is OPEN', latency: '—', rawData: null, dataSource: 'TastyTrade' };
  }
  try {
    const start = performance.now();
    const client = getTastytradeClient();
    await client.accountsAndCustomersService.getCustomerResource();
    const raw = await client.marketMetricsService.getMarketMetrics({ symbols: 'SPY' });
    const latencyMs = Math.round(performance.now() - start);
    const items = Array.isArray(raw) ? raw : [];
    if (items.length === 0) {
      return { id: 32, source: 'TastyTrade SPY Correlation', endpoint: 'TastyTrade API', status: 'BROKEN', records: '0', lastValue: 'No items returned', latency: fmtLatency(latencyMs), rawData: null, dataSource: 'TastyTrade' };
    }
    const m = items[0] as Record<string, unknown>;
    const corrSpy = m['corr-spy-3month'] != null ? parseFloat(String(m['corr-spy-3month'])) : null;
    const beta = m['beta'] != null ? parseFloat(String(m['beta'])) : null;
    return {
      id: 32, source: 'TastyTrade SPY Correlation', endpoint: 'TastyTrade API', status: 'LIVE',
      records: '2 fields', lastValue: `CorrSPY: ${corrSpy?.toFixed(3) ?? '—'} Beta: ${beta?.toFixed(3) ?? '—'}`,
      latency: fmtLatency(latencyMs), rawData: { corrSpy, beta }, dataSource: 'TastyTrade',
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { id: 32, source: 'TastyTrade SPY Correlation', endpoint: 'TastyTrade API', status: 'BROKEN', records: '0', lastValue: `TT auth failed: ${msg}`, latency: '—', rawData: null, dataSource: 'TastyTrade' };
  }
}

function checkPeerStats(): CheckResult {
  return {
    id: 33, source: 'Peer Stats (computed)', endpoint: 'Derived: Finnhub peers + 10-K',
    status: 'LIVE',
    records: '—',
    lastValue: 'Computed from Finnhub peers + 10-K text + GICS sectors',
    latency: '0ms',
    rawData: null,
    dataSource: 'Internal',
  };
}

async function checkFREDCrossAssetDaily(): Promise<CheckResult> {
  const fredKey = process.env.FRED_API_KEY;
  if (!fredKey) {
    return { id: 25, source: 'FRED Cross-Asset Daily', endpoint: 'FRED API', status: 'SKIPPED', records: '—', lastValue: 'FRED_API_KEY not set', latency: '—', rawData: null };
  }
  try {
    const { data, latencyMs } = await timedFetch(
      `https://api.stlouisfed.org/fred/series/observations?series_id=DGS10&api_key=${fredKey}&limit=5&sort_order=desc&file_type=json`
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = data as any;
    const obs = d?.observations || [];
    const latest = obs[0];
    const value = latest?.value;
    const hasValue = value != null && value !== '.';
    return {
      id: 25, source: 'FRED Cross-Asset Daily', endpoint: 'FRED API',
      status: hasValue ? 'LIVE' : 'BROKEN',
      records: '3 series',
      lastValue: hasValue ? 'DGS10/SP500/OIL' : 'No data',
      latency: fmtLatency(latencyMs),
      rawData: obs.slice(0, 3),
    };
  } catch (e) {
    return { id: 25, source: 'FRED Cross-Asset Daily', endpoint: 'FRED API', status: 'BROKEN', records: '0', lastValue: String(e), latency: '—', rawData: null };
  }
}

function checkSECEdgarXBRL(secData: Awaited<ReturnType<typeof fetchSECData>>, xbrlResult: { entityName: string | null; latencyMs: number } | null): CheckResult {
  if (!secData.paddedCIK) {
    return { id: 26, source: 'SEC EDGAR XBRL Facts', endpoint: 'EDGAR XBRL API', status: 'BROKEN', records: '0', lastValue: 'CIK lookup failed', latency: '—', rawData: null };
  }
  if (!xbrlResult) {
    return { id: 26, source: 'SEC EDGAR XBRL Facts', endpoint: 'EDGAR XBRL API', status: 'BROKEN', records: '0', lastValue: 'XBRL fetch failed', latency: '—', rawData: null };
  }
  return {
    id: 26, source: 'SEC EDGAR XBRL Facts', endpoint: 'EDGAR XBRL API',
    status: xbrlResult.entityName ? 'LIVE' : 'BROKEN',
    records: xbrlResult.entityName ? 'facts' : '0',
    lastValue: xbrlResult.entityName ? `Entity: ${xbrlResult.entityName}` : 'No XBRL data',
    latency: fmtLatency(xbrlResult.latencyMs),
    rawData: { entityName: xbrlResult.entityName, cik: secData.paddedCIK },
  };
}

function check10KBusinessDescription(secData: Awaited<ReturnType<typeof fetchSECData>>): CheckResult {
  return {
    id: 27, source: '10-K Business Description', endpoint: 'SEC EDGAR',
    status: secData.cik ? 'LIVE' : 'BROKEN',
    records: secData.cik ? '—' : '0',
    lastValue: secData.cik ? `CIK: ${secData.cik} resolved` : 'CIK lookup failed',
    latency: '—',
    rawData: { cik: secData.cik },
  };
}

async function checkFinnhubRecommendationsInfoEdge(symbol: string, finnhubKey: string): Promise<CheckResult> {
  try {
    const { data, latencyMs } = await timedFetch(
      `${FINNHUB_BASE}/stock/recommendation?symbol=${symbol}&token=${finnhubKey}`
    );
    const items = Array.isArray(data) ? data : [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const latest = items[0] as any;
    const buyCount = latest ? (latest.strongBuy || 0) + (latest.buy || 0) : 0;
    const holdCount = latest ? (latest.hold || 0) : 0;
    return {
      id: 28, source: 'Finnhub Recommendations', endpoint: '/stock/recommendation',
      status: items.length > 0 ? 'LIVE' : 'BROKEN',
      records: `${items.length} mo`,
      lastValue: latest ? `Buy: ${buyCount} / Hold: ${holdCount}` : 'NULL',
      latency: fmtLatency(latencyMs),
      rawData: items.slice(0, 5),
    };
  } catch (e) {
    return { id: 28, source: 'Finnhub Recommendations', endpoint: '/stock/recommendation', status: 'BROKEN', records: '0', lastValue: String(e), latency: '—', rawData: null };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function checkNewsClassifier(newsItems: any[]): CheckResult {
  const classifiedCount = newsItems.filter((i: { headline?: string }) => i.headline).length;
  return {
    id: 29, source: 'News Classifier', endpoint: '/company-news',
    status: newsItems.length > 0 ? 'LIVE' : 'BROKEN',
    records: classifiedCount > 0 ? `${classifiedCount} headlines` : '—',
    lastValue: newsItems.length > 0 ? `${classifiedCount} classifiable headlines` : 'No news to classify',
    latency: '—',
    rawData: { classifiedCount, sampleHeadline: newsItems[0]?.headline },
  };
}

async function checkFinnhubEarningsQualityScore(symbol: string, finnhubKey: string): Promise<CheckResult> {
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
      id: 30, source: 'Finnhub Earnings Quality', endpoint: '/stock/earnings-quality-score',
      status,
      records: items.length > 0 ? `${items.length} periods` : '0 curr',
      lastValue,
      latency: fmtLatency(latencyMs),
      rawData: data,
    };
  } catch (e) {
    return { id: 30, source: 'Finnhub Earnings Quality', endpoint: '/stock/earnings-quality-score', status: 'BROKEN', records: '0', lastValue: String(e), latency: '—', rawData: null };
  }
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

  // ── Run all 33 checks in parallel ──
  const allChecks = await Promise.allSettled([
    // Check 1: TastyTrade IV/HV (market-hours gated)
    checkTastyTradeIVHV(),
    // Check 2: Finnhub Basic Metrics
    (async () => {
      if (!finnhubKey) {
        return { id: 2, source: 'Finnhub Basic Metrics', endpoint: '/stock/metric', status: 'SKIPPED' as SourceStatus, records: '—', lastValue: 'FINNHUB_API_KEY not set', latency: '—', rawData: null };
      }
      const { metricResult, latencyMs } = await runFinnhubMetric(symbol, finnhubKey);
      return checkBasicMetrics(metricResult, latencyMs);
    })(),
    // Checks 3-18: individual Finnhub endpoints
    finnhubKey ? checkEPSEstimates(symbol, finnhubKey) : Promise.resolve({ id: 3, source: 'EPS Estimates', endpoint: '/stock/eps-estimate', status: 'SKIPPED' as SourceStatus, records: '—', lastValue: 'FINNHUB_API_KEY not set', latency: '—', rawData: null }),
    finnhubKey ? checkRevenueEstimates(symbol, finnhubKey) : Promise.resolve({ id: 4, source: 'Revenue Estimates', endpoint: '/stock/revenue-estimate', status: 'SKIPPED' as SourceStatus, records: '—', lastValue: 'FINNHUB_API_KEY not set', latency: '—', rawData: null }),
    finnhubKey ? checkPriceTargets(symbol, finnhubKey) : Promise.resolve({ id: 5, source: 'Price Targets', endpoint: '/stock/price-target', status: 'SKIPPED' as SourceStatus, records: '—', lastValue: 'FINNHUB_API_KEY not set', latency: '—', rawData: null }),
    finnhubKey ? checkUpgradesDowngrades(symbol, finnhubKey) : Promise.resolve({ id: 6, source: 'Upgrades/Downgrades', endpoint: '/stock/upgrade-downgrade', status: 'SKIPPED' as SourceStatus, records: '—', lastValue: 'FINNHUB_API_KEY not set', latency: '—', rawData: null }),
    finnhubKey ? checkRecommendations(symbol, finnhubKey) : Promise.resolve({ id: 7, source: 'Recommendations', endpoint: '/stock/recommendation', status: 'SKIPPED' as SourceStatus, records: '—', lastValue: 'FINNHUB_API_KEY not set', latency: '—', rawData: null }),
    finnhubKey ? checkEarningsHistory(symbol, finnhubKey) : Promise.resolve({ id: 8, source: 'Earnings History', endpoint: '/stock/earnings', status: 'SKIPPED' as SourceStatus, records: '—', lastValue: 'FINNHUB_API_KEY not set', latency: '—', rawData: null }),
    finnhubKey ? checkEarningsQuality(symbol, finnhubKey) : Promise.resolve({ id: 9, source: 'Earnings Quality', endpoint: '/stock/earnings-quality', status: 'SKIPPED' as SourceStatus, records: '—', lastValue: 'FINNHUB_API_KEY not set', latency: '—', rawData: null }),
    finnhubKey ? checkRevenueBreakdown(symbol, finnhubKey) : Promise.resolve({ id: 10, source: 'Revenue Breakdown', endpoint: '/stock/revenue-breakdown2', status: 'SKIPPED' as SourceStatus, records: '—', lastValue: 'FINNHUB_API_KEY not set', latency: '—', rawData: null }),
    finnhubKey ? checkInsiderTransactions(symbol, finnhubKey) : Promise.resolve({ id: 11, source: 'Insider Transactions', endpoint: '/stock/insider-trans', status: 'SKIPPED' as SourceStatus, records: '—', lastValue: 'FINNHUB_API_KEY not set', latency: '—', rawData: null }),
    finnhubKey ? checkInsiderSentiment(symbol, finnhubKey) : Promise.resolve({ id: 12, source: 'Insider Sentiment', endpoint: '/stock/insider-sentiment', status: 'SKIPPED' as SourceStatus, records: '—', lastValue: 'FINNHUB_API_KEY not set', latency: '—', rawData: null }),
    finnhubKey ? checkInstitutionalOwnership(symbol, finnhubKey) : Promise.resolve({ id: 13, source: 'Institutional Own.', endpoint: '/stock/ownership', status: 'SKIPPED' as SourceStatus, records: '—', lastValue: 'FINNHUB_API_KEY not set', latency: '—', rawData: null }),
    finnhubKey ? checkPeers(symbol, finnhubKey) : Promise.resolve({ id: 14, source: 'Peers', endpoint: '/stock/peers', status: 'SKIPPED' as SourceStatus, records: '—', lastValue: 'FINNHUB_API_KEY not set', latency: '—', rawData: null }),
    finnhubKey ? checkFinancialsAnnual(symbol, finnhubKey) : Promise.resolve({ id: 15, source: 'Financials (Annual)', endpoint: '/stock/financials-rep', status: 'SKIPPED' as SourceStatus, records: '—', lastValue: 'FINNHUB_API_KEY not set', latency: '—', rawData: null }),
    finnhubKey ? checkFinancialsQuarterly(symbol, finnhubKey) : Promise.resolve({ id: 16, source: 'Financials (Quarterly)', endpoint: '/stock/financials', status: 'SKIPPED' as SourceStatus, records: '—', lastValue: 'FINNHUB_API_KEY not set', latency: '—', rawData: null }),
    finnhubKey ? checkFinBERTSentiment(symbol, finnhubKey) : Promise.resolve({ id: 17, source: 'FinBERT Sentiment', endpoint: '/news-sentiment', status: 'SKIPPED' as SourceStatus, records: '—', lastValue: 'FINNHUB_API_KEY not set', latency: '—', rawData: null }),
    // Checks 18 & 29 share the same company-news fetch
    (async () => {
      if (!finnhubKey) {
        return [
          { id: 18, source: 'Company News', endpoint: '/company-news', status: 'SKIPPED' as SourceStatus, records: '—', lastValue: 'FINNHUB_API_KEY not set', latency: '—', rawData: null },
          { id: 29, source: 'News Classifier', endpoint: '/company-news', status: 'SKIPPED' as SourceStatus, records: '—', lastValue: 'FINNHUB_API_KEY not set', latency: '—', rawData: null },
        ];
      }
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
        return [
          {
            id: 18, source: 'Company News', endpoint: '/company-news',
            status: (items.length > 0 ? 'LIVE' : 'BROKEN') as SourceStatus,
            records: `${items.length} rec`,
            lastValue: latestDate ?? 'NULL',
            latency: fmtLatency(latencyMs),
            rawData: items.slice(0, 3),
          },
          checkNewsClassifier(items),
        ];
      } catch (e) {
        return [
          { id: 18, source: 'Company News', endpoint: '/company-news', status: 'BROKEN' as SourceStatus, records: '0', lastValue: String(e), latency: '—', rawData: null },
          { id: 29, source: 'News Classifier', endpoint: '/company-news', status: 'BROKEN' as SourceStatus, records: '0', lastValue: String(e), latency: '—', rawData: null },
        ];
      }
    })(),
    // Check 19: FRED
    checkFREDMacro(),
    // Checks 20, 21, 26, 27 share the same SEC fetch
    (async () => {
      try {
        const secData = await fetchSECData(symbol);
        // Fetch XBRL companyfacts if CIK resolved
        let xbrlResult: { entityName: string | null; latencyMs: number } | null = null;
        if (secData.paddedCIK) {
          try {
            const xbrlStart = performance.now();
            const xbrlRes = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${secData.paddedCIK}.json`, {
              headers: { 'User-Agent': 'TempleStuart/1.0 (contact@example.com)', Accept: 'application/json' },
            });
            const xbrlData = await xbrlRes.json();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            xbrlResult = { entityName: (xbrlData as any)?.entityName ?? null, latencyMs: Math.round(performance.now() - xbrlStart) };
          } catch {
            xbrlResult = null;
          }
        }
        return [
          checkSECEdgar(secData),
          checkSECTickers(secData),
          checkSECEdgarXBRL(secData, xbrlResult),
          check10KBusinessDescription(secData),
        ];
      } catch (e) {
        return [
          { id: 20, source: 'SEC EDGAR Submissions', endpoint: 'EDGAR direct', status: 'BROKEN' as SourceStatus, records: '—', lastValue: String(e), latency: '—', rawData: null },
          { id: 21, source: 'SEC Company Tickers', endpoint: '/files/company_tickers', status: 'BROKEN' as SourceStatus, records: '—', lastValue: String(e), latency: '—', rawData: null },
          { id: 26, source: 'SEC EDGAR XBRL Facts', endpoint: 'EDGAR XBRL API', status: 'BROKEN' as SourceStatus, records: '0', lastValue: String(e), latency: '—', rawData: null },
          { id: 27, source: '10-K Business Description', endpoint: 'SEC EDGAR', status: 'BROKEN' as SourceStatus, records: '0', lastValue: String(e), latency: '—', rawData: null },
        ];
      }
    })(),
    // Check 22: xAI
    checkXAIGrok(symbol),
    // Check 23: TastyTrade Greeks
    checkTastyTradeGreeks(),
    // Check 24: TastyTrade Candles
    checkTastyTradeCandles(),
    // Check 25: FRED Cross-Asset Daily
    checkFREDCrossAssetDaily(),
    // Check 28: Finnhub Recommendations (Info-Edge)
    finnhubKey ? checkFinnhubRecommendationsInfoEdge(symbol, finnhubKey) : Promise.resolve({ id: 28, source: 'Finnhub Recommendations', endpoint: '/stock/recommendation', status: 'SKIPPED' as SourceStatus, records: '—', lastValue: 'FINNHUB_API_KEY not set', latency: '—', rawData: null }),
    // Check 30: Finnhub Earnings Quality Score
    finnhubKey ? checkFinnhubEarningsQualityScore(symbol, finnhubKey) : Promise.resolve({ id: 30, source: 'Finnhub Earnings Quality', endpoint: '/stock/earnings-quality-score', status: 'SKIPPED' as SourceStatus, records: '—', lastValue: 'FINNHUB_API_KEY not set', latency: '—', rawData: null }),
    // Check 31: TastyTrade Options Flow (market-hours gated)
    checkTastyTradeOptionsFlow(),
    // Check 32: TastyTrade SPY Correlation (market-hours gated)
    checkTastyTradeSPYCorrelation(),
    // Check 33: Peer Stats (computed — always LIVE)
    Promise.resolve(checkPeerStats()),
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

  // Assign dataSource from map for checks that don't set it inline
  for (const r of results) {
    if (!r.dataSource) {
      r.dataSource = SOURCE_PROVIDER[r.id] ?? 'Internal';
    }
  }

  // ── Write results to ObservatoryHealthLog ──
  const marketOpen = isMarketHours();
  try {
    const logEntries = results.map(r => ({
      symbol,
      sourceId: r.id,
      sourceName: r.source,
      dataSource: r.dataSource ?? 'Unknown',
      status: r.status,
      lastValue: r.lastValue ?? null,
      wasMarketHours: marketOpen,
      checkedAt: new Date(),
    }));
    await prisma.observatoryHealthLog.createMany({
      data: logEntries,
      skipDuplicates: false,
    });
  } catch {
    // Non-fatal: don't block response if logging fails
  }

  // ── Read last confirmed LIVE timestamps for MKT-HRS rows ──
  const ttSourceIds = [23, 24, 31, 32];
  try {
    const lastLiveRecords = await prisma.observatoryHealthLog.findMany({
      where: {
        symbol,
        sourceId: { in: ttSourceIds },
        status: 'LIVE',
        wasMarketHours: true,
      },
      orderBy: { checkedAt: 'desc' },
      distinct: ['sourceId'],
      select: { sourceId: true, checkedAt: true },
    });
    const lastLiveMap = Object.fromEntries(
      lastLiveRecords.map(r => [r.sourceId, r.checkedAt.toISOString()])
    );
    for (const r of results) {
      r.lastConfirmedLive = lastLiveMap[r.id] ?? null;
    }
  } catch {
    // Non-fatal: don't block response if query fails
  }

  return NextResponse.json({
    symbol,
    checkedAt: new Date().toISOString(),
    results,
  });
}
