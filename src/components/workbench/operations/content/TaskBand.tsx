/**
 * TaskBand — the shared task-row band (S2 day map + S3 timeline), fully legible
 * (CE-8F) and now the task LIFECYCLE surface (OPS-CE-8G), inline / flat-law:
 *
 *   • PLANNED (no block)     → inline commit form (TaskTimeCommit, CE-8E).
 *   • COMMITTED (block, not done) → TIME label + [edit time] · [uncommit] · [✓ mark done].
 *       - edit time  → PATCH /daily-plan/blocks/[blockId] { scheduled_* } (409→allow_conflicts).
 *       - uncommit   → DELETE /daily-plan/blocks/[blockId] (inline confirm) → back to planned.
 *       - mark done  → actuals (prefilled scheduled, editable) → PATCH block
 *                      { actual_*, status:'completed' } THEN PATCH the task
 *                      { status:'completed' } (the EXISTING task-status flow: status
 *                      history + completed_at + audit). commit ≠ completion — DONE is explicit.
 *   • DONE (block completed) → permanent "✓ DONE · {actual times}" record; no actions.
 *
 * Every mutation dispatches CONTENT_DAY_PLAN_CHANGED_EVENT so S1/S2/S3 refresh: the
 * done task leaves the to-do pool and flips to ✓ in the map in one click. All routes
 * are EXISTING Daily Plan / project-task routes; auth unchanged; 0-schema.
 */

'use client';

import { useState } from 'react';
import { CONTENT_DAY_PLAN_CHANGED_EVENT } from './ScenifyModal';
import TaskTimeCommit from './TaskTimeCommit';

const fieldLabel = 'text-brand-purple uppercase tracking-wide text-[10px] font-medium';
const timeInput =
  'px-1.5 py-0.5 bg-white border border-brand-purple/40 rounded text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple';
