'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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
  const [filterCoas, setFilterCoas] = useState<string[]>([]);
  const [filterSubs, setFilterSubs] = useState<string[]>([]);
  const [filterSearch, setFilterSearch] = useState('');
  const [filterVendorStatus, setFilterVendorStatus] = useState<'all' | 'has' | 'missing'>('all');
  
  // Pagination
  const [visibleCount, setVisibleCount] = useState(100);
  
  // Selection & assignment
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [assignCoa, setAssignCoa] = useState('');
  const [assignSub, setAssignSub] = useState('');
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

  // Reset visible count and clear sub filters when COA filter changes
  useEffect(() => {
    setVisibleCount(100);
  }, [filterCoas, filterSubs, filterSearch, filterVendorStatus]);

  // Clear sub filters when COA changes (they may not apply)
  useEffect(() => {
    setFilterSubs([]);
  }, [filterCoas]);

  const getCoaName = (code: string | null) => {
    if (!code) return null;
    return coaOptions.find(c => c.code === code)?.name || code;
  };

  // Get unique COAs with counts
  const usedCoas = useMemo(() => {
    const counts: Record<string, number> = {};
    transactions.forEach(t => {
      if (t.accountCode) {
        counts[t.accountCode] = (counts[t.accountCode] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .map(([code, count]) => ({
        code,
        name: getCoaName(code) || code,
        count
      }))
      .sort((a, b) => b.count - a.count);
  }, [transactions, coaOptions]);

  // Get transactions filtered by COA only (for contextual vendor list)
  const coaFilteredTransactions = useMemo(() => {
    if (filterCoas.length === 0) return transactions;
    return transactions.filter(t => {
      if (filterCoas.includes('__unassigned__') && !t.accountCode) return true;
      if (t.accountCode && filterCoas.includes(t.accountCode)) return true;
      return false;
    });
  }, [transactions, filterCoas]);

  // Get unique sub-accounts with counts — CONTEXTUAL to selected COA(s)
  const usedSubs = useMemo(() => {
    const counts: Record<string, number> = {};
    coaFilteredTransactions.forEach(t => {
      if (t.subAccount) {
        counts[t.subAccount] = (counts[t.subAccount] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .map(([sub, count]) => ({ sub, count }))
      .sort((a, b) => b.count - a.count);
  }, [coaFilteredTransactions]);

  // Stats for contextual data
  const contextStats = useMemo(() => {
    const txns = coaFilteredTransactions;
    return {
      total: txns.length,
      hasVendor: txns.filter(t => t.subAccount).length,
      missingVendor: txns.filter(t => !t.subAccount).length,
    };
  }, [coaFilteredTransactions]);

  // Filter transactions (full filter chain)
  const filtered = useMemo(() => {
    return transactions.filter(t => {
      // COA filter
      if (filterCoas.length > 0) {
        if (filterCoas.includes('__unassigned__')) {
          if (t.accountCode && !filterCoas.includes(t.accountCode)) return false;
        } else {
          if (!t.accountCode || !filterCoas.includes(t.accountCode)) return false;
        }
      }
      
      // Sub-account filter
      if (filterSubs.length > 0) {
        if (filterSubs.includes('__none__')) {
          if (t.subAccount && !filterSubs.includes(t.subAccount)) return false;
        } else {
          if (!t.subAccount || !filterSubs.includes(t.subAccount)) return false;
        }
      }
      
      // Vendor status filter
      if (filterVendorStatus === 'has' && !t.subAccount) return false;
      if (filterVendorStatus === 'missing' && t.subAccount) return false;
      
      // Search filter
      if (filterSearch) {
        const search = filterSearch.toLowerCase();
        if (!t.name.toLowerCase().includes(search) && 
            !(t.merchantName?.toLowerCase().includes(search)) &&
            !(t.subAccount?.toLowerCase().includes(search))) return false;
      }
      
      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, filterCoas, filterSubs, filterSearch, filterVendorStatus]);

  const committed = transactions.filter(t => t.accountCode);

  const clearFilters = () => {
    setFilterCoas([]);
    setFilterSubs([]);
    setFilterSearch('');
    setFilterVendorStatus('all');
  };

  const hasActiveFilters = filterCoas.length > 0 || filterSubs.length > 0 || filterSearch || filterVendorStatus !== 'all';

  const toggleCoaFilter = (code: string) => {
    setFilterCoas(prev => 
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const toggleSubFilter = (sub: string) => {
    setFilterSubs(prev => 
      prev.includes(sub) ? prev.filter(s => s !== sub) : [...prev, sub]
    );
  };

  const handleBulkAssign = async () => {
    if (selectedIds.length === 0 || (!assignCoa && !assignSub)) return;
    
    setIsAssigning(true);
    try {
      if (assignCoa) {
        await fetch('/api/transactions/assign-coa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            transactionIds: selectedIds, 
            accountCode: assignCoa, 
            subAccount: assignSub.trim() || null 
          })
        });
      } else {
        await fetch('/api/transactions/update-sub-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            transactionIds: selectedIds, 
            subAccount: assignSub.trim() || null 
          })
        });
      }
      setSelectedIds([]);
      setAssignCoa('');
      setAssignSub('');
      await loadData();
    } catch (err) {
      console.error('Assign error:', err);
    }
    setIsAssigning(false);
  };

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

  const stats = {
    total: transactions.length,
    assigned: committed.length,
    unassigned: transactions.length - committed.length,
    hasVendor: transactions.filter(t => t.subAccount).length,
    missingVendor: transactions.filter(t => !t.subAccount).length,
  };

  const loadMore = () => {
    setVisibleCount(prev => Math.min(prev + 100, filtered.length));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f7f4] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-[#b4b237] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f7f4]">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 h-12 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#b4b237] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs">TS</span>
            </div>
            <span className="font-semibold text-gray-900 text-sm">Temple Stuart</span>
          </div>
          
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setView('transactions')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition ${
                view === 'transactions' ? 'bg-white shadow text-gray-900' : 'text-gray-500'
              }`}
            >
              Txns
            </button>
            <button
              onClick={() => setView('statements')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition ${
                view === 'statements' ? 'bg-white shadow text-gray-900' : 'text-gray-500'
              }`}
            >
              Reports
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 py-4">
        
        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className="bg-white rounded-lg border p-2 text-center">
            <p className="text-lg font-bold text-gray-900">{stats.total.toLocaleString()}</p>
            <p className="text-xs text-gray-500">Total</p>
          </div>
          <div className="bg-white rounded-lg border p-2 text-center">
            <p className="text-lg font-bold text-green-600">{stats.assigned.toLocaleString()}</p>
            <p className="text-xs text-gray-500">Categorized</p>
          </div>
          <div 
            onClick={() => setFilterVendorStatus(filterVendorStatus === 'has' ? 'all' : 'has')}
            className={`bg-white rounded-lg border p-2 text-center cursor-pointer transition ${filterVendorStatus === 'has' ? 'ring-2 ring-[#b4b237]' : ''}`}
          >
            <p className="text-lg font-bold text-blue-600">{stats.hasVendor.toLocaleString()}</p>
            <p className="text-xs text-gray-500">Has Vendor</p>
          </div>
          <div 
            onClick={() => setFilterVendorStatus(filterVendorStatus === 'missing' ? 'all' : 'missing')}
            className={`bg-white rounded-lg border p-2 text-center cursor-pointer transition ${filterVendorStatus === 'missing' ? 'ring-2 ring-[#b4b237]' : ''}`}
          >
            <p className="text-lg font-bold text-red-500">{stats.missingVendor.toLocaleString()}</p>
            <p className="text-xs text-gray-500">No Vendor</p>
          </div>
        </div>

        {view === 'transactions' && (
          <>
            {/* Connected Accounts */}
            <details className="bg-white rounded-lg border mb-4">
              <summary className="px-3 py-2 font-semibold text-sm cursor-pointer">
                Connected Accounts
              </summary>
              <ImportDataSection entityId="personal" />
            </details>

            {/* Filters */}
            <div className="bg-white rounded-lg border mb-4 p-3 space-y-3">
              <input
                type="text"
                placeholder="🔍 Search name, merchant, vendor..."
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
              
              {/* Category chips */}
              <div>
                <p className="text-xs text-gray-500 mb-1">Step 1: Select Category</p>
                <div className="flex flex-wrap gap-1">
                  <button
                    onClick={() => toggleCoaFilter('__unassigned__')}
                    className={`px-2 py-1 rounded-full text-xs transition ${
                      filterCoas.includes('__unassigned__') 
                        ? 'bg-amber-500 text-white' 
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    ⚠️ Uncategorized ({stats.unassigned})
                  </button>
                  {usedCoas.slice(0, 15).map(({ code, name, count }) => (
                    <button
                      key={code}
                      onClick={() => toggleCoaFilter(code)}
                      className={`px-2 py-1 rounded-full text-xs transition ${
                        filterCoas.includes(code) 
                          ? 'bg-[#b4b237] text-white' 
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {name} ({count})
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Vendor chips - CONTEXTUAL */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-gray-500">
                    Step 2: Select Vendors {filterCoas.length > 0 && <span className="text-[#b4b237]">(showing only for selected category)</span>}
                  </p>
                  {filterCoas.length > 0 && (
                    <span className="text-xs text-gray-400">
                      {contextStats.hasVendor} with vendor, {contextStats.missingVendor} without
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                  <button
                    onClick={() => toggleSubFilter('__none__')}
                    className={`px-2 py-1 rounded-full text-xs transition ${
                      filterSubs.includes('__none__') 
                        ? 'bg-red-500 text-white' 
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    ❌ No Vendor ({contextStats.missingVendor})
                  </button>
                  {usedSubs.map(({ sub, count }) => (
                    <button
                      key={sub}
                      onClick={() => toggleSubFilter(sub)}
                      className={`px-2 py-1 rounded-full text-xs transition ${
                        filterSubs.includes(sub) 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-blue-50 text-blue-700'
                      }`}
                    >
                      {sub} ({count})
                    </button>
                  ))}
                  {usedSubs.length === 0 && filterCoas.length > 0 && (
                    <span className="text-xs text-gray-400 py-1">No vendors in this category</span>
                  )}
                </div>
              </div>
              
              {hasActiveFilters && (
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-sm font-medium">{filtered.length} transactions</span>
                  <button onClick={clearFilters} className="text-sm text-[#b4b237] font-medium">
                    Clear all
                  </button>
                </div>
              )}
            </div>

            {/* Select controls */}
            {filtered.length > 0 && (
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={() => setSelectedIds(
                    selectedIds.length === filtered.length ? [] : filtered.map(t => t.id)
                  )}
                  className="text-xs text-[#b4b237] font-medium"
                >
                  {selectedIds.length === filtered.length ? 'Deselect all' : `Select all ${filtered.length}`}
                </button>
                {selectedIds.length > 0 && (
                  <span className="text-xs text-gray-500">({selectedIds.length} selected)</span>
                )}
              </div>
            )}

            {/* Bulk Actions */}
            {selectedIds.length > 0 && (
              <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-3 z-40 md:relative md:shadow-none md:border md:rounded-lg md:mb-4">
                <div className="max-w-7xl mx-auto">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-bold text-[#b4b237]">{selectedIds.length} selected</span>
                    <button onClick={() => setSelectedIds([])} className="text-xs text-gray-400 ml-auto">
                      ✕ Clear
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={assignCoa}
                      onChange={(e) => setAssignCoa(e.target.value)}
                      className="flex-1 border rounded-lg px-2 py-2 text-sm"
                    >
                      <option value="">Category...</option>
                      {Object.entries(coaGrouped).map(([type, opts]) => (
                        <optgroup key={type} label={type.charAt(0).toUpperCase() + type.slice(1)}>
                          {opts.map(o => <option key={o.id} value={o.code}>{o.name}</option>)}
                        </optgroup>
                      ))}
                    </select>
                    
                    <input
                      type="text"
                      value={assignSub}
                      onChange={(e) => setAssignSub(e.target.value)}
                      placeholder="Vendor name..."
                      list="sub-list"
                      className="flex-1 border rounded-lg px-2 py-2 text-sm"
                    />
                    <datalist id="sub-list">
                      {usedSubs.slice(0, 50).map(({ sub }) => <option key={sub} value={sub} />)}
                    </datalist>
                    
                    <button
                      onClick={handleBulkAssign}
                      disabled={(!assignCoa && !assignSub) || isAssigning}
                      className="px-4 py-2 bg-[#b4b237] text-white rounded-lg text-sm font-medium disabled:opacity-50"
                    >
                      {isAssigning ? '...' : 'Save'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Transaction List */}
            <div className="bg-white rounded-lg border overflow-hidden">
              <div className="max-h-[70vh] overflow-y-auto">
                {filtered.slice(0, visibleCount).map(txn => (
                  <div 
                    key={txn.id}
                    onClick={() => setSelectedIds(
                      selectedIds.includes(txn.id)
                        ? selectedIds.filter(id => id !== txn.id)
                        : [...selectedIds, txn.id]
                    )}
                    className={`px-3 py-2 border-b flex items-start gap-3 cursor-pointer active:bg-gray-100 ${
                      selectedIds.includes(txn.id) ? 'bg-blue-50' : ''
                    } ${!txn.accountCode ? 'bg-amber-50/30' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(txn.id)}
                      onChange={() => {}}
                      className="w-5 h-5 rounded mt-0.5"
                    />
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm truncate">{txn.name}</span>
                        <span className={`text-sm font-mono whitespace-nowrap ${txn.amount < 0 ? 'text-green-600' : 'text-gray-900'}`}>
                          {txn.amount < 0 ? '+' : '-'}${Math.abs(txn.amount).toFixed(2)}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                        <span>{new Date(txn.date).toLocaleDateString()}</span>
                        <span>•</span>
                        {txn.accountCode ? (
                          <span className="text-gray-600">{getCoaName(txn.accountCode)}</span>
                        ) : (
                          <span className="text-amber-500 font-medium">Uncategorized</span>
                        )}
                      </div>
                      
                      <div className="mt-1">
                        {txn.subAccount ? (
                          <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                            🏪 {txn.subAccount}
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 bg-red-100 text-red-600 rounded text-xs">
                            ❌ No vendor
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                {visibleCount < filtered.length && (
                  <button
                    onClick={loadMore}
                    className="w-full py-4 text-center text-sm text-[#b4b237] font-medium hover:bg-gray-50"
                  >
                    Load more ({filtered.length - visibleCount} remaining)
                  </button>
                )}
                
                {filtered.length === 0 && (
                  <div className="px-3 py-8 text-center text-gray-500">
                    No transactions found
                  </div>
                )}
              </div>
            </div>
            
            {selectedIds.length > 0 && <div className="h-28 md:hidden" />}
          </>
        )}

        {view === 'statements' && (
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
