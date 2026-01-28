'use client';

import { useState, useEffect } from 'react';

interface ClosingPeriod {
  id: string;
  periodType: 'monthly' | 'quarterly' | 'yearly';
  periodEnd: string;
  status: 'open' | 'closed';
  closedAt?: Date;
  closedBy?: string;
}

export default function CloseBooksTab() {
  const [periods, setPeriods] = useState<ClosingPeriod[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [periodType, setPeriodType] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');

  useEffect(() => {
    loadPeriods();
  }, []);

  const loadPeriods = async () => {
    try {
      const res = await fetch('/api/closing-periods');
      if (res.ok) {
        const data = await res.json();
        setPeriods(data.periods || []);
      }
    } catch (error) {
      console.error('Error loading periods:', error);
    }
  };

  const generatePeriodEnd = () => {
    const now = new Date();
    if (periodType === 'monthly') {
      return new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]; // Last day of previous month
    } else if (periodType === 'quarterly') {
      const quarter = Math.floor(now.getMonth() / 3);
      return new Date(now.getFullYear(), quarter * 3, 0).toISOString().split('T')[0];
    } else {
      return new Date(now.getFullYear() - 1, 11, 31).toISOString().split('T')[0];
    }
  };

  const handleClosePeriod = async () => {
    if (!selectedPeriod) {
      alert('Please enter a period end date');
      return;
    }

    const confirm = window.confirm(
      `Are you sure you want to close the books for period ending ${selectedPeriod}?\n\n` +
      `This will:\n` +
      `• Close all revenue and expense accounts\n` +
      `• Transfer net income to equity\n` +
      `• Mark the period as closed\n\n` +
      `This action cannot be easily undone.`
    );

    if (!confirm) return;

    setLoading(true);
    try {
      const res = await fetch('/api/closing-periods/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodEnd: selectedPeriod,
          periodType
        })
      });

      const result = await res.json();

      if (res.ok) {
        alert(`✅ Books closed successfully!\n\nNet Income: $${result.netIncome?.toFixed(2) || '0.00'}\nClosing Entry ID: ${result.closingEntryId}`);
        loadPeriods();
        setSelectedPeriod('');
      } else {
        alert(`❌ Error: ${result.error || 'Failed to close books'}`);
      }
    } catch (error) {
      alert('Failed to close period');
    }
    setLoading(false);
  };

  const handleReopenPeriod = async (periodId: string) => {
    const confirm = window.confirm(
      'Are you sure you want to reopen this period?\n\n' +
      'This will reverse the closing entries and allow modifications.'
    );

    if (!confirm) return;

    setLoading(true);
    try {
      const res = await fetch('/api/closing-periods/reopen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodId })
      });

      if (res.ok) {
        alert('✅ Period reopened successfully!');
        loadPeriods();
      } else {
        alert('❌ Failed to reopen period');
      }
    } catch (error) {
      alert('Failed to reopen period');
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Close Books</h2>
          <p className="text-sm text-gray-600 mt-1">Period-end closing process</p>
        </div>
        <button 
          onClick={loadPeriods}
          className="px-4 py-2 bg-[#2d1b4e] text-white rounded-lg text-sm"
        >
          Refresh
        </button>
      </div>

      {/* Close New Period */}
      <div className="bg-white border rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">Close New Period</h3>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Period Type</label>
              <select
                value={periodType}
                onChange={(e) => {
                  setPeriodType(e.target.value as any);
                  setSelectedPeriod(generatePeriodEnd());
                }}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Period End Date</label>
              <input
                type="date"
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-yellow-900 mb-2">Pre-Closing Checklist</h4>
            <ul className="text-sm text-yellow-800 space-y-1">
              <li>✓ All transactions for the period have been recorded</li>
              <li>✓ Bank accounts have been reconciled</li>
              <li>✓ All adjusting entries have been made</li>
              <li>✓ Financial statements have been reviewed</li>
              <li>✓ All accounts are accurate and balanced</li>
            </ul>
          </div>

          <button
            onClick={handleClosePeriod}
            disabled={!selectedPeriod || loading}
            className={`w-full py-3 rounded-lg text-sm font-medium ${
              selectedPeriod && !loading
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {loading ? 'Closing Period...' : 'Close Books for This Period'}
          </button>
        </div>
      </div>

      {/* Closed Periods History */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="bg-gray-50 px-6 py-4 border-b">
          <h3 className="text-lg font-semibold">Closed Periods History</h3>
        </div>
        
        {periods.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500 text-sm">
            No periods have been closed yet
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Period End</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Closed At</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {periods.map((period) => (
                  <tr key={period.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium">
                      {new Date(period.periodEnd).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm capitalize">{period.periodType}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        period.status === 'closed' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {period.status === 'closed' ? 'Closed' : 'Open'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {period.closedAt 
                        ? new Date(period.closedAt).toLocaleString()
                        : '—'
                      }
                    </td>
                    <td className="px-4 py-3 text-center">
                      {period.status === 'closed' && (
                        <button
                          onClick={() => handleReopenPeriod(period.id)}
                          disabled={loading}
                          className="px-3 py-1 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 disabled:opacity-50"
                        >
                          Reopen
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">About Closing Books</h3>
        <p className="text-sm text-blue-800">
          Closing the books is the final step in the accounting cycle. It transfers all revenue and expense 
          balances to equity (retained earnings), resetting them to zero for the next period. This process 
          creates a clear separation between accounting periods and ensures accurate financial reporting.
        </p>
      </div>
    </div>
  );
}
