'use client';
import { themed, type Surface } from '@/lib/ds';
/**
 * src/components/workbench/SectionJ_CostLedger.tsx
 *
 * Cost ledger: cumulative cost today/week/month, per-run breakdown,
 * per-model breakdown. Currently a placeholder — cost_ledger table
 * lands in PR-23 per architecture doc § 8.1 Phase 2.
 */


export function SectionJ_CostLedger({ surface = 'light' }: { surface?: Surface } = {}) {
  const dk = surface === 'dark';
  return (
    <section className={themed('bg-white rounded border border-border shadow-sm p-5', dk)}>
      <div className="flex items-center justify-between mb-3">
        <h2 className={themed('font-mono text-sm font-bold tracking-wide text-text-primary', dk)}>
          J · COST LEDGER
        </h2>
        <span className="text-xs font-mono text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
          UNBUILT · PHASE 2 · PR-23
        </span>
      </div>

      <div className="space-y-3 text-xs font-mono">
        <div className="grid grid-cols-3 gap-3 opacity-50">
          <div>
            <div className={themed('text-text-faint uppercase tracking-wide mb-1', dk)}>today</div>
            <div className={themed('text-2xl text-text-muted tabular-nums', dk)}>$ —</div>
          </div>
          <div>
            <div className={themed('text-text-faint uppercase tracking-wide mb-1', dk)}>this week</div>
            <div className={themed('text-2xl text-text-muted tabular-nums', dk)}>$ —</div>
          </div>
          <div>
            <div className={themed('text-text-faint uppercase tracking-wide mb-1', dk)}>this month</div>
            <div className={themed('text-2xl text-text-muted tabular-nums', dk)}>$ —</div>
          </div>
        </div>

        <div className={themed('text-text-muted leading-relaxed pt-2 border-t border-border-light', dk)}>
          Per architecture doc § 4.4, every model call writes to a
          versioned <code>cost_ledger</code> table. Cost cap enforcement
          fires <code>CostCapExceeded</code> if a run exceeds its
          budget. Per-run economics target is $1.35-$1.80 (Phase 2
          ensemble) per architecture doc § 4.4. Lands in PR-23.
        </div>
      </div>
    </section>
  );
}
