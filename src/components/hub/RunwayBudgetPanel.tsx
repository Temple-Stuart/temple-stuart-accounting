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

import { useState } from 'react';
import HubBudgetSection from './HubBudgetSection';
import BudgetComparison from './BudgetComparison';

export default function RunwayBudgetPanel() {
  const [view, setView] = useState<'month' | 'year'>('month');

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
      </div>
      {view === 'month' ? <HubBudgetSection /> : <BudgetComparison />}
    </div>
  );
}
