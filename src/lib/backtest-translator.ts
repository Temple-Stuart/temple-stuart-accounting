// Backtest Translator — converts StrategyCard into Tastytrade backtester API format
// Backtester API: backtester.vast.tastyworks.com

import type { StrategyCard } from './strategy-builder';

// ─── Backtester Request Types ─────────────────────────────────────

export interface BacktestLeg {
  side: 'sell' | 'buy';
  type: 'call' | 'put';
  delta: number; // Must be a multiple of 5 (e.g. 10, 15, 20, 25)
}

export interface BacktestManagement {
  profitTargetPercent: number;  // e.g. 50 = close at 50% of max profit
  stopLossPercent: number;      // e.g. 200 = close at 200% of credit received
  exitDte: number;              // close position at N DTE remaining
}

export interface BacktestConfig {
  symbol: string;
  strategyType: string;
  legs: BacktestLeg[];
  dte: number;
  management: BacktestManagement;
  startDate: string;  // YYYY-MM-DD
  endDate: string;     // YYYY-MM-DD
}

// ─── Backtester Response Types ────────────────────────────────────

export interface BacktestTrade {
  entryDate: string;
  exitDate: string;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  pnlPercent: number;
  holdingDays: number;
  exitReason: 'profit_target' | 'stop_loss' | 'dte_exit' | 'expiration';
  maxDrawdown: number;
}

export interface BacktestResult {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  config: BacktestConfig;
  trades: BacktestTrade[];
  summary: {
    totalTrades: number;
    winRate: number;
    avgPnl: number;
    totalPnl: number;
    maxDrawdown: number;
    sharpeRatio: number;
    profitFactor: number;
    avgHoldingDays: number;
    avgWin: number;
    avgLoss: number;
    maxWin: number;
    maxLoss: number;
    consecutiveWins: number;
    consecutiveLosses: number;
  };
  equityCurve: { date: string; equity: number }[];
  monthlyReturns: { year: number; month: number; pnl: number; trades: number }[];
  error?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────

/** Round a delta (0-1 decimal) to nearest multiple of 5 (integer).
 *  The backtester uses integer deltas in multiples of 5. */
function roundDelta(delta: number): number {
  const abs = Math.abs(delta) * 100; // Convert 0.16 → 16
  const rounded = Math.round(abs / 5) * 5;
  return Math.max(5, Math.min(50, rounded)); // Clamp 5–50
}

/** Map strategy name to backtester strategy type identifier */
function mapStrategyType(name: string): string {
  const map: Record<string, string> = {
    'Iron Condor': 'iron_condor',
    'Put Credit Spread': 'short_put_vertical',
    'Call Credit Spread': 'short_call_vertical',
    'Short Strangle': 'short_strangle',
    'Short Straddle': 'short_straddle',
    'Bull Call Spread': 'long_call_vertical',
    'Bear Put Spread': 'long_put_vertical',
    'Debit Spread': 'long_call_vertical',
    'Long Straddle': 'long_straddle',
    'Long Strangle': 'long_strangle',
    'Jade Lizard': 'jade_lizard',
  };
  return map[name] || 'custom';
}

// ─── Translator ───────────────────────────────────────────────────

/** Convert a StrategyCard into a BacktestConfig ready for the backtester API */
export function translateToBacktest(
  card: StrategyCard,
  symbol: string,
  overrides?: Partial<Pick<BacktestConfig, 'dte' | 'startDate' | 'endDate' | 'management'>>
): BacktestConfig {
  const legs: BacktestLeg[] = card.legs.map(leg => ({
    side: leg.side,
    type: leg.type,
    delta: roundDelta(leg.delta),
  }));

  // Default management rules
  const defaultManagement: BacktestManagement = {
    profitTargetPercent: 50,
    stopLossPercent: 200,
    exitDte: 21,
  };

  // Default date range: 5 years back from today
  const endDate = new Date();
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 5);

  return {
    symbol: symbol.toUpperCase(),
    strategyType: mapStrategyType(card.name),
    legs,
    dte: overrides?.dte ?? card.dte,
    management: overrides?.management ?? defaultManagement,
    startDate: overrides?.startDate ?? startDate.toISOString().slice(0, 10),
    endDate: overrides?.endDate ?? endDate.toISOString().slice(0, 10),
  };
}

/** Get default management rules for a strategy type */
export function getDefaultManagement(strategyName: string): BacktestManagement {
  // Credit strategies: close at 50% profit, 200% stop
  if (['Iron Condor', 'Put Credit Spread', 'Call Credit Spread', 'Short Strangle', 'Short Straddle', 'Jade Lizard'].includes(strategyName)) {
    return { profitTargetPercent: 50, stopLossPercent: 200, exitDte: 21 };
  }
  // Debit strategies: close at 100% profit, 50% stop
  return { profitTargetPercent: 100, stopLossPercent: 50, exitDte: 7 };
}

/** Build the backtester API request body from a BacktestConfig */
export function buildBacktestRequest(config: BacktestConfig): Record<string, unknown> {
  return {
    symbol: config.symbol,
    'strategy-type': config.strategyType,
    legs: config.legs.map(leg => ({
      side: leg.side,
      'option-type': leg.type,
      delta: leg.delta,
    })),
    'target-dte': config.dte,
    'start-date': config.startDate,
    'end-date': config.endDate,
    management: {
      'profit-target-percent': config.management.profitTargetPercent,
      'stop-loss-percent': config.management.stopLossPercent,
      'exit-dte': config.management.exitDte,
    },
  };
}

