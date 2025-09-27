'use client';

import { useState, useEffect, useCallback } from 'react';
import Script from 'next/script';

declare global {
  interface Window {
    Plaid: any;
  }
}

export function ImportDataSection({ entityId }: { entityId: string }) {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [committedTransactions, setCommittedTransactions] = useState<any[]>([]);
  const [investmentTransactions, setInvestmentTransactions] = useState<any[]>([]);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'spending' | 'investments'>('spending');
  
  const [selectedFilter, setSelectedFilter] = useState<{type: string, value: string} | null>(null);
  const [showCOAAssignment, setShowCOAAssignment] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [selectedSubAccount, setSelectedSubAccount] = useState('');
  const [subAccountsList, setSubAccountsList] = useState<string[]>([]);
  const [newSubAccount, setNewSubAccount] = useState('');
  const [rowChanges, setRowChanges] = useState<{[key: string]: {coa: string, sub: string}}>({});
  const [selectedCommitted, setSelectedCommitted] = useState<string[]>([]);

  useEffect(() => {
    loadData();
    createLinkToken();
  }, [entityId]);

  const loadData = async () => {
    try {
      const res = await fetch('/api/accounts');
      if (res.ok) {
        const data = await res.json();
        let accountsList = [];
        if (data.accounts) {
          accountsList = data.accounts;
        } else if (data.items) {
          data.items.forEach((item: any) => {
            if (item.accounts) {
              accountsList.push(...item.accounts);
            }
          });
        } else if (Array.isArray(data)) {
          accountsList = data;
        }
        setAccounts(accountsList);
      }
    } catch (error) {
      console.error('Error loading accounts:', error);
    }

    try {
      const res = await fetch('/api/transactions');
      if (res.ok) {
        const data = await res.json();
        let allTxns = [];
        if (data.transactions) {
          allTxns = data.transactions;
        } else if (Array.isArray(data)) {
          allTxns = data;
        }
        
        const committed = allTxns.filter(t => t.accountCode);
        const uncommitted = allTxns.filter(t => !t.accountCode);
        
        setCommittedTransactions(committed);
        setTransactions(uncommitted);
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
    }

    try {
      const res = await fetch('/api/investment-transactions');
      if (res.ok) {
        const data = await res.json();
        let investments = [];
        if (data.transactions) {
          investments = data.transactions;
        } else if (data.investments) {
          investments = data.investments;
        } else if (Array.isArray(data)) {
          investments = data;
        }
        setInvestmentTransactions(investments);
      }
    } catch (error) {
      console.error('Error loading investments:', error);
    }
  };

  const createLinkToken = async () => {
    try {
      const res = await fetch('/api/plaid/link-token', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        const data = await res.json();
        setLinkToken(data.link_token);
      }
    } catch (error) {
      console.error('Error creating link token:', error);
    }
  };

  const syncCompleteData = async () => {
    setLoading(true);
    setSyncStatus('Syncing ALL transaction data...');
    try {
      const res = await fetch('/api/transactions/sync-complete', { method: 'POST' });
      if (res.ok) {
        setSyncStatus(`Sync complete!`);
        await loadData();
      }
    } catch (error) {
      setSyncStatus('Sync failed');
    }
    setLoading(false);
  };

  const openPlaidLink = useCallback(() => {
    if (!linkToken || !window.Plaid) return;
    const handler = window.Plaid.create({
      token: linkToken,
      onSuccess: async (public_token: string) => {
        try {
          const res = await fetch('/api/plaid/exchange-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ publicToken: public_token }),
          });
          if (res.ok) {
            await loadData();
            await syncCompleteData();
          }
        } catch (error) {
          console.error('Link error:', error);
        }
      },
      onExit: (err: any) => {
        if (err) console.error('Plaid Link error:', err);
      },
    });
    handler.open();
  }, [linkToken]);

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

  const getAccountType = (account: any) => {
    if (!account) return '';
    const name = account?.name?.toLowerCase() || '';
    if (name.includes('spending')) return 'Spending';
    if (name.includes('individual')) return 'Investment';
    if (name.includes('checking')) return 'Checking';
    return account?.type || '';
  };

  const getMerchants = () => {
    const merchants = new Map();
    transactions.forEach(t => {
      const merchant = t.merchantName || t.merchant_name || t.name;
      if (merchant) {
        merchants.set(merchant, (merchants.get(merchant) || 0) + 1);
      }
    });
    return Array.from(merchants.entries()).sort((a, b) => b[1] - a[1]);
  };

  const getPrimaryCategories = () => {
    const categories = new Map();
    transactions.forEach(t => {
      const cat = t.personal_finance_category?.primary || 'Uncategorized';
      categories.set(cat, (categories.get(cat) || 0) + 1);
    });
    return Array.from(categories.entries()).sort((a, b) => b[1] - a[1]);
  };

  const getDetailedCategories = () => {
    const categories = new Map();
    transactions.forEach(t => {
      const cat = t.personal_finance_category?.detailed;
      if (cat) {
        categories.set(cat, (categories.get(cat) || 0) + 1);
      }
    });
    return Array.from(categories.entries()).sort((a, b) => b[1] - a[1]);
  };

  const getFilteredTransactions = () => {
    if (!selectedFilter) return transactions;
    return transactions.filter(t => {
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

  const applyBulkCOA = async () => {
    if (!selectedAccount) {
      alert('Please select a Chart of Account');
      return;
    }
    const filtered = getFilteredTransactions();
    const transactionIds = filtered.map(t => t.id);
    try {
      const res = await fetch('/api/transactions/assign-coa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionIds,
          accountCode: selectedAccount,
          subAccount: selectedSubAccount || null
        })
      });
      if (res.ok) {
        await loadData();
        alert(`✅ Committed ${transactionIds.length} transactions`);
        setSelectedFilter(null);
        setShowCOAAssignment(false);
        setSelectedAccount('');
        setSelectedSubAccount('');
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
      for (const [txnId, values] of updates) {
        await fetch('/api/transactions/assign-coa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transactionIds: [txnId],
            accountCode: values.coa,
            subAccount: values.sub || null
          })
        });
      }
      await loadData();
      setRowChanges({});
      alert(`✅ Committed ${updates.length} transactions`);
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
      await loadData();
      setSelectedCommitted([]);
      alert(`✅ Uncommitted ${selectedCommitted.length} transactions`);
    } catch (error) {
      alert('Failed to uncommit');
    }
  };

  const totalTransactions = transactions.length + committedTransactions.length;
  const progressPercent = totalTransactions > 0 ? (committedTransactions.length / totalTransactions * 100) : 0;

  // FULL COA LIST - IRS/GAAP Compliant
  const coaOptions = [
    { group: "1000 - Assets", options: [
      { code: "1010", name: "Petty Cash" },
      { code: "1020", name: "Cash in Bank - Operating" },
      { code: "1030", name: "Cash in Bank - Payroll" },
      { code: "1040", name: "Savings Account" },
      { code: "1100", name: "Accounts Receivable" },
      { code: "1200", name: "Inventory" },
      { code: "1300", name: "Prepaid Expenses" },
      { code: "1400", name: "Land" },
      { code: "1410", name: "Buildings" },
      { code: "1420", name: "Equipment" },
      { code: "1430", name: "Vehicles" },
      { code: "1440", name: "Furniture & Fixtures" },
      { code: "1450", name: "Accumulated Depreciation" },
      { code: "1500", name: "Investments - Stocks" },
      { code: "1510", name: "Investments - Bonds" },
      { code: "1520", name: "Investments - Crypto" }
    ]},
    { group: "2000 - Liabilities", options: [
      { code: "2010", name: "Accounts Payable" },
      { code: "2020", name: "Credit Card Payable" },
      { code: "2100", name: "Wages Payable" },
      { code: "2110", name: "Payroll Taxes Payable" },
      { code: "2120", name: "Sales Tax Payable" },
      { code: "2200", name: "Short-Term Notes Payable" },
      { code: "2300", name: "Long-Term Notes Payable" },
      { code: "2400", name: "Mortgage Payable" }
    ]},
    { group: "3000 - Equity", options: [
      { code: "3010", name: "Owner's Capital" },
      { code: "3020", name: "Owner's Draw" },
      { code: "3100", name: "Retained Earnings" },
      { code: "3200", name: "Dividends" }
    ]},
    { group: "4000 - Revenue", options: [
      { code: "4010", name: "Sales Revenue" },
      { code: "4020", name: "Service Revenue" },
      { code: "4030", name: "Consulting Revenue" },
      { code: "4100", name: "Interest Income" },
      { code: "4110", name: "Dividend Income" },
      { code: "4120", name: "Capital Gains" },
      { code: "4130", name: "Capital Losses" },
      { code: "4200", name: "Other Income" }
    ]},
    { group: "5000 - COGS", options: [
      { code: "5010", name: "Cost of Goods Sold" },
      { code: "5020", name: "Direct Labor" },
      { code: "5030", name: "Direct Materials" },
      { code: "5040", name: "Subcontractor Costs" }
    ]},
    { group: "6000 - Operating Expenses", options: [
      { code: "6010", name: "Salaries & Wages" },
      { code: "6020", name: "Payroll Taxes" },
      { code: "6030", name: "Employee Benefits" },
      { code: "6100", name: "Rent Expense" },
      { code: "6110", name: "Utilities" },
      { code: "6120", name: "Telephone & Internet" },
      { code: "6200", name: "Office Supplies" },
      { code: "6210", name: "Software & Subscriptions" },
      { code: "6300", name: "Advertising & Marketing" },
      { code: "6400", name: "Travel" },
      { code: "6410", name: "Meals & Entertainment (50%)" },
      { code: "6420", name: "Meals & Entertainment (100%)" },
      { code: "6430", name: "Vehicle Expenses" },
      { code: "6440", name: "Gas & Fuel" },
      { code: "6500", name: "Professional Fees" },
      { code: "6510", name: "Legal Fees" },
      { code: "6520", name: "Accounting Fees" },
      { code: "6600", name: "Bank Service Charges" },
      { code: "6610", name: "Credit Card Fees" },
      { code: "6620", name: "Interest Expense" },
      { code: "6700", name: "Depreciation" },
      { code: "6800", name: "Repairs & Maintenance" },
      { code: "6900", name: "Insurance" },
      { code: "6950", name: "Other Operating Expenses" }
    ]},
    { group: "7000 - Other Expenses", options: [
      { code: "7010", name: "Income Tax Expense" },
      { code: "7020", name: "Penalties & Fines" }
    ]},
    { group: "8000 - Personal (Non-Business)", options: [
      { code: "8010", name: "Personal Draw" },
      { code: "8020", name: "Personal Credit Card" },
      { code: "8050", name: "Personal Meals" },
      { code: "8060", name: "Personal Entertainment" },
      { code: "8100", name: "Home Mortgage/Rent" },
      { code: "8110", name: "Home Utilities" },
      { code: "8120", name: "Groceries" },
      { code: "8130", name: "Healthcare & Medical" },
      { code: "8140", name: "Personal Insurance" },
      { code: "8150", name: "Clothing & Personal Care" },
      { code: "8160", name: "Education" },
      { code: "8170", name: "Hobbies & Recreation" },
      { code: "8180", name: "Gifts & Donations" },
      { code: "8190", name: "Other Personal" }
    ]}
  ];

  return (
    <>
      <Script src="https://cdn.plaid.com/link/v2/stable/link-initialize.js" strategy="lazyOnload" />
      
      <div className="space-y-6">
        <div className="bg-white border rounded-xl p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">Progress</span>
            <span className="text-sm text-gray-600">
              {committedTransactions.length} / {totalTransactions} committed ({progressPercent.toFixed(1)}%)
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-green-600 h-2 rounded-full" style={{width: `${progressPercent}%`}} />
          </div>
          {progressPercent === 100 && (
            <button className="mt-2 w-full px-4 py-2 bg-blue-600 text-white rounded-lg">
              Continue to Step 2 →
            </button>
          )}
        </div>

        <div className="bg-white border rounded-xl">
          <div className="px-4 py-4 border-b flex justify-between">
            <h3 className="text-lg font-medium">Connected Accounts</h3>
            <div className="flex gap-2">
              <button onClick={syncCompleteData} disabled={loading} className="px-4 py-2 bg-[#b4b237] text-white rounded-lg text-sm">
                {loading ? 'Syncing...' : 'Sync All Data'}
              </button>
              <button onClick={openPlaidLink} disabled={!linkToken} className="px-4 py-2 bg-[#b4b237] text-white rounded-lg text-sm">
                + Connect
              </button>
            </div>
          </div>
          <div className="p-4">
            {syncStatus && (
              <div className="mb-4 p-3 bg-[#b4b237]/5 text-gray-700 rounded-lg text-sm">
                {syncStatus}
              </div>
            )}
            {accounts.map(account => (
              <div key={account.id} className="border rounded-lg p-3 mb-4 flex justify-between">
                <div>
                  <h4 className="font-medium">{account.name}</h4>
                  <p className="text-sm text-gray-500">{account.type} • {account.subtype}</p>
                </div>
                <p className="text-xl font-semibold">
                  ${(account.balance || account.currentBalance || 0).toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="border-b flex">
            <button onClick={() => setActiveTab('spending')} 
              className={`px-6 py-3 font-medium ${activeTab === 'spending' ? 'border-b-2 border-[#b4b237] text-[#b4b237]' : 'text-gray-600'}`}>
              Spending ({transactions.length} uncommitted, {committedTransactions.length} committed)
            </button>
            <button onClick={() => setActiveTab('investments')} 
              className={`px-6 py-3 font-medium ${activeTab === 'investments' ? 'border-b-2 border-[#b4b237] text-[#b4b237]' : 'text-gray-600'}`}>
              Investments ({investmentTransactions.length})
            </button>
          </div>

          {activeTab === 'spending' && (
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
                        {coaOptions.map(group => (
                          <optgroup key={group.group} label={group.group}>
                            {group.options.map(opt => (
                              <option key={opt.code} value={opt.code}>{opt.code} - {opt.name}</option>
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

              <div className="overflow-auto" style={{maxHeight: '400px'}}>
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
                      <th className="px-2 py-2 text-left bg-yellow-50">COA</th>
                      <th className="px-2 py-2 text-left bg-yellow-50">Sub</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(selectedFilter ? getFilteredTransactions() : transactions).map((txn) => (
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
                          <select value={rowChanges[txn.id]?.coa || ''}
                            onChange={(e) => setRowChanges({...rowChanges, [txn.id]: {...(rowChanges[txn.id] || {}), coa: e.target.value}})}
                            className="text-xs border rounded px-1 py-0.5 w-20">
                            <option value="">-</option>
                            {coaOptions.map(group => (
                              <optgroup key={group.group} label={group.group}>
                                {group.options.map(opt => (
                                  <option key={opt.code} value={opt.code}>{opt.code}</option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-1 bg-yellow-50">
                          <select value={rowChanges[txn.id]?.sub || ''}
                            onChange={(e) => setRowChanges({...rowChanges, [txn.id]: {...(rowChanges[txn.id] || {}), sub: e.target.value}})}
                            className="text-xs border rounded px-1 py-0.5 w-20">
                            <option value="">-</option>
                            {subAccountsList.map(sub => (
                              <option key={sub} value={sub}>{sub}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {committedTransactions.length > 0 && (
                <div className="border-t bg-green-50">
                  <div className="p-3 bg-green-100 flex justify-between">
                    <h4 className="text-sm font-medium text-green-800">Committed ({committedTransactions.length})</h4>
                    <button onClick={massUncommit} className="px-3 py-1 bg-red-600 text-white rounded text-xs">
                      Uncommit Selected
                    </button>
                  </div>
                  <div className="overflow-auto" style={{maxHeight: '300px'}}>
                    <table className="w-full text-xs">
                      <thead className="bg-green-100 sticky top-0">
                        <tr>
                          <th className="px-2 py-2">
                            <input type="checkbox" onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedCommitted(committedTransactions.map(t => t.id));
                              } else {
                                setSelectedCommitted([]);
                              }
                            }} />
                          </th>
                          <th className="px-2 py-2 text-left">Date</th>
                          <th className="px-2 py-2 text-left">Name</th>
                          <th className="px-2 py-2 text-left">Merchant</th>
                          <th className="px-2 py-2 text-right">Amount</th>
                          <th className="px-2 py-2 text-left">COA</th>
                          <th className="px-2 py-2 text-left">Sub</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-green-200">
                        {committedTransactions.map((txn) => (
                          <tr key={txn.id} className="bg-white">
                            <td className="px-2 py-2">
                              <input type="checkbox" checked={selectedCommitted.includes(txn.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedCommitted([...selectedCommitted, txn.id]);
                                  } else {
                                    setSelectedCommitted(selectedCommitted.filter(id => id !== txn.id));
                                  }
                                }} />
                            </td>
                            <td className="px-2 py-2">{new Date(txn.date).toLocaleDateString()}</td>
                            <td className="px-2 py-2">{txn.name}</td>
                            <td className="px-2 py-2">{txn.merchantName || '-'}</td>
                            <td className="px-2 py-2 text-right">${Math.abs(txn.amount).toFixed(2)}</td>
                            <td className="px-2 py-2 font-semibold text-green-700">{txn.accountCode}</td>
                            <td className="px-2 py-2">{txn.subAccount || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'investments' && (
            <div className="overflow-auto" style={{maxHeight: '600px'}}>
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-2 py-2 text-left">Date</th>
                    <th className="px-2 py-2 text-left">Symbol</th>
                    <th className="px-2 py-2 text-left">Name</th>
                    <th className="px-2 py-2 text-left">Type</th>
                    <th className="px-2 py-2 text-left">Subtype</th>
                    <th className="px-2 py-2 text-right">Qty</th>
                    <th className="px-2 py-2 text-right">Price</th>
                    <th className="px-2 py-2 text-right">Amount</th>
                    <th className="px-2 py-2 text-right">Fees</th>
                    <th className="px-2 py-2 text-left bg-yellow-50">COA</th>
                    <th className="px-2 py-2 text-left bg-yellow-50">Sub</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {investmentTransactions.map((txn) => (
                    <tr key={txn.id || txn.investment_transaction_id} className="hover:bg-gray-50">
                      <td className="px-2 py-2">{new Date(txn.date).toLocaleDateString()}</td>
                      <td className="px-2 py-2 font-medium">{txn.security?.ticker_symbol || '-'}</td>
                      <td className="px-2 py-2">{txn.name}</td>
                      <td className="px-2 py-2">{txn.type}</td>
                      <td className="px-2 py-2">{txn.subtype}</td>
                      <td className="px-2 py-2 text-right">{txn.quantity || '-'}</td>
                      <td className="px-2 py-2 text-right">${txn.price || 0}</td>
                      <td className={`px-2 py-2 text-right font-medium ${
                        txn.amount < 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        ${Math.abs(txn.amount || 0).toFixed(2)}
                      </td>
                      <td className="px-2 py-2 text-right">${txn.fees || 0}</td>
                      <td className="px-2 py-1 bg-yellow-50">
                        <select className="text-xs border rounded px-1 py-0.5 w-20">
                          <option value="">-</option>
                          <option value="1500">1500</option>
                          <option value="4120">4120</option>
                          <option value="4130">4130</option>
                        </select>
                      </td>
                      <td className="px-2 py-1 bg-yellow-50">
                        <select className="text-xs border rounded px-1 py-0.5 w-20">
                          <option value="">-</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-4 bg-gray-50 text-sm">
                Total Investment Transactions: {investmentTransactions.length}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
