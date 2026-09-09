'use client';

import { Fragment, useState, useCallback } from 'react';
import { Badge } from '@/components/ui';
// TRADE-SHELL-DARK: the one section-header idiom (ds.ts).
import { SECTION_HEADER } from '@/lib/ds';
// OBSERVATORY-01: what each feed costs, derived from the call sites (counts only).
import { FEED_COST, SCAN_COST, scanCostLine, callsMadeLine, type ProviderSpend } from '@/lib/observatory/feedCost';

/**
 * OBSERVATORY-01 — THE OBSERVATORY MEASURES OR SAYS NOTHING.
 *
 * This screen used to render a 33-row HARDCODED_SOURCES array whenever no
 * check had run — typed statuses, typed latencies ("12ms"), typed values
 * ("beta: 1.09") and dates frozen at 2026-03-02. A spend decision was being
 * read off numbers nobody measured. That array is deleted.
 *
 * THE RULE NOW: no row, no status, no latency, no value renders without a
 * measurement behind it. With no check run this session the screen says so and
 * shows the button. Every rendered table carries the timestamp it was measured
 * at and the symbol each probe actually asked about — which is NOT always the
 * one selected: the TastyTrade probes ask about a fixed ticker.
 *
 * Results live in component state only. The check DOES persist a row per feed
 * to ObservatoryHealthLog (check/route.ts:1120), but that table holds no
 * latency, records or raw payload, so it cannot reconstitute this table — and
 * a partial reconstruction rendered as a measurement is the thing this PR
 * deletes. Reading the last run back is a separate change with its own route.
 */

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
  lastConfirmedLive?: string | null;
  // OBSERVATORY-01 — the cost facts the route derives from the call sites.
  provider?: DataProvider;
  billable?: boolean;
  costBasis?: string;
  upstreamCalls?: number;
  usedByScan?: boolean;
  scanCitation?: string;
  probedSymbol?: string | null;
}

interface CheckResponse {
  symbol: string;
  checkedAt: string;
  marketOpen?: boolean;
  spend?: ProviderSpend[];
  results: DataSource[];
}

/** What a measured run looks like — the ONLY shape that renders a row. */
interface Measurement {
  symbol: string;
  checkedAt: string;
  marketOpen: boolean | null;
  spend: ProviderSpend[];
  rows: DataSource[];
}

const SYMBOLS = ['MSFT', 'BAC', 'NFLX'];

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
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')} ET`;
}

/**
 * Which gate a feed feeds. A MAPPING, not a measurement — the check reports a
 * feed's health, not which gate consumed it, and this says which gate would.
 */
const SOURCE_GATE_MAP: Record<number, GateName> = {
  1: 'Vol-Edge', 2: 'Quality', 3: 'Info-Edge', 4: 'Info-Edge', 5: 'Info-Edge',
  6: 'Info-Edge', 7: 'Info-Edge', 8: 'Quality', 9: 'Quality', 10: 'Quality',
  11: 'Info-Edge', 12: 'Info-Edge', 13: 'Info-Edge', 14: 'All', 15: 'Quality',
  16: 'Quality', 17: 'Info-Edge', 18: 'Info-Edge', 19: 'Regime', 20: 'Info-Edge',
  21: 'Info-Edge', 22: 'Info-Edge', 23: 'Vol-Edge', 24: 'Vol-Edge', 25: 'Regime',
  26: 'Info-Edge', 27: 'All', 28: 'Info-Edge', 29: 'Info-Edge', 30: 'Quality',
  31: 'Vol-Edge', 32: 'Regime', 33: 'All',
};

function enrichMeasuredResults(results: DataSource[]): DataSource[] {
  return results.map(r => ({
    ...r,
    gate: SOURCE_GATE_MAP[r.id] ?? 'All',
    dataSource: (r.provider ?? r.dataSource ?? FEED_COST[r.id]?.provider ?? 'Internal') as DataProvider,
  }));
}

/** Counts, computed from the measured rows. Never typed. */
function computeStatusCounts(rows: DataSource[]) {
  const counts: Record<SourceStatus, number> = { LIVE: 0, PARTIAL: 0, BROKEN: 0, 'MKT-HRS': 0, SKIPPED: 0 };
  for (const r of rows) counts[r.status] = (counts[r.status] || 0) + 1;
  return (['LIVE', 'PARTIAL', 'BROKEN', 'MKT-HRS', 'SKIPPED'] as SourceStatus[]).map(s => ({
    label: s, status: s, count: counts[s], colorClass: STATUS_COLOR_MAP[s],
  }));
}

