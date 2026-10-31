/**
 * TaskListView — the PURE, props-only render of a project's task list.
 *
 * Extracted from TaskList (PR1). It owns NO data: no fetch, no /api/* call, no
 * data-loading useEffect, no context (useOperationsEntity), no server import.
 * It is FULLY CONTROLLED — every piece of data and every action arrives as a
 * prop, so the parent (the TaskList container) owns all behavior. The rendered
 * markup is byte-for-byte equivalent to the pre-extraction TaskList output.
 *
 * The per-task rows are NOT rendered by this view directly — they arrive via the
 * `renderTaskRow` render-prop (PR7b). The authed TaskList container injects the
 * LIVE <TaskRow> container; the public showroom injects the pure <TaskRowView>.
 * The view owns only the list wrapper, header, create-form and empty/loading
 * states — never a row's data source — so when fed pure rows it is fetch-free.
 */

'use client';

import { Fragment } from 'react';
import type { Task, TaskForm, CoaAccountSummary } from './types';
import TaskCreateInputs from './TaskCreateInputs';


export interface TaskListViewProps {
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
  // ── Injected row slot (PR7b) ────────────────────────────────────────────────
  // Each row's data source is the slot-builder's concern, never this view's.
  // Authed → live <TaskRow> containers; showroom → pure <TaskRowView> rows.
  // `index` is the 1-based display index (this view passes `i + 1`, unchanged).
  renderTaskRow: (task: Task, index: number) => React.ReactNode;
}

export default function TaskListView({ tasks,
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
  renderTaskRow,
}: TaskListViewProps & { }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs">
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
            className={`px-2 py-1 border text-white rounded text-xs hover:opacity-90 ${'border-brand-purple bg-brand-purple'}`}
          >
            + add task
          </button>
        )}
      </div>

      {error && (
        <div className="text-xs px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800">
          {error}
        </div>
      )}

      {showCreate && (
        <TaskCreateInputs
          createForm={createForm}
          createSaving={createSaving}
          createError={createError}
          coaAccounts={coaAccounts}
          onCreateFormChange={onCreateFormChange}
          onCreate={onCreate}
          onCancelCreate={onCancelCreate}
        />
      )}

      {loading ? (
        <div className="text-xs text-text-muted">loading tasks…</div>
      ) : tasks.length === 0 ? (
        <div className="text-xs text-text-muted italic">
          no tasks yet — click "+ add task" to break this project down into atomic execution units.
        </div>
      ) : (
        <div className="space-y-1.5">
          {tasks.map((t, i) => (
            <Fragment key={t.id}>{renderTaskRow(t, i + 1)}</Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
