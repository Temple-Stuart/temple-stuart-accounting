/**
 * src/components/workbench/SectionJ_CostLedger.tsx
 *
 * Cost ledger: cumulative cost today/week/month, per-run breakdown,
 * per-model breakdown. Currently a placeholder — cost_ledger table
 * lands in PR-23 per architecture doc § 8.1 Phase 2.
 */

'use client';

export function SectionJ_CostLedger() {
  return (
    <section className="bg-white rounded border border-border shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-mono text-sm font-bold tracking-wide text-text-primary">
          J · COST LEDGER
        </h2>
        <span className="text-xs font-mono text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
          UNBUILT · PHASE 2 · PR-23
        </span>
      </div>

      <div className="space-y-3 text-xs font-mono">
        <div className="grid grid-cols-3 gap-3 opacity-50">
          <div>
            <div className="text-text-faint uppercase tracking-wide mb-1">today</div>
            <div className="text-2xl text-text-muted tabular-nums">$ —</div>
          </div>
          <div>
            <div className="text-text-faint uppercase tracking-wide mb-1">this week</div>
            <div className="text-2xl text-text-muted tabular-nums">$ —</div>
          </div>
          <div>
            <div className="text-text-faint uppercase tracking-wide mb-1">this month</div>
            <div className="text-2xl text-text-muted tabular-nums">$ —</div>
          </div>
        </div>

        <div className="text-text-muted leading-relaxed pt-2 border-t border-border-light">
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
