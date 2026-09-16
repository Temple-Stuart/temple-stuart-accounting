'use client';

/**
 * TRADE-SPLIT — TRADE LOG (registry tool 18) — its own page, its own pipe.
 *
 * TOOL-LAW-01 rules one tool, one page. /trading was the last grandfathered
 * exception: Brokerage (17) and Trade Log (18) shared it. THE SORT already drew
 * the line (src/lib/nav.ts THE_SORT) — trade 04 LAB, 05 RECORD, 06 COMMIT are
 * this tool's; 01-03 are Brokerage's, now on /brokerage.
 *
 * Everything here MOVED WHOLE from src/app/trading/page.tsx — the Trade Lab
 * (:925-934), the Performance row (:810-833), the P&L calendar (:884-897), the
 * Trade Journal and its modal (:937-1066, :1081-1170), the Chart of Accounts
 * (:837-849) and Commit to Ledger (:851-882), with the loaders and derivations
 * they read. Nothing is rewritten.
 *
 * The strip is this tool's OWN three phases (PIPE_PHASES.trade 04-06) through
 * the shared StageStrip. Phase 06 COMMIT keeps its existing hand-off to Books
 * (PIPE_PHASES.trade[5].link — "IN BOOKS →"), unchanged.
 *
 * THE EMPTY ROOM (TRADE-SPLIT STEP 0.4): a trading_positions row is created in
 * exactly one place — src/lib/position-tracker-service.ts:176, from an
 * investment_transactions leg, reached through
 * /api/investment-transactions/commit-to-ledger:116 (and stock-lots:171,
 * assignment-exercise:60, batch-trade-processor). Those legs are written only
 * by the PLAID arrivals pass (src/lib/arrivals/plaidInvestmentsPage.ts:203,
 * :215 via /api/transactions/sync-complete). NO manual "log a trade" path
 * exists, and TastyTrade writes nothing but tastytrade_connections — so the
 * empty room names the doors that actually fill it, never Brokerage's connect.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { AppLayout } from '@/components/ui';
// LOCK-01: this page renders a paid module — it asks the tab's own question first.
import RoomLock, { useTabLock } from '@/components/shell/RoomLock';
import ToolOpener from '@/components/shell/ToolOpener';
import { navToolsOfScreen } from '@/lib/nav';
import { TOOL_GATE } from '@/lib/offer';
import CalendarGrid, { CalendarEvent, SourceConfig } from '@/components/shared/CalendarGrid';
import TradeLabPanel from '@/components/trading/TradeLabPanel';
import LogTradeForm from '@/components/trading/LogTradeForm';
import COAManagementTable from '@/components/bookkeeping/COAManagementTable';
import StageStrip, { type StagePhase } from '@/components/ui/StageStrip';
import { PIPE_PHASES } from '@/lib/pipePhases';
import { TRADE_LOG_EMPTY_ROOM, TRADE_LOG_EMPTY_ROOM_DOORS, tradeLogRoomIsEmpty } from '@/lib/tradeLogRoom';
// TRADE-LOG-01: provenance is DISPLAY only — never a capability branch.
import { MANUAL_BADGE } from '@/lib/tradeLog/ownership';
// TRADE-SHELL-DARK: the one section-header idiom (ds.ts).
import { MONEY_ACTION, SECTION_HEADER, STATE, chip } from '@/lib/ds';

// This tool's three phases, read from the shared pipe — never a retyped list.
const [, , , PIPE_LAB, PIPE_RECORD, PIPE_COMMIT] = PIPE_PHASES.trade;

type TradeLogPhase = 'lab' | 'record' | 'commit';

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
  /** TRADE-LOG-01: true when the trade was entered by hand, false when it came
   *  from the broker's arrivals. /api/trading/trades sets it on every trade. */
  handEntered?: boolean;
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

const EMOTIONS = ['confident', 'neutral', 'nervous', 'fomo', 'revenge', 'greedy', 'fearful'];
const SETUPS = ['breakout', 'pullback', 'mean-reversion', 'momentum', 'earnings', 'theta-decay', 'volatility', 'other'];

