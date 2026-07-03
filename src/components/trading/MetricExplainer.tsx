'use client';

import { createContext, useContext, useId, useState, type ReactNode } from 'react';
import { METRIC_EXPLAINERS, type MetricValues } from './metricExplainers';

/**
 * TEACH-1 — tap-to-open, mobile-first metric explainers.
 *
 * `MetricInfo` wraps a metric's on-card label with a subtle affordance (dotted underline
 * + ⓘ). Tapping it opens a plain-language panel: what the number MEANS (with the card's
 * LIVE values) → HOW it's made (numbered steps) → the exact data source. One panel open
 * at a time (coordinated by MetricExplainerProvider). No fetches, no external calls —
 * content is deterministic client-side templates.
 *
 * TRUTH-FIRST: if the metric's value is missing, the panel shows the true-state message
 * instead of a fabricated number.
 */

interface Ctx { openId: string | null; setOpenId: (id: string | null) => void; }
const ExplainerCtx = createContext<Ctx | null>(null);

export function MetricExplainerProvider({ children }: { children: ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null);
  return <ExplainerCtx.Provider value={{ openId, setOpenId }}>{children}</ExplainerCtx.Provider>;
}

interface MetricInfoProps {
  metricKey: string;
  values: MetricValues;
  /** The metric's primary value; when null/undefined the panel shows the true-state message. */
  hasValue?: boolean;
  /** Reason the value is unavailable, if known from the data (else a generic true-state line). */
  missingReason?: string;
  children: ReactNode;
}

export default function MetricInfo({ metricKey, values, hasValue = true, missingReason, children }: MetricInfoProps) {
  const id = useId();
  const ctx = useContext(ExplainerCtx);
  // Fall back to self-managed state if no provider is mounted (still works, just not
  // coordinated one-at-a-time).
  const [selfOpen, setSelfOpen] = useState(false);
  const open = ctx ? ctx.openId === id : selfOpen;
  const toggle = () => {
    if (ctx) ctx.setOpenId(open ? null : id);
    else setSelfOpen((o) => !o);
  };

  const meta = METRIC_EXPLAINERS[metricKey];

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="inline-flex items-center gap-0.5 border-b border-dotted border-text-faint text-left hover:border-brand-purple focus:outline-none focus:border-brand-purple"
      >
        {children}
        <span aria-hidden="true" className="text-[9px] text-text-faint">ⓘ</span>
      </button>

      {open && meta && (
        <span
          role="dialog"
          className="absolute left-0 top-full z-50 mt-1 block w-72 max-w-[85vw] rounded-lg border border-border bg-white p-3 text-left shadow-lg"
        >
          <span className="mb-1 flex items-start justify-between gap-2">
            <span className="text-sm font-semibold text-text-primary">{meta.title}</span>
            <button
              type="button"
              onClick={toggle}
              aria-label="Close"
              className="shrink-0 text-xs text-text-muted hover:text-text-primary"
            >
              ✕
            </button>
          </span>

          {hasValue ? (
            <>
              <span className="block space-y-1 text-xs text-text-secondary">
                {meta.explain(values).map((line, i) => (
                  <span key={i} className="block">{line}</span>
                ))}
              </span>
              <span className="mt-2 block text-[11px] font-semibold uppercase tracking-wider text-text-muted">How it&rsquo;s made</span>
              <ol className="mt-0.5 list-decimal space-y-0.5 pl-4 text-[11px] text-text-secondary">
                {meta.pipeline.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </>
          ) : (
            <span className="block text-xs text-text-secondary">
              This value could not be computed for this card — {missingReason || 'data not available from source'}.
            </span>
          )}

          <span className="mt-2 block font-mono text-[10px] text-text-muted">
            Data source: {meta.source}
          </span>
        </span>
      )}
    </span>
  );
}
