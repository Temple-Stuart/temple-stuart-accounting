/**
 * Section E · THE WORK — the tasks of the open projects (WORK-01d, Alex, 2026-10-25).
 *
 * /tasks is three tables: THE WORK, then PROJECTS, then ROUTINE EXPENSES
 * (SectionF_RoutineExpenses). This section is THE WORK: one DataTable (IDIOM-01)
 * named 'work' over the task spec in src/lib/operations/work.ts — one row per
 * task of an OPEN project, every book:
 *
 *   TASK · PROJECT · BOOK · STATUS · DEADLINE · ESTIMATE · ACCOUNT · DONE · controls
 *
 *   · THE READS — the projects GET (its default leaves out the archived; the
 *     completed, dropped and cancelled it still returns are filtered here to
 *     morningLog.ts OPEN_PROJECT_STATUSES, the one set), then each OPEN
 *     project's tasks GET with include_archived=true (the route's default
 *     excludes archived tasks — projects/[id]/tasks/route.ts), then each book's
 *     chart (the ACCOUNT column names the account). Existing routes, no new one;
 *     a failed read is said in words, never an empty table. A task of a project
 *     that is not open is never read here — its home is PROJECTS → show archived
 *     → the row's details (ruling B).
 *   · THE DEFAULT — "STATUS: open only" is a VISIBLE chip in the controls row,
 *     already applied, dropping done, cancelled and archived; a click on it
 *     clears it (everything shows); "clear filters" clears it with the rest.
 *     Never a hidden default.
 *   · "+ task" opens the task form (TaskCreateInputs) under a REQUIRED project
 *     select over the open projects and posts to the existing
 *     projects/[id]/tasks route — no new write route (WORK-01 ruling C). No
 *     project picked is refused by name, no request.
 *   · EDIT — a row's "edit" expands the EXISTING editor under the row
 *     (TaskEditInputs through useTaskActions); the row's other controls are the
 *     old task row's — ✓ complete, ↩ uncomplete, ↗ schedule, history, archive /
 *     unarchive, delete, and accept / reject on a pending review.
 *   · THE SIGNAL (WORK-01b ruling 3) — a task change here bumps the page's
 *     WorkChanges signal, so PROJECTS' task counts re-read; THE WORK re-reads on
 *     every bump, wherever it came from.
 *
 * React state only: the filters, the sort, the open popover, the one editor open
 * and nothing else; nothing is stored in the browser.
 *
 * HISTORY. TASKS-01 (2026-09-18) built this section as the routines list;
 * TASKS-ONE-02 (2026-10-14) took Today off it; WORK-01 (2026-10-24) made it the
 * one table of every routine line and every task with a KIND column; WORK-01d
 * split that table in two — the routines went to SectionF_RoutineExpenses, and
 * KIND left with the merge.
 *
 * TASKS-03 (Alex, 2026-10-26, ruling A): THE WORK prints the ledger's pair —
 * ACTUAL (actual_cost_usd as logged) and MATCH (the postings linked to the task
 * in Books, which the tasks GET now carries per task: match_cents · match_links
 * · match_unreadable, ruling B) — between ESTIMATE and ACCOUNT, drawn through the
 * same WorkCell as every other column; the spec is work.ts taskTable. Nothing
 * else here changed.
 */

'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useOperationsEntity } from './EntitySelector';
import { useWorkChanges } from './WorkChanges';
import DataTable, { cellClass as cell, chipClass as chip } from '@/components/table/DataTable';
import { dataAttr } from '@/components/table/dataAttr';
import type { TableColumn } from '@/lib/table/columns';
import { filterOn, filterRows, noFilters, type TableFilters } from '@/lib/table/filters';
import { sortRows, type TableSort } from '@/lib/table/sort';
import { localToday } from '@/lib/localToday';
import { SETUP_DOOR } from '@/lib/entities/kinds';
import TaskCreateInputs from './projects/TaskCreateInputs';
import TaskEditInputs from './projects/TaskEditInputs';
import TaskHistoryList from './projects/TaskHistoryList';
import TaskScheduleMenu from './projects/TaskScheduleMenu';
import { useTaskActions } from './projects/useTaskActions';
import type { CoaAccountSummary, Project, TaskForm } from './projects/types';
import { DEFAULT_TASK_FORM } from './projects/types';
import { WorkCell, readJson, useBookCharts } from './workShared';
import {
  ADD_TASK_WORDS, CLEAR_CHIP_MARK, EDIT_WORDS, NO_OPEN_PROJECT_WORDS, NO_WORK_WORDS, PICK_PROJECT_WORDS, PROJECT_FIELD_WORDS,
  PROJECT_REQUIRED_WORDS, TASK_DEFAULT, TASK_TABLE_NAME, WORK_LOADING_WORDS, WORK_TITLE_WORDS, openProjects, rowCountWords, statusChipWords, statusDroppedOf,
  taskDefaultFilters, taskRowsOf, taskTable, workCsvFileName, workFailedWords, withoutStatusFilter, type TaskColumn, type TaskRow, type WorkCharts, type WorkProject,
} from '@/lib/operations/work';

