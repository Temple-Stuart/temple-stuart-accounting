'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import ScannerResultsTable from './ScannerResultsTable';
import FilterPanel from './FilterPanel';
import { countActiveFilters } from './FilterPanel';
import type { ScannerFilters } from '@/lib/convergence/filter-types';
import { DEFAULT_FILTERS } from '@/lib/convergence/filter-types';
import { applyFilters, describeActiveFilters } from '@/lib/convergence/filter-engine';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';

/* ===================================================================
   ConvergenceIntelligence — unified market intelligence dashboard
   Replaces both ConvergenceDashboard and ConvergenceAnalyzer.
   Uses shared design tokens and UI primitives.
   =================================================================== */

// ── Batch scan types (from /api/ai/convergence-synthesis) ───────────

interface RankedRow {
  rank: number;
  symbol: string;
  composite: number;
  vol_edge: number;
  quality: number;
  regime: number;
  info_edge: number;
  convergence: string;
  direction: string;
  strategy: string;
  sector: string | null;
  ivp: number | null;
}

interface PipelineSummary {
  total_universe: number;
  after_hard_filters: number;
  pre_scored: number;
  scored: number;
  final_9: string[];
  pipeline_runtime_ms: number;
  timestamp: string;
}

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

interface BatchResponse {
  pipeline_summary: PipelineSummary;
  top_9: RankedRow[];
  social_sentiment?: Record<string, SocialSentimentData>;
  rejection_reasons?: Record<string, RejectionReason[]>;
  timing: { pipeline_ms: number; ai_ms: number; total_ms: number };
}

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

interface Headline {
  datetime: number;
  headline: string;
  source: string;
  sentiment: string;
}

// ── Helpers ──────────────────────────────────────────────────────────

function gradeColor(s: number): string {
  if (s >= 70) return 'text-brand-green';
  if (s >= 50) return 'text-brand-amber';
  return 'text-brand-red';
}

