'use client';

import { useState, useMemo, useCallback, Fragment } from 'react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';

/* ===================================================================
   ScannerResultsTable — dense, sortable, selectable power table
   for bulk scan results (Popular 50, S&P 500, etc.).
   Single ticker lookups continue to use the existing TickerCard.
   =================================================================== */

// ── Types (canonical imports) ────────────────────────────────────────

import type {
  VolEdgeResult,
  QualityGateResult,
  RegimeResult,
  InfoEdgeResult,
  TradeCardSetup,
  TradeCardWhy,
  TradeCardKeyStats,
  TradeCardData,
} from '@/lib/convergence/types';
import type { TickerDetail } from '@/lib/convergence/filter-engine';
import { TickerChapter } from './ConvergenceIntelligence';
import { themed, type Surface } from '@/lib/ds';

interface Headline {
  datetime: number;
  headline: string;
  source: string;
  sentiment: string;
}

// ── Props ────────────────────────────────────────────────────────────

interface SocialSentimentData {
  symbol: string;
  score: number;
  magnitude: number;
  postCount: number;
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  themes: string[];
  samplePosts: { text: string; sentiment: 'bullish' | 'bearish' | 'neutral'; author: string }[];
  dataAge: string;
  error?: string;
}

interface RejectionReason {
  strategy: string;
  reason: string;
  gate: string;
  details?: { value: number; threshold: number; spreadWidth?: number };
}

interface ScannerResultsTableProps {
  results: TickerDetail[];
  sentimentMap?: Record<string, SocialSentimentData>;
  rejectionMap?: Record<string, RejectionReason[]>;
  savedCards: Map<string, string>;
  savingCards: Set<string>;
  saveErrors: Map<string, string>;
  onSaveCard: (detail: TickerDetail, card: TradeCardData, sentiment?: SocialSentimentData) => Promise<void>;
  onRemoveCard: (cardKey: string, savedId: string) => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pipelineProgress?: Record<string, any>;
}

// ── Helpers ──────────────────────────────────────────────────────────

function gradeColor(s: number): string {
  if (s >= 70) return 'text-brand-green';
  if (s >= 50) return 'text-status-warning';
  return 'text-brand-red';
}

// TRADE-CHIPS: DISCRETE 3-bucket score color — tokenized to the status
// family (kept as an rgb(var()) string: consumers feed inline style/SVG).
function gradeColorHex(s: number): string {
  if (s >= 70) return 'rgb(var(--ts-success))';
  if (s >= 50) return 'rgb(var(--ts-warning))';
  return 'rgb(var(--ts-danger))';
}

function letterGrade(s: number): string {
  if (s >= 90) return 'A+'; if (s >= 80) return 'A'; if (s >= 70) return 'B+';
  if (s >= 60) return 'B'; if (s >= 50) return 'C+'; if (s >= 40) return 'C';
  if (s >= 30) return 'D'; return 'F';
}

function dirBadgeVariant(d: string): 'success' | 'danger' | 'default' {
  const u = d.toUpperCase();
  if (u === 'BULLISH') return 'success';
  if (u === 'BEARISH') return 'danger';
  return 'default';
}

function fmtDollar(v: number | null): string {
  if (v == null) return '—';
  return v >= 0 ? `$${v.toLocaleString()}` : `-$${Math.abs(v).toLocaleString()}`;
}

function fmtPct(v: number | null): string {
  if (v == null) return '—';
  return `${(v * 100).toFixed(1)}%`;
}

function fmtMcap(v: number | null): string {
  if (v == null) return '—';
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
  popMethod: 'breakeven_d2' | 'delta_approx';
  ev: number | null;
  evPerRisk: number | null;
  riskReward: number | null;
  dte: number | null;
  hasWideSpread: boolean;
}

type SortKey = 'symbol' | 'score' | 'direction' | 'strategyName' | 'maxProfit' | 'maxLoss' | 'winPct' | 'ev' | 'evPerRisk' | 'riskReward' | 'dte';

