'use client';

import { useState, useEffect } from 'react';

interface LedgerEntryItem {
  id: string;
  date: string;
  description: string;
  entryType: 'D' | 'C';
  amount: number; // already dollars from API
  runningBalance: number; // already dollars from API
  journal_id: string;
  is_reversal: boolean;
}

interface AccountLedger {
  accountCode: string;
  accountName: string;
  accountType: string;
  balanceType: string;
  entries: LedgerEntryItem[];
  openingBalance: number;
  closingBalance: number;
}

export default function LedgerPage() {
  const [ledgers, setLedgers] = useState<AccountLedger[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/ledger')
      .then(res => res.json())
      .then(data => {
        setLedgers(data.ledgers || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load ledger:', err);
        setLoading(false);
      });
  }, []);

  const filteredLedgers = selectedAccount === 'all'
    ? ledgers
    : ledgers.filter(l => l.accountCode === selectedAccount);

  const formatMoney = (amount: number) => {
    return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-gray-600">Loading ledger...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">General Ledger</h1>
          <p className="text-gray-600 mt-2">All posted transactions grouped by account</p>
        </div>

        {/* Account Filter */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Filter by Account
          </label>
          <select
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Accounts</option>
            {ledgers.map(l => (
              <option key={l.accountCode} value={l.accountCode}>
                {l.accountCode} — {l.accountName}
              </option>
            ))}
          </select>
        </div>

        {/* Account Ledgers */}
        {filteredLedgers.length === 0 ? (
          <div className="bg-white rounded-lg shadow text-center py-12">
            <p className="text-gray-500">No ledger entries found</p>
          </div>
        ) : (
          <div className="space-y-8">
            {filteredLedgers.map(account => (
              <div key={account.accountCode} className="bg-white rounded-lg shadow overflow-hidden">
                {/* Account header */}
                <div className="bg-gray-50 px-6 py-4 border-b flex items-center justify-between">
                  <div>
                    <span className="font-mono font-medium text-gray-900">{account.accountCode}</span>
                    <span className="ml-3 text-gray-700">{account.accountName}</span>
                    <span className="ml-3 text-xs text-gray-500 uppercase">{account.accountType}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm text-gray-500">Closing Balance: </span>
                    <span className="font-semibold text-gray-900">{formatMoney(account.closingBalance)}</span>
                  </div>
                </div>

                {/* Entries table */}
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Description
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Debit
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Credit
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Balance
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {account.entries.map((entry) => (
                      <tr key={entry.id} className={`hover:bg-gray-50 ${entry.is_reversal ? 'text-red-600' : ''}`}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {new Date(entry.date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {entry.description}
                          {entry.is_reversal && (
                            <span className="ml-2 px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-xs">Reversal</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                          {entry.entryType === 'D' ? formatMoney(entry.amount) : '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                          {entry.entryType === 'C' ? formatMoney(entry.amount) : '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                          {formatMoney(entry.runningBalance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
