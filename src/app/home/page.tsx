'use client';

import { useState, useEffect } from 'react';
import { AppLayout, Card } from '@/components/ui';

interface HomeSummary {
  totalMonthly: number;
  totalAllTime: number;
  monthCount: number;
  transactionCount: number;
}

interface HomeByCode {
  code: string;
  name: string;
  total: number;
  count: number;
  monthlyAvg: number;
}

interface HomeData {
  summary: HomeSummary;
  byCode: HomeByCode[];
  byMonth: Array<{ month: string; total: number; breakdown: Record<string, number> }>;
  recentTransactions: Array<{ id: string; date: string; name: string; amount: number; accountCode: string }>;
}

export default function HomePage() {
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/home')
      .then(res => res.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatMonth = (month: string) => {
    const [year, m] = month.split('-');
    const date = new Date(parseInt(year), parseInt(m) - 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="p-8 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-[#b4b237] border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <span className="text-4xl">🏠</span>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Home</h1>
            <p className="text-gray-500">What it costs to have a residence</p>
          </div>
        </div>

        {/* Key Insight Card */}
        <Card className="p-6 mb-8 bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-orange-600 font-medium mb-1">Monthly Cost of Home</div>
              <div className="text-4xl font-bold text-orange-700">
                {formatCurrency(data?.summary.totalMonthly || 0)}
              </div>
              <div className="text-sm text-orange-600 mt-1">
                This is your baseline to beat as a digital nomad
              </div>
            </div>
            <div className="text-6xl opacity-50">🏡</div>
          </div>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {data?.byCode.map(item => (
            <Card key={item.code} className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-gray-500">{item.name}</div>
                <div className="text-xs text-gray-400">{item.code}</div>
              </div>
              <div className="text-2xl font-bold text-gray-900 mb-1">
                {formatCurrency(item.monthlyAvg)}<span className="text-sm font-normal text-gray-400">/mo</span>
              </div>
              <div className="text-xs text-gray-400">
                {formatCurrency(item.total)} total • {item.count} transactions
              </div>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly History */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Monthly History</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {data?.byMonth.map(month => (
                <div key={month.month} className="py-3 border-b border-gray-100">
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-medium text-gray-900">{formatMonth(month.month)}</div>
                    <div className="font-bold text-gray-900">{formatCurrency(month.total)}</div>
                  </div>
                  <div className="flex gap-4 text-xs text-gray-400">
                    {Object.entries(month.breakdown).map(([code, amount]) => (
                      <span key={code}>{code}: {formatCurrency(amount)}</span>
                    ))}
                  </div>
                </div>
              ))}
              {data?.byMonth.length === 0 && (
                <div className="text-gray-400 text-sm">No home expenses recorded yet</div>
              )}
            </div>
          </Card>

          {/* Recent Transactions */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Transactions</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {data?.recentTransactions.map(txn => (
                <div key={txn.id} className="py-2 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-gray-900 truncate max-w-[200px]">{txn.name}</div>
                    <div className="font-semibold text-red-600">{formatCurrency(Math.abs(txn.amount))}</div>
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(txn.date).toLocaleDateString()} • {txn.accountCode}
                  </div>
                </div>
              ))}
              {data?.recentTransactions.length === 0 && (
                <div className="text-gray-400 text-sm">No home expenses recorded yet</div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
