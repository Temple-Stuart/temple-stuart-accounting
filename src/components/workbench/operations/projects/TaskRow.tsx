/**
 * TaskRow — single task in a project's task list.
 *
 * Three modes (mirrors ProjectRow's pattern at task scale):
 *   1. Compact: index + title + status pill + deadline + "complete" quick action
 *   2. Expanded: + description + unblocks_label + estimates + completed_at
 *   3. Edit: inline form for all writable fields
 *
 * Click row body → toggle expand. "complete" quick-action button (when status
 * !== 'completed') → single-click sets status to 'completed', server writes
 * operations_project_task_completed audit + completed_at timestamp.
 */

'use client';

import { useState } from 'react';
import type { Task, TaskForm, TaskStatus } from './types';
import { TASK_STATUS_LABELS, TASK_STATUS_PILL_CLASSES } from './types';

interface Props {
  task: Task;
  projectId: string;
  index: number; // 1-based display index
  onUpdate: () => void;
  onDelete: () => void;
}

const STATUS_OPTIONS: TaskStatus[] = [
  'open',
  'in_progress',
  'blocked',
  'completed',
  'cancelled',
];

function taskToForm(t: Task): TaskForm {
  return {
    title: t.title,
    description: t.description ?? '',
    status: t.status,
    estimated_minutes: t.estimated_minutes !== null ? String(t.estimated_minutes) : '',
    estimated_cost_usd: t.estimated_cost_usd ?? '',
    deadline: t.deadline ? t.deadline.slice(0, 10) : '',
    unblocks_label: t.unblocks_label ?? '',
  };
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function TaskRow({ task, projectId, index, onUpdate, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<TaskForm>(() => taskToForm(task));
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const inputClass =
    'w-full px-2 py-1 border border-border rounded text-xs font-mono text-text-primary focus:outline-none focus:border-brand-purple';
  const labelClass = 'text-text-faint uppercase tracking-wide mb-1 text-xs font-mono';
  const pillClass = `inline-block px-2 py-0.5 border rounded text-xs font-mono ${TASK_STATUS_PILL_CLASSES[task.status]}`;

  return (
    <div className="border border-border-light rounded bg-white">
      <div
        className="flex items-center justify-between px-3 py-1.5 cursor-pointer hover:bg-bg-row text-xs font-mono"
        onClick={() => !editing && setExpanded((x) => !x)}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-text-faint shrink-0 w-6 text-right">{index}.</span>
          <span className="text-text-faint">{expanded ? '▾' : '▸'}</span>
          <span
            className={
              task.status === 'completed' || task.status === 'cancelled'
                ? 'text-text-muted line-through truncate'
                : 'text-text-primary truncate'
            }
          >
            {task.title}
          </span>
          <span className={pillClass}>{TASK_STATUS_LABELS[task.status]}</span>
          {task.deadline && (
            <span className="text-text-muted">due {formatDate(task.deadline)}</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {task.status !== 'completed' && task.status !== 'cancelled' && (
            <button
              type="button"
              onClick={handleQuickComplete}
              disabled={completing}
              className="px-2 py-0.5 border border-green-300 text-green-800 rounded hover:bg-green-50 disabled:opacity-50 text-xs font-mono"
              title="Mark task as completed"
            >
              {completing ? '…' : '✓ complete'}
            </button>
          )}
        </div>
      </div>

      {expanded && !editing && (
        <div className="px-4 py-2 border-t border-border-light text-xs font-mono space-y-2">
          {error && (
            <div className="px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800">
              {error}
            </div>
          )}
          {task.description ? (
            <div>
              <div className={labelClass}>description</div>
              <div className="text-text-primary whitespace-pre-wrap">{task.description}</div>
            </div>
          ) : (
            <div className="text-text-muted italic">no description</div>
          )}

          {task.unblocks_label && (
            <div>
              <div className={labelClass}>unblocks</div>
              <div className="text-text-primary whitespace-pre-wrap">{task.unblocks_label}</div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border-light">
            <div>
              <div className={labelClass}>est. minutes</div>
              <div className="text-text-primary">{task.estimated_minutes ?? '—'}</div>
            </div>
            <div>
              <div className={labelClass}>est. cost (usd)</div>
              <div className="text-text-primary">{task.estimated_cost_usd ?? '—'}</div>
            </div>
            <div>
              <div className={labelClass}>completed at</div>
              <div className="text-text-primary">{formatDate(task.completed_at)}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-border-light">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); enterEdit(); }}
              className="px-2 py-1 border border-border rounded hover:bg-bg-row"
            >
              edit
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="px-2 py-1 border border-red-300 text-red-700 rounded hover:bg-red-50 disabled:opacity-50"
            >
              {deleting ? 'deleting…' : 'delete'}
            </button>
          </div>
        </div>
      )}

      {editing && (
        <div className="px-4 py-3 border-t border-border-light text-xs font-mono space-y-3">
          {error && (
            <div className="px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <div className={labelClass}>title</div>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className={inputClass}
                maxLength={500}
              />
            </div>
            <div>
              <div className={labelClass}>status</div>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as TaskStatus })}
                className={inputClass}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {TASK_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className={labelClass}>deadline</div>
              <input
                type="date"
                value={form.deadline}
                onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <div className={labelClass}>description</div>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className={inputClass}
              placeholder="what does this task entail?"
            />
          </div>

          <div>
            <div className={labelClass}>unblocks (rationale for priority engine)</div>
            <textarea
              value={form.unblocks_label}
              onChange={(e) => setForm({ ...form, unblocks_label: e.target.value })}
              rows={2}
              className={inputClass}
              placeholder="what does completing this unblock? — fed to the priority ranker (PR-Ops-4)"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className={labelClass}>est. minutes</div>
              <input
                type="number"
                min={0}
                value={form.estimated_minutes}
                onChange={(e) => setForm({ ...form, estimated_minutes: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <div className={labelClass}>est. cost (usd)</div>
              <input
                type="text"
                value={form.estimated_cost_usd}
                onChange={(e) => setForm({ ...form, estimated_cost_usd: e.target.value })}
                className={inputClass}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-border-light">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1 border border-brand-purple bg-brand-purple text-white rounded hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'saving…' : 'save'}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={saving}
              className="px-3 py-1 border border-border rounded hover:bg-bg-row disabled:opacity-50"
            >
              cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
