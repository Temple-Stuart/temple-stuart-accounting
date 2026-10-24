/**
 * Section E · THE WORK — ONE TABLE (WORK-01, Alex, 2026-10-24).
 *
 * /tasks is THE WORK first, then PROJECTS. This section is THE WORK: one
 * DataTable (IDIOM-01) named 'work' over the pure spec in
 * src/lib/operations/work.ts — one row per routine LINE (a stepless routine is
 * one row), one row per task, every book:
 *
 *   KIND · NAME · PROJECT · BOOK · CADENCE · DAYS · TIME · DEADLINE · AMOUNT · ACCOUNT · STATUS · controls
 *
 *   · THE READS — the routines GET (every routine, active or not, with its
 *     lines), the projects GET (every project, archived included) and each
 *     project's tasks GET (archived included), then each book's chart (the
 *     ACCOUNT column names the account). Existing routes, no new one; a failed
 *     read is said in words, never an empty table. Everything comes in, so the
 *     STATUS filter is the only thing that narrows (ruling B).
 *   · THE DEFAULT — "STATUS: not ended, not inactive, not archived" (WORK-01b: inactive joined) is a VISIBLE chip in the
 *     controls row, already applied; a click on it clears it (everything shows);
 *     "clear filters" clears it with the rest. Never a hidden default. The old
 *     list's "show inactive" and "show ended (n)" toggles are this filter's
 *     checklist now — moved, not loosened.
 *   · "+ routine" opens FORM-01's routine form, unchanged (RoutineCreateForm;
 *     Days = Once makes a one-off). "+ task" opens the task form
 *     (TaskCreateInputs) under a REQUIRED project select over the open
 *     projects and posts to the existing projects/[id]/tasks route — no new
 *     write route (ruling C). No project picked is refused by name, no request.
 *   · EDIT (ruling D) — a row's "edit" expands the EXISTING editor under the
 *     row: for a routine line's routine, RoutineEditForm (RoutineRow's form,
 *     lifted — ruling 2 — with all its lines, through RoutineStepList); for a
 *     task, TaskEditInputs through useTaskActions, the hook the projects table
 *     fired. A routine row's other controls are RoutineRow's: deactivate /
 *     reactivate · delete (an ended routine keeps "edit" alone — ROUTINE-02a);
 *     a task row's are TaskTableRow's: ✓ accept / ✕ reject · ✓ complete /
 *     ↩ uncomplete · ↗ schedule · history · archive / unarchive · delete.
 *   · CSV — work_<day>.csv, the rows shown, over the spec.
 *
 * What left with WORK-01: the per-book tables and the ALL DAY band (ALLDAY-01;
 * the BOOK and TIME columns carry them), RoutineList and RoutineRow (their
 * rows' small print is said in the editor). The entity selector seeds "+ routine"
 * and nothing else; nothing is stored in the browser.
 *
 * TASKS-01 (2026-09-18) built this section as the routines list — the strips
 * and the receipts came off then; TASKS-ONE-02 (2026-10-14) took Today off it
 * (the day card replaced it); what each left is still off.
 */

'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useOperationsEntity, type Entity } from './EntitySelector';
import { useWorkChanges } from './WorkChanges';
import DataTable, { cellClass as cell, chipClass as chip, moneyClass } from '@/components/table/DataTable';
import { dataAttr } from '@/components/table/dataAttr';
import type { TableColumn } from '@/lib/table/columns';
import { filterOn, filterRows, noFilters, type TableFilters } from '@/lib/table/filters';
import { sortRows, type TableSort } from '@/lib/table/sort';
import { BLANK } from '@/lib/table/words';
import { localToday } from '@/lib/localToday';
import { SETUP_DOOR } from '@/lib/entities/kinds';
import RoutineCreateForm from './routines/RoutineCreateForm';
import RoutineEditForm from './routines/RoutineEditForm';
import TaskCreateInputs from './projects/TaskCreateInputs';
import TaskEditInputs from './projects/TaskEditInputs';
import TaskHistoryList from './projects/TaskHistoryList';
import TaskScheduleMenu from './projects/TaskScheduleMenu';
import { useTaskActions } from './projects/useTaskActions';
import type { Routine } from './routines/types';
import type { CoaAccountSummary, Project, TaskForm } from './projects/types';
import { DEFAULT_TASK_FORM } from './projects/types';
import {
  ADD_ROUTINE_WORDS, ADD_TASK_WORDS, CLEAR_CHIP_MARK, EDIT_WORDS, NO_OPEN_PROJECT_WORDS, NO_WORK_WORDS, PICK_PROJECT_WORDS, PROJECT_FIELD_WORDS,
  PROJECT_REQUIRED_WORDS, WORK_LOADING_WORDS, WORK_TABLE_NAME, WORK_TITLE_WORDS, openProjects, statusChipWords, statusDroppedOf, workCountWords,
  workCsvFileName, workDefaultFilters, workFailedWords, workRowsOf, workTable, withoutStatusFilter, type WorkCharts, type WorkColumn, type WorkProject, type WorkRow,
} from '@/lib/operations/work';

