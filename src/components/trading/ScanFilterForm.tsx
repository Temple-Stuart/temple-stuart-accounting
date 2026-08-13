'use client';

import type { MutableRefObject } from 'react';
import type { ScannerFilters } from '@/lib/convergence/filter-types';
import { AVAILABLE_STRATEGIES } from '@/lib/convergence/filter-types';
// TRADE-SEGMENTS: the DS segmented-control + chip idioms. The converted
// controls drop their themed() wrap: both idioms are token-native dark
// classes with zero DARKEN_MAP-eligible tokens (themed() would be an
// identity call), and both live mounts (/trading + the app trade tab)
// pass. themed() stays on every other element.
import { SECTION_HEADER, SEGMENT, themed, toggleChip, type Surface } from '@/lib/ds';

// TRADING-PR-1/3: the scan filter form. All 18 ScannerFilters fields + universe are
// rendered EXPANDED inline (TRADING-PR-3 removed the openPopover collapsed pills —
// Liquidity gates / Edge metrics / Strategies are now visible labeled field groups).
// Presentational only: every control writes the same ScannerFilters path via
// onFiltersChange; the 18 filters are still applied CLIENT-SIDE via applyFilters in
// ConvergenceIntelligence, and the Scan button still fires scanTriggerRef.current().
// SCAN-PURP-PURGE: chrome is the house system now — SECTION_HEADER band +
// panel-surface body; group labels white/60, field labels white/70 (TRADE-INK).
// showHeader (HOME-PR-1c pattern) lets
// the home launcher render it BANDLESS under the single "Launch a module" band.

interface Props {
  scannerUniverse: string;
  setScannerUniverse: (u: string) => void;
  scannerFilters: ScannerFilters;
  /** Same handler the page used (handleFiltersChange) — persists to localStorage
   *  + updates the lifted scannerFilters state shared with ConvergenceIntelligence. */
  onFiltersChange: (next: ScannerFilters) => void;
  /** The ref ConvergenceIntelligence registers its scan trigger into. */
  scanTriggerRef: MutableRefObject<(() => void) | null>;
  ttConnected?: boolean | null;
  /** TRADING-PR-3: render the "Scan filters" SectionCard band. Default true
   *  (dashboard, standalone). The home launcher passes false — it already wraps
   *  the form in the single "Launch a module" band, so a second band would be a
   *  redundant double-purple (the HOME-PR-1c pattern). */
  showHeader?: boolean;
}

const UNIVERSES = [{ val: 'sp500', label: 'S&P 500' }, { val: 'nasdaq100', label: 'Nasdaq 100' }];

// Light/secondary group label — the Travel one-purple + secondary-white inner rule.
function GroupLabel({ children }: { children: React.ReactNode }) {
  // TRADE-INK: group eyebrows → white/60 (the brand-purple ink was illegible on dark).
  return <div className="text-[10px] uppercase tracking-wider font-semibold text-text-muted mb-1.5">{children}</div>;
}
function FieldLabel({ dk = false, children }: { dk?: boolean; children: React.ReactNode }) {
  // HOME-STYLE-PR-1: field sub-labels → readable secondary text, weight 500.
  return <span className="text-[11px] text-text-secondary font-medium w-[88px] shrink-0">{children}</span>;
}

