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

interface OpenTransaction {
  id: string;
  date: string;
  name: string;
  ticker: string | null;
  underlying: string | null;
  isOption: boolean;
  optionType: string | null;
  strike: number | null;
  expiration: string | null;
  action: string;
  quantity: number;
  price: number;
  amount: number;
}

interface OpensData {
  totalOpens: number;
  opens: OpenTransaction[];
  byDate: Record<string, OpenTransaction[]>;
}


interface TradeRecord {
  tradeNum: string;
  underlying: string;
  strategy: string;
  status: 'OPEN' | 'CLOSED';
  openDate: string;
  closeDate: string | null;
  legs: number;
  openLegs: number;
  closeLegs: number;
  openAmount: number;
  closeAmount: number;
  realizedPL: number;
  transactions: Array<{
    id: string;
    date: string;
    name: string;
    type: string;
    quantity: number;
    price: number;
    amount: number;
    isOpen: boolean;
    isClose: boolean;
  }>;
}

interface TradesData {
  summary: {
    totalTrades: number;
    openTrades: number;
    closedTrades: number;
    totalRealizedPL: number;
    winRate: number;
    avgWin: number;
    avgLoss: number;
    profitFactor: number;
  };
  trades: TradeRecord[];
  byTicker: Array<{ ticker: string; count: number; pl: number; wins: number; losses: number }>;
  byStrategy: Array<{ strategy: string; count: number; pl: number; wins: number; losses: number }>;
}

type TabType = 'overview' | 'trades' | 'commit';

