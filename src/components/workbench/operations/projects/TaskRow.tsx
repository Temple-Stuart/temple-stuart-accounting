/**
 * TaskRow — the LIVE, authed container for a single task row.
 *
 * PR4 split: this file keeps the EXACT live behavior it had before — all 8
 * fetches (PATCH save / PATCH quick-complete / GET history / POST uncomplete /
 * POST schedule / DELETE / PATCH archive / PATCH unarchive) plus every UI toggle
 * — and now renders the pure <TaskRowView/> with the live data + the 8 real
 * handlers wired to its callbacks. The public name + prop shape
 * ({ task, projectId, index, coaAccounts, onUpdate, onDelete }) are unchanged,
 * so the existing call site (TaskListView.tsx:212) is untouched and
 * /operations/projects behaves identically. NO new behavior, NO demo data.
 *
 * Three modes (mirrors ProjectRow's pattern at task scale):
 *   1. Compact: index + title + status pill + deadline + "complete" quick action
 *   2. Expanded: + description + unblocks_label + estimates + completed_at
 *   3. Edit: inline form for all writable fields
 */

'use client';

import { useState } from 'react';
import TaskRowView, { type TaskStatusHistoryRow } from './TaskRowView';
import type { Task, TaskForm, CoaAccountSummary } from './types';

interface Props {
  task: Task;
  projectId: string;
  index: number; // 1-based display index
  coaAccounts: CoaAccountSummary[];
  onUpdate: () => void;
  onDelete: () => void;
}

function taskToForm(t: Task): TaskForm {
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

export default function TaskRow({ task, projectId, index, coaAccounts, onUpdate, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<TaskForm>(() => taskToForm(task));
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
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
      const res = await fetch(
        `/api/operations/projects/${projectId}/tasks/${task.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'completed' }),
        }
      );
      const body = await res.json();
      if (!res.ok) {
        setError(body?.message ?? body?.error ?? 'failed to complete');
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
      const res = await fetch(
        `/api/operations/projects/${projectId}/tasks/${task.id}/uncomplete`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: reason || undefined }),
        }
      );
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error ?? `HTTP ${res.status}`);
      }
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
    try {
      const res = await fetch(`/api/operations/projects/${projectId}/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.message ?? body?.error ?? `failed to ${verb}`);
        return;
      }
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : `failed to ${verb}`);
    } finally {
      setReviewing(false);
    }
  };
  const handleAcceptPending = (e: React.MouseEvent) => patchReviewStatus(e, 'open', 'accept');
  const handleRejectPending = (e: React.MouseEvent) => patchReviewStatus(e, 'cancelled', 'reject');

  return (
    <TaskRowView
      task={task}
      index={index}
      coaAccounts={coaAccounts}
      expanded={expanded}
      editing={editing}
      notesOpen={notesOpen}
      scheduleMenuOpen={scheduleMenuOpen}
      form={form}
      scheduleDate={scheduleDate}
      saving={saving}
      completing={completing}
      deleting={deleting}
      archiving={archiving}
      scheduling={scheduling}
      error={error}
      scheduleSuccess={scheduleSuccess}
      showHistory={showHistory}
      history={history}
      historyLoading={historyLoading}
      historyError={historyError}
      onToggleExpanded={() => setExpanded((x) => !x)}
      onToggleNotes={() => setNotesOpen((x) => !x)}
      onEnterEdit={enterEdit}
      onCancelEdit={cancelEdit}
      onFormChange={setForm}
      onToggleScheduleMenu={toggleScheduleMenu}
      onCloseScheduleMenu={() => setScheduleMenuOpen(false)}
      onScheduleDateChange={setScheduleDate}
      onSave={handleSave}
      onQuickComplete={handleQuickComplete}
      onToggleHistory={handleToggleHistory}
      onUncomplete={handleUncomplete}
      onSchedule={handleSchedule}
      onDelete={handleDelete}
      onArchive={handleArchive}
      onUnarchive={handleUnarchive}
      reviewing={reviewing}
      onAcceptPending={handleAcceptPending}
      onRejectPending={handleRejectPending}
    />
  );
}
