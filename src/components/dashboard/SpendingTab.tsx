'use client';

import { useState, useEffect } from 'react';

interface CoaOption {
  id: string;
  code: string;
  name: string;
  accountType: string;
  balanceType: string;
}

interface MerchantSuggestion {
  coaCode: string;
  subAccount: string | null;
  confidenceScore: number;
  usageCount: number;
}

interface SpendingTabProps {
  transactions: any[];
  committedTransactions: any[];
  coaOptions: CoaOption[];
  onReload: () => Promise<void>;
}

export default function SpendingTab({ transactions, committedTransactions, coaOptions, onReload }: SpendingTabProps) {
  if (transactions === undefined || committedTransactions === undefined || coaOptions === undefined) {
    return <div className="p-4">Loading...</div>;
  }

  const [selectedFilter, setSelectedFilter] = useState<{type: string, value: string} | null>(null);
  const [showCOAAssignment, setShowCOAAssignment] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [selectedSubAccount, setSelectedSubAccount] = useState('');
  const [subAccountsList, setSubAccountsList] = useState<string[]>([]);
  const [newSubAccount, setNewSubAccount] = useState('');
  const [rowChanges, setRowChanges] = useState<{[key: string]: {coa: string, sub: string}}>({});
  const [selectedCommitted, setSelectedCommitted] = useState<string[]>([]);
  const [selectedUncommitted, setSelectedUncommitted] = useState<string[]>([]);
  const [merchantSuggestions, setMerchantSuggestions] = useState<{[key: string]: MerchantSuggestion}>({});

  useEffect(() => {
    loadMerchantSuggestions();
  }, [transactions]);

  const loadMerchantSuggestions = async () => {
    const suggestions: {[key: string]: MerchantSuggestion} = {};
    for (const txn of transactions.slice(0, 50)) {
      const merchant = txn.merchantName || txn.name;
      const category = txn.personal_finance_category?.primary;
      if (merchant) {
        const suggestion = await loadMerchantSuggestion(merchant, category);
        if (suggestion) suggestions[txn.id] = suggestion;
      }
    }
    setMerchantSuggestions(suggestions);
  };

  const loadMerchantSuggestion = async (merchantName: string, categoryPrimary: string) => {
    try {
      const params = new URLSearchParams();
      if (merchantName) params.append('merchantName', merchantName);
      if (categoryPrimary) params.append('categoryPrimary', categoryPrimary);
      const res = await fetch(`/api/merchant-mappings?${params}`);
      if (res.ok) {
        const data = await res.json();
        if (data.mappings && data.mappings.length > 0) {
          const best = data.mappings[0];
          return {
            coaCode: best.coaCode,
            subAccount: best.subAccount,
            confidenceScore: parseFloat(best.confidenceScore),
            usageCount: best.usageCount
          };
        }
      }
    } catch (error) {
      console.error('Error loading merchant suggestion:', error);
    }
    return null;
  };

  const addSubAccount = () => {
    if (newSubAccount && !subAccountsList.includes(newSubAccount)) {
      setSubAccountsList([...subAccountsList, newSubAccount]);
      setNewSubAccount('');
    }
  };

  const getInstitution = (account: any) => {
    if (!account) return '-';
    const name = account?.name?.toLowerCase() || '';
    const institutionName = account?.plaidItem?.institutionName?.toLowerCase() || '';
    if (name.includes('robinhood') || institutionName.includes('robinhood')) return 'RH';
    if (name.includes('wells') || institutionName.includes('wells')) return 'WF';
    if (name.includes('relay') || institutionName.includes('relay')) return 'Relay';
    if (name.includes('tasty') || institutionName.includes('tasty')) return 'Tasty';
    return 'Bank';
  };

  const getMerchants = () => {
    if (!transactions || transactions.length === 0) return [];
    const merchants = new Map<string, number>();
    transactions.forEach((t: any) => {
      const merchant = t.merchantName || t.merchant_name || t.name;
      if (merchant) merchants.set(merchant, (merchants.get(merchant) || 0) + 1);
    });
    return Array.from(merchants.entries()).sort((a, b) => b[1] - a[1]);
  };

  const getPrimaryCategories = () => {
    if (!transactions || transactions.length === 0) return [];
    const categories = new Map<string, number>();
    transactions.forEach((t: any) => {
      const cat = t.personal_finance_category?.primary || 'Uncategorized';
      categories.set(cat, (categories.get(cat) || 0) + 1);
    });
    return Array.from(categories.entries()).sort((a, b) => b[1] - a[1]);
  };

  const getFilteredTransactions = () => {
    if (!selectedFilter) return transactions;
    return transactions.filter((t: any) => {
      if (selectedFilter.type === 'merchant') {
        return (t.merchantName || t.merchant_name || t.name) === selectedFilter.value;
      }
      if (selectedFilter.type === 'primary') {
        return (t.personal_finance_category?.primary || 'Uncategorized') === selectedFilter.value;
      }
      return true;
    });
  };

  const groupCoaByType = () => {
    const grouped: {[key: string]: CoaOption[]} = {};
    if (!coaOptions || coaOptions.length === 0) return {};
    coaOptions.forEach(opt => {
      if (!grouped[opt.accountType]) grouped[opt.accountType] = [];
      grouped[opt.accountType].push(opt);
    });
    return grouped;
  };

  const applyBulkCOA = async () => {
    if (!selectedAccount) {
      alert('Please select a Chart of Account');
      return;
    }
    const filtered = getFilteredTransactions();
    const transactionIds = filtered.map((t: any) => t.id);
    try {
      const res = await fetch('/api/transactions/commit-to-ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionIds,
          accountCode: selectedAccount,
          subAccount: selectedSubAccount || null
        })
      });
      const result = await res.json();
      if (result.success) {
        await onReload();
        alert(`✅ Committed ${result.committed} transactions`);
        setSelectedFilter(null);
        setShowCOAAssignment(false);
        setSelectedAccount('');
        setSelectedSubAccount('');
      } else {
        alert(`❌ Error: ${result.error || 'Failed to commit'}`);
      }
    } catch (error) {
      console.error('Error applying bulk COA:', error);
      alert('Failed to apply bulk assignment');
    }
  };

  const applyToSelectedTransactions = async () => {
    if (!selectedAccount) {
      alert('Please select a Chart of Account');
      return;
    }
    if (selectedUncommitted.length === 0) {
      alert('Please select transactions to assign');
      return;
    }
    try {
      const res = await fetch('/api/transactions/commit-to-ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionIds: selectedUncommitted,
          accountCode: selectedAccount,
          subAccount: selectedSubAccount || null
        })
      });
      const result = await res.json();
      if (result.success) {
        await onReload();
        alert(`✅ Committed ${result.committed} selected transactions`);
        setSelectedUncommitted([]);
        setSelectedAccount('');
        setSelectedSubAccount('');
      } else {
        alert(`❌ Error: ${result.error || 'Failed to commit'}`);
      }
    } catch (error) {
      console.error('Error applying to selected:', error);
      alert('Failed to commit selected transactions');
    }
  };

  const commitSelectedRows = async () => {
    const rowsToCommit = Object.entries(rowChanges).filter(([_, change]) => change.coa);
    if (rowsToCommit.length === 0) {
      alert('No rows with COA assigned');
      return;
    }
    try {
      for (const [txnId, change] of rowsToCommit) {
        await fetch('/api/transactions/commit-to-ledger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transactionIds: [txnId],
            accountCode: change.coa,
            subAccount: change.sub || null
          })
        });
      }
      await onReload();
      setRowChanges({});
      alert(`✅ Committed ${rowsToCommit.length} transactions`);
    } catch (error) {
      console.error('Error committing rows:', error);
      alert('Failed to commit transactions');
    }
  };

  const massUncommit = async () => {
    if (selectedCommitted.length === 0) {
      alert('No transactions selected');
      return;
    }
    try {
      for (const txnId of selectedCommitted) {
        await fetch('/api/transactions/assign-coa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transactionIds: [txnId],
            accountCode: null,
            subAccount: null
          })
        });
      }
      await onReload();
      setSelectedCommitted([]);
      alert(`✅ Uncommitted ${selectedCommitted.length} transactions`);
    } catch (error) {
      console.error('Error uncommitting:', error);
      alert('Failed to uncommit transactions');
    }
  };

  const coaGrouped = groupCoaByType();

  return (
    <div className="space-y-4">
      {/* Filters Row - Compact */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-gray-50 rounded-lg">
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Top Merchants</h4>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {getMerchants().slice(0, 8).map(([merchant, count]) => (
              <button key={merchant} onClick={() => { setSelectedFilter({type: 'merchant', value: merchant}); setShowCOAAssignment(true); }}
                className="w-full text-left text-xs px-2 py-1.5 hover:bg-[#b4b237]/10 rounded flex justify-between items-center group">
                <span className="truncate">{merchant}</span>
                <span className="text-gray-400 group-hover:text-[#b4b237]">{count}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Categories</h4>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {getPrimaryCategories().slice(0, 8).map(([category, count]) => (
              <button key={category} onClick={() => { setSelectedFilter({type: 'primary', value: category}); setShowCOAAssignment(true); }}
                className="w-full text-left text-xs px-2 py-1.5 hover:bg-[#b4b237]/10 rounded flex justify-between items-center group">
                <span className="truncate">{category}</span>
                <span className="text-gray-400 group-hover:text-[#b4b237]">{count}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Sub-Accounts</h4>
          <div className="flex gap-1 mb-2">
            <input type="text" placeholder="New sub-account" value={newSubAccount} onChange={(e) => setNewSubAccount(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addSubAccount()}
              className="flex-1 px-2 py-1.5 border rounded text-xs" />
            <button onClick={addSubAccount} className="px-2 py-1.5 bg-gray-600 text-white rounded text-xs">+</button>
          </div>
          <div className="text-xs text-gray-500">{subAccountsList.length > 0 ? subAccountsList.join(', ') : 'None defined'}</div>
        </div>

        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Quick Stats</h4>
          <div className="text-xs space-y-1">
            <div className="flex justify-between"><span>Uncommitted:</span><span className="font-semibold">{transactions.length}</span></div>
            <div className="flex justify-between"><span>Committed:</span><span className="font-semibold text-green-600">{committedTransactions.length}</span></div>
            <div className="flex justify-between"><span>Selected:</span><span className="font-semibold text-[#b4b237]">{selectedUncommitted.length}</span></div>
          </div>
        </div>
      </div>

      {/* Bulk Assignment Bar */}
      {showCOAAssignment && selectedFilter && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[150px]">
            <span className="text-sm font-medium">{selectedFilter.value}</span>
            <span className="text-xs text-gray-500 ml-2">({getFilteredTransactions().length} txns)</span>
          </div>
          <select value={selectedAccount} onChange={(e) => setSelectedAccount(e.target.value)} className="text-sm border rounded px-2 py-1.5">
            <option value="">Select COA</option>
            {Object.keys(coaGrouped).map(type => (
              <optgroup key={type} label={type}>
                {coaGrouped[type].map(opt => <option key={opt.id} value={opt.code}>{opt.code} - {opt.name}</option>)}
              </optgroup>
            ))}
          </select>
          <select value={selectedSubAccount} onChange={(e) => setSelectedSubAccount(e.target.value)} className="text-sm border rounded px-2 py-1.5">
            <option value="">No Sub</option>
            {subAccountsList.map(sub => <option key={sub} value={sub}>{sub}</option>)}
          </select>
          <button onClick={applyBulkCOA} className="px-3 py-1.5 bg-[#b4b237] text-white rounded text-sm font-medium">Apply & Commit</button>
          <button onClick={() => { setSelectedFilter(null); setShowCOAAssignment(false); }} className="px-3 py-1.5 border rounded text-sm">Clear</button>
        </div>
      )}

      {/* Selection Bar */}
      {selectedUncommitted.length > 0 && (
        <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-purple-700">{selectedUncommitted.length} selected</span>
          <select value={selectedAccount} onChange={(e) => setSelectedAccount(e.target.value)} className="text-sm border rounded px-2 py-1.5">
            <option value="">Select COA</option>
            {Object.keys(coaGrouped).map(type => (
              <optgroup key={type} label={type}>
                {coaGrouped[type].map(opt => <option key={opt.id} value={opt.code}>{opt.code} - {opt.name}</option>)}
              </optgroup>
            ))}
          </select>
          <select value={selectedSubAccount} onChange={(e) => setSelectedSubAccount(e.target.value)} className="text-sm border rounded px-2 py-1.5">
            <option value="">No Sub</option>
            {subAccountsList.map(sub => <option key={sub} value={sub}>{sub}</option>)}
          </select>
          <button onClick={applyToSelectedTransactions} className="px-3 py-1.5 bg-purple-600 text-white rounded text-sm font-medium">Commit Selected</button>
          <button onClick={() => setSelectedUncommitted([])} className="px-3 py-1.5 border rounded text-sm">Clear</button>
        </div>
      )}

      {/* Action Bar */}
      <div className="flex justify-between items-center px-1">
        <button onClick={commitSelectedRows} className="px-4 py-2 bg-[#b4b237] text-white rounded text-sm font-medium">
          Commit Rows with COA
        </button>
        <span className="text-sm text-gray-500">{transactions.length} uncommitted</span>
      </div>

      {/* Transactions Table - Cleaner */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto" style={{maxHeight: '400px'}}>
          <table className="w-full text-sm">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="px-3 py-2 w-8">
                  <input type="checkbox" onChange={(e) => {
                    const txns = selectedFilter ? getFilteredTransactions() : transactions;
                    setSelectedUncommitted(e.target.checked ? txns.map((t: any) => t.id) : []);
                  }} checked={selectedUncommitted.length > 0 && selectedUncommitted.length === (selectedFilter ? getFilteredTransactions() : transactions).length} />
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600">Inst</th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600">Date</th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 min-w-[180px]">Description</th>
                <th className="px-2 py-2 text-right text-xs font-semibold text-gray-600">Amount</th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600">Category</th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 bg-yellow-50 min-w-[160px]">COA</th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 bg-blue-50 w-24">Sub</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(selectedFilter ? getFilteredTransactions() : transactions).map((txn: any) => (
                <tr key={txn.id} className={`hover:bg-gray-50 ${selectedUncommitted.includes(txn.id) ? 'bg-purple-50' : ''}`}>
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={selectedUncommitted.includes(txn.id)}
                      onChange={(e) => setSelectedUncommitted(e.target.checked ? [...selectedUncommitted, txn.id] : selectedUncommitted.filter(id => id !== txn.id))} />
                  </td>
                  <td className="px-2 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                      getInstitution(txn.account) === 'WF' ? 'bg-red-100 text-red-700' : 
                      getInstitution(txn.account) === 'RH' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                    }`}>{getInstitution(txn.account)}</span>
                  </td>
                  <td className="px-2 py-2 text-xs text-gray-600 whitespace-nowrap">{new Date(txn.date).toLocaleDateString()}</td>
                  <td className="px-2 py-2">
                    <div className="text-sm font-medium text-gray-900 whitespace-normal">{txn.name}</div>
                    {txn.merchantName && txn.merchantName !== txn.name && (
                      <div className="text-xs text-gray-500 truncate">{txn.merchantName}</div>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right font-medium">${Math.abs(txn.amount).toFixed(2)}</td>
                  <td className="px-2 py-2 text-xs text-gray-600">{txn.personal_finance_category?.primary || '-'}</td>
                  <td className="px-2 py-1 bg-yellow-50">
                    <select value={rowChanges[txn.id]?.coa || ''}
                      onChange={(e) => setRowChanges({...rowChanges, [txn.id]: {...(rowChanges[txn.id] || {}), coa: e.target.value}})}
                      className="text-xs border rounded px-1.5 py-1 w-full bg-white">
                      <option value="">-</option>
                      {Object.keys(coaGrouped).map(type => (
                        <optgroup key={type} label={type}>
                          {coaGrouped[type].map(opt => <option key={opt.id} value={opt.code}>{opt.code}</option>)}
                        </optgroup>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1 bg-blue-50">
                    <select value={rowChanges[txn.id]?.sub || ''}
                      onChange={(e) => setRowChanges({...rowChanges, [txn.id]: {...(rowChanges[txn.id] || {}), sub: e.target.value}})}
                      className="text-xs border rounded px-1.5 py-1 w-full bg-white">
                      <option value="">-</option>
                      {subAccountsList.map(sub => <option key={sub} value={sub}>{sub}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Committed Section */}
      {committedTransactions.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-green-50 border-b flex justify-between items-center">
            <h4 className="text-sm font-semibold text-green-800">Committed ({committedTransactions.length})</h4>
            <button onClick={massUncommit} disabled={selectedCommitted.length === 0}
              className="px-3 py-1.5 bg-red-600 text-white rounded text-xs disabled:opacity-50">
              Uncommit Selected
            </button>
          </div>
          <div className="overflow-x-auto overflow-y-auto" style={{maxHeight: '250px'}}>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 w-8">
                    <input type="checkbox" onChange={(e) => setSelectedCommitted(e.target.checked ? committedTransactions.map(t => t.id) : [])} />
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600">Date</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600">Description</th>
                  <th className="px-2 py-2 text-right text-xs font-semibold text-gray-600">Amount</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600">COA</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600">Sub</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {committedTransactions.map((txn: any) => (
                  <tr key={txn.id} className={`hover:bg-gray-50 ${selectedCommitted.includes(txn.id) ? 'bg-red-50' : ''}`}>
                    <td className="px-3 py-2">
                      <input type="checkbox" checked={selectedCommitted.includes(txn.id)}
                        onChange={(e) => setSelectedCommitted(e.target.checked ? [...selectedCommitted, txn.id] : selectedCommitted.filter(id => id !== txn.id))} />
                    </td>
                    <td className="px-2 py-2 text-xs text-gray-600">{new Date(txn.date).toLocaleDateString()}</td>
                    <td className="px-2 py-2 whitespace-normal">{txn.name}</td>
                    <td className="px-2 py-2 text-right font-medium">${Math.abs(txn.amount).toFixed(2)}</td>
                    <td className="px-2 py-2 font-mono text-xs">{txn.accountCode}</td>
                    <td className="px-2 py-2 text-xs text-gray-600">{txn.subAccount || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