export default function ScanFilterForm({
  scannerUniverse, setScannerUniverse, scannerFilters, onFiltersChange, scanTriggerRef, ttConnected, showHeader = true, surface = 'light',
}: Props & { surface?: Surface }) {
  const dk = surface === 'dark';
  const f = scannerFilters;
  const runScan = () => { if (scanTriggerRef.current) scanTriggerRef.current(); };

  const formBody = (
    <div className="space-y-4">

      {/* Universe + Direction + Stance + Risk type */}
      <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
        <div className="flex flex-col gap-1">
          <GroupLabel>Universe</GroupLabel>
          <div className="flex gap-1.5">
            {UNIVERSES.map(u => (
              <button key={u.val} type="button" onClick={() => setScannerUniverse(u.val)}
                className={toggleChip(scannerUniverse === u.val)}>
                {u.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <GroupLabel>Direction</GroupLabel>
          <div className={SEGMENT.wrap}>
            {(['ALL', 'BULLISH', 'BEARISH', 'NEUTRAL'] as const).map(d => (
              <button key={d} type="button" onClick={() => onFiltersChange({ ...f, risk: { ...f.risk, direction: d } })}
                className={SEGMENT.item(f.risk.direction === d)}>
                {d === 'BULLISH' ? 'Bull' : d === 'BEARISH' ? 'Bear' : d === 'NEUTRAL' ? 'Ntrl' : 'All'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <GroupLabel>Premium</GroupLabel>
          <div className={SEGMENT.wrap}>
            {(['SELL', 'BUY', 'BOTH'] as const).map(s => (
              <button key={s} type="button" onClick={() => onFiltersChange({ ...f, risk: { ...f.risk, premiumStance: s } })}
                className={SEGMENT.item(f.risk.premiumStance === s)}>
                {s === 'BOTH' ? 'Both' : s}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <GroupLabel>Risk</GroupLabel>
          <div className={SEGMENT.wrap}>
            {(['DEFINED_ONLY', 'INCLUDE_UNLIMITED'] as const).map(r => (
              <button key={r} type="button" onClick={() => onFiltersChange({ ...f, risk: { ...f.risk, riskType: r } })}
                className={SEGMENT.item(f.risk.riskType === r)}>
                {r === 'DEFINED_ONLY' ? 'Defined' : 'Unlimited'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <GroupLabel>DTE</GroupLabel>
          <div className="flex items-center gap-1">
            <input type="number" min={0} max={365} value={f.risk.minDte} onChange={e => onFiltersChange({ ...f, risk: { ...f.risk, minDte: +e.target.value } })}
              className="w-14 rounded border border-border bg-white px-2 py-1 text-xs font-mono text-text-primary text-center focus:outline-none focus:border-brand-purple-pop focus:ring-2 focus:ring-brand-purple-pop/20" />
            <span className={themed('text-gray-400 text-xs', dk)}>—</span>
            <input type="number" min={0} max={365} value={f.risk.maxDte} onChange={e => onFiltersChange({ ...f, risk: { ...f.risk, maxDte: +e.target.value } })}
              className="w-14 rounded border border-border bg-white px-2 py-1 text-xs font-mono text-text-primary text-center focus:outline-none focus:border-brand-purple-pop focus:ring-2 focus:ring-brand-purple-pop/20" />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <GroupLabel>Width $</GroupLabel>
          <div className="flex items-center gap-1">
            <input type="number" min={0} max={100} value={f.risk.minSpreadWidth} onChange={e => onFiltersChange({ ...f, risk: { ...f.risk, minSpreadWidth: +e.target.value } })}
              className="w-14 rounded border border-border bg-white px-2 py-1 text-xs font-mono text-text-primary text-center focus:outline-none focus:border-brand-purple-pop focus:ring-2 focus:ring-brand-purple-pop/20" />
            <span className={themed('text-gray-400 text-xs', dk)}>—</span>
            <input type="number" min={0} max={100} value={f.risk.maxSpreadWidth} onChange={e => onFiltersChange({ ...f, risk: { ...f.risk, maxSpreadWidth: +e.target.value } })}
              className="w-14 rounded border border-border bg-white px-2 py-1 text-xs font-mono text-text-primary text-center focus:outline-none focus:border-brand-purple-pop focus:ring-2 focus:ring-brand-purple-pop/20" />
          </div>
        </div>
      </div>

      {/* Liquidity gates + Edge metrics — expanded inline (was popovers) */}
      <div className={themed('grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4 border-t border-gray-100 pt-3', dk)}>
        {/* Liquidity gates (4) */}
        <div>
          <GroupLabel>Liquidity gates</GroupLabel>
          <div className="space-y-2">
            <div className="flex items-center gap-2"><FieldLabel>Min OI</FieldLabel><input type="range" min={0} max={5000} step={50} value={f.liquidity.minOpenInterest} onChange={e => onFiltersChange({ ...f, liquidity: { ...f.liquidity, minOpenInterest: +e.target.value } })} className="flex-1 h-1.5 accent-brand-purple-pop cursor-pointer" /><span className={themed('text-[11px] font-mono font-semibold text-gray-800 w-[54px] text-right', dk)}>{f.liquidity.minOpenInterest}</span></div>
            <div className="flex items-center gap-2"><FieldLabel>Max Spread</FieldLabel><input type="range" min={1} max={50} value={f.liquidity.maxBidAskSpreadPct} onChange={e => onFiltersChange({ ...f, liquidity: { ...f.liquidity, maxBidAskSpreadPct: +e.target.value } })} className="flex-1 h-1.5 accent-brand-purple-pop cursor-pointer" /><span className={themed('text-[11px] font-mono font-semibold text-gray-800 w-[54px] text-right', dk)}>{f.liquidity.maxBidAskSpreadPct}%</span></div>
            <div className="flex items-center gap-2"><FieldLabel>Min Volume</FieldLabel><input type="range" min={0} max={10000000} step={100000} value={f.liquidity.minUnderlyingVolume} onChange={e => onFiltersChange({ ...f, liquidity: { ...f.liquidity, minUnderlyingVolume: +e.target.value } })} className="flex-1 h-1.5 accent-brand-purple-pop cursor-pointer" /><span className={themed('text-[11px] font-mono font-semibold text-gray-800 w-[54px] text-right', dk)}>{f.liquidity.minUnderlyingVolume >= 1e6 ? `${(f.liquidity.minUnderlyingVolume / 1e6).toFixed(1)}M` : `${(f.liquidity.minUnderlyingVolume / 1e3).toFixed(0)}K`}</span></div>
            <div className="flex items-center gap-2"><FieldLabel>Min Rating</FieldLabel><div className="flex gap-1 flex-1">{[1,2,3,4,5].map(n => (<button key={n} type="button" onClick={() => onFiltersChange({ ...f, liquidity: { ...f.liquidity, minLiquidityRating: n } })} className={themed(`text-base ${n <= f.liquidity.minLiquidityRating ? 'text-brand-gold' : 'text-gray-300'}`, dk)}>*</button>))}</div></div>
          </div>
        </div>
        {/* Edge metrics (6) */}
        <div>
          <GroupLabel>Edge metrics</GroupLabel>
          <div className="space-y-2">
            <div className="flex items-center gap-2"><FieldLabel>Min PoP</FieldLabel><input type="range" min={0} max={100} value={f.edge.minPop} onChange={e => onFiltersChange({ ...f, edge: { ...f.edge, minPop: +e.target.value } })} className="flex-1 h-1.5 accent-brand-purple-pop cursor-pointer" /><span className={themed('text-[11px] font-mono font-semibold text-gray-800 w-[54px] text-right', dk)}>{f.edge.minPop}%</span></div>
            <div className="flex items-center gap-2"><FieldLabel>Min EV</FieldLabel><input type="range" min={-500} max={1000} step={10} value={f.edge.minEv} onChange={e => onFiltersChange({ ...f, edge: { ...f.edge, minEv: +e.target.value } })} className="flex-1 h-1.5 accent-brand-purple-pop cursor-pointer" /><span className={themed('text-[11px] font-mono font-semibold text-gray-800 w-[54px] text-right', dk)}>${f.edge.minEv}</span></div>
            <div className="flex items-center gap-2"><FieldLabel>Min EV/Risk</FieldLabel><input type="range" min={-200} max={200} step={5} value={Math.round(f.edge.minEvPerRisk * 100)} onChange={e => onFiltersChange({ ...f, edge: { ...f.edge, minEvPerRisk: +e.target.value / 100 } })} className="flex-1 h-1.5 accent-brand-purple-pop cursor-pointer" /><span className={themed('text-[11px] font-mono font-semibold text-gray-800 w-[54px] text-right', dk)}>{f.edge.minEvPerRisk.toFixed(2)}</span></div>
            <div className="flex items-center gap-2"><FieldLabel>Vol Edge</FieldLabel><div className={SEGMENT.wrap}>{(['IV_ABOVE_HV', 'IV_BELOW_HV', 'ANY'] as const).map(v => (<button key={v} type="button" onClick={() => onFiltersChange({ ...f, edge: { ...f.edge, volEdge: v } })} className={SEGMENT.item(f.edge.volEdge === v)}>{v === 'IV_ABOVE_HV' ? 'IV>HV' : v === 'IV_BELOW_HV' ? 'IV<HV' : 'Any'}</button>))}</div></div>
            <div className="flex items-center gap-2"><FieldLabel>Min IV Rank</FieldLabel><input type="range" min={0} max={100} value={f.edge.minIvRank} onChange={e => onFiltersChange({ ...f, edge: { ...f.edge, minIvRank: +e.target.value } })} className="flex-1 h-1.5 accent-brand-purple-pop cursor-pointer" /><span className={themed('text-[11px] font-mono font-semibold text-gray-800 w-[54px] text-right', dk)}>{f.edge.minIvRank}%</span></div>
            <div className="flex items-center gap-2"><FieldLabel>Sentiment</FieldLabel><input type="range" min={-100} max={100} value={f.edge.minSentiment} onChange={e => onFiltersChange({ ...f, edge: { ...f.edge, minSentiment: +e.target.value } })} className="flex-1 h-1.5 accent-brand-purple-pop cursor-pointer" /><span className={themed('text-[11px] font-mono font-semibold text-gray-800 w-[54px] text-right', dk)}>{(f.edge.minSentiment / 100).toFixed(1)}</span></div>
          </div>
        </div>
      </div>

      {/* Strategies (16) — expanded inline (was popover) */}
      <div className={themed('border-t border-gray-100 pt-3', dk)}>
        <div className="flex items-center justify-between mb-1.5">
          <GroupLabel>Strategies {f.risk.strategies.length > 0 ? `(${f.risk.strategies.length}/16)` : '(all)'}</GroupLabel>
          {f.risk.strategies.length > 0 && (
            <button type="button" onClick={() => onFiltersChange({ ...f, risk: { ...f.risk, strategies: [] } })}
              className="text-[11px] text-brand-purple-pop hover:underline">Reset all</button>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {AVAILABLE_STRATEGIES.map(s => {
            const active = f.risk.strategies.length === 0 || f.risk.strategies.includes(s);
            return (
              <button key={s} type="button" onClick={() => {
                const curr = f.risk.strategies;
                const next = curr.includes(s) ? curr.filter(x => x !== s) : [...curr, s];
                onFiltersChange({ ...f, risk: { ...f.risk, strategies: next } });
              }}
                className={toggleChip(active)}>
                {s}
              </button>
            );
          })}
        </div>
      </div>

      {/* Scan CTA */}
      <div className={themed('flex justify-end border-t border-gray-100 pt-3', dk)}>
        <button type="button" onClick={runScan}
          className="px-8 py-2 bg-brand-purple text-white font-bold text-sm rounded transition-colors hover:bg-brand-purple-hover whitespace-nowrap">
          Scan
        </button>
      </div>
    </div>
  );

  if (!showHeader) return formBody;
  return (
    <div className="rounded-lg overflow-hidden border border-border shadow-sm mb-3">
      <div className={SECTION_HEADER}>
        <span>Scan filters</span>
        {ttConnected != null && (
          <span className="flex items-center gap-1.5 text-xs font-normal">
            {ttConnected
              ? <><span className="w-2 h-2 bg-status-success rounded-full" />TT Connected</>
              : <><span className="w-2 h-2 bg-status-danger rounded-full" />No Broker</>}
          </span>
        )}
      </div>
      <div className="bg-white p-4">{formBody}</div>
    </div>
  );
}
