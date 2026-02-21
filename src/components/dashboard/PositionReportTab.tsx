'use client';

import { useState, useEffect } from 'react';

interface PositionSummary {
  totalRealizedPL: number;
  optionRealizedPL: number;
  stockRealizedPL: number;
  shortTermPL: number;
  longTermPL: number;
  openPositions: number;
  closedPositions: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
}

interface StrategyBreakdown {
  strategy: string;
  count: number;
  wins: number;
  losses: number;
  pl: number;
}

interface OpenOption {
  id: string;
  symbol: string;
  optionType: string;
  positionType: string;
  strike: number;
  expiration: string | null;
  quantity: number;
  remainingQuantity: number;
  costBasis: number;
  openPrice: number;
  openDate: string;
  strategy: string;
  tradeNum: string;
}

interface OpenStock {
  symbol: string;
  status: string;
  shares: { original: number; remaining: number };
  costBasis: number;
  remainingCostBasis: number;
  avgCostPerShare: number;
  realizedPL: number;
  shortTermPL: number;
  longTermPL: number;
  openDate: string;
  lotCount: number;
}

interface ClosedOption {
  id: string;
  symbol: string;
  optionType: string;
  positionType: string;
  strike: number;
  quantity: number;
  costBasis: number;
  proceeds: number;
  realizedPL: number;
  openDate: string;
  closeDate: string | null;
  strategy: string;
  tradeNum: string;
  holdingDays: number | null;
  isLongTerm: boolean;
}

interface ClosedStock {
  symbol: string;
  shares: { original: number; remaining: number };
  costBasis: number;
  proceeds: number;
  realizedPL: number;
  shortTermPL: number;
  longTermPL: number;
  openDate: string;
  closeDate: string | null;
  lotCount: number;
  dispositionCount: number;
}

interface PositionData {
  summary: PositionSummary;
  byStrategy: StrategyBreakdown[];
  openPositions: {
    options: OpenOption[];
    stocks: OpenStock[];
  };
  closedPositions: {
    options: ClosedOption[];
    stocks: ClosedStock[];
  };
}

