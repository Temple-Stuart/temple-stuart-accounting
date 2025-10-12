'use client';

import { useEffect, useState } from 'react';

interface JournalEntry {
  id: string;
  date: string;
  description: string;
  transactionId: string;
  debitAccount: string;
  creditAccount: string;
  amount: number;
  posted: boolean;
}

export default function JournalEntriesPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/journal-entries')
      .then(res => res.json())
      .then(data => {
        setEntries(data.entries || []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const formatMoney = (cents: number) => {
    return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  };

  if (loading) return <div className="p-8">Loading journal entries...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Journal Entries</h1>

      <table className="w-full border">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-3 text-left">Date</th>
            <th className="p-3 text-left">Description</th>
            <th className="p-3 text-left">Debit Account</th>
            <th className="p-3 text-left">Credit Account</th>
            <th className="p-3 text-right">Amount</th>
            <th className="p-3 text-center">Status</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(entry => (
            <tr key={entry.id} className="border-t">
              <td className="p-3">{new Date(entry.date).toLocaleDateString()}</td>
              <td className="p-3">{entry.description}</td>
              <td className="p-3 font-mono">{entry.debitAccount}</td>
              <td className="p-3 font-mono">{entry.creditAccount}</td>
              <td className="p-3 text-right font-semibold">{formatMoney(entry.amount)}</td>
              <td className="p-3 text-center">
                {entry.posted ? (
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">Posted</span>
                ) : (
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">Pending</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {entries.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No journal entries yet. Commit transactions to create entries.
        </div>
      )}
    </div>
  );
}
