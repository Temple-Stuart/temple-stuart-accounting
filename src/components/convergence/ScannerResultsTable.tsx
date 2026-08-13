'use client';

import { useState, useMemo, useCallback, useEffect, Fragment } from 'react';
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
  /** RESULTS-ANATOMY: reports the derived row tally (trade = card rows,
   *  skip = rejection rows) for the results kicker. Reporting only. */
  onTally?: (t: { trade: number; skip: number }) => void;
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
  /** RESULTS-ANATOMY: derived from existing state only — 'trade' ⇐ the
   *  strategy was emitted as a real trade card (card != null); 'skip' ⇐ a
   *  stored rejection (rejectionMap / _rejection_reasons) or fetch error.
   *  Never invented. */
  verdict: 'trade' | 'skip';
  /** skip rows only: the STORED reason string, verbatim source. */
  skipReason?: string;
}

type SortKey = 'symbol' | 'score' | 'direction' | 'strategyName' | 'maxProfit' | 'maxLoss' | 'winPct' | 'ev' | 'evPerRisk' | 'riskReward' | 'dte';

// ── Expanded Detail ──────────────────────────────────────────────────

function ExpandedDetail({ detail, card, sentiment, rejections }: { detail: TickerDetail; card: TradeCardData | null; sentiment?: SocialSentimentData; rejections?: RejectionReason[] }) {
  const comp = detail.scores.composite;
  const why = card?.why;
  const ks = card?.key_stats;
  const headlines: Headline[] = detail.scores.info_edge?.breakdown?.news_sentiment?.news_detail?.headlines?.slice(0, 3) ?? [];
  const allRejections = rejections || detail._rejection_reasons;

  return (
    <div className="px-6 py-4 space-y-4 border-t border-border">
      {/* Rejection reasons (when no strategies passed) */}
      {allRejections && allRejections.length > 0 && !card && (
        <div>
          <div className="text-[10px] text-text-muted uppercase tracking-wider font-bold mb-1.5">Why No Strategies Passed</div>
          <div className="space-y-1 max-h-[200px] overflow-y-auto">
            {allRejections.map((rej, i) => (
              <div key={i} className="flex items-start gap-2 text-xs rounded px-2 py-1 bg-bg-row">
                <span className={`shrink-0 px-1 py-0.5 rounded text-[9px] font-bold ${rej.gate === 'construction' ? 'bg-amber-50 text-status-warning' : 'bg-red-50 text-brand-red'}`}>
                  {rej.gate === 'construction' ? 'BUILD' : `GATE ${rej.gate}`}
                </span>
                <span className="text-text-faint flex-1">
                  <span className="text-text-faint font-mono">{rej.strategy}:</span> {rej.reason}
                  {rej.details?.spreadWidth != null && (
                    <span className="text-text-muted"> (width: ${rej.details.spreadWidth})</span>
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
              <span className="text-[10px] text-text-faint w-16 text-right shrink-0">
                {cat === 'vol_edge' ? 'Vol Edge' : cat === 'info_edge' ? 'Info Edge' : cat.charAt(0).toUpperCase() + cat.slice(1)}
              </span>
              <div className="flex-1 h-3 rounded-full overflow-hidden bg-bg-row">
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
          <div className="text-[10px] text-text-muted uppercase tracking-wider font-bold mb-1.5">Why This Trade</div>
          <div className="space-y-1">
            {why.plain_english_signals.map((sig, i) => (
              <div key={i} className="flex gap-2 text-xs text-text-faint leading-relaxed">
                <span className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold bg-bg-row text-text-muted">{i + 1}</span>
                <span>{sig}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KEY STATS */}
      {ks && (
        <div>
          <div className="text-[10px] text-text-muted uppercase tracking-wider font-bold mb-1.5">Key Stats</div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
            <div>
              <span className="text-text-muted">IV Rank: </span>
              <span className="text-text-faint font-mono">{ks.iv_rank != null ? ks.iv_rank.toFixed(1) : '—'}</span>
              {ks.iv_rank != null && <span className="text-text-muted text-[10px]"> &mdash; {statExplain('iv_rank', ks.iv_rank)}</span>}
            </div>
            <div>
              <span className="text-text-muted">P/E: </span>
              <span className="text-text-faint font-mono">{ks.pe_ratio != null ? ks.pe_ratio.toFixed(1) : '—'}</span>
              {ks.pe_ratio != null && <span className="text-text-muted text-[10px]"> &mdash; {statExplain('pe_ratio', ks.pe_ratio)}</span>}
            </div>
            <div>
              <span className="text-text-muted">Beta: </span>
              <span className="text-text-faint font-mono">{ks.beta != null ? ks.beta.toFixed(2) : '—'}</span>
              {ks.beta != null && <span className="text-text-muted text-[10px]"> &mdash; {statExplain('beta', ks.beta)}</span>}
            </div>
            <div>
              <span className="text-text-muted">SPY Corr: </span>
              <span className="text-text-faint font-mono">{ks.spy_correlation != null ? ks.spy_correlation.toFixed(2) : '—'}</span>
              {ks.spy_correlation != null && <span className="text-text-muted text-[10px]"> &mdash; {statExplain('spy_correlation', ks.spy_correlation)}</span>}
            </div>
            <div>
              <span className="text-text-muted">Liquidity: </span>
              <span className="text-text-faint font-mono">{ks.liquidity_rating != null ? `${ks.liquidity_rating}/5` : '—'}</span>
              {ks.liquidity_rating != null && <span className="text-text-muted text-[10px]"> &mdash; {statExplain('liquidity_rating', ks.liquidity_rating)}</span>}
            </div>
            <div>
              <span className="text-text-muted">Mkt Cap: </span>
              <span className="text-text-faint font-mono">{fmtMcap(ks.market_cap)}</span>
            </div>
            <div>
              <span className="text-text-muted">Sector: </span>
              <span className="text-text-faint">{ks.sector ?? '—'}</span>
            </div>
            <div>
              <span className="text-text-muted">Earnings: </span>
              <span className="text-text-faint font-mono">{ks.earnings_date ?? '—'}</span>
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
          <div className="text-[10px] text-text-muted uppercase tracking-wider font-bold mb-1">Macro Regime</div>
          <div className="rounded px-3 py-2 text-xs text-text-faint leading-relaxed bg-bg-row">
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
          <div className="text-[10px] text-text-muted uppercase tracking-wider font-bold mb-1.5">Headlines</div>
          <div className="space-y-1">
            {headlines.map((h, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className="text-text-faint leading-relaxed flex-1">&ldquo;{h.headline}&rdquo;</span>
                <span className="shrink-0 text-[9px] text-text-muted">{h.source}</span>
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
          <div className="text-[10px] text-text-muted uppercase tracking-wider font-bold mb-1.5">
            Social Pulse
            <span className="ml-2 text-[9px] text-text-secondary normal-case font-normal">
              Based on {sentiment.postCount} X posts in last 24h
            </span>
          </div>
          <div className="rounded px-3 py-2 text-xs space-y-2 bg-bg-row">
            <div className="flex items-center gap-3">
              <span className="text-text-faint">Score:</span>
              <span
                className={`font-mono font-bold ${sentiment.score > 0.2 ? 'text-brand-green' : sentiment.score < -0.2 ? 'text-brand-red' : 'text-text-muted'}`}
              >
                {sentiment.score > 0 ? '+' : ''}{sentiment.score.toFixed(2)}
              </span>
              <span className="text-text-faint">
                ({sentiment.bullishCount} bullish / {sentiment.bearishCount} bearish / {sentiment.neutralCount} neutral)
              </span>
            </div>
            {sentiment.themes.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-text-faint shrink-0">Themes:</span>
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
                    <span className="text-text-faint leading-relaxed flex-1">&ldquo;{post.text}&rdquo;</span>
                    <span className="shrink-0 text-[9px] text-text-muted font-mono">{post.author}</span>
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
  onTally,
}: ScannerResultsTableProps & { }) {
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [batchSaving, setBatchSaving] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 });

  // Build flat rows: one row per strategy, not per ticker.
  // RESULTS-ANATOMY: SKIP rows join the candidate list — one per STORED
  // rejection ({strategy, reason} from _rejection_reasons / rejectionMap,
  // the same data the old collapsed "No strategies — …" message summarized).
  // A ticker with neither cards nor rejections keeps its single message row
  // (fetch-error / 'No strategies available', existing strings) as a skip.
  const rows = useMemo<TableRow[]>(() => {
    const result: TableRow[] = [];
    const skipRowBase = (detail: TickerDetail, comp: { score: number; direction: string }) => ({
      detail,
      card: null,
      cardKey: '',
      symbol: detail.symbol,
      score: comp.score,
      direction: comp.direction,
      legsText: '',
      entryText: '—',
      maxProfit: null,
      maxLoss: null,
      winPct: null,
      popMethod: 'delta_approx' as const,
      ev: null,
      evPerRisk: null,
      riskReward: null,
      dte: null,
      hasWideSpread: false,
      verdict: 'skip' as const,
    });
    for (const detail of results) {
      const cards = detail.trade_cards ?? [];
      const comp = detail.scores.composite;
      const rejections = detail._rejection_reasons || rejectionMap?.[detail.symbol] || [];
      if (cards.length === 0 && rejections.length === 0) {
        // Ticker with no strategies and no stored rejections — single skip
        // row carrying the existing message string.
        result.push({
          ...skipRowBase(detail, comp),
          id: `${detail.symbol}|__none__`,
          strategyName: '',
          skipReason: detail._fetch_errors?.chain_fetch || 'No strategies available',
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
            verdict: 'trade' as const,
          });
        }
        // RESULTS-ANATOMY: the ticker's stored rejections render as SKIP
        // rows beneath its trade rows — the reason string verbatim from
        // state ({strategy, reason}, RejectionReason).
        rejections.forEach((rej, i) => {
          result.push({
            ...skipRowBase(detail, comp),
            id: `${detail.symbol}|skip|${rej.strategy}|${i}`,
            strategyName: rej.strategy,
            skipReason: rej.reason,
          });
        });
      }
    }
    return result;
  }, [results, rejectionMap]);

  // RESULTS-ANATOMY: the derived tally, reported upward for the results
  // kicker ("N TRADE · M SKIP") — counts of the rows built above, nothing
  // separately computed.
  const tradeCount = useMemo(() => rows.filter((r) => r.verdict === 'trade').length, [rows]);
  const skipCount = rows.length - tradeCount;
  useEffect(() => {
    onTally?.({ trade: tradeCount, skip: skipCount });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tradeCount, skipCount]);

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
        <span className="text-text-secondary">|</span>
        <button onClick={deselectAll} className="text-[10px] text-brand-purple hover:text-brand-purple-hover font-medium">Deselect All</button>
        {selectedCount > 0 && (
          <span className="text-[10px] text-text-faint font-mono">{selectedCount} selected</span>
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
      <div className="overflow-x-auto rounded border border-border overflow-y-auto">
        <table className="w-full text-xs" style={{ minWidth: 900 }}>
          {/* RESULTS-ANATOMY (mock 1A "02 / RESULTS"): the six mapped columns
              — TICKER · STRATEGY · PREMIUM · POP · EV · VERDICT (+ the
              functional checkbox column, unchanged wiring). The demoted
              top-level columns (X, Score, Direction, Legs, Max P/L, EV/Risk,
              R:R, DTE) all still render in the expanded chapter beneath each
              row — nothing removed from the organ, only from the candidate
              row. Sort survives on the four mapped sortable fields. */}
          <thead className="sticky top-0 z-10">
            <tr className="bg-bg-row">
              <th className="px-2 py-2 w-8">{/* checkbox col */}</th>
              <th className={thBase + ' text-left'} onClick={() => toggleSort('symbol')}>Ticker{sortIndicator('symbol')}</th>
              <th className={thBase + ' text-left'} onClick={() => toggleSort('strategyName')}>Strategy{sortIndicator('strategyName')}</th>
              <th className={thBase + ' text-right'}>Premium</th>
              <th className={thBase + ' text-right'} onClick={() => toggleSort('winPct')} title="Estimated Probability of Profit — N(d2) at breakeven when available, delta approximation otherwise. Actual results will vary.">PoP{sortIndicator('winPct')}</th>
              <th className={thBase + ' text-right'} onClick={() => toggleSort('ev')} title="Expected Value — estimated profit/loss per trade using three-outcome model">EV{sortIndicator('ev')}</th>
              <th className={thBase + ' text-left'}>Verdict</th>
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
                  {/* RESULTS-ANATOMY: selected row wears the lane-A
                      purple-wash idiom (the deck table / FlightPickerView
                      selected-row precedent); queued keeps its existing
                      real-flag markers (savedCards left border + ✓). */}
                  <tr
                    className={`transition-colors cursor-pointer hover:bg-brand-purple-wash/40 ${isQueued ? 'bg-status-success/10' : ''} ${isSelected ? 'bg-brand-purple-wash/40' : ''}`}
                    style={{
                      borderLeft: isSelected ? '2px solid rgb(var(--ts-purple))' : isQueued ? '2px solid rgb(var(--ts-success))' : '2px solid transparent',
                    }}
                  >
                    {/* Checkbox */}
                    <td className="px-2 py-2 text-center" onClick={e => e.stopPropagation()}>
                      {row.card === null ? null : isQueued ? (
                        <span className="text-brand-green text-sm">&#10003;</span>
                      ) : isSaving ? (
                        <span className="inline-block w-3 h-3 border-2 border-text-muted border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(row.id)}
                          className="w-3.5 h-3.5 rounded border-border text-brand-purple focus:ring-0 focus:ring-offset-0 cursor-pointer"
                        />
                      )}
                    </td>
                    {/* TICKER */}
                    <td className="px-2 py-2 font-mono font-bold text-brand-purple" onClick={() => toggleRow(row.id)}>
                      {row.symbol}
                    </td>
                    {/* STRATEGY */}
                    <td className="px-2 py-2 text-text-secondary" onClick={() => toggleRow(row.id)}>
                      {row.strategyName || <span className="text-text-muted italic">—</span>}
                      {row.hasWideSpread && (
                        <span className="ml-1 text-status-warning cursor-help" title="Bid/ask estimated from theoretical price — actual market spread may differ">&#x26A0;</span>
                      )}
                    </td>
                    {/* PREMIUM (the existing entryText — Collect/Pay) */}
                    <td className="px-2 py-2 text-right font-mono text-text-faint" onClick={() => toggleRow(row.id)}>
                      {row.entryText}
                    </td>
                    {/* PoP — TRADE-UX-1: the dossier anchor leads the row.
                        Same field/format, strongest-cell weight kept. */}
                    <td
                      className="px-2 py-2 text-right font-mono text-sm font-black text-text-primary"
                      onClick={() => toggleRow(row.id)}
                      title={row.popMethod === 'breakeven_d2'
                        ? 'PoP via N(d2) at breakeven price'
                        : 'PoP estimated from option deltas (approximate)'}
                    >
                      {fmtPct(row.winPct)}
                    </td>
                    {/* EV */}
                    <td className={`px-2 py-2 text-right font-mono ${row.ev == null ? 'text-text-muted' : row.ev > 0 ? 'text-brand-green' : row.ev < 0 ? 'text-brand-red' : 'text-text-muted'}`} onClick={() => toggleRow(row.id)}>
                      {row.ev != null ? `${row.ev >= 0 ? '+' : ''}$${Math.round(row.ev)}` : '—'}
                    </td>
                    {/* VERDICT — TRADE ⇐ real card; SKIP ⇐ the STORED reason,
                        rendered verbatim (uppercased presentation only).
                        QUEUED TO LAB ⇐ the real savedCards flag. */}
                    <td className="px-2 py-2" onClick={() => toggleRow(row.id)}>
                      <span className="inline-flex flex-wrap items-center gap-1.5">
                        {row.verdict === 'trade' ? (
                          <span className="rounded bg-brand-purple px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-wider text-white">TRADE</span>
                        ) : (
                          <span className="rounded border border-border bg-bg-row px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-wider text-text-muted">SKIP</span>
                        )}
                        {row.verdict === 'skip' && row.skipReason && (
                          <span className="font-mono text-[9px] tracking-wider text-text-faint">{row.skipReason.toUpperCase()}</span>
                        )}
                        {isQueued && (
                          <span className="font-mono text-[9px] tracking-wider text-brand-green">● QUEUED TO LAB</span>
                        )}
                      </span>
                    </td>
                  </tr>

                  {/* Error row */}
                  {error && (
                    <tr className="bg-red-50">
                      <td colSpan={7} className="px-4 py-1 text-[10px] text-brand-red">
                        Failed to save: {error}
                      </td>
                    </tr>
                  )}

                  {/* Expanded detail row */}
                  {isExpanded && (
                    <tr>
                      <td colSpan={7} className="bg-white p-0">
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
