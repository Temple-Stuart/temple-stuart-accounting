/**
 * useTaskActions — every action on ONE task, in one home (PROJECTS-01, 2026-09-30).
 *
 * Moved verbatim out of TaskRow.tsx (its handlers :110-351 and the state they
 * drive) so the task row and the projects table fire the SAME handlers — never
 * a copied fetch. The fetches, in order: PATCH save · GET history · POST
 * schedule · DELETE · PATCH archive · PATCH unarchive · PATCH accept/reject
 * (pending_review → open / cancelled) — and, at the foot of the file, the two
 * the handlers call as plain writers: PATCH quick-complete · POST uncomplete.
 * WORK-02 (Alex, 2026-10-26): those two are LIFTED there (completeTask,
 * uncompleteTask), not copied, so THE WORK BLOCK on the day card fires the
 * same writer the task row does; the hook's handlers keep their names and
 * their chrome (the busy flag, the error, the reason prompt, the alert).
 *
 * Whether the edit inputs and the history are open is the CALLER's state
 * (`editing` / `showHistory`): the row holds it itself; the table holds it per
 * task, because the project cell spans the rows those two open.
 */

'use client';

import { useState } from 'react';
import type { TaskStatusHistoryRow } from './TaskRowView';
import type { Task, TaskForm } from './types';


export function taskToForm(t: Task): TaskForm {
  return {
    title: t.title,
    description: t.description ?? '',
    status: t.status,
    estimated_minutes: t.estimated_minutes !== null ? String(t.estimated_minutes) : '',
    estimated_cost_usd: t.estimated_cost_usd ?? '',
    deadline: t.deadline ? t.deadline.slice(0, 10) : '',
    unblocks_label: t.unblocks_label ?? '',
    link_url: t.link_url ?? '',
    notes: t.notes ?? '',
    coa_code: t.coa_code ?? '',
    actual_minutes: t.actual_minutes !== null ? String(t.actual_minutes) : '',
    actual_cost_usd: t.actual_cost_usd ?? '',
  };
}

export interface TaskActionsInput {
  task: Task;
  projectId: string;
  onUpdate: () => void;
  onDelete: () => void;
  editing: boolean;
  setEditing: (on: boolean) => void;
  showHistory: boolean;
  setShowHistory: (on: boolean) => void;
}

