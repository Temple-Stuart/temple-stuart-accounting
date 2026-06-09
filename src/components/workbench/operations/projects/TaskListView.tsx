/**
 * TaskListView — the PURE, props-only render of a project's task list.
 *
 * Extracted from TaskList (PR1). It owns NO data: no fetch, no /api/* call, no
 * data-loading useEffect, no context (useOperationsEntity), no server import.
 * It is FULLY CONTROLLED — every piece of data and every action arrives as a
 * prop, so the parent (the TaskList container) owns all behavior. The rendered
 * markup is byte-for-byte equivalent to the pre-extraction TaskList output.
 */

'use client';

import TaskRow from './TaskRow';
import type { Task, TaskForm, CoaAccountSummary } from './types';

export interface TaskListViewProps {
  /** Threaded to each TaskRow (TaskRow needs the project id for its mutations). */
  projectId: string;
  // ── Data (loaded by the container) ──────────────────────────────────────────
  tasks: Task[];
  loading: boolean;
  error: string | null;
  coaAccounts: CoaAccountSummary[];
  showArchived: boolean;
  // ── Create-form state (owned by the container; this view is controlled) ─────
  showCreate: boolean;
  createForm: TaskForm;
  createSaving: boolean;
  createError: string | null;
  // ── Action callbacks (the container owns behavior) ──────────────────────────
  onShowArchivedChange: (next: boolean) => void;
  onStartCreate: () => void;
  onCancelCreate: () => void;
  onCreateFormChange: (form: TaskForm) => void;
  onCreate: () => void;
  /** Per-row refresh — the container re-fetches the task list. */
  onTaskUpdate: () => void;
  onTaskDelete: () => void;
}

export default function TaskListView({
  projectId,
  tasks,
  loading,
  error,
  coaAccounts,
  showArchived,
  showCreate,
  createForm,
  createSaving,
  createError,
  onShowArchivedChange,
  onStartCreate,
  onCancelCreate,
  onCreateFormChange,
  onCreate,
  onTaskUpdate,
  onTaskDelete,
}: TaskListViewProps) {
  const inputClass =
    'w-full px-2 py-1 border border-border rounded text-xs font-mono text-text-primary focus:outline-none focus:border-brand-purple';
  const labelClass = 'text-text-faint uppercase tracking-wide mb-1 text-xs font-mono';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="text-text-muted">
            {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
          </span>
          <label className="flex items-center gap-1 cursor-pointer" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => onShowArchivedChange(e.target.checked)}
            />
            <span className="text-text-muted">show archived</span>
          </label>
        </div>
        {!showCreate && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onStartCreate(); }}
            className="px-2 py-1 border border-brand-purple bg-brand-purple text-white rounded text-xs font-mono hover:opacity-90"
          >
            + add task
          </button>
        )}
      </div>

      {error && (
        <div className="text-xs font-mono px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800">
          {error}
        </div>
      )}

      {showCreate && (
        <div className="border border-brand-purple rounded p-3 bg-purple-50/30 text-xs font-mono space-y-3">
          <div className="font-bold text-text-primary">new task</div>
          {createError && (
            <div className="px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800">
              {createError}
            </div>
          )}
          <div>
            <div className={labelClass}>title</div>
            <input
              type="text"
              value={createForm.title}
              onChange={(e) => onCreateFormChange({ ...createForm, title: e.target.value })}
              className={inputClass}
              maxLength={500}
              placeholder="what is the atomic unit of work?"
            />
          </div>
          <div>
            <div className={labelClass}>description (optional)</div>
            <textarea
              value={createForm.description}
              onChange={(e) => onCreateFormChange({ ...createForm, description: e.target.value })}
              rows={2}
              className={inputClass}
              placeholder="more detail if the title isn't enough"
            />
          </div>
          <div>
            <div className={labelClass}>unblocks (optional — rationale for priority engine)</div>
            <textarea
              value={createForm.unblocks_label}
              onChange={(e) => onCreateFormChange({ ...createForm, unblocks_label: e.target.value })}
              rows={2}
              className={inputClass}
              placeholder="what does completing this unblock?"
            />
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <div className={labelClass}>deadline (optional)</div>
              <input
                type="date"
                value={createForm.deadline}
                onChange={(e) => onCreateFormChange({ ...createForm, deadline: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <div className={labelClass}>est. minutes (optional)</div>
              <input
                type="number"
                min={0}
                value={createForm.estimated_minutes}
                onChange={(e) => onCreateFormChange({ ...createForm, estimated_minutes: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <div className={labelClass}>est. cost usd (optional)</div>
              <input
                type="text"
                value={createForm.estimated_cost_usd}
                onChange={(e) => onCreateFormChange({ ...createForm, estimated_cost_usd: e.target.value })}
                className={inputClass}
                placeholder="0.00"
              />
            </div>
            <div>
              <div className={labelClass}>category (optional)</div>
              <select
                value={createForm.coa_code}
                onChange={(e) => onCreateFormChange({ ...createForm, coa_code: e.target.value })}
                className={inputClass}
              >
                <option value="">— None —</option>
                {coaAccounts.map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.code} · {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-border-light">
            <button
              type="button"
              onClick={onCreate}
              disabled={createSaving}
              className="px-3 py-1 border border-brand-purple bg-brand-purple text-white rounded hover:opacity-90 disabled:opacity-50"
            >
              {createSaving ? 'creating…' : 'create task'}
            </button>
            <button
              type="button"
              onClick={onCancelCreate}
              disabled={createSaving}
              className="px-3 py-1 border border-border rounded hover:bg-bg-row disabled:opacity-50"
            >
              cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-xs font-mono text-text-muted">loading tasks…</div>
      ) : tasks.length === 0 ? (
        <div className="text-xs font-mono text-text-muted italic">
          no tasks yet — click "+ add task" to break this project down into atomic execution units.
        </div>
      ) : (
        <div className="space-y-1.5">
          {tasks.map((t, i) => (
            <TaskRow
              key={t.id}
              task={t}
              projectId={projectId}
              index={i + 1}
              coaAccounts={coaAccounts}
              onUpdate={onTaskUpdate}
              onDelete={onTaskDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
