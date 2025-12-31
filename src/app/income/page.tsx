'use client';

import { useState, useEffect } from 'react';
import { AppLayout, Card } from '@/components/ui';

interface IncomeSummary {
  ytdTotal: number;
  allTimeTotal: number;
  monthlyAvg: number;
  transactionCount: number;
}

interface IncomeByCode {
  code: string;
  name: string;
  total: number;
  count: number;
}

interface IncomeByMonth {
  month: string;
  total: number;
}

interface RecentTransaction {
  id: string;
  date: string;
  name: string;
  amount: number;
  accountCode: string;
}

interface IncomeData {
  summary: IncomeSummary;
  byCode: IncomeByCode[];
  byMonth: IncomeByMonth[];
  recentTransactions: RecentTransaction[];
}

export default function IncomePage() {
  const [data, setData] = useState<IncomeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/income')
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
          <span className="text-4xl">💵</span>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Income</h1>
            <p className="text-gray-500">Track earnings from all sources (P-4XXX)</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-6">
            <div className="text-sm text-gray-500 mb-1">YTD Income</div>
            <div className="text-3xl font-bold text-green-600">
              {formatCurrency(data?.summary.ytdTotal || 0)}
            </div>
          </Card>
          <Card className="p-6">
            <div className="text-sm text-gray-500 mb-1">All-Time Income</div>
            <div className="text-3xl font-bold text-gray-900">
              {formatCurrency(data?.summary.allTimeTotal || 0)}
            </div>
          </Card>
          <Card className="p-6">
            <div className="text-sm text-gray-500 mb-1">Monthly Average</div>
            <div className="text-3xl font-bold text-gray-900">
              {formatCurrency(data?.summary.monthlyAvg || 0)}
            </div>
          </Card>
          <Card className="p-6">
            <div className="text-sm text-gray-500 mb-1">Transactions</div>
            <div className="text-3xl font-bold text-gray-900">
              {data?.summary.transactionCount || 0}
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* By Source */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">By Source</h2>
            <div className="space-y-3">
              {data?.byCode.filter(c => c.total > 0).map(source => (
                <div key={source.code} className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">{source.name}</div>
                    <div className="text-xs text-gray-400">{source.code} • {source.count} txns</div>
                  </div>
                  <div className="text-right font-semibold text-green-600">
                    {formatCurrency(source.total)}
                  </div>
                </div>
              ))}
              {data?.byCode.filter(c => c.total > 0).length === 0 && (
                <div className="text-gray-400 text-sm">No income recorded yet</div>
              )}
            </div>
          </Card>

          {/* By Month */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">By Month</h2>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {data?.byMonth.slice(0, 12).map(month => (
                <div key={month.month} className="flex items-center justify-between py-2 border-b border-gray-100">
                  <div className="text-gray-600">{formatMonth(month.month)}</div>
                  <div className="font-semibold text-green-600">{formatCurrency(month.total)}</div>
                </div>
              ))}
              {data?.byMonth.length === 0 && (
                <div className="text-gray-400 text-sm">No income recorded yet</div>
              )}
            </div>
          </Card>

          {/* Recent Transactions */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Income</h2>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {data?.recentTransactions.map(txn => (
                <div key={txn.id} className="py-2 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-gray-900 truncate max-w-[180px]">{txn.name}</div>
                    <div className="font-semibold text-green-600">{formatCurrency(Math.abs(txn.amount))}</div>
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(txn.date).toLocaleDateString()} • {txn.accountCode}
                  </div>
                </div>
              ))}
              {data?.recentTransactions.length === 0 && (
                <div className="text-gray-400 text-sm">No income recorded yet</div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
