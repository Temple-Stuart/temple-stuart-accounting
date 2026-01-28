'use client';

import { useState, useEffect } from 'react';

interface FinancialData {
  incomeStatement: {
    revenue: number;
    expenses: number;
    netIncome: number;
  };
  balanceSheet: {
    assets: number;
    liabilities: number;
    equity: number;
  };
}

export default function FinancialStatementsTab() {
  const [data, setData] = useState<FinancialData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStatements();
  }, []);

  const loadStatements = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/statements');
      if (res.ok) {
        const statements = await res.json();
        setData(statements);
      }
    } catch (error) {
      console.error('Error loading statements:', error);
    }
    setLoading(false);
  };

  if (loading) {
    return <div className="p-8 text-center">Loading statements...</div>;
  }

  if (!data) {
    return <div className="p-8 text-center text-red-600">Failed to load statements</div>;
  }

  const isBalanced = Math.abs(
    data.balanceSheet.assets - (data.balanceSheet.liabilities + data.balanceSheet.equity)
  ) < 0.01;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Financial Statements</h2>
        <button 
          onClick={loadStatements}
          className="px-4 py-2 bg-[#2d1b4e] text-white rounded-lg text-sm"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Income Statement */}
        <div className="bg-white border rounded-xl p-6">
          <h3 className="text-xl font-semibold mb-6">Income Statement</h3>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-700">Revenue</span>
              <span className="text-lg font-semibold text-green-600">
                ${data.incomeStatement.revenue.toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-700">Expenses</span>
              <span className="text-lg font-semibold text-red-600">
                ${data.incomeStatement.expenses.toFixed(2)}
              </span>
            </div>

            <div className="border-t pt-4 mt-4">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold">Net Income</span>
                <span className={`text-2xl font-bold ${
                  data.incomeStatement.netIncome >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  ${data.incomeStatement.netIncome.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Balance Sheet */}
        <div className="bg-white border rounded-xl p-6">
          <h3 className="text-xl font-semibold mb-6">Balance Sheet</h3>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-700">Assets</span>
              <span className="text-lg font-semibold">
                ${data.balanceSheet.assets.toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-700">Liabilities</span>
              <span className="text-lg font-semibold">
                ${data.balanceSheet.liabilities.toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-700">Equity</span>
              <span className="text-lg font-semibold">
                ${data.balanceSheet.equity.toFixed(2)}
              </span>
            </div>

            <div className="border-t pt-4 mt-4">
              <div className="text-sm text-gray-600 space-y-1">
                <div>Balance Check: Assets = ${data.balanceSheet.assets.toFixed(2)}</div>
                <div>Liabilities + Equity = ${(data.balanceSheet.liabilities + data.balanceSheet.equity).toFixed(2)}</div>
                <div className={`font-semibold ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                  {isBalanced ? '✓ Books balanced' : '⚠ Books not balanced'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="bg-white border rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">Quick Ratios</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="border rounded-lg p-4 text-center">
            <div className="text-sm text-gray-600 mb-1">Profit Margin</div>
            <div className="text-2xl font-bold">
              {data.incomeStatement.revenue > 0 
                ? ((data.incomeStatement.netIncome / data.incomeStatement.revenue) * 100).toFixed(1)
                : '0.0'
              }%
            </div>
          </div>
          
          <div className="border rounded-lg p-4 text-center">
            <div className="text-sm text-gray-600 mb-1">Current Ratio</div>
            <div className="text-2xl font-bold">
              {data.balanceSheet.liabilities !== 0
                ? (data.balanceSheet.assets / Math.abs(data.balanceSheet.liabilities)).toFixed(2)
                : 'N/A'
              }
            </div>
          </div>
          
          <div className="border rounded-lg p-4 text-center">
            <div className="text-sm text-gray-600 mb-1">ROE</div>
            <div className="text-2xl font-bold">
              {data.balanceSheet.equity !== 0
                ? ((data.incomeStatement.netIncome / data.balanceSheet.equity) * 100).toFixed(1)
                : '0.0'
              }%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
