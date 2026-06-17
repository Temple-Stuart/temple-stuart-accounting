'use client';

/**
 * HubBudgetSection (PR-HB-1) — a month-scoped budget table under the hub home calendar.
 *
 * A flat table (Category | COA | Budget | Actual | Variance) with a 4-toggle
 * (Personal / Business / Travel / Trading) and a month + year selector. It REUSES the
 * existing budget routes and the existing BudgetDrillDown component verbatim:
 *   • Personal → /api/hub/year-calendar   (planned ← budgets table; actual ← ledger)
 *   • Business → /api/hub/business-budget  (planned ← budget_line_items; actual ← ledger)
 *   • Travel   → /api/hub/nomad-budget     (planned ← budget_line_items source=trip; actual ← ledger)
 *   • Trading  → NO route yet → honest "route pending (HB-2)" — never fabricated numbers.
 *
 * Clicking an ACTUAL figure opens the existing BudgetDrillDown (which self-fetches
 * /api/hub/drill-down → the ledger transactions behind that COA × month). The BUDGET figure
 * is inert this PR — HB-3 wires the budget → budget_line_items drill.
 *
 * Mounted only in the authed home calendar tab (ModuleLauncher), so logged-out demo users
 * never see it. The existing /hub month-grid is untouched.
 */

import { useEffect, useState } from 'react';
import BudgetDrillDown from '@/components/hub/BudgetDrillDown';
import { formatMoney, moneyColorClass } from '@/lib/money';

// Uniform response shape across the three budget routes (PR-HB-1 audit, all three identical):
// budgetData/actualData keyed coa → month(0-indexed) → dollars; coaNames keyed coa → label.
interface BudgetResponse {
  budgetData: Record<string, Record<number, number>>;
  actualData: Record<string, Record<number, number>>;
  coaNames: Record<string, string>;
}

type ToggleKey = 'personal' | 'business' | 'travel' | 'trading';

