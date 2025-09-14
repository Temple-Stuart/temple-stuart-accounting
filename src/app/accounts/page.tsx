'use client';

import { useState, useEffect } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import TimeframeFilter from './TimeframeFilter';

// Import the transaction interface
interface Transaction {
  account_id: string;
  transaction_id: string;
  amount: number;
  date: string;
  name: string;
  merchant_name?: string;
  category?: string[];
  pending: boolean;
  institution_name?: string;
}

interface Account {
  id: string;
  name: string;
  type: string;
  subtype: string;
  balance: number;
}

interface PlaidItem {
  id: string;
  institutionName: string;
  accounts: Account[];
}

type TabType = 'connect' | 'transactions' | 'chart' | 'reconcile' | 'reports' | 'taxes';

interface WorkflowStep {
  id: TabType;
  number: string;
  title: string;
  description: string;
  icon: string;
  status: 'complete' | 'current' | 'upcoming';
}

export default function AccountsPage() {
  const [plaidItems, setPlaidItems] = useState<PlaidItem[]>([]);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('connect');
  
  // Transaction-specific state
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [sortField, setSortField] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [filterText, setFilterText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null);
  const [customCategories, setCustomCategories] = useState<{[key: string]: string}>({});
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  
  // Standard accounting categories for dropdown
  const accountingCategories = [
    'Advertising & Marketing',
    'Bank Fees',
    'Car & Truck Expenses',
    'Contractors',
    'Cost of Goods Sold',
    'Dues & Subscriptions',
    'Equipment',
    'Insurance',
    'Interest Paid',
    'Legal & Professional Fees',
    'Meals & Entertainment',
    'Office Expenses',
    'Other Business Expenses',
    'Payroll',
    'Rent or Lease',
    'Repairs & Maintenance',
    'Supplies',
    'Taxes & Licenses',
    'Travel',
    'Utilities',
    'Income - Sales',
    'Income - Services',
    'Income - Other',
    'Owner Draw',
    'Owner Contribution'
  ];

  // Workflow steps that match your essential bookkeeping services
  const workflowSteps: WorkflowStep[] = [
    {
      id: 'connect',
      number: '1',
      title: 'Connect Accounts',
      description: 'Link all bank accounts & credit cards',
      icon: '🏦',
      status: plaidItems.length > 0 ? 'complete' : 'current'
    },
    {
      id: 'transactions',
      number: '2',
      title: 'Review Transactions',
      description: 'Import & review all transactions',
      icon: '📊',
      status: plaidItems.length > 0 ? 'current' : 'upcoming'
    },
    {
      id: 'chart',
      number: '3',
      title: 'Chart of Accounts',
      description: 'Categorize expenses & income',
      icon: '📈',
      status: 'upcoming'
    },
    {
      id: 'reconcile',
      number: '4',
      title: 'Bank Reconciliation',
      description: 'Match records with bank statements',
      icon: '✅',
      status: 'upcoming'
    },
    {
      id: 'reports',
      number: '5',
      title: 'Financial Reports',
      description: 'P&L, Balance Sheet, Cash Flow',
      icon: '📑',
      status: 'upcoming'
    },
    {
      id: 'taxes',
      number: '6',
      title: 'Tax Preparation',
      description: 'Organize for tax filing',
      icon: '🧾',
      status: 'upcoming'
    }
  ];

  // Derive unique categories and vendors from transactions
  const categories = Array.from(new Set(
    transactions.flatMap(t => t.category || [])
  )).sort();

  const vendors = Array.from(new Set(
    transactions
      .map(t => t.merchant_name || t.name)
      .filter(Boolean)
  )).sort();

  const syncAllTransactions = async (months = 24) => {
    setSyncing(true);
    try {
      const response = await fetch("/api/transactions/sync", {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ months }),
      });
      const result = await response.json();
      if (result.success) {
        alert(`Successfully synced ${result.totalSynced} transactions from the last ${months} months!`);
        await fetchTransactions();
      } else {
        alert(`Error: ${result.error || 'Failed to sync'}`);
      }
    } catch (error) {
      console.error("Sync error:", error);
      alert("Failed to sync transactions");
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchLinkToken();
    fetchAccounts();
  }, []);

  useEffect(() => {
    if (activeTab === 'transactions' && transactions.length === 0) {
      fetchTransactions();
    }
  }, [activeTab]);

  const fetchLinkToken = async () => {
    try {
      const response = await fetch('/api/plaid/link-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await response.json();
      setLinkToken(data.link_token);
    } catch (error) {
      console.error('Error fetching link token:', error);
    }
  };

  const fetchAccounts = async () => {
    try {
      const response = await fetch('/api/accounts');
      const data = await response.json();
      setPlaidItems(data.plaidItems || []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    setTransactionsLoading(true);
    try {
      const response = await fetch('/api/transactions');
      if (response.ok) {
        const data = await response.json();
        if (data.transactions && Array.isArray(data.transactions)) {
          setTransactions(data.transactions);
        }
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setTransactionsLoading(false);
    }
  };

  const onSuccess = async (public_token: string, metadata: any) => {
    try {
      await fetch('/api/plaid/exchange-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_token, metadata }),
      });
      await fetchAccounts();
    } catch (error) {
      console.error('Error exchanging token:', error);
    }
  };

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
    onExit: (err) => {
      if (err) console.error('Plaid Link exited with error:', err);
    },
    onEvent: (eventName, metadata) => {
      console.log('Plaid event:', eventName, metadata);
    },
  });

  // Transaction helper functions
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
    
    let filtered = data;
    
    if (filterText) {
      filtered = filtered.filter(item => {
        const searchStr = JSON.stringify(item).toLowerCase();
        return searchStr.includes(filterText.toLowerCase());
      });
    }
    
    if (selectedCategory) {
      filtered = filtered.filter(item => 
        item.category && item.category.includes(selectedCategory)
      );
    }
    
    if (selectedVendor) {
      filtered = filtered.filter(item => 
        (item.merchant_name === selectedVendor) || (item.name === selectedVendor)
      );
    }
    
    return filtered;
  };

  const getCategoryCount = (category: string) => {
    return transactions.filter(t => 
      t.category && t.category.includes(category)
    ).length;
  };

  const getVendorCount = (vendor: string) => {
    return transactions.filter(t => 
      (t.merchant_name === vendor) || (t.name === vendor)
    ).length;
  };

  const getVendorTotal = (vendor: string) => {
    return transactions
      .filter(t => (t.merchant_name === vendor) || (t.name === vendor))
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  };

  const displayData = sortData(filterData(transactions));

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50/30 via-white to-amber-50/20 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your financial dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/30 via-white to-amber-50/20">
      <div className="flex h-screen">
        {/* Left Sidebar - Workflow Steps */}
        <div className="w-80 bg-white shadow-xl border-r border-gray-200 overflow-y-auto">
          <div className="p-6">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-amber-500 bg-clip-text text-transparent mb-2">
              Financial Dashboard
            </h2>
            <p className="text-sm text-gray-600 mb-6">Complete bookkeeping workflow</p>
            
            {/* Progress indicator */}
            <div className="mb-6 p-4 bg-purple-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-purple-700">Overall Progress</span>
                <span className="text-sm text-purple-600">
                  {workflowSteps.filter(s => s.status === 'complete').length}/{workflowSteps.length}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-purple-600 to-amber-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${(workflowSteps.filter(s => s.status === 'complete').length / workflowSteps.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Workflow Steps as Tabs */}
            <div className="space-y-2">
              {workflowSteps.map((step) => (
                <button
                  key={step.id}
                  onClick={() => setActiveTab(step.id)}
                  className={`w-full text-left p-4 rounded-lg transition-all duration-300 ${
                    activeTab === step.id
                      ? 'bg-gradient-to-r from-purple-600 to-amber-500 text-white shadow-lg'
                      : step.status === 'complete'
                      ? 'bg-green-50 hover:bg-green-100 text-gray-700'
                      : step.status === 'upcoming'
                      ? 'bg-gray-50 hover:bg-gray-100 text-gray-400'
                      : 'bg-white hover:bg-purple-50 text-gray-700 border border-purple-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      activeTab === step.id
                        ? 'bg-white/20'
                        : step.status === 'complete'
                        ? 'bg-green-500 text-white'
                        : step.status === 'upcoming'
                        ? 'bg-gray-300 text-gray-500'
                        : 'bg-purple-100 text-purple-600'
                    }`}>
                      {step.status === 'complete' ? '✓' : step.number}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{step.icon}</span>
                        <h3 className="font-semibold">{step.title}</h3>
                      </div>
                      <p className={`text-xs mt-1 ${
                        activeTab === step.id ? 'text-white/80' : 'text-gray-500'
                      }`}>
                        {step.description}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-8">
            {/* Connect Accounts Tab */}
            {activeTab === 'connect' && (
              <div>
                <div className="mb-8">
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    Step 1: Connect Your Accounts
                  </h1>
                  <p className="text-gray-600">
                    Link all your business bank accounts and credit cards to get started with automated bookkeeping.
                  </p>
                </div>

                <div className="mb-6">
                  <button
                    onClick={() => open()}
                    disabled={!ready || loading}
                    className="px-6 py-3 bg-gradient-to-r from-purple-600 to-amber-500 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg"
                  >
                    {loading ? 'Loading...' : '+ Connect New Bank Account'}
                  </button>
                </div>

                {plaidItems.length === 0 ? (
                  <div className="bg-white rounded-lg shadow-lg p-12 text-center border border-purple-200">
                    <div className="text-6xl mb-4">🏦</div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">No accounts connected yet</h3>
                    <p className="text-gray-500">Connect your first bank account to begin automated bookkeeping</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {plaidItems.map((item) => (
                      <div key={item.id} className="bg-white rounded-lg shadow-lg p-6 border border-purple-200">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="text-xl font-semibold text-purple-700">{item.institutionName}</h3>
                            <p className="text-sm text-gray-500">Connected accounts: {item.accounts.length}</p>
                          </div>
                          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
                            Connected
                          </span>
                        </div>
                        <div className="space-y-2">
                          {item.accounts.map((account) => (
                            <div key={account.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                              <div>
                                <p className="font-medium text-gray-700">{account.name}</p>
                                <p className="text-sm text-gray-500">{account.type} - {account.subtype}</p>
                              </div>
                              <p className="font-bold text-lg text-purple-600">
                                ${account.balance?.toFixed(2) || '0.00'}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Transactions Tab */}
            {activeTab === 'transactions' && (
              <div>
                <div className="mb-8">
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    Step 2: Review Transactions
                  </h1>
                  <p className="text-gray-600">
                    Review all imported transactions and prepare them for categorization.
                  </p>
                </div>

                {/* Add TimeframeFilter here */}
                <TimeframeFilter onSync={syncAllTransactions} syncing={syncing} />

                {transactionsLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
                    <p>Loading transactions...</p>
                  </div>
                ) : (
                  <div className="flex gap-6">
                    {/* Categories & Vendors Sidebar */}
                    <div className="w-80 space-y-6">
                      {/* Categories */}
                      <div className="bg-white rounded-lg shadow-lg p-4 border border-purple-200">
                        <div className="flex justify-between items-center mb-4">
                          <h2 className="text-lg font-bold text-purple-600">Categories</h2>
                          {selectedCategory && (
                            <button
                              onClick={() => setSelectedCategory(null)}
                              className="text-xs text-gray-500 hover:text-purple-600"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                        <div className="max-h-64 overflow-y-auto space-y-1">
                          {categories.length > 0 ? (
                            categories.map(category => (
                              <button
                                key={category}
                                onClick={() => setSelectedCategory(
                                  selectedCategory === category ? null : category
                                )}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm flex justify-between items-center transition-colors ${
                                  selectedCategory === category
                                    ? 'bg-purple-100 text-purple-700 font-semibold'
                                    : 'hover:bg-gray-50'
                                }`}
                              >
                                <span className="truncate">{category}</span>
                                <span className="text-xs text-gray-500 ml-2">
                                  {getCategoryCount(category)}
                                </span>
                              </button>
                            ))
                          ) : (
                            <p className="text-sm text-gray-500">No categories found</p>
                          )}
                        </div>
                      </div>

                      {/* Vendors */}
                      <div className="bg-white rounded-lg shadow-lg p-4 border border-amber-500">
                        <div className="flex justify-between items-center mb-4">
                          <h2 className="text-lg font-bold text-amber-600">Vendors</h2>
                          {selectedVendor && (
                            <button
                              onClick={() => setSelectedVendor(null)}
                              className="text-xs text-gray-500 hover:text-amber-600"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                        <div className="max-h-96 overflow-y-auto space-y-1">
                          {vendors.length > 0 ? (
                            vendors.slice(0, 20).map(vendor => (
                              <button
                                key={vendor}
                                onClick={() => setSelectedVendor(
                                  selectedVendor === vendor ? null : vendor
                                )}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                                  selectedVendor === vendor
                                    ? 'bg-amber-100 text-amber-700 font-semibold'
                                    : 'hover:bg-gray-50'
                                }`}
                              >
                                <div className="flex justify-between items-start">
                                  <span className="truncate flex-1">{vendor}</span>
                                  <div className="text-right ml-2">
                                    <div className="text-xs text-gray-500">
                                      {getVendorCount(vendor)} txns
                                    </div>
                                    <div className="text-xs font-semibold">
                                      ${getVendorTotal(vendor).toFixed(2)}
                                    </div>
                                  </div>
                                </div>
                              </button>
                            ))
                          ) : (
                            <p className="text-sm text-gray-500">No vendors found</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Transactions Table */}
                    <div className="flex-1">
                      {/* Search */}
                      <div className="mb-4">
                        <input
                          type="text"
                          placeholder="Search transactions..."
                          value={filterText}
                          onChange={(e) => setFilterText(e.target.value)}
                          className="px-4 py-2 border border-purple-200 rounded-lg w-full max-w-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="bg-white rounded-lg p-4 border border-purple-200">
                          <div className="text-sm font-semibold text-purple-600">Transactions</div>
                          <div className="text-2xl font-bold">{displayData.length}</div>
                          <div className="text-xs text-gray-500">of {transactions.length} total</div>
                        </div>
                        <div className="bg-white rounded-lg p-4 border border-purple-200">
                          <div className="text-sm font-semibold text-purple-600">Total Amount</div>
                          <div className="text-2xl font-bold">
                            ${displayData.reduce((sum, t) => sum + Math.abs(t.amount), 0).toFixed(2)}
                          </div>
                        </div>
                        <div className="bg-white rounded-lg p-4 border border-purple-200">
                          <div className="text-sm font-semibold text-purple-600">Pending</div>
                          <div className="text-2xl font-bold">
                            {displayData.filter(t => t.pending).length}
                          </div>
                        </div>
                      </div>

                      {/* Table */}
                      <div className="bg-white rounded-lg shadow-xl overflow-hidden">
                        <div className="overflow-x-auto">
                          {displayData.length > 0 ? (
                            <table className="w-full">
                              <thead className="bg-gradient-to-r from-purple-600 to-amber-500 text-white">
                                <tr>
                                  <th 
                                    className="px-4 py-3 text-left cursor-pointer hover:bg-purple-700"
                                    onClick={() => handleSort('date')}
                                  >
                                    Date {sortField === 'date' && (sortDirection === 'asc' ? '↑' : '↓')}
                                  </th>
                                  <th className="px-4 py-3 text-left">Description</th>
                                  <th className="px-4 py-3 text-left">Plaid Category</th>
                                  <th 
                                    className="px-4 py-3 text-left cursor-pointer hover:bg-purple-700"
                                    onClick={() => handleSort('amount')}
                                  >
                                    Amount {sortField === 'amount' && (sortDirection === 'asc' ? '↑' : '↓')}
                                  </th>
                                  <th className="px-4 py-3 text-left">Status</th>
                                  <th className="px-4 py-3 text-left">Chart of Accounts</th>
                                </tr>
                              </thead>
                              <tbody>
                                {displayData.slice(0, 50).map((transaction, index) => (
                                  <tr key={transaction.transaction_id} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                    <td className="px-4 py-3 text-sm">
                                      {new Date(transaction.date).toLocaleDateString()}
                                    </td>
                                    <td className="px-4 py-3">
                                      <div>
                                        <p className="font-semibold">{transaction.name}</p>
                                        {transaction.merchant_name && (
                                          <p className="text-xs text-gray-500">{transaction.merchant_name}</p>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3">
                                      {transaction.personal_finance_category && (
                                        <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">
                                          {transaction.personal_finance_category?.detailed || transaction.personal_finance_category?.primary || "Uncategorized"}
                                        </span>
                                      )}
                                    </td>
                                    <td className={`px-4 py-3 font-bold ${
                                      transaction.amount < 0 ? 'text-green-600' : 'text-red-600'
                                    }`}>
                                      ${Math.abs(transaction.amount).toFixed(2)}
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                        transaction.pending 
                                          ? 'bg-yellow-100 text-yellow-700' 
                                          : 'bg-green-100 text-green-700'
                                      }`}>
                                        {transaction.pending ? 'Pending' : 'Posted'}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-2">
                                        {editingCategory === transaction.transaction_id ? (
                                          <>
                                            <select
                                              className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                                              value={customCategories[transaction.transaction_id] || ''}
                                              onChange={(e) => {
                                                setCustomCategories({
                                                  ...customCategories,
                                                  [transaction.transaction_id]: e.target.value
                                                });
                                              }}
                                            >
                                              <option value="">Select category</option>
                                              {accountingCategories.map(cat => (
                                                <option key={cat} value={cat}>{cat}</option>
                                              ))}
                                            </select>
                                            <button
                                              onClick={() => setEditingCategory(null)}
                                              className="text-green-600 hover:text-green-700"
                                            >
                                              ✓
                                            </button>
                                          </>
                                        ) : (
                                          <button
                                            onClick={() => setEditingCategory(transaction.transaction_id)}
                                            className="text-left hover:bg-gray-100 px-2 py-1 rounded text-sm w-full"
                                          >
                                            {customCategories[transaction.transaction_id] || 
                                             (transaction.category?.[0] && (
                                               <span className="text-gray-500 italic">
                                                 {transaction.personal_finance_category?.detailed || transaction.personal_finance_category?.primary || "Uncategorized"}
                                               </span>
                                             )) || 
                                             <span className="text-gray-400">Click to assign</span>
                                            }
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <div className="text-center py-8 text-gray-500">
                              {transactions.length === 0 
                                ? "No transactions found. Click one of the sync buttons above to import your transaction history."
                                : "No transactions match the current filters."}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Chart of Accounts Tab */}
            {activeTab === 'chart' && (
              <div>
                <div className="mb-8">
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    Step 3: Chart of Accounts
                  </h1>
                  <p className="text-gray-600">
                    Categorize your transactions for accurate financial reporting.
                  </p>
                </div>
                <div className="bg-white rounded-lg shadow-lg p-12 text-center border border-purple-200">
                  <div className="text-6xl mb-4">📈</div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">Chart of Accounts Setup</h3>
                  <p className="text-gray-500 mb-6">Categorization tools coming soon</p>
                  <p className="text-sm text-amber-600 font-semibold">Under Development</p>
                </div>
              </div>
            )}

            {/* Bank Reconciliation Tab */}
            {activeTab === 'reconcile' && (
              <div>
                <div className="mb-8">
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    Step 4: Bank Reconciliation
                  </h1>
                  <p className="text-gray-600">
                    Match your records with bank statements to ensure accuracy.
                  </p>
                </div>
                <div className="bg-white rounded-lg shadow-lg p-12 text-center border border-purple-200">
                  <div className="text-6xl mb-4">✅</div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">Reconciliation Tools</h3>
                  <p className="text-gray-500 mb-6">Automated matching and discrepancy detection</p>
                  <p className="text-sm text-amber-600 font-semibold">Coming Soon</p>
                </div>
              </div>
            )}

            {/* Financial Reports Tab */}
            {activeTab === 'reports' && (
              <div>
                <div className="mb-8">
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    Step 5: Financial Reports
                  </h1>
                  <p className="text-gray-600">
                    Generate P&L statements, balance sheets, and cash flow reports.
                  </p>
                </div>
                <div className="bg-white rounded-lg shadow-lg p-12 text-center border border-purple-200">
                  <div className="text-6xl mb-4">📑</div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">Financial Reporting</h3>
                  <p className="text-gray-500 mb-6">Real-time financial statements and analytics</p>
                  <p className="text-sm text-amber-600 font-semibold">Coming Soon</p>
                </div>
              </div>
            )}

            {/* Tax Preparation Tab */}
            {activeTab === 'taxes' && (
              <div>
                <div className="mb-8">
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    Step 6: Tax Preparation
                  </h1>
                  <p className="text-gray-600">
                    Organize all financial data for seamless tax filing.
                  </p>
                </div>
                <div className="bg-white rounded-lg shadow-lg p-12 text-center border border-purple-200">
                  <div className="text-6xl mb-4">🧾</div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">Tax Organization</h3>
                  <p className="text-gray-500 mb-6">Export-ready reports for your CPA</p>
                  <p className="text-sm text-amber-600 font-semibold">Coming Soon</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