const chipOn = 'px-2 py-0.5 border border-brand-purple bg-brand-purple text-white rounded text-xs';
const actionClass = 'px-2 py-0.5 border border-border text-text-muted rounded hover:bg-bg-row disabled:opacity-50 text-xs';
const inputClass = 'w-full px-2 py-1 border border-border rounded text-xs text-text-primary focus:outline-none focus:border-brand-purple';
const labelClass = 'text-text-faint uppercase tracking-wide mb-1 text-xs';
const name = TASK_TABLE_NAME;

type WorkRead =
  | { readonly kind: 'loading' }
  | { readonly kind: 'failed'; readonly words: string }
  | { readonly kind: 'loaded'; readonly projects: WorkProject[] };

export default function SectionE_Work() {
  const { entities } = useOperationsEntity();
  // WORK-01b (Alex, 2026-10-24, ruling 3): the page's task-change signal — a task change here bumps it (PROJECTS' counts
  // re-read), and THE WORK re-reads on every bump, wherever it came from.
  const { version: workVersion, bump: taskChanged } = useWorkChanges();
  const [read, setRead] = useState<WorkRead>({ kind: 'loading' });
  const chartsRead = useBookCharts(entities);
  // One filter per column — STATUS dropping the default at first (ruling B); the sort; the open popover; the one editor open; whether a task is being created. React state only.
  const [filters, setFilters] = useState<TableFilters>(() => taskDefaultFilters(taskTable([], {})));
  const [sort, setSort] = useState<TableSort<TaskColumn> | null>(null);
  const [openFilter, setOpenFilter] = useState<TaskColumn | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const readWork = async () => {
    setRead({ kind: 'loading' });
    try {
      const projectsBody = await readJson('/api/operations/projects', 'projects');
      // Ruling B: only the open projects are read on — the one set (morningLog.ts), applied here because the route's default still returns the completed, dropped and cancelled.
      const projects = openProjects((projectsBody.projects ?? []) as Project[]);
      const tasks = await Promise.all(projects.map((p) => readJson(`/api/operations/projects/${p.id}/tasks?include_archived=true`, `tasks of ${p.title}`).then((b) => (b.tasks ?? []) as WorkProject['tasks'])));
      setRead({ kind: 'loaded', projects: projects.map((project, i) => ({ project, tasks: tasks[i] })) });
    } catch (e) {
      setRead({ kind: 'failed', words: e instanceof Error ? e.message : String(e) });
    }
  };
  useEffect(() => { readWork(); }, [workVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const charts: WorkCharts = useMemo(() => (chartsRead.kind === 'loaded' ? chartsRead.charts : {}), [chartsRead]);
  const columns: readonly TableColumn<TaskRow, TaskColumn>[] = useMemo(() => taskTable(entities, charts), [entities, charts]);
  const off = useMemo(() => noFilters(columns), [columns]);
  const loaded = read.kind === 'loaded' && chartsRead.kind === 'loaded';
  const rows: readonly TaskRow[] = read.kind === 'loaded' ? taskRowsOf(read.projects) : [];
  const shown = sortRows(filterRows(rows, filters, columns), sort, columns);
  const csv = loaded && shown.length > 0 ? { name: workCsvFileName(localToday()) } : null;
  const projects = read.kind === 'loaded' ? read.projects.map((p) => p.project) : [];

  const renderRow = (row: TaskRow) => (
    <TaskWorkRow key={row.id} row={row} columns={columns} coaAccounts={[...(charts[row.task.entity_id] ?? [])]} editing={editing === row.id} setEditing={(on) => setEditing(on ? row.id : null)} onChanged={taskChanged} />
  );

  return (
    <section className="space-y-3" {...dataAttr(name, 'section')}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-brand-purple">{WORK_TITLE_WORDS}</h2>
      </div>
      <DataTable
        name={name}
        columns={columns}
        rows={rows}
        shown={shown}
        loaded={loaded}
        tableClassName="min-w-[80rem]"
        filters={filters}
        onFilters={setFilters}
        noFilters={off}
        sort={sort}
        onSort={setSort}
        openFilter={openFilter}
        onOpenFilter={setOpenFilter}
        csv={csv}
        controls={(
          <>
            {/* ZERO-STATE-1: no silent disable — when no entity exists the reason renders beside the button (SELL-04: entities are set up by the user in Books). */}
            {entities.length === 0 && (
              <span className="text-[11px] text-text-faint" {...dataAttr(name, 'no-entity')}>
                no entity yet — set one up in Books › <a href={SETUP_DOOR} className="underline">Chart of accounts</a>.
              </span>
            )}
            <button type="button" className={chip} disabled={entities.length === 0 || creating || read.kind !== 'loaded'} onClick={() => setCreating(true)} {...dataAttr(name, 'add-task')}>{ADD_TASK_WORDS}</button>
            {/* Ruling B: the STATUS filter is VISIBLE while it narrows — "STATUS: open only" at first, the values dropped otherwise; its click clears it. */}
            {filterOn(filters, 'status', 'value') && (
              <button type="button" className={chipOn} onClick={() => setFilters(withoutStatusFilter(filters))} {...dataAttr(name, 'status-chip')}>
                {statusChipWords(statusDroppedOf(filters), TASK_DEFAULT)} {CLEAR_CHIP_MARK}
              </button>
            )}
          </>
        )}
        renderRow={renderRow}
        foot={null}
      >
        {creating && (
          <NewTaskForm projects={projects} charts={charts} onCreated={() => { setCreating(false); taskChanged(); }} onCancel={() => setCreating(false)} />
        )}
        {(read.kind === 'loading' || (read.kind === 'loaded' && chartsRead.kind === 'loading')) && <div className="text-xs text-text-muted" {...dataAttr(name, 'loading')}>{WORK_LOADING_WORDS}</div>}
        {read.kind === 'failed' && <div className="text-xs px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800" {...dataAttr(name, 'failed')}>{workFailedWords(read.words)}</div>}
        {chartsRead.kind === 'failed' && <div className="text-xs px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800" {...dataAttr(name, 'failed')}>{workFailedWords(chartsRead.words)}</div>}
        {loaded && rows.length === 0 && <div className="text-xs text-text-muted" {...dataAttr(name, 'none')}>{NO_WORK_WORDS}</div>}
      </DataTable>
      {loaded && rows.length > 0 && <p className="text-xs text-text-muted" {...dataAttr(name, 'count')}>{rowCountWords(shown.length, rows.length)}</p>}
    </section>
  );
}

interface TaskWorkRowProps {
  row: TaskRow;
  columns: readonly TableColumn<TaskRow, TaskColumn>[];
  /** The task's book's chart, for the edit inputs' category list. */
  coaAccounts: CoaAccountSummary[];
  editing: boolean;
  setEditing: (on: boolean) => void;
  onChanged: () => void;
}

/** A task's row: the cells, then TaskTableRow's controls through useTaskActions — the hook the projects table fired; the history and the editor under it while open. */
function TaskWorkRow({ row, columns, coaAccounts, editing, setEditing, onChanged }: TaskWorkRowProps) {
  const { task } = row;
  const [showHistory, setShowHistory] = useState(false);
  const a = useTaskActions({ task, projectId: row.project.id, onUpdate: onChanged, onDelete: onChanged, editing, setEditing, showHistory, setShowHistory });

  return (
    <Fragment>
      <tr className={'border-t border-border ' + (task.status === 'archived' ? 'opacity-60' : '')} {...dataAttr(name, 'row', row.id)} {...dataAttr(name, 'task', task.id)}>
        {columns.map((c) => <WorkCell key={c.key} name={name} column={c} row={row} />)}
        <td className={cell}>
          <div className="flex flex-wrap items-center gap-1">
            <button type="button" onClick={a.enterEdit} disabled={a.editing} className={actionClass} aria-expanded={a.editing} {...dataAttr(name, 'edit')}>{EDIT_WORDS}</button>
            {/* PHASE2-4: auto-fired task awaiting review → accept (→ open) / reject (→ cancelled). */}
            {task.status === 'pending_review' && (
              <>
                <button type="button" onClick={a.handleAcceptPending} disabled={a.reviewing} className="px-2 py-0.5 border border-purple-300 text-purple-800 rounded hover:bg-purple-50 disabled:opacity-50 text-xs" title="Accept this auto-generated task (becomes a live open task)">
                  {a.reviewing ? '…' : '✓ accept'}
                </button>
                <button type="button" onClick={a.handleRejectPending} disabled={a.reviewing} className={actionClass} title="Reject this auto-generated task (marked cancelled)">
                  {a.reviewing ? '…' : '✕ reject'}
                </button>
              </>
            )}
            {task.status !== 'completed' && task.status !== 'cancelled' && task.status !== 'pending_review' && (
              <button type="button" onClick={a.handleQuickComplete} disabled={a.completing} className="px-2 py-0.5 border border-green-300 text-green-800 rounded hover:bg-green-50 disabled:opacity-50 text-xs" title="Mark task as completed" {...dataAttr(name, 'complete')}>
                {a.completing ? '…' : '✓ complete'}
              </button>
            )}
            {task.status === 'completed' && (
              <button type="button" onClick={() => a.handleUncomplete()} className={actionClass} title="Revert this task to open" {...dataAttr(name, 'uncomplete')}>
                ↩ uncomplete
              </button>
            )}
            {task.status !== 'completed' && task.status !== 'cancelled' && (
              <button type="button" onClick={a.toggleScheduleMenu} disabled={a.scheduling} className={actionClass} title="Schedule this task on a daily plan">
                {a.scheduling ? '↗ scheduling…' : '↗ schedule'}
              </button>
            )}
            <button type="button" onClick={() => a.handleToggleHistory()} className={actionClass} title="Show status change history">
              history
            </button>
            {task.status === 'archived' ? (
              <button type="button" onClick={a.handleUnarchive} disabled={a.archiving} className={actionClass} {...dataAttr(name, 'unarchive')}>
                {a.archiving ? 'unarchiving…' : 'unarchive'}
              </button>
            ) : (
              <button type="button" onClick={a.handleArchive} disabled={a.archiving} className={actionClass} {...dataAttr(name, 'archive')}>
                {a.archiving ? 'archiving…' : 'archive'}
              </button>
            )}
            <button type="button" onClick={a.handleDelete} disabled={a.deleting} className="px-2 py-0.5 border border-red-300 text-red-700 rounded hover:bg-red-50 disabled:opacity-50 text-xs" {...dataAttr(name, 'delete')}>
              {a.deleting ? 'deleting…' : 'delete'}
            </button>
          </div>
          {/* EXEC-2: the accept fired the build — or the route refused; its own words, on the task's row. */}
          {a.reviewNotice && (
            <div className="mt-1 px-2 py-1 rounded border bg-green-50 border-green-200 text-green-800 text-xs" {...dataAttr(name, 'task-notice')}>{a.reviewNotice}</div>
          )}
          {a.error && !a.editing && (
            <div className="mt-1 px-2 py-1 rounded border bg-red-50 border-red-200 text-red-800 text-xs" {...dataAttr(name, 'row-error')}>{a.error}</div>
          )}
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
        <tr {...dataAttr(name, 'history', row.id)}>
          <td colSpan={columns.length + 1} className="border-t border-border-light">
            <TaskHistoryList history={a.history} historyLoading={a.historyLoading} historyError={a.historyError} />
          </td>
        </tr>
      )}
      {a.editing && (
        <tr {...dataAttr(name, 'editing', row.id)}>
          <td colSpan={columns.length + 1} className="border-t border-border-light bg-bg-row">
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
    </Fragment>
  );
}

/** "+ task": the task form under a REQUIRED project select over the open projects; posts to the existing projects/[id]/tasks route (WORK-01 ruling C). */
function NewTaskForm({ projects, charts, onCreated, onCancel }: { projects: readonly Project[]; charts: WorkCharts; onCreated: () => void; onCancel: () => void }) {
  const [projectId, setProjectId] = useState('');
  const [form, setForm] = useState<TaskForm>(DEFAULT_TASK_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const project = projects.find((p) => p.id === projectId) ?? null;
  const coaAccounts = project === null ? [] : [...(charts[project.entity_id] ?? [])];

  const handleCreate = async () => {
    // Refused by name, before any request: a task belongs to a project.
    if (project === null) {
      setError(PROJECT_REQUIRED_WORDS);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/operations/projects/${project.id}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.message ?? body?.error ?? 'failed to create');
        return;
      }
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to create');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border border-border rounded p-3 bg-white text-xs space-y-3" {...dataAttr(name, 'new-task')}>
      <div>
        <div className={labelClass}>{PROJECT_FIELD_WORDS}</div>
        {projects.length === 0 ? (
          <div className="text-text-muted" {...dataAttr(name, 'no-open-project')}>{NO_OPEN_PROJECT_WORDS}</div>
        ) : (
          <select value={projectId} onChange={(e) => { setProjectId(e.target.value); setError(null); }} className={inputClass} required {...dataAttr(name, 'task-project')}>
            <option value="">{PICK_PROJECT_WORDS}</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        )}
      </div>
      <TaskCreateInputs
        createForm={form}
        createSaving={saving}
        createError={error}
        coaAccounts={coaAccounts}
        onCreateFormChange={setForm}
        onCreate={handleCreate}
        onCancelCreate={onCancel}
      />
    </div>
  );
}