/** Parse the backtester API response into our BacktestResult type */
export function parseBacktestResponse(raw: Record<string, any>, config: BacktestConfig): BacktestResult {
  const rawTrades = raw['trades'] || raw['results'] || [];
  const trades: BacktestTrade[] = rawTrades.map((t: any) => ({
    entryDate: t['entry-date'] || t['open-date'] || '',
    exitDate: t['exit-date'] || t['close-date'] || '',
    entryPrice: parseFloat(t['entry-price'] || t['open-price'] || 0),
    exitPrice: parseFloat(t['exit-price'] || t['close-price'] || 0),
    pnl: parseFloat(t['pnl'] || t['profit-loss'] || 0),
    pnlPercent: parseFloat(t['pnl-percent'] || t['return-percent'] || 0),
    holdingDays: parseInt(t['holding-days'] || t['days-held'] || 0, 10),
    exitReason: mapExitReason(t['exit-reason'] || t['close-reason'] || ''),
    maxDrawdown: parseFloat(t['max-drawdown'] || 0),
  }));

  // Compute summary stats
  const wins = trades.filter(t => t.pnl > 0);
  const losses = trades.filter(t => t.pnl <= 0);
  const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);
  const avgPnl = trades.length > 0 ? totalPnl / trades.length : 0;
  const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((s, t) => s + t.pnl, 0) / losses.length : 0;
  const grossWins = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLosses = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));

  // Equity curve
  let equity = 0;
  const equityCurve: { date: string; equity: number }[] = [];
  let maxEquity = 0;
  let maxDd = 0;
  for (const t of trades) {
    equity += t.pnl;
    maxEquity = Math.max(maxEquity, equity);
    maxDd = Math.max(maxDd, maxEquity - equity);
    equityCurve.push({ date: t.exitDate, equity });
  }

  // Monthly returns
  const monthMap = new Map<string, { pnl: number; trades: number }>();
  for (const t of trades) {
    const d = t.exitDate.slice(0, 7); // YYYY-MM
    const existing = monthMap.get(d) || { pnl: 0, trades: 0 };
    existing.pnl += t.pnl;
    existing.trades += 1;
    monthMap.set(d, existing);
  }
  const monthlyReturns = Array.from(monthMap.entries()).map(([key, val]) => ({
    year: parseInt(key.slice(0, 4)),
    month: parseInt(key.slice(5, 7)),
    pnl: Math.round(val.pnl * 100) / 100,
    trades: val.trades,
  }));

  // Sharpe ratio approximation (annualized, using monthly returns)
  const monthlyPnls = monthlyReturns.map(m => m.pnl);
  const meanMonthly = monthlyPnls.length > 0 ? monthlyPnls.reduce((a, b) => a + b, 0) / monthlyPnls.length : 0;
  const variance = monthlyPnls.length > 1
    ? monthlyPnls.reduce((s, p) => s + (p - meanMonthly) ** 2, 0) / (monthlyPnls.length - 1)
    : 0;
  const stdMonthly = Math.sqrt(variance);
  const sharpe = stdMonthly > 0 ? (meanMonthly / stdMonthly) * Math.sqrt(12) : 0;

  // Consecutive wins/losses
  let maxConsWins = 0, maxConsLosses = 0, consWins = 0, consLosses = 0;
  for (const t of trades) {
    if (t.pnl > 0) { consWins++; consLosses = 0; maxConsWins = Math.max(maxConsWins, consWins); }
    else { consLosses++; consWins = 0; maxConsLosses = Math.max(maxConsLosses, consLosses); }
  }

  // Use server-provided summary if available, otherwise our computed values
  const serverSummary = raw['summary'] || {};

  return {
    id: raw['id'] || raw['backtest-id'] || '',
    status: raw['status'] === 'completed' || raw['status'] === 'complete' ? 'completed' : (raw['status'] || 'completed') as any,
    config,
    trades,
    summary: {
      totalTrades: serverSummary['total-trades'] ?? trades.length,
      winRate: serverSummary['win-rate'] ?? (trades.length > 0 ? wins.length / trades.length : 0),
      avgPnl: serverSummary['avg-pnl'] ?? Math.round(avgPnl * 100) / 100,
      totalPnl: serverSummary['total-pnl'] ?? Math.round(totalPnl * 100) / 100,
      maxDrawdown: serverSummary['max-drawdown'] ?? Math.round(maxDd * 100) / 100,
      sharpeRatio: serverSummary['sharpe-ratio'] ?? Math.round(sharpe * 100) / 100,
      profitFactor: serverSummary['profit-factor'] ?? (grossLosses > 0 ? Math.round((grossWins / grossLosses) * 100) / 100 : grossWins > 0 ? Infinity : 0),
      avgHoldingDays: serverSummary['avg-holding-days'] ?? Math.round(trades.reduce((s, t) => s + t.holdingDays, 0) / Math.max(1, trades.length)),
      avgWin: serverSummary['avg-win'] ?? Math.round(avgWin * 100) / 100,
      avgLoss: serverSummary['avg-loss'] ?? Math.round(avgLoss * 100) / 100,
      maxWin: serverSummary['max-win'] ?? (wins.length > 0 ? Math.max(...wins.map(t => t.pnl)) : 0),
      maxLoss: serverSummary['max-loss'] ?? (losses.length > 0 ? Math.min(...losses.map(t => t.pnl)) : 0),
      consecutiveWins: maxConsWins,
      consecutiveLosses: maxConsLosses,
    },
    equityCurve,
    monthlyReturns,
  };
}

function mapExitReason(reason: string): BacktestTrade['exitReason'] {
  const r = reason.toLowerCase();
  if (r.includes('profit')) return 'profit_target';
  if (r.includes('stop') || r.includes('loss')) return 'stop_loss';
  if (r.includes('dte') || r.includes('exit')) return 'dte_exit';
  return 'expiration';
}
