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
    return <div className="p-8 text-center text-sm text-gray-500">Scanning for wash sale violations...</div>;
  }

  if (!data) {
    return <div className="p-8 text-center text-sm text-red-600">Failed to load wash sale data</div>;
  }

  const { summary, bySymbol, taxImpact } = data;

  return (
    <div>
      {/* Header */}
      <div className="bg-[#2d1b4e] text-white px-4 py-2 flex items-center justify-between">
        <span className="text-sm font-semibold">Wash Sale Report (IRS Publication 550)</span>
        <div className="flex gap-2">
          <button onClick={loadData} className="text-xs bg-[#3d2b5e] px-3 py-1 rounded hover:bg-[#4d3b6e]">
            Re-scan
          </button>
          {summary.totalViolations > 0 && (
            <button
              onClick={applyAdjustments}
              disabled={applying}
              className="text-xs bg-amber-600 px-3 py-1 rounded hover:bg-amber-700 disabled:opacity-50"
            >
              {applying ? 'Applying...' : 'Apply Adjustments'}
            </button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="p-4 space-y-4">
        {summary.totalViolations === 0 ? (
          <div className="text-center py-8">
            <div className="text-2xl mb-2">No wash sale violations detected</div>
            <div className="text-sm text-gray-500">
              All losing dispositions have been scanned against the 30-day replacement window.
            </div>
          </div>
        ) : (
          <>
            {/* Top metrics */}
            <div className="grid grid-cols-4 gap-3">
              <div className="border rounded-lg p-3 bg-red-50">
                <div className="text-[10px] text-gray-500 uppercase">Disallowed Losses</div>
                <div className="text-xl font-bold font-mono text-red-700">
                  {fmt(summary.totalDisallowedLosses)}
                </div>
              </div>
              <div className="border rounded-lg p-3">
                <div className="text-[10px] text-gray-500 uppercase">Violations Found</div>
                <div className="text-xl font-bold font-mono">{summary.totalViolations}</div>
              </div>
              <div className="border rounded-lg p-3">
                <div className="text-[10px] text-gray-500 uppercase">Symbols Affected</div>
                <div className="text-xl font-bold font-mono">{summary.symbolsAffected.length}</div>
              </div>
              <div className="border rounded-lg p-3 bg-amber-50">
                <div className="text-[10px] text-gray-500 uppercase">Est. Tax Impact</div>
                <div className="text-xl font-bold font-mono text-amber-700">
                  {fmt(taxImpact.estimatedAdditionalTax)}
                </div>
              </div>
            </div>

            {/* Type breakdown */}
            <div className="grid grid-cols-4 gap-3 text-xs">
              <div className="border rounded p-2">
                <div className="text-gray-500">Stock to Stock</div>
                <div className="font-bold font-mono">{summary.stockToStockCount}</div>
              </div>
              <div className="border rounded p-2">
                <div className="text-gray-500">Stock to Option</div>
                <div className="font-bold font-mono">{summary.stockToOptionCount}</div>
              </div>
              <div className="border rounded p-2">
                <div className="text-gray-500">Option to Stock</div>
                <div className="font-bold font-mono">{summary.optionToStockCount}</div>
              </div>
              <div className="border rounded p-2">
                <div className="text-gray-500">Option to Option</div>
                <div className="font-bold font-mono">{summary.optionToOptionCount}</div>
              </div>
            </div>

            {/* Tax impact note */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
              {taxImpact.note}
            </div>

            {/* Per-symbol breakdown */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 text-sm font-semibold">By Symbol</div>
              <table className="w-full text-xs">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-2 text-left">Symbol</th>
                    <th className="px-3 py-2 text-right">Violations</th>
                    <th className="px-3 py-2 text-right">Disallowed Loss</th>
                    <th className="px-3 py-2 text-center">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {bySymbol.map(group => (
                    <>
                      <tr
                        key={group.symbol}
                        className="border-b hover:bg-gray-50 cursor-pointer"
                        onClick={() => setExpandedSymbol(expandedSymbol === group.symbol ? null : group.symbol)}
                      >
                        <td className="px-3 py-2 font-medium">{group.symbol}</td>
                        <td className="px-3 py-2 text-right font-mono">{group.count}</td>
                        <td className="px-3 py-2 text-right font-mono text-red-700 font-semibold">
                          {fmt(group.totalDisallowed)}
                        </td>
                        <td className="px-3 py-2 text-center text-gray-400">
                          {expandedSymbol === group.symbol ? '\u25B2' : '\u25BC'}
                        </td>
                      </tr>
                      {expandedSymbol === group.symbol && group.violations.map((v, i) => (
                        <tr key={`${v.dispositionId}-${i}`} className="bg-gray-50 border-b text-[11px]">
                          <td className="px-3 py-1.5 pl-6" colSpan={4}>
                            <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                              <div>
                                <span className="text-gray-500">Sale:</span>{' '}
                                <span className="font-mono">{fmtDate(v.saleDate)}</span>{' '}
                                {v.quantitySold} shares @ {fmt(v.proceedsPerShare)}
                              </div>
                              <div>
                                <span className="text-gray-500">Replacement:</span>{' '}
                                <span className={`px-1 py-0.5 rounded text-[10px] font-medium ${
                                  v.replacementType === 'stock' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                                }`}>{v.replacementType}</span>{' '}
                                <span className="font-mono">{fmtDate(v.replacementDate)}</span>{' '}
                                {v.replacementQuantity} {v.replacementType === 'option' ? 'contracts' : 'shares'} @ {fmt(v.replacementCostPerShare)}
                              </div>
                              <div>
                                <span className="text-gray-500">Realized Loss:</span>{' '}
                                <span className="font-mono text-red-700">{fmt(v.realizedLoss)}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Disallowed:</span>{' '}
                                <span className="font-mono text-red-700 font-semibold">{fmt(v.disallowedLoss)}</span>
                                {' '}
                                <span className="text-gray-500">Adjusted Basis:</span>{' '}
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