export function useTaskActions({ task, projectId, onUpdate, onDelete, editing, setEditing, showHistory, setShowHistory }: TaskActionsInput) {
  const [form, setForm] = useState<TaskForm>(() => taskToForm(task));
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  // EXEC-2: a positive note shown after accepting a pending task (the build fired).
  const [reviewNotice, setReviewNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<TaskStatusHistoryRow[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const [scheduleMenuOpen, setScheduleMenuOpen] = useState(false);

  /**
   * Default for the schedule date picker. Uses task.deadline (matching the
   * edit-form's deadline.slice(0,10) extraction at taskToForm above) so the
   * user doesn't re-enter the date they already typed when setting the
   * deadline. Falls back to today's UTC date when no deadline is set.
   * PR-Ops-5.4.
   */
  const defaultScheduleDate = (): string =>
    task.deadline ? task.deadline.slice(0, 10) : new Date().toISOString().slice(0, 10);

  const [scheduleDate, setScheduleDate] = useState<string>(defaultScheduleDate);

  /**
   * Toggle the schedule menu. On open (false → true) re-sync the date
   * picker to the current deadline so a deadline edit after first render
   * is honored. Close path keeps the existing toggle semantic (clicking
   * ↗ schedule while open closes the menu).
   */
  const toggleScheduleMenu = () => {
    if (!scheduleMenuOpen) {
      setScheduleDate(defaultScheduleDate());
    }
    setScheduleMenuOpen((x) => !x);
  };
  const [scheduleSuccess, setScheduleSuccess] = useState<string | null>(null);

  const enterEdit = () => {
    setForm(taskToForm(task));
    setEditing(true);
    setError(null);
  };

  const cancelEdit = () => {
    setForm(taskToForm(task));
    setEditing(false);
    setError(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/operations/projects/${projectId}/tasks/${task.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        }
      );
      const body = await res.json();
      if (!res.ok) {
        setError(body?.message ?? body?.error ?? 'failed to save');
        return;
      }
      setEditing(false);
      onUpdate();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickComplete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setCompleting(true);
    setError(null);
    try {
      // WORK-02: the one writer, lifted (completeTask below).
      const answer = await completeTask(projectId, task.id);
      if (!answer.ok) {
        setError(answer.words);
        return;
      }
      onUpdate();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to complete');
    } finally {
      setCompleting(false);
    }
  };

  const handleToggleHistory = async () => {
    if (showHistory) {
      setShowHistory(false);
      return;
    }
    setShowHistory(true);
    if (history !== null) return; // already loaded
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await fetch(
        `/api/operations/projects/${projectId}/tasks/${task.id}/history`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      setHistory(body.history ?? []);
    } catch (e) {
      setHistoryError(e instanceof Error ? e.message : 'Failed to load history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleUncomplete = async () => {
    const reason = window.prompt('Reason for uncompleting? (optional)') ?? undefined;
    try {
      // WORK-02: the one writer, lifted (uncompleteTask below).
      const answer = await uncompleteTask(projectId, task.id, reason || undefined);
      if (!answer.ok) throw new Error(answer.words);
      onUpdate();
      // Invalidate cached history so the new row shows on next open.
      setHistory(null);
    } catch (e) {
      alert(`Uncomplete failed: ${e instanceof Error ? e.message : 'unknown error'}`);
    }
  };

  const handleSchedule = async (targetDate: string) => {
    setScheduling(true);
    setError(null);
    try {
      const res = await fetch('/api/operations/daily-plan/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_date: targetDate,
          task_id: task.id,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? body.error ?? `HTTP ${res.status}`);
      }
      setScheduleSuccess(`scheduled for ${targetDate}`);
      setScheduleMenuOpen(false);
      // Auto-clear success message after 4 seconds.
      setTimeout(() => setScheduleSuccess(null), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to schedule task');
    } finally {
      setScheduling(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete task "${task.title}"?`)) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/operations/projects/${projectId}/tasks/${task.id}`,
        { method: 'DELETE' }
      );
      const body = await res.json();
      if (!res.ok) {
        setError(body?.message ?? body?.error ?? 'failed to delete');
        return;
      }
      onDelete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  // Soft archive: hide an out-of-scope task from active views; history preserved
  // (distinct from delete). PATCH to 'archived' rides the existing task status
  // flow (status-history row + audit). Unarchive restores to 'open'.
  const handleArchive = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (
      !confirm(
        `Archive task "${task.title}"? It is hidden from active views but its history is preserved. (This is NOT delete — nothing is destroyed; restore it later via "show archived".)`
      )
    )
      return;
    setArchiving(true);
    setError(null);
    try {
      const res = await fetch(`/api/operations/projects/${projectId}/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'archived' }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.message ?? body?.error ?? 'failed to archive');
        return;
      }
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to archive');
    } finally {
      setArchiving(false);
    }
  };

  const handleUnarchive = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setArchiving(true);
    setError(null);
    try {
      const res = await fetch(`/api/operations/projects/${projectId}/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'open' }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.message ?? body?.error ?? 'failed to unarchive');
        return;
      }
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to unarchive');
    } finally {
      setArchiving(false);
    }
  };

  // PHASE2-4: accept/reject an auto-fired pending_review task. Reuses the existing
  // PATCH status flow (status-history + audit). Accept → 'open' (becomes a live
  // task); reject → 'cancelled'. No new endpoint, no new paid path.
  const patchReviewStatus = async (
    e: React.MouseEvent,
    newStatus: 'open' | 'cancelled',
    verb: string
  ) => {
    e.stopPropagation();
    if (newStatus === 'cancelled' && !confirm(`Reject auto-generated task "${task.title}"? It is marked cancelled (history preserved).`)) {
      return;
    }
    setReviewing(true);
    setError(null);
    setReviewNotice(null);
    try {
      const res = await fetch(`/api/operations/projects/${projectId}/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const body = await res.json();
      if (!res.ok) {
        // EXEC-2: a 502 here is the build-fire failure (e.g. cap reached) — surfaced,
        // not swallowed. The status change already committed; the build didn't start.
        setError(body?.message ?? body?.error ?? `failed to ${verb}`);
        return;
      }
      // EXEC-2: accepting fired the Execute-Task Routine (build → PR, async).
      if (newStatus === 'open') setReviewNotice('building… PR incoming');
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : `failed to ${verb}`);
    } finally {
      setReviewing(false);
    }
  };
  const handleAcceptPending = (e: React.MouseEvent) => patchReviewStatus(e, 'open', 'accept');
  const handleRejectPending = (e: React.MouseEvent) => patchReviewStatus(e, 'cancelled', 'reject');

  return {
    editing,
    showHistory,
    form, setForm,
    saving, completing, deleting, archiving, reviewing, reviewNotice, error,
    history, historyLoading, historyError,
    scheduling, scheduleMenuOpen, scheduleDate, setScheduleDate, scheduleSuccess,
    toggleScheduleMenu,
    closeScheduleMenu: () => setScheduleMenuOpen(false),
    enterEdit, cancelEdit,
    handleSave, handleQuickComplete, handleToggleHistory, handleUncomplete, handleSchedule,
    handleDelete, handleArchive, handleUnarchive, handleAcceptPending, handleRejectPending,
  };
}

export type TaskActions = ReturnType<typeof useTaskActions>;

// ── WORK-02 (Alex, 2026-10-26): THE TWO WRITERS, LIFTED ──────────────────────
//
// The quick-complete and the uncomplete as plain writers — moved VERBATIM out of
// the two handlers above (which call them now), so THE WORK BLOCK on the day
// card (stops/WorkBlock.tsx) fires the SAME fetch the task row does: one writer
// per action, never a copied fetch. Each answers ok, or the route's own words.

export type TaskWriteAnswer = { readonly ok: true } | { readonly ok: false; readonly words: string };

/** PATCH …/tasks/<id> { status: 'completed' } — the route sets completed_at = now. */
export async function completeTask(projectId: string, taskId: string): Promise<TaskWriteAnswer> {
  const res = await fetch(
    `/api/operations/projects/${projectId}/tasks/${taskId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    }
  );
  const body = await res.json();
  if (!res.ok) return { ok: false, words: body?.message ?? body?.error ?? 'failed to complete' };
  return { ok: true };
}

/** POST …/tasks/<id>/uncomplete { reason? } — the route sets status open and clears completed_at. */
export async function uncompleteTask(projectId: string, taskId: string, reason: string | undefined): Promise<TaskWriteAnswer> {
  const res = await fetch(
    `/api/operations/projects/${projectId}/tasks/${taskId}/uncomplete`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    }
  );
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    return { ok: false, words: errBody.error ?? `HTTP ${res.status}` };
  }
  return { ok: true };
}
