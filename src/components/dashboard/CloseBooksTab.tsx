'use client';

import { useState, useEffect, useCallback } from 'react';

interface YearEndStatus {
  isClosed: boolean;
  closingEntryId: string | null;
  netIncome: number | null;
  closedAt: string | null;
}

interface CloseBooksTabProps {
  entityId: string | null;
  selectedYear: number;
}

export default function CloseBooksTab({ entityId, selectedYear }: CloseBooksTabProps) {
  const [status, setStatus] = useState<YearEndStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);

  const loadStatus = useCallback(async () => {
    if (!entityId) return;
    setChecking(true);
    try {
      const res = await fetch(`/api/year-end-close?entityId=${entityId}&year=${selectedYear}`);
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('Error loading year-end close status:', error);
    }
    setChecking(false);
  }, [entityId, selectedYear]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleYearEndClose = async () => {
    if (!entityId) {
      alert('No entity found. Create an entity first.');
      return;
    }

    const confirm = window.confirm(
      `Are you sure you want to perform the year-end close for ${selectedYear}?\n\n` +
      `This will:\n` +
      `• Close all revenue and expense accounts to zero\n` +
      `• Transfer net income to Retained Earnings (3900)\n` +
      `• Create a closing journal entry dated Dec 31, ${selectedYear}\n\n` +
      `All 12 months must be period-closed first.`
    );

    if (!confirm) return;

    setLoading(true);
    try {
      const res = await fetch('/api/year-end-close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityId, year: selectedYear }),
      });

      const result = await res.json();

      if (res.ok) {
        const netDollars = (result.netIncome / 100).toFixed(2);
        alert(
          `Books closed successfully!\n\n` +
          `Net Income: $${netDollars}\n` +
          `Accounts Closed: ${result.accountsClosed}\n` +
          `Closing Entry ID: ${result.closingEntryId}`
        );
        loadStatus();
      } else {
        alert(`Error: ${result.error || 'Failed to close year'}`);
      }
    } catch (error) {
      alert('Failed to perform year-end close');
    }
    setLoading(false);
  };

  const formatCents = (cents: number | null) => {
    if (cents === null) return '—';
    const dollars = cents / 100;
    return dollars < 0
      ? `-$${Math.abs(dollars).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `$${dollars.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <span className="text-terminal-sm text-text-muted font-mono">GAAP year-end closing entries for {selectedYear}</span>
        <button
          onClick={loadStatus}
          disabled={checking}
          className="px-3 py-1 text-xs border border-border text-text-secondary rounded-lg hover:bg-bg-row transition-colors disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {/* Status */}
      {status?.isClosed ? (
        <div className="bg-green-50 border border-green-200 rounded p-6">
          <h3 className="text-terminal-lg font-semibold text-green-900 mb-3">Year {selectedYear} Closed</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-green-700 font-medium">Net Income:</span>
              <span className="ml-2 text-green-900 font-semibold">{formatCents(status.netIncome)}</span>
            </div>
            <div>
              <span className="text-green-700 font-medium">Closed At:</span>
              <span className="ml-2 text-green-900">{status.closedAt ? new Date(status.closedAt).toLocaleString() : '—'}</span>
            </div>
            <div className="col-span-2">
              <span className="text-green-700 font-medium">Closing Entry:</span>
              <span className="ml-2 text-green-900 font-mono text-xs">{status.closingEntryId}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border rounded p-6">
          <h3 className="text-terminal-lg font-semibold mb-4">Close Year {selectedYear}</h3>

          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
              <h4 className="text-sm font-semibold text-yellow-900 mb-2">Pre-Closing Checklist</h4>
              <ul className="text-sm text-yellow-800 space-y-1">
                <li>All 12 months must be period-closed</li>
                <li>All transactions for the year have been recorded</li>
                <li>Bank accounts have been reconciled</li>
                <li>All adjusting entries have been made</li>
                <li>Financial statements have been reviewed</li>
              </ul>
            </div>

            <button
              onClick={handleYearEndClose}
              disabled={loading || !entityId}
              className={`w-full py-3 rounded text-sm font-medium ${
                !loading && entityId
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-border text-text-muted cursor-not-allowed'
              }`}
            >
              {loading ? 'Closing Year...' : `Close Books for ${selectedYear}`}
            </button>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-brand-purple-wash border border-blue-200 rounded p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">About Year-End Close</h3>
        <p className="text-sm text-blue-800">
          Year-end close is the final step in the annual accounting cycle. It creates closing journal entries that
          zero out all revenue and expense accounts, transferring the net income (or loss) to Retained Earnings (3900).
          This ensures clean income statement balances for the next fiscal year while preserving the cumulative
          equity position on the balance sheet.
        </p>
      </div>
    </div>
  );
}
