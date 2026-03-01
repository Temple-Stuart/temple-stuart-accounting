'use client';

import { useState, useEffect } from 'react';

interface LedgerEntry {
  id: string;
  date: Date;
  description: string;
  entryType: 'D' | 'C';
  amount: number;
  runningBalance: number;
}

interface AccountLedger {
  accountCode: string;
  accountName: string;
  accountType: string;
  entries: LedgerEntry[];
  openingBalance: number;
  closingBalance: number;
}

export default function LedgerTab() {
  const [ledgers, setLedgers] = useState<AccountLedger[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [accountFilter, setAccountFilter] = useState<string>('');

  useEffect(() => {
    loadLedger();
  }, []);

  const loadLedger = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ledger');
      if (res.ok) {
        const data = await res.json();
        setLedgers(data.ledgers || []);
      }
    } catch (error) {
      console.error('Error loading ledger:', error);
    }
    setLoading(false);
  };

  const getFilteredLedgers = () => {
    let filtered = ledgers;
    
    if (selectedAccount !== 'all') {
      filtered = filtered.filter(l => l.accountType.toLowerCase() === selectedAccount.toLowerCase());
    }
    
    if (accountFilter) {
      filtered = filtered.filter(l => 
        l.accountCode.toLowerCase().includes(accountFilter.toLowerCase()) ||
        l.accountName.toLowerCase().includes(accountFilter.toLowerCase())
      );
    }
    
    return filtered;
  };

  const accountTypes = ['all', 'asset', 'liability', 'equity', 'revenue', 'expense'];

  if (loading) {
    return <div className="p-8 text-center">Loading ledger...</div>;
  }

  const filtered = getFilteredLedgers();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-sm font-bold">General Ledger</h2>
          <p className="text-sm text-text-secondary mt-1">{filtered.length} accounts with activity</p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search accounts..."
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
            className="px-4 py-2 border rounded text-sm"
          />
          <select 
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            className="px-4 py-2 border rounded text-sm"
          >
            {accountTypes.map(type => (
              <option key={type} value={type}>
                {type === 'all' ? 'All Types' : type.charAt(0).toUpperCase() + type.slice(1)}
              </option>
            ))}
          </select>
          <button 
            onClick={loadLedger}
            className="px-4 py-2 bg-brand-purple text-white rounded text-sm"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {filtered.map((ledger) => (
          <div key={ledger.accountCode} className="bg-white border rounded overflow-hidden">
            <div className="bg-bg-row px-6 py-4 border-b">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-terminal-lg font-semibold">
                    <span className="font-mono mr-2">{ledger.accountCode}</span>
                    {ledger.accountName}
                  </h3>
                  <span className={`inline-block mt-1 px-2 py-1 rounded text-xs font-medium ${
                    ledger.accountType === 'asset' ? 'bg-brand-purple-wash text-brand-purple' :
                    ledger.accountType === 'liability' ? 'bg-red-100 text-brand-red' :
                    ledger.accountType === 'equity' ? 'bg-purple-100 text-purple-700' :
                    ledger.accountType === 'revenue' ? 'bg-green-100 text-brand-green' :
                    'bg-orange-100 text-orange-700'
                  }`}>
                    {ledger.accountType}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-sm text-text-secondary">Closing Balance</div>
                  <div className={`text-sm font-bold ${
                    ledger.closingBalance > 0 ? 'text-brand-green' :
                    ledger.closingBalance < 0 ? 'text-brand-red' :
                    'text-text-faint'
                  }`}>
                    {ledger.closingBalance < 0 ? '-' : ''}${Math.abs(ledger.closingBalance).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            {ledger.entries.length > 0 ? (
              <div className="overflow-auto" style={{maxHeight: '400px'}}>
                <table className="w-full">
                  <thead className="bg-bg-row sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-text-secondary">Date</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-text-secondary">Description</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-text-secondary">Debit</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-text-secondary">Credit</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-text-secondary">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-sm">
                    {ledger.entries.map((entry, idx) => (
                      <tr key={entry.id} className="hover:bg-bg-row">
                        <td className="px-4 py-2">{new Date(entry.date).toLocaleDateString()}</td>
                        <td className="px-4 py-2">{entry.description}</td>
                        <td className="px-4 py-2 text-right font-semibold text-brand-purple">
                          {entry.entryType === 'D' ? `$${entry.amount.toFixed(2)}` : '—'}
                        </td>
                        <td className="px-4 py-2 text-right font-semibold text-brand-green">
                          {entry.entryType === 'C' ? `$${entry.amount.toFixed(2)}` : '—'}
                        </td>
                        <td className="px-4 py-2 text-right font-bold">
                          {entry.runningBalance < 0 ? '-' : ''}${Math.abs(entry.runningBalance).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-6 py-8 text-center text-text-muted text-sm">
                No transactions in this account
              </div>
            )}
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="bg-white border rounded p-8 text-center text-text-muted">
          No accounts found matching your filters
        </div>
      )}
    </div>
  );
}
