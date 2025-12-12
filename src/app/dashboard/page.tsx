'use client';

import { useState, useEffect, useCallback } from 'react';
import { ImportDataSection } from '@/components/dashboard/ImportDataSection';
import ThreeStatementSection from '@/components/dashboard/ThreeStatementSection';

interface Transaction {
  id: string;
  date: string;
  name: string;
  merchantName: string | null;
  amount: number;
  accountCode: string | null;
  subAccount: string | null;
  plaidAccountId: string;
}

interface CoaOption {
  id: string;
  code: string;
  name: string;
  accountType: string;
}

export default function Dashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [coaOptions, setCoaOptions] = useState<CoaOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'transactions' | 'statements'>('transactions');
  
  // Filters
  const [filterCoa, setFilterCoa] = useState<string>('all');
  const [filterSearch, setFilterSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [assignCoa, setAssignCoa] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [txnRes, coaRes] = await Promise.all([
        fetch('/api/transactions'),
        fetch('/api/chart-of-accounts')
      ]);
      
      if (txnRes.ok) {
        const data = await txnRes.json();
        setTransactions(data.transactions || data || []);
      }
      if (coaRes.ok) {
        const data = await coaRes.json();
        setCoaOptions(data.accounts || []);
      }
    } catch (err) {
      console.error('Load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Filter transactions
  const filtered = transactions.filter(t => {
    if (filterCoa === 'unassigned' && t.accountCode) return false;
    if (filterCoa === 'assigned' && !t.accountCode) return false;
    if (filterCoa !== 'all' && filterCoa !== 'unassigned' && filterCoa !== 'assigned' && t.accountCode !== filterCoa) return false;
    if (filterSearch && !t.name.toLowerCase().includes(filterSearch.toLowerCase()) && 
        !(t.merchantName?.toLowerCase().includes(filterSearch.toLowerCase()))) return false;
    return true;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const committed = transactions.filter(t => t.accountCode);

  // Bulk assign
  const handleBulkAssign = async () => {
    if (!assignCoa || selectedIds.length === 0) return;
    setIsAssigning(true);
    try {
      await fetch('/api/transactions/assign-coa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionIds: selectedIds, accountCode: assignCoa, subAccount: null })
      });
      setSelectedIds([]);
      setAssignCoa('');
      await loadData();
    } catch (err) {
      console.error('Assign error:', err);
    }
    setIsAssigning(false);
  };

  // Reassign from 3-statement drilldown
  const handleReassign = async (ids: string[], code: string, sub: string | null) => {
    await fetch('/api/transactions/assign-coa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionIds: ids, accountCode: code, subAccount: sub })
    });
    await loadData();
  };

  const coaGrouped = coaOptions.reduce((acc, opt) => {
    if (!acc[opt.accountType]) acc[opt.accountType] = [];
    acc[opt.accountType].push(opt);
    return acc;
  }, {} as Record<string, CoaOption[]>);

  const getCoaName = (code: string | null) => {
    if (!code) return null;
    return coaOptions.find(c => c.code === code)?.name || code;
  };

  const stats = {
    total: transactions.length,
    assigned: transactions.filter(t => t.accountCode).length,
    unassigned: transactions.filter(t => !t.accountCode).length,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f7f4] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-[#b4b237] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-500">Loading transactions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f7f4]">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#b4b237] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">TS</span>
            </div>
            <span className="font-semibold text-gray-900">Temple Stuart</span>
          </div>
          
          {/* View Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setView('transactions')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${
                view === 'transactions' ? 'bg-white shadow text-gray-900' : 'text-gray-500'
              }`}
            >
              Transactions
            </button>
            <button
              onClick={() => setView('statements')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${
                view === 'statements' ? 'bg-white shadow text-gray-900' : 'text-gray-500'
              }`}
            >
              3-Statement
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        
        {/* Stats Bar */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg border p-4">
            <p className="text-2xl font-bold text-gray-900">{stats.total.toLocaleString()}</p>
            <p className="text-sm text-gray-500">Total Transactions</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <p className="text-2xl font-bold text-green-600">{stats.assigned.toLocaleString()}</p>
            <p className="text-sm text-gray-500">Assigned to COA</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <p className="text-2xl font-bold text-amber-600">{stats.unassigned.toLocaleString()}</p>
            <p className="text-sm text-gray-500">Needs Review</p>
          </div>
        </div>

        {view === 'transactions' ? (
          <>
            {/* Connected Accounts */}
            <div className="bg-white rounded-lg border mb-6">
              <div className="px-4 py-3 border-b">
                <h2 className="font-semibold">Connected Accounts</h2>
              </div>
              <ImportDataSection entityId="personal" />
            </div>

            {/* Transaction List */}
            <div className="bg-white rounded-lg border">
              <div className="px-4 py-3 border-b flex flex-wrap items-center gap-3">
                <h2 className="font-semibold">Transactions</h2>
                
                {/* Search */}
                <input
                  type="text"
                  placeholder="Search..."
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                  className="ml-auto border rounded-lg px-3 py-1.5 text-sm w-48"
                />
                
                {/* Filter */}
                <select
                  value={filterCoa}
                  onChange={(e) => setFilterCoa(e.target.value)}
                  className="border rounded-lg px-3 py-1.5 text-sm"
                >
                  <option value="all">All ({stats.total})</option>
                  <option value="unassigned">⚠️ Unassigned ({stats.unassigned})</option>
                  <option value="assigned">✓ Assigned ({stats.assigned})</option>
                  <optgroup label="By COA">
                    {coaOptions.filter(c => transactions.some(t => t.accountCode === c.code)).map(c => (
                      <option key={c.id} value={c.code}>{c.code} - {c.name}</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* Bulk Actions */}
              {selectedIds.length > 0 && (
                <div className="px-4 py-2 bg-[#b4b237]/10 border-b flex items-center gap-3">
                  <span className="text-sm font-medium">{selectedIds.length} selected</span>
                  <select
                    value={assignCoa}
                    onChange={(e) => setAssignCoa(e.target.value)}
                    className="border rounded px-2 py-1 text-sm flex-1 max-w-xs"
                  >
                    <option value="">Assign to COA...</option>
                    {Object.entries(coaGrouped).map(([type, opts]) => (
                      <optgroup key={type} label={type.toUpperCase()}>
                        {opts.map(o => <option key={o.id} value={o.code}>{o.code} - {o.name}</option>)}
                      </optgroup>
                    ))}
                  </select>
                  <button
                    onClick={handleBulkAssign}
                    disabled={!assignCoa || isAssigning}
                    className="px-4 py-1 bg-[#b4b237] text-white rounded text-sm font-medium disabled:opacity-50"
                  >
                    {isAssigning ? 'Assigning...' : 'Assign'}
                  </button>
                  <button
                    onClick={() => setSelectedIds([])}
                    className="px-3 py-1 text-gray-500 text-sm"
                  >
                    Clear
                  </button>
                </div>
              )}

              {/* Table */}
              <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 w-10">
                        <input
                          type="checkbox"
                          checked={selectedIds.length === filtered.length && filtered.length > 0}
                          onChange={(e) => setSelectedIds(e.target.checked ? filtered.map(t => t.id) : [])}
                        />
                      </th>
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-left">Description</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                      <th className="px-3 py-2 text-left">COA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filtered.slice(0, 500).map(txn => (
                      <tr 
                        key={txn.id} 
                        className={`hover:bg-gray-50 ${selectedIds.includes(txn.id) ? 'bg-blue-50' : ''} ${!txn.accountCode ? 'bg-amber-50/50' : ''}`}
                      >
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(txn.id)}
                            onChange={(e) => setSelectedIds(
                              e.target.checked 
                                ? [...selectedIds, txn.id] 
                                : selectedIds.filter(id => id !== txn.id)
                            )}
                          />
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-gray-600">
                          {new Date(txn.date).toLocaleDateString()}
                        </td>
                        <td className="px-3 py-2">
                          <div className="truncate max-w-[300px] font-medium">{txn.name}</div>
                          {txn.merchantName && txn.merchantName !== txn.name && (
                            <div className="text-xs text-gray-400 truncate">{txn.merchantName}</div>
                          )}
                        </td>
                        <td className={`px-3 py-2 text-right font-mono ${txn.amount < 0 ? 'text-green-600' : 'text-gray-900'}`}>
                          {txn.amount < 0 ? '+' : ''}{Math.abs(txn.amount).toFixed(2)}
                        </td>
                        <td className="px-3 py-2">
                          {txn.accountCode ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded text-xs">
                              <span className="font-mono text-gray-500">{txn.accountCode}</span>
                              <span className="text-gray-700">{getCoaName(txn.accountCode)}</span>
                            </span>
                          ) : (
                            <span className="text-amber-500 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filtered.length > 500 && (
                  <div className="px-4 py-3 text-center text-sm text-gray-500 border-t">
                    Showing 500 of {filtered.length} transactions
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          /* 3-Statement View */
          <ThreeStatementSection
            committedTransactions={committed}
            coaOptions={coaOptions}
            onReassign={handleReassign}
          />
        )}
      </main>
    </div>
  );
}
