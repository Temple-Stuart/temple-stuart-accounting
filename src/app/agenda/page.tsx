'use client';

import { useState, useEffect } from 'react';
import { AppLayout, Card } from '@/components/ui';

interface AgendaSummary {
  totalMonthly: number;
  totalAllTime: number;
  ytdTotal: number;
  monthCount: number;
  transactionCount: number;
}

interface AgendaByCode {
  code: string;
  name: string;
  total: number;
  count: number;
  monthlyAvg: number;
}

interface AgendaData {
  summary: AgendaSummary;
  byCode: AgendaByCode[];
  byMonth: Array<{ month: string; total: number }>;
  recentTransactions: Array<{ id: string; date: string; name: string; amount: number; accountCode: string }>;
}

export default function AgendaPage() {
  const [data, setData] = useState<AgendaData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/agenda')
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
          <span className="text-4xl">📋</span>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Agenda</h1>
            <p className="text-gray-500">Personal costs that follow you everywhere</p>
          </div>
        </div>

        {/* Key Insight */}
        <Card className="p-6 mb-8 bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-purple-600 font-medium mb-1">Monthly Personal Costs</div>
              <div className="text-4xl font-bold text-purple-700">
                {formatCurrency(data?.summary.totalMonthly || 0)}
              </div>
              <div className="text-sm text-purple-600 mt-1">
                These costs follow you - home or nomad
              </div>
            </div>
            <div className="text-6xl opacity-50">👤</div>
          </div>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-6">
            <div className="text-sm text-gray-500 mb-1">YTD Spending</div>
            <div className="text-2xl font-bold text-gray-900">{formatCurrency(data?.summary.ytdTotal || 0)}</div>
          </Card>
          <Card className="p-6">
            <div className="text-sm text-gray-500 mb-1">All-Time</div>
            <div className="text-2xl font-bold text-gray-900">{formatCurrency(data?.summary.totalAllTime || 0)}</div>
          </Card>
          <Card className="p-6">
            <div className="text-sm text-gray-500 mb-1">Categories</div>
            <div className="text-2xl font-bold text-gray-900">{data?.byCode.filter(c => c.total > 0).length || 0}</div>
          </Card>
          <Card className="p-6">
            <div className="text-sm text-gray-500 mb-1">Transactions</div>
            <div className="text-2xl font-bold text-gray-900">{data?.summary.transactionCount || 0}</div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* By Category */}
          <Card className="p-6 lg:col-span-2">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">By Category</h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {data?.byCode.filter(c => c.total > 0).map(item => (
                <div key={item.code} className="flex items-center justify-between py-2 border-b border-gray-100">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{item.name}</div>
                    <div className="text-xs text-gray-400">{item.code} • {item.count} txns</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-gray-900">{formatCurrency(item.monthlyAvg)}<span className="text-xs text-gray-400">/mo</span></div>
                    <div className="text-xs text-gray-400">{formatCurrency(item.total)} total</div>
                  </div>
                </div>
              ))}
              {data?.byCode.filter(c => c.total > 0).length === 0 && (
                <div className="text-gray-400 text-sm">No agenda expenses recorded yet</div>
              )}
            </div>
          </Card>

          {/* Monthly Trend */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Monthly Trend</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {data?.byMonth.slice(0, 12).map(month => (
                <div key={month.month} className="flex items-center justify-between py-2 border-b border-gray-100">
                  <div className="text-gray-600">{formatMonth(month.month)}</div>
                  <div className="font-semibold text-gray-900">{formatCurrency(month.total)}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Recent Transactions */}
        <Card className="p-6 mt-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Transactions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto">
            {data?.recentTransactions.map(txn => (
              <div key={txn.id} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-gray-900 truncate max-w-[150px]">{txn.name}</div>
                  <div className="font-semibold text-red-600">{formatCurrency(Math.abs(txn.amount))}</div>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {new Date(txn.date).toLocaleDateString()} • {txn.accountCode}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
