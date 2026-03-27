'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { AppLayout } from '@/components/ui';
import CalendarGrid, { CalendarEvent, SourceConfig } from '@/components/shared/CalendarGrid';
import ConvergenceIntelligence from '@/components/convergence/ConvergenceIntelligence';
import TradeLabPanel from '@/components/trading/TradeLabPanel';
import DataObservatory from '@/components/data-observatory/DataObservatory';
import type { ScannerFilters } from '@/lib/convergence/filter-types';
import { DEFAULT_FILTERS, AVAILABLE_STRATEGIES } from '@/lib/convergence/filter-types';


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

type TabType = 'overview' | 'positions' | 'market-intelligence';

const EMOTIONS = ['confident', 'neutral', 'nervous', 'fomo', 'revenge', 'greedy', 'fearful'];
const SETUPS = ['breakout', 'pullback', 'mean-reversion', 'momentum', 'earnings', 'theta-decay', 'volatility', 'other'];

export default function TradingPage() {
  const { data: session } = useSession();
  const userEmail = session?.user?.email || null;
  const ownerEmail = process.env.NEXT_PUBLIC_OWNER_EMAIL;
  const isOwner = !!ownerEmail && userEmail?.toLowerCase() === ownerEmail.toLowerCase();

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [tradesData, setTradesData] = useState<TradesData | null>(null);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Date range filter
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Per-user scanner start date (for filtering legacy positions)
  const [scannerStartDate, setScannerStartDate] = useState<string | null>(null);

  // Lifted scanner filter state (shared between search bar and ConvergenceIntelligence)
  const [scannerFilters, setScannerFilters] = useState<ScannerFilters>(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('scanner-filters') : null;
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_FILTERS;
  });
  const [scannerUniverse, setScannerUniverse] = useState('sp500');
  const [showStrategyPopover, setShowStrategyPopover] = useState(false);
  const scanTriggerRef = useRef<(() => void) | null>(null);
  const scanningRef = useRef<boolean>(false);
  const [scanningDisplay, setScanningDisplay] = useState(false);

  const handleFiltersChange = useCallback((next: ScannerFilters) => {
    setScannerFilters(next);
    try { localStorage.setItem('scanner-filters', JSON.stringify(next)); } catch {}
  }, []);

  // Trade cards (for reconciliation metrics scoping)
  const [tradeCards, setTradeCards] = useState<{
    status: string;
    link: { trade_num: string } | null;
  }[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/user/scanner-start-date');
        if (res.ok) {
          const { scanner_start_date } = await res.json();
          if (scanner_start_date) setScannerStartDate(scanner_start_date);
        }
      } catch { /* ignore */ }
    })();
  }, []);

  // Fetch trade cards for reconciliation metrics
  useEffect(() => {
    fetch('/api/trade-cards')
      .then(r => r.json())
      .then(data => setTradeCards(Array.isArray(data?.cards) ? data.cards : []));
  }, []);

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

  const [maxTradeNum, setMaxTradeNum] = useState(0);

  // Tastytrade connection state
  const [ttConnected, setTtConnected] = useState<boolean | null>(null);
  const [ttAccounts, setTtAccounts] = useState<string[]>([]);
  const [ttConnecting, setTtConnecting] = useState(false);
  const [ttError, setTtError] = useState<string | null>(null);

  // Tastytrade live data state
  const [ttPositions, setTtPositions] = useState<any[]>([]);
  const [ttBalances, setTtBalances] = useState<any[]>([]);
  const [ttLoading, setTtLoading] = useState(false);
  const [ttDataError, setTtDataError] = useState<string | null>(null);
  const [ttQuoteSymbol, setTtQuoteSymbol] = useState('');
  const [ttQuoteData, setTtQuoteData] = useState<any | null>(null);
  const [ttQuoteLoading, setTtQuoteLoading] = useState(false);
  const [ttChainSymbol, setTtChainSymbol] = useState('');
  const [ttChainData, setTtChainData] = useState<any | null>(null);
  const [ttChainLoading, setTtChainLoading] = useState(false);
  const [ttRefreshing, setTtRefreshing] = useState(false);
  const [ttExpandedExp, setTtExpandedExp] = useState<number | null>(null);
  const [ttGreeksData, setTtGreeksData] = useState<Record<string, any>>({});
  const [ttGreeksLoading, setTtGreeksLoading] = useState(false);
  const [ttGreeksFetched, setTtGreeksFetched] = useState<Set<number>>(new Set());
  const [ttShowAllStrikes, setTtShowAllStrikes] = useState(false);

  // Check Tastytrade connection status on load
  useEffect(() => {
    if (!isOwner) return;
    fetch('/api/tastytrade/status')
      .then(res => res.json())
      .then(data => {
        setTtConnected(data.connected || false);
        setTtAccounts(data.accountNumbers || []);
      })
      .catch(() => setTtConnected(false));
  }, [isOwner]);



  const handleTtConnect = async () => {
    setTtConnecting(true);
    setTtError(null);
    try {
      const res = await fetch('/api/tastytrade/connect', {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        setTtError(data.error || 'Connection failed');
        return;
      }
      setTtConnected(true);
      setTtAccounts(data.accountNumbers || []);
    } catch {
      setTtError('Failed to connect');
    } finally {
      setTtConnecting(false);
    }
  };

  const handleTtDisconnect = async () => {
    try {
      await fetch('/api/tastytrade/disconnect', { method: 'POST' });
      setTtConnected(false);
      setTtAccounts([]);
      setTtPositions([]);
      setTtBalances([]);
    } catch {
      // ignore
    }
  };

  const fetchTtData = async () => {
    setTtLoading(true);
    setTtDataError(null);
    try {
      const [posRes, balRes] = await Promise.all([
        fetch('/api/tastytrade/positions'),
        fetch('/api/tastytrade/balances'),
      ]);
      if (posRes.status === 401 || balRes.status === 401) {
        setTtDataError('Session expired — please reconnect');
        setTtConnected(false);
        return;
      }
      const [posData, balData] = await Promise.all([posRes.json(), balRes.json()]);
      setTtPositions(posData.positions || []);
      setTtBalances(balData.balances || []);
    } catch {
      setTtDataError('Failed to load account data');
    } finally {
      setTtLoading(false);
    }
  };

  // Fetch positions + balances when connected on Market Intelligence tab
  useEffect(() => {
    if (ttConnected) {
      fetchTtData();
    }
  }, [ttConnected]);

  const handleTtRefresh = async () => {
    setTtRefreshing(true);
    try {
      await fetch('/api/tastytrade/callback', { method: 'POST' });
      await fetchTtData();
    } catch {
      setTtDataError('Failed to refresh session');
    } finally {
      setTtRefreshing(false);
    }
  };

  const handleTtQuote = async () => {
    if (!ttQuoteSymbol.trim()) return;
    setTtQuoteLoading(true);
    setTtQuoteData(null);
    try {
      const res = await fetch('/api/tastytrade/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: [ttQuoteSymbol.trim().toUpperCase()] }),
      });
      if (res.status === 401) {
        setTtDataError('Session expired — please reconnect');
        setTtConnected(false);
        return;
      }
      const data = await res.json();
      setTtQuoteData(data.quotes || {});
    } catch {
      setTtQuoteData(null);
    } finally {
      setTtQuoteLoading(false);
    }
  };

  const handleTtChain = async () => {
    if (!ttChainSymbol.trim()) return;
    setTtChainLoading(true);
    setTtChainData(null);
    setTtExpandedExp(null);
    setTtGreeksData({});
    setTtGreeksFetched(new Set());
    setTtShowAllStrikes(false);
    try {
      const res = await fetch('/api/tastytrade/chains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: ttChainSymbol.trim().toUpperCase() }),
      });
      if (res.status === 401) {
        setTtDataError('Session expired — please reconnect');
        setTtConnected(false);
        return;
      }
      const data = await res.json();
      setTtChainData(data.chain || null);
    } catch {
      setTtChainData(null);
    } finally {
      setTtChainLoading(false);
    }
  };

  const handleLoadGreeks = async (exp: any, expIndex: number) => {
    if (ttGreeksFetched.has(expIndex)) return;
    setTtGreeksLoading(true);
    try {
      const allStrikes: number[] = (exp.strikes || []).map((s: any) => s.strike);
      const quotePrice = ttQuoteData && Object.values(ttQuoteData)[0]
        ? (Object.values(ttQuoteData)[0] as any).last || (Object.values(ttQuoteData)[0] as any).mid
        : null;
      const center = quotePrice || (allStrikes.length > 0
        ? (Math.min(...allStrikes) + Math.max(...allStrikes)) / 2
        : 0);
      const range = 30;

      const symbols: string[] = [];
      for (const s of exp.strikes || []) {
        if (Math.abs(s.strike - center) > range) continue;
        if (s.callStreamerSymbol) symbols.push(s.callStreamerSymbol);
        if (s.putStreamerSymbol) symbols.push(s.putStreamerSymbol);
      }
      if (symbols.length === 0) return;
      const res = await fetch('/api/tastytrade/greeks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols }),
      });
      if (res.status === 401) {
        setTtDataError('Session expired — please reconnect');
        setTtConnected(false);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setTtGreeksData(prev => ({ ...prev, ...data.greeks }));
        setTtGreeksFetched(prev => new Set(prev).add(expIndex));
      }
    } catch {
      // ignore
    } finally {
      setTtGreeksLoading(false);
    }
  };

  const handleExpandExp = (i: number, exp: any) => {
    const next = ttExpandedExp === i ? null : i;
    setTtExpandedExp(next);
    if (next !== null && !ttGreeksFetched.has(i)) {
      handleLoadGreeks(exp, i);
    }
  };

  const fmtCurrency = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

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

  // Open positions filtered by scanner start date (for Trade Reconciliation tab)
  const openPositions = useMemo(() => {
    return filteredTrades.filter(t => {
      if (t.status !== 'OPEN' && t.status !== 'PARTIAL') return false;
      if (scannerStartDate && new Date(t.openDate) < new Date(scannerStartDate)) return false;
      return true;
    });
  }, [filteredTrades, scannerStartDate]);

  // Metrics scoped to reconciliation (open positions only, filtered by scanner start date)
  const reconciliationMetrics = useMemo(() => {
    const trades = openPositions;
    const gradedTradeNums = new Set(
      tradeCards
        .filter(c => c.status === 'graded' && c.link?.trade_num)
        .map(c => c.link!.trade_num)
    );
    const closed = filteredTrades.filter(t =>
      t.status === 'CLOSED' &&
      gradedTradeNums.has(t.tradeNum)
    );
    const wins = closed.filter(t => t.realizedPL >= 0);
    const losses = closed.filter(t => t.realizedPL < 0);
    const totalPL = closed.reduce((sum, t) => sum + t.realizedPL, 0);
    const totalWins = wins.reduce((sum, t) => sum + t.realizedPL, 0);
    const totalLosses = Math.abs(losses.reduce((sum, t) => sum + t.realizedPL, 0));
    return {
      totalTrades: trades.length + closed.length,
      openTrades: trades.length,
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
  }, [openPositions, filteredTrades, tradeCards]);

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

  // Persistent metrics: Expectancy + Max Drawdown (always visible regardless of tab)
  const persistentMetrics = useMemo(() => {
    const m = filteredMetrics;
    const expectancy = m.closedTrades > 0 ? m.totalRealizedPL / m.closedTrades : null;

    // Max drawdown: walk cumulative P&L curve, track peak, find deepest peak-to-trough
    let maxDrawdown = 0;
    let peak = 0;
    for (const point of equityCurve) {
      if (point.cumulative > peak) peak = point.cumulative;
      const drawdown = point.cumulative - peak;
      if (drawdown < maxDrawdown) maxDrawdown = drawdown;
    }

    return { expectancy, maxDrawdown, totalPL: m.totalRealizedPL, profitFactor: m.profitFactor };
  }, [filteredMetrics, equityCurve]);

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

  // P&L events for CalendarGrid — one event per day that had closed trades
  const plCalendarEvents: CalendarEvent[] = useMemo(() => {
    return Object.entries(plByDate).map(([dateKey, data]) => ({
      id: `pl-${dateKey}`,
      source: data.pl >= 0 ? 'win' : 'loss',
      title: `${data.pl >= 0 ? '+' : ''}$${Math.abs(data.pl).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
      startDate: dateKey,
      budgetAmount: data.pl,
    }));
  }, [plByDate]);

  const PL_SOURCE_CONFIG: Record<string, SourceConfig> = {
    win: { label: 'Win', icon: '', bg: 'bg-emerald-50', dot: 'bg-emerald-500', badge: 'bg-emerald-500' },
    loss: { label: 'Loss', icon: '', bg: 'bg-red-50', dot: 'bg-red-500', badge: 'bg-red-500' },
  };

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

  const getJournalEntry = (tradeNum: string) => journalEntries.find(e => e.tradeNum === tradeNum);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-bg-terminal">
        <div className="p-4 lg:p-6 max-w-[1800px] mx-auto">
          
          {/* ── Purple Background Zone ── */}
          <div className="-mx-4 lg:-mx-6 -mt-4 lg:-mt-6 px-3 lg:px-6 py-2 mb-3 bg-brand-purple/80">
            <div className="max-w-[1800px] mx-auto space-y-1">

              {/* ROW 1 — Dense Scanner Bar (4 zones) */}
              <div className="bg-white border-2 border-brand-gold/60 rounded-xl shadow-md flex flex-col lg:flex-row overflow-hidden">

                {/* Zone 1: Identity */}
                <div className="px-3 py-2 lg:w-[140px] lg:flex-shrink-0 lg:border-r border-b lg:border-b-0 border-gray-200">
                  <div className="text-sm text-text-primary leading-tight">Trading</div>
                  <div className="flex items-center gap-1 mt-0.5">
                    {ttConnected ? (
                      <><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /><span className="text-[9px] text-emerald-600">TT Connected</span></>
                    ) : ttConnected === false ? (
                      <><div className="w-1.5 h-1.5 bg-red-400 rounded-full" /><span className="text-[9px] text-text-muted">No Broker</span></>
                    ) : (
                      <span className="text-[9px] text-text-faint">...</span>
                    )}
                  </div>
                </div>

                {/* Zone 2: Risk Profile */}
                <div className="px-3 py-1.5 lg:flex-[3] lg:border-r border-b lg:border-b-0 border-gray-200 min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-1">
                    {[{ val: 'sp500', label: 'S&P 500' }, { val: 'nasdaq100', label: 'Nasdaq 100' }].map(u => (
                      <button key={u.val} onClick={() => setScannerUniverse(u.val)}
                        className={`text-[10px] px-1.5 py-px rounded-full border ${scannerUniverse === u.val ? 'bg-brand-purple/10 text-brand-purple border-brand-purple/30' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                        {u.label}
                      </button>
                    ))}
                    <div className="flex gap-px rounded overflow-hidden border border-gray-200 ml-0.5">
                      {(['ALL', 'BULLISH', 'BEARISH', 'NEUTRAL'] as const).map(d => (
                        <button key={d} onClick={() => handleFiltersChange({ ...scannerFilters, risk: { ...scannerFilters.risk, direction: d } })}
                          className={`px-1 py-px text-[9px] font-bold ${scannerFilters.risk.direction === d ? 'bg-brand-purple text-white' : 'bg-white text-gray-400'}`}>
                          {d === 'BULLISH' ? 'Bull' : d === 'BEARISH' ? 'Bear' : d === 'NEUTRAL' ? 'Ntrl' : 'All'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <div className="flex gap-px rounded overflow-hidden border border-gray-200">
                      {(['SELL', 'BUY', 'BOTH'] as const).map(s => (
                        <button key={s} onClick={() => handleFiltersChange({ ...scannerFilters, risk: { ...scannerFilters.risk, premiumStance: s } })}
                          className={`px-1 py-px text-[9px] font-bold ${scannerFilters.risk.premiumStance === s ? 'bg-brand-purple text-white' : 'bg-white text-gray-400'}`}>
                          {s === 'BOTH' ? 'Both' : s}
                        </button>
                      ))}
                    </div>
                    <span className="text-[9px] text-gray-500">{scannerFilters.risk.minDte}-{scannerFilters.risk.maxDte}d</span>
                    <span className="text-[9px] text-gray-500">${scannerFilters.risk.minSpreadWidth}-${scannerFilters.risk.maxSpreadWidth}w</span>
                    <div className="relative">
                      <button onClick={() => setShowStrategyPopover(p => !p)}
                        className="text-[9px] text-brand-purple hover:underline">
                        {scannerFilters.risk.strategies.length > 0 ? `${scannerFilters.risk.strategies.length} strats` : '16 strats'}
                      </button>
                      {showStrategyPopover && (
                        <div className="absolute top-full left-0 mt-1 z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-2 w-[280px]" onClick={e => e.stopPropagation()}>
                          <div className="flex flex-wrap gap-1">
                            {AVAILABLE_STRATEGIES.map(s => {
                              const active = scannerFilters.risk.strategies.length === 0 || scannerFilters.risk.strategies.includes(s);
                              return (
                                <button key={s} onClick={() => {
                                  const curr = scannerFilters.risk.strategies;
                                  const next = curr.includes(s) ? curr.filter(x => x !== s) : [...curr, s];
                                  handleFiltersChange({ ...scannerFilters, risk: { ...scannerFilters.risk, strategies: next } });
                                }}
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${active ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-400 border border-gray-200'}`}>
                                  {s}
                                </button>
                              );
                            })}
                          </div>
                          <button onClick={() => handleFiltersChange({ ...scannerFilters, risk: { ...scannerFilters.risk, strategies: [] } })}
                            className="text-[9px] text-brand-purple hover:underline mt-1">Reset all</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Zone 3: Quantitative Filters (Liquidity + Edge) */}
                <div className="px-3 py-1.5 lg:flex-[4] lg:border-r border-b lg:border-b-0 border-gray-200 min-w-0">
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0">
                    {/* Liquidity Gates */}
                    <div className="space-y-0">
                      <div className="flex items-center gap-1"><span className="text-[8px] text-gray-400 w-14 text-right shrink-0">Min OI</span><input type="range" min={0} max={5000} step={50} value={scannerFilters.liquidity.minOpenInterest} onChange={e => handleFiltersChange({ ...scannerFilters, liquidity: { ...scannerFilters.liquidity, minOpenInterest: +e.target.value } })} className="flex-1 h-0.5 accent-brand-purple" /><span className="text-[8px] font-mono text-gray-600 w-8 text-right">{scannerFilters.liquidity.minOpenInterest}</span></div>
                      <div className="flex items-center gap-1"><span className="text-[8px] text-gray-400 w-14 text-right shrink-0">Spread</span><input type="range" min={1} max={50} value={scannerFilters.liquidity.maxBidAskSpreadPct} onChange={e => handleFiltersChange({ ...scannerFilters, liquidity: { ...scannerFilters.liquidity, maxBidAskSpreadPct: +e.target.value } })} className="flex-1 h-0.5 accent-brand-purple" /><span className="text-[8px] font-mono text-gray-600 w-8 text-right">{scannerFilters.liquidity.maxBidAskSpreadPct}%</span></div>
                      <div className="flex items-center gap-1"><span className="text-[8px] text-gray-400 w-14 text-right shrink-0">Volume</span><input type="range" min={0} max={10000000} step={100000} value={scannerFilters.liquidity.minUnderlyingVolume} onChange={e => handleFiltersChange({ ...scannerFilters, liquidity: { ...scannerFilters.liquidity, minUnderlyingVolume: +e.target.value } })} className="flex-1 h-0.5 accent-brand-purple" /><span className="text-[8px] font-mono text-gray-600 w-8 text-right">{scannerFilters.liquidity.minUnderlyingVolume >= 1e6 ? `${(scannerFilters.liquidity.minUnderlyingVolume / 1e6).toFixed(1)}M` : `${(scannerFilters.liquidity.minUnderlyingVolume / 1e3).toFixed(0)}K`}</span></div>
                      <div className="flex items-center gap-1"><span className="text-[8px] text-gray-400 w-14 text-right shrink-0">Liq</span><div className="flex gap-0.5">{[1,2,3,4,5].map(n => (<button key={n} onClick={() => handleFiltersChange({ ...scannerFilters, liquidity: { ...scannerFilters.liquidity, minLiquidityRating: n } })} className={`text-[10px] ${n <= scannerFilters.liquidity.minLiquidityRating ? 'text-brand-gold' : 'text-gray-300'}`}>*</button>))}</div></div>
                    </div>
                    {/* Edge Metrics */}
                    <div className="space-y-0">
                      <div className="flex items-center gap-1"><span className="text-[8px] text-gray-400 w-14 text-right shrink-0">PoP</span><input type="range" min={0} max={100} value={scannerFilters.edge.minPop} onChange={e => handleFiltersChange({ ...scannerFilters, edge: { ...scannerFilters.edge, minPop: +e.target.value } })} className="flex-1 h-0.5 accent-brand-purple" /><span className="text-[8px] font-mono text-gray-600 w-8 text-right">{scannerFilters.edge.minPop}%</span></div>
                      <div className="flex items-center gap-1"><span className="text-[8px] text-gray-400 w-14 text-right shrink-0">EV</span><input type="range" min={-500} max={1000} step={10} value={scannerFilters.edge.minEv} onChange={e => handleFiltersChange({ ...scannerFilters, edge: { ...scannerFilters.edge, minEv: +e.target.value } })} className="flex-1 h-0.5 accent-brand-purple" /><span className="text-[8px] font-mono text-gray-600 w-8 text-right">${scannerFilters.edge.minEv}</span></div>
                      <div className="flex items-center gap-1"><span className="text-[8px] text-gray-400 w-14 text-right shrink-0">IV Rank</span><input type="range" min={0} max={100} value={scannerFilters.edge.minIvRank} onChange={e => handleFiltersChange({ ...scannerFilters, edge: { ...scannerFilters.edge, minIvRank: +e.target.value } })} className="flex-1 h-0.5 accent-brand-purple" /><span className="text-[8px] font-mono text-gray-600 w-8 text-right">{scannerFilters.edge.minIvRank}%</span></div>
                      <div className="flex items-center gap-1"><span className="text-[8px] text-gray-400 w-14 text-right shrink-0">Vol</span><div className="flex gap-px rounded overflow-hidden border border-gray-200">{(['IV_ABOVE_HV', 'IV_BELOW_HV', 'ANY'] as const).map(v => (<button key={v} onClick={() => handleFiltersChange({ ...scannerFilters, edge: { ...scannerFilters.edge, volEdge: v } })} className={`px-1 py-px text-[8px] font-bold ${scannerFilters.edge.volEdge === v ? 'bg-brand-purple text-white' : 'bg-white text-gray-400'}`}>{v === 'IV_ABOVE_HV' ? 'IV>HV' : v === 'IV_BELOW_HV' ? 'IV<HV' : 'Any'}</button>))}</div></div>
                    </div>
                  </div>
                </div>

                {/* Zone 4: Scan Market */}
                <button onClick={() => { if (scanTriggerRef.current) scanTriggerRef.current(); }}
                  className="flex items-center justify-center px-4 py-2 bg-brand-gold hover:bg-brand-gold-bright text-white font-bold text-sm transition-colors whitespace-nowrap lg:rounded-r-xl">
                  Scan
                </button>
              </div>

              {/* ROW 2 — 7 Metrics Bar */}
              {(() => { const m = filteredMetrics; return (
              <div className="bg-white/90 backdrop-blur-sm rounded-lg">
                <div className="flex flex-wrap items-center gap-3 px-3 py-1.5">
                  <div className="flex items-center gap-1">
                    <span className="text-[8px] text-white/50 uppercase tracking-wider">Period</span>
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="border-0 outline-none bg-transparent text-[10px] text-white w-[90px]" />
                    <span className="text-white/30 text-[9px]">—</span>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="border-0 outline-none bg-transparent text-[10px] text-white w-[90px]" />
                    {(dateFrom || dateTo) && <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="text-[9px] text-white/50 hover:text-white">x</button>}
                  </div>
                  <div className="w-px h-3 bg-white/20" />
                  <div><span className="text-[8px] text-white/50 uppercase">P&L </span><span className={`text-[11px] font-mono font-semibold ${m.totalRealizedPL >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{fmtPL(m.totalRealizedPL)}</span></div>
                  <div className="w-px h-3 bg-white/20" />
                  <div><span className="text-[8px] text-white/50 uppercase">WR </span><span className="text-[11px] font-mono font-semibold text-white">{m.winRate}%</span></div>
                  <div className="w-px h-3 bg-white/20" />
                  <div><span className="text-[8px] text-white/50 uppercase">PF </span><span className="text-[11px] font-mono font-semibold text-white">{m.profitFactor >= 999 ? '∞' : m.profitFactor.toFixed(2)}</span></div>
                  <div className="w-px h-3 bg-white/20" />
                  <div><span className="text-[8px] text-white/50 uppercase">Max W </span><span className="text-[11px] font-mono font-semibold text-emerald-300">{fmt(m.largestWin)}</span></div>
                  <div className="w-px h-3 bg-white/20" />
                  <div><span className="text-[8px] text-white/50 uppercase">Max L </span><span className="text-[11px] font-mono font-semibold text-red-300">{fmt(Math.abs(m.largestLoss))}</span></div>
                  <div className="w-px h-3 bg-white/20" />
                  <div><span className="text-[8px] text-white/50 uppercase">Avg W </span><span className="text-[11px] font-mono font-semibold text-emerald-300">{fmt(m.avgWin)}</span></div>
                  <div className="w-px h-3 bg-white/20" />
                  <div><span className="text-[8px] text-white/50 uppercase">Avg L </span><span className="text-[11px] font-mono font-semibold text-red-300">{fmt(m.avgLoss)}</span></div>
                </div>
              </div>
              ); })()}

            </div>
          </div>

          {/* ── Page Content ── */}
          <div className="space-y-3">
            {/* P&L Calendar */}
            <div className="rounded-lg overflow-hidden border border-gray-200/50 shadow-sm">
              <div className="bg-brand-purple/80 text-white px-4 py-2.5 text-sm font-semibold">P&L Calendar</div>
              <div className="bg-white">
                <CalendarGrid
                  events={plCalendarEvents}
                  sourceConfig={PL_SOURCE_CONFIG}
                  defaultView="month"
                  showBudgetTotals={true}
                  showCategoryLegend={false}
                  compact={true}
                />
              </div>
            </div>

            {/* Brokerage Connection now in search bar — standalone section removed */}

            {/* ── Market Intelligence ── */}
            {isOwner && ttConnected && (
              <div className="mb-4">
                {ttLoading ? (
                  <div className="rounded-lg overflow-hidden border border-gray-200/50 shadow-sm bg-white p-8 text-center text-text-faint text-sm">Loading account data...</div>
                ) : ttDataError ? (
                  <div className="rounded-lg overflow-hidden border border-gray-200/50 shadow-sm bg-white p-6">
                    <div className="text-sm text-brand-red mb-3">{ttDataError}</div>
                    <button onClick={fetchTtData} className="text-xs text-brand-purple hover:underline font-medium">Retry</button>
                  </div>
                ) : (
                  <ConvergenceIntelligence
                    externalFilters={scannerFilters}
                    onFiltersChange={handleFiltersChange}
                    externalUniverse={scannerUniverse}
                    onUniverseChange={setScannerUniverse}
                    hideControls={true}
                    scanTriggerRef={scanTriggerRef}
                    scanningRef={scanningRef}
                  />
                )}
              </div>
            )}

            {/* ── Trade Lab ── */}
            <div className="mb-4">
              <TradeLabPanel
                onCardsChange={() => {
                  fetch('/api/trade-cards')
                    .then(r => r.json())
                    .then(data => setTradeCards(Array.isArray(data?.cards) ? data.cards : []));
                }}
              />
            </div>


                {/* Trade Journal */}
                <div className="rounded-lg overflow-hidden border border-gray-200/50 shadow-sm mb-4">
                  <div className="bg-brand-purple/80 text-white px-4 py-2.5 text-sm font-semibold flex items-center justify-between">
                    <span>Trade Journal</span>
                    <span className="text-xs text-text-faint">{filteredTrades.length} trades · {journalEntries.length} entries</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50">
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
                      <tbody className="divide-y divide-border">
                        {filteredTrades.map(trade => {
                          const journal = getJournalEntry(trade.tradeNum);
                          const isExpanded = expandedTrade === trade.tradeNum;

                          return (
                            <>
                              <tr key={trade.tradeNum} className={`hover:bg-bg-row ${isExpanded ? 'bg-brand-purple/5' : ''}`}>
                                <td className="px-3 py-2 font-mono text-text-secondary">#{trade.tradeNum}</td>
                                <td className="px-3 py-2 text-text-secondary">{new Date(trade.openDate).toLocaleDateString()}</td>
                                <td className="px-3 py-2 font-mono font-semibold">{trade.underlying}</td>
                                <td className="px-3 py-2">
                                  <span className="px-2 py-0.5 bg-brand-purple-wash text-brand-purple text-[10px]">{trade.strategy}</span>
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <span className={`px-2 py-0.5 text-[10px] ${trade.type === 'option' ? 'bg-purple-100 text-purple-700' : 'bg-bg-row text-text-secondary'}`}>
                                    {trade.type}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <span className={`px-2 py-0.5 text-[10px] ${
                                    trade.status === 'OPEN' ? 'bg-green-100 text-brand-green' :
                                    trade.status === 'PARTIAL' ? 'bg-yellow-100 text-yellow-700' :
                                    'bg-bg-row text-text-secondary'
                                  }`}>{trade.status}</span>
                                </td>
                                <td className={`px-3 py-2 text-right font-mono font-semibold ${
                                  trade.status === 'CLOSED' ? (trade.realizedPL >= 0 ? 'text-brand-green' : 'text-brand-red') : 'text-text-faint'
                                }`}>
                                  {trade.status === 'CLOSED' ? fmtPL(trade.realizedPL) : '—'}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  {journal?.rating ? (
                                    <span className="text-amber-500">{'★'.repeat(journal.rating)}{'☆'.repeat(5 - journal.rating)}</span>
                                  ) : <span className="text-text-faint">—</span>}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  {journal ? (
                                    <span className={`px-2 py-0.5 text-[10px] ${
                                      journal.emotion === 'confident' ? 'bg-emerald-100 text-brand-green' :
                                      journal.emotion === 'nervous' || journal.emotion === 'fearful' ? 'bg-yellow-100 text-yellow-700' :
                                      journal.emotion === 'fomo' || journal.emotion === 'revenge' || journal.emotion === 'greedy' ? 'bg-red-100 text-brand-red' :
                                      'bg-bg-row text-text-secondary'
                                    }`}>{journal.emotion}</span>
                                  ) : <span className="text-text-faint">—</span>}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <div className="flex items-center gap-1 justify-center">
                                    <button onClick={() => openJournalModal(trade)}
                                      className="px-2 py-1 text-[10px] bg-brand-purple text-white hover:bg-brand-purple-hover">
                                      {journal ? 'Edit' : 'Add'}
                                    </button>
                                    <button onClick={() => setExpandedTrade(isExpanded ? null : trade.tradeNum)}
                                      className="px-2 py-1 text-[10px] bg-bg-row text-text-secondary hover:bg-border">
                                      {isExpanded ? '▲' : '▼'}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr key={`${trade.tradeNum}-detail`}>
                                  <td colSpan={10} className="px-4 py-3 bg-bg-row">
                                    <div className="grid lg:grid-cols-2 gap-4 text-xs">
                                      <div>
                                        <div className="font-semibold text-text-secondary mb-2">Trade Details</div>
                                        <div className="space-y-1 text-text-secondary">
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
                                          <div className="font-semibold text-text-secondary mb-2">Journal Notes</div>
                                          <div className="space-y-1 text-text-secondary">
                                            {journal.thesis && <div><span className="font-medium">Thesis:</span> {journal.thesis}</div>}
                                            {journal.setup && <div><span className="font-medium">Setup:</span> {journal.setup}</div>}
                                            {journal.mistakes && <div><span className="font-medium text-brand-red">Mistakes:</span> {journal.mistakes}</div>}
                                            {journal.lessons && <div><span className="font-medium text-brand-green">Lessons:</span> {journal.lessons}</div>}
                                            {journal.tags?.length > 0 && (
                                              <div className="flex gap-1 flex-wrap">
                                                {journal.tags.map(tag => (
                                                  <span key={tag} className="px-2 py-0.5 bg-border text-text-secondary text-[10px]">{tag}</span>
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
                          <tr><td colSpan={10} className="px-3 py-8 text-center text-text-faint">No trades in selected period</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>


            {/* ── Data Observatory ── */}
            {isOwner && (
              <div className="mb-4">
                <DataObservatory />
              </div>
            )}

          </div>

        </div>
      </div>

      {/* Journal Entry Modal */}
      {journalModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setJournalModal(null)}>
          <div className="bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="bg-brand-purple/80 text-white px-4 py-3 flex justify-between items-center sticky top-0">
              <div>
                <div className="font-semibold">Trade Journal</div>
                <div className="text-xs text-text-faint">#{journalModal.trade.tradeNum} · {journalModal.trade.underlying}</div>
              </div>
              <button onClick={() => setJournalModal(null)} className="text-white/60 hover:text-white text-sm">×</button>
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Entry Type</label>
                <select value={journalForm.entryType} onChange={e => setJournalForm(p => ({ ...p, entryType: e.target.value }))}
                  className="w-full border border-border px-3 py-2 text-sm">
                  <option value="pre-trade">Pre-Trade (Planning)</option>
                  <option value="during">During Trade</option>
                  <option value="post-trade">Post-Trade (Review)</option>
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Thesis / Reason</label>
                <textarea value={journalForm.thesis} onChange={e => setJournalForm(p => ({ ...p, thesis: e.target.value }))}
                  className="w-full border border-border px-3 py-2 text-sm h-20" placeholder="Why did you take this trade?" />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Setup</label>
                  <select value={journalForm.setup} onChange={e => setJournalForm(p => ({ ...p, setup: e.target.value }))}
                    className="w-full border border-border px-3 py-2 text-sm">
                    <option value="">Select...</option>
                    {SETUPS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Emotion</label>
                  <select value={journalForm.emotion} onChange={e => setJournalForm(p => ({ ...p, emotion: e.target.value }))}
                    className="w-full border border-border px-3 py-2 text-sm">
                    {EMOTIONS.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Mistakes</label>
                <textarea value={journalForm.mistakes} onChange={e => setJournalForm(p => ({ ...p, mistakes: e.target.value }))}
                  className="w-full border border-border px-3 py-2 text-sm h-16" placeholder="What went wrong?" />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Lessons Learned</label>
                <textarea value={journalForm.lessons} onChange={e => setJournalForm(p => ({ ...p, lessons: e.target.value }))}
                  className="w-full border border-border px-3 py-2 text-sm h-16" placeholder="What will you do differently?" />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Rating (1-5)</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} onClick={() => setJournalForm(p => ({ ...p, rating: n }))}
                      className={`w-10 h-10 text-terminal-lg ${journalForm.rating >= n ? 'text-amber-500' : 'text-text-faint'}`}>
                      {journalForm.rating >= n ? '★' : '☆'}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Tags (comma separated)</label>
                <input type="text" value={journalForm.tags} onChange={e => setJournalForm(p => ({ ...p, tags: e.target.value }))}
                  className="w-full border border-border px-3 py-2 text-sm" placeholder="e.g., earnings, scalp, swing" />
              </div>
            </div>
            
            <div className="bg-bg-row px-4 py-3 flex justify-end gap-2 sticky bottom-0 border-t">
              <button onClick={() => setJournalModal(null)} className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary">
                Cancel
              </button>
              <button onClick={saveJournalEntry} disabled={saving}
                className="px-4 py-2 text-sm bg-brand-purple text-white hover:bg-brand-purple-hover disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Entry'}
              </button>
            </div>
          </div>
        </div>
      )}

    </AppLayout>
  );
}
