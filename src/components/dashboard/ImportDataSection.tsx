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
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('');

  useEffect(() => {
    loadAccounts();
    createLinkToken();
  }, [entityId]);

  const loadAccounts = async () => {
    try {
      const res = await fetch('/api/accounts');
      if (res.ok) {
        const data = await res.json();
        // API returns { items: [...] } with nested accounts
        const allAccounts: any[] = [];
        (data.items || []).forEach((item: any) => {
          (item.accounts || []).forEach((acc: any) => {
            allAccounts.push({
              ...acc,
              plaid_items: { institutionName: item.institutionName }
            });
          });
        });
        setAccounts(allAccounts);
      }
    } catch (error) {
      console.error('Error loading accounts:', error);
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
      setSyncStatus('Syncing...');
      const itemsRes = await fetch('/api/plaid/items');
      const items = await itemsRes.json();
      for (const item of items) {
        await fetch('/api/plaid/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId: item.id })
        });
      }
      await loadAccounts();
      setSyncStatus('Done!');
      setTimeout(() => setSyncStatus(''), 2000);
    } catch (error) {
      console.error('Error syncing:', error);
      setSyncStatus('Error');
    }
  };

  const createLinkToken = async () => {
    try {
      const res = await fetch('/api/plaid/link-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityId })
      });
      const data = await res.json();
      if (data.link_token) {
        setLinkToken(data.link_token);
      }
    } catch (error) {
      console.error('Error creating link token:', error);
    }
  };

  const openPlaidLink = useCallback(() => {
    if (!linkToken || !window.Plaid) return;
    
    const handler = window.Plaid.create({
      token: linkToken,
      onSuccess: async (publicToken: string, metadata: any) => {
        setLoading(true);
        try {
          await fetch('/api/plaid/exchange-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              publicToken, 
              institutionId: metadata.institution?.institution_id,
              institutionName: metadata.institution?.name,
              entityId
            })
          });
          await loadAccounts();
          await createLinkToken();
        } catch (error) {
          console.error('Error exchanging token:', error);
        }
        setLoading(false);
      },
      onExit: (err: any) => {
        if (err) console.error('Plaid Link error:', err);
      }
    });
    handler.open();
  }, [linkToken, entityId]);

  return (
    <>
      <Script 
        src="https://cdn.plaid.com/link/v2/stable/link-initialize.js"
        strategy="lazyOnload"
      />
      
      <div className="p-4">
        {/* Header with actions */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={openPlaidLink}
              disabled={!linkToken || loading}
              className="px-3 py-1.5 bg-[#2d1b4e] text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {loading ? '...' : '+ Add Account'}
            </button>
            <button
              onClick={syncAllAccounts}
              className="px-3 py-1.5 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
            >
              🔄 Sync
            </button>
            {syncStatus && (
              <span className="text-xs text-gray-500">{syncStatus}</span>
            )}
          </div>
        </div>

        {/* Accounts Table */}
        {accounts.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Account</th>
                <th className="px-3 py-2 text-left font-medium">Type</th>
                <th className="px-3 py-2 text-left font-medium">Entity</th>
                <th className="px-3 py-2 text-right font-medium">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {accounts.map(account => (
                <tr key={account.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <div>
                      <span className="font-medium">{account.name}</span>
                      {account.plaid_items?.institutionName && (
                        <span className="text-xs text-gray-400 ml-2">
                          {account.plaid_items.institutionName}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400">
                      •••{account.mask || '----'}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-gray-600">{account.type}</td>
                  <td className="px-3 py-2">
                    <select
                      value={account.entityType || 'personal'}
                      onChange={(e) => updateEntityType(account.id, e.target.value)}
                      className="text-xs border rounded px-2 py-1"
                    >
                      <option value="personal">Personal</option>
                      <option value="business">Business</option>
                      <option value="trading">Trading</option>
                    </select>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    ${(account.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="py-6 text-center text-gray-500 text-sm">
            No accounts connected. Click "+ Add Account" to link your bank.
          </div>
        )}
      </div>
    </>
  );
}