// route = null → no backend yet (Trading): an honest pending state, not fake rows.
// entityType mirrors the existing /hub openDrill calls (hub/page.tsx:709/:862/:809).
const TOGGLES: { key: ToggleKey; label: string; route: string | null; entityType: string }[] = [
  { key: 'personal', label: 'Personal', route: '/api/hub/year-calendar', entityType: 'personal' },
  { key: 'business', label: 'Business', route: '/api/hub/business-budget', entityType: 'sole_prop' },
  { key: 'travel', label: 'Travel', route: '/api/hub/nomad-budget', entityType: 'personal' },
  { key: 'trading', label: 'Trading', route: null, entityType: 'trading' },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Plain magnitude dollars for the Budget/Actual columns (expense amounts shown unsigned). */
const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function HubBudgetSection() {
  const now = new Date();
  const [toggle, setToggle] = useState<ToggleKey>('personal');
  const [year, setYear] = useState(now.getFullYear());
  const [monthIdx, setMonthIdx] = useState(now.getMonth()); // 0-indexed
  const [data, setData] = useState<BudgetResponse>({ budgetData: {}, actualData: {}, coaNames: {} });
  const [loading, setLoading] = useState(false);
  // The clicked ACTUAL cell → drives the reused BudgetDrillDown (same shape as hub/page.tsx).
  const [drillDown, setDrillDown] = useState<{
    coaCodes: string[]; month: number; year: number; categoryName: string; cellAmount: number; entityType: string;
  } | null>(null);

  const active = TOGGLES.find(t => t.key === toggle)!;

  // Fetch when the toggle (route) or year changes — NOT month: the routes return all 12 months,
  // so switching month is pure client-side filtering. Trading (route null) fetches nothing.
  useEffect(() => {
    if (!active.route) { setData({ budgetData: {}, actualData: {}, coaNames: {} }); return; }
    let cancelled = false;
    setLoading(true);
    fetch(`${active.route}?year=${year}`)
      .then(res => (res.ok ? res.json() : { budgetData: {}, actualData: {}, coaNames: {} }))
      .then(d => {
        if (cancelled) return;
        setData({ budgetData: d.budgetData || {}, actualData: d.actualData || {}, coaNames: d.coaNames || {} });
      })
      .catch(() => { if (!cancelled) setData({ budgetData: {}, actualData: {}, coaNames: {} }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [active.route, year]); // eslint-disable-line react-hooks/exhaustive-deps

  // Rows for the selected month — one per COA the route returned (never invented).
  const allRows = Object.entries(data.coaNames).map(([code, name]) => {
    const budget = data.budgetData[code]?.[monthIdx] ?? 0;
    const actual = data.actualData[code]?.[monthIdx] ?? 0;
    return { code, name, budget, actual, variance: actual - budget };
  });
  // PR-HB-1b: hide fully-empty ($0 budget AND $0 actual) accounts for the month. Uses !== 0 (NOT
  // > 0) so a genuine NEGATIVE row — a Trading P&L loss or a refund/credit — still shows.
  const rows = allRows.filter(r => r.budget !== 0 || r.actual !== 0);
  // Totals sum the SAME visible (filtered) set — numerically identical to the full set since
  // hidden rows are 0/0, but explicitly matched so the footer always equals the visible rows.
  const totalBudget = rows.reduce((s, r) => s + r.budget, 0);
  const totalActual = rows.reduce((s, r) => s + r.actual, 0);

  // 3-line opener mirroring hub/page.tsx:355 openDrill — only ACTUAL cells with a value drill.
  const openActualDrill = (code: string, name: string, actual: number) => {
    if (actual <= 0) return;
    setDrillDown({ coaCodes: [code], month: monthIdx, year, categoryName: name, cellAmount: actual, entityType: active.entityType });
  };

  const cellClass = 'py-1.5 px-3 text-right font-mono tabular-nums';

  return (
    <div className="border-t border-border bg-white px-4 py-4 lg:px-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-text-primary tracking-tight">Budget</h2>
          <p className="text-xs text-text-muted mt-0.5">{MONTHS[monthIdx]} {year} · Budget vs Actual · USD</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Month selector */}
          <select
            value={monthIdx}
            onChange={e => setMonthIdx(Number(e.target.value))}
            className="text-xs border border-border rounded px-2 py-1 text-text-secondary bg-white"
          >
            {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
          {/* Year stepper (mirrors /hub's year nav) */}
          <div className="flex items-center gap-1 text-xs">
            <button onClick={() => setYear(y => y - 1)} className="px-2 py-1 text-text-secondary hover:bg-bg-row rounded">◀</button>
            <span className="font-mono text-text-primary tabular-nums">{year}</span>
            <button onClick={() => setYear(y => y + 1)} className="px-2 py-1 text-text-secondary hover:bg-bg-row rounded">▶</button>
          </div>
        </div>
      </div>

      {/* 4-toggle: Personal (was Homebase — LABEL only) / Business / Travel / Trading */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {TOGGLES.map(t => (
          <button
            key={t.key}
            onClick={() => setToggle(t.key)}
            className={`text-xs px-3 py-1 rounded border transition-colors font-medium ${
              toggle === t.key
                ? 'bg-brand-purple text-white border-brand-purple'
                : 'text-text-secondary border-border hover:bg-bg-row'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Trading has no budget route yet → honest pending state, never fabricated rows. */}
      {!active.route ? (
        <div className="rounded-lg border border-dashed border-border bg-bg-row/40 px-4 py-8 text-center text-sm text-text-muted">
          Trading budget — route pending (HB-2). No data to show yet.
        </div>
      ) : loading ? (
        <div className="px-4 py-8 text-center text-sm text-text-faint">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-bg-row/40 px-4 py-8 text-center text-sm text-text-muted">
          No budget or actual activity for {MONTHS[monthIdx]} {year}.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border text-xs text-text-faint">
                <th className="py-2 px-3 text-left font-medium">Category</th>
                <th className="py-2 px-3 text-left font-medium">COA</th>
                <th className="py-2 px-3 text-right font-medium">Budget</th>
                <th className="py-2 px-3 text-right font-medium">Actual</th>
                <th className="py-2 px-3 text-right font-medium">Variance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.code} className="border-b border-border-light">
                  <td className="py-1.5 px-3 text-text-primary">{r.name}</td>
                  <td className="py-1.5 px-3 font-mono text-xs text-text-muted">{r.code}</td>
                  {/* BUDGET cell — inert this PR (HB-3 wires budget → budget_line_items drill). */}
                  <td className={`${cellClass} text-text-secondary`}>{usd(r.budget)}</td>
                  {/* ACTUAL cell — clickable → reused BudgetDrillDown (ledger transactions). */}
                  <td
                    onClick={() => openActualDrill(r.code, r.name, r.actual)}
                    className={`${cellClass} ${r.actual > 0 ? 'cursor-pointer hover:underline text-text-primary' : 'text-text-faint'}`}
                  >
                    {usd(r.actual)}
                  </td>
                  {/* Variance = actual − budget; colored via moneyColorClass on (budget − actual)
                      as 'pnl' so OVER budget (positive variance) reads red, UNDER reads green. */}
                  <td className={`${cellClass} ${moneyColorClass(r.budget - r.actual, 'pnl')}`}>
                    {formatMoney(r.variance, { kind: 'pnl' })}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border font-semibold">
                <td className="py-2 px-3 text-text-primary" colSpan={2}>Total</td>
                <td className={`${cellClass} text-text-primary`}>{usd(totalBudget)}</td>
                <td className={`${cellClass} text-text-primary`}>{usd(totalActual)}</td>
                <td className={`${cellClass} ${moneyColorClass(totalBudget - totalActual, 'pnl')}`}>
                  {formatMoney(totalActual - totalBudget, { kind: 'pnl' })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Reused verbatim — self-fetches /api/hub/drill-down for the clicked COA × month. */}
      {drillDown && (
        <BudgetDrillDown isOpen={true} onClose={() => setDrillDown(null)} {...drillDown} />
      )}
    </div>
  );
}
