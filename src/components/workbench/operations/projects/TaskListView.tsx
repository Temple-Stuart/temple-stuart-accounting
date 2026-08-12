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
 * LIVE <TaskRow surface={surface}> container; the public showroom injects the pure <TaskRowView surface={surface}>.
 * The view owns only the list wrapper, header, create-form and empty/loading
 * states — never a row's data source — so when fed pure rows it is fetch-free.
 */

'use client';

import { Fragment } from 'react';
import type { Task, TaskForm, CoaAccountSummary } from './types';
import { themed, type Surface } from '@/lib/ds';

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
  // Authed → live <TaskRow surface={surface}> containers; showroom → pure <TaskRowView surface={surface}> rows.
  // `index` is the 1-based display index (this view passes `i + 1`, unchanged).
  renderTaskRow: (task: Task, index: number) => React.ReactNode;
}

export default function TaskListView({ surface = 'light',
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
  renderTaskRow,
}: TaskListViewProps & { surface?: Surface }) {
  const dk = surface === 'dark';
  const inputClass =
    themed('w-full px-2 py-1 border border-border rounded text-xs text-text-primary focus:outline-none focus:border-brand-purple', dk);
  const labelClass = themed('text-text-faint uppercase tracking-wide mb-1 text-xs', dk);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs">
          <span className={themed('text-text-muted', dk)}>
            {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
          </span>
          <label className="flex items-center gap-1 cursor-pointer" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => onShowArchivedChange(e.target.checked)}
            />
            <span className={themed('text-text-muted', dk)}>show archived</span>
          </label>
        </div>
        {!showCreate && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onStartCreate(); }}
            className={`px-2 py-1 border text-white rounded text-xs hover:opacity-90 ${dk ? 'border-brand-purple-pop bg-brand-purple-pop' : 'border-brand-purple bg-brand-purple'}`}
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
        <div className={themed('border border-border rounded p-3 bg-white text-xs space-y-3', dk)}>
          <div className={themed('font-bold text-text-primary', dk)}>new task</div>
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
          <div className={themed('flex items-center gap-2 pt-2 border-t border-border-light', dk)}>
            <button
              type="button"
              onClick={onCreate}
              disabled={createSaving}
              className={`px-3 py-1 border text-white rounded hover:opacity-90 disabled:opacity-50 ${dk ? 'border-brand-purple-pop bg-brand-purple-pop' : 'border-brand-purple bg-brand-purple'}`}
            >
              {createSaving ? 'creating…' : 'create task'}
            </button>
            <button
              type="button"
              onClick={onCancelCreate}
              disabled={createSaving}
              className={themed('px-3 py-1 border border-border rounded hover:bg-bg-row disabled:opacity-50', dk)}
            >
              cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className={themed('text-xs text-text-muted', dk)}>loading tasks…</div>
      ) : tasks.length === 0 ? (
        <div className={themed('text-xs text-text-muted italic', dk)}>
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
