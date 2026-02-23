'use client';

import { useState, useMemo, useCallback, Fragment } from 'react';

/* ===================================================================
   ScannerResultsTable — dense, sortable, selectable power table
   for bulk scan results (Popular 50, S&P 500, etc.).
   Single ticker lookups continue to use the existing TickerCard.
   =================================================================== */

// ── Types (structural match with ConvergenceIntelligence) ───────────

interface LegData { type: string; side: string; strike: number; price: number }

interface TradeCardSetup {
  strategy_name: string;
  legs: LegData[];
  expiration_date: string;
  dte: number;
  net_credit: number | null;
  net_debit: number | null;
  max_profit: number | null;
  max_loss: number | null;
  breakevens: number[];
  probability_of_profit: number | null;
  hv_pop: number | null;
  risk_reward_ratio: number | null;
  greeks: { delta: number; gamma: number; theta: number; vega: number; theta_per_day: number };
  ev: number;
  ev_per_risk: number;
  has_wide_spread: boolean;
  is_unlimited_risk: boolean;
}

interface TradeCardWhy {
  composite_score: number;
  letter_grade: string;
  direction: string;
  convergence_gate: string;
  category_scores: { vol_edge: number; quality: number; regime: number; info_edge: number };
  plain_english_signals: string[];
  regime_context: string;
  risk_flags: string[];
}

interface TradeCardKeyStats {
  iv_rank: number | null;
  iv_percentile: number | null;
  iv30: number | null;
  hv30: number | null;
  iv_hv_spread: number | null;
  earnings_date: string | null;
  days_to_earnings: number | null;
  market_cap: number | null;
  sector: string | null;
  beta: number | null;
  spy_correlation: number | null;
  pe_ratio: number | null;
  dividend_yield: number | null;
  liquidity_rating: number | null;
  lendability: string | null;
  buzz_ratio: number | null;
  sentiment_momentum: number | null;
  analyst_consensus: string | null;
}

interface TradeCardData {
  symbol: string;
  label: string;
  setup: TradeCardSetup;
  why: TradeCardWhy;
  key_stats: TradeCardKeyStats;
}

interface Headline {
  datetime: number;
  headline: string;
  source: string;
  sentiment: string;
}

interface TickerDetail {
  symbol: string;
  pipeline_runtime_ms: number;
  scores: {
    composite: {
      score: number;
      direction: string;
      convergence_gate: string;
      categories_above_50: number;
      category_scores: { vol_edge: number; quality: number; regime: number; info_edge: number };
    };
    info_edge?: {
      breakdown?: {
        news_sentiment?: {
          news_detail?: {
            headlines?: Headline[];
          };
        };
      };
    };
  };
  trade_cards?: TradeCardData[];
  data_gaps: string[];
  _chain_stats?: Record<string, unknown>;
  _fetch_errors?: Record<string, string>;
}

// ── Props ────────────────────────────────────────────────────────────

interface ScannerResultsTableProps {
  results: TickerDetail[];
  savedCards: Map<string, string>;
  savingCards: Set<string>;
  saveErrors: Map<string, string>;
  onSaveCard: (detail: TickerDetail, card: TradeCardData) => Promise<void>;
  onRemoveCard: (cardKey: string, savedId: string) => Promise<void>;
}

// ── Helpers ──────────────────────────────────────────────────────────

function gradeColor(s: number): string {
  if (s >= 70) return '#10B981';
  if (s >= 50) return '#F59E0B';
  return '#EF4444';
}

function letterGrade(s: number): string {
  if (s >= 90) return 'A+'; if (s >= 80) return 'A'; if (s >= 70) return 'B+';
  if (s >= 60) return 'B'; if (s >= 50) return 'C+'; if (s >= 40) return 'C';
  if (s >= 30) return 'D'; return 'F';
}

