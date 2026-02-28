'use client';

import { useEffect, useState } from 'react';

interface LedgerLine {
  id: string;
  entry_type: 'D' | 'C';
  amount: string; // BigInt cents as string
  account: {
    code: string;
    name: string;
  };
}

interface JournalEntry {
  id: string;
  date: string;
  description: string;
  status: string;
  source_type: string;
  is_reversal?: boolean;
  ledger_entries: LedgerLine[];
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

  const formatMoney = (cents: string) => {
    const amount = parseInt(cents) / 100;
    return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  };

  if (loading) return <div className="p-8">Loading journal entries...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Journal Entries</h1>

      {entries.length === 0 ? (
        <div className="text-center py-12 text-text-muted">
          No journal entries yet. Commit transactions to create entries.
        </div>
      ) : (
        <div className="space-y-6">
          {entries.map(entry => {
            const debits = entry.ledger_entries.filter(l => l.entry_type === 'D');
            const credits = entry.ledger_entries.filter(l => l.entry_type === 'C');

            return (
              <div key={entry.id} className="border rounded overflow-hidden">
                {/* Entry header */}
                <div className="bg-bg-row px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-text-secondary">
                      {new Date(entry.date).toLocaleDateString()}
                    </span>
                    <span className="font-medium">{entry.description}</span>
                    {entry.is_reversal && (
                      <span className="px-2 py-0.5 bg-red-100 text-brand-red rounded text-xs">Reversal</span>
                    )}
                  </div>
                  <span className={`px-2 py-1 rounded text-xs ${
                    entry.status === 'posted'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {entry.status === 'posted' ? 'Posted' : entry.status}
                  </span>
                </div>

                {/* Ledger lines */}
                <table className="w-full">
                  <thead className="bg-bg-row text-xs text-text-muted uppercase">
                    <tr>
                      <th className="px-4 py-2 text-left w-1/3">Account</th>
                      <th className="px-4 py-2 text-right w-1/3">Debit</th>
                      <th className="px-4 py-2 text-right w-1/3">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {debits.map(line => (
                      <tr key={line.id} className="border-t">
                        <td className="px-4 py-2 font-mono text-sm">
                          {line.account.code} — {line.account.name}
                        </td>
                        <td className="px-4 py-2 text-right font-semibold text-sm">
                          {formatMoney(line.amount)}
                        </td>
                        <td className="px-4 py-2 text-right text-sm text-text-faint">—</td>
                      </tr>
                    ))}
                    {credits.map(line => (
                      <tr key={line.id} className="border-t">
                        <td className="px-4 py-2 font-mono text-sm pl-8">
                          {line.account.code} — {line.account.name}
                        </td>
                        <td className="px-4 py-2 text-right text-sm text-text-faint">—</td>
                        <td className="px-4 py-2 text-right font-semibold text-sm">
                          {formatMoney(line.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
