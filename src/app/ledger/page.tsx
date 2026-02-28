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
        <div className="text-sm text-text-secondary">Loading ledger...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-row py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-primary">General Ledger</h1>
          <p className="text-text-secondary mt-2">All posted transactions grouped by account</p>
        </div>

        {/* Account Filter */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-text-secondary mb-2">
            Filter by Account
          </label>
          <select
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            className="px-4 py-2 border border-border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          <div className="bg-white rounded shadow text-center py-12">
            <p className="text-text-muted">No ledger entries found</p>
          </div>
        ) : (
          <div className="space-y-8">
            {filteredLedgers.map(account => (
              <div key={account.accountCode} className="bg-white rounded shadow overflow-hidden">
                {/* Account header */}
                <div className="bg-bg-row px-6 py-4 border-b flex items-center justify-between">
                  <div>
                    <span className="font-mono font-medium text-text-primary">{account.accountCode}</span>
                    <span className="ml-3 text-text-secondary">{account.accountName}</span>
                    <span className="ml-3 text-xs text-text-muted uppercase">{account.accountType}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm text-text-muted">Closing Balance: </span>
                    <span className="font-semibold text-text-primary">{formatMoney(account.closingBalance)}</span>
                  </div>
                </div>

                {/* Entries table */}
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-bg-row">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                        Description
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">
                        Debit
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">
                        Credit
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">
                        Balance
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-border">
                    {account.entries.map((entry) => (
                      <tr key={entry.id} className={`hover:bg-bg-row ${entry.is_reversal ? 'text-brand-red' : ''}`}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {new Date(entry.date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {entry.description}
                          {entry.is_reversal && (
                            <span className="ml-2 px-1.5 py-0.5 bg-red-100 text-brand-red rounded text-xs">Reversal</span>
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