export default function PositionReportTab() {
  const [data, setData] = useState<PositionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'summary' | 'open' | 'closed'>('summary');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/positions/summary');
      if (res.ok) {
        setData(await res.json());
      }
    } catch (error) {
      console.error('Error loading positions:', error);
    }
    setLoading(false);
  };

  const fmt = (val: number) => {
    if (val === 0) return '-';
    const abs = Math.abs(val);
    const formatted = abs >= 1000
      ? `$${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `$${abs.toFixed(2)}`;
    return val < 0 ? `(${formatted})` : formatted;
  };

  const plColor = (val: number) => val >= 0 ? 'text-green-700' : 'text-red-700';

  const fmtDate = (d: string | null) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
  };

  if (loading) {
    return <div className="p-8 text-center text-sm text-gray-500">Loading position report...</div>;
  }

  if (!data) {
    return <div className="p-8 text-center text-sm text-red-600">Failed to load position data</div>;
  }

  const { summary } = data;

  return (
    <div>
      {/* Header */}
      <div className="bg-[#2d1b4e] text-white px-4 py-2 flex items-center justify-between">
        <span className="text-sm font-semibold">Position &amp; P&amp;L Report</span>
        <button onClick={loadData} className="text-xs bg-[#3d2b5e] px-3 py-1 rounded hover:bg-[#4d3b6e]">
          Refresh
        </button>
      </div>

      {/* Sub-tabs */}
      <div className="flex border-b border-gray-200">
        {[
          { key: 'summary', label: 'P&L Summary' },
          { key: 'open', label: `Open (${summary.openPositions})` },
          { key: 'closed', label: `Closed (${summary.closedPositions})` },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveView(tab.key as any)}
            className={`px-4 py-2 text-xs font-medium ${
              activeView === tab.key ? 'bg-[#2d1b4e] text-white' : 'bg-gray-50 text-gray-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* P&L Summary View */}
      {activeView === 'summary' && (
        <div className="p-4 space-y-4">
          {/* Top metrics */}
          <div className="grid grid-cols-5 gap-3">
            <div className="border rounded-lg p-3">
              <div className="text-[10px] text-gray-500 uppercase">Total Realized P&L</div>
              <div className={`text-xl font-bold font-mono ${plColor(summary.totalRealizedPL)}`}>
                {fmt(summary.totalRealizedPL)}
              </div>
            </div>
            <div className="border rounded-lg p-3">
              <div className="text-[10px] text-gray-500 uppercase">Short-Term P&L</div>
              <div className={`text-xl font-bold font-mono ${plColor(summary.shortTermPL)}`}>
                {fmt(summary.shortTermPL)}
              </div>
            </div>
            <div className="border rounded-lg p-3">
              <div className="text-[10px] text-gray-500 uppercase">Long-Term P&L</div>
              <div className={`text-xl font-bold font-mono ${plColor(summary.longTermPL)}`}>
                {fmt(summary.longTermPL)}
              </div>
            </div>
            <div className="border rounded-lg p-3">
              <div className="text-[10px] text-gray-500 uppercase">Win Rate</div>
              <div className="text-xl font-bold font-mono">{summary.winRate}%</div>
            </div>
            <div className="border rounded-lg p-3">
              <div className="text-[10px] text-gray-500 uppercase">Profit Factor</div>
              <div className="text-xl font-bold font-mono">
                {summary.profitFactor >= 999 ? 'N/A' : summary.profitFactor.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Options vs Stocks breakdown */}
          <div className="grid grid-cols-2 gap-4">
            <div className="border rounded-lg p-4">
              <h4 className="text-sm font-semibold mb-3">Options P&L</h4>
              <div className={`text-2xl font-bold font-mono ${plColor(summary.optionRealizedPL)}`}>
                {fmt(summary.optionRealizedPL)}
              </div>
            </div>
            <div className="border rounded-lg p-4">
              <h4 className="text-sm font-semibold mb-3">Stocks P&L</h4>
              <div className={`text-2xl font-bold font-mono ${plColor(summary.stockRealizedPL)}`}>
                {fmt(summary.stockRealizedPL)}
              </div>
              <div className="flex gap-4 mt-2 text-xs text-gray-500">
                <span>ST: <span className={`font-mono ${plColor(summary.shortTermPL - (summary.shortTermPL - (data.closedPositions.stocks.reduce((s, p) => s + p.shortTermPL, 0))))}`}>{fmt(data.closedPositions.stocks.reduce((s, p) => s + p.shortTermPL, 0))}</span></span>
                <span>LT: <span className={`font-mono ${plColor(data.closedPositions.stocks.reduce((s, p) => s + p.longTermPL, 0))}`}>{fmt(data.closedPositions.stocks.reduce((s, p) => s + p.longTermPL, 0))}</span></span>
              </div>
            </div>
          </div>

          {/* Strategy breakdown */}
          {data.byStrategy.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 text-sm font-semibold">By Strategy</div>
              <table className="w-full text-xs">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-2 text-left">Strategy</th>
                    <th className="px-3 py-2 text-right">Trades</th>
                    <th className="px-3 py-2 text-right">Wins</th>
                    <th className="px-3 py-2 text-right">Losses</th>
                    <th className="px-3 py-2 text-right">Win Rate</th>
                    <th className="px-3 py-2 text-right">P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byStrategy.map(s => (
                    <tr key={s.strategy} className="border-b hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium">{s.strategy}</td>
                      <td className="px-3 py-2 text-right font-mono">{s.count}</td>
                      <td className="px-3 py-2 text-right font-mono text-green-700">{s.wins}</td>
                      <td className="px-3 py-2 text-right font-mono text-red-700">{s.losses}</td>
                      <td className="px-3 py-2 text-right font-mono">
                        {s.count > 0 ? Math.round((s.wins / s.count) * 100) : 0}%
                      </td>
                      <td className={`px-3 py-2 text-right font-mono font-semibold ${plColor(s.pl)}`}>
                        {fmt(s.pl)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Avg win/loss */}
          <div className="grid grid-cols-2 gap-4">
            <div className="border rounded-lg p-3">
              <div className="text-[10px] text-gray-500 uppercase">Avg Win</div>
              <div className="text-lg font-bold font-mono text-green-700">{fmt(summary.avgWin)}</div>
            </div>
            <div className="border rounded-lg p-3">
              <div className="text-[10px] text-gray-500 uppercase">Avg Loss</div>
              <div className="text-lg font-bold font-mono text-red-700">{fmt(summary.avgLoss)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Open Positions View */}
      {activeView === 'open' && (
        <div className="p-4 space-y-4">
          {/* Open Options */}
          {data.openPositions.options.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800">
                Open Options ({data.openPositions.options.length})
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-3 py-2 text-left">Symbol</th>
                      <th className="px-3 py-2 text-left">Type</th>
                      <th className="px-3 py-2 text-right">Strike</th>
                      <th className="px-3 py-2 text-left">Exp</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Cost Basis</th>
                      <th className="px-3 py-2 text-left">Opened</th>
                      <th className="px-3 py-2 text-left">Strategy</th>
                      <th className="px-3 py-2 text-right">Trade #</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.openPositions.options.map(p => (
                      <tr key={p.id} className="border-b hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium">{p.symbol}</td>
                        <td className="px-3 py-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            p.optionType === 'CALL' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {p.positionType} {p.optionType}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono">${p.strike?.toFixed(2) ?? '-'}</td>
                        <td className="px-3 py-2">{fmtDate(p.expiration)}</td>
                        <td className="px-3 py-2 text-right font-mono">{p.remainingQuantity}</td>
                        <td className="px-3 py-2 text-right font-mono">{fmt(p.costBasis)}</td>
                        <td className="px-3 py-2">{fmtDate(p.openDate)}</td>
                        <td className="px-3 py-2">{p.strategy}</td>
                        <td className="px-3 py-2 text-right font-mono text-gray-400">#{p.tradeNum}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Open Stocks */}
          {data.openPositions.stocks.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-purple-50 px-4 py-2 text-sm font-semibold text-purple-800">
                Open Stock Positions ({data.openPositions.stocks.length})
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-3 py-2 text-left">Symbol</th>
                      <th className="px-3 py-2 text-right">Shares</th>
                      <th className="px-3 py-2 text-right">Avg Cost</th>
                      <th className="px-3 py-2 text-right">Cost Basis</th>
                      <th className="px-3 py-2 text-right">Realized P&L</th>
                      <th className="px-3 py-2 text-left">Opened</th>
                      <th className="px-3 py-2 text-right">Lots</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.openPositions.stocks.map(p => (
                      <tr key={p.symbol} className="border-b hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium">{p.symbol}</td>
                        <td className="px-3 py-2 text-right font-mono">{p.shares.remaining}</td>
                        <td className="px-3 py-2 text-right font-mono">${p.avgCostPerShare.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right font-mono">{fmt(p.remainingCostBasis)}</td>
                        <td className={`px-3 py-2 text-right font-mono font-semibold ${plColor(p.realizedPL)}`}>
                          {fmt(p.realizedPL)}
                        </td>
                        <td className="px-3 py-2">{fmtDate(p.openDate)}</td>
                        <td className="px-3 py-2 text-right font-mono text-gray-400">{p.lotCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {data.openPositions.options.length === 0 && data.openPositions.stocks.length === 0 && (
            <div className="text-center text-sm text-gray-500 py-8">No open positions</div>
          )}
        </div>
      )}

      {/* Closed Positions View */}
      {activeView === 'closed' && (
        <div className="p-4 space-y-4">
          {/* Closed Options */}
          {data.closedPositions.options.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800">
                Closed Options ({data.closedPositions.options.length})
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-3 py-2 text-left">Symbol</th>
                      <th className="px-3 py-2 text-left">Type</th>
                      <th className="px-3 py-2 text-right">Strike</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Cost Basis</th>
                      <th className="px-3 py-2 text-right">Proceeds</th>
                      <th className="px-3 py-2 text-right">P&L</th>
                      <th className="px-3 py-2 text-right">Days</th>
                      <th className="px-3 py-2 text-left">Term</th>
                      <th className="px-3 py-2 text-left">Closed</th>
                      <th className="px-3 py-2 text-right">Trade #</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.closedPositions.options.map(p => (
                      <tr key={p.id} className="border-b hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium">{p.symbol}</td>
                        <td className="px-3 py-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            p.optionType === 'CALL' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {p.positionType} {p.optionType}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono">${p.strike?.toFixed(2) ?? '-'}</td>
                        <td className="px-3 py-2 text-right font-mono">{p.quantity}</td>
                        <td className="px-3 py-2 text-right font-mono">{fmt(p.costBasis)}</td>
                        <td className="px-3 py-2 text-right font-mono">{fmt(p.proceeds)}</td>
                        <td className={`px-3 py-2 text-right font-mono font-semibold ${plColor(p.realizedPL)}`}>
                          {fmt(p.realizedPL)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-gray-500">{p.holdingDays ?? '-'}</td>
                        <td className="px-3 py-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            p.isLongTerm ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {p.isLongTerm ? 'LT' : 'ST'}
                          </span>
                        </td>
                        <td className="px-3 py-2">{fmtDate(p.closeDate)}</td>
                        <td className="px-3 py-2 text-right font-mono text-gray-400">#{p.tradeNum}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Closed Stocks */}
          {data.closedPositions.stocks.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-purple-50 px-4 py-2 text-sm font-semibold text-purple-800">
                Closed Stock Positions ({data.closedPositions.stocks.length})
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-3 py-2 text-left">Symbol</th>
                      <th className="px-3 py-2 text-right">Shares</th>
                      <th className="px-3 py-2 text-right">Cost Basis</th>
                      <th className="px-3 py-2 text-right">Proceeds</th>
                      <th className="px-3 py-2 text-right">P&L</th>
                      <th className="px-3 py-2 text-right">ST P&L</th>
                      <th className="px-3 py-2 text-right">LT P&L</th>
                      <th className="px-3 py-2 text-left">Closed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.closedPositions.stocks.map(p => (
                      <tr key={p.symbol} className="border-b hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium">{p.symbol}</td>
                        <td className="px-3 py-2 text-right font-mono">{p.shares.original}</td>
                        <td className="px-3 py-2 text-right font-mono">{fmt(p.costBasis)}</td>
                        <td className="px-3 py-2 text-right font-mono">{fmt(p.proceeds)}</td>
                        <td className={`px-3 py-2 text-right font-mono font-semibold ${plColor(p.realizedPL)}`}>
                          {fmt(p.realizedPL)}
                        </td>
                        <td className={`px-3 py-2 text-right font-mono ${plColor(p.shortTermPL)}`}>
                          {fmt(p.shortTermPL)}
                        </td>
                        <td className={`px-3 py-2 text-right font-mono ${plColor(p.longTermPL)}`}>
                          {fmt(p.longTermPL)}
                        </td>
                        <td className="px-3 py-2">{fmtDate(p.closeDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {data.closedPositions.options.length === 0 && data.closedPositions.stocks.length === 0 && (
            <div className="text-center text-sm text-gray-500 py-8">No closed positions</div>
          )}
        </div>
      )}
    </div>
  );
}
