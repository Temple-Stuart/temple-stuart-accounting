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

  const plColor = (val: number) => val >= 0 ? 'text-brand-green' : 'text-brand-red';

  const fmtDate = (d: string | null) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
  };

  if (loading) {
    return <div className="p-8 text-center text-terminal-sm text-text-muted">Loading position report...</div>;
  }

  if (!data) {
    return <div className="p-8 text-center text-terminal-sm text-brand-red">Failed to load position data</div>;
  }

  const { summary } = data;

  return (
    <div>
      {/* Sub-tabs + Refresh */}
      <div className="flex items-center border-b border-border">
        {[
          { key: 'summary', label: 'P&L Summary' },
          { key: 'open', label: `Open (${summary.openPositions})` },
          { key: 'closed', label: `Closed (${summary.closedPositions})` },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveView(tab.key as any)}
            className={`px-3 py-1.5 text-terminal-base font-mono font-medium border-b-2 transition-colors ${
              activeView === tab.key
                ? 'border-brand-purple text-brand-purple'
                : 'border-transparent text-text-muted hover:text-text-secondary'
            }`}
          >
            {tab.label}
          </button>
        ))}
        <button onClick={loadData} className="ml-auto mr-2 px-3 py-1 text-xs border border-border text-text-secondary rounded-lg hover:bg-bg-row transition-colors">
          Refresh
        </button>
      </div>

      {/* P&L Summary View */}
      {activeView === 'summary' && (
        <div className="p-3 space-y-3">
          {/* Top metrics */}
          <div className="grid grid-cols-5 gap-2">
            <div className="border border-border rounded p-2">
              <div className="text-terminal-xs text-text-muted uppercase tracking-widest">Total Realized P&L</div>
              <div className={`text-terminal-lg font-bold font-mono ${plColor(summary.totalRealizedPL)}`}>
                {fmt(summary.totalRealizedPL)}
              </div>
            </div>
            <div className="border border-border rounded p-2">
              <div className="text-terminal-xs text-text-muted uppercase tracking-widest">Short-Term P&L</div>
              <div className={`text-terminal-lg font-bold font-mono ${plColor(summary.shortTermPL)}`}>
                {fmt(summary.shortTermPL)}
              </div>
            </div>
            <div className="border border-border rounded p-2">
              <div className="text-terminal-xs text-text-muted uppercase tracking-widest">Long-Term P&L</div>
              <div className={`text-terminal-lg font-bold font-mono ${plColor(summary.longTermPL)}`}>
                {fmt(summary.longTermPL)}
              </div>
            </div>
            <div className="border border-border rounded p-2">
              <div className="text-terminal-xs text-text-muted uppercase tracking-widest">Win Rate</div>
              <div className="text-terminal-lg font-bold font-mono">{summary.winRate}%</div>
            </div>
            <div className="border border-border rounded p-2">
              <div className="text-terminal-xs text-text-muted uppercase tracking-widest">Profit Factor</div>
              <div className="text-terminal-lg font-bold font-mono">
                {summary.profitFactor >= 999 ? 'N/A' : summary.profitFactor.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Options vs Stocks breakdown */}
          <div className="grid grid-cols-2 gap-3">
            <div className="border border-border rounded p-3">
              <h4 className="text-terminal-lg font-semibold mb-2">Options P&L</h4>
              <div className={`text-sm font-bold font-mono ${plColor(summary.optionRealizedPL)}`}>
                {fmt(summary.optionRealizedPL)}
              </div>
            </div>
            <div className="border border-border rounded p-3">
              <h4 className="text-terminal-lg font-semibold mb-2">Stocks P&L</h4>
              <div className={`text-sm font-bold font-mono ${plColor(summary.stockRealizedPL)}`}>
                {fmt(summary.stockRealizedPL)}
              </div>
              <div className="flex gap-4 mt-2 text-terminal-sm text-text-muted">
                <span>ST: <span className={`font-mono ${plColor(summary.shortTermPL - (summary.shortTermPL - (data.closedPositions.stocks.reduce((s, p) => s + p.shortTermPL, 0))))}`}>{fmt(data.closedPositions.stocks.reduce((s, p) => s + p.shortTermPL, 0))}</span></span>
                <span>LT: <span className={`font-mono ${plColor(data.closedPositions.stocks.reduce((s, p) => s + p.longTermPL, 0))}`}>{fmt(data.closedPositions.stocks.reduce((s, p) => s + p.longTermPL, 0))}</span></span>
              </div>
            </div>
          </div>

          {/* Strategy breakdown */}
          {data.byStrategy.length > 0 && (
            <div className="border border-border rounded overflow-hidden">
              <div className="bg-bg-row px-3 py-1.5 text-terminal-lg font-semibold">By Strategy</div>
              <table className="w-full text-terminal-base">
                <thead className="bg-gray-50 text-text-secondary">
                  <tr>
                    <th className="py-1 px-2 text-left text-terminal-xs uppercase tracking-widest font-mono">Strategy</th>
                    <th className="py-1 px-2 text-right text-terminal-xs uppercase tracking-widest font-mono">Trades</th>
                    <th className="py-1 px-2 text-right text-terminal-xs uppercase tracking-widest font-mono">Wins</th>
                    <th className="py-1 px-2 text-right text-terminal-xs uppercase tracking-widest font-mono">Losses</th>
                    <th className="py-1 px-2 text-right text-terminal-xs uppercase tracking-widest font-mono">Win Rate</th>
                    <th className="py-1 px-2 text-right text-terminal-xs uppercase tracking-widest font-mono">P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byStrategy.map((s, idx) => (
                    <tr key={s.strategy} className={`border-b border-border-light hover:bg-bg-row ${idx % 2 === 0 ? 'bg-white' : 'bg-bg-row'}`}>
                      <td className="py-1 px-2 font-medium">{s.strategy}</td>
                      <td className="py-1 px-2 text-right font-mono">{s.count}</td>
                      <td className="py-1 px-2 text-right font-mono text-brand-green">{s.wins}</td>
                      <td className="py-1 px-2 text-right font-mono text-brand-red">{s.losses}</td>
                      <td className="py-1 px-2 text-right font-mono">
                        {s.count > 0 ? Math.round((s.wins / s.count) * 100) : 0}%
                      </td>
                      <td className={`py-1 px-2 text-right font-mono font-semibold ${plColor(s.pl)}`}>
                        {fmt(s.pl)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Avg win/loss */}
          <div className="grid grid-cols-2 gap-3">
            <div className="border border-border rounded p-2">
              <div className="text-terminal-xs text-text-muted uppercase tracking-widest">Avg Win</div>
              <div className="text-base font-bold font-mono text-brand-green">{fmt(summary.avgWin)}</div>
            </div>
            <div className="border border-border rounded p-2">
              <div className="text-terminal-xs text-text-muted uppercase tracking-widest">Avg Loss</div>
              <div className="text-base font-bold font-mono text-brand-red">{fmt(summary.avgLoss)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Open Positions View */}
      {activeView === 'open' && (
        <div className="p-3 space-y-3">
          {/* Open Options */}
          {data.openPositions.options.length > 0 && (
            <div className="border border-border rounded overflow-hidden">
              <div className="bg-bg-row px-3 py-1.5 text-terminal-lg font-semibold text-text-primary">
                Open Options ({data.openPositions.options.length})
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-terminal-base">
                  <thead className="bg-gray-50 text-text-secondary">
                    <tr>
                      <th className="py-1 px-2 text-left text-terminal-xs uppercase tracking-widest font-mono">Symbol</th>
                      <th className="py-1 px-2 text-left text-terminal-xs uppercase tracking-widest font-mono">Type</th>
                      <th className="py-1 px-2 text-right text-terminal-xs uppercase tracking-widest font-mono">Strike</th>
                      <th className="py-1 px-2 text-left text-terminal-xs uppercase tracking-widest font-mono">Exp</th>
                      <th className="py-1 px-2 text-right text-terminal-xs uppercase tracking-widest font-mono">Qty</th>
                      <th className="py-1 px-2 text-right text-terminal-xs uppercase tracking-widest font-mono">Cost Basis</th>
                      <th className="py-1 px-2 text-left text-terminal-xs uppercase tracking-widest font-mono">Opened</th>
                      <th className="py-1 px-2 text-left text-terminal-xs uppercase tracking-widest font-mono">Strategy</th>
                      <th className="py-1 px-2 text-right text-terminal-xs uppercase tracking-widest font-mono">Trade #</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.openPositions.options.map((p, idx) => (
                      <tr key={p.id} className={`border-b border-border-light hover:bg-bg-row ${idx % 2 === 0 ? 'bg-white' : 'bg-bg-row'}`}>
                        <td className="py-1 px-2 font-medium">{p.symbol}</td>
                        <td className="py-1 px-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            p.optionType === 'CALL' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {p.positionType} {p.optionType}
                          </span>
                        </td>
                        <td className="py-1 px-2 text-right font-mono font-semibold">${p.strike?.toFixed(2) ?? '-'}</td>
                        <td className="py-1 px-2 font-mono text-text-muted">{fmtDate(p.expiration)}</td>
                        <td className="py-1 px-2 text-right font-mono">{p.remainingQuantity}</td>
                        <td className="py-1 px-2 text-right font-mono font-semibold">{fmt(p.costBasis)}</td>
                        <td className="py-1 px-2 font-mono text-text-muted">{fmtDate(p.openDate)}</td>
                        <td className="py-1 px-2">{p.strategy}</td>
                        <td className="py-1 px-2 text-right font-mono text-text-faint">#{p.tradeNum}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Open Stocks */}
          {data.openPositions.stocks.length > 0 && (
            <div className="border border-border rounded overflow-hidden">
              <div className="bg-bg-row px-3 py-1.5 text-terminal-lg font-semibold text-text-primary">
                Open Stock Positions ({data.openPositions.stocks.length})
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-terminal-base">
                  <thead className="bg-gray-50 text-text-secondary">
                    <tr>
                      <th className="py-1 px-2 text-left text-terminal-xs uppercase tracking-widest font-mono">Symbol</th>
                      <th className="py-1 px-2 text-right text-terminal-xs uppercase tracking-widest font-mono">Shares</th>
                      <th className="py-1 px-2 text-right text-terminal-xs uppercase tracking-widest font-mono">Avg Cost</th>
                      <th className="py-1 px-2 text-right text-terminal-xs uppercase tracking-widest font-mono">Cost Basis</th>
                      <th className="py-1 px-2 text-right text-terminal-xs uppercase tracking-widest font-mono">Realized P&L</th>
                      <th className="py-1 px-2 text-left text-terminal-xs uppercase tracking-widest font-mono">Opened</th>
                      <th className="py-1 px-2 text-right text-terminal-xs uppercase tracking-widest font-mono">Lots</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.openPositions.stocks.map((p, idx) => (
                      <tr key={p.symbol} className={`border-b border-border-light hover:bg-bg-row ${idx % 2 === 0 ? 'bg-white' : 'bg-bg-row'}`}>
                        <td className="py-1 px-2 font-medium">{p.symbol}</td>
                        <td className="py-1 px-2 text-right font-mono">{p.shares.remaining}</td>
                        <td className="py-1 px-2 text-right font-mono font-semibold">${p.avgCostPerShare.toFixed(2)}</td>
                        <td className="py-1 px-2 text-right font-mono font-semibold">{fmt(p.remainingCostBasis)}</td>
                        <td className={`py-1 px-2 text-right font-mono font-semibold ${plColor(p.realizedPL)}`}>
                          {fmt(p.realizedPL)}
                        </td>
                        <td className="py-1 px-2 font-mono text-text-muted">{fmtDate(p.openDate)}</td>
                        <td className="py-1 px-2 text-right font-mono text-text-faint">{p.lotCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {data.openPositions.options.length === 0 && data.openPositions.stocks.length === 0 && (
            <div className="text-center text-terminal-sm text-text-muted py-8">No open positions</div>
          )}
        </div>
      )}

      {/* Closed Positions View */}
      {activeView === 'closed' && (
        <div className="p-3 space-y-3">
          {/* Closed Options */}
          {data.closedPositions.options.length > 0 && (
            <div className="border border-border rounded overflow-hidden">
              <div className="bg-bg-row px-3 py-1.5 text-terminal-lg font-semibold text-text-primary">
                Closed Options ({data.closedPositions.options.length})
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-terminal-base">
                  <thead className="bg-gray-50 text-text-secondary">
                    <tr>
                      <th className="py-1 px-2 text-left text-terminal-xs uppercase tracking-widest font-mono">Symbol</th>
                      <th className="py-1 px-2 text-left text-terminal-xs uppercase tracking-widest font-mono">Type</th>
                      <th className="py-1 px-2 text-right text-terminal-xs uppercase tracking-widest font-mono">Strike</th>
                      <th className="py-1 px-2 text-right text-terminal-xs uppercase tracking-widest font-mono">Qty</th>
                      <th className="py-1 px-2 text-right text-terminal-xs uppercase tracking-widest font-mono">Cost Basis</th>
                      <th className="py-1 px-2 text-right text-terminal-xs uppercase tracking-widest font-mono">Proceeds</th>
                      <th className="py-1 px-2 text-right text-terminal-xs uppercase tracking-widest font-mono">P&L</th>
                      <th className="py-1 px-2 text-right text-terminal-xs uppercase tracking-widest font-mono">Days</th>
                      <th className="py-1 px-2 text-left text-terminal-xs uppercase tracking-widest font-mono">Term</th>
                      <th className="py-1 px-2 text-left text-terminal-xs uppercase tracking-widest font-mono">Closed</th>
                      <th className="py-1 px-2 text-right text-terminal-xs uppercase tracking-widest font-mono">Trade #</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.closedPositions.options.map((p, idx) => (
                      <tr key={p.id} className={`border-b border-border-light hover:bg-bg-row ${idx % 2 === 0 ? 'bg-white' : 'bg-bg-row'}`}>
                        <td className="py-1 px-2 font-medium">{p.symbol}</td>
                        <td className="py-1 px-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            p.optionType === 'CALL' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {p.positionType} {p.optionType}
                          </span>
                        </td>
                        <td className="py-1 px-2 text-right font-mono font-semibold">${p.strike?.toFixed(2) ?? '-'}</td>
                        <td className="py-1 px-2 text-right font-mono">{p.quantity}</td>
                        <td className="py-1 px-2 text-right font-mono font-semibold">{fmt(p.costBasis)}</td>
                        <td className="py-1 px-2 text-right font-mono font-semibold">{fmt(p.proceeds)}</td>
                        <td className={`py-1 px-2 text-right font-mono font-semibold ${plColor(p.realizedPL)}`}>
                          {fmt(p.realizedPL)}
                        </td>
                        <td className="py-1 px-2 text-right font-mono text-text-muted">{p.holdingDays ?? '-'}</td>
                        <td className="py-1 px-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            p.isLongTerm ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {p.isLongTerm ? 'LT' : 'ST'}
                          </span>
                        </td>
                        <td className="py-1 px-2 font-mono text-text-muted">{fmtDate(p.closeDate)}</td>
                        <td className="py-1 px-2 text-right font-mono text-text-faint">#{p.tradeNum}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Closed Stocks */}
          {data.closedPositions.stocks.length > 0 && (
            <div className="border border-border rounded overflow-hidden">
              <div className="bg-bg-row px-3 py-1.5 text-terminal-lg font-semibold text-text-primary">
                Closed Stock Positions ({data.closedPositions.stocks.length})
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-terminal-base">
                  <thead className="bg-gray-50 text-text-secondary">
                    <tr>
                      <th className="py-1 px-2 text-left text-terminal-xs uppercase tracking-widest font-mono">Symbol</th>
                      <th className="py-1 px-2 text-right text-terminal-xs uppercase tracking-widest font-mono">Shares</th>
                      <th className="py-1 px-2 text-right text-terminal-xs uppercase tracking-widest font-mono">Cost Basis</th>
                      <th className="py-1 px-2 text-right text-terminal-xs uppercase tracking-widest font-mono">Proceeds</th>
                      <th className="py-1 px-2 text-right text-terminal-xs uppercase tracking-widest font-mono">P&L</th>
                      <th className="py-1 px-2 text-right text-terminal-xs uppercase tracking-widest font-mono">ST P&L</th>
                      <th className="py-1 px-2 text-right text-terminal-xs uppercase tracking-widest font-mono">LT P&L</th>
                      <th className="py-1 px-2 text-left text-terminal-xs uppercase tracking-widest font-mono">Closed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.closedPositions.stocks.map((p, idx) => (
                      <tr key={p.symbol} className={`border-b border-border-light hover:bg-bg-row ${idx % 2 === 0 ? 'bg-white' : 'bg-bg-row'}`}>
                        <td className="py-1 px-2 font-medium">{p.symbol}</td>
                        <td className="py-1 px-2 text-right font-mono">{p.shares.original}</td>
                        <td className="py-1 px-2 text-right font-mono font-semibold">{fmt(p.costBasis)}</td>
                        <td className="py-1 px-2 text-right font-mono font-semibold">{fmt(p.proceeds)}</td>
                        <td className={`py-1 px-2 text-right font-mono font-semibold ${plColor(p.realizedPL)}`}>
                          {fmt(p.realizedPL)}
                        </td>
                        <td className={`py-1 px-2 text-right font-mono ${plColor(p.shortTermPL)}`}>
                          {fmt(p.shortTermPL)}
                        </td>
                        <td className={`py-1 px-2 text-right font-mono ${plColor(p.longTermPL)}`}>
                          {fmt(p.longTermPL)}
                        </td>
                        <td className="py-1 px-2 font-mono text-text-muted">{fmtDate(p.closeDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {data.closedPositions.options.length === 0 && data.closedPositions.stocks.length === 0 && (
            <div className="text-center text-terminal-sm text-text-muted py-8">No closed positions</div>
          )}
        </div>
      )}
    </div>
  );
}
