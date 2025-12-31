'use client';

import { useState, useEffect } from 'react';
import { AppLayout, Card } from '@/components/ui';

interface TradingSummary {
  totalRealizedPL: number;
  totalUnrealizedPL: number;
  openPositionCount: number;
  closedTradeCount: number;
  contributions: number;
  withdrawals: number;
  netCapitalFlow: number;
}

interface Position {
  id: string;
  symbol: string;
  optionType?: string;
  strikePrice?: number;
  expirationDate?: string;
  quantity: number;
  costBasis?: number;
  realizedPL?: number;
  openDate: string;
  closeDate?: string;
  strategy?: string;
}

interface StrategyPL {
  strategy: string;
  count: number;
  realizedPL: number;
}

interface RecentTrade {
  id: string;
  date: string;
  name: string;
  type: string;
  subtype: string;
  quantity: number;
  price: number;
  amount: number;
  ticker?: string;
}

interface TradingData {
  summary: TradingSummary;
  openPositions: Position[];
  closedPositions: Position[];
  byStrategy: StrategyPL[];
  recentTrades: RecentTrade[];
}

export default function TradingPage() {
  const [data, setData] = useState<TradingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/trading')
      .then(res => res.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const formatCurrency = (amount: number) => {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.abs(amount));
    return amount < 0 ? `-${formatted}` : formatted;
  };

  const formatPL = (amount: number) => {
    const formatted = formatCurrency(amount);
    const color = amount >= 0 ? 'text-green-600' : 'text-red-600';
    const prefix = amount >= 0 ? '+' : '';
    return <span className={color}>{prefix}{formatted}</span>;
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
          <span className="text-4xl">📊</span>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Trading</h1>
            <p className="text-gray-500">Track positions, P&L, and strategies (T-XXXX)</p>
          </div>
        </div>

        {/* P&L Hero */}
        <Card className={`p-6 mb-8 ${(data?.summary.totalRealizedPL || 0) >= 0 ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200' : 'bg-gradient-to-r from-red-50 to-orange-50 border-red-200'}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium mb-1 text-gray-600">Total Realized P&L</div>
              <div className="text-4xl font-bold">
                {formatPL(data?.summary.totalRealizedPL || 0)}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                {data?.summary.closedTradeCount || 0} closed trades
              </div>
            </div>
            <div className="text-6xl opacity-50">📈</div>
          </div>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-6">
            <div className="text-sm text-gray-500 mb-1">Open Positions</div>
            <div className="text-2xl font-bold text-gray-900">{data?.summary.openPositionCount || 0}</div>
          </Card>
          <Card className="p-6">
            <div className="text-sm text-gray-500 mb-1">Contributions</div>
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(data?.summary.contributions || 0)}</div>
          </Card>
          <Card className="p-6">
            <div className="text-sm text-gray-500 mb-1">Withdrawals</div>
            <div className="text-2xl font-bold text-orange-600">{formatCurrency(data?.summary.withdrawals || 0)}</div>
          </Card>
          <Card className="p-6">
            <div className="text-sm text-gray-500 mb-1">Net Capital Flow</div>
            <div className="text-2xl font-bold text-gray-900">{formatCurrency(data?.summary.netCapitalFlow || 0)}</div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* P&L by Strategy */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">P&L by Strategy</h2>
            <div className="space-y-3">
              {data?.byStrategy.map(s => (
                <div key={s.strategy} className="flex items-center justify-between py-2 border-b border-gray-100">
                  <div>
                    <div className="font-medium text-gray-900">{s.strategy}</div>
                    <div className="text-xs text-gray-400">{s.count} trades</div>
                  </div>
                  <div className="font-semibold">{formatPL(s.realizedPL)}</div>
                </div>
              ))}
              {(!data?.byStrategy || data.byStrategy.length === 0) && (
                <div className="text-gray-400 text-sm">No closed trades yet</div>
              )}
            </div>
          </Card>

          {/* Open Positions */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Open Positions</h2>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {data?.openPositions.map(p => (
                <div key={p.id} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-gray-900">{p.symbol}</div>
                    <div className="text-sm text-gray-600">{p.quantity} contracts</div>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {p.optionType && `${p.optionType} `}
                    {p.strikePrice && `$${p.strikePrice} `}
                    {p.strategy && `• ${p.strategy}`}
                  </div>
                </div>
              ))}
              {(!data?.openPositions || data.openPositions.length === 0) && (
                <div className="text-gray-400 text-sm">No open positions</div>
              )}
            </div>
          </Card>
        </div>

        {/* Recent Trades */}
        <Card className="p-6 mt-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Trades</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Symbol</th>
                  <th className="pb-2">Type</th>
                  <th className="pb-2 text-right">Qty</th>
                  <th className="pb-2 text-right">Price</th>
                  <th className="pb-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data?.recentTrades.map(t => (
                  <tr key={t.id} className="border-b border-gray-100">
                    <td className="py-2">{new Date(t.date).toLocaleDateString()}</td>
                    <td className="py-2 font-medium">{t.ticker || t.name.slice(0, 20)}</td>
                    <td className="py-2">{t.subtype || t.type}</td>
                    <td className="py-2 text-right">{t.quantity}</td>
                    <td className="py-2 text-right">${t.price?.toFixed(2) || '—'}</td>
                    <td className="py-2 text-right font-medium">{formatCurrency(t.amount || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(!data?.recentTrades || data.recentTrades.length === 0) && (
              <div className="text-gray-400 text-sm text-center py-4">No trades recorded yet</div>
            )}
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
