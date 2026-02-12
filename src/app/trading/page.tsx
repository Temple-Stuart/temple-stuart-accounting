'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
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

type TabType = 'overview' | 'positions' | 'market-intelligence';

const EMOTIONS = ['confident', 'neutral', 'nervous', 'fomo', 'revenge', 'greedy', 'fearful'];
const SETUPS = ['breakout', 'pullback', 'mean-reversion', 'momentum', 'earnings', 'theta-decay', 'volatility', 'other'];

export default function TradingPage() {
  const { data: session } = useSession();
  const userEmail = session?.user?.email || null;
  const isOwner = userEmail?.toLowerCase() === 'stuart.alexander.phi@gmail.com';

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [tradesData, setTradesData] = useState<TradesData | null>(null);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  
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

  const [maxTradeNum, setMaxTradeNum] = useState(0);

  // Tastytrade connection state
  const [ttConnected, setTtConnected] = useState<boolean | null>(null);
  const [ttAccounts, setTtAccounts] = useState<string[]>([]);
  const [ttConnecting, setTtConnecting] = useState(false);
  const [ttError, setTtError] = useState<string | null>(null);
  const [ttUsername, setTtUsername] = useState('');
  const [ttPassword, setTtPassword] = useState('');

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
  const [ttScannerData, setTtScannerData] = useState<any[]>([]);
  const [ttScannerLoading, setTtScannerLoading] = useState(false);
  const [ttScannerFetchedAt, setTtScannerFetchedAt] = useState<string | null>(null);
  const [ttScannerSort, setTtScannerSort] = useState<string>('ivRank');
  const [ttScannerSortDir, setTtScannerSortDir] = useState<'asc' | 'desc'>('desc');
  const [ttScannerCountdown, setTtScannerCountdown] = useState(60);
  const [ttScannerUniverse, setTtScannerUniverse] = useState<string>('popular');
  const [ttScannerCustomInput, setTtScannerCustomInput] = useState('');
  const [ttScannerTotalScanned, setTtScannerTotalScanned] = useState(0);
  const [ttVix, setTtVix] = useState<number | null>(null);

  // Check Tastytrade connection status when owner loads Market Intelligence
  useEffect(() => {
    if (!isOwner || activeTab !== 'market-intelligence') return;
    fetch('/api/tastytrade/status')
      .then(res => res.json())
      .then(data => {
        setTtConnected(data.connected || false);
        setTtAccounts(data.accountNumbers || []);
      })
      .catch(() => setTtConnected(false));
  }, [isOwner, activeTab]);

  // Scanner: fetch market metrics + VIX
  const fetchScannerData = async (universeOverride?: string) => {
    setTtScannerLoading(true);
    try {
      const uni = universeOverride ?? ttScannerUniverse;
      const params = new URLSearchParams({ universe: uni });
      if (uni === 'custom' && ttScannerCustomInput.trim()) {
        params.set('customSymbols', ttScannerCustomInput.trim());
      }
      const scanRes = await fetch(`/api/tastytrade/scanner?${params}`);
      if (scanRes.ok) {
        const data = await scanRes.json();
        setTtScannerData(data.metrics || []);
        setTtScannerTotalScanned(data.totalScanned || 0);
        setTtScannerFetchedAt(data.fetchedAt || new Date().toISOString());
        setTtScannerCountdown(60);
      }
    } catch {
      // ignore — scanner failure shouldn't break the rest
    }
    try {
      const vixRes = await fetch('/api/tastytrade/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: ['$VIX.X'] }),
      });
      if (vixRes.ok) {
        const data = await vixRes.json();
        const vq = data.quotes?.['$VIX.X'] || data.quotes?.['VIX'] || Object.values(data.quotes || {})[0];
        if (vq) setTtVix(vq.last || vq.mid || null);
      }
    } catch {
      // VIX fetch failure is non-critical
    }
    setTtScannerLoading(false);
  };

  // Auto-fetch scanner on connection, refresh every 60s
  useEffect(() => {
    if (!ttConnected || activeTab !== 'market-intelligence') return;
    if (ttScannerUniverse === 'custom') return; // custom only fetches on explicit Scan click
    fetchScannerData();
    const interval = setInterval(() => fetchScannerData(), 60000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ttConnected, activeTab, ttScannerUniverse]);

  // Countdown timer
  useEffect(() => {
    if (!ttScannerFetchedAt) return;
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - new Date(ttScannerFetchedAt).getTime()) / 1000);
      setTtScannerCountdown(Math.max(0, 60 - elapsed));
    }, 1000);
    return () => clearInterval(timer);
  }, [ttScannerFetchedAt]);

  // Sort scanner data
  const sortedScannerData = useMemo(() => {
    return [...ttScannerData].sort((a, b) => {
      const av = a[ttScannerSort] ?? 0;
      const bv = b[ttScannerSort] ?? 0;
      return ttScannerSortDir === 'desc' ? bv - av : av - bv;
    });
  }, [ttScannerData, ttScannerSort, ttScannerSortDir]);

  const handleScannerSort = (col: string) => {
    if (ttScannerSort === col) {
      setTtScannerSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setTtScannerSort(col);
      setTtScannerSortDir('desc');
    }
  };

  const handleScanSymbol = (symbol: string) => {
    setTtQuoteSymbol(symbol);
    setTtChainSymbol(symbol);
  };

  const handleTtConnect = async () => {
    if (!ttUsername || !ttPassword) {
      setTtError('Username and password are required');
      return;
    }
    setTtConnecting(true);
    setTtError(null);
    try {
      const res = await fetch('/api/tastytrade/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: ttUsername, password: ttPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTtError(data.error || 'Connection failed');
        return;
      }
      setTtConnected(true);
      setTtAccounts(data.accountNumbers || []);
      setTtUsername('');
      setTtPassword('');
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
    if (ttConnected && activeTab === 'market-intelligence') {
      fetchTtData();
    }
  }, [ttConnected, activeTab]);

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
              { key: 'positions', label: 'Open Positions' },
              { key: 'market-intelligence', label: 'Market Intelligence' },
            ].map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key as TabType)}
                className={`px-4 py-2 text-xs font-medium whitespace-nowrap transition-colors ${activeTab === tab.key ? 'bg-[#2d1b4e] text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                {tab.label}{tab.key === 'market-intelligence' && !isOwner ? ' \uD83D\uDD12' : ''}
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

                {/* Trade Journal */}
                <div className="border-t border-gray-200">
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

            {/* Market Intelligence Tab */}
            {activeTab === 'market-intelligence' && (
              <div>
                {isOwner ? (
                  <div className="space-y-4 p-4">
                    {/* Tastytrade Connection Card */}
                    <div className="bg-white border border-gray-200 p-6">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Brokerage Connection</div>
                          <div className="text-sm font-medium text-gray-900">Tastytrade</div>
                        </div>
                        {ttConnected && (
                          <div className="flex items-center gap-3">
                            <button
                              onClick={handleTtRefresh}
                              disabled={ttRefreshing}
                              className="text-xs text-gray-500 hover:text-gray-700 underline disabled:opacity-50"
                            >
                              {ttRefreshing ? 'Refreshing...' : 'Refresh Data'}
                            </button>
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                              <span className="text-xs text-emerald-600 font-medium">Connected</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {ttConnected === null ? (
                        <div className="text-xs text-gray-400">Checking connection...</div>
                      ) : ttConnected ? (
                        <div>
                          <div className="text-xs text-gray-500 mb-2">
                            Accounts: {ttAccounts.length > 0 ? ttAccounts.join(', ') : 'None found'}
                          </div>
                          <button
                            onClick={handleTtDisconnect}
                            className="text-xs text-red-500 hover:text-red-700 underline"
                          >
                            Disconnect
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-xs text-gray-500">Connect your Tastytrade account to enable market data and trading features.</p>
                          {ttError && (
                            <div className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2">{ttError}</div>
                          )}
                          <input
                            type="text"
                            placeholder="Tastytrade username or email"
                            value={ttUsername}
                            onChange={e => setTtUsername(e.target.value)}
                            className="w-full border border-gray-200 px-3 py-2 text-sm"
                          />
                          <input
                            type="password"
                            placeholder="Password"
                            value={ttPassword}
                            onChange={e => setTtPassword(e.target.value)}
                            className="w-full border border-gray-200 px-3 py-2 text-sm"
                            onKeyDown={e => e.key === 'Enter' && handleTtConnect()}
                          />
                          <button
                            onClick={handleTtConnect}
                            disabled={ttConnecting}
                            className="w-full px-4 py-2 text-xs font-medium bg-[#2d1b4e] text-white hover:bg-[#3d2b5e] disabled:opacity-50"
                          >
                            {ttConnecting ? 'Connecting...' : 'Connect Tastytrade'}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Live data or loading state */}
                    {ttConnected && ttLoading ? (
                      <div className="bg-white border border-gray-200 p-8 text-center">
                        <div className="text-sm text-gray-400">Loading account data...</div>
                      </div>
                    ) : ttConnected && ttDataError ? (
                      <div className="bg-white border border-gray-200 p-6">
                        <div className="text-sm text-red-600 mb-3">{ttDataError}</div>
                        <button onClick={fetchTtData} className="text-xs text-[#2d1b4e] hover:underline font-medium">Retry</button>
                      </div>
                    ) : ttConnected ? (
                      <>
                        {/* Market Regime Header */}
                        {ttVix !== null && (
                          <div className="bg-white border border-gray-200 px-6 py-3 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-gray-500 uppercase tracking-wider">VIX</span>
                              <span className="text-lg font-mono font-semibold">{ttVix.toFixed(2)}</span>
                              <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${
                                ttVix < 15 ? 'bg-emerald-100 text-emerald-700' :
                                ttVix < 20 ? 'bg-gray-100 text-gray-700' :
                                ttVix < 30 ? 'bg-amber-100 text-amber-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {ttVix < 15 ? 'Low Vol' : ttVix < 20 ? 'Normal' : ttVix < 30 ? 'Elevated' : 'High Vol'}
                              </span>
                            </div>
                            <div className="text-[10px] text-gray-400">
                              {ttVix < 15 ? 'Buying premium may outperform selling' :
                               ttVix < 20 ? 'Balanced environment for premium strategies' :
                               ttVix < 30 ? 'Elevated premiums — selling strategies favored' :
                               'Extreme vol — wide spreads, manage risk tightly'}
                            </div>
                          </div>
                        )}

                        {/* Volatility Scanner */}
                        <div className="bg-white border border-gray-200 p-6">
                          <div className="flex items-center justify-between mb-3">
                            <div className="text-xs text-gray-500 uppercase tracking-wider">Volatility Scanner</div>
                            <div className="flex items-center gap-3 text-[10px] text-gray-400">
                              {ttScannerFetchedAt && (
                                <span>Updated {new Date(ttScannerFetchedAt).toLocaleTimeString()}</span>
                              )}
                              <span>{ttScannerCountdown}s</span>
                              {ttScannerLoading && (
                                <div className="w-2.5 h-2.5 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                              )}
                            </div>
                          </div>

                          {/* Universe selector */}
                          <div className="flex items-center gap-2 mb-3 flex-wrap">
                            <label className="text-[10px] text-gray-500 font-medium">Universe:</label>
                            <select
                              value={ttScannerUniverse}
                              onChange={(e) => {
                                setTtScannerUniverse(e.target.value);
                              }}
                              className="text-xs border border-gray-200 rounded px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#2d1b4e]"
                            >
                              <optgroup label="Indices">
                                <option value="popular">Popular (50)</option>
                                <option value="megacap">Mega Cap (30)</option>
                                <option value="nasdaq100">Nasdaq 100</option>
                                <option value="dow30">Dow 30</option>
                                <option value="sp500">S&P 500</option>
                              </optgroup>
                              <optgroup label="ETFs">
                                <option value="etfs">ETFs (25)</option>
                              </optgroup>
                              <optgroup label="Sectors">
                                <option value="sector_tech">Tech</option>
                                <option value="sector_finance">Finance</option>
                                <option value="sector_energy">Energy</option>
                                <option value="sector_healthcare">Healthcare</option>
                                <option value="retail_favorites">Retail Favorites</option>
                              </optgroup>
                              <optgroup label="Custom">
                                <option value="custom">Custom</option>
                              </optgroup>
                            </select>
                            {ttScannerUniverse === 'custom' && (
                              <>
                                <input
                                  type="text"
                                  value={ttScannerCustomInput}
                                  onChange={(e) => setTtScannerCustomInput(e.target.value)}
                                  placeholder="AAPL, TSLA, NVDA..."
                                  className="text-xs border border-gray-200 rounded px-2 py-1 flex-1 min-w-[150px] focus:outline-none focus:ring-1 focus:ring-[#2d1b4e]"
                                  onKeyDown={(e) => { if (e.key === 'Enter') fetchScannerData(); }}
                                />
                                <button
                                  onClick={() => fetchScannerData()}
                                  disabled={ttScannerLoading || !ttScannerCustomInput.trim()}
                                  className="text-xs font-medium px-3 py-1 bg-[#2d1b4e] text-white rounded hover:bg-[#3d2b5e] disabled:opacity-50"
                                >Scan</button>
                              </>
                            )}
                          </div>

                          {ttScannerLoading && ttScannerUniverse === 'sp500' && (
                            <div className="flex items-center gap-2 mb-3 text-xs text-gray-400">
                              <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                              Scanning ~500 symbols...
                            </div>
                          )}

                          {sortedScannerData.length > 0 ? (
                            <div className="overflow-x-auto">
                              {ttScannerTotalScanned > 50 && (
                                <div className="text-[10px] text-gray-400 mb-1">
                                  Top {Math.min(50, sortedScannerData.length)} of {ttScannerTotalScanned} scanned (sorted by {ttScannerSort === 'ivRank' ? 'IV Rank' : ttScannerSort === 'ivPercentile' ? 'IV %ile' : ttScannerSort === 'impliedVolatility' ? 'IV' : 'Liquidity'} {ttScannerSortDir === 'desc' ? '\u25BC' : '\u25B2'})
                                </div>
                              )}
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-gray-200 text-gray-500">
                                    <th className="text-left px-2 py-1.5 font-medium">Symbol</th>
                                    {[
                                      { key: 'ivRank', label: 'IV Rank' },
                                      { key: 'ivPercentile', label: 'IV %ile' },
                                      { key: 'impliedVolatility', label: 'IV' },
                                      { key: 'liquidityRating', label: 'Liquidity' },
                                    ].map(col => (
                                      <th
                                        key={col.key}
                                        className="text-right px-2 py-1.5 font-medium cursor-pointer hover:text-gray-900 select-none"
                                        onClick={() => handleScannerSort(col.key)}
                                      >
                                        {col.label}{ttScannerSort === col.key ? (ttScannerSortDir === 'desc' ? ' \u25BC' : ' \u25B2') : ''}
                                      </th>
                                    ))}
                                    <th className="text-center px-2 py-1.5 font-medium">Earnings</th>
                                    <th className="text-center px-2 py-1.5 font-medium"></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {sortedScannerData.slice(0, 50).map((m: any) => (
                                    <tr key={m.symbol} className="border-b border-gray-50 hover:bg-gray-50">
                                      <td className="px-2 py-1.5 font-mono font-medium text-gray-900">{m.symbol}</td>
                                      <td className={`text-right px-2 py-1.5 font-mono ${
                                        m.ivRank > 50 ? 'text-emerald-600 font-medium' :
                                        m.ivRank < 20 ? 'text-red-500' : 'text-gray-700'
                                      }`}>{(m.ivRank * 100).toFixed(1)}</td>
                                      <td className="text-right px-2 py-1.5 font-mono text-gray-600">{(m.ivPercentile * 100).toFixed(1)}</td>
                                      <td className="text-right px-2 py-1.5 font-mono text-gray-600">{(m.impliedVolatility * 100).toFixed(1)}%</td>
                                      <td className="text-right px-2 py-1.5 font-mono text-gray-500">{m.liquidityRating || '\u2014'}</td>
                                      <td className="text-center px-2 py-1.5">
                                        {m.daysTillEarnings !== null && m.daysTillEarnings >= 0 && m.daysTillEarnings <= 30 ? (
                                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                                            m.daysTillEarnings <= 7 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                                          }`}>
                                            {m.daysTillEarnings <= 7 ? '\u26A1 ' : ''}{m.daysTillEarnings}d
                                          </span>
                                        ) : (
                                          <span className="text-gray-300">{'\u2014'}</span>
                                        )}
                                      </td>
                                      <td className="text-center px-2 py-1.5">
                                        <button
                                          onClick={() => handleScanSymbol(m.symbol)}
                                          className="text-[10px] font-medium text-[#2d1b4e] hover:underline"
                                        >Scan</button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : !ttScannerLoading ? (
                            <div className="text-xs text-gray-400">
                              No scanner data available.{' '}
                              <button onClick={() => fetchScannerData()} className="text-[#2d1b4e] hover:underline font-medium">Retry</button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center py-4 gap-2 text-xs text-gray-400">
                              <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                              Loading scanner data...
                            </div>
                          )}
                        </div>

                        {/* Card 1 — Account Overview */}
                        <div className="bg-white border border-gray-200 p-6">
                          <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">Account Overview</div>
                          {ttBalances.length === 0 ? (
                            <div className="text-sm text-gray-400">No account data available</div>
                          ) : (
                            <div className="space-y-3">
                              {ttBalances.map((bal: any) => (
                                <div key={bal.accountNumber} className="border border-gray-100 p-3">
                                  <div className="text-xs font-medium text-gray-700 mb-2">{bal.accountNumber}</div>
                                  <div className="grid grid-cols-3 gap-3">
                                    <div>
                                      <div className="text-[10px] text-gray-400 uppercase">Net Liq</div>
                                      <div className="text-sm font-mono font-medium">{fmtCurrency(bal.netLiq)}</div>
                                    </div>
                                    <div>
                                      <div className="text-[10px] text-gray-400 uppercase">Cash</div>
                                      <div className="text-sm font-mono">{fmtCurrency(bal.cashBalance)}</div>
                                    </div>
                                    <div>
                                      <div className="text-[10px] text-gray-400 uppercase">Buying Power</div>
                                      <div className="text-sm font-mono">{fmtCurrency(bal.buyingPower)}</div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Card 2 — Open Positions */}
                        <div className="bg-white border border-gray-200 p-6">
                          <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">Open Positions</div>
                          {ttPositions.length === 0 ? (
                            <div className="text-sm text-gray-400">No open positions</div>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-gray-200 text-gray-500">
                                    <th className="text-left px-2 py-1.5 font-medium">Symbol</th>
                                    <th className="text-left px-2 py-1.5 font-medium">Type</th>
                                    <th className="text-right px-2 py-1.5 font-medium">Qty</th>
                                    <th className="text-right px-2 py-1.5 font-medium">Avg Price</th>
                                    <th className="text-right px-2 py-1.5 font-medium">Mkt Value</th>
                                    <th className="text-right px-2 py-1.5 font-medium">P&L</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {ttPositions.map((pos: any, i: number) => (
                                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                                      <td className="px-2 py-1.5 font-medium">{pos.symbol}</td>
                                      <td className="px-2 py-1.5">
                                        <span className={`px-1.5 py-0.5 text-[10px] ${pos.instrumentType === 'Equity' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                                          {pos.instrumentType}
                                        </span>
                                      </td>
                                      <td className="px-2 py-1.5 text-right font-mono">{pos.quantity}</td>
                                      <td className="px-2 py-1.5 text-right font-mono">{fmtCurrency(pos.averageOpenPrice)}</td>
                                      <td className="px-2 py-1.5 text-right font-mono">{fmtCurrency(pos.marketValue)}</td>
                                      <td className={`px-2 py-1.5 text-right font-mono ${pos.unrealizedPL >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                        {pos.unrealizedPL >= 0 ? '+' : ''}{fmtCurrency(pos.unrealizedPL)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>

                        {/* Card 3 — Quick Quote */}
                        <div className="bg-white border border-gray-200 p-6">
                          <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">Quick Quote</div>
                          <div className="flex gap-2 mb-3">
                            <input
                              type="text"
                              placeholder="Symbol (e.g. SPY)"
                              value={ttQuoteSymbol}
                              onChange={e => setTtQuoteSymbol(e.target.value.toUpperCase())}
                              onKeyDown={e => e.key === 'Enter' && handleTtQuote()}
                              className="flex-1 border border-gray-200 px-3 py-2 text-sm font-mono"
                            />
                            <button
                              onClick={handleTtQuote}
                              disabled={ttQuoteLoading || !ttQuoteSymbol.trim()}
                              className="px-4 py-2 text-xs font-medium bg-[#2d1b4e] text-white hover:bg-[#3d2b5e] disabled:opacity-50"
                            >
                              {ttQuoteLoading ? 'Loading...' : 'Get Quote'}
                            </button>
                          </div>
                          {ttQuoteData && Object.keys(ttQuoteData).length > 0 && (
                            <div className="border border-gray-100 p-3">
                              {Object.entries(ttQuoteData).map(([sym, q]: [string, any]) => (
                                <div key={sym}>
                                  <div className="text-sm font-medium text-gray-900 mb-2">{sym}</div>
                                  <div className="grid grid-cols-5 gap-3 text-xs">
                                    <div><span className="text-gray-400">Bid</span><div className="font-mono">{q.bid?.toFixed(2)}</div></div>
                                    <div><span className="text-gray-400">Ask</span><div className="font-mono">{q.ask?.toFixed(2)}</div></div>
                                    <div><span className="text-gray-400">Mid</span><div className="font-mono">{q.mid?.toFixed(2)}</div></div>
                                    <div><span className="text-gray-400">Last</span><div className="font-mono">{q.last?.toFixed(2) || '—'}</div></div>
                                    <div><span className="text-gray-400">Volume</span><div className="font-mono">{(q.volume || 0).toLocaleString()}</div></div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          {ttQuoteData && Object.keys(ttQuoteData).length === 0 && (
                            <div className="text-xs text-gray-400">No quote data received — market may be closed</div>
                          )}
                        </div>

                        {/* Card 4 — Option Chain Lookup */}
                        <div className="bg-white border border-gray-200 p-6">
                          <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">Option Chain Lookup</div>
                          <div className="flex gap-2 mb-3">
                            <input
                              type="text"
                              placeholder="Symbol (e.g. AAPL)"
                              value={ttChainSymbol}
                              onChange={e => setTtChainSymbol(e.target.value.toUpperCase())}
                              onKeyDown={e => e.key === 'Enter' && handleTtChain()}
                              className="flex-1 border border-gray-200 px-3 py-2 text-sm font-mono"
                            />
                            <button
                              onClick={handleTtChain}
                              disabled={ttChainLoading || !ttChainSymbol.trim()}
                              className="px-4 py-2 text-xs font-medium bg-[#2d1b4e] text-white hover:bg-[#3d2b5e] disabled:opacity-50"
                            >
                              {ttChainLoading ? 'Loading...' : 'Load Chain'}
                            </button>
                          </div>
                          {ttChainData && ttChainData.expirations?.length > 0 && (
                            <div className="space-y-1">
                              {ttChainData.expirations.map((exp: any, i: number) => {
                                const isExp = ttExpandedExp === i;
                                const hasFetched = ttGreeksFetched.has(i);
                                const visibleStrikes = (exp.strikes || []).filter((s: any) => {
                                  if (ttShowAllStrikes || !hasFetched) return true;
                                  return ttGreeksData[s.callStreamerSymbol] || ttGreeksData[s.putStreamerSymbol];
                                });
                                return (
                                  <div key={i} className="border border-gray-100">
                                    <div
                                      className="px-3 py-2 flex items-center justify-between text-xs cursor-pointer hover:bg-gray-50"
                                      onClick={() => handleExpandExp(i, exp)}
                                    >
                                      <div className="font-medium text-gray-700">{exp.date}</div>
                                      <div className="flex gap-4 text-gray-500 items-center">
                                        <span>{exp.dte} DTE</span>
                                        <span>{exp.strikes?.length || 0} strikes</span>
                                        <span className="text-[10px]">{isExp ? '\u25B2' : '\u25BC'}</span>
                                      </div>
                                    </div>
                                    {isExp && (
                                      <div className="border-t border-gray-100 px-2 py-2">
                                        {ttGreeksLoading && !hasFetched ? (
                                          <div className="flex items-center justify-center py-4 gap-2 text-xs text-gray-400">
                                            <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                                            Loading Greeks...
                                          </div>
                                        ) : (
                                          <>
                                            {hasFetched && (
                                              <div className="flex justify-end mb-1">
                                                <button
                                                  onClick={(e) => { e.stopPropagation(); setTtShowAllStrikes(p => !p); }}
                                                  className="text-[10px] text-gray-400 hover:text-gray-600 underline"
                                                >
                                                  {ttShowAllStrikes ? 'Show active only' : 'Show all strikes'}
                                                </button>
                                              </div>
                                            )}
                                            <div className="overflow-x-auto">
                                              <table className="w-full text-[10px]">
                                                <thead>
                                                  <tr className="border-b border-gray-200 text-gray-500">
                                                    <th className="text-right px-1 py-1 font-medium">Bid</th>
                                                    <th className="text-right px-1 py-1 font-medium">Ask</th>
                                                    <th className="text-right px-1 py-1 font-medium">Vol</th>
                                                    <th className="text-right px-1 py-1 font-medium">OI</th>
                                                    <th className="text-right px-1 py-1 font-medium">IV</th>
                                                    <th className="text-right px-1 py-1 font-medium">{'\u0394'}</th>
                                                    <th className="text-right px-1 py-1 font-medium">{'\u0393'}</th>
                                                    <th className="text-right px-1 py-1 font-medium">{'\u0398'}</th>
                                                    <th className="text-right px-1 py-1 font-medium">{'\u03BD'}</th>
                                                    <th className="text-right px-1 py-1 font-medium">{'\u03C1'}</th>
                                                    <th className="text-center px-1 py-1 font-semibold bg-gray-50">Strike</th>
                                                    <th className="text-left px-1 py-1 font-medium">{'\u03C1'}</th>
                                                    <th className="text-left px-1 py-1 font-medium">{'\u03BD'}</th>
                                                    <th className="text-left px-1 py-1 font-medium">{'\u0398'}</th>
                                                    <th className="text-left px-1 py-1 font-medium">{'\u0393'}</th>
                                                    <th className="text-left px-1 py-1 font-medium">{'\u0394'}</th>
                                                    <th className="text-left px-1 py-1 font-medium">IV</th>
                                                    <th className="text-left px-1 py-1 font-medium">OI</th>
                                                    <th className="text-left px-1 py-1 font-medium">Vol</th>
                                                    <th className="text-left px-1 py-1 font-medium">Bid</th>
                                                    <th className="text-left px-1 py-1 font-medium">Ask</th>
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  {visibleStrikes.map((s: any, j: number) => {
                                                    const cg = ttGreeksData[s.callStreamerSymbol];
                                                    const pg = ttGreeksData[s.putStreamerSymbol];
                                                    const d = '\u2014';
                                                    return (
                                                      <tr key={j} className="border-b border-gray-50 hover:bg-gray-50">
                                                        <td className="text-right px-1 py-0.5 font-mono text-gray-600">{cg?.bid != null ? cg.bid.toFixed(2) : d}</td>
                                                        <td className="text-right px-1 py-0.5 font-mono text-gray-600">{cg?.ask != null ? cg.ask.toFixed(2) : d}</td>
                                                        <td className="text-right px-1 py-0.5 font-mono text-gray-500">{cg?.volume != null ? cg.volume.toLocaleString() : d}</td>
                                                        <td className="text-right px-1 py-0.5 font-mono text-gray-500">{cg?.openInterest != null ? cg.openInterest.toLocaleString() : d}</td>
                                                        <td className="text-right px-1 py-0.5 font-mono text-gray-600">{cg?.iv != null ? (cg.iv * 100).toFixed(1) + '%' : d}</td>
                                                        <td className="text-right px-1 py-0.5 font-mono text-emerald-600">{cg?.delta != null ? cg.delta.toFixed(3) : d}</td>
                                                        <td className="text-right px-1 py-0.5 font-mono text-gray-500">{cg?.gamma != null ? cg.gamma.toFixed(4) : d}</td>
                                                        <td className="text-right px-1 py-0.5 font-mono text-gray-500">{cg?.theta != null ? cg.theta.toFixed(3) : d}</td>
                                                        <td className="text-right px-1 py-0.5 font-mono text-gray-500">{cg?.vega != null ? cg.vega.toFixed(3) : d}</td>
                                                        <td className="text-right px-1 py-0.5 font-mono text-gray-500">{cg?.rho != null ? cg.rho.toFixed(4) : d}</td>
                                                        <td className="text-center px-1 py-0.5 font-mono font-semibold bg-gray-50">{s.strike.toFixed(2)}</td>
                                                        <td className="text-left px-1 py-0.5 font-mono text-gray-500">{pg?.rho != null ? pg.rho.toFixed(4) : d}</td>
                                                        <td className="text-left px-1 py-0.5 font-mono text-gray-500">{pg?.vega != null ? pg.vega.toFixed(3) : d}</td>
                                                        <td className="text-left px-1 py-0.5 font-mono text-gray-500">{pg?.theta != null ? pg.theta.toFixed(3) : d}</td>
                                                        <td className="text-left px-1 py-0.5 font-mono text-gray-500">{pg?.gamma != null ? pg.gamma.toFixed(4) : d}</td>
                                                        <td className="text-left px-1 py-0.5 font-mono text-red-600">{pg?.delta != null ? pg.delta.toFixed(3) : d}</td>
                                                        <td className="text-left px-1 py-0.5 font-mono text-gray-600">{pg?.iv != null ? (pg.iv * 100).toFixed(1) + '%' : d}</td>
                                                        <td className="text-left px-1 py-0.5 font-mono text-gray-500">{pg?.openInterest != null ? pg.openInterest.toLocaleString() : d}</td>
                                                        <td className="text-left px-1 py-0.5 font-mono text-gray-500">{pg?.volume != null ? pg.volume.toLocaleString() : d}</td>
                                                        <td className="text-left px-1 py-0.5 font-mono text-gray-600">{pg?.bid != null ? pg.bid.toFixed(2) : d}</td>
                                                        <td className="text-left px-1 py-0.5 font-mono text-gray-600">{pg?.ask != null ? pg.ask.toFixed(2) : d}</td>
                                                      </tr>
                                                    );
                                                  })}
                                                  {visibleStrikes.length === 0 && hasFetched && (
                                                    <tr><td colSpan={21} className="text-center py-3 text-gray-400 text-xs">No active strikes with data</td></tr>
                                                  )}
                                                </tbody>
                                              </table>
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {ttChainData && ttChainData.expirations?.length === 0 && (
                            <div className="text-xs text-gray-400">No expirations found in 0–45 DTE range</div>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="bg-white border border-gray-200 p-6">
                          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Account Overview</div>
                          <div className="text-sm text-gray-400">Connect brokerage to view account data</div>
                        </div>
                        <div className="bg-white border border-gray-200 p-6">
                          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Positions</div>
                          <div className="text-sm text-gray-400">Connect brokerage to view positions</div>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center min-h-[500px] p-8">
                    <div className="max-w-md w-full bg-gradient-to-b from-[#1a0f2e] to-[#2d1b4e] border border-[#3d2b5e] p-8 text-center">
                      <div className="mb-4">
                        <svg className="w-12 h-12 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                        </svg>
                      </div>
                      <h2 className="text-xl font-bold text-white mb-2">Market Intelligence</h2>
                      <p className="text-sm text-gray-400 mb-6">Real-time market data, AI-powered strategy builder, and live trading signals</p>
                      <div className="text-left space-y-3 mb-8">
                        {[
                          'Live stock, options, crypto & futures data',
                          'AI algo builder — describe strategies in plain English',
                          'Backtest against historical data',
                          'Live signal alerts',
                          'Tax-aware trade warnings (wash sales, ST/LT impact)',
                        ].map((feature, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm text-gray-300">
                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full flex-shrink-0"></div>
                            <span>{feature}</span>
                          </div>
                        ))}
                      </div>
                      <div className="inline-block px-6 py-2 bg-white/10 border border-white/20 text-sm font-medium text-gray-300 cursor-default">
                        Coming Soon
                      </div>
                      <p className="text-xs text-gray-500 mt-4">Included in the Trader Pro plan</p>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>

        </div>
      </div>

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
