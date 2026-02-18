'use client';

import { useState, useCallback } from 'react';

/* ===================================================================
   ConvergenceIntelligence — unified market intelligence dashboard
   Replaces both ConvergenceDashboard and ConvergenceAnalyzer.
   Dark theme, screenshot-ready, zero click-to-expand.
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
  final_8: string[];
  pipeline_runtime_ms: number;
  timestamp: string;
}

interface BatchResponse {
  pipeline_summary: PipelineSummary;
  top_8: RankedRow[];
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

function gateLabel(n: number): { text: string; color: string } {
  if (n >= 4) return { text: 'FULL POSITION', color: '#10B981' };
  if (n >= 3) return { text: 'HALF SIZE', color: '#F59E0B' };
  return { text: 'NO TRADE', color: '#EF4444' };
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
    case 'pe_ratio': return n > 40 ? 'high valuation \u2014 growth priced in' : n > 15 ? 'moderate valuation' : 'cheap on earnings';
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
      <div className="w-16 text-[10px] font-medium text-slate-400 text-right shrink-0">{label}</div>
      <div className="flex-1 h-3.5 rounded-full overflow-hidden" style={{ background: '#334155' }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(score, 100)}%`, background: gradeColor(score) }} />
      </div>
      <div className="w-10 text-xs font-mono font-bold text-right shrink-0" style={{ color: gradeColor(score) }}>{score.toFixed(1)}</div>
    </div>
  );
}

// ── Ticker Card (the full card for one ticker) ─────────────────────

function TickerCard({ detail }: { detail: TickerDetail }) {
  const comp = detail.scores.composite;
  const cards = detail.trade_cards ?? [];
  const why = cards[0]?.why;
  const ks = cards[0]?.key_stats;
  const headlines: Headline[] = detail.scores.info_edge?.breakdown?.news_sentiment?.news_detail?.headlines?.slice(0, 3) ?? [];
  const gate = gateLabel(comp.categories_above_50);
  const dir = dirBadge(comp.direction);

  return (
    <div className="rounded-lg overflow-hidden border" style={{ background: '#1E293B', borderColor: '#334155' }}>

      {/* ═══ A) HEADER ROW ═══ */}
      <div className="px-5 py-3 flex items-center justify-between flex-wrap gap-2" style={{ background: '#0F172A' }}>
        <div className="flex items-center gap-3">
          <span className="text-2xl font-black font-mono text-white">{detail.symbol}</span>
          <span className="text-2xl font-black font-mono" style={{ color: gradeColor(comp.score) }}>{comp.score.toFixed(1)}</span>
          <span className="text-lg font-black" style={{ color: gradeColor(comp.score) }}>{letterGrade(comp.score)}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider" style={{ background: dir.bg, color: dir.text }}>{dir.label}</span>
          {ks?.sector && <span className="px-2 py-0.5 rounded text-[10px] font-medium" style={{ background: '#334155', color: '#94A3B8' }}>{ks.sector}</span>}
          <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ color: gate.color, background: gate.color + '20' }}>
            {comp.categories_above_50}/4 {gate.text}
          </span>
        </div>
      </div>

      {/* ═══ B) SCORE BARS ═══ */}
      <div className="px-5 py-3 space-y-1.5 border-b" style={{ borderColor: '#334155' }}>
        <ScoreBar label="Vol Edge" score={comp.category_scores.vol_edge} />
        <ScoreBar label="Quality" score={comp.category_scores.quality} />
        <ScoreBar label="Regime" score={comp.category_scores.regime} />
        <ScoreBar label="Info Edge" score={comp.category_scores.info_edge} />
      </div>

      {/* ═══ C) THE TRADE ═══ */}
      {cards.length > 0 ? (
        <div className="border-b" style={{ borderColor: '#334155' }}>
          {cards.map((card, ci) => (
            <div key={ci} className={ci > 0 ? 'border-t' : ''} style={{ borderColor: '#334155' }}>
              {/* Strategy header */}
              <div className="px-5 py-2 flex items-center justify-between" style={{ background: '#334155' }}>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black" style={{ background: '#3B82F6', color: '#fff' }}>{card.label}</span>
                  <span className="text-sm font-bold text-white">{card.setup.strategy_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-300">{card.setup.expiration_date}</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: '#1E293B', color: '#94A3B8' }}>{card.setup.dte} DTE</span>
                </div>
              </div>

              <div className="px-5 py-3">
                {/* Legs table */}
                <table className="w-full text-xs mb-3">
                  <thead>
                    <tr className="text-slate-500 text-[10px]">
                      <th className="text-left font-medium pb-1 w-16">Action</th>
                      <th className="text-left font-medium pb-1 w-12">Type</th>
                      <th className="text-right font-medium pb-1">Strike</th>
                      <th className="text-right font-medium pb-1">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {card.setup.legs.map((leg, j) => (
                      <tr key={j}>
                        <td className="py-0.5 font-bold" style={{ color: leg.side === 'sell' ? '#F87171' : '#34D399' }}>{leg.side.toUpperCase()}</td>
                        <td className="py-0.5 text-slate-300">{leg.type.toUpperCase()}</td>
                        <td className="py-0.5 text-right font-mono font-bold text-white">${leg.strike}</td>
                        <td className="py-0.5 text-right font-mono text-slate-300">${leg.price.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Key numbers row */}
                <div className="grid grid-cols-4 gap-3 mb-2">
                  <div className="text-center">
                    <div className="text-[9px] text-slate-500 uppercase">Max Profit</div>
                    <div className="text-sm font-mono font-black text-green-400">{fmtDollar(card.setup.max_profit)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[9px] text-slate-500 uppercase">Max Loss</div>
                    <div className="text-sm font-mono font-black text-red-400">{fmtDollar(card.setup.max_loss)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[9px] text-slate-500 uppercase">Win Rate</div>
                    <div className="text-sm font-mono font-black text-white">{fmtPct(card.setup.probability_of_profit)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[9px] text-slate-500 uppercase">Risk/Reward</div>
                    <div className="text-sm font-mono font-black text-white">{card.setup.risk_reward_ratio != null ? card.setup.risk_reward_ratio.toFixed(2) : '\u2014'}</div>
                  </div>
                </div>

                {/* Premium line */}
                <div className="text-center rounded py-1.5" style={{ background: '#0F172A' }}>
                  {card.setup.net_credit != null && card.setup.net_credit > 0 ? (
                    <span className="text-xs font-bold text-green-400">Collect ${(card.setup.net_credit * 100).toFixed(0)} premium per contract</span>
                  ) : card.setup.net_debit != null ? (
                    <span className="text-xs font-bold text-white">Pay ${(card.setup.net_debit * 100).toFixed(0)} to enter per contract</span>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-5 py-4 text-center border-b" style={{ borderColor: '#334155' }}>
          <div className="text-slate-500 text-xs">
            {detail._fetch_errors?.chain_fetch ? `No trade cards \u2014 ${detail._fetch_errors.chain_fetch}` : 'No strategies passed quality gates for this ticker'}
          </div>
        </div>
      )}

      {/* ═══ D) WHY THIS TRADE ═══ */}
      {why && (
        <div className="px-5 py-3 border-b" style={{ borderColor: '#334155' }}>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-2">Why This Trade</div>

          {why.plain_english_signals.length > 0 && (
            <div className="space-y-1.5 mb-3">
              {why.plain_english_signals.map((sig, i) => (
                <div key={i} className="flex gap-2 text-xs text-slate-200 leading-relaxed">
                  <span className="shrink-0 mt-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ background: '#334155', color: '#94A3B8' }}>{i + 1}</span>
                  <span>{sig}</span>
                </div>
              ))}
            </div>
          )}

          {/* Regime context */}
          <div className="rounded px-3 py-2 text-xs text-slate-300 leading-relaxed mb-2" style={{ background: '#0F172A' }}>
            {why.regime_context}
          </div>

          {/* Risk flags */}
          {why.risk_flags.length > 0 && (
            <div className="space-y-1">
              {why.risk_flags.map((flag, i) => {
                const isRed = flag.startsWith('UNLIMITED') || flag.startsWith('INSIDER');
                return (
                  <div key={i} className="flex items-start gap-2 rounded px-3 py-1.5 text-[10px] font-medium leading-relaxed"
                    style={{ background: isRed ? '#7F1D1D20' : '#78350F20', color: isRed ? '#FCA5A5' : '#FDE68A' }}>
                    <span className="shrink-0 mt-0.5">{isRed ? '\u26D4' : '\u26A0'}</span>
                    <span>{flag}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ E) KEY STATS ═══ */}
      {ks && (
        <div className="px-5 py-3 border-b" style={{ borderColor: '#334155' }}>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-2">Key Stats</div>
          <div className="space-y-2 text-xs">
            {/* Volatility row */}
            <div>
              <span className="text-slate-500 font-medium">Volatility: </span>
              <span className="text-slate-200 font-mono">
                IV Rank {ks.iv_rank != null ? ks.iv_rank.toFixed(2) : '\u2014'}
                {ks.iv_rank != null && <span className="text-slate-500"> \u2014 {statExplain('iv_rank', ks.iv_rank)}</span>}
                {' | '}IV {ks.iv30 != null ? `${ks.iv30.toFixed(1)}%` : '\u2014'}
                {' | '}HV {ks.hv30 != null ? `${ks.hv30.toFixed(1)}%` : '\u2014'}
              </span>
            </div>
            {/* Company row */}
            <div>
              <span className="text-slate-500 font-medium">Company: </span>
              <span className="text-slate-200 font-mono">
                P/E {ks.pe_ratio != null ? ks.pe_ratio.toFixed(1) : '\u2014'}
                {ks.pe_ratio != null && <span className="text-slate-500"> \u2014 {statExplain('pe_ratio', ks.pe_ratio)}</span>}
                {' | '}Cap {fmtMcap(ks.market_cap)}
                {' | '}Earnings {ks.earnings_date ?? '\u2014'}
                {ks.days_to_earnings != null && ks.days_to_earnings > 0 && <span className="text-amber-400"> ({ks.days_to_earnings}d away)</span>}
              </span>
            </div>
            {/* Market row */}
            <div>
              <span className="text-slate-500 font-medium">Market: </span>
              <span className="text-slate-200 font-mono">
                Beta {ks.beta != null ? ks.beta.toFixed(2) : '\u2014'}
                {ks.beta != null && <span className="text-slate-500"> \u2014 {statExplain('beta', ks.beta)}</span>}
                {' | '}SPY Corr {ks.spy_correlation != null ? ks.spy_correlation.toFixed(2) : '\u2014'}
                {ks.spy_correlation != null && <span className="text-slate-500"> \u2014 {statExplain('spy_correlation', ks.spy_correlation)}</span>}
                {' | '}Liquidity {ks.liquidity_rating != null ? `${ks.liquidity_rating}/5` : '\u2014'}
              </span>
            </div>
            {/* Sentiment row */}
            <div>
              <span className="text-slate-500 font-medium">Sentiment: </span>
              <span className="text-slate-200 font-mono">
                Analysts: {ks.analyst_consensus ?? '\u2014'}
                {' | '}Buzz {ks.buzz_ratio != null ? `${ks.buzz_ratio.toFixed(1)}x` : '\u2014'}
                {ks.buzz_ratio != null && <span className="text-slate-500"> \u2014 {statExplain('buzz_ratio', ks.buzz_ratio)}</span>}
                {' | '}Trend {ks.sentiment_momentum != null ? ks.sentiment_momentum.toFixed(0) : '\u2014'}
                {ks.sentiment_momentum != null && <span className="text-slate-500"> \u2014 {statExplain('sentiment_momentum', ks.sentiment_momentum)}</span>}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ═══ F) TOP HEADLINES ═══ */}
      {headlines.length > 0 && (
        <div className="px-5 py-3">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-2">Recent Headlines</div>
          <div className="space-y-1.5">
            {headlines.map((h, i) => {
              const sentColor = h.sentiment === 'bullish' ? '#34D399' : h.sentiment === 'bearish' ? '#F87171' : '#94A3B8';
              return (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="text-slate-300 leading-relaxed flex-1">&ldquo;{h.headline}&rdquo;</span>
                  <span className="shrink-0 text-[9px] text-slate-500">{h.source}</span>
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

  // Scan market — fetch batch, then enrich each winner
  const scanMarket = useCallback(async () => {
    setScanning(true);
    setBatchError(null);
    setBatchData(null);
    setEnriched([]);
    setEnriching(false);
    try {
      const resp = await fetch(`/api/ai/convergence-synthesis?limit=8&universe=${universe}&refresh=true`);
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
        throw new Error(body.error || `HTTP ${resp.status}`);
      }
      const json: BatchResponse = await resp.json();
      setBatchData(json);
      setScanning(false);

      // Now enrich each top ticker sequentially
      const symbols = json.top_8.map(r => r.symbol);
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
    <div className="rounded-lg overflow-hidden" style={{ background: '#0F172A' }}>

      {/* ═══ SECTION 1: UNIVERSE SELECTOR ═══ */}
      <div className="px-5 py-4 flex items-center gap-3 flex-wrap border-b" style={{ background: '#1E293B', borderColor: '#334155' }}>
        <div className="text-xs font-bold tracking-widest text-slate-400 uppercase mr-1">Market Intelligence</div>
        <select
          value={universe}
          onChange={e => setUniverse(e.target.value)}
          className="text-xs px-2 py-1.5 rounded border border-slate-600 text-white focus:outline-none focus:border-blue-500"
          style={{ background: '#0F172A' }}
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
          className="px-4 py-1.5 rounded text-xs font-bold tracking-wider text-white disabled:opacity-40 transition-colors"
          style={{ background: scanning || enriching ? '#334155' : '#4F46E5' }}
        >
          {scanning ? 'Scanning...' : enriching ? `Loading ${enrichProgress.current}...` : 'Scan Market'}
        </button>
        {(scanning || enriching) && (
          <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        )}
        {/* Pipeline summary */}
        {batchData && (
          <div className="ml-auto text-[10px] text-slate-500 font-mono">
            {batchData.pipeline_summary.total_universe} scanned
            {' \u2192 '}{batchData.pipeline_summary.after_hard_filters} filtered
            {' \u2192 '}{batchData.pipeline_summary.scored} scored
            {' \u2192 '}{batchData.top_8.length} selected
            {' ('}
            {(batchData.timing.total_ms / 1000).toFixed(1)}s)
          </div>
        )}
      </div>

      {/* Loading state */}
      {scanning && (
        <div className="px-5 py-16 text-center">
          <div className="w-8 h-8 border-3 border-slate-600 border-t-indigo-400 rounded-full animate-spin mx-auto mb-4" style={{ borderWidth: 3 }} />
          <div className="text-sm font-medium text-slate-300">Running convergence pipeline...</div>
          <div className="text-[10px] text-slate-500 mt-1">Scanning universe, applying filters, scoring, ranking</div>
        </div>
      )}

      {/* Batch error */}
      {batchError && (
        <div className="px-5 py-8 text-center">
          <div className="text-red-400 text-sm font-medium mb-2">Scan failed</div>
          <div className="text-red-400/60 text-xs">{batchError}</div>
        </div>
      )}

      {/* Enrichment progress */}
      {enriching && enrichProgress.total > 0 && (
        <div className="px-5 py-2 flex items-center gap-3" style={{ background: '#0F172A' }}>
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#334155' }}>
            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${(enrichProgress.done / enrichProgress.total) * 100}%`, background: '#4F46E5' }} />
          </div>
          <div className="text-[10px] text-slate-500 font-mono shrink-0">
            {enrichProgress.done}/{enrichProgress.total} \u2014 loading {enrichProgress.current}
          </div>
        </div>
      )}

      {/* ═══ SECTION 2: FULL TRADE CARDS ═══ */}
      {enriched.length > 0 && (
        <div className="px-5 py-4 space-y-4">
          {enriched.map((detail) => (
            <TickerCard key={detail.symbol} detail={detail} />
          ))}
        </div>
      )}

      {/* Empty state — no scan yet */}
      {!scanning && !batchData && !batchError && enriched.length === 0 && (
        <div className="px-5 py-16 text-center">
          <div className="text-slate-500 text-sm">Select a universe and click Scan Market</div>
          <div className="text-slate-600 text-xs mt-1">Finds top opportunities with full trade cards and plain English analysis</div>
        </div>
      )}

      {/* ═══ SECTION 3: SINGLE TICKER LOOKUP ═══ */}
      <div className="px-5 py-4 border-t" style={{ borderColor: '#334155' }}>
        <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-2">Look Up a Specific Ticker</div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={lookupTicker}
            onChange={e => setLookupTicker(e.target.value.toUpperCase())}
            onKeyDown={e => { if (e.key === 'Enter') lookupAnalyze(); }}
            placeholder="AAPL"
            className="w-28 px-3 py-1.5 rounded text-sm font-mono font-bold tracking-wider text-white border border-slate-600 focus:outline-none focus:border-blue-500"
            style={{ background: '#0F172A' }}
          />
          <button
            onClick={lookupAnalyze}
            disabled={lookupLoading || !lookupTicker.trim()}
            className="px-4 py-1.5 rounded text-xs font-bold text-white disabled:opacity-40"
            style={{ background: lookupLoading ? '#334155' : '#3B82F6' }}
          >
            {lookupLoading ? 'Analyzing...' : 'Analyze'}
          </button>
          {lookupLoading && <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />}
        </div>
        {lookupError && <div className="text-red-400 text-xs mt-2">{lookupError}</div>}
        {lookupData && (
          <div className="mt-3">
            <TickerCard detail={lookupData} />
          </div>
        )}
      </div>
    </div>
  );
}
