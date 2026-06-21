'use client';

/**
 * RunwayBudgetPanel (ONE-BUDGET-TOGGLE) — one budget panel with a Month/Year toggle.
 *
 * Shows ONE of the two budget views at a time instead of stacking both:
 *   • Month → <HubBudgetSection/>   (the month-scoped Budget-vs-Actual table)
 *   • Year  → <BudgetComparison/>   (the full-year travel-vs-home comparison grid)
 *
 * Presentation + selection only — neither child component is modified; their data,
 * fetches, math, toggle, and drill-down stay byte-identical. This wrapper just holds
 * the view toggle and conditionally renders one. Rendered inside RunwayDataProvider
 * by ModuleLauncher, so the children remain in the provider's context scope.
 */

import { useEffect, useState } from 'react';
import HubBudgetSection from './HubBudgetSection';
import BudgetComparison from './BudgetComparison';

// ── /api/runway response (RUNWAY-2). Compute-on-read; every figure traceable to a
//    labeled source. State carries the TRUTHFUL window status — no fabricated numbers. ──
type WindowState = 'ok' | 'insufficient_history' | 'cashflow_positive' | 'no_cash';
interface RunwayWindow {
  months: number;
  rangeStart: string;
  rangeEnd: string;
  expenses: number;
  income: number;
  netBurnTotal: number;
  netBurnPerMonth: number;
  sufficientHistory: boolean;
  state: WindowState;
  runwayMonths: number | null;
  zeroDate: string | null;
}
interface RunwayData {
  asOf: string;
  cash: { dollars: number; accountsLinked: number; available: boolean; source: string };
  burnSource: string;
  windows: RunwayWindow[];
}

const usd = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

/** Friendly YYYY-MM-DD → "Mon D, YYYY" (parsed at midnight to avoid tz drift). */
const niceDate = (ymd: string) =>
  new Date(`${ymd}T00:00:00`).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

/** One trailing-window card. Renders the window's REAL state — never a fake number. */
function RunwayWindowCard({ w }: { w: RunwayWindow }) {
  // Net burn/mo is real data in every state; how runway + zero date render depends on state.
  const burnLine =
    w.state === 'insufficient_history'
      ? '—'
      : w.netBurnPerMonth > 0
        ? `${usd(w.netBurnPerMonth)}/mo out`
        : `${usd(Math.abs(w.netBurnPerMonth))}/mo in`; // ≤ 0 → net inflow

  let runwayLine: string;
  let zeroLine: string;
  switch (w.state) {
    case 'ok':
      runwayLine = `${w.runwayMonths!.toFixed(1)} mo`;
      zeroLine = niceDate(w.zeroDate!);
      break;
    case 'cashflow_positive':
      runwayLine = 'Cash-flow positive';
      zeroLine = 'no burn';
      break;
    case 'insufficient_history':
      runwayLine = `Need ${w.months} full months`;
      zeroLine = 'insufficient history';
      break;
    case 'no_cash':
      runwayLine = 'No bank linked';
      zeroLine = '—';
      break;
  }

  return (
    <div className="flex-1 min-w-[180px] rounded-lg border border-border bg-bg-row/40 px-3 py-2">
      <div className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
        Trailing {w.months}mo
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <span className="text-xs text-text-muted">Net burn</span>
        <span className="font-mono text-sm text-text-primary tabular-nums">{burnLine}</span>
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs text-text-muted">Runway</span>
        <span className="font-mono text-sm text-text-primary tabular-nums">{runwayLine}</span>
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs text-text-muted">Zero date</span>
        <span className="font-mono text-sm text-text-primary tabular-nums">{zeroLine}</span>
      </div>
    </div>
  );
}

export default function RunwayBudgetPanel() {
  const [view, setView] = useState<'month' | 'year'>('month');
  const [runway, setRunway] = useState<RunwayData | null>(null);
  // Honest error/empty handling — on failure we DECLARE "unavailable", never show zeros.
  const [runwayError, setRunwayError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/runway')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`status ${r.status}`))))
      .then((d: RunwayData) => { if (!cancelled) setRunway(d); })
      .catch(() => { if (!cancelled) setRunwayError(true); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="border-t border-border bg-white rounded-lg overflow-hidden">
      <div className="px-4 py-3 lg:px-8 border-b border-border">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-text-primary tracking-tight">Runway Budget</h2>
            <p className="text-xs text-text-muted mt-0.5">
              {view === 'month'
                ? 'Month-by-month budget vs actual.'
                : 'Full-year travel-vs-home comparison.'}
            </p>
          </div>
          {/* Month / Year toggle — mirrors HubBudgetSection's Personal/Business/Travel
              toggle styling (same tokens, no new hex). */}
          <div className="flex gap-1.5">
            {([['month', 'Month'], ['year', 'Year']] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setView(key)}
                className={`text-xs px-3 py-1 rounded border transition-colors font-medium ${
                  view === key
                    ? 'bg-brand-purple text-white border-brand-purple'
                    : 'text-text-secondary border-border hover:bg-bg-row'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── RUNWAY READOUT (RUNWAY-2) — Cash + trailing-3mo & 6mo net burn / runway / zero date.
            Every number is source-labeled and traceable; empty/edge states declare the truth,
            never a fabricated figure. ── */}
        <div className="mt-3">
          {runwayError ? (
            <p className="text-xs text-text-faint italic">Runway unavailable — could not load cash + burn.</p>
          ) : !runway ? (
            <p className="text-xs text-text-faint italic">Loading runway…</p>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2">
              {/* Cash card */}
              <div className="flex-1 min-w-[180px] rounded-lg border border-border bg-bg-row/40 px-3 py-2">
                <div className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Cash</div>
                <div className="mt-1 font-mono text-lg text-text-primary tabular-nums">
                  {runway.cash.available ? usd(runway.cash.dollars) : 'No bank linked'}
                </div>
                <div className="text-[10px] text-text-faint mt-0.5">
                  {runway.cash.source} · as of {niceDate(runway.asOf)}
                </div>
              </div>
              {runway.windows.map((w) => (
                <RunwayWindowCard key={w.months} w={w} />
              ))}
            </div>
          )}
          {runway && !runwayError && (
            <p className="text-[10px] text-text-faint mt-1">
              Net burn = expenses − income over the trailing full calendar months ({runway.burnSource}); runway = cash ÷ net burn/mo.
            </p>
          )}
        </div>
      </div>
      {view === 'month' ? <HubBudgetSection /> : <BudgetComparison />}
    </div>
  );
}
