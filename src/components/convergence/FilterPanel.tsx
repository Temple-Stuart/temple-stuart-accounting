'use client';

import { useState, useCallback } from 'react';
import type {
  ScannerFilters,
  LiquidityGates,
  RiskProfile,
  EdgeMetrics,
  Direction,
  PremiumStance,
  RiskType,
  VolEdge,
} from '@/lib/convergence/filter-types';
import { DEFAULT_FILTERS, AVAILABLE_STRATEGIES } from '@/lib/convergence/filter-types';
import { themed, type Surface } from '@/lib/ds';

// ── Helpers ──────────────────────────────────────────────────────────

function fmtVolume(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

function countActiveFilters(filters: ScannerFilters): number {
  const d = DEFAULT_FILTERS;
  let count = 0;
  // Tier 1
  if (filters.liquidity.minOpenInterest !== d.liquidity.minOpenInterest) count++;
  if (filters.liquidity.maxBidAskSpreadPct !== d.liquidity.maxBidAskSpreadPct) count++;
  if (filters.liquidity.minUnderlyingVolume !== d.liquidity.minUnderlyingVolume) count++;
  if (filters.liquidity.minLiquidityRating !== d.liquidity.minLiquidityRating) count++;
  // Tier 2
  if (filters.risk.riskType !== d.risk.riskType) count++;
  if (filters.risk.direction !== d.risk.direction) count++;
  if (filters.risk.premiumStance !== d.risk.premiumStance) count++;
  if (filters.risk.strategies.length > 0) count++;
  if (filters.risk.minDte !== d.risk.minDte) count++;
  if (filters.risk.maxDte !== d.risk.maxDte) count++;
  if (filters.risk.minSpreadWidth !== d.risk.minSpreadWidth) count++;
  if (filters.risk.maxSpreadWidth !== d.risk.maxSpreadWidth) count++;
  // Tier 3
  if (filters.edge.minPop !== d.edge.minPop) count++;
  if (filters.edge.minEv !== d.edge.minEv) count++;
  if (filters.edge.minEvPerRisk !== d.edge.minEvPerRisk) count++;
  if (filters.edge.volEdge !== d.edge.volEdge) count++;
  if (filters.edge.minIvRank !== d.edge.minIvRank) count++;
  if (filters.edge.minSentiment !== d.edge.minSentiment) count++;
  return count;
}

// ── Sub-components ───────────────────────────────────────────────────

function SectionHeader({ dk = false, label, open, onToggle }: { dk?: boolean; label: string; open: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className="flex items-center gap-2 w-full text-left py-1.5">
      <span className={themed('text-[10px] text-text-muted font-mono', dk)}>{open ? '\u25BC' : '\u25B6'}</span>
      <span className={themed('text-[10px] text-text-muted uppercase tracking-wider font-bold', dk)}>{label}</span>
    </button>
  );
}

function SliderRow({ dk = false, label, value, min, max, step, format, onChange }: { dk?: boolean;
  label: string; value: number; min: number; max: number; step: number;
  format: (v: number) => string; onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={themed('text-[10px] text-text-muted w-24 shrink-0 text-right', dk)}>{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="flex-1 h-1 cursor-pointer accent-brand-purple"
      />
      <span className={themed('text-[10px] text-text-primary font-mono w-16 text-right shrink-0', dk)}>{format(value)}</span>
    </div>
  );
}

function ToggleGroup<T extends string>({ options, value, onChange, dk = false }: {
  options: { label: string; value: T }[]; value: T; onChange: (v: T) => void; dk?: boolean;
}) {
  return (
    <div className={themed('flex gap-0.5 rounded overflow-hidden bg-bg-terminal border border-border', dk)}>
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={themed(`px-2 py-1 text-[10px] font-bold transition-colors ${
            value === opt.value
              ? 'bg-brand-purple text-white'
              : 'bg-transparent text-text-muted hover:text-text-secondary'
          }`, dk)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function LiquidityStars({ dk = false, value, onChange }: { dk?: boolean; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className={themed('text-[10px] text-text-muted w-24 shrink-0 text-right', dk)}>Min Liquidity</span>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={themed(`text-sm transition-colors ${n <= value ? 'text-brand-gold' : 'text-text-faint'}`, dk)}
          >
            &#9733;
          </button>
        ))}
      </div>
      <span className={themed('text-[10px] text-text-muted font-mono', dk)}>{value}/5</span>
    </div>
  );
}

// ── Props ────────────────────────────────────────────────────────────

interface FilterPanelProps {
  filters: ScannerFilters;
  onChange: (filters: ScannerFilters) => void;
}

// ── Main Component ───────────────────────────────────────────────────

export default function FilterPanel({ filters, onChange, surface = 'light' }: FilterPanelProps & { surface?: Surface }) {
  const dk = surface === 'dark';
  const [open, setOpen] = useState(false);
  const [t1Open, setT1Open] = useState(true);
  const [t2Open, setT2Open] = useState(true);
  const [t3Open, setT3Open] = useState(true);

  const activeCount = countActiveFilters(filters);

  const setLiquidity = useCallback((patch: Partial<LiquidityGates>) => {
    onChange({ ...filters, liquidity: { ...filters.liquidity, ...patch } });
  }, [filters, onChange]);

  const setRisk = useCallback((patch: Partial<RiskProfile>) => {
    onChange({ ...filters, risk: { ...filters.risk, ...patch } });
  }, [filters, onChange]);

  const setEdge = useCallback((patch: Partial<EdgeMetrics>) => {
    onChange({ ...filters, edge: { ...filters.edge, ...patch } });
  }, [filters, onChange]);

  const toggleStrategy = useCallback((name: string) => {
    const current = filters.risk.strategies;
    const next = current.includes(name)
      ? current.filter(s => s !== name)
      : [...current, name];
    setRisk({ strategies: next });
  }, [filters.risk.strategies, setRisk]);

  const reset = useCallback(() => {
    onChange(DEFAULT_FILTERS);
    try { localStorage.removeItem('scanner-filters'); } catch {}
  }, [onChange]);

  return (
    <div className={themed('border-b border-border', dk)}>
      {/* Toggle bar */}
      <div className={themed('px-4 py-2 flex items-center gap-3 bg-bg-row', dk)}>
        <button
          onClick={() => setOpen(!open)}
          className={themed(`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${activeCount > 0 ? 'text-brand-purple' : 'text-text-muted'}`, dk)}
        >
          <span className="font-mono">{open ? '\u25BC' : '\u25B6'}</span>
          Filters
          {activeCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-brand-purple text-white">
              {activeCount}
            </span>
          )}
        </button>
        {activeCount > 0 && (
          <button onClick={reset} className={themed('text-[10px] text-text-faint hover:text-text-secondary transition-colors', dk)}>
            Reset to defaults
          </button>
        )}
      </div>

      {/* Panel body */}
      {open && (
        <div className={themed('px-4 py-3 space-y-3 bg-bg-terminal border-t border-border', dk)}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* TIER 1: Liquidity Gates */}
            <div className={themed('rounded border border-border bg-white p-3', dk)}>
              <SectionHeader dk={dk} label="Liquidity Gates" open={t1Open} onToggle={() => setT1Open(!t1Open)} />
              {t1Open && (
                <div className="space-y-2 mt-2">
                  <SliderRow dk={dk}
                    label="Min OI" value={filters.liquidity.minOpenInterest}
                    min={0} max={5000} step={50}
                    format={v => v.toLocaleString()}
                    onChange={v => setLiquidity({ minOpenInterest: v })}
                  />
                  <SliderRow dk={dk}
                    label="Max Spread" value={filters.liquidity.maxBidAskSpreadPct}
                    min={1} max={50} step={1}
                    format={v => `${v}%`}
                    onChange={v => setLiquidity({ maxBidAskSpreadPct: v })}
                  />
                  <SliderRow dk={dk}
                    label="Min Volume" value={filters.liquidity.minUnderlyingVolume}
                    min={0} max={10_000_000} step={100_000}
                    format={fmtVolume}
                    onChange={v => setLiquidity({ minUnderlyingVolume: v })}
                  />
                  <LiquidityStars dk={dk}
                    value={filters.liquidity.minLiquidityRating}
                    onChange={v => setLiquidity({ minLiquidityRating: v })}
                  />
                </div>
              )}
            </div>

            {/* TIER 2: Risk Profile */}
            <div className={themed('rounded border border-border bg-white p-3', dk)}>
              <SectionHeader dk={dk} label="Risk Profile" open={t2Open} onToggle={() => setT2Open(!t2Open)} />
              {t2Open && (
                <div className="space-y-2.5 mt-2">
                  <div className="flex items-center gap-2">
                    <span className={themed('text-[10px] text-text-muted w-24 shrink-0 text-right', dk)}>Risk Type</span>
                    <ToggleGroup<RiskType> dk={dk}
                      options={[
                        { label: 'Defined Only', value: 'DEFINED_ONLY' },
                        { label: 'Include Unlimited', value: 'INCLUDE_UNLIMITED' },
                      ]}
                      value={filters.risk.riskType}
                      onChange={v => setRisk({ riskType: v })}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={themed('text-[10px] text-text-muted w-24 shrink-0 text-right', dk)}>Direction</span>
                    <ToggleGroup<Direction> dk={dk}
                      options={[
                        { label: 'All', value: 'ALL' },
                        { label: 'Bull', value: 'BULLISH' },
                        { label: 'Bear', value: 'BEARISH' },
                        { label: 'Neutral', value: 'NEUTRAL' },
                      ]}
                      value={filters.risk.direction}
                      onChange={v => setRisk({ direction: v })}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={themed('text-[10px] text-text-muted w-24 shrink-0 text-right', dk)}>Premium</span>
                    <ToggleGroup<PremiumStance> dk={dk}
                      options={[
                        { label: 'Sell', value: 'SELL' },
                        { label: 'Buy', value: 'BUY' },
                        { label: 'Both', value: 'BOTH' },
                      ]}
                      value={filters.risk.premiumStance}
                      onChange={v => setRisk({ premiumStance: v })}
                    />
                  </div>
                  <SliderRow dk={dk}
                    label="Min DTE" value={filters.risk.minDte}
                    min={0} max={180} step={5}
                    format={v => `${v}d`}
                    onChange={v => setRisk({ minDte: v })}
                  />
                  <SliderRow dk={dk}
                    label="Max DTE" value={filters.risk.maxDte}
                    min={0} max={180} step={5}
                    format={v => `${v}d`}
                    onChange={v => setRisk({ maxDte: v })}
                  />
                  <SliderRow dk={dk}
                    label="Min Width" value={filters.risk.minSpreadWidth}
                    min={0.5} max={20} step={0.5}
                    format={v => `$${v}`}
                    onChange={v => setRisk({ minSpreadWidth: v })}
                  />
                  <SliderRow dk={dk}
                    label="Max Width" value={filters.risk.maxSpreadWidth}
                    min={1} max={50} step={1}
                    format={v => `$${v}`}
                    onChange={v => setRisk({ maxSpreadWidth: v })}
                  />
                  {/* Strategy checkboxes */}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={themed('text-[10px] text-text-muted w-24 shrink-0 text-right', dk)}>Strategies</span>
                      <button
                        onClick={() => setRisk({ strategies: [...AVAILABLE_STRATEGIES] })}
                        className="text-[9px] text-brand-purple hover:text-brand-purple-hover"
                      >
                        Select All
                      </button>
                      <span className={themed('text-text-faint text-[9px]', dk)}>|</span>
                      <button
                        onClick={() => setRisk({ strategies: [] })}
                        className="text-[9px] text-brand-purple hover:text-brand-purple-hover"
                      >
                        Clear
                      </button>
                      {filters.risk.strategies.length > 0 && (
                        <span className={themed('text-[9px] text-text-muted font-mono', dk)}>
                          ({filters.risk.strategies.length})
                        </span>
                      )}
                    </div>
                    <div className="pl-[104px] flex flex-wrap gap-1">
                      {AVAILABLE_STRATEGIES.map(name => {
                        const active = filters.risk.strategies.length === 0 || filters.risk.strategies.includes(name);
                        return (
                          <button
                            key={name}
                            onClick={() => toggleStrategy(name)}
                            className={themed(`px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors border ${
                              filters.risk.strategies.includes(name)
                                ? 'border-brand-purple bg-brand-purple-wash text-brand-purple'
                                : active
                                  ? 'border-border bg-bg-row text-text-secondary'
                                  : 'border-transparent bg-bg-terminal text-text-faint'
                            }`, dk)}
                          >
                            {name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* TIER 3: Edge Metrics */}
            <div className={themed('rounded border border-border bg-white p-3', dk)}>
              <SectionHeader dk={dk} label="Edge Metrics" open={t3Open} onToggle={() => setT3Open(!t3Open)} />
              {t3Open && (
                <div className="space-y-2 mt-2">
                  <SliderRow dk={dk}
                    label="Min Est. PoP" value={filters.edge.minPop}
                    min={0} max={100} step={1}
                    format={v => `${v}%`}
                    onChange={v => setEdge({ minPop: v })}
                  />
                  <SliderRow dk={dk}
                    label="Min Est. EV" value={filters.edge.minEv}
                    min={-500} max={500} step={10}
                    format={v => `$${v}`}
                    onChange={v => setEdge({ minEv: v })}
                  />
                  <SliderRow dk={dk}
                    label="Min EV/Risk" value={filters.edge.minEvPerRisk}
                    min={-100} max={100} step={1}
                    format={v => (v / 100).toFixed(2)}
                    onChange={v => setEdge({ minEvPerRisk: v })}
                  />
                  <div className="flex items-center gap-2">
                    <span className={themed('text-[10px] text-text-muted w-24 shrink-0 text-right', dk)}>Vol Edge</span>
                    <ToggleGroup<VolEdge> dk={dk}
                      options={[
                        { label: 'IV > HV', value: 'IV_ABOVE_HV' },
                        { label: 'IV < HV', value: 'IV_BELOW_HV' },
                        { label: 'Any', value: 'ANY' },
                      ]}
                      value={filters.edge.volEdge}
                      onChange={v => setEdge({ volEdge: v })}
                    />
                  </div>
                  <SliderRow dk={dk}
                    label="Min IV Rank" value={filters.edge.minIvRank}
                    min={0} max={100} step={1}
                    format={v => `${v}%`}
                    onChange={v => setEdge({ minIvRank: v })}
                  />
                  <SliderRow dk={dk}
                    label="Min Sentiment" value={filters.edge.minSentiment}
                    min={-100} max={100} step={10}
                    format={v => (v / 100).toFixed(1)}
                    onChange={v => setEdge({ minSentiment: v })}
                  />
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

export { countActiveFilters };
