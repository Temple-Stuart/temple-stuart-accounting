'use client';

import { useState, useEffect } from 'react';

interface WashSaleViolation {
  dispositionId: string;
  symbol: string;
  saleDate: string;
  quantitySold: number;
  proceedsPerShare: number;
  costBasisPerShare: number;
  realizedLoss: number;
  replacementType: 'stock' | 'option';
  replacementDate: string;
  replacementQuantity: number;
  replacementCostPerShare: number;
  replacementLotId: string | null;
  replacementPositionId: string | null;
  disallowedLoss: number;
  adjustedCostBasis: number;
  sharesAffected: number;
}

interface SymbolGroup {
  symbol: string;
  violations: WashSaleViolation[];
  totalDisallowed: number;
  count: number;
}

interface WashSaleSummary {
  totalDisallowedLosses: number;
  totalViolations: number;
  symbolsAffected: string[];
  stockToStockCount: number;
  stockToOptionCount: number;
  optionToStockCount: number;
  optionToOptionCount: number;
}

interface TaxImpact {
  totalDisallowedLosses: number;
  estimatedAdditionalTax: number;
  note: string;
}

interface WashSaleData {
  violations: WashSaleViolation[];
  summary: WashSaleSummary;
  bySymbol: SymbolGroup[];
  taxImpact: TaxImpact;
}

