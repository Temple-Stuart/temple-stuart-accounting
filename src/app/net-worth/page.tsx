'use client';

import { useState, useEffect } from 'react';
import { AppLayout, Card } from '@/components/ui';

interface AccountItem {
  code: string;
  name: string;
  balance: number;
}

interface NetWorthData {
  summary: {
    totalAssets: number;
    totalDebt: number;
    totalEquity: number;
    netWorth: number;
  };
  assets: AccountItem[];
  debt: AccountItem[];
  equity: AccountItem[];
}

export default function NetWorthPage() {
  const [data, setData] = useState<NetWorthData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/net-worth')
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

  if (loading) {
    return (
      <AppLayout>
        <div className="p-8 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-brand-accent border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  const netWorth = data?.summary.netWorth || 0;
  const isPositive = netWorth >= 0;

  return (
    <AppLayout>
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <span className="text-4xl">💰</span>
          <div>
            <h1 className="text-sm font-bold text-text-primary">Net Worth</h1>
            <p className="text-text-muted">Assets - Debt = Equity</p>
          </div>
        </div>

        {/* Net Worth Hero */}
        <Card className={`p-8 mb-8 ${isPositive ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200' : 'bg-gradient-to-r from-red-50 to-orange-50 border-red-200'}`}>
          <div className="text-center">
            <div className={`text-sm font-medium mb-2 ${isPositive ? 'text-brand-green' : 'text-brand-red'}`}>
              Net Worth
            </div>
            <div className={`text-5xl font-bold ${isPositive ? 'text-brand-green' : 'text-brand-red'}`}>
              {formatCurrency(netWorth)}
            </div>
          </div>
        </Card>

        {/* Summary Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="p-6 bg-brand-purple-wash border-blue-200">
            <div className="text-sm text-brand-purple mb-1">Total Assets</div>
            <div className="text-3xl font-bold text-brand-purple">
              {formatCurrency(data?.summary.totalAssets || 0)}
            </div>
          </Card>
          <Card className="p-6 bg-red-50 border-red-200">
            <div className="text-sm text-brand-red mb-1">Total Debt</div>
            <div className="text-3xl font-bold text-brand-red">
              {formatCurrency(data?.summary.totalDebt || 0)}
            </div>
          </Card>
          <Card className="p-6 bg-purple-50 border-purple-200">
            <div className="text-sm text-purple-600 mb-1">Equity (Book)</div>
            <div className="text-3xl font-bold text-purple-700">
              {formatCurrency(data?.summary.totalEquity || 0)}
            </div>
          </Card>
        </div>

        {/* Detail Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Assets */}
          <Card className="p-6">
            <h2 className="text-terminal-lg font-semibold text-brand-purple mb-4 flex items-center gap-2">
              <span>📈</span> Assets (P-1XXX)
            </h2>
            <div className="space-y-2">
              {data?.assets.filter(a => a.balance > 0).map(asset => (
                <div key={asset.code} className="flex items-center justify-between py-2 border-b border-border-light">
                  <div>
                    <div className="font-medium text-text-primary">{asset.name}</div>
                    <div className="text-xs text-text-faint">{asset.code}</div>
                  </div>
                  <div className="font-semibold text-brand-purple">{formatCurrency(asset.balance)}</div>
                </div>
              ))}
              {data?.assets.filter(a => a.balance > 0).length === 0 && (
                <div className="text-text-faint text-sm">No assets with balance</div>
              )}
            </div>
          </Card>

          {/* Debt */}
          <Card className="p-6">
            <h2 className="text-terminal-lg font-semibold text-brand-red mb-4 flex items-center gap-2">
              <span>📉</span> Debt (P-2XXX)
            </h2>
            <div className="space-y-2">
              {data?.debt.filter(d => d.balance > 0).map(item => (
                <div key={item.code} className="flex items-center justify-between py-2 border-b border-border-light">
                  <div>
                    <div className="font-medium text-text-primary">{item.name}</div>
                    <div className="text-xs text-text-faint">{item.code}</div>
                  </div>
                  <div className="font-semibold text-brand-red">{formatCurrency(item.balance)}</div>
                </div>
              ))}
              {data?.debt.filter(d => d.balance > 0).length === 0 && (
                <div className="text-text-faint text-sm">No debt with balance</div>
              )}
            </div>
          </Card>

          {/* Equity */}
          <Card className="p-6">
            <h2 className="text-terminal-lg font-semibold text-purple-700 mb-4 flex items-center gap-2">
              <span>⚖️</span> Equity (P-3XXX)
            </h2>
            <div className="space-y-2">
              {data?.equity.map(item => (
                <div key={item.code} className="flex items-center justify-between py-2 border-b border-border-light">
                  <div>
                    <div className="font-medium text-text-primary">{item.name}</div>
                    <div className="text-xs text-text-faint">{item.code}</div>
                  </div>
                  <div className="font-semibold text-purple-600">{formatCurrency(item.balance)}</div>
                </div>
              ))}
              {data?.equity.length === 0 && (
                <div className="text-text-faint text-sm">No equity accounts</div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
