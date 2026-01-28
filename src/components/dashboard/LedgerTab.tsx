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
          <h2 className="text-2xl font-bold">General Ledger</h2>
          <p className="text-sm text-gray-600 mt-1">{filtered.length} accounts with activity</p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search accounts..."
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg text-sm"
          />
          <select 
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            className="px-4 py-2 border rounded-lg text-sm"
          >
            {accountTypes.map(type => (
              <option key={type} value={type}>
                {type === 'all' ? 'All Types' : type.charAt(0).toUpperCase() + type.slice(1)}
              </option>
            ))}
          </select>
          <button 
            onClick={loadLedger}
            className="px-4 py-2 bg-[#2d1b4e] text-white rounded-lg text-sm"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {filtered.map((ledger) => (
          <div key={ledger.accountCode} className="bg-white border rounded-xl overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold">
                    <span className="font-mono mr-2">{ledger.accountCode}</span>
                    {ledger.accountName}
                  </h3>
                  <span className={`inline-block mt-1 px-2 py-1 rounded text-xs font-medium ${
                    ledger.accountType === 'asset' ? 'bg-blue-100 text-blue-700' :
                    ledger.accountType === 'liability' ? 'bg-red-100 text-red-700' :
                    ledger.accountType === 'equity' ? 'bg-purple-100 text-purple-700' :
                    ledger.accountType === 'revenue' ? 'bg-green-100 text-green-700' :
                    'bg-orange-100 text-orange-700'
                  }`}>
                    {ledger.accountType}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-600">Closing Balance</div>
                  <div className={`text-xl font-bold ${
                    ledger.closingBalance > 0 ? 'text-green-600' : 
                    ledger.closingBalance < 0 ? 'text-red-600' : 
                    'text-gray-400'
                  }`}>
                    ${Math.abs(ledger.closingBalance).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            {ledger.entries.length > 0 ? (
              <div className="overflow-auto" style={{maxHeight: '400px'}}>
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Date</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Description</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600">Debit</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600">Credit</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-sm">
                    {ledger.entries.map((entry, idx) => (
                      <tr key={entry.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2">{new Date(entry.date).toLocaleDateString()}</td>
                        <td className="px-4 py-2">{entry.description}</td>
                        <td className="px-4 py-2 text-right font-semibold text-blue-600">
                          {entry.entryType === 'D' ? `$${entry.amount.toFixed(2)}` : '—'}
                        </td>
                        <td className="px-4 py-2 text-right font-semibold text-green-600">
                          {entry.entryType === 'C' ? `$${entry.amount.toFixed(2)}` : '—'}
                        </td>
                        <td className="px-4 py-2 text-right font-bold">
                          ${Math.abs(entry.runningBalance).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-6 py-8 text-center text-gray-500 text-sm">
                No transactions in this account
              </div>
            )}
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="bg-white border rounded-xl p-8 text-center text-gray-500">
          No accounts found matching your filters
        </div>
      )}
    </div>
  );
}
