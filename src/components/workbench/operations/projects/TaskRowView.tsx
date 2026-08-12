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
import type { Task, TaskForm, TaskStatus, CoaAccountSummary } from './types';
import { TASK_STATUS_LABELS, TASK_STATUS_PILL_CLASSES } from './types';
import { themed, type Surface } from '@/lib/ds';

export type TaskStatusHistoryRow = {
  id: string;
  previous_status: string | null;
  new_status: string;
  changed_at: string;
  changed_by: string | null;
  reason: string | null;
};

const STATUS_OPTIONS: TaskStatus[] = [
  'open',
  'in_progress',
  'blocked',
  'completed',
  'cancelled',
];

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

export default function TaskRowView({ surface = 'light',
  task,
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
}: TaskRowViewProps & { surface?: Surface }) {
  const dk = surface === 'dark';
  const inputClass =
    themed('w-full px-2 py-1 border border-border rounded text-xs text-text-primary focus:outline-none focus:border-brand-purple', dk);
  const labelClass = themed('text-text-faint uppercase tracking-wide mb-1 text-xs', dk);
  const pillClass = `inline-block px-2 py-0.5 rounded-full text-xs font-medium ${TASK_STATUS_PILL_CLASSES[task.status]}`;

  return (
    <div className={themed(`border border-border-light rounded bg-white${task.status === 'archived' ? ' opacity-60' : ''}`, dk)}>
      <div
        className={themed('flex items-center justify-between px-3 py-1.5 cursor-pointer hover:bg-bg-row text-xs', dk)}
        onClick={() => !editing && onToggleExpanded()}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className={themed('text-text-faint shrink-0 w-6 text-right', dk)}>{index}.</span>
          <span className={themed('text-text-faint', dk)}>{expanded ? '▾' : '▸'}</span>
          <span
            className={
              task.status === 'completed' || task.status === 'cancelled'
                ? themed('text-text-muted line-through truncate', dk)
                : themed('text-text-primary truncate', dk)
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
              className={`shrink-0  hover:opacity-80 ${dk ? 'text-brand-purple-pop' : 'text-brand-purple'}`}
            >
              <ExternalLink className="w-3.5 h-3.5" strokeWidth={2} />
            </a>
          )}
          <span className={pillClass}>{TASK_STATUS_LABELS[task.status]}</span>
          {task.deadline && (
            <span className={themed('text-text-muted', dk)}>due {formatDate(task.deadline)}</span>
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
                className={themed('px-2 py-0.5 border border-border text-text-muted rounded hover:bg-bg-row disabled:opacity-50 text-xs', dk)}
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
              className={themed('px-2 py-0.5 border border-border text-text-muted rounded hover:bg-bg-row text-xs', dk)}
              title="Revert this task to open"
            >
              ↩ uncomplete
            </button>
          )}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleHistory(); }}
            className={themed('px-2 py-0.5 border border-border text-text-muted rounded hover:bg-bg-row text-xs', dk)}
            title="Show status change history"
          >
            history
          </button>
          {task.status !== 'completed' && task.status !== 'cancelled' && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleScheduleMenu(); }}
              disabled={scheduling}
              className={themed('px-2 py-0.5 border border-border text-text-muted rounded hover:bg-bg-row disabled:opacity-50 text-xs', dk)}
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
        <div
          className={themed('mx-6 mt-2 mb-2 p-2 border border-border-light rounded bg-bg-row text-xs', dk)}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className={themed('text-text-muted', dk)}>schedule for:</span>
            <input
              type="date"
              value={scheduleDate}
              onChange={(e) => onScheduleDateChange(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className={themed('px-2 py-0.5 border border-border rounded text-text-primary', dk)}
            />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onSchedule(scheduleDate); }}
              disabled={scheduling || !scheduleDate}
              className={themed('px-2 py-0.5 border border-border text-text-primary rounded hover:bg-white disabled:opacity-50', dk)}
            >
              schedule
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onCloseScheduleMenu(); }}
              className={themed('px-2 py-0.5 text-text-muted hover:bg-bg-row rounded', dk)}
            >
              cancel
            </button>
          </div>
        </div>
      )}

      {showHistory && (
        <div className={themed('mx-6 mt-2 mb-2 p-2 border border-border-light rounded bg-bg-row text-xs', dk)}>
          {historyLoading && <div className={themed('text-text-muted', dk)}>loading history…</div>}
          {historyError && <div className="text-red-700">{historyError}</div>}
          {!historyLoading && !historyError && history !== null && history.length === 0 && (
            <div className={themed('text-text-muted italic', dk)}>no status changes recorded yet</div>
          )}
          {!historyLoading && !historyError && history !== null && history.length > 0 && (
            <ul className="space-y-1">
              {history.map((h) => (
                <li key={h.id} className="flex flex-col">
                  <div>
                    <span className={themed('text-text-muted', dk)}>
                      {new Date(h.changed_at).toLocaleString()}
                    </span>
                    {' · '}
                    <span className={themed('text-text-primary', dk)}>
                      {h.previous_status ?? '—'} → {h.new_status}
                    </span>
                    {h.changed_by && (
                      <span className={themed('text-text-muted', dk)}> · {h.changed_by}</span>
                    )}
                  </div>
                  {h.reason && (
                    <div className={themed('text-text-muted pl-2 italic', dk)}>
                      &ldquo;{h.reason}&rdquo;
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
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
        <div className={themed('px-4 py-2 border-t border-border-light text-xs space-y-2', dk)}>
          {error && (
            <div className="px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800">
              {error}
            </div>
          )}
          {task.description ? (
            <div>
              <div className={labelClass}>description</div>
              <div className={themed('text-text-primary whitespace-pre-wrap', dk)}>{task.description}</div>
            </div>
          ) : (
            <div className={themed('text-text-muted italic', dk)}>no description</div>
          )}

          {task.unblocks_label && (
            <div>
              <div className={labelClass}>unblocks</div>
              <div className={themed('text-text-primary whitespace-pre-wrap', dk)}>{task.unblocks_label}</div>
            </div>
          )}

          {task.link_url && (
            <div>
              <div className={labelClass}>link</div>
              <a
                href={task.link_url}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1  hover:underline break-all ${dk ? 'text-brand-purple-pop' : 'text-brand-purple'}`}
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
                className={themed('flex items-center gap-1 text-text-faint uppercase tracking-wide text-xs hover:text-text-primary', dk)}
              >
                <span>{notesOpen ? '▾' : '▸'}</span>
                <span>notes ({task.notes.length} chars)</span>
              </button>
              {notesOpen && (
                <div className={themed('mt-1 text-text-primary whitespace-pre-wrap', dk)}>{task.notes}</div>
              )}
            </div>
          )}

          <div className={themed('grid grid-cols-3 gap-3 pt-2 border-t border-border-light', dk)}>
            <div>
              <div className={labelClass}>est. minutes</div>
              <div className={themed('text-text-primary', dk)}>{task.estimated_minutes ?? '—'}</div>
            </div>
            <div>
              {/* PROJECTS-UX-1: the anchor — task cost cells get the
                  strongest-cell treatment (see ProjectRowView). */}
              <div className={themed('font-semibold text-text-primary uppercase tracking-wide mb-1 text-xs', dk)}>est. cost (usd)</div>
              <div className={themed('text-text-primary font-mono tabular-nums font-bold', dk)}>{task.estimated_cost_usd ?? '—'}</div>
            </div>
            <div>
              <div className={labelClass}>category</div>
              {(() => {
                if (task.coa_code === null) {
                  return <div className={themed('text-text-muted', dk)}>—</div>;
                }
                const match = coaAccounts.find((a) => a.code === task.coa_code);
                if (match) {
                  return (
                    <div className={themed('text-text-primary', dk)}>
                      <span className="font-mono">{match.code}</span>
                      <span className={themed('text-text-muted', dk)}> · {match.name}</span>
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
              <div className={themed('text-text-primary', dk)}>{task.actual_minutes ?? '—'}</div>
            </div>
            <div>
              {/* PROJECTS-UX-1: actual cost — the strongest evidence on the
                  tab (money actually spent per task) — same treatment. */}
              <div className={themed('font-semibold text-text-primary uppercase tracking-wide mb-1 text-xs', dk)}>actual cost (usd)</div>
              <div className={themed('text-text-primary font-mono tabular-nums font-bold', dk)}>{task.actual_cost_usd ?? '—'}</div>
            </div>
            <div>
              <div className={labelClass}>completed at</div>
              <div className={themed('text-text-primary', dk)}>{formatDate(task.completed_at)}</div>
            </div>
          </div>

          <div className={themed('flex items-center gap-2 pt-2 border-t border-border-light', dk)}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEnterEdit(); }}
              className={themed('px-2 py-1 border border-border rounded hover:bg-bg-row', dk)}
            >
              edit
            </button>
            {task.status === 'archived' ? (
              <button
                type="button"
                onClick={onUnarchive}
                disabled={archiving}
                className={themed('px-2 py-1 border border-border rounded hover:bg-bg-row disabled:opacity-50', dk)}
              >
                {archiving ? 'unarchiving…' : 'unarchive'}
              </button>
            ) : (
              <button
                type="button"
                onClick={onArchive}
                disabled={archiving}
                className={themed('px-2 py-1 border border-border text-text-muted rounded hover:bg-bg-row disabled:opacity-50', dk)}
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
        <div className={themed('px-4 py-3 border-t border-border-light text-xs space-y-3', dk)}>
          {error && (
            <div className="px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800">
              {error}
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-3">
              <div className={labelClass}>title</div>
              <input
                type="text"
                value={form.title}
                onChange={(e) => onFormChange({ ...form, title: e.target.value })}
                className={inputClass}
                maxLength={500}
              />
            </div>
            <div>
              <div className={labelClass}>status</div>
              <select
                value={form.status}
                onChange={(e) => onFormChange({ ...form, status: e.target.value as TaskStatus })}
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
                onChange={(e) => onFormChange({ ...form, deadline: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <div className={labelClass}>category</div>
              <select
                value={form.coa_code}
                onChange={(e) => onFormChange({ ...form, coa_code: e.target.value })}
                className={inputClass}
              >
                <option value="">— None —</option>
                {/* If the task's current code isn't in the dropdown options
                    (e.g., archived or out-of-entity), still surface it so the
                    user isn't silently re-categorized when they save. */}
                {form.coa_code !== '' && !coaAccounts.some((a) => a.code === form.coa_code) && (
                  <option value={form.coa_code}>{form.coa_code} ⚠ (not in current COA)</option>
                )}
                {coaAccounts.map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.code} · {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className={labelClass}>description</div>
            <textarea
              value={form.description}
              onChange={(e) => onFormChange({ ...form, description: e.target.value })}
              rows={3}
              className={inputClass}
              placeholder="what does this task entail?"
            />
          </div>

          <div>
            <div className={labelClass}>unblocks (rationale for priority engine)</div>
            <textarea
              value={form.unblocks_label}
              onChange={(e) => onFormChange({ ...form, unblocks_label: e.target.value })}
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
                onChange={(e) => onFormChange({ ...form, estimated_minutes: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <div className={labelClass}>actual minutes</div>
              <input
                type="number"
                min={0}
                step={1}
                value={form.actual_minutes}
                onChange={(e) => onFormChange({ ...form, actual_minutes: e.target.value })}
                className={inputClass}
                placeholder="(empty)"
              />
            </div>
            <div>
              <div className={labelClass}>est. cost (usd)</div>
              <input
                type="text"
                value={form.estimated_cost_usd}
                onChange={(e) => onFormChange({ ...form, estimated_cost_usd: e.target.value })}
                className={inputClass}
                placeholder="0.00"
              />
            </div>
            <div>
              <div className={labelClass}>actual cost (usd)</div>
              <input
                type="number"
                min={0}
                step={0.01}
                value={form.actual_cost_usd}
                onChange={(e) => onFormChange({ ...form, actual_cost_usd: e.target.value })}
                className={inputClass}
                placeholder="(empty)"
              />
            </div>
          </div>

          <div>
            <div className={labelClass}>link url (vendor / portal)</div>
            <input
              type="url"
              value={form.link_url ?? ''}
              onChange={(e) => onFormChange({ ...form, link_url: e.target.value })}
              className={inputClass}
              maxLength={500}
              placeholder="https://..."
            />
          </div>

          <div>
            <div className={labelClass}>notes (institutional context)</div>
            <textarea
              value={form.notes ?? ''}
              onChange={(e) => onFormChange({ ...form, notes: e.target.value })}
              rows={6}
              className={inputClass}
              maxLength={1500}
              placeholder="dependencies, timing anchors, decision points, gotchas..."
            />
          </div>

          <div className={themed('flex items-center gap-2 pt-2 border-t border-border-light', dk)}>
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className={`px-3 py-1 border text-white rounded hover:opacity-90 disabled:opacity-50 ${dk ? 'border-brand-purple-pop bg-brand-purple-pop' : 'border-brand-purple bg-brand-purple'}`}
            >
              {saving ? 'saving…' : 'save'}
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              disabled={saving}
              className={themed('px-3 py-1 border border-border rounded hover:bg-bg-row disabled:opacity-50', dk)}
            >
              cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
