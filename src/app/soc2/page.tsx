'use client';

import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/ui';

interface ControlProof {
  id: string;
  name: string;
  description: string;
  status: 'pass' | 'fail' | 'warn';
  proof: {
    query: string;
    result: any;
    explanation: string;
  };
  timestamp: string;
}

interface Soc2Response {
  controls: ControlProof[];
  summary: {
    total: number;
    passing: number;
    failing: number;
    warning: number;
    overallStatus: 'pass' | 'fail' | 'warn';
  };
  timestamp: string;
}

const STATUS_CONFIG = {
  pass: { label: 'PASS', bg: 'bg-green-50', border: 'border-l-green-500', text: 'text-green-700', badge: 'bg-green-100 text-green-800', icon: '\u2713' },
  fail: { label: 'FAIL', bg: 'bg-red-50', border: 'border-l-red-500', text: 'text-red-700', badge: 'bg-red-100 text-red-800', icon: '\u2717' },
  warn: { label: 'WARN', bg: 'bg-amber-50', border: 'border-l-amber-500', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-800', icon: '!' },
};

export default function Soc2Page() {
  const [data, setData] = useState<Soc2Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  const fetchControls = async () => {
    try {
      setRefreshing(true);
      setError(null);
      const res = await fetch('/api/soc2');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchControls(); }, []);

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    if (data) setExpanded(new Set(data.controls.map(c => c.id)));
  };

  const collapseAll = () => setExpanded(new Set());

  const formatResult = (result: any): string => {
    return JSON.stringify(result, null, 2);
  };

  return (
    <AppLayout>
      <div className="px-4 py-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-lg font-semibold text-text-primary font-mono">SOC 2 Control Verification</h1>
          <p className="text-xs text-text-muted mt-1">Live proof against production data</p>

          {data && (
            <div className="flex items-center gap-3 mt-3">
              <span className={`inline-flex items-center px-2.5 py-1 text-xs font-mono font-bold rounded ${
                data.summary.overallStatus === 'pass' ? 'bg-green-100 text-green-800' :
                data.summary.overallStatus === 'fail' ? 'bg-red-100 text-red-800' :
                'bg-amber-100 text-amber-800'
              }`}>
                {data.summary.passing}/{data.summary.total} PASSING
                {data.summary.failing > 0 && ` \u2014 ${data.summary.failing} FAILING`}
                {data.summary.warning > 0 && data.summary.failing === 0 && ` \u2014 ${data.summary.warning} WARNING`}
              </span>
              <span className="text-[10px] text-text-faint font-mono">
                Last verified: {new Date(data.timestamp).toLocaleString()}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={fetchControls}
              disabled={refreshing}
              className="px-3 py-1.5 text-xs font-mono font-medium bg-brand-purple text-white hover:bg-brand-purple-hover transition-colors disabled:opacity-50"
            >
              {refreshing ? 'Verifying...' : 'Run All Checks'}
            </button>
            {data && (
              <>
                <button onClick={expandAll} className="px-2 py-1.5 text-xs font-mono text-text-muted hover:text-text-primary border border-border hover:bg-bg-row transition-colors">
                  Expand All
                </button>
                <button onClick={collapseAll} className="px-2 py-1.5 text-xs font-mono text-text-muted hover:text-text-primary border border-border hover:bg-bg-row transition-colors">
                  Collapse All
                </button>
              </>
            )}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="space-y-3">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-16 bg-bg-row/50 rounded animate-pulse border border-border" />
            ))}
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-red-50 border border-red-200 p-4 text-sm text-red-700 font-mono">
            Error loading controls: {error}
          </div>
        )}

        {/* Controls */}
        {data && !loading && (
          <div className="space-y-2">
            {data.controls.map(control => {
              const config = STATUS_CONFIG[control.status];
              const isExpanded = expanded.has(control.id);

              return (
                <div key={control.id} className={`border border-border border-l-4 ${config.border} ${isExpanded ? config.bg : 'bg-white'}`}>
                  {/* Control Header */}
                  <button
                    onClick={() => toggle(control.id)}
                    className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-bg-row/30 transition-colors"
                  >
                    <span className={`inline-flex items-center justify-center w-5 h-5 text-xs font-bold rounded ${config.badge}`}>
                      {config.icon}
                    </span>
                    <span className="text-xs font-mono font-bold text-text-muted w-16 flex-shrink-0">{control.id}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-text-primary">{control.name}</div>
                      <div className="text-xs text-text-muted truncate">{control.description}</div>
                    </div>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${config.badge}`}>
                      {config.label}
                    </span>
                    <svg className={`w-4 h-4 text-text-faint transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Expanded Proof */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-border/50">
                      {/* Explanation */}
                      <div className="mt-3 mb-3">
                        <div className="text-[10px] font-mono uppercase tracking-wider text-text-faint mb-1">Explanation</div>
                        <p className="text-xs text-text-primary font-mono leading-relaxed">{control.proof.explanation}</p>
                      </div>

                      {/* Result */}
                      <div className="mb-3">
                        <div className="text-[10px] font-mono uppercase tracking-wider text-text-faint mb-1">Result</div>
                        <pre className="text-xs font-mono bg-white border border-border p-3 overflow-x-auto text-text-secondary leading-relaxed">
                          {formatResult(control.proof.result)}
                        </pre>
                      </div>

                      {/* SQL Query */}
                      <div className="mb-2">
                        <div className="text-[10px] font-mono uppercase tracking-wider text-text-faint mb-1">SQL Query</div>
                        <pre className="text-[11px] font-mono bg-gray-900 text-green-400 p-3 overflow-x-auto leading-relaxed rounded-sm">
                          {control.proof.query}
                        </pre>
                      </div>

                      {/* Timestamp */}
                      <div className="text-[9px] font-mono text-text-faint mt-2">
                        Verified at {new Date(control.timestamp).toLocaleString()}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Proof Statement */}
        {data && !loading && (
          <div className="mt-8 border border-border bg-white p-5">
            <h2 className="text-sm font-semibold text-text-primary mb-3 font-mono">Proof Statement</h2>
            <p className="text-xs text-text-secondary leading-relaxed">
              Temple Stuart implements institutional-grade financial controls
              including double-entry bookkeeping with complete audit trails,
              immutable ledger entries enforced by database triggers,
              per-transaction idempotency with unique constraints, and
              entity-scoped data separation. Our control framework is
              designed to SOC 2 Trust Service Criteria standards and is
              audit-ready.
            </p>
            <p className="text-[10px] text-text-faint mt-3 font-mono">
              Every claim above is verified by the controls on this page. Click any control to see the proof.
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