export default function WashSaleReportTab() {
  const [data, setData] = useState<WashSaleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tax/wash-sales');
      if (res.ok) {
        setData(await res.json());
      }
    } catch (error) {
      console.error('Error loading wash sales:', error);
    }
    setLoading(false);
  };

  const applyAdjustments = async () => {
    if (!confirm('This will mark dispositions as wash sales and adjust replacement lot cost basis. Continue?')) return;
    setApplying(true);
    try {
      const res = await fetch('/api/tax/wash-sales', { method: 'POST' });
      if (res.ok) {
        await loadData(); // Refresh data after applying
      }
    } catch (error) {
      console.error('Error applying adjustments:', error);
    }
    setApplying(false);
  };

  const fmt = (val: number) => {
    if (val === 0) return '-';
    const abs = Math.abs(val);
    const formatted = abs >= 1000
      ? `$${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `$${abs.toFixed(2)}`;
    return val < 0 ? `(${formatted})` : formatted;
  };

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });

  if (loading) {
    return <div className="p-8 text-center text-terminal-sm text-text-muted">Scanning for wash sale violations...</div>;
  }

  if (!data) {
    return <div className="p-8 text-center text-terminal-sm text-brand-red">Failed to load wash sale data</div>;
  }

  const { summary, bySymbol, taxImpact } = data;

  return (
    <div>
      {/* Actions */}
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <span className="text-terminal-sm text-text-muted font-mono">IRS Publication 550</span>
        <div className="flex gap-2">
          <button onClick={loadData} className="px-3 py-1 text-xs border border-border text-text-secondary rounded-lg hover:bg-bg-row transition-colors">
            Re-scan
          </button>
          {summary.totalViolations > 0 && (
            <button
              onClick={applyAdjustments}
              disabled={applying}
              className="px-3 py-1 text-xs bg-brand-gold hover:bg-brand-gold-bright text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {applying ? 'Applying...' : 'Apply Adjustments'}
            </button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="p-3 space-y-3">
        {summary.totalViolations === 0 ? (
          <div className="text-center py-8">
            <div className="text-terminal-lg mb-2">No wash sale violations detected</div>
            <div className="text-terminal-sm text-text-muted">
              All losing dispositions have been scanned against the 30-day replacement window.
            </div>
          </div>
        ) : (
          <>
            {/* Top metrics */}
            <div className="grid grid-cols-4 gap-2">
              <div className="border border-border rounded p-2 bg-bg-row">
                <div className="text-terminal-xs text-text-muted uppercase tracking-widest">Disallowed Losses</div>
                <div className="text-terminal-lg font-bold font-mono text-brand-red">
                  {fmt(summary.totalDisallowedLosses)}
                </div>
              </div>
              <div className="border border-border rounded p-2">
                <div className="text-terminal-xs text-text-muted uppercase tracking-widest">Violations Found</div>
                <div className="text-terminal-lg font-bold font-mono">{summary.totalViolations}</div>
              </div>
              <div className="border border-border rounded p-2">
                <div className="text-terminal-xs text-text-muted uppercase tracking-widest">Symbols Affected</div>
                <div className="text-terminal-lg font-bold font-mono">{summary.symbolsAffected.length}</div>
              </div>
              <div className="border border-border rounded p-2 bg-bg-row">
                <div className="text-terminal-xs text-text-muted uppercase tracking-widest">Est. Tax Impact</div>
                <div className="text-terminal-lg font-bold font-mono text-brand-amber">
                  {fmt(taxImpact.estimatedAdditionalTax)}
                </div>
              </div>
            </div>

            {/* Type breakdown */}
            <div className="grid grid-cols-4 gap-2 text-terminal-base">
              <div className="border border-border rounded p-2">
                <div className="text-text-muted">Stock to Stock</div>
                <div className="font-bold font-mono">{summary.stockToStockCount}</div>
              </div>
              <div className="border border-border rounded p-2">
                <div className="text-text-muted">Stock to Option</div>
                <div className="font-bold font-mono">{summary.stockToOptionCount}</div>
              </div>
              <div className="border border-border rounded p-2">
                <div className="text-text-muted">Option to Stock</div>
                <div className="font-bold font-mono">{summary.optionToStockCount}</div>
              </div>
              <div className="border border-border rounded p-2">
                <div className="text-text-muted">Option to Option</div>
                <div className="font-bold font-mono">{summary.optionToOptionCount}</div>
              </div>
            </div>

            {/* Tax impact note */}
            <div className="bg-amber-50 border border-amber-200 rounded p-2 text-terminal-sm text-amber-800">
              {taxImpact.note}
            </div>

            {/* Per-symbol breakdown */}
            <div className="border border-border rounded overflow-hidden">
              <div className="bg-bg-row px-3 py-1.5 text-terminal-lg font-semibold">By Symbol</div>
              <table className="w-full text-terminal-base">
                <thead className="bg-gray-50 text-text-secondary">
                  <tr>
                    <th className="py-1 px-2 text-left text-terminal-xs uppercase tracking-widest font-mono">Symbol</th>
                    <th className="py-1 px-2 text-right text-terminal-xs uppercase tracking-widest font-mono">Violations</th>
                    <th className="py-1 px-2 text-right text-terminal-xs uppercase tracking-widest font-mono">Disallowed Loss</th>
                    <th className="py-1 px-2 text-center text-terminal-xs uppercase tracking-widest font-mono">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {bySymbol.map((group, idx) => (
                    <>
                      <tr
                        key={group.symbol}
                        className={`border-b border-border-light hover:bg-bg-row cursor-pointer ${idx % 2 === 0 ? 'bg-white' : 'bg-bg-row'}`}
                        onClick={() => setExpandedSymbol(expandedSymbol === group.symbol ? null : group.symbol)}
                      >
                        <td className="py-1 px-2 font-medium">{group.symbol}</td>
                        <td className="py-1 px-2 text-right font-mono">{group.count}</td>
                        <td className="py-1 px-2 text-right font-mono text-brand-red font-semibold">
                          {fmt(group.totalDisallowed)}
                        </td>
                        <td className="py-1 px-2 text-center text-text-faint">
                          {expandedSymbol === group.symbol ? '\u25B2' : '\u25BC'}
                        </td>
                      </tr>
                      {expandedSymbol === group.symbol && group.violations.map((v, i) => (
                        <tr key={`${v.dispositionId}-${i}`} className="bg-bg-row border-b border-border-light text-terminal-sm">
                          <td className="py-1 px-2 pl-6" colSpan={4}>
                            <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                              <div>
                                <span className="text-text-muted">Sale:</span>{' '}
                                <span className="font-mono text-text-muted">{fmtDate(v.saleDate)}</span>{' '}
                                {v.quantitySold} shares @ {fmt(v.proceedsPerShare)}
                              </div>
                              <div>
                                <span className="text-text-muted">Replacement:</span>{' '}
                                <span className={`px-1 py-0.5 rounded text-[10px] font-medium ${
                                  v.replacementType === 'stock' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                                }`}>{v.replacementType}</span>{' '}
                                <span className="font-mono text-text-muted">{fmtDate(v.replacementDate)}</span>{' '}
                                {v.replacementQuantity} {v.replacementType === 'option' ? 'contracts' : 'shares'} @ {fmt(v.replacementCostPerShare)}
                              </div>
                              <div>
                                <span className="text-text-muted">Realized Loss:</span>{' '}
                                <span className="font-mono text-brand-red">{fmt(v.realizedLoss)}</span>
                              </div>
                              <div>
                                <span className="text-text-muted">Disallowed:</span>{' '}
                                <span className="font-mono text-brand-red font-semibold">{fmt(v.disallowedLoss)}</span>
                                {' '}
                                <span className="text-text-muted">Adjusted Basis:</span>{' '}
                                <span className="font-mono">{fmt(v.adjustedCostBasis)}</span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
