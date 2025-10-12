'use client';

import { useEffect, useState } from 'react';

interface Statements {
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

export default function StatementsPage() {
  const [statements, setStatements] = useState<Statements | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/statements')
      .then(res => res.json())
      .then(data => {
        setStatements(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const formatMoney = (cents: number) => {
    return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  };

  if (loading) return <div className="p-8">Loading statements...</div>;
  if (!statements) return <div className="p-8">Error loading statements</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Financial Statements</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="border rounded-lg p-6">
          <h2 className="text-2xl font-semibold mb-6">Income Statement</h2>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span>Revenue</span>
              <span className="font-semibold text-green-600">{formatMoney(statements.incomeStatement.revenue)}</span>
            </div>
            <div className="flex justify-between">
              <span>Expenses</span>
              <span className="font-semibold text-red-600">{formatMoney(statements.incomeStatement.expenses)}</span>
            </div>
            <div className="border-t pt-4 flex justify-between text-lg">
              <span className="font-bold">Net Income</span>
              <span className={`font-bold ${statements.incomeStatement.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatMoney(statements.incomeStatement.netIncome)}
              </span>
            </div>
          </div>
        </div>

        <div className="border rounded-lg p-6">
          <h2 className="text-2xl font-semibold mb-6">Balance Sheet</h2>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span>Assets</span>
              <span className="font-semibold">{formatMoney(statements.balanceSheet.assets)}</span>
            </div>
            <div className="flex justify-between">
              <span>Liabilities</span>
              <span className="font-semibold">{formatMoney(statements.balanceSheet.liabilities)}</span>
            </div>
            <div className="flex justify-between">
              <span>Equity</span>
              <span className="font-semibold">{formatMoney(statements.balanceSheet.equity)}</span>
            </div>
            <div className="border-t pt-4">
              <div className="text-sm text-gray-600">
                Balance Check: Assets = {formatMoney(statements.balanceSheet.assets)}
              </div>
              <div className="text-sm text-gray-600">
                Liabilities + Equity = {formatMoney(statements.balanceSheet.liabilities + statements.balanceSheet.equity)}
              </div>
              <div className={`text-sm font-semibold ${
                statements.balanceSheet.assets === statements.balanceSheet.liabilities + statements.balanceSheet.equity 
                  ? 'text-green-600' 
                  : 'text-red-600'
              }`}>
                {statements.balanceSheet.assets === statements.balanceSheet.liabilities + statements.balanceSheet.equity 
                  ? '✓ Books balanced' 
                  : '⚠ Books not balanced'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
