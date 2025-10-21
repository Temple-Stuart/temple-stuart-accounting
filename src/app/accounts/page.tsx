'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
interface Account {
id: string;
name: string;
institution: string;
type: string;
subtype: string;
balance: number;
lastSync: string;
entityType?: string;
}
interface Transaction {
id: string;
date: string;
description: string;
amount: number;
category: string;
accountId: string;
}
export default function AccountsPage() {
const [accounts, setAccounts] = useState<Account[]>([]);
const [transactions, setTransactions] = useState<Transaction[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState('');
const router = useRouter();
useEffect(() => {
fetchAccountsAndTransactions();
}, []);
const fetchAccountsAndTransactions = async () => {
try {
const accountsRes = await fetch('/api/accounts');
if (!accountsRes.ok) {
if (accountsRes.status === 401) {
router.push('/login');
return;
}
throw new Error('Failed to fetch accounts');
}
const accountsData = await accountsRes.json();
  let allAccounts: Account[] = [];
  
  if (Array.isArray(accountsData)) {
    allAccounts = accountsData.map((account: any) => ({
      id: account.id,
      name: account.name,
      institution: account.plaidItem?.institutionName || 'Bank',
      type: account.type,
      subtype: account.subtype,
      balance: account.currentBalance || account.balance || 0,
      lastSync: new Date().toISOString(),
      entityType: account.entityType
    }));
  } else if (accountsData.items) {
    allAccounts = accountsData.items.flatMap((item: any) => 
      item.accounts?.map((account: any) => ({
        id: account.id,
        name: account.name,
        institution: item.institutionName,
        type: account.type,
        subtype: account.subtype,
        balance: account.balance,
        lastSync: new Date().toISOString(),
        entityType: account.entityType
      })) || []
    );
  }
  
  setAccounts(allAccounts);

  const transactionsRes = await fetch('/api/transactions');
  if (transactionsRes.ok) {
    const transactionsData = await transactionsRes.json();
    setTransactions(transactionsData);
  }
} catch (err) {
  setError('Failed to load data');
  console.error(err);
} finally {
  setLoading(false);
}
};
const updateEntityType = async (accountId: string, entityType: string) => {
try {
const res = await fetch('/api/accounts/update-entity', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ accountId, entityType })
});
  if (res.ok) {
    setAccounts(accounts.map(acc => 
      acc.id === accountId ? { ...acc, entityType } : acc
    ));
  }
} catch (err) {
  console.error('Failed to update entity type:', err);
}
};
return (
<div className="min-h-screen bg-gray-50">
<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
<h1 className="text-3xl font-bold text-gray-900 mb-8">Accounts</h1>
    {loading && <div>Loading...</div>}
    {error && <div className="text-red-600">{error}</div>}
    
    {!loading && !error && (
      <>
        <div className="grid gap-6 mb-8">
          {accounts.map(account => (
            <div key={account.id} className="bg-white p-6 rounded-lg shadow">
              <div className="flex justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-medium">{account.name}</h3>
                  <p className="text-sm text-gray-500">{account.institution}</p>
                  <div className="mt-2">
                    <label className="text-xs text-gray-500 block mb-1">Entity Type:</label>
                    <select
                      value={account.entityType || ''}
                      onChange={(e) => updateEntityType(account.id, e.target.value)}
                      className="border rounded px-3 py-1 text-sm"
                    >
                      <option value="">Not Set</option>
                      <option value="personal">Personal</option>
                      <option value="business">Business</option>
                      <option value="trading">Trading</option>
                      <option value="retirement">Retirement</option>
                    </select>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">${account.balance.toFixed(2)}</p>
                  <p className="text-sm text-gray-500">{account.type}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b">
            <h2 className="text-xl font-semibold">Recent Transactions</h2>
          </div>
          <div className="divide-y">
            {transactions.slice(0, 10).map((transaction: any) => (
              <div key={transaction.id} className="px-6 py-4">
                <div className="flex justify-between">
                  <div>
                    <p className="font-medium">{transaction.name || transaction.description}</p>
                    <p className="text-sm text-gray-500">{transaction.category}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-medium ${transaction.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      ${Math.abs(transaction.amount).toFixed(2)}
                    </p>
                    <p className="text-sm text-gray-500">{new Date(transaction.date).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </>
    )}
  </div>
</div>
);
}
