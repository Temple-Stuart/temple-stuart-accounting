'use client';

import { useState } from 'react';
import { AppLayout, Badge } from '@/components/ui';

// ─── Types ──────────────────────────────────────────────────────────────────

type SourceStatus = 'LIVE' | 'BROKEN' | 'PARTIAL' | 'MKT-HRS' | 'SKIPPED';

interface DataSource {
  id: number;
  source: string;
  endpoint: string;
  status: SourceStatus;
  records: string;
  lastValue: string;
  latency: string;
}

// ─── Sample Data ────────────────────────────────────────────────────────────

const SYMBOLS = ['MSFT', 'BAC', 'NFLX'];

const DATA_SOURCES: DataSource[] = [
  { id: 1,  source: 'Finnhub IV/HV',          endpoint: '/stock/metric',            status: 'BROKEN',   records: '0',        lastValue: 'iv30: NULL',              latency: '—' },
  { id: 2,  source: 'Finnhub Basic Metrics',   endpoint: '/stock/metric',            status: 'PARTIAL',  records: '8 fields', lastValue: 'beta: 1.09',              latency: '12ms' },
  { id: 3,  source: 'EPS Estimates',           endpoint: '/stock/eps-estimate',      status: 'LIVE',     records: '4 qtrs',   lastValue: 'Next: $3.28 avg',         latency: '8ms' },
  { id: 4,  source: 'Revenue Estimates',       endpoint: '/stock/revenue-estimate',  status: 'LIVE',     records: '4 qtrs',   lastValue: 'Next: $72.1B',            latency: '9ms' },
  { id: 5,  source: 'Price Targets',           endpoint: '/stock/price-target',      status: 'LIVE',     records: '59 anal',  lastValue: 'Mean: $608',              latency: '7ms' },
  { id: 6,  source: 'Upgrades/Downgrades',     endpoint: '/stock/upgrade-downgrade', status: 'PARTIAL',  records: '5 rec',    lastValue: 'Date: NULL',              latency: '11ms' },
  { id: 7,  source: 'Recommendations',         endpoint: '/stock/recommendation',    status: 'LIVE',     records: '4 mo',     lastValue: 'Buy: 60 / Hold: 6',      latency: '6ms' },
  { id: 8,  source: 'Earnings History',        endpoint: '/stock/earnings',          status: 'LIVE',     records: '40 qtrs',  lastValue: 'Beat rate: 87%',          latency: '14ms' },
  { id: 9,  source: 'Earnings Quality',        endpoint: '/stock/earnings-quality',  status: 'BROKEN',   records: '0 curr',   lastValue: 'Returning 1983 data',     latency: '18ms' },
  { id: 10, source: 'Revenue Breakdown',       endpoint: '/stock/revenue-breakdown2',status: 'PARTIAL',  records: '3 seg',    lastValue: 'Parser bug',              latency: '10ms' },
  { id: 11, source: 'Insider Transactions',    endpoint: '/stock/insider-trans',     status: 'LIVE',     records: '5 rec',    lastValue: 'F: -639 (2026-03-02)',    latency: '9ms' },
  { id: 12, source: 'Insider Sentiment',       endpoint: '/stock/insider-sentiment', status: 'BROKEN',   records: '0',        lastValue: 'Empty response',          latency: '8ms' },
  { id: 13, source: 'Institutional Own.',      endpoint: '/stock/ownership',         status: 'PARTIAL',  records: '5 hold',   lastValue: 'Names: NULL',             latency: '13ms' },
  { id: 14, source: 'Peers',                   endpoint: '/stock/peers',             status: 'LIVE',     records: '12 sym',   lastValue: 'ORCL, PLTR, CRM...',      latency: '5ms' },
  { id: 15, source: 'Financials (Annual)',      endpoint: '/stock/financials-rep',    status: 'BROKEN',   records: '0 curr',   lastValue: 'All fields NULL',         latency: '16ms' },
  { id: 16, source: 'Financials (Quarterly)',   endpoint: '/stock/financials',        status: 'PARTIAL',  records: '4 qtrs',   lastValue: 'grossProfit: NULL',       latency: '11ms' },
  { id: 17, source: 'FinBERT Sentiment',       endpoint: '/news-sentiment',          status: 'LIVE',     records: '—',        lastValue: 'Bullish: 0.93',           latency: '22ms' },
  { id: 18, source: 'Company News',            endpoint: '/company-news',            status: 'LIVE',     records: '3 rec',    lastValue: '2026-03-04',              latency: '19ms' },
  { id: 19, source: 'FRED Macro (14 series)',  endpoint: 'FRED API',                 status: 'LIVE',     records: '14 ser',   lastValue: 'VIX: 22.1, 10Y: 4.31%',  latency: '31ms' },
  { id: 20, source: 'SEC EDGAR Submissions',   endpoint: 'EDGAR direct',             status: 'LIVE',     records: '—',        lastValue: 'CIK: 789019',            latency: '44ms' },
  { id: 21, source: 'SEC Company Tickers',     endpoint: '/files/company_tickers',   status: 'LIVE',     records: '—',        lastValue: 'CIK: 789019',            latency: '12ms' },
  { id: 22, source: 'xAI/Grok Sentiment',      endpoint: 'xAI API',                  status: 'LIVE',     records: '—',        lastValue: 'Bullish',                 latency: '287ms' },
  { id: 23, source: 'TastyTrade Greeks',       endpoint: 'TastyTrade API',           status: 'MKT-HRS', records: '—',        lastValue: 'Requires open market',    latency: '—' },
];

