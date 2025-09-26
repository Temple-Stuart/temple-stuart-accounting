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
  const [investmentTransactions, setInvestmentTransactions] = useState<any[]>([]);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'spending' | 'investments'>('spending');
  
  // NEW: Filter states
  const [selectedFilter, setSelectedFilter] = useState<{type: string, value: string} | null>(null);
  const [showCOAAssignment, setShowCOAAssignment] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [selectedSubAccount, setSelectedSubAccount] = useState('');

  useEffect(() => {
    loadData();
    createLinkToken();
  }, [entityId]);

  const loadData = async () => {
    try {
      const res = await fetch('/api/accounts');
      if (res.ok) {
        const data = await res.json();
        setAccounts(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error loading accounts:', error);
    }

    try {
      const res = await fetch('/api/transactions');
      if (res.ok) {
        const data = await res.json();
        setTransactions(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
    }

    try {
      const res = await fetch('/api/investment-transactions');
      if (res.ok) {
        const data = await res.json();
        const txns = Array.isArray(data) ? data : (data.investments || []);
        setInvestmentTransactions(txns);
      }
    } catch (error) {
      console.error('Error loading investment transactions:', error);
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
    setSyncStatus('Syncing ALL transaction data with enrichments...');
    
    try {
      const res = await fetch('/api/transactions/sync-complete', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setSyncStatus(`Synced: ${data.synced.transactions} transactions, ${data.synced.investmentTransactions} trades`);
        await loadData();
      } else {
        setSyncStatus('Sync failed');
      }
    } catch (error) {
      setSyncStatus('Sync failed: Network error');
    }
    
    setLoading(false);
  };

  const openPlaidLink = useCallback(() => {
    if (!linkToken || !window.Plaid) return;

    const handler = window.Plaid.create({
      token: linkToken,
      onSuccess: async (public_token: string) => {
        try {
          setSyncStatus('Connecting account...');
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
          setSyncStatus('Failed to connect account');
        }
      },
      onExit: (err: any) => {
        if (err) console.error('Plaid Link error:', err);
      },
    });

    handler.open();
  }, [linkToken]);

  // Get institution from account
  const getInstitution = (account: any) => {
    if (!account) return '-';
    const name = account.name?.toLowerCase() || '';
    const institutionName = account.plaidItem?.institutionName?.toLowerCase() || '';
    
    if (name.includes('robinhood') || institutionName.includes('robinhood')) {
      return 'Robinhood';
    }
    if (name.includes('wells') || name.includes('everyday') || institutionName.includes('wells')) {
      return 'Wells Fargo';
    }
    return institutionName || 'Bank';
  };

  // Get account type for display
  const getAccountType = (account: any) => {
    if (!account) return '';
    const name = account.name?.toLowerCase() || '';
    if (name.includes('spending')) return 'Spending';
    if (name.includes('individual')) return 'Investment';
    if (name.includes('checking')) return 'Checking';
    return account.type || '';
  };

  // NEW: Get unique filter values
  const getMerchants = () => {
    const merchants = new Map();
    transactions.forEach(t => {
      const merchant = t.merchantName || t.name;
      if (merchant) {
        merchants.set(merchant, (merchants.get(merchant) || 0) + 1);
      }
    });
    return Array.from(merchants.entries()).sort((a, b) => b[1] - a[1]);
  };

  const getPrimaryCategories = () => {
    const categories = new Map();
    transactions.forEach(t => {
      const cat = t.personal_finance_category?.primary || t.category || 'Uncategorized';
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

  // NEW: Filter transactions
  const getFilteredTransactions = () => {
    if (!selectedFilter) return transactions;
    
    return transactions.filter(t => {
      if (selectedFilter.type === 'merchant') {
        return (t.merchantName || t.name) === selectedFilter.value;
      }
      if (selectedFilter.type === 'primary') {
        return (t.personal_finance_category?.primary || t.category || 'Uncategorized') === selectedFilter.value;
      }
      if (selectedFilter.type === 'detailed') {
        return t.personal_finance_category?.detailed === selectedFilter.value;
      }
      return true;
    });
  };

  // NEW: Apply COA to filtered transactions
  const applyBulkCOA = () => {
    const filtered = getFilteredTransactions();
    console.log(`Applying Account: ${selectedAccount}, SubAccount: ${selectedSubAccount} to ${filtered.length} transactions`);
    // TODO: Update transactions in database
  };

  return (
    <>
      <Script
        src="https://cdn.plaid.com/link/v2/stable/link-initialize.js"
        strategy="lazyOnload"
      />
      
      <div className="space-y-6">
        {/* Connected Accounts */}
        <div className="bg-white border border-gray-100 rounded-xl">
          <div className="px-4 sm:px-6 py-4 border-b">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <h3 className="text-lg font-medium">Connected Accounts</h3>
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  onClick={syncCompleteData}
                  disabled={loading || accounts.length === 0}
                  className="flex-1 sm:flex-none px-4 py-2 bg-[#b4b237] text-white rounded-lg hover:bg-[#b4b237] disabled:opacity-50 text-sm"
                >
                  {loading ? 'Syncing...' : 'Sync All Data'}
                </button>
                <button
                  onClick={openPlaidLink}
                  disabled={!linkToken}
                  className="flex-1 sm:flex-none px-4 py-2 bg-[#b4b237] text-white rounded-lg hover:bg-[#9a9630] disabled:opacity-50 text-sm"
                >
                  + Connect
                </button>
              </div>
            </div>
          </div>
          <div className="p-4 sm:p-6">
            {syncStatus && (
              <div className="mb-4 p-3 bg-[#b4b237]/5 text-gray-700 rounded-lg text-sm">
                {syncStatus}
              </div>
            )}
            {accounts.map((account) => (
              <div key={account.id} className="border rounded-lg p-3 sm:p-4 mb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium">{account.name}</h4>
                    <p className="text-sm text-gray-500">
                      {account.type} • {account.subtype}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg sm:text-xl font-semibold">
                      ${(account.currentBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Transaction Tabs */}
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <div className="border-b">
            <div className="flex">
              <button
                onClick={() => setActiveTab('spending')}
                className={`px-4 sm:px-6 py-3 font-medium whitespace-nowrap ${
                  activeTab === 'spending'
                    ? 'border-b-2 border-[#b4b237] text-[#b4b237]'
                    : 'text-gray-600'
                }`}
              >
                Spending ({transactions.length})
              </button>
              <button
                onClick={() => setActiveTab('investments')}
                className={`px-4 sm:px-6 py-3 font-medium whitespace-nowrap ${
                  activeTab === 'investments'
                    ? 'border-b-2 border-[#b4b237] text-[#b4b237]'
                    : 'text-gray-600'
                }`}
              >
                Investments ({investmentTransactions.length})
              </button>
            </div>
          </div>

          {/* Spending Transactions with COA Filters */}
          {activeTab === 'spending' && (
            <>
              {/* NEW: Filter Lists */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border-b bg-gray-50">
                <div>
                  <h4 className="text-xs font-semibold text-gray-600 mb-2">MERCHANT</h4>
                  <div className="bg-white border rounded-lg max-h-40 overflow-y-auto">
                    {getMerchants().slice(0, 10).map(([merchant, count]) => (
                      <div
                        key={merchant}
                        onClick={() => {
                          setSelectedFilter({type: 'merchant', value: merchant});
                          setShowCOAAssignment(true);
                        }}
                        className={`px-3 py-2 cursor-pointer hover:bg-gray-50 flex justify-between items-center text-sm ${
                          selectedFilter?.value === merchant ? 'bg-blue-50 text-blue-700' : ''
                        }`}
                      >
                        <span>{merchant}</span>
                        <span className="text-xs text-gray-500">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h4 className="text-xs font-semibold text-gray-600 mb-2">PRIMARY CATEGORY</h4>
                  <div className="bg-white border rounded-lg max-h-40 overflow-y-auto">
                    {getPrimaryCategories().map(([category, count]) => (
                      <div
                        key={category}
                        onClick={() => {
                          setSelectedFilter({type: 'primary', value: category});
                          setShowCOAAssignment(true);
                        }}
                        className={`px-3 py-2 cursor-pointer hover:bg-gray-50 flex justify-between items-center text-sm ${
                          selectedFilter?.value === category ? 'bg-blue-50 text-blue-700' : ''
                        }`}
                      >
                        <span>{category}</span>
                        <span className="text-xs text-gray-500">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h4 className="text-xs font-semibold text-gray-600 mb-2">DETAILED CATEGORY</h4>
                  <div className="bg-white border rounded-lg max-h-40 overflow-y-auto">
                    {getDetailedCategories().slice(0, 10).map(([category, count]) => (
                      <div
                        key={category}
                        onClick={() => {
                          setSelectedFilter({type: 'detailed', value: category});
                          setShowCOAAssignment(true);
                        }}
                        className={`px-3 py-2 cursor-pointer hover:bg-gray-50 flex justify-between items-center text-sm ${
                          selectedFilter?.value === category ? 'bg-blue-50 text-blue-700' : ''
                        }`}
                      >
                        <span>{category}</span>
                        <span className="text-xs text-gray-500">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* NEW: COA Assignment Bar */}
              {showCOAAssignment && selectedFilter && (
                <div className="p-4 bg-blue-50 border-b">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium">Assign COA to: {selectedFilter.value}</h4>
                      <p className="text-xs text-gray-600">{getFilteredTransactions().length} transactions</p>
                    </div>
                    <div className="flex gap-2">
                      <select 
                        value={selectedAccount}
                        onChange={(e) => setSelectedAccount(e.target.value)}
                        className="text-sm border rounded px-3 py-1"
                      >
                        <option value="">Select Account</option>
                        <optgroup label="Assets (1000)">
                          <option value="1010">1010 - Cash</option>
                          <option value="1020">1020 - Accounts Receivable</option>
                        </optgroup>
                        <optgroup label="Expenses (5000)">
                          <option value="5010">5010 - COGS</option>
                          <option value="5020">5020 - Meals</option>
                          <option value="5030">5030 - Office</option>
                        </optgroup>
                      </select>
                      <select 
                        value={selectedSubAccount}
                        onChange={(e) => setSelectedSubAccount(e.target.value)}
                        className="text-sm border rounded px-3 py-1"
                      >
                        <option value="">Sub Account</option>
                      </select>
                      <button 
                        onClick={applyBulkCOA}
                        className="px-4 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                      >
                        Apply to All
                      </button>
                      <button 
                        onClick={() => {
                          setSelectedFilter(null);
                          setShowCOAAssignment(false);
                        }}
                        className="px-3 py-1 border rounded text-sm"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Transactions Table */}
              <div className="w-full overflow-auto" style={{ maxHeight: '600px' }}>
                <table className="w-full text-xs" style={{ minWidth: '800px' }}>
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-2 py-2 text-left">Institution</th>
                      <th className="px-2 py-2 text-left">Account</th>
                      <th className="px-2 py-2 text-left">Date</th>
                      <th className="px-2 py-2 text-left">Name</th>
                      <th className="px-2 py-2 text-left">Merchant</th>
                      <th className="px-2 py-2 text-right">Amount</th>
                      <th className="px-2 py-2 text-left">Primary Category</th>
                      <th className="px-2 py-2 text-left">Detailed Category</th>
                      <th className="px-2 py-2 text-left">COA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(selectedFilter ? getFilteredTransactions() : transactions).map((txn) => (
                      <tr key={txn.id} className={`hover:bg-gray-50 ${
                        selectedFilter && getFilteredTransactions().includes(txn) ? 'bg-blue-50' : ''
                      }`}>
                        <td className="px-2 py-2">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${
                            getInstitution(txn.account) === 'Wells Fargo' 
                              ? 'bg-red-50 text-red-600' 
                              : 'bg-[#b4b237]/10 text-[#b4b237]'
                          }`}>
                            {getInstitution(txn.account)}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-xs text-gray-600">
                          {getAccountType(txn.account)}
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap">
                          {new Date(txn.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </td>
                        <td className="px-2 py-2">{txn.name}</td>
                        <td className="px-2 py-2">{txn.merchantName || '-'}</td>
                        <td className={`px-2 py-2 text-right font-medium whitespace-nowrap ${
                          txn.amount < 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          ${Math.abs(txn.amount).toFixed(2)}
                        </td>
                        <td className="px-2 py-2">
                          {txn.personal_finance_category?.primary || txn.category || 'Uncategorized'}
                        </td>
                        <td className="px-2 py-2 text-xs">
                          {txn.personal_finance_category?.detailed || '-'}
                        </td>
                        <td className="px-2 py-2">
                          <select className="text-xs border rounded px-1 py-0.5">
                            <option>Unassigned</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Investment Transactions Table */}
          {activeTab === 'investments' && (
            <div className="w-full overflow-auto" style={{ maxHeight: '600px' }}>
              <table className="w-full text-xs" style={{ minWidth: '600px' }}>
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-2 py-2 text-left">Date</th>
                    <th className="px-2 py-2 text-left">Description</th>
                    <th className="px-2 py-2 text-left">Type</th>
                    <th className="px-2 py-2 text-left">Subtype</th>
                    <th className="px-2 py-2 text-right">Qty</th>
                    <th className="px-2 py-2 text-right">Price</th>
                    <th className="px-2 py-2 text-right">Amount</th>
                    <th className="px-2 py-2 text-right">Fees</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {investmentTransactions.map((txn) => (
                    <tr key={txn.id || txn.investment_transaction_id} className="hover:bg-gray-50">
                      <td className="px-2 py-2 whitespace-nowrap">
                        {new Date(txn.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                      <td className="px-2 py-2 text-xs">{txn.name}</td>
                      <td className="px-2 py-2">{txn.type}</td>
                      <td className="px-2 py-2">{txn.subtype}</td>
                      <td className="px-2 py-2 text-right">{txn.quantity || '-'}</td>
                      <td className="px-2 py-2 text-right">${txn.price || 0}</td>
                      <td className={`px-2 py-2 text-right font-medium whitespace-nowrap ${
                        txn.amount < 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        ${Math.abs(txn.amount || 0).toFixed(2)}
                      </td>
                      <td className="px-2 py-2 text-right">${txn.fees || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
