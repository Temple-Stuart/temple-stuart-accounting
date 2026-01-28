'use client';

import { useState, useEffect } from 'react';
import { Button, Badge, Card, ResponsiveTable } from '@/components/ui';

interface CoaOption {
  id: string;
  code: string;
  name: string;
  accountType: string;
  balanceType: string;
}

interface SpendingTabProps {
  transactions: any[];
  committedTransactions: any[];
  coaOptions: CoaOption[];
  onReload: () => Promise<void>;
}

export default function SpendingTab({ transactions, committedTransactions, coaOptions, onReload }: SpendingTabProps) {
  if (!transactions || !committedTransactions || !coaOptions) {
    return <div className="p-4 text-center text-gray-400">Loading...</div>;
  }

  const [selectedFilter, setSelectedFilter] = useState<{type: string, value: string} | null>(null);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [selectedSubAccount, setSelectedSubAccount] = useState('');
  const [subAccountsList, setSubAccountsList] = useState<string[]>([]);
  const [newSubAccount, setNewSubAccount] = useState('');
  const [rowChanges, setRowChanges] = useState<{[key: string]: {coa: string, sub: string}}>({});
  const [selectedUncommitted, setSelectedUncommitted] = useState<string[]>([]);
  const [selectedCommitted, setSelectedCommitted] = useState<string[]>([]);
  const [expandedSection, setExpandedSection] = useState<'filters' | 'uncommitted' | 'committed' | null>('uncommitted');

  const addSubAccount = () => {
    if (newSubAccount && !subAccountsList.includes(newSubAccount)) {
      setSubAccountsList([...subAccountsList, newSubAccount]);
      setNewSubAccount('');
    }
  };

  const getMerchants = () => {
    const merchants = new Map<string, number>();
    transactions.forEach((t: any) => {
      const merchant = t.merchantName || t.name;
      if (merchant) merchants.set(merchant, (merchants.get(merchant) || 0) + 1);
    });
    return Array.from(merchants.entries()).sort((a, b) => b[1] - a[1]);
  };

  const getCategories = () => {
    const categories = new Map<string, number>();
    transactions.forEach((t: any) => {
      const cat = t.personal_finance_category?.primary || 'Other';
      categories.set(cat, (categories.get(cat) || 0) + 1);
    });
    return Array.from(categories.entries()).sort((a, b) => b[1] - a[1]);
  };

  const getFilteredTransactions = () => {
    if (!selectedFilter) return transactions;
    return transactions.filter((t: any) => {
      if (selectedFilter.type === 'merchant') return (t.merchantName || t.name) === selectedFilter.value;
      if (selectedFilter.type === 'category') return (t.personal_finance_category?.primary || 'Other') === selectedFilter.value;
      return true;
    });
  };

  const groupCoaByType = () => {
    const grouped: {[key: string]: CoaOption[]} = {};
    coaOptions.forEach(opt => {
      if (!grouped[opt.accountType]) grouped[opt.accountType] = [];
      grouped[opt.accountType].push(opt);
    });
    return grouped;
  };

  const applyBulkCOA = async () => {
    if (!selectedAccount) return alert('Select a COA first');
    const ids = selectedUncommitted.length > 0 ? selectedUncommitted : getFilteredTransactions().map((t: any) => t.id);
    if (ids.length === 0) return alert('No transactions to commit');
    
    try {
      const res = await fetch('/api/transactions/commit-to-ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionIds: ids, accountCode: selectedAccount, subAccount: selectedSubAccount || null })
      });
      const result = await res.json();
      if (result.success) {
        await onReload();
        setSelectedFilter(null);
        setSelectedAccount('');
        setSelectedSubAccount('');
        setSelectedUncommitted([]);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const commitRowsWithCOA = async () => {
    const rows = Object.entries(rowChanges).filter(([_, c]) => c.coa);
    if (rows.length === 0) return alert('No rows with COA assigned');
    
    try {
      for (const [id, change] of rows) {
        await fetch('/api/transactions/commit-to-ledger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transactionIds: [id], accountCode: change.coa, subAccount: change.sub || null })
        });
      }
      await onReload();
      setRowChanges({});
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const uncommitSelected = async () => {
    if (selectedCommitted.length === 0) return;
    try {
      for (const id of selectedCommitted) {
        await fetch('/api/transactions/assign-coa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transactionIds: [id], accountCode: null, subAccount: null })
        });
      }
      await onReload();
      setSelectedCommitted([]);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const coaGrouped = groupCoaByType();
  const filteredTxns = getFilteredTransactions();
  const rowsWithCoa = Object.entries(rowChanges).filter(([_, c]) => c.coa).length;

  return (
    <div className="space-y-4">
      {/* Stats Bar - Always visible */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Badge variant="warning">{transactions.length} pending</Badge>
          <Badge variant="success">{committedTransactions.length} done</Badge>
          {selectedUncommitted.length > 0 && <Badge variant="gold">{selectedUncommitted.length} selected</Badge>}
        </div>
        {rowsWithCoa > 0 && (
          <Button size="sm" onClick={commitRowsWithCOA}>
            Commit {rowsWithCoa} Rows
          </Button>
        )}
      </div>

      {/* Quick Filters - Collapsible on Mobile */}
      <div className="border rounded-lg overflow-hidden">
        <button 
          onClick={() => setExpandedSection(expandedSection === 'filters' ? null : 'filters')}
          className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between text-left"
        >
          <span className="font-medium text-sm text-gray-700">Quick Filters</span>
          <span className="text-gray-400">{expandedSection === 'filters' ? '▼' : '▶'}</span>
        </button>
        
        {expandedSection === 'filters' && (
          <div className="p-4 space-y-4">
            {/* Merchants */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">By Merchant</h4>
              <div className="flex flex-wrap gap-2">
                {getMerchants().slice(0, 6).map(([merchant, count]) => (
                  <button
                    key={merchant}
                    onClick={() => setSelectedFilter({ type: 'merchant', value: merchant })}
                    className={`px-2 py-1 rounded-full text-xs border transition-colors ${
                      selectedFilter?.value === merchant 
                        ? 'bg-[#2d1b4e] text-white border-[#2d1b4e]' 
                        : 'bg-white hover:border-[#2d1b4e]'
                    }`}
                  >
                    {merchant.slice(0, 15)}{merchant.length > 15 ? '...' : ''} ({count})
                  </button>
                ))}
              </div>
            </div>

            {/* Categories */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">By Category</h4>
              <div className="flex flex-wrap gap-2">
                {getCategories().slice(0, 6).map(([cat, count]) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedFilter({ type: 'category', value: cat })}
                    className={`px-2 py-1 rounded-full text-xs border transition-colors ${
                      selectedFilter?.value === cat 
                        ? 'bg-[#2d1b4e] text-white border-[#2d1b4e]' 
                        : 'bg-white hover:border-[#2d1b4e]'
                    }`}
                  >
                    {cat} ({count})
                  </button>
                ))}
              </div>
            </div>

            {/* Sub-accounts */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Sub-Accounts</h4>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Add sub-account" 
                  value={newSubAccount} 
                  onChange={(e) => setNewSubAccount(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addSubAccount()}
                  className="flex-1 px-3 py-1.5 border rounded-lg text-sm"
                />
                <Button size="sm" variant="secondary" onClick={addSubAccount}>+</Button>
              </div>
              {subAccountsList.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {subAccountsList.map(sub => (
                    <span key={sub} className="px-2 py-0.5 bg-gray-100 rounded text-xs">{sub}</span>
                  ))}
                </div>
              )}
            </div>

            {selectedFilter && (
              <button onClick={() => setSelectedFilter(null)} className="text-xs text-gray-500 hover:text-gray-700">
                ✕ Clear filter
              </button>
            )}
          </div>
        )}
      </div>

      {/* Assignment Bar - Shows when filter active or items selected */}
      {(selectedFilter || selectedUncommitted.length > 0) && (
        <div className="p-3 bg-[#2d1b4e]/10 border border-[#2d1b4e]/30 rounded-lg space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {selectedUncommitted.length > 0 
                ? `${selectedUncommitted.length} selected` 
                : `${filteredTxns.length} filtered`}
            </span>
            <button onClick={() => { setSelectedFilter(null); setSelectedUncommitted([]); }} className="text-xs text-gray-500">✕</button>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <select 
              value={selectedAccount} 
              onChange={(e) => setSelectedAccount(e.target.value)} 
              className="flex-1 px-3 py-2 border rounded-lg text-sm"
            >
              <option value="">Select COA...</option>
              {Object.keys(coaGrouped).map(type => (
                <optgroup key={type} label={type}>
                  {coaGrouped[type].map(opt => (
                    <option key={opt.id} value={opt.code}>{opt.code} - {opt.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <select 
              value={selectedSubAccount} 
              onChange={(e) => setSelectedSubAccount(e.target.value)} 
              className="px-3 py-2 border rounded-lg text-sm"
            >
              <option value="">No sub-account</option>
              {subAccountsList.map(sub => <option key={sub} value={sub}>{sub}</option>)}
            </select>
            <Button onClick={applyBulkCOA} disabled={!selectedAccount}>Commit</Button>
          </div>
        </div>
      )}

      {/* Uncommitted Transactions */}
      {transactions.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <button 
            onClick={() => setExpandedSection(expandedSection === 'uncommitted' ? null : 'uncommitted')}
            className="w-full px-4 py-3 bg-amber-50 flex items-center justify-between text-left"
          >
            <span className="font-medium text-sm text-amber-800">Pending ({filteredTxns.length})</span>
            <span className="text-amber-600">{expandedSection === 'uncommitted' ? '▼' : '▶'}</span>
          </button>
          
          {expandedSection === 'uncommitted' && (
            <ResponsiveTable minWidth="600px" maxHeight="350px" showLandscapeHint={false}>
              <table className="w-full text-sm">
                <thead className="bg-gray-100 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 w-8 sticky left-0 bg-gray-100 z-20">
                      <input 
                        type="checkbox" 
                        onChange={(e) => setSelectedUncommitted(e.target.checked ? filteredTxns.map((t: any) => t.id) : [])}
                        checked={selectedUncommitted.length === filteredTxns.length && filteredTxns.length > 0}
                        className="w-4 h-4 rounded"
                      />
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600">Date</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 min-w-[150px]">Description</th>
                    <th className="px-2 py-2 text-right text-xs font-semibold text-gray-600">Amount</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 bg-yellow-50 min-w-[120px]">COA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredTxns.slice(0, 50).map((txn: any) => (
                    <tr key={txn.id} className={`hover:bg-gray-50 ${selectedUncommitted.includes(txn.id) ? 'bg-[#2d1b4e]/5' : ''}`}>
                      <td className="px-3 py-2 sticky left-0 bg-white">
                        <input 
                          type="checkbox" 
                          checked={selectedUncommitted.includes(txn.id)}
                          onChange={(e) => setSelectedUncommitted(e.target.checked ? [...selectedUncommitted, txn.id] : selectedUncommitted.filter(id => id !== txn.id))}
                          className="w-4 h-4 rounded"
                        />
                      </td>
                      <td className="px-2 py-2 text-xs text-gray-600 whitespace-nowrap">{new Date(txn.date).toLocaleDateString()}</td>
                      <td className="px-2 py-2">
                        <div className="text-sm text-gray-900 truncate max-w-[200px]">{txn.name}</div>
                        {txn.personal_finance_category?.primary && (
                          <div className="text-xs text-gray-400">{txn.personal_finance_category.primary}</div>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-sm whitespace-nowrap">${Math.abs(txn.amount).toFixed(2)}</td>
                      <td className="px-2 py-1 bg-yellow-50">
                        <select 
                          value={rowChanges[txn.id]?.coa || ''}
                          onChange={(e) => setRowChanges({...rowChanges, [txn.id]: {...(rowChanges[txn.id] || {}), coa: e.target.value}})}
                          className="w-full text-xs border rounded px-2 py-1.5 bg-white"
                        >
                          <option value="">—</option>
                          {Object.keys(coaGrouped).map(type => (
                            <optgroup key={type} label={type}>
                              {coaGrouped[type].map(opt => <option key={opt.id} value={opt.code}>{opt.code}</option>)}
                            </optgroup>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredTxns.length > 50 && (
                <div className="p-3 text-center text-xs text-gray-500 bg-gray-50">
                  Showing 50 of {filteredTxns.length} • Use filters to narrow down
                </div>
              )}
            </ResponsiveTable>
          )}
        </div>
      )}

      {/* Committed Transactions */}
      {committedTransactions.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <button 
            onClick={() => setExpandedSection(expandedSection === 'committed' ? null : 'committed')}
            className="w-full px-4 py-3 bg-green-50 flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm text-green-800">Committed ({committedTransactions.length})</span>
              {selectedCommitted.length > 0 && (
                <Badge variant="danger" size="sm">{selectedCommitted.length} selected</Badge>
              )}
            </div>
            <span className="text-green-600">{expandedSection === 'committed' ? '▼' : '▶'}</span>
          </button>
          
          {expandedSection === 'committed' && (
            <>
              {selectedCommitted.length > 0 && (
                <div className="px-4 py-2 bg-red-50 border-b flex items-center justify-between">
                  <span className="text-sm text-red-700">{selectedCommitted.length} to uncommit</span>
                  <Button size="sm" variant="danger" onClick={uncommitSelected}>Uncommit</Button>
                </div>
              )}
              <ResponsiveTable minWidth="500px" maxHeight="250px" showLandscapeHint={false}>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 w-8">
                        <input 
                          type="checkbox" 
                          onChange={(e) => setSelectedCommitted(e.target.checked ? committedTransactions.map(t => t.id) : [])}
                          checked={selectedCommitted.length === committedTransactions.length && committedTransactions.length > 0}
                          className="w-4 h-4 rounded"
                        />
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600">Date</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600">Description</th>
                      <th className="px-2 py-2 text-right text-xs font-semibold text-gray-600">Amount</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600">COA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {committedTransactions.slice(0, 30).map((txn: any) => (
                      <tr key={txn.id} className={`hover:bg-gray-50 ${selectedCommitted.includes(txn.id) ? 'bg-red-50' : ''}`}>
                        <td className="px-3 py-2">
                          <input 
                            type="checkbox" 
                            checked={selectedCommitted.includes(txn.id)}
                            onChange={(e) => setSelectedCommitted(e.target.checked ? [...selectedCommitted, txn.id] : selectedCommitted.filter(id => id !== txn.id))}
                            className="w-4 h-4 rounded"
                          />
                        </td>
                        <td className="px-2 py-2 text-xs text-gray-600 whitespace-nowrap">{new Date(txn.date).toLocaleDateString()}</td>
                        <td className="px-2 py-2 truncate max-w-[180px]">{txn.name}</td>
                        <td className="px-2 py-2 text-right font-mono whitespace-nowrap">${Math.abs(txn.amount).toFixed(2)}</td>
                        <td className="px-2 py-2 font-mono text-xs text-green-700">{txn.accountCode}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ResponsiveTable>
            </>
          )}
        </div>
      )}

      {/* Empty State */}
      {transactions.length === 0 && committedTransactions.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <div className="text-3xl mb-2">📭</div>
          <p>No transactions to categorize</p>
        </div>
      )}
    </div>
  );
}
