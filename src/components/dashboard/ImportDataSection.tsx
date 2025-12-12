'use client';

import { useState, useEffect, useCallback } from 'react';
import Script from 'next/script';
import SpendingTab from './SpendingTab';
import InvestmentsTab from './InvestmentsTab';
import ThreeStatementSection from './ThreeStatementSection';

declare global {
  interface Window {
    Plaid: any;
  }
}

interface CoaOption {
  id: string;
  code: string;
  name: string;
  accountType: string;
  balanceType: string;
}

export function ImportDataSection({ entityId }: { entityId: string }) {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [committedTransactions, setCommittedTransactions] = useState<any[]>([]);
  const [investmentTransactions, setInvestmentTransactions] = useState<any[]>([]);
  const [committedInvestments, setCommittedInvestments] = useState<any[]>([]);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'spending' | 'investments'>('spending');
  const [coaOptions, setCoaOptions] = useState<CoaOption[]>([]);

  useEffect(() => {
    loadData();
    createLinkToken();
    loadChartOfAccounts();
  }, [entityId]);

  const loadChartOfAccounts = async () => {
    try {
      const res = await fetch('/api/chart-of-accounts');
      if (res.ok) {
        const data = await res.json();
        setCoaOptions(data.accounts || []);
      }
    } catch (error) {
      console.error('Error loading COA:', error);
    }
  };

  const updateEntityType = async (accountId: string, entityType: string) => {
    try {
      await fetch('/api/accounts/update-entity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, entityType })
      });
      setAccounts(accounts.map(acc =>
        acc.id === accountId ? {...acc, entityType} : acc
      ));
    } catch (error) {
      console.error('Error updating entity type:', error);
    }
  };

  const handleReassign = async (transactionIds: string[], newCoaCode: string, newSubAccount: string | null) => {
    try {
      const res = await fetch('/api/transactions/commit-to-ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionIds,
          accountCode: newCoaCode,
          subAccount: newSubAccount
        })
      });
      const result = await res.json();
      if (result.success) {
        await loadData();
      } else {
        throw new Error(result.error || 'Failed to reassign');
      }
    } catch (error) {
      console.error('Reassign error:', error);
      throw error;
    }
  };

  const syncAllAccounts = async () => {
    try {
      const itemsRes = await fetch('/api/plaid/items');
      const items = await itemsRes.json();
      for (const item of items) {
        await fetch('/api/plaid/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId: item.id })
        });
      }
      loadData();
    } catch (error) {
      console.error('Sync error:', error);
    }
  };

  const loadData = async () => {
    try {
      const res = await fetch('/api/accounts');
      if (res.ok) {
        const data = await res.json();
        let accountsList: any[] = [];
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
        let allTxns: any[] = [];
        if (data.transactions) {
          allTxns = data.transactions;
        } else if (Array.isArray(data)) {
          allTxns = data;
        }
        
        const committed = allTxns.filter((t: any) => t.accountCode);
        const uncommitted = allTxns.filter((t: any) => !t.accountCode);
        
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
        let investments: any[] = [];
        if (data.transactions) {
          investments = data.transactions;
        } else if (data.investments) {
          investments = data.investments;
        } else if (Array.isArray(data)) {
          investments = data;
        }
        const committedInv = investments.filter((t: any) => t.accountCode);
        const uncommittedInv = investments.filter((t: any) => !t.accountCode);
        setCommittedInvestments(committedInv);
        setInvestmentTransactions(uncommittedInv);
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


  const totalTransactions = transactions.length + committedTransactions.length + investmentTransactions.length + committedInvestments.length;
  const committedCount = committedTransactions.length + committedInvestments.length;
  const progressPercent = totalTransactions > 0 ? (committedCount / totalTransactions * 100) : 0;

  const getInstitution = (account: any) => {
    const name = account?.name?.toLowerCase() || '';
    const inst = account?.plaidItem?.institutionName || '';
    if (inst.toLowerCase().includes('wells') || name.includes('wells')) return 'Wells Fargo';
    if (inst.toLowerCase().includes('robinhood') || name.includes('robinhood')) return 'Robinhood';
    if (inst.toLowerCase().includes('relay') || name.includes('relay')) return 'Relay';
    if (inst.toLowerCase().includes('tasty') || name.includes('tasty')) return 'TastyTrade';
    return inst || 'Bank';
  };


  return (
    <>
      <Script src="https://cdn.plaid.com/link/v2/stable/link-initialize.js" strategy="lazyOnload" />
      
      <div className="space-y-4">

        {/* Connected Accounts */}
        <div className="bg-white border rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b flex justify-between items-center">
            <h3 className="text-sm font-semibold">Connected Accounts</h3>
            <div className="flex gap-2">
              {syncStatus && <span className="text-xs text-gray-500 mr-2">{syncStatus}</span>}
              <button onClick={syncCompleteData} disabled={loading}
                className="px-3 py-1.5 bg-[#b4b237] text-white rounded text-xs font-medium disabled:opacity-50">
                {loading ? 'Syncing...' : 'Sync'}
              </button>
              <button onClick={openPlaidLink} disabled={!linkToken}
                className="px-3 py-1.5 bg-[#b4b237] text-white rounded text-xs font-medium disabled:opacity-50">
                + Add
              </button>
            </div>
          </div>
          
          {accounts.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Institution</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Account</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Type</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Balance</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 w-32">Entity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {accounts.map((account: any) => (
                  <tr key={account.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        getInstitution(account) === 'Wells Fargo' ? 'bg-red-100 text-red-700' :
                        getInstitution(account) === 'Robinhood' ? 'bg-green-100 text-green-700' :
                        getInstitution(account) === 'Relay' ? 'bg-blue-100 text-blue-700' :
                        getInstitution(account) === 'TastyTrade' ? 'bg-purple-100 text-purple-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>{getInstitution(account)}</span>
                    </td>
                    <td className="px-3 py-2 font-medium">{account.name}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{account.type} • {account.subtype}</td>
                    <td className="px-3 py-2 text-right font-semibold">
                      ${(account.balance || account.currentBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={account.entityType || ''}
                        onChange={(e) => updateEntityType(account.id, e.target.value)}
                        className="w-full border rounded px-2 py-1 text-xs bg-white"
                      >
                        <option value="">-</option>
                        <option value="personal">Personal</option>
                        <option value="business">Business</option>
                        <option value="trading">Trading</option>
                        <option value="retirement">Retirement</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-6 text-center text-gray-500 text-sm">
              No accounts connected. Click "+ Add" to link your bank.
            </div>
          )}
        </div>

        {/* Spending / Investments Tabs */}
        <div className="bg-white border rounded-lg overflow-hidden">
          <div className="flex border-b">
            <button 
              onClick={() => setActiveTab('spending')} 
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'spending' 
                  ? 'bg-white border-b-2 border-[#b4b237] text-[#b4b237]' 
                  : 'bg-gray-50 text-gray-600 hover:text-gray-900'
              }`}
            >
              Spending
              <span className="ml-2 text-xs text-gray-400">
                {transactions.length} pending • {committedTransactions.length} done
              </span>
            </button>
            <button 
              onClick={() => setActiveTab('investments')} 
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'investments' 
                  ? 'bg-white border-b-2 border-[#b4b237] text-[#b4b237]' 
                  : 'bg-gray-50 text-gray-600 hover:text-gray-900'
              }`}
            >
              Investments
              <span className="ml-2 text-xs text-gray-400">
                {investmentTransactions.length} pending • {committedInvestments.length} done
              </span>
            </button>
          </div>

          <div className="p-4">
            {activeTab === 'spending' && (
              <SpendingTab
                transactions={transactions}
                committedTransactions={committedTransactions}
                coaOptions={coaOptions}
                onReload={loadData}
              />
            )}

            {activeTab === 'investments' && (
              <InvestmentsTab
                investmentTransactions={investmentTransactions}
                committedInvestments={committedInvestments}
                onReload={loadData}
              />
            )}
          </div>
        </div>

        {/* 3-Statement Model */}
        <ThreeStatementSection
          committedTransactions={committedTransactions}
          coaOptions={coaOptions}
          onReassign={handleReassign}
        />
      </div>
    </>
  );
}
