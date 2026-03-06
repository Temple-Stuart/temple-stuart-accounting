'use client';

import { useState, useCallback } from 'react';
import { AppLayout, Badge } from '@/components/ui';

// ─── Types ──────────────────────────────────────────────────────────────────

type SourceStatus = 'LIVE' | 'BROKEN' | 'PARTIAL' | 'MKT-HRS' | 'SKIPPED';
type DataProvider = 'TastyTrade' | 'Finnhub' | 'FRED' | 'SEC' | 'xAI' | 'Internal';
type GateName = 'Vol-Edge' | 'Quality' | 'Info-Edge' | 'Regime' | 'All';

interface DataSource {
  id: number;
  source: string;
  endpoint: string;
  status: SourceStatus;
  records: string;
  lastValue: string;
  latency: string;
  rawData?: unknown;
  dataSource: DataProvider;
  gate: GateName;
  lastConfirmedLive?: string;
}

interface CheckResponse {
  symbol: string;
  checkedAt: string;
  results: DataSource[];
}

// ─── Sample Data (fallback when no live results) ────────────────────────────

const SYMBOLS = ['MSFT', 'BAC', 'NFLX'];

const HARDCODED_SOURCES: DataSource[] = [
  { id: 1,  source: 'TastyTrade IV/HV',       endpoint: 'TastyTrade API',           status: 'MKT-HRS',  records: '—',        lastValue: 'Requires open market',    latency: '—',    dataSource: 'TastyTrade', gate: 'Vol-Edge' },
  { id: 2,  source: 'Finnhub Basic Metrics',   endpoint: '/stock/metric',            status: 'PARTIAL',  records: '8 fields', lastValue: 'beta: 1.09',              latency: '12ms', dataSource: 'Finnhub',    gate: 'Quality' },
  { id: 3,  source: 'EPS Estimates',           endpoint: '/stock/eps-estimate',      status: 'LIVE',     records: '4 qtrs',   lastValue: 'Next: $3.28 avg',         latency: '8ms',  dataSource: 'Finnhub',    gate: 'Info-Edge' },
  { id: 4,  source: 'Revenue Estimates',       endpoint: '/stock/revenue-estimate',  status: 'LIVE',     records: '4 qtrs',   lastValue: 'Next: $72.1B',            latency: '9ms',  dataSource: 'Finnhub',    gate: 'Info-Edge' },
  { id: 5,  source: 'Price Targets',           endpoint: '/stock/price-target',      status: 'LIVE',     records: '59 anal',  lastValue: 'Mean: $608',              latency: '7ms',  dataSource: 'Finnhub',    gate: 'Info-Edge' },
  { id: 6,  source: 'Upgrades/Downgrades',     endpoint: '/stock/upgrade-downgrade', status: 'PARTIAL',  records: '5 rec',    lastValue: 'down by Stifel (date pending)', latency: '11ms', dataSource: 'Finnhub',    gate: 'Info-Edge' },
  { id: 7,  source: 'Recommendations',         endpoint: '/stock/recommendation',    status: 'LIVE',     records: '4 mo',     lastValue: 'Buy: 60 / Hold: 6',      latency: '6ms',  dataSource: 'Finnhub',    gate: 'Info-Edge' },
  { id: 8,  source: 'Earnings History',        endpoint: '/stock/earnings',          status: 'LIVE',     records: '40 qtrs',  lastValue: 'Beat rate: 87%',          latency: '14ms', dataSource: 'Finnhub',    gate: 'Quality' },
  { id: 9,  source: 'Earnings Quality',        endpoint: '/stock/earnings-quality',  status: 'BROKEN',   records: '0 curr',   lastValue: 'Returning 1983 data',     latency: '18ms', dataSource: 'Finnhub',    gate: 'Quality' },
  { id: 10, source: 'Revenue Breakdown',       endpoint: '/stock/revenue-breakdown2',status: 'PARTIAL',  records: '3 seg',    lastValue: 'Parser bug',              latency: '10ms', dataSource: 'Finnhub',    gate: 'Quality' },
  { id: 11, source: 'Insider Transactions',    endpoint: '/stock/insider-trans',     status: 'LIVE',     records: '5 rec',    lastValue: 'F: -639 (2026-03-02)',    latency: '9ms',  dataSource: 'Finnhub',    gate: 'Info-Edge' },
  { id: 12, source: 'Insider Sentiment',       endpoint: '/stock/insider-sentiment', status: 'BROKEN',   records: '0',        lastValue: 'Empty response',          latency: '8ms',  dataSource: 'Finnhub',    gate: 'Info-Edge' },
  { id: 13, source: 'Institutional Own.',      endpoint: '/stock/ownership',         status: 'PARTIAL',  records: '5 hold',   lastValue: 'Names: NULL',             latency: '13ms', dataSource: 'Finnhub',    gate: 'Info-Edge' },
  { id: 14, source: 'Peers',                   endpoint: '/stock/peers',             status: 'LIVE',     records: '12 sym',   lastValue: 'ORCL, PLTR, CRM...',      latency: '5ms',  dataSource: 'Finnhub',    gate: 'All' },
  { id: 15, source: 'Financials (Annual)',      endpoint: '/stock/financials-rep',    status: 'BROKEN',   records: '0 curr',   lastValue: 'All fields NULL',         latency: '16ms', dataSource: 'Finnhub',    gate: 'Quality' },
  { id: 16, source: 'Financials (Quarterly)',   endpoint: '/stock/financials',        status: 'PARTIAL',  records: '4 qtrs',   lastValue: 'grossIncome: PARTIAL',    latency: '11ms', dataSource: 'Finnhub',    gate: 'Quality' },
  { id: 17, source: 'FinBERT Sentiment',       endpoint: '/news-sentiment',          status: 'LIVE',     records: '—',        lastValue: 'Bullish: 0.93',           latency: '22ms', dataSource: 'Finnhub',    gate: 'Info-Edge' },
  { id: 18, source: 'Company News',            endpoint: '/company-news',            status: 'LIVE',     records: '3 rec',    lastValue: '2026-03-04',              latency: '19ms', dataSource: 'Finnhub',    gate: 'Info-Edge' },
  { id: 19, source: 'FRED Macro (14 series)',  endpoint: 'FRED API',                 status: 'LIVE',     records: '14 ser',   lastValue: 'VIX: 22.1, 10Y: 4.31%',  latency: '31ms', dataSource: 'FRED',       gate: 'Regime' },
  { id: 20, source: 'SEC EDGAR Submissions',   endpoint: 'EDGAR direct',             status: 'LIVE',     records: '—',        lastValue: 'CIK: 789019',            latency: '44ms', dataSource: 'SEC',        gate: 'Info-Edge' },
  { id: 21, source: 'SEC Company Tickers',     endpoint: '/files/company_tickers',   status: 'LIVE',     records: '—',        lastValue: 'CIK: 789019',            latency: '12ms', dataSource: 'SEC',        gate: 'Info-Edge' },
  { id: 22, source: 'xAI/Grok Sentiment',      endpoint: 'xAI API',                  status: 'LIVE',     records: '—',        lastValue: 'Bullish',                 latency: '287ms',dataSource: 'xAI',        gate: 'Info-Edge' },
  { id: 23, source: 'TastyTrade Greeks',       endpoint: 'TastyTrade API',           status: 'MKT-HRS', records: '—',        lastValue: 'Requires open market',    latency: '—',    dataSource: 'TastyTrade', gate: 'Vol-Edge' },
  { id: 24, source: 'TastyTrade Candles',      endpoint: 'TastyTrade API',           status: 'MKT-HRS', records: '—',        lastValue: 'Requires open market',    latency: '—',    dataSource: 'TastyTrade', gate: 'Vol-Edge' },
  { id: 25, source: 'FRED Cross-Asset Daily',  endpoint: 'FRED API',                 status: 'LIVE',     records: '3 series', lastValue: 'DGS10/SP500/OIL',         latency: '—',    dataSource: 'FRED',       gate: 'Regime' },
  { id: 26, source: 'SEC EDGAR XBRL Facts',    endpoint: 'EDGAR XBRL API',           status: 'BROKEN',   records: '0',        lastValue: 'CIK lookup failed',       latency: '—',    dataSource: 'SEC',        gate: 'Info-Edge' },
  { id: 27, source: '10-K Business Description', endpoint: 'SEC EDGAR',              status: 'BROKEN',   records: '0',        lastValue: 'CIK lookup failed',       latency: '—',    dataSource: 'SEC',        gate: 'All' },
  { id: 28, source: 'Finnhub Recommendations', endpoint: '/stock/recommendation',    status: 'LIVE',     records: '4 mo',     lastValue: 'Buy: 60 / Hold: 6',      latency: '—',    dataSource: 'Finnhub',    gate: 'Info-Edge' },
  { id: 29, source: 'News Classifier',         endpoint: '/company-news',            status: 'LIVE',     records: '—',        lastValue: 'Bullish: 0.87',           latency: '—',    dataSource: 'Internal',   gate: 'Info-Edge' },
  { id: 30, source: 'Finnhub Earnings Quality', endpoint: '/stock/earnings-quality-score', status: 'BROKEN', records: '0 curr', lastValue: 'Returning 1983 data',  latency: '—',    dataSource: 'Finnhub',    gate: 'Quality' },
  { id: 31, source: 'TastyTrade Options Flow', endpoint: 'TastyTrade chain API', status: 'MKT-HRS', records: '—', lastValue: 'Requires open market', latency: '—', dataSource: 'TastyTrade', gate: 'Vol-Edge' },
  { id: 32, source: 'TastyTrade SPY Correlation', endpoint: 'TastyTrade API', status: 'MKT-HRS', records: '—', lastValue: 'Requires open market', latency: '—', dataSource: 'TastyTrade', gate: 'Regime' },
  { id: 33, source: 'Peer Stats (computed)', endpoint: 'Derived: Finnhub peers + 10-K', status: 'LIVE', records: '—', lastValue: 'Computed from peers + sectors', latency: '—', dataSource: 'Internal', gate: 'All' },
];

