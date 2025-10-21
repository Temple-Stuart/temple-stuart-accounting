'use client';

import { useState, useEffect, useCallback } from 'react';
import Script from 'next/script';
import SpendingTab from './SpendingTab';
import InvestmentsTab from './InvestmentsTab';

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
  
  // Reload data after sync
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

  const totalTransactions = transactions.length + committedTransactions.length + investmentTransactions.filter((txn: any) => new Date(txn.date) >= new Date("2025-06-10")).length + committedInvestments.length;
  const progressPercent = totalTransactions > 0 ? (committedTransactions.length / totalTransactions * 100) : 0;

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
{accounts.map((account: any) => (
<div key={account.id} className="border rounded-lg p-3 mb-4">
<div className="flex justify-between mb-2">
<div>
<h4 className="font-medium">{account.name}</h4>
<p className="text-sm text-gray-500">{account.type} • {account.subtype}</p>
</div>
<p className="text-xl font-semibold">
${(account.balance || account.currentBalance || 0).toFixed(2)}
</p>
</div>
<div className="mt-2">
<label className="text-xs text-gray-600 block mb-1">Entity Type:</label>
<select
value={account.entityType || ''}
onChange={(e) => updateEntityType(account.id, e.target.value)}
className="border rounded px-2 py-1 text-sm w-full"
>
<option value="">Not Set</option>
<option value="personal">Personal</option>
<option value="business">Business</option>
<option value="trading">Trading</option>
<option value="retirement">Retirement</option>
</select>
</div>
</div>
))}
            <button onClick={() => setActiveTab('investments')} 
              className={`px-6 py-3 font-medium ${activeTab === 'investments' ? 'border-b-2 border-[#b4b237] text-[#b4b237]' : 'text-gray-600'}`}>
              Investments ({investmentTransactions.filter((txn: any) => new Date(txn.date) >= new Date("2025-06-10")).length} uncommitted, {committedInvestments.length} committed)
            </button>
          </div>

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
    </>
  );
}