const chipOn = 'px-2 py-0.5 border border-brand-purple bg-brand-purple text-white rounded text-xs';
const actionClass = 'px-2 py-0.5 border border-border text-text-muted rounded hover:bg-bg-row disabled:opacity-50 text-xs';
const inputClass = 'w-full px-2 py-1 border border-border rounded text-xs text-text-primary focus:outline-none focus:border-brand-purple';
const labelClass = 'text-text-faint uppercase tracking-wide mb-1 text-xs';
const name = WORK_TABLE_NAME;

type WorkRead =
  | { readonly kind: 'loading' }
  | { readonly kind: 'failed'; readonly words: string }
  | { readonly kind: 'loaded'; readonly routines: Routine[]; readonly projects: WorkProject[] };
type ChartsRead =
  | { readonly kind: 'loading' }
  | { readonly kind: 'failed'; readonly words: string }
  | { readonly kind: 'loaded'; readonly charts: WorkCharts };

/** One GET, its body, or the route's own words thrown. */
async function readJson(url: string, what: string): Promise<Record<string, unknown>> {
  const res = await fetch(url);
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(String(body?.message ?? body?.error ?? `${what}: HTTP ${res.status}`));
  return body;
}

export default function SectionE_Work() {
  const { entities } = useOperationsEntity();
  // WORK-01b (Alex, 2026-10-24, ruling 3): the page's task-change signal — a task change here bumps it (PROJECTS' counts
  // re-read), and THE WORK re-reads on every bump, wherever it came from. Routine changes re-read here alone.
  const { version: workVersion, bump: taskChanged } = useWorkChanges();
  const [read, setRead] = useState<WorkRead>({ kind: 'loading' });
  const [chartsRead, setChartsRead] = useState<ChartsRead>({ kind: 'loading' });
  // One filter per column — STATUS dropping the default at first (ruling B); the sort; the open popover; the one editor open; what is being created. React state only.
  const [filters, setFilters] = useState<TableFilters>(() => workDefaultFilters(workTable([], {})));
  const [sort, setSort] = useState<TableSort<WorkColumn> | null>(null);
  const [openFilter, setOpenFilter] = useState<WorkColumn | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState<'routine' | 'task' | null>(null);
  // The book the routine form opens on, captured when it opens (RoutineList's rule, kept).
  const [createEntityId, setCreateEntityId] = useState('');

  const readWork = async () => {
    setRead({ kind: 'loading' });
    try {
      const [routinesBody, projectsBody] = await Promise.all([
        readJson('/api/operations/routines', 'routines'),
        readJson('/api/operations/projects?include_archived=true', 'projects'),
      ]);
      const routines = (routinesBody.routines ?? []) as Routine[];
      const projects = (projectsBody.projects ?? []) as Project[];
      const tasks = await Promise.all(projects.map((p) => readJson(`/api/operations/projects/${p.id}/tasks?include_archived=true`, `tasks of ${p.title}`).then((b) => (b.tasks ?? []) as WorkProject['tasks'])));
      setRead({ kind: 'loaded', routines, projects: projects.map((project, i) => ({ project, tasks: tasks[i] })) });
    } catch (e) {
      setRead({ kind: 'failed', words: e instanceof Error ? e.message : String(e) });
    }
  };
  useEffect(() => { readWork(); }, [workVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  // Each book's chart, for ACCOUNT's names and the task forms' category lists — once per entity list.
  useEffect(() => {
    let live = true;
    setChartsRead({ kind: 'loading' });
    (async () => {
      try {
        const pairs = await Promise.all(entities.map(async (e) => {
          const body = await readJson(`/api/chart-of-accounts?entity_id=${encodeURIComponent(e.id)}`, `chart of ${e.name}`);
          type CoaResponseRow = { code: string; name: string; accountType: string; entity_id: string };
          const list: CoaAccountSummary[] = ((body.accounts ?? []) as CoaResponseRow[]).map((a) => ({ code: a.code, name: a.name, account_type: a.accountType, entity_id: a.entity_id }));
          return [e.id, list] as const;
        }));
        if (live) setChartsRead({ kind: 'loaded', charts: Object.fromEntries(pairs) });
      } catch (e) {
        if (live) setChartsRead({ kind: 'failed', words: e instanceof Error ? e.message : String(e) });
      }
    })();
    return () => { live = false; };
  }, [entities]);

  const charts: WorkCharts = useMemo(() => (chartsRead.kind === 'loaded' ? chartsRead.charts : {}), [chartsRead]);
  const columns: readonly TableColumn<WorkRow, WorkColumn>[] = useMemo(() => workTable(entities, charts), [entities, charts]);
  const off = useMemo(() => noFilters(columns), [columns]);
  const loaded = read.kind === 'loaded' && chartsRead.kind === 'loaded';
  // ROUTINE-02a: ended is judged now, in each routine's own zone (work.ts hands `now` to the rule).
  const rows: readonly WorkRow[] = read.kind === 'loaded' ? workRowsOf(read.routines, read.projects, new Date()) : [];
  const shown = sortRows(filterRows(rows, filters, columns), sort, columns);
  const csv = loaded && shown.length > 0 ? { name: workCsvFileName(localToday()) } : null;
  const allProjects = read.kind === 'loaded' ? read.projects.map((p) => p.project) : [];
  const refresh = () => { readWork(); };

  const startRoutine = () => {
    setCreateEntityId(entities[0]?.id ?? '');
    setCreating('routine');
  };

  const renderRow = (row: WorkRow) => (row.of === 'routine'
    ? <RoutineWorkRow key={row.id} row={row} columns={columns} entities={entities} editing={editing === row.id} setEditing={(on) => setEditing(on ? row.id : null)} onChanged={refresh} />
    : <TaskWorkRow key={row.id} row={row} columns={columns} coaAccounts={[...(charts[row.task.entity_id] ?? [])]} editing={editing === row.id} setEditing={(on) => setEditing(on ? row.id : null)} onChanged={taskChanged} />);

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
        tableClassName="min-w-[96rem]"
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
            {/* ZERO-STATE-1: no silent disable — when no entity exists the reason renders beside the buttons (SELL-04: entities are set up by the user in Books). */}
            {entities.length === 0 && (
              <span className="text-[11px] text-text-faint" {...dataAttr(name, 'no-entity')}>
                no entity yet — set one up in Books › <a href={SETUP_DOOR} className="underline">Chart of accounts</a>.
              </span>
            )}
            <button type="button" className={chip} disabled={entities.length === 0 || creating !== null} onClick={startRoutine} {...dataAttr(name, 'add-routine')}>{ADD_ROUTINE_WORDS}</button>
            <button type="button" className={chip} disabled={entities.length === 0 || creating !== null || read.kind !== 'loaded'} onClick={() => setCreating('task')} {...dataAttr(name, 'add-task')}>{ADD_TASK_WORDS}</button>
            {/* Ruling B: the STATUS filter is VISIBLE while it narrows — the chip's words are the values dropped; its click clears it. */}
            {filterOn(filters, 'status', 'value') && (
              <button type="button" className={chipOn} onClick={() => setFilters(withoutStatusFilter(filters))} {...dataAttr(name, 'status-chip')}>
                {statusChipWords(statusDroppedOf(filters))} {CLEAR_CHIP_MARK}
              </button>
            )}
          </>
        )}
        renderRow={renderRow}
        foot={null}
      >
        {creating === 'routine' && (
          <RoutineCreateForm
            entities={entities}
            defaultEntityId={createEntityId}
            onCreated={() => { setCreating(null); refresh(); }}
            onCancel={() => setCreating(null)}
          />
        )}
        {creating === 'task' && (
          <NewTaskForm projects={openProjects(allProjects)} charts={charts} onCreated={() => { setCreating(null); taskChanged(); }} onCancel={() => setCreating(null)} />
        )}
        {(read.kind === 'loading' || (read.kind === 'loaded' && chartsRead.kind === 'loading')) && <div className="text-xs text-text-muted" {...dataAttr(name, 'loading')}>{WORK_LOADING_WORDS}</div>}
        {read.kind === 'failed' && <div className="text-xs px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800" {...dataAttr(name, 'failed')}>{workFailedWords(read.words)}</div>}
        {chartsRead.kind === 'failed' && <div className="text-xs px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800" {...dataAttr(name, 'failed')}>{workFailedWords(chartsRead.words)}</div>}
        {loaded && rows.length === 0 && <div className="text-xs text-text-muted" {...dataAttr(name, 'none')}>{NO_WORK_WORDS}</div>}
      </DataTable>
      {loaded && rows.length > 0 && <p className="text-xs text-text-muted" {...dataAttr(name, 'count')}>{workCountWords(shown.length, rows.length)}</p>}
    </section>
  );
}

