'use client';

import { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
import { useSession } from 'next-auth/react';
import { AppLayout } from '@/components/ui';
import {
  getStrategyLabels,
  generateStrategies,
  buildStrikeData,
  buildCustomCard,
  detectStrategyName,
  renderPnlSvg,
  type StrategyCard,
  type StrategyLabel,
  type CustomLeg,
} from '@/lib/strategy-builder';
import ConvergenceIntelligence from '@/components/convergence/ConvergenceIntelligence';


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

interface MarketBrief {
  regime: string;
  sectorHeatmap: string;
  riskClusters: {
    earningsCluster: string[];
    sectorConcentration: string[];
    risingVol: string[];
    backwardation: string[];
    anomalous: string[];
  };
  topNotes: { symbol: string; note: string }[];
  marginal: { symbol: string; note: string }[];
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
  const [ttScannerData, setTtScannerData] = useState<any[]>([]);
  const [ttScannerLoading, setTtScannerLoading] = useState(false);
  const [ttScannerFetchedAt, setTtScannerFetchedAt] = useState<string | null>(null);
  const [ttScannerSort, setTtScannerSort] = useState<string>('score');
  const [ttScannerSortDir, setTtScannerSortDir] = useState<'asc' | 'desc'>('desc');
  const [ttScannerCountdown, setTtScannerCountdown] = useState(60);
  const [ttScannerUniverse, setTtScannerUniverse] = useState<string>('popular');
  const [ttScannerStarted, setTtScannerStarted] = useState(false);
  const [ttScannerCustomInput, setTtScannerCustomInput] = useState('');
  const [ttScannerTotalScanned, setTtScannerTotalScanned] = useState(0);
  const [ttVix, setTtVix] = useState<number | null>(null);

  // Market Brief states
  const [marketBrief, setMarketBrief] = useState<MarketBrief | null>(null);
  const [marketBriefLoading, setMarketBriefLoading] = useState(false);
  const [marketBriefError, setMarketBriefError] = useState<string | null>(null);
  const [marketBriefUniverse, setMarketBriefUniverse] = useState<string | null>(null);

  // Strategy Builder states
  const [sbExpandedSymbol, setSbExpandedSymbol] = useState<string | null>(null);
  const [sbLoading, setSbLoading] = useState(false);
  const [sbQuotePrice, setSbQuotePrice] = useState<number | null>(null);
  const [sbChainData, setSbChainData] = useState<any | null>(null);
  const [sbGreeksData, setSbGreeksData] = useState<Record<string, any>>({});
  const [sbStrategies, setSbStrategies] = useState<StrategyCard[]>([]);
  const [sbSelectedExp, setSbSelectedExp] = useState<number | null>(null);

  // Per-strategy AI analysis
  const [strategyAnalyses, setStrategyAnalyses] = useState<Record<string, { strategy: string; analysis: string }[]>>({});
  const [strategyAnalysisLoading, setStrategyAnalysisLoading] = useState<Record<string, boolean>>({});

  // Top Picks — dedicated strategy analysis for brief's top tickers
  const [topPicksData, setTopPicksData] = useState<Record<string, {
    status: 'loading' | 'strategies' | 'analyzing' | 'done' | 'error';
    price?: number;
    expDate?: string;
    dte?: number;
    strategies?: StrategyCard[];
    analyses?: { strategy: string; analysis: string }[];
    finnhub?: {
      news: { count: number; articles: { headline: string; source: string; daysAgo: number; url: string }[] } | null;
      analysts: { strongBuy: number; buy: number; hold: number; sell: number; strongSell: number; period: string } | null;
      priceTarget: { high: number; low: number; mean: number; median: number; numberAnalysts: number } | null;
      priceTargetStatus?: number; // HTTP status if price target was blocked (e.g. 403 = premium)
    } | null;
    error?: string;
  }>>({});
  const [topPicksTriggered, setTopPicksTriggered] = useState(false);

  // Click-to-build
  const [sbCustomLegs, setSbCustomLegs] = useState<CustomLeg[]>([]);
  const [sbCustomCard, setSbCustomCard] = useState<StrategyCard | null>(null);


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

  const startScan = (universeOverride?: string) => {
    setTtScannerStarted(true);
    fetchScannerData(universeOverride);
  };

  // Auto-fetch scanner on connection, refresh every 60s (only after explicit scan)
  useEffect(() => {
    if (!ttConnected || activeTab !== 'market-intelligence') return;
    if (!ttScannerStarted) return; // Wait for explicit scan
    if (ttScannerUniverse === 'custom') return; // custom only fetches on explicit Scan click
    fetchScannerData();
    const interval = setInterval(() => fetchScannerData(), 60000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ttConnected, activeTab, ttScannerUniverse, ttScannerStarted]);

  // Countdown timer
  useEffect(() => {
    if (!ttScannerFetchedAt) return;
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - new Date(ttScannerFetchedAt).getTime()) / 1000);
      setTtScannerCountdown(Math.max(0, 60 - elapsed));
    }, 1000);
    return () => clearInterval(timer);
  }, [ttScannerFetchedAt]);

  // Composite scoring function — max 100 (with HV trend bonus)
  const computeScore = (t: any): number => {
    let score = 0;

    // === IV-HV Spread (0-30 pts) — THE EDGE ===
    const spread = t.ivHvSpread ?? 0;
    const clampedSpread = Math.min(spread, 100);
    if (clampedSpread >= 20) score += 30;
    else if (clampedSpread >= 15) score += 25;
    else if (clampedSpread >= 10) score += 20;
    else if (clampedSpread >= 5) score += 12;
    else if (clampedSpread >= 0) score += 5;

    // HV Trend Bonus/Penalty
    const hv30 = t.hv30, hv60 = t.hv60, hv90 = t.hv90;
    if (hv30 != null && hv60 != null && hv90 != null) {
      if (hv30 < hv60 && hv60 < hv90) score += 5;
      else if (hv30 > hv60 && hv60 > hv90) score -= 3;
    }

    // === IV Rank (0-20 pts) — RELATIVE RICHNESS ===
    const ivr = (t.ivRank ?? 0) * 100;
    if (ivr >= 80) score += 20;
    else if (ivr >= 60) score += 16;
    else if (ivr >= 40) score += 12;
    else if (ivr >= 20) score += 6;
    else score += 2;

    // === Liquidity (0-20 pts) — EXECUTION QUALITY ===
    const liq = t.liquidityRating ?? 0;
    if (liq >= 5) score += 20;
    else if (liq >= 4) score += 18;
    else if (liq >= 3) score += 12;
    else if (liq >= 2) score += 6;

    // === Term Structure Shape (0-10 pts) — MARKET REGIME ===
    const ts = t.termStructure;
    if (ts && ts.length >= 3) {
      const nearIv = ts[0]?.iv ?? 0;
      const farIv = ts[Math.min(ts.length - 1, 5)]?.iv ?? 0;
      if (nearIv > 0 && farIv > 0) {
        if (farIv > nearIv * 1.02) score += 10;
        else if (farIv > nearIv * 0.95) score += 7;
        else score += 3;
      } else {
        score += 5;
      }
    } else {
      score += 5;
    }

    // === Earnings Buffer (0-10 pts) — EVENT RISK ===
    const dte = t.daysTillEarnings;
    if (dte === null || dte === undefined) score += 10;
    else if (dte < 0) score += 10;
    else if (dte > 30) score += 8;
    else if (dte >= 14) score += 5;
    else if (dte >= 7) score += 2;

    // === Lendability (0-5 pts) — SQUEEZE RISK ===
    if (t.lendability === 'Easy To Borrow') score += 5;
    else if (t.lendability === 'Locate Required') score += 2;

    return score;
  };

  // Hard gate filter reasons — institutional-grade
  const getFilterReason = (t: any): string | null => {
    if (t.liquidityRating == null || t.liquidityRating < 3) return 'Liquidity < 3';
    if (t.ivHvSpread != null && t.ivHvSpread < 5) return 'IV-HV spread < 5';
    if ((t.ivRank ?? 0) * 100 < 15) return 'IV Rank < 15';
    if (t.borrowRate != null && t.borrowRate > 10) return 'Borrow rate > 10%';
    return null;
  };

  // Sort scanner data with computed score + hard gates + sector penalty
  const [filteredOutExpanded, setFilteredOutExpanded] = useState(false);
  const { passedData, filteredData } = useMemo(() => {
    const scored = ttScannerData.map(m => ({
      ...m,
      score: computeScore(m),
      filterReason: getFilterReason(m),
      sectorPenalty: false as boolean,
    }));
    const passed = scored.filter(m => !m.filterReason);
    const filtered = scored.filter(m => m.filterReason);

    // Sort passed by score desc first to apply sector penalty to top 10
    passed.sort((a, b) => b.score - a.score);
    const sectorCount: Record<string, number> = {};
    for (let i = 0; i < Math.min(passed.length, 10); i++) {
      const sector = passed[i].sector || 'Unknown';
      sectorCount[sector] = (sectorCount[sector] || 0) + 1;
      if (sectorCount[sector] >= 3) {
        passed[i].score -= 5;
        passed[i].sectorPenalty = true;
      }
    }

    // Now apply the user's chosen sort
    const sortFn = (a: any, b: any) => {
      const av = a[ttScannerSort] ?? 0;
      const bv = b[ttScannerSort] ?? 0;
      return ttScannerSortDir === 'desc' ? bv - av : av - bv;
    };
    passed.sort(sortFn);
    filtered.sort(sortFn);
    return { passedData: passed, filteredData: filtered };
  }, [ttScannerData, ttScannerSort, ttScannerSortDir]);
  // Keep sortedScannerData for backward compat (expanded row logic)
  const sortedScannerData = passedData;

  const handleScannerSort = (col: string) => {
    if (ttScannerSort === col) {
      setTtScannerSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setTtScannerSort(col);
      setTtScannerSortDir('desc');
    }
  };

  // Market Brief: fire once per universe load
  const handleRefreshBrief = () => {
    setMarketBrief(null);
    setMarketBriefUniverse(null);
    setMarketBriefError(null);
  };

  useEffect(() => {
    if (passedData.length === 0) return;
    if (marketBriefUniverse === ttScannerUniverse && marketBrief !== null) return;
    let cancelled = false;
    (async () => {
      setMarketBriefLoading(true);
      setMarketBriefError(null);
      try {
        const res = await fetch('/api/ai/market-brief', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            universe: ttScannerUniverse,
            totalScanned: ttScannerTotalScanned,
            totalPassed: passedData.length,
            totalFiltered: filteredData.length,
            tickers: passedData,
          }),
        });
        if (!cancelled && res.ok) {
          const data = await res.json();
          if (data.error) { setMarketBriefError('AI analysis unavailable'); }
          else { setMarketBrief(data); setMarketBriefUniverse(ttScannerUniverse); }
        } else if (!cancelled) {
          setMarketBriefError('AI analysis unavailable');
        }
      } catch {
        if (!cancelled) setMarketBriefError('AI analysis unavailable');
      }
      if (!cancelled) setMarketBriefLoading(false);
    })();
    return () => { cancelled = true; };
  }, [passedData.length, ttScannerUniverse, marketBriefUniverse, marketBrief]);

  // Trigger per-strategy AI analysis after strategies finish generating
  useEffect(() => {
    if (!sbExpandedSymbol || sbStrategies.length === 0) return;
    if (strategyAnalyses[sbExpandedSymbol]) return; // already fetched
    if (strategyAnalysisLoading[sbExpandedSymbol]) return; // already fetching
    const symbol = sbExpandedSymbol;
    const scannerRow = sortedScannerData.find((m: any) => m.symbol === symbol);
    setStrategyAnalysisLoading(prev => ({ ...prev, [symbol]: true }));
    (async () => {
      try {
        // Stagger AI calls to avoid 30k input token/min rate limit
        await new Promise(r => setTimeout(r, 3000));
        const res = await fetch('/api/ai/strategy-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol,
            scannerData: scannerRow ? {
              ivHvSpread: scannerRow.ivHvSpread,
              hvTrend: scannerRow.hv30 < scannerRow.hv60 && scannerRow.hv60 < scannerRow.hv90 ? 'declining' :
                       scannerRow.hv30 > scannerRow.hv60 && scannerRow.hv60 > scannerRow.hv90 ? 'rising' : 'mixed',
              earningsDate: scannerRow.earningsDate,
              daysTillEarnings: scannerRow.daysTillEarnings,
              sector: scannerRow.sector,
              hasWideSpread: sbStrategies.some(c => c.hasWideSpread),
            } : {},
            strategies: sbStrategies.map(c => ({
              name: c.name,
              legs: c.legs.map(l => ({ side: l.side, type: l.type, strike: l.strike, price: l.price })),
              netCredit: c.netCredit,
              netDebit: c.netDebit,
              maxProfit: c.maxProfit,
              maxLoss: c.maxLoss,
              breakevens: c.breakevens,
              pop: c.pop,
              riskReward: c.riskReward,
              dte: c.dte,
              thetaPerDay: c.thetaPerDay,
              netDelta: c.netDelta,
              netVega: c.netVega,
            })),
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setStrategyAnalyses(prev => ({ ...prev, [symbol]: data }));
          }
        }
      } catch {
        // AI analysis failed silently — strategies still work
      }
      setStrategyAnalysisLoading(prev => ({ ...prev, [symbol]: false }));
    })();
  }, [sbExpandedSymbol, sbStrategies]);

  // Memoize brief indicator sets
  const { topSymbols, marginalSymbols, briefNoteMap } = useMemo(() => {
    const top = new Set(marketBrief?.topNotes?.map(n => n.symbol) ?? []);
    const marg = new Set(marketBrief?.marginal?.map(n => n.symbol) ?? []);
    const notes: Record<string, string> = {};
    for (const n of marketBrief?.topNotes ?? []) notes[n.symbol] = n.note;
    for (const n of marketBrief?.marginal ?? []) notes[n.symbol] = n.note;
    return { topSymbols: top, marginalSymbols: marg, briefNoteMap: notes };
  }, [marketBrief]);

  // Reset top picks when market brief is refreshed (set to null)
  useEffect(() => {
    if (!marketBrief) {
      setTopPicksTriggered(false);
      setTopPicksData({});
    }
  }, [marketBrief]);

  // Top Picks: process all topNotes tickers sequentially after Market Brief loads
  useEffect(() => {
    if (topPicksTriggered) return;
    if (!marketBrief?.topNotes?.length) return;
    if (passedData.length === 0) return;
    setTopPicksTriggered(true);

    const symbols = marketBrief.topNotes.slice(0, 8).map(n => n.symbol);
    // Initialize all as loading
    const init: typeof topPicksData = {};
    for (const sym of symbols) init[sym] = { status: 'loading' };
    setTopPicksData(init);

    // Process sequentially to respect TT API rate limits
    (async () => {
      for (const symbol of symbols) {
        try {
          // Start Finnhub fetch immediately (runs in parallel with TT data)
          const finnhubPromise = fetch('/api/finnhub/ticker-context?symbol=' + encodeURIComponent(symbol))
            .then(r => r.json())
            .catch(() => null);

          // 1. Fetch quote + chain in parallel
          const [quoteRes, chainRes] = await Promise.all([
            fetch('/api/tastytrade/quotes', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ symbols: [symbol] }),
            }),
            fetch('/api/tastytrade/chains', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ symbol }),
            }),
          ]);

          let price: number | null = null;
          if (quoteRes.ok) {
            const qd = await quoteRes.json();
            const q = qd.quotes?.[symbol] || Object.values(qd.quotes || {})[0];
            if (q) price = (q as any).last || (q as any).mid || null;
          }
          if (!price) throw new Error('No quote');

          if (!chainRes.ok) throw new Error('No chain');
          const chainJson = await chainRes.json();
          const chain = chainJson.chain;
          if (!chain?.expirations?.length) throw new Error('No chain');

          // 2. Pick expiration closest to 35 DTE within 20-60 range
          let bestExpIdx = 0;
          let bestDiff = Infinity;
          for (let i = 0; i < chain.expirations.length; i++) {
            const dte = chain.expirations[i].dte;
            if (dte >= 20 && dte <= 60) {
              const diff = Math.abs(dte - 35);
              if (diff < bestDiff) { bestDiff = diff; bestExpIdx = i; }
            }
          }
          const exp = chain.expirations[bestExpIdx];

          // 3. Fetch Greeks for that expiration — IV-aware range covers 2.5 SD
          const scannerItem = passedData.find((t: any) => t.symbol === symbol);
          const ivRank = scannerItem?.ivRank ?? 0;
          const tpIv30 = scannerItem?.impliedVolatility ?? 0.30;
          const tpHv30 = (scannerItem?.hv30 ?? 30) / 100;
          const allStrikes: number[] = (exp.strikes || []).map((s: any) => s.strike);
          const center = price || (allStrikes.length > 0 ? (Math.min(...allStrikes) + Math.max(...allStrikes)) / 2 : 0);
          const tpSdMove = price ? price * tpIv30 * Math.sqrt(exp.dte / 365) : 50;
          const range = Math.max(tpSdMove * 2.5, 10);
          const streamerSyms: string[] = [];
          for (const s of exp.strikes || []) {
            if (Math.abs(s.strike - center) > range) continue;
            if (s.callStreamerSymbol) streamerSyms.push(s.callStreamerSymbol);
            if (s.putStreamerSymbol) streamerSyms.push(s.putStreamerSymbol);
          }

          console.log(`[TopPicks] ${symbol}: chain expirations=${chain.expirations.length}, selected exp=${exp.date} (${exp.dte} DTE), total strikes=${(exp.strikes || []).length}, in-range=${streamerSyms.length / 2} (±$${range.toFixed(2)} from $${center.toFixed(2)}, IV=${(tpIv30 * 100).toFixed(1)}%)`);

          let greeks: Record<string, any> = {};
          if (streamerSyms.length > 0) {
            const greeksRes = await fetch('/api/tastytrade/greeks', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ symbols: streamerSyms.slice(0, 200) }),
            });
            if (greeksRes.ok) {
              const gd = await greeksRes.json();
              greeks = gd.greeks || {};
              console.log(`[TopPicks] ${symbol}: greeks fetched=${streamerSyms.length} symbols, returned=${Object.keys(greeks).length} entries`);
            } else {
              console.log(`[TopPicks] ${symbol}: greeks fetch FAILED — status=${greeksRes.status}`);
            }
          } else {
            console.log(`[TopPicks] ${symbol}: NO strikes in range — skipping greeks fetch`);
          }

          // 4. Generate strategies (same functions as handleScannerExpand)
          const strikeData = buildStrikeData(exp.strikes || [], greeks);
          console.log(`[TopPicks] ${symbol}: strikeData built=${strikeData.length}, withGreeks=${strikeData.filter(s => s.callDelta != null || s.putDelta != null).length}, ivRank=${ivRank}`);
          const cards = generateStrategies({
            strikes: strikeData,
            currentPrice: price,
            ivRank,
            expiration: exp.date,
            dte: exp.dte,
            symbol,
            iv30: tpIv30,
            hv30: tpHv30,
          });

          if (cards.length === 0) {
            // No valid strategies — show Finnhub data if available but note no strategies
            const finnhubData = await finnhubPromise;
            setTopPicksData(prev => ({
              ...prev,
              [symbol]: {
                status: 'done',
                price,
                expDate: exp.date,
                dte: exp.dte,
                strategies: [],
                analyses: [],
                finnhub: finnhubData?.error ? null : finnhubData,
              }
            }));
            continue; // move to next symbol
          }

          // Await Finnhub data (started earlier in parallel — adds zero latency)
          const finnhubData = await finnhubPromise;

          setTopPicksData(prev => ({
            ...prev,
            [symbol]: { status: 'analyzing', price, expDate: exp.date, dte: exp.dte, strategies: cards, finnhub: finnhubData?.error ? null : finnhubData }
          }));

          // 5. AI analysis (includes Finnhub data if available)
          // Stagger AI calls to avoid 30k input token/min rate limit
          await new Promise(r => setTimeout(r, 3000));
          try {
            const aiRes = await fetch('/api/ai/strategy-analysis', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                symbol,
                currentPrice: price,
                scannerData: scannerItem ? {
                  ivHvSpread: scannerItem.ivHvSpread,
                  hvTrend: scannerItem.hv30 < scannerItem.hv60 && scannerItem.hv60 < scannerItem.hv90 ? 'declining' :
                           scannerItem.hv30 > scannerItem.hv60 && scannerItem.hv60 > scannerItem.hv90 ? 'rising' : 'mixed',
                  earningsDate: scannerItem.earningsDate,
                  daysTillEarnings: scannerItem.daysTillEarnings,
                  sector: scannerItem.sector,
                  hasWideSpread: cards.some(c => c.hasWideSpread),
                } : {},
                finnhub: finnhubData?.error ? null : finnhubData ?? null,
                strategies: cards.map(c => ({
                  name: c.name,
                  legs: c.legs.map(l => ({ side: l.side, type: l.type, strike: l.strike, price: l.price })),
                  netCredit: c.netCredit,
                  netDebit: c.netDebit,
                  maxProfit: c.maxProfit,
                  maxLoss: c.maxLoss,
                  breakevens: c.breakevens,
                  pop: c.pop,
                  riskReward: c.riskReward,
                  dte: c.dte,
                  thetaPerDay: c.thetaPerDay,
                  netDelta: c.netDelta,
                  netVega: c.netVega,
                })),
              }),
            });
            if (aiRes.ok) {
              const aiData = await aiRes.json();
              setTopPicksData(prev => ({
                ...prev,
                [symbol]: {
                  status: 'done',
                  price,
                  expDate: exp.date,
                  dte: exp.dte,
                  strategies: cards,
                  analyses: Array.isArray(aiData) ? aiData : [],
                  finnhub: finnhubData?.error ? null : finnhubData,
                }
              }));
            } else {
              // AI failed, still show strategies without analysis
              setTopPicksData(prev => ({
                ...prev,
                [symbol]: { status: 'done', price, expDate: exp.date, dte: exp.dte, strategies: cards, analyses: [], finnhub: finnhubData?.error ? null : finnhubData }
              }));
            }
          } catch {
            // AI failed, still show strategies
            setTopPicksData(prev => ({
              ...prev,
              [symbol]: { status: 'done', price, expDate: exp.date, dte: exp.dte, strategies: cards, analyses: [], finnhub: finnhubData?.error ? null : finnhubData }
            }));
          }

        } catch (err) {
          console.error(`[TopPicks] Failed for ${symbol}:`, err);
          setTopPicksData(prev => ({
            ...prev,
            [symbol]: { status: 'error', error: err instanceof Error ? err.message : String(err) }
          }));
        }
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketBrief, passedData.length, topPicksTriggered]);

  // Strategy Builder: expand scanner row → fetch quote, chain, Greeks → generate strategies
  const handleScannerExpand = async (symbol: string, ivRank: number, iv30Raw?: number, hv30Raw?: number) => {
    if (sbExpandedSymbol === symbol) {
      setSbExpandedSymbol(null);
      return;
    }
    setSbExpandedSymbol(symbol);
    setSbLoading(true);
    setSbStrategies([]);
    setSbChainData(null);
    setSbGreeksData({});
    setSbSelectedExp(null);
    setSbCustomLegs([]);
    setSbCustomCard(null);
    setSbQuotePrice(null);

    try {
      // 1. Fetch quote + chain in parallel
      const [quoteRes, chainRes] = await Promise.all([
        fetch('/api/tastytrade/quotes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbols: [symbol] }),
        }),
        fetch('/api/tastytrade/chains', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbol }),
        }),
      ]);

      let price: number | null = null;
      if (quoteRes.ok) {
        const qd = await quoteRes.json();
        const q = qd.quotes?.[symbol] || Object.values(qd.quotes || {})[0];
        if (q) price = q.last || q.mid || null;
      }
      setSbQuotePrice(price);

      if (!chainRes.ok) { setSbLoading(false); return; }
      const chainJson = await chainRes.json();
      const chain = chainJson.chain;
      if (!chain?.expirations?.length) { setSbLoading(false); return; }
      setSbChainData(chain);

      // 2. Pick first expiration with DTE 7-45
      let expIdx = chain.expirations.findIndex((e: any) => e.dte >= 7 && e.dte <= 45);
      if (expIdx === -1) expIdx = 0; // fallback to first
      setSbSelectedExp(expIdx);
      const exp = chain.expirations[expIdx];

      // 3. Fetch Greeks for that expiration — IV-aware range covers 2.5 SD
      const sbIv30 = iv30Raw ?? 0.30;
      const sbHv30 = (hv30Raw ?? 30) / 100;
      const allStrikes: number[] = (exp.strikes || []).map((s: any) => s.strike);
      const center = price || (allStrikes.length > 0 ? (Math.min(...allStrikes) + Math.max(...allStrikes)) / 2 : 0);
      const sbSdMove = price ? price * sbIv30 * Math.sqrt(exp.dte / 365) : 50;
      const range = Math.max(sbSdMove * 2.5, 10);
      const symbols: string[] = [];
      for (const s of exp.strikes || []) {
        if (Math.abs(s.strike - center) > range) continue;
        if (s.callStreamerSymbol) symbols.push(s.callStreamerSymbol);
        if (s.putStreamerSymbol) symbols.push(s.putStreamerSymbol);
      }

      console.log(`[StrategyBuilder UI] ${symbol}: chain expirations=${chain.expirations.length}, selected exp=${exp.date} (${exp.dte} DTE), total strikes=${(exp.strikes || []).length}, in-range=${symbols.length / 2} (±$${range.toFixed(2)} from $${center.toFixed(2)}, IV=${(sbIv30 * 100).toFixed(1)}%)`);

      if (symbols.length > 0) {
        const greeksRes = await fetch('/api/tastytrade/greeks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbols: symbols.slice(0, 200) }),
        });
        if (greeksRes.ok) {
          const gd = await greeksRes.json();
          const greeks = gd.greeks || {};
          setSbGreeksData(greeks);

          console.log(`[StrategyBuilder UI] ${symbol}: greeks fetched=${symbols.length} syms, returned=${Object.keys(greeks).length} entries`);

          // 4. Generate strategies
          if (price) {
            const strikeData = buildStrikeData(exp.strikes || [], greeks);
            console.log(`[StrategyBuilder UI] ${symbol}: strikeData built=${strikeData.length}, withGreeks=${strikeData.filter(s => s.callDelta != null || s.putDelta != null).length}, ivRank=${ivRank}`);
            const cards = generateStrategies({
              strikes: strikeData,
              currentPrice: price,
              ivRank,
              expiration: exp.date,
              dte: exp.dte,
              symbol,
              iv30: sbIv30,
              hv30: sbHv30,
            });
            setSbStrategies(cards);
          }
        } else {
          console.log(`[StrategyBuilder UI] ${symbol}: greeks fetch FAILED — status=${greeksRes.status}`);
        }
      } else {
        console.log(`[StrategyBuilder UI] ${symbol}: NO strikes in range — skipping greeks fetch`);
      }
    } catch {
      // ignore — don't break scanner
    } finally {
      setSbLoading(false);
    }
  };

  // Click-to-build: toggle a leg
  const handleClickLeg = (type: 'call' | 'put', side: 'buy' | 'sell', strike: number, streamerSymbol: string) => {
    setSbCustomLegs(prev => {
      const exists = prev.find(l => l.streamerSymbol === streamerSymbol && l.side === side);
      let next: CustomLeg[];
      if (exists) {
        next = prev.filter(l => !(l.streamerSymbol === streamerSymbol && l.side === side));
      } else if (prev.length >= 4) {
        return prev; // max 4 legs
      } else {
        next = [...prev, { type, side, strike, streamerSymbol }];
      }
      // Auto-build custom card
      if (next.length > 0 && sbChainData && sbSelectedExp != null) {
        const exp = sbChainData.expirations[sbSelectedExp];
        const card = buildCustomCard(next, sbGreeksData, exp.date, exp.dte, sbQuotePrice || 0);
        setSbCustomCard(card);
      } else {
        setSbCustomCard(null);
      }
      return next;
    });
  };

  const handleScanSymbol = (symbol: string) => {
    setTtQuoteSymbol(symbol);
    setTtChainSymbol(symbol);
  };

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

                        {/* Market Intelligence — unified scanner + trade cards */}
                        <ConvergenceIntelligence />

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
                                setTtScannerStarted(false);
                                setTtScannerData([]);
                                setMarketBrief(null);
                                setMarketBriefUniverse(null);
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
                                  onKeyDown={(e) => { if (e.key === 'Enter') startScan(); }}
                                />
                                <button
                                  onClick={() => startScan()}
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
                                  {ttScannerTotalScanned} scanned {'\u2192'} {sortedScannerData.length} passed all gates{filteredData.length > 0 ? ` (${filteredData.length} filtered)` : ''} {'\u00B7'} sorted by {
                                    { score: 'Score', ivRank: 'IV Rank', ivHvSpread: 'IV-HV', hv30: 'HV30', impliedVolatility: 'IV', liquidityRating: 'Liquidity' }[ttScannerSort] || ttScannerSort
                                  } {ttScannerSortDir === 'desc' ? '\u25BC' : '\u25B2'}
                                </div>
                              )}
                              {/* Market Brief Card */}
                              {marketBriefLoading && (
                                <div style={{ border: '1px solid #374151', borderRadius: 8, padding: 16, marginBottom: 16, color: '#9CA3AF' }} className="flex items-center gap-2 text-xs">
                                  <div className="w-3 h-3 border border-gray-500 border-t-transparent rounded-full animate-spin" />
                                  AI analyzing {passedData.length} qualifying tickers...
                                </div>
                              )}
                              {marketBrief && !marketBriefLoading && (() => {
                                const rc = marketBrief.riskClusters;
                                const allRisks = [...(rc.earningsCluster || []), ...(rc.sectorConcentration || []), ...(rc.risingVol || []), ...(rc.backwardation || []), ...(rc.anomalous || [])];
                                return (
                                  <div style={{ border: '1px solid #374151', borderRadius: 8, padding: 20, marginBottom: 16, background: '#111827' }}>
                                    <div className="flex justify-between items-center mb-3">
                                      <div style={{ fontWeight: 600, fontSize: 13, color: '#D1D5DB', letterSpacing: '0.05em' }}>
                                        MARKET BRIEF &mdash; {ttScannerUniverse} ({passedData.length} qualifying)
                                      </div>
                                      <button onClick={handleRefreshBrief} style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', fontSize: 12 }}>Refresh</button>
                                    </div>
                                    <p style={{ color: '#E5E7EB', fontSize: 13, lineHeight: 1.6, marginBottom: 16, margin: '0 0 16px 0' }}>{marketBrief.regime}</p>
                                    <p style={{ color: '#D1D5DB', fontSize: 13, lineHeight: 1.6, marginBottom: 16, margin: '0 0 16px 0' }}>{marketBrief.sectorHeatmap}</p>
                                    {allRisks.length > 0 && (
                                      <div style={{ marginBottom: 16 }}>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: '#F59E0B', marginBottom: 6 }}>RISK CLUSTERS</div>
                                        {allRisks.map((r, i) => (
                                          <div key={i} style={{ color: '#D1D5DB', fontSize: 12, lineHeight: 1.5, paddingLeft: 12 }}>{'\u2022'} {r}</div>
                                        ))}
                                      </div>
                                    )}
                                    {marketBrief.topNotes && marketBrief.topNotes.length > 0 && (
                                      <div style={{ marginBottom: 16 }}>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: '#10B981', marginBottom: 6 }}>TOP TICKERS</div>
                                        {marketBrief.topNotes.map((t, i) => (
                                          <div key={i} style={{ fontSize: 12, lineHeight: 1.5, marginBottom: 4 }}>
                                            <span style={{ color: '#10B981', fontWeight: 600 }}>{t.symbol}</span>
                                            <span style={{ color: '#6B7280' }}> &mdash; </span>
                                            <span style={{ color: '#9CA3AF' }}>{t.note}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    {marketBrief.marginal && marketBrief.marginal.length > 0 && (
                                      <div>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: '#6B7280' }}>MARGINAL (barely passed gates)</div>
                                        {marketBrief.marginal.map((t, i) => (
                                          <div key={i} style={{ fontSize: 12, lineHeight: 1.5, marginBottom: 4, color: '#6B7280' }}>
                                            <span style={{ fontWeight: 600 }}>{t.symbol}</span> &mdash; {t.note}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                              {marketBriefError && !marketBriefLoading && (
                                <div style={{ color: '#6B7280', fontSize: 12, marginBottom: 8 }}>{marketBriefError}</div>
                              )}

                              {/* Top Picks — Strategy Analysis */}
                              {marketBrief?.topNotes && marketBrief.topNotes.length > 0 && Object.keys(topPicksData).length > 0 && (
                                <div style={{ marginBottom: 16 }}>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: '#D1D5DB', letterSpacing: '0.05em', marginBottom: 12 }}>
                                    TOP PICKS &mdash; STRATEGY ANALYSIS
                                  </div>
                                  {marketBrief.topNotes.slice(0, 8).map((pick) => {
                                    const data = topPicksData[pick.symbol];
                                    return (
                                      <div key={pick.symbol} style={{ border: '1px solid #374151', borderRadius: 8, padding: 16, marginBottom: 12, background: '#111827' }}>
                                        {/* Symbol header */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                          <span style={{ fontSize: 14, fontWeight: 700, color: '#10B981' }}>
                                            {pick.symbol}
                                            <span style={{ fontWeight: 400, color: '#6B7280', fontSize: 12, marginLeft: 8 }}>{pick.note}</span>
                                          </span>
                                          <span style={{ color: '#9CA3AF', fontSize: 12 }}>
                                            {data?.price ? `$${data.price.toFixed(2)}` : ''}
                                            {data?.expDate && data?.dte != null ? ` \u00B7 ${data.expDate} (${data.dte} DTE)` : ''}
                                          </span>
                                        </div>

                                        {/* Finnhub context bar */}
                                        {data?.finnhub && (
                                          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 8, fontSize: 11, color: '#6B7280' }}>
                                            {data.finnhub.news && (
                                              <span>
                                                {data.finnhub.news.count > 0
                                                  ? `${data.finnhub.news.count} article${data.finnhub.news.count !== 1 ? 's' : ''} this week`
                                                  : 'No recent news'
                                                }
                                              </span>
                                            )}
                                            {data.finnhub.analysts && (
                                              <span>
                                                Analysts:
                                                <span style={{ color: '#10B981' }}> {data.finnhub.analysts.strongBuy + data.finnhub.analysts.buy} Buy</span>
                                                <span> / {data.finnhub.analysts.hold} Hold</span>
                                                <span style={{ color: '#EF4444' }}> / {data.finnhub.analysts.sell + data.finnhub.analysts.strongSell} Sell</span>
                                              </span>
                                            )}
                                            {data.finnhub.priceTarget && data.price && (
                                              <span>
                                                Target: ${data.finnhub.priceTarget.mean.toFixed(0)}
                                                {(() => {
                                                  const pct = ((data.finnhub.priceTarget!.mean - data.price!) / data.price! * 100);
                                                  if (Math.abs(pct) < 5) return null;
                                                  return (
                                                    <span style={{ color: pct > 0 ? '#10B981' : '#EF4444', marginLeft: 4 }}>
                                                      ({pct > 0 ? '+' : ''}{pct.toFixed(0)}%)
                                                    </span>
                                                  );
                                                })()}
                                              </span>
                                            )}
                                          </div>
                                        )}

                                        {/* Finnhub news headlines */}
                                        {data?.finnhub?.news?.articles && data.finnhub.news.articles.length > 0 && (
                                          <div style={{ marginBottom: 10 }}>
                                            {data.finnhub.news.articles.slice(0, 3).map((article, i) => {
                                              const truncated = article.headline.length > 120
                                                ? article.headline.substring(0, 117) + '...'
                                                : article.headline;
                                              return (
                                                <div key={i} style={{ fontSize: 11, color: '#9CA3AF', lineHeight: 1.4, marginBottom: 2, paddingLeft: 8 }}>
                                                  <span style={{ color: '#6B7280' }}>
                                                    {article.daysAgo === 0 ? 'Today' : article.daysAgo === 1 ? '1d ago' : article.daysAgo + 'd ago'}
                                                  </span>
                                                  {' '}
                                                  <span style={{ color: '#D1D5DB' }}>{truncated}</span>
                                                  {' '}
                                                  <span style={{ color: '#4B5563' }}>&mdash; {article.source}</span>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}

                                        {/* Loading state */}
                                        {(!data || data.status === 'loading') && (
                                          <div className="flex items-center gap-2" style={{ color: '#6B7280', fontSize: 12 }}>
                                            <div className="w-3 h-3 border border-gray-500 border-t-transparent rounded-full animate-spin" />
                                            Loading strategies...
                                          </div>
                                        )}

                                        {/* Strategies generated, waiting for AI */}
                                        {data?.status === 'analyzing' && data.strategies && (
                                          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                            {data.strategies.map((card, ci) => (
                                              <div key={ci} style={{ flex: '1 1 280px', maxWidth: 340, border: '1px solid #1F2937', borderRadius: 6, padding: 12, background: '#0D1117' }}>
                                                <div style={{ fontSize: 12, fontWeight: 600, color: '#D1D5DB', marginBottom: 4 }}>
                                                  {card.label}) {card.name}
                                                </div>
                                                <div style={{ fontSize: 11, color: '#6B7280' }}>
                                                  {card.legs.length} legs | {card.dte} DTE |{' '}
                                                  PoP {card.pop != null ? `${Math.round(card.pop * 100)}%` : 'N/A'} |{' '}
                                                  {card.netCredit != null ? `Credit $${card.netCredit.toFixed(2)}` : `Debit $${(card.netDebit ?? 0).toFixed(2)}`}
                                                </div>
                                                <div className="flex items-center gap-2 mt-2" style={{ color: '#6B7280', fontSize: 11, fontStyle: 'italic' }}>
                                                  <div className="w-2 h-2 border border-gray-500 border-t-transparent rounded-full animate-spin" />
                                                  Analyzing...
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        )}

                                        {/* Done — full strategy cards with AI analysis */}
                                        {data?.status === 'done' && data.strategies && data.strategies.length > 0 && (
                                          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                            {data.strategies.map((card, ci) => {
                                              const analysis = data.analyses?.find(a => a.strategy === card.name);
                                              return (
                                                <div key={ci} style={{ flex: '1 1 280px', maxWidth: 340, border: '1px solid #1F2937', borderRadius: 6, padding: 12, background: '#0D1117' }}>
                                                  <div style={{ fontSize: 12, fontWeight: 600, color: '#D1D5DB', marginBottom: 4 }}>
                                                    {card.label}) {card.name}
                                                  </div>

                                                  {/* Legs detail */}
                                                  <div style={{ borderTop: '1px solid #1F2937', paddingTop: 4, marginBottom: 4 }}>
                                                    {card.legs.map((leg, li) => (
                                                      <div key={li} style={{ fontSize: 11, fontFamily: 'monospace', color: '#6B7280', marginBottom: 2 }}>
                                                        <span style={{ color: leg.side === 'sell' ? '#10B981' : '#3B82F6' }}>
                                                          {leg.side === 'sell' ? 'SELL' : 'BUY'}
                                                        </span>{' '}
                                                        {leg.strike} {leg.type === 'call' ? 'C' : 'P'}{' '}
                                                        <span style={{ color: '#4B5563' }}>@${leg.price.toFixed(2)}</span>
                                                        {leg.delta != null && <span style={{ color: '#374151' }}> ({'\u0394'}{leg.delta.toFixed(2)})</span>}
                                                      </div>
                                                    ))}
                                                  </div>

                                                  {/* Key metrics */}
                                                  <div style={{ borderTop: '1px solid #1F2937', paddingTop: 4, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px', fontSize: 11, color: '#9CA3AF' }}>
                                                    <div>{card.netCredit != null ? 'Credit:' : 'Debit:'} <span style={{ fontFamily: 'monospace', fontWeight: 500, color: card.netCredit != null ? '#10B981' : '#3B82F6' }}>${(card.netCredit ?? card.netDebit ?? 0).toFixed(2)}</span></div>
                                                    <div>Max Profit: <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{card.maxProfit != null ? `$${card.maxProfit}` : 'Unlimited'}</span></div>
                                                    <div>Max Loss: <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{card.maxLoss != null ? `$${card.maxLoss}` : <span style={{ color: card.isUnlimited ? '#EF4444' : '#F59E0B' }}>{card.isUnlimited ? 'Unlimited' : 'Undefined'}</span>}</span></div>
                                                    <div>R/R: <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{card.riskReward != null ? `${card.riskReward}:1` : 'N/A'}</span></div>
                                                  </div>

                                                  {/* PoP + EV + Greeks row */}
                                                  <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 11, color: '#9CA3AF' }}>
                                                    <span>PoP: <span style={{ color: card.pop != null && card.pop >= 0.6 ? '#10B981' : card.pop != null && card.pop >= 0.45 ? '#F59E0B' : '#EF4444' }}>
                                                      {card.pop != null ? `${Math.round(card.pop * 100)}%` : 'N/A'}
                                                    </span>{card.hvPop != null && Math.abs(card.hvPop - (card.pop ?? 0)) > 0.02 && <span style={{ color: '#10B981', fontFamily: 'monospace' }}>{` (${Math.round(card.hvPop * 100)}% adj)`}</span>}</span>
                                                    <span>EV: <span style={{ color: '#10B981', fontFamily: 'monospace', fontWeight: 500 }}>+${Math.round(card.ev)}</span></span>
                                                    <span>{'\u0398'}: ${card.thetaPerDay >= 0 ? '+' : ''}{card.thetaPerDay.toFixed(2)}/day</span>
                                                    <span>{'\u0394'}: {card.netDelta >= 0 ? '+' : ''}{card.netDelta.toFixed(2)}</span>
                                                    <span>{'\u03BD'}: {card.netVega >= 0 ? '+' : ''}{card.netVega.toFixed(2)}</span>
                                                  </div>

                                                  {/* Breakevens */}
                                                  {card.breakevens.length > 0 && (
                                                    <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>
                                                      BE: {card.breakevens.map(b => `$${b}`).join(' \u2014 ')}
                                                    </div>
                                                  )}

                                                  {/* P&L Chart */}
                                                  {card.pnlPoints.length > 2 && data.price && (
                                                    <div style={{ borderTop: '1px solid #1F2937', paddingTop: 4, marginTop: 4 }}
                                                      dangerouslySetInnerHTML={{ __html: renderPnlSvg(card.pnlPoints, card.breakevens, data.price, 280, 100) }}
                                                    />
                                                  )}

                                                  {/* Wide spread warning */}
                                                  {card.hasWideSpread && (
                                                    <div style={{ fontSize: 10, color: '#F59E0B', marginTop: 4 }}>{'\u26A0'} Wide bid/ask spreads &mdash; fill prices may differ</div>
                                                  )}

                                                  {/* AI Analysis */}
                                                  {analysis?.analysis && (
                                                    <div style={{ fontSize: 11, color: '#9CA3AF', lineHeight: 1.5, marginTop: 8, paddingTop: 8, borderTop: '1px solid #1F2937', fontStyle: 'italic' }}>
                                                      {analysis.analysis}
                                                    </div>
                                                  )}


                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}

                                        {/* No strategies state (e.g. sparse options data) */}
                                        {data?.status === 'done' && data.strategies && data.strategies.length === 0 && (
                                          <div style={{ color: '#6B7280', fontSize: 12 }}>No suitable strategies found for {pick.symbol} &mdash; options data may be too sparse</div>
                                        )}

                                        {/* Error state */}
                                        {data?.status === 'error' && (
                                          <div style={{ color: '#6B7280', fontSize: 12 }}>Could not load strategies for {pick.symbol}{data.error ? `: ${data.error}` : ''}</div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-gray-200 text-gray-500">
                                    <th className="text-left px-2 py-1.5 font-medium">Symbol</th>
                                    {[
                                      { key: 'score', label: 'Score' },
                                      { key: 'ivRank', label: 'IV Rank' },
                                      { key: 'ivHvSpread', label: 'IV-HV \u25B3' },
                                      { key: 'hv30', label: 'HV30' },
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
                                    <th className="text-center px-2 py-1.5 font-medium">Sector</th>
                                    <th className="text-center px-2 py-1.5 font-medium">Earnings</th>
                                    <th className="text-left px-2 py-1.5 font-medium">Suggested</th>
                                    <th className="text-center px-2 py-1.5 font-medium"></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {sortedScannerData.slice(0, 50).map((m: any) => {
                                    const labels = getStrategyLabels(m.ivRank);
                                    const isExpanded = sbExpandedSymbol === m.symbol;
                                    const ivhv = m.ivHvSpread;
                                    const sectorShort: Record<string, string> = { Technology: 'Tech', Healthcare: 'Hlth', 'Financial Services': 'Finl', Energy: 'Enrg', Communication: 'Comm', 'Consumer Cyclical': 'CyCl', 'Consumer Defensive': 'CDef', Industrials: 'Indu', 'Basic Materials': 'Matl', 'Real Estate': 'REst', Utilities: 'Util' };
                                    const earningsTag = m.daysTillEarnings !== null && m.daysTillEarnings >= 0 && m.daysTillEarnings <= 30
                                      ? `${m.daysTillEarnings}d${m.earningsTimeOfDay === 'bmo' ? ' BMO' : m.earningsTimeOfDay === 'amc' ? ' AMC' : ''}`
                                      : null;
                                    return (
                                      <Fragment key={m.symbol}>
                                        <tr
                                          className={`border-b border-gray-50 hover:bg-gray-50 cursor-pointer ${isExpanded ? 'bg-indigo-50' : ''}`}
                                          onClick={() => handleScannerExpand(m.symbol, m.ivRank, m.impliedVolatility, m.hv30)}
                                        >
                                          <td className="px-2 py-1.5 font-mono font-medium text-gray-900" title={briefNoteMap[m.symbol] || undefined}>
                                            <span className="mr-1 text-[9px] text-gray-400">{isExpanded ? '\u25B2' : '\u25BC'}</span>
                                            {topSymbols.has(m.symbol) && <span className="text-emerald-500 mr-0.5">{'\u25CF'}</span>}
                                            {marginalSymbols.has(m.symbol) && <span className="text-gray-400 mr-0.5">{'\u25CF'}</span>}
                                            {m.symbol}
                                          </td>
                                          <td className={`text-right px-2 py-1.5 font-mono font-medium ${
                                            m.score >= 80 ? 'text-emerald-500' :
                                            m.score >= 60 ? 'text-emerald-600' :
                                            m.score >= 40 ? 'text-amber-600' : 'text-gray-400'
                                          }`}>{m.score}{m.sectorPenalty ? <span className="text-amber-500 ml-0.5" title={`Sector concentration: 3+ ${m.sector || 'Unknown'} in top 10`}>{'\u26A0'}</span> : null}</td>
                                          <td className={`text-right px-2 py-1.5 font-mono ${
                                            (m.ivRank ?? 0) > 0.50 ? 'text-emerald-600 font-medium' :
                                            (m.ivRank ?? 0) < 0.20 ? 'text-red-500' : 'text-gray-700'
                                          }`}>{((m.ivRank ?? 0) * 100).toFixed(1)}</td>
                                          <td className={`text-right px-2 py-1.5 font-mono font-medium ${
                                            ivhv != null && ivhv > 80 ? 'text-orange-500' :
                                            ivhv != null && ivhv > 15 ? 'text-emerald-500' :
                                            ivhv != null && ivhv > 8 ? 'text-emerald-600' :
                                            ivhv != null && ivhv > 3 ? 'text-amber-600' :
                                            ivhv != null && ivhv < 0 ? 'text-red-500' : 'text-gray-400'
                                          }`}>{ivhv != null ? ivhv.toFixed(1) + (ivhv > 80 ? '?' : '') : '\u2014'}</td>
                                          <td className="text-right px-2 py-1.5 font-mono text-gray-500">{m.hv30 != null ? <>
                                            {m.hv30.toFixed(1)}%{' '}
                                            {m.hv30 != null && m.hv60 != null && m.hv90 != null ? (
                                              m.hv30 < m.hv60 && m.hv60 < m.hv90 ? <span className="text-emerald-500">{'\u25BC'}</span> :
                                              m.hv30 > m.hv60 && m.hv60 > m.hv90 ? <span className="text-red-500">{'\u25B2'}</span> :
                                              <span className="text-gray-300">{'\u2014'}</span>
                                            ) : null}
                                          </> : '\u2014'}</td>
                                          <td className="text-right px-2 py-1.5 font-mono text-gray-600">{((m.impliedVolatility ?? 0) * 100).toFixed(1)}%</td>
                                          <td className="text-right px-2 py-1.5 font-mono text-gray-500">{m.liquidityRating != null ? m.liquidityRating : '\u2014'}</td>
                                          <td className="text-center px-2 py-1.5 text-[10px] text-gray-500 font-mono">{m.sector ? (sectorShort[m.sector] || m.sector.slice(0, 4)) : '\u2014'}</td>
                                          <td className="text-center px-2 py-1.5">
                                            {earningsTag ? (
                                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                                                m.daysTillEarnings <= 7 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                                              }`}>
                                                {m.daysTillEarnings <= 7 ? '\u26A1 ' : ''}{earningsTag}
                                              </span>
                                            ) : (
                                              <span className="text-gray-300">{'\u2014'}</span>
                                            )}
                                          </td>
                                          <td className="px-2 py-1.5">
                                            <div className="flex flex-wrap gap-0.5">
                                              {labels.map((l, li) => (
                                                <span key={li} className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap ${
                                                  l.type === 'credit' ? 'bg-emerald-100 text-emerald-700' :
                                                  l.type === 'debit' ? 'bg-blue-100 text-blue-700' :
                                                  'bg-gray-100 text-gray-600'
                                                }`}>{l.name}</span>
                                              ))}
                                            </div>
                                          </td>
                                          <td className="text-center px-2 py-1.5">
                                            <button
                                              onClick={(e) => { e.stopPropagation(); handleScanSymbol(m.symbol); }}
                                              className="text-[10px] font-medium text-[#2d1b4e] hover:underline"
                                            >Scan</button>
                                          </td>
                                        </tr>
                                        {/* Expanded Strategy Builder Row */}
                                        {isExpanded && (
                                          <tr>
                                            <td colSpan={12} className="bg-gray-50 border-b border-gray-200 px-3 py-3">
                                              {sbLoading ? (
                                                <div className="flex items-center gap-2 text-xs text-gray-400 py-4 justify-center">
                                                  <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                                                  Fetching chain & Greeks for {m.symbol}...
                                                </div>
                                              ) : sbStrategies.length > 0 || sbCustomCard ? (
                                                <div>
                                                  <div className="text-[10px] text-gray-500 mb-2 font-medium">
                                                    AI Strategies for {m.symbol} {sbChainData && sbSelectedExp != null && `\u2014 ${sbChainData.expirations[sbSelectedExp].date} (${sbChainData.expirations[sbSelectedExp].dte} DTE)`}
                                                    {sbQuotePrice && <span className="ml-2 text-gray-400">@ ${sbQuotePrice.toFixed(2)}</span>}
                                                  </div>
                                                  {/* Strategy Cards */}
                                                  <div className="flex flex-wrap gap-3 mb-3">
                                                    {sbStrategies.map((card, ci) => (
                                                      <div key={ci} className="border border-gray-200 bg-white rounded p-3 min-w-[280px] max-w-[320px] flex-1">
                                                        <div className="flex justify-between items-start mb-1">
                                                          <div className="text-xs font-semibold text-gray-900">{card.label}) {card.name}</div>
                                                          <div className="text-[9px] text-gray-400">{card.dte} DTE</div>
                                                        </div>
                                                        <div className="border-t border-gray-100 pt-1 mb-1 space-y-0.5">
                                                          {card.legs.map((leg, li) => (
                                                            <div key={li} className="text-[10px] font-mono text-gray-600">
                                                              <span className={leg.side === 'sell' ? 'text-emerald-600' : 'text-blue-600'}>
                                                                {leg.side === 'sell' ? 'SELL' : 'BUY'}
                                                              </span>{' '}
                                                              {leg.strike} {leg.type === 'call' ? 'C' : 'P'}{' '}
                                                              <span className="text-gray-400">@${leg.price.toFixed(2)}</span>
                                                            </div>
                                                          ))}
                                                        </div>
                                                        <div className="border-t border-gray-100 pt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
                                                          <div className="text-gray-500">
                                                            {card.netCredit != null ? 'Credit:' : 'Debit:'}
                                                            <span className={`ml-1 font-mono font-medium ${card.netCredit != null ? 'text-emerald-600' : 'text-blue-600'}`}>
                                                              ${(card.netCredit ?? card.netDebit ?? 0).toFixed(2)}
                                                            </span>
                                                          </div>
                                                          <div className="text-gray-500">Max Profit: <span className="font-mono font-medium text-gray-700">{card.maxProfit != null ? `$${card.maxProfit}` : 'Unlimited'}</span></div>
                                                          <div className="text-gray-500">Max Loss: <span className={`font-mono font-medium ${card.isUnlimited ? 'text-red-600' : 'text-gray-700'}`}>{card.maxLoss != null ? `$${card.maxLoss}` : card.isUnlimited ? 'Unlimited' : 'Undefined'}</span></div>
                                                          <div className="text-gray-500">R/R: <span className="font-mono font-medium text-gray-700">{card.riskReward != null ? `${card.riskReward}:1` : 'N/A'}</span></div>
                                                          {card.breakevens.length > 0 && (
                                                            <div className="text-gray-500 col-span-2">BE: <span className="font-mono text-gray-700">{card.breakevens.map(b => `$${b}`).join(' \u2014 ')}</span></div>
                                                          )}
                                                          <div className="text-gray-500">PoP: <span className="font-mono font-medium text-gray-700">{card.pop != null ? `~${Math.round(card.pop * 100)}%` : 'N/A'}</span>{card.hvPop != null && Math.abs(card.hvPop - (card.pop ?? 0)) > 0.02 && <span className="font-mono text-emerald-600">{` (${Math.round(card.hvPop * 100)}% adj)`}</span>}</div>
                                                          <div className="text-gray-500">EV: <span className="font-mono font-medium text-emerald-600">+${Math.round(card.ev)}</span></div>
                                                          <div className="text-gray-500">{'\u0398'}: <span className={`font-mono font-medium ${card.thetaPerDay >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{card.thetaPerDay >= 0 ? '+' : ''}${card.thetaPerDay.toFixed(2)}/day</span></div>
                                                        </div>
                                                        <div className="border-t border-gray-100 pt-1 mt-1 text-[9px] font-mono text-gray-400 flex gap-3">
                                                          <span>{'\u0394'} {card.netDelta >= 0 ? '+' : ''}{card.netDelta.toFixed(2)}</span>
                                                          <span>{'\u0393'} {card.netGamma >= 0 ? '+' : ''}{card.netGamma.toFixed(3)}</span>
                                                          <span>{'\u0398'} {card.netTheta >= 0 ? '+' : ''}{card.netTheta.toFixed(2)}</span>
                                                          <span>{'\u03BD'} {card.netVega >= 0 ? '+' : ''}{card.netVega.toFixed(2)}</span>
                                                        </div>
                                                        {/* P&L Chart */}
                                                        {card.pnlPoints.length > 2 && sbQuotePrice && (
                                                          <div className="border-t border-gray-100 pt-1 mt-1"
                                                            dangerouslySetInnerHTML={{ __html: renderPnlSvg(card.pnlPoints, card.breakevens, sbQuotePrice, 280, 120) }}
                                                          />
                                                        )}
                                                        {card.hasWideSpread && (
                                                          <div className="text-[9px] text-amber-600 mt-1">{'\u26A0'} Wide bid/ask spreads — prices may be unreliable (market may be closed)</div>
                                                        )}
                                                        {/* AI Analysis for this strategy */}
                                                        {strategyAnalysisLoading[m.symbol] && (
                                                          <div className="text-[9px] text-gray-400 mt-1 italic" style={{ animation: 'pulse 2s ease-in-out infinite' }}>Analyzing...</div>
                                                        )}
                                                        {strategyAnalyses[m.symbol]?.find(a => a.strategy === card.name)?.analysis && (
                                                          <div className="border-t border-gray-100 pt-1 mt-1 text-[10px] text-gray-500 italic leading-relaxed">
                                                            {strategyAnalyses[m.symbol].find(a => a.strategy === card.name)!.analysis}
                                                          </div>
                                                        )}

                                                      </div>
                                                    ))}
                                                    {/* Custom Strategy Card */}
                                                    {sbCustomCard && (
                                                      <div className="border border-indigo-300 bg-indigo-50 rounded p-3 min-w-[280px] max-w-[320px] flex-1">
                                                        <div className="flex justify-between items-start mb-1">
                                                          <div className="text-xs font-semibold text-indigo-900">{sbCustomCard.name}</div>
                                                          <button onClick={() => { setSbCustomLegs([]); setSbCustomCard(null); }} className="text-[9px] text-indigo-400 hover:text-indigo-600">Clear</button>
                                                        </div>
                                                        <div className="border-t border-indigo-200 pt-1 mb-1 space-y-0.5">
                                                          {sbCustomCard.legs.map((leg, li) => (
                                                            <div key={li} className="text-[10px] font-mono text-gray-600">
                                                              <span className={leg.side === 'sell' ? 'text-emerald-600' : 'text-blue-600'}>
                                                                {leg.side === 'sell' ? 'SELL' : 'BUY'}
                                                              </span>{' '}
                                                              {leg.strike} {leg.type === 'call' ? 'C' : 'P'}{' '}
                                                              <span className="text-gray-400">@${leg.price.toFixed(2)}</span>
                                                            </div>
                                                          ))}
                                                        </div>
                                                        <div className="border-t border-indigo-200 pt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
                                                          <div className="text-gray-500">
                                                            {sbCustomCard.netCredit != null ? 'Credit:' : 'Debit:'}
                                                            <span className={`ml-1 font-mono font-medium ${sbCustomCard.netCredit != null ? 'text-emerald-600' : 'text-blue-600'}`}>
                                                              ${(sbCustomCard.netCredit ?? sbCustomCard.netDebit ?? 0).toFixed(2)}
                                                            </span>
                                                          </div>
                                                          <div className="text-gray-500">Max Profit: <span className="font-mono font-medium text-gray-700">{sbCustomCard.maxProfit != null ? `$${sbCustomCard.maxProfit}` : 'Unlimited'}</span></div>
                                                          <div className="text-gray-500">Max Loss: <span className={`font-mono font-medium ${sbCustomCard.isUnlimited ? 'text-red-600' : 'text-gray-700'}`}>{sbCustomCard.maxLoss != null ? `$${sbCustomCard.maxLoss}` : sbCustomCard.isUnlimited ? 'Unlimited' : 'Undefined'}</span></div>
                                                          <div className="text-gray-500">PoP: <span className="font-mono font-medium text-gray-700">{sbCustomCard.pop != null ? `~${Math.round(sbCustomCard.pop * 100)}%` : 'N/A'}</span></div>
                                                        </div>
                                                        {sbCustomCard.pnlPoints.length > 2 && sbQuotePrice && (
                                                          <div className="border-t border-indigo-200 pt-1 mt-1"
                                                            dangerouslySetInnerHTML={{ __html: renderPnlSvg(sbCustomCard.pnlPoints, sbCustomCard.breakevens, sbQuotePrice, 280, 120) }}
                                                          />
                                                        )}
                                                        {sbCustomCard.hasWideSpread && (
                                                          <div className="text-[9px] text-amber-600 mt-1">{'\u26A0'} Wide bid/ask spreads — prices may be unreliable (market may be closed)</div>
                                                        )}
                                                      </div>
                                                    )}
                                                  </div>
                                                  {/* Click-to-build strike table */}
                                                  {sbChainData && sbSelectedExp != null && (
                                                    <div>
                                                      <div className="flex items-center gap-2 mb-1">
                                                        <div className="text-[9px] text-gray-400 uppercase tracking-wider">Click bid/ask to build custom strategy (max 4 legs)</div>
                                                        {sbCustomLegs.length > 0 && (
                                                          <button onClick={() => { setSbCustomLegs([]); setSbCustomCard(null); }} className="text-[9px] text-red-400 hover:text-red-600">Clear All</button>
                                                        )}
                                                      </div>
                                                      <div className="overflow-x-auto max-h-[200px] overflow-y-auto">
                                                        <table className="w-full text-[9px]">
                                                          <thead className="sticky top-0 bg-gray-50">
                                                            <tr className="text-gray-500 border-b border-gray-200">
                                                              <th className="text-right px-1 py-0.5 font-medium">C.Bid</th>
                                                              <th className="text-right px-1 py-0.5 font-medium">C.Ask</th>
                                                              <th className="text-right px-1 py-0.5 font-medium">{'\u0394'}</th>
                                                              <th className="text-center px-1 py-0.5 font-semibold bg-gray-100">Strike</th>
                                                              <th className="text-left px-1 py-0.5 font-medium">{'\u0394'}</th>
                                                              <th className="text-left px-1 py-0.5 font-medium">P.Bid</th>
                                                              <th className="text-left px-1 py-0.5 font-medium">P.Ask</th>
                                                            </tr>
                                                          </thead>
                                                          <tbody>
                                                            {(sbChainData.expirations[sbSelectedExp].strikes || [])
                                                              .filter((s: any) => {
                                                                if (!sbQuotePrice) return true;
                                                                return Math.abs(s.strike - sbQuotePrice) <= sbQuotePrice * 0.12;
                                                              })
                                                              .map((s: any, si: number) => {
                                                                const cg = sbGreeksData[s.callStreamerSymbol] || {};
                                                                const pg = sbGreeksData[s.putStreamerSymbol] || {};
                                                                const isCallBidSel = sbCustomLegs.some(l => l.streamerSymbol === s.callStreamerSymbol && l.side === 'sell');
                                                                const isCallAskSel = sbCustomLegs.some(l => l.streamerSymbol === s.callStreamerSymbol && l.side === 'buy');
                                                                const isPutBidSel = sbCustomLegs.some(l => l.streamerSymbol === s.putStreamerSymbol && l.side === 'sell');
                                                                const isPutAskSel = sbCustomLegs.some(l => l.streamerSymbol === s.putStreamerSymbol && l.side === 'buy');
                                                                return (
                                                                  <tr key={si} className="border-b border-gray-50 hover:bg-white">
                                                                    <td
                                                                      className={`text-right px-1 py-0.5 font-mono cursor-pointer hover:bg-emerald-100 ${isCallBidSel ? 'bg-emerald-200 ring-1 ring-emerald-400' : 'text-gray-600'}`}
                                                                      onClick={(e) => { e.stopPropagation(); if (cg.bid != null) handleClickLeg('call', 'sell', s.strike, s.callStreamerSymbol); }}
                                                                    >{cg.bid != null ? cg.bid.toFixed(2) : ''}</td>
                                                                    <td
                                                                      className={`text-right px-1 py-0.5 font-mono cursor-pointer hover:bg-blue-100 ${isCallAskSel ? 'bg-blue-200 ring-1 ring-blue-400' : 'text-gray-600'}`}
                                                                      onClick={(e) => { e.stopPropagation(); if (cg.ask != null) handleClickLeg('call', 'buy', s.strike, s.callStreamerSymbol); }}
                                                                    >{cg.ask != null ? cg.ask.toFixed(2) : ''}</td>
                                                                    <td className="text-right px-1 py-0.5 font-mono text-gray-400">{cg.delta != null ? cg.delta.toFixed(2) : ''}</td>
                                                                    <td className={`text-center px-1 py-0.5 font-mono font-semibold bg-gray-100 ${sbQuotePrice && Math.abs(s.strike - sbQuotePrice) < 1 ? 'text-indigo-700' : 'text-gray-700'}`}>{s.strike}</td>
                                                                    <td className="text-left px-1 py-0.5 font-mono text-gray-400">{pg.delta != null ? pg.delta.toFixed(2) : ''}</td>
                                                                    <td
                                                                      className={`text-left px-1 py-0.5 font-mono cursor-pointer hover:bg-emerald-100 ${isPutBidSel ? 'bg-emerald-200 ring-1 ring-emerald-400' : 'text-gray-600'}`}
                                                                      onClick={(e) => { e.stopPropagation(); if (pg.bid != null) handleClickLeg('put', 'sell', s.strike, s.putStreamerSymbol); }}
                                                                    >{pg.bid != null ? pg.bid.toFixed(2) : ''}</td>
                                                                    <td
                                                                      className={`text-left px-1 py-0.5 font-mono cursor-pointer hover:bg-blue-100 ${isPutAskSel ? 'bg-blue-200 ring-1 ring-blue-400' : 'text-gray-600'}`}
                                                                      onClick={(e) => { e.stopPropagation(); if (pg.ask != null) handleClickLeg('put', 'buy', s.strike, s.putStreamerSymbol); }}
                                                                    >{pg.ask != null ? pg.ask.toFixed(2) : ''}</td>
                                                                  </tr>
                                                                );
                                                              })}
                                                          </tbody>
                                                        </table>
                                                      </div>
                                                    </div>
                                                  )}
                                                </div>
                                              ) : (
                                                <div className="text-xs text-gray-400 text-center py-2">
                                                  No strategies available{sbQuotePrice ? '' : ' (could not fetch quote price)'}
                                                </div>
                                              )}
                                            </td>
                                          </tr>
                                        )}
                                      </Fragment>
                                    );
                                  })}
                                </tbody>
                              </table>
                              {filteredData.length > 0 && (
                                <div className="mt-2">
                                  <button
                                    onClick={() => setFilteredOutExpanded(p => !p)}
                                    className="text-[10px] text-gray-400 hover:text-gray-600"
                                  >
                                    {filteredOutExpanded ? '\u25B2' : '\u25BC'} Filtered Out ({filteredData.length})
                                  </button>
                                  {filteredOutExpanded && (
                                    <table className="w-full text-xs mt-1 opacity-50">
                                      <tbody>
                                        {filteredData.slice(0, 30).map((m: any) => (
                                          <tr key={m.symbol} className="border-b border-gray-50">
                                            <td className="px-2 py-1 font-mono text-gray-400">{m.symbol}</td>
                                            <td className="text-right px-2 py-1 font-mono text-gray-400">{m.score}</td>
                                            <td className="text-right px-2 py-1 font-mono text-gray-400">{((m.ivRank ?? 0) * 100).toFixed(1)}</td>
                                            <td className="text-right px-2 py-1 font-mono text-gray-400">{m.ivHvSpread != null ? m.ivHvSpread.toFixed(1) : '\u2014'}</td>
                                            <td className="text-right px-2 py-1 font-mono text-gray-400">{m.hv30 != null ? m.hv30.toFixed(1) + '%' : '\u2014'}</td>
                                            <td className="text-right px-2 py-1 font-mono text-gray-400">{((m.impliedVolatility ?? 0) * 100).toFixed(1)}%</td>
                                            <td className="text-right px-2 py-1 font-mono text-gray-400">{m.liquidityRating != null ? m.liquidityRating : '\u2014'}</td>
                                            <td className="px-2 py-1 text-[10px] text-red-400">{m.filterReason}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : !ttScannerStarted && !ttScannerLoading ? (
                            <div className="flex flex-col items-center justify-center py-16 gap-4">
                              <div className="text-4xl">{'\uD83D\uDD0D'}</div>
                              <div className="text-lg font-semibold text-gray-700">Market Intelligence</div>
                              <div className="text-sm text-gray-500 text-center max-w-md">
                                Select a universe above, then scan to find options where implied volatility exceeds realized movement.
                              </div>
                              <button
                                onClick={() => startScan()}
                                className="mt-2 px-6 py-3 bg-[#2d1b4e] text-white rounded-lg font-semibold text-sm hover:bg-[#3d2b5e] transition-colors"
                              >
                                {'\uD83D\uDE80'} Scan Market
                              </button>
                            </div>
                          ) : !ttScannerLoading ? (
                            <div className="text-xs text-gray-400">
                              No scanner data available.{' '}
                              <button onClick={() => startScan()} className="text-[#2d1b4e] hover:underline font-medium">Retry</button>
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
                          'IV-HV spread analysis & options scanner',
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
