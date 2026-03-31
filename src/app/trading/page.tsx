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
import COAManagementTable from '@/components/bookkeeping/COAManagementTable';


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

  // Trade-to-ledger commit state
  const [committedTradeNums, setCommittedTradeNums] = useState<Set<string>>(new Set());
  const [commitLoading, setCommitLoading] = useState(false);
  const [commitResult, setCommitResult] = useState<{ committed: number; skipped: number; errors: string[] } | null>(null);

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
  const [openPopover, setOpenPopover] = useState<string | null>(null);
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
  const [tradingEntityId, setTradingEntityId] = useState<string | null>(null);

  // Load trading entity for COA management
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/entities');
        if (res.ok) {
          const data = await res.json();
          const entity = (data.entities || []).find((e: any) => e.entity_type === 'trading');
          if (entity) setTradingEntityId(entity.id);
        }
      } catch (err) { console.error('Failed to load entity:', err); }
    })();
  }, []);

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

  // Fetch committed trade nums from journal entries
  const loadCommittedTrades = useCallback(async () => {
    try {
      const res = await fetch('/api/journal-transactions?source_type=trading_position');
      if (res.ok) {
        const data = await res.json();
        const nums = new Set<string>(
          (data.entries || [])
            .filter((e: any) => e.source_type === 'trading_position' && e.source_id)
            .map((e: any) => e.source_id)
        );
        setCommittedTradeNums(nums);
      }
    } catch { /* ignore */ }
  }, []);

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
    loadCommittedTrades();
  }, [loadCommittedTrades]);

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
      details: data.trades.map(t => `${t.underlying} | ${t.strategy.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}`),
    }));
  }, [plByDate]);

  // Uncommitted closed trades (for ledger commit)
  const uncommittedTrades = useMemo(() => {
    if (!tradesData?.trades) return [];
    return tradesData.trades.filter(t =>
      t.status === 'CLOSED' &&
      t.tradeNum &&
      Math.abs(t.realizedPL) >= 0.01 &&
      !committedTradeNums.has(t.tradeNum)
    );
  }, [tradesData, committedTradeNums]);

  const commitTradesToLedger = async () => {
    if (uncommittedTrades.length === 0) return;
    setCommitLoading(true);
    setCommitResult(null);
    try {
      const tradeNums = [...new Set(uncommittedTrades.map(t => t.tradeNum!))];
      const res = await fetch('/api/trading/commit-to-ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tradeNums }),
      });
      if (res.ok) {
        const result = await res.json();
        setCommitResult(result);
        await loadCommittedTrades();
      } else {
        const data = await res.json().catch(() => ({}));
        setCommitResult({ committed: 0, skipped: 0, errors: [data.error || 'Failed to commit'] });
      }
    } catch (err) {
      setCommitResult({ committed: 0, skipped: 0, errors: ['Network error'] });
    } finally {
      setCommitLoading(false);
    }
  };

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
          <div className="-mx-4 lg:-mx-6 -mt-4 lg:-mt-6 px-3 lg:px-6 py-3 pb-5 bg-brand-purple/95 backdrop-blur-sm sticky top-0 z-40">
            <div className="max-w-[1800px] mx-auto">

              {/* ROW 1 — Scanner Bar (compact with category popovers) */}
              <div className="bg-white border-2 border-brand-gold/60 rounded-xl shadow-md flex flex-col lg:flex-row" style={{ overflow: 'visible' }}>

                {/* Zone 1: Identity */}
                <div className="px-4 py-3 lg:w-[160px] lg:flex-shrink-0 lg:border-r border-b lg:border-b-0 border-gray-200">
                  <div className="text-sm font-bold text-text-primary">Trading Dashboard</div>
                  <div className="flex items-center gap-1.5 mt-1">
                    {ttConnected ? (
                      <><div className="w-2 h-2 bg-emerald-500 rounded-full" /><span className="text-xs text-emerald-600">TT Connected</span></>
                    ) : ttConnected === false ? (
                      <><div className="w-2 h-2 bg-red-400 rounded-full" /><span className="text-xs text-text-muted">No Broker</span></>
                    ) : (
                      <span className="text-xs text-text-faint">Checking...</span>
                    )}
                  </div>
                </div>

                {/* Zone 2: Filters — inline toggles + category popovers */}
                <div className="px-4 py-2.5 lg:flex-1 lg:border-r border-b lg:border-b-0 border-gray-200 min-w-0 space-y-1.5">
                  {/* Row 1: Universe + Direction + Premium + Risk Type */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[{ val: 'sp500', label: 'S&P 500' }, { val: 'nasdaq100', label: 'Nasdaq 100' }].map(u => (
                      <button key={u.val} onClick={() => setScannerUniverse(u.val)}
                        className={`text-[11px] px-2 py-1 rounded-full border ${scannerUniverse === u.val ? 'bg-brand-purple/10 text-brand-purple border-brand-purple/30 font-medium' : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'}`}>
                        {u.label}
                      </button>
                    ))}
                    <div className="flex gap-px rounded overflow-hidden border border-gray-200 ml-1">
                      {(['ALL', 'BULLISH', 'BEARISH', 'NEUTRAL'] as const).map(d => (
                        <button key={d} onClick={() => handleFiltersChange({ ...scannerFilters, risk: { ...scannerFilters.risk, direction: d } })}
                          className={`px-2 py-1 text-[11px] font-bold ${scannerFilters.risk.direction === d ? 'bg-brand-purple text-white' : 'bg-white text-gray-400 hover:bg-gray-50'}`}>
                          {d === 'BULLISH' ? 'Bull' : d === 'BEARISH' ? 'Bear' : d === 'NEUTRAL' ? 'Ntrl' : 'All'}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-px rounded overflow-hidden border border-gray-200">
                      {(['SELL', 'BUY', 'BOTH'] as const).map(s => (
                        <button key={s} onClick={() => handleFiltersChange({ ...scannerFilters, risk: { ...scannerFilters.risk, premiumStance: s } })}
                          className={`px-2 py-1 text-[11px] font-bold ${scannerFilters.risk.premiumStance === s ? 'bg-brand-purple text-white' : 'bg-white text-gray-400 hover:bg-gray-50'}`}>
                          {s === 'BOTH' ? 'Both' : s}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-px rounded overflow-hidden border border-gray-200">
                      {(['DEFINED_ONLY', 'INCLUDE_UNLIMITED'] as const).map(r => (
                        <button key={r} onClick={() => handleFiltersChange({ ...scannerFilters, risk: { ...scannerFilters.risk, riskType: r } })}
                          className={`px-2 py-1 text-[11px] font-bold ${scannerFilters.risk.riskType === r ? 'bg-brand-purple text-white' : 'bg-white text-gray-400 hover:bg-gray-50'}`}>
                          {r === 'DEFINED_ONLY' ? 'Defined' : 'Unlimited'}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Row 2: Category popovers + DTE + Width + Strategies */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* Liquidity popover */}
                    <div className="relative">
                      <button onClick={() => setOpenPopover(openPopover === 'liquidity' ? null : 'liquidity')}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded-md border cursor-pointer ${openPopover === 'liquidity' ? 'bg-brand-purple/10 text-brand-purple border-brand-purple/30' : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'}`}>
                        Liquidity
                      </button>
                      {openPopover === 'liquidity' && (
                        <div className="absolute top-full left-0 mt-1 z-50 bg-white rounded-lg border-2 border-brand-gold/60 shadow-lg p-3 w-[300px]" onClick={e => e.stopPropagation()}>
                          <div className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-2">Liquidity Gates</div>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2"><span className="text-[11px] text-gray-600 w-[80px] shrink-0">Min OI</span><input type="range" min={0} max={5000} step={50} value={scannerFilters.liquidity.minOpenInterest} onChange={e => handleFiltersChange({ ...scannerFilters, liquidity: { ...scannerFilters.liquidity, minOpenInterest: +e.target.value } })} className="flex-1 h-1.5 accent-brand-purple cursor-pointer" /><span className="text-[11px] font-mono font-semibold text-gray-800 w-[50px] text-right">{scannerFilters.liquidity.minOpenInterest}</span></div>
                            <div className="flex items-center gap-2"><span className="text-[11px] text-gray-600 w-[80px] shrink-0">Max Spread</span><input type="range" min={1} max={50} value={scannerFilters.liquidity.maxBidAskSpreadPct} onChange={e => handleFiltersChange({ ...scannerFilters, liquidity: { ...scannerFilters.liquidity, maxBidAskSpreadPct: +e.target.value } })} className="flex-1 h-1.5 accent-brand-purple cursor-pointer" /><span className="text-[11px] font-mono font-semibold text-gray-800 w-[50px] text-right">{scannerFilters.liquidity.maxBidAskSpreadPct}%</span></div>
                            <div className="flex items-center gap-2"><span className="text-[11px] text-gray-600 w-[80px] shrink-0">Min Volume</span><input type="range" min={0} max={10000000} step={100000} value={scannerFilters.liquidity.minUnderlyingVolume} onChange={e => handleFiltersChange({ ...scannerFilters, liquidity: { ...scannerFilters.liquidity, minUnderlyingVolume: +e.target.value } })} className="flex-1 h-1.5 accent-brand-purple cursor-pointer" /><span className="text-[11px] font-mono font-semibold text-gray-800 w-[50px] text-right">{scannerFilters.liquidity.minUnderlyingVolume >= 1e6 ? `${(scannerFilters.liquidity.minUnderlyingVolume / 1e6).toFixed(1)}M` : `${(scannerFilters.liquidity.minUnderlyingVolume / 1e3).toFixed(0)}K`}</span></div>
                            <div className="flex items-center gap-2"><span className="text-[11px] text-gray-600 w-[80px] shrink-0">Min Rating</span><div className="flex gap-1">{[1,2,3,4,5].map(n => (<button key={n} onClick={() => handleFiltersChange({ ...scannerFilters, liquidity: { ...scannerFilters.liquidity, minLiquidityRating: n } })} className={`text-base ${n <= scannerFilters.liquidity.minLiquidityRating ? 'text-brand-gold' : 'text-gray-300'}`}>*</button>))}</div></div>
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Edge popover */}
                    <div className="relative">
                      <button onClick={() => setOpenPopover(openPopover === 'edge' ? null : 'edge')}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded-md border cursor-pointer ${openPopover === 'edge' ? 'bg-brand-purple/10 text-brand-purple border-brand-purple/30' : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'}`}>
                        Edge
                      </button>
                      {openPopover === 'edge' && (
                        <div className="absolute top-full left-0 mt-1 z-50 bg-white rounded-lg border-2 border-brand-gold/60 shadow-lg p-3 w-[300px]" onClick={e => e.stopPropagation()}>
                          <div className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-2">Edge Metrics</div>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2"><span className="text-[11px] text-gray-600 w-[80px] shrink-0">Min PoP</span><input type="range" min={0} max={100} value={scannerFilters.edge.minPop} onChange={e => handleFiltersChange({ ...scannerFilters, edge: { ...scannerFilters.edge, minPop: +e.target.value } })} className="flex-1 h-1.5 accent-brand-purple cursor-pointer" /><span className="text-[11px] font-mono font-semibold text-gray-800 w-[50px] text-right">{scannerFilters.edge.minPop}%</span></div>
                            <div className="flex items-center gap-2"><span className="text-[11px] text-gray-600 w-[80px] shrink-0">Min EV</span><input type="range" min={-500} max={1000} step={10} value={scannerFilters.edge.minEv} onChange={e => handleFiltersChange({ ...scannerFilters, edge: { ...scannerFilters.edge, minEv: +e.target.value } })} className="flex-1 h-1.5 accent-brand-purple cursor-pointer" /><span className="text-[11px] font-mono font-semibold text-gray-800 w-[50px] text-right">${scannerFilters.edge.minEv}</span></div>
                            <div className="flex items-center gap-2"><span className="text-[11px] text-gray-600 w-[80px] shrink-0">Min EV/Risk</span><input type="range" min={-200} max={200} step={5} value={Math.round(scannerFilters.edge.minEvPerRisk * 100)} onChange={e => handleFiltersChange({ ...scannerFilters, edge: { ...scannerFilters.edge, minEvPerRisk: +e.target.value / 100 } })} className="flex-1 h-1.5 accent-brand-purple cursor-pointer" /><span className="text-[11px] font-mono font-semibold text-gray-800 w-[50px] text-right">{scannerFilters.edge.minEvPerRisk.toFixed(2)}</span></div>
                            <div className="flex items-center gap-2"><span className="text-[11px] text-gray-600 w-[80px] shrink-0">Vol Edge</span><div className="flex gap-px rounded overflow-hidden border border-gray-200">{(['IV_ABOVE_HV', 'IV_BELOW_HV', 'ANY'] as const).map(v => (<button key={v} onClick={() => handleFiltersChange({ ...scannerFilters, edge: { ...scannerFilters.edge, volEdge: v } })} className={`px-2 py-0.5 text-[10px] font-bold ${scannerFilters.edge.volEdge === v ? 'bg-brand-purple text-white' : 'bg-white text-gray-400 hover:bg-gray-50'}`}>{v === 'IV_ABOVE_HV' ? 'IV>HV' : v === 'IV_BELOW_HV' ? 'IV<HV' : 'Any'}</button>))}</div></div>
                            <div className="flex items-center gap-2"><span className="text-[11px] text-gray-600 w-[80px] shrink-0">Min IV Rank</span><input type="range" min={0} max={100} value={scannerFilters.edge.minIvRank} onChange={e => handleFiltersChange({ ...scannerFilters, edge: { ...scannerFilters.edge, minIvRank: +e.target.value } })} className="flex-1 h-1.5 accent-brand-purple cursor-pointer" /><span className="text-[11px] font-mono font-semibold text-gray-800 w-[50px] text-right">{scannerFilters.edge.minIvRank}%</span></div>
                            <div className="flex items-center gap-2"><span className="text-[11px] text-gray-600 w-[80px] shrink-0">Sentiment</span><input type="range" min={-100} max={100} value={scannerFilters.edge.minSentiment} onChange={e => handleFiltersChange({ ...scannerFilters, edge: { ...scannerFilters.edge, minSentiment: +e.target.value } })} className="flex-1 h-1.5 accent-brand-purple cursor-pointer" /><span className="text-[11px] font-mono font-semibold text-gray-800 w-[50px] text-right">{(scannerFilters.edge.minSentiment / 100).toFixed(1)}</span></div>
                          </div>
                        </div>
                      )}
                    </div>
                    {/* DTE inline */}
                    <span className="text-[10px] text-gray-500">DTE</span>
                    <input type="number" min={0} max={365} value={scannerFilters.risk.minDte} onChange={e => handleFiltersChange({ ...scannerFilters, risk: { ...scannerFilters.risk, minDte: +e.target.value } })}
                      className="w-14 border border-gray-200 rounded px-1.5 py-0.5 text-xs font-mono text-center" />
                    <span className="text-gray-400 text-xs">—</span>
                    <input type="number" min={0} max={365} value={scannerFilters.risk.maxDte} onChange={e => handleFiltersChange({ ...scannerFilters, risk: { ...scannerFilters.risk, maxDte: +e.target.value } })}
                      className="w-14 border border-gray-200 rounded px-1.5 py-0.5 text-xs font-mono text-center" />
                    {/* Width inline */}
                    <span className="text-[10px] text-gray-500">W$</span>
                    <input type="number" min={0} max={100} value={scannerFilters.risk.minSpreadWidth} onChange={e => handleFiltersChange({ ...scannerFilters, risk: { ...scannerFilters.risk, minSpreadWidth: +e.target.value } })}
                      className="w-14 border border-gray-200 rounded px-1.5 py-0.5 text-xs font-mono text-center" />
                    <span className="text-gray-400 text-xs">—</span>
                    <input type="number" min={0} max={100} value={scannerFilters.risk.maxSpreadWidth} onChange={e => handleFiltersChange({ ...scannerFilters, risk: { ...scannerFilters.risk, maxSpreadWidth: +e.target.value } })}
                      className="w-14 border border-gray-200 rounded px-1.5 py-0.5 text-xs font-mono text-center" />
                    {/* Strategies popover */}
                    <div className="relative">
                      <button onClick={() => setOpenPopover(openPopover === 'strategies' ? null : 'strategies')}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded-md border cursor-pointer ${openPopover === 'strategies' ? 'bg-brand-purple/10 text-brand-purple border-brand-purple/30' : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'}`}>
                        {scannerFilters.risk.strategies.length > 0 ? `${scannerFilters.risk.strategies.length}/16 strats` : '16 strats'}
                      </button>
                      {openPopover === 'strategies' && (
                        <div className="absolute top-full right-0 mt-1 z-50 bg-white rounded-lg border-2 border-brand-gold/60 shadow-lg p-3 w-[320px]" onClick={e => e.stopPropagation()}>
                          <div className="flex flex-wrap gap-1">
                            {AVAILABLE_STRATEGIES.map(s => {
                              const active = scannerFilters.risk.strategies.length === 0 || scannerFilters.risk.strategies.includes(s);
                              return (
                                <button key={s} onClick={() => {
                                  const curr = scannerFilters.risk.strategies;
                                  const next = curr.includes(s) ? curr.filter(x => x !== s) : [...curr, s];
                                  handleFiltersChange({ ...scannerFilters, risk: { ...scannerFilters.risk, strategies: next } });
                                }}
                                  className={`px-2 py-0.5 rounded text-[11px] font-medium ${active ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-400 border border-gray-200'}`}>
                                  {s}
                                </button>
                              );
                            })}
                          </div>
                          <button onClick={() => handleFiltersChange({ ...scannerFilters, risk: { ...scannerFilters.risk, strategies: [] } })}
                            className="text-[11px] text-brand-purple hover:underline mt-2">Reset all</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Zone 3: Scan */}
                <button onClick={() => { setOpenPopover(null); if (scanTriggerRef.current) scanTriggerRef.current(); }}
                  className="flex items-center justify-center px-5 min-w-[80px] bg-brand-gold hover:bg-brand-gold-bright text-white font-bold text-base transition-colors whitespace-nowrap lg:rounded-r-xl shrink-0">
                  Scan
                </button>
              </div>

              {/* ROW 2 — 7 Metrics Bar */}
              {(() => { const m = filteredMetrics; return (
              <div className="bg-brand-purple/90 rounded-lg mt-2 px-3 py-2">
                <div className="flex items-center">
                  <div className="flex items-center gap-1.5 pr-3 border-r border-white/20 shrink-0">
                    <span className="text-[9px] text-white/50 uppercase">Period</span>
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="bg-white/20 border border-white/30 rounded px-1.5 py-0.5 text-white text-[11px] font-mono w-[100px] outline-none" />
                    <span className="text-white/50">—</span>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="bg-white/20 border border-white/30 rounded px-1.5 py-0.5 text-white text-[11px] font-mono w-[100px] outline-none" />
                    {(dateFrom || dateTo) && <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="text-white/50 hover:text-white text-xs">x</button>}
                  </div>
                  <div className="flex-1 grid grid-cols-7 text-center min-w-0">
                    <div className="px-2 border-r border-white/10 min-w-0"><div className="text-[9px] text-white/60 uppercase">P&L</div><div className={`text-sm font-bold font-mono truncate ${m.totalRealizedPL >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{fmtPL(m.totalRealizedPL)}</div></div>
                    <div className="px-2 border-r border-white/10 min-w-0"><div className="text-[9px] text-white/60 uppercase">WR</div><div className="text-sm font-bold font-mono text-white truncate">{m.winRate}%</div></div>
                    <div className="px-2 border-r border-white/10 min-w-0"><div className="text-[9px] text-white/60 uppercase">PF</div><div className="text-sm font-bold font-mono text-white truncate">{m.profitFactor >= 999 ? '∞' : m.profitFactor.toFixed(2)}</div></div>
                    <div className="px-2 border-r border-white/10 min-w-0"><div className="text-[9px] text-white/60 uppercase">Max W</div><div className="text-sm font-bold font-mono text-emerald-300 truncate">{fmt(m.largestWin)}</div></div>
                    <div className="px-2 border-r border-white/10 min-w-0"><div className="text-[9px] text-white/60 uppercase">Max L</div><div className="text-sm font-bold font-mono text-red-300 truncate">{fmt(Math.abs(m.largestLoss))}</div></div>
                    <div className="px-2 border-r border-white/10 min-w-0"><div className="text-[9px] text-white/60 uppercase">Avg W</div><div className="text-sm font-bold font-mono text-emerald-300 truncate">{fmt(m.avgWin)}</div></div>
                    <div className="px-2 min-w-0"><div className="text-[9px] text-white/60 uppercase">Avg L</div><div className="text-sm font-bold font-mono text-red-300 truncate">{fmt(m.avgLoss)}</div></div>
                  </div>
                </div>
              </div>
              ); })()}

            </div>
          </div>

          {/* ── Page Content ── */}
          <div className="space-y-3 mt-4">
            {/* Chart of Accounts */}
            {tradingEntityId && (
              <div className="overflow-hidden border-x border-b border-gray-200/50">
                <div className="bg-brand-purple/80 text-white px-4 py-2.5 text-sm font-semibold">Chart of Accounts</div>
                <div className="bg-white p-3">
                  <COAManagementTable
                    entityId={tradingEntityId}
                    entityName="Trading"
                    entityType="trading"
                  />
                </div>
              </div>
            )}

            {/* Commit Trades to Ledger */}
            {uncommittedTrades.length > 0 && (
              <div className="overflow-hidden border-x border-b border-gray-200/50">
                <div className="bg-brand-purple/80 text-white px-4 py-2.5 text-sm font-semibold">Commit Trades to Ledger</div>
                <div className="bg-white px-4 py-3 flex items-center justify-between">
                  <div>
                    <span className="text-sm text-text-primary font-medium">
                      {uncommittedTrades.length} closed trade{uncommittedTrades.length !== 1 ? 's' : ''} not yet in ledger
                    </span>
                    <span className="text-xs text-text-muted ml-2">
                      (Net P&L: {fmtCurrency(uncommittedTrades.reduce((s, t) => s + t.realizedPL, 0))})
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {commitResult && (
                      <span className={`text-xs ${commitResult.errors.length > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                        {commitResult.committed > 0 && `${commitResult.committed} committed`}
                        {commitResult.skipped > 0 && ` · ${commitResult.skipped} skipped`}
                        {commitResult.errors.length > 0 && ` · ${commitResult.errors.length} error${commitResult.errors.length !== 1 ? 's' : ''}`}
                      </span>
                    )}
                    <button
                      onClick={commitTradesToLedger}
                      disabled={commitLoading}
                      className="px-4 py-1.5 text-xs font-semibold bg-brand-gold text-white rounded hover:bg-brand-gold/90 disabled:opacity-50"
                    >
                      {commitLoading ? 'Committing...' : 'Commit to Ledger'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* P&L Calendar */}
            <div className="overflow-hidden border-x border-b border-gray-200/50">
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
                  <div className="overflow-hidden border-x border-b border-gray-200/50 bg-white p-4 text-center text-text-faint text-sm">Loading account data...</div>
                ) : ttDataError ? (
                  <div className="overflow-hidden border-x border-b border-gray-200/50 bg-white p-4">
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
                <div className="overflow-hidden border-x border-b border-gray-200/50">
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
