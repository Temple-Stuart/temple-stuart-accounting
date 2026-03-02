'use client';

import { useState, useEffect, useRef } from 'react';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

interface DrillDownTransaction {
  date: string;
  merchant: string;
  description: string;
  amount: number;
  coaCode: string;
  coaName: string;
}

interface BudgetDrillDownProps {
  isOpen: boolean;
  onClose: () => void;
  coaCodes: string[];
  month: number;
  year: number;
  categoryName: string;
  cellAmount: number;
  entityType: string;
}

export default function BudgetDrillDown({
  isOpen,
  onClose,
  coaCodes,
  month,
  year,
  categoryName,
  cellAmount,
  entityType,
}: BudgetDrillDownProps) {
  const [transactions, setTransactions] = useState<DrillDownTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      coaCodes: coaCodes.join(','),
      month: month.toString(),
      year: year.toString(),
      entityType,
    });

    fetch(`/api/hub/drill-down?${params}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json();
      })
      .then(data => {
        setTransactions(data.transactions || []);
        setTotal(data.total || 0);
        setCount(data.count || 0);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [isOpen, coaCodes, month, year, entityType]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay to avoid the opening click triggering close
    const timer = setTimeout(() => document.addEventListener('mousedown', handleClick), 50);
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handleClick); };
  }, [isOpen, onClose]);

  // Escape key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const fmt = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const totalMismatch = Math.abs(total - cellAmount) > 0.01;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" />

      {/* Panel */}
      <div
        ref={panelRef}
        className="relative w-full max-w-lg bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
        style={{ animation: 'slideInRight 0.2s ease-out' }}
      >
        {/* Header */}
        <div className="bg-brand-purple text-white px-5 py-4 flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold">{categoryName}</h3>
            <p className="text-xs text-white/70 mt-0.5 font-mono">
              {MONTHS[month]} {year} · {coaCodes.length === 1 ? coaCodes[0] : `${coaCodes.length} accounts`}
            </p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors p-1 -mr-1 -mt-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-5 space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-10 bg-bg-row/50 rounded animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="p-8 text-center text-brand-red text-sm">{error}</div>
          ) : transactions.length === 0 ? (
            <div className="p-8 text-center text-text-faint text-sm">No transactions found for this period</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-bg-row/50 text-text-muted">
                  <th className="text-left py-2 px-4 font-medium">Date</th>
                  <th className="text-left py-2 px-2 font-medium">Merchant</th>
                  {coaCodes.length > 1 && <th className="text-left py-2 px-2 font-medium">Account</th>}
                  <th className="text-right py-2 px-4 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((txn, i) => (
                  <tr key={i} className={`border-b border-border-light hover:bg-brand-purple-wash/20 ${i % 2 === 0 ? 'bg-white' : 'bg-bg-row/30'}`}>
                    <td className="py-2 px-4 font-mono text-text-muted whitespace-nowrap">{txn.date}</td>
                    <td className="py-2 px-2 text-text-primary truncate max-w-[200px]" title={txn.description}>
                      {txn.merchant}
                    </td>
                    {coaCodes.length > 1 && (
                      <td className="py-2 px-2 text-text-muted font-mono whitespace-nowrap">{txn.coaCode}</td>
                    )}
                    <td className="py-2 px-4 text-right font-mono text-text-primary whitespace-nowrap">{fmt(txn.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        {!loading && !error && transactions.length > 0 && (
          <div className="border-t border-border bg-bg-row/50 px-5 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">{count} transaction{count !== 1 ? 's' : ''}</span>
              <div className="flex items-center gap-2">
                {totalMismatch && (
                  <span className="text-amber-600 text-xs flex items-center gap-1" title={`Expected ${fmt(cellAmount)}, got ${fmt(total)}`}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    mismatch
                  </span>
                )}
                <span className="text-sm font-semibold font-mono text-text-primary">{fmt(total)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CSS animation */}
      <style jsx>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
