/**
 * TaskRowView — the PURE, props-only render of a single task row.
 *
 * Extracted from TaskRow (PR4). It owns NO data: no fetch, no /api/* call, no
 * data-loading useEffect, no context, no server import. It is FULLY CONTROLLED —
 * all data + UI state arrive as props, and every mutating action (the 8 fetches
 * that lived in TaskRow) plus the UI toggles are callback props, so the parent
 * (the TaskRow container) owns all behavior. The rendered markup is
 * byte-for-byte equivalent to the pre-extraction TaskRow output.
 *
 * The 8 action callbacks (each was a live fetch in TaskRow):
 *   onSave          → PATCH  /tasks/[id]        (full form)        [handleSave]
 *   onQuickComplete → PATCH  /tasks/[id]        ({status:completed})[handleQuickComplete]
 *   onToggleHistory → GET    /tasks/[id]/history (lazy load)        [handleToggleHistory]
 *   onUncomplete    → POST   /tasks/[id]/uncomplete                 [handleUncomplete]
 *   onSchedule      → POST   /daily-plan/items                      [handleSchedule]
 *   onDelete        → DELETE /tasks/[id]                            [handleDelete]
 *   onArchive       → PATCH  /tasks/[id]        ({status:archived}) [handleArchive]
 *   onUnarchive     → PATCH  /tasks/[id]        ({status:open})     [handleUnarchive]
 */

'use client';

import { ExternalLink } from 'lucide-react';
import type { Task, TaskForm, CoaAccountSummary } from './types';
import { TASK_STATUS_LABELS, TASK_STATUS_PILL_CLASSES } from './types';
import TaskScheduleMenu from './TaskScheduleMenu';
import TaskHistoryList from './TaskHistoryList';
import TaskEditInputs from './TaskEditInputs';


