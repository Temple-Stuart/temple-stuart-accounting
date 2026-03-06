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

// ── Ticker Card (the full card for one ticker) ─────────────────────

export function TickerCard({ detail, sentiment, savedCards, savingCards, saveErrors, onSave, onRemove }: {
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
      <div className="px-5 py-3 space-y-1.5 border-b border-border">
        <div title="Volatility Edge (0–100): measures whether options are mispriced relative to realized vol. Combines VRP z-score, IV percentile, term structure shape, skew asymmetry, and dealer gamma exposure. Above 50 = options appear expensive = edge for premium sellers."><ScoreBar label="Vol Edge" score={comp.category_scores.vol_edge} /></div>
        <div title="Quality Gate (0–100): measures the fundamental health of the underlying company. Combines Piotroski F-Score safety, profitability margins, earnings quality (accrual ratio + beat rate), and growth trajectory. Above 50 = high-quality underlying."><ScoreBar label="Quality" score={comp.category_scores.quality} /></div>
        <div title="Macro Regime Gate (0–100): measures whether the current macro environment favors the trade direction. Scored from 14 FRED macro indicators including GDP, CPI, Fed Funds, yield curve, and credit spreads. Above 50 = favorable macro backdrop."><ScoreBar label="Regime" score={comp.category_scores.regime} /></div>
        <div title="Information Edge Gate (0–100): measures signals of informed activity. Combines insider net purchase ratio (MSPR), institutional ownership changes, analyst upgrades/downgrades, SUE earnings surprise, and FinBERT news sentiment. Above 50 = positive information asymmetry."><ScoreBar label="Info Edge" score={comp.category_scores.info_edge} /></div>
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
              <div className="rounded px-3 py-2.5 mb-2 bg-bg-row">
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
        <div className="px-5 py-3 border-b border-border">
          <div className="text-[10px] text-text-muted uppercase tracking-wider font-bold mb-2">Key Stats</div>
          <div className="space-y-2 text-xs">
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
            {/* Social Pulse row — from xAI x_search */}
            {sentiment && !sentiment.error && sentiment.postCount > 0 && (
              <div>
                <span className="text-text-muted font-medium">Social Pulse: </span>
                <span
                  className={`font-mono font-bold ${sentiment.score > 0.2 ? 'text-brand-green' : sentiment.score < -0.2 ? 'text-brand-red' : 'text-text-muted'}`}
                  title="Aggregate sentiment score from real X (Twitter) posts analyzed by xAI Grok. Range -1.0 (fully bearish) to +1.0 (fully bullish). Based on actual post content, not price action."
                >
                  {sentiment.score > 0 ? '+' : ''}{sentiment.score.toFixed(2)}
                </span>
                <span className="text-text-faint font-mono" title="Breakdown of post sentiment classification by xAI Grok. Each post classified as bullish, bearish, or neutral based on content analysis.">
                  {' '}(<span title="Number of recent X/Twitter posts about this ticker analyzed by xAI Grok. Higher count = more data points = higher confidence in the sentiment reading.">{sentiment.postCount} posts</span>
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
  // Render from live progress if result not yet available
  const isLive = !result && progress && Object.keys(progress).length > 0;
  if (!result && !isLive) return null;
  const ps = result?.pipeline_summary;
  const hf = result?.hard_filters;
  const rankings = result?.rankings;
  const rejections = result?.rejection_reasons ?? {};

  // Unified data accessors: prefer live progress, fall back to final result
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bData: any = progress?.b?.data ?? (result ? { input: ps?.total_universe, output: hf?.output_count, filters: hf?.filters_applied, survivors: hf?.survivors } : null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eData: any = progress?.e?.data ?? (result ? { finnhub_calls: ps?.finnhub_calls_made, finnhub_errors: ps?.finnhub_errors, data_gaps: result.data_gaps } : null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fData: any = progress?.f?.data ?? (result ? { scored: ps?.scored, rankings: [...(rankings?.top_9 ?? []), ...(rankings?.also_scored ?? [])] } : null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gData: any = progress?.g?.data ?? (result ? { trade_cards: ps?.total_trade_cards, top_9: rankings?.top_9?.map((r: any) => r.symbol), rejections: result.rejection_reasons } : null); // eslint-disable-line @typescript-eslint/no-explicit-any

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
        <div className="px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-bg-row" onClick={() => toggle('a')}>
          <div className="flex items-center gap-3">
            <span className="text-brand-purple font-bold">STEP A</span>
            <span className="text-text-secondary">TT Scanner — Universe Scan</span>
            {(ps?.total_universe ?? progress?.a?.data?.total_universe) ? (
              <>
                <span className="text-brand-green">{ps?.total_universe ?? progress?.a?.data?.total_universe ?? 0} symbols fetched</span>
                <span className="text-text-muted">({universe})</span>
              </>
            ) : (
              <span className="text-text-muted animate-pulse">waiting...</span>
            )}
          </div>
          <span className="text-text-muted">{expanded['a'] ? '▲' : '▼'}</span>
        </div>
        {expanded['a'] && (
          <div className="px-8 py-2 border-t border-border bg-bg-row space-y-2">
            <div className="text-text-muted">
              Universe scanned via TastyTrade market-metrics API. Batch size: 50.
              Market open: {(ps?.market_open ?? progress?.a?.data?.market_open) ? 'YES — live Greeks' : 'NO — theoretical pricing'}
            </div>
            {(progress?.a?.data?.symbols ?? []).length > 0 ? (
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                <table className="w-full text-[10px]">
                  <thead><tr className="text-text-muted border-b border-border">
                    <th className="text-right py-1 px-1">#</th><th className="text-left py-1 px-1">SYMBOL</th><th className="text-right py-1 px-1">IV RANK</th><th className="text-right py-1 px-1">IV%</th><th className="text-right py-1 px-1">HV30</th><th className="text-right py-1 px-1">LIQ</th><th className="text-right py-1 px-1">MKT CAP</th><th className="text-left py-1 px-1">SECTOR</th>
                  </tr></thead>
                  <tbody>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(progress?.a?.data?.symbols ?? []).map((s: any, i: number) => (
                      <tr key={s.symbol} className="border-b border-border/50 hover:bg-bg-card">
                        <td className="py-0.5 px-1 text-right text-text-muted">{i + 1}</td>
                        <td className="py-0.5 px-1 font-bold text-text-primary">{s.symbol}</td>
                        <td className="py-0.5 px-1 text-right">{s.ivRank?.toFixed(0) ?? '—'}</td>
                        <td className="py-0.5 px-1 text-right">{s.ivPercentile?.toFixed(0) ?? '—'}</td>
                        <td className="py-0.5 px-1 text-right">{s.hv30?.toFixed(1) ?? '—'}</td>
                        <td className="py-0.5 px-1 text-right">{s.liquidityRating ?? '—'}</td>
                        <td className="py-0.5 px-1 text-right">{fmtMcap(s.marketCap)}</td>
                        <td className="py-0.5 px-1 text-text-muted">{s.sector ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-text-muted">Symbol table loads on next scan.</div>
            )}
          </div>
        )}
      </div>

      {/* Step A2 */}
      <div className="border-b border-border">
        <div className="px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-bg-row" onClick={() => toggle('a2')}>
          <div className="flex items-center gap-3">
            <span className="text-brand-purple font-bold">STEP B</span>
            <span className="text-text-secondary">Pre-Filter</span>
            {progress?.a2 ? (
              <span className="text-brand-red">
                {progress.a2.data.input} → {progress.a2.data.output} survived
                {(progress.a2.data.excluded as number) > 0 && ` (${progress.a2.data.excluded} excluded)`}
              </span>
            ) : (
              <span className="text-text-muted animate-pulse">waiting...</span>
            )}
          </div>
          <span className="text-text-muted">{expanded['a2'] ? '▲' : '▼'}</span>
        </div>
        {expanded['a2'] && progress?.a2 && (
          <div className="px-8 py-2 border-t border-border bg-bg-row space-y-2">
            <div className="text-text-muted">Formula: Pre-Score = (IV Rank × 60%) + (Liquidity × 40%). Tickers scoring below liquidity threshold are excluded before expensive data fetching begins.</div>
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
              <table className="w-full text-[10px]">
                <thead><tr className="text-text-muted border-b border-border">
                  <th className="text-right py-1 px-1">#</th><th className="text-left py-1 px-1">SYMBOL</th><th className="text-right py-1 px-1">PRE-SCORE</th><th className="text-right py-1 px-1">IV RANK</th><th className="text-right py-1 px-1">LIQUIDITY</th><th className="text-left py-1 px-1">WHAT HAPPENED</th>
                </tr></thead>
                <tbody>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(progress.a2.data.tickers as any[] ?? []).map((t: any, i: number) => (
                    <tr key={t.symbol} className="border-b border-border/50">
                      <td className="py-0.5 px-1 text-right text-text-muted">{i + 1}</td>
                      <td className="py-0.5 px-1 font-bold text-text-primary">{t.symbol}</td>
                      <td className="py-0.5 px-1 text-right">{t.pre_score}</td>
                      <td className="py-0.5 px-1 text-right">{t.iv_rank ?? '—'}</td>
                      <td className="py-0.5 px-1 text-right">{t.liquidity ?? '—'}/5</td>
                      <td className={`py-0.5 px-1 ${t.excluded ? 'text-brand-red' : 'text-brand-green'}`}>{t.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Step C — Top-N Selection */}
      <div className="border-b border-border">
        <div className="px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-bg-row" onClick={() => toggle('c_narrow')}>
          <div className="flex items-center gap-3">
            <span className="text-brand-purple font-bold">STEP C</span>
            <span className="text-text-secondary">Top-N Selection</span>
            {progress?.a2 ? (
              <span className="text-brand-gold">{progress.a2.data.output} → {progress?.b?.data?.input ?? 36} candidates for hard filters</span>
            ) : (
              <span className="text-text-muted animate-pulse">waiting...</span>
            )}
          </div>
          <span className="text-text-muted">{expanded['c_narrow'] ? '▲' : '▼'}</span>
        </div>
        {expanded['c_narrow'] && progress?.a2 && (
          <div className="border-t border-border bg-bg-row p-3">
            <p className="text-text-muted text-xs mb-2">
              <span className="text-text-primary font-bold">What this does:</span>{' '}After pre-scoring all {progress.a2.data.output} survived tickers, the pipeline selects only the top-scoring candidates to run through the expensive hard filter checks. Formula: limit × 4 candidates (9 final trades × 4 = 36). This prevents wasting time filtering tickers that would never rank high enough to be selected anyway.
            </p>
            <div className="overflow-y-auto" style={{maxHeight: '200px'}}>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-text-muted border-b border-border">
                    <th className="text-left py-1 pr-3">#</th>
                    <th className="text-left py-1 pr-3">SYMBOL</th>
                    <th className="text-right py-1 pr-3">PRE-SCORE</th>
                    <th className="text-right py-1 pr-3">IV RANK</th>
                    <th className="text-right py-1 pr-3">LIQUIDITY</th>
                    <th className="text-left py-1">STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(progress.a2.data.tickers ?? []).filter((t: any) => !t.excluded).slice(0, progress?.b?.data?.input ?? 36).map((t: any, i: number) => (
                    <tr key={t.symbol} className="border-b border-border/50">
                      <td className="py-1 pr-3 text-text-muted">{i + 1}</td>
                      <td className="py-1 pr-3 font-bold">{t.symbol}</td>
                      <td className="py-1 pr-3 text-right text-brand-gold">{t.pre_score}</td>
                      <td className="py-1 pr-3 text-right">{t.iv_rank ?? '—'}</td>
                      <td className="py-1 pr-3 text-right">{t.liquidity ?? '—'}/5</td>
                      <td className="py-1 text-brand-green">✓ Selected for hard filters</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Step D — Hard Filters */}
      <div className="border-b border-border">
        <div className="px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-bg-row" onClick={() => toggle('b')}>
          <div className="flex items-center gap-3">
            <span className="text-brand-purple font-bold">STEP D</span>
            <span className="text-text-secondary">Hard Filters</span>
            {(hf?.output_count != null || progress?.b) ? (
              <span className="text-brand-red">{hf?.input_count ?? progress?.b?.data?.input ?? 0} → {hf?.output_count ?? progress?.b?.data?.output ?? 0} survived</span>
            ) : (
              <span className="text-text-muted animate-pulse">waiting...</span>
            )}
          </div>
          <span className="text-text-muted">{expanded['b'] ? '▲' : '▼'}</span>
        </div>
        {expanded['b'] && (
          <div className="px-8 py-2 border-t border-border bg-bg-row space-y-3">
            {/* Table 1: Filters Applied */}
            <table className="w-full text-[10px]">
              <thead><tr className="text-text-muted border-b border-border">
                <th className="text-left py-1 px-1">FILTER</th><th className="text-right py-1 px-1">DROPPED</th><th className="text-right py-1 px-1">PASSED</th><th className="text-left py-1 px-1">THRESHOLD</th><th className="text-left py-1 px-1">WHAT HAPPENED</th>
              </tr></thead>
              <tbody>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {filterRows.map((f: any) => {
                  const thresholdMap: Record<string, string> = { market_cap: '> $2B market cap', liquidity: '≥ 2/5 liquidity', liquidityRating: '≥ 2/5 liquidity', iv30: 'IV data required', borrow_rate: '< 50% borrow rate', borrowRate: '< 50% borrow rate', earnings: 'no earnings in 7d', no_earnings_7d: 'no earnings in 7d' };
                  const threshold = thresholdMap[f.name] ?? f.name;
                  return (
                    <tr key={f.name} className="border-b border-border/50">
                      <td className="py-0.5 px-1 font-bold text-text-primary">{f.name}</td>
                      <td className="py-0.5 px-1 text-right text-brand-red">{f.dropped}</td>
                      <td className="py-0.5 px-1 text-right text-brand-green">{f.passed}</td>
                      <td className="py-0.5 px-1 text-text-muted">{threshold}</td>
                      <td className="py-0.5 px-1">{f.dropped > 0 ? <span className="text-brand-red">{f.dropped} tickers dropped</span> : <span className="text-brand-green">all passed</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {/* Table 2: Survivors */}
            <div>
              <div className="text-text-muted font-bold mb-1">SURVIVORS ({bData?.survivors?.length ?? 0})</div>
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                <table className="w-full text-[10px]">
                  <thead><tr className="text-text-muted border-b border-border">
                    <th className="text-right py-1 px-1">#</th><th className="text-left py-1 px-1">SYMBOL</th><th className="text-left py-1 px-1">REASON</th>
                  </tr></thead>
                  <tbody>
                    {(bData?.survivors ?? []).map((sym: string, i: number) => (
                      <tr key={sym} className="border-b border-border/50">
                        <td className="py-0.5 px-1 text-right text-text-muted">{i + 1}</td>
                        <td className="py-0.5 px-1 font-bold text-text-primary">{sym}</td>
                        <td className="py-0.5 px-1 text-brand-green">✓ Passed all 5 filters</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Step C */}
      <div className="border-b border-border">
        <div className="px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-bg-row" onClick={() => toggle('c')}>
          <div className="flex items-center gap-3">
            <span className="text-brand-purple font-bold">STEP E</span>
            <span className="text-text-secondary">Peer Grouping</span>
            {progress?.b ? (
              <span className="text-brand-green">Finnhub peer relationships mapped</span>
            ) : (
              <span className="text-text-muted animate-pulse">waiting...</span>
            )}
          </div>
          <span className="text-text-muted">{expanded['c'] ? '▲' : '▼'}</span>
        </div>
        {expanded['c'] && (
          <div className="border-t border-border bg-bg-row p-3 text-xs">
            <p className="text-text-muted mb-1">
              <span className="text-text-primary font-bold">What this does:</span>{' '}
              Each stock is benchmarked against similar companies using Finnhub peer data. Instead of asking &quot;is this stock&apos;s IV high?&quot; we ask &quot;is this stock&apos;s IV high compared to its industry peers?&quot; This prevents large-cap tech stocks from always dominating just because they have higher absolute IV.
            </p>
            <p className="text-text-muted">
              Peer data is used internally during scoring (Step H) — relative z-scores are computed per metric vs peer group.
            </p>
          </div>
        )}
      </div>

      {/* Step D */}
      <div className="border-b border-border">
        <div className="px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-bg-row" onClick={() => toggle('d')}>
          <div className="flex items-center gap-3">
            <span className="text-brand-purple font-bold">STEP F</span>
            <span className="text-text-secondary">Pre-Score</span>
            {(ps?.finnhub_fetched != null || progress?.d) ? (
              <span className="text-brand-gold">{bData?.output ?? 0} → {ps?.finnhub_fetched ?? progress?.d?.data?.candidates ?? 0} selected for enrichment</span>
            ) : (
              <span className="text-text-muted animate-pulse">waiting...</span>
            )}
          </div>
          <span className="text-text-muted">{expanded['d'] ? '▲' : '▼'}</span>
        </div>
        {expanded['d'] && (
          <div className="px-8 py-2 border-t border-border bg-bg-row space-y-2">
            <div className="text-text-muted">Pre-score formula: 40% × IV Percentile + 30% × IV-HV Spread + 30% × Liquidity Rating</div>
            <p className="text-text-muted text-xs mb-2">
              <span className="text-text-primary font-bold">Why top {progress?.d?.data?.candidates ?? 18}?</span>{' '}
              The pipeline limits expensive Finnhub API calls to the highest pre-scoring tickers only. Each ticker requires ~8 API calls (earnings, financials, insider data, etc). Running all {progress?.b?.data?.output ?? '?'} survivors would take too long and cost too many API credits.
            </p>
            {(progress?.d?.data?.pre_scores ?? []).length > 0 ? (
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                <table className="w-full text-[10px]">
                  <thead><tr className="text-text-muted border-b border-border">
                    <th className="text-right py-1 px-1">RANK</th><th className="text-left py-1 px-1">SYMBOL</th><th className="text-right py-1 px-1">PRE-SCORE</th><th className="text-right py-1 px-1">IV%</th><th className="text-right py-1 px-1">IV-HV SPREAD</th><th className="text-right py-1 px-1">LIQUIDITY</th><th className="text-left py-1 px-1">STATUS</th>
                  </tr></thead>
                  <tbody>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(progress?.d?.data?.pre_scores ?? []).map((r: any, i: number) => (
                      <tr key={r.symbol} className="border-b border-border/50 hover:bg-bg-card">
                        <td className="py-0.5 px-1 text-right text-text-muted">{i + 1}</td>
                        <td className="py-0.5 px-1 font-bold text-text-primary">{r.symbol}</td>
                        <td className="py-0.5 px-1 text-right text-brand-gold">{r.pre_score?.toFixed(1) ?? '—'}</td>
                        <td className="py-0.5 px-1 text-right">{r.ivp?.toFixed(0) ?? '—'}</td>
                        <td className="py-0.5 px-1 text-right">{r.iv_hv_spread?.toFixed(1) ?? '—'}</td>
                        <td className="py-0.5 px-1 text-right">{r.liquidity?.toFixed(0) ?? '—'}</td>
                        <td className="py-0.5 px-1 text-brand-green">✓ Selected</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-text-muted">{progress?.d?.data?.candidates ?? 0} candidates selected for enrichment.</div>
            )}
          </div>
        )}
      </div>

      {/* Step E */}
      <div className="border-b border-border">
        <div className="px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-bg-row" onClick={() => toggle('e')}>
          <div className="flex items-center gap-3">
            <span className="text-brand-purple font-bold">STEP G</span>
            <span className="text-text-secondary">Data Enrichment</span>
            {(ps?.finnhub_calls_made != null || progress?.e) ? (
              <span className="text-text-secondary">
                {ps?.finnhub_calls_made ?? progress?.e?.data?.finnhub_calls ?? 0} Finnhub calls
                {(ps?.finnhub_errors > 0 || (progress?.e?.data?.finnhub_errors ?? 0) > 0) && (
                  <span className="text-brand-red"> · {ps?.finnhub_errors ?? progress?.e?.data?.finnhub_errors} errors</span>
                )}
              </span>
            ) : (
              <span className="text-text-muted animate-pulse">waiting...</span>
            )}
          </div>
          <span className="text-text-muted">{expanded['e'] ? '▲' : '▼'}</span>
        </div>
        {expanded['e'] && (
          <div className="px-8 py-2 border-t border-border bg-bg-row">
            <div className="text-xs space-y-2">
              <p className="text-text-muted">
                <span className="text-text-primary font-bold">What this step does:</span>{' '}Fetches institutional-grade data for each of the {progress?.d?.data?.candidates ?? 18} selected tickers from 8 sources in parallel.
              </p>
              <div className="grid grid-cols-2 gap-1 text-text-muted">
                <div>📊 46 quarters of earnings history</div>
                <div>🏦 Institutional ownership %</div>
                <div>💼 Insider buy/sell transactions</div>
                <div>📈 Revenue breakdown by segment</div>
                <div>📄 SEC filings (10-K, Form 4)</div>
                <div>🤖 FinBERT news sentiment</div>
                <div>🌍 FRED macro data (14 series)</div>
                <div>💡 Earnings quality score</div>
              </div>
              {(eData?.data_gaps ?? []).length > 0 && (
                <div className="pt-1">
                  <span className="text-brand-red font-bold">Data gaps:</span>
                  {(eData?.data_gaps ?? []).map((g: string, i: number) => (
                    <div key={i} className="text-brand-red">⚠ {g}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Step F */}
      <div className="border-b border-border">
        <div className="px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-bg-row" onClick={() => toggle('f')}>
          <div className="flex items-center gap-3">
            <span className="text-brand-purple font-bold">STEP H</span>
            <span className="text-text-secondary">4-Gate Scoring</span>
            {(ps?.scored != null || progress?.f) ? (
              <span className="text-brand-green">{ps?.scored ?? progress?.f?.data?.scored ?? 0} tickers scored</span>
            ) : (
              <span className="text-text-muted animate-pulse">waiting...</span>
            )}
          </div>
          <span className="text-text-muted">{expanded['f'] ? '▲' : '▼'}</span>
        </div>
        {expanded['f'] && (
          <div className="px-8 py-2 border-t border-border bg-bg-row space-y-2">
            {progress?.f?.data?.weights && (
              <div className="p-2 bg-bg-card rounded text-[10px]">
                <span className="text-text-muted">Weights used (regime: <span className="text-brand-gold">{progress.f.data.regime as string}</span>): </span>
                Vol Edge {(progress.f.data.weights as any).vol_edge}% · Quality {(progress.f.data.weights as any).quality}% · Regime {(progress.f.data.weights as any).regime}% · Info Edge {(progress.f.data.weights as any).info_edge}%
              </div>
            )}
            <p className="text-text-muted text-xs mb-2">
              Each gate scores 0-100. Composite = weighted average. Weights shift based on detected macro regime — in stagflation, Quality and Regime matter more than Vol Edge.
            </p>
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
              <table className="w-full text-[10px]">
                <thead><tr className="text-text-muted border-b border-border">
                  <th className="text-right py-1 px-1">RANK</th><th className="text-left py-1 px-1">SYMBOL</th><th className="text-right py-1 px-1">VOL</th><th className="text-right py-1 px-1">QUAL</th><th className="text-right py-1 px-1">REG</th><th className="text-right py-1 px-1">INFO</th><th className="text-right py-1 px-1">SCORE</th><th className="text-left py-1 px-1">STATUS</th>
                </tr></thead>
                <tbody>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(fData?.rankings ?? []).map((r: any, i: number) => (
                    <tr key={r.symbol} className="border-b border-border/50 hover:bg-bg-card">
                      <td className="py-0.5 px-1 text-right text-text-muted">{i + 1}</td>
                      <td className="py-0.5 px-1 font-bold text-text-primary">{r.symbol}</td>
                      <td className="py-0.5 px-1 text-right">{r.vol_edge?.toFixed(0) ?? '—'}</td>
                      <td className="py-0.5 px-1 text-right">{r.quality?.toFixed(0) ?? '—'}</td>
                      <td className="py-0.5 px-1 text-right">{r.regime?.toFixed(0) ?? '—'}</td>
                      <td className="py-0.5 px-1 text-right">{r.info_edge?.toFixed(0) ?? '—'}</td>
                      <td className={`py-0.5 px-1 text-right font-bold ${r.composite >= 60 ? 'text-brand-green' : r.composite >= 50 ? 'text-brand-gold' : 'text-text-muted'}`}>{r.composite?.toFixed(1) ?? '—'}</td>
                      <td className="py-0.5 px-1">{i < 9 ? <span className="text-brand-green">✓ Selected for trade cards</span> : <span className="text-text-muted">Scored — below top 9 cutoff</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Step G */}
      <div className="border-b border-border">
        <div className="px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-bg-row" onClick={() => toggle('g')}>
          <div className="flex items-center gap-3">
            <span className="text-brand-purple font-bold">STEP I</span>
            <span className="text-text-secondary">Trade Cards</span>
            {(ps?.total_trade_cards != null || progress?.g) ? (
              <span className="text-brand-green">{ps?.total_trade_cards ?? progress?.g?.data?.trade_cards ?? 0} strategies generated</span>
            ) : (
              <span className="text-text-muted animate-pulse">waiting...</span>
            )}
          </div>
          <span className="text-text-muted">{expanded['g'] ? '▲' : '▼'}</span>
        </div>
        {expanded['g'] && (
          <div className="px-8 py-2 border-t border-border bg-bg-row">
            <p className="text-text-muted text-xs mb-2">
              Selection rules in order: (1) composite score rank, (2) must have ≥ 3 of 4 gates above 50 — &quot;convergence&quot;, (3) quality score ≥ 40, (4) max 2 tickers per sector — diversity rule. Top 9 survivors get options chains fetched and trade cards built.
            </p>
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
              <table className="w-full text-[10px]">
                <thead><tr className="text-text-muted border-b border-border">
                  <th className="text-left py-1 px-1">SYMBOL</th><th className="text-left py-1 px-1">STRATEGY</th><th className="text-left py-1 px-1">STATUS</th>
                </tr></thead>
                <tbody>
                  {(gData?.top_9 ?? []).map((symbol: string) => {
                    const rej = gData?.rejections?.[symbol];
                    const hasRejection = rej?.length > 0;
                    return (
                      <tr key={symbol} className="border-b border-border/50 hover:bg-bg-card">
                        <td className="py-0.5 px-1 font-bold text-text-primary">{symbol}</td>
                        <td className="py-0.5 px-1 text-text-muted">{hasRejection ? rej[0].strategy ?? '—' : 'auto-selected'}</td>
                        <td className="py-0.5 px-1">{hasRejection ? <span className="text-brand-red">✗ {rej[0].reason}</span> : <span className="text-brand-green">✓ Strategy generated</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="px-4 py-2 flex items-center gap-4 text-text-muted">
        <span>{ps?.total_universe ?? progress?.a?.data?.total_universe ?? 0} scanned</span>
        <span>→</span>
        <span>{hf?.output_count ?? progress?.b?.data?.output ?? 0} filtered</span>
        <span>→</span>
        <span>{ps?.scored ?? progress?.f?.data?.scored ?? 0} scored</span>
        <span>→</span>
        <span className="text-brand-green">{ps?.final_9?.length ?? progress?.g?.data?.top_9?.length ?? 0} selected</span>
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

      {/* PIPELINE FLOW PANEL */}
      {(pipelineResult || Object.keys(pipelineProgress).length > 0) && (
        <div className="px-5 py-3">
          <PipelineFlowPanel result={pipelineResult} progress={pipelineProgress} universe={universe} />
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
