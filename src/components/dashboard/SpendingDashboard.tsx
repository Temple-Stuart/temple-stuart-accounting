'use client';

import { useState, useEffect } from 'react';

interface Transaction {
  id: string;
  date: string;
  merchantName: string;
  name: string;
  amount: number;
  accountCode: string;
  subAccount: string | null;
  personal_finance_category: {
    primary: string;
    detailed: string;
  } | null;
}

interface SpendingDashboardProps {
  transactions: Transaction[];
  coaOptions: any[];
}

export default function SpendingDashboard({ transactions, coaOptions }: SpendingDashboardProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedMerchant, setSelectedMerchant] = useState<string | null>(null);

  // Calculate current month/year totals
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const thisMonthTransactions = transactions.filter(t => {
    const txnDate = new Date(t.date);
    return txnDate.getMonth() === currentMonth && txnDate.getFullYear() === currentYear;
  });

  const thisYearTransactions = transactions.filter(t => {
    const txnDate = new Date(t.date);
    return txnDate.getFullYear() === currentYear;
  });

  const thisMonthTotal = thisMonthTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const thisYearTotal = thisYearTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

  // Group by category
  const categoryTotals = transactions.reduce((acc, t) => {
    const category = t.personal_finance_category?.primary || 'Uncategorized';
    acc[category] = (acc[category] || 0) + Math.abs(t.amount);
    return acc;
  }, {} as Record<string, number>);

  const sortedCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // Group by merchant
  const merchantTotals = transactions.reduce((acc, t) => {
    const merchant = t.merchantName || t.name || 'Unknown';
    acc[merchant] = (acc[merchant] || 0) + Math.abs(t.amount);
    return acc;
  }, {} as Record<string, number>);

  const sortedMerchants = Object.entries(merchantTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // Filter transactions
  const filteredTransactions = transactions.filter(t => {
    if (selectedCategory && t.personal_finance_category?.primary !== selectedCategory) return false;
    if (selectedMerchant && (t.merchantName || t.name) !== selectedMerchant) return false;
    return true;
  });

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold">Spending Dashboard</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-6 bg-white border rounded-lg">
          <div className="text-sm text-gray-600">This Month</div>
          <div className="text-3xl font-bold">${thisMonthTotal.toFixed(2)}</div>
          <div className="text-xs text-gray-500">{thisMonthTransactions.length} transactions</div>
        </div>
        <div className="p-6 bg-white border rounded-lg">
          <div className="text-sm text-gray-600">This Year</div>
          <div className="text-3xl font-bold">${thisYearTotal.toFixed(2)}</div>
          <div className="text-xs text-gray-500">{thisYearTransactions.length} transactions</div>
        </div>
      </div>

      {/* Spending by Category */}
      <div className="bg-white border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Top Categories</h3>
        <div className="space-y-2">
          {sortedCategories.map(([category, amount]) => (
            <div key={category} className="flex items-center justify-between">
              <button
                onClick={() => setSelectedCategory(selectedCategory === category ? null : category)}
                className={`text-left flex-1 ${selectedCategory === category ? 'text-blue-600 font-semibold' : 'text-gray-700'}`}
              >
                {category}
              </button>
              <div className="flex items-center gap-4">
                <div className="w-48 bg-gray-200 rounded-full h-4">
                  <div
                    className="bg-blue-600 h-4 rounded-full"
                    style={{ width: `${(amount / sortedCategories[0][1]) * 100}%` }}
                  />
                </div>
                <span className="font-semibold w-24 text-right">${amount.toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Merchants */}
      <div className="bg-white border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Top Merchants</h3>
        <div className="space-y-2">
          {sortedMerchants.map(([merchant, amount]) => (
            <div key={merchant} className="flex items-center justify-between">
              <button
                onClick={() => setSelectedMerchant(selectedMerchant === merchant ? null : merchant)}
                className={`text-left flex-1 ${selectedMerchant === merchant ? 'text-blue-600 font-semibold' : 'text-gray-700'}`}
              >
                {merchant}
              </button>
              <span className="font-semibold">${amount.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Transaction List */}
      <div className="bg-white border rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">
            Transactions {selectedCategory || selectedMerchant ? '(Filtered)' : ''}
          </h3>
          {(selectedCategory || selectedMerchant) && (
            <button
              onClick={() => {
                setSelectedCategory(null);
                setSelectedMerchant(null);
              }}
              className="text-sm text-blue-600"
            >
              Clear Filters
            </button>
          )}
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left">Date</th>
              <th className="px-4 py-2 text-left">Merchant</th>
              <th className="px-4 py-2 text-left">Category</th>
              <th className="px-4 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredTransactions.slice(0, 50).map(txn => (
              <tr key={txn.id} className="hover:bg-gray-50">
                <td className="px-4 py-2">{new Date(txn.date).toLocaleDateString()}</td>
                <td className="px-4 py-2">{txn.merchantName || txn.name}</td>
                <td className="px-4 py-2 text-xs">{txn.personal_finance_category?.primary || '-'}</td>
                <td className="px-4 py-2 text-right font-medium">${Math.abs(txn.amount).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
