'use client';

import { useState, useEffect, useCallback } from 'react';
import { BookOpen, Lock } from 'lucide-react';
import TaxFilingWizard from '@/components/tax-filing/TaxFilingWizard';

/**
 * TAX-1 — the closed-books handoff gate for the homepage Tax tab.
 *
 * "Tax begins at completed books": the wizard only opens once the user has actually
 * CLOSED at least one accounting period (closing_periods.status === 'closed'). This
 * mirrors the constitution — tax figures derive from the ledger, so they are only
 * trustworthy once a period is closed.
 *
 * Handoff rule (documented, intentionally simple for TAX-1): if ANY closed period
 * exists for the user's default entity, the handoff is satisfied and the wizard renders.
 * Refining this to per-tax-year granularity (filing year N needs year-N closes) is a
 * later PR.
 *
 * TRUTH-FIRST — three explicit states, no guessing:
 *   loading → neutral placeholder
 *   error   → explicit error + Retry (a FAILED closing-periods/entities fetch is neither
 *             open nor closed — we never guess a state)
 *   loaded  → NO closed period → the handoff gate screen (with a jump-to-Books button)
 *             ≥1 closed period → the bare <TaxFilingWizard />
 * "No entity / no closed period" is the TRUE not-yet-closed state, not a fallback.
 *
 * All fetches hit existing, auth-gated, user-scoped routes (/api/entities,
 * /api/closing-periods) — no new routes.
 */

interface Props {
  /** Switches the homepage to the Books tab (ModuleLauncher selectTab('books')). */
  onGoToBooks: () => void;
}

type GateState = 'loading' | 'error' | 'gate' | 'wizard';

export default function TaxHandoffGate({ onGoToBooks }: Props) {
  const [state, setState] = useState<GateState>('loading');
  const [periodCount, setPeriodCount] = useState(0);

  const load = useCallback(async () => {
    setState('loading');
    try {
      // Resolve the default entity — same rule BooksPipeline uses (is_default || [0]).
      const entRes = await fetch('/api/entities');
      if (!entRes.ok) throw new Error('entities fetch failed');
      const entData = await entRes.json();
      const entities = entData.entities || [];
      const def = entities.find((e: { is_default?: boolean }) => e.is_default) || entities[0];
      // No entity at all → the user cannot have closed a period → TRUE gate state
      // (not an error, not a guess).
      if (!def) {
        setPeriodCount(0);
        setState('gate');
        return;
      }
      const cpRes = await fetch(`/api/closing-periods?entityId=${encodeURIComponent(def.id)}`);
      if (!cpRes.ok) throw new Error('closing-periods fetch failed');
      const cpData = await cpRes.json();
      const periods: Array<{ status?: string }> = cpData.periods || [];
      // Closed contract: status === 'closed'. 'reopened' and absent do NOT count.
      const closed = periods.filter((p) => p.status === 'closed').length;
      setPeriodCount(periods.length);
      setState(closed > 0 ? 'wizard' : 'gate');
    } catch {
      setState('error');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (state === 'loading') {
    return (
      <div className="rounded-xl border-2 border-border bg-white px-4 py-3 text-sm text-text-muted">
        Checking your books…
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div role="alert" className="rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between gap-3">
        <span>Couldn&rsquo;t check whether your books are closed. Nothing is assumed — the tax wizard stays locked until we can confirm.</span>
        <button
          type="button"
          onClick={load}
          className="shrink-0 rounded-lg border border-red-400 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
        >
          Retry
        </button>
      </div>
    );
  }

  if (state === 'gate') {
    return (
      <div className="rounded-xl border-2 border-brand-gold/50 bg-brand-gold/5 px-6 py-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-gold/15 text-brand-gold">
          <Lock className="h-6 w-6" aria-hidden="true" />
        </div>
        <h3 className="text-lg font-semibold text-text-primary">Tax begins at completed books</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-text-secondary">
          Your tax figures come straight from your ledger, so the filing wizard opens once you&rsquo;ve
          closed at least one accounting period. {periodCount > 0
            ? `You have ${periodCount} period${periodCount === 1 ? '' : 's'} on record, but none are closed yet.`
            : 'No periods are closed yet.'}
        </p>
        <button
          type="button"
          onClick={onGoToBooks}
          className="mx-auto mt-5 inline-flex items-center gap-2 rounded-lg bg-brand-purple px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-purple/90"
        >
          <BookOpen className="h-4 w-4" aria-hidden="true" />
          Go to Books &amp; close a period
        </button>
      </div>
    );
  }

  // state === 'wizard' — handoff satisfied (at least one closed period); render the bare wizard.
  return <TaxFilingWizard />;
}