function gradeColorHex(s: number): string {
  if (s >= 70) return '#16a34a';
  if (s >= 50) return '#d97706';
  return '#c53030';
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

function gateLabel(n: number): { text: string; variant: 'success' | 'warning' | 'danger' } {
  if (n >= 4) return { text: 'FULL POSITION', variant: 'success' };
  if (n >= 3) return { text: 'HALF SIZE', variant: 'warning' };
  return { text: 'NO TRADE', variant: 'danger' };
}

function statExplain(key: string, val: number | string | null): string {
  if (val == null) return '';
  const n = typeof val === 'number' ? val : parseFloat(String(val));
  if (isNaN(n)) return '';
  switch (key) {
    case 'iv_rank': return n > 70 ? 'options more expensive than most of past year' : n > 40 ? 'options at moderate prices' : 'options are cheap vs. past year';
    case 'iv_percentile': return `priced higher than ${n.toFixed(0)}% of past year`;
    case 'beta': return n > 1.2 ? 'moves more than the market' : n > 0.8 ? 'moves roughly with the market' : 'less volatile than the market';
    case 'spy_correlation': return n > 0.7 ? 'strongly follows the S&P 500' : n > 0.4 ? 'somewhat follows the market' : 'marches to its own beat';
    case 'liquidity_rating': return n >= 4 ? 'easy to get in and out' : n >= 3 ? 'decent liquidity' : 'may be hard to fill';
    case 'pe_ratio': return n > 40 ? 'high valuation — growth priced in' : n > 15 ? 'moderate valuation' : 'cheap on earnings';
    case 'buzz_ratio': return n > 2 ? 'much more coverage than normal' : n > 1 ? 'normal coverage' : 'below-average attention';
    case 'sentiment_momentum': return n > 20 ? 'sentiment improving recently' : n < -20 ? 'sentiment declining' : 'stable sentiment';
    default: return '';
  }
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// ── Score Bar ───────────────────────────────────────────────────────

function ScoreBar({ label, score }: { label: string; score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 text-[10px] font-medium text-text-muted text-right shrink-0">{label}</div>
      <div className="flex-1 h-3.5 rounded-full overflow-hidden bg-bg-row">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(score, 100)}%`, background: gradeColorHex(score) }} />
      </div>
      <div className={`w-10 text-xs font-mono font-bold text-right shrink-0 ${gradeColor(score)}`}>{score.toFixed(1)}</div>
    </div>
  );
}

// ── Ticker Chapter (mini-pipeline deep dive + TickerCard) ───────────

function PriceSourceBadge({ source }: { source: string }) {
  const colors: Record<string, string> = {
    live: 'text-brand-green',
    theo: 'text-brand-amber',
    mixed: 'text-blue-500',
    none: 'text-brand-red',
  };
  return <span className={`font-bold ${colors[source] ?? 'text-text-muted'}`}>{source}</span>;
}

// Build a unique key for a trade card: symbol|strategy|expiration|sorted_strikes
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildCardKey(symbol: string, strategyName: string, expiration?: string | null, legs?: any[] | null): string {
  const strikes = (legs ?? []).map((l: { strike?: number }) => l.strike).filter((s): s is number => s != null).sort((a, b) => a - b).join(',');
  return `${symbol}|${strategyName}|${expiration ?? ''}|${strikes}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function TickerChapter({ detail, sentiment, savedCards, savingCards, saveErrors, onSave, onRemove, pipelineProgress }: {
  detail: TickerDetail;
  sentiment?: SocialSentimentData;
  savedCards: Map<string, string>;
  savingCards: Set<string>;
  saveErrors: Map<string, string>;
  onSave: (detail: TickerDetail, card: TradeCardData, sentiment?: SocialSentimentData) => Promise<void>;
  onRemove: (cardKey: string, savedId: string) => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pipelineProgress: Record<string, any>;
}) {
  const sym = detail.symbol;

  // Section 1: ranking data from step_k
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rankings: any[] = pipelineProgress?.step_k?.data?.rankings ?? [];
  const rankIdx = rankings.findIndex((r: { symbol: string }) => r.symbol === sym);
  const rankRow = rankIdx >= 0 ? rankings[rankIdx] : null;

  // Section 2: chain fetch data from step_n
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jTickers: any[] = pipelineProgress?.step_n?.data?.tickers ?? [];
  const jRow = jTickers.find((t: { symbol: string }) => t.symbol === sym) ?? null;

  // Section 3: strategy scoring from step_p
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const kTickers: any[] = pipelineProgress?.step_p?.data?.tickers ?? [];
  const kRow = kTickers.find((t: { symbol: string }) => t.symbol === sym) ?? null;

  const sectionHeader = 'text-[10px] uppercase tracking-wider font-bold text-brand-purple mb-1.5 mt-3';
  const labelStyle = 'text-[11px] text-text-muted';
  const valueStyle = 'text-[11px] font-mono text-text-primary';
  const gateScore = (v: number) => v >= 50 ? 'text-brand-green font-bold' : 'text-brand-red font-bold';
  const loadingMsg = (msg: string) => <div className="text-[11px] text-text-faint italic">{msg}</div>;

  return (
    <div>
      {/* Mini-pipeline panel */}
      <div className="bg-bg-terminal rounded-t border border-border px-5 py-4 font-mono">
        <div className="text-sm font-black text-text-primary">{sym} — DEEP DIVE</div>
        <div className="text-[10px] text-text-faint mt-0.5">
          How this ticker traveled through the pipeline and why this trade was selected
        </div>

        {/* SECTION 1 — WHY THIS TICKER */}
        <div className={sectionHeader}>WHY THIS TICKER</div>
        {rankRow ? (
          <div className="space-y-0.5">
            <div className={labelStyle}>
              Composite Score: <span className={valueStyle}>{rankRow.composite?.toFixed?.(1) ?? rankRow.composite}</span>
              {' — '}ranked <span className={valueStyle}>#{rankIdx + 1}</span> of all scored tickers
            </div>
            <div className={labelStyle}>
              Gates:{' '}
              <span className={`font-mono ${gateScore(rankRow.vol_edge)}`}>{rankRow.vol_edge?.toFixed?.(1) ?? rankRow.vol_edge}</span> Vol Edge{' · '}
              <span className={`font-mono ${gateScore(rankRow.quality)}`}>{rankRow.quality?.toFixed?.(1) ?? rankRow.quality}</span> Quality{' · '}
              <span className={`font-mono ${gateScore(rankRow.regime)}`}>{rankRow.regime?.toFixed?.(1) ?? rankRow.regime}</span> Regime{' · '}
              <span className={`font-mono ${gateScore(rankRow.info_edge)}`}>{rankRow.info_edge?.toFixed?.(1) ?? rankRow.info_edge}</span> Info Edge
            </div>
            <div className={labelStyle}>
              Sector: <span className={valueStyle}>{rankRow.sector ?? '—'}</span>
            </div>
            <div className={labelStyle}>
              Direction: <span className={valueStyle}>{rankRow.direction ?? '—'}</span>
            </div>
            <div className={labelStyle}>
              Selection: <span className={valueStyle}>{rankRow.selection_status ?? '—'}</span>
            </div>
          </div>
        ) : loadingMsg('Pipeline data loading...')}

        {/* SECTION 2 — CHAIN FETCH (STEP N) */}
        <div className={sectionHeader}>CHAIN FETCH (STEP N)</div>
        {jRow ? (
          <div className="space-y-1">
            <div className={labelStyle}>
              Expirations evaluated: <span className={valueStyle}>{jRow.expirationsEvaluated ?? '—'}</span>
            </div>
            <div className={labelStyle}>
              Winning expiration: <span className={valueStyle}>{jRow.winningExpiration ?? jRow.expiration ?? '—'}</span>
              {' · '}<span className={valueStyle}>{jRow.winningDte ?? jRow.dte ?? '—'} DTE</span>
            </div>
            <div className={labelStyle}>
              Strikes fetched: <span className={valueStyle}>{jRow.strikeCount ?? '—'}</span>
            </div>
            <div className={labelStyle}>
              Price source: <PriceSourceBadge source={jRow.priceSource ?? 'none'} />
            </div>
            {jRow.allExpirations && jRow.allExpirations.length > 0 && (
              <div className="mt-1.5 overflow-x-auto">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="text-text-muted uppercase tracking-wider">
                      <th className="text-left font-medium py-0.5 pr-3">Expiration</th>
                      <th className="text-right font-medium py-0.5 pr-3">DTE</th>
                      <th className="text-right font-medium py-0.5 pr-3">Strikes</th>
                      <th className="text-right font-medium py-0.5 pr-3">Strategies Built</th>
                      <th className="text-right font-medium py-0.5">Best Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {jRow.allExpirations.map((exp: any, i: number) => {
                      const isWinner = exp.expiration === (jRow.winningExpiration ?? jRow.expiration);
                      return (
                        <tr key={i} className={isWinner ? 'bg-amber-50/50' : ''} style={isWinner ? { borderLeft: '2px solid #d97706' } : {}}>
                          <td className={`py-0.5 pr-3 font-mono ${isWinner ? 'text-brand-amber font-bold' : 'text-text-faint'}`}>{exp.expiration}</td>
                          <td className="py-0.5 pr-3 text-right font-mono text-text-faint">{exp.dte}</td>
                          <td className="py-0.5 pr-3 text-right font-mono text-text-faint">{exp.strikeCount}</td>
                          <td className="py-0.5 pr-3 text-right font-mono text-text-faint">{exp.strategiesBuilt}</td>
                          <td className={`py-0.5 text-right font-mono ${exp.bestScore != null ? (isWinner ? 'text-brand-amber font-bold' : 'text-text-faint') : 'text-text-muted'}`}>
                            {exp.bestScore != null ? exp.bestScore.toFixed(3) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : loadingMsg('Chain data loading...')}

        {/* SECTION 3 — STRATEGY SCORING (STEP P) */}
        <div className={sectionHeader}>STRATEGY SCORING (STEP P)</div>
        {kRow ? (
          <div className="space-y-0.5">
            <div className={labelStyle}>
              Strategies built: <span className={valueStyle}>{kRow.strategiesBuilt ?? '—'}</span>
            </div>
            <div className={labelStyle}>
              {'Gate A failed (EV \u2264 0): '}<span className={valueStyle}>{kRow.gateAFailed ?? '—'}</span>
            </div>
            <div className={labelStyle}>
              {'Gate B failed (PoP floor): '}<span className={valueStyle}>{kRow.gateBFailed ?? '—'}</span>
            </div>
            <div className={labelStyle}>
              {'Gate C failed (min credit): '}<span className={valueStyle}>{kRow.gateCFailed ?? '—'}</span>
            </div>
            <div className={labelStyle}>
              Strategies passed:{' '}
              <span className={`font-mono font-bold ${(kRow.strategiesPassed ?? 0) > 0 ? 'text-brand-green' : 'text-brand-red'}`}>
                {kRow.strategiesPassed ?? 0}
              </span>
            </div>
            <div className={labelStyle}>
              Winner:{' '}
              <span className={`font-mono font-bold ${kRow.winner ? 'text-brand-green' : 'text-brand-red'}`}>
                {kRow.winner ?? 'none'}
              </span>
            </div>
            <div className={labelStyle}>
              Winning score: <span className={valueStyle}>{kRow.winnerScore != null ? kRow.winnerScore.toFixed(3) : '—'}</span>
              <span className="text-[9px] text-text-faint ml-1">(EV/Risk × 50% + Theta Efficiency × 30% + Edge Ratio × 20%)</span>
            </div>
          </div>
        ) : loadingMsg('Strategy data loading...')}

        {/* SECTION 4 — THE TRADE */}
        <div className={sectionHeader}>THE TRADE</div>
        <div className="text-[11px] text-text-faint">
          The full trade breakdown is shown below — every number sourced from the chain fetch and strategy scoring above.
        </div>
        <div className="mt-2 border-t border-border/50" />
      </div>

      {/* Terminal-style trade card */}
      <TerminalTradeCard
        detail={detail}
        sentiment={sentiment}
        savedCards={savedCards}
        savingCards={savingCards}
        saveErrors={saveErrors}
        onSave={onSave}
        onRemove={onRemove}
      />
    </div>
  );
}

// ── Terminal Trade Card ─────────────────────────────────────────────

function termBar(score: number, width = 10): string {
  const filled = Math.round((Math.min(Math.max(score, 0), 100) / 100) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function termGateColor(score: number): string {
  return score >= 50 ? 'text-green-400' : 'text-red-400';
}

function termTruncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

export function TerminalTradeCard({ detail, sentiment, savedCards, savingCards, saveErrors, onSave, onRemove }: {
  detail: TickerDetail;
  sentiment?: SocialSentimentData;
  savedCards: Map<string, string>;
  savingCards: Set<string>;
  saveErrors: Map<string, string>;
  onSave: (detail: TickerDetail, card: TradeCardData, sentiment?: SocialSentimentData) => Promise<void>;
  onRemove: (cardKey: string, savedId: string) => Promise<void>;
}) {
  const comp = detail.scores.composite;
  const cards = detail.trade_cards ?? [];
  const headlines: Headline[] = detail.scores.info_edge?.breakdown?.news_sentiment?.news_detail?.headlines?.slice(0, 3) ?? [];
  const ks = cards[0]?.key_stats;
  const why = cards[0]?.why;

  const divider = <div className="border-t border-gray-700 my-1" />;

  // ── Shared sections (rendered for both trade and no-trade cases) ──

  const renderForAgainst = (cardWhy: TradeCardWhy | undefined) => {
    const forItems: string[] = [];
    const againstItems: string[] = [];

    if (cardWhy) {
      forItems.push(...cardWhy.plain_english_signals);
    }
    if (sentiment && !sentiment.error && sentiment.score > 0.2) {
      forItems.push(`Social +${sentiment.score.toFixed(2)} bullish (${sentiment.postCount} posts)`);
    }
    if (ks?.earnings_pattern && ks.earnings_pattern.beat_rate != null && ks.earnings_pattern.beat_rate > 60) {
      forItems.push(`Beat rate ${ks.earnings_pattern.beat_rate}%${ks.earnings_pattern.sue_score != null ? ` · SUE ${ks.earnings_pattern.sue_score}` : ''}`);
    }

    if (cardWhy) {
      againstItems.push(...cardWhy.risk_flags);
    }
    if (sentiment && !sentiment.error && sentiment.score < -0.2) {
      againstItems.push(`Social ${sentiment.score.toFixed(2)} bearish`);
    }
    if (comp.category_scores.regime < 40) {
      againstItems.push(`Weak regime ${comp.category_scores.regime.toFixed(1)}`);
    }
    const gateNames: [string, number][] = [
      ['Vol Edge', comp.category_scores.vol_edge],
      ['Quality', comp.category_scores.quality],
      ['Regime', comp.category_scores.regime],
      ['Info Edge', comp.category_scores.info_edge],
    ];
    for (const [name, score] of gateNames) {
      if (score < 40 && !(name === 'Regime' && comp.category_scores.regime < 40)) {
        againstItems.push(`${name} gate weak ${score.toFixed(1)}`);
      }
    }

    return (
      <div>
        <div className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-1">For vs Against</div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-[10px] text-green-400 font-bold mb-0.5">FOR THE TRADE</div>
            {forItems.length > 0 ? forItems.map((s, i) => (
              <div key={i} className="text-xs text-green-400 leading-relaxed">&#10003; {s}</div>
            )) : (
              <div className="text-xs text-gray-500">No bullish signals found</div>
            )}
          </div>
          <div>
            <div className="text-[10px] text-red-400 font-bold mb-0.5">AGAINST THE TRADE</div>
            {againstItems.length > 0 ? againstItems.map((s, i) => (
              <div key={i} className="text-xs text-red-400 leading-relaxed">&#10007; {s}</div>
            )) : (
              <div className="text-xs text-green-400">No risk flags</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderGateBars = () => {
    const gates: [string, number][] = [
      ['VOL EDGE', comp.category_scores.vol_edge],
      ['QUALITY', comp.category_scores.quality],
      ['REGIME', comp.category_scores.regime],
      ['INFO', comp.category_scores.info_edge],
    ];
    return (
      <div>
        <div className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-1">Gate Scores</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
          {gates.map(([label, score]) => (
            <div key={label} className="flex items-center gap-1">
              <span className="w-16 text-xs text-gray-400 shrink-0">{label}</span>
              <span className={`text-xs font-bold w-8 text-right ${termGateColor(score)}`}>{score.toFixed(1)}</span>
              <span className={`text-xs font-mono ${termGateColor(score)}`}>{termBar(score)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderVolDetail = () => {
    const bd = detail.scores?.vol_edge?.breakdown;
    if (!bd) return null;
    const subs: [string, number, string | null][] = [
      ['MISPRICING', bd.mispricing?.score ?? 0, null],
      ['TERM STRUCT', bd.term_structure?.score ?? 0, bd.term_structure?.shape ?? null],
      ['TECHNICALS', bd.technicals?.score ?? 0, null],
      ['SKEW', bd.skew?.score ?? 0, bd.skew?.skew_direction ?? null],
      ['GEX', bd.gex?.score ?? 0, bd.gex?.gex_regime ?? null],
    ];
    const vrpZ = bd.mispricing?.z_scores?.vrp_z;
    return (
      <div>
        <div className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-1">Vol Detail</div>
        <div className="grid grid-cols-3 gap-x-3 gap-y-0.5">
          {subs.map(([label, score, extra]) => (
            <div key={label} className="flex items-center gap-1">
              <span className="text-xs text-gray-400">{label}</span>
              <span className={`text-xs font-bold ${score >= 50 ? 'text-green-400' : 'text-red-400'}`}>{Math.round(score)}</span>
              {extra && <span className="text-xs text-gray-500">{extra}</span>}
            </div>
          ))}
        </div>
        {vrpZ != null && (
          <div className="text-xs text-gray-400 mt-0.5">
            VRP z: <span className={vrpZ > 0.5 ? 'text-green-400' : vrpZ < -0.5 ? 'text-red-400' : 'text-gray-400'}>{vrpZ >= 0 ? '+' : ''}{vrpZ.toFixed(1)}</span>
          </div>
        )}
        {ks && (
          <div className="text-xs text-gray-400 mt-0.5">
            IV RANK {ks.iv_rank != null ? ks.iv_rank.toFixed(2) : '—'} · IV {ks.iv30 != null ? `${ks.iv30.toFixed(1)}%` : '—'} · HV30 {ks.hv30 != null ? `${ks.hv30.toFixed(1)}%` : '—'}{ks.iv_hv_spread != null ? ` · VRP ${ks.iv_hv_spread > 0 ? '+' : ''}${ks.iv_hv_spread.toFixed(1)}%` : ''}
          </div>
        )}
        {ks?.vol_cone && (
          <div className="text-xs text-gray-500 mt-0.5">
            VOL CONE: {[
              ks.vol_cone.hv10 != null && `HV10 ${ks.vol_cone.hv10}%`,
              ks.vol_cone.hv20 != null && `HV20 ${ks.vol_cone.hv20}%`,
              ks.vol_cone.hv30 != null && `HV30 ${ks.vol_cone.hv30}%`,
              ks.vol_cone.hv60 != null && `HV60 ${ks.vol_cone.hv60}%`,
              ks.vol_cone.hv90 != null && `HV90 ${ks.vol_cone.hv90}%`,
            ].filter(Boolean).join(' · ')}{ks.vol_cone.current_iv != null ? ` vs IV ${ks.vol_cone.current_iv}%` : ''}
          </div>
        )}
        {ks?.forward_vol && (
          <div className="text-xs text-gray-500 mt-0.5">
            FWD VOL {ks.forward_vol.forward_iv}% ({ks.forward_vol.from_dte}→{ks.forward_vol.to_dte}d){ks.vol_cone?.current_iv != null ? ` vs spot IV ${ks.vol_cone.current_iv}%` : ''}
          </div>
        )}
      </div>
    );
  };

  const renderCompanyMacro = () => {
    const rs = detail.scores?.regime?.breakdown?.regime_scores;
    const dom = detail.scores?.regime?.breakdown?.dominant_regime;
    return (
      <div>
        <div className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-1">Company &amp; Macro</div>
        {ks && (
          <>
            <div className="text-xs text-gray-400">
              P/E {ks.pe_ratio != null ? ks.pe_ratio.toFixed(1) : '—'} · CAP {fmtMcap(ks.market_cap)} · BETA {ks.beta != null ? ks.beta.toFixed(2) : '—'} · SPY CORR {ks.spy_correlation != null ? ks.spy_correlation.toFixed(2) : '—'} · LIQ {ks.liquidity_rating != null ? `${ks.liquidity_rating}/5` : '—'} · BORROW {ks.borrow_rate != null ? `${ks.borrow_rate.toFixed(1)}%` : '—'} {ks.lendability ?? ''}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              EARNINGS {ks.earnings_date ?? '—'}{ks.days_to_earnings != null && ks.days_to_earnings > 0 ? ` (${ks.days_to_earnings}d away)` : ''}{ks.earnings_pattern ? ` · BEAT ${ks.earnings_pattern.beat_rate ?? '—'}% (${ks.earnings_pattern.total_quarters}Q)${ks.earnings_pattern.sue_score != null ? ` · SUE ${ks.earnings_pattern.sue_score}` : ''}${ks.earnings_pattern.streak ? ` · ${ks.earnings_pattern.streak}` : ''}` : ''}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              DIV YIELD {ks.dividend_yield != null ? `${ks.dividend_yield.toFixed(2)}%` : '—'} · IV %ILE {ks.iv_percentile != null ? ks.iv_percentile.toFixed(1) : '—'}
            </div>
          </>
        )}
        {rs && (
          <div className="text-xs text-gray-400 mt-0.5">
            REGIME: <span className="text-yellow-400 font-bold">{dom?.toUpperCase()}</span> Goldilocks {Math.round(rs.goldilocks * 100)}% Reflation {Math.round(rs.reflation * 100)}% Stagflation {Math.round(rs.stagflation * 100)}% Deflation {Math.round(rs.deflation * 100)}%
          </div>
        )}
        {why?.regime_context && (
          <div className="text-xs text-gray-500 mt-0.5">{why.regime_context}</div>
        )}
      </div>
    );
  };

  const renderInfoSignals = () => {
    const ie = detail.scores?.info_edge;
    const bd = ie?.breakdown;
    const mspr = bd?.insider_activity?.insider_detail?.latest_mspr;
    const newsScore = bd?.news_sentiment?.score;
    const instOwners = bd?.institutional_ownership?.indicators?.total_holders;
    return (
      <div>
        <div className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-1">Info Signals</div>
        <div className="text-xs text-gray-400">
          ANALYSTS: {ks?.analyst_consensus ?? '—'} · INSIDER MSPR: {mspr != null ? mspr.toFixed(2) : '—'} · NEWS SENTIMENT: {newsScore != null ? newsScore.toFixed(1) : '—'} · INST OWNERS: {instOwners ?? '—'} · BUZZ: {ks?.buzz_ratio != null ? `${ks.buzz_ratio.toFixed(1)}x` : '—'} · TREND: {ks?.sentiment_momentum != null ? ks.sentiment_momentum.toFixed(0) : '—'}
        </div>
        {sentiment && !sentiment.error && sentiment.postCount > 0 && (
          <>
            <div className="text-xs mt-0.5">
              <span className="text-gray-400">SOCIAL: </span>
              <span className={sentiment.score > 0.2 ? 'text-green-400 font-bold' : sentiment.score < -0.2 ? 'text-red-400 font-bold' : 'text-gray-400 font-bold'}>
                {sentiment.score > 0 ? '+' : ''}{sentiment.score.toFixed(2)}
              </span>
              <span className="text-gray-500"> · {sentiment.postCount} posts · {sentiment.bullishCount}B/{sentiment.bearishCount}Be/{sentiment.neutralCount}N · AGE: {sentiment.dataAge}</span>
            </div>
            {sentiment.themes.length > 0 && (
              <div className="text-xs text-gray-500 mt-0.5">THEMES: {sentiment.themes.join(' · ')}</div>
            )}
            {sentiment.samplePosts && sentiment.samplePosts.length > 0 && (
              <div className="mt-0.5">
                {sentiment.samplePosts.slice(0, 2).map((post, i) => (
                  <div key={i} className="text-xs text-gray-500 truncate">&ldquo;{termTruncate(post.text, 80)}&rdquo; — {post.sentiment}</div>
                ))}
              </div>
            )}
          </>
        )}
        {sentiment?.error && (
          <div className="text-xs text-gray-500 mt-0.5">SOCIAL: unavailable — {sentiment.error}</div>
        )}
        {!sentiment && (
          <div className="text-xs text-gray-500 mt-0.5">SOCIAL: xAI data not loaded</div>
        )}
        {sentiment && !sentiment.error && sentiment.postCount === 0 && (
          <div className="text-xs text-gray-500 mt-0.5">SOCIAL: 0 posts found</div>
        )}
        {/* Magnitude + data age always shown if available */}
        {sentiment && !sentiment.error && sentiment.postCount > 0 && (
          <div className="text-xs text-gray-500 mt-0.5">MAGNITUDE: {sentiment.magnitude.toFixed(2)}</div>
        )}
      </div>
    );
  };

  const renderHeadlines = () => {
    if (headlines.length === 0) return null;
    return (
      <div>
        <div className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-1">Headlines</div>
        {headlines.map((h, i) => {
          const color = h.sentiment === 'bullish' ? 'text-green-400' : h.sentiment === 'bearish' ? 'text-red-400' : 'text-gray-400';
          return (
            <div key={i} className="text-xs text-gray-400">
              <span className={`font-bold ${color}`}>[{h.sentiment.toUpperCase()}]</span> &ldquo;{termTruncate(h.headline, 70)}&rdquo; <span className="text-gray-500">{h.source}</span>
            </div>
          );
        })}
      </div>
    );
  };

  // ── No-strategy case ──

  if (cards.length === 0) {
    return (
      <div className="bg-[#1a1a2e] rounded border border-gray-700 font-mono text-xs p-4">
        {/* Header */}
        <div className="text-gray-100">
          <span className="font-bold">{detail.symbol}</span>
          <span className="text-gray-400"> · Score </span>
          <span className={termGateColor(comp.score)}>{comp.score.toFixed(1)} {letterGrade(comp.score)}</span>
          <span className="text-gray-400"> · {comp.categories_above_50}/4 gates · {comp.direction}</span>
        </div>
        <div className="text-red-400 mt-1">No strategies passed quality gates</div>
        {detail._fetch_errors?.chain_fetch && (
          <div className="text-gray-500 mt-0.5">{detail._fetch_errors.chain_fetch}</div>
        )}
        {divider}
        {renderForAgainst(undefined)}
        {divider}
        {renderGateBars()}
        {divider}
        {renderVolDetail()}
        {divider}
        {renderCompanyMacro()}
        {divider}
        {renderInfoSignals()}
        {renderHeadlines() && <>{divider}{renderHeadlines()}</>}
      </div>
    );
  }

  // ── Trade card case ──

  return (
    <div className="space-y-2">
      {cards.map((card, ci) => {
        const cardKey = buildCardKey(detail.symbol, card.setup.strategy_name, card.setup.expiration_date, card.setup.legs);
        const savedId = savedCards.get(cardKey);
        const saving = savingCards.has(cardKey);
        const error = saveErrors.get(cardKey);

        // Kelly calc
        const winRate = card.setup.hv_pop ?? card.setup.probability_of_profit ?? 0;
        const ratio = (card.setup.max_profit != null && card.setup.max_loss != null && card.setup.max_loss !== 0)
          ? card.setup.max_profit / card.setup.max_loss : 0;
        const rawKelly = ratio > 0 ? (winRate * ratio - (1 - winRate)) / ratio : 0;
        const kellyPct = Math.round(Math.max(0, rawKelly * 0.25) * 1000) / 10;

        const thetaPerDay = card.setup.greeks?.theta_per_day ?? 0;
        const vegaPt = (card.setup.greeks?.vega ?? 0) * 100;

        return (
          <div key={ci} className="bg-[#1a1a2e] rounded border border-gray-700 font-mono text-xs p-4">

            {/* SECTION 1 — HEADER */}
            <div className="text-gray-100">
              <span className="font-bold">{detail.symbol}</span>
              <span className="text-gray-400"> · </span>
              <span className="text-gray-100 font-bold">{card.setup.strategy_name}</span>
              <span className="text-gray-400"> · {card.setup.expiration_date} · {card.setup.dte}DTE</span>
            </div>
            <div className="text-gray-400">
              Score <span className={termGateColor(comp.score)}>{comp.score.toFixed(1)} {letterGrade(comp.score)}</span> · {comp.categories_above_50}/4 gates · {comp.direction}{ks?.sector ? ` · ${ks.sector}` : ''}
            </div>

            {divider}

            {/* SECTION 2 — TRADE SETUP */}
            <div className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-1">Trade Setup</div>
            {card.setup.legs.map((leg, j) => (
              <div key={j} className="text-xs">
                <span className={leg.side === 'sell' ? 'text-red-400 font-bold' : 'text-green-400 font-bold'}>
                  {leg.side.toUpperCase().padEnd(4)}
                </span>
                <span className="text-gray-400"> {leg.type.toUpperCase().padEnd(4)} </span>
                <span className="text-gray-100">${leg.strike}</span>
                <span className="text-gray-500">  ${leg.price.toFixed(2)}</span>
              </div>
            ))}
            <div className="text-xs text-gray-100 mt-1">
              {card.setup.net_credit != null && card.setup.net_credit > 0
                ? <span className="text-green-400 font-bold">COLLECT ${(card.setup.net_credit * 100).toFixed(0)}</span>
                : card.setup.net_debit != null
                ? <span className="text-gray-100 font-bold">PAY ${(card.setup.net_debit * 100).toFixed(0)}</span>
                : null}
              <span className="text-gray-400"> · MAX LOSS </span>
              <span className="text-red-400">{fmtDollar(card.setup.max_loss)}</span>
              <span className="text-gray-400"> · POP </span>
              <span className="text-gray-100">{fmtPct(card.setup.probability_of_profit)}</span>
              <span className="text-gray-500"> ({card.setup.pop_method === 'breakeven_d2' ? 'N(d2)' : 'Δ approx'})</span>
              <span className="text-gray-400"> · EV </span>
              <span className={card.setup.ev >= 0 ? 'text-green-400' : 'text-red-400'}>{card.setup.ev >= 0 ? '+' : ''}${Math.round(card.setup.ev)}</span>
              <span className="text-gray-400"> · EV/RISK </span>
              <span className="text-gray-100">{card.setup.ev_per_risk.toFixed(3)}</span>
              <span className="text-gray-400"> · R:R </span>
              <span className="text-gray-100">{card.setup.risk_reward_ratio != null ? card.setup.risk_reward_ratio.toFixed(2) : '—'}</span>
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              B/E {(card.setup.breakevens?.length ?? 0) === 0 ? '—' : card.setup.breakevens.map(b => `$${b.toFixed(2)}`).join(' / ')} · HV POP {card.setup.hv_pop != null ? `${Math.round(card.setup.hv_pop * 100)}%` : '—'} · THETA <span className={thetaPerDay >= 0 ? 'text-green-400' : 'text-red-400'}>{thetaPerDay >= 0 ? '+' : ''}${thetaPerDay.toFixed(2)}/day</span> · VEGA/pt <span className={vegaPt >= 0 ? 'text-green-400' : 'text-red-400'}>{vegaPt >= 0 ? '+' : ''}${Math.abs(vegaPt).toFixed(2)}</span> · KELLY <span className={kellyPct >= 2 ? 'text-green-400' : kellyPct >= 1 ? 'text-yellow-400' : 'text-gray-400'}>{kellyPct.toFixed(1)}%</span>
            </div>
            {card.setup.has_wide_spread && (
              <div className="text-xs text-yellow-400 mt-0.5">&#x26A0; Wide bid-ask spread — prices estimated from theoretical model</div>
            )}
            {card.setup.is_unlimited_risk && (
              <div className="text-xs text-red-400 mt-0.5">&#x26A0; UNLIMITED RISK — naked short position</div>
            )}

            {divider}

            {/* SECTION 3 — FOR vs AGAINST */}
            {renderForAgainst(card.why)}

            {divider}

            {/* SECTION 4 — GATE BARS */}
            {renderGateBars()}

            {divider}

            {/* SECTION 5 — VOL DETAIL */}
            {renderVolDetail()}

            {divider}

            {/* SECTION 6 — COMPANY & MACRO */}
            {renderCompanyMacro()}

            {divider}

            {/* SECTION 7 — INFO SIGNALS */}
            {renderInfoSignals()}

            {/* SECTION 8 — HEADLINES */}
            {renderHeadlines() && <>{divider}{renderHeadlines()}</>}

            {divider}

            {/* SECTION 9 — ACTION */}
            {savedId ? (
              <div className="flex items-center justify-center gap-3 mt-1">
                <Badge variant="success" size="md">Queued &#10003;</Badge>
                <button
                  onClick={() => onRemove(cardKey, savedId)}
                  className="text-[10px] text-gray-500 hover:text-red-400 transition-colors"
                >
                  &#10005; Remove
                </button>
              </div>
            ) : saving ? (
              <div className="w-full mt-1">
                <Button variant="secondary" size="md" loading disabled className="w-full">Saving...</Button>
              </div>
            ) : (
              <div>
                <Button variant="primary" size="md" onClick={() => onSave(detail, card, sentiment)} className="w-full mt-1">Enter Trade</Button>
                {error && <div className="mt-1 px-2 py-1 rounded text-[10px] bg-red-900/50 text-red-400">Failed: {error}</div>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Ticker Card (the full card for one ticker) ─────────────────────

export function TickerCard({ detail, sentiment, savedCards, savingCards, saveErrors, onSave, onRemove }: {
  detail: TickerDetail;
  sentiment?: SocialSentimentData;
  savedCards: Map<string, string>; // key: "SYMBOL|strategy_name" → saved card ID
  savingCards: Set<string>;
  saveErrors: Map<string, string>;
  onSave: (detail: TickerDetail, card: TradeCardData, sentiment?: SocialSentimentData) => Promise<void>;
  onRemove: (cardKey: string, savedId: string) => Promise<void>;
}) {
  const comp = detail.scores.composite;
  const cards = detail.trade_cards ?? [];
  const why = cards[0]?.why;
  const ks = cards[0]?.key_stats;
  const headlines: Headline[] = detail.scores.info_edge?.breakdown?.news_sentiment?.news_detail?.headlines?.slice(0, 3) ?? [];
  const gate = gateLabel(comp.categories_above_50);

  return (
    <div className="bg-white rounded border border-border shadow-sm overflow-hidden">

      {/* A) HEADER ROW */}
      <div className="px-5 py-2 flex items-center justify-between flex-wrap gap-2 bg-brand-purple-hover">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black font-mono text-white">{detail.symbol}</span>
          <span className="text-sm font-black font-mono" style={{ color: gradeColorHex(comp.score) }} title="Convergence score 0–100. Combines Vol Edge, Quality, Regime, and Info Edge gates using z-score weighted averaging. Higher = stronger multi-signal agreement.">{comp.score.toFixed(1)}</span>
          <span className="text-terminal-lg font-black" style={{ color: gradeColorHex(comp.score) }} title="Letter grade derived from composite score. A = 80+, B = 65+, C = 50+, D = 35+, F = below 35.">{letterGrade(comp.score)}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span title="Scanner-recommended trade direction based on dominant signal alignment across all four gates."><Badge variant={dirBadgeVariant(comp.direction)} size="sm">{comp.direction}</Badge></span>
          {ks?.sector && <span title="Stock sector from market data. Useful for concentration risk — avoid over-weighting one sector."><Badge variant="default" size="sm">{ks.sector}</Badge></span>}
          <span title="Number of scoring gates above 50. All 4 gates above 50 = full position signal. Fewer gates = reduced conviction. 4/4 is required for a full position recommendation."><Badge variant={gate.variant} size="sm">
            {comp.categories_above_50}/4 {gate.text}
          </Badge></span>
        </div>
      </div>

      {/* B) SCORE BARS */}
      <div className="px-5 py-2 space-y-1.5 border-b border-border">
        <div title="Volatility Edge (0–100): measures whether options are mispriced relative to realized vol. Combines VRP z-score, IV percentile, term structure shape, skew asymmetry, and dealer gamma exposure. Above 50 = options appear expensive = edge for premium sellers."><ScoreBar label="Vol Edge" score={comp.category_scores.vol_edge} /></div>
        <div title="Quality Gate (0–100): measures the fundamental health of the underlying company. Combines Piotroski F-Score safety, profitability margins, earnings quality (accrual ratio + beat rate), and growth trajectory. Above 50 = high-quality underlying."><ScoreBar label="Quality" score={comp.category_scores.quality} /></div>
        <div title="Macro Regime Gate (0–100): measures whether the current macro environment favors the trade direction. Scored from 14 FRED macro indicators including GDP, CPI, Fed Funds, yield curve, and credit spreads. Above 50 = favorable macro backdrop."><ScoreBar label="Regime" score={comp.category_scores.regime} /></div>
        <div title="Information Edge Gate (0–100): measures signals of informed activity. Combines insider net purchase ratio (MSPR), institutional ownership changes, analyst upgrades/downgrades, SUE earnings surprise, and FinBERT news sentiment. Above 50 = positive information asymmetry."><ScoreBar label="Info Edge" score={comp.category_scores.info_edge} /></div>
      </div>

      {/* B2) SOCIAL PULSE — promoted from Key Stats */}
      {sentiment && !sentiment.error && sentiment.postCount > 0 && (
        <div className="px-5 py-2 border-b border-border bg-bg-row">
          <div className="text-[10px] text-text-muted uppercase tracking-wider font-bold mb-1">Social Pulse (xAI/Grok)</div>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span
              className={`text-lg font-bold font-mono ${sentiment.score > 0.2 ? 'text-brand-green' : sentiment.score < -0.2 ? 'text-brand-red' : 'text-text-muted'}`}
              title="Aggregate sentiment score from real X (Twitter) posts analyzed by xAI Grok. Range -1.0 (fully bearish) to +1.0 (fully bullish). Based on actual post content, not price action."
            >
              {sentiment.score > 0 ? '+' : ''}{sentiment.score.toFixed(2)}
            </span>
            <span className="text-xs text-text-faint font-mono" title="Breakdown of post sentiment classification by xAI Grok. Each post classified as bullish, bearish, or neutral based on content analysis.">
              <span title="Number of recent X/Twitter posts about this ticker analyzed by xAI Grok. Higher count = more data points = higher confidence in the sentiment reading.">{sentiment.postCount} posts</span>
              {' | '}{sentiment.bullishCount}B/{sentiment.bearishCount}b/{sentiment.neutralCount}N
            </span>
            {sentiment.themes.length > 0 && (
              <span className="flex gap-1 flex-wrap">
                {sentiment.themes.slice(0, 3).map((t, i) => (
                  <Badge key={i} variant="default" size="sm">{t}</Badge>
                ))}
              </span>
            )}
          </div>
          {sentiment.samplePosts && sentiment.samplePosts.length > 0 && (
            <div className="mt-1 space-y-0.5">
              {sentiment.samplePosts.slice(0, 2).map((post, i) => (
                <div key={i} className="text-[10px] text-text-secondary leading-relaxed truncate">&ldquo;{post.text}&rdquo;</div>
              ))}
            </div>
          )}
        </div>
      )}
      {sentiment?.error && (
        <div className="px-5 py-2 border-b border-border text-xs text-text-muted">
          Social Pulse unavailable — {sentiment.error}
        </div>
      )}
      {!sentiment && (
        <div className="px-5 py-2 border-b border-border text-xs text-text-muted">
          Social Pulse — xAI data not loaded
        </div>
      )}

      {/* C) THE TRADE */}
      {cards.length > 0 ? (
        <div className="border-b border-border">
          {cards.map((card, ci) => (
            <div key={ci} className={ci > 0 ? 'border-t border-border' : ''}>
              {/* Strategy header */}
              <div className="px-5 py-2 flex items-center justify-between bg-bg-row">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black bg-brand-purple text-white">{card.label}</span>
                  <span className="text-sm font-bold text-text-primary">{card.setup.strategy_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-text-secondary">{card.setup.expiration_date}</span>
                  <Badge variant="default" size="sm">{card.setup.dte} DTE</Badge>
                </div>
              </div>

              <div className="px-5 py-2">
                {/* Legs table */}
                <table className="w-full text-xs mb-3">
                  <thead>
                    <tr className="text-text-muted text-[10px]">
                      <th className="text-left font-medium pb-1 w-16">Action</th>
                      <th className="text-left font-medium pb-1 w-12">Type</th>
                      <th className="text-right font-medium pb-1">Strike</th>
                      <th className="text-right font-medium pb-1">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {card.setup.legs.map((leg, j) => (
                      <tr key={j}>
                        <td className={`py-0.5 font-bold ${leg.side === 'sell' ? 'text-brand-red' : 'text-brand-green'}`}>{leg.side.toUpperCase()}</td>
                        <td className="py-0.5 text-text-secondary">{leg.type.toUpperCase()}</td>
                        <td className="py-0.5 text-right font-mono font-bold text-text-primary">${leg.strike}</td>
                        <td className="py-0.5 text-right font-mono text-text-secondary">${leg.price.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Key numbers row */}
                <div className="grid grid-cols-5 gap-3 mb-2">
                  <div className="text-center">
                    <div className="text-[9px] text-text-muted uppercase">Max Profit</div>
                    <div className="text-sm font-mono font-black text-brand-green">{fmtDollar(card.setup.max_profit)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[9px] text-text-muted uppercase">Max Loss</div>
                    <div className="text-sm font-mono font-black text-brand-red">{fmtDollar(card.setup.max_loss)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[9px] text-text-muted uppercase" title={card.setup.pop_method === 'breakeven_d2' ? 'PoP via N(d2) at breakeven price — the standard Black-Scholes probability that the underlying closes beyond the breakeven price at expiration. More accurate than delta approx.' : 'PoP estimated from option deltas — quick approximation used when breakeven calculation is unavailable. Less precise than N(d2) method.'}>Est. PoP</div>
                    <div className="text-sm font-mono font-black text-text-primary">{fmtPct(card.setup.probability_of_profit)}</div>
                    <div className={`text-[8px] font-mono mt-0.5 ${card.setup.pop_method === 'breakeven_d2' ? 'text-brand-green' : 'text-text-faint'}`}>
                      {card.setup.pop_method === 'breakeven_d2' ? 'N(d2)' : 'Δ approx'}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-[9px] text-text-muted uppercase" title="Expected Value estimate using three-outcome model. Not a guarantee of returns.">Est. EV</div>
                    <div className={`text-sm font-mono font-black ${card.setup.ev > 0 ? 'text-brand-green' : card.setup.ev < 0 ? 'text-brand-red' : 'text-text-muted'}`}>
                      {card.setup.ev !== 0 ? `${card.setup.ev >= 0 ? '+' : ''}$${Math.round(card.setup.ev)}` : '—'}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-[9px] text-text-muted uppercase">Risk/Reward</div>
                    <div className="text-sm font-mono font-black text-text-primary">{card.setup.risk_reward_ratio != null ? card.setup.risk_reward_ratio.toFixed(2) : '—'}</div>
                  </div>
                </div>

                {/* Greeks (dollar terms) + Breakevens row */}
                <div className="border-t border-border mt-2 pt-2">
                  <div className="grid grid-cols-3 gap-3 mb-2">
                    <div className="text-center">
                      <div className="text-[9px] text-text-muted uppercase" title="Dollar delta: how much this position gains or loses if the stock moves $1. Calculated as net delta × stock price × 100.">Δ Exposure</div>
                      <div className={`text-sm font-mono font-black ${(() => {
                        const cp = card.key_stats?.current_price;
                        if (cp == null) return 'text-text-muted';
                        const dd = (card.setup.greeks?.delta ?? 0) * cp * 100;
                        return dd >= 0 ? 'text-brand-green' : 'text-brand-red';
                      })()}`}>
                        {(() => {
                          const cp = card.key_stats?.current_price;
                          if (cp == null) return '—';
                          const dd = Math.round((card.setup.greeks?.delta ?? 0) * cp * 100);
                          return dd >= 0 ? `+$${dd}` : `-$${Math.abs(dd)}`;
                        })()}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-[9px] text-text-muted uppercase" title="Dollar theta: how much this position earns (credit) or loses (debit) per calendar day from time decay alone. Already in per-contract dollar terms.">Daily θ</div>
                      {(() => {
                        const t = card.setup.greeks?.theta_per_day ?? 0;
                        return (
                          <div className={`text-sm font-mono font-black ${t >= 0 ? 'text-brand-green' : 'text-brand-red'}`}>
                            {t >= 0 ? '+' : '-'}${Math.abs(t).toFixed(2)}
                          </div>
                        );
                      })()}
                    </div>
                    <div className="text-center">
                      <div className="text-[9px] text-text-muted uppercase" title="Dollar vega: how much this position gains or loses if implied volatility moves 1 percentage point. Per contract.">Vega/pt</div>
                      {(() => {
                        const v = (card.setup.greeks?.vega ?? 0) * 100;
                        return (
                          <div className={`text-sm font-mono font-black ${v >= 0 ? 'text-brand-green' : 'text-brand-red'}`}>
                            {v >= 0 ? '+' : '-'}${Math.abs(v).toFixed(2)}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="flex items-baseline gap-4">
                    <div>
                      <span className="text-[9px] text-text-muted uppercase mr-1" title="Breakeven price(s) — the exact underlying stock price(s) where this trade breaks even at expiration. Calculated from the P&L curve.">B/E</span>
                      <span className="text-sm font-mono text-text-primary">
                        {(card.setup.breakevens?.length ?? 0) === 0
                          ? '—'
                          : card.setup.breakevens.map(b => `$${b.toFixed(2)}`).join(' / ')}
                      </span>
                    </div>
                    {card.setup.hv_pop != null && (
                      <div>
                        <span className="text-[9px] text-text-muted uppercase mr-1" title="Probability of profit recalculated using historical (realized) volatility instead of implied volatility. More conservative than Est. PoP — shows what history says vs. what options imply.">HV PoP</span>
                        <span className="text-sm font-mono text-text-secondary">{Math.round(card.setup.hv_pop * 100)}%</span>
                        <span className="text-[9px] text-text-faint ml-1">(hist. vol)</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Quarter-Kelly Position Sizing */}
                {card.setup.probability_of_profit != null &&
                 card.setup.max_profit != null &&
                 card.setup.max_loss != null &&
                 card.setup.max_loss !== 0 && (() => {
                  const winRate = card.setup.hv_pop ?? card.setup.probability_of_profit!;
                  const ratio = card.setup.max_profit! / card.setup.max_loss!;
                  const rawKelly = ratio > 0 ? (winRate * ratio - (1 - winRate)) / ratio : 0;
                  const quarterKelly = Math.max(0, rawKelly * 0.25);
                  const kellyPct = Math.round(quarterKelly * 1000) / 10;
                  return (
                    <div className="border-t border-border mt-2 pt-2 flex justify-between items-start px-1">
                      <span
                        className="text-[9px] uppercase tracking-wider text-text-muted cursor-help"
                        title="Quarter-Kelly = 25% of full Kelly criterion. Formula: (win_rate × ratio − loss_rate) / ratio × 0.25, where ratio = max_profit / max_loss."
                      >
                        Kelly Size
                      </span>
                      <div className="text-right">
                        <span className={`text-sm font-mono font-bold ${
                          kellyPct >= 2.0 ? 'text-brand-green' :
                          kellyPct >= 1.0 ? 'text-brand-gold' :
                          kellyPct > 0   ? 'text-text-secondary' :
                                           'text-text-muted'
                        }`}>
                          {kellyPct.toFixed(1)}% <span className="text-[9px] font-normal text-text-muted">of account</span>
                        </span>
                        <div className="text-[9px] text-text-faint mt-0.5">
                          {kellyPct >= 2.0
                            ? 'Favorable edge — size with confidence'
                            : kellyPct >= 1.0
                            ? 'Moderate edge — standard allocation'
                            : kellyPct > 0
                            ? 'Thin edge — keep size small'
                            : 'No edge detected — consider skipping'}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {card.setup.has_wide_spread && (
                  <div className="text-[10px] text-brand-amber text-center mb-1" title="Bid/ask estimated from theoretical price — actual market spread may differ">
                    &#x26A0; Wide bid-ask spread — prices estimated from theoretical model
                  </div>
                )}

                {/* Premium line */}
                <div className="text-center rounded py-1.5 bg-bg-row">
                  {card.setup.net_credit != null && card.setup.net_credit > 0 ? (
                    <span className="text-xs font-bold text-brand-green">Collect ${(card.setup.net_credit * 100).toFixed(0)} premium per contract</span>
                  ) : card.setup.net_debit != null ? (
                    <span className="text-xs font-bold text-text-primary">Pay ${(card.setup.net_debit * 100).toFixed(0)} to enter per contract</span>
                  ) : null}
                </div>

                {/* Enter Trade / Queued button */}
                {(() => {
                  const cardKey = buildCardKey(detail.symbol, card.setup.strategy_name, card.setup.expiration_date, card.setup.legs);
                  const savedId = savedCards.get(cardKey);
                  const saving = savingCards.has(cardKey);
                  const error = saveErrors.get(cardKey);
                  if (savedId) {
                    return (
                      <div className="flex items-center justify-center gap-3 mt-1">
                        <Badge variant="success" size="md">Queued &#10003;</Badge>
                        <button
                          onClick={() => onRemove(cardKey, savedId)}
                          className="text-[10px] text-text-muted hover:text-brand-red transition-colors"
                        >
                          &#10005; Remove
                        </button>
                      </div>
                    );
                  }
                  if (saving) {
                    return (
                      <div className="w-full mt-1">
                        <Button variant="secondary" size="md" loading disabled className="w-full">
                          Saving...
                        </Button>
                      </div>
                    );
                  }
                  return (
                    <div>
                      <Button
                        variant="primary"
                        size="md"
                        onClick={() => onSave(detail, card, sentiment)}
                        className="w-full mt-1"
                      >
                        Enter Trade
                      </Button>
                      {error && (
                        <div className="mt-1 px-2 py-1 rounded text-[10px] bg-red-50 text-brand-red">
                          Failed: {error}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-5 py-4 text-center border-b border-border">
          <div className="text-text-muted text-xs">
            {detail._fetch_errors?.chain_fetch ? `No trade cards — ${detail._fetch_errors.chain_fetch}` : 'No strategies passed quality gates for this ticker'}
          </div>
        </div>
      )}

      {/* D) WHY THIS TRADE */}
      {why && (
        <div className="px-5 py-2 border-b border-border">
          <div className="text-[10px] text-text-muted uppercase tracking-wider font-bold mb-2">Why This Trade</div>

          {why.plain_english_signals.length > 0 && (
            <div className="space-y-1 mb-3">
              {why.plain_english_signals.map((sig, i) => (
                <div key={i} className="flex gap-2 text-xs text-text-secondary leading-relaxed">
                  <span className="shrink-0 mt-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold bg-bg-row text-text-muted">{i + 1}</span>
                  <span>{sig}</span>
                </div>
              ))}
            </div>
          )}

          {/* Vol Edge Breakdown panel */}
          {detail.scores?.vol_edge?.breakdown && (() => {
            const bd = detail.scores.vol_edge.breakdown;
            const subs = [
              { key: 'mispricing', label: 'Mispricing', score: bd.mispricing?.score ?? 0 },
              { key: 'term_structure', label: 'Term Structure', score: bd.term_structure?.score ?? 0 },
              { key: 'technicals', label: 'Technicals', score: bd.technicals?.score ?? 0 },
              { key: 'skew', label: 'Skew', score: bd.skew?.score ?? 0 },
              { key: 'gex', label: 'GEX', score: bd.gex?.score ?? 0 },
            ];
            const best = subs.reduce((a, b) => (b.score > a.score ? b : a));
            const bestExplain: Record<string, string> = {
              mispricing: 'Options appear mispriced relative to realized volatility \u2014 core edge signal.',
              term_structure: 'Vol surface shape suggests a positioning opportunity by tenor.',
              technicals: 'Price action confirms the direction of the trade.',
              skew: 'Skew asymmetry signals directional positioning in the options market.',
              gex: 'Dealer gamma exposure is creating structural price pressure.',
            };
            const subTooltips: Record<string, string> = {
              mispricing: 'Mispricing (0–100): compares implied volatility to realized volatility using VRP z-score, IV percentile, and IV-HV spread. High score = options are statistically expensive relative to how much the stock actually moves.',
              term_structure: 'Term Structure (0–100): reads the shape of the volatility surface across expiration dates. Contango (near-term IV < far-term IV) favors premium sellers. Backwardation signals stress or upcoming events.',
              technicals: 'Technicals (0–100): confirms price action direction using RSI, trend (SMA alignment), Bollinger Band position, and volume. High score = price action aligns with the trade direction.',
              skew: 'Skew (0–100): measures asymmetry between put and call implied volatilities. Steep put skew signals bearish positioning or fear. Steep call skew signals bullish demand. Documented in Xing, Zhang & Zhao (2010, JFQA).',
              gex: 'Gamma Exposure (0–100): measures dealer hedging pressure from options positioning. Long gamma = dealers buy dips/sell rallies (dampening). Short gamma = dealers amplify moves (volatility). Based on Barbon & Buraschi (2021).',
            };
            const vrpZ = bd.mispricing?.z_scores?.vrp_z;
            const gexRegimeMap: Record<string, { text: string; variant: 'success' | 'danger' | 'default' }> = {
              long_gamma: { text: 'long \u03B3', variant: 'success' },
              short_gamma: { text: 'short \u03B3', variant: 'danger' },
              neutral: { text: 'neutral \u03B3', variant: 'default' },
            };
            return (
              <div className="rounded px-3 py-1.5 mb-1 bg-bg-row">
                <div
                  className="text-[10px] text-text-muted font-mono uppercase tracking-wider font-bold mb-2"
                  title="Five independent signals scored 0–100. Mispricing compares implied vs realized vol. Term structure reads the shape of the vol surface. Technicals confirm price action. Skew detects directional positioning. GEX shows dealer gamma exposure and hedging pressure."
                >
                  Vol Edge Breakdown
                </div>
                <div className="space-y-1.5">
                  {subs.map(({ key, label, score }) => (
                    <div key={key} className="flex items-center gap-2" title={subTooltips[key]}>
                      <div className="w-24 shrink-0 text-[10px] font-medium text-text-secondary">{label}</div>
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-bg-terminal">
                        <div className="h-full rounded-full transition-all duration-500 bg-brand-purple" style={{ width: `${Math.min(Math.round(score), 100)}%` }} />
                      </div>
                      <div className="w-6 text-[10px] font-mono font-bold text-right shrink-0 text-text-secondary">{Math.round(score)}</div>
                      <div className="w-20 shrink-0">
                        {key === 'mispricing' && vrpZ != null && (
                          <span className={`text-[10px] font-mono ${vrpZ > 0.5 ? 'text-brand-green' : vrpZ < -0.5 ? 'text-brand-red' : 'text-text-muted'}`} title="Variance Risk Premium z-score: how many standard deviations the current IV-HV spread is above its 12-month average. Above +1.5 = options historically expensive. Carr & Wu (2009, RFS).">
                            VRP z: {vrpZ >= 0 ? '+' : ''}{vrpZ.toFixed(1)}
                          </span>
                        )}
                        {key === 'term_structure' && bd.term_structure?.shape && (
                          <span className="text-[10px] font-mono text-text-secondary">{bd.term_structure.shape}</span>
                        )}
                        {key === 'skew' && bd.skew?.skew_direction && (
                          <Badge variant={bd.skew.skew_direction === 'bullish' ? 'success' : bd.skew.skew_direction === 'bearish' ? 'danger' : 'default'} size="sm">
                            {bd.skew.skew_direction}
                          </Badge>
                        )}
                        {key === 'gex' && bd.gex?.gex_regime && (() => {
                          const g = gexRegimeMap[bd.gex.gex_regime] ?? { text: bd.gex.gex_regime, variant: 'default' as const };
                          return <Badge variant={g.variant} size="sm">{g.text}</Badge>;
                        })()}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-xs text-text-secondary italic px-1 mt-2">
                  {bestExplain[best.key] ?? ''}
                </div>
              </div>
            );
          })()}

          {/* Macro Regime scores panel */}
          {detail.scores?.regime?.breakdown?.regime_scores && (() => {
            const rs = detail.scores.regime.breakdown.regime_scores;
            const dom = detail.scores.regime.breakdown.dominant_regime;
            const regimes: { key: string; label: string; desc: string; barColor: string }[] = [
              { key: 'goldilocks', label: 'Goldilocks', desc: 'high growth, low inflation', barColor: 'bg-brand-green' },
              { key: 'reflation', label: 'Reflation', desc: 'high growth, high inflation', barColor: 'bg-brand-gold' },
              { key: 'stagflation', label: 'Stagflation', desc: 'low growth, high inflation', barColor: 'bg-brand-red' },
              { key: 'deflation', label: 'Deflation', desc: 'low growth, low inflation', barColor: 'bg-brand-purple' },
            ];
            const domExplain: Record<string, string> = {
              goldilocks: 'Growth is strong and inflation is contained \u2014 historically the best environment for selling options premium.',
              reflation: 'Growth is strong but inflation is elevated \u2014 watch for vol spikes around Fed decisions.',
              stagflation: 'Growth is weak and inflation is high \u2014 the hardest environment for premium sellers. Size down.',
              deflation: 'Growth is weak and inflation is falling \u2014 risk-off conditions. Favor defined-risk strategies.',
            };
            return (
              <div className="rounded px-3 py-1.5 mb-1 bg-bg-row">
                <div
                  className="text-[10px] text-text-muted font-mono uppercase tracking-wider font-bold mb-2"
                  title="Regime scores derived from 14 FRED macro indicators. Rule-based sigmoid scoring inspired by Hamilton (1989). Not HMM-estimated probabilities."
                >
                  Macro Regime
                </div>
                <div className="space-y-1.5">
                  {regimes.map(({ key, label, desc, barColor }) => {
                    const score = rs[key as keyof typeof rs];
                    const pct = Math.round(score * 100);
                    const isDom = key === dom;
                    return (
                      <div key={key} className="flex items-center gap-2">
                        <div className="w-20 shrink-0 flex items-center gap-1">
                          <span className="text-[10px] font-medium text-text-secondary" title={desc}>{label}</span>
                          {isDom && <Badge variant="default" size="sm">DOMINANT</Badge>}
                        </div>
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-bg-terminal">
                          <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
                        </div>
                        <div className="w-8 text-[10px] font-mono font-bold text-right shrink-0 text-text-secondary">{pct}%</div>
                      </div>
                    );
                  })}
                </div>
                <div className="text-xs text-text-secondary italic px-1 mt-2">
                  {domExplain[dom] ?? why.regime_context}
                </div>
              </div>
            );
          })()}

          {/* Risk flags */}
          {why.risk_flags.length > 0 && (
            <div className="space-y-1">
              {why.risk_flags.map((flag, i) => {
                const isRed = flag.startsWith('UNLIMITED') || flag.startsWith('INSIDER');
                return (
                  <div key={i} className={`flex items-start gap-2 rounded px-3 py-1.5 text-[10px] font-medium leading-relaxed ${isRed ? 'bg-red-50 text-brand-red' : 'bg-amber-50 text-brand-amber'}`} title="Risk flag: a condition that reduces confidence in this trade. Review before entering.">
                    <span className="shrink-0 mt-0.5">{isRed ? '\u26D4' : '\u26A0'}</span>
                    <span>{flag}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* E) KEY STATS */}
      {ks && (
        <div className="px-5 py-2 border-b border-border">
          <div className="text-[10px] text-text-muted uppercase tracking-wider font-bold mb-2">Key Stats</div>
          <div className="space-y-1 text-xs">
            {/* Volatility row */}
            <div>
              <span className="text-text-muted font-medium">Volatility: </span>
              <span className="text-text-secondary font-mono">
                <span title="IV Rank (0–100): where current implied volatility sits relative to its 52-week range. Above 50 = IV elevated vs recent history. Formula: (IV_now - IV_low) / (IV_high - IV_low).">IV Rank {ks.iv_rank != null ? ks.iv_rank.toFixed(2) : '—'}</span>
                {ks.iv_rank != null && <span className="text-text-muted"> — {statExplain('iv_rank', ks.iv_rank)}</span>}
                {' | '}<span title="30-day implied volatility: the annualized volatility the options market is currently pricing in. Derived from option prices across the chain.">IV {ks.iv30 != null ? `${ks.iv30.toFixed(1)}%` : '—'}</span>
                {' | '}<span title="30-day historical (realized) volatility: how much the stock has actually moved over the past 30 days, annualized. Compare to IV — the gap is the variance risk premium.">HV {ks.hv30 != null ? `${ks.hv30.toFixed(1)}%` : '—'}</span>
                {ks.iv_hv_spread != null && (
                  <>
                    {' | '}
                    <span
                      className={ks.iv_hv_spread > 0 ? 'text-brand-green' : ks.iv_hv_spread < 0 ? 'text-brand-red' : 'text-text-muted'}
                      title="IV-HV Spread: implied volatility minus 30-day realized volatility. Positive means options are pricing in more movement than the stock has actually delivered — the core variance risk premium signal."
                    >
                      VRP {ks.iv_hv_spread > 0 ? '+' : ''}{ks.iv_hv_spread.toFixed(1)}%
                    </span>
                  </>
                )}
              </span>
            </div>
            {/* Vol Cone row */}
            {(() => {
              const cone = ks.vol_cone;
              if (!cone) return null;
              const hvEntries = [
                { label: 'HV10', val: cone.hv10 },
                { label: 'HV20', val: cone.hv20 },
                { label: 'HV30', val: cone.hv30 },
                { label: 'HV60', val: cone.hv60 },
                { label: 'HV90', val: cone.hv90 },
              ].filter(x => x.val != null);
              if (hvEntries.length === 0) return null;
              return (
                <div>
                  <span
                    className="text-text-muted font-medium"
                    title="Realized volatility at multiple lookback windows vs current implied vol. Close-to-close log returns annualized ×√252. Shows whether current IV is high or low relative to how much the stock has actually moved at different time horizons."
                  >
                    Vol Cone:{' '}
                  </span>
                  <span className="text-text-secondary font-mono">
                    {hvEntries.map((x, i, arr) => (
                      <span key={x.label}>
                        <span className="text-text-muted text-[9px]">{x.label}{' '}</span>
                        <span className={
                          cone.current_iv != null && x.val! > cone.current_iv
                            ? 'text-brand-green'
                            : cone.current_iv != null && x.val! < cone.current_iv * 0.8
                            ? 'text-brand-red'
                            : 'text-text-secondary'
                        }>
                          {x.val}%
                        </span>
                        {i < arr.length - 1 && <span className="text-text-muted"> | </span>}
                      </span>
                    ))}
                    {cone.current_iv != null && (
                      <span className="text-text-muted"> vs IV {cone.current_iv}%</span>
                    )}
                  </span>
                </div>
              );
            })()}
            {/* Forward Vol row */}
            {ks.forward_vol && (
              <div>
                <span
                  className="text-text-muted font-medium"
                  title="Forward implied volatility: what the options market is pricing for volatility BETWEEN two expiration dates, stripping out near-term event risk already priced in. Computed as σ_fwd=√[(σ²_far×T_far−σ²_near×T_near)÷(T_far−T_near)]. Negative forward variance (calendar arbitrage) is suppressed."
                >
                  Fwd Vol:{' '}
                </span>
                <span className="text-text-secondary font-mono">
                  <span
                    className={
                      ks.vol_cone?.current_iv != null
                        ? ks.forward_vol.forward_iv > ks.vol_cone.current_iv * 1.1
                          ? 'text-brand-red'
                          : ks.forward_vol.forward_iv < ks.vol_cone.current_iv * 0.9
                          ? 'text-brand-green'
                          : 'text-text-secondary'
                        : 'text-text-secondary'
                    }
                  >
                    {ks.forward_vol.forward_iv}%
                  </span>
                  <span className="text-text-muted">
                    {' '}({ks.forward_vol.from_dte}→{ks.forward_vol.to_dte}d)
                  </span>
                  {ks.vol_cone?.current_iv != null && (
                    <span className="text-text-muted">
                      {' '}vs spot IV {ks.vol_cone.current_iv}%
                    </span>
                  )}
                </span>
              </div>
            )}
            {/* Company row */}
            <div>
              <span className="text-text-muted font-medium">Company: </span>
              <span className="text-text-secondary font-mono">
                <span title="Price-to-earnings ratio. Used in Quality Gate as one input to valuation context. Extreme P/E (very high or negative) increases fundamental risk score.">P/E {ks.pe_ratio != null ? ks.pe_ratio.toFixed(1) : '—'}</span>
                {ks.pe_ratio != null && <span className="text-text-muted"> — {statExplain('pe_ratio', ks.pe_ratio)}</span>}
                {' | '}<span title="Total market capitalization. Larger caps tend to have tighter bid-ask spreads and more liquid options chains.">Cap {fmtMcap(ks.market_cap)}</span>
                {' | '}<span title="Next scheduled earnings announcement. Options IV typically spikes before earnings and collapses after. Know this date before entering any position.">Earnings {ks.earnings_date ?? '—'}</span>
                {ks.days_to_earnings != null && ks.days_to_earnings > 0 && <span className="text-brand-amber" title="Calendar days until next earnings. Under 21 days = elevated event risk. The scanner flags this in risk flags."> ({ks.days_to_earnings}d away)</span>}
              </span>
            </div>
            {/* Earnings pattern row */}
            {ks.earnings_pattern && ks.earnings_pattern.total_quarters >= 2 && (
              <div>
                <span
                  className="text-text-muted font-medium"
                  title="Historical earnings beat rate and Standardized Unexpected Earnings (SUE) from Finnhub. Beat rate = quarters beat / total quarters. SUE methodology: Bernard & Thomas (1989, JAR). Note: IV crush prediction (pre vs post-earnings IV ratio) requires historical IV data not yet collected."
                >
                  Earnings:{' '}
                </span>
                <span className="text-text-secondary font-mono">
                  {ks.earnings_pattern.beat_rate != null && (
                    <span
                      className={
                        ks.earnings_pattern.beat_rate >= 70
                          ? 'text-brand-green'
                          : ks.earnings_pattern.beat_rate <= 40
                          ? 'text-brand-red'
                          : 'text-text-secondary'
                      }
                      title="Beat rate: % of quarters where actual EPS exceeded consensus estimate."
                    >
                      {ks.earnings_pattern.beat_rate}% beat
                    </span>
                  )}
                  {ks.earnings_pattern.avg_surprise_pct != null && (
                    <span className="text-text-muted">
                      {' '}(avg {ks.earnings_pattern.avg_surprise_pct > 0 ? '+' : ''}{ks.earnings_pattern.avg_surprise_pct.toFixed(1)}%)
                    </span>
                  )}
                  <span className="text-text-faint text-[9px]">
                    {' '}{ks.earnings_pattern.total_quarters}Q
                  </span>
                  {ks.earnings_pattern.streak && (
                    <span className="text-text-muted">
                      {' | '}{ks.earnings_pattern.streak}
                    </span>
                  )}
                  {ks.earnings_pattern.sue_score != null && (
                    <span
                      className={
                        ks.earnings_pattern.sue_score > 60
                          ? 'text-brand-green'
                          : ks.earnings_pattern.sue_score < 40
                          ? 'text-brand-red'
                          : 'text-text-muted'
                      }
                      title="SUE score (0-100): Standardized Unexpected Earnings. Measures magnitude and consistency of earnings surprises relative to ticker-specific volatility. Bernard & Thomas (1989) documented post-earnings announcement drift (PEAD): high SUE predicts positive returns for 60 days post-announcement."
                    >
                      {' | '}SUE {ks.earnings_pattern.sue_score}
                    </span>
                  )}
                </span>
              </div>
            )}
            {/* Market row */}
            <div>
              <span className="text-text-muted font-medium">Market: </span>
              <span className="text-text-secondary font-mono">
                <span title="Beta measures how much this stock moves relative to the S&P 500. Beta 1.5 = stock moves ~50% more than the market on average. Higher beta = wider expected moves = higher IV.">Beta {ks.beta != null ? ks.beta.toFixed(2) : '—'}</span>
                {ks.beta != null && <span className="text-text-muted"> — {statExplain('beta', ks.beta)}</span>}
                {' | '}<span title="30-day rolling correlation to SPY. High correlation means the stock moves with the market — macro events affect this position. Low correlation = more idiosyncratic risk.">SPY Corr {ks.spy_correlation != null ? ks.spy_correlation.toFixed(2) : '—'}</span>
                {ks.spy_correlation != null && <span className="text-text-muted"> — {statExplain('spy_correlation', ks.spy_correlation)}</span>}
                {' | '}<span title="Options chain liquidity score. Combines bid-ask spreads, open interest, and daily volume across strikes. Low liquidity = wider fills = higher real cost of the trade.">Liquidity {ks.liquidity_rating != null ? `${ks.liquidity_rating}/5` : '—'}</span>
              </span>
            </div>
            {/* Sentiment row */}
            <div>
              <span className="text-text-muted font-medium">Sentiment: </span>
              <span className="text-text-secondary font-mono">
                <span title="Aggregated analyst recommendation from Finnhub. Ranges from Strong Buy to Strong Sell. Used as one input to the Info Edge gate.">Analysts: {ks.analyst_consensus ?? '—'}</span>
                {' | '}<span title="Social media activity ratio: recent mention volume vs baseline. From xAI/Grok real-time X/Twitter analysis. Elevated buzz can signal upcoming price movement.">Buzz {ks.buzz_ratio != null ? `${ks.buzz_ratio.toFixed(1)}x` : '—'}</span>
                {ks.buzz_ratio != null && <span className="text-text-muted"> — {statExplain('buzz_ratio', ks.buzz_ratio)}</span>}
                {' | '}<span title="Rate of change in social sentiment. Positive = sentiment improving recently. Negative = sentiment deteriorating. From xAI/Grok X/Twitter analysis.">Trend {ks.sentiment_momentum != null ? ks.sentiment_momentum.toFixed(0) : '—'}</span>
                {ks.sentiment_momentum != null && <span className="text-text-muted"> — {statExplain('sentiment_momentum', ks.sentiment_momentum)}</span>}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* F) TOP HEADLINES */}
      {headlines.length > 0 && (
        <div className="px-5 py-2">
          <div className="text-[10px] text-text-muted uppercase tracking-wider font-bold mb-2">Recent Headlines</div>
          <div className="space-y-1.5">
            {headlines.map((h, i) => (
              <div key={i} className="flex items-start gap-2 text-xs" title="News headline from Finnhub. Sentiment scored by FinBERT — a financial-domain BERT model trained on financial phrase classification.">
                <span className="text-text-secondary leading-relaxed flex-1">&ldquo;{h.headline}&rdquo;</span>
                <span className="shrink-0 text-[9px] text-text-muted">{h.source}</span>
                <span title="FinBERT sentiment classification: positive, negative, or neutral. FinBERT outperforms general NLP models on financial text (Huang, Wang & Yang 2023)."><Badge
                  variant={h.sentiment === 'bullish' ? 'success' : h.sentiment === 'bearish' ? 'danger' : 'default'}
                  size="sm"
                >
                  {h.sentiment}
                </Badge></span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Filtered Results Section ────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PipelineFlowPanel({ result, progress, universe }: { result: any; progress?: Record<string, any>; universe?: string }) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [hDrillDown, setHDrillDown] = useState<Record<string, boolean>>({});
  // Render from live progress if result not yet available
  const isLive = !result && progress && Object.keys(progress).length > 0;
  if (!result && !isLive) return null;
  const ps = result?.pipeline_summary;
  const hf = result?.hard_filters;
  const rankings = result?.rankings;
  const rejections = result?.rejection_reasons ?? {};

  // Unified data accessors: prefer live progress, fall back to final result
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bData: any = progress?.step_e?.data ?? (result ? { input: ps?.total_universe, output: hf?.output_count, filters: hf?.filters_applied, survivors: hf?.survivors } : null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eData: any = progress?.step_i?.data ?? (result ? { finnhub_calls: ps?.finnhub_calls_made, finnhub_errors: ps?.finnhub_errors, data_gaps: result.data_gaps } : null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fData: any = progress?.step_k?.data ?? (result ? { scored: ps?.scored, rankings: [...(rankings?.top_9 ?? []), ...(rankings?.also_scored ?? [])] } : null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gData: any = progress?.step_s?.data ?? (result ? { trade_cards: ps?.total_trade_cards, top_9: rankings?.top_9?.map((r: any) => r.symbol), rejections: result.rejection_reasons } : null); // eslint-disable-line @typescript-eslint/no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jData: any = progress?.step_n?.data ?? null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const kData: any = progress?.step_p?.data ?? null;

  const filterRows = (bData?.filters ?? []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (f: any) => ({
      name: f.filter,
      dropped: f.failed,
      passed: f.passed,
    })
  );

  const toggle = (key: string) =>
    setExpanded(e => ({ ...e, [key]: !e[key] }));

  return (
    <div className="border border-border rounded bg-bg-card mb-4 text-xs font-mono">
      {/* Header */}
      <div className="px-4 py-2 border-b border-border flex items-center justify-between">
        <span className="text-text-primary font-bold uppercase tracking-wider text-[10px]">Pipeline Flow</span>
        <span className="text-text-muted">
          {ps?.timestamp ? new Date(ps.timestamp).toLocaleTimeString() : ''}
          {' '}· {ps?.pipeline_runtime_ms ? `${(ps.pipeline_runtime_ms / 1000).toFixed(1)}s` : ''}
        </span>
      </div>

      {/* Step A */}
      <div className="border-b border-border">
        <div className="px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-bg-row" onClick={() => toggle('step_a')}>
          <div className="flex items-center gap-3">
            <span className="text-brand-purple font-bold">STEP A</span>
            <span className="text-text-secondary">TT Scanner — Universe Scan</span>
            {(ps?.total_universe ?? progress?.step_a?.data?.total_universe) ? (
              <>
                <span className="text-brand-green">{ps?.total_universe ?? progress?.step_a?.data?.total_universe ?? 0} symbols fetched</span>
                <span className="text-text-muted">({universe})</span>
              </>
            ) : (
              <span className="text-text-muted animate-pulse">waiting...</span>
            )}
          </div>
          <span className="text-text-muted">{expanded['step_a'] ? '▲' : '▼'}</span>
        </div>
        {expanded['step_a'] && (
          <div className="border-t border-border bg-bg-row p-3">
            <div className="text-xs space-y-3 mb-4">
              <p className="text-text-muted italic text-xs">
                Step A pulls live market data on every ticker in the universe. This is the raw material — nothing here is estimated. Every number comes directly from TastyTrade. The two columns that matter most are IV Rank and IV-HV Spread — those two drive the ranking in Step B.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-border">
                  <thead>
                    <tr>
                      <th className="text-text-muted font-bold text-xs p-2 bg-bg-card border border-border">DATA POINT</th>
                      <th className="text-text-muted font-bold text-xs p-2 bg-bg-card border border-border">SOURCE</th>
                      <th className="text-text-muted font-bold text-xs p-2 bg-bg-card border border-border">WHEN APPLIED</th>
                      <th className="text-text-muted font-bold text-xs p-2 bg-bg-card border border-border">WHERE APPLIED</th>
                      <th className="text-text-muted font-bold text-xs p-2 bg-bg-card border border-border">WHY</th>
                      <th className="text-text-muted font-bold text-xs p-2 bg-bg-card border border-border">HOW / VALUE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['IV Rank', 'TastyTrade market-metrics', 'Step A fetch', 'Step B pre-score formula (40% weight)', 'Measures how expensive options are right now vs the past year. High rank = options priced at a premium', 'Higher IV Rank → higher pre-score → more likely to make the cut'],
                      ['IV-HV Spread', 'TastyTrade market-metrics', 'Step A fetch', 'Step B (35% weight), Step C exclusion', 'If realized vol exceeds implied vol there is no premium to sell. This is the core vol edge signal', 'Negative spread = instant exclusion in Step C. Positive spread = edge exists'],
                      ['Liquidity Rating', 'TastyTrade market-metrics', 'Step A fetch', 'Step B (25% weight), Step C exclusion, Step E filter', 'Wide bid-ask spreads destroy profit before you make a trade. Must be 2/5 or higher to proceed', 'Below 2/5 = excluded in Step C'],
                      ['IV30', 'TastyTrade market-metrics', 'Step A fetch', 'Step E filter (must exist), Step F peer z-score', 'If IV data does not exist we cannot price options. Also used to compare each stock against its peers', 'Missing IV30 = hard eliminated in Step E'],
                      ['Earnings Date / DTE', 'TastyTrade market-metrics', 'Step A fetch', 'Step C warning flag, Step E filter', 'IV spikes before earnings then collapses after. Entering a trade into earnings destroys the edge', 'Within 7 days = eliminated in Step E'],
                      ['Borrow Rate', 'TastyTrade market-metrics', 'Step A fetch', 'Step E filter', 'High borrow rate = short squeeze risk. Violent price spikes break option pricing models', 'Above 50% = eliminated in Step E'],
                      ['Market Cap', 'TastyTrade market-metrics', 'Step A fetch', 'Step E filter', 'Small companies have thin options markets — wide spreads, low open interest, hard to exit', 'Below $2B = eliminated in Step E'],
                      ['Beta / SPY Correlation', 'TastyTrade market-metrics', 'Step A fetch', 'Step K Regime gate (SPY correlation modifier)', 'Tells us how closely this stock follows the market. High correlation amplifies regime signals', 'SPY correlation multiplied against base regime score in Step K'],
                    ].map(([dp, src, when, where, why, how], i) => (
                      <tr key={i}>
                        <td className="text-xs p-2 text-text-muted border border-border">{dp}</td>
                        <td className="text-xs p-2 text-text-muted border border-border">{src}</td>
                        <td className="text-xs p-2 text-text-muted border border-border">{when}</td>
                        <td className="text-xs p-2 text-text-muted border border-border">{where}</td>
                        <td className="text-xs p-2 text-text-muted border border-border">{why}</td>
                        <td className="text-xs p-2 text-text-muted border border-border">{how}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {/* Symbol table — two-tier design */}
            {(() => {
              const fetchedAt = progress?.step_a?.data?.fetched_at as string | undefined;
              const source = progress?.step_a?.data?.source as string | undefined;
              const ageSec = fetchedAt ? Math.round((Date.now() - new Date(fetchedAt).getTime()) / 1000) : null;
              const fmtPct = (v: any) => v != null ? (v * 100).toFixed(1) : '—';
              const fmt1 = (v: any) => v != null ? Number(v).toFixed(1) : '—';
              const fmt2 = (v: any) => v != null ? Number(v).toFixed(2) : '—';
              const fmtCap = (v: any) => {
                if (v == null) return '—';
                if (v >= 1e12) return '$' + (v / 1e12).toFixed(1) + 'T';
                return '$' + (v / 1e9).toFixed(1) + 'B';
              };
              const fmtSpread = (v: any) => {
                if (v == null) return '—';
                const n = Number(v);
                return (n >= 0 ? '+' : '') + n.toFixed(1);
              };
              return (
                <>
                <div className="flex items-center gap-3 text-xs text-text-muted mb-1">
                  <span className="font-bold">SYMBOLS FETCHED ({(progress?.step_a?.data?.symbols ?? []).length})</span>
                </div>
                <div className="overflow-y-auto" style={{maxHeight: '320px'}}>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-text-muted border-b border-border">
                        <th className="text-left py-1 pr-1 w-4"></th>
                        <th className="text-left py-1 pr-2">#</th>
                        <th className="text-left py-1 pr-2">SYMBOL</th>
                        <th className="text-right py-1 pr-2">IV RANK</th>
                        <th className="text-right py-1 pr-2">IV%</th>
                        <th className="text-right py-1 pr-2">IV30</th>
                        <th className="text-right py-1 pr-2">IV-HV SPREAD</th>
                        <th className="text-right py-1 pr-2">LIQ</th>
                        <th className="text-right py-1 pr-2">MKT CAP</th>
                        <th className="text-right py-1 pr-2">BETA</th>
                        <th className="text-right py-1 pr-2">SPY CORR</th>
                        <th className="text-right py-1 pr-2">BORROW</th>
                        <th className="text-left py-1 pr-2">EARNINGS</th>
                        <th className="text-right py-1 pr-2">DTE</th>
                        <th className="text-left py-1 pr-2">SOURCE</th>
                        <th className="text-left py-1 pr-2">ENDPOINT</th>
                        <th className="text-left py-1 pr-2">FETCHED</th>
                        <th className="text-right py-1">AGE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(progress?.step_a?.data?.symbols ?? []).map((s: any, i: number) => {
                        const detailKey = `stepA_${s.symbol}`;
                        const isOpen = expanded[detailKey];
                        const hasTerm = Array.isArray(s.termStructure) && s.termStructure.length > 0;
                        return (
                          <React.Fragment key={s.symbol}>
                            <tr className="border-b border-border/50 cursor-pointer hover:bg-bg-row/50" onClick={() => toggle(detailKey)}>
                              <td className="py-1 pr-1 text-text-muted text-center">{isOpen ? '▼' : '▶'}</td>
                              <td className="py-1 pr-2 text-text-muted">{i+1}</td>
                              <td className="py-1 pr-2 font-bold">{s.symbol}</td>
                              <td className="py-1 pr-2 text-right">{fmtPct(s.ivRank)}</td>
                              <td className="py-1 pr-2 text-right">{fmtPct(s.ivPercentile)}</td>
                              <td className="py-1 pr-2 text-right">{fmt1(s.iv30)}</td>
                              <td className="py-1 pr-2 text-right">{fmtSpread(s.ivHvSpread)}</td>
                              <td className="py-1 pr-2 text-right">{s.liquidityRating != null ? s.liquidityRating + '/5' : '—'}</td>
                              <td className="py-1 pr-2 text-right">{fmtCap(s.marketCap)}</td>
                              <td className="py-1 pr-2 text-right">{fmt2(s.beta)}</td>
                              <td className="py-1 pr-2 text-right">{fmt2(s.corrSpy)}</td>
                              <td className="py-1 pr-2 text-right">{s.borrowRate != null ? s.borrowRate + '%' : '—'}</td>
                              <td className="py-1 pr-2 text-left">{s.earningsDate ?? '—'}</td>
                              <td className="py-1 pr-2 text-right">{s.daysTillEarnings != null ? s.daysTillEarnings + 'd' : '—'}</td>
                              <td className="py-1 pr-2 text-text-muted text-[10px]">TastyTrade</td>
                              <td className="py-1 pr-2 text-text-muted text-[10px]">market-metrics</td>
                              <td className="py-1 pr-2 text-text-muted text-[10px]">{fetchedAt ? new Date(fetchedAt).toISOString().slice(11, 19) + ' UTC' : '—'}</td>
                              <td className="py-1 text-right text-text-muted text-[10px]">{ageSec != null ? ageSec + 's' : '—'}</td>
                            </tr>
                            {isOpen && (
                              <tr className="bg-bg-row/30 border-b border-border/50">
                                <td colSpan={18} className="py-2 px-4">
                                  <div className="grid grid-cols-3 gap-x-6 gap-y-1 text-xs mb-2">
                                    <div className="flex justify-between"><span className="text-text-muted">HV30</span><span>{fmt1(s.hv30)}</span></div>
                                    <div className="flex justify-between"><span className="text-text-muted">HV60</span><span>{fmt1(s.hv60)}</span></div>
                                    <div className="flex justify-between"><span className="text-text-muted">HV90</span><span>{fmt1(s.hv90)}</span></div>
                                    <div className="flex justify-between"><span className="text-text-muted">SECTOR</span><span>{s.sector ?? '—'}</span></div>
                                    <div className="flex justify-between"><span className="text-text-muted">INDUSTRY</span><span>{s.industry ?? '—'}</span></div>
                                    <div className="flex justify-between"><span className="text-text-muted">IMPLIED VOL</span><span>{fmtPct(s.impliedVolatility)}{s.impliedVolatility != null ? '%' : ''}</span></div>
                                    <div className="flex justify-between"><span className="text-text-muted">P/E</span><span>{fmt1(s.peRatio)}</span></div>
                                    <div className="flex justify-between"><span className="text-text-muted">EPS</span><span>{fmt2(s.eps)}</span></div>
                                    <div className="flex justify-between"><span className="text-text-muted">DIV YIELD</span><span>{s.dividendYield != null ? (s.dividendYield * 100).toFixed(2) + '%' : '—'}</span></div>
                                    <div className="flex justify-between"><span className="text-text-muted">LENDABILITY</span><span>{s.lendability ?? '—'}</span></div>
                                    <div className="flex justify-between"><span className="text-text-muted">LAST EPS</span><span>{fmt2(s.earningsActualEps)}</span></div>
                                    <div className="flex justify-between"><span className="text-text-muted">EPS EST</span><span>{fmt2(s.earningsEstimate)}</span></div>
                                    <div className="flex justify-between"><span className="text-text-muted">EARNINGS TOD</span><span>{s.earningsTimeOfDay ?? '—'}</span></div>
                                  </div>
                                  {hasTerm && (
                                    <div>
                                      <p className="text-text-muted text-xs font-bold mb-1">TERM STRUCTURE</p>
                                      <table className="text-xs">
                                        <thead>
                                          <tr className="text-text-muted">
                                            <th className="text-left pr-4 py-0.5">EXPIRY</th>
                                            <th className="text-right py-0.5">IV</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {s.termStructure.map((t: any, ti: number) => (
                                            <tr key={ti} className="border-t border-border/30">
                                              <td className="pr-4 py-0.5">{t.date ?? '—'}</td>
                                              <td className="text-right py-0.5">{t.iv != null ? (t.iv * 100).toFixed(1) + '%' : '—'}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* Step A2 */}
      <div className="border-b border-border">
        <div className="px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-bg-row" onClick={() => toggle('step_b')}>
          <div className="flex items-center gap-3">
            <span className="text-brand-purple font-bold">STEP B</span>
            <span className="text-text-secondary">Pre-Filter</span>
            {progress?.step_b ? (
              <span className="text-brand-red">
                {progress.step_b.data.input} → {progress.step_b.data.output} survived
                {(progress.step_b.data.excluded as number) > 0 && ` (${progress.step_b.data.excluded} excluded)`}
              </span>
            ) : (
              <span className="text-text-muted animate-pulse">waiting...</span>
            )}
          </div>
          <span className="text-text-muted">{expanded['step_b'] ? '▲' : '▼'}</span>
        </div>
        {expanded['step_b'] && progress?.step_b && (
          <div className="border-t border-border bg-bg-row p-3">
            <div className="text-xs space-y-3 mb-4">
              <p className="text-text-muted italic text-xs">
                Step B scores every ticker using only the data we already have from Step A. No new API calls. Three signals go in, one score comes out. This step ranks — it does not eliminate.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-border">
                  <thead>
                    <tr>
                      <th className="text-text-muted font-bold text-xs p-2 bg-bg-card border border-border">DATA POINT</th>
                      <th className="text-text-muted font-bold text-xs p-2 bg-bg-card border border-border">SOURCE</th>
                      <th className="text-text-muted font-bold text-xs p-2 bg-bg-card border border-border">WHEN APPLIED</th>
                      <th className="text-text-muted font-bold text-xs p-2 bg-bg-card border border-border">WHERE APPLIED</th>
                      <th className="text-text-muted font-bold text-xs p-2 bg-bg-card border border-border">WHY</th>
                      <th className="text-text-muted font-bold text-xs p-2 bg-bg-card border border-border">HOW / VALUE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['IV Rank', 'Step A', 'Step B scoring', 'Pre-score formula (40% weight)', 'Highest weight because elevated IV rank is the primary condition for selling premium', 'IV Rank × 0.40 → contributes up to 40 points'],
                      ['IV-HV Spread', 'Step A', 'Step B scoring', 'Pre-score formula (35% weight)', 'Confirms the premium is real — if realized vol exceeds implied vol there is nothing to sell', 'Normalized spread/30, clamped 0–1, × 0.35 → contributes up to 35 points'],
                      ['Liquidity Rating', 'Step A', 'Step B scoring', 'Pre-score formula (25% weight)', 'A great vol setup is worthless if you cannot execute the trade at a fair price', 'Rating/5 × 0.25 → contributes up to 25 points'],
                      ['Pre-Score', 'Computed', 'Step B output', 'Step D Top-N cutoff', 'Single number summarizing vol selling opportunity per ticker', 'Top scorers advance to Step E. Everyone else is ranked out'],
                    ].map(([dp, src, when, where, why, how], i) => (
                      <tr key={i}>
                        <td className="text-xs p-2 text-text-muted border border-border">{dp}</td>
                        <td className="text-xs p-2 text-text-muted border border-border">{src}</td>
                        <td className="text-xs p-2 text-text-muted border border-border">{when}</td>
                        <td className="text-xs p-2 text-text-muted border border-border">{where}</td>
                        <td className="text-xs p-2 text-text-muted border border-border">{why}</td>
                        <td className="text-xs p-2 text-text-muted border border-border">{how}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="text-text-muted text-xs font-bold mb-1">
              ALL TICKERS SCORED ({(progress?.step_b?.data?.tickers as any[] ?? []).length}){/* eslint-disable-line @typescript-eslint/no-explicit-any */}
            </p>
            <div className="overflow-x-auto overflow-y-auto" style={{maxHeight: '240px'}}>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-text-muted border-b border-border">
                    <th className="text-left py-1 pr-3">#</th>
                    <th className="text-left py-1 pr-3">SYMBOL</th>
                    <th className="text-right py-1 pr-3">IV RANK</th>
                    <th className="text-right py-1 pr-3">IV-HV SPREAD</th>
                    <th className="text-right py-1 pr-3">LIQUIDITY</th>
                    <th className="text-left py-1 pr-3">CALCULATION</th>
                    <th className="text-right py-1 pr-3">PRE-SCORE</th>
                    <th className="text-left py-1 pr-3 w-48">STATUS</th>
                    <th className="text-left py-1 pr-3">SOURCE</th>
                    <th className="text-left py-1 pr-3">ENDPOINT</th>
                    <th className="text-left py-1 pr-3">FETCHED</th>
                    <th className="text-right py-1">AGE</th>
                  </tr>
                </thead>
                <tbody>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(progress?.step_b?.data?.tickers as any[] ?? []).map((t: any, i: number) => {
                    const fetchedAt = progress?.step_a?.data?.fetched_at as string | undefined;
                    const fetchedTime = fetchedAt ? new Date(fetchedAt).toISOString().slice(11, 19) + ' UTC' : '—';
                    const ageSec = fetchedAt ? Math.round((Date.now() - new Date(fetchedAt).getTime()) / 1000) + 's' : '—';
                    const ivHvSpread = t.iv_hv_spread;
                    const ivRankNorm = t.iv_rank != null ? t.iv_rank : null;
                    const ivHvNorm = ivHvSpread != null ? Math.min(Math.max(ivHvSpread / 30, 0), 1) : null;
                    const liqNorm = t.liquidity != null ? t.liquidity / 5 : null;
                    const calcStr = t.excluded
                      ? '—'
                      : `(${(ivRankNorm ?? 0).toFixed(3)} × 40%) + (${(ivHvNorm ?? 0).toFixed(3)} × 35%) + (${(liqNorm ?? 0).toFixed(3)} × 25%)`;
                    return (
                      <tr key={t.symbol} className="border-b border-border/50">
                        <td className="py-1 pr-3 text-text-muted">{i+1}</td>
                        <td className="py-1 pr-3 font-bold">{t.symbol}</td>
                        <td className="py-1 pr-3 text-right">{t.iv_rank != null ? (t.iv_rank * 100).toFixed(1) : '—'}</td>
                        <td className="py-1 pr-3 text-right">{ivHvSpread != null ? (ivHvSpread >= 0 ? '+' : '') + ivHvSpread.toFixed(1) : '—'}</td>
                        <td className="py-1 pr-3 text-right">{t.liquidity ?? '—'}/5</td>
                        <td className="py-1 pr-3 text-text-muted font-mono text-[10px]">
                          {calcStr}
                        </td>
                        <td className="py-1 pr-3 text-right text-brand-gold font-bold">{t.pre_score ?? '—'}</td>
                        <td className={`py-1 pr-3 w-48 max-w-[12rem] truncate ${t.excluded ? 'text-brand-red' : t.reason?.startsWith('⚠') ? 'text-brand-gold' : 'text-brand-green'}`}>
                          {t.excluded
                            ? `✗ Excluded — ${t.exclusion_reason}`
                            : t.reason?.startsWith('⚠')
                            ? t.reason
                            : '✓ Passed'
                          }
                        </td>
                        <td className="py-1 pr-3 text-text-muted text-[10px]">TastyTrade</td>
                        <td className="py-1 pr-3 text-text-muted text-[10px]">market-metrics</td>
                        <td className="py-1 pr-3 text-text-muted text-[10px]">{fetchedTime}</td>
                        <td className="py-1 text-right text-text-muted text-[10px]">{ageSec}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Step C — Hard Exclusions */}
      <div className="border-b border-border">
        <div className="px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-bg-row" onClick={() => toggle('step_c')}>
          <div className="flex items-center gap-3">
            <span className="text-brand-purple font-bold">STEP C</span>
            <span className="text-text-secondary">Hard Exclusions</span>
            {progress?.step_c ? (
              <span className="text-brand-green">
                {progress.step_c.data.excluded ?? '—'} excluded — {progress.step_c.data.survivors ?? '—'} passed
              </span>
            ) : (
              <span className="text-text-muted animate-pulse">waiting...</span>
            )}
          </div>
          <span className="text-text-muted">{expanded['step_c'] ? '▲' : '▼'}</span>
        </div>
        {expanded['step_c'] && (
          <div className="border-t border-border bg-bg-row p-3">
            <div className="text-xs space-y-3 mb-4">
              <p className="text-text-muted italic text-xs">
                Step C applies two instant disqualifiers. No partial credit. If a ticker fails either rule it is gone. This step eliminates — it does not score.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-border">
                  <thead>
                    <tr>
                      <th className="text-text-muted font-bold text-xs p-2 bg-bg-card border border-border">DATA POINT</th>
                      <th className="text-text-muted font-bold text-xs p-2 bg-bg-card border border-border">SOURCE</th>
                      <th className="text-text-muted font-bold text-xs p-2 bg-bg-card border border-border">WHEN APPLIED</th>
                      <th className="text-text-muted font-bold text-xs p-2 bg-bg-card border border-border">WHERE APPLIED</th>
                      <th className="text-text-muted font-bold text-xs p-2 bg-bg-card border border-border">WHY</th>
                      <th className="text-text-muted font-bold text-xs p-2 bg-bg-card border border-border">HOW / VALUE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['IV-HV Spread', 'Step A', 'Step C exclusion', 'Hard exclusion rule', 'If realized vol exceeds implied vol there is no premium to sell — the edge does not exist', 'Spread ≤ 0 = eliminated immediately'],
                      ['Liquidity Rating', 'Step A', 'Step C exclusion', 'Hard exclusion rule', 'Below 2/5 the bid-ask spread eats all profit before the trade makes a dollar', 'Rating < 2/5 = eliminated immediately'],
                      ['Earnings proximity', 'Step A', 'Step C flag', 'Warning passed to Step E', 'Earnings within 3 days flagged for visibility — Step E enforces the hard 7-day rule', 'Not eliminated here — passed forward with warning'],
                    ].map(([dp, src, when, where, why, how], i) => (
                      <tr key={i}>
                        <td className="text-xs p-2 text-text-muted border border-border">{dp}</td>
                        <td className="text-xs p-2 text-text-muted border border-border">{src}</td>
                        <td className="text-xs p-2 text-text-muted border border-border">{when}</td>
                        <td className="text-xs p-2 text-text-muted border border-border">{where}</td>
                        <td className="text-xs p-2 text-text-muted border border-border">{why}</td>
                        <td className="text-xs p-2 text-text-muted border border-border">{how}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* LEFT TABLE — Excluded tickers */}
              <div>
                <p className="text-text-primary font-bold text-[10px] uppercase tracking-wider mb-1">
                  EXCLUDED ({progress?.step_c?.data?.excluded ?? '—'} tickers)
                </p>
                {(progress?.step_c?.data?.exclusions ?? []).length > 0 ? (
                  <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                    <table className="w-full text-[10px]">
                      <thead><tr className="text-text-muted border-b border-border">
                        <th className="text-left py-1 px-1">#</th>
                        <th className="text-left py-1 px-1">SYMBOL</th>
                        <th className="text-left py-1 px-1">REASON</th>
                      </tr></thead>
                      <tbody>
                        {(progress?.step_c?.data?.exclusions ?? []).map((e: { symbol: string; reason: string }, i: number) => (
                          <tr key={e.symbol} className="border-b border-border/50">
                            <td className="py-0.5 px-1 text-text-muted font-mono">{i + 1}</td>
                            <td className="py-0.5 px-1 font-bold text-text-primary">{e.symbol}</td>
                            <td className="py-0.5 px-1 text-text-muted">{e.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-text-muted text-[10px] italic">No tickers excluded</p>
                )}
              </div>

              {/* RIGHT TABLE — Earnings warnings */}
              <div>
                <p className="text-text-primary font-bold text-[10px] uppercase tracking-wider mb-1">
                  EARNINGS WARNINGS ({(progress?.step_c?.data?.earnings_warnings ?? []).length} tickers flagged)
                </p>
                {(progress?.step_c?.data?.earnings_warnings ?? []).length > 0 ? (
                  <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                    <table className="w-full text-[10px]">
                      <thead><tr className="text-text-muted border-b border-border">
                        <th className="text-left py-1 px-1">#</th>
                        <th className="text-left py-1 px-1">SYMBOL</th>
                        <th className="text-right py-1 px-1">DAYS TO EARNINGS</th>
                      </tr></thead>
                      <tbody>
                        {(progress?.step_c?.data?.earnings_warnings ?? []).map((w: { symbol: string; days_to_earnings: number | null }, i: number) => (
                          <tr key={w.symbol} className="border-b border-border/50">
                            <td className="py-0.5 px-1 text-text-muted font-mono">{i + 1}</td>
                            <td className="py-0.5 px-1 font-bold text-text-primary">{w.symbol}</td>
                            <td className="py-0.5 px-1 text-right font-mono text-brand-gold">{w.days_to_earnings ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-text-muted text-[10px] italic">No earnings warnings</p>
                )}
                <p className="text-text-muted text-[10px] mt-2">
                  ⚠ These tickers passed but carry earnings risk. Step E will enforce the 7-day earnings exclusion.
                </p>
              </div>
            </div>

            <p className="text-text-muted text-[10px] mt-3 italic">
              Source: Step B pre-filter computation — no new API calls
            </p>
          </div>
        )}
      </div>

      {/* Step D — Top-N Selection */}
      <div className="border-b border-border">
        <div className="px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-bg-row" onClick={() => toggle('step_d')}>
          <div className="flex items-center gap-3">
            <span className="text-brand-purple font-bold">STEP D</span>
            <span className="text-text-secondary">Top-N Selection</span>
            {progress?.step_b ? (
              <span className="text-brand-gold">{progress.step_b.data.output} → {progress?.step_e?.data?.input ?? 45} candidates for hard filters</span>
            ) : (
              <span className="text-text-muted animate-pulse">waiting...</span>
            )}
          </div>
          <span className="text-text-muted">{expanded['step_d'] ? '▲' : '▼'}</span>
        </div>
        {expanded['step_d'] && progress?.step_b && (
          <div className="border-t border-border bg-bg-row p-3">
            <div className="text-xs space-y-3 mb-4">
              <p className="text-text-muted italic text-xs">
                Step D makes one decision: who gets checked in Step E. The hard filters in Step E cost time. We only run them on tickers most likely to survive. We take the top scorers by pre-score and send them forward. Everyone else is ranked out.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-border">
                  <thead>
                    <tr>
                      <th className="text-text-muted font-bold text-xs p-2 bg-bg-card border border-border">DATA POINT</th>
                      <th className="text-text-muted font-bold text-xs p-2 bg-bg-card border border-border">SOURCE</th>
                      <th className="text-text-muted font-bold text-xs p-2 bg-bg-card border border-border">WHEN APPLIED</th>
                      <th className="text-text-muted font-bold text-xs p-2 bg-bg-card border border-border">WHERE APPLIED</th>
                      <th className="text-text-muted font-bold text-xs p-2 bg-bg-card border border-border">WHY</th>
                      <th className="text-text-muted font-bold text-xs p-2 bg-bg-card border border-border">HOW / VALUE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Pre-Score', 'Step B', 'Step D selection', 'Top-N cutoff', 'Running expensive checks on every ticker wastes time. Only the highest-scoring candidates are worth checking', 'Top scorers advance. Cutoff score shown per ticker in the table below'],
                      ['Rank', 'Computed', 'Step D output', 'Step E input', 'Ordered list of highest-conviction candidates before hard filters run', 'Rank determines who gets checked in Step E'],
                    ].map(([dp, src, when, where, why, how], i) => (
                      <tr key={i}>
                        <td className="text-xs p-2 text-text-muted border border-border">{dp}</td>
                        <td className="text-xs p-2 text-text-muted border border-border">{src}</td>
                        <td className="text-xs p-2 text-text-muted border border-border">{when}</td>
                        <td className="text-xs p-2 text-text-muted border border-border">{where}</td>
                        <td className="text-xs p-2 text-text-muted border border-border">{why}</td>
                        <td className="text-xs p-2 text-text-muted border border-border">{how}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="text-text-muted text-xs font-bold mb-1">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              ALL TICKERS RANKED ({(progress?.step_b?.data?.tickers as any[] ?? []).filter((t: any) => !t.excluded).length} non-excluded)
            </p>
            <div className="overflow-y-auto" style={{maxHeight: '240px'}}>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-text-muted border-b border-border">
                    <th className="text-left py-1 pr-3">#</th>
                    <th className="text-left py-1 pr-3">SYMBOL</th>
                    <th className="text-right py-1 pr-3">PRE-SCORE</th>
                    <th className="text-right py-1 pr-3">RANK</th>
                    <th className="text-right py-1 pr-3">CUTOFF</th>
                    <th className="text-left py-1 pr-3">STATUS</th>
                    <th className="text-left py-1 pr-3">SOURCE</th>
                    <th className="text-left py-1 pr-3">ENDPOINT</th>
                    <th className="text-left py-1 pr-3">FETCHED</th>
                    <th className="text-right py-1">AGE</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const fetchedAt = progress?.step_a?.data?.fetched_at as string | undefined;
                    const fetchedTime = fetchedAt ? new Date(fetchedAt).toISOString().slice(11, 19) + ' UTC' : '—';
                    const ageSec = fetchedAt ? Math.round((Date.now() - new Date(fetchedAt).getTime()) / 1000) + 's' : '—';
                    const nonExcluded = (progress?.step_b?.data?.tickers as any[] ?? []).filter((t: any) => !t.excluded); // eslint-disable-line @typescript-eslint/no-explicit-any
                    const topN = progress?.step_e?.data?.input ?? 45;
                    const cutoffScore = nonExcluded[topN - 1]?.pre_score ?? '—';
                    return nonExcluded.map((t: any, i: number) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                      const selected = i < topN;
                      return (
                        <tr key={t.symbol} className="border-b border-border/50">
                          <td className="py-1 pr-3 text-text-muted">{i+1}</td>
                          <td className="py-1 pr-3 font-bold">{t.symbol}</td>
                          <td className={`py-1 pr-3 text-right font-bold ${selected ? 'text-brand-gold' : 'text-text-muted'}`}>
                            {t.pre_score}
                          </td>
                          <td className="py-1 pr-3 text-right text-text-muted">
                            #{i+1}
                          </td>
                          <td className="py-1 pr-3 text-right text-text-muted">
                            {cutoffScore}
                          </td>
                          <td className={`py-1 pr-3 ${selected ? 'text-brand-green' : 'text-brand-red'}`}>
                            {selected
                              ? `✓ Ranked #${i+1} — moves to hard filters`
                              : `✗ Ranked #${i+1} — below top ${topN} cutoff (score ${t.pre_score} vs cutoff ${cutoffScore})`
                            }
                          </td>
                          <td className="py-1 pr-3 text-text-muted text-[10px]">TastyTrade</td>
                          <td className="py-1 pr-3 text-text-muted text-[10px]">market-metrics</td>
                          <td className="py-1 pr-3 text-text-muted text-[10px]">{fetchedTime}</td>
                          <td className="py-1 text-right text-text-muted text-[10px]">{ageSec}</td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Step E — Hard Filters */}
      <div className="border-b border-border">
        <div className="px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-bg-row" onClick={() => toggle('step_e')}>
          <div className="flex items-center gap-3">
            <span className="text-brand-purple font-bold">STEP E</span>
            <span className="text-text-secondary">Hard Filters</span>
            {(hf?.output_count != null || progress?.step_e) ? (
              <span className="text-brand-red">{hf?.input_count ?? progress?.step_e?.data?.input ?? 0} → {hf?.output_count ?? progress?.step_e?.data?.output ?? 0} survived</span>
            ) : (
              <span className="text-text-muted animate-pulse">waiting...</span>
            )}
          </div>
          <span className="text-text-muted">{expanded['step_e'] ? '▲' : '▼'}</span>
        </div>
        {expanded['step_e'] && (
          <div className="border-t border-border bg-bg-row p-3">
            <div className="text-xs space-y-3 mb-4">
              <p className="text-text-muted italic text-xs">
                Step E runs six binary rules against the candidates from Step D. Pass all six or you are out. No scores, no partial credit. Each rule has a hard threshold. The table shows the actual value for every rule on every ticker.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-border">
                  <thead>
                    <tr>
                      <th className="text-text-muted font-bold text-xs p-2 bg-bg-card border border-border">DATA POINT</th>
                      <th className="text-text-muted font-bold text-xs p-2 bg-bg-card border border-border">SOURCE</th>
                      <th className="text-text-muted font-bold text-xs p-2 bg-bg-card border border-border">WHEN APPLIED</th>
                      <th className="text-text-muted font-bold text-xs p-2 bg-bg-card border border-border">WHERE APPLIED</th>
                      <th className="text-text-muted font-bold text-xs p-2 bg-bg-card border border-border">WHY</th>
                      <th className="text-text-muted font-bold text-xs p-2 bg-bg-card border border-border">HOW / VALUE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Market Cap', 'Step A', 'Step E filter', 'Rule 1 — must be >$2B', 'Small companies have thin options markets. Low open interest, wide spreads, hard to exit', 'Below $2B = eliminated'],
                      ['Liquidity Rating', 'Step A', 'Step E filter', 'Rule 2 — must be ≥2/5', 'Below 2/5 the bid-ask spread makes profitable trading impossible', 'Below 2/5 = eliminated'],
                      ['IV30', 'Step A', 'Step E filter', 'Rule 3 — must exist and >0', 'No IV data means we cannot price options. No IV = no trade', 'Missing or zero = eliminated'],
                      ['Borrow Rate', 'Step A', 'Step E filter', 'Rule 4 — must be <50%', 'Hard-to-borrow stocks are short squeeze candidates. Violent squeezes break option pricing', 'Above 50% = eliminated'],
                      ['Days to Earnings', 'Step A', 'Step E filter', 'Rule 5 — must be >7 days', 'IV spikes into earnings then collapses after. Entering into earnings destroys the edge', 'Within 7 days = eliminated'],
                      ['Reg SHO Status', 'SEC FINRA daily list', 'Step E filter', 'Rule 6 — must not be on list', 'Stocks with persistent delivery failures carry elevated short squeeze risk', 'On list = eliminated'],
                    ].map(([dp, src, when, where, why, how], i) => (
                      <tr key={i}>
                        <td className="text-xs p-2 text-text-muted border border-border">{dp}</td>
                        <td className="text-xs p-2 text-text-muted border border-border">{src}</td>
                        <td className="text-xs p-2 text-text-muted border border-border">{when}</td>
                        <td className="text-xs p-2 text-text-muted border border-border">{where}</td>
                        <td className="text-xs p-2 text-text-muted border border-border">{why}</td>
                        <td className="text-xs p-2 text-text-muted border border-border">{how}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {/* Full matrix table */}
            <p className="text-text-muted text-xs font-bold mb-1">
              ALL {bData?.input ?? '?'} TICKERS — 6 FILTER MATRIX
            </p>
            <div className="overflow-x-auto overflow-y-auto" style={{maxHeight: '300px'}}>
              <table className="w-full text-xs whitespace-nowrap">
                <thead>
                  <tr className="text-text-muted border-b border-border sticky top-0 bg-bg-card">
                    <th className="text-left py-1 pr-2">#</th>
                    <th className="text-left py-1 pr-2">SYMBOL</th>
                    <th className="text-right py-1 pr-2">MKT CAP<br/><span className="font-normal text-[9px]">&gt;$2B</span></th>
                    <th className="text-right py-1 pr-2">LIQ<br/><span className="font-normal text-[9px]">≥2/5</span></th>
                    <th className="text-right py-1 pr-2">IV30<br/><span className="font-normal text-[9px]">exists</span></th>
                    <th className="text-right py-1 pr-2">BORROW<br/><span className="font-normal text-[9px]">&lt;50%</span></th>
                    <th className="text-right py-1 pr-2">EARNINGS<br/><span className="font-normal text-[9px]">&gt;7d</span></th>
                    <th className="text-right py-1 pr-2">REG SHO<br/><span className="font-normal text-[9px]">not on list</span></th>
                    <th className="text-left py-1 pr-2">RESULT</th>
                    <th className="text-left py-1 pr-2">SOURCE</th>
                    <th className="text-left py-1 pr-2">ENDPOINT</th>
                    <th className="text-left py-1 pr-2">FETCHED</th>
                    <th className="text-right py-1">AGE</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    /* eslint-disable @typescript-eslint/no-explicit-any */
                    const fetchedAt = progress?.step_a?.data?.fetched_at as string | undefined;
                    const fetchedTime = fetchedAt ? new Date(fetchedAt).toISOString().slice(11, 19) + ' UTC' : '—';
                    const ageSec = fetchedAt ? Math.round((Date.now() - new Date(fetchedAt).getTime()) / 1000) + 's' : '—';
                    const survivorSyms: string[] = bData?.survivors ?? [];
                    const rejections: Record<string, any> = bData?.ticker_rejections ?? {};
                    const details: Record<string, any> = bData?.ticker_details ?? {};

                    // Build full list: survivors + rejected, sorted alphabetically
                    const allTickers = [
                      ...survivorSyms.map(sym => ({ symbol: sym, rejected: false, failedFilter: null as string | null })),
                      ...Object.entries(rejections).map(([sym, r]: [string, any]) => ({ symbol: sym, rejected: true, failedFilter: r.filter as string | null })),
                    ].sort((a, b) => a.symbol.localeCompare(b.symbol));

                    const cell = (ok: boolean, value: string, isFailedFilter?: boolean) => (
                      <td className={`py-1 pr-2 text-right rounded ${isFailedFilter ? 'bg-red-900/40 text-brand-red font-bold' : ok ? 'text-brand-green' : 'text-brand-red'}`}>
                        {value} {ok ? '✓' : '✗'}
                      </td>
                    );

                    const warnings: Record<string, any> = bData?.ticker_warnings ?? {};

                    return allTickers.map((t, i) => {
                      const d = details[t.symbol] ?? {};
                      const capOk = (d.market_cap ?? 0) >= 2e9;
                      const liqOk = (d.liquidity_rating ?? 0) >= 2;
                      const ivOk = (d.iv30 ?? 0) > 0;
                      const borrowOk = d.borrow_rate == null || d.borrow_rate < 50;
                      const earningsOk = d.days_till_earnings == null || d.days_till_earnings > 7;
                      const regSho = d.reg_sho === true;
                      const regShoOk = !regSho;
                      const ff = t.failedFilter;
                      const borrowWarning = warnings[t.symbol];
                      const borrowCell = borrowWarning
                        ? <td className="py-1 pr-2 text-right text-brand-gold">— ⚠</td>
                        : cell(borrowOk, d.borrow_rate != null ? d.borrow_rate+'%' : '—', ff === 'Borrow Rate');
                      return (
                        <tr key={t.symbol} className={`border-b border-border/50 ${t.rejected ? 'opacity-75' : ''}`}>
                          <td className="py-1 pr-2 text-text-muted">{i+1}</td>
                          <td className={`py-1 pr-2 font-bold ${t.rejected ? 'text-brand-red' : 'text-brand-green'}`}>{t.symbol}</td>
                          {cell(capOk, d.market_cap ? '$'+(d.market_cap/1e9).toFixed(1)+'B' : '—', ff === 'Market Cap')}
                          {cell(liqOk, d.liquidity_rating != null ? d.liquidity_rating+'/5' : '—', ff === 'Options Liquidity')}
                          {cell(ivOk, d.iv30 != null ? d.iv30.toFixed(2) : '—', ff === 'IV Data')}
                          {borrowCell}
                          {cell(earningsOk, d.days_till_earnings != null ? d.days_till_earnings+'d' : '—', ff === 'Earnings Timing')}
                          {cell(regShoOk, regSho ? '✗ threshold' : '✓ clear', ff === 'Reg SHO')}
                          <td className={`py-1 pr-2 font-bold ${t.rejected ? 'text-brand-red' : 'text-brand-green'}`}>
                            {t.rejected ? '✗ REJECTED' : '✓ PASSED'}
                          </td>
                          <td className="py-1 pr-2 text-text-muted text-[10px]">TastyTrade</td>
                          <td className="py-1 pr-2 text-text-muted text-[10px]">market-metrics</td>
                          <td className="py-1 pr-2 text-text-muted text-[10px]">{fetchedTime}</td>
                          <td className="py-1 text-right text-text-muted text-[10px]">{ageSec}</td>
                        </tr>
                      );
                    });
                    /* eslint-enable @typescript-eslint/no-explicit-any */
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Step F — Peer Grouping */}
      <div className="border-b border-border">
        <div className="px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-bg-row" onClick={() => toggle('step_f')}>
          <div className="flex items-center gap-3">
            <span className="text-brand-purple font-bold">STEP F</span>
            <span className="text-text-secondary">Peer Grouping</span>
            {progress?.step_e ? (
              <span className="text-brand-green">Finnhub peer relationships mapped</span>
            ) : (
              <span className="text-text-muted animate-pulse">waiting...</span>
            )}
          </div>
          <span className="text-text-muted">{expanded['step_f'] ? '▲' : '▼'}</span>
        </div>
        {expanded['step_f'] && (
          <div className="border-t border-border bg-bg-row p-3">
            <div className="text-xs space-y-3 mb-4">
              <p className="text-text-muted italic text-xs">
                Step F answers one question: is this stock&apos;s volatility high compared to companies just like it? We pull peer groups from Finnhub and compute z-scores — how many standard deviations each stock sits above or below its peers. Context matters more than raw numbers.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-border">
                  <thead>
                    <tr>
                      <th className="text-text-muted font-bold text-xs p-2 bg-bg-card border border-border">DATA POINT</th>
                      <th className="text-text-muted font-bold text-xs p-2 bg-bg-card border border-border">SOURCE</th>
                      <th className="text-text-muted font-bold text-xs p-2 bg-bg-card border border-border">WHEN APPLIED</th>
                      <th className="text-text-muted font-bold text-xs p-2 bg-bg-card border border-border">WHERE APPLIED</th>
                      <th className="text-text-muted font-bold text-xs p-2 bg-bg-card border border-border">WHY</th>
                      <th className="text-text-muted font-bold text-xs p-2 bg-bg-card border border-border">HOW / VALUE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Peer group', 'Finnhub /stock/peers', 'Step F fetch', 'Z-score computation', 'Comparing a tech stock\'s IV to a utility\'s IV is meaningless. Peers provide the right baseline', 'Groups each stock with its actual industry competitors'],
                      ['IV Percentile z-score', 'Computed from peer group', 'Step F output', 'Step K Info Edge gate', 'Peer-relative IV is more actionable than market-wide IV. Institutions trade relative value', 'Outlier z-score signals the stock is unusually cheap or expensive vs peers'],
                      ['IV30 z-score', 'Computed from peer group', 'Step F output', 'Step K Vol Edge gate', 'Confirms whether implied move is elevated relative to similar companies', 'High positive z-score = vol is expensive relative to peers'],
                      ['Beta z-score', 'Computed from peer group', 'Step F output', 'Step K Regime gate', 'Shows whether this stock moves more or less than its sector', 'Used to calibrate regime sensitivity per ticker'],
                      ['GICS sector fallback', 'TastyTrade sector data', 'Step F fallback', 'Peer grouping when Finnhub peers unavailable', 'Some tickers have no Finnhub peers. Sector grouping ensures every ticker gets a peer comparison', 'Flagged with ⚠ in the TYPE column'],
                    ].map(([dp, src, when, where, why, how], i) => (
                      <tr key={i}>
                        <td className="text-xs p-2 text-text-muted border border-border">{dp}</td>
                        <td className="text-xs p-2 text-text-muted border border-border">{src}</td>
                        <td className="text-xs p-2 text-text-muted border border-border">{when}</td>
                        <td className="text-xs p-2 text-text-muted border border-border">{where}</td>
                        <td className="text-xs p-2 text-text-muted border border-border">{why}</td>
                        <td className="text-xs p-2 text-text-muted border border-border">{how}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="text-text-muted text-xs font-bold mb-1">
              PEER GROUPING — ALL {' '}{(progress?.step_f?.data?.groups ?? []).length} SURVIVORS
            </p>
            <div className="overflow-x-auto overflow-y-auto" style={{maxHeight: '280px'}}>
              <table className="w-full text-xs whitespace-nowrap">
                <thead>
                  <tr className="text-text-muted border-b border-border sticky top-0 bg-bg-card">
                    <th className="text-left py-1 pr-3">#</th>
                    <th className="text-left py-1 pr-3">SYMBOL</th>
                    <th className="text-left py-1 pr-3">PEER GROUP</th>
                    <th className="text-right py-1 pr-3">PEERS</th>
                    <th className="text-right py-1 pr-3">MY IV%</th>
                    <th className="text-right py-1 pr-3">PEER AVG IV%</th>
                    <th className="text-right py-1 pr-3">Z-SCORE IV%<br/><span className="font-normal text-[9px]">vs peers</span></th>
                    <th className="text-right py-1 pr-3">MY IV30</th>
                    <th className="text-right py-1 pr-3">PEER AVG IV30</th>
                    <th className="text-right py-1 pr-3">Z-SCORE IV30<br/><span className="font-normal text-[9px]">vs peers</span></th>
                    <th className="text-right py-1 pr-3">Z-SCORE &beta;<br/><span className="font-normal text-[9px]">vs peers</span></th>
                    <th className="text-left py-1 pr-3">FORMULA<br/><span className="font-normal text-[9px]">(my−mean)/stdev</span></th>
                    <th className="text-left py-1">TYPE</th>
                    <th className="text-left py-1 pr-3">SOURCE</th>
                    <th className="text-left py-1 pr-3">ENDPOINT</th>
                    <th className="text-left py-1 pr-3">FETCHED</th>
                    <th className="text-right py-1">AGE</th>
                  </tr>
                </thead>
                <tbody>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(() => {
                    const fetchedAt = progress?.step_a?.data?.fetched_at as string | undefined;
                    const fetchedTime = fetchedAt ? new Date(fetchedAt).toISOString().slice(11,19) + ' UTC' : '—';
                    const ageSec = fetchedAt ? Math.round((Date.now() - new Date(fetchedAt).getTime()) / 1000) + 's' : '—';
                    return (progress?.step_f?.data?.groups ?? []).map((g: any, i: number) => {
                    const zColor = (z: string | null) => {
                      if (z == null) return 'text-text-muted';
                      const n = parseFloat(z);
                      if (n >= 1.5) return 'text-brand-green font-bold';
                      if (n >= 0.5) return 'text-brand-gold';
                      if (n <= -1.5) return 'text-brand-red';
                      return 'text-text-muted';
                    };
                    return (
                      <tr key={g.symbol} className="border-b border-border/50">
                        <td className="py-1 pr-3 text-text-muted">{i+1}</td>
                        <td className="py-1 pr-3 font-bold">{g.symbol}</td>
                        <td className="py-1 pr-3 text-text-muted max-w-[200px] overflow-hidden text-ellipsis">
                          {g.insufficient_peers ? '⚠ '+g.peer_group : g.peer_group}
                        </td>
                        <td className="py-1 pr-3 text-right">{g.peer_count}</td>
                        <td className="py-1 pr-3 text-right">
                          {g.my_iv_percentile != null ? Number(g.my_iv_percentile).toFixed(1) : '—'}
                        </td>
                        <td className="py-1 pr-3 text-right text-text-muted">{g.peer_mean_iv ?? '—'}</td>
                        <td className={`py-1 pr-3 text-right ${zColor(g.z_iv_percentile)}`}>
                          {g.z_iv_percentile != null ? (parseFloat(g.z_iv_percentile) >= 0 ? '+' : '')+g.z_iv_percentile : '—'}
                        </td>
                        <td className="py-1 pr-3 text-right">
                          {g.my_iv30 != null ? Number(g.my_iv30).toFixed(1) : '—'}
                        </td>
                        <td className="py-1 pr-3 text-right text-text-muted">{g.peer_mean_iv30 ?? '—'}</td>
                        <td className={`py-1 pr-3 text-right ${zColor(g.z_iv30)}`}>
                          {g.z_iv30 != null ? (parseFloat(g.z_iv30) >= 0 ? '+' : '')+g.z_iv30 : '—'}
                        </td>
                        <td className={`py-1 pr-3 text-right ${zColor(g.z_beta)}`}>
                          {g.z_beta != null ? (parseFloat(g.z_beta) >= 0 ? '+' : '')+g.z_beta : '—'}
                        </td>
                        {(() => {
                          const ivZFormula = (() => {
                            const my = g.my_iv_percentile;
                            const mean = g.peer_mean_iv != null ? parseFloat(g.peer_mean_iv) : null;
                            const std = g.peer_stdev_iv;
                            if (my == null || mean == null || std == null || std === 0) return '—';
                            return `(${Number(my).toFixed(1)}−${mean.toFixed(1)})/${std.toFixed(2)}=${g.z_iv_percentile}`;
                          })();
                          return (
                            <td className="py-1 pr-3 text-text-muted font-mono text-[10px]">
                              {ivZFormula}
                            </td>
                          );
                        })()}
                        <td className="py-1 text-text-muted text-[10px]">{g.group_type}</td>
                        <td className="py-1 pr-3 text-text-muted text-[10px]">TastyTrade</td>
                        <td className="py-1 pr-3 text-text-muted text-[10px]">market-metrics</td>
                        <td className="py-1 pr-3 text-text-muted text-[10px]">{fetchedTime}</td>
                        <td className="py-1 text-right text-text-muted text-[10px]">{ageSec}</td>
                      </tr>
                    );
                  });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Step G — Pre-Score */}
      <div className="border-b border-border">
        <div className="px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-bg-row" onClick={() => toggle('step_g')}>
          <div className="flex items-center gap-3">
            <span className="text-brand-purple font-bold">STEP G</span>
            <span className="text-text-secondary">Pre-Score</span>
            {(ps?.finnhub_fetched != null || progress?.step_g) ? (
              <span className="text-brand-gold">{bData?.output ?? 0} → {ps?.finnhub_fetched ?? progress?.step_g?.data?.candidates ?? 0} selected for enrichment</span>
            ) : (
              <span className="text-text-muted animate-pulse">waiting...</span>
            )}
          </div>
          <span className="text-text-muted">{expanded['step_g'] ? '▲' : '▼'}</span>
        </div>
        {expanded['step_g'] && (
          <div className="border-t border-border bg-bg-row p-3">
            <div className="text-xs space-y-3 mb-4">
              <p className="text-text-muted italic text-xs">
                Step G re-scores the survivors with a more precise formula now that the field is small enough to be exact. Same three signals as Step B but with different weights. The top scorers get the expensive institutional data pull in Steps H, I, and J.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-border">
                  <thead>
                    <tr>
                      <th className="text-text-muted font-bold text-xs p-2 bg-bg-card border border-border">DATA POINT</th>
                      <th className="text-text-muted font-bold text-xs p-2 bg-bg-card border border-border">SOURCE</th>
                      <th className="text-text-muted font-bold text-xs p-2 bg-bg-card border border-border">WHEN APPLIED</th>
                      <th className="text-text-muted font-bold text-xs p-2 bg-bg-card border border-border">WHERE APPLIED</th>
                      <th className="text-text-muted font-bold text-xs p-2 bg-bg-card border border-border">WHY</th>
                      <th className="text-text-muted font-bold text-xs p-2 bg-bg-card border border-border">HOW / VALUE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['IV Percentile', 'Step A', 'Step G scoring', 'Pre-score formula (40% weight)', 'More precise than IV Rank for a small pool — captures where current IV sits vs the full distribution', 'IV Percentile × 0.40'],
                      ['IV-HV Spread', 'Step A', 'Step G scoring', 'Pre-score formula (30% weight)', 'Confirms premium exists. Lower weight than Step B because Step C already removed negative-spread tickers', 'Normalized spread × 0.30'],
                      ['Liquidity Rating', 'Step A', 'Step G scoring', 'Pre-score formula (30% weight)', 'Higher weight than Step B — with hard filters done tradability is more critical to rank precisely', 'Rating/5 × 0.30'],
                      ['Step G Score', 'Computed', 'Step G output', 'Steps H I J enrichment order', 'Determines which tickers get expensive data fetches first', 'All survivors advance but ranking matters for tie-breaking'],
                    ].map(([dp, src, when, where, why, how], i) => (
                      <tr key={i}>
                        <td className="text-xs p-2 text-text-muted border border-border">{dp}</td>
                        <td className="text-xs p-2 text-text-muted border border-border">{src}</td>
                        <td className="text-xs p-2 text-text-muted border border-border">{when}</td>
                        <td className="text-xs p-2 text-text-muted border border-border">{where}</td>
                        <td className="text-xs p-2 text-text-muted border border-border">{why}</td>
                        <td className="text-xs p-2 text-text-muted border border-border">{how}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="text-text-muted text-xs font-bold mb-1">
              ALL {progress?.step_g?.data?.total ?? '—'} SURVIVORS RANKED — TOP {progress?.step_g?.data?.candidates ?? 18} SELECTED FOR ENRICHMENT
            </p>
            <div className="overflow-x-auto overflow-y-auto" style={{maxHeight: '280px'}}>
              <table className="w-full text-xs whitespace-nowrap">
                <thead>
                  <tr className="text-text-muted border-b border-border sticky top-0 bg-bg-card">
                    <th className="text-left py-1 pr-3">RANK</th>
                    <th className="text-left py-1 pr-3">SYMBOL</th>
                    <th className="text-right py-1 pr-3">IV%<br/><span className="font-normal text-[9px]">×40%</span></th>
                    <th className="text-right py-1 pr-3">IV-HV<br/><span className="font-normal text-[9px]">×30%</span></th>
                    <th className="text-right py-1 pr-3">LIQ<br/><span className="font-normal text-[9px]">×30%</span></th>
                    <th className="text-left py-1 pr-3">CALCULATION</th>
                    <th className="text-right py-1 pr-3">SCORE</th>
                    <th className="text-left py-1">STATUS</th>
                    <th className="text-left py-1 pr-3">SOURCE</th>
                    <th className="text-left py-1 pr-3">ENDPOINT</th>
                    <th className="text-left py-1 pr-3">FETCHED</th>
                    <th className="text-right py-1">AGE</th>
                  </tr>
                </thead>
                <tbody>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(() => {
                    const fetchedAt = progress?.step_a?.data?.fetched_at as string | undefined;
                    const fetchedTime = fetchedAt ? new Date(fetchedAt).toISOString().slice(11,19) + ' UTC' : '—';
                    const ageSec = fetchedAt ? Math.round((Date.now() - new Date(fetchedAt).getTime()) / 1000) + 's' : '—';
                    return (progress?.step_g?.data?.pre_scores ?? []).map((t: any) => {
                    const ivpC = ((t.ivp ?? 0) * 0.4).toFixed(1);
                    const ivhvC = (Math.min(Math.abs(t.iv_hv_spread ?? 0) / 20 * 100, 100) * 0.3).toFixed(1);
                    const liqC = (((t.liquidity ?? 0) / 5) * 100 * 0.3).toFixed(1);
                    return (
                      <tr key={t.symbol} className={`border-b border-border/50 ${!t.selected ? 'opacity-60' : ''}`}>
                        <td className="py-1 pr-3 text-text-muted">#{t.rank}</td>
                        <td className={`py-1 pr-3 font-bold ${t.selected ? 'text-brand-green' : 'text-text-muted'}`}>{t.symbol}</td>
                        <td className="py-1 pr-3 text-right">{t.ivp ?? '—'}</td>
                        <td className="py-1 pr-3 text-right">{t.iv_hv_spread ?? '—'}</td>
                        <td className="py-1 pr-3 text-right">{t.liquidity ?? '—'}/5</td>
                        <td className="py-1 pr-3 text-text-muted font-mono text-[10px]">
                          ({t.ivp ?? 0}×40%) + (min(|{t.iv_hv_spread ?? 0}|/20×100,100)×30%) + ({t.liquidity ?? 0}/5×100×30%) = {ivpC}+{ivhvC}+{liqC}
                        </td>
                        <td className={`py-1 pr-3 text-right font-bold ${t.selected ? 'text-brand-gold' : 'text-text-muted'}`}>{t.pre_score}</td>
                        <td className={`py-1 ${t.selected ? 'text-brand-green' : 'text-brand-red'}`}>
                          {t.selected
                            ? '✓ Selected for enrichment'
                            : `✗ ${t.reason?.replace('✗ ', '') ?? 'Ranked out'}`
                          }
                        </td>
                        <td className="py-1 pr-3 text-text-muted text-[10px]">TastyTrade</td>
                        <td className="py-1 pr-3 text-text-muted text-[10px]">market-metrics</td>
                        <td className="py-1 pr-3 text-text-muted text-[10px]">{fetchedTime}</td>
                        <td className="py-1 text-right text-text-muted text-[10px]">{ageSec}</td>
                      </tr>
                    );
                  });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Step H — Macro & Regime Data */}
      <div className="border-b border-border">
        <div className="px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-bg-row" onClick={() => toggle('step_h')}>
          <div className="flex items-center gap-3">
            <span className="text-brand-purple font-bold">STEP H</span>
            <span className="text-text-secondary">Macro &amp; Regime Data</span>
            {progress?.step_h ? (
              <span className="text-brand-green">
                {(progress.step_h.data?.series as any[])?.length ?? 0} FRED series fetched
              </span>
            ) : (
              <span className="text-text-muted animate-pulse">waiting...</span>
            )}
          </div>
          <span className="text-text-muted">{expanded['step_h'] ? '▲' : '▼'}</span>
        </div>
        {expanded['step_h'] && (
          <div className="border-t border-border bg-bg-row p-3">
            <div className="text-xs space-y-3 mb-4">
              <p className="text-text-muted italic text-xs">
                Step H pulls all macro data from FRED in a single batch. This is market-wide data — not per ticker. It tells us what the economic environment looks like right now. The Regime gate in Step K reads all of this to classify the current regime and adjust the scoring weights.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-border">
                  <thead>
                    <tr>
                      <th className="text-text-muted font-bold text-xs p-2 bg-bg-card border border-border">DATA POINT</th>
                      <th className="text-text-muted font-bold text-xs p-2 bg-bg-card border border-border">SOURCE</th>
                      <th className="text-text-muted font-bold text-xs p-2 bg-bg-card border border-border">WHEN APPLIED</th>
                      <th className="text-text-muted font-bold text-xs p-2 bg-bg-card border border-border">WHERE APPLIED</th>
                      <th className="text-text-muted font-bold text-xs p-2 bg-bg-card border border-border">WHY</th>
                      <th className="text-text-muted font-bold text-xs p-2 bg-bg-card border border-border">HOW / VALUE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['VIX / VIX3M', 'FRED VIXCLS / VXVCLS', 'Step H fetch', 'Step K Regime gate, Vol Edge gate', 'VIX measures market fear. Term structure slope tells us whether vol is in contango or backwardation', 'Slope <1 = contango = favorable for vol selling. Slope >1 = caution'],
                      ['VVIX', 'FRED VVIXCLS', 'Step H fetch', 'Step K Vol Edge gate', 'Volatility of volatility. Elevated VVIX means the vol surface is unstable — bad for premium selling', 'High VVIX reduces Vol Edge scores'],
                      ['Fed Funds Rate', 'FRED FEDFUNDS', 'Step H fetch', 'Step K Regime gate, Black-Scholes PoP', 'Risk-free rate used in options pricing. Also signals monetary policy stance', 'Used as risk-free rate in N(d2) PoP calculation on the trade card'],
                      ['Yield Curve (10Y-2Y, 10Y-3M)', 'FRED T10Y2Y / T10Y3M', 'Step H fetch', 'Step K Regime gate', 'Inverted yield curve signals recession risk. Affects regime classification', 'Inversion detected = regime shifts toward Deflation or Stagflation'],
                      ['CPI / Inflation', 'FRED CPIAUCSL', 'Step H fetch', 'Step K Regime gate', 'Inflation level determines whether we are in Goldilocks, Reflation, or Stagflation', 'High CPI + low growth = Stagflation weights applied'],
                      ['HY / BBB Credit Spread', 'FRED BAMLH0A0HYM2 / BAMLC0A4CBBB', 'Step H fetch', 'Step K Regime gate', 'Credit stress is a leading indicator of market risk. Widening spreads signal deteriorating conditions', 'Spread above threshold shifts regime toward Crisis or Stagflation'],
                      ['Fed Net Liquidity', 'Computed: WALCL − WTREGEN − RRPONTSYD', 'Step H computation', 'Step K Regime gate', 'Net liquidity in the system drives risk asset performance. Tightening liquidity is bearish for vol selling', 'Declining net liquidity reduces Regime gate scores'],
                      ['Dollar Index', 'FRED DTWEXBGS', 'Step H fetch', 'Step K Regime gate', 'Strong dollar tightens global financial conditions. Risk-off signal', 'Dollar above threshold shifts Regime gate scores down'],
                      ['GDP / Unemployment / NFP', 'FRED GDPC1 / UNRATE / PAYEMS', 'Step H fetch', 'Step K Regime gate', 'Core growth signals. Determine whether we are in expansion or contraction', 'Low growth + high unemployment = Deflation or Stagflation classification'],
                    ].map(([dp, src, when, where, why, how], i) => (
                      <tr key={i}>
                        <td className="text-xs p-2 text-text-muted border border-border">{dp}</td>
                        <td className="text-xs p-2 text-text-muted border border-border">{src}</td>
                        <td className="text-xs p-2 text-text-muted border border-border">{when}</td>
                        <td className="text-xs p-2 text-text-muted border border-border">{where}</td>
                        <td className="text-xs p-2 text-text-muted border border-border">{why}</td>
                        <td className="text-xs p-2 text-text-muted border border-border">{how}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        {expanded['step_h'] && progress?.step_h?.data && (() => {
          const hd = progress.step_h.data;
          const series = (hd.series ?? []) as { name: string; key: string; value: number | null; source: string; series_id: string; null_reason: string | null }[];
          const computed = hd.computed as {
            fed_net_liquidity: { value: number | null; formula: string; inputs: { walcl: number | null; wtregen: number | null; rrpontsyd: number | null }; null_reason: string | null };
            vix_term_structure_slope: { value: number | null; formula: string; inputs: { vix: number | null; vxv: number | null }; null_reason: string | null };
          } | undefined;
          return (
            <div className="border-t border-border bg-bg-row p-3 text-xs space-y-4">
              {/* SECTION 1 — Computed Values */}
              <div className="space-y-3">
                <p className="text-text-secondary font-semibold">Computed Values</p>
                {/* Fed Net Liquidity */}
                <div className="bg-bg-primary p-2 rounded border border-border/50">
                  <div className="flex items-center gap-2">
                    <span className="text-text-primary font-medium">Fed Net Liquidity</span>
                    <span className="text-text-secondary">
                      {computed?.fed_net_liquidity?.value != null
                        ? `$${(computed.fed_net_liquidity.value / 1e6).toFixed(0)}M`
                        : '—'}
                    </span>
                  </div>
                  <div className="text-text-muted mt-1">
                    Formula: {computed?.fed_net_liquidity?.formula ?? '—'}
                  </div>
                  <div className="text-text-muted">
                    Inputs: WALCL={computed?.fed_net_liquidity?.inputs?.walcl != null ? `$${(computed.fed_net_liquidity.inputs.walcl / 1e6).toFixed(0)}M` : '—'}{' '}
                    · WTREGEN={computed?.fed_net_liquidity?.inputs?.wtregen != null ? `$${(computed.fed_net_liquidity.inputs.wtregen / 1e6).toFixed(0)}M` : '—'}{' '}
                    · RRPONTSYD={computed?.fed_net_liquidity?.inputs?.rrpontsyd != null ? `$${(computed.fed_net_liquidity.inputs.rrpontsyd / 1e6).toFixed(0)}M` : '—'}
                  </div>
                  {computed?.fed_net_liquidity?.null_reason && (
                    <div className="text-brand-red mt-1">{computed.fed_net_liquidity.null_reason}</div>
                  )}
                </div>
                {/* VIX Term Structure Slope */}
                <div className="bg-bg-primary p-2 rounded border border-border/50">
                  <div className="flex items-center gap-2">
                    <span className="text-text-primary font-medium">VIX Term Structure Slope</span>
                    <span className="text-text-secondary">
                      {computed?.vix_term_structure_slope?.value != null
                        ? computed.vix_term_structure_slope.value.toFixed(3)
                        : '—'}
                    </span>
                    {computed?.vix_term_structure_slope?.value != null && (
                      <span className={computed.vix_term_structure_slope.value < 1 ? 'text-brand-green' : 'text-brand-red'}>
                        {computed.vix_term_structure_slope.value < 1
                          ? '< 1 = contango (favorable)'
                          : '> 1 = backwardation (caution)'}
                      </span>
                    )}
                  </div>
                  <div className="text-text-muted mt-1">
                    Formula: {computed?.vix_term_structure_slope?.formula ?? '—'}
                  </div>
                  <div className="text-text-muted">
                    Inputs: VIX={computed?.vix_term_structure_slope?.inputs?.vix ?? '—'}{' '}
                    · VXV={computed?.vix_term_structure_slope?.inputs?.vxv ?? '—'}
                  </div>
                  {computed?.vix_term_structure_slope?.null_reason && (
                    <div className="text-brand-red mt-1">{computed.vix_term_structure_slope.null_reason}</div>
                  )}
                </div>
              </div>

              {/* SECTION 2 — Full FRED Series Table */}
              <div className="space-y-2">
                <p className="text-text-secondary font-semibold">FRED Series</p>
                <p className="text-text-muted">Fetched at: {hd.fetched_at as string ?? '—'}</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-border text-text-muted">
                        <th className="py-1 pr-3">SERIES</th>
                        <th className="py-1 pr-3">SERIES ID</th>
                        <th className="py-1 pr-3 text-right">VALUE</th>
                        <th className="py-1 pr-3">SOURCE</th>
                        <th className="py-1">NULL REASON</th>
                      </tr>
                    </thead>
                    <tbody>
                      {series.map((s) => (
                        <tr key={s.key} className="border-b border-border/30">
                          <td className="py-1 pr-3 text-text-primary">{s.name}</td>
                          <td className="py-1 pr-3 text-text-muted font-mono">{s.series_id}</td>
                          <td className="py-1 pr-3 text-right text-text-primary font-mono">
                            {s.value != null ? (typeof s.value === 'number' && Math.abs(s.value) >= 1000 ? s.value.toLocaleString() : s.value) : '—'}
                          </td>
                          <td className="py-1 pr-3 text-text-muted">{s.source}</td>
                          <td className="py-1 text-brand-red">{s.null_reason ?? ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SECTION 3 — Fetch Metadata */}
              <div className="space-y-1">
                <p className="text-text-secondary font-semibold">Fetch Metadata</p>
                <p className="text-text-muted">Fetch time: {hd.fetch_ms as number}ms</p>
                <p className="text-text-muted">Cached: {hd.cached ? 'yes' : 'no'}</p>
                <p className="text-text-muted">Source: FRED API (free, commercial use permitted)</p>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Step I — Data Enrichment */}
      <div className="border-b border-border">
        <div className="px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-bg-row" onClick={() => toggle('step_i')}>
          <div className="flex items-center gap-3">
            <span className="text-brand-purple font-bold">STEP I</span>
            <span className="text-text-secondary">Data Enrichment</span>
            {(ps?.finnhub_calls_made != null || progress?.step_i) ? (
              <span className="text-text-secondary">
                {ps?.finnhub_calls_made ?? progress?.step_i?.data?.finnhub_calls ?? 0} Finnhub calls
                {(ps?.finnhub_errors > 0 || (progress?.step_i?.data?.finnhub_errors ?? 0) > 0) && (
                  <span className="text-brand-red"> · {ps?.finnhub_errors ?? progress?.step_i?.data?.finnhub_errors} errors</span>
                )}
              </span>
            ) : (
              <span className="text-text-muted animate-pulse">waiting...</span>
            )}
          </div>
          <span className="text-text-muted">{expanded['step_i'] ? '▲' : '▼'}</span>
        </div>
        {expanded['step_i'] && (
          <div className="border-t border-border bg-bg-row p-3">
            <div className="text-xs space-y-3 mb-4">
              <p className="text-text-muted italic text-xs">
                Step I is the most expensive step. Multiple data sources per ticker. The question it answers is: why is IV elevated? A high IV rank tells you options are expensive. It does not tell you whether that is an opportunity or a warning. This step finds out.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-border">
                  <thead>
                    <tr>
                      <th className="text-text-muted font-bold text-xs p-2 bg-bg-card border border-border">DATA POINT</th>
                      <th className="text-text-muted font-bold text-xs p-2 bg-bg-card border border-border">SOURCE</th>
                      <th className="text-text-muted font-bold text-xs p-2 bg-bg-card border border-border">WHEN APPLIED</th>
                      <th className="text-text-muted font-bold text-xs p-2 bg-bg-card border border-border">WHERE APPLIED</th>
                      <th className="text-text-muted font-bold text-xs p-2 bg-bg-card border border-border">WHY</th>
                      <th className="text-text-muted font-bold text-xs p-2 bg-bg-card border border-border">HOW / VALUE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Earnings history / beat rate', 'Finnhub /stock/earnings', 'Step I fetch', 'Step K Info Edge gate, trade card SUE score', 'Beat rate tells you how reliably this company delivers. Consistent beats reduce surprise risk', 'High beat rate = higher earnings momentum score in Info Edge'],
                      ['Analyst ratings (B/H/S)', 'Finnhub /stock/recommendation', 'Step I fetch', 'Step K Info Edge gate', 'Wall Street consensus reflects institutional conviction. Heavy Buy-side = well-supported stock', 'Buy consensus = higher analyst consensus score'],
                      ['Insider sentiment (MSPR)', 'Finnhub /stock/insider-sentiment', 'Step I fetch', 'Step K Info Edge gate, Quality gate MSPR adjustment', 'Insiders know the company better than anyone. Net selling is a warning', 'Negative MSPR adjusts Quality gate score down'],
                      ['News sentiment', 'Finnhub /news-sentiment + FinBERT', 'Step I fetch', 'Step K Info Edge gate', 'Captures market narrative momentum before it shows up in price', '7-day sentiment score weighted into Info Edge'],
                      ['Institutional ownership', 'Finnhub /stock/ownership', 'Step I fetch', 'Step K Info Edge gate', 'High institutional ownership = well-researched, widely held, lower idiosyncratic risk', 'Holder count feeds institutional ownership sub-score'],
                      ['Earnings quality score', 'Finnhub /stock/earnings-quality-score', 'Step I fetch', 'Step K Quality gate', 'Measures whether reported profits reflect real cash generation or accounting adjustments', 'Low quality score reduces Quality gate'],
                      ['P/E ratio', 'Finnhub /stock/metric', 'Step I fetch', 'Step K Quality gate', 'Context for whether stock is priced at premium or discount vs peers', 'Used in peer comparison scoring'],
                      ['Quarterly financials', 'Finnhub /stock/financials', 'Step I fetch', 'Step K Quality gate (Piotroski, Altman Z)', 'Balance sheet and income statement power the financial safety scores', 'Weak financials reduce Quality gate'],
                      ['EBITDA / EBIT estimates', 'Finnhub /stock/ebitda-estimate + ebit-estimate', 'Step I fetch', 'Step K Quality gate', 'Estimate dispersion signals how uncertain analysts are about future earnings', 'High dispersion = elevated uncertainty = lower Quality score'],
                      ['Dividend history', 'Finnhub /stock/dividend', 'Step I fetch', 'Step K Quality gate, trade card', 'Upcoming ex-dividend dates affect options pricing and assignment risk', 'Ex-date proximity flagged in trade card risk section'],
                      ['Fund ownership', 'Finnhub /stock/fund-ownership', 'Step I fetch', 'Step K Info Edge gate (fund flow signal)', 'ETF and mutual fund flows create demand floor signals', 'Net fund buying = higher Info Edge score'],
                      ['SEC filings recency', 'SEC EDGAR', 'Step I fetch', 'Step K Info Edge gate (filing recency)', 'Company behind on filings is a compliance risk', 'Stale filings reduce Info Edge score'],
                      ['SEC 8-K scan', 'SEC EDGAR EFTS', 'Step I fetch', 'Step K Info Edge gate (material event flag)', 'Recent 8-Ks flag M&A, leadership changes, restatements — events that explain elevated IV', 'High 8-K count = material event risk flag on trade card'],
                    ].map(([dp, src, when, where, why, how], i) => (
                      <tr key={i}>
                        <td className="text-xs p-2 text-text-muted border border-border">{dp}</td>
                        <td className="text-xs p-2 text-text-muted border border-border">{src}</td>
                        <td className="text-xs p-2 text-text-muted border border-border">{when}</td>
                        <td className="text-xs p-2 text-text-muted border border-border">{where}</td>
                        <td className="text-xs p-2 text-text-muted border border-border">{why}</td>
                        <td className="text-xs p-2 text-text-muted border border-border">{how}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {progress?.step_i?.data?.data_gaps?.length > 0 && (
                <div className="p-2 bg-bg-card rounded border border-brand-red/30">
                  <p className="text-brand-red font-bold text-xs mb-1">DATA GAPS DETECTED</p>
                  {(progress?.step_i?.data?.data_gaps ?? []).map((gap: string, i: number) => (
                    <p key={i} className="text-brand-red text-xs">⚠ {gap}</p>
                  ))}
                </div>
              )}
            </div>
            <p className="text-text-muted text-xs font-bold mb-1">
              {progress?.step_i?.data?.finnhub_calls ?? '—'} FINNHUB CALLS — {progress?.step_i?.data?.tickers?.length ?? '—'} TICKERS ENRICHED
              {progress?.step_i?.data?.finnhub_errors > 0 && (
                <span className="text-brand-red ml-2">⚠ {progress?.step_i?.data?.finnhub_errors} ERRORS</span>
              )}
            </p>
            {(() => {
              const gFetchedAt = progress?.step_i?.data?.fetched_at as string | undefined;
              const gFetchedTime = gFetchedAt
                ? new Date(gFetchedAt).toISOString().slice(11,19) + ' UTC'
                : '—';
              const gAgeSec = gFetchedAt
                ? Math.round((Date.now() - new Date(gFetchedAt).getTime()) / 1000) + 's'
                : '—';
              const tickers = progress?.step_i?.data?.tickers ?? [];
              return (
                <>
                  {/* Table 1 — Finnhub Data */}
                  <div className="overflow-x-auto overflow-y-auto" style={{maxHeight: '300px'}}>
                    <table className="w-full text-xs whitespace-nowrap">
                      <thead>
                        <tr className="text-text-muted border-b border-border sticky top-0 bg-bg-card">
                          <th className="text-left py-1 pr-3">#</th>
                          <th className="text-left py-1 pr-3">SYMBOL</th>
                          <th className="text-right py-1 pr-3">EARNINGS<br/><span className="font-normal text-[9px]">beat/total</span></th>
                          <th className="text-right py-1 pr-3">BEAT RATE<br/><span className="font-normal text-[9px]">&gt;60% good</span></th>
                          <th className="text-left py-1 pr-3">ANALYST<br/><span className="font-normal text-[9px]">B/H/S</span></th>
                          <th className="text-right py-1 pr-3">INSIDER<br/><span className="font-normal text-[9px]">MSPR</span></th>
                          <th className="text-right py-1 pr-3">NEWS<br/><span className="font-normal text-[9px]">7d score</span></th>
                          <th className="text-right py-1 pr-3">INST OWN<br/><span className="font-normal text-[9px]">holders</span></th>
                          <th className="text-right py-1 pr-3">EQ SCORE<br/><span className="font-normal text-[9px]">letter/score</span></th>
                          <th className="text-right py-1 pr-3">P/E</th>
                          <th className="text-right py-1 pr-3">EBITDA EST<br/><span className="font-normal text-[9px]">count</span></th>
                          <th className="text-left py-1 pr-3">DIV EX DATE<br/><span className="font-normal text-[9px]">next</span></th>
                          <th className="text-right py-1 pr-3">52W HIGH</th>
                          <th className="text-right py-1 pr-3">52W LOW</th>
                          <th className="text-left py-1 pr-3">TOP FUND</th>
                          <th className="text-left py-1 pr-3">SOURCE</th>
                          <th className="text-left py-1 pr-3">ENDPOINT</th>
                          <th className="text-left py-1 pr-3">FETCHED</th>
                          <th className="text-right py-1">AGE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tickers.map((t: any, i: number) => {
                          const beatColor = t.beat_rate == null ? 'text-text-muted' : t.beat_rate >= 60 ? 'text-brand-green' : t.beat_rate >= 40 ? 'text-brand-gold' : 'text-brand-red';
                          const insiderColor = t.insider_sentiment == null ? 'text-text-muted' : t.insider_sentiment > 10 ? 'text-brand-green' : t.insider_sentiment < -10 ? 'text-brand-red' : 'text-brand-gold';
                          const newsColor = t.news_sentiment == null ? 'text-text-muted' : t.news_sentiment > 55 ? 'text-brand-green' : t.news_sentiment < 45 ? 'text-brand-red' : 'text-brand-gold';
                          return (
                            <tr key={t.symbol} className="border-b border-border/50">
                              <td className="py-1 pr-3 text-text-muted">{i+1}</td>
                              <td className="py-1 pr-3 font-bold">{t.symbol}</td>
                              <td className="py-1 pr-3 text-right">
                                {t.beat_count != null && t.earnings_quarters != null
                                  ? `${t.beat_count}/${t.earnings_quarters}`
                                  : '—'}
                              </td>
                              <td className={`py-1 pr-3 text-right font-bold ${beatColor}`}>{t.beat_rate != null ? t.beat_rate+'%' : '—'}</td>
                              <td className="py-1 pr-3 text-text-muted">{t.analyst_rating ?? '—'}</td>
                              <td className={`py-1 pr-3 text-right font-bold ${insiderColor}`}>{t.insider_sentiment != null ? t.insider_sentiment.toFixed(1) : '—'}</td>
                              <td className={`py-1 pr-3 text-right font-bold ${newsColor}`}>{t.news_sentiment != null ? t.news_sentiment.toFixed(1) : '—'}</td>
                              <td className="py-1 pr-3 text-right">{t.institutional_holders != null ? t.institutional_holders.toLocaleString() : '—'}</td>
                              <td className={`py-1 pr-3 text-right font-bold ${
                                t.earnings_quality_letter === 'A' || t.earnings_quality_letter === 'B'
                                  ? 'text-brand-green'
                                  : t.earnings_quality_letter === 'C'
                                  ? 'text-brand-gold'
                                  : t.earnings_quality_letter != null
                                  ? 'text-brand-red'
                                  : 'text-text-muted'
                              }`}>
                                {t.earnings_quality_letter != null && t.earnings_quality_score != null
                                  ? `${t.earnings_quality_letter} (${t.earnings_quality_score.toFixed(2)})`
                                  : '—'}
                              </td>
                              <td className="py-1 pr-3 text-right">{t.pe_ratio != null ? t.pe_ratio.toFixed(1) : '—'}</td>
                              <td className="py-1 pr-3 text-right">{t.ebitda_estimate_count != null ? t.ebitda_estimate_count : '—'}</td>
                              <td className="py-1 pr-3 text-text-muted">{t.next_ex_date ?? '—'}</td>
                              <td className="py-1 pr-3 text-right">{t.week52_high != null ? t.week52_high.toFixed(2) : '—'}</td>
                              <td className="py-1 pr-3 text-right">{t.week52_low != null ? t.week52_low.toFixed(2) : '—'}</td>
                              <td className="py-1 pr-3 text-left text-[10px]">{t.top_fund != null ? t.top_fund.slice(0, 12) : '—'}</td>
                              <td className="py-1 pr-3 text-text-muted text-[10px]">Finnhub</td>
                              <td className="py-1 pr-3 text-text-muted text-[10px] max-w-[180px] truncate">earnings·recommendation·insider-sentiment·news-sentiment·ownership·earnings-quality·metric·ebitda-estimate·dividend·fund-ownership</td>
                              <td className="py-1 pr-3 text-text-muted text-[10px]">{gFetchedTime}</td>
                              <td className="py-1 text-right text-text-muted text-[10px]">{gAgeSec}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Table 2 — SEC EDGAR Data */}
                  <div className="overflow-x-auto overflow-y-auto mt-3" style={{maxHeight: '200px'}}>
                    <table className="text-xs whitespace-nowrap">
                      <thead>
                        <tr className="text-text-muted border-b border-border sticky top-0 bg-bg-card">
                          <th className="text-left py-1 pr-3">#</th>
                          <th className="text-left py-1 pr-3">SYMBOL</th>
                          <th className="text-right py-1 pr-3">8-K<br/><span className="font-normal text-[9px]">30d</span></th>
                          <th className="text-left py-1 pr-3">SOURCE</th>
                          <th className="text-left py-1 pr-3">ENDPOINT</th>
                          <th className="text-left py-1 pr-3">FETCHED</th>
                          <th className="text-right py-1">AGE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tickers.map((t: any, i: number) => (
                          <tr key={t.symbol} className="border-b border-border/50">
                            <td className="py-1 pr-3 text-text-muted">{i+1}</td>
                            <td className="py-1 pr-3 font-bold">{t.symbol}</td>
                            <td className={`py-1 pr-3 text-right font-bold ${t.edgar_8k_count != null && t.edgar_8k_count > 0 ? 'text-brand-red' : 'text-text-muted'}`}>{t.edgar_8k_count != null ? t.edgar_8k_count : '—'}</td>
                            <td className="py-1 pr-3 text-text-muted text-[10px]">SEC EDGAR</td>
                            <td className="py-1 pr-3 text-text-muted text-[10px]">EFTS /search-index</td>
                            <td className="py-1 pr-3 text-text-muted text-[10px]">{gFetchedTime}</td>
                            <td className="py-1 text-right text-text-muted text-[10px]">{gAgeSec}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* Step J — Candle Data & Cross-Asset Correlations */}
      <div className="border-b border-border">
        <div className="px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-bg-row" onClick={() => toggle('step_j')}>
          <div className="flex items-center gap-3">
            <span className="text-brand-purple font-bold">STEP J</span>
            <span className="text-text-secondary">Candle Data &amp; Cross-Asset Correlations</span>
            {progress?.step_j?.data ? (
              <span className="text-brand-green">{progress.step_j.data.symbols_with_data} of {progress.step_j.data.symbols_requested} symbols have candle data</span>
            ) : (
              <span className="text-text-muted animate-pulse">waiting...</span>
            )}
          </div>
          <span className="text-text-muted">{expanded['step_j'] ? '▲' : '▼'}</span>
        </div>
        {expanded['step_j'] && progress?.step_j?.data && (
          <div className="border-t border-border bg-bg-row p-3">
            <p className="text-text-muted text-xs font-bold mb-1">
              {progress.step_j.data.total_candles} CANDLES — {progress.step_j.data.symbols_with_data}/{progress.step_j.data.symbols_requested} SYMBOLS — {progress.step_j.data.elapsed_ms}ms
              {progress.step_j.data.symbols_failed > 0 && (
                <span className="text-brand-red ml-2">⚠ {progress.step_j.data.symbols_failed} FAILED</span>
              )}
            </p>

            {/* Section 1 — Per-ticker candle table */}
            {(() => {
              const jFetchedAt = progress?.step_j?.data?.fetched_at as string | undefined;
              const jFetchedTime = jFetchedAt
                ? new Date(jFetchedAt).toISOString().slice(11,19) + ' UTC'
                : '—';
              const jAgeSec = jFetchedAt
                ? Math.round((Date.now() - new Date(jFetchedAt).getTime()) / 1000) + 's'
                : '—';
              const candlesPerSymbol = progress?.step_j?.data?.candles_per_symbol ?? [];
              return (
                <div className="overflow-x-auto overflow-y-auto" style={{maxHeight: '300px'}}>
                  <table className="w-full text-xs whitespace-nowrap">
                    <thead>
                      <tr className="text-text-muted border-b border-border sticky top-0 bg-bg-card">
                        <th className="text-left py-1 pr-3">#</th>
                        <th className="text-left py-1 pr-3">SYMBOL</th>
                        <th className="text-right py-1 pr-3">CANDLES</th>
                        <th className="text-left py-1 pr-3">SOURCE</th>
                        <th className="text-left py-1 pr-3">ENDPOINT</th>
                        <th className="text-left py-1 pr-3">FETCHED</th>
                        <th className="text-right py-1">AGE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {candlesPerSymbol.map((c: any, i: number) => (
                        <tr key={c.symbol} className="border-b border-border/50">
                          <td className="py-1 pr-3 text-text-muted">{i+1}</td>
                          <td className="py-1 pr-3 font-bold">{c.symbol}</td>
                          <td className={`py-1 pr-3 text-right font-bold ${c.candle_count != null && c.candle_count > 0 ? 'text-brand-green' : 'text-text-muted'}`}>{c.candle_count != null ? c.candle_count : '—'}</td>
                          <td className="py-1 pr-3 text-text-muted text-[10px]">{c.source}</td>
                          <td className="py-1 pr-3 text-text-muted text-[10px]">{c.endpoint}</td>
                          <td className="py-1 pr-3 text-text-muted text-[10px]">{jFetchedTime}</td>
                          <td className="py-1 text-right text-text-muted text-[10px]">{jAgeSec}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}

            {/* Section 2 — Cross-asset correlations */}
            <div className="mt-3 p-2 bg-bg-card rounded border border-border">
              <p className="text-text-muted text-xs font-bold mb-1">CROSS-ASSET CORRELATIONS</p>
              {progress.step_j.data.cross_asset_correlations?.available ? (
                <p className="text-xs text-brand-green">
                  Available — Source: {progress.step_j.data.cross_asset_correlations.source} | Endpoint: {progress.step_j.data.cross_asset_correlations.endpoint}
                </p>
              ) : (
                <p className="text-xs text-brand-red">
                  Not available — {progress.step_j.data.cross_asset_correlations?.null_reason ?? '—'}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Step K — 4-Gate Scoring */}
      <div className="border-b border-border">
        <div className="px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-bg-row" onClick={() => toggle('step_k')}>
          <div className="flex items-center gap-3">
            <span className="text-brand-purple font-bold">STEP K</span>
            <span className="text-text-secondary">4-Gate Scoring</span>
            {(ps?.scored != null || progress?.step_k) ? (
              <span className="text-brand-green">{ps?.scored ?? progress?.step_k?.data?.scored ?? 0} tickers scored</span>
            ) : (
              <span className="text-text-muted animate-pulse">waiting...</span>
            )}
          </div>
          <span className="text-text-muted">{expanded['step_k'] ? '▲' : '▼'}</span>
        </div>
        {expanded['step_k'] && (
          <div className="border-t border-border bg-bg-row p-3">
            <div className="text-xs space-y-3 mb-4">
              <p className="text-text-secondary">
                Step K scores every finalist 0–100 across 4 independent gates. Each gate asks a different question. The final score is a weighted average of all 4.
              </p>
              {/* 4 Gates explained */}
              <div className="grid grid-cols-1 gap-1 pt-1">
                {[
                  ['Vol Edge', 'Are the options mispriced? Measures IV vs Historical Volatility, term structure slope, and volatility risk premium. This is the core premium-selling signal.'],
                  ['Quality', 'Is this a safe company to sell premium on? Measures profitability, Piotroski F-Score, Altman Z-Score, and earnings quality. High IV on a company about to go bankrupt is not an edge — it is a trap.'],
                  ['Regime', 'What is the current macro environment? Reads 14 FRED data series — VIX, 10Y Treasury, Fed Funds rate, high yield spreads. Detects one of 5 regimes: Goldilocks, Reflation, Deflation, Stagflation, or Crisis.'],
                  ['Info Edge', 'What are insiders, analysts, and institutions signaling? Reads insider MSPR, analyst Buy/Hold/Sell consensus, 7-day news sentiment, and institutional ownership count.'],
                ].map(([gate, explanation], i) => (
                  <div key={i} className="flex gap-2 py-1 border-b border-border/30">
                    <span className="text-text-primary font-bold w-24 shrink-0">{gate}</span>
                    <span className="text-text-muted">{explanation}</span>
                  </div>
                ))}
              </div>
              {/* Regime weight table */}
              <div>
                <p className="text-text-primary font-bold mb-2">Gate Weights by Regime:</p>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-text-muted border-b border-border">
                      <th className="text-left py-1 pr-3">REGIME</th>
                      <th className="text-right py-1 pr-3">VOL EDGE</th>
                      <th className="text-right py-1 pr-3">QUALITY</th>
                      <th className="text-right py-1 pr-3">REGIME</th>
                      <th className="text-right py-1 pr-3">INFO EDGE</th>
                      <th className="text-left py-1 pl-3">WHY</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['GOLDILOCKS', '30%', '20%', '20%', '30%', 'Bull market — vol + info signals dominate'],
                      ['REFLATION', '30%', '20%', '25%', '25%', 'Recovery — vol edge as opportunity, regime confirms'],
                      ['DEFLATION', '20%', '35%', '25%', '20%', 'Contraction — quality critical to avoid blowups'],
                      ['STAGFLATION', '20%', '30%', '30%', '20%', 'Hardest to trade — regime + quality paramount'],
                      ['CRISIS', '15%', '40%', '30%', '15%', 'Quality paramount — vol surface unreliable'],
                    ].map(([regime, ve, q, r, ie, why]) => {
                      const isCurrent = progress?.step_k?.data?.regime === regime;
                      return (
                        <tr key={regime} className={`border-b border-border/30 ${isCurrent ? 'bg-brand-gold/10' : ''}`}>
                          <td className={`py-1 pr-3 font-bold ${isCurrent ? 'text-brand-gold' : 'text-text-muted'}`}>{isCurrent ? '▶ ' : ''}{regime}</td>
                          <td className="py-1 pr-3 text-right">{ve}</td>
                          <td className="py-1 pr-3 text-right">{q}</td>
                          <td className="py-1 pr-3 text-right">{r}</td>
                          <td className="py-1 pr-3 text-right">{ie}</td>
                          <td className="py-1 pl-3 text-text-muted">{why}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Current weights */}
              {progress?.step_k?.data?.weights && (
                <div className="p-2 bg-bg-card rounded border border-border">
                  <p className="text-text-primary font-bold mb-1">
                    Current weights (regime: <span className="text-brand-gold">{progress.step_k.data.regime as string}</span>):
                  </p>
                  <p className="text-brand-gold font-mono">
                    Composite = (Vol Edge × {(progress.step_k.data.weights as any).vol_edge}%) + (Quality × {(progress.step_k.data.weights as any).quality}%) + (Regime × {(progress.step_k.data.weights as any).regime}%) + (Info Edge × {(progress.step_k.data.weights as any).info_edge}%)
                  </p>
                </div>
              )}
              <div className="space-y-1">
                <p className="text-text-muted">
                  <span className="text-text-primary font-bold">Convergence requirement:</span>
                  {' '}3 or more gates must score above 50. A ticker with only 1 strong gate is not a convergent trade — something else is wrong with it.
                </p>
                <p className="text-text-muted">
                  The calculation for every ticker is shown below. Green gate = above 50. Red gate = below 50. Step S applies the final selection rules.
                </p>
              </div>
            </div>
            <p className="text-text-muted text-xs font-bold mb-1">
              {progress?.step_k?.data?.scored ?? '—'} TICKERS SCORED — 4-GATE MATRIX
            </p>
            <div className="overflow-x-auto overflow-y-auto" style={{maxHeight: '300px'}}>
              <table className="w-full text-xs whitespace-nowrap">
                <thead>
                  <tr className="text-text-muted border-b border-border sticky top-0 bg-bg-card">
                    <th className="text-left py-1 pr-3">RANK</th>
                    <th className="text-left py-1 pr-3">SYMBOL</th>
                    <th className="text-right py-1 pr-3">VOL EDGE<br/><span className="font-normal text-[9px]">{(progress?.step_k?.data?.weights as any)?.vol_edge ?? 25}% weight</span></th>
                    <th className="text-right py-1 pr-3">QUALITY<br/><span className="font-normal text-[9px]">{(progress?.step_k?.data?.weights as any)?.quality ?? 25}% weight</span></th>
                    <th className="text-right py-1 pr-3">REGIME<br/><span className="font-normal text-[9px]">{(progress?.step_k?.data?.weights as any)?.regime ?? 25}% weight</span></th>
                    <th className="text-right py-1 pr-3">INFO EDGE<br/><span className="font-normal text-[9px]">{(progress?.step_k?.data?.weights as any)?.info_edge ?? 25}% weight</span></th>
                    <th className="text-right py-1 pr-3">GATES<br/><span className="font-normal text-[9px]">above 50</span></th>
                    <th className="text-left py-1 pr-3">CALCULATION</th>
                    <th className="text-right py-1 pr-3">SCORE</th>
                    <th className="text-left py-1 pr-3">STATUS</th>
                    <th className="text-right py-1 pr-3">CONF<br/><span className="font-normal text-[9px]">data %</span></th>
                    <th className="text-right py-1 pr-3">SIZE<br/><span className="font-normal text-[9px]">position %</span></th>
                    <th className="text-left py-1 pr-3">FETCHED</th>
                    <th className="text-right py-1 pr-3">AGE</th>
                    <th className="text-left py-1 pr-3">SOURCE</th>
                    <th className="text-left py-1">ENDPOINT</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const hFetchedAt = progress?.step_k?.data?.fetched_at as string | undefined;
                    const hFetchedTime = hFetchedAt
                      ? new Date(hFetchedAt).toISOString().slice(11, 19) + ' UTC'
                      : '—';
                    const hAgeSec = hFetchedAt
                      ? Math.round((Date.now() - new Date(hFetchedAt).getTime()) / 1000) + 's'
                      : '—';
                    return (fData?.rankings ?? []).map((r: any, i: number) => {
                    const w = (progress?.step_k?.data?.weights as any) ?? { vol_edge: 25, quality: 25, regime: 25, info_edge: 25 };
                    const gateColor = (score: number) => score >= 50 ? 'text-brand-green font-bold' : 'text-brand-red';
                    const gatesAbove50 = [r.vol_edge, r.quality, r.regime, r.info_edge].filter((g: number) => g >= 50).length;
                    const veC = (r.vol_edge * w.vol_edge / 100).toFixed(1);
                    const qC = (r.quality * w.quality / 100).toFixed(1);
                    const rC = (r.regime * w.regime / 100).toFixed(1);
                    const ieC = (r.info_edge * w.info_edge / 100).toFixed(1);
                    const eligible = r.selection_status === 'eligible';
                    return (
                      <React.Fragment key={r.symbol}>
                      <tr className={`border-b border-border/50 cursor-pointer ${!eligible ? 'opacity-60' : ''}`} onClick={() => setHDrillDown(prev => ({ ...prev, [r.symbol]: !prev[r.symbol] }))}>
                        <td className="py-1 pr-3 text-text-muted">#{i+1}</td>
                        <td className={`py-1 pr-3 font-bold ${eligible ? 'text-brand-green' : 'text-text-muted'}`}>{r.symbol}</td>
                        <td className={`py-1 pr-3 text-right ${gateColor(r.vol_edge)}`}>{r.vol_edge}</td>
                        <td className={`py-1 pr-3 text-right ${gateColor(r.quality)}`}>{r.quality}</td>
                        <td className={`py-1 pr-3 text-right ${gateColor(r.regime)}`}>{r.regime}</td>
                        <td className={`py-1 pr-3 text-right ${gateColor(r.info_edge)}`}>{r.info_edge}</td>
                        <td className={`py-1 pr-3 text-right font-bold ${gatesAbove50 >= 3 ? 'text-brand-green' : gatesAbove50 === 2 ? 'text-brand-gold' : 'text-brand-red'}`}>{gatesAbove50}/4</td>
                        <td className="py-1 pr-3 text-text-muted font-mono text-[10px]">({r.vol_edge}×{w.vol_edge}%) + ({r.quality}×{w.quality}%) + ({r.regime}×{w.regime}%) + ({r.info_edge}×{w.info_edge}%) = {veC}+{qC}+{rC}+{ieC}</td>
                        <td className={`py-1 pr-3 text-right font-bold ${r.composite >= 60 ? 'text-brand-green' : r.composite >= 50 ? 'text-brand-gold' : 'text-text-muted'}`}>{r.composite}</td>
                        <td className={`py-1 pr-3 ${eligible ? 'text-brand-green' : 'text-brand-red'}`}>{eligible ? `✓ ${gatesAbove50}/4 gates — eligible` : `✗ ${gatesAbove50}/4 gates — needs 3`}</td>
                        <td className="py-1 pr-3 text-right text-text-muted">{r.data_confidence != null ? (r.data_confidence * 100).toFixed(0) + '%' : '—'}</td>
                        <td className="py-1 pr-3 text-right text-text-muted">{r.position_size_pct != null ? r.position_size_pct + '%' : '—'}</td>
                        <td className="py-1 pr-3 text-text-muted text-[10px]">{hFetchedTime}</td>
                        <td className="py-1 pr-3 text-right text-text-muted text-[10px]">{hAgeSec}</td>
                        <td className="py-1 pr-3 text-text-muted text-[10px]">Steps A–J</td>
                        <td className="py-1 text-text-muted text-[10px]">Composite — see Steps A–J</td>
                      </tr>
                      {hDrillDown[r.symbol] && (
                        <tr key={r.symbol + '_drill'}>
                          <td colSpan={16} className="py-2 px-3 bg-bg-card border-b border-border">
                            <div className="grid grid-cols-4 gap-3 text-xs">
                              {/* VOL EDGE */}
                              <div>
                                <p className="text-brand-purple font-bold mb-1">VOL EDGE {r.vol_edge}<span className="text-text-muted font-normal ml-1">— TastyTrade + Candles</span></p>
                                {r.vol_edge_detail && (
                                  <table className="w-full text-[10px]">
                                    <thead><tr className="text-text-muted border-b border-border"><th className="text-left py-0.5">COMPONENT</th><th className="text-right py-0.5">SCORE</th><th className="text-right py-0.5">WEIGHT</th><th className="text-right py-0.5">CONTRIB</th></tr></thead>
                                    <tbody>
                                      {[
                                        ['Mispricing', r.vol_edge_detail.mispricing],
                                        ['Term Structure', r.vol_edge_detail.term_structure],
                                        ['Technicals', r.vol_edge_detail.technicals],
                                        ['Skew', r.vol_edge_detail.skew],
                                        ['GEX', r.vol_edge_detail.gex],
                                      ].map(([name, d]: any) => (
                                        <tr key={name} className="border-b border-border/30">
                                          <td className="py-0.5 text-text-secondary">{name}</td>
                                          <td className="py-0.5 text-right">{d.score}</td>
                                          <td className="py-0.5 text-right text-text-muted">{(d.weight * 100).toFixed(0)}%</td>
                                          <td className="py-0.5 text-right text-brand-gold">{(d.score * d.weight).toFixed(1)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                                <p className="text-text-muted mt-1">Conf: {r.vol_edge_detail ? (r.vol_edge_detail.data_confidence * 100).toFixed(0) + '%' : '—'}</p>
                              </div>
                              {/* QUALITY */}
                              <div>
                                <p className="text-brand-purple font-bold mb-1">QUALITY {r.quality}<span className="text-text-muted font-normal ml-1">— Finnhub</span></p>
                                {r.quality_detail && (
                                  <table className="w-full text-[10px]">
                                    <thead><tr className="text-text-muted border-b border-border"><th className="text-left py-0.5">COMPONENT</th><th className="text-right py-0.5">SCORE</th><th className="text-right py-0.5">WEIGHT</th><th className="text-right py-0.5">CONTRIB</th></tr></thead>
                                    <tbody>
                                      {[
                                        ['Safety', r.quality_detail.safety],
                                        ['Profitability', r.quality_detail.profitability],
                                        ['Growth', r.quality_detail.growth],
                                        ['Fund. Risk', r.quality_detail.fundamental_risk],
                                      ].map(([name, d]: any) => (
                                        <tr key={name} className="border-b border-border/30">
                                          <td className="py-0.5 text-text-secondary">{name}</td>
                                          <td className="py-0.5 text-right">{d.score}</td>
                                          <td className="py-0.5 text-right text-text-muted">{(d.weight * 100).toFixed(0)}%</td>
                                          <td className="py-0.5 text-right text-brand-gold">{(d.score * d.weight).toFixed(1)}</td>
                                        </tr>
                                      ))}
                                      {r.quality_detail.mspr_adjustment !== 0 && (
                                        <tr className="border-b border-border/30">
                                          <td className="py-0.5 text-text-muted" colSpan={3}>MSPR adj</td>
                                          <td className={`py-0.5 text-right ${r.quality_detail.mspr_adjustment > 0 ? 'text-brand-green' : 'text-brand-red'}`}>{r.quality_detail.mspr_adjustment > 0 ? '+' : ''}{r.quality_detail.mspr_adjustment}</td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>
                                )}
                                <p className="text-text-muted mt-1">Conf: {r.quality_detail ? (r.quality_detail.data_confidence * 100).toFixed(0) + '%' : '—'}</p>
                              </div>
                              {/* REGIME */}
                              <div>
                                <p className="text-brand-purple font-bold mb-1">REGIME {r.regime}<span className="text-text-muted font-normal ml-1">— FRED</span></p>
                                {r.regime_detail && (
                                  <table className="w-full text-[10px]">
                                    <tbody>
                                      <tr className="border-b border-border/30"><td className="py-0.5 text-text-secondary">Regime</td><td className="py-0.5 text-right font-bold">{r.regime_detail.dominant_regime}</td></tr>
                                      <tr className="border-b border-border/30"><td className="py-0.5 text-text-secondary">Growth Signal</td><td className="py-0.5 text-right">{r.regime_detail.growth_score}</td></tr>
                                      <tr className="border-b border-border/30"><td className="py-0.5 text-text-secondary">Inflation Signal</td><td className="py-0.5 text-right">{r.regime_detail.inflation_score}</td></tr>
                                      <tr className="border-b border-border/30"><td className="py-0.5 text-text-secondary">SPY Multiplier</td><td className="py-0.5 text-right">{r.regime_detail.spy_multiplier}</td></tr>
                                      <tr className="border-b border-border/30"><td className="py-0.5 text-text-secondary">Base → Final</td><td className="py-0.5 text-right">{r.regime_detail.base_score} → {r.regime}</td></tr>
                                      <tr className="border-b border-border/30"><td className="py-0.5 text-text-secondary">VIX</td><td className="py-0.5 text-right">{r.regime_detail.raw_values.vix ?? '—'}</td></tr>
                                      <tr className="border-b border-border/30"><td className="py-0.5 text-text-secondary">GDP</td><td className="py-0.5 text-right">{r.regime_detail.raw_values.gdp ?? '—'}</td></tr>
                                      <tr className="border-b border-border/30"><td className="py-0.5 text-text-secondary">CPI YoY</td><td className="py-0.5 text-right">{r.regime_detail.raw_values.cpi_yoy ?? '—'}</td></tr>
                                      <tr className="border-b border-border/30"><td className="py-0.5 text-text-secondary">Fed Funds</td><td className="py-0.5 text-right">{r.regime_detail.raw_values.fed_funds ?? '—'}</td></tr>
                                      <tr className="border-b border-border/30"><td className="py-0.5 text-text-secondary">Yield Curve Spread</td><td className="py-0.5 text-right">{r.regime_detail.yield_curve_spread ?? '—'}</td></tr>
                                      <tr className="border-b border-border/30"><td className="py-0.5 text-text-secondary">HY Spread</td><td className="py-0.5 text-right">{r.regime_detail.hy_spread ?? '—'}</td></tr>
                                      <tr className="border-b border-border/30"><td className="py-0.5 text-text-secondary">Cross-Asset Corr</td><td className="py-0.5 text-right">{r.regime_detail.cross_asset_available ? 'Available' : '—'}</td></tr>
                                      <tr className="border-b border-border/30"><td className="py-0.5 text-text-secondary">BBB Spread</td><td className="py-0.5 text-right">{r.regime_detail.bbb_spread_raw != null ? `${r.regime_detail.bbb_spread_raw}%` : '—'} → score {r.regime_detail.bbb_spread ?? '—'}</td></tr>
                                      <tr className="border-b border-border/30"><td className="py-0.5 text-text-secondary">T10Y3M</td><td className="py-0.5 text-right">{r.regime_detail.t10y3m_raw != null ? `${r.regime_detail.t10y3m_raw}%` : '—'} → score {r.regime_detail.t10y3m ?? '—'}</td></tr>
                                      <tr className="border-b border-border/30"><td className="py-0.5 text-text-secondary">Dollar Index</td><td className="py-0.5 text-right">{r.regime_detail.dollar_index_raw ?? '—'} → score {r.regime_detail.dollar_index ?? '—'}</td></tr>
                                      <tr className="border-b border-border/30"><td className="py-0.5 text-text-secondary">Fed Net Liquidity</td><td className="py-0.5 text-right">{r.regime_detail.fed_net_liquidity_raw != null ? `$${r.regime_detail.fed_net_liquidity_raw}B` : '—'} → score {r.regime_detail.fed_net_liquidity ?? '—'}</td></tr>
                                    </tbody>
                                  </table>
                                )}
                                <p className="text-text-muted mt-1">Conf: {r.regime_detail ? (r.regime_detail.data_confidence * 100).toFixed(0) + '%' : '—'}</p>
                              </div>
                              {/* INFO EDGE */}
                              <div>
                                <p className="text-brand-purple font-bold mb-1">INFO EDGE {r.info_edge}<span className="text-text-muted font-normal ml-1">— Finnhub</span></p>
                                {r.info_edge_detail && (
                                  <table className="w-full text-[10px]">
                                    <thead><tr className="text-text-muted border-b border-border"><th className="text-left py-0.5">COMPONENT</th><th className="text-right py-0.5">SCORE</th><th className="text-right py-0.5">WEIGHT</th><th className="text-right py-0.5">CONTRIB</th></tr></thead>
                                    <tbody>
                                      {[
                                        ['Analyst', r.info_edge_detail.analyst_consensus],
                                        ['Price Target', r.info_edge_detail.price_target],
                                        ['Upgrades', r.info_edge_detail.upgrade_downgrade],
                                        ['Insider', r.info_edge_detail.insider_activity],
                                        ['Earnings Mom.', r.info_edge_detail.earnings_momentum],
                                        ['Flow', r.info_edge_detail.flow_signal],
                                        ['News', r.info_edge_detail.news_sentiment],
                                        ['Inst. Own.', r.info_edge_detail.institutional_ownership],
                                        ['Fund Flow', r.info_edge_detail.fund_flow],
                                        ['Material Event', r.info_edge_detail.material_event],
                                      ].map(([name, d]: any) => (
                                        <tr key={name} className="border-b border-border/30">
                                          <td className="py-0.5 text-text-secondary">{name}</td>
                                          <td className="py-0.5 text-right">{d ? d.score : '—'}</td>
                                          <td className="py-0.5 text-right text-text-muted">{d ? (d.weight * 100).toFixed(0) + '%' : '—'}</td>
                                          <td className="py-0.5 text-right text-brand-gold">{d ? (d.score * d.weight).toFixed(1) : '—'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                                <p className="text-text-muted mt-1">Conf: {r.info_edge_detail ? (r.info_edge_detail.data_confidence * 100).toFixed(0) + '%' : '—'}</p>
                                {r.info_edge_detail?.filing_recency && (
                                  <div className="mt-1 pt-1 border-t border-border/30">
                                    <p className="text-text-secondary font-bold">Filing Recency</p>
                                    <table className="w-full text-[10px]">
                                      <tbody>
                                        <tr className="border-b border-border/30"><td className="py-0.5 text-text-secondary">Signal Active</td><td className="py-0.5 text-right">{r.info_edge_detail.filing_recency.filing_signal_active ? 'Yes' : 'No'}</td></tr>
                                        <tr className="border-b border-border/30"><td className="py-0.5 text-text-secondary">Filing Type</td><td className="py-0.5 text-right">{r.info_edge_detail.filing_recency.filing_type ?? '—'}</td></tr>
                                        <tr className="border-b border-border/30"><td className="py-0.5 text-text-secondary">Filing Age</td><td className="py-0.5 text-right">{r.info_edge_detail.filing_recency.filing_age_hours != null ? r.info_edge_detail.filing_recency.filing_age_hours + 'h' : '—'}</td></tr>
                                        <tr className="border-b border-border/30"><td className="py-0.5 text-text-secondary">EPS Surprise</td><td className="py-0.5 text-right">{r.info_edge_detail.filing_recency.eps_surprise_pct != null ? r.info_edge_detail.filing_recency.eps_surprise_pct + '%' : '—'}</td></tr>
                                        <tr className="border-b border-border/30"><td className="py-0.5 text-text-secondary">Recency Score</td><td className="py-0.5 text-right">{r.info_edge_detail.filing_recency.filing_recency_score}</td></tr>
                                        <tr className="border-b border-border/30"><td className="py-0.5 text-text-secondary">Modifier</td><td className={`py-0.5 text-right ${r.info_edge_detail.filing_recency.filing_modifier > 0 ? 'text-brand-green' : r.info_edge_detail.filing_recency.filing_modifier < 0 ? 'text-brand-red' : ''}`}>{r.info_edge_detail.filing_recency.filing_modifier > 0 ? '+' : ''}{r.info_edge_detail.filing_recency.filing_modifier}</td></tr>
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </div>
                            <p className="text-text-muted text-[10px] mt-2">Formula: ({r.vol_edge}×{progress?.step_k?.data?.weights?.vol_edge ?? '?'}%) + ({r.quality}×{progress?.step_k?.data?.weights?.quality ?? '?'}%) + ({r.regime}×{progress?.step_k?.data?.weights?.regime ?? '?'}%) + ({r.info_edge}×{progress?.step_k?.data?.weights?.info_edge ?? '?'}%) = {r.composite}</p>
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                    );
                  });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Step L — Re-Score With Technicals */}
      <div className="border-b border-border">
        <div className="px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-bg-row" onClick={() => toggle('step_l')}>
          <div className="flex items-center gap-3">
            <span className="text-brand-purple font-bold">STEP L</span>
            <span className="text-text-secondary">Re-Score With Technicals</span>
            {progress?.step_l?.data ? (
              <span className="text-brand-green">{(progress.step_l.data as any).re_scored} of {(progress.step_l.data as any).total} tickers re-scored with candle technicals</span>
            ) : (
              <span className="text-text-muted animate-pulse">waiting...</span>
            )}
          </div>
          <span className="text-text-muted">{expanded['step_l'] ? '▲' : '▼'}</span>
        </div>
        {expanded['step_l'] && progress?.step_l?.data && (
          <div className="px-8 py-2 border-t border-border bg-bg-row">
            {(() => {
              const lFetchedAt = (progress.step_l.data as any).fetched_at as string | undefined;
              const lFetchedTime = lFetchedAt
                ? new Date(lFetchedAt).toISOString().slice(11, 19) + ' UTC'
                : '—';
              const lAgeSec = lFetchedAt
                ? Math.round((Date.now() - new Date(lFetchedAt).getTime()) / 1000) + 's'
                : '—';
              const tickers = (progress.step_l.data as any).tickers ?? [];
              return (
                <div className="overflow-x-auto overflow-y-auto" style={{maxHeight: '300px'}}>
                  <table className="w-full text-xs whitespace-nowrap">
                    <thead>
                      <tr className="text-text-muted border-b border-border sticky top-0 bg-bg-card">
                        <th className="text-left py-1 pr-3">#</th>
                        <th className="text-left py-1 pr-3">SYMBOL</th>
                        <th className="text-right py-1 pr-3">CANDLES</th>
                        <th className="text-right py-1 pr-3">VOL EDGE</th>
                        <th className="text-right py-1 pr-3">COMPOSITE</th>
                        <th className="text-right py-1 pr-3">TECHNICALS</th>
                        <th className="text-right py-1 pr-3">RSI</th>
                        <th className="text-right py-1 pr-3">SMA20</th>
                        <th className="text-right py-1 pr-3">SMA50</th>
                        <th className="text-right py-1 pr-3">BB POS</th>
                        <th className="text-right py-1 pr-3">VOL RATIO</th>
                        <th className="text-right py-1 pr-3">52W RATIO</th>
                        <th className="text-left py-1 pr-3">SOURCE</th>
                        <th className="text-left py-1 pr-3">ENDPOINT</th>
                        <th className="text-left py-1 pr-3">FETCHED</th>
                        <th className="text-right py-1">AGE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tickers.map((t: any, i: number) => (
                        <tr key={t.symbol} className="border-b border-border/50">
                          <td className="py-1 pr-3 text-text-muted">{i + 1}</td>
                          <td className="py-1 pr-3 font-bold">{t.symbol}</td>
                          <td className={`py-1 pr-3 text-right font-bold ${t.candles_used != null && t.candles_used > 0 ? 'text-brand-green' : 'text-text-muted'}`}>{t.candles_used ?? '—'}</td>
                          <td className="py-1 pr-3 text-right">{t.vol_edge_score ?? '—'}</td>
                          <td className="py-1 pr-3 text-right">{t.composite_score ?? '—'}</td>
                          <td className="py-1 pr-3 text-right">{t.technicals_score ?? '—'}</td>
                          <td className="py-1 pr-3 text-right">{t.rsi_14 != null ? Number(t.rsi_14).toFixed(1) : '—'}</td>
                          <td className="py-1 pr-3 text-right">{t.sma_20 != null ? Number(t.sma_20).toFixed(2) : '—'}</td>
                          <td className="py-1 pr-3 text-right">{t.sma_50 != null ? Number(t.sma_50).toFixed(2) : '—'}</td>
                          <td className="py-1 pr-3 text-right">{t.bb_position != null ? Number(t.bb_position).toFixed(2) : '—'}</td>
                          <td className="py-1 pr-3 text-right">{t.volume_ratio != null ? Number(t.volume_ratio).toFixed(2) : '—'}</td>
                          <td className="py-1 pr-3 text-right">{t.high52w_ratio != null ? Number(t.high52w_ratio).toFixed(2) : '—'}</td>
                          <td className="py-1 pr-3 text-text-muted text-[10px]">{t.source}</td>
                          <td className="py-1 pr-3 text-text-muted text-[10px]">{t.endpoint}</td>
                          <td className="py-1 pr-3 text-text-muted text-[10px]">{lFetchedTime}</td>
                          <td className="py-1 text-right text-text-muted text-[10px]">{lAgeSec}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Step M — Final Selection */}
      <div className="border-b border-border">
        <div className="px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-bg-row" onClick={() => toggle('step_m')}>
          <div className="flex items-center gap-3">
            <span className="text-brand-purple font-bold">STEP M</span>
            <span className="text-text-secondary">Final Selection</span>
            {progress?.step_m?.data ? (
              <span className="text-brand-green">{(progress.step_m.data as any).selected} of {(progress.step_m.data as any).total_scored} tickers selected</span>
            ) : (
              <span className="text-text-muted animate-pulse">waiting...</span>
            )}
          </div>
          <span className="text-text-muted">{expanded['step_m'] ? '▲' : '▼'}</span>
        </div>
        {expanded['step_m'] && progress?.step_m?.data && (
          <div className="px-8 py-2 border-t border-border bg-bg-row">
            {(() => {
              const md = progress.step_m.data as any;

              {/* PART 1 — Sector distribution */}
              const sectorDist = md.sector_distribution ?? {};

              {/* PART 2 — Selected tickers */}
              const selected: any[] = md.top9 ?? [];

              {/* PART 3 — Excluded tickers */}
              const excluded: any[] = md.excluded ?? [];

              {/* PART 4 — Adjustments */}
              const adjustments: string[] = md.adjustments ?? [];

              return (
                <>
                  {/* PART 1 — Sector Distribution */}
                  <div className="mb-3 p-2 bg-bg-card rounded border border-border">
                    <p className="text-text-muted text-xs font-bold mb-1">SECTOR DISTRIBUTION</p>
                    {Object.entries(sectorDist).map(([sector, count]) => (
                      <p key={sector} className="text-xs text-text-secondary">{sector}: {count as number}</p>
                    ))}
                  </div>

                  {/* PART 2 — Selected Tickers */}
                  <div className="overflow-x-auto overflow-y-auto mb-3" style={{maxHeight: '300px'}}>
                    <table className="w-full text-xs whitespace-nowrap">
                      <thead>
                        <tr className="text-text-muted border-b border-border sticky top-0 bg-bg-card">
                          <th className="text-right py-1 pr-3">RANK</th>
                          <th className="text-left py-1 pr-3">SYMBOL</th>
                          <th className="text-right py-1 pr-3">COMPOSITE</th>
                          <th className="text-right py-1 pr-3">VOL EDGE</th>
                          <th className="text-right py-1 pr-3">QUALITY</th>
                          <th className="text-right py-1 pr-3">REGIME</th>
                          <th className="text-right py-1 pr-3">INFO EDGE</th>
                          <th className="text-left py-1 pr-3">CONVERGENCE</th>
                          <th className="text-left py-1 pr-3">SECTOR</th>
                          <th className="text-left py-1">STATUS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.map((r: any) => (
                          <tr key={r.symbol} className="border-b border-border/50">
                            <td className="py-1 pr-3 text-right text-text-muted">{r.rank}</td>
                            <td className="py-1 pr-3 font-bold">{r.symbol}</td>
                            <td className="py-1 pr-3 text-right">{r.composite ?? '—'}</td>
                            <td className="py-1 pr-3 text-right">{r.vol_edge ?? '—'}</td>
                            <td className="py-1 pr-3 text-right">{r.quality ?? '—'}</td>
                            <td className="py-1 pr-3 text-right">{r.regime ?? '—'}</td>
                            <td className="py-1 pr-3 text-right">{r.info_edge ?? '—'}</td>
                            <td className="py-1 pr-3">{r.convergence ?? '—'}</td>
                            <td className="py-1 pr-3">{r.sector ?? '—'}</td>
                            <td className="py-1 text-brand-green font-bold">✓ SELECTED</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* PART 3 — Excluded Tickers */}
                  {excluded.length > 0 && (
                    <div className="overflow-x-auto overflow-y-auto mb-3" style={{maxHeight: '300px'}}>
                      <table className="w-full text-xs whitespace-nowrap">
                        <thead>
                          <tr className="text-text-muted border-b border-border sticky top-0 bg-bg-card">
                            <th className="text-left py-1 pr-3">SYMBOL</th>
                            <th className="text-right py-1 pr-3">COMPOSITE</th>
                            <th className="text-left py-1 pr-3">CONVERGENCE</th>
                            <th className="text-right py-1 pr-3">QUALITY</th>
                            <th className="text-left py-1 pr-3">SECTOR</th>
                            <th className="text-left py-1 pr-3">REASON</th>
                            <th className="text-left py-1">STATUS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {excluded.map((r: any) => (
                            <tr key={r.symbol} className="border-b border-border/50">
                              <td className="py-1 pr-3 font-bold">{r.symbol}</td>
                              <td className="py-1 pr-3 text-right">{r.composite ?? '—'}</td>
                              <td className="py-1 pr-3">{r.convergence ?? '—'}</td>
                              <td className="py-1 pr-3 text-right">{r.quality ?? '—'}</td>
                              <td className="py-1 pr-3">{r.sector ?? '—'}</td>
                              <td className="py-1 pr-3 text-text-muted text-[10px]">{r.reason}</td>
                              <td className="py-1 text-brand-red font-bold">✗ EXCLUDED</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* PART 4 — Adjustments Log */}
                  {adjustments.length > 0 && (
                    <div className="p-2 bg-bg-card rounded border border-border">
                      <p className="text-text-muted text-xs font-bold mb-1">ADJUSTMENTS LOG</p>
                      {adjustments.map((adj: string, i: number) => (
                        <p key={i} className="text-[10px] text-text-muted">{adj}</p>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* Step N — Chain Fetch */}
      <div className="border-b border-border">
        <div className="px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-bg-row" onClick={() => toggle('step_n')}>
          <div className="flex items-center gap-3">
            <span className="text-brand-purple font-bold">STEP N</span>
            <span className="text-text-secondary">Chain Fetch</span>
            {jData ? (
              <span className="text-brand-green">{jData.totalStrikes} strikes fetched across {jData.tickers?.length ?? 0} tickers — {jData.greeksEvents} Greeks events received</span>
            ) : (
              <span className="text-text-muted animate-pulse">waiting...</span>
            )}
          </div>
          <span className="text-text-muted">{expanded['step_n'] ? '▲' : '▼'}</span>
        </div>
        {expanded['step_n'] && (
          <div className="px-8 py-2 border-t border-border bg-bg-row">
            <p className="text-text-secondary text-xs leading-relaxed mb-3">
              TastyTrade REST API returns all expirations within 15–60 DTE for each ticker. We evaluate every expiration — not just the closest one. For each expiration, a WebSocket streams live Greeks (delta, gamma, theta, vega) and quotes (bid, ask) for every strike. The expiration with the highest-scoring strategy wins.
            </p>
            {jData?.tickers && (() => {
              const nFetchedAt = jData.fetched_at ? new Date(jData.fetched_at as string) : null;
              const nFetchedTime = nFetchedAt ? nFetchedAt.toLocaleTimeString() : '—';
              const nAgeSec = nFetchedAt ? Math.round((Date.now() - nFetchedAt.getTime()) / 1000) : null;
              return (
              <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                <table className="w-full text-[10px]">
                  <thead><tr className="text-text-muted border-b border-border">
                    <th className="text-left py-1 px-1">SYMBOL</th>
                    <th className="text-left py-1 px-1">EXPIRATION</th>
                    <th className="text-right py-1 px-1">DTE</th>
                    <th className="text-right py-1 px-1">STRIKES</th>
                    <th className="text-left py-1 px-1">PRICE SOURCE</th>
                    <th className="text-left py-1 px-1">SOURCE</th>
                    <th className="text-left py-1 px-1">ENDPOINT</th>
                    <th className="text-left py-1 px-1">FETCHED</th>
                    <th className="text-right py-1 px-1">AGE</th>
                  </tr></thead>
                  <tbody>
                    {jData.tickers.map((t: { symbol: string; expiration?: string; dte?: number; strikeCount?: number; priceSource?: string; source?: string; endpoint?: string }) => {
                      const srcColor = t.priceSource === 'live' ? 'text-brand-green' : t.priceSource === 'theo' ? 'text-brand-gold' : t.priceSource === 'mixed' ? 'text-brand-blue' : 'text-brand-red';
                      const srcLabel = t.priceSource === 'theo' ? 'theo (market closed)' : (t.priceSource ?? '—');
                      return (
                        <tr key={t.symbol} className="border-b border-border/50">
                          <td className="py-0.5 px-1 font-bold text-text-primary">{t.symbol}</td>
                          <td className="py-0.5 px-1 text-text-secondary font-mono">{t.expiration ?? '—'}</td>
                          <td className="py-0.5 px-1 text-right font-mono text-text-secondary">{t.dte ?? '—'}</td>
                          <td className="py-0.5 px-1 text-right font-mono text-text-secondary">{t.strikeCount ?? '—'}</td>
                          <td className={`py-0.5 px-1 font-mono ${srcColor}`}>{srcLabel}</td>
                          <td className="py-0.5 px-1 font-mono text-text-secondary">{t.source ?? 'TastyTrade'}</td>
                          <td className="py-0.5 px-1 font-mono text-text-secondary">{t.endpoint ?? 'options-chain'}</td>
                          <td className="py-0.5 px-1 font-mono text-text-secondary">{nFetchedTime}</td>
                          <td className="py-0.5 px-1 text-right font-mono text-text-secondary">{nAgeSec != null ? `${nAgeSec}s` : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              );
            })()}
            {jData && (
              <p className="text-text-muted text-xs mt-3">
                {jData.streamerSymbols} streamer symbols subscribed · {jData.greeksEvents} Greeks events received
              </p>
            )}
          </div>
        )}
      </div>

      {/* Step O — Live Greeks Subscription */}
      <div className="border-b border-border">
        <div className="px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-bg-row" onClick={() => toggle('step_o')}>
          <div className="flex items-center gap-3">
            <span className="text-brand-purple font-bold">STEP O</span>
            <span className="text-text-secondary">Live Greeks Subscription</span>
            {progress?.step_o?.data ? (
              <span className="text-brand-green">{(progress.step_o.data as any).greeks_events_received} Greeks events received across {(progress.step_o.data as any).streamer_symbols_subscribed} symbols</span>
            ) : (
              <span className="text-text-muted animate-pulse">waiting...</span>
            )}
          </div>
          <span className="text-text-muted">{expanded['step_o'] ? '▲' : '▼'}</span>
        </div>
        {expanded['step_o'] && progress?.step_o?.data && (() => {
          const od = progress.step_o.data as any;
          const oFetchedAt = od.fetched_at ? new Date(od.fetched_at) : null;
          const oFetchedTime = oFetchedAt ? oFetchedAt.toLocaleTimeString() : '—';
          const oAgeSec = oFetchedAt ? Math.round((Date.now() - oFetchedAt.getTime()) / 1000) : null;
          const tickers: any[] = od.tickers ?? [];
          return (
            <div className="px-8 py-2 border-t border-border bg-bg-row">
              <p className="text-xs mb-3">
                {od.market_open
                  ? <span className="text-brand-green font-bold">Market Open — live quotes</span>
                  : <span className="text-brand-gold font-bold">Market Closed — {od.market_note ?? 'theo pricing'}</span>
                }
              </p>
              {tickers.length > 0 && (
                <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                  <table className="w-full text-[10px]">
                    <thead><tr className="text-text-muted border-b border-border">
                      <th className="text-right py-1 px-1">#</th>
                      <th className="text-left py-1 px-1">SYMBOL</th>
                      <th className="text-right py-1 px-1">STRIKES</th>
                      <th className="text-left py-1 px-1">EXPIRATION</th>
                      <th className="text-right py-1 px-1">DTE</th>
                      <th className="text-left py-1 px-1">SOURCE</th>
                      <th className="text-left py-1 px-1">ENDPOINT</th>
                      <th className="text-left py-1 px-1">FETCHED</th>
                      <th className="text-right py-1 px-1">AGE</th>
                    </tr></thead>
                    <tbody>
                      {tickers.map((t: any, i: number) => (
                        <tr key={t.symbol} className="border-b border-border/50">
                          <td className="py-0.5 px-1 text-right text-text-muted">{i + 1}</td>
                          <td className="py-0.5 px-1 font-bold text-text-primary">{t.symbol}</td>
                          <td className="py-0.5 px-1 text-right font-mono text-text-secondary">{t.strike_count ?? '—'}</td>
                          <td className="py-0.5 px-1 text-text-secondary font-mono">{t.expiration ?? '—'}</td>
                          <td className="py-0.5 px-1 text-right font-mono text-text-secondary">{t.dte ?? '—'}</td>
                          <td className="py-0.5 px-1 font-mono text-text-secondary">{t.source ?? 'TastyTrade'}</td>
                          <td className="py-0.5 px-1 font-mono text-text-secondary">{t.endpoint ?? 'Greeks WebSocket'}</td>
                          <td className="py-0.5 px-1 font-mono text-text-secondary">{oFetchedTime}</td>
                          <td className="py-0.5 px-1 text-right font-mono text-text-secondary">{oAgeSec != null ? `${oAgeSec}s` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Step P — Strategy Scoring */}
      <div className="border-b border-border">
        <div className="px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-bg-row" onClick={() => toggle('step_p')}>
          <div className="flex items-center gap-3">
            <span className="text-brand-purple font-bold">STEP P</span>
            <span className="text-text-secondary">Strategy Scoring</span>
            {kData ? (
              <span className="text-brand-green">{kData.totalPassed} strategies passed all 3 gates</span>
            ) : (
              <span className="text-text-muted animate-pulse">waiting...</span>
            )}
          </div>
          <span className="text-text-muted">{expanded['step_p'] ? '▲' : '▼'}</span>
        </div>
        {expanded['step_p'] && (
          <div className="px-8 py-2 border-t border-border bg-bg-row">
            {/* IV Rank tier system */}
            <div className="space-y-2 mb-3">
              <p className="text-text-secondary text-xs leading-relaxed">
                <span className="font-bold text-text-primary">IV Rank above 50%</span> → premium selling strategies (Iron Condor, Put Credit Spread, Short Strangle).
              </p>
              <p className="text-text-secondary text-xs leading-relaxed">
                <span className="font-bold text-text-primary">IV Rank 20–50%</span> → neutral strategies (Iron Condor, Put Credit Spread, Bull Call Spread).
              </p>
              <p className="text-text-secondary text-xs leading-relaxed">
                <span className="font-bold text-text-primary">IV Rank below 20%</span> → debit strategies (Long Straddle, Long Strangle, Debit Spread).
              </p>
            </div>
            {/* Gate explanations */}
            <div className="space-y-2 mb-3">
              <p className="text-text-secondary text-xs leading-relaxed">
                <span className="font-bold text-text-primary">Gate A:</span> Strategy must have positive expected value. EV = P(full profit) × max profit + P(partial) × midpoint + P(full loss) × max loss.
              </p>
              <p className="text-text-secondary text-xs leading-relaxed">
                <span className="font-bold text-text-primary">Gate B:</span> Probability of profit must meet strategy-specific floor. Iron Condor ≥ 50%. Put Credit Spread ≥ 55%. Short Strangle ≥ 60%. Uses N(d2) breakeven method where available.
              </p>
              <p className="text-text-secondary text-xs leading-relaxed">
                <span className="font-bold text-text-primary">Gate C:</span> Credit strategies must collect at least $0.10/share. Debit strategies skip this gate.
              </p>
            </div>
            {/* Scoring formula */}
            <p className="text-text-secondary text-xs leading-relaxed mb-3">
              <span className="font-bold text-text-primary">Survivors ranked by:</span> (EV/Risk × 50%) + (Theta Efficiency × 30%) + (Edge Ratio × 20%). Highest score = Strategy A.
            </p>
            {/* Per-ticker table */}
            {kData?.tickers && (() => {
              const pFetchedAt = kData.fetched_at ? new Date(kData.fetched_at as string) : null;
              const pFetchedTime = pFetchedAt ? pFetchedAt.toLocaleTimeString() : '—';
              const pAgeSec = pFetchedAt ? Math.round((Date.now() - pFetchedAt.getTime()) / 1000) : null;
              return (
              <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                <table className="w-full text-[10px]">
                  <thead><tr className="text-text-muted border-b border-border">
                    <th className="text-left py-1 px-1">SYMBOL</th>
                    <th className="text-right py-1 px-1">BUILT</th>
                    <th className="text-right py-1 px-1">GATE A ✗</th>
                    <th className="text-right py-1 px-1">GATE B ✗</th>
                    <th className="text-right py-1 px-1">GATE C ✗</th>
                    <th className="text-right py-1 px-1">PASSED</th>
                    <th className="text-left py-1 px-1">WINNER</th>
                    <th className="text-right py-1 px-1">SCORE</th>
                    <th className="text-left py-1 px-1">SOURCE</th>
                    <th className="text-left py-1 px-1">ENDPOINT</th>
                    <th className="text-left py-1 px-1">FETCHED</th>
                    <th className="text-right py-1 px-1">AGE</th>
                  </tr></thead>
                  <tbody>
                    {kData.tickers.map((t: { symbol: string; strategiesBuilt?: number; gateAFailed?: number; gateBFailed?: number; gateCFailed?: number; strategiesPassed?: number; winner?: string | null; winnerScore?: number | null; source?: string; endpoint?: string }) => (
                      <tr key={t.symbol} className="border-b border-border/50">
                        <td className="py-0.5 px-1 font-bold text-text-primary">{t.symbol}</td>
                        <td className="py-0.5 px-1 text-right font-mono text-text-secondary">{t.strategiesBuilt ?? '—'}</td>
                        <td className="py-0.5 px-1 text-right font-mono text-text-secondary">{t.gateAFailed ?? 0}</td>
                        <td className="py-0.5 px-1 text-right font-mono text-text-secondary">{t.gateBFailed ?? 0}</td>
                        <td className="py-0.5 px-1 text-right font-mono text-text-secondary">{t.gateCFailed ?? 0}</td>
                        <td className={`py-0.5 px-1 text-right font-mono font-bold ${(t.strategiesPassed ?? 0) > 0 ? 'text-brand-green' : 'text-brand-red'}`}>{t.strategiesPassed ?? 0}</td>
                        <td className={`py-0.5 px-1 font-mono ${t.winner ? 'text-brand-green' : 'text-brand-red'}`}>{t.winner ?? 'none'}</td>
                        <td className="py-0.5 px-1 text-right font-mono text-text-secondary">{t.winnerScore != null ? t.winnerScore.toFixed(1) : '—'}</td>
                        <td className="py-0.5 px-1 font-mono text-text-secondary">TastyTrade</td>
                        <td className="py-0.5 px-1 font-mono text-text-secondary">Greeks WebSocket</td>
                        <td className="py-0.5 px-1 font-mono text-text-secondary">{pFetchedTime}</td>
                        <td className="py-0.5 px-1 text-right font-mono text-text-secondary">{pAgeSec != null ? `${pAgeSec}s` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Step Q — Live Options Flow & GEX */}
      {(() => { const qData: any = progress?.step_q?.data ?? null; return (
      <div className="border-b border-border">
        <div className="px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-bg-row" onClick={() => toggle('step_q')}>
          <div className="flex items-center gap-3">
            <span className="text-brand-purple font-bold">STEP Q</span>
            <span className="text-text-secondary">Live Options Flow &amp; GEX</span>
            {qData ? (
              <span className="text-brand-green">{qData.tickers_with_flow} tickers with live flow data</span>
            ) : (
              <span className="text-text-muted animate-pulse">waiting...</span>
            )}
          </div>
          <span className="text-text-muted">{expanded['step_q'] ? '▲' : '▼'}</span>
        </div>
        {expanded['step_q'] && (
          <div className="px-8 py-2 border-t border-border bg-bg-row">
            {qData?.tickers && (() => {
              const qFetchedAt = qData.fetched_at ? new Date(qData.fetched_at as string) : null;
              const qFetchedTime = qFetchedAt ? qFetchedAt.toLocaleTimeString() : '—';
              const qAgeSec = qFetchedAt ? Math.round((Date.now() - qFetchedAt.getTime()) / 1000) : null;
              return (
              <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                <table className="w-full text-[10px]">
                  <thead><tr className="text-text-muted border-b border-border">
                    <th className="text-right py-1 px-1">#</th>
                    <th className="text-left py-1 px-1">SYMBOL</th>
                    <th className="text-right py-1 px-1">PCR</th>
                    <th className="text-right py-1 px-1">VOL BIAS</th>
                    <th className="text-right py-1 px-1">UNUSUAL</th>
                    <th className="text-right py-1 px-1">CALL VOL</th>
                    <th className="text-right py-1 px-1">PUT VOL</th>
                    <th className="text-right py-1 px-1">CALL OI</th>
                    <th className="text-right py-1 px-1">PUT OI</th>
                    <th className="text-right py-1 px-1">STRIKES</th>
                    <th className="text-left py-1 px-1">SOURCE</th>
                    <th className="text-left py-1 px-1">ENDPOINT</th>
                    <th className="text-left py-1 px-1">FETCHED</th>
                    <th className="text-right py-1 px-1">AGE</th>
                  </tr></thead>
                  <tbody>
                    {qData.tickers.map((t: { symbol: string; put_call_ratio?: number | null; volume_bias?: number | null; unusual_activity_ratio?: number | null; total_call_volume?: number | null; total_put_volume?: number | null; total_call_oi?: number | null; total_put_oi?: number | null; strikes_analyzed?: number | null; source?: string; endpoint?: string }, idx: number) => (
                      <tr key={t.symbol} className="border-b border-border/50">
                        <td className="py-0.5 px-1 text-right font-mono text-text-muted">{idx + 1}</td>
                        <td className="py-0.5 px-1 font-bold text-text-primary">{t.symbol}</td>
                        <td className="py-0.5 px-1 text-right font-mono text-text-secondary">{t.put_call_ratio != null ? t.put_call_ratio.toFixed(2) : '—'}</td>
                        <td className="py-0.5 px-1 text-right font-mono text-text-secondary">{t.volume_bias != null ? t.volume_bias.toFixed(2) : '—'}</td>
                        <td className="py-0.5 px-1 text-right font-mono text-text-secondary">{t.unusual_activity_ratio != null ? t.unusual_activity_ratio.toFixed(2) : '—'}</td>
                        <td className="py-0.5 px-1 text-right font-mono text-text-secondary">{t.total_call_volume ?? '—'}</td>
                        <td className="py-0.5 px-1 text-right font-mono text-text-secondary">{t.total_put_volume ?? '—'}</td>
                        <td className="py-0.5 px-1 text-right font-mono text-text-secondary">{t.total_call_oi ?? '—'}</td>
                        <td className="py-0.5 px-1 text-right font-mono text-text-secondary">{t.total_put_oi ?? '—'}</td>
                        <td className="py-0.5 px-1 text-right font-mono text-text-secondary">{t.strikes_analyzed ?? '—'}</td>
                        <td className="py-0.5 px-1 font-mono text-text-secondary">{t.source ?? '—'}</td>
                        <td className="py-0.5 px-1 font-mono text-text-secondary">{t.endpoint ?? '—'}</td>
                        <td className="py-0.5 px-1 font-mono text-text-secondary">{qFetchedTime}</td>
                        <td className="py-0.5 px-1 text-right font-mono text-text-secondary">{qAgeSec != null ? `${qAgeSec}s` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              );
            })()}
          </div>
        )}
      </div>
      ); })()}

      {/* Step R — Re-Score With Live Data */}
      {(() => { const rData: any = progress?.step_r?.data ?? null; return (
      <div className="border-b border-border">
        <div className="px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-bg-row" onClick={() => toggle('step_r')}>
          <div className="flex items-center gap-3">
            <span className="text-brand-purple font-bold">STEP R</span>
            <span className="text-text-secondary">Re-Score With Live Data</span>
            {rData ? (
              <span className="text-brand-green">{rData.flow_re_scored} of {rData.total} tickers re-scored with live flow data</span>
            ) : (
              <span className="text-text-muted animate-pulse">waiting...</span>
            )}
          </div>
          <span className="text-text-muted">{expanded['step_r'] ? '▲' : '▼'}</span>
        </div>
        {expanded['step_r'] && (
          <div className="px-8 py-2 border-t border-border bg-bg-row">
            {rData?.tickers && (() => {
              const rFetchedAt = rData.fetched_at ? new Date(rData.fetched_at as string) : null;
              const rFetchedTime = rFetchedAt ? rFetchedAt.toLocaleTimeString() : '—';
              const rAgeSec = rFetchedAt ? Math.round((Date.now() - rFetchedAt.getTime()) / 1000) : null;
              return (
              <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                <table className="w-full text-[10px]">
                  <thead><tr className="text-text-muted border-b border-border">
                    <th className="text-right py-1 px-1">#</th>
                    <th className="text-left py-1 px-1">SYMBOL</th>
                    <th className="text-right py-1 px-1">COMPOSITE</th>
                    <th className="text-right py-1 px-1">VOL EDGE</th>
                    <th className="text-right py-1 px-1">INFO EDGE</th>
                    <th className="text-left py-1 px-1">HAS FLOW</th>
                    <th className="text-left py-1 px-1">SOURCE</th>
                    <th className="text-left py-1 px-1">ENDPOINT</th>
                    <th className="text-left py-1 px-1">FETCHED</th>
                    <th className="text-right py-1 px-1">AGE</th>
                  </tr></thead>
                  <tbody>
                    {rData.tickers.map((t: { symbol: string; composite?: number | null; vol_edge?: number | null; info_edge?: number | null; has_flow_data?: boolean; source?: string; endpoint?: string }, idx: number) => (
                      <tr key={t.symbol} className="border-b border-border/50">
                        <td className="py-0.5 px-1 text-right font-mono text-text-muted">{idx + 1}</td>
                        <td className="py-0.5 px-1 font-bold text-text-primary">{t.symbol}</td>
                        <td className="py-0.5 px-1 text-right font-mono text-text-secondary">{t.composite != null ? t.composite.toFixed(1) : '—'}</td>
                        <td className="py-0.5 px-1 text-right font-mono text-text-secondary">{t.vol_edge != null ? t.vol_edge.toFixed(1) : '—'}</td>
                        <td className="py-0.5 px-1 text-right font-mono text-text-secondary">{t.info_edge != null ? t.info_edge.toFixed(1) : '—'}</td>
                        <td className={`py-0.5 px-1 font-mono font-bold ${t.has_flow_data ? 'text-brand-green' : 'text-brand-red'}`}>{t.has_flow_data ? 'YES' : 'NO'}</td>
                        <td className="py-0.5 px-1 font-mono text-text-secondary">{t.source ?? '—'}</td>
                        <td className="py-0.5 px-1 font-mono text-text-secondary">{t.endpoint ?? '—'}</td>
                        <td className="py-0.5 px-1 font-mono text-text-secondary">{rFetchedTime}</td>
                        <td className="py-0.5 px-1 text-right font-mono text-text-secondary">{rAgeSec != null ? `${rAgeSec}s` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              );
            })()}
          </div>
        )}
      </div>
      ); })()}

      {/* Step S — Trade Cards */}
      <div className="border-b border-border">
        <div className="px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-bg-row" onClick={() => toggle('step_s')}>
          <div className="flex items-center gap-3">
            <span className="text-brand-purple font-bold">STEP S</span>
            <span className="text-text-secondary">Trade Cards</span>
            {(ps?.total_trade_cards != null || progress?.step_s) ? (
              <span className="text-brand-green">{ps?.total_trade_cards ?? progress?.step_s?.data?.trade_cards ?? 0} strategies generated</span>
            ) : (
              <span className="text-text-muted animate-pulse">waiting...</span>
            )}
          </div>
          <span className="text-text-muted">{expanded['step_s'] ? '▲' : '▼'}</span>
        </div>
        {expanded['step_s'] && (
          <div className="px-8 py-2 border-t border-border bg-bg-row">
            {/* Selection rules explanation */}
            <div className="space-y-2 mb-3">
              <p className="text-text-secondary text-xs leading-relaxed">
                <span className="font-bold text-text-primary">Rule 1 — Convergence Gate:</span> 3 or more of the 4 gates must score above 50. A single strong gate is not enough. The signal must converge across multiple independent dimensions.
              </p>
              <p className="text-text-secondary text-xs leading-relaxed">
                <span className="font-bold text-text-primary">Rule 2 — Quality Floor:</span> Quality gate must score 40 or above. High IV on a deteriorating business is not an edge — it is a warning sign.
              </p>
              <p className="text-text-secondary text-xs leading-relaxed">
                <span className="font-bold text-text-primary">Rule 3 — Sector Cap:</span> Soft cap of 2 tickers per sector. If enough diverse candidates exist, only the top 2 per sector are taken. If fewer than 9 diverse candidates survive, the cap is relaxed and the best remaining tickers are admitted regardless of sector.
              </p>
            </div>

            {/* Full eligibility matrix */}
            {(() => {
              const sFetchedAt = progress?.step_s?.data?.fetched_at ? new Date(progress.step_s.data.fetched_at as string) : null;
              const sFetchedTime = sFetchedAt ? sFetchedAt.toLocaleTimeString() : '—';
              const sAgeSec = sFetchedAt ? Math.round((Date.now() - sFetchedAt.getTime()) / 1000) : null;
              return (
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              <table className="w-full text-[10px]">
                <thead><tr className="text-text-muted border-b border-border">
                  <th className="text-left py-1 px-1">RANK</th>
                  <th className="text-left py-1 px-1">SYMBOL</th>
                  <th className="text-right py-1 px-1">COMPOSITE</th>
                  <th className="text-center py-1 px-1">GATES</th>
                  <th className="text-right py-1 px-1">VOL</th>
                  <th className="text-right py-1 px-1">QUAL</th>
                  <th className="text-right py-1 px-1">REG</th>
                  <th className="text-right py-1 px-1">INFO</th>
                  <th className="text-left py-1 px-1">SECTOR</th>
                  <th className="text-left py-1 px-1">STATUS</th>
                  <th className="text-left py-1 px-1">SOURCE</th>
                  <th className="text-left py-1 px-1">ENDPOINT</th>
                  <th className="text-left py-1 px-1">FETCHED</th>
                  <th className="text-right py-1 px-1">AGE</th>
                </tr></thead>
                <tbody>
                  {(fData?.rankings ?? []).map((r: { symbol: string; composite: number; vol_edge: number; quality: number; regime: number; info_edge: number; sector?: string | null; convergence?: string; selection_status?: string }, idx: number) => {
                    const top9Set = new Set(gData?.top_9 ?? []);
                    const inTop9 = top9Set.has(r.symbol);
                    const rej = gData?.rejections?.[r.symbol];
                    const hasRejection = rej?.length > 0;
                    const gatesAbove50 = [r.vol_edge, r.quality, r.regime, r.info_edge].filter(s => s >= 50).length;

                    // Determine sector counts among already-selected tickers above this rank
                    const sectorCounts: Record<string, number> = {};
                    (fData?.rankings ?? []).slice(0, idx).forEach((prev: { symbol: string; sector?: string | null }) => {
                      if (top9Set.has(prev.symbol) && prev.sector) {
                        sectorCounts[prev.sector] = (sectorCounts[prev.sector] ?? 0) + 1;
                      }
                    });

                    let status: { text: string; color: string };
                    if (inTop9 && !hasRejection) {
                      status = { text: '✓ Final 9 — trade card built', color: 'text-brand-green' };
                    } else if (inTop9 && hasRejection) {
                      status = { text: '⚠ Selected — strategy pending', color: 'text-brand-gold' };
                    } else if (r.selection_status === 'below_threshold' || gatesAbove50 < 3) {
                      status = { text: '✗ Needs 3/4 gates above 50', color: 'text-brand-red' };
                    } else if (r.quality < 40) {
                      status = { text: '✗ Quality floor — score below 40', color: 'text-brand-red' };
                    } else if (r.sector && (sectorCounts[r.sector] ?? 0) >= 2) {
                      status = { text: `✗ Sector cap — 2 ${r.sector} already selected`, color: 'text-brand-red' };
                    } else {
                      status = { text: '✗ Ranked out — composite below top 9 cutoff', color: 'text-brand-red' };
                    }

                    return (
                      <tr key={r.symbol} className={`border-b border-border/50 hover:bg-bg-card ${inTop9 ? 'bg-white/50' : ''}`}>
                        <td className="py-0.5 px-1 text-text-muted font-mono">{idx + 1}</td>
                        <td className="py-0.5 px-1 font-bold text-text-primary">{r.symbol}</td>
                        <td className="py-0.5 px-1 text-right font-mono font-bold text-text-primary">{r.composite.toFixed(1)}</td>
                        <td className="py-0.5 px-1 text-center font-mono">{r.convergence ?? `${gatesAbove50}/4`}</td>
                        <td className={`py-0.5 px-1 text-right font-mono ${r.vol_edge >= 50 ? 'text-brand-green' : 'text-text-muted'}`}>{r.vol_edge.toFixed(0)}</td>
                        <td className={`py-0.5 px-1 text-right font-mono ${r.quality >= 50 ? 'text-brand-green' : r.quality < 40 ? 'text-brand-red' : 'text-text-muted'}`}>{r.quality.toFixed(0)}</td>
                        <td className={`py-0.5 px-1 text-right font-mono ${r.regime >= 50 ? 'text-brand-green' : 'text-text-muted'}`}>{r.regime.toFixed(0)}</td>
                        <td className={`py-0.5 px-1 text-right font-mono ${r.info_edge >= 50 ? 'text-brand-green' : 'text-text-muted'}`}>{r.info_edge.toFixed(0)}</td>
                        <td className="py-0.5 px-1 text-text-secondary">{r.sector ?? '—'}</td>
                        <td className={`py-0.5 px-1 ${status.color}`}>{status.text}</td>
                        <td className="py-0.5 px-1 font-mono text-text-secondary">All prior steps</td>
                        <td className="py-0.5 px-1 font-mono text-text-secondary">Composite — see Steps A–J</td>
                        <td className="py-0.5 px-1 font-mono text-text-secondary">{sFetchedTime}</td>
                        <td className="py-0.5 px-1 text-right font-mono text-text-secondary">{sAgeSec != null ? `${sAgeSec}s` : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
              );
            })()}

            {/* Next steps explanation */}
            <p className="text-text-muted text-xs mt-3 italic">
              Step N fetches the live options chain for each of the final 9. Step P builds and scores strategy candidates.
            </p>
          </div>
        )}
      </div>

      {/* Step T — Save & Return */}
      {(() => { const tData: any = progress?.step_t?.data ?? null; // eslint-disable-line @typescript-eslint/no-explicit-any
        const tFetchedAt = tData?.fetched_at ? new Date(tData.fetched_at as string) : null;
        const tFetchedTime = tFetchedAt ? tFetchedAt.toLocaleTimeString() : '—';
        const tAgeSec = tFetchedAt ? Math.round((Date.now() - tFetchedAt.getTime()) / 1000) : null;
        return (
      <div className="border-b border-border">
        <div className="px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-bg-row" onClick={() => toggle('step_t')}>
          <div className="flex items-center gap-3">
            <span className="text-brand-purple font-bold">STEP T</span>
            <span className="text-text-secondary">Save &amp; Return</span>
            {tData ? (
              tData.saved ? (
                <span className="text-brand-green">Scan saved — {tData.symbols_logged} tickers logged</span>
              ) : (
                <span className="text-brand-gold">Not saved — no user session</span>
              )
            ) : (
              <span className="text-text-muted animate-pulse">waiting...</span>
            )}
          </div>
          <span className="text-text-muted">{expanded['step_t'] ? '▲' : '▼'}</span>
        </div>
        {expanded['step_t'] && tData && (
          <div className="px-8 py-2 border-t border-border bg-bg-row">
            <table className="text-[10px]">
              <tbody>
                <tr><td className="py-0.5 pr-4 text-text-muted font-bold">Pipeline Runtime</td><td className="py-0.5 font-mono text-text-secondary">{tData.pipeline_runtime_ms}ms</td></tr>
                <tr><td className="py-0.5 pr-4 text-text-muted font-bold">Symbols Logged</td><td className="py-0.5 font-mono text-text-secondary">{tData.symbols_logged}</td></tr>
                <tr><td className="py-0.5 pr-4 text-text-muted font-bold">Final 9</td><td className="py-0.5 font-mono text-text-secondary">{(tData.final_9 ?? []).join(', ')}</td></tr>
                <tr><td className="py-0.5 pr-4 text-text-muted font-bold">Saved</td><td className="py-0.5 font-mono text-text-secondary">{tData.saved ? 'Yes' : 'No'}</td></tr>
                <tr><td className="py-0.5 pr-4 text-text-muted font-bold">Source</td><td className="py-0.5 font-mono text-text-secondary">{tData.source}</td></tr>
                <tr><td className="py-0.5 pr-4 text-text-muted font-bold">Endpoint</td><td className="py-0.5 font-mono text-text-secondary">{tData.endpoint}</td></tr>
                <tr><td className="py-0.5 pr-4 text-text-muted font-bold">Fetched</td><td className="py-0.5 font-mono text-text-secondary">{tFetchedTime}</td></tr>
                <tr><td className="py-0.5 pr-4 text-text-muted font-bold">Age</td><td className="py-0.5 font-mono text-text-secondary">{tAgeSec != null ? `${tAgeSec}s` : '—'}</td></tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
      ); })()}

      {/* Summary */}
      <div className="px-4 py-2 flex items-center gap-4 text-text-muted">
        <span>{ps?.total_universe ?? progress?.step_a?.data?.total_universe ?? 0} scanned</span>
        <span>→</span>
        <span>{hf?.output_count ?? progress?.step_e?.data?.output ?? 0} filtered</span>
        <span>→</span>
        <span>{ps?.scored ?? progress?.step_k?.data?.scored ?? 0} scored</span>
        <span>→</span>
        <span className="text-brand-green">{ps?.final_9?.length ?? progress?.step_s?.data?.top_9?.length ?? 0} selected</span>
        <span className="ml-auto">
          {isLive ? (
            <span className="text-brand-purple animate-pulse">Pipeline running...</span>
          ) : (
            <>Finnhub: {ps?.finnhub_calls_made ?? 0} calls · Runtime: {ps?.pipeline_runtime_ms ? `${(ps.pipeline_runtime_ms / 1000).toFixed(1)}s` : '—'}</>
          )}
        </span>
      </div>
    </div>
  );
}

function FilteredResultsSection({
  enriched, filters, sentimentMap, rejectionMap, onResetFilters,
  savedCards, savingCards, saveErrors, onSaveCard, onRemoveCard,
  pipelineProgress,
}: {
  enriched: TickerDetail[];
  filters: ScannerFilters;
  sentimentMap?: Record<string, SocialSentimentData>;
  rejectionMap?: Record<string, RejectionReason[]>;
  onResetFilters: () => void;
  savedCards: Map<string, string>;
  savingCards: Set<string>;
  saveErrors: Map<string, string>;
  onSaveCard: (detail: TickerDetail, card: TradeCardData, sentiment?: SocialSentimentData) => Promise<void>;
  onRemoveCard: (cardKey: string, savedId: string) => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pipelineProgress: Record<string, any>;
}) {
  const { passed, filtered, totalStrategies, passedStrategies } = useMemo(
    () => applyFilters(enriched, filters, sentimentMap),
    [enriched, filters, sentimentMap],
  );
  const [showFiltered, setShowFiltered] = useState(false);
  const activeFilters = useMemo(() => describeActiveFilters(filters), [filters]);
  const activeCount = countActiveFilters(filters);
  const filteredCount = totalStrategies - passedStrategies;

  return (
    <>
      {/* Active filter summary bar */}
      {activeCount > 0 && (
        <div className="px-5 py-1.5 flex items-center gap-3 flex-wrap text-[10px] bg-bg-row border-b border-border">
          <span className="text-text-muted font-bold uppercase tracking-wider shrink-0">Active:</span>
          <span className="text-text-secondary">{activeFilters.join(' \u2022 ')}</span>
          <button onClick={onResetFilters} className="text-brand-purple hover:text-brand-purple-hover ml-auto shrink-0">
            Clear all
          </button>
        </div>
      )}

      {/* Filter counts */}
      {totalStrategies > 0 && (
        <div className="px-5 py-1.5 flex items-center gap-3 text-[10px] bg-white border-b border-border">
          <span className="text-text-muted">
            Showing <span className="text-text-primary font-bold">{passedStrategies}</span> of <span className="text-text-primary font-bold">{totalStrategies}</span> strategies across <span className="text-text-primary font-bold">{passed.length}</span> tickers
          </span>
          {filteredCount > 0 && (
            <button
              onClick={() => setShowFiltered(!showFiltered)}
              className="text-text-faint hover:text-text-secondary transition-colors"
            >
              {filteredCount} filtered out {showFiltered ? '\u25B2' : '\u25BC'}
            </button>
          )}
        </div>
      )}

      {/* Filtered-out reasons */}
      {showFiltered && filtered.length > 0 && (
        <div className="px-5 py-2 space-y-1 max-h-[150px] overflow-y-auto bg-bg-terminal">
          {filtered.map((f, i) => (
            <div key={i} className="text-[10px]">
              <span className="text-text-secondary font-mono font-bold">{f.result.symbol}</span>
              <span className="text-text-faint"> — </span>
              <span className="text-text-muted">{f.reasons.join(' | ')}</span>
            </div>
          ))}
        </div>
      )}

      <ScannerResultsTable
        results={passed}
        sentimentMap={sentimentMap}
        rejectionMap={rejectionMap}
        savedCards={savedCards}
        savingCards={savingCards}
        saveErrors={saveErrors}
        onSaveCard={onSaveCard}
        onRemoveCard={onRemoveCard}
        pipelineProgress={pipelineProgress}
      />
    </>
  );
}

// ── Main Component ──────────────────────────────────────────────────

export default function ConvergenceIntelligence() {
  // Batch scan state
  const [universe, setUniverse] = useState('sp500');
  const [scanning, setScanning] = useState(false);
  const [batchData, setBatchData] = useState<BatchResponse | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pipelineResult, setPipelineResult] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pipelineProgress, setPipelineProgress] = useState<Record<string, any>>({});

  // Enrichment state (individual ticker fetches)
  const [enriched, setEnriched] = useState<TickerDetail[]>([]);
  const [enriching, setEnriching] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState({ done: 0, total: 0, current: '' });

  // Single ticker lookup
  const [lookupTicker, setLookupTicker] = useState('');
  const [lookupData, setLookupData] = useState<TickerDetail | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Filter state — persisted in localStorage
  const [filters, setFilters] = useState<ScannerFilters>(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('scanner-filters') : null;
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_FILTERS;
  });

  const handleFiltersChange = useCallback((next: ScannerFilters) => {
    setFilters(next);
    try { localStorage.setItem('scanner-filters', JSON.stringify(next)); } catch {}
  }, []);

  // Trade card queue — Map<"SYMBOL|strategy|expiration|strikes", savedCardId>
  const [savedCards, setSavedCards] = useState<Map<string, string>>(new Map());
  const [savingCards, setSavingCards] = useState<Set<string>>(new Set());
  const [saveErrors, setSaveErrors] = useState<Map<string, string>>(new Map());

  // Load existing queued cards on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/trade-cards?status=queued');
        if (!res.ok) return;
        const { cards } = await res.json();
        const map = new Map<string, string>();
        for (const c of cards) {
          map.set(buildCardKey(c.symbol, c.strategy_name, c.expiration_date, c.legs), c.id);
        }
        setSavedCards(map);
      } catch { /* ignore auth errors on non-owner pages */ }
    })();
  }, []);

  // Save a card to queue
  const saveCard = useCallback(async (detail: TickerDetail, card: TradeCardData, socialData?: SocialSentimentData) => {
    const cardKey = buildCardKey(detail.symbol, card.setup.strategy_name, card.setup.expiration_date, card.setup.legs);
    setSavingCards(prev => { const next = new Set(prev); next.add(cardKey); return next; });
    setSaveErrors(prev => { const next = new Map(prev); next.delete(cardKey); return next; });

    const comp = detail.scores.composite;
    const ks = card.key_stats;
    const why = card.why;
    const headlines: Headline[] = detail.scores.info_edge?.breakdown?.news_sentiment?.news_detail?.headlines?.slice(0, 5) ?? [];

    const body = {
      symbol: detail.symbol,
      strategy_name: card.setup.strategy_name,
      direction: comp.direction,
      legs: card.setup.legs,
      entry_price: card.setup.net_credit ?? card.setup.net_debit ?? null,
      max_profit: card.setup.max_profit,
      max_loss: card.setup.max_loss,
      win_rate: card.setup.probability_of_profit != null ? Math.round(card.setup.probability_of_profit * 10000) / 100 : null,
      risk_reward: card.setup.risk_reward_ratio,
      thesis_points: why?.plain_english_signals ?? null,
      key_stats: ks ?? null,
      macro_regime: why?.regime_context ?? null,
      sentiment: ks?.analyst_consensus ?? null,
      insider_activity: null,
      headlines: headlines.length > 0 ? headlines.map(h => ({ title: h.headline, source: h.source, sentiment: h.sentiment })) : null,
      dte: card.setup.dte,
      expiration_date: card.setup.expiration_date,
      // Convergence scoring
      composite_score: comp.score ?? null,
      letter_grade: letterGrade(comp.score),
      convergence_gate: comp.convergence_gate ?? null,
      vol_edge_score: detail.scores.composite.category_scores?.vol_edge ?? null,
      quality_score: detail.scores.composite.category_scores?.quality ?? null,
      regime_score: detail.scores.composite.category_scores?.regime ?? null,
      info_edge_score: detail.scores.composite.category_scores?.info_edge ?? null,
      // Volatility detail
      vol_sub_scores: detail.scores.vol_edge?.breakdown ?? null,
      vol_cone: ks?.vol_cone ?? null,
      forward_vol: ks?.forward_vol ?? null,
      // Risk & signals
      risk_flags: why?.risk_flags ?? null,
      plain_signals: why?.plain_english_signals ?? null,
      // Social sentiment
      social_score: socialData?.score ?? null,
      social_post_count: socialData?.postCount ?? null,
      social_themes: socialData?.themes ?? null,
      social_posts: socialData?.samplePosts ?? null,
      // Greeks
      greeks_delta: card.setup.greeks?.delta ?? null,
      greeks_gamma: card.setup.greeks?.gamma ?? null,
      greeks_theta: card.setup.greeks?.theta ?? null,
      greeks_vega: card.setup.greeks?.vega ?? null,
      // Derived metrics
      ev_per_risk: card.setup.ev_per_risk ?? null,
      // Full card snapshot
      full_card_json: card ?? null,
    };

    console.log('[TradeCard] Saving:', cardKey, body);

    try {
      const res = await fetch('/api/trade-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      console.log('[TradeCard] Response:', res.status, data);
      if (res.ok) {
        setSavedCards(prev => {
          const next = new Map(prev);
          next.set(cardKey, data.card.id);
          return next;
        });
      } else {
        console.error('[TradeCard] Save failed:', res.status, data);
        setSaveErrors(prev => new Map(prev).set(cardKey, data.error || `HTTP ${res.status}`));
      }
    } catch (err) {
      console.error('[TradeCard] Save error:', err);
      setSaveErrors(prev => new Map(prev).set(cardKey, 'Network error — check console'));
    } finally {
      setSavingCards(prev => { const next = new Set(prev); next.delete(cardKey); return next; });
    }
  }, []);

  // Remove a card from queue
  const removeCard = useCallback(async (cardKey: string, savedId: string) => {
    console.log('[TradeCard] Removing:', cardKey, savedId);
    try {
      const res = await fetch('/api/trade-cards', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: savedId }),
      });
      const data = await res.json();
      console.log('[TradeCard] Remove response:', res.status, data);
      if (res.ok) {
        setSavedCards(prev => {
          const next = new Map(prev);
          next.delete(cardKey);
          return next;
        });
      } else {
        console.error('[TradeCard] Remove failed:', res.status, data);
      }
    } catch (err) {
      console.error('[TradeCard] Remove error:', err);
    }
  }, []);

  // Scan market — run pipeline with SSE progress, then synthesize with Claude, then enrich each winner
  const scanMarket = useCallback(async () => {
    setScanning(true);
    setBatchError(null);
    setBatchData(null);
    setEnriched([]);
    setEnriching(false);
    setPipelineResult(null);
    setPipelineProgress({});
    try {
      // Step 1: Run the convergence pipeline with SSE streaming for live progress
      const pipelineResults = await new Promise<any>((resolve, reject) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        const url = `/api/trading/convergence?stream=true&limit=9&refresh=true&universe=${encodeURIComponent(universe)}`;
        const eventSource = new EventSource(url);

        eventSource.onmessage = (e) => {
          try {
            const event = JSON.parse(e.data);
            if (event.step === 'done') {
              eventSource.close();
              // Pipeline cached the result — fetch it instantly
              fetch(`/api/trading/convergence?limit=9&universe=${encodeURIComponent(universe)}`)
                .then(r => {
                  if (!r.ok) throw new Error(`Pipeline HTTP ${r.status}`);
                  return r.json();
                })
                .then(resolve)
                .catch(reject);
              return;
            }
            if (event.step === 'error') {
              eventSource.close();
              reject(new Error(event.label));
              return;
            }
            // Update pipeline flow panel in real time
            setPipelineProgress(prev => ({ ...prev, [event.step]: event }));
          } catch { /* ignore parse errors */ }
        };

        eventSource.onerror = () => {
          eventSource.close();
          reject(new Error('Pipeline connection lost'));
        };
      });

      setPipelineResult(pipelineResults);

      // Step 2: Send pipeline results to Claude for synthesis (no re-run)
      const resp = await fetch('/api/ai/convergence-synthesis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipelineResults, refresh: true }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({ error: `Synthesis HTTP ${resp.status}` }));
        throw new Error(body.error || `Synthesis HTTP ${resp.status}`);
      }
      const json: BatchResponse = await resp.json();
      setBatchData(json);
      setScanning(false);

      // Now enrich each top ticker sequentially
      const symbols = json.top_9.map(r => r.symbol);
      if (symbols.length > 0) {
        setEnriching(true);
        setEnrichProgress({ done: 0, total: symbols.length, current: symbols[0] });
        const results: TickerDetail[] = [];
        for (let i = 0; i < symbols.length; i++) {
          setEnrichProgress({ done: i, total: symbols.length, current: symbols[i] });
          try {
            const r = await fetch(`/api/test/convergence?symbol=${encodeURIComponent(symbols[i])}`);
            if (r.ok) {
              const d: TickerDetail = await r.json();
              results.push(d);
              setEnriched([...results]);
            }
          } catch { /* skip failed ticker */ }
          if (i < symbols.length - 1) await delay(1500);
        }
        setEnriching(false);
        setEnrichProgress({ done: symbols.length, total: symbols.length, current: '' });
      }
    } catch (e: unknown) {
      setBatchError(e instanceof Error ? e.message : String(e));
      setScanning(false);
    }
  }, [universe]);

  // Single ticker lookup
  const lookupAnalyze = useCallback(async () => {
    const sym = lookupTicker.trim().toUpperCase();
    if (!sym) return;
    setLookupLoading(true);
    setLookupError(null);
    setLookupData(null);
    try {
      const resp = await fetch(`/api/test/convergence?symbol=${encodeURIComponent(sym)}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      setLookupData(await resp.json());
    } catch (e: unknown) {
      setLookupError(e instanceof Error ? e.message : String(e));
    } finally {
      setLookupLoading(false);
    }
  }, [lookupTicker]);

  return (
    <div className="bg-white rounded border border-border shadow-sm overflow-hidden">

      {/* SECTION 1: UNIVERSE SELECTOR — matches Data Observatory header */}
      <div className="bg-brand-purple">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs font-semibold text-white font-mono uppercase tracking-wider">
            Market Intelligence
          </span>
          <div className="flex items-center gap-2">
            <select
              value={universe}
              onChange={e => setUniverse(e.target.value)}
              disabled={scanning || enriching}
              className="bg-brand-purple-deep text-white text-xs font-mono px-2 py-1 border border-white/10 rounded focus:outline-none focus:ring-1 focus:ring-brand-gold disabled:opacity-50"
            >
              <option value="sp500">S&amp;P 500</option>
              <option value="nasdaq100">Nasdaq 100</option>
              <option value="russell2000">Russell 2000</option>
              <option value="sp400">S&amp;P 400 MidCap</option>
              <option value="dow30">Dow Jones (30)</option>
              <option value="sp600">S&amp;P 600 SmallCap</option>
              <option value="wilshire5000">Wilshire 5000</option>
              <option value="msciusa">MSCI USA</option>
              <option value="russell1000">Russell 1000</option>
            </select>
            <button
              onClick={scanMarket}
              disabled={scanning || enriching}
              className="bg-brand-gold text-white text-xs font-semibold font-mono px-3 py-1 rounded hover:bg-brand-gold-bright transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {(scanning || enriching) && (
                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {scanning ? 'SCANNING...' : enriching ? `LOADING ${enrichProgress.current}...` : 'SCAN MARKET'}
            </button>
          </div>
        </div>
        {/* Pipeline summary — second row inside purple header */}
        {batchData && (
          <div className="px-4 pb-1.5 text-[10px] text-white/60 font-mono">
            {batchData.pipeline_summary.total_universe} scanned
            {' \u2192 '}{batchData.pipeline_summary.after_hard_filters} filtered
            {' \u2192 '}{batchData.pipeline_summary.scored} scored
            {' \u2192 '}{batchData.top_9.length} selected
            {' ('}
            {(batchData.timing.total_ms / 1000).toFixed(1)}s)
          </div>
        )}
      </div>

      {/* Loading state */}
      {scanning && (
        <div className="px-5 py-16 text-center">
          <div className="w-8 h-8 border-3 border-border border-t-brand-purple rounded-full animate-spin mx-auto mb-4" style={{ borderWidth: 3 }} />
          <div className="text-sm font-medium text-text-primary">Running convergence pipeline...</div>
          <div className="text-[10px] text-text-muted mt-1">Scanning universe, applying filters, scoring, ranking</div>
        </div>
      )}

      {/* Batch error */}
      {batchError && (
        <div className="px-5 py-8 text-center">
          <div className="text-brand-red text-sm font-medium mb-2">Scan failed</div>
          <div className="text-brand-red/60 text-xs">{batchError}</div>
        </div>
      )}

      {/* Enrichment progress */}
      {enriching && enrichProgress.total > 0 && (
        <div className="px-5 py-2 flex items-center gap-3 bg-bg-terminal">
          <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-bg-row">
            <div className="h-full rounded-full transition-all duration-300 bg-brand-purple" style={{ width: `${(enrichProgress.done / enrichProgress.total) * 100}%` }} />
          </div>
          <div className="text-[10px] text-text-muted font-mono shrink-0">
            {enrichProgress.done}/{enrichProgress.total} — loading {enrichProgress.current}
          </div>
        </div>
      )}

      {/* FILTER PANEL */}
      <FilterPanel filters={filters} onChange={handleFiltersChange} />

      {/* PIPELINE FLOW PANEL */}
      {(pipelineResult || Object.keys(pipelineProgress).length > 0) && (
        <div className="px-5 py-3">
          <PipelineFlowPanel result={pipelineResult} progress={pipelineProgress} universe={universe} />
        </div>
      )}

      {/* SECTION 2: FULL TRADE CARDS */}
      {enriched.length > 1 && (
        <FilteredResultsSection
          enriched={enriched}
          filters={filters}
          sentimentMap={batchData?.social_sentiment}
          rejectionMap={batchData?.rejection_reasons}
          onResetFilters={() => handleFiltersChange(DEFAULT_FILTERS)}
          savedCards={savedCards}
          savingCards={savingCards}
          saveErrors={saveErrors}
          onSaveCard={saveCard}
          onRemoveCard={removeCard}
          pipelineProgress={pipelineProgress}
        />
      )}
      {enriched.length === 1 && (
        <div className="px-5 py-4 space-y-4">
          <TickerChapter detail={enriched[0]} sentiment={batchData?.social_sentiment?.[enriched[0].symbol]} savedCards={savedCards} savingCards={savingCards} saveErrors={saveErrors} onSave={saveCard} onRemove={removeCard} pipelineProgress={pipelineProgress} />
        </div>
      )}

      {/* Empty state — no scan yet */}
      {!scanning && !batchData && !batchError && enriched.length === 0 && (
        <div className="px-5 py-16 text-center">
          <div className="text-text-muted text-sm">Set your preferences above, then click Scan Market</div>
          <div className="text-text-faint text-xs mt-1">Filters are applied after enrichment — adjust them now or after the scan</div>
        </div>
      )}

      {/* SECTION 3: SINGLE TICKER LOOKUP */}
      <div className="px-5 py-4 border-t border-border">
        <div className="text-[10px] text-text-muted uppercase tracking-wider font-bold mb-2">Look Up a Specific Ticker</div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={lookupTicker}
            onChange={e => setLookupTicker(e.target.value.toUpperCase())}
            onKeyDown={e => { if (e.key === 'Enter') lookupAnalyze(); }}
            placeholder="AAPL"
            className="w-28 px-3 py-1.5 rounded text-sm font-mono font-bold tracking-wider text-text-primary border border-border bg-white focus:outline-none focus:ring-1 focus:ring-brand-purple"
          />
          <Button
            variant="primary"
            size="sm"
            onClick={lookupAnalyze}
            disabled={lookupLoading || !lookupTicker.trim()}
            loading={lookupLoading}
          >
            {lookupLoading ? 'Analyzing...' : 'Analyze'}
          </Button>
        </div>
        {lookupError && <div className="text-brand-red text-xs mt-2">{lookupError}</div>}
        {lookupData && (
          <div className="mt-3">
            <TickerCard detail={lookupData} savedCards={savedCards} savingCards={savingCards} saveErrors={saveErrors} onSave={saveCard} onRemove={removeCard} />
          </div>
        )}
      </div>
    </div>
  );
}
