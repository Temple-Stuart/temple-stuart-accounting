/**
 * TaskTimeCommit — inline first-commit of a task's time, WITHOUT leaving the Content
 * page (OPS-CE-8E). Rendered on every block-less ("planned · no time") task row in
 * the S2 day map (ScenifyDraft) and the S3 timeline (DailyLog).
 *
 * Reuses the EXACT route + payload the Daily Plan tab uses to create a calendar block
 * (DailyPlanItemRow.tsx:135-141): POST /api/operations/daily-plan/items/[itemId]/blocks
 * with { scheduled_start, scheduled_end } as ISO datetimes (+ allow_conflicts on the
 * 409 overlap retry). Zero new write paths; auth unchanged.
 *
 * The day's date is fixed (the row's day), so this uses two compact <input type=time>
 * and composes ISO from `${date}T${HH:MM}` (local) — same instants the Daily Plan form
 * produces. On success it dispatches CONTENT_DAY_PLAN_CHANGED_EVENT so S2/S3 re-read
 * and re-sort the task into its clock position immediately; this row then unmounts
 * (it becomes a timed block).
 */

'use client';

import { useState } from 'react';
import { CONTENT_DAY_PLAN_CHANGED_EVENT } from './ScenifyModal';

export default function TaskTimeCommit({ itemId, date }: { itemId: string; date: string }) {
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('10:00');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  const inputClass =
    'px-1.5 py-0.5 bg-white border border-brand-purple/40 rounded text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple';

  const commit = async (allowConflicts: boolean) => {
    if (saving) return;
    const startAt = new Date(`${date}T${start}`);
    const endAt = new Date(`${date}T${end}`);
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      setError('Invalid time');
      return;
    }
    if (endAt.getTime() <= startAt.getTime()) {
      setError('End must be after start');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body: { scheduled_start: string; scheduled_end: string; allow_conflicts?: boolean } = {
        scheduled_start: startAt.toISOString(),
        scheduled_end: endAt.toISOString(),
      };
      if (allowConflicts) body.allow_conflicts = true;
      const res = await fetch(`/api/operations/daily-plan/items/${itemId}/blocks`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.status === 409) {
        setConflict(true);
        setError('Overlaps another block.');
        setSaving(false);
        return;
      }
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.message ?? b?.error ?? `failed (${res.status})`);
      }
      // The day's plan changed — S2/S3 re-read + re-sort; this row becomes timed.
      window.dispatchEvent(new Event(CONTENT_DAY_PLAN_CHANGED_EVENT));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to commit time');
      setSaving(false);
    }
  };

  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <label className="flex items-center gap-1 text-brand-purple font-medium">
        start
        <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={inputClass} />
      </label>
      <label className="flex items-center gap-1 text-brand-purple font-medium">
        end
        <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={inputClass} />
      </label>
      <button
        type="button"
        onClick={() => commit(false)}
        disabled={saving}
        className="px-2 py-0.5 border border-brand-purple bg-brand-purple text-white rounded hover:opacity-90 disabled:opacity-50"
      >
        {saving ? 'committing…' : 'commit time'}
      </button>
      {conflict && (
        <button
          type="button"
          onClick={() => commit(true)}
          disabled={saving}
          className="px-2 py-0.5 border border-amber-400 text-amber-700 rounded hover:bg-amber-50 disabled:opacity-50"
        >
          schedule anyway
        </button>
      )}
      {error && <span className="text-red-700">{error}</span>}
    </span>
  );
}
