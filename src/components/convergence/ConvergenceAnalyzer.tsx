'use client';

import { useState, useCallback } from 'react';

/* ===================================================================
   ConvergenceAnalyzer — single-ticker deep-dive dashboard
   Dark theme, screenshot-ready, zero hidden content.
   Fetches from /api/test/convergence?symbol=TICKER
   =================================================================== */

// ── Types (mirrors API response shape) ──────────────────────────────

interface LegData {
  type: string;
  side: string;
  strike: number;
  price: number;
}

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
  greeks: {
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
    theta_per_day: number;
  };
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
  category_scores: {
    vol_edge: number;
    quality: number;
    regime: number;
    info_edge: number;
  };
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

interface TradeCard {
  symbol: string;
  generated_at: string;
  label: string;
  setup: TradeCardSetup;
  why: TradeCardWhy;
  key_stats: TradeCardKeyStats;
}

interface CategoryScores {
  vol_edge: number;
  quality: number;
  regime: number;
  info_edge: number;
}

interface CompositeResult {
  score: number;
  direction: string;
  convergence_gate: string;
  categories_above_50: number;
  category_scores: CategoryScores;
}

interface StrategySuggestion {
  direction: string;
  suggested_strategy: string;
  suggested_dte: number;
  note: string;
}

interface AnalysisResult {
  symbol: string;
  timestamp: string;
  pipeline_runtime_ms: number;
  raw_data: {
    tastytrade_scanner: Record<string, unknown> | null;
    tastytrade_candles: { count: number; newest: string | null };
  };
  scores: {
    composite: CompositeResult;
  };
  strategy_suggestion: StrategySuggestion;
  trade_cards?: TradeCard[];
  data_gaps: string[];
  _chain_stats?: Record<string, unknown>;
  _fetch_errors?: Record<string, string>;
}

// ── Helpers ─────────────────────────────────────────────────────────

function letterGrade(score: number): string {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B+';
  if (score >= 60) return 'B';
  if (score >= 50) return 'C+';
  if (score >= 40) return 'C';
  if (score >= 30) return 'D';
  return 'F';
}

function gradeColor(score: number): string {
  if (score >= 70) return '#10B981'; // green
  if (score >= 50) return '#F59E0B'; // amber
  return '#EF4444'; // red
}

function directionBadge(dir: string) {
  const d = dir.toUpperCase();
  if (d === 'BULLISH') return { bg: '#065F46', text: '#34D399', label: 'BULLISH' };
  if (d === 'BEARISH') return { bg: '#7F1D1D', text: '#FCA5A5', label: 'BEARISH' };
  return { bg: '#1E293B', text: '#94A3B8', label: 'NEUTRAL' };
}

function fmtDollar(v: number | null): string {
  if (v == null) return '—';
  return v >= 0 ? `$${v.toLocaleString()}` : `-$${Math.abs(v).toLocaleString()}`;
}

function fmtPct(v: number | null, decimals = 1): string {
  if (v == null) return '—';
  return `${(v * 100).toFixed(decimals)}%`;
}

function fmtNum(v: number | null, decimals = 1): string {
  if (v == null) return '—';
  return v.toFixed(decimals);
}

function fmtMarketCap(v: number | null): string {
  if (v == null) return '—';
  if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  return `$${v.toLocaleString()}`;
}

// ── Component ───────────────────────────────────────────────────────

