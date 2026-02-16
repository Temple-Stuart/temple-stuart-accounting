'use client';

import { useState, useEffect, useCallback } from 'react';

/* ===== TYPES ===== */

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
  iv_hv_spread: number | null;
  hv_trend: string;
  mspr: number | null;
  beat_streak: string;
  key_signal: string;
}

interface ConvergenceAnalysisItem {
  symbol: string;
  composite: number;
  convergence: string;
  analysis: string;
}

interface RiskFlags {
  sectorConcentration: string[];
  regimeMisalignment: string[];
  qualityConcerns: string[];
  convergenceWeakness: string[];
  insiderSelling: string[];
  exclusions: string[];
}

interface Synthesis {
  pipelineSummary: string;
  convergenceAnalysis: ConvergenceAnalysisItem[];
  riskFlags: RiskFlags;
  crossTickerInsights: string;
  raw?: string;
  parse_error?: boolean;
}

interface PipelineSummary {
  total_universe: number;
  after_hard_filters: number;
  pre_scored: number;
  finnhub_fetched: number;
  scored: number;
  final_8: string[];
  pipeline_runtime_ms: number;
  finnhub_calls_made: number;
  finnhub_errors: number;
  fred_cached: boolean;
  timestamp: string;
}

interface Timing {
  pipeline_ms: number;
  ai_ms: number;
  total_ms: number;
}

interface SynthesisResponse {
  synthesis: Synthesis;
  pipeline_summary: PipelineSummary;
  top_8: RankedRow[];
  sector_distribution: Record<string, number>;
  timing: Timing;
}

/* ===== COLORS ===== */

const C = {
  bg: '#111827',
  bgAlt: '#1F2937',
  border: '#374151',
  primary: '#E5E7EB',
  secondary: '#D1D5DB',
  tertiary: '#9CA3AF',
  muted: '#6B7280',
  green: '#10B981',
  red: '#EF4444',
  amber: '#F59E0B',
  greenBg: 'rgba(16,185,129,0.15)',
  redBg: 'rgba(239,68,68,0.15)',
  amberBg: 'rgba(245,158,11,0.15)',
};

/* ===== HELPERS ===== */

function scoreColor(score: number): string {
  if (score >= 70) return C.green;
  if (score >= 50) return C.amber;
  return C.red;
}

function scoreBg(score: number): string {
  if (score >= 70) return C.greenBg;
  if (score >= 50) return C.amberBg;
  return C.redBg;
}

function dirColor(dir: string): string {
  const d = dir.toUpperCase();
  if (d === 'BULLISH') return C.green;
  if (d === 'BEARISH') return C.red;
  return C.muted;
}

function dirBg(dir: string): string {
  const d = dir.toUpperCase();
  if (d === 'BULLISH') return C.greenBg;
  if (d === 'BEARISH') return C.redBg;
  return 'rgba(107,114,128,0.15)';
}

function convergenceColor(conv: string): string {
  const n = parseInt(conv.split('/')[0], 10);
  if (n >= 4) return C.green;
  if (n === 3) return C.amber;
  return C.red;
}

/* ===== SCORE BAR ===== */

