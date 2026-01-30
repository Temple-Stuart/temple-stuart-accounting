'use client';

import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/ui';

interface TradeSummary {
  totalTrades: number;
  openTrades: number;
  closedTrades: number;
  totalRealizedPL: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
}

interface Trade {
  tradeNum: string;
  type: string;
  underlying: string;
  strategy: string;
  status: 'OPEN' | 'CLOSED' | 'PARTIAL';
  openDate: string;
  closeDate: string | null;
  legs: number;
  realizedPL: number;
  shares?: { original: number; remaining: number; sold: number };
  costBasis?: number;
  proceeds?: number;
  shortTermPL?: number;
  longTermPL?: number;
  transactions?: any[];
}

interface StrategyBreakdown {
  strategy: string;
  count: number;
  wins: number;
  losses: number;
  pl: number;
}

interface TickerBreakdown {
  ticker: string;
  count: number;
  wins: number;
  losses: number;
  pl: number;
}

interface JournalEntry {
  id: string;
  tradeNum: string;
  entryDate: string;
  entryType: string;
  thesis: string | null;
  setup: string | null;
  emotion: string | null;
  mistakes: string | null;
  lessons: string | null;
  rating: number | null;
  tags: string[];
}

interface TradesData {
  summary: TradeSummary;
  trades: Trade[];
  byStrategy: StrategyBreakdown[];
  byTicker: TickerBreakdown[];
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
  positionType: string;
  quantity: number;
  price: number;
  amount: number;
}

interface OpensData {
  totalOpens: number;
  totalCloses: number;
  opens: OpenTransaction[];
  closes: OpenTransaction[];
  byDate: Record<string, OpenTransaction[]>;
  byDateAndUnderlying: Record<string, Record<string, OpenTransaction[]>>;
}

type TabType = 'overview' | 'journal' | 'positions' | 'commit';

const EMOTIONS = ['confident', 'neutral', 'nervous', 'fomo', 'revenge', 'greedy', 'fearful'];
const SETUPS = ['breakout', 'pullback', 'mean-reversion', 'momentum', 'earnings', 'theta-decay', 'volatility', 'other'];

const STRATEGY_OPTIONS = [
  { value: 'bull-call-spread', label: 'Bull Call Spread' },
  { value: 'bear-call-spread', label: 'Bear Call Spread' },
  { value: 'bull-put-spread', label: 'Bull Put Spread' },
  { value: 'bear-put-spread', label: 'Bear Put Spread' },
  { value: 'iron-condor', label: 'Iron Condor' },
  { value: 'iron-butterfly', label: 'Iron Butterfly' },
  { value: 'straddle', label: 'Straddle' },
  { value: 'strangle', label: 'Strangle' },
  { value: 'covered-call', label: 'Covered Call' },
  { value: 'cash-secured-put', label: 'Cash Secured Put' },
  { value: 'naked-call', label: 'Naked Call' },
  { value: 'naked-put', label: 'Naked Put' },
  { value: 'long-call', label: 'Long Call' },
  { value: 'long-put', label: 'Long Put' },
  { value: 'stock-long', label: 'Stock Long' },
  { value: 'stock-short', label: 'Stock Short' },
  { value: 'custom', label: 'Custom / Other' },
];