const btn = 'px-2 py-0.5 border rounded disabled:opacity-50';

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-0.5 ${className ?? ''}`}>
      <span className={fieldLabel}>{label}</span>
      {children}
    </div>
  );
}

// ISO instant → local "HH:MM" for prefilling time inputs.
const isoToTime = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

type Mode = 'view' | 'edit' | 'uncommit' | 'remove' | 'done';

export default function TaskBand({
  date,
  planned,
  itemId,
  blockId,
  taskId,
  projectId,
  title,
  projectName,
  status,
  scheduledStart,
  scheduledEnd,
  timeLabel,
}: {
  date: string;
  planned: boolean;
  itemId: string;
  blockId: string | null;
  taskId: string | null;
  projectId: string | null;
  title: string;
  projectName: string | null;
  status: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  actualStart?: string | null;
  actualEnd?: string | null;
  timeLabel: string;
}) {
  const done = status === 'completed';
  const [mode, setMode] = useState<Mode>('view');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  const open = (m: Mode) => {
    setStart(isoToTime(scheduledStart) || '09:00');
    setEnd(isoToTime(scheduledEnd) || '10:00');
    setError(null);
    setConflict(false);
    setMode(m);
  };

  const fail = (e: unknown, fallback: string) => setError(e instanceof Error ? e.message : fallback);
  const done2 = () => {
    window.dispatchEvent(new Event(CONTENT_DAY_PLAN_CHANGED_EVENT));
  };

  // Validate the two time inputs against the day; returns ISO strings or null.
  const toIso = (): { startIso: string; endIso: string } | null => {
    const s = new Date(`${date}T${start}`);
    const e = new Date(`${date}T${end}`);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
      setError('Invalid time');
      return null;
    }
    if (e.getTime() <= s.getTime()) {
      setError('End must be after start');
      return null;
    }
    return { startIso: s.toISOString(), endIso: e.toISOString() };
  };

  const saveEdit = async (allowConflicts: boolean) => {
    if (busy || !blockId) return;
    const iso = toIso();
    if (!iso) return;
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { scheduled_start: iso.startIso, scheduled_end: iso.endIso };
      if (allowConflicts) body.allow_conflicts = true;
      const res = await fetch(`/api/operations/daily-plan/blocks/${blockId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.status === 409) {
        setConflict(true);
        setError('Overlaps another block.');
        setBusy(false);
        return;
      }
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message ?? `failed (${res.status})`);
      setMode('view');
      done2();
    } catch (e) {
      fail(e, 'failed to update time');
      setBusy(false);
    }
  };

  const uncommit = async () => {
    if (busy || !blockId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/operations/daily-plan/blocks/${blockId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message ?? `failed (${res.status})`);
      done2(); // the row becomes planned again (re-read)
    } catch (e) {
      fail(e, 'failed to uncommit');
      setBusy(false);
    }
  };

  // Remove the whole piece from the day via the EXISTING item DELETE route. The
  // route cascade-deletes any calendar block (daily-plan/items/[itemId]/route.ts:
  // 192-196), so it works for both a planned piece (no block) and a committed one.
  // DONE pieces never reach this — they render the permanent record branch with no
  // actions. Same refresh + error affordance as uncommit; the row leaves the day.
  const removeFromDay = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/operations/daily-plan/items/${itemId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message ?? `failed (${res.status})`);
      done2(); // the row leaves the day (re-read via CONTENT_DAY_PLAN_CHANGED_EVENT)
    } catch (e) {
      fail(e, 'failed to remove from day');
      setBusy(false);
    }
  };

  // Shared confirm row for "remove from day" — used by both the planned branch and
  // the committed default view (one source).
  const removeConfirm = (
    <span className="flex flex-wrap items-center gap-1.5">
      <span className="text-text-muted">Remove this task from the day?</span>
      <button type="button" onClick={removeFromDay} disabled={busy} className={`${btn} border-red-300 text-red-700 hover:bg-red-50`}>
        {busy ? 'removing…' : 'remove from day'}
      </button>
      <button type="button" onClick={() => setMode('view')} disabled={busy} className={`${btn} border-border text-text-muted hover:bg-bg-row`}>
        cancel
      </button>
    </span>
  );

  const markDone = async () => {
    if (busy || !blockId) return;
    const iso = toIso();
    if (!iso) return;
    setBusy(true);
    setError(null);
    try {
      // 1) the block: actuals + completed.
      const blockRes = await fetch(`/api/operations/daily-plan/blocks/${blockId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actual_start: iso.startIso, actual_end: iso.endIso, status: 'completed' }),
      });
      if (!blockRes.ok) throw new Error((await blockRes.json().catch(() => ({})))?.message ?? `block failed (${blockRes.status})`);
      // 2) the task: completed via the EXISTING task-status flow (status history +
      //    completed_at + audit). Skipped for ad-hoc items (no task).
      if (taskId && projectId) {
        const taskRes = await fetch(`/api/operations/projects/${projectId}/tasks/${taskId}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'completed' }),
        });
        if (!taskRes.ok) throw new Error((await taskRes.json().catch(() => ({})))?.message ?? `task failed (${taskRes.status})`);
      }
      setMode('view');
      done2();
    } catch (e) {
      fail(e, 'failed to mark done');
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-start gap-x-5 gap-y-2">
      <span className={done ? 'text-brand-purple mt-4' : 'text-amber-700 mt-4'} aria-hidden="true">
        {done ? '✓' : '▦'}
      </span>

      <Field label="time">
        {planned && !blockId ? (
          mode === 'remove' ? (
            removeConfirm
          ) : (
            <span className="flex flex-wrap items-center gap-2">
              <TaskTimeCommit itemId={itemId} date={date} />
              <button
                type="button"
                onClick={() => setMode('remove')}
                className={`${btn} border-border text-text-muted hover:bg-bg-row`}
              >
                remove from day
              </button>
            </span>
          )
        ) : done ? (
          <span className="text-text-primary font-medium tabular-nums whitespace-nowrap">✓ DONE · {timeLabel}</span>
        ) : mode === 'edit' || mode === 'done' ? (
          <span className="flex flex-wrap items-center gap-1.5">
            <label className="flex items-center gap-1 text-brand-purple font-medium">
              {mode === 'done' ? 'actual start' : 'start'}
              <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={timeInput} />
            </label>
            <label className="flex items-center gap-1 text-brand-purple font-medium">
              {mode === 'done' ? 'actual end' : 'end'}
              <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={timeInput} />
            </label>
            <button
              type="button"
              onClick={() => (mode === 'done' ? markDone() : saveEdit(false))}
              disabled={busy}
              className={`${btn} border-brand-purple bg-brand-purple text-white hover:opacity-90`}
            >
              {busy ? 'saving…' : mode === 'done' ? 'confirm done' : 'save time'}
            </button>
            {conflict && mode === 'edit' && (
              <button
                type="button"
                onClick={() => saveEdit(true)}
                disabled={busy}
                className={`${btn} border-amber-400 text-amber-700 hover:bg-amber-50`}
              >
                schedule anyway
              </button>
            )}
            <button type="button" onClick={() => setMode('view')} disabled={busy} className={`${btn} border-border text-text-muted hover:bg-bg-row`}>
              cancel
            </button>
          </span>
        ) : mode === 'uncommit' ? (
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-text-muted">Remove the time? Returns to planned.</span>
            <button type="button" onClick={uncommit} disabled={busy} className={`${btn} border-red-300 text-red-700 hover:bg-red-50`}>
              {busy ? 'removing…' : 'remove'}
            </button>
            <button type="button" onClick={() => setMode('view')} disabled={busy} className={`${btn} border-border text-text-muted hover:bg-bg-row`}>
              cancel
            </button>
          </span>
        ) : mode === 'remove' ? (
          removeConfirm
        ) : (
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-text-primary font-medium tabular-nums whitespace-nowrap">{timeLabel}</span>
            <button type="button" onClick={() => open('edit')} className={`${btn} border-brand-purple text-brand-purple hover:bg-purple-100/50`}>
              edit time
            </button>
            <button type="button" onClick={() => setMode('uncommit')} className={`${btn} border-border text-text-muted hover:bg-bg-row`}>
              uncommit
            </button>
            <button type="button" onClick={() => setMode('remove')} className={`${btn} border-border text-text-muted hover:bg-bg-row`}>
              remove from day
            </button>
            <button type="button" onClick={() => open('done')} className={`${btn} border-brand-purple bg-brand-purple text-white hover:opacity-90`}>
              ✓ mark done
            </button>
          </span>
        )}
        {error && <span className="text-red-700 mt-0.5">{error}</span>}
      </Field>

      <Field label="task" className="min-w-[160px] flex-1">
        <span className="text-text-primary font-medium break-words">{title}</span>
      </Field>

      {projectName && (
        <Field label="project" className="min-w-[120px]">
          <span className="text-text-muted break-words">{projectName}</span>
        </Field>
      )}

      <Field label="status">
        <span
          className={`px-1.5 py-0.5 rounded border text-[10px] uppercase tracking-wide whitespace-nowrap ${
            done ? 'border-brand-purple bg-purple-50 text-brand-purple' : 'border-amber-300 bg-white text-amber-700'
          }`}
        >
          {status}
        </span>
      </Field>
    </div>
  );
}