function dirBadge(d: string) {
  const u = d.toUpperCase();
  if (u === 'BULLISH') return { bg: '#065F46', text: '#34D399', label: 'BULLISH' };
  if (u === 'BEARISH') return { bg: '#7F1D1D', text: '#FCA5A5', label: 'BEARISH' };
  return { bg: '#334155', text: '#94A3B8', label: 'NEUTRAL' };
}

function fmtDollar(v: number | null): string {
  if (v == null) return '\u2014';
  return v >= 0 ? `$${v.toLocaleString()}` : `-$${Math.abs(v).toLocaleString()}`;
}

function fmtPct(v: number | null): string {
  if (v == null) return '\u2014';
  return `${(v * 100).toFixed(1)}%`;
}

function fmtMcap(v: number | null): string {
  if (v == null) return '\u2014';
  if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  return `$${v.toLocaleString()}`;
}

function statExplain(key: string, val: number | null): string {
  if (val == null) return '';
  switch (key) {
    case 'iv_rank': return val > 70 ? 'options expensive vs. past year' : val > 40 ? 'moderate option prices' : 'options cheap vs. past year';
    case 'beta': return val > 1.2 ? 'moves more than the market' : val > 0.8 ? 'moves with the market' : 'less volatile than market';
    case 'spy_correlation': return val > 0.7 ? 'strongly follows S&P 500' : val > 0.4 ? 'somewhat follows market' : 'marches to its own beat';
    case 'liquidity_rating': return val >= 4 ? 'easy to fill' : val >= 3 ? 'decent liquidity' : 'may be hard to fill';
    case 'pe_ratio': return val > 40 ? 'high valuation' : val > 15 ? 'moderate valuation' : 'cheap on earnings';
    default: return '';
  }
}

// ── Flat row type ────────────────────────────────────────────────────

interface TableRow {
  id: string;
  detail: TickerDetail;
  card: TradeCardData | null;
  cardKey: string;
  symbol: string;
  score: number;
  direction: string;
  strategyName: string;
  legsText: string;
  entryText: string;
  maxProfit: number | null;
  maxLoss: number | null;
  winPct: number | null;
  riskReward: number | null;
  dte: number | null;
}

type SortKey = 'symbol' | 'score' | 'direction' | 'strategyName' | 'maxProfit' | 'maxLoss' | 'winPct' | 'riskReward' | 'dte';

// ── Expanded Detail ──────────────────────────────────────────────────