export type TaskStatusHistoryRow = {
  id: string;
  previous_status: string | null;
  new_status: string;
  changed_at: string;
  changed_by: string | null;
  reason: string | null;
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export interface TaskRowViewProps {
  task: Task;
  index: number; // 1-based display index
  coaAccounts: CoaAccountSummary[];
  // ── UI state (controlled by the container) ──────────────────────────────────
  expanded: boolean;
  editing: boolean;
  notesOpen: boolean;
  scheduleMenuOpen: boolean;
  form: TaskForm;
  scheduleDate: string;
  // ── Pending / feedback flags (set around the container's fetches) ───────────
  saving: boolean;
  completing: boolean;
  deleting: boolean;
  archiving: boolean;
  scheduling: boolean;
  error: string | null;
  scheduleSuccess: string | null;
  // ── History (lazy-loaded by the container) ──────────────────────────────────
  showHistory: boolean;
  history: TaskStatusHistoryRow[] | null;
  historyLoading: boolean;
  historyError: string | null;
  // ── UI toggle callbacks ─────────────────────────────────────────────────────
  onToggleExpanded: () => void;
  onToggleNotes: () => void;
  onEnterEdit: () => void;
  onCancelEdit: () => void;
  onFormChange: (form: TaskForm) => void;
  onToggleScheduleMenu: () => void;
  onCloseScheduleMenu: () => void;
  onScheduleDateChange: (date: string) => void;
  // ── The 8 action callbacks (each a live fetch in the container) ─────────────
  onSave: () => void;
  onQuickComplete: (e: React.MouseEvent) => void;
  onToggleHistory: () => void;
  onUncomplete: () => void;
  onSchedule: (targetDate: string) => void;
  onDelete: (e: React.MouseEvent) => void;
  onArchive: (e: React.MouseEvent) => void;
  onUnarchive: (e: React.MouseEvent) => void;
  // PHASE2-4: pending_review accept/reject (auto-fire checkpoint). Optional so the
  // showroom + other callers are unaffected; the buttons only render for a
  // pending_review task when both handlers are supplied.
  reviewing?: boolean;
  reviewNotice?: string | null;
  onAcceptPending?: (e: React.MouseEvent) => void;
  onRejectPending?: (e: React.MouseEvent) => void;
}

export default function TaskRowView({ task,
  index,
  coaAccounts,
  expanded,
  editing,
  notesOpen,
  scheduleMenuOpen,
  form,
  scheduleDate,
  saving,
  completing,
  deleting,
  archiving,
  scheduling,
  error,
  scheduleSuccess,
  showHistory,
  history,
  historyLoading,
  historyError,
  onToggleExpanded,
  onToggleNotes,
  onEnterEdit,
  onCancelEdit,
  onFormChange,
  onToggleScheduleMenu,
  onCloseScheduleMenu,
  onScheduleDateChange,
  onSave,
  onQuickComplete,
  onToggleHistory,
  onUncomplete,
  onSchedule,
  onDelete,
  onArchive,
  onUnarchive,
  reviewing,
  reviewNotice,
  onAcceptPending,
  onRejectPending,
}: TaskRowViewProps & { }) {
  const labelClass = 'text-text-faint uppercase tracking-wide mb-1 text-xs';
  const pillClass = `inline-block px-2 py-0.5 rounded-full text-xs font-medium ${TASK_STATUS_PILL_CLASSES[task.status]}`;

  return (
    <div className={`border border-border-light rounded bg-white${task.status === 'archived' ? ' opacity-60' : ''}`}>
      <div
        className="flex items-center justify-between px-3 py-1.5 cursor-pointer hover:bg-bg-row text-xs"
        onClick={() => !editing && onToggleExpanded()}
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
          {task.link_url && (
            <a
              href={task.link_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title={task.link_url}
              className={`shrink-0  hover:opacity-80 ${'text-brand-purple'}`}
            >
              <ExternalLink className="w-3.5 h-3.5" strokeWidth={2} />
            </a>
          )}
          <span className={pillClass}>{TASK_STATUS_LABELS[task.status]}</span>
          {task.deadline && (
            <span className="text-text-muted">due {formatDate(task.deadline)}</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* PHASE2-4: auto-fired task awaiting review → accept (→ open) / reject (→ cancelled). */}
          {task.status === 'pending_review' && onAcceptPending && onRejectPending && (
            <>
              <button
                type="button"
                onClick={onAcceptPending}
                disabled={reviewing}
                className="px-2 py-0.5 border border-purple-300 text-purple-800 rounded hover:bg-purple-50 disabled:opacity-50 text-xs"
                title="Accept this auto-generated task (becomes a live open task)"
              >
                {reviewing ? '…' : '✓ accept'}
              </button>
              <button
                type="button"
                onClick={onRejectPending}
                disabled={reviewing}
                className="px-2 py-0.5 border border-border text-text-muted rounded hover:bg-bg-row disabled:opacity-50 text-xs"
                title="Reject this auto-generated task (marked cancelled)"
              >
                {reviewing ? '…' : '✕ reject'}
              </button>
            </>
          )}
          {task.status !== 'completed' && task.status !== 'cancelled' && task.status !== 'pending_review' && (
            <button
              type="button"
              onClick={onQuickComplete}
              disabled={completing}
              className="px-2 py-0.5 border border-green-300 text-green-800 rounded hover:bg-green-50 disabled:opacity-50 text-xs"
              title="Mark task as completed"
            >
              {completing ? '…' : '✓ complete'}
            </button>
          )}
          {task.status === 'completed' && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onUncomplete(); }}
              className="px-2 py-0.5 border border-border text-text-muted rounded hover:bg-bg-row text-xs"
              title="Revert this task to open"
            >
              ↩ uncomplete
            </button>
          )}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleHistory(); }}
            className="px-2 py-0.5 border border-border text-text-muted rounded hover:bg-bg-row text-xs"
            title="Show status change history"
          >
            history
          </button>
          {task.status !== 'completed' && task.status !== 'cancelled' && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleScheduleMenu(); }}
              disabled={scheduling}
              className="px-2 py-0.5 border border-border text-text-muted rounded hover:bg-bg-row disabled:opacity-50 text-xs"
              title="Schedule this task on a daily plan"
            >
              {scheduling ? '↗ scheduling…' : '↗ schedule'}
            </button>
          )}
          {scheduleSuccess && (
            <span className="text-xs text-green-700">{scheduleSuccess}</span>
          )}
        </div>
      </div>

      {scheduleMenuOpen && (
        <TaskScheduleMenu
          scheduleDate={scheduleDate}
          scheduling={scheduling}
          onScheduleDateChange={onScheduleDateChange}
          onSchedule={onSchedule}
          onCloseScheduleMenu={onCloseScheduleMenu}
        />
      )}

      {showHistory && (
        <TaskHistoryList history={history} historyLoading={historyLoading} historyError={historyError} />
      )}

      {/* EXEC-2: always-visible review feedback — the accept fired the build (green)
          or it failed (red, shown here when collapsed so it's never hidden; the
          expanded block below shows the same error when open). */}
      {reviewNotice && (
        <div className="px-4 pb-2">
          <div className="px-3 py-1.5 rounded border bg-green-50 border-green-200 text-green-800 text-xs">{reviewNotice}</div>
        </div>
      )}
      {error && !expanded && (
        <div className="px-4 pb-2">
          <div className="px-3 py-1.5 rounded border bg-red-50 border-red-200 text-red-800 text-xs">{error}</div>
        </div>
      )}

      {expanded && !editing && (
        <div className="px-4 py-2 border-t border-border-light text-xs space-y-2">
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

          {task.link_url && (
            <div>
              <div className={labelClass}>link</div>
              <a
                href={task.link_url}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1  hover:underline break-all ${'text-brand-purple'}`}
              >
                <ExternalLink className="w-3 h-3" strokeWidth={2} />
                <span>{task.link_url}</span>
              </a>
            </div>
          )}

          {task.notes && (
            <div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onToggleNotes(); }}
                className="flex items-center gap-1 text-text-faint uppercase tracking-wide text-xs hover:text-text-primary"
              >
                <span>{notesOpen ? '▾' : '▸'}</span>
                <span>notes ({task.notes.length} chars)</span>
              </button>
              {notesOpen && (
                <div className="mt-1 text-text-primary whitespace-pre-wrap">{task.notes}</div>
              )}
            </div>
          )}

          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border-light">
            <div>
              <div className={labelClass}>est. minutes</div>
              <div className="text-text-primary">{task.estimated_minutes ?? '—'}</div>
            </div>
            <div>
              {/* PROJECTS-UX-1: the anchor — task cost cells get the
                  strongest-cell treatment (see ProjectRowView). */}
              <div className="font-semibold text-text-primary uppercase tracking-wide mb-1 text-xs">est. cost (usd)</div>
              <div className="text-text-primary font-mono tabular-nums font-bold">{task.estimated_cost_usd ?? '—'}</div>
            </div>
            <div>
              <div className={labelClass}>category</div>
              {(() => {
                if (task.coa_code === null) {
                  return <div className="text-text-muted">—</div>;
                }
                const match = coaAccounts.find((a) => a.code === task.coa_code);
                if (match) {
                  return (
                    <div className="text-text-primary">
                      <span className="font-mono">{match.code}</span>
                      <span className="text-text-muted"> · {match.name}</span>
                    </div>
                  );
                }
                return (
                  <div
                    className="text-amber-700 italic"
                    title="Code not found in current chart of accounts"
                  >
                    <span className="font-mono">{task.coa_code}</span>
                    <span className="ml-1">⚠</span>
                  </div>
                );
              })()}
            </div>
            <div>
              <div className={labelClass}>actual minutes</div>
              <div className="text-text-primary">{task.actual_minutes ?? '—'}</div>
            </div>
            <div>
              {/* PROJECTS-UX-1: actual cost — the strongest evidence on the
                  tab (money actually spent per task) — same treatment. */}
              <div className="font-semibold text-text-primary uppercase tracking-wide mb-1 text-xs">actual cost (usd)</div>
              <div className="text-text-primary font-mono tabular-nums font-bold">{task.actual_cost_usd ?? '—'}</div>
            </div>
            <div>
              <div className={labelClass}>completed at</div>
              <div className="text-text-primary">{formatDate(task.completed_at)}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-border-light">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEnterEdit(); }}
              className="px-2 py-1 border border-border rounded hover:bg-bg-row"
            >
              edit
            </button>
            {task.status === 'archived' ? (
              <button
                type="button"
                onClick={onUnarchive}
                disabled={archiving}
                className="px-2 py-1 border border-border rounded hover:bg-bg-row disabled:opacity-50"
              >
                {archiving ? 'unarchiving…' : 'unarchive'}
              </button>
            ) : (
              <button
                type="button"
                onClick={onArchive}
                disabled={archiving}
                className="px-2 py-1 border border-border text-text-muted rounded hover:bg-bg-row disabled:opacity-50"
              >
                {archiving ? 'archiving…' : 'archive'}
              </button>
            )}
            <button
              type="button"
              onClick={onDelete}
              disabled={deleting}
              className="px-2 py-1 border border-red-300 text-red-700 rounded hover:bg-red-50 disabled:opacity-50"
            >
              {deleting ? 'deleting…' : 'delete'}
            </button>
          </div>
        </div>
      )}

      {editing && (
        <TaskEditInputs
          form={form}
          coaAccounts={coaAccounts}
          saving={saving}
          error={error}
          onFormChange={onFormChange}
          onSave={onSave}
          onCancelEdit={onCancelEdit}
        />
      )}
    </div>
  );
}
