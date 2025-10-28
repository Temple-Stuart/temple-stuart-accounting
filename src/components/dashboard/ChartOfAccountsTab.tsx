'use client';

import { useState, useEffect } from 'react';

interface CoaAccount {
  id: string;
  code: string;
  name: string;
  accountType: string;
  balanceType: string;
  settledBalance: bigint;
  isArchived: boolean;
}

export default function ChartOfAccountsTab() {
  const [accounts, setAccounts] = useState<CoaAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/chart-of-accounts');
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts || []);
      }
    } catch (error) {
      console.error('Error loading COA:', error);
    }
    setLoading(false);
  };

  const groupByType = () => {
    const grouped: {[key: string]: CoaAccount[]} = {};
    accounts.forEach(acc => {
      if (!grouped[acc.accountType]) {
        grouped[acc.accountType] = [];
      }
      grouped[acc.accountType].push(acc);
    });
    return grouped;
  };

  const getFilteredAccounts = () => {
    if (filter === 'all') return accounts;
    return accounts.filter(acc => acc.accountType.toLowerCase() === filter.toLowerCase());
  };

  const accountTypes = ['all', 'asset', 'liability', 'equity', 'revenue', 'expense'];

  if (loading) {
    return <div className="p-8 text-center">Loading chart of accounts...</div>;
  }

  const grouped = groupByType();
  const filtered = getFilteredAccounts();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Chart of Accounts</h2>
        <div className="flex gap-2">
          <select 
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg text-sm"
          >
            {accountTypes.map(type => (
              <option key={type} value={type}>
                {type === 'all' ? 'All Types' : type.charAt(0).toUpperCase() + type.slice(1)}
              </option>
            ))}
          </select>
          <button 
            onClick={loadAccounts}
            className="px-4 py-2 bg-[#b4b237] text-white rounded-lg text-sm"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-4">
        {Object.keys(grouped).map(type => (
          <div key={type} className="bg-white border rounded-lg p-4">
            <div className="text-xs text-gray-600 mb-1">{type.toUpperCase()}</div>
            <div className="text-2xl font-bold">{grouped[type].length}</div>
            <div className="text-xs text-gray-500 mt-1">accounts</div>
          </div>
        ))}
      </div>

      {/* Accounts Table */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="overflow-auto" style={{maxHeight: '600px'}}>
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Code</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Account Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Balance Type</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Current Balance</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((account) => {
                const balance = Number(account.settledBalance) / 100;
                return (
                  <tr key={account.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-mono font-semibold text-sm">{account.code}</span>
                    </td>
                    <td className="px-4 py-3 text-sm">{account.name}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        account.accountType === 'asset' ? 'bg-blue-100 text-blue-700' :
                        account.accountType === 'liability' ? 'bg-red-100 text-red-700' :
                        account.accountType === 'equity' ? 'bg-purple-100 text-purple-700' :
                        account.accountType === 'revenue' ? 'bg-green-100 text-green-700' :
                        'bg-orange-100 text-orange-700'
                      }`}>
                        {account.accountType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {account.balanceType === 'D' ? 'Debit' : 'Credit'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-semibold ${
                        balance > 0 ? 'text-green-600' : 
                        balance < 0 ? 'text-red-600' : 
                        'text-gray-400'
                      }`}>
                        ${Math.abs(balance).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        account.is_archived ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700'
                      }`}>
                        {account.is_archived ? 'Archived' : 'Active'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-sm text-gray-500 text-center">
        Showing {filtered.length} of {accounts.length} total accounts
      </div>
    </div>
  );
}