function ExpandedDetail({ detail, card }: { detail: TickerDetail; card: TradeCardData | null }) {
  const comp = detail.scores.composite;
  const why = card?.why;
  const ks = card?.key_stats;
  const headlines: Headline[] = detail.scores.info_edge?.breakdown?.news_sentiment?.news_detail?.headlines?.slice(0, 3) ?? [];

  return (
    <div className="px-6 py-4 space-y-4" style={{ borderTop: '1px solid #334155' }}>
      {/* Score bars */}
      <div className="grid grid-cols-4 gap-3">
        {(['vol_edge', 'quality', 'regime', 'info_edge'] as const).map(cat => {
          const score = comp.category_scores[cat];
          return (
            <div key={cat} className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400 w-16 text-right shrink-0">
                {cat === 'vol_edge' ? 'Vol Edge' : cat === 'info_edge' ? 'Info Edge' : cat.charAt(0).toUpperCase() + cat.slice(1)}
              </span>
              <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: '#334155' }}>
                <div className="h-full rounded-full" style={{ width: `${Math.min(score, 100)}%`, background: gradeColor(score) }} />
              </div>
              <span className="text-[10px] font-mono font-bold w-8 text-right shrink-0" style={{ color: gradeColor(score) }}>
                {score.toFixed(0)}
              </span>
            </div>
          );
        })}
      </div>

      {/* WHY THIS TRADE */}
      {why && why.plain_english_signals.length > 0 && (
        <div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Why This Trade</div>
          <div className="space-y-1">
            {why.plain_english_signals.map((sig, i) => (
              <div key={i} className="flex gap-2 text-xs text-gray-200 leading-relaxed">
                <span className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ background: '#334155', color: '#94A3B8' }}>{i + 1}</span>
                <span>{sig}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KEY STATS */}
      {ks && (
        <div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Key Stats</div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
            <div>
              <span className="text-gray-500">IV Rank: </span>
              <span className="text-gray-200 font-mono">{ks.iv_rank != null ? ks.iv_rank.toFixed(1) : '\u2014'}</span>
              {ks.iv_rank != null && <span className="text-gray-500 text-[10px]"> &mdash; {statExplain('iv_rank', ks.iv_rank)}</span>}
            </div>
            <div>
              <span className="text-gray-500">P/E: </span>
              <span className="text-gray-200 font-mono">{ks.pe_ratio != null ? ks.pe_ratio.toFixed(1) : '\u2014'}</span>
              {ks.pe_ratio != null && <span className="text-gray-500 text-[10px]"> &mdash; {statExplain('pe_ratio', ks.pe_ratio)}</span>}
            </div>
            <div>
              <span className="text-gray-500">Beta: </span>
              <span className="text-gray-200 font-mono">{ks.beta != null ? ks.beta.toFixed(2) : '\u2014'}</span>
              {ks.beta != null && <span className="text-gray-500 text-[10px]"> &mdash; {statExplain('beta', ks.beta)}</span>}
            </div>
            <div>
              <span className="text-gray-500">SPY Corr: </span>
              <span className="text-gray-200 font-mono">{ks.spy_correlation != null ? ks.spy_correlation.toFixed(2) : '\u2014'}</span>
              {ks.spy_correlation != null && <span className="text-gray-500 text-[10px]"> &mdash; {statExplain('spy_correlation', ks.spy_correlation)}</span>}
            </div>
            <div>
              <span className="text-gray-500">Liquidity: </span>
              <span className="text-gray-200 font-mono">{ks.liquidity_rating != null ? `${ks.liquidity_rating}/5` : '\u2014'}</span>
              {ks.liquidity_rating != null && <span className="text-gray-500 text-[10px]"> &mdash; {statExplain('liquidity_rating', ks.liquidity_rating)}</span>}
            </div>
            <div>
              <span className="text-gray-500">Mkt Cap: </span>
              <span className="text-gray-200 font-mono">{fmtMcap(ks.market_cap)}</span>
            </div>
            <div>
              <span className="text-gray-500">Sector: </span>
              <span className="text-gray-200">{ks.sector ?? '\u2014'}</span>
            </div>
            <div>
              <span className="text-gray-500">Earnings: </span>
              <span className="text-gray-200 font-mono">{ks.earnings_date ?? '\u2014'}</span>
              {ks.days_to_earnings != null && ks.days_to_earnings > 0 && (
                <span className="text-amber-400 text-[10px]"> ({ks.days_to_earnings}d away)</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Regime context */}
      {why?.regime_context && (
        <div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">Macro Regime</div>
          <div className="rounded px-3 py-2 text-xs text-gray-300 leading-relaxed" style={{ background: '#1E293B' }}>
            {why.regime_context}
          </div>
        </div>
      )}

      {/* Risk flags */}
      {why && why.risk_flags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {why.risk_flags.map((flag, i) => {
            const isRed = flag.startsWith('UNLIMITED') || flag.startsWith('INSIDER');
            return (
              <span
                key={i}
                className="px-2 py-0.5 rounded text-[10px] font-medium"
                style={{ background: isRed ? '#7F1D1D30' : '#78350F30', color: isRed ? '#FCA5A5' : '#FDE68A' }}
              >
                {isRed ? '\u26D4 ' : '\u26A0 '}{flag}
              </span>
            );
          })}
        </div>
      )}

      {/* Headlines */}
      {headlines.length > 0 && (
        <div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Headlines</div>
          <div className="space-y-1">
            {headlines.map((h, i) => {
              const sentColor = h.sentiment === 'bullish' ? '#34D399' : h.sentiment === 'bearish' ? '#F87171' : '#94A3B8';
              return (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="text-gray-300 leading-relaxed flex-1">&ldquo;{h.headline}&rdquo;</span>
                  <span className="shrink-0 text-[9px] text-gray-500">{h.source}</span>
                  <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ color: sentColor, background: sentColor + '15' }}>
                    {h.sentiment}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────

export default function ScannerResultsTable({
  results,
  savedCards,
  savingCards,
  saveErrors,
  onSaveCard,
  onRemoveCard,
}: ScannerResultsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [batchSaving, setBatchSaving] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 });

  // Build flat rows: one row per strategy, not per ticker
  const rows = useMemo<TableRow[]>(() => {
    const result: TableRow[] = [];
    for (const detail of results) {
      const cards = detail.trade_cards ?? [];
      const comp = detail.scores.composite;
      if (cards.length === 0) {
        // Ticker with no strategies — single row with message
        result.push({
          id: `${detail.symbol}|__none__`,
          detail,
          card: null,
          cardKey: '',
          symbol: detail.symbol,
          score: comp.score,
          direction: comp.direction,
          strategyName: '',
          legsText: '',
          entryText: '',
          maxProfit: null,
          maxLoss: null,
          winPct: null,
          riskReward: null,
          dte: null,
        });
      } else {
        for (const card of cards) {
          const s = card.setup;
          const legsText = s.legs
            .map(l => `${l.side.toUpperCase()} ${l.strike}${l.type[0].toUpperCase()}`)
            .join(' / ');
          let entryText = '\u2014';
          if (s.net_credit != null && s.net_credit > 0) {
            entryText = `Collect $${(s.net_credit * 100).toFixed(0)}`;
          } else if (s.net_debit != null) {
            entryText = `Pay $${(s.net_debit * 100).toFixed(0)}`;
          }
          result.push({
            id: `${detail.symbol}|${s.strategy_name}`,
            detail,
            card,
            cardKey: `${detail.symbol}|${s.strategy_name}`,
            symbol: detail.symbol,
            score: comp.score,
            direction: comp.direction,
            strategyName: s.strategy_name,
            legsText,
            entryText,
            maxProfit: s.max_profit,
            maxLoss: s.max_loss,
            winPct: s.probability_of_profit,
            riskReward: s.risk_reward_ratio,
            dte: s.dte,
          });
        }
      }
    }
    return result;
  }, [results]);

  // Sorted rows
  const sortedRows = useMemo(() => {
    const sorted = [...rows];
    sorted.sort((a, b) => {
      let aVal: number | string = 0;
      let bVal: number | string = 0;
      switch (sortKey) {
        case 'symbol': aVal = a.symbol; bVal = b.symbol; break;
        case 'score': aVal = a.score; bVal = b.score; break;
        case 'direction': aVal = a.direction; bVal = b.direction; break;
        case 'strategyName': aVal = a.strategyName; bVal = b.strategyName; break;
        case 'maxProfit': aVal = a.maxProfit ?? -Infinity; bVal = b.maxProfit ?? -Infinity; break;
        case 'maxLoss': aVal = a.maxLoss ?? -Infinity; bVal = b.maxLoss ?? -Infinity; break;
        case 'winPct': aVal = a.winPct ?? -Infinity; bVal = b.winPct ?? -Infinity; break;
        case 'riskReward': aVal = a.riskReward ?? -Infinity; bVal = b.riskReward ?? -Infinity; break;
        case 'dte': aVal = a.dte ?? Infinity; bVal = b.dte ?? Infinity; break;
      }
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
    return sorted;
  }, [rows, sortKey, sortDir]);

  const toggleSort = useCallback((key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }, [sortKey]);

  const toggleRow = useCallback((id: string) => {
    setExpandedRow(prev => (prev === id ? null : id));
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    const keys = new Set<string>();
    for (const r of rows) {
      if (r.card !== null && !savedCards.has(r.cardKey)) keys.add(r.id);
    }
    setSelectedRows(keys);
  }, [rows, savedCards]);

  const deselectAll = useCallback(() => setSelectedRows(new Set()), []);

  const selectedCount = selectedRows.size;

  // Batch save
  const batchSave = useCallback(async () => {
    const toSave = sortedRows.filter(r => selectedRows.has(r.id) && r.card && !savedCards.has(r.cardKey));
    if (toSave.length === 0) return;
    setBatchSaving(true);
    setBatchProgress({ done: 0, total: toSave.length });
    for (let i = 0; i < toSave.length; i++) {
      setBatchProgress({ done: i, total: toSave.length });
      await onSaveCard(toSave[i].detail, toSave[i].card!);
    }
    setBatchProgress({ done: toSave.length, total: toSave.length });
    setBatchSaving(false);
    setSelectedRows(new Set());
  }, [sortedRows, selectedRows, savedCards, onSaveCard]);

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return '';
    return sortDir === 'asc' ? ' \u25B2' : ' \u25BC';
  };

  const thBase = 'px-2 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-200 select-none whitespace-nowrap';

  return (
    <div className="px-4 py-3">
      {/* Batch actions bar */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <button onClick={selectAll} className="text-[10px] text-indigo-400 hover:text-indigo-300 font-medium">Select All</button>
        <span className="text-gray-600">|</span>
        <button onClick={deselectAll} className="text-[10px] text-indigo-400 hover:text-indigo-300 font-medium">Deselect All</button>
        {selectedCount > 0 && (
          <span className="text-[10px] text-gray-400 font-mono">{selectedCount} selected</span>
        )}
        <div className="ml-auto">
          <button
            onClick={batchSave}
            disabled={selectedCount === 0 || batchSaving}
            className="px-4 py-1.5 rounded text-xs font-bold text-white disabled:opacity-40 transition-colors"
            style={{ background: selectedCount > 0 && !batchSaving ? '#059669' : '#334155' }}
          >
            {batchSaving
              ? `Saving ${batchProgress.done}/${batchProgress.total}...`
              : `Add Selected to Queue (${selectedCount})`
            }
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border max-h-[700px] overflow-y-auto" style={{ borderColor: '#334155' }}>
        <table className="w-full text-xs" style={{ minWidth: 900 }}>
          <thead className="sticky top-0 z-10">
            <tr style={{ background: '#1E293B' }}>
              <th className="px-2 py-2 w-8">{/* checkbox col */}</th>
              <th className={thBase + ' text-left'} onClick={() => toggleSort('symbol')}>Symbol{sortIndicator('symbol')}</th>
              <th className={thBase + ' text-right'} onClick={() => toggleSort('score')}>Score{sortIndicator('score')}</th>
              <th className={thBase + ' text-left'} onClick={() => toggleSort('direction')}>Direction{sortIndicator('direction')}</th>
              <th className={thBase + ' text-left'} onClick={() => toggleSort('strategyName')}>Strategy{sortIndicator('strategyName')}</th>
              <th className={thBase + ' text-left'}>Legs</th>
              <th className={thBase + ' text-right'}>Entry</th>
              <th className={thBase + ' text-right'} onClick={() => toggleSort('maxProfit')}>Max P{sortIndicator('maxProfit')}</th>
              <th className={thBase + ' text-right'} onClick={() => toggleSort('maxLoss')}>Max L{sortIndicator('maxLoss')}</th>
              <th className={thBase + ' text-right'} onClick={() => toggleSort('winPct')}>Win%{sortIndicator('winPct')}</th>
              <th className={thBase + ' text-right'} onClick={() => toggleSort('riskReward')}>R:R{sortIndicator('riskReward')}</th>
              <th className={thBase + ' text-right'} onClick={() => toggleSort('dte')}>DTE{sortIndicator('dte')}</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, idx) => {
              const isExpanded = expandedRow === row.id;
              const isQueued = row.card ? savedCards.has(row.cardKey) : false;
              const isSaving = row.card ? savingCards.has(row.cardKey) : false;
              const error = row.card ? saveErrors.get(row.cardKey) : undefined;
              const isSelected = selectedRows.has(row.id);
              const bgColor = idx % 2 === 0 ? '#111827' : '#1F2937';
              const dir = dirBadge(row.direction);

              return (
                <Fragment key={row.id}>
                  <tr
                    className="transition-colors cursor-pointer hover:bg-gray-700/30"
                    style={{
                      background: isQueued ? '#064E3B20' : isSelected ? '#312E8120' : bgColor,
                      borderLeft: isSelected ? '2px solid #6366F1' : isQueued ? '2px solid #10B981' : '2px solid transparent',
                    }}
                  >
                    {/* Checkbox */}
                    <td className="px-2 py-2 text-center" onClick={e => e.stopPropagation()}>
                      {row.card === null ? null : isQueued ? (
                        <span className="text-green-400 text-sm">&#10003;</span>
                      ) : isSaving ? (
                        <span className="inline-block w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(row.id)}
                          className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-800 text-indigo-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                        />
                      )}
                    </td>
                    {/* Symbol */}
                    <td className="px-2 py-2 font-mono font-bold text-white" onClick={() => toggleRow(row.id)}>
                      {row.symbol}
                    </td>
                    {/* Score */}
                    <td className="px-2 py-2 text-right font-mono font-bold" onClick={() => toggleRow(row.id)} style={{ color: gradeColor(row.score) }}>
                      {row.score.toFixed(1)} <span className="text-[10px]">{letterGrade(row.score)}</span>
                    </td>
                    {/* Direction */}
                    <td className="px-2 py-2" onClick={() => toggleRow(row.id)}>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider" style={{ background: dir.bg, color: dir.text }}>
                        {dir.label}
                      </span>
                    </td>
                    {/* Strategy */}
                    <td className="px-2 py-2 text-gray-200" onClick={() => toggleRow(row.id)}>
                      {row.card ? row.strategyName : (
                        <span className="text-gray-500 italic">
                          {row.detail._fetch_errors?.chain_fetch || 'No strategies available'}
                        </span>
                      )}
                    </td>
                    {/* Legs */}
                    <td className="px-2 py-2 text-gray-300 font-mono text-[10px] max-w-[200px]" onClick={() => toggleRow(row.id)} style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
                      {row.legsText || '\u2014'}
                    </td>
                    {/* Entry */}
                    <td className="px-2 py-2 text-right font-mono text-gray-200" onClick={() => toggleRow(row.id)}>
                      {row.entryText}
                    </td>
                    {/* Max Profit */}
                    <td className="px-2 py-2 text-right font-mono text-green-400" onClick={() => toggleRow(row.id)}>
                      {fmtDollar(row.maxProfit)}
                    </td>
                    {/* Max Loss */}
                    <td className="px-2 py-2 text-right font-mono text-red-400" onClick={() => toggleRow(row.id)}>
                      {fmtDollar(row.maxLoss)}
                    </td>
                    {/* Win% */}
                    <td className="px-2 py-2 text-right font-mono text-gray-200" onClick={() => toggleRow(row.id)}>
                      {fmtPct(row.winPct)}
                    </td>
                    {/* R:R */}
                    <td className="px-2 py-2 text-right font-mono text-gray-200" onClick={() => toggleRow(row.id)}>
                      {row.riskReward != null ? row.riskReward.toFixed(2) : '\u2014'}
                    </td>
                    {/* DTE */}
                    <td className="px-2 py-2 text-right font-mono text-gray-300" onClick={() => toggleRow(row.id)}>
                      {row.dte ?? '\u2014'}
                    </td>
                  </tr>

                  {/* Error row */}
                  {error && (
                    <tr style={{ background: '#7F1D1D15' }}>
                      <td colSpan={12} className="px-4 py-1 text-[10px] text-red-300">
                        Failed to save: {error}
                      </td>
                    </tr>
                  )}

                  {/* Expanded detail row */}
                  {isExpanded && (
                    <tr>
                      <td colSpan={12} style={{ background: '#0F172A', padding: 0 }}>
                        <ExpandedDetail detail={row.detail} card={row.card} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
