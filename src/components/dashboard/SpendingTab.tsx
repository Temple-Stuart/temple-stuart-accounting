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
  console.log("Guard check:", { transactions, committedTransactions, coaOptions, transUndef: transactions === undefined, commitUndef: committedTransactions === undefined, coaUndef: coaOptions === undefined });
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

  const getDetailedCategories = () => {
    if (!transactions || transactions.length === 0) return [];
    const categories = new Map<string, number>();
    transactions.forEach((t: any) => {
      const cat = t.personal_finance_category?.detailed;
      if (cat) categories.set(cat, (categories.get(cat) || 0) + 1);
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
      if (selectedFilter.type === 'detailed') {
        return t.personal_finance_category?.detailed === selectedFilter.value;
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
        alert(`✅ Committed ${result.committed} transactions with journal entries`);
        setSelectedFilter(null);
        setShowCOAAssignment(false);
        setSelectedAccount('');
        setSelectedSubAccount('');
      } else {
        alert(`❌ ${result.errors.length} errors occurred`);
      }
    } catch (error) {
      alert('Failed to save');
    }
  };

  const commitSelectedRows = async () => {
    const updates = Object.entries(rowChanges).filter(([id, values]) => values.coa);
    if (updates.length === 0) {
      alert('No rows have COA assigned');
      return;
    }
    try {
      const transactionIds = updates.map(([id]) => id);
      const accountCode = updates[0][1].coa;
      
      const res = await fetch('/api/transactions/commit-to-ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionIds,
          accountCode,
          subAccount: updates[0][1].sub || null
        })
      });
      
      const result = await res.json();
      
      if (result.success) {
        await onReload();
        setRowChanges({});
        alert(`✅ Committed ${result.committed} transactions with journal entries`);
      } else {
        alert(`❌ Errors: ${result.errors.length}`);
      }
    } catch (error) {
      alert('Failed to commit transactions');
    }
  };

  const massUncommit = async () => {
    if (selectedCommitted.length === 0) {
      alert('Select transactions to uncommit');
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
      alert('Failed to uncommit');
    }
  };

  const coaGrouped = groupCoaByType();

  return (
    <>
      <div className="grid grid-cols-3 gap-4 p-4 border-b bg-gray-50">
        <div>
          <h4 className="text-xs font-semibold text-gray-600 mb-2">MERCHANT</h4>
          <div className="bg-white border rounded-lg max-h-40 overflow-y-auto">
            {getMerchants().slice(0, 30).map(([merchant, count]) => (
              <div key={merchant} onClick={() => {
                setSelectedFilter({type: 'merchant', value: merchant});
                setShowCOAAssignment(true);
              }}
              className={`px-3 py-2 cursor-pointer hover:bg-gray-50 flex justify-between text-sm ${
                selectedFilter?.value === merchant ? 'bg-blue-50 text-blue-700' : ''
              }`}>
                <span className="truncate">{merchant}</span>
                <span className="text-xs text-gray-500">{count}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div>
          <h4 className="text-xs font-semibold text-gray-600 mb-2">PRIMARY</h4>
          <div className="bg-white border rounded-lg max-h-40 overflow-y-auto">
            {getPrimaryCategories().map(([category, count]) => (
              <div key={category} onClick={() => {
                setSelectedFilter({type: 'primary', value: category});
                setShowCOAAssignment(true);
              }}
              className={`px-3 py-2 cursor-pointer hover:bg-gray-50 flex justify-between text-sm ${
                selectedFilter?.value === category ? 'bg-blue-50 text-blue-700' : ''
              }`}>
                <span>{category}</span>
                <span className="text-xs text-gray-500">{count}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div>
          <h4 className="text-xs font-semibold text-gray-600 mb-2">DETAILED</h4>
          <div className="bg-white border rounded-lg max-h-40 overflow-y-auto">
            {getDetailedCategories().slice(0, 30).map(([category, count]) => (
              <div key={category} onClick={() => {
                setSelectedFilter({type: 'detailed', value: category});
                setShowCOAAssignment(true);
              }}
              className={`px-3 py-2 cursor-pointer hover:bg-gray-50 flex justify-between text-sm ${
                selectedFilter?.value === category ? 'bg-blue-50 text-blue-700' : ''
              }`}>
                <span className="truncate">{category}</span>
                <span className="text-xs text-gray-500">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="p-3 bg-gray-100 border-b">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Build Sub-Accounts:</span>
          <input type="text" placeholder="Enter new sub-account name"
            value={newSubAccount} onChange={(e) => setNewSubAccount(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addSubAccount()}
            className="flex-1 px-3 py-1 border rounded text-sm" />
          <button onClick={addSubAccount} className="px-4 py-1 bg-gray-600 text-white rounded text-sm">Add</button>
          <div className="text-xs text-gray-600">
            Current: {subAccountsList.length > 0 ? subAccountsList.join(', ') : 'None'}
          </div>
        </div>
      </div>

      {showCOAAssignment && selectedFilter && (
        <div className="p-4 bg-blue-50 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium">Assign to: {selectedFilter.value}</h4>
              <p className="text-xs text-gray-600">{getFilteredTransactions().length} transactions</p>
            </div>
            <div className="flex gap-2">
              <select value={selectedAccount} onChange={(e) => setSelectedAccount(e.target.value)}
                className="text-sm border rounded px-3 py-1">
                <option value="">Select COA</option>
                {Object.keys(coaGrouped).map(type => (
                  <optgroup key={type} label={type}>
                    {coaGrouped[type].map(opt => (
                      <option key={opt.id} value={opt.code}>{opt.code} - {opt.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <select value={selectedSubAccount} onChange={(e) => setSelectedSubAccount(e.target.value)}
                className="text-sm border rounded px-3 py-1">
                <option value="">No Sub-Account</option>
                {subAccountsList.map(sub => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
              <button onClick={applyBulkCOA} className="px-4 py-1 bg-green-600 text-white rounded text-sm">
                Apply & Commit
              </button>
              <button onClick={() => {setSelectedFilter(null); setShowCOAAssignment(false);}}
                className="px-3 py-1 border rounded text-sm">Clear</button>
            </div>
          </div>
        </div>
      )}

      <div className="p-2 bg-gray-100 border-b flex justify-between">
        <button onClick={commitSelectedRows} className="px-4 py-2 bg-blue-600 text-white rounded text-sm">
          Commit Rows with COA Assigned
        </button>
        <span className="text-sm text-gray-600">
          Showing all {transactions.length} uncommitted transactions
        </span>
      </div>

      <div className="overflow-x-auto overflow-y-auto" style={{maxHeight: '400px'}}>
        <table className="w-full text-xs">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-2 py-2 text-left">Inst</th>
              <th className="px-2 py-2 text-left">Date</th>
              <th className="px-2 py-2 text-left">Name</th>
              <th className="px-2 py-2 text-left">Merchant</th>
              <th className="px-2 py-2 text-right">Amount</th>
              <th className="px-2 py-2 text-left">Primary</th>
              <th className="px-2 py-2 text-left">Detailed</th>
              <th className="px-2 py-2 text-left bg-yellow-50 min-w-[200px]">COA</th>
              <th className="px-2 py-2 text-center bg-blue-50 min-w-[80px]">Sub-Acct</th>
              <th className="px-2 py-2 text-center bg-green-50 min-w-[60px]">Conf%</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(selectedFilter ? getFilteredTransactions() : transactions).map((txn: any) => {
              const suggestion = merchantSuggestions[txn.id];
              return (
              <tr key={txn.id} className={selectedFilter && getFilteredTransactions().includes(txn) ? 'bg-yellow-50' : ''}>
                <td className="px-2 py-2">
                  <span className={`px-1 py-0.5 rounded text-xs font-medium ${
                    getInstitution(txn.account) === 'WF' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
                  }`}>{getInstitution(txn.account)}</span>
                </td>
                <td className="px-2 py-2">{new Date(txn.date).toLocaleDateString()}</td>
                <td className="px-2 py-2">{txn.name}</td>
                <td className="px-2 py-2">{txn.merchantName || '-'}</td>
                <td className="px-2 py-2 text-right">${Math.abs(txn.amount).toFixed(2)}</td>
                <td className="px-2 py-2">{txn.personal_finance_category?.primary || '-'}</td>
                <td className="px-2 py-2">{txn.personal_finance_category?.detailed || '-'}</td>
                <td className="px-2 py-1 bg-yellow-50">
                  <select value={rowChanges[txn.id]?.coa || (txn.predictedCoaCode || '')}
                    onChange={(e) => setRowChanges({...rowChanges, [txn.id]: {...(rowChanges[txn.id] || {}), coa: e.target.value}})}
                    className="text-xs border rounded px-1 py-0.5 w-full">
                    <option value="">-</option>
                    {Object.keys(coaGrouped).map(type => (
                      <optgroup key={type} label={type}>
                        {coaGrouped[type].map(opt => (
                          <option key={opt.id} value={opt.code}>{opt.code} - {opt.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1 bg-blue-50">
                  <select value={rowChanges[txn.id]?.sub || (txn.subAccount || '')}
                    onChange={(e) => setRowChanges({...rowChanges, [txn.id]: {...(rowChanges[txn.id] || {}), sub: e.target.value}})}
                    className="text-xs border rounded px-1 py-0.5 w-full">
                    <option value="">-</option>
                    {subAccountsList.map((sub: string) => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-2 text-center bg-green-50">
                  {txn.predictionConfidence ? (
                    <span className="text-xs font-semibold text-green-700">
                      {(parseFloat(txn.predictionConfidence) * 100).toFixed(0)}%
                    </span>
                  ) : '-'}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {committedTransactions.length > 0 && (
        <div className="border-t bg-green-50">
          <div className="p-3 bg-green-100 flex justify-between items-center">
            <h4 className="text-sm font-medium text-green-800">Committed ({committedTransactions.length})</h4>
            <button onClick={massUncommit} className="px-3 py-1 bg-red-600 text-white rounded text-xs">
              Uncommit Selected
            </button>
          </div>
          <div className="overflow-x-auto overflow-y-auto" style={{maxHeight: '300px'}}>
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-2 py-2"><input type="checkbox" onChange={(e) => {
                    if (e.target.checked) setSelectedCommitted(committedTransactions.map(t => t.id));
                    else setSelectedCommitted([]);
                  }} /></th>
                  <th className="px-2 py-2 text-left">Date</th>
                  <th className="px-2 py-2 text-left">Name</th>
                  <th className="px-2 py-2 text-right">Amount</th>
                  <th className="px-2 py-2 text-left">COA</th>
                  <th className="px-2 py-2 text-left">Sub-Account</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {committedTransactions.map((txn: any) => (
                  <tr key={txn.id}>
                    <td className="px-2 py-2">
                      <input type="checkbox" 
                        checked={selectedCommitted.includes(txn.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedCommitted([...selectedCommitted, txn.id]);
                          else setSelectedCommitted(selectedCommitted.filter(id => id !== txn.id));
                        }}
                      />
                    </td>
                    <td className="px-2 py-2">{new Date(txn.date).toLocaleDateString()}</td>
                    <td className="px-2 py-2">{txn.name}</td>
                    <td className="px-2 py-2 text-right">${Math.abs(txn.amount).toFixed(2)}</td>
                    <td className="px-2 py-2">{txn.accountCode}</td>
                    <td className="px-2 py-2">{txn.subAccount || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

