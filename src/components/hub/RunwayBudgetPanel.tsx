'use client';
import { themed } from '@/lib/ds';

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
  // Additive per-entity breakdown — Personal + Business (+ Unattributed if any) === netBurnTotal.
  entities: { personal: EntityBurn; business: EntityBurn; unattributed: EntityBurn | null };
}
interface EntityBurn {
  expenses: number;
  income: number;
  netBurnTotal: number;
  netBurnPerMonth: number;
}
interface RunwayData {
  asOf: string;
  cash: { dollars: number; accountsLinked: number; available: boolean; source: string };
  burnSource: string;
  windows: RunwayWindow[];
}

// Trading panel (SEPARATE from runway — realized P&L, governed by different rules; never a runway).
interface TradingData {
  realizedPnl: number;
  gains: number;
  losses: number;
  tradeCount: number;
  period: string;
  source: string;
  capital: { tracked: boolean; reason: string };
  drawdown: { tracked: boolean; reason: string };
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

  // Per-entity net burn/mo — same trailing-ledger basis as the combined line. Net burn is real in
  // every state EXCEPT insufficient_history (the window lacks full data); no per-entity runway/zero
  // date (cash is not entity-split this PR). Mirrors the combined burnLine sign convention.
  const entityBurnLine = (e: EntityBurn) =>
    w.state === 'insufficient_history'
      ? '—'
      : e.netBurnPerMonth > 0
        ? `${usd(e.netBurnPerMonth)}/mo out`
        : `${usd(Math.abs(e.netBurnPerMonth))}/mo in`;