/**
 * Scanner readiness, read off the measured rows. A gate whose feed was not
 * measured (SKIPPED, or the market was closed) is UNKNOWN — it is never called
 * ready and never called degraded on a probe that did not run.
 */
type GateReadiness = { name: string; state: 'READY' | 'DEGRADED' | 'UNKNOWN'; detail: string };

function computeScannerGates(rows: DataSource[]): GateReadiness[] {
  const byId = new Map(rows.map(r => [r.id, r]));
  const read = (name: string, id: number, label: string): GateReadiness => {
    const row = byId.get(id);
    if (!row) return { name, state: 'UNKNOWN', detail: `${label} not in this run` };
    if (row.status === 'SKIPPED' || row.status === 'MKT-HRS') {
      return { name, state: 'UNKNOWN', detail: `${label} not measured — ${row.lastValue}` };
    }
    if (row.status === 'LIVE') return { name, state: 'READY', detail: `${label} flowing` };
    return { name, state: 'DEGRADED', detail: `${label} ${row.status.toLowerCase()} — ${row.lastValue}` };
  };
  return [
    read('Vol-Edge', 1, 'IV/HV'),
    read('Quality', 9, 'Earnings quality'),
    read('Info-Edge', 12, 'Insider sentiment'),
    read('Regime', 19, 'FRED macro'),
  ];
}

