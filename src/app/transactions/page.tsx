'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ManualTransactionForm from '@/components/ManualTransactionForm';

interface Transaction {
  id: string;
  date: string;
  name: string;
  merchantName?: string;
  amount: number;
  category?: string | string[];
  pending: boolean;
  accountName?: string;
  accountType?: string;
  institutionName?: string;
  accountCode?: string;
  subAccount?: string;
  source?: string;
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [filterText, setFilterText] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const router = useRouter();

  const fetchTransactions = useCallback(async () => {
    try {
      // Fetch both Plaid and manual transactions
      const [plaidRes, manualRes] = await Promise.all([
        fetch('/api/transactions'),
        fetch('/api/transactions/manual'),
      ]);

      let all: Transaction[] = [];

      if (plaidRes.ok) {
        const plaidData = await plaidRes.json();
        if (plaidData.transactions && Array.isArray(plaidData.transactions)) {
          all = plaidData.transactions.map((t: any) => ({
            ...t,
            source: 'plaid',
          }));
        }
      }

      if (manualRes.ok) {
        const manualData = await manualRes.json();
        if (manualData.transactions && Array.isArray(manualData.transactions)) {
          const manual = manualData.transactions.map((t: any) => ({
            ...t,
            source: 'manual',
          }));
          all = [...all, ...manual];
        }
      }

      setTransactions(all);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortData = (data: Transaction[]) => {
    if (!Array.isArray(data)) return [];
    return [...data].sort((a, b) => {
      let aVal: any = a[sortField as keyof Transaction];
      let bVal: any = b[sortField as keyof Transaction];
      if (sortField === 'date') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      }
      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
  };

  const filterData = (data: Transaction[]) => {
    if (!Array.isArray(data)) return [];
    if (!filterText) return data;
    return data.filter(item => {
      const searchStr = JSON.stringify(item).toLowerCase();
      return searchStr.includes(filterText.toLowerCase());
    });
  };

  const getCategoryDisplay = (category: string | string[] | undefined): string => {
    if (!category) return '';
    if (Array.isArray(category)) return category[0] || '';
    return category;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-terminal p-6">
        <div className="text-center text-text-muted font-mono text-sm">Loading transactions...</div>
      </div>
    );
  }

  const displayData = sortData(filterData(transactions));
  const manualCount = transactions.filter(t => t.source === 'manual').length;
  const plaidCount = transactions.filter(t => t.source === 'plaid').length;

  return (
    <div className="min-h-screen bg-bg-terminal p-6">
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-sm font-semibold text-text-primary">Transactions</h1>
            <p className="text-xs text-text-muted font-mono mt-1">
              {transactions.length} total — {plaidCount} synced, {manualCount} manual
            </p>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
              showAddForm
                ? 'bg-border text-text-secondary hover:bg-border'
                : 'bg-brand-purple text-white hover:bg-brand-purple-hover'
            }`}
          >
            {showAddForm ? 'Close' : '+ Add Transaction'}
          </button>
        </div>

        {/* Manual Entry Form */}
        {showAddForm && (
          <div className="mb-6 max-w-lg">
            <ManualTransactionForm
              onSuccess={() => {
                fetchTransactions();
              }}
              onCancel={() => setShowAddForm(false)}
            />
          </div>
        )}

        {/* Filter */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Filter transactions..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="px-3 py-2 border border-border rounded w-full max-w-sm text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple"
          />
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-white rounded p-3 border border-border">
            <div className="text-[10px] font-medium text-text-muted uppercase tracking-wider">Total</div>
            <div className="text-terminal-lg font-bold text-text-primary font-mono">{transactions.length}</div>
          </div>
          <div className="bg-white rounded p-3 border border-border">
            <div className="text-[10px] font-medium text-text-muted uppercase tracking-wider">Expenses</div>
            <div className="text-terminal-lg font-bold text-brand-red font-mono">
              ${transactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0).toFixed(2)}
            </div>
          </div>
          <div className="bg-white rounded p-3 border border-border">
            <div className="text-[10px] font-medium text-text-muted uppercase tracking-wider">Income</div>
            <div className="text-terminal-lg font-bold text-brand-green font-mono">
              ${Math.abs(transactions.filter(t => t.amount < 0).reduce((sum, t) => sum + t.amount, 0)).toFixed(2)}
            </div>
          </div>
          <div className="bg-white rounded p-3 border border-border">
            <div className="text-[10px] font-medium text-text-muted uppercase tracking-wider">Pending</div>
            <div className="text-terminal-lg font-bold text-yellow-600 font-mono">
              {transactions.filter(t => t.pending).length}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded border border-border overflow-hidden">
          <div className="overflow-x-auto">
            {displayData.length > 0 ? (
              <table className="w-full">
                <thead className="bg-brand-purple text-white">
                  <tr>
                    <th className="px-3 py-2.5 text-left text-xs font-medium cursor-pointer hover:bg-brand-purple-hover" onClick={() => handleSort('date')}>
                      Date {sortField === 'date' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium cursor-pointer hover:bg-brand-purple-hover" onClick={() => handleSort('name')}>
                      Description {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium">Category</th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium">Account</th>
                    <th className="px-3 py-2.5 text-right text-xs font-medium cursor-pointer hover:bg-brand-purple-hover" onClick={() => handleSort('amount')}>
                      Amount {sortField === 'amount' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium">Source</th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {displayData.map((txn) => {
                    const catDisplay = getCategoryDisplay(txn.category);
                    return (
                      <tr key={txn.id} className="hover:bg-bg-row transition-colors">
                        <td className="px-3 py-2.5 text-xs font-mono text-text-secondary">
                          {new Date(txn.date).toLocaleDateString()}
                        </td>
                        <td className="px-3 py-2.5 text-sm font-medium text-text-primary">
                          {txn.name}
                          {txn.merchantName && txn.merchantName !== txn.name && (
                            <span className="text-xs text-text-faint ml-1">({txn.merchantName})</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {catDisplay && (
                            <span className="px-2 py-0.5 bg-bg-row text-text-secondary rounded text-[10px] font-medium">
                              {catDisplay}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-text-muted">
                          {txn.accountName || txn.institutionName || '-'}
                        </td>
                        <td className={`px-3 py-2.5 text-sm font-mono font-bold text-right ${
                          txn.amount < 0 ? 'text-brand-green' : 'text-brand-red'
                        }`}>
                          {txn.amount < 0 ? '+' : '-'}${Math.abs(txn.amount).toFixed(2)}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            txn.source === 'manual'
                              ? 'bg-brand-purple-wash text-brand-purple'
                              : 'bg-purple-50 text-purple-600'
                          }`}>
                            {txn.source === 'manual' ? 'Manual' : 'Plaid'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            txn.pending
                              ? 'bg-yellow-50 text-yellow-700'
                              : 'bg-green-50 text-brand-green'
                          }`}>
                            {txn.pending ? 'Pending' : 'Posted'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-12 text-text-faint">
                <p className="text-sm">No transactions yet.</p>
                <button
                  onClick={() => setShowAddForm(true)}
                  className="mt-2 text-sm text-brand-purple hover:underline"
                >
                  Add your first transaction
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