  return (
    <div className={themed('flex-1 min-w-[180px] rounded-lg border border-border bg-bg-row/40 px-3 py-2', true)}>
      <div className={themed('text-xs font-semibold text-text-secondary uppercase tracking-wide', true)}>
        Trailing {w.months}mo
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <span className={themed('text-xs text-text-muted', true)}>Net burn</span>
        <span className={themed('font-mono text-sm text-text-primary tabular-nums', true)}>{burnLine}</span>
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className={themed('text-xs text-text-muted', true)}>Runway</span>
        <span className={themed('font-mono text-sm text-text-primary tabular-nums', true)}>{runwayLine}</span>
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className={themed('text-xs text-text-muted', true)}>Zero date</span>
        <span className={themed('font-mono text-sm text-text-primary tabular-nums', true)}>{zeroLine}</span>
      </div>
      {/* Per-entity operating breakdown (additive; Personal + Business reconcile to Net burn above). */}
      <div className={themed('mt-1.5 pt-1.5 border-t border-border-light space-y-0.5', true)}>
        <div className="flex items-baseline justify-between gap-2">
          <span className={themed('text-[10px] text-text-faint uppercase tracking-wide', true)}>Personal</span>
          <span className={themed('font-mono text-xs text-text-secondary tabular-nums', true)}>{entityBurnLine(w.entities.personal)}</span>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <span className={themed('text-[10px] text-text-faint uppercase tracking-wide', true)}>Business</span>
          <span className={themed('font-mono text-xs text-text-secondary tabular-nums', true)}>{entityBurnLine(w.entities.business)}</span>
        </div>
        {w.entities.unattributed && (
          // A non-trading entity that is neither Personal nor Business — surfaced, never dropped.
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[10px] text-amber-600 uppercase tracking-wide">Unattributed</span>
            <span className="font-mono text-xs text-amber-600 tabular-nums">{entityBurnLine(w.entities.unattributed)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// PREVIEW (guest) shells — the REAL "no data yet" states the panel already renders for a user with
// nothing: cash unavailable → "No bank linked", windows show "—" (insufficient_history), trading
// $0 / "not tracked". Every figure is ZERO/empty and every label is one the component (or its
// routes) already emits — NO fabricated numbers, NO sample data. Used to render the panel for a
// logged-out guest WITHOUT calling the authed /api/runway or /api/trading routes.
const PREVIEW_EMPTY_ENTITY: EntityBurn = { expenses: 0, income: 0, netBurnTotal: 0, netBurnPerMonth: 0 };
function previewRunway(): RunwayData {
  const win = (months: number): RunwayWindow => ({
    months, rangeStart: '', rangeEnd: '', expenses: 0, income: 0,
    netBurnTotal: 0, netBurnPerMonth: 0, sufficientHistory: false,
    state: 'insufficient_history', runwayMonths: null, zeroDate: null,
    entities: { personal: PREVIEW_EMPTY_ENTITY, business: PREVIEW_EMPTY_ENTITY, unattributed: null },
  });
  return {
    asOf: new Date().toISOString().slice(0, 10),
    cash: { dollars: 0, accountsLinked: 0, available: false, source: 'Plaid balance · operating (excl. trading)' },
    burnSource: 'trailing ledger actuals',
    windows: [win(3), win(6)],
  };
}
const PREVIEW_TRADING: TradingData = {
  realizedPnl: 0, gains: 0, losses: 0, tradeCount: 0,
  period: 'all-time', source: 'trading ledger, realized (4100 gains − 5100 losses)',
  capital: { tracked: false, reason: 'no contributions/withdrawals posted to the trading ledger' },
  drawdown: { tracked: false, reason: 'no peak/trough data tracked' },
};

export default function RunwayBudgetPanel({ preview = false }: { preview?: boolean } = {}) {
  const [view, setView] = useState<'month' | 'year'>('month');
  const [runway, setRunway] = useState<RunwayData | null>(null);
  // Honest error/empty handling — on failure we DECLARE "unavailable", never show zeros.
  const [runwayError, setRunwayError] = useState(false);
  const [trading, setTrading] = useState<TradingData | null>(null);
  const [tradingError, setTradingError] = useState(false);
  // TRUTH-LABELS: a 403 (Trade module not unlocked) is a distinct, honest state —
  // previously lumped into tradingError and mislabeled as an outage.
  const [tradingLocked, setTradingLocked] = useState(false);

  useEffect(() => {
    // PREVIEW (guest): render the real empty shell; never call the authed route (no 401).
    if (preview) { setRunway(previewRunway()); return; }
    let cancelled = false;
    fetch('/api/runway')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`status ${r.status}`))))
      .then((d: RunwayData) => { if (!cancelled) setRunway(d); })
      .catch(() => { if (!cancelled) setRunwayError(true); });
    return () => { cancelled = true; };
  }, [preview]);

  useEffect(() => {
    // PREVIEW (guest): render the real empty shell; never call the authed route (no 401).
    if (preview) { setTrading(PREVIEW_TRADING); return; }
    let cancelled = false;
    fetch('/api/trading/realized-pnl')
      .then((r) => {
        // TRUTH-LABELS: a 403 here is the tab:trade PAYWALL (requireTabAccess),
        // not an outage — rendered as an honest "locked" state below, never as
        // "unavailable". Any other failure stays a declared error.
        if (r.status === 403) {
          if (!cancelled) setTradingLocked(true);
          return null;
        }
        return r.ok ? r.json() : Promise.reject(new Error(`status ${r.status}`));
      })
      .then((d: TradingData | null) => { if (!cancelled && d) setTrading(d); })
      .catch(() => { if (!cancelled) setTradingError(true); });
    return () => { cancelled = true; };
  }, [preview]);

  return (
    <div className={themed('border-t border-border bg-white rounded-lg overflow-hidden', true)}>
      <div className={themed('px-4 py-3 lg:px-8 border-b border-border', true)}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className={themed('text-base font-bold text-text-primary tracking-tight', true)}>Runway Budget</h2>
            <p className={themed('text-xs text-text-muted mt-0.5', true)}>
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
                className={themed(`text-xs px-3 py-1 rounded border transition-colors font-medium ${
                  view === key
                    ? 'bg-brand-purple text-white border-brand-purple'
                    : 'text-text-secondary border-border hover:bg-bg-row'
                }`, true)}
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
            <p className={themed('text-xs text-text-faint italic', true)}>Runway unavailable — could not load cash + burn.</p>
          ) : !runway ? (
            <p className={themed('text-xs text-text-faint italic', true)}>Loading runway…</p>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2">
              {/* Cash card */}
              <div className={themed('flex-1 min-w-[180px] rounded-lg border border-border bg-bg-row/40 px-3 py-2', true)}>
                <div className={themed('text-xs font-semibold text-text-secondary uppercase tracking-wide', true)}>Cash</div>
                <div className={themed('mt-1 font-mono text-lg text-text-primary tabular-nums', true)}>
                  {runway.cash.available ? usd(runway.cash.dollars) : 'No bank linked'}
                </div>
                <div className={themed('text-[10px] text-text-faint mt-0.5', true)}>
                  {runway.cash.source} · as of {niceDate(runway.asOf)}
                </div>
              </div>
              {runway.windows.map((w) => (
                <RunwayWindowCard key={w.months} w={w} />
              ))}
            </div>
          )}
          {runway && !runwayError && (
            <p className={themed('text-[10px] text-text-faint mt-1', true)}>
              Net burn = expenses − income over the trailing full calendar months ({runway.burnSource}); runway = cash ÷ net burn/mo.
            </p>
          )}
        </div>