// ── Expanded Detail ──────────────────────────────────────────────────

function ExpandedDetail({ dk = false, detail, card, sentiment, rejections }: { dk?: boolean; detail: TickerDetail; card: TradeCardData | null; sentiment?: SocialSentimentData; rejections?: RejectionReason[] }) {
  const comp = detail.scores.composite;
  const why = card?.why;
  const ks = card?.key_stats;
  const headlines: Headline[] = detail.scores.info_edge?.breakdown?.news_sentiment?.news_detail?.headlines?.slice(0, 3) ?? [];
  const allRejections = rejections || detail._rejection_reasons;

  return (
    <div className={themed('px-6 py-4 space-y-4 border-t border-border', dk)}>
      {/* Rejection reasons (when no strategies passed) */}
      {allRejections && allRejections.length > 0 && !card && (
        <div>
          <div className={themed('text-[10px] text-text-muted uppercase tracking-wider font-bold mb-1.5', dk)}>Why No Strategies Passed</div>
          <div className="space-y-1 max-h-[200px] overflow-y-auto">
            {allRejections.map((rej, i) => (
              <div key={i} className={themed('flex items-start gap-2 text-xs rounded px-2 py-1 bg-bg-row', dk)}>
                <span className={`shrink-0 px-1 py-0.5 rounded text-[9px] font-bold ${rej.gate === 'construction' ? 'bg-amber-50 text-status-warning' : 'bg-red-50 text-brand-red'}`}>
                  {rej.gate === 'construction' ? 'BUILD' : `GATE ${rej.gate}`}
                </span>
                <span className={themed('text-text-faint flex-1', dk)}>
                  <span className={themed('text-text-faint font-mono', dk)}>{rej.strategy}:</span> {rej.reason}
                  {rej.details?.spreadWidth != null && (
                    <span className={themed('text-text-muted', dk)}> (width: ${rej.details.spreadWidth})</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Score bars */}
      <div className="grid grid-cols-4 gap-3">
        {(['vol_edge', 'quality', 'regime', 'info_edge'] as const).map(cat => {
          const score = comp.category_scores[cat];
          return (
            <div key={cat} className="flex items-center gap-2">
              <span className={themed('text-[10px] text-text-faint w-16 text-right shrink-0', dk)}>
                {cat === 'vol_edge' ? 'Vol Edge' : cat === 'info_edge' ? 'Info Edge' : cat.charAt(0).toUpperCase() + cat.slice(1)}
              </span>
              <div className={themed('flex-1 h-3 rounded-full overflow-hidden bg-bg-row', dk)}>
                <div className="h-full rounded-full" style={{ width: `${Math.min(score, 100)}%`, background: gradeColorHex(score) }} />
              </div>
              <span className={`text-[10px] font-mono font-bold w-8 text-right shrink-0 ${gradeColor(score)}`}>
                {score.toFixed(0)}
              </span>
            </div>
          );
        })}
      </div>

      {/* WHY THIS TRADE */}
      {why && why.plain_english_signals.length > 0 && (
        <div>
          <div className={themed('text-[10px] text-text-muted uppercase tracking-wider font-bold mb-1.5', dk)}>Why This Trade</div>
          <div className="space-y-1">
            {why.plain_english_signals.map((sig, i) => (
              <div key={i} className={themed('flex gap-2 text-xs text-text-faint leading-relaxed', dk)}>
                <span className={themed('shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold bg-bg-row text-text-muted', dk)}>{i + 1}</span>
                <span>{sig}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KEY STATS */}
      {ks && (
        <div>
          <div className={themed('text-[10px] text-text-muted uppercase tracking-wider font-bold mb-1.5', dk)}>Key Stats</div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
            <div>
              <span className={themed('text-text-muted', dk)}>IV Rank: </span>
              <span className={themed('text-text-faint font-mono', dk)}>{ks.iv_rank != null ? ks.iv_rank.toFixed(1) : '—'}</span>
              {ks.iv_rank != null && <span className={themed('text-text-muted text-[10px]', dk)}> &mdash; {statExplain('iv_rank', ks.iv_rank)}</span>}
            </div>
            <div>
              <span className={themed('text-text-muted', dk)}>P/E: </span>
              <span className={themed('text-text-faint font-mono', dk)}>{ks.pe_ratio != null ? ks.pe_ratio.toFixed(1) : '—'}</span>
              {ks.pe_ratio != null && <span className={themed('text-text-muted text-[10px]', dk)}> &mdash; {statExplain('pe_ratio', ks.pe_ratio)}</span>}
            </div>
            <div>
              <span className={themed('text-text-muted', dk)}>Beta: </span>
              <span className={themed('text-text-faint font-mono', dk)}>{ks.beta != null ? ks.beta.toFixed(2) : '—'}</span>
              {ks.beta != null && <span className={themed('text-text-muted text-[10px]', dk)}> &mdash; {statExplain('beta', ks.beta)}</span>}
            </div>
            <div>
              <span className={themed('text-text-muted', dk)}>SPY Corr: </span>
              <span className={themed('text-text-faint font-mono', dk)}>{ks.spy_correlation != null ? ks.spy_correlation.toFixed(2) : '—'}</span>
              {ks.spy_correlation != null && <span className={themed('text-text-muted text-[10px]', dk)}> &mdash; {statExplain('spy_correlation', ks.spy_correlation)}</span>}
            </div>
            <div>
              <span className={themed('text-text-muted', dk)}>Liquidity: </span>
              <span className={themed('text-text-faint font-mono', dk)}>{ks.liquidity_rating != null ? `${ks.liquidity_rating}/5` : '—'}</span>
              {ks.liquidity_rating != null && <span className={themed('text-text-muted text-[10px]', dk)}> &mdash; {statExplain('liquidity_rating', ks.liquidity_rating)}</span>}
            </div>
            <div>
              <span className={themed('text-text-muted', dk)}>Mkt Cap: </span>
              <span className={themed('text-text-faint font-mono', dk)}>{fmtMcap(ks.market_cap)}</span>
            </div>
            <div>
              <span className={themed('text-text-muted', dk)}>Sector: </span>
              <span className={themed('text-text-faint', dk)}>{ks.sector ?? '—'}</span>
            </div>
            <div>
              <span className={themed('text-text-muted', dk)}>Earnings: </span>
              <span className={themed('text-text-faint font-mono', dk)}>{ks.earnings_date ?? '—'}</span>
              {ks.days_to_earnings != null && ks.days_to_earnings > 0 && (
                <span className="text-status-warning text-[10px]"> ({ks.days_to_earnings}d away)</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Regime context */}
      {why?.regime_context && (
        <div>
          <div className={themed('text-[10px] text-text-muted uppercase tracking-wider font-bold mb-1', dk)}>Macro Regime</div>
          <div className={themed('rounded px-3 py-2 text-xs text-text-faint leading-relaxed bg-bg-row', dk)}>
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
                className={`px-2 py-0.5 rounded text-[10px] font-medium ${isRed ? 'bg-red-50 text-brand-red' : 'bg-amber-50 text-status-warning'}`}
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
          <div className={themed('text-[10px] text-text-muted uppercase tracking-wider font-bold mb-1.5', dk)}>Headlines</div>
          <div className="space-y-1">
            {headlines.map((h, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className={themed('text-text-faint leading-relaxed flex-1', dk)}>&ldquo;{h.headline}&rdquo;</span>
                <span className={themed('shrink-0 text-[9px] text-text-muted', dk)}>{h.source}</span>
                <Badge
                  variant={h.sentiment === 'bullish' ? 'success' : h.sentiment === 'bearish' ? 'danger' : 'default'}
                  size="sm"
                >
                  {h.sentiment}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Social Pulse — from xAI x_search */}
      {sentiment && !sentiment.error && sentiment.postCount > 0 && (
        <div>
          <div className={themed('text-[10px] text-text-muted uppercase tracking-wider font-bold mb-1.5', dk)}>
            Social Pulse
            <span className={themed('ml-2 text-[9px] text-text-secondary normal-case font-normal', dk)}>
              Based on {sentiment.postCount} X posts in last 24h
            </span>
          </div>
          <div className={themed('rounded px-3 py-2 text-xs space-y-2 bg-bg-row', dk)}>
            <div className="flex items-center gap-3">
              <span className={themed('text-text-faint', dk)}>Score:</span>
              <span
                className={themed(`font-mono font-bold ${sentiment.score > 0.2 ? 'text-brand-green' : sentiment.score < -0.2 ? 'text-brand-red' : 'text-text-muted'}`, dk)}
              >
                {sentiment.score > 0 ? '+' : ''}{sentiment.score.toFixed(2)}
              </span>
              <span className={themed('text-text-faint', dk)}>
                ({sentiment.bullishCount} bullish / {sentiment.bearishCount} bearish / {sentiment.neutralCount} neutral)
              </span>
            </div>
            {sentiment.themes.length > 0 && (
              <div className="flex items-center gap-2">
                <span className={themed('text-text-faint shrink-0', dk)}>Themes:</span>
                <div className="flex flex-wrap gap-1">
                  {sentiment.themes.slice(0, 5).map((t, i) => (
                    <Badge key={i} variant="default" size="sm">{t}</Badge>
                  ))}
                </div>
              </div>
            )}
            {sentiment.samplePosts.length > 0 && (
              <div className="space-y-1 mt-1">
                {sentiment.samplePosts.slice(0, 3).map((post, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <Badge
                      variant={post.sentiment === 'bullish' ? 'success' : post.sentiment === 'bearish' ? 'danger' : 'default'}
                      size="sm"
                    >
                      {post.sentiment.charAt(0).toUpperCase()}
                    </Badge>
                    <span className={themed('text-text-faint leading-relaxed flex-1', dk)}>&ldquo;{post.text}&rdquo;</span>
                    <span className={themed('shrink-0 text-[9px] text-text-muted font-mono', dk)}>{post.author}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────

export default function ScannerResultsTable({
  results,
  sentimentMap,
  rejectionMap,
  savedCards,
  savingCards,
  saveErrors,
  onSaveCard,
  onRemoveCard,
  pipelineProgress,
  surface = 'light',
}: ScannerResultsTableProps & { surface?: Surface }) {
  const dk = surface === 'dark';
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
          popMethod: 'delta_approx' as const,
          ev: null,
          evPerRisk: null,
          riskReward: null,
          dte: null,
          hasWideSpread: false,
        });
      } else {
        for (const card of cards) {
          const s = card.setup;
          const legsText = s.legs
            .map(l => `${l.side.toUpperCase()} ${l.strike}${l.type[0].toUpperCase()}`)
            .join(' / ');
          let entryText = '—';
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
            popMethod: s.pop_method ?? 'delta_approx',
            ev: s.ev ?? null,
            evPerRisk: s.ev_per_risk ?? null,
            riskReward: s.risk_reward_ratio,
            dte: s.dte,
            hasWideSpread: s.has_wide_spread,
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
        case 'ev': aVal = a.ev ?? -Infinity; bVal = b.ev ?? -Infinity; break;
        case 'evPerRisk': aVal = a.evPerRisk ?? -Infinity; bVal = b.evPerRisk ?? -Infinity; break;
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
      await onSaveCard(toSave[i].detail, toSave[i].card!, sentimentMap?.[toSave[i].symbol]);
    }
    setBatchProgress({ done: toSave.length, total: toSave.length });
    setBatchSaving(false);
    setSelectedRows(new Set());
  }, [sortedRows, selectedRows, savedCards, onSaveCard, sentimentMap]);

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return '';
    return sortDir === 'asc' ? ' \u25B2' : ' \u25BC';
  };

  // TRADE-TABLES: DATA.columnHeader layered onto the sort affordances —
  // token-native, so the themed() wrap dropped (identity on dark).
  const thBase = 'px-2 py-2 font-mono text-[10px] uppercase tracking-wider text-text-faint cursor-pointer hover:text-text-muted select-none whitespace-nowrap';

  return (
    <div className="px-4 py-3">
      {/* Batch actions bar */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <button onClick={selectAll} className="text-[10px] text-brand-purple hover:text-brand-purple-hover font-medium">Select All</button>
        <span className={themed('text-text-secondary', dk)}>|</span>
        <button onClick={deselectAll} className="text-[10px] text-brand-purple hover:text-brand-purple-hover font-medium">Deselect All</button>
        {selectedCount > 0 && (
          <span className={themed('text-[10px] text-text-faint font-mono', dk)}>{selectedCount} selected</span>
        )}
        <div className="ml-auto">
          <Button
            variant="primary"
            size="sm"
            onClick={batchSave}
            disabled={selectedCount === 0 || batchSaving}
            loading={batchSaving}
            className={selectedCount > 0 && !batchSaving ? 'bg-brand-green hover:bg-brand-green/90 border-0' : ''}
          >
            {batchSaving
              ? `Saving ${batchProgress.done}/${batchProgress.total}...`
              : `Add Selected to Queue (${selectedCount})`
            }
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className={themed('overflow-x-auto rounded border border-border overflow-y-auto', dk)}>
        <table className="w-full text-xs" style={{ minWidth: 900 }}>
          <thead className="sticky top-0 z-10">
            <tr className="bg-bg-row">
              <th className="px-2 py-2 w-8">{/* checkbox col */}</th>
              <th className={thBase + ' text-left'} onClick={() => toggleSort('symbol')}>Symbol{sortIndicator('symbol')}</th>
              <th className={thBase + ' text-center w-6'} title="Social Sentiment from X/Twitter (via xAI Grok)">X</th>
              <th className={thBase + ' text-right'} onClick={() => toggleSort('score')}>Score{sortIndicator('score')}</th>
              <th className={thBase + ' text-left'} onClick={() => toggleSort('direction')}>Direction{sortIndicator('direction')}</th>
              <th className={thBase + ' text-left'} onClick={() => toggleSort('strategyName')}>Strategy{sortIndicator('strategyName')}</th>
              <th className={thBase + ' text-left'}>Legs</th>
              <th className={thBase + ' text-right'}>Entry</th>
              <th className={thBase + ' text-right'} onClick={() => toggleSort('maxProfit')}>Max P{sortIndicator('maxProfit')}</th>
              <th className={thBase + ' text-right'} onClick={() => toggleSort('maxLoss')}>Max L{sortIndicator('maxLoss')}</th>
              <th className={thBase + ' text-right'} onClick={() => toggleSort('winPct')} title="Estimated Probability of Profit — N(d2) at breakeven when available, delta approximation otherwise. Actual results will vary.">Est. PoP{sortIndicator('winPct')}</th>
              <th className={thBase + ' text-right'} onClick={() => toggleSort('ev')} title="Expected Value — estimated profit/loss per trade using three-outcome model">Est. EV{sortIndicator('ev')}</th>
              <th className={thBase + ' text-right'} onClick={() => toggleSort('evPerRisk')} title="Expected Value per dollar risked — higher is better">EV/Risk{sortIndicator('evPerRisk')}</th>
              <th className={thBase + ' text-right'} onClick={() => toggleSort('riskReward')}>R:R{sortIndicator('riskReward')}</th>
              <th className={thBase + ' text-right'} onClick={() => toggleSort('dte')}>DTE{sortIndicator('dte')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sortedRows.map((row, idx) => {
              const isExpanded = expandedRow === row.id;
              const isQueued = row.card ? savedCards.has(row.cardKey) : false;
              const isSaving = row.card ? savingCards.has(row.cardKey) : false;
              const error = row.card ? saveErrors.get(row.cardKey) : undefined;
              const isSelected = selectedRows.has(row.id);

              return (
                <Fragment key={row.id}>
                  <tr
                    className={`transition-colors cursor-pointer hover:bg-white/5 ${isQueued ? 'bg-status-success/10' : ''} ${isSelected ? 'bg-brand-purple-pop/10' : ''}`}
                    style={{
                      borderLeft: isSelected ? '2px solid rgb(var(--ts-purple-pop))' : isQueued ? '2px solid rgb(var(--ts-success))' : '2px solid transparent',
                    }}
                  >
                    {/* Checkbox */}
                    <td className="px-2 py-2 text-center" onClick={e => e.stopPropagation()}>
                      {row.card === null ? null : isQueued ? (
                        <span className="text-brand-green text-sm">&#10003;</span>
                      ) : isSaving ? (
                        <span className={themed('inline-block w-3 h-3 border-2 border-text-muted border-t-transparent rounded-full animate-spin', dk)} />
                      ) : (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(row.id)}
                          className={themed('w-3.5 h-3.5 rounded border-border text-brand-purple focus:ring-0 focus:ring-offset-0 cursor-pointer', dk)}
                        />
                      )}
                    </td>
                    {/* Symbol */}
                    <td className={themed('px-2 py-2 font-mono font-bold text-text-primary', dk)} onClick={() => toggleRow(row.id)}>
                      {row.symbol}
                    </td>
                    {/* Sentiment dot */}
                    <td className="px-1 py-2 text-center" onClick={() => toggleRow(row.id)}>
                      {(() => {
                        const s = sentimentMap?.[row.symbol];
                        if (!s || s.error || s.postCount === 0) return null;
                        const dotClass = s.score > 0.2 ? 'bg-brand-green' : s.score < -0.2 ? 'bg-brand-red' : 'bg-text-muted';
                        const label = s.score > 0.2 ? 'bullish' : s.score < -0.2 ? 'bearish' : 'neutral';
                        return (
                          <span
                            className={`inline-block w-2 h-2 rounded-full ${dotClass}`}
                            title={`Social Sentiment: ${s.score > 0 ? '+' : ''}${s.score.toFixed(2)} (${label}) — ${s.postCount} posts. ${s.themes.length > 0 ? 'Themes: ' + s.themes.slice(0, 3).join(', ') : ''}`}
                          />
                        );
                      })()}
                    </td>
                    {/* Score */}
                    <td className={`px-2 py-2 text-right font-mono font-bold ${gradeColor(row.score)}`} onClick={() => toggleRow(row.id)}>
                      {row.score.toFixed(1)} <span className="text-[10px]">{letterGrade(row.score)}</span>
                    </td>
                    {/* Direction */}
                    <td className="px-2 py-2" onClick={() => toggleRow(row.id)}>
                      <Badge variant={dirBadgeVariant(row.direction)} size="sm">{row.direction}</Badge>
                    </td>
                    {/* Strategy */}
                    <td className={themed('px-2 py-2 text-text-faint', dk)} onClick={() => toggleRow(row.id)}>
                      {row.card ? (
                        <>
                          {row.strategyName}
                          {row.hasWideSpread && (
                            <span className="ml-1 text-status-warning cursor-help" title="Bid/ask estimated from theoretical price — actual market spread may differ">&#x26A0;</span>
                          )}
                        </>
                      ) : (
                        <span className={themed('text-text-muted italic', dk)}>
                          {row.detail._fetch_errors?.chain_fetch || (() => {
                            const rej = row.detail._rejection_reasons || rejectionMap?.[row.symbol];
                            if (rej && rej.length > 0) {
                              const top = rej[0];
                              const extra = rej.length > 1 ? ` (+${rej.length - 1} more)` : '';
                              return `No strategies — ${top.reason}${extra}`;
                            }
                            return 'No strategies available';
                          })()}
                        </span>
                      )}
                    </td>
                    {/* Legs */}
                    <td className={themed('px-2 py-2 text-text-faint font-mono text-[10px] max-w-[200px]', dk)} onClick={() => toggleRow(row.id)} style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
                      {row.legsText || '—'}
                    </td>
                    {/* Entry */}
                    <td className={themed('px-2 py-2 text-right font-mono text-text-faint', dk)} onClick={() => toggleRow(row.id)}>
                      {row.entryText}
                    </td>
                    {/* Max Profit */}
                    <td className="px-2 py-2 text-right font-mono text-brand-green" onClick={() => toggleRow(row.id)}>
                      {fmtDollar(row.maxProfit)}
                    </td>
                    {/* Max Loss */}
                    <td className="px-2 py-2 text-right font-mono text-brand-red" onClick={() => toggleRow(row.id)}>
                      {fmtDollar(row.maxLoss)}
                    </td>
                    {/* Est. PoP — TRADE-UX-1: the dossier anchor leads the row.
                        Within the table idiom the promotion is weight + primary
                        color (a display numeral would break row rhythm): the
                        strongest cell in every results row. Same field/format. */}
                    <td
                      className={themed('px-2 py-2 text-right font-mono text-sm font-black text-text-primary', dk)}
                      onClick={() => toggleRow(row.id)}
                      title={row.popMethod === 'breakeven_d2'
                        ? 'PoP via N(d2) at breakeven price'
                        : 'PoP estimated from option deltas (approximate)'}
                    >
                      {fmtPct(row.winPct)}
                    </td>
                    {/* Est. EV */}
                    <td className={themed(`px-2 py-2 text-right font-mono ${row.ev == null ? 'text-text-muted' : row.ev > 0 ? 'text-brand-green' : row.ev < 0 ? 'text-brand-red' : 'text-text-muted'}`, dk)} onClick={() => toggleRow(row.id)}>
                      {row.ev != null ? `${row.ev >= 0 ? '+' : ''}$${Math.round(row.ev)}` : '—'}
                    </td>
                    {/* EV/Risk */}
                    <td className={themed(`px-2 py-2 text-right font-mono ${row.evPerRisk == null ? 'text-text-muted' : row.evPerRisk > 0 ? 'text-brand-green' : row.evPerRisk < 0 ? 'text-brand-red' : 'text-text-muted'}`, dk)} onClick={() => toggleRow(row.id)}>
                      {row.evPerRisk != null ? row.evPerRisk.toFixed(3) : '—'}
                    </td>
                    {/* R:R */}
                    <td className={themed('px-2 py-2 text-right font-mono text-text-faint', dk)} onClick={() => toggleRow(row.id)}>
                      {row.riskReward != null ? row.riskReward.toFixed(2) : '—'}
                    </td>
                    {/* DTE */}
                    <td className={themed('px-2 py-2 text-right font-mono text-text-faint', dk)} onClick={() => toggleRow(row.id)}>
                      {row.dte ?? '—'}
                    </td>
                  </tr>

                  {/* Error row */}
                  {error && (
                    <tr className="bg-red-50">
                      <td colSpan={15} className="px-4 py-1 text-[10px] text-brand-red">
                        Failed to save: {error}
                      </td>
                    </tr>
                  )}

                  {/* Expanded detail row */}
                  {isExpanded && (
                    <tr>
                      <td colSpan={15} className={themed('bg-white p-0', dk)}>
                        <TickerChapter detail={row.detail} sentiment={sentimentMap?.[row.symbol]} savedCards={savedCards} savingCards={savingCards} saveErrors={saveErrors} onSave={onSaveCard} onRemove={onRemoveCard} pipelineProgress={pipelineProgress ?? {}} />
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