export default function ConvergenceAnalyzer() {
  const [ticker, setTicker] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async () => {
    const sym = ticker.trim().toUpperCase();
    if (!sym) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const resp = await fetch(`/api/test/convergence?symbol=${encodeURIComponent(sym)}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      setData(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [ticker]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') analyze();
  };

  // Derived data
  const composite = data?.scores?.composite;
  const cards = data?.trade_cards ?? [];
  // Use first card's why/key_stats (shared across cards, same scoring result)
  const why = cards.length > 0 ? cards[0].why : null;
  const keyStats = cards.length > 0 ? cards[0].key_stats : null;
  const scanner = data?.raw_data?.tastytrade_scanner as Record<string, unknown> | null;

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: '#0F172A' }}>
      {/* ─── TICKER INPUT BAR ─── */}
      <div className="px-5 py-4 flex items-center gap-3 border-b border-slate-700/50" style={{ background: '#1E293B' }}>
        <div className="text-xs font-bold tracking-widest text-slate-400 uppercase mr-2">Convergence</div>
        <input
          type="text"
          value={ticker}
          onChange={e => setTicker(e.target.value.toUpperCase())}
          onKeyDown={handleKeyDown}
          placeholder="AAPL"
          className="w-28 px-3 py-1.5 rounded text-sm font-mono font-bold tracking-wider text-white border border-slate-600 focus:outline-none focus:border-blue-500"
          style={{ background: '#0F172A' }}
        />
        <button
          onClick={analyze}
          disabled={loading || !ticker.trim()}
          className="px-4 py-1.5 rounded text-xs font-bold tracking-wider text-white disabled:opacity-40 transition-colors"
          style={{ background: loading ? '#334155' : '#3B82F6' }}
        >
          {loading ? 'Analyzing...' : 'Analyze'}
        </button>
        {loading && (
          <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        )}
        {data && (
          <div className="ml-auto flex items-center gap-3 text-xs text-slate-400">
            <span className="font-mono font-bold text-white text-sm">{data.symbol}</span>
            {scanner?.['sector'] && (
              <span className="px-2 py-0.5 rounded text-[10px] font-medium" style={{ background: '#334155', color: '#94A3B8' }}>
                {String(scanner['sector'])}
              </span>
            )}
            <span>{data.pipeline_runtime_ms}ms</span>
          </div>
        )}
      </div>

      {/* ─── EMPTY STATE ─── */}
      {!data && !loading && !error && (
        <div className="px-5 py-16 text-center">
          <div className="text-slate-500 text-sm">Enter a ticker symbol to run the convergence pipeline</div>
          <div className="text-slate-600 text-xs mt-1">Scores, trade cards, and plain English signals in ~5 seconds</div>
        </div>
      )}

      {/* ─── ERROR STATE ─── */}
      {error && (
        <div className="px-5 py-8 text-center">
          <div className="text-red-400 text-sm font-medium">Analysis failed</div>
          <div className="text-red-400/60 text-xs mt-1">{error}</div>
        </div>
      )}

      {/* ─── RESULTS ─── */}
      {data && composite && (
        <div className="px-5 py-5 space-y-4">

          {/* ══════════ 1. CONVERGENCE SCORECARD ══════════ */}
          <div className="rounded-lg p-4" style={{ background: '#1E293B' }}>
            <div className="flex items-start gap-6">
              {/* Big score + grade */}
              <div className="text-center flex-shrink-0" style={{ minWidth: 100 }}>
                <div className="text-4xl font-black font-mono" style={{ color: gradeColor(composite.score) }}>
                  {composite.score.toFixed(1)}
                </div>
                <div className="text-2xl font-black mt-[-4px]" style={{ color: gradeColor(composite.score) }}>
                  {letterGrade(composite.score)}
                </div>
                <div className="mt-1">
                  {(() => {
                    const d = directionBadge(composite.direction);
                    return (
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wider" style={{ background: d.bg, color: d.text }}>
                        {d.label}
                      </span>
                    );
                  })()}
                </div>
              </div>

              {/* Category bars */}
              <div className="flex-1 space-y-2 pt-1">
                {([
                  ['Vol Edge', composite.category_scores.vol_edge],
                  ['Quality', composite.category_scores.quality],
                  ['Regime', composite.category_scores.regime],
                  ['Info Edge', composite.category_scores.info_edge],
                ] as [string, number][]).map(([label, score]) => (
                  <div key={label} className="flex items-center gap-2">
                    <div className="w-16 text-[10px] font-medium text-slate-400 text-right">{label}</div>
                    <div className="flex-1 h-4 rounded-full overflow-hidden" style={{ background: '#334155' }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(score, 100)}%`,
                          background: gradeColor(score),
                        }}
                      />
                    </div>
                    <div className="w-10 text-xs font-mono font-bold text-right" style={{ color: gradeColor(score) }}>
                      {score.toFixed(1)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Convergence gate */}
              <div className="flex-shrink-0 text-right pt-1">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Convergence</div>
                <div className="text-lg font-black font-mono" style={{ color: composite.categories_above_50 >= 4 ? '#10B981' : composite.categories_above_50 >= 3 ? '#F59E0B' : '#EF4444' }}>
                  {composite.categories_above_50}/4
                </div>
                <div className="text-[10px] font-medium mt-0.5" style={{ color: composite.categories_above_50 >= 4 ? '#10B981' : composite.categories_above_50 >= 3 ? '#F59E0B' : '#EF4444' }}>
                  {composite.categories_above_50 >= 4 ? 'FULL POSITION' : composite.categories_above_50 >= 3 ? 'HALF SIZE' : 'NO TRADE'}
                </div>
              </div>
            </div>
          </div>

          {/* ══════════ 2. TRADE CARDS ══════════ */}
          {cards.length > 0 ? (
            <div className={`grid gap-3 ${cards.length === 1 ? 'grid-cols-1' : cards.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
              {cards.map((card, i) => (
                <div key={i} className="rounded-lg overflow-hidden border" style={{ background: '#1E293B', borderColor: '#334155' }}>
                  {/* Card header */}
                  <div className="px-3 py-2 flex items-center justify-between" style={{ background: '#334155' }}>
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black" style={{ background: '#3B82F6', color: '#fff' }}>
                        {card.label}
                      </span>
                      <span className="text-xs font-bold text-white">{card.setup.strategy_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400">{card.setup.expiration_date}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: '#1E293B', color: '#94A3B8' }}>
                        {card.setup.dte}d
                      </span>
                    </div>
                  </div>

                  {/* Legs table */}
                  <div className="px-3 py-2">
                    <table className="w-full text-[10px]">
                      <thead>
                        <tr className="text-slate-500">
                          <th className="text-left font-medium pb-1">Side</th>
                          <th className="text-left font-medium pb-1">Type</th>
                          <th className="text-right font-medium pb-1">Strike</th>
                          <th className="text-right font-medium pb-1">Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {card.setup.legs.map((leg, j) => (
                          <tr key={j}>
                            <td className="py-0.5 font-bold" style={{ color: leg.side === 'sell' ? '#F87171' : '#34D399' }}>
                              {leg.side.toUpperCase()}
                            </td>
                            <td className="py-0.5 text-slate-300">{leg.type.toUpperCase()}</td>
                            <td className="py-0.5 text-right font-mono font-bold text-white">${leg.strike}</td>
                            <td className="py-0.5 text-right font-mono text-slate-300">${leg.price.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Key numbers */}
                  <div className="px-3 py-2 border-t" style={{ borderColor: '#334155' }}>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                      <div className="flex justify-between">
                        <span className="text-[10px] text-slate-500">Max Profit</span>
                        <span className="text-[10px] font-mono font-bold text-green-400">{fmtDollar(card.setup.max_profit)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[10px] text-slate-500">Max Loss</span>
                        <span className="text-[10px] font-mono font-bold text-red-400">{fmtDollar(card.setup.max_loss)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[10px] text-slate-500">PoP</span>
                        <span className="text-[10px] font-mono font-bold text-white">{fmtPct(card.setup.probability_of_profit)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[10px] text-slate-500">R/R</span>
                        <span className="text-[10px] font-mono font-bold text-white">{fmtNum(card.setup.risk_reward_ratio, 2)}</span>
                      </div>
                    </div>
                    {/* Credit/Debit callout */}
                    <div className="mt-2 text-center rounded py-1" style={{ background: '#0F172A' }}>
                      {card.setup.net_credit != null && card.setup.net_credit > 0 ? (
                        <span className="text-[10px] font-bold text-green-400">
                          Collect ${(card.setup.net_credit * 100).toFixed(0)} premium
                        </span>
                      ) : card.setup.net_debit != null ? (
                        <span className="text-[10px] font-bold text-amber-400">
                          Pay ${(card.setup.net_debit * 100).toFixed(0)} to enter
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Greeks row */}
                  <div className="px-3 py-1.5 flex justify-between border-t text-[9px] text-slate-500" style={{ borderColor: '#334155' }}>
                    <span>D {card.setup.greeks.delta.toFixed(2)}</span>
                    <span>G {card.setup.greeks.gamma.toFixed(3)}</span>
                    <span>T {card.setup.greeks.theta.toFixed(3)}</span>
                    <span>V {card.setup.greeks.vega.toFixed(3)}</span>
                    <span className="font-bold" style={{ color: card.setup.greeks.theta_per_day >= 0 ? '#10B981' : '#EF4444' }}>
                      {card.setup.greeks.theta_per_day >= 0 ? '+' : ''}{card.setup.greeks.theta_per_day.toFixed(0)}/day
                    </span>
                  </div>

                  {/* EV row */}
                  <div className="px-3 py-1.5 flex justify-between border-t text-[10px]" style={{ borderColor: '#334155' }}>
                    <span className="text-slate-500">EV</span>
                    <span className="font-mono font-bold" style={{ color: card.setup.ev >= 0 ? '#10B981' : '#EF4444' }}>
                      {card.setup.ev >= 0 ? '+' : ''}{fmtDollar(card.setup.ev)}
                    </span>
                    {card.setup.hv_pop != null && (
                      <>
                        <span className="text-slate-500">HV PoP</span>
                        <span className="font-mono font-bold text-white">{fmtPct(card.setup.hv_pop)}</span>
                      </>
                    )}
                  </div>

                  {/* Flags */}
                  {card.setup.has_wide_spread && (
                    <div className="px-3 py-1 text-[9px] font-bold text-amber-400 border-t" style={{ borderColor: '#334155' }}>
                      WIDE SPREAD
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg p-4 text-center" style={{ background: '#1E293B' }}>
              <div className="text-slate-500 text-xs">No trade cards generated</div>
              <div className="text-slate-600 text-[10px] mt-1">
                {data._fetch_errors?.chain_fetch
                  ? `Chain fetch: ${data._fetch_errors.chain_fetch}`
                  : 'Strategy builder gates filtered all candidates'}
              </div>
            </div>
          )}

          {/* ══════════ 3. THE WHY ══════════ */}
          <div className="rounded-lg p-4" style={{ background: '#1E293B' }}>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-3">The Why</div>

            {/* Plain English signals */}
            {why && why.plain_english_signals.length > 0 && (
              <div className="space-y-2 mb-4">
                {why.plain_english_signals.map((signal, i) => (
                  <div key={i} className="flex gap-2 text-xs text-slate-200 leading-relaxed">
                    <span className="flex-shrink-0 mt-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ background: '#334155', color: '#94A3B8' }}>
                      {i + 1}
                    </span>
                    <span>{signal}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Regime context */}
            {why && (
              <div className="rounded px-3 py-2 text-xs text-slate-300 leading-relaxed" style={{ background: '#0F172A' }}>
                {why.regime_context}
              </div>
            )}

            {/* Risk flags */}
            {why && why.risk_flags.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {why.risk_flags.map((flag, i) => {
                  const isRed = flag.startsWith('UNLIMITED') || flag.startsWith('INSIDER');
                  return (
                    <div key={i} className="flex items-start gap-2 rounded px-3 py-1.5 text-[10px] font-medium leading-relaxed"
                      style={{ background: isRed ? '#7F1D1D20' : '#78350F20', color: isRed ? '#FCA5A5' : '#FDE68A' }}
                    >
                      <span className="flex-shrink-0 mt-0.5">{isRed ? '\u26D4' : '\u26A0'}</span>
                      <span>{flag}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* No signals fallback */}
            {(!why || why.plain_english_signals.length === 0) && (
              <div className="text-xs text-slate-500">No scoring signals available — check data gaps below</div>
            )}
          </div>

          {/* ══════════ 4. KEY STATS GRID ══════════ */}
          {keyStats && (
            <div className="rounded-lg p-4" style={{ background: '#1E293B' }}>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-3">Key Stats</div>
              <div className="grid grid-cols-4 gap-x-4 gap-y-3">
                {([
                  ['IV Rank', keyStats.iv_rank != null ? fmtNum(keyStats.iv_rank, 2) : '—'],
                  ['IV Percentile', keyStats.iv_percentile != null ? fmtNum(keyStats.iv_percentile, 2) : '—'],
                  ['IV 30d', keyStats.iv30 != null ? `${fmtNum(keyStats.iv30)}%` : '—'],
                  ['HV 30d', keyStats.hv30 != null ? `${fmtNum(keyStats.hv30)}%` : '—'],
                  ['Earnings', keyStats.earnings_date ?? '—'],
                  ['Days to ER', keyStats.days_to_earnings != null ? `${keyStats.days_to_earnings}d` : '—'],
                  ['P/E', keyStats.pe_ratio != null ? fmtNum(keyStats.pe_ratio) : '—'],
                  ['Market Cap', fmtMarketCap(keyStats.market_cap)],
                  ['Beta', keyStats.beta != null ? fmtNum(keyStats.beta, 2) : '—'],
                  ['SPY Corr', keyStats.spy_correlation != null ? fmtNum(keyStats.spy_correlation, 2) : '—'],
                  ['Sector', keyStats.sector ?? '—'],
                  ['Liquidity', keyStats.liquidity_rating != null ? `${keyStats.liquidity_rating}/5` : '—'],
                  ['Analyst', keyStats.analyst_consensus ?? '—'],
                  ['Buzz Ratio', keyStats.buzz_ratio != null ? `${fmtNum(keyStats.buzz_ratio)}x` : '—'],
                  ['Sent. Momentum', keyStats.sentiment_momentum != null ? fmtNum(keyStats.sentiment_momentum) : '—'],
                  ['Lendability', keyStats.lendability ?? '—'],
                ] as [string, string][]).map(([label, value]) => (
                  <div key={label}>
                    <div className="text-[9px] text-slate-500 uppercase tracking-wider">{label}</div>
                    <div className="text-xs font-mono font-bold text-white mt-0.5">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══════════ 5. DATA GAPS & DIAGNOSTICS ══════════ */}
          {(data.data_gaps.length > 0 || data._fetch_errors) && (
            <div className="rounded-lg p-3" style={{ background: '#1E293B' }}>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-2">Diagnostics</div>
              {data.data_gaps.length > 0 && (
                <div className="text-[10px] text-slate-500 mb-1">
                  <span className="font-medium text-slate-400">Data gaps: </span>
                  {data.data_gaps.join(', ')}
                </div>
              )}
              {data._fetch_errors && Object.keys(data._fetch_errors).length > 0 && (
                <div className="text-[10px] text-red-400/60">
                  <span className="font-medium text-red-400">Fetch errors: </span>
                  {Object.entries(data._fetch_errors).map(([k, v]) => `${k}: ${v}`).join(' | ')}
                </div>
              )}
              {data._chain_stats && (
                <div className="text-[10px] text-slate-600 mt-1">
                  Chain: {String(data._chain_stats.chain_symbols_fetched)} fetched, {String(data._chain_stats.total_strategy_cards)} cards, {String(data._chain_stats.greeks_events_received)} greeks, {String(data._chain_stats.chain_elapsed_ms)}ms
                  {data._chain_stats.market_note && <span className="ml-1 text-amber-500/60">({String(data._chain_stats.market_note)})</span>}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
