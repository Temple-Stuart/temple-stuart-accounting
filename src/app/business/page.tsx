'use client';

import { useState, useEffect } from 'react';
import { AppLayout, Card, Button } from '@/components/ui';

interface BusinessBudget {
  budgetData: Record<string, Record<number, number>>;
  actualData: Record<string, Record<number, number>>;
  coaNames: Record<string, string>;
  budgetGrandTotal: number;
  actualGrandTotal: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function BusinessPage() {
  const [budget, setBudget] = useState<BusinessBudget | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => { loadBudget(); }, [selectedYear]);

  const loadBudget = async () => {
    try {
      const res = await fetch(`/api/hub/business-budget?year=${selectedYear}`);
      if (res.ok) {
        const data = await res.json();
        setBudget(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);

  if (loading) return <AppLayout><div className="p-8 flex justify-center"><div className="w-8 h-8 border-4 border-[#b4b237] border-t-transparent rounded-full animate-spin" /></div></AppLayout>;

  const hasAccounts = budget && Object.keys(budget.coaNames).length > 0;

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">💼 Business</h1>
            <p className="text-gray-600">Business expenses tracked on personal cards</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setSelectedYear(y => y - 1)} className="px-3 py-1 border rounded hover:bg-gray-50">←</button>
            <span className="font-medium">{selectedYear}</span>
            <button onClick={() => setSelectedYear(y => y + 1)} className="px-3 py-1 border rounded hover:bg-gray-50">→</button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="text-sm text-gray-500">Budget</div>
            <div className="text-2xl font-bold text-indigo-600">{fmt(budget?.budgetGrandTotal || 0)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-500">Actual</div>
            <div className="text-2xl font-bold text-gray-900">{fmt(budget?.actualGrandTotal || 0)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-500">Variance</div>
            <div className={`text-2xl font-bold ${(budget?.budgetGrandTotal || 0) >= (budget?.actualGrandTotal || 0) ? 'text-emerald-600' : 'text-red-600'}`}>
              {fmt((budget?.budgetGrandTotal || 0) - (budget?.actualGrandTotal || 0))}
            </div>
          </Card>
        </div>

        {/* Accounts Table */}
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50">
            <h2 className="font-semibold">Business Accounts</h2>
          </div>
          {hasAccounts ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left py-2 px-4">Account</th>
                    <th className="text-right py-2 px-4">Budget</th>
                    <th className="text-right py-2 px-4">Actual</th>
                    <th className="text-right py-2 px-4">Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(budget?.coaNames || {}).map(([code, name]) => {
                    const budgetTotal = Object.values(budget?.budgetData[code] || {}).reduce((s, v) => s + v, 0);
                    const actualTotal = Object.values(budget?.actualData[code] || {}).reduce((s, v) => s + v, 0);
                    const variance = budgetTotal - actualTotal;
                    
                    if (budgetTotal === 0 && actualTotal === 0) return null;
                    
                    return (
                      <tr key={code} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-4">
                          <div className="font-medium">{name}</div>
                          <div className="text-xs text-gray-400">{code}</div>
                        </td>
                        <td className="text-right py-2 px-4 text-indigo-600">{fmt(budgetTotal)}</td>
                        <td className="text-right py-2 px-4">{fmt(actualTotal)}</td>
                        <td className={`text-right py-2 px-4 ${variance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {fmt(variance)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-indigo-50 font-bold">
                    <td className="py-2 px-4">Total</td>
                    <td className="text-right py-2 px-4 text-indigo-600">{fmt(budget?.budgetGrandTotal || 0)}</td>
                    <td className="text-right py-2 px-4">{fmt(budget?.actualGrandTotal || 0)}</td>
                    <td className={`text-right py-2 px-4 ${(budget?.budgetGrandTotal || 0) >= (budget?.actualGrandTotal || 0) ? 'text-emerald-600' : 'text-red-600'}`}>
                      {fmt((budget?.budgetGrandTotal || 0) - (budget?.actualGrandTotal || 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">
              <div className="text-4xl mb-3">💼</div>
              <p className="font-medium">No business accounts yet</p>
              <p className="text-sm text-gray-400 mt-1">Map transactions to B-xxxx accounts in the Chart of Accounts to track business expenses</p>
            </div>
          )}
        </Card>

        {/* Info */}
        <Card className="p-4 bg-indigo-50 border-indigo-200">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <div>
              <h3 className="font-medium text-indigo-900">How it works</h3>
              <p className="text-sm text-indigo-700 mt-1">
                Business expenses paid on personal cards are tracked here. Map transactions to B-xxxx accounts 
                (like B-6100 Software) and they'll appear in this budget. The Hub calculator includes these 
                costs in your total projected spend.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