const STATUS_COUNTS: { label: string; status: SourceStatus; count: number; colorClass: string }[] = [
  { label: 'LIVE',     status: 'LIVE',     count: 13, colorClass: 'text-brand-green' },
  { label: 'PARTIAL',  status: 'PARTIAL',  count: 5,  colorClass: 'text-brand-amber' },
  { label: 'BROKEN',   status: 'BROKEN',   count: 4,  colorClass: 'text-brand-red' },
  { label: 'MKT-HRS',  status: 'MKT-HRS',  count: 1,  colorClass: 'text-brand-gold' },
  { label: 'SKIPPED',  status: 'SKIPPED',  count: 0,  colorClass: 'text-text-muted' },
];

const SCANNER_GATES: { name: string; ok: boolean; detail: string }[] = [
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

// ─── Component ──────────────────────────────────────────────────────────────

export default function DataObservatoryPage() {
  const [selectedSymbol, setSelectedSymbol] = useState('MSFT');
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const toggleRow = (id: number) => {
    setExpandedRow(prev => (prev === id ? null : id));
  };

  return (
    <AppLayout>
      {/* ── Header Bar ──────────────────────────────────────────────── */}
      <div className="bg-brand-purple">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs font-semibold text-white font-mono uppercase tracking-wider">
            Data Observatory
          </span>
          <div className="flex items-center gap-2">
            <select
              value={selectedSymbol}
              onChange={e => setSelectedSymbol(e.target.value)}
              className="bg-brand-purple-deep text-white text-xs font-mono px-2 py-1 border border-white/10 rounded focus:outline-none focus:ring-1 focus:ring-brand-gold"
            >
              {SYMBOLS.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <button className="bg-brand-gold text-white text-xs font-semibold font-mono px-3 py-1 rounded hover:bg-brand-gold-bright transition-colors">
              RUN CHECK
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
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-bg-row sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-text-muted w-8">#</th>
                      <th className="px-3 py-2 text-left font-medium text-text-muted">SOURCE</th>
                      <th className="px-3 py-2 text-left font-medium text-text-muted">ENDPOINT</th>
                      <th className="px-3 py-2 text-center font-medium text-text-muted">STATUS</th>
                      <th className="px-3 py-2 text-right font-medium text-text-muted">RECORDS</th>
                      <th className="px-3 py-2 text-left font-medium text-text-muted">LAST VALUE</th>
                      <th className="px-3 py-2 text-right font-medium text-text-muted">LATENCY</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {DATA_SOURCES.map(row => (
                      <>
                        <tr
                          key={row.id}
                          onClick={() => toggleRow(row.id)}
                          className="hover:bg-bg-row cursor-pointer transition-colors"
                        >
                          <td className="px-3 py-2 font-mono text-text-muted">{row.id}</td>
                          <td className="px-3 py-2 font-medium text-text-primary">{row.source}</td>
                          <td className="px-3 py-2 font-mono text-text-secondary">{row.endpoint}</td>
                          <td className="px-3 py-2 text-center">
                            <Badge variant={statusBadgeVariant(row.status)} size="sm">{row.status}</Badge>
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-text-secondary">{row.records}</td>
                          <td className="px-3 py-2 font-mono text-text-primary">{row.lastValue}</td>
                          <td className="px-3 py-2 text-right font-mono text-text-muted">{row.latency}</td>
                        </tr>
                        {expandedRow === row.id && (
                          <tr key={`${row.id}-detail`}>
                            <td colSpan={7} className="px-0 py-0">
                              <div className="bg-bg-row border-t border-border px-4 py-3">
                                <pre className="font-mono text-terminal-sm text-text-muted whitespace-pre-wrap">{`// raw data will appear here when API is wired\n{\n  "source": "${row.source}",\n  "endpoint": "${row.endpoint}",\n  "symbol": "${selectedSymbol}",\n  "status": "${row.status}",\n  "data": null\n}`}</pre>
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
                  {STATUS_COUNTS.map(s => (
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
                  {SCANNER_GATES.map(gate => (
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
                <span className="text-terminal-sm font-mono text-text-faint">—</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </AppLayout>
  );
}
