/**
 * TakeifyButton — the 🎬 Take affordance for a routine step.
 *
 * If the step already has a take, renders a non-interactive
 * "🎬 Take" badge. Otherwise renders a clickable button that
 * POSTs a bare { routine_step_id } to /api/operations/content/takes.
 * On success calls onTakeify with the new take so the parent can
 * update state.
 *
 * Step-level mirror of ScenifyButton. Bare POST — no inline form
 * for take details (filming_location_specific / camera_needed /
 * filming_angle / notes are edited later from the Content tab
 * via inline cells; landing in 4.9.3e).
 *
 * Sized to step-row density (py-0.5) to match RoutineStepList's
 * existing edit/delete buttons.
 */

'use client';

import { useState } from 'react';
import type { Take } from './ContentTable';

type TakeifyStep = {
  id: string;
  content_scene?: { id: string } | null;
};

export default function TakeifyButton({
  step,
  onTakeify,
}: {
  step: TakeifyStep;
  onTakeify: (newTake: Take) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (step.content_scene) {
    return (
      <span
        className="px-2 py-0.5 border border-border rounded bg-purple-50 text-brand-purple text-xs font-mono"
        title="this step already has a take"
      >
        🎬 Take
      </span>
    );
  }

  const handleClick = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/operations/content/takes', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routine_step_id: step.id }),
      });
      if (!res.ok) {
        let msg = res.statusText;
        try {
          const body = await res.json();
          msg = body.message || body.error || msg;
        } catch {
          // non-JSON response — fall back to statusText
        }
        setError(msg);
        console.error('Take-ify failed:', msg);
        return;
      }
      const { take } = await res.json();
      onTakeify(take);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Network error';
      setError(msg);
      console.error('Take-ify network error:', e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleClick();
        }}
        disabled={submitting}
        className="px-2 py-0.5 border border-border rounded hover:bg-bg-row disabled:opacity-50 text-xs font-mono"
      >
        {submitting ? '…' : '🎬 Take'}
      </button>
      {error && (
        <span className="text-red-700 text-xs font-mono" title={error}>
          {error}
        </span>
      )}
    </>
  );
}