/** The symbols this run actually asked about, in the order first seen. */
function symbolsProbed(rows: DataSource[]): string[] {
  const seen: string[] = [];
  for (const r of rows) {
    const s = r.probedSymbol ?? (FEED_COST[r.id]?.probes === 'none' ? null : null);
    if (s && !seen.includes(s)) seen.push(s);
  }
  return seen;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function DataObservatory() {
  const [selectedSymbol, setSelectedSymbol] = useState('MSFT');
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  // NULL means: nothing has been measured this session. It renders the
  // not-measured state — never a row.
  const [measurement, setMeasurement] = useState<Measurement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleRow = (id: number) => setExpandedRow(prev => (prev === id ? null : id));

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
      setMeasurement({
        symbol: data.symbol,
        checkedAt: data.checkedAt,
        marketOpen: data.marketOpen ?? null,
        spend: data.spend ?? [],
        rows: enrichMeasuredResults(data.results),
      });
    } catch (e) {
      // FAIL LOUD: a failed check leaves the screen unmeasured and says why.
      // It never falls back to a previous run or to typed rows.
      setError(e instanceof Error ? e.message : 'Check failed');
    } finally {
      setLoading(false);
    }
  }, [selectedSymbol]);

  const rows = measurement?.rows ?? [];
  const statusCounts = measurement ? computeStatusCounts(rows) : null;
  const scannerGates = measurement ? computeScannerGates(rows) : null;
  const probed = measurement ? symbolsProbed(rows) : [];

  return (
    <>
      {/* ── Header Bar — TRADE-SHELL-DARK: the SECTION_HEADER idiom. ── */}
      <div className="rounded-t-lg overflow-hidden">
        <div className={SECTION_HEADER}>
          <span>Data Observatory</span>
          <div className="flex items-center gap-2">
            {error && <span className="text-xs font-mono text-red-300" data-observatory-error>{error}</span>}
            <select
              value={selectedSymbol}
              onChange={e => setSelectedSymbol(e.target.value)}
              disabled={loading}
              className="bg-brand-purple-deep text-white text-xs font-mono px-2 py-1 border border-white/10 rounded focus:outline-none focus:ring-1 focus:ring-brand-gold disabled:opacity-50"
            >
              {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button
              onClick={runCheck}
              disabled={loading}
              data-run-check
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

      <div className="p-4 lg:p-6">
        {/* ── What a run costs — printed whether or not one has run, because it
              is read from the call sites, not from a measurement. ── */}
        <div className="mb-4 border border-border bg-bg-row px-4 py-3" data-cost-summary>
          <div className="text-[9px] uppercase tracking-wider font-mono text-text-muted mb-1">What this costs upstream</div>
          <p className="font-mono text-terminal-sm text-text-primary">{scanCostLine()}</p>
          <p className="font-mono text-terminal-sm text-text-secondary mt-1">
            {measurement ? callsMadeLine(measurement.spend) : 'No check has run this session, so this screen has spent nothing.'}
          </p>
          <p className="font-mono text-terminal-xs text-text-muted mt-1">
            Counts, never dollars: this product does not know any vendor&rsquo;s rate. The rate lives in the vendor&rsquo;s invoice.
            Ceilings, not averages — the scan gates its later stages, and three caches can serve a repeat for free.
          </p>
        </div>

        {!measurement ? (
          /* ── NOT MEASURED. No row, no status, no latency, no value. ── */
          <div className="border border-border bg-white px-6 py-10 text-center" data-not-measured>
            <div className="font-mono text-sm font-semibold text-text-primary">Not measured yet</div>
            <p className="mt-2 font-mono text-terminal-sm text-text-secondary max-w-2xl mx-auto">
              Nothing has been probed in this session, so there is nothing to show. This screen renders no
              status, no latency and no value it did not measure. Press <span className="font-semibold">RUN CHECK</span> above to
              probe all {Object.keys(FEED_COST).length} feeds for {selectedSymbol}.
            </p>
            <p className="mt-3 font-mono text-terminal-xs text-text-muted max-w-2xl mx-auto">
              Running it spends real upstream calls, per the counts above. Feeds needing an open market report
              MKT-HRS and call nothing; feeds with no key report SKIPPED and call nothing.
            </p>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-4">

            {/* ── Left: the measured table ── */}
            <div className="flex-1 min-w-0">
              <div className="bg-white border border-border shadow-sm overflow-hidden">
                <div className="bg-brand-purple-hover text-white px-4 py-2 font-mono" data-measured-at>
                  <div className="text-xs font-semibold uppercase tracking-wider">
                    Data Sources — measured at {new Date(measurement.checkedAt).toLocaleString()}
                  </div>
                  <div className="text-[10px] opacity-80 mt-0.5">
                    Symbols probed: {probed.length > 0 ? probed.join(', ') : 'none'}
                    {' · '}selected {measurement.symbol}
                    {probed.some(p => p !== measurement.symbol) && ' — the TastyTrade probes ask about a fixed ticker, not the selected one'}
                    {measurement.marketOpen !== null && ` · market ${measurement.marketOpen ? 'OPEN' : 'CLOSED'}`}
                  </div>
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
                        <th className="px-3 py-2 text-left font-medium text-text-muted">PROBED</th>
                        <th className="px-3 py-2 text-center font-medium text-text-muted">STATUS</th>
                        <th className="px-3 py-2 text-right font-medium text-text-muted">RECORDS</th>
                        <th className="px-3 py-2 text-left font-medium text-text-muted">LAST VALUE</th>
                        <th className="px-3 py-2 text-right font-medium text-text-muted">LATENCY</th>
                        <th className="px-3 py-2 text-center font-medium text-text-muted">METERED</th>
                        <th className="px-3 py-2 text-right font-medium text-text-muted">CALLS</th>
                        <th className="px-3 py-2 text-center font-medium text-text-muted">IN SCAN</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {rows.map(row => (
                        <Fragment key={row.id}>
                          <tr
                            onClick={() => toggleRow(row.id)}
                            data-feed-row={row.id}
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
                            <td className="px-3 py-2 font-mono text-text-secondary">{row.probedSymbol ?? '— none'}</td>
                            <td className="px-3 py-2 text-center">
                              <Badge variant={statusBadgeVariant(row.status)} size="sm">{row.status}</Badge>
                              {row.status === 'MKT-HRS' && (
                                row.lastConfirmedLive
                                  ? <div className="text-[9px] text-brand-green font-mono mt-0.5">Last LIVE: {formatLastLive(row.lastConfirmedLive)}</div>
                                  : <div className="text-[9px] text-text-muted font-mono mt-0.5">Never confirmed LIVE</div>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-text-secondary">{row.records}</td>
                            <td className="px-3 py-2 font-mono text-text-primary">{row.lastValue}</td>
                            <td className="px-3 py-2 text-right font-mono text-text-muted">{row.latency}</td>
                            <td className="px-3 py-2 text-center font-mono text-[10px]">
                              {row.billable ? <span className="text-brand-red font-semibold">METERED</span> : <span className="text-text-muted">no</span>}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-text-primary">{row.upstreamCalls ?? '—'}</td>
                            <td className="px-3 py-2 text-center font-mono text-[10px] text-text-secondary">{row.usedByScan ? 'yes' : 'no'}</td>
                          </tr>
                          {expandedRow === row.id && (
                            <tr>
                              <td colSpan={13} className="px-0 py-0">
                                <div className="bg-bg-row border-t border-border px-4 py-3 space-y-2">
                                  <div className="font-mono text-terminal-xs text-text-secondary">
                                    <span className="text-text-muted">Cost basis:</span> {row.costBasis ?? 'not recorded'}
                                  </div>
                                  <div className="font-mono text-terminal-xs text-text-secondary">
                                    <span className="text-text-muted">In the scan:</span> {row.scanCitation ?? 'not recorded'}
                                  </div>
                                  <pre className="font-mono text-terminal-sm text-text-muted whitespace-pre-wrap">
                                    {row.rawData != null
                                      ? JSON.stringify(row.rawData, null, 2)
                                      : 'No payload was captured for this probe — it returned none, or it did not run.'}
                                  </pre>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* ── Right: the panel, all of it computed from the same rows ── */}
            <div className="w-full lg:w-72 flex-shrink-0">
              <div className="bg-white border border-border shadow-sm overflow-hidden">
                <div className="bg-brand-purple-hover text-white px-4 py-2 text-xs font-semibold uppercase tracking-wider font-mono">
                  System Status
                </div>

                <div className="p-3 border-b border-border">
                  <div className="space-y-1.5">
                    {statusCounts?.map(s => (
                      <div key={s.label} className="flex items-center justify-between">
                        <Badge variant={statusBadgeVariant(s.status)} size="sm">{s.label}</Badge>
                        <span className={`font-mono font-semibold text-sm ${s.colorClass}`}>{s.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-3 border-b border-border">
                  <div className="text-[9px] text-text-muted uppercase tracking-wider font-mono mb-2">Scanner Readiness</div>
                  <div className="space-y-1.5">
                    {scannerGates?.map(gate => (
                      <div key={gate.name} className="flex items-start gap-2">
                        <span className="flex-shrink-0 mt-px">
                          {gate.state === 'READY'
                            ? <Badge variant="success" size="sm">READY</Badge>
                            : gate.state === 'DEGRADED'
                              ? <Badge variant="warning" size="sm">DEGRADED</Badge>
                              : <Badge variant="default" size="sm">UNKNOWN</Badge>}
                        </span>
                        <div className="min-w-0">
                          <span className="text-terminal-sm font-semibold text-text-primary font-mono">{gate.name}</span>
                          <span className="text-terminal-xs text-text-muted font-mono ml-1">({gate.detail})</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-3 border-b border-border">
                  <div className="text-[9px] text-text-muted uppercase tracking-wider font-mono mb-2">Calls this check made</div>
                  <div className="space-y-1">
                    {measurement.spend.length === 0
                      ? <span className="font-mono text-terminal-sm text-text-muted">none recorded</span>
                      : measurement.spend.map(s => (
                        <div key={s.provider} className="flex items-center justify-between font-mono text-terminal-sm">
                          <span className="text-text-secondary">{s.provider}{s.billable ? ' · metered' : ''}</span>
                          <span className="text-text-primary font-semibold">{s.calls}</span>
                        </div>
                      ))}
                  </div>
                </div>

                <div className="p-3">
                  <div className="text-[9px] text-text-muted uppercase tracking-wider font-mono mb-1">One scan, one symbol</div>
                  <div className="space-y-1">
                    {SCAN_COST.map(c => (
                      <div key={c.provider} className="flex items-center justify-between font-mono text-terminal-sm">
                        <span className="text-text-secondary">{c.provider}</span>
                        <span className="text-text-primary">
                          {c.callsPerSymbol !== null && c.callsPerSymbol > 0
                            ? `${c.callsPerSymbol} / symbol`
                            : c.callsPerScan !== null ? `${c.callsPerScan} / scan` : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </>
  );
}
