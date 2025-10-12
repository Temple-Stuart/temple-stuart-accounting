'use client';

import { useEffect, useState } from 'react';

interface LedgerEntry {
  id: string;
  date: string;
  description: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  balance: number;
}

export default function LedgerPage() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [accounts, setAccounts] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/ledger')
      .then(res => res.json())
      .then(data => {
        setEntries(data.entries || []);
        const uniqueAccounts = [...new Set(data.entries.map((e: LedgerEntry) => e.accountCode))];
        setAccounts(uniqueAccounts);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const filteredEntries = selectedAccount === 'all' 
    ? entries 
    : entries.filter(e => e.accountCode === selectedAccount);

  const formatMoney = (cents: number) => {
    return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  };

  if (loading) return <div className="p-8">Loading ledger...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">General Ledger</h1>

      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Filter by Account:</label>
        <select 
          value={selectedAccount}
          onChange={(e) => setSelectedAccount(e.target.value)}
          className="border rounded px-4 py-2 w-64"
        >
          <option value="all">All Accounts</option>
          {accounts.map(code => (
            <option key={code} value={code}>{code}</option>
          ))}
        </select>
      </div>

      <table className="w-full border">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-3 text-left">Date</th>
            <th className="p-3 text-left">Account</th>
            <th className="p-3 text-left">Description</th>
            <th className="p-3 text-right">Debit</th>
            <th className="p-3 text-right">Credit</th>
            <th className="p-3 text-right">Balance</th>
          </tr>
        </thead>
        <tbody>
          {filteredEntries.map(entry => (
            <tr key={entry.id} className="border-t">
              <td className="p-3">{new Date(entry.date).toLocaleDateString()}</td>
              <td className="p-3 font-mono">{entry.accountCode} - {entry.accountName}</td>
              <td className="p-3">{entry.description}</td>
              <td className="p-3 text-right">{entry.debit > 0 ? formatMoney(entry.debit) : ''}</td>
              <td className="p-3 text-right">{entry.credit > 0 ? formatMoney(entry.credit) : ''}</td>
              <td className="p-3 text-right font-semibold">{formatMoney(entry.balance)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {filteredEntries.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No ledger entries yet. Commit some transactions to see them here.
        </div>
      )}
    </div>
  );
}
