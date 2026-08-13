'use client';

import { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, ReferenceLine,
} from 'recharts';
import type { BacktestResult, BacktestManagement } from '@/lib/backtest-translator';
import type { StrategyCard } from '@/lib/strategy-builder';

// ─── Types ────────────────────────────────────────────────────────

interface BacktestPanelProps {
  symbol: string;
  card: StrategyCard;
  onClose: () => void;
}

interface BacktestState {
  status: 'idle' | 'checking' | 'configuring' | 'running' | 'done' | 'error';
  available: boolean | null;
  dateRange: { start: string; end: string } | null;
  result: BacktestResult | null;
  error: string | null;
}

// ─── Hero Stats ───────────────────────────────────────────────────

function HeroStats({ result }: { result: BacktestResult }) {
  // DIRECTION-C (ruling 5): these hexes ARE the canonical tokens — recharts
  // props are SVG attributes where CSS var() cannot resolve, so the literal
  // values stay, pinned to the token registry: #16a34a=--ts-green, #c53030=
  // --ts-red, #f59e0b=--ts-warning, #7a7488=--ts-text-muted (globals.css:74,
  // 75,83,63). No arbitrary hex survives.
  const s = result.summary;
  const stats = [
    { label: 'Est. PoP', value: `${Math.round(s.winRate * 100)}%`, color: s.winRate >= 0.5 ? '#16a34a' : '#c53030' },
    { label: 'Total P&L', value: `$${s.totalPnl.toLocaleString()}`, color: s.totalPnl >= 0 ? '#16a34a' : '#c53030' },
    { label: 'Avg P&L', value: `$${s.avgPnl.toFixed(0)}`, color: s.avgPnl >= 0 ? '#16a34a' : '#c53030' },
    { label: 'Max Drawdown', value: `$${s.maxDrawdown.toFixed(0)}`, color: '#c53030' },
    { label: 'Sharpe', value: s.sharpeRatio.toFixed(2), color: s.sharpeRatio >= 1 ? '#16a34a' : s.sharpeRatio >= 0.5 ? '#f59e0b' : '#c53030' },
    { label: 'Profit Factor', value: s.profitFactor === Infinity ? '∞' : s.profitFactor.toFixed(2), color: s.profitFactor >= 1.5 ? '#16a34a' : '#f59e0b' },
    { label: 'Total Trades', value: String(s.totalTrades), color: '#7a7488' },
    { label: 'Avg Days Held', value: String(s.avgHoldingDays), color: '#7a7488' },
  ];

  return (
    <div className="grid grid-cols-4 gap-2 mb-4">
      {stats.map((st, i) => (
        <div key={i} className="bg-white border border-border rounded p-2 text-center">
          <div className="text-[10px] text-text-muted uppercase tracking-wide">{st.label}</div>
          <div className="text-sm font-bold font-mono" style={{ color: st.color }}>{st.value}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Equity Curve ─────────────────────────────────────────────────

function EquityCurve({ result }: { result: BacktestResult }) {
  const data = useMemo(() => {
    return [{ date: result.config.startDate, equity: 0 }, ...result.equityCurve];
  }, [result]);

  if (data.length < 2) return null;

  return (
    <div className="mb-4">
      <div className="text-xs font-semibold text-text-faint mb-2">Equity Curve</div>
      {/* DIRECTION-C (rulings 4+5): chart chrome in CSS contexts uses the DS
          vars (var(--ts-white), rgb(var(--ts-border)), var(--ts-text)); SVG
          attribute props keep canonical literals — #DDD6E8=--ts-border,
          #4a4a5a=--ts-text-secondary, #a8a2b0=--ts-text-faint, #3b2d6b=
          --ts-purple, #16a34a/#c53030=--ts-green/--ts-red (globals.css:24,
          62-64,70,74-75). */}
      <div className="bg-white border border-border rounded p-3">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#DDD6E8" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 9, fill: '#4a4a5a' }}
              tickFormatter={(d: string) => d.slice(0, 7)}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 9, fill: '#4a4a5a' }}
              tickFormatter={(v: number) => `$${v.toFixed(0)}`}
            />
            <Tooltip
              contentStyle={{ background: 'var(--ts-white)', border: '1px solid rgb(var(--ts-border))', fontSize: 11, color: 'var(--ts-text)' }}
              formatter={(value: any) => [`$${Number(value).toFixed(2)}`, 'Equity']}
              labelFormatter={(label: any) => `Date: ${label}`}
            />
            <ReferenceLine y={0} stroke="#DDD6E8" />
            <Line
              type="monotone"
              dataKey="equity"
              stroke="#3b2d6b"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Monthly Heatmap ──────────────────────────────────────────────

function MonthlyHeatmap({ result }: { result: BacktestResult }) {
  const { years, monthData } = useMemo(() => {
    const yrs = [...new Set(result.monthlyReturns.map(m => m.year))].sort();
    const md = new Map<string, number>();
    for (const m of result.monthlyReturns) {
      md.set(`${m.year}-${m.month}`, m.pnl);
    }
    return { years: yrs, monthData: md };
  }, [result]);

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const maxAbs = Math.max(1, ...result.monthlyReturns.map(m => Math.abs(m.pnl)));

  function cellColor(pnl: number | undefined): string {
    if (pnl === undefined) return '#F3EFE6';
    const intensity = Math.min(1, Math.abs(pnl) / maxAbs);
    if (pnl >= 0) return `rgba(22, 163, 74, ${0.15 + intensity * 0.6})`;
    return `rgba(197, 48, 48, ${0.15 + intensity * 0.6})`;
  }

  if (years.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="text-xs font-semibold text-text-faint mb-2">Monthly Returns</div>
      <div className="bg-white border border-border rounded p-3 overflow-x-auto">
        <table className="w-full text-[10px]">
          <thead>
            <tr>
              <th className="text-left text-text-muted px-1">Year</th>
              {months.map(m => (
                <th key={m} className="text-center text-text-muted px-1">{m}</th>
              ))}
              <th className="text-center text-text-muted px-1">Total</th>
            </tr>
          </thead>
          <tbody>
            {years.map(year => {
              const yearTotal = result.monthlyReturns
                .filter(m => m.year === year)
                .reduce((s, m) => s + m.pnl, 0);
              return (
                <tr key={year}>
                  <td className="text-text-faint px-1 font-mono">{year}</td>
                  {months.map((_, mi) => {
                    const pnl = monthData.get(`${year}-${mi + 1}`);
                    return (
                      <td
                        key={mi}
                        className="text-center px-1 font-mono"
                        style={{
                          backgroundColor: cellColor(pnl),
                          color: pnl !== undefined ? (pnl >= 0 ? '#16a34a' : '#c53030') : '#a8a2b0',
                        }}
                      >
                        {pnl !== undefined ? `$${Math.round(pnl)}` : '-'}
                      </td>
                    );
                  })}
                  <td
                    className="text-center px-1 font-mono font-bold"
                    style={{ color: yearTotal >= 0 ? '#16a34a' : '#c53030' }}
                  >
                    ${Math.round(yearTotal)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── P&L Distribution ─────────────────────────────────────────────

function PnlDistribution({ result }: { result: BacktestResult }) {
  const bins = useMemo(() => {
    if (result.trades.length === 0) return [];
    const pnls = result.trades.map(t => t.pnl);
    const min = Math.min(...pnls);
    const max = Math.max(...pnls);
    const range = max - min || 1;
    const nBins = Math.min(20, Math.max(5, Math.ceil(Math.sqrt(pnls.length))));
    const binWidth = range / nBins;
    const b: { range: string; count: number; midPnl: number }[] = [];
    for (let i = 0; i < nBins; i++) {
      const lo = min + i * binWidth;
      const hi = lo + binWidth;
      const count = pnls.filter(p => p >= lo && (i === nBins - 1 ? p <= hi : p < hi)).length;
      b.push({ range: `$${Math.round(lo)}`, count, midPnl: (lo + hi) / 2 });
    }
    return b;
  }, [result]);

  if (bins.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="text-xs font-semibold text-text-faint mb-2">P&L Distribution</div>
      <div className="bg-white border border-border rounded p-3">
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={bins}>
            <CartesianGrid strokeDasharray="3 3" stroke="#DDD6E8" />
            <XAxis dataKey="range" tick={{ fontSize: 8, fill: '#4a4a5a' }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 9, fill: '#4a4a5a' }} />
            <Tooltip
              contentStyle={{ background: 'var(--ts-white)', border: '1px solid rgb(var(--ts-border))', fontSize: 11, color: 'var(--ts-text)' }}
              formatter={(value: any) => [value, 'Trades']}
            />
            <Bar dataKey="count">
              {bins.map((b, i) => (
                <Cell key={i} fill={b.midPnl >= 0 ? '#16a34a' : '#c53030'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Trade Log ────────────────────────────────────────────────────

function TradeLog({ result }: { result: BacktestResult }) {
  const [expanded, setExpanded] = useState(false);
  const trades = expanded ? result.trades : result.trades.slice(0, 20);

  return (
    <div className="mb-4">
      <div className="text-xs font-semibold text-text-faint mb-2">
        Trade Log ({result.trades.length} trades)
      </div>
      <div className="bg-white border border-border rounded overflow-hidden">
        <div className="max-h-[300px] overflow-y-auto">
          <table className="w-full text-[10px]">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-border">
                <th className="text-left px-2 py-1 text-text-muted">#</th>
                <th className="text-left px-2 py-1 text-text-muted">Entry</th>
                <th className="text-left px-2 py-1 text-text-muted">Exit</th>
                <th className="text-right px-2 py-1 text-text-muted">Days</th>
                <th className="text-right px-2 py-1 text-text-muted">P&L</th>
                <th className="text-right px-2 py-1 text-text-muted">P&L %</th>
                <th className="text-left px-2 py-1 text-text-muted">Exit Reason</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t, i) => (
                <tr key={i} className="border-b border-panel-hover hover:bg-bg-row">
                  <td className="px-2 py-1 text-text-muted font-mono">{i + 1}</td>
                  <td className="px-2 py-1 text-text-faint font-mono">{t.entryDate}</td>
                  <td className="px-2 py-1 text-text-faint font-mono">{t.exitDate}</td>
                  <td className="px-2 py-1 text-text-faint font-mono text-right">{t.holdingDays}</td>
                  <td className="px-2 py-1 font-mono text-right" style={{ color: t.pnl >= 0 ? '#16a34a' : '#c53030' }}>
                    {t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(0)}
                  </td>
                  <td className="px-2 py-1 font-mono text-right" style={{ color: t.pnlPercent >= 0 ? '#16a34a' : '#c53030' }}>
                    {t.pnlPercent >= 0 ? '+' : ''}{(t.pnlPercent * 100).toFixed(1)}%
                  </td>
                  <td className="px-2 py-1 text-text-muted">
                    {t.exitReason.replace('_', ' ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {result.trades.length > 20 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full text-[10px] text-brand-purple hover:text-brand-purple-hover py-1 border-t border-border"
          >
            {expanded ? 'Show less' : `Show all ${result.trades.length} trades`}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Configuration Panel ──────────────────────────────────────────

function ConfigPanel({
  management,
  dte,
  startDate,
  endDate,
  onChange,
}: {
  management: BacktestManagement;
  dte: number;
  startDate: string;
  endDate: string;
  onChange: (updates: { management?: Partial<BacktestManagement>; dte?: number; startDate?: string; endDate?: string }) => void;
}) {
  return (
    <div className="mb-4">
      <div className="text-xs font-semibold text-text-faint mb-2">Configuration</div>
      <div className="bg-white border border-border rounded p-3 grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] text-text-muted block mb-1">Target DTE</label>
          <input
            type="number"
            value={dte}
            onChange={e => onChange({ dte: parseInt(e.target.value) || 45 })}
            className="w-full bg-white border border-border rounded px-2 py-1 text-xs text-text-faint font-mono"
          />
        </div>
        <div>
          <label className="text-[10px] text-text-muted block mb-1">Profit Target %</label>
          <input
            type="number"
            value={management.profitTargetPercent}
            onChange={e => onChange({ management: { profitTargetPercent: parseInt(e.target.value) || 50 } })}
            className="w-full bg-white border border-border rounded px-2 py-1 text-xs text-text-faint font-mono"
          />
        </div>
        <div>
          <label className="text-[10px] text-text-muted block mb-1">Stop Loss %</label>
          <input
            type="number"
            value={management.stopLossPercent}
            onChange={e => onChange({ management: { stopLossPercent: parseInt(e.target.value) || 200 } })}
            className="w-full bg-white border border-border rounded px-2 py-1 text-xs text-text-faint font-mono"
          />
        </div>
        <div>
          <label className="text-[10px] text-text-muted block mb-1">Exit at DTE</label>
          <input
            type="number"
            value={management.exitDte}
            onChange={e => onChange({ management: { exitDte: parseInt(e.target.value) || 21 } })}
            className="w-full bg-white border border-border rounded px-2 py-1 text-xs text-text-faint font-mono"
          />
        </div>
        <div>
          <label className="text-[10px] text-text-muted block mb-1">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={e => onChange({ startDate: e.target.value })}
            className="w-full bg-white border border-border rounded px-2 py-1 text-xs text-text-faint font-mono"
          />
        </div>
        <div>
          <label className="text-[10px] text-text-muted block mb-1">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={e => onChange({ endDate: e.target.value })}
            className="w-full bg-white border border-border rounded px-2 py-1 text-xs text-text-faint font-mono"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────

export default function BacktestPanel({ symbol, card, onClose }: BacktestPanelProps) {
  const defaultEnd = new Date().toISOString().slice(0, 10);
  const defaultStart = new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [state, setState] = useState<BacktestState>({
    status: 'idle',
    available: null,
    dateRange: null,
    result: null,
    error: null,
  });

  const [dte, setDte] = useState(card.dte);
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [management, setManagement] = useState<BacktestManagement>({
    profitTargetPercent: card.netCredit != null ? 50 : 100,
    stopLossPercent: card.netCredit != null ? 200 : 50,
    exitDte: 21,
  });

  // Check availability on mount-like interaction
  async function checkAvailability() {
    setState(prev => ({ ...prev, status: 'checking', error: null }));
    try {
      const resp = await fetch(`/api/tastytrade/backtest/available?symbol=${encodeURIComponent(symbol)}`);
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Failed to check availability');
      if (!data.available) {
        setState(prev => ({ ...prev, status: 'error', error: data.message || `${symbol} not available for backtesting` }));
        return;
      }
      setState(prev => ({
        ...prev,
        status: 'configuring',
        available: true,
        dateRange: { start: data.startDate, end: data.endDate },
      }));
      if (data.startDate) setStartDate(data.startDate);
      if (data.endDate) setEndDate(data.endDate);
    } catch (err: any) {
      setState(prev => ({ ...prev, status: 'error', error: err.message }));
    }
  }

  async function runBacktest() {
    setState(prev => ({ ...prev, status: 'running', error: null }));
    try {
      const config = {
        symbol,
        strategyType: card.name.toLowerCase().replace(/\s+/g, '_'),
        legs: card.legs.map(leg => ({
          side: leg.side,
          type: leg.type,
          delta: roundDeltaForDisplay(leg.delta),
        })),
        dte,
        management,
        startDate,
        endDate,
      };

      const resp = await fetch('/api/tastytrade/backtest/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Backtest failed');

      setState(prev => ({ ...prev, status: 'done', result: data.result }));
    } catch (err: any) {
      setState(prev => ({ ...prev, status: 'error', error: err.message }));
    }
  }

  function handleConfigChange(updates: { management?: Partial<BacktestManagement>; dte?: number; startDate?: string; endDate?: string }) {
    if (updates.management) setManagement(prev => ({ ...prev, ...updates.management }));
    if (updates.dte !== undefined) setDte(updates.dte);
    if (updates.startDate !== undefined) setStartDate(updates.startDate);
    if (updates.endDate !== undefined) setEndDate(updates.endDate);
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white border border-border rounded w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-white border-b border-border px-4 py-3 flex justify-between items-center">
          <div>
            <div className="text-sm font-bold text-text-primary">
              Backtest: {symbol} — {card.name}
            </div>
            <div className="text-[10px] text-text-muted">
              {card.legs.map(l => `${l.side === 'sell' ? 'S' : 'B'} ${l.strike}${l.type === 'call' ? 'C' : 'P'}`).join(' / ')}
              {' '} | {card.dte} DTE
            </div>
          </div>
          <button onClick={onClose} className="text-text-faint hover:text-text-primary text-sm leading-none">
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Idle state */}
          {state.status === 'idle' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="text-sm text-text-faint mb-4">
                Run a historical backtest of this {card.name} on {symbol}
              </div>
              <div className="text-[10px] text-text-secondary mb-6 max-w-md text-center">
                The backtester will simulate entering this strategy every cycle over the selected date range,
                applying your management rules to each trade.
              </div>
              <button
                onClick={checkAvailability}
                className="px-6 py-2 bg-brand-purple hover:bg-brand-purple-hover text-white text-sm font-medium rounded"
              >
                Check Availability
              </button>
            </div>
          )}

          {/* Checking */}
          {state.status === 'checking' && (
            <div className="flex items-center justify-center py-12 gap-2 text-text-faint text-sm">
              <div className="w-4 h-4 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
              Checking {symbol} backtest availability...
            </div>
          )}

          {/* Configuring */}
          {state.status === 'configuring' && (
            <div>
              <ConfigPanel
                management={management}
                dte={dte}
                startDate={startDate}
                endDate={endDate}
                onChange={handleConfigChange}
              />

              {/* Leg summary */}
              <div className="mb-4">
                <div className="text-xs font-semibold text-text-faint mb-2">Strategy Legs (delta targets)</div>
                <div className="bg-white border border-border rounded p-3 flex gap-4">
                  {card.legs.map((leg, i) => (
                    <div key={i} className="text-[11px] font-mono">
                      <span className={leg.side === 'sell' ? 'text-emerald-400' : 'text-blue-400'}>
                        {leg.side === 'sell' ? 'SELL' : 'BUY'}
                      </span>{' '}
                      <span className="text-text-faint">{leg.type === 'call' ? 'C' : 'P'}</span>{' '}
                      <span className="text-text-faint">{'\u0394'}{roundDeltaForDisplay(leg.delta)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={runBacktest}
                  className="px-6 py-2 bg-brand-purple hover:bg-brand-purple-hover text-white text-sm font-medium rounded"
                >
                  Run Backtest
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-text-faint hover:text-text-faint text-sm border border-border rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Running */}
          {state.status === 'running' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-brand-purple border-t-transparent rounded-full animate-spin mb-4" />
              <div className="text-sm text-text-faint">Running backtest for {symbol}...</div>
              <div className="text-[10px] text-text-secondary mt-2">
                Testing {card.name} from {startDate} to {endDate} ({dte} DTE entries)
              </div>
            </div>
          )}

          {/* Results */}
          {state.status === 'done' && state.result && (
            <div>
              <HeroStats result={state.result} />
              <EquityCurve result={state.result} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <MonthlyHeatmap result={state.result} />
                <PnlDistribution result={state.result} />
              </div>
              <TradeLog result={state.result} />

              {/* Re-run with different params */}
              <div className="border-t border-border pt-4 mt-4">
                <ConfigPanel
                  management={management}
                  dte={dte}
                  startDate={startDate}
                  endDate={endDate}
                  onChange={handleConfigChange}
                />
                <button
                  onClick={runBacktest}
                  className="px-6 py-2 bg-brand-purple hover:bg-brand-purple-hover text-white text-sm font-medium rounded"
                >
                  Re-run with New Settings
                </button>
              </div>
            </div>
          )}

          {/* Error */}
          {state.status === 'error' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="text-red-400 text-sm mb-2">{state.error}</div>
              <button
                onClick={checkAvailability}
                className="px-4 py-2 text-text-faint hover:text-text-faint text-sm border border-border rounded"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function roundDeltaForDisplay(delta: number): number {
  const abs = Math.abs(delta) * 100;
  const rounded = Math.round(abs / 5) * 5;
  return Math.max(5, Math.min(50, rounded));
}
