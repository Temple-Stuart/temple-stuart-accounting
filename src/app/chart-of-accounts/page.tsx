'use client';

import { useEffect, useState } from 'react';

interface Account {
  code: string;
  name: string;
  accountType: string;
  balanceType: string;
  settledBalance: string;
  entityType: string;
}

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/chart-of-accounts/balances')
      .then(res => res.json())
      .then(data => {
        setAccounts(data.accounts || []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const personal = accounts.filter(a => a.entityType === 'personal');
  const business = accounts.filter(a => a.entityType === 'business');

  const formatBalance = (cents: string) => {
    const amount = parseInt(cents) / 100;
    return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  };

  if (loading) return <div className="p-8">Loading accounts...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Chart of Accounts</h1>

      <div className="mb-12">
        <h2 className="text-2xl font-semibold mb-4 text-purple-600">Personal Accounts</h2>
        <table className="w-full border">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-left">Code</th>
              <th className="p-3 text-left">Account Name</th>
              <th className="p-3 text-left">Type</th>
              <th className="p-3 text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {personal.map(acc => (
              <tr key={acc.code} className="border-t">
                <td className="p-3 font-mono">{acc.code}</td>
                <td className="p-3">{acc.name}</td>
                <td className="p-3">{acc.accountType}</td>
                <td className="p-3 text-right font-semibold">{formatBalance(acc.settledBalance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="text-2xl font-semibold mb-4 text-blue-600">Business Accounts</h2>
        <table className="w-full border">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-left">Code</th>
              <th className="p-3 text-left">Account Name</th>
              <th className="p-3 text-left">Type</th>
              <th className="p-3 text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {business.map(acc => (
              <tr key={acc.code} className="border-t">
                <td className="p-3 font-mono">{acc.code}</td>
                <td className="p-3">{acc.name}</td>
                <td className="p-3">{acc.accountType}</td>
                <td className="p-3 text-right font-semibold">{formatBalance(acc.settledBalance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
