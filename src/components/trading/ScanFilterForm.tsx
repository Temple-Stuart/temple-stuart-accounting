'use client';

import { useState } from 'react';
import type { MutableRefObject } from 'react';
import type { ScannerFilters } from '@/lib/convergence/filter-types';
import { AVAILABLE_STRATEGIES } from '@/lib/convergence/filter-types';

// TRADING-PR-1: the scan filter form, extracted VERBATIM (same controls, same
// state writes) from the inline strip in src/app/trading/page.tsx (Zone 2 + the
// Scan button). Presentational reshape only — the 18 ScannerFilters fields +
// universe are unchanged and still applied CLIENT-SIDE via applyFilters in
// ConvergenceIntelligence; the Scan button still fires scanTriggerRef.current().
// SectionCard chrome matches CreateTripForm / the app design language (one
// brand-purple band + white body). Shared so HOME-PR-2 can mount it on the home
// Trading pill.

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
}

const UNIVERSES = [{ val: 'sp500', label: 'S&P 500' }, { val: 'nasdaq100', label: 'Nasdaq 100' }];

export default function ScanFilterForm({
  scannerUniverse, setScannerUniverse, scannerFilters, onFiltersChange, scanTriggerRef, ttConnected,
}: Props) {
  // openPopover was page-level state used only by this strip → now internal.
  const [openPopover, setOpenPopover] = useState<string | null>(null);
  const f = scannerFilters;

  const runScan = () => { setOpenPopover(null); if (scanTriggerRef.current) scanTriggerRef.current(); };

  return (
    <div className="rounded-lg overflow-hidden border border-gray-200/50 shadow-sm mb-4">
      <div className="bg-brand-purple/80 text-white px-4 py-2.5 text-sm font-semibold flex items-center justify-between">
        <span>Scan filters</span>
        {ttConnected != null && (
          <span className="flex items-center gap-1.5 text-xs font-normal">
            {ttConnected
              ? <><span className="w-2 h-2 bg-emerald-400 rounded-full" />TT Connected</>
              : <><span className="w-2 h-2 bg-red-400 rounded-full" />No Broker</>}
          </span>
        )}
      </div>
      <div className="bg-white p-4 space-y-3">

        {/* Universe + Direction + Stance + Risk type */}
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-text-muted">Universe</span>
            <div className="flex gap-1.5">
              {UNIVERSES.map(u => (
                <button key={u.val} type="button" onClick={() => setScannerUniverse(u.val)}
                  className={`text-[11px] px-2 py-1 rounded-full border ${scannerUniverse === u.val ? 'bg-brand-purple/10 text-brand-purple border-brand-purple/30 font-medium' : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'}`}>
                  {u.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-text-muted">Direction</span>
            <div className="flex gap-px rounded overflow-hidden border border-gray-200">
              {(['ALL', 'BULLISH', 'BEARISH', 'NEUTRAL'] as const).map(d => (
                <button key={d} type="button" onClick={() => onFiltersChange({ ...f, risk: { ...f.risk, direction: d } })}
                  className={`px-2 py-1 text-[11px] font-bold ${f.risk.direction === d ? 'bg-brand-purple text-white' : 'bg-white text-gray-400 hover:bg-gray-50'}`}>
                  {d === 'BULLISH' ? 'Bull' : d === 'BEARISH' ? 'Bear' : d === 'NEUTRAL' ? 'Ntrl' : 'All'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-text-muted">Premium</span>
            <div className="flex gap-px rounded overflow-hidden border border-gray-200">
              {(['SELL', 'BUY', 'BOTH'] as const).map(s => (
                <button key={s} type="button" onClick={() => onFiltersChange({ ...f, risk: { ...f.risk, premiumStance: s } })}
                  className={`px-2 py-1 text-[11px] font-bold ${f.risk.premiumStance === s ? 'bg-brand-purple text-white' : 'bg-white text-gray-400 hover:bg-gray-50'}`}>
                  {s === 'BOTH' ? 'Both' : s}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-text-muted">Risk</span>
            <div className="flex gap-px rounded overflow-hidden border border-gray-200">
              {(['DEFINED_ONLY', 'INCLUDE_UNLIMITED'] as const).map(r => (
                <button key={r} type="button" onClick={() => onFiltersChange({ ...f, risk: { ...f.risk, riskType: r } })}
                  className={`px-2 py-1 text-[11px] font-bold ${f.risk.riskType === r ? 'bg-brand-purple text-white' : 'bg-white text-gray-400 hover:bg-gray-50'}`}>
                  {r === 'DEFINED_ONLY' ? 'Defined' : 'Unlimited'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Numerics (DTE / Width) + Liquidity/Edge/Strategies popovers */}
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-text-muted">DTE</span>
            <div className="flex items-center gap-1">
              <input type="number" min={0} max={365} value={f.risk.minDte} onChange={e => onFiltersChange({ ...f, risk: { ...f.risk, minDte: +e.target.value } })}
                className="w-14 border border-gray-200 rounded px-1.5 py-1 text-xs font-mono text-center" />
              <span className="text-gray-400 text-xs">—</span>
              <input type="number" min={0} max={365} value={f.risk.maxDte} onChange={e => onFiltersChange({ ...f, risk: { ...f.risk, maxDte: +e.target.value } })}
                className="w-14 border border-gray-200 rounded px-1.5 py-1 text-xs font-mono text-center" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-text-muted">Width $</span>
            <div className="flex items-center gap-1">
              <input type="number" min={0} max={100} value={f.risk.minSpreadWidth} onChange={e => onFiltersChange({ ...f, risk: { ...f.risk, minSpreadWidth: +e.target.value } })}
                className="w-14 border border-gray-200 rounded px-1.5 py-1 text-xs font-mono text-center" />
              <span className="text-gray-400 text-xs">—</span>
              <input type="number" min={0} max={100} value={f.risk.maxSpreadWidth} onChange={e => onFiltersChange({ ...f, risk: { ...f.risk, maxSpreadWidth: +e.target.value } })}
                className="w-14 border border-gray-200 rounded px-1.5 py-1 text-xs font-mono text-center" />
            </div>
          </div>

          {/* Liquidity gates popover */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-text-muted">Liquidity</span>
            <div className="relative">
              <button type="button" onClick={() => setOpenPopover(openPopover === 'liquidity' ? null : 'liquidity')}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md border cursor-pointer ${openPopover === 'liquidity' ? 'bg-brand-purple/10 text-brand-purple border-brand-purple/30' : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'}`}>
                Liquidity gates
              </button>
              {openPopover === 'liquidity' && (
                <div className="absolute top-full left-0 mt-1 z-50 bg-white rounded-lg border-2 border-brand-gold/60 shadow-lg p-3 w-[300px]" onClick={e => e.stopPropagation()}>
                  <div className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-2">Liquidity Gates</div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2"><span className="text-[11px] text-gray-600 w-[80px] shrink-0">Min OI</span><input type="range" min={0} max={5000} step={50} value={f.liquidity.minOpenInterest} onChange={e => onFiltersChange({ ...f, liquidity: { ...f.liquidity, minOpenInterest: +e.target.value } })} className="flex-1 h-1.5 accent-brand-purple cursor-pointer" /><span className="text-[11px] font-mono font-semibold text-gray-800 w-[50px] text-right">{f.liquidity.minOpenInterest}</span></div>
                    <div className="flex items-center gap-2"><span className="text-[11px] text-gray-600 w-[80px] shrink-0">Max Spread</span><input type="range" min={1} max={50} value={f.liquidity.maxBidAskSpreadPct} onChange={e => onFiltersChange({ ...f, liquidity: { ...f.liquidity, maxBidAskSpreadPct: +e.target.value } })} className="flex-1 h-1.5 accent-brand-purple cursor-pointer" /><span className="text-[11px] font-mono font-semibold text-gray-800 w-[50px] text-right">{f.liquidity.maxBidAskSpreadPct}%</span></div>
                    <div className="flex items-center gap-2"><span className="text-[11px] text-gray-600 w-[80px] shrink-0">Min Volume</span><input type="range" min={0} max={10000000} step={100000} value={f.liquidity.minUnderlyingVolume} onChange={e => onFiltersChange({ ...f, liquidity: { ...f.liquidity, minUnderlyingVolume: +e.target.value } })} className="flex-1 h-1.5 accent-brand-purple cursor-pointer" /><span className="text-[11px] font-mono font-semibold text-gray-800 w-[50px] text-right">{f.liquidity.minUnderlyingVolume >= 1e6 ? `${(f.liquidity.minUnderlyingVolume / 1e6).toFixed(1)}M` : `${(f.liquidity.minUnderlyingVolume / 1e3).toFixed(0)}K`}</span></div>
                    <div className="flex items-center gap-2"><span className="text-[11px] text-gray-600 w-[80px] shrink-0">Min Rating</span><div className="flex gap-1">{[1,2,3,4,5].map(n => (<button key={n} type="button" onClick={() => onFiltersChange({ ...f, liquidity: { ...f.liquidity, minLiquidityRating: n } })} className={`text-base ${n <= f.liquidity.minLiquidityRating ? 'text-brand-gold' : 'text-gray-300'}`}>*</button>))}</div></div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Edge metrics popover */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-text-muted">Edge</span>
            <div className="relative">
              <button type="button" onClick={() => setOpenPopover(openPopover === 'edge' ? null : 'edge')}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md border cursor-pointer ${openPopover === 'edge' ? 'bg-brand-purple/10 text-brand-purple border-brand-purple/30' : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'}`}>
                Edge metrics
              </button>
              {openPopover === 'edge' && (
                <div className="absolute top-full left-0 mt-1 z-50 bg-white rounded-lg border-2 border-brand-gold/60 shadow-lg p-3 w-[300px]" onClick={e => e.stopPropagation()}>
                  <div className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-2">Edge Metrics</div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2"><span className="text-[11px] text-gray-600 w-[80px] shrink-0">Min PoP</span><input type="range" min={0} max={100} value={f.edge.minPop} onChange={e => onFiltersChange({ ...f, edge: { ...f.edge, minPop: +e.target.value } })} className="flex-1 h-1.5 accent-brand-purple cursor-pointer" /><span className="text-[11px] font-mono font-semibold text-gray-800 w-[50px] text-right">{f.edge.minPop}%</span></div>
                    <div className="flex items-center gap-2"><span className="text-[11px] text-gray-600 w-[80px] shrink-0">Min EV</span><input type="range" min={-500} max={1000} step={10} value={f.edge.minEv} onChange={e => onFiltersChange({ ...f, edge: { ...f.edge, minEv: +e.target.value } })} className="flex-1 h-1.5 accent-brand-purple cursor-pointer" /><span className="text-[11px] font-mono font-semibold text-gray-800 w-[50px] text-right">${f.edge.minEv}</span></div>
                    <div className="flex items-center gap-2"><span className="text-[11px] text-gray-600 w-[80px] shrink-0">Min EV/Risk</span><input type="range" min={-200} max={200} step={5} value={Math.round(f.edge.minEvPerRisk * 100)} onChange={e => onFiltersChange({ ...f, edge: { ...f.edge, minEvPerRisk: +e.target.value / 100 } })} className="flex-1 h-1.5 accent-brand-purple cursor-pointer" /><span className="text-[11px] font-mono font-semibold text-gray-800 w-[50px] text-right">{f.edge.minEvPerRisk.toFixed(2)}</span></div>
                    <div className="flex items-center gap-2"><span className="text-[11px] text-gray-600 w-[80px] shrink-0">Vol Edge</span><div className="flex gap-px rounded overflow-hidden border border-gray-200">{(['IV_ABOVE_HV', 'IV_BELOW_HV', 'ANY'] as const).map(v => (<button key={v} type="button" onClick={() => onFiltersChange({ ...f, edge: { ...f.edge, volEdge: v } })} className={`px-2 py-0.5 text-[10px] font-bold ${f.edge.volEdge === v ? 'bg-brand-purple text-white' : 'bg-white text-gray-400 hover:bg-gray-50'}`}>{v === 'IV_ABOVE_HV' ? 'IV>HV' : v === 'IV_BELOW_HV' ? 'IV<HV' : 'Any'}</button>))}</div></div>
                    <div className="flex items-center gap-2"><span className="text-[11px] text-gray-600 w-[80px] shrink-0">Min IV Rank</span><input type="range" min={0} max={100} value={f.edge.minIvRank} onChange={e => onFiltersChange({ ...f, edge: { ...f.edge, minIvRank: +e.target.value } })} className="flex-1 h-1.5 accent-brand-purple cursor-pointer" /><span className="text-[11px] font-mono font-semibold text-gray-800 w-[50px] text-right">{f.edge.minIvRank}%</span></div>
                    <div className="flex items-center gap-2"><span className="text-[11px] text-gray-600 w-[80px] shrink-0">Sentiment</span><input type="range" min={-100} max={100} value={f.edge.minSentiment} onChange={e => onFiltersChange({ ...f, edge: { ...f.edge, minSentiment: +e.target.value } })} className="flex-1 h-1.5 accent-brand-purple cursor-pointer" /><span className="text-[11px] font-mono font-semibold text-gray-800 w-[50px] text-right">{(f.edge.minSentiment / 100).toFixed(1)}</span></div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Strategies popover */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-text-muted">Strategies</span>
            <div className="relative">
              <button type="button" onClick={() => setOpenPopover(openPopover === 'strategies' ? null : 'strategies')}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md border cursor-pointer ${openPopover === 'strategies' ? 'bg-brand-purple/10 text-brand-purple border-brand-purple/30' : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'}`}>
                {f.risk.strategies.length > 0 ? `${f.risk.strategies.length}/16 strats` : '16 strats'}
              </button>
              {openPopover === 'strategies' && (
                <div className="absolute top-full left-0 mt-1 z-50 bg-white rounded-lg border-2 border-brand-gold/60 shadow-lg p-3 w-[320px]" onClick={e => e.stopPropagation()}>
                  <div className="flex flex-wrap gap-1">
                    {AVAILABLE_STRATEGIES.map(s => {
                      const active = f.risk.strategies.length === 0 || f.risk.strategies.includes(s);
                      return (
                        <button key={s} type="button" onClick={() => {
                          const curr = f.risk.strategies;
                          const next = curr.includes(s) ? curr.filter(x => x !== s) : [...curr, s];
                          onFiltersChange({ ...f, risk: { ...f.risk, strategies: next } });
                        }}
                          className={`px-2 py-0.5 rounded text-[11px] font-medium ${active ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-400 border border-gray-200'}`}>
                          {s}
                        </button>
                      );
                    })}
                  </div>
                  <button type="button" onClick={() => onFiltersChange({ ...f, risk: { ...f.risk, strategies: [] } })}
                    className="text-[11px] text-brand-purple hover:underline mt-2">Reset all</button>
                </div>
              )}
            </div>
          </div>

          {/* Scan CTA */}
          <button type="button" onClick={runScan}
            className="ml-auto px-6 py-2 bg-brand-gold hover:bg-brand-gold-bright text-white font-bold text-sm rounded transition-colors whitespace-nowrap">
            Scan
          </button>
        </div>
      </div>
    </div>
  );
}
