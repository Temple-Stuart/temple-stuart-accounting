/**
 * TaskTableRow — one task as rows of the projects table (PROJECTS-01, 2026-09-30).
 *
 * The task's row: Task (the title — struck through when done or cancelled, the
 * link icon when it has one — and beneath it the description in full,
 * "unblocks: …" and the notes) · Status (the pill and its quick action) ·
 * Minutes · Cost · Account · Deadline · Done · its controls (edit · ↗ schedule ·
 * history · archive or unarchive · delete). Nothing expands: "history" and
 * "edit" each open a row directly under the task, spanning the task's columns
 * (the project cell spans them); "↗ schedule" opens the date menu on the row.
 *
 * Every control fires the ONE handler it fires on the task list, from
 * useTaskActions — this file holds no fetch. The inputs, the date menu and the
 * history are the SAME parts the task view renders.
 */

'use client';

import type { ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';
import { accountCell, type AccountCellBook } from '@/lib/coa/accountCell';
import { AccountText } from '../routines/RoutineStepList';
import TaskEditInputs from './TaskEditInputs';
import TaskHistoryList from './TaskHistoryList';
import TaskScheduleMenu from './TaskScheduleMenu';
import type { CoaAccountSummary, Task } from './types';
import { useTaskActions } from './useTaskActions';
import {
  TASK_COLUMNS, costPair, formatDate, minutesPair, notesPreview, taskStatusPill, taskStatusWords,
} from './projectsTableText';


const cellClass = 'px-2 py-1.5 align-top border-t border-border-light';
const actionClass =
  'px-2 py-0.5 border border-border text-text-muted rounded hover:bg-bg-row disabled:opacity-50 text-xs';

interface Props {
  task: Task;
  projectId: string;
  /** The tab's entity list — the account is drawn against the task's book. */
  entities: readonly AccountCellBook[];
  /** The book's chart, for the edit inputs' category list. */
  coaAccounts: CoaAccountSummary[];
  /** Re-read the project's tasks after a change. */
  onChanged: () => void;
  editing: boolean;
  setEditing: (on: boolean) => void;
  showHistory: boolean;
  setShowHistory: (on: boolean) => void;
  /** The project's cell, on the project's first row; null on the others. */
  projectCell: ReactNode;
}

export default function TaskTableRow({
  task, projectId, entities, coaAccounts, onChanged, editing, setEditing, showHistory, setShowHistory, projectCell,
}: Props) {
  const a = useTaskActions({ task, projectId, onUpdate: onChanged, onDelete: onChanged, editing, setEditing, showHistory, setShowHistory });
  const account = accountCell(entities, task.entity_id, task.coa_code);
  const notes = task.notes ? notesPreview(task.notes) : null;

  return (
    <>
      <tr className={task.status === 'archived' ? 'opacity-60' : undefined} data-task-row={task.id}>
        {projectCell}
        <td className={cellClass} data-task-title>
          <div className="flex items-center gap-1.5">
            <span
              className={
                task.status === 'completed' || task.status === 'cancelled'
                  ? 'text-text-muted line-through'
                  : 'text-text-primary'
              }
            >
              {task.title}
            </span>
            {task.link_url && (
              <a
                href={task.link_url}
                target="_blank"
                rel="noopener noreferrer"
                title={task.link_url}
                className={`shrink-0  hover:opacity-80 ${'text-brand-purple'}`}
              >
                <ExternalLink className="w-3.5 h-3.5" strokeWidth={2} />
              </a>
            )}
          </div>
          <div className="mt-0.5 space-y-0.5 text-[11px] text-text-muted">
            {task.description && <div className="whitespace-pre-wrap" data-task-description>{task.description}</div>}
            {task.unblocks_label && <div className="whitespace-pre-wrap" data-task-unblocks>unblocks: {task.unblocks_label}</div>}
            {notes && (
              <div className="italic whitespace-pre-wrap" data-task-notes>
                {notes.shown}
                {notes.more && <span className="not-italic text-text-faint"> {notes.more}</span>}
              </div>
            )}
          </div>
          {/* EXEC-2: the accept fired the build — or the route refused; its own words, on the task's row. */}
          {a.reviewNotice && (
            <div className="mt-1 px-2 py-1 rounded border bg-green-50 border-green-200 text-green-800 text-xs" data-task-notice>{a.reviewNotice}</div>
          )}
          {a.error && !a.editing && (
            <div className="mt-1 px-2 py-1 rounded border bg-red-50 border-red-200 text-red-800 text-xs" data-task-error>{a.error}</div>
          )}
        </td>
        <td className={cellClass} data-task-status>
          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${taskStatusPill(task.status)}`}>
            {taskStatusWords(task.status)}
          </span>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {/* PHASE2-4: auto-fired task awaiting review → accept (→ open) / reject (→ cancelled). */}
            {task.status === 'pending_review' && (
              <>
                <button
                  type="button"
                  onClick={a.handleAcceptPending}
                  disabled={a.reviewing}
                  className="px-2 py-0.5 border border-purple-300 text-purple-800 rounded hover:bg-purple-50 disabled:opacity-50 text-xs"
                  title="Accept this auto-generated task (becomes a live open task)"
                >
                  {a.reviewing ? '…' : '✓ accept'}
                </button>
                <button
                  type="button"
                  onClick={a.handleRejectPending}
                  disabled={a.reviewing}
                  className="px-2 py-0.5 border border-border text-text-muted rounded hover:bg-bg-row disabled:opacity-50 text-xs"
                  title="Reject this auto-generated task (marked cancelled)"
                >
                  {a.reviewing ? '…' : '✕ reject'}
                </button>
              </>
            )}
            {task.status !== 'completed' && task.status !== 'cancelled' && task.status !== 'pending_review' && (
              <button
                type="button"
                onClick={a.handleQuickComplete}
                disabled={a.completing}
                className="px-2 py-0.5 border border-green-300 text-green-800 rounded hover:bg-green-50 disabled:opacity-50 text-xs"
                title="Mark task as completed"
              >
                {a.completing ? '…' : '✓ complete'}
              </button>
            )}
            {task.status === 'completed' && (
              <button
                type="button"
                onClick={() => a.handleUncomplete()}
                className="px-2 py-0.5 border border-border text-text-muted rounded hover:bg-bg-row text-xs"
                title="Revert this task to open"
              >
                ↩ uncomplete
              </button>
            )}
          </div>
        </td>
        <td className={`${cellClass} tabular-nums text-text-primary whitespace-nowrap`} data-task-minutes>
          {minutesPair(task.estimated_minutes, task.actual_minutes)}
        </td>
        <td className={`${cellClass} font-mono tabular-nums text-text-primary whitespace-nowrap`} data-task-cost>
          {costPair(task.estimated_cost_usd, task.actual_cost_usd)}
        </td>
        <td className={cellClass} data-task-account>
          {account.state === 'blank' ? <span className="text-text-muted">—</span> : <AccountText cell={account} />}
        </td>
        <td className={`${cellClass} whitespace-nowrap text-text-primary`} data-task-deadline>{formatDate(task.deadline)}</td>
        <td className={`${cellClass} whitespace-nowrap text-text-primary`} data-task-done>{formatDate(task.completed_at)}</td>
        <td className={cellClass}>
          <div className="flex flex-wrap items-center gap-1">
            <button type="button" onClick={a.enterEdit} disabled={a.editing} className={actionClass}>
              edit
            </button>
            {task.status !== 'completed' && task.status !== 'cancelled' && (
              <button
                type="button"
                onClick={a.toggleScheduleMenu}
                disabled={a.scheduling}
                className={actionClass}
                title="Schedule this task on a daily plan"
              >
                {a.scheduling ? '↗ scheduling…' : '↗ schedule'}
              </button>
            )}
            <button
              type="button"
              onClick={() => a.handleToggleHistory()}
              className={actionClass}
              title="Show status change history"
            >
              history
            </button>
            {task.status === 'archived' ? (
              <button type="button" onClick={a.handleUnarchive} disabled={a.archiving} className={actionClass}>
                {a.archiving ? 'unarchiving…' : 'unarchive'}
              </button>
            ) : (
              <button type="button" onClick={a.handleArchive} disabled={a.archiving} className={actionClass}>
                {a.archiving ? 'archiving…' : 'archive'}
              </button>
            )}
            <button
              type="button"
              onClick={a.handleDelete}
              disabled={a.deleting}
              className="px-2 py-0.5 border border-red-300 text-red-700 rounded hover:bg-red-50 disabled:opacity-50 text-xs"
            >
              {a.deleting ? 'deleting…' : 'delete'}
            </button>
          </div>
          {a.scheduleSuccess && <div className="mt-1 text-xs text-green-700">{a.scheduleSuccess}</div>}
          {a.scheduleMenuOpen && (
            <TaskScheduleMenu
              scheduleDate={a.scheduleDate}
              scheduling={a.scheduling}
              onScheduleDateChange={a.setScheduleDate}
              onSchedule={a.handleSchedule}
              onCloseScheduleMenu={a.closeScheduleMenu}
            />
          )}
        </td>
      </tr>
      {a.showHistory && (
        <tr data-task-history={task.id}>
          <td colSpan={TASK_COLUMNS} className="border-t border-border-light">
            <TaskHistoryList history={a.history} historyLoading={a.historyLoading} historyError={a.historyError} />
          </td>
        </tr>
      )}
      {a.editing && (
        <tr data-task-editing={task.id}>
          <td colSpan={TASK_COLUMNS} className="border-t border-border-light bg-bg-row">
            <TaskEditInputs
              form={a.form}
              coaAccounts={coaAccounts}
              saving={a.saving}
              error={a.error}
              onFormChange={a.setForm}
              onSave={a.handleSave}
              onCancelEdit={a.cancelEdit}
            />
          </td>
        </tr>
      )}
    </>
  );
}
