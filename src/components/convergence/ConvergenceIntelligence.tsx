'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
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

// ── Single-ticker types (from /api/test/convergence) ────────────────

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
  pop_method: 'breakeven_d2' | 'delta_approx';
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
  current_price: number | null;
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

// ── Score breakdown types (imported from canonical types.ts) ──
import type {
  VolEdgeResult,
  QualityGateResult,
  RegimeResult,
  InfoEdgeResult,
} from '@/lib/convergence/types';

interface TickerDetail {
  symbol: string;
  pipeline_runtime_ms: number;
  scores: {
    vol_edge: VolEdgeResult;
    quality: QualityGateResult;
    regime: RegimeResult;
    info_edge: InfoEdgeResult;
    composite: {
      score: number;
      direction: string;
      convergence_gate: string;
      categories_above_50: number;
      category_scores: { vol_edge: number; quality: number; regime: number; info_edge: number };
    };
  };
  trade_cards?: TradeCardData[];
  data_gaps: string[];
  _chain_stats?: Record<string, unknown>;
  _fetch_errors?: Record<string, string>;
  _rejection_reasons?: RejectionReason[];
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

// ── Ticker Card (the full card for one ticker) ─────────────────────

function TickerCard({ detail, sentiment, savedCards, savingCards, saveErrors, onSave, onRemove }: {
  detail: TickerDetail;
  sentiment?: SocialSentimentData;
  savedCards: Map<string, string>; // key: "SYMBOL|strategy_name" → saved card ID
  savingCards: Set<string>;
  saveErrors: Map<string, string>;
  onSave: (detail: TickerDetail, card: TradeCardData) => Promise<void>;
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
      <div className="px-5 py-3 flex items-center justify-between flex-wrap gap-2 bg-brand-purple-hover">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black font-mono text-white">{detail.symbol}</span>
          <span className="text-sm font-black font-mono" style={{ color: gradeColorHex(comp.score) }}>{comp.score.toFixed(1)}</span>
          <span className="text-terminal-lg font-black" style={{ color: gradeColorHex(comp.score) }}>{letterGrade(comp.score)}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={dirBadgeVariant(comp.direction)} size="sm">{comp.direction}</Badge>
          {ks?.sector && <Badge variant="default" size="sm">{ks.sector}</Badge>}
          <Badge variant={gate.variant} size="sm">
            {comp.categories_above_50}/4 {gate.text}
          </Badge>
        </div>
      </div>

      {/* B) SCORE BARS */}
      <div className="px-5 py-3 space-y-1.5 border-b border-border">
        <ScoreBar label="Vol Edge" score={comp.category_scores.vol_edge} />
        <ScoreBar label="Quality" score={comp.category_scores.quality} />
        <ScoreBar label="Regime" score={comp.category_scores.regime} />
        <ScoreBar label="Info Edge" score={comp.category_scores.info_edge} />
      </div>

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

              <div className="px-5 py-3">
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
                    <div className="text-[9px] text-text-muted uppercase" title={card.setup.pop_method === 'breakeven_d2' ? 'PoP via N(d2) at breakeven price' : 'PoP estimated from option deltas (approximate)'}>Est. PoP</div>
                    <div className="text-sm font-mono font-black text-text-primary">{fmtPct(card.setup.probability_of_profit)}</div>
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
                  const cardKey = `${detail.symbol}|${card.setup.strategy_name}`;
                  const savedId = savedCards.get(cardKey);
                  const saving = savingCards.has(cardKey);
                  const error = saveErrors.get(cardKey);
                  if (savedId) {
                    return (
                      <div className="flex items-center justify-center gap-3 mt-3">
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
                      <div className="w-full mt-3">
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
                        onClick={() => onSave(detail, card)}
                        className="w-full mt-3"
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
        <div className="px-5 py-3 border-b border-border">
          <div className="text-[10px] text-text-muted uppercase tracking-wider font-bold mb-2">Why This Trade</div>

          {why.plain_english_signals.length > 0 && (
            <div className="space-y-1.5 mb-3">
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
            const vrpZ = bd.mispricing?.z_scores?.vrp_z;
            const gexRegimeMap: Record<string, { text: string; variant: 'success' | 'danger' | 'default' }> = {
              long_gamma: { text: 'long \u03B3', variant: 'success' },
              short_gamma: { text: 'short \u03B3', variant: 'danger' },
              neutral: { text: 'neutral \u03B3', variant: 'default' },
            };
            return (
              <div className="rounded px-3 py-2.5 mb-2 bg-bg-row">
                <div
                  className="text-[10px] text-text-muted font-mono uppercase tracking-wider font-bold mb-2"
                  title="Five independent signals scored 0–100. Mispricing compares implied vs realized vol. Term structure reads the shape of the vol surface. Technicals confirm price action. Skew detects directional positioning. GEX shows dealer gamma exposure and hedging pressure."
                >
                  Vol Edge Breakdown
                </div>
                <div className="space-y-1.5">
                  {subs.map(({ key, label, score }) => (
                    <div key={key} className="flex items-center gap-2">
                      <div className="w-24 shrink-0 text-[10px] font-medium text-text-secondary">{label}</div>
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-bg-terminal">
                        <div className="h-full rounded-full transition-all duration-500 bg-brand-purple" style={{ width: `${Math.min(Math.round(score), 100)}%` }} />
                      </div>
                      <div className="w-6 text-[10px] font-mono font-bold text-right shrink-0 text-text-secondary">{Math.round(score)}</div>
                      <div className="w-20 shrink-0">
                        {key === 'mispricing' && vrpZ != null && (
                          <span className={`text-[10px] font-mono ${vrpZ > 0.5 ? 'text-brand-green' : vrpZ < -0.5 ? 'text-brand-red' : 'text-text-muted'}`}>
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
              <div className="rounded px-3 py-2.5 mb-2 bg-bg-row">
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

          {/* Regime context */}
          <div className="rounded px-3 py-2 text-xs text-text-secondary leading-relaxed mb-2 bg-bg-row">
            {why.regime_context}
          </div>

          {/* Risk flags */}
          {why.risk_flags.length > 0 && (
            <div className="space-y-1">
              {why.risk_flags.map((flag, i) => {
                const isRed = flag.startsWith('UNLIMITED') || flag.startsWith('INSIDER');
                return (
                  <div key={i} className={`flex items-start gap-2 rounded px-3 py-1.5 text-[10px] font-medium leading-relaxed ${isRed ? 'bg-red-50 text-brand-red' : 'bg-amber-50 text-brand-amber'}`}>
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
        <div className="px-5 py-3 border-b border-border">
          <div className="text-[10px] text-text-muted uppercase tracking-wider font-bold mb-2">Key Stats</div>
          <div className="space-y-2 text-xs">
            {/* Volatility row */}
            <div>
              <span className="text-text-muted font-medium">Volatility: </span>
              <span className="text-text-secondary font-mono">
                IV Rank {ks.iv_rank != null ? ks.iv_rank.toFixed(2) : '—'}
                {ks.iv_rank != null && <span className="text-text-muted"> — {statExplain('iv_rank', ks.iv_rank)}</span>}
                {' | '}IV {ks.iv30 != null ? `${ks.iv30.toFixed(1)}%` : '—'}
                {' | '}HV {ks.hv30 != null ? `${ks.hv30.toFixed(1)}%` : '—'}
              </span>
            </div>
            {/* Company row */}
            <div>
              <span className="text-text-muted font-medium">Company: </span>
              <span className="text-text-secondary font-mono">
                P/E {ks.pe_ratio != null ? ks.pe_ratio.toFixed(1) : '—'}
                {ks.pe_ratio != null && <span className="text-text-muted"> — {statExplain('pe_ratio', ks.pe_ratio)}</span>}
                {' | '}Cap {fmtMcap(ks.market_cap)}
                {' | '}Earnings {ks.earnings_date ?? '—'}
                {ks.days_to_earnings != null && ks.days_to_earnings > 0 && <span className="text-brand-amber"> ({ks.days_to_earnings}d away)</span>}
              </span>
            </div>
            {/* Market row */}
            <div>
              <span className="text-text-muted font-medium">Market: </span>
              <span className="text-text-secondary font-mono">
                Beta {ks.beta != null ? ks.beta.toFixed(2) : '—'}
                {ks.beta != null && <span className="text-text-muted"> — {statExplain('beta', ks.beta)}</span>}
                {' | '}SPY Corr {ks.spy_correlation != null ? ks.spy_correlation.toFixed(2) : '—'}
                {ks.spy_correlation != null && <span className="text-text-muted"> — {statExplain('spy_correlation', ks.spy_correlation)}</span>}
                {' | '}Liquidity {ks.liquidity_rating != null ? `${ks.liquidity_rating}/5` : '—'}
              </span>
            </div>
            {/* Sentiment row */}
            <div>
              <span className="text-text-muted font-medium">Sentiment: </span>
              <span className="text-text-secondary font-mono">
                Analysts: {ks.analyst_consensus ?? '—'}
                {' | '}Buzz {ks.buzz_ratio != null ? `${ks.buzz_ratio.toFixed(1)}x` : '—'}
                {ks.buzz_ratio != null && <span className="text-text-muted"> — {statExplain('buzz_ratio', ks.buzz_ratio)}</span>}
                {' | '}Trend {ks.sentiment_momentum != null ? ks.sentiment_momentum.toFixed(0) : '—'}
                {ks.sentiment_momentum != null && <span className="text-text-muted"> — {statExplain('sentiment_momentum', ks.sentiment_momentum)}</span>}
              </span>
            </div>
            {/* Social Pulse row — from xAI x_search */}
            {sentiment && !sentiment.error && sentiment.postCount > 0 && (
              <div>
                <span className="text-text-muted font-medium">Social Pulse: </span>
                <span
                  className={`font-mono font-bold ${sentiment.score > 0.2 ? 'text-brand-green' : sentiment.score < -0.2 ? 'text-brand-red' : 'text-text-muted'}`}
                >
                  {sentiment.score > 0 ? '+' : ''}{sentiment.score.toFixed(2)}
                </span>
                <span className="text-text-faint font-mono">
                  {' '}({sentiment.postCount} posts
                  {' | '}{sentiment.bullishCount}B/{sentiment.bearishCount}b/{sentiment.neutralCount}N)
                </span>
                {sentiment.themes.length > 0 && (
                  <span className="ml-2">
                    {sentiment.themes.slice(0, 3).map((t, i) => (
                      <Badge key={i} variant="default" size="sm" className="mr-1">{t}</Badge>
                    ))}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* F) TOP HEADLINES */}
      {headlines.length > 0 && (
        <div className="px-5 py-3">
          <div className="text-[10px] text-text-muted uppercase tracking-wider font-bold mb-2">Recent Headlines</div>
          <div className="space-y-1.5">
            {headlines.map((h, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className="text-text-secondary leading-relaxed flex-1">&ldquo;{h.headline}&rdquo;</span>
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
    </div>
  );
}

// ── Filtered Results Section ────────────────────────────────────────

function FilteredResultsSection({
  enriched, filters, sentimentMap, rejectionMap, onResetFilters,
  savedCards, savingCards, saveErrors, onSaveCard, onRemoveCard,
}: {
  enriched: TickerDetail[];
  filters: ScannerFilters;
  sentimentMap?: Record<string, SocialSentimentData>;
  rejectionMap?: Record<string, RejectionReason[]>;
  onResetFilters: () => void;
  savedCards: Map<string, string>;
  savingCards: Set<string>;
  saveErrors: Map<string, string>;
  onSaveCard: (detail: TickerDetail, card: TradeCardData) => Promise<void>;
  onRemoveCard: (cardKey: string, savedId: string) => Promise<void>;
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
      />
    </>
  );
}

// ── Main Component ──────────────────────────────────────────────────

export default function ConvergenceIntelligence() {
  // Batch scan state
  const [universe, setUniverse] = useState('popular');
  const [scanning, setScanning] = useState(false);
  const [batchData, setBatchData] = useState<BatchResponse | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);

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

  // Trade card queue — Map<"SYMBOL|strategy_name", savedCardId>
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
          map.set(`${c.symbol}|${c.strategy_name}`, c.id);
        }
        setSavedCards(map);
      } catch { /* ignore auth errors on non-owner pages */ }
    })();
  }, []);

  // Save a card to queue
  const saveCard = useCallback(async (detail: TickerDetail, card: TradeCardData) => {
    const cardKey = `${detail.symbol}|${card.setup.strategy_name}`;
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

  // Scan market — run pipeline, then synthesize with Claude, then enrich each winner
  const scanMarket = useCallback(async () => {
    setScanning(true);
    setBatchError(null);
    setBatchData(null);
    setEnriched([]);
    setEnriching(false);
    try {
      // Step 1: Run the convergence pipeline
      const pipelineResp = await fetch(`/api/trading/convergence?limit=9&refresh=true`);
      if (!pipelineResp.ok) {
        const body = await pipelineResp.json().catch(() => ({ error: `Pipeline HTTP ${pipelineResp.status}` }));
        throw new Error(body.error || `Pipeline HTTP ${pipelineResp.status}`);
      }
      const pipelineResults = await pipelineResp.json();

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
              <optgroup label="Indices">
                <option value="popular">Popular (50)</option>
                <option value="megacap">Mega Cap (30)</option>
                <option value="nasdaq100">Nasdaq 100</option>
                <option value="dow30">Dow 30</option>
                <option value="sp500">S&amp;P 500</option>
              </optgroup>
              <optgroup label="ETFs">
                <option value="etfs">ETFs (25)</option>
              </optgroup>
              <optgroup label="Sectors">
                <option value="tech">Tech</option>
                <option value="finance">Finance</option>
                <option value="energy">Energy</option>
                <option value="healthcare">Healthcare</option>
                <option value="retail">Retail Favorites</option>
              </optgroup>
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
        />
      )}
      {enriched.length === 1 && (
        <div className="px-5 py-4 space-y-4">
          <TickerCard detail={enriched[0]} sentiment={batchData?.social_sentiment?.[enriched[0].symbol]} savedCards={savedCards} savingCards={savingCards} saveErrors={saveErrors} onSave={saveCard} onRemove={removeCard} />
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
