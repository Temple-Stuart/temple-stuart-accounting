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
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  
  // Monthly budgets by category (hardcoded for now, will be user-editable later)
  const [budgets] = useState<Record<string, number>>({
    'FOOD_AND_DRINK': 800,
    'TRANSPORTATION': 300,
    'RENT_AND_UTILITIES': 2000,
    'GENERAL_MERCHANDISE': 500,
    'GENERAL_SERVICES': 200,
    'ENTERTAINMENT': 300,
    'PERSONAL_CARE': 150,
  });

  // Calculate current month/year totals
  const now = new Date();

  // Filter by entity if selected
  const entityFilteredTransactions = selectedEntity
    ? transactions.filter(t => {
        if (selectedEntity === 'Personal') return t.accountCode?.startsWith('P-');
        if (selectedEntity === 'Business') return t.accountCode?.startsWith('B-');
        if (selectedEntity === 'Trading') return t.accountCode?.startsWith('T-');
        return true;
      })
    : transactions;
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const thisMonthTransactions = entityFilteredTransactions.filter(t => {
    const txnDate = new Date(t.date);
    return txnDate.getMonth() === currentMonth && txnDate.getFullYear() === currentYear;
  });

  const thisYearTransactions = entityFilteredTransactions.filter(t => {
    const txnDate = new Date(t.date);
    return txnDate.getFullYear() === currentYear;
  });

  const thisMonthTotal = thisMonthTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const thisYearTotal = thisYearTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

  // Group by category
  const categoryTotals = entityFilteredTransactions.reduce((acc, t) => {
    const category = t.personal_finance_category?.primary || 'Uncategorized';
    acc[category] = (acc[category] || 0) + Math.abs(t.amount);
    return acc;
  }, {} as Record<string, number>);

  const sortedCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // Group by merchant
  const merchantTotals = entityFilteredTransactions.reduce((acc, t) => {
    const merchant = t.merchantName || t.name || 'Unknown';
    acc[merchant] = (acc[merchant] || 0) + Math.abs(t.amount);
    return acc;
  }, {} as Record<string, number>);

  const sortedMerchants = Object.entries(merchantTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);


  // Monthly spending trends (last 6 months)
  const monthlyTrends: { month: string; total: number; count: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const date = new Date(currentYear, currentMonth - i, 1);
    const monthTransactions = entityFilteredTransactions.filter(t => {
      const txnDate = new Date(t.date);
      return txnDate.getMonth() === date.getMonth() && txnDate.getFullYear() === date.getFullYear();
    });
    const total = monthTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    monthlyTrends.push({
      month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      total,
      count: monthTransactions.length
    });
  }

  const generateAIInsights = async () => {
    setLoadingInsights(true);
    try {
      const response = await fetch("/api/ai/spending-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          thisMonthTotal,
          thisYearTotal,
          thisMonthCount: thisMonthTransactions.length,
          categories: sortedCategories,
          merchants: sortedMerchants,
          trends: monthlyTrends,
          entity: selectedEntity
        })
      });
      const data = await response.json();
      setAiInsights(data.insights);
    } catch (error) {
      console.error("Error generating AI insights:", error);
      setAiInsights("Unable to generate insights at this time.");
    }
    setLoadingInsights(false);
  };
  // Filter transactions
  const filteredTransactions = entityFilteredTransactions.filter(t => {
    if (selectedCategory && t.personal_finance_category?.primary !== selectedCategory) return false;
    if (selectedMerchant && (t.merchantName || t.name) !== selectedMerchant) return false;
    return true;
  });

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold">Spending Dashboard</h2>

      {/* Entity Filter */}
      <div className="flex gap-2">
        <button
          onClick={() => setSelectedEntity(null)}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            selectedEntity === null
              ? 'bg-[#b4b237] text-white'
              : 'bg-white text-gray-700 border hover:bg-gray-50'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setSelectedEntity('Personal')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            selectedEntity === 'Personal'
              ? 'bg-[#b4b237] text-white'
              : 'bg-white text-gray-700 border hover:bg-gray-50'
          }`}
        >
          Personal
        </button>
        <button
          onClick={() => setSelectedEntity('Business')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            selectedEntity === 'Business'
              ? 'bg-[#b4b237] text-white'
              : 'bg-white text-gray-700 border hover:bg-gray-50'
          }`}
        >
          Business
        </button>
        <button
          onClick={() => setSelectedEntity('Trading')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            selectedEntity === 'Trading'
              ? 'bg-[#b4b237] text-white'
              : 'bg-white text-gray-700 border hover:bg-gray-50'
          }`}
        >
          Trading
        </button>
      </div>

      {/* AI Insights Button */}
      <button
        onClick={generateAIInsights}
        disabled={loadingInsights}
        className="px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
      >
        {loadingInsights ? "Analyzing..." : "🤖 Get AI Insights"}
      </button>

      {/* AI Insights Display */}
      {aiInsights && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <div className="text-3xl">🤖</div>
            <div>
              <h3 className="text-lg font-semibold text-purple-900 mb-2">AI Financial Insights</h3>
              <p className="text-gray-700 leading-relaxed">{aiInsights}</p>
            </div>
          </div>
        </div>
      )}

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


      {/* Monthly Spending Trend */}
      <div className="bg-white border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Spending Trend (Last 6 Months)</h3>
        <div className="relative h-64">
          {monthlyTrends.length > 0 && (
            <div className="flex items-end justify-between h-full gap-2">
              {monthlyTrends.map((month, idx) => {
                const maxAmount = Math.max(...monthlyTrends.map(m => m.total));
                const heightPercent = maxAmount > 0 ? (month.total / maxAmount) * 100 : 0;
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full flex flex-col items-center">
                      <span className="text-xs font-semibold text-gray-700 mb-1">
                        ${month.total.toFixed(0)}
                      </span>
                      <div
                        className="w-full bg-blue-500 rounded-t transition-all hover:bg-blue-600"
                        style={{ height: `${heightPercent}%` }}
                        title={`${month.month}: $${month.total.toFixed(2)} (${month.count} transactions)`}
                      />
                    </div>
                    <span className="text-xs text-gray-600 text-center">{month.month}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {/* Spending by Category */}
      <div className="bg-white border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Top Categories (with Budgets)</h3>
        <div className="space-y-3">
          {sortedCategories.map(([category, amount]) => {
            const budget = budgets[category];
            const budgetPercent = budget ? (amount / budget) * 100 : 0;
            const barColor = budgetPercent >= 100 ? 'bg-red-500' : budgetPercent >= 70 ? 'bg-yellow-500' : 'bg-green-500';
            
            return (
              <div key={category} className="space-y-1">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setSelectedCategory(selectedCategory === category ? null : category)}
                    className={`text-left ${selectedCategory === category ? 'text-blue-600 font-semibold' : 'text-gray-700'}`}
                  >
                    {category}
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">${amount.toFixed(2)}</span>
                    {budget && (
                      <span className={`text-xs font-medium ${budgetPercent >= 100 ? 'text-red-600' : budgetPercent >= 70 ? 'text-yellow-600' : 'text-green-600'}`}>
                        {budgetPercent.toFixed(0)}% of ${budget}
                      </span>
                    )}
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`${barColor} h-3 rounded-full transition-all`}
                    style={{ width: `${Math.min(budgetPercent, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
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
