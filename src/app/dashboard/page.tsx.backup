'use client';

import { useState, useEffect, useMemo } from 'react';
import { ImportDataSection } from '@/components/dashboard/ImportDataSection';

export default function Dashboard() {
  const [activeStep, setActiveStep] = useState(1);
  const [activeEntity, setActiveEntity] = useState<'personal' | 'business'>('personal');
  
  const pipelineSteps = [
    { id: 1, name: 'Import Data', description: 'Connect accounts & import transactions' },
    { id: 2, name: 'Chart of Accounts', description: 'Define account categories' },
    { id: 3, name: 'Journal Entries', description: 'Record transactions' },
    { id: 4, name: 'Post to Ledger', description: 'Update general ledger' },
    { id: 5, name: 'Reconciliation', description: 'Match bank statements' },
    { id: 6, name: 'Adjusting Entries', description: 'Period-end adjustments' },
    { id: 7, name: 'Financial Statements', description: 'Generate reports' },
    { id: 8, name: '3-Statement Analysis', description: 'Analyze performance' },
    { id: 9, name: 'Metrics & Projections', description: 'Forecast & KPIs' },
    { id: 10, name: 'Close Books', description: 'Period closing' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Temple Stuart Accounting</h1>
          <div className="mt-4 flex space-x-4">
            <button
              onClick={() => setActiveEntity('personal')}
              className={`px-4 py-2 rounded-lg font-medium ${
                activeEntity === 'personal' 
                  ? 'bg-[#b4b237] text-white' 
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              Personal
            </button>
            <button
              onClick={() => setActiveEntity('business')}
              className={`px-4 py-2 rounded-lg font-medium ${
                activeEntity === 'business' 
                  ? 'bg-[#b4b237] text-white' 
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              Business
            </button>
          </div>
        </div>

        <div className="flex gap-8">
          {/* Pipeline Sidebar */}
          <div className="w-64 flex-shrink-0">
            <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3">
              Accounting Pipeline
            </h2>
            <nav className="space-y-1">
              {pipelineSteps.map((step) => (
                <button
                  key={step.id}
                  onClick={() => setActiveStep(step.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                    activeStep === step.id
                      ? 'bg-[#b4b237] text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center">
                    <span className="text-sm font-medium">{step.id}. {step.name}</span>
                  </div>
                </button>
              ))}
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {activeStep === 1 && <ImportDataWithFilters entityId={activeEntity} />}
            {activeStep === 2 && <ChartOfAccountsSection entityId={activeEntity} />}
            {activeStep === 3 && <div>Journal Entries - Coming Soon</div>}
            {activeStep === 4 && <div>Post to Ledger - Coming Soon</div>}
            {activeStep === 5 && <div>Reconciliation - Coming Soon</div>}
            {activeStep === 6 && <div>Adjusting Entries - Coming Soon</div>}
            {activeStep === 7 && <div>Financial Statements - Coming Soon</div>}
            {activeStep === 8 && <div>3-Statement Analysis - Coming Soon</div>}
            {activeStep === 9 && <div>Metrics & Projections - Coming Soon</div>}
            {activeStep === 10 && <div>Close Books - Coming Soon</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

// Import Data with COA Filters
function ImportDataWithFilters({ entityId }: { entityId: string }) {
  const [selectedFilter, setSelectedFilter] = useState<{type: string, value: string} | null>(null);
  const [showCOAAssignment, setShowCOAAssignment] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<any[]>([]);
  
  // Load transactions on mount
  useEffect(() => {
    fetch('/api/transactions')
      .then(res => res.json())
      .then(data => {
        const txns = Array.isArray(data) ? data : [];
        setTransactions(txns);
        setFilteredTransactions(txns);
      });
  }, []);
  
  // Calculate unique filter values from real data
  const merchants = useMemo(() => {
    const merchantMap = new Map();
    transactions.forEach(t => {
      // Check multiple possible merchant field locations
      const merchant = t.merchantName || t.merchant_name || t.merchant?.name || t.name || 'Unknown';
      // Skip if it's just a generic transaction name
      if (merchant && merchant !== 'Unknown' && !merchant.startsWith('ACH ') && !merchant.startsWith('ATM ')) {
        merchantMap.set(merchant, (merchantMap.get(merchant) || 0) + 1);
      }
    });
    return Array.from(merchantMap.entries())
      .map(([name, count]) => ({name, count}))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }, [transactions]);
  
  const primaryCategories = useMemo(() => {
    const catMap = new Map();
    transactions.forEach(t => {
      const cat = t.personal_finance_category?.primary || t.category?.[0] || 'Uncategorized';
      catMap.set(cat, (catMap.get(cat) || 0) + 1);
    });
    return Array.from(catMap.entries())
      .map(([name, count]) => ({name, count}))
      .sort((a, b) => b.count - a.count);
  }, [transactions]);
  
  const detailedCategories = useMemo(() => {
    const catMap = new Map();
    transactions.forEach(t => {
      const cat = t.personal_finance_category?.detailed;
      if (cat) {
        catMap.set(cat, (catMap.get(cat) || 0) + 1);
      }
    });
    return Array.from(catMap.entries())
      .map(([name, count]) => ({name, count}))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }, [transactions]);
  
  // Filter transactions when filter selected
  useEffect(() => {
    if (!selectedFilter) {
      setFilteredTransactions(transactions);
      return;
    }
    
    const filtered = transactions.filter(t => {
      if (selectedFilter.type === 'merchant') {
        const merchant = t.merchantName || t.merchant_name || t.merchant?.name || t.name || 'Unknown';
        return merchant === selectedFilter.value;
      }
      if (selectedFilter.type === 'primary') {
        return (t.personal_finance_category?.primary || t.category?.[0] || 'Uncategorized') === selectedFilter.value;
      }
      if (selectedFilter.type === 'detailed') {
        return t.personal_finance_category?.detailed === selectedFilter.value;
      }
      return true;
    });
    
    setFilteredTransactions(filtered);
  }, [selectedFilter, transactions]);

  return (
    <div className="space-y-6">
      {/* Filter Lists */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-xs font-semibold text-gray-600 mb-3">MERCHANT</h3>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {merchants.map(merchant => (
              <div
                key={merchant.name}
                onClick={() => {
                  setSelectedFilter({type: 'merchant', value: merchant.name});
                  setShowCOAAssignment(true);
                }}
                className={`px-3 py-2 rounded cursor-pointer hover:bg-gray-50 flex justify-between ${
                  selectedFilter?.value === merchant.name ? 'bg-blue-50 text-blue-700' : ''
                }`}
              >
                <span className="text-sm">{merchant.name}</span>
                <span className="text-xs text-gray-500">{merchant.count}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-xs font-semibold text-gray-600 mb-3">PRIMARY CATEGORY</h3>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {primaryCategories.map(cat => (
              <div
                key={cat.name}
                onClick={() => {
                  setSelectedFilter({type: 'primary', value: cat.name});
                  setShowCOAAssignment(true);
                }}
                className={`px-3 py-2 rounded cursor-pointer hover:bg-gray-50 flex justify-between ${
                  selectedFilter?.value === cat.name ? 'bg-blue-50 text-blue-700' : ''
                }`}
              >
                <span className="text-sm">{cat.name}</span>
                <span className="text-xs text-gray-500">{cat.count}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-xs font-semibold text-gray-600 mb-3">DETAILED CATEGORY</h3>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {detailedCategories.map(cat => (
              <div
                key={cat.name}
                onClick={() => {
                  setSelectedFilter({type: 'detailed', value: cat.name});
                  setShowCOAAssignment(true);
                }}
                className={`px-3 py-2 rounded cursor-pointer hover:bg-gray-50 flex justify-between ${
                  selectedFilter?.value === cat.name ? 'bg-blue-50 text-blue-700' : ''
                }`}
              >
                <span className="text-sm">{cat.name}</span>
                <span className="text-xs text-gray-500">{cat.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* COA Assignment Bar */}
      {showCOAAssignment && (
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Assign COA to: {selectedFilter?.value}</h4>
              <p className="text-sm text-gray-600">Will apply to all matching transactions</p>
            </div>
            <div className="flex gap-2">
              <select className="px-3 py-2 border rounded-lg bg-white">
                <option>Select Account</option>
                <optgroup label="Assets (1000)">
                  <option value="1010">1010 - Cash</option>
                  <option value="1020">1020 - Accounts Receivable</option>
                </optgroup>
                <optgroup label="Liabilities (2000)">
                  <option value="2010">2010 - Accounts Payable</option>
                  <option value="2020">2020 - Credit Cards</option>
                </optgroup>
                <optgroup label="Equity (3000)">
                  <option value="3010">3010 - Owner's Equity</option>
                  <option value="3020">3020 - Retained Earnings</option>
                </optgroup>
                <optgroup label="Revenue (4000)">
                  <option value="4010">4010 - Sales Revenue</option>
                  <option value="4020">4020 - Service Revenue</option>
                </optgroup>
                <optgroup label="Expenses (5000)">
                  <option value="5010">5010 - Cost of Goods Sold</option>
                  <option value="5020">5020 - Meals & Entertainment</option>
                  <option value="5030">5030 - Office Supplies</option>
                  <option value="5040">5040 - Travel</option>
                  <option value="5050">5050 - Utilities</option>
                </optgroup>
              </select>
              <select className="px-3 py-2 border rounded-lg bg-white">
                <option>Sub Account (Optional)</option>
              </select>
              <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                Apply to All
              </button>
              <button 
                onClick={() => {
                  setSelectedFilter(null);
                  setShowCOAAssignment(false);
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Import existing ImportDataSection below */}
      <div className="bg-white rounded-lg shadow p-4 mt-4">
        <h3 className="text-sm font-semibold mb-2">
          {selectedFilter ? `Showing ${filteredTransactions.length} transactions for ${selectedFilter.value}` : 'All Transactions'}
        </h3>
        
        {/* Transaction Table with COA columns */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs table-fixed">
            <colgroup>
              <col className="w-20" /> {/* Institution */}
              <col className="w-16" /> {/* Account */}
              <col className="w-16" /> {/* Date */}
              <col className="w-36" /> {/* Name */}
              <col className="w-24" /> {/* Merchant */}
              <col className="w-20" /> {/* Amount */}
              <col className="w-24" /> {/* Primary Cat */}
              <col className="w-32" /> {/* Detailed Cat */}
              <col className="w-32" /> {/* Account Assignment */}
              <col className="w-28" /> {/* Sub Account */}
            </colgroup>
            <thead className="bg-gray-50">
              <tr>
                <th className="px-1 py-2 text-left">Institution</th>
                <th className="px-1 py-2 text-left">Account</th>
                <th className="px-1 py-2 text-left">Date</th>
                <th className="px-1 py-2 text-left">Name</th>
                <th className="px-1 py-2 text-left">Merchant</th>
                <th className="px-1 py-2 text-right">Amount</th>
                <th className="px-1 py-2 text-left">Primary</th>
                <th className="px-1 py-2 text-left">Detailed</th>
                <th className="px-1 py-2 text-left bg-blue-50">COA</th>
                <th className="px-1 py-2 text-left bg-blue-50">Sub</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((txn, idx) => (
                <tr key={txn.id || idx} className="border-b hover:bg-gray-50">
                  <td className="px-1 py-3 align-top">
                    <span className="px-1 py-0.5 rounded text-xs font-medium bg-red-50 text-red-600">
                      Wells
                    </span>
                  </td>
                  <td className="px-1 py-3 align-top">Checking</td>
                  <td className="px-1 py-3 align-top whitespace-nowrap">{new Date(txn.date).toLocaleDateString('en-US', {month: 'numeric', day: 'numeric'})}</td>
                  <td className="px-1 py-3 align-top">
                    <div className="break-words">{txn.name}</div>
                  </td>
                  <td className="px-1 py-3 align-top">
                    <div className="break-words">
                      {txn.merchantName || txn.merchant_name || '-'}
                    </div>
                  </td>
                  <td className={`px-1 py-3 align-top text-right font-medium whitespace-nowrap ${txn.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    ${Math.abs(txn.amount).toFixed(2)}
                  </td>
                  <td className="px-1 py-3 align-top">
                    <div className="break-words">
                      {txn.personal_finance_category?.primary || txn.category?.[0] || 'Uncategorized'}
                    </div>
                  </td>
                  <td className="px-1 py-3 align-top text-xs">
                    <div className="break-words">
                      {txn.personal_finance_category?.detailed || '-'}
                    </div>
                  </td>
                  <td className="px-1 py-2 align-top bg-blue-50">
                    <select 
                      className="w-full text-xs border rounded px-1 py-1"
                      defaultValue={txn.account_assignment || ''}
                      onChange={(e) => {
                        console.log('Assign account:', e.target.value, 'to transaction:', txn.id);
                      }}
                    >
                      <option value="">Select</option>
                      <optgroup label="Assets">
                        <option value="1010">1010-Cash</option>
                        <option value="1020">1020-A/R</option>
                      </optgroup>
                      <optgroup label="Liabilities">
                        <option value="2010">2010-A/P</option>
                        <option value="2020">2020-CC</option>
                      </optgroup>
                      <optgroup label="Revenue">
                        <option value="4010">4010-Sales</option>
                      </optgroup>
                      <optgroup label="Expenses">
                        <option value="5020">5020-Meals</option>
                        <option value="5030">5030-Office</option>
                        <option value="5040">5040-Travel</option>
                      </optgroup>
                    </select>
                  </td>
                  <td className="px-1 py-2 align-top bg-blue-50">
                    <select 
                      className="w-full text-xs border rounded px-1 py-1"
                      defaultValue={txn.sub_account || ''}
                      onChange={(e) => {
                        console.log('Assign sub:', e.target.value, 'to:', txn.id);
                      }}
                    >
                      <option value="">None</option>
                      <option value="Proj-A">Proj-A</option>
                      <option value="Proj-B">Proj-B</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Placeholder for Chart of Accounts
function ChartOfAccountsSection({ entityId }: { entityId: string }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Chart of Accounts</h2>
      <p className="text-gray-600">Configure your account structure...</p>
    </div>
  );
}