const HARDCODED_STATUS_COUNTS: { label: string; status: SourceStatus; count: number; colorClass: string }[] = [
  { label: 'LIVE',     status: 'LIVE',     count: 17, colorClass: 'text-brand-green' },
  { label: 'PARTIAL',  status: 'PARTIAL',  count: 5,  colorClass: 'text-brand-amber' },
  { label: 'BROKEN',   status: 'BROKEN',   count: 6,  colorClass: 'text-brand-red' },
  { label: 'MKT-HRS',  status: 'MKT-HRS',  count: 5,  colorClass: 'text-brand-gold' },
  { label: 'SKIPPED',  status: 'SKIPPED',  count: 0,  colorClass: 'text-text-muted' },
];

const HARDCODED_SCANNER_GATES: { name: string; ok: boolean; detail: string }[] = [
  { name: 'Vol-Edge',  ok: false, detail: 'IV/HV null' },
  { name: 'Quality',   ok: false, detail: 'D/E null, earnings quality broken' },
  { name: 'Info-Edge', ok: false, detail: 'MSPR broken, filing dates null' },
  { name: 'Regime',    ok: true,  detail: 'FRED flowing' },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function statusBadgeVariant(status: SourceStatus): 'success' | 'danger' | 'warning' | 'gold' | 'default' {
  switch (status) {
    case 'LIVE':     return 'success';
    case 'BROKEN':   return 'danger';
    case 'PARTIAL':  return 'warning';
    case 'MKT-HRS':  return 'gold';
    case 'SKIPPED':  return 'default';
  }
}

const STATUS_COLOR_MAP: Record<SourceStatus, string> = {
  LIVE: 'text-brand-green',
  PARTIAL: 'text-brand-amber',
  BROKEN: 'text-brand-red',
  'MKT-HRS': 'text-brand-gold',
  SKIPPED: 'text-text-muted',
};

const PROVIDER_BADGE_CLASSES: Record<DataProvider, string> = {
  TastyTrade: 'bg-yellow-50 text-yellow-700 border border-yellow-200 font-mono',
  Finnhub:    'bg-purple-50 text-purple-700 border border-purple-200 font-mono',
  FRED:       'bg-green-50 text-green-700 border border-green-200 font-mono',
  SEC:        'bg-blue-50 text-blue-700 border border-blue-200 font-mono',
  xAI:        'bg-orange-50 text-orange-700 border border-orange-200 font-mono',
  Internal:   'bg-gray-50 text-gray-500 border border-gray-200 font-mono',
};

function formatLastLive(iso: string): string {
  const d = new Date(iso);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const month = months[d.getMonth()];
  const day = d.getDate();
  const hours = d.getHours();
  const mins = d.getMinutes().toString().padStart(2, '0');
  return `${month} ${day}, ${hours}:${mins} ET`;
}

// Map source ID to gate for live results (API doesn't return gate)
const SOURCE_GATE_MAP: Record<number, GateName> = {
  1: 'Vol-Edge', 2: 'Quality', 3: 'Info-Edge', 4: 'Info-Edge', 5: 'Info-Edge',
  6: 'Info-Edge', 7: 'Info-Edge', 8: 'Quality', 9: 'Quality', 10: 'Quality',
  11: 'Info-Edge', 12: 'Info-Edge', 13: 'Info-Edge', 14: 'All', 15: 'Quality',
  16: 'Quality', 17: 'Info-Edge', 18: 'Info-Edge', 19: 'Regime', 20: 'Info-Edge',
  21: 'Info-Edge', 22: 'Info-Edge', 23: 'Vol-Edge', 24: 'Vol-Edge', 25: 'Regime',
  26: 'Info-Edge', 27: 'All', 28: 'Info-Edge', 29: 'Info-Edge', 30: 'Quality',
  31: 'Vol-Edge', 32: 'Regime', 33: 'All',
};

const SOURCE_PROVIDER_MAP: Record<number, DataProvider> = {
  1: 'Finnhub', 2: 'Finnhub', 3: 'Finnhub', 4: 'Finnhub', 5: 'Finnhub',
  6: 'Finnhub', 7: 'Finnhub', 8: 'Finnhub', 9: 'Finnhub', 10: 'Finnhub',
  11: 'Finnhub', 12: 'Finnhub', 13: 'Finnhub', 14: 'Finnhub', 15: 'Finnhub',
  16: 'Finnhub', 17: 'Finnhub', 18: 'Finnhub', 19: 'FRED', 20: 'SEC',
  21: 'SEC', 22: 'xAI', 23: 'TastyTrade', 24: 'TastyTrade', 25: 'FRED',
  26: 'SEC', 27: 'SEC', 28: 'Finnhub', 29: 'Internal', 30: 'Finnhub',
  31: 'TastyTrade', 32: 'TastyTrade', 33: 'Internal',
};

function enrichLiveResults(results: DataSource[]): DataSource[] {
  return results.map(r => ({
    ...r,
    gate: SOURCE_GATE_MAP[r.id] ?? 'All',
    dataSource: (r.dataSource as DataProvider) || SOURCE_PROVIDER_MAP[r.id] || 'Internal',
  }));
}

function computeStatusCounts(rows: DataSource[]) {
  const counts: Record<SourceStatus, number> = { LIVE: 0, PARTIAL: 0, BROKEN: 0, 'MKT-HRS': 0, SKIPPED: 0 };
  for (const r of rows) counts[r.status] = (counts[r.status] || 0) + 1;
  return (['LIVE', 'PARTIAL', 'BROKEN', 'MKT-HRS', 'SKIPPED'] as SourceStatus[]).map(s => ({
    label: s, status: s, count: counts[s], colorClass: STATUS_COLOR_MAP[s],
  }));
}

function computeScannerGates(rows: DataSource[]) {
  const byId = new Map(rows.map(r => [r.id, r]));
  const ivhv = byId.get(1);
  const earningsQ = byId.get(9);
  const insiderSent = byId.get(12);
  const financialsA = byId.get(15);
  const fred = byId.get(19);

  return [
    {
      name: 'Vol-Edge',
      ok: ivhv?.status === 'LIVE',
      detail: ivhv?.status === 'LIVE' ? 'IV/HV flowing' : 'IV/HV null',
    },
    {
      name: 'Quality',
      ok: earningsQ?.status === 'LIVE' && financialsA?.status === 'LIVE',
      detail: earningsQ?.status !== 'LIVE' ? 'Earnings quality broken' : (financialsA?.status !== 'LIVE' ? 'Financials broken' : 'Quality data flowing'),
    },
    {
      name: 'Info-Edge',
      ok: insiderSent?.status === 'LIVE',
      detail: insiderSent?.status === 'LIVE' ? 'Insider data flowing' : 'MSPR broken, filing dates null',
    },
    {
      name: 'Regime',
      ok: fred?.status === 'LIVE',
      detail: fred?.status === 'LIVE' ? 'FRED flowing' : 'FRED broken',
    },
  ];
}

// ─── Component ──────────────────────────────────────────────────────────────

export function DataObservatory() {
  const [selectedSymbol, setSelectedSymbol] = useState('MSFT');
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [liveResults, setLiveResults] = useState<DataSource[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleRow = (id: number) => {
    setExpandedRow(prev => (prev === id ? null : id));
  };

  const runCheck = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/data-observatory/check?symbol=${selectedSymbol}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data: CheckResponse = await res.json();
      setLiveResults(enrichLiveResults(data.results));
      setCheckedAt(data.checkedAt);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Check failed');
    } finally {
      setLoading(false);
    }
  }, [selectedSymbol]);

  // Use live results if available, otherwise hardcoded
  const displayRows = liveResults ?? HARDCODED_SOURCES;
  const statusCounts = liveResults ? computeStatusCounts(liveResults) : HARDCODED_STATUS_COUNTS;
  const scannerGates = liveResults ? computeScannerGates(liveResults) : HARDCODED_SCANNER_GATES;

  return (
    <>
      {/* ── Header Bar ──────────────────────────────────────────────── */}
      <div className="bg-brand-purple">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs font-semibold text-white font-mono uppercase tracking-wider">
            Data Observatory
          </span>
          <div className="flex items-center gap-2">
            {error && (
              <span className="text-xs font-mono text-red-300">{error}</span>
            )}
            <select
              value={selectedSymbol}
              onChange={e => setSelectedSymbol(e.target.value)}
              disabled={loading}
              className="bg-brand-purple-deep text-white text-xs font-mono px-2 py-1 border border-white/10 rounded focus:outline-none focus:ring-1 focus:ring-brand-gold disabled:opacity-50"
            >
              {SYMBOLS.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <button
              onClick={runCheck}
              disabled={loading}
              className="bg-brand-gold text-white text-xs font-semibold font-mono px-3 py-1 rounded hover:bg-brand-gold-bright transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {loading && (
                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {loading ? 'CHECKING...' : 'RUN CHECK'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Content ────────────────────────────────────────────── */}
      <div className="p-4 lg:p-6">
        <div className="flex flex-col lg:flex-row gap-4">

          {/* ── Left Column: Data Source Table ──────────────────────── */}
          <div className="flex-1 min-w-0">
            <div className="bg-white border border-border shadow-sm overflow-hidden">
              <div className="bg-brand-purple-hover text-white px-4 py-2 text-xs font-semibold uppercase tracking-wider font-mono">
                Data Sources — {selectedSymbol}
                {liveResults && <span className="ml-2 opacity-60">(live)</span>}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-bg-row sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-text-muted w-8">#</th>
                      <th className="px-3 py-2 text-left font-medium text-text-muted">PROVIDER</th>
                      <th className="px-3 py-2 text-left font-medium text-text-muted">GATE</th>
                      <th className="px-3 py-2 text-left font-medium text-text-muted">SOURCE</th>
                      <th className="px-3 py-2 text-left font-medium text-text-muted">ENDPOINT</th>
                      <th className="px-3 py-2 text-center font-medium text-text-muted">STATUS</th>
                      <th className="px-3 py-2 text-right font-medium text-text-muted">RECORDS</th>
                      <th className="px-3 py-2 text-left font-medium text-text-muted">LAST VALUE</th>
                      <th className="px-3 py-2 text-right font-medium text-text-muted">LATENCY</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {displayRows.map(row => (
                      <>
                        <tr
                          key={row.id}
                          onClick={() => toggleRow(row.id)}
                          className="hover:bg-bg-row cursor-pointer transition-colors"
                        >
                          <td className="px-3 py-2 font-mono text-text-muted">{row.id}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-block px-1.5 py-0.5 text-[10px] rounded ${PROVIDER_BADGE_CLASSES[row.dataSource]}`}>
                              {row.dataSource}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs font-mono text-gray-500">{row.gate}</td>
                          <td className="px-3 py-2 font-medium text-text-primary">{row.source}</td>
                          <td className="px-3 py-2 font-mono text-text-secondary">{row.endpoint}</td>
                          <td className="px-3 py-2 text-center">
                            <Badge variant={statusBadgeVariant(row.status)} size="sm">{row.status}</Badge>
                            {row.status === 'MKT-HRS' && (
                              row.lastConfirmedLive
                                ? <div className="text-[9px] text-brand-green font-mono mt-0.5">Last LIVE: {formatLastLive(row.lastConfirmedLive)}</div>
                                : <div className="text-[9px] text-text-muted font-mono mt-0.5">Never confirmed</div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-text-secondary">{row.records}</td>
                          <td className="px-3 py-2 font-mono text-text-primary">{row.lastValue}</td>
                          <td className="px-3 py-2 text-right font-mono text-text-muted">{row.latency}</td>
                        </tr>
                        {expandedRow === row.id && (
                          <tr key={`${row.id}-detail`}>
                            <td colSpan={9} className="px-0 py-0">
                              <div className="bg-bg-row border-t border-border px-4 py-3">
                                <pre className="font-mono text-terminal-sm text-text-muted whitespace-pre-wrap">{
                                  row.rawData
                                    ? JSON.stringify(row.rawData, null, 2)
                                    : `// raw data will appear here when API is wired\n{\n  "source": "${row.source}",\n  "endpoint": "${row.endpoint}",\n  "symbol": "${selectedSymbol}",\n  "status": "${row.status}",\n  "data": null\n}`
                                }</pre>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ── Right Column: System Status Panel ──────────────────── */}
          <div className="w-full lg:w-72 flex-shrink-0">
            <div className="bg-white border border-border shadow-sm overflow-hidden">
              {/* Panel Header */}
              <div className="bg-brand-purple-hover text-white px-4 py-2 text-xs font-semibold uppercase tracking-wider font-mono">
                System Status
              </div>

              {/* Status Counts */}
              <div className="p-3 border-b border-border">
                <div className="space-y-1.5">
                  {statusCounts.map(s => (
                    <div key={s.label} className="flex items-center justify-between">
                      <Badge variant={statusBadgeVariant(s.status)} size="sm">{s.label}</Badge>
                      <span className={`font-mono font-semibold text-sm ${s.colorClass}`}>{s.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Scanner Readiness */}
              <div className="p-3 border-b border-border">
                <div className="text-[9px] text-text-muted uppercase tracking-wider font-mono mb-2">Scanner Readiness</div>
                <div className="space-y-1.5">
                  {scannerGates.map(gate => (
                    <div key={gate.name} className="flex items-start gap-2">
                      <span className="flex-shrink-0 mt-px">
                        {gate.ok
                          ? <Badge variant="success" size="sm">LIVE</Badge>
                          : <Badge variant="warning" size="sm">DEGRADED</Badge>
                        }
                      </span>
                      <div className="min-w-0">
                        <span className="text-terminal-sm font-semibold text-text-primary font-mono">{gate.name}</span>
                        <span className="text-terminal-xs text-text-muted font-mono ml-1">({gate.detail})</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Last Checked */}
              <div className="p-3">
                <div className="text-[9px] text-text-muted uppercase tracking-wider font-mono mb-1">Last Checked</div>
                <span className="text-terminal-sm font-mono text-text-faint">
                  {checkedAt ? new Date(checkedAt).toLocaleString() : '—'}
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}

export default function DataObservatoryPage() {
  return (
    <AppLayout>
      <DataObservatory />
    </AppLayout>
  );
}