        {/* ── TRADING — a SEPARATE panel under DIFFERENT rules. Trading P&L is EXCLUDED from
            operating runway; it is realized performance, NOT months of runway and NOT a zero date.
            Capital/drawdown are declared "not tracked" (not derivable) — never fabricated. ── */}
        <div className={themed('mt-3 pt-3 border-t-2 border-border', true)}>
          <div className="flex items-baseline justify-between gap-2">
            <h3 className={themed('text-xs font-semibold text-text-secondary uppercase tracking-wide', true)}>Trading</h3>
            <span className={themed('text-[10px] text-text-faint', true)}>separate from operating runway</span>
          </div>
          {tradingLocked ? (
            <p className={themed('text-xs text-text-muted italic mt-1', true)}>
              Trade module locked — subscribe on the Trade tab to see realized P&L here.
            </p>
          ) : tradingError ? (
            <p className={themed('text-xs text-text-faint italic mt-1', true)}>Trading unavailable — could not load realized P&L.</p>
          ) : !trading ? (
            <p className={themed('text-xs text-text-faint italic mt-1', true)}>Loading trading…</p>
          ) : (
            <div className="mt-2 flex flex-col sm:flex-row gap-2">
              {/* Realized P&L — the one truthfully-derivable trading figure. */}
              <div className={themed('flex-1 min-w-[180px] rounded-lg border border-border bg-bg-row/40 px-3 py-2', true)}>
                <div className={themed('text-xs font-semibold text-text-secondary uppercase tracking-wide', true)}>Realized P&amp;L</div>
                <div className={`mt-1 font-mono text-lg tabular-nums ${trading.realizedPnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {trading.realizedPnl >= 0 ? '+' : '−'}{usd(Math.abs(trading.realizedPnl))}
                </div>
                <div className={themed('text-[10px] text-text-faint mt-0.5', true)}>
                  {trading.source} · {trading.period} · {trading.tradeCount} trade{trading.tradeCount === 1 ? '' : 's'}
                </div>
              </div>
              {/* Capital — DECLARED not-tracked (not derivable); no invented number. */}
              <div className={themed('flex-1 min-w-[180px] rounded-lg border border-dashed border-border bg-bg-row/20 px-3 py-2', true)}>
                <div className={themed('text-xs font-semibold text-text-secondary uppercase tracking-wide', true)}>Capital</div>
                <div className={themed('mt-1 font-mono text-sm text-text-faint italic tabular-nums', true)}>not tracked yet</div>
                <div className={themed('text-[10px] text-text-faint mt-0.5', true)}>{trading.capital.reason}</div>
              </div>
              {/* Drawdown — DECLARED not-tracked. */}
              <div className={themed('flex-1 min-w-[180px] rounded-lg border border-dashed border-border bg-bg-row/20 px-3 py-2', true)}>
                <div className={themed('text-xs font-semibold text-text-secondary uppercase tracking-wide', true)}>Max drawdown</div>
                <div className={themed('mt-1 font-mono text-sm text-text-faint italic tabular-nums', true)}>not tracked yet</div>
                <div className={themed('text-[10px] text-text-faint mt-0.5', true)}>{trading.drawdown.reason}</div>
              </div>
            </div>
          )}
        </div>
      </div>
      {view === 'month' ? <HubBudgetSection preview={preview} /> : <BudgetComparison preview={preview} />}
    </div>
  );
}
