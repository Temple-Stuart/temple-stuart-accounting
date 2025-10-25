'use client';

import { useState, useEffect } from 'react';

interface PendingTransaction {
  id: string;
  date: string;
  merchantName: string;
  amount: number;
  category: string | null;
  predictedCoaCode: string | null;
  predictionConfidence: number | null;
  accountCode: string | null;
  accountName: string;
  institutionName: string;
}

export default function ReviewQueueTab({ coaOptions }: { coaOptions: any[] }) {
  const [transactions, setTransactions] = useState<PendingTransaction[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [categorizing, setCategorizing] = useState(false);
  const [committing, setCommitting] = useState(false);

  useEffect(() => {
    loadReviewQueue();
  }, []);

  const loadReviewQueue = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/transactions/review-queue');
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions || []);
      }
    } catch (error) {
      console.error('Error loading review queue:', error);
    }
    setLoading(false);
  };

  const runAutoCategorization = async () => {
    setCategorizing(true);
    try {
      const res = await fetch('/api/transactions/auto-categorize', {
        method: 'POST'
      });
      if (res.ok) {
        const data = await res.json();
        alert(data.message);
        await loadReviewQueue();
      }
    } catch (error) {
      console.error('Error auto-categorizing:', error);
      alert('Failed to auto-categorize transactions');
    }
    setCategorizing(false);
  };

  const handleCategoryChange = async (txnId: string, newCoaCode: string) => {
    try {
      await fetch('/api/transactions/assign-coa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionIds: [txnId],
          accountCode: newCoaCode
        })
      });
      
      setTransactions(prev =>
        prev.map(t =>
          t.id === txnId ? { ...t, accountCode: newCoaCode } : t
        )
      );
    } catch (error) {
      console.error('Error updating category:', error);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.size === transactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(transactions.map(t => t.id)));
    }
  };

  const handleToggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const commitSelected = async () => {
    if (selectedIds.size === 0) {
      alert('No transactions selected');
      return;
    }

    setCommitting(true);
    try {
      const res = await fetch('/api/transactions/commit-to-ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionIds: Array.from(selectedIds),
          accountCode: 'dummy' // Will use accountCode from each transaction
        })
      });

      if (res.ok) {
        const data = await res.json();
        alert(`Committed ${data.committed} transactions`);
        setSelectedIds(new Set());
        await loadReviewQueue();
      }
    } catch (error) {
      console.error('Error committing transactions:', error);
      alert('Failed to commit transactions');
    }
    setCommitting(false);
  };

  if (loading) {
    return <div className="p-8 text-center">Loading review queue...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Review Queue</h2>
          <p className="text-sm text-gray-600">{transactions.length} transactions pending review</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={runAutoCategorization}
            disabled={categorizing}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg disabled:bg-gray-400"
          >
            {categorizing ? 'Categorizing...' : '🤖 Auto-Categorize'}
          </button>
          <button
            onClick={commitSelected}
            disabled={committing || selectedIds.size === 0}
            className="px-4 py-2 bg-[#b4b237] text-white rounded-lg disabled:bg-gray-400"
          >
            {committing ? 'Committing...' : `Commit Selected (${selectedIds.size})`}
          </button>
        </div>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedIds.size === transactions.length && transactions.length > 0}
                  onChange={handleSelectAll}
                />
              </th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Merchant</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-left">Predicted Category</th>
              <th className="px-4 py-3 text-left">Confidence</th>
              <th className="px-4 py-3 text-left">Assign Category</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {transactions.map(txn => {
              const finalCoaCode = txn.accountCode || txn.predictedCoaCode;
              const confidence = txn.predictionConfidence;
              const confidenceColor = confidence
                ? confidence > 0.8 ? 'text-green-600' : confidence > 0.6 ? 'text-yellow-600' : 'text-red-600'
                : 'text-gray-400';

              return (
                <tr key={txn.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(txn.id)}
                      onChange={() => handleToggleSelect(txn.id)}
                    />
                  </td>
                  <td className="px-4 py-2">{new Date(txn.date).toLocaleDateString()}</td>
                  <td className="px-4 py-2">{txn.merchantName}</td>
                  <td className="px-4 py-2 text-right font-medium">${Math.abs(txn.amount).toFixed(2)}</td>
                  <td className="px-4 py-2">
                    {finalCoaCode ? (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {finalCoaCode}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">None</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {confidence ? (
                      <span className={`text-xs font-semibold ${confidenceColor}`}>
                        {(confidence * 100).toFixed(0)}%
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={finalCoaCode || ''}
                      onChange={(e) => handleCategoryChange(txn.id, e.target.value)}
                      className="text-xs border rounded px-2 py-1 w-full"
                    >
                      <option value="">Select category...</option>
                      {coaOptions.map(coa => (
                        <option key={coa.code} value={coa.code}>
                          {coa.code} - {coa.name}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
