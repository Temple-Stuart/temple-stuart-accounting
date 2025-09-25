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

  return (
    <>
      <Script
        src="https://cdn.plaid.com/link/v2/stable/link-initialize.js"
        strategy="lazyOnload"
      />
      
      <div className="space-y-6">
        {/* Connected Accounts */}
        <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg">
          <div className="px-4 sm:px-6 py-4 border-b">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <h3 className="text-lg font-medium">Connected Accounts</h3>
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  onClick={syncCompleteData}
                  disabled={loading || accounts.length === 0}
                  className="flex-1 sm:flex-none px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-500 disabled:opacity-50 text-sm"
                >
                  {loading ? 'Syncing...' : 'Sync All Data'}
                </button>
                <button
                  onClick={openPlaidLink}
                  disabled={!linkToken}
                  className="flex-1 sm:flex-none px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 text-sm"
                >
                  + Connect
                </button>
              </div>
            </div>
          </div>
          <div className="p-4 sm:p-6">
            {syncStatus && (
              <div className="mb-4 p-3 bg-blue-50 text-blue-700 rounded-lg text-sm">
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
        <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg overflow-hidden">
          <div className="border-b">
            <div className="flex">
              <button
                onClick={() => setActiveTab('spending')}
                className={`px-4 sm:px-6 py-3 font-medium whitespace-nowrap ${
                  activeTab === 'spending'
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-600'
                }`}
              >
                Spending ({transactions.length})
              </button>
              <button
                onClick={() => setActiveTab('investments')}
                className={`px-4 sm:px-6 py-3 font-medium whitespace-nowrap ${
                  activeTab === 'investments'
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-600'
                }`}
              >
                Investments ({investmentTransactions.length})
              </button>
            </div>
          </div>

          {/* Spending Transactions Table with proper scroll */}
          {activeTab === 'spending' && (
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
                    <th className="px-2 py-2 text-left">Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {transactions.map((txn) => (
                    <tr key={txn.id} className="hover:bg-gray-50">
                      <td className="px-2 py-2">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${
                          getInstitution(txn.account) === 'Wells Fargo' 
                            ? 'bg-red-100 text-red-800' 
                            : 'bg-green-100 text-green-800'
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
                      <td className="px-2 py-2 text-xs">
                        {txn.location ? `${txn.location.city || ''} ${txn.location.region || ''}`.trim() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Investment Transactions Table with proper scroll */}
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