export default function TradingPage() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [data, setData] = useState<TradingData | null>(null);
  const [opensData, setOpensData] = useState<OpensData | null>(null);
  const [loading, setLoading] = useState(true);
  const [opensLoading, setOpensLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [tradesData, setTradesData] = useState<TradesData | null>(null);
  const [tradesLoading, setTradesLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/trading').then(res => res.json()),
      fetch('/api/trading/trades').then(res => res.json())
    ])
      .then(([tradingData, tradesResult]) => {
        setData(tradingData);
        setTradesData(tradesResult);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (activeTab === 'trades' && !tradesData) {
      setTradesLoading(true);
      fetch('/api/trading/trades')
        .then(res => res.json())
        .then(setTradesData)
        .catch(console.error)
        .finally(() => setTradesLoading(false));
    }
  }, [activeTab, tradesData]);

  useEffect(() => {
    if (activeTab === 'commit' && !opensData) {
      setOpensLoading(true);
      fetch('/api/investment-transactions/opens')
        .then(res => res.json())
        .then(setOpensData)
        .catch(console.error)
        .finally(() => setOpensLoading(false));
    }
  }, [activeTab, opensData]);

  const formatCurrency = (amount: number) => {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Math.abs(amount));
    return amount < 0 ? `-${formatted}` : formatted;
  };

  const formatPL = (amount: number) => {
    const formatted = formatCurrency(amount);
    const color = amount >= 0 ? 'text-green-600' : 'text-red-600';
    const prefix = amount >= 0 ? '+' : '';
    return <span className={color}>{prefix}{formatted}</span>;
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAllOnDate = (date: string) => {
    if (!opensData?.byDate[date]) return;
    setSelectedIds(prev => {
      const next = new Set(prev);
      opensData.byDate[date].forEach(t => next.add(t.id));
      return next;
    });
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
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="text-4xl">📊</span>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Trading</h1>
              <p className="text-gray-500">Track positions, P&L, and strategies</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 font-medium text-sm rounded-t-lg transition-colors ${
              activeTab === 'overview'
                ? 'bg-white border border-b-white border-gray-200 text-gray-900 -mb-px'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('commit')}
            className={`px-4 py-2 font-medium text-sm rounded-t-lg transition-colors ${
              activeTab === 'commit'
                ? 'bg-white border border-b-white border-gray-200 text-gray-900 -mb-px'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Commit Trades
            {opensData && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                {opensData.totalOpens}
              </span>
            )}
          </button>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <>
            {/* P&L Hero */}
            <Card className={`p-6 mb-8 ${(tradesData?.summary.totalRealizedPL || 0) >= 0 ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200' : 'bg-gradient-to-r from-red-50 to-orange-50 border-red-200'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium mb-1 text-gray-600">Total Realized P&L</div>
                  <div className="text-4xl font-bold">
                    {formatPL(tradesData?.summary.totalRealizedPL || 0)}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    {tradesData?.summary.closedTrades || 0} closed trades • {tradesData?.summary.winRate || 0}% win rate
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500">Avg Win</div>
                  <div className="text-lg font-bold text-green-600">${(tradesData?.summary.avgWin || 0).toFixed(2)}</div>
                  <div className="text-sm text-gray-500 mt-1">Avg Loss</div>
                  <div className="text-lg font-bold text-red-600">${Math.abs(tradesData?.summary.avgLoss || 0).toFixed(2)}</div>
                </div>
              </div>
            </Card>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <Card className="p-6">
                <div className="text-sm text-gray-500 mb-1">Total Trades</div>
                <div className="text-2xl font-bold text-gray-900">{tradesData?.summary.totalTrades || 0}</div>
                <div className="text-xs text-gray-400">{tradesData?.summary.openTrades || 0} open</div>
              </Card>
              <Card className="p-6">
                <div className="text-sm text-gray-500 mb-1">Win Rate</div>
                <div className="text-2xl font-bold text-blue-600">{tradesData?.summary.winRate || 0}%</div>
              </Card>
              <Card className="p-6">
                <div className="text-sm text-gray-500 mb-1">Profit Factor</div>
                <div className="text-2xl font-bold text-purple-600">{(tradesData?.summary.profitFactor || 0).toFixed(2)}</div>
              </Card>
              <Card className="p-6">
                <div className="text-sm text-gray-500 mb-1">Contributions</div>
                <div className="text-2xl font-bold text-green-600">{formatCurrency(data?.summary.contributions || 0)}</div>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* P&L by Strategy */}
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">P&L by Strategy</h2>
                <div className="space-y-3">
                  {tradesData?.byStrategy.map(s => (
                    <div key={s.strategy} className="flex items-center justify-between py-2 border-b border-gray-100">
                      <div>
                        <div className="font-medium text-gray-900">{s.strategy}</div>
                        <div className="text-xs text-gray-400">{s.count} trades • {s.wins}W/{s.losses}L</div>
                      </div>
                      <div className={`font-semibold ${s.pl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatPL(s.pl)}
                      </div>
                    </div>
                  ))}
                  {(!tradesData?.byStrategy || tradesData.byStrategy.length === 0) && (
                    <div className="text-gray-400 text-sm">No closed trades yet</div>
                  )}
                </div>
              </Card>

              {/* P&L by Ticker */}
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">P&L by Ticker</h2>
                <div className="space-y-3">
                  {tradesData?.byTicker.map(t => (
                    <div key={t.ticker} className="flex items-center justify-between py-2 border-b border-gray-100">
                      <div>
                        <div className="font-medium text-gray-900">{t.ticker}</div>
                        <div className="text-xs text-gray-400">{t.count} trades • {t.wins}W/{t.losses}L</div>
                      </div>
                      <div className={`font-semibold ${t.pl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatPL(t.pl)}
                      </div>
                    </div>
                  ))}
                  {(!tradesData?.byTicker || tradesData.byTicker.length === 0) && (
                    <div className="text-gray-400 text-sm">No trades by ticker yet</div>
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
                        <td className="py-2 font-medium">{t.ticker || (t.name?.slice(0, 20) || "—")}</td>
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
          </>
        )}

        {/* Commit Trades Tab */}
        {activeTab === 'commit' && (
          <div>
            {opensLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-[#b4b237] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                {/* Selection Summary */}
                <Card className="p-4 mb-6 bg-blue-50 border-blue-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-blue-900">
                        {selectedIds.size} transactions selected
                      </span>
                      <span className="text-blue-600 ml-4">
                        {opensData?.totalOpens || 0} total opens to commit
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedIds(new Set())}
                        className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                      >
                        Clear
                      </button>
                      <button
                        disabled={selectedIds.size === 0}
                        className="px-4 py-1 text-sm bg-[#b4b237] text-white rounded hover:bg-[#9a982f] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Group as Trade →
                      </button>
                    </div>
                  </div>
                </Card>

                {/* Transactions by Date */}
                <div className="space-y-4">
                  {opensData?.byDate && Object.entries(opensData.byDate)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([date, transactions]) => (
                      <Card key={date} className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-semibold text-gray-900">
                            {new Date(date).toLocaleDateString('en-US', { 
                              weekday: 'short', 
                              month: 'short', 
                              day: 'numeric',
                              year: 'numeric'
                            })}
                            <span className="ml-2 text-sm font-normal text-gray-500">
                              ({transactions.length} transactions)
                            </span>
                          </h3>
                          <button
                            onClick={() => selectAllOnDate(date)}
                            className="text-sm text-blue-600 hover:text-blue-800"
                          >
                            Select all
                          </button>
                        </div>
                        <div className="space-y-1">
                          {transactions.map(t => (
                            <div
                              key={t.id}
                              onClick={() => toggleSelect(t.id)}
                              className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${
                                selectedIds.has(t.id) 
                                  ? 'bg-blue-100 border border-blue-300' 
                                  : 'hover:bg-gray-50 border border-transparent'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={selectedIds.has(t.id)}
                                onChange={() => toggleSelect(t.id)}
                                className="w-4 h-4 rounded"
                              />
                              <div className={`w-16 text-xs font-medium px-2 py-0.5 rounded ${
                                t.action === 'sell_to_open' 
                                  ? 'bg-red-100 text-red-700' 
                                  : 'bg-green-100 text-green-700'
                              }`}>
                                {t.action === 'sell_to_open' ? 'SELL' : 'BUY'}
                              </div>
                              <div className="flex-1 font-mono text-sm">
                                {t.ticker || 'Unknown'}
                              </div>
                              <div className="text-sm text-gray-600">
                                {t.quantity} @ ${t.price?.toFixed(2)}
                              </div>
                              <div className={`text-sm font-medium w-24 text-right ${
                                (t.amount || 0) < 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {formatCurrency(t.amount || 0)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </Card>
                    ))}
                </div>

                {(!opensData?.opens || opensData.opens.length === 0) && (
                  <Card className="p-8 text-center text-gray-500">
                    No uncommitted opens found
                  </Card>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