/** One cell as the spec prints it — money right-aligned, a blank faint, a text column wrapping. */
function WorkCell({ column, row }: { column: TableColumn<WorkRow, WorkColumn>; row: WorkRow }) {
  const words = column.words(row);
  const className = column.kind === 'money' ? moneyClass : column.kind === 'text' ? `${cell} max-w-[24rem] break-words` : `${cell} whitespace-nowrap`;
  return <td className={`${className} ${words === BLANK ? 'text-text-faint' : ''}`} {...dataAttr(name, 'cell', column.key)}>{words}</td>;
}

interface RoutineWorkRowProps {
  row: Extract<WorkRow, { of: 'routine' }>;
  columns: readonly TableColumn<WorkRow, WorkColumn>[];
  entities: Entity[];
  editing: boolean;
  setEditing: (on: boolean) => void;
  onChanged: () => void;
}

/** A routine line's row: the cells, then edit · deactivate / reactivate · delete (RoutineRow's handlers, moved); its editor under it while open. */
function RoutineWorkRow({ row, columns, entities, editing, setEditing, onChanged }: RoutineWorkRowProps) {
  const { routine, end } = row;
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggleActive = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setToggling(true);
    setError(null);
    try {
      const res = await fetch(`/api/operations/routines/${routine.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !routine.is_active }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.message ?? body?.error ?? 'failed to toggle');
        return;
      }
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to toggle');
    } finally {
      setToggling(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete routine "${routine.name}"? All completion history will also be deleted.`)) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/operations/routines/${routine.id}`, { method: 'DELETE' });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.message ?? body?.error ?? 'failed to delete');
        return;
      }
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Fragment>
      <tr className={'border-t border-border ' + (routine.is_active && !end.ended ? '' : 'opacity-60')} {...dataAttr(name, 'row', row.id)} {...dataAttr(name, 'of', 'routine')} {...dataAttr(name, 'routine', routine.id)}>
        {columns.map((c) => <WorkCell key={c.key} column={c} row={row} />)}
        <td className={cell}>
          <div className="flex flex-wrap items-center gap-1">
            <button type="button" onClick={() => setEditing(!editing)} className={actionClass} aria-expanded={editing} {...dataAttr(name, 'edit')}>{EDIT_WORDS}</button>
            {/* ROUTINE-02a: an ended routine keeps "edit" alone — nothing is deactivated or deleted. */}
            {!end.ended && (
              <>
                <button type="button" onClick={handleToggleActive} disabled={toggling} className={actionClass} {...dataAttr(name, 'toggle-active')}>
                  {toggling ? '…' : routine.is_active ? 'deactivate' : 'reactivate'}
                </button>
                <button type="button" onClick={handleDelete} disabled={deleting} className="px-2 py-0.5 border border-red-300 text-red-700 rounded hover:bg-red-50 disabled:opacity-50 text-xs" {...dataAttr(name, 'delete')}>
                  {deleting ? 'deleting…' : 'delete'}
                </button>
              </>
            )}
          </div>
          {error && (
            <div className="mt-1 px-2 py-1 rounded border bg-red-50 border-red-200 text-red-800 text-xs" {...dataAttr(name, 'row-error')}>{error}</div>
          )}
        </td>
      </tr>
      {editing && (
        <tr {...dataAttr(name, 'editing', row.id)}>
          <td colSpan={columns.length + 1} className="p-2 border-t border-border-light bg-bg-row">
            <RoutineEditForm routine={routine} end={end} entities={entities} onChanged={onChanged} onClose={() => setEditing(false)} />
          </td>
        </tr>
      )}
    </Fragment>
  );
}

interface TaskWorkRowProps {
  row: Extract<WorkRow, { of: 'task' }>;
  columns: readonly TableColumn<WorkRow, WorkColumn>[];
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
      <tr className={'border-t border-border ' + (task.status === 'archived' ? 'opacity-60' : '')} {...dataAttr(name, 'row', row.id)} {...dataAttr(name, 'of', 'task')} {...dataAttr(name, 'task', task.id)}>
        {columns.map((c) => <WorkCell key={c.key} column={c} row={row} />)}
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
              <button type="button" onClick={a.handleQuickComplete} disabled={a.completing} className="px-2 py-0.5 border border-green-300 text-green-800 rounded hover:bg-green-50 disabled:opacity-50 text-xs" title="Mark task as completed">
                {a.completing ? '…' : '✓ complete'}
              </button>
            )}
            {task.status === 'completed' && (
              <button type="button" onClick={() => a.handleUncomplete()} className={actionClass} title="Revert this task to open">
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
              <button type="button" onClick={a.handleUnarchive} disabled={a.archiving} className={actionClass}>
                {a.archiving ? 'unarchiving…' : 'unarchive'}
              </button>
            ) : (
              <button type="button" onClick={a.handleArchive} disabled={a.archiving} className={actionClass}>
                {a.archiving ? 'archiving…' : 'archive'}
              </button>
            )}
            <button type="button" onClick={a.handleDelete} disabled={a.deleting} className="px-2 py-0.5 border border-red-300 text-red-700 rounded hover:bg-red-50 disabled:opacity-50 text-xs">
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

/** "+ task": the task form under a REQUIRED project select over the open projects; posts to the existing projects/[id]/tasks route (ruling C). */
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
