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
        // The API returns { accounts, availableYears } — derive summary if needed
        if (statements.incomeStatement && statements.balanceSheet) {
          setData(statements);
        } else if (statements.accounts) {
          // Derive financial summary from ledger account rows
          let revenue = 0, expenses = 0, assets = 0, liabilities = 0, equity = 0;
          for (const acct of statements.accounts) {
            const net = ((acct.debits || 0) - (acct.credits || 0)) / 100;
            const type = acct.accountType?.toLowerCase();
            if (type === 'revenue') revenue += Math.abs(net);
            else if (type === 'expense') expenses += Math.abs(net);
            else if (type === 'asset') assets += Math.abs(net);
            else if (type === 'liability') liabilities += Math.abs(net);
            else if (type === 'equity') equity += Math.abs(net);
          }
          setData({
            incomeStatement: { revenue, expenses, netIncome: revenue - expenses },
            balanceSheet: { assets, liabilities, equity },
          });
        }
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
    return <div className="p-8 text-center text-brand-red">Failed to load statements</div>;
  }

  const isBalanced = Math.abs(
    data.balanceSheet.assets - (data.balanceSheet.liabilities + data.balanceSheet.equity)
  ) < 0.01;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-bold">Financial Statements</h2>
        <button 
          onClick={loadStatements}
          className="px-4 py-2 bg-brand-purple text-white rounded text-sm"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Income Statement */}
        <div className="bg-white border rounded p-6">
          <h3 className="text-sm font-semibold mb-6">Income Statement</h3>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-text-secondary">Revenue</span>
              <span className="text-terminal-lg font-semibold text-brand-green">
                ${data.incomeStatement.revenue.toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-text-secondary">Expenses</span>
              <span className="text-terminal-lg font-semibold text-brand-red">
                ${data.incomeStatement.expenses.toFixed(2)}
              </span>
            </div>

            <div className="border-t pt-4 mt-4">
              <div className="flex justify-between items-center">
                <span className="text-terminal-lg font-bold">Net Income</span>
                <span className={`text-sm font-bold ${
                  data.incomeStatement.netIncome >= 0 ? 'text-brand-green' : 'text-brand-red'
                }`}>
                  ${data.incomeStatement.netIncome.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Balance Sheet */}
        <div className="bg-white border rounded p-6">
          <h3 className="text-sm font-semibold mb-6">Balance Sheet</h3>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-text-secondary">Assets</span>
              <span className="text-terminal-lg font-semibold">
                ${data.balanceSheet.assets.toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-text-secondary">Liabilities</span>
              <span className="text-terminal-lg font-semibold">
                ${data.balanceSheet.liabilities.toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-text-secondary">Equity</span>
              <span className="text-terminal-lg font-semibold">
                ${data.balanceSheet.equity.toFixed(2)}
              </span>
            </div>

            <div className="border-t pt-4 mt-4">
              <div className="text-sm text-text-secondary space-y-1">
                <div>Balance Check: Assets = ${data.balanceSheet.assets.toFixed(2)}</div>
                <div>Liabilities + Equity = ${(data.balanceSheet.liabilities + data.balanceSheet.equity).toFixed(2)}</div>
                <div className={`font-semibold ${isBalanced ? 'text-brand-green' : 'text-brand-red'}`}>
                  {isBalanced ? '✓ Books balanced' : '⚠ Books not balanced'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="bg-white border rounded p-6">
        <h3 className="text-terminal-lg font-semibold mb-4">Quick Ratios</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="border rounded p-4 text-center">
            <div className="text-sm text-text-secondary mb-1">Profit Margin</div>
            <div className="text-sm font-bold">
              {data.incomeStatement.revenue > 0 
                ? ((data.incomeStatement.netIncome / data.incomeStatement.revenue) * 100).toFixed(1)
                : '0.0'
              }%
            </div>
          </div>
          
          <div className="border rounded p-4 text-center">
            <div className="text-sm text-text-secondary mb-1">Current Ratio</div>
            <div className="text-sm font-bold">
              {data.balanceSheet.liabilities !== 0
                ? (data.balanceSheet.assets / Math.abs(data.balanceSheet.liabilities)).toFixed(2)
                : 'N/A'
              }
            </div>
          </div>
          
          <div className="border rounded p-4 text-center">
            <div className="text-sm text-text-secondary mb-1">ROE</div>
            <div className="text-sm font-bold">
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