export default function TradingPage() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [tradesData, setTradesData] = useState<TradesData | null>(null);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [opensData, setOpensData] = useState<OpensData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Date range filter
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  
  // Journal modal
  const [journalModal, setJournalModal] = useState<{ trade: Trade; entry?: JournalEntry } | null>(null);
  const [journalForm, setJournalForm] = useState({
    entryType: 'post-trade',
    thesis: '',
    setup: '',
    emotion: 'neutral',
    mistakes: '',
    lessons: '',
    rating: 3,
    tags: ''
  });
  const [saving, setSaving] = useState(false);

  // Expanded trade details
  const [expandedTrade, setExpandedTrade] = useState<string | null>(null);

  // Commit modal state
  const [commitModal, setCommitModal] = useState<{
    underlying: string;
    legs: OpenTransaction[];
    detectedStrategy: string;
  } | null>(null);
  const [commitStrategy, setCommitStrategy] = useState('');
  const [committing, setCommitting] = useState(false);
  const [maxTradeNum, setMaxTradeNum] = useState(0);

  useEffect(() => {
    Promise.all([
      fetch('/api/trading/trades').then(res => res.json()),
      fetch('/api/trading-journal').then(res => res.ok ? res.json() : { entries: [] }),
      fetch('/api/investment-transactions/max-trade-num').then(res => res.ok ? res.json() : { maxTradeNum: 0 })
    ])
      .then(([tradesResult, journalResult, maxResult]) => {
        setTradesData(tradesResult);
        setJournalEntries(journalResult.entries || []);
        setMaxTradeNum(maxResult.maxTradeNum || 0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (activeTab === 'commit' && !opensData) {
      fetch('/api/investment-transactions/opens')
        .then(res => res.json())
        .then(setOpensData)
        .catch(console.error);
    }
  }, [activeTab, opensData]);

  // Filtered trades based on date range
  const filteredTrades = useMemo(() => {
    if (!tradesData?.trades) return [];
    let trades = tradesData.trades;
    
    if (dateFrom) {
      const from = new Date(dateFrom);
      trades = trades.filter(t => new Date(t.openDate) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59);
      trades = trades.filter(t => new Date(t.openDate) <= to);
    }
    
    return trades;
  }, [tradesData, dateFrom, dateTo]);

  // Recalculate metrics for filtered trades
  const filteredMetrics = useMemo(() => {
    const closed = filteredTrades.filter(t => t.status === 'CLOSED');
    const wins = closed.filter(t => t.realizedPL >= 0);
    const losses = closed.filter(t => t.realizedPL < 0);
    
    const totalPL = closed.reduce((sum, t) => sum + t.realizedPL, 0);
    const totalWins = wins.reduce((sum, t) => sum + t.realizedPL, 0);
    const totalLosses = Math.abs(losses.reduce((sum, t) => sum + t.realizedPL, 0));
    
    return {
      totalTrades: filteredTrades.length,
      openTrades: filteredTrades.filter(t => t.status === 'OPEN' || t.status === 'PARTIAL').length,
      closedTrades: closed.length,
      totalRealizedPL: totalPL,
      winRate: closed.length > 0 ? Math.round((wins.length / closed.length) * 100) : 0,
      avgWin: wins.length > 0 ? totalWins / wins.length : 0,
      avgLoss: losses.length > 0 ? totalLosses / losses.length : 0,
      profitFactor: totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? 999 : 0,
      largestWin: wins.length > 0 ? Math.max(...wins.map(t => t.realizedPL)) : 0,
      largestLoss: losses.length > 0 ? Math.min(...losses.map(t => t.realizedPL)) : 0,
      avgHoldDays: closed.length > 0 ? closed.reduce((sum, t) => {
        if (!t.closeDate) return sum;
        const days = Math.ceil((new Date(t.closeDate).getTime() - new Date(t.openDate).getTime()) / (1000 * 60 * 60 * 24));
        return sum + days;
      }, 0) / closed.length : 0,
      winStreak: calculateStreak(closed, true),
      lossStreak: calculateStreak(closed, false),
    };
  }, [filteredTrades]);

  // Equity curve data
  const equityCurve = useMemo(() => {
    const closed = filteredTrades
      .filter(t => t.status === 'CLOSED' && t.closeDate)
      .sort((a, b) => new Date(a.closeDate!).getTime() - new Date(b.closeDate!).getTime());
    
    let cumulative = 0;
    return closed.map(t => {
      cumulative += t.realizedPL;
      return { date: t.closeDate!, pl: t.realizedPL, cumulative, trade: t };
    });
  }, [filteredTrades]);

  // P&L by actual date (365 day calendar)
  const plByDate = useMemo(() => {
    const byDate: Record<string, { pl: number; count: number; trades: Trade[] }> = {};
    
    filteredTrades.filter(t => t.status === 'CLOSED' && t.closeDate).forEach(t => {
      const dateKey = new Date(t.closeDate!).toISOString().split('T')[0];
      if (!byDate[dateKey]) byDate[dateKey] = { pl: 0, count: 0, trades: [] };
      byDate[dateKey].pl += t.realizedPL;
      byDate[dateKey].count++;
      byDate[dateKey].trades.push(t);
    });
    
    return byDate;
  }, [filteredTrades]);

  // Calendar data for the last 365 days
  const calendarData = useMemo(() => {
    const today = new Date();
    const days: { date: Date; dateStr: string; pl: number; count: number }[] = [];
    
    for (let i = 364; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const data = plByDate[dateStr];
      days.push({
        date,
        dateStr,
        pl: data?.pl || 0,
        count: data?.count || 0
      });
    }
    
    return days;
  }, [plByDate]);

  // Group calendar by month for display
  const calendarByMonth = useMemo(() => {
    const months: Record<string, typeof calendarData> = {};
    calendarData.forEach(day => {
      const monthKey = day.dateStr.slice(0, 7); // YYYY-MM
      if (!months[monthKey]) months[monthKey] = [];
      months[monthKey].push(day);
    });
    return Object.entries(months).sort(([a], [b]) => a.localeCompare(b));
  }, [calendarData]);

  // P&L by strategy (filtered)
  const filteredByStrategy = useMemo(() => {
    const map: Record<string, StrategyBreakdown> = {};
    filteredTrades.filter(t => t.status === 'CLOSED').forEach(t => {
      const key = t.strategy || 'unknown';
      if (!map[key]) map[key] = { strategy: key, count: 0, wins: 0, losses: 0, pl: 0 };
      map[key].count++;
      map[key].pl += t.realizedPL;
      if (t.realizedPL >= 0) map[key].wins++;
      else map[key].losses++;
    });
    return Object.values(map).sort((a, b) => b.pl - a.pl);
  }, [filteredTrades]);

  // P&L by ticker (filtered)
  const filteredByTicker = useMemo(() => {
    const map: Record<string, TickerBreakdown> = {};
    filteredTrades.filter(t => t.status === 'CLOSED').forEach(t => {
      const key = t.underlying || 'UNKNOWN';
      if (!map[key]) map[key] = { ticker: key, count: 0, wins: 0, losses: 0, pl: 0 };
      map[key].count++;
      map[key].pl += t.realizedPL;
      if (t.realizedPL >= 0) map[key].wins++;
      else map[key].losses++;
    });
    return Object.values(map).sort((a, b) => b.pl - a.pl);
  }, [filteredTrades]);

  // Detect strategy from legs
  const detectStrategy = (legs: OpenTransaction[]): string => {
    if (legs.length === 0) return 'unknown';
    
    const options = legs.filter(l => l.isOption);
    const stocks = legs.filter(l => !l.isOption);
    
    // Single leg
    if (legs.length === 1) {
      const leg = legs[0];
      if (!leg.isOption) return leg.action === 'buy' ? 'stock-long' : 'stock-short';
      if (leg.action === 'buy_to_open' && leg.optionType === 'call') return 'long-call';
      if (leg.action === 'buy_to_open' && leg.optionType === 'put') return 'long-put';
      if (leg.action === 'sell_to_open' && leg.optionType === 'call') return 'naked-call';
      if (leg.action === 'sell_to_open' && leg.optionType === 'put') return 'cash-secured-put';
      return 'custom';
    }
    
    // Two leg spreads
    if (options.length === 2 && stocks.length === 0) {
      const calls = options.filter(o => o.optionType === 'call');
      const puts = options.filter(o => o.optionType === 'put');
      const buys = options.filter(o => o.action === 'buy_to_open');
      const sells = options.filter(o => o.action === 'sell_to_open');
      
      // Vertical spreads (same expiration, different strikes)
      if (calls.length === 2 && buys.length === 1 && sells.length === 1) {
        const buyLeg = buys[0];
        const sellLeg = sells[0];
        if ((buyLeg.strike || 0) < (sellLeg.strike || 0)) return 'bull-call-spread';
        return 'bear-call-spread';
      }
      
      if (puts.length === 2 && buys.length === 1 && sells.length === 1) {
        const buyLeg = buys[0];
        const sellLeg = sells[0];
        if ((buyLeg.strike || 0) > (sellLeg.strike || 0)) return 'bear-put-spread';
        return 'bull-put-spread';
      }
      
      // Straddle (same strike, different types)
      if (calls.length === 1 && puts.length === 1) {
        if (calls[0].strike === puts[0].strike) return buys.length === 2 ? 'straddle' : 'straddle';
        return buys.length === 2 ? 'strangle' : 'strangle';
      }
    }
    
    // Four leg (iron condor, iron butterfly)
    if (options.length === 4) {
      const calls = options.filter(o => o.optionType === 'call');
      const puts = options.filter(o => o.optionType === 'put');
      if (calls.length === 2 && puts.length === 2) {
        return 'iron-condor';
      }
    }
    
    // Covered call
    if (stocks.length === 1 && options.length === 1) {
      const stock = stocks[0];
      const option = options[0];
      if (stock.action === 'buy' && option.action === 'sell_to_open' && option.optionType === 'call') {
        return 'covered-call';
      }
    }
    
    return 'custom';
  };

  function calculateStreak(trades: Trade[], isWin: boolean): number {
    let maxStreak = 0;
    let currentStreak = 0;
    
    trades.forEach(t => {
      if ((isWin && t.realizedPL >= 0) || (!isWin && t.realizedPL < 0)) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    });
    
    return maxStreak;
  }

  const fmt = (n: number) => '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const fmtPL = (n: number) => (n >= 0 ? '+' : '-') + fmt(n);
  const fmtPct = (n: number) => n.toFixed(1) + '%';

  const openJournalModal = (trade: Trade) => {
    const existing = journalEntries.find(e => e.tradeNum === trade.tradeNum);
    setJournalForm({
      entryType: existing?.entryType || 'post-trade',
      thesis: existing?.thesis || '',
      setup: existing?.setup || '',
      emotion: existing?.emotion || 'neutral',
      mistakes: existing?.mistakes || '',
      lessons: existing?.lessons || '',
      rating: existing?.rating || 3,
      tags: existing?.tags?.join(', ') || ''
    });
    setJournalModal({ trade, entry: existing });
  };

  const saveJournalEntry = async () => {
    if (!journalModal) return;
    setSaving(true);
    
    try {
      const res = await fetch('/api/trading-journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tradeNum: journalModal.trade.tradeNum,
          ...journalForm,
          tags: journalForm.tags.split(',').map(t => t.trim()).filter(Boolean)
        })
      });
      
      if (res.ok) {
        const updated = await res.json();
        setJournalEntries(prev => {
          const idx = prev.findIndex(e => e.tradeNum === journalModal.trade.tradeNum);
          if (idx >= 0) {
            const newEntries = [...prev];
            newEntries[idx] = updated.entry;
            return newEntries;
          }
          return [...prev, updated.entry];
        });
        setJournalModal(null);
      }
    } catch (err) {
      console.error('Failed to save journal entry:', err);
    } finally {
      setSaving(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getJournalEntry = (tradeNum: string) => journalEntries.find(e => e.tradeNum === tradeNum);

  // Open commit modal for a group of transactions
  const openCommitModal = (underlying: string, legs: OpenTransaction[]) => {
    const detected = detectStrategy(legs);
    setCommitStrategy(detected);
    setCommitModal({ underlying, legs, detectedStrategy: detected });
  };

  // Commit the trade
  const commitTrade = async () => {
    if (!commitModal) return;
    setCommitting(true);
    
    const newTradeNum = maxTradeNum + 1;
    
    try {
      const res = await fetch('/api/investment-transactions/commit-to-ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionIds: commitModal.legs.map(l => l.id),
          tradeNum: newTradeNum.toString(),
          strategy: commitStrategy
        })
      });
      
      if (res.ok) {
        // Refresh data
        setMaxTradeNum(newTradeNum);
        setOpensData(null); // Force reload
        setCommitModal(null);
        
        // Also refresh trades
        const tradesRes = await fetch('/api/trading/trades');
        if (tradesRes.ok) {
          setTradesData(await tradesRes.json());
        }
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to commit');
      }
    } catch (err) {
      console.error('Commit error:', err);
      alert('Failed to commit trade');
    } finally {
      setCommitting(false);
    }
  };

  // Group opens by underlying for better visualization
  const groupedOpens = useMemo(() => {
    if (!opensData?.opens) return [];
    
    const byUnderlying: Record<string, OpenTransaction[]> = {};
    opensData.opens.forEach(t => {
      const key = t.underlying || t.ticker || 'UNKNOWN';
      if (!byUnderlying[key]) byUnderlying[key] = [];
      byUnderlying[key].push(t);
    });
    
    return Object.entries(byUnderlying)
      .map(([underlying, legs]) => {
        const sortedLegs = [...legs].sort((a, b) => {
          // Sort by date, then by strike
          const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
          if (dateCompare !== 0) return dateCompare;
          return (a.strike || 0) - (b.strike || 0);
        });
        
        const netAmount = sortedLegs.reduce((sum, l) => sum + (l.amount || 0), 0);
        const detected = detectStrategy(sortedLegs);
        
        return {
          underlying,
          legs: sortedLegs,
          netAmount,
          detectedStrategy: detected,
          isCredit: netAmount < 0,
          legCount: sortedLegs.length
        };
      })
      .sort((a, b) => a.underlying.localeCompare(b.underlying));
  }, [opensData]);

  // Group closes similarly
  const groupedCloses = useMemo(() => {
    if (!opensData?.closes) return [];
    
    const byUnderlying: Record<string, OpenTransaction[]> = {};
    opensData.closes.forEach(t => {
      const key = t.underlying || t.ticker || 'UNKNOWN';
      if (!byUnderlying[key]) byUnderlying[key] = [];
      byUnderlying[key].push(t);
    });
    
    return Object.entries(byUnderlying)
      .map(([underlying, legs]) => ({
        underlying,
        legs: [...legs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
        netAmount: legs.reduce((sum, l) => sum + (l.amount || 0), 0),
        legCount: legs.length
      }))
      .sort((a, b) => a.underlying.localeCompare(b.underlying));
  }, [opensData]);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-[#2d1b4e] border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#f5f5f5]">
        <div className="p-4 lg:p-6 max-w-[1800px] mx-auto">
          
          {/* Header */}
          <div className="mb-4 bg-[#2d1b4e] text-white p-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h1 className="text-lg font-semibold tracking-tight">Trading Dashboard</h1>
                <p className="text-gray-300 text-xs font-mono">
                  {filteredMetrics.totalTrades} trades · {filteredMetrics.closedTrades} closed · {filteredMetrics.openTrades} open
                </p>
              </div>
              
              {/* Date Range Filter */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-400">Period:</span>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  className="bg-[#3d2b5e] text-white border-0 px-2 py-1 text-xs" />
                <span className="text-gray-400">to</span>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  className="bg-[#3d2b5e] text-white border-0 px-2 py-1 text-xs" />
                {(dateFrom || dateTo) && (
                  <button onClick={() => { setDateFrom(''); setDateTo(''); }} 
                    className="px-2 py-1 bg-white/10 hover:bg-white/20 text-xs">Clear</button>
                )}
              </div>
            </div>
          </div>

          {/* Hero Stats Row */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-4">
            <div className={`p-4 border ${filteredMetrics.totalRealizedPL >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Total P&L</div>
              <div className={`text-2xl font-bold font-mono ${filteredMetrics.totalRealizedPL >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {fmtPL(filteredMetrics.totalRealizedPL)}
              </div>
            </div>
            <div className="bg-white border border-gray-200 p-4">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Win Rate</div>
              <div className="text-2xl font-bold font-mono text-gray-900">{filteredMetrics.winRate}%</div>
              <div className="text-[10px] text-gray-400">{filteredMetrics.closedTrades} closed</div>
            </div>
            <div className="bg-white border border-gray-200 p-4">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Profit Factor</div>
              <div className="text-2xl font-bold font-mono text-gray-900">{filteredMetrics.profitFactor.toFixed(2)}</div>
            </div>
            <div className="bg-white border border-gray-200 p-4">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Avg Win</div>
              <div className="text-xl font-bold font-mono text-emerald-700">{fmt(filteredMetrics.avgWin)}</div>
            </div>
            <div className="bg-white border border-gray-200 p-4">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Avg Loss</div>
              <div className="text-xl font-bold font-mono text-red-700">{fmt(filteredMetrics.avgLoss)}</div>
            </div>
            <div className="bg-white border border-gray-200 p-4">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Avg Hold</div>
              <div className="text-xl font-bold font-mono text-gray-900">{filteredMetrics.avgHoldDays.toFixed(1)}d</div>
            </div>
          </div>

          {/* Secondary Stats */}
          <div className="grid grid-cols-4 lg:grid-cols-8 gap-2 mb-4">
            <div className="bg-white border border-gray-200 p-2 text-center">
              <div className="text-[9px] text-gray-500 uppercase">Largest Win</div>
              <div className="text-sm font-mono font-semibold text-emerald-700">{fmt(filteredMetrics.largestWin)}</div>
            </div>
            <div className="bg-white border border-gray-200 p-2 text-center">
              <div className="text-[9px] text-gray-500 uppercase">Largest Loss</div>
              <div className="text-sm font-mono font-semibold text-red-700">{fmt(Math.abs(filteredMetrics.largestLoss))}</div>
            </div>
            <div className="bg-white border border-gray-200 p-2 text-center">
              <div className="text-[9px] text-gray-500 uppercase">Win Streak</div>
              <div className="text-sm font-mono font-semibold text-gray-900">{filteredMetrics.winStreak}</div>
            </div>
            <div className="bg-white border border-gray-200 p-2 text-center">
              <div className="text-[9px] text-gray-500 uppercase">Loss Streak</div>
              <div className="text-sm font-mono font-semibold text-gray-900">{filteredMetrics.lossStreak}</div>
            </div>
            <div className="bg-white border border-gray-200 p-2 text-center">
              <div className="text-[9px] text-gray-500 uppercase">Options</div>
              <div className="text-sm font-mono font-semibold text-gray-900">{filteredTrades.filter(t => t.type === 'option').length}</div>
            </div>
            <div className="bg-white border border-gray-200 p-2 text-center">
              <div className="text-[9px] text-gray-500 uppercase">Stocks</div>
              <div className="text-sm font-mono font-semibold text-gray-900">{filteredTrades.filter(t => t.type === 'stock').length}</div>
            </div>
            <div className="bg-white border border-gray-200 p-2 text-center">
              <div className="text-[9px] text-gray-500 uppercase">Strategies</div>
              <div className="text-sm font-mono font-semibold text-gray-900">{filteredByStrategy.length}</div>
            </div>
            <div className="bg-white border border-gray-200 p-2 text-center">
              <div className="text-[9px] text-gray-500 uppercase">Tickers</div>
              <div className="text-sm font-mono font-semibold text-gray-900">{filteredByTicker.length}</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-4 overflow-x-auto bg-white border border-gray-200">
            {[
              { key: 'overview', label: 'Overview' },
              { key: 'journal', label: 'Trade Journal' },
              { key: 'positions', label: 'Open Positions' },
              { key: 'commit', label: `Commit${opensData ? ` (${opensData.totalOpens + opensData.totalCloses})` : ''}` },
            ].map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key as TabType)}
                className={`px-4 py-2 text-xs font-medium whitespace-nowrap transition-colors ${activeTab === tab.key ? 'bg-[#2d1b4e] text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="bg-white border border-gray-200">
            
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div>
                {/* P&L Calendar - 365 Day Heatmap */}
                <div className="border-b border-gray-200">
                  <div className="bg-[#2d1b4e] text-white px-4 py-2 text-sm font-semibold flex items-center justify-between">
                    <span>P&L Calendar</span>
                    <span className="text-xs text-gray-300">Last 365 days</span>
                  </div>
                  <div className="p-4 overflow-x-auto">
                    {calendarByMonth.length > 0 ? (
                      <div className="space-y-3">
                        {calendarByMonth.map(([monthKey, days]) => {
                          const monthDate = new Date(monthKey + '-01');
                          const monthName = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                          const monthTotal = days.reduce((sum, d) => sum + d.pl, 0);
                          const tradeDays = days.filter(d => d.count > 0).length;
                          
                          return (
                            <div key={monthKey} className="flex items-start gap-3">
                              <div className="w-20 flex-shrink-0">
                                <div className="text-xs font-medium text-gray-700">{monthName}</div>
                                <div className={`text-[10px] font-mono ${monthTotal >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                  {monthTotal !== 0 ? fmtPL(monthTotal) : '—'}
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-[2px]">
                                {days.map((day, i) => {
                                  const intensity = day.pl === 0 ? 0 : Math.min(Math.abs(day.pl) / 500, 1);
                                  const isPositive = day.pl >= 0;
                                  const dayOfWeek = day.date.getDay();
                                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                                  
                                  let bgColor = 'bg-gray-100';
                                  if (day.count > 0) {
                                    if (isPositive) {
                                      bgColor = intensity > 0.7 ? 'bg-emerald-600' : intensity > 0.3 ? 'bg-emerald-400' : 'bg-emerald-200';
                                    } else {
                                      bgColor = intensity > 0.7 ? 'bg-red-600' : intensity > 0.3 ? 'bg-red-400' : 'bg-red-200';
                                    }
                                  } else if (isWeekend) {
                                    bgColor = 'bg-gray-50';
                                  }
                                  
                                  return (
                                    <div key={i} className="group relative">
                                      <div className={`w-4 h-4 ${bgColor} ${day.count > 0 ? 'cursor-pointer' : ''}`} />
                                      {day.count > 0 && (
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-gray-900 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-20">
                                          <div className="font-medium">{day.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                                          <div className={day.pl >= 0 ? 'text-emerald-400' : 'text-red-400'}>{fmtPL(day.pl)}</div>
                                          <div className="text-gray-400">{day.count} trade{day.count > 1 ? 's' : ''}</div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="h-32 flex items-center justify-center text-gray-400 text-sm">No trading data</div>
                    )}
                    
                    {/* Legend */}
                    <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-100">
                      <span className="text-[10px] text-gray-500">Less</span>
                      <div className="flex gap-1">
                        <div className="w-3 h-3 bg-red-600" title="Large Loss" />
                        <div className="w-3 h-3 bg-red-400" title="Medium Loss" />
                        <div className="w-3 h-3 bg-red-200" title="Small Loss" />
                        <div className="w-3 h-3 bg-gray-100" title="No Trades" />
                        <div className="w-3 h-3 bg-emerald-200" title="Small Win" />
                        <div className="w-3 h-3 bg-emerald-400" title="Medium Win" />
                        <div className="w-3 h-3 bg-emerald-600" title="Large Win" />
                      </div>
                      <span className="text-[10px] text-gray-500">More</span>
                    </div>
                  </div>
                </div>

                <div className="grid lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-200">
                  {/* By Strategy */}
                  <div>
                    <div className="bg-[#3d2b5e] text-white px-4 py-2 text-xs font-semibold uppercase tracking-wider">
                      P&L by Strategy
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">Strategy</th>
                            <th className="px-3 py-2 text-center font-medium">W/L</th>
                            <th className="px-3 py-2 text-right font-medium">P&L</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {filteredByStrategy.map(s => (
                            <tr key={s.strategy} className="hover:bg-gray-50">
                              <td className="px-3 py-2 font-medium">{s.strategy}</td>
                              <td className="px-3 py-2 text-center text-gray-500">{s.wins}W/{s.losses}L</td>
                              <td className={`px-3 py-2 text-right font-mono font-semibold ${s.pl >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                                {fmtPL(s.pl)}
                              </td>
                            </tr>
                          ))}
                          {filteredByStrategy.length === 0 && (
                            <tr><td colSpan={3} className="px-3 py-4 text-center text-gray-400">No data</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* By Ticker */}
                  <div>
                    <div className="bg-[#3d2b5e] text-white px-4 py-2 text-xs font-semibold uppercase tracking-wider">
                      P&L by Ticker
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">Ticker</th>
                            <th className="px-3 py-2 text-center font-medium">W/L</th>
                            <th className="px-3 py-2 text-right font-medium">P&L</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {filteredByTicker.slice(0, 15).map(t => (
                            <tr key={t.ticker} className="hover:bg-gray-50">
                              <td className="px-3 py-2 font-mono font-medium">{t.ticker}</td>
                              <td className="px-3 py-2 text-center text-gray-500">{t.wins}W/{t.losses}L</td>
                              <td className={`px-3 py-2 text-right font-mono font-semibold ${t.pl >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                                {fmtPL(t.pl)}
                              </td>
                            </tr>
                          ))}
                          {filteredByTicker.length === 0 && (
                            <tr><td colSpan={3} className="px-3 py-4 text-center text-gray-400">No data</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Trade Journal Tab */}
            {activeTab === 'journal' && (
              <div>
                <div className="bg-[#2d1b4e] text-white px-4 py-2 text-sm font-semibold flex items-center justify-between">
                  <span>Trade Journal</span>
                  <span className="text-xs text-gray-300">{filteredTrades.length} trades · {journalEntries.length} entries</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-[#3d2b5e] text-white">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Trade #</th>
                        <th className="px-3 py-2 text-left font-medium">Date</th>
                        <th className="px-3 py-2 text-left font-medium">Ticker</th>
                        <th className="px-3 py-2 text-left font-medium">Strategy</th>
                        <th className="px-3 py-2 text-center font-medium">Type</th>
                        <th className="px-3 py-2 text-center font-medium">Status</th>
                        <th className="px-3 py-2 text-right font-medium">P&L</th>
                        <th className="px-3 py-2 text-center font-medium">Rating</th>
                        <th className="px-3 py-2 text-center font-medium">Journal</th>
                        <th className="px-3 py-2 text-center font-medium"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredTrades.map(trade => {
                        const journal = getJournalEntry(trade.tradeNum);
                        const isExpanded = expandedTrade === trade.tradeNum;
                        
                        return (
                          <>
                            <tr key={trade.tradeNum} className={`hover:bg-gray-50 ${isExpanded ? 'bg-[#2d1b4e]/5' : ''}`}>
                              <td className="px-3 py-2 font-mono text-gray-600">#{trade.tradeNum}</td>
                              <td className="px-3 py-2 text-gray-600">{new Date(trade.openDate).toLocaleDateString()}</td>
                              <td className="px-3 py-2 font-mono font-semibold">{trade.underlying}</td>
                              <td className="px-3 py-2">
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px]">{trade.strategy}</span>
                              </td>
                              <td className="px-3 py-2 text-center">
                                <span className={`px-2 py-0.5 text-[10px] ${trade.type === 'option' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'}`}>
                                  {trade.type}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-center">
                                <span className={`px-2 py-0.5 text-[10px] ${
                                  trade.status === 'OPEN' ? 'bg-green-100 text-green-700' : 
                                  trade.status === 'PARTIAL' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-gray-100 text-gray-600'
                                }`}>{trade.status}</span>
                              </td>
                              <td className={`px-3 py-2 text-right font-mono font-semibold ${
                                trade.status === 'CLOSED' ? (trade.realizedPL >= 0 ? 'text-emerald-700' : 'text-red-700') : 'text-gray-400'
                              }`}>
                                {trade.status === 'CLOSED' ? fmtPL(trade.realizedPL) : '—'}
                              </td>
                              <td className="px-3 py-2 text-center">
                                {journal?.rating ? (
                                  <span className="text-amber-500">{'★'.repeat(journal.rating)}{'☆'.repeat(5 - journal.rating)}</span>
                                ) : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="px-3 py-2 text-center">
                                {journal ? (
                                  <span className={`px-2 py-0.5 text-[10px] ${
                                    journal.emotion === 'confident' ? 'bg-emerald-100 text-emerald-700' :
                                    journal.emotion === 'nervous' || journal.emotion === 'fearful' ? 'bg-yellow-100 text-yellow-700' :
                                    journal.emotion === 'fomo' || journal.emotion === 'revenge' || journal.emotion === 'greedy' ? 'bg-red-100 text-red-700' :
                                    'bg-gray-100 text-gray-700'
                                  }`}>{journal.emotion}</span>
                                ) : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <div className="flex items-center gap-1 justify-center">
                                  <button onClick={() => openJournalModal(trade)}
                                    className="px-2 py-1 text-[10px] bg-[#2d1b4e] text-white hover:bg-[#3d2b5e]">
                                    {journal ? 'Edit' : 'Add'}
                                  </button>
                                  <button onClick={() => setExpandedTrade(isExpanded ? null : trade.tradeNum)}
                                    className="px-2 py-1 text-[10px] bg-gray-100 text-gray-700 hover:bg-gray-200">
                                    {isExpanded ? '▲' : '▼'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr key={`${trade.tradeNum}-detail`}>
                                <td colSpan={10} className="px-4 py-3 bg-gray-50">
                                  <div className="grid lg:grid-cols-2 gap-4 text-xs">
                                    <div>
                                      <div className="font-semibold text-gray-700 mb-2">Trade Details</div>
                                      <div className="space-y-1 text-gray-600">
                                        <div>Opened: {new Date(trade.openDate).toLocaleString()}</div>
                                        {trade.closeDate && <div>Closed: {new Date(trade.closeDate).toLocaleString()}</div>}
                                        <div>Legs: {trade.legs}</div>
                                        {trade.type === 'stock' && trade.shares && (
                                          <>
                                            <div>Shares: {trade.shares.original} (sold: {trade.shares.sold})</div>
                                            <div>Cost Basis: {fmt(trade.costBasis || 0)}</div>
                                            {trade.status === 'CLOSED' && <div>Proceeds: {fmt(trade.proceeds || 0)}</div>}
                                          </>
                                        )}
                                      </div>
                                    </div>
                                    {journal && (
                                      <div>
                                        <div className="font-semibold text-gray-700 mb-2">Journal Notes</div>
                                        <div className="space-y-1 text-gray-600">
                                          {journal.thesis && <div><span className="font-medium">Thesis:</span> {journal.thesis}</div>}
                                          {journal.setup && <div><span className="font-medium">Setup:</span> {journal.setup}</div>}
                                          {journal.mistakes && <div><span className="font-medium text-red-600">Mistakes:</span> {journal.mistakes}</div>}
                                          {journal.lessons && <div><span className="font-medium text-emerald-600">Lessons:</span> {journal.lessons}</div>}
                                          {journal.tags?.length > 0 && (
                                            <div className="flex gap-1 flex-wrap">
                                              {journal.tags.map(tag => (
                                                <span key={tag} className="px-2 py-0.5 bg-gray-200 text-gray-600 text-[10px]">{tag}</span>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })}
                      {filteredTrades.length === 0 && (
                        <tr><td colSpan={10} className="px-3 py-8 text-center text-gray-400">No trades in selected period</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Open Positions Tab */}
            {activeTab === 'positions' && (
              <div>
                <div className="bg-[#2d1b4e] text-white px-4 py-2 text-sm font-semibold">
                  Open Positions ({filteredTrades.filter(t => t.status === 'OPEN' || t.status === 'PARTIAL').length})
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-[#3d2b5e] text-white">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Trade #</th>
                        <th className="px-3 py-2 text-left font-medium">Opened</th>
                        <th className="px-3 py-2 text-left font-medium">Ticker</th>
                        <th className="px-3 py-2 text-left font-medium">Strategy</th>
                        <th className="px-3 py-2 text-center font-medium">Type</th>
                        <th className="px-3 py-2 text-center font-medium">Status</th>
                        <th className="px-3 py-2 text-right font-medium">Days Open</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredTrades.filter(t => t.status === 'OPEN' || t.status === 'PARTIAL').map(trade => {
                        const daysOpen = Math.ceil((Date.now() - new Date(trade.openDate).getTime()) / (1000 * 60 * 60 * 24));
                        return (
                          <tr key={trade.tradeNum} className="hover:bg-gray-50">
                            <td className="px-3 py-2 font-mono text-gray-600">#{trade.tradeNum}</td>
                            <td className="px-3 py-2 text-gray-600">{new Date(trade.openDate).toLocaleDateString()}</td>
                            <td className="px-3 py-2 font-mono font-semibold">{trade.underlying}</td>
                            <td className="px-3 py-2">
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px]">{trade.strategy}</span>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className={`px-2 py-0.5 text-[10px] ${trade.type === 'option' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'}`}>
                                {trade.type}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className={`px-2 py-0.5 text-[10px] ${trade.status === 'PARTIAL' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                                {trade.status}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right font-mono">{daysOpen}d</td>
                          </tr>
                        );
                      })}
                      {filteredTrades.filter(t => t.status === 'OPEN' || t.status === 'PARTIAL').length === 0 && (
                        <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">No open positions</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Commit Trades Tab - REDESIGNED */}
            {activeTab === 'commit' && (
              <div>
                {/* Header with counts */}
                <div className="bg-[#2d1b4e] text-white px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold">Commit Trades</div>
                      <div className="text-xs text-gray-400">
                        Group transactions into trades · Next trade # will be {maxTradeNum + 1}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <div className="text-center">
                        <div className="text-lg font-bold font-mono">{opensData?.totalOpens || 0}</div>
                        <div className="text-gray-400">Opens</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold font-mono">{opensData?.totalCloses || 0}</div>
                        <div className="text-gray-400">Closes</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Opens Section */}
                <div className="border-b border-gray-200">
                  <div className="bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                    Opening Positions ({groupedOpens.length} underlyings, {opensData?.totalOpens || 0} legs)
                  </div>
                  
                  {groupedOpens.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-sm">No opening transactions to commit</div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {groupedOpens.map(group => (
                        <div key={group.underlying} className="p-4 hover:bg-gray-50">
                          {/* Group Header */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <span className="text-lg font-bold font-mono text-gray-900">{group.underlying}</span>
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-medium">
                                {STRATEGY_OPTIONS.find(s => s.value === group.detectedStrategy)?.label || group.detectedStrategy}
                              </span>
                              <span className="text-xs text-gray-500">{group.legCount} leg{group.legCount > 1 ? 's' : ''}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className={`text-right ${group.isCredit ? 'text-emerald-700' : 'text-red-700'}`}>
                                <div className="text-xs text-gray-500">{group.isCredit ? 'Credit' : 'Debit'}</div>
                                <div className="text-lg font-bold font-mono">{fmt(Math.abs(group.netAmount))}</div>
                              </div>
                              <button onClick={() => openCommitModal(group.underlying, group.legs)}
                                className="px-4 py-2 bg-[#2d1b4e] text-white text-xs font-medium hover:bg-[#3d2b5e]">
                                Commit →
                              </button>
                            </div>
                          </div>
                          
                          {/* Legs Table */}
                          <div className="bg-gray-50 rounded overflow-hidden">
                            <table className="w-full text-xs">
                              <thead className="bg-gray-100">
                                <tr>
                                  <th className="px-3 py-2 text-left font-medium text-gray-600">Date</th>
                                  <th className="px-3 py-2 text-left font-medium text-gray-600">Action</th>
                                  <th className="px-3 py-2 text-left font-medium text-gray-600">Type</th>
                                  <th className="px-3 py-2 text-right font-medium text-gray-600">Strike</th>
                                  <th className="px-3 py-2 text-left font-medium text-gray-600">Expiration</th>
                                  <th className="px-3 py-2 text-right font-medium text-gray-600">Qty</th>
                                  <th className="px-3 py-2 text-right font-medium text-gray-600">Price</th>
                                  <th className="px-3 py-2 text-right font-medium text-gray-600">Amount</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                {group.legs.map(leg => (
                                  <tr key={leg.id} className="bg-white">
                                    <td className="px-3 py-2 text-gray-600">{new Date(leg.date).toLocaleDateString()}</td>
                                    <td className="px-3 py-2">
                                      <span className={`px-2 py-0.5 text-[10px] font-medium ${
                                        leg.action.includes('buy') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                      }`}>
                                        {leg.action === 'buy_to_open' ? 'BTO' : leg.action === 'sell_to_open' ? 'STO' : leg.action.toUpperCase()}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2">
                                      {leg.isOption ? (
                                        <span className={`px-2 py-0.5 text-[10px] ${leg.optionType === 'call' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                          {leg.optionType?.toUpperCase()}
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-[10px]">STOCK</span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono">{leg.strike ? `$${leg.strike}` : '—'}</td>
                                    <td className="px-3 py-2 text-gray-600">{leg.expiration || '—'}</td>
                                    <td className="px-3 py-2 text-right font-mono">{leg.quantity}</td>
                                    <td className="px-3 py-2 text-right font-mono">${leg.price?.toFixed(2)}</td>
                                    <td className={`px-3 py-2 text-right font-mono font-semibold ${(leg.amount || 0) < 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                                      {(leg.amount || 0) < 0 ? '+' : '-'}{fmt(Math.abs(leg.amount || 0))}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Closes Section */}
                <div>
                  <div className="bg-red-50 px-4 py-2 text-xs font-semibold text-red-800 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                    Closing Positions ({groupedCloses.length} underlyings, {opensData?.totalCloses || 0} legs)
                  </div>
                  
                  {groupedCloses.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-sm">No closing transactions to match</div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {groupedCloses.map(group => (
                        <div key={group.underlying} className="p-4 hover:bg-gray-50">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <span className="text-lg font-bold font-mono text-gray-900">{group.underlying}</span>
                              <span className="text-xs text-gray-500">{group.legCount} leg{group.legCount > 1 ? 's' : ''}</span>
                            </div>
                            <div className={`text-lg font-bold font-mono ${group.netAmount < 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                              {group.netAmount < 0 ? '+' : '-'}{fmt(Math.abs(group.netAmount))}
                            </div>
                          </div>
                          
                          <div className="bg-gray-50 rounded overflow-hidden">
                            <table className="w-full text-xs">
                              <thead className="bg-gray-100">
                                <tr>
                                  <th className="px-3 py-2 text-left font-medium text-gray-600">Date</th>
                                  <th className="px-3 py-2 text-left font-medium text-gray-600">Action</th>
                                  <th className="px-3 py-2 text-left font-medium text-gray-600">Type</th>
                                  <th className="px-3 py-2 text-right font-medium text-gray-600">Strike</th>
                                  <th className="px-3 py-2 text-left font-medium text-gray-600">Expiration</th>
                                  <th className="px-3 py-2 text-right font-medium text-gray-600">Qty</th>
                                  <th className="px-3 py-2 text-right font-medium text-gray-600">Price</th>
                                  <th className="px-3 py-2 text-right font-medium text-gray-600">Amount</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                {group.legs.map(leg => (
                                  <tr key={leg.id} className="bg-white">
                                    <td className="px-3 py-2 text-gray-600">{new Date(leg.date).toLocaleDateString()}</td>
                                    <td className="px-3 py-2">
                                      <span className={`px-2 py-0.5 text-[10px] font-medium ${
                                        leg.action.includes('buy') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                      }`}>
                                        {leg.action === 'buy_to_close' ? 'BTC' : leg.action === 'sell_to_close' ? 'STC' : leg.action.toUpperCase()}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2">
                                      {leg.isOption ? (
                                        <span className={`px-2 py-0.5 text-[10px] ${leg.optionType === 'call' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                          {leg.optionType?.toUpperCase()}
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-[10px]">STOCK</span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono">{leg.strike ? `$${leg.strike}` : '—'}</td>
                                    <td className="px-3 py-2 text-gray-600">{leg.expiration || '—'}</td>
                                    <td className="px-3 py-2 text-right font-mono">{leg.quantity}</td>
                                    <td className="px-3 py-2 text-right font-mono">${leg.price?.toFixed(2)}</td>
                                    <td className={`px-3 py-2 text-right font-mono font-semibold ${(leg.amount || 0) < 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                                      {(leg.amount || 0) < 0 ? '+' : '-'}{fmt(Math.abs(leg.amount || 0))}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>

        </div>
      </div>

      {/* Commit Modal */}
      {commitModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setCommitModal(null)}>
          <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="bg-[#2d1b4e] text-white px-4 py-3 flex justify-between items-center sticky top-0">
              <div>
                <div className="font-semibold">Commit Trade</div>
                <div className="text-xs text-gray-300">Trade #{maxTradeNum + 1} · {commitModal.underlying}</div>
              </div>
              <button onClick={() => setCommitModal(null)} className="text-white/60 hover:text-white text-xl">×</button>
            </div>
            
            <div className="p-4">
              {/* Strategy Selection */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-700 mb-2">Strategy</label>
                <select value={commitStrategy} onChange={e => setCommitStrategy(e.target.value)}
                  className="w-full border border-gray-200 px-3 py-2 text-sm">
                  {STRATEGY_OPTIONS.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                {commitModal.detectedStrategy !== commitStrategy && (
                  <div className="text-xs text-gray-500 mt-1">
                    Auto-detected: {STRATEGY_OPTIONS.find(s => s.value === commitModal.detectedStrategy)?.label || commitModal.detectedStrategy}
                  </div>
                )}
              </div>

              {/* Legs Preview */}
              <div className="mb-4">
                <div className="text-xs font-medium text-gray-700 mb-2">Legs ({commitModal.legs.length})</div>
                <div className="bg-gray-50 rounded overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Action</th>
                        <th className="px-3 py-2 text-left font-medium">Type</th>
                        <th className="px-3 py-2 text-right font-medium">Strike</th>
                        <th className="px-3 py-2 text-left font-medium">Exp</th>
                        <th className="px-3 py-2 text-right font-medium">Qty</th>
                        <th className="px-3 py-2 text-right font-medium">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {commitModal.legs.map(leg => (
                        <tr key={leg.id} className="bg-white">
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 text-[10px] font-medium ${
                              leg.action.includes('buy') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {leg.action === 'buy_to_open' ? 'BTO' : leg.action === 'sell_to_open' ? 'STO' : leg.action.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            {leg.isOption ? (
                              <span className={`px-2 py-0.5 text-[10px] ${leg.optionType === 'call' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                {leg.optionType?.toUpperCase()}
                              </span>
                            ) : 'STOCK'}
                          </td>
                          <td className="px-3 py-2 text-right font-mono">{leg.strike ? `$${leg.strike}` : '—'}</td>
                          <td className="px-3 py-2">{leg.expiration || '—'}</td>
                          <td className="px-3 py-2 text-right font-mono">{leg.quantity}</td>
                          <td className={`px-3 py-2 text-right font-mono font-semibold ${(leg.amount || 0) < 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                            {fmt(leg.amount || 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-100">
                      <tr>
                        <td colSpan={5} className="px-3 py-2 text-right font-semibold">Net:</td>
                        <td className={`px-3 py-2 text-right font-mono font-bold ${
                          commitModal.legs.reduce((sum, l) => sum + (l.amount || 0), 0) < 0 ? 'text-emerald-700' : 'text-red-700'
                        }`}>
                          {fmt(commitModal.legs.reduce((sum, l) => sum + (l.amount || 0), 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-50 px-4 py-3 flex justify-end gap-2 sticky bottom-0 border-t">
              <button onClick={() => setCommitModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
                Cancel
              </button>
              <button onClick={commitTrade} disabled={committing}
                className="px-4 py-2 text-sm bg-[#2d1b4e] text-white hover:bg-[#3d2b5e] disabled:opacity-50">
                {committing ? 'Committing...' : `Commit as Trade #${maxTradeNum + 1}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Journal Entry Modal */}
      {journalModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setJournalModal(null)}>
          <div className="bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="bg-[#2d1b4e] text-white px-4 py-3 flex justify-between items-center sticky top-0">
              <div>
                <div className="font-semibold">Trade Journal</div>
                <div className="text-xs text-gray-300">#{journalModal.trade.tradeNum} · {journalModal.trade.underlying}</div>
              </div>
              <button onClick={() => setJournalModal(null)} className="text-white/60 hover:text-white text-xl">×</button>
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Entry Type</label>
                <select value={journalForm.entryType} onChange={e => setJournalForm(p => ({ ...p, entryType: e.target.value }))}
                  className="w-full border border-gray-200 px-3 py-2 text-sm">
                  <option value="pre-trade">Pre-Trade (Planning)</option>
                  <option value="during">During Trade</option>
                  <option value="post-trade">Post-Trade (Review)</option>
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Thesis / Reason</label>
                <textarea value={journalForm.thesis} onChange={e => setJournalForm(p => ({ ...p, thesis: e.target.value }))}
                  className="w-full border border-gray-200 px-3 py-2 text-sm h-20" placeholder="Why did you take this trade?" />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Setup</label>
                  <select value={journalForm.setup} onChange={e => setJournalForm(p => ({ ...p, setup: e.target.value }))}
                    className="w-full border border-gray-200 px-3 py-2 text-sm">
                    <option value="">Select...</option>
                    {SETUPS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Emotion</label>
                  <select value={journalForm.emotion} onChange={e => setJournalForm(p => ({ ...p, emotion: e.target.value }))}
                    className="w-full border border-gray-200 px-3 py-2 text-sm">
                    {EMOTIONS.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Mistakes</label>
                <textarea value={journalForm.mistakes} onChange={e => setJournalForm(p => ({ ...p, mistakes: e.target.value }))}
                  className="w-full border border-gray-200 px-3 py-2 text-sm h-16" placeholder="What went wrong?" />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Lessons Learned</label>
                <textarea value={journalForm.lessons} onChange={e => setJournalForm(p => ({ ...p, lessons: e.target.value }))}
                  className="w-full border border-gray-200 px-3 py-2 text-sm h-16" placeholder="What will you do differently?" />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Rating (1-5)</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} onClick={() => setJournalForm(p => ({ ...p, rating: n }))}
                      className={`w-10 h-10 text-lg ${journalForm.rating >= n ? 'text-amber-500' : 'text-gray-300'}`}>
                      {journalForm.rating >= n ? '★' : '☆'}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Tags (comma separated)</label>
                <input type="text" value={journalForm.tags} onChange={e => setJournalForm(p => ({ ...p, tags: e.target.value }))}
                  className="w-full border border-gray-200 px-3 py-2 text-sm" placeholder="e.g., earnings, scalp, swing" />
              </div>
            </div>
            
            <div className="bg-gray-50 px-4 py-3 flex justify-end gap-2 sticky bottom-0 border-t">
              <button onClick={() => setJournalModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
                Cancel
              </button>
              <button onClick={saveJournalEntry} disabled={saving}
                className="px-4 py-2 text-sm bg-[#2d1b4e] text-white hover:bg-[#3d2b5e] disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Entry'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