function ScoreBar({ label, score, weight }: { label: string; score: number; weight: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
      <div style={{ width: 70, fontSize: 11, color: C.tertiary, flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, height: 8, background: '#374151', borderRadius: 4, overflow: 'hidden' }}>
        <div
          style={{
            width: `${Math.min(score, 100)}%`,
            height: '100%',
            background: scoreColor(score),
            borderRadius: 4,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
      <div style={{ width: 32, fontSize: 11, fontFamily: 'monospace', color: scoreColor(score), textAlign: 'right' }}>
        {score.toFixed(0)}
      </div>
      <div style={{ width: 28, fontSize: 9, color: C.muted, textAlign: 'right' }}>{weight}</div>
    </div>
  );
}

/* ===== TRADE CARD ===== */

function TradeCard({
  row,
  analysis,
  isExpanded,
  onToggle,
}: {
  row: RankedRow;
  analysis: ConvergenceAnalysisItem | undefined;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      style={{
        background: C.bg,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: 16,
        cursor: 'pointer',
        transition: 'border-color 0.2s',
      }}
      onClick={onToggle}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = C.muted; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = C.border; }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: C.green }}>{row.symbol}</span>
          <span style={{ fontSize: 18, fontWeight: 600, fontFamily: 'monospace', color: scoreColor(row.composite) }}>
            {row.composite.toFixed(1)}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {/* Convergence badge */}
          <span style={{
            fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
            color: convergenceColor(row.convergence), background: scoreBg(parseInt(row.convergence) >= 4 ? 70 : parseInt(row.convergence) >= 3 ? 50 : 30),
          }}>
            {row.convergence}
          </span>
          {/* Direction badge */}
          <span style={{
            fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
            color: dirColor(row.direction), background: dirBg(row.direction),
          }}>
            {row.direction}
          </span>
          {/* IVP badge */}
          {row.ivp !== null && (
            <span style={{
              fontSize: 10, fontWeight: 500, padding: '2px 6px', borderRadius: 4,
              fontFamily: 'monospace',
              color: row.ivp >= 60 ? C.green : row.ivp >= 40 ? C.amber : C.muted,
              background: row.ivp >= 60 ? C.greenBg : row.ivp >= 40 ? C.amberBg : 'rgba(107,114,128,0.15)',
            }}>
              IVP {row.ivp.toFixed(0)}
            </span>
          )}
        </div>
      </div>

      {/* Strategy + sector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: C.secondary }}>{row.strategy}</span>
        {row.sector && (
          <span style={{ fontSize: 10, color: C.muted, background: '#1F2937', padding: '2px 6px', borderRadius: 4 }}>
            {row.sector}
          </span>
        )}
      </div>

      {/* Score bars */}
      <div style={{ marginBottom: 8 }}>
        <ScoreBar label="Vol Edge" score={row.vol_edge} weight="40%" />
        <ScoreBar label="Quality" score={row.quality} weight="30%" />
        <ScoreBar label="Regime" score={row.regime} weight="20%" />
        <ScoreBar label="Info Edge" score={row.info_edge} weight="10%" />
      </div>

      {/* Key signals */}
      {row.key_signal && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: isExpanded ? 12 : 0 }}>
          {row.key_signal.split(', ').map((sig, i) => (
            <span key={i} style={{
              fontSize: 9, padding: '1px 5px', borderRadius: 3,
              background: '#1F2937', color: C.tertiary, fontFamily: 'monospace',
            }}>
              {sig}
            </span>
          ))}
        </div>
      )}

      {/* Expanded analysis */}
      {isExpanded && (
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, marginTop: 4 }}>
          {analysis ? (
            <p style={{ fontSize: 12, lineHeight: 1.6, color: C.secondary, margin: 0 }}>{analysis.analysis}</p>
          ) : (
            <p style={{ fontSize: 11, color: C.muted, margin: 0, fontStyle: 'italic' }}>No AI analysis available for this ticker.</p>
          )}

          {/* Detail rows */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 12 }}>
            <div>
              <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', marginBottom: 2 }}>HV Trend</div>
              <div style={{ fontSize: 11, fontFamily: 'monospace', color: C.secondary }}>{row.hv_trend || 'N/A'}</div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', marginBottom: 2 }}>Insider MSPR</div>
              <div style={{
                fontSize: 11, fontFamily: 'monospace',
                color: row.mspr !== null ? (row.mspr > 0 ? C.green : row.mspr < 0 ? C.red : C.secondary) : C.muted,
              }}>
                {row.mspr !== null ? row.mspr.toFixed(2) : 'N/A'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', marginBottom: 2 }}>Beat Streak</div>
              <div style={{ fontSize: 11, fontFamily: 'monospace', color: C.secondary }}>{row.beat_streak || 'N/A'}</div>
            </div>
          </div>

          {/* IV-HV Spread */}
          {row.iv_hv_spread !== null && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', marginBottom: 2 }}>IV-HV Spread</div>
              <div style={{ fontSize: 11, fontFamily: 'monospace', color: row.iv_hv_spread > 5 ? C.green : C.tertiary }}>
                {row.iv_hv_spread.toFixed(2)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ===== MAIN DASHBOARD ===== */

export default function ConvergenceDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SynthesisResponse | null>(null);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [exclusionsExpanded, setExclusionsExpanded] = useState(false);
  const [cacheHit, setCacheHit] = useState<boolean | null>(null);

  const fetchData = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/ai/convergence-synthesis?limit=8${refresh ? '&refresh=true' : ''}`;
      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setCacheHit(res.headers.get('X-Cache-Hit') === 'true');
      const json: SynthesisResponse = await res.json();
      setData(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ===== LOADING STATE ===== */
  if (loading) {
    return (
      <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: 40, textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <div style={{
            width: 28, height: 28, border: `3px solid ${C.border}`, borderTopColor: C.green,
            borderRadius: '50%', animation: 'convergence-spin 1s linear infinite',
          }} />
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.secondary, marginBottom: 8 }}>
          Running convergence pipeline...
        </div>
        <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.6 }}>
          Scanning S&amp;P 500 &rarr; Hard filters &rarr; Sector stats &rarr; Scoring &rarr; AI synthesis
        </div>
        <div style={{ fontSize: 10, color: C.muted, marginTop: 12 }}>
          This may take 10&ndash;20 seconds
        </div>
        <style>{`@keyframes convergence-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  /* ===== ERROR STATE ===== */
  if (error) {
    return (
      <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: C.red, marginBottom: 12 }}>{error}</div>
        <button
          onClick={() => fetchData()}
          style={{
            background: 'none', border: `1px solid ${C.border}`, borderRadius: 4,
            padding: '6px 16px', fontSize: 12, color: C.secondary, cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { synthesis, pipeline_summary: ps, top_8, sector_distribution, timing } = data;
  const analysisMap = new Map<string, ConvergenceAnalysisItem>();
  if (synthesis.convergenceAnalysis) {
    for (const item of synthesis.convergenceAnalysis) {
      analysisMap.set(item.symbol, item);
    }
  }

  // Collect risk flags that have entries
  const riskEntries: { label: string; items: string[] }[] = [];
  if (synthesis.riskFlags) {
    const rf = synthesis.riskFlags;
    if (rf.sectorConcentration?.length) riskEntries.push({ label: 'Sector Concentration', items: rf.sectorConcentration });
    if (rf.regimeMisalignment?.length) riskEntries.push({ label: 'Regime Misalignment', items: rf.regimeMisalignment });
    if (rf.qualityConcerns?.length) riskEntries.push({ label: 'Quality Concerns', items: rf.qualityConcerns });
    if (rf.convergenceWeakness?.length) riskEntries.push({ label: 'Convergence Weakness', items: rf.convergenceWeakness });
    if (rf.insiderSelling?.length) riskEntries.push({ label: 'Insider Selling', items: rf.insiderSelling });
  }

  // Exclusions
  const exclusions = synthesis.riskFlags?.exclusions || [];

  return (
    <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20 }}>

      {/* A) HEADER BAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: C.secondary, letterSpacing: '0.08em' }}>
            CONVERGENCE SCANNER
          </div>
          <div style={{ fontSize: 10, color: C.muted, marginTop: 4, fontFamily: 'monospace' }}>
            {ps.total_universe} universe &rarr; {ps.after_hard_filters} filtered &rarr; {ps.scored} scored &rarr; {ps.final_8.length} final
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 10, color: C.muted, textAlign: 'right' }}>
            <div>{new Date(ps.timestamp).toLocaleTimeString()}</div>
            <div>{ps.pipeline_runtime_ms.toLocaleString()}ms pipeline</div>
            {cacheHit !== null && (
              <div style={{ color: cacheHit ? C.green : C.muted }}>{cacheHit ? 'cached' : 'fresh'}</div>
            )}
          </div>
          <button
            onClick={() => fetchData(true)}
            style={{
              background: 'none', border: `1px solid ${C.border}`, borderRadius: 4,
              padding: '4px 10px', fontSize: 11, color: C.tertiary, cursor: 'pointer',
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* B) PIPELINE SUMMARY */}
      {synthesis.pipelineSummary && !synthesis.parse_error && (
        <div style={{ background: C.bgAlt, borderRadius: 6, padding: 14, marginBottom: 16 }}>
          <p style={{ margin: 0, fontSize: 12, lineHeight: 1.7, color: C.secondary }}>{synthesis.pipelineSummary}</p>
        </div>
      )}

      {/* C) TRADE CARDS GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12, marginBottom: 16 }}>
        {top_8.map((row) => (
          <TradeCard
            key={row.symbol}
            row={row}
            analysis={analysisMap.get(row.symbol)}
            isExpanded={expandedCard === row.symbol}
            onToggle={() => setExpandedCard(expandedCard === row.symbol ? null : row.symbol)}
          />
        ))}
      </div>

      {/* D) RISK FLAGS */}
      {riskEntries.length > 0 && (
        <div style={{
          background: C.bg, border: `1px solid ${C.amber}33`, borderRadius: 6,
          padding: 14, marginBottom: 16,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.amber, marginBottom: 8 }}>RISK FLAGS</div>
          {riskEntries.map((entry, i) => (
            <div key={i} style={{ marginBottom: i < riskEntries.length - 1 ? 8 : 0 }}>
              <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>
                {entry.label}
              </div>
              {entry.items.map((item, j) => (
                <div key={j} style={{ fontSize: 11, color: C.secondary, lineHeight: 1.5, paddingLeft: 12 }}>
                  {'\u2022'} {item}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* E) CROSS-TICKER INSIGHTS */}
      {synthesis.crossTickerInsights && !synthesis.parse_error && (
        <div style={{ background: C.bgAlt, borderRadius: 6, padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.secondary, marginBottom: 6 }}>CROSS-TICKER INSIGHTS</div>
          <p style={{ margin: 0, fontSize: 12, lineHeight: 1.7, color: C.tertiary }}>{synthesis.crossTickerInsights}</p>
        </div>
      )}

      {/* F) SECTOR DISTRIBUTION */}
      {Object.keys(sector_distribution).length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {Object.keys(sector_distribution).map((sector) => {
            const count = sector_distribution[sector];
            return (
              <div key={sector} style={{
                fontSize: 11, padding: '4px 10px', borderRadius: 4,
                background: count >= 2 ? C.amberBg : C.bgAlt,
                color: count >= 2 ? C.amber : C.tertiary,
                border: `1px solid ${count >= 2 ? C.amber + '33' : C.border}`,
              }}>
                <span style={{ fontWeight: 600 }}>{sector}</span>
                <span style={{ fontFamily: 'monospace', marginLeft: 4 }}>{count}</span>
                {count >= 2 && <span style={{ fontSize: 9, marginLeft: 4 }}>cap</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* G) EXCLUSIONS */}
      {exclusions.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <button
            onClick={() => setExclusionsExpanded(!exclusionsExpanded)}
            style={{
              background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              fontSize: 11, color: C.muted, display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <span style={{ transform: exclusionsExpanded ? 'rotate(90deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>
              &#9654;
            </span>
            Exclusions ({exclusions.length})
          </button>
          {exclusionsExpanded && (
            <div style={{ marginTop: 8, paddingLeft: 12 }}>
              {exclusions.map((ex, i) => (
                <div key={i} style={{ fontSize: 11, color: C.muted, lineHeight: 1.6 }}>
                  {'\u2022'} {ex}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* H) TIMING FOOTER */}
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', fontSize: 10, fontFamily: 'monospace', color: C.muted }}>
        <span>Pipeline: {timing.pipeline_ms.toLocaleString()}ms</span>
        <span>AI: {timing.ai_ms.toLocaleString()}ms</span>
        <span>Total: {timing.total_ms.toLocaleString()}ms</span>
      </div>
    </div>
  );
}