export default function TradeLogPage() {
  // LOCK-01: the same check the tab makes (isTabLocked over /api/auth/me).
  const roomLock = useTabLock('tab:trade');

  // The phase this tool's strip has selected.
  const [phase, setPhase] = useState<TradeLogPhase>('lab');

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

  // Trade cards (kept so the Trade Lab mount below is the one from /trading)
  const [tradeCards, setTradeCards] = useState<{
    status: string;
    link: { trade_num: string } | null;
  }[]>([]);

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

  // TRADE-LOG-01 STEP 4 — a hand-entered trade can be corrected or removed by
  // its owner. A synced one cannot: it is the broker's record. Both actions go
  // through /api/trade-log/manual, which checks ownership on every call.
  const [correctingTrade, setCorrectingTrade] = useState<string | null>(null);
  const [deleteRefusal, setDeleteRefusal] = useState<string | null>(null);


  const [maxTradeNum, setMaxTradeNum] = useState(0);

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

  // TRADE-LOG-01: the record read, named — a hand-entered trade lands through
  // the same /api/trading/trades the synced ones come from (it unions the
  // manual legs), so logging one reloads exactly this.
  const loadRecord = useCallback(async () => {
    const [tradesResult, journalResult, maxResult] = await Promise.all([
      fetch('/api/trading/trades').then(res => res.json()),
      fetch('/api/trading-journal').then(res => res.ok ? res.json() : { entries: [] }),
      fetch('/api/investment-transactions/max-trade-num').then(res => res.ok ? res.json() : { maxTradeNum: 0 })
    ]);
    setTradesData(tradesResult);
    setJournalEntries(journalResult.entries || []);
    setMaxTradeNum(maxResult.maxTradeNum || 0);
  }, []);

  useEffect(() => {
    loadRecord()
      .catch(console.error)
      .finally(() => setLoading(false));
    loadCommittedTrades();
  }, [loadRecord, loadCommittedTrades]);
  const deleteManualTrade = useCallback(async (tradeNum: string) => {
    setDeleteRefusal(null);
    const res = await fetch(`/api/trade-log/manual?trade_num=${encodeURIComponent(tradeNum)}`, { method: 'DELETE' });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      // NEVER a silent cascade — the route names the card that still holds the
      // grade, and the refusal is shown with its reason.
      setDeleteRefusal(data?.error ?? `Trade ${tradeNum} was not deleted (HTTP ${res.status}).`);
      return;
    }
    await loadRecord().catch(console.error);
  }, [loadRecord]);

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
      // TRADE-LOG-01 STEP 3: the calendar marks a hand-entered trade too — the
      // day's P&L says which of its trades the broker never confirmed.
      details: data.trades.map(t => `${t.underlying} | ${t.strategy.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}${t.handEntered ? ` · ${MANUAL_BADGE}` : ''}`),
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

  // THE EMPTY ROOM: this tool's work is a trade. With none in the log the room
  // says what it needs and where that comes from — never a blank page, never a
  // pitch, and never a door that does not fill it (STEP 0.4).
  const roomIsEmpty = tradeLogRoomIsEmpty(tradesData?.trades);

  return (
    <AppLayout>
      <RoomLock locked={roomLock.locked} stepName="Trading">
      <div className="min-h-screen bg-bg-terminal text-text-primary">
        <div className="p-4 lg:p-6 max-w-[1800px] mx-auto">
          {/* TRADE-SPLIT: ONE tool's screen — Trade Log (18). */}
          <ToolOpener tools={navToolsOfScreen('/trade-log', TOOL_GATE)} />

          {/* This tool's own pipe: trade 04-06 from PIPE_PHASES.trade. */}
          <div className="mb-3">
            <StageStrip
              phases={([
                { key: 'lab', num: PIPE_LAB.num, label: PIPE_LAB.name, subLabel: PIPE_LAB.subLabel,
                  state: phase === 'lab' ? 'active' : 'pending' },
                { key: 'record', num: PIPE_RECORD.num, label: PIPE_RECORD.name, subLabel: PIPE_RECORD.subLabel,
                  state: phase === 'record' ? 'active' : 'pending' },
                { key: 'commit', num: PIPE_COMMIT.num, label: PIPE_COMMIT.name,
                  state: phase === 'commit' ? 'active' : uncommittedTrades.length === 0 ? 'done' : 'pending' },
              ] as StagePhase[])}
              onSelect={(k) => setPhase(k as TradeLogPhase)}
            />
          </div>

          {roomIsEmpty && (
            <div className="overflow-hidden border-x border-b border-border bg-white px-4 py-3 mb-3">
              <p role="status" data-empty-room className="text-sm text-text-primary">
                {TRADE_LOG_EMPTY_ROOM}
              </p>
              <div className="mt-2 flex items-center gap-3 font-mono text-[11px]">
                {TRADE_LOG_EMPTY_ROOM_DOORS.map((d) => (
                  // TRADE-LOG-01: the first door is ON this page — it opens
                  // phase 04 and the form, it does not navigate away.
                  d.href.startsWith('#') ? (
                    <button key={d.href} type="button" data-empty-room-door
                      onClick={() => { setPhase('lab'); document.getElementById(d.href.slice(1))?.scrollIntoView({ behavior: 'smooth' }); }}
                      className="text-brand-purple hover:underline">{d.label}</button>
                  ) : (
                    <Link key={d.href} href={d.href} data-empty-room-door className="text-brand-purple hover:underline">{d.label}</Link>
                  )
                ))}
              </div>
            </div>
          )}

          {/* ── 04 LAB — log a trade by hand, link a position to a card, the thesis ── */}
          <div className={phase === 'lab' ? 'block' : 'hidden'}>
            {/* TRADE-LOG-01: the other door. A trade can be logged by hand —
                Trade Log needs nothing but a trade. */}
            <div className="mb-4">
              <LogTradeForm
                editTradeNum={correctingTrade}
                onEditDone={() => setCorrectingTrade(null)}
                onLogged={() => { loadRecord().catch(console.error); }}
              />
            </div>
            <div className="mb-4">
              <TradeLabPanel
                onCardsChange={() => {
                  fetch('/api/trade-cards')
                    .then(r => r.json())
                    .then(data => setTradeCards(Array.isArray(data?.cards) ? data.cards : []));
                }}
              />
            </div>
          </div>

          {/* ── 05 RECORD — the graded results ── */}
          <div className={phase === 'record' ? 'block' : 'hidden'}>
          {/* Performance — the 7-metric row (was ROW 2 in the sticky zone). */}
          {(() => { const m = filteredMetrics; return (
          <div className="rounded-lg overflow-hidden border border-border shadow-sm mb-3">
            <div className={SECTION_HEADER}>
              <span>Performance</span>
              <span className="flex items-center gap-1.5 text-xs font-normal ml-auto">
                <span className="text-text-muted uppercase text-[10px]">Period</span>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="bg-bg-row border border-border rounded px-1.5 py-0.5 text-text-primary text-[11px] font-mono w-[110px] outline-none" />
                <span className="text-text-faint">—</span>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="bg-bg-row border border-border rounded px-1.5 py-0.5 text-text-primary text-[11px] font-mono w-[110px] outline-none" />
                {(dateFrom || dateTo) && <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="text-text-muted hover:text-text-primary text-xs">x</button>}
              </span>
            </div>
            <div className="bg-white px-3 py-3 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-center">
              <div className="px-2"><div className="text-[9px] text-text-muted uppercase">P&amp;L</div><div className={`text-sm font-bold font-mono truncate ${m.totalRealizedPL >= 0 ? 'text-status-success' : 'text-status-danger'}`}>{fmtPL(m.totalRealizedPL)}</div></div>
              <div className="px-2"><div className="text-[9px] text-text-muted uppercase">WR</div><div className="text-sm font-bold font-mono text-text-primary truncate">{m.winRate}%</div></div>
              <div className="px-2"><div className="text-[9px] text-text-muted uppercase">PF</div><div className="text-sm font-bold font-mono text-text-primary truncate">{m.profitFactor >= 999 ? '∞' : m.profitFactor.toFixed(2)}</div></div>
              <div className="px-2"><div className="text-[9px] text-text-muted uppercase">Max W</div><div className="text-sm font-bold font-mono text-status-success truncate">{fmt(m.largestWin)}</div></div>
              <div className="px-2"><div className="text-[9px] text-text-muted uppercase">Max L</div><div className="text-sm font-bold font-mono text-status-danger truncate">{fmt(Math.abs(m.largestLoss))}</div></div>
              <div className="px-2"><div className="text-[9px] text-text-muted uppercase">Avg W</div><div className="text-sm font-bold font-mono text-status-success truncate">{fmt(m.avgWin)}</div></div>
              <div className="px-2"><div className="text-[9px] text-text-muted uppercase">Avg L</div><div className="text-sm font-bold font-mono text-status-danger truncate">{fmt(m.avgLoss)}</div></div>
            </div>
          </div>
          ); })()}

          {/* P&L Calendar */}
          <div className="overflow-hidden border-x border-b border-border">
            <div className={SECTION_HEADER}>P&L Calendar</div>
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

                {/* Trade Journal */}
                <div className="overflow-hidden border-x border-b border-border">
                  <div className={SECTION_HEADER}>
                    <span>Trade Journal</span>
                    <span className="text-xs text-text-faint">{filteredTrades.length} trades · {journalEntries.length} entries</span>
                  </div>
                  {deleteRefusal && (
                    <div className="bg-white px-4 py-2">
                      <div className={STATE.errorCard} role="alert" data-delete-refusal>{deleteRefusal}</div>
                    </div>
                  )}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-bg-row">
                        <tr>
                          <th className="px-2 py-2 text-left font-mono text-[10px] uppercase tracking-wider text-text-faint">Trade #</th>
                          <th className="px-2 py-2 text-left font-mono text-[10px] uppercase tracking-wider text-text-faint">Date</th>
                          <th className="px-2 py-2 text-left font-mono text-[10px] uppercase tracking-wider text-text-faint">Ticker</th>
                          <th className="px-2 py-2 text-left font-mono text-[10px] uppercase tracking-wider text-text-faint">Strategy</th>
                          <th className="px-2 py-2 text-center font-mono text-[10px] uppercase tracking-wider text-text-faint">Type</th>
                          <th className="px-2 py-2 text-center font-mono text-[10px] uppercase tracking-wider text-text-faint">Status</th>
                          <th className="px-2 py-2 text-right font-mono text-[10px] uppercase tracking-wider text-text-faint">P&L</th>
                          <th className="px-2 py-2 text-center font-mono text-[10px] uppercase tracking-wider text-text-faint">Rating</th>
                          <th className="px-2 py-2 text-center font-mono text-[10px] uppercase tracking-wider text-text-faint">Journal</th>
                          <th className="px-2 py-2 text-center font-mono text-[10px] uppercase tracking-wider text-text-faint"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredTrades.map(trade => {
                          const journal = getJournalEntry(trade.tradeNum);
                          const isExpanded = expandedTrade === trade.tradeNum;

                          return (
                            <>
                              <tr key={trade.tradeNum} className={`transition-colors hover:bg-white/5 ${isExpanded ? 'bg-brand-purple/10' : ''}`}>
                                <td className="px-2 py-2 font-mono text-text-muted">
                                  #{trade.tradeNum}
                                  {/* TRADE-LOG-01 STEP 3: provenance, visible. Display only —
                                      a hand-entered trade does everything a synced one does. */}
                                  {trade.handEntered && (
                                    <span data-hand-entered className={`${chip('accent')} ml-1`}>{MANUAL_BADGE}</span>
                                  )}
                                </td>
                                <td className="px-2 py-2 text-text-muted">{new Date(trade.openDate).toLocaleDateString()}</td>
                                <td className="px-2 py-2 font-mono font-semibold">{trade.underlying}</td>
                                <td className="px-2 py-2">
                                  <span className={chip('accent')}>{trade.strategy}</span>
                                </td>
                                <td className="px-2 py-2 text-center">
                                  <span className={chip(trade.type === 'option' ? 'info' : 'neutral')}>
                                    {trade.type}
                                  </span>
                                </td>
                                <td className="px-2 py-2 text-center">
                                  <span className={chip(
                                    trade.status === 'OPEN' || trade.status === 'PARTIAL' ? 'warning' : 'success'
                                  )}>{trade.status}</span>
                                </td>
                                <td className={`px-2 py-2 text-right font-mono font-semibold ${
                                  trade.status === 'CLOSED' ? (trade.realizedPL >= 0 ? 'text-status-success' : 'text-status-danger') : 'text-text-faint'
                                }`}>
                                  {trade.status === 'CLOSED' ? fmtPL(trade.realizedPL) : '—'}
                                </td>
                                <td className="px-2 py-2 text-center">
                                  {journal?.rating ? (
                                    <span className="text-status-warning">{'★'.repeat(journal.rating)}{'☆'.repeat(5 - journal.rating)}</span>
                                  ) : <span className="text-text-faint">—</span>}
                                </td>
                                <td className="px-2 py-2 text-center">
                                  {journal ? (
                                    <span className={chip(
                                      journal.emotion === 'confident' ? 'success' :
                                      journal.emotion === 'nervous' || journal.emotion === 'fearful' ? 'warning' :
                                      journal.emotion === 'fomo' || journal.emotion === 'revenge' || journal.emotion === 'greedy' ? 'danger' :
                                      'neutral'
                                    )}>{journal.emotion}</span>
                                  ) : <span className="text-text-faint">—</span>}
                                </td>
                                <td className="px-2 py-2 text-center">
                                  <div className="flex items-center gap-1 justify-center">
                                    <button onClick={() => openJournalModal(trade)}
                                      className="px-2 py-1 text-[10px] bg-brand-purple text-white hover:bg-brand-purple-hover">
                                      {journal ? 'Edit' : 'Add'}
                                    </button>
                                    {/* STEP 4: only a hand-entered trade is the owner's to
                                        correct or remove — a synced one is the broker's record. */}
                                    {trade.handEntered && (
                                      <>
                                        <button data-correct-trade onClick={() => { setDeleteRefusal(null); setCorrectingTrade(trade.tradeNum); setPhase('lab'); }}
                                          className="px-2 py-1 text-[10px] bg-bg-row text-text-muted hover:bg-border">
                                          Correct
                                        </button>
                                        <button data-delete-trade onClick={() => deleteManualTrade(trade.tradeNum)}
                                          className="px-2 py-1 text-[10px] bg-bg-row text-status-danger hover:bg-border">
                                          Delete
                                        </button>
                                      </>
                                    )}
                                    <button onClick={() => setExpandedTrade(isExpanded ? null : trade.tradeNum)}
                                      className="px-2 py-1 text-[10px] bg-bg-row text-text-muted hover:bg-border">
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
                                        <div className="font-semibold text-text-muted mb-2">Trade Details</div>
                                        <div className="space-y-1 text-text-muted">
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
                                          <div className="font-semibold text-text-muted mb-2">Journal Notes</div>
                                          <div className="space-y-1 text-text-muted">
                                            {journal.thesis && <div><span className="font-medium">Thesis:</span> {journal.thesis}</div>}
                                            {journal.setup && <div><span className="font-medium">Setup:</span> {journal.setup}</div>}
                                            {journal.mistakes && <div><span className="font-medium text-status-danger">Mistakes:</span> {journal.mistakes}</div>}
                                            {journal.lessons && <div><span className="font-medium text-status-success">Lessons:</span> {journal.lessons}</div>}
                                            {journal.tags?.length > 0 && (
                                              <div className="flex gap-1 flex-wrap">
                                                {journal.tags.map(tag => (
                                                  <span key={tag} className={chip()}>{tag}</span>
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
                          <tr><td colSpan={10} className={STATE.empty}>No trades in selected period</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
          </div>

          {/* ── 06 COMMIT — post to Books; the hand-off is the pipe's own ── */}
          <div className={phase === 'commit' ? 'block space-y-3' : 'hidden'}>
            {/* Chart of Accounts */}
            {tradingEntityId && (
              <div className="overflow-hidden border-x border-b border-border">
                <div className={SECTION_HEADER}>Chart of Accounts</div>
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
              <div className="overflow-hidden border-x border-b border-border">
                <div className={SECTION_HEADER}>Commit Trades to Ledger</div>
                <div className="bg-white px-4 py-3 flex items-center justify-between">
                  <div>
                    <span className="text-sm text-text-primary font-medium">
                      {uncommittedTrades.length} closed trade{uncommittedTrades.length !== 1 ? 's' : ''} not yet in ledger
                    </span>
                    <span className="text-xs text-text-faint ml-2">
                      (Net P&L: {fmtCurrency(uncommittedTrades.reduce((s, t) => s + t.realizedPL, 0))})
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {commitResult && (
                      <span className={`text-xs ${commitResult.errors.length > 0 ? 'text-status-danger' : 'text-status-success'}`}>
                        {commitResult.committed > 0 && `${commitResult.committed} committed`}
                        {commitResult.skipped > 0 && ` · ${commitResult.skipped} skipped`}
                        {commitResult.errors.length > 0 && ` · ${commitResult.errors.length} error${commitResult.errors.length !== 1 ? 's' : ''}`}
                      </span>
                    )}
                    <button
                      onClick={commitTradesToLedger}
                      disabled={commitLoading}
                      className={MONEY_ACTION}
                    >
                      {commitLoading ? 'Committing...' : 'Commit to Ledger'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Phase 06's own hand-off, from the pipe (PIPE_PHASES.trade[5].link). */}
            <div className="overflow-hidden border-x border-b border-border bg-white px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-text-muted">
                Committed trades post a balanced entry; the ledger they land in is Bookkeeping&apos;s.
              </span>
              <Link href="/books" className="font-mono text-[11px] text-brand-purple hover:underline">
                {PIPE_COMMIT.link?.label ?? 'IN BOOKS →'}
              </Link>
            </div>
          </div>

        </div>
      </div>

      {/* Journal Entry Modal */}
      {journalModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setJournalModal(null)}>
          <div className="bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className={`${SECTION_HEADER} sticky top-0`}>
              <div>
                <div className="font-semibold">Trade Journal</div>
                <div className="text-xs text-text-faint">#{journalModal.trade.tradeNum} · {journalModal.trade.underlying}</div>
              </div>
              <button onClick={() => setJournalModal(null)} className="text-text-muted hover:text-text-primary text-sm">×</button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Entry Type</label>
                <select value={journalForm.entryType} onChange={e => setJournalForm(p => ({ ...p, entryType: e.target.value }))}
                  className="w-full border border-border px-3 py-2 text-sm">
                  <option value="pre-trade">Pre-Trade (Planning)</option>
                  <option value="during">During Trade</option>
                  <option value="post-trade">Post-Trade (Review)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Thesis / Reason</label>
                <textarea value={journalForm.thesis} onChange={e => setJournalForm(p => ({ ...p, thesis: e.target.value }))}
                  className="w-full border border-border px-3 py-2 text-sm h-20" placeholder="Why did you take this trade?" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Setup</label>
                  <select value={journalForm.setup} onChange={e => setJournalForm(p => ({ ...p, setup: e.target.value }))}
                    className="w-full border border-border px-3 py-2 text-sm">
                    <option value="">Select...</option>
                    {SETUPS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Emotion</label>
                  <select value={journalForm.emotion} onChange={e => setJournalForm(p => ({ ...p, emotion: e.target.value }))}
                    className="w-full border border-border px-3 py-2 text-sm">
                    {EMOTIONS.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Mistakes</label>
                <textarea value={journalForm.mistakes} onChange={e => setJournalForm(p => ({ ...p, mistakes: e.target.value }))}
                  className="w-full border border-border px-3 py-2 text-sm h-16" placeholder="What went wrong?" />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Lessons Learned</label>
                <textarea value={journalForm.lessons} onChange={e => setJournalForm(p => ({ ...p, lessons: e.target.value }))}
                  className="w-full border border-border px-3 py-2 text-sm h-16" placeholder="What will you do differently?" />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Rating (1-5)</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} onClick={() => setJournalForm(p => ({ ...p, rating: n }))}
                      className={`w-10 h-10 text-terminal-lg ${journalForm.rating >= n ? 'text-status-warning' : 'text-text-faint'}`}>
                      {journalForm.rating >= n ? '★' : '☆'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Tags (comma separated)</label>
                <input type="text" value={journalForm.tags} onChange={e => setJournalForm(p => ({ ...p, tags: e.target.value }))}
                  className="w-full border border-border px-3 py-2 text-sm" placeholder="e.g., earnings, scalp, swing" />
              </div>
            </div>

            <div className="bg-bg-row px-4 py-3 flex justify-end gap-2 sticky bottom-0 border-t">
              <button onClick={() => setJournalModal(null)} className="px-4 py-2 text-sm text-text-muted hover:text-text-primary">
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

      </RoomLock>
    </AppLayout>
  );
}
