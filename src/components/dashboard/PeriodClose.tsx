'use client';

import { useState, useMemo } from 'react';

interface Transaction {
  id: string;
  date: string;
  accountCode: string | null;
}

interface Reconciliation {
  id: string;
  accountId: string;
  periodEnd: string;
  status: string;
}

interface PeriodCloseRecord {
  id: string;
  year: number;
  month: number;
  status: string;
  closedAt: string | null;
  closedBy: string | null;
}

interface PeriodCloseProps {
  transactions: Transaction[];
  reconciliations: Reconciliation[];
  periodCloses: PeriodCloseRecord[];
  selectedYear: number;
  onClose: (year: number, month: number, notes?: string) => Promise<void>;
  onReopen: (year: number, month: number) => Promise<void>;
  onReload: () => void;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 
                'July', 'August', 'September', 'October', 'November', 'December'];

export default function PeriodClose({ transactions, reconciliations, periodCloses, selectedYear, onClose, onReopen, onReload }: PeriodCloseProps) {
  const [closing, setClosing] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  // Count transactions per month
  const txnsByMonth = useMemo(() => {
    const counts: Record<number, number> = {};
    transactions.forEach(t => {
      const d = new Date(t.date);
      if (d.getFullYear() === selectedYear) {
        const m = d.getMonth();
        counts[m] = (counts[m] || 0) + 1;
      }
    });
    return counts;
  }, [transactions, selectedYear]);

  // Count uncategorized per month
  const uncategorizedByMonth = useMemo(() => {
    const counts: Record<number, number> = {};
    transactions.forEach(t => {
      const d = new Date(t.date);
      if (d.getFullYear() === selectedYear && !t.accountCode) {
        const m = d.getMonth();
        counts[m] = (counts[m] || 0) + 1;
      }
    });
    return counts;
  }, [transactions, selectedYear]);

  // Check if month is reconciled (has at least one reconciled account for that period)
  const reconciledMonths = useMemo(() => {
    const months = new Set<number>();
    reconciliations.forEach(r => {
      if (r.status === 'reconciled') {
        const d = new Date(r.periodEnd);
        if (d.getFullYear() === selectedYear) {
          months.add(d.getMonth());
        }
      }
    });
    return months;
  }, [reconciliations, selectedYear]);

  // Get period status
  const getStatus = (month: number) => {
    const record = periodCloses.find(p => p.year === selectedYear && p.month === month + 1);
    return record?.status || 'open';
  };

  const getCloseRecord = (month: number) => {
    return periodCloses.find(p => p.year === selectedYear && p.month === month + 1);
  };

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const handleClose = async (month: number) => {
    setProcessing(true);
    await onClose(selectedYear, month + 1, notes);
    setClosing(null);
    setNotes('');
    setProcessing(false);
    onReload();
  };

  const handleReopen = async (month: number) => {
    setProcessing(true);
    await onReopen(selectedYear, month + 1);
    setProcessing(false);
    onReload();
  };

  const canClose = (month: number) => {
    // Can't close future months
    if (selectedYear > currentYear) return false;
    if (selectedYear === currentYear && month > currentMonth) return false;
    // Must have transactions categorized
    if (uncategorizedByMonth[month] > 0) return false;
    // Should be reconciled (warning but not blocking)
    return true;
  };

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <div className="px-4 py-3 border-b bg-gray-50">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm text-gray-600">Fiscal Year {selectedYear}</span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-500 rounded-full"></span> Closed</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-yellow-500 rounded-full"></span> Open</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-500 rounded-full"></span> Current</span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Month</th>
              <th className="px-4 py-3 text-right font-semibold">Transactions</th>
              <th className="px-4 py-3 text-right font-semibold">Uncategorized</th>
              <th className="px-4 py-3 text-center font-semibold">Reconciled</th>
              <th className="px-4 py-3 text-center font-semibold">Status</th>
              <th className="px-4 py-3 text-center font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {MONTHS.map((monthName, idx) => {
              const status = getStatus(idx);
              const record = getCloseRecord(idx);
              const txnCount = txnsByMonth[idx] || 0;
              const uncatCount = uncategorizedByMonth[idx] || 0;
              const isReconciled = reconciledMonths.has(idx);
              const isCurrent = selectedYear === currentYear && idx === currentMonth;
              const isFuture = selectedYear > currentYear || (selectedYear === currentYear && idx > currentMonth);

              return (
                <tr key={idx} className={`${isCurrent ? 'bg-blue-50' : ''} ${status === 'closed' ? 'bg-green-50' : ''}`}>
                  <td className="px-4 py-3 font-medium">
                    {monthName}
                    {isCurrent && <span className="ml-2 text-xs text-blue-600">(Current)</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">{txnCount || '-'}</td>
                  <td className="px-4 py-3 text-right">
                    {uncatCount > 0 ? (
                      <span className="text-red-600 font-medium">{uncatCount}</span>
                    ) : txnCount > 0 ? (
                      <span className="text-green-600">✓</span>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isReconciled ? (
                      <span className="text-green-600">✓</span>
                    ) : txnCount > 0 ? (
                      <span className="text-yellow-600">⚠️</span>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {status === 'closed' ? (
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">🔒 Closed</span>
                    ) : isFuture ? (
                      <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded text-xs">Future</span>
                    ) : isCurrent ? (
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">🔄 Current</span>
                    ) : (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">⚠️ Open</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {status === 'closed' ? (
                      <button
                        onClick={() => handleReopen(idx)}
                        disabled={processing}
                        className="text-xs text-gray-500 hover:text-red-600"
                      >
                        Reopen
                      </button>
                    ) : closing === idx ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Notes (optional)"
                          className="px-2 py-1 border rounded text-xs w-32"
                        />
                        <button
                          onClick={() => handleClose(idx)}
                          disabled={processing || !canClose(idx)}
                          className="px-2 py-1 bg-green-600 text-white rounded text-xs disabled:opacity-50"
                        >
                          {processing ? '...' : 'Confirm'}
                        </button>
                        <button
                          onClick={() => setClosing(null)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          ✕
                        </button>
                      </div>
                    ) : !isFuture && !isCurrent && txnCount > 0 ? (
                      <button
                        onClick={() => setClosing(idx)}
                        disabled={!canClose(idx)}
                        className="px-3 py-1 bg-[#2d1b4e] text-white rounded text-xs font-medium disabled:opacity-50"
                        title={uncatCount > 0 ? 'Categorize all transactions first' : ''}
                      >
                        Close Period
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary Footer */}
      <div className="px-4 py-3 bg-gray-50 border-t flex justify-between text-sm">
        <span className="text-gray-600">
          Closed: {periodCloses.filter(p => p.year === selectedYear && p.status === 'closed').length} / 12 months
        </span>
        <span className="text-gray-600">
          {periodCloses.filter(p => p.year === selectedYear && p.status === 'closed').length === 12 ? (
            <span className="text-green-600 font-medium">✓ Year Complete</span>
          ) : (
            <span className="text-yellow-600">Year in progress</span>
          )}
        </span>
      </div>
    </div>
  );
}
