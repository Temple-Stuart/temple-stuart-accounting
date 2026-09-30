/**
 * ProjectTableRows — one project as rows of the projects table (PROJECTS-01, 2026-09-30).
 *
 * The project's cell spans its task rows and holds the title, the status pill,
 * the book, the small print (target date, the estimates when set, the requests,
 * the money allocated from the ledger, the tasks counted by status) and its
 * controls: + task · details. Every task is a row (TaskTableRow); a project with
 * no tasks is one row, "no tasks". "+ task" opens the create inputs as a row at
 * the end of the project's rows; "details" opens the project's existing detail —
 * <ProjectRow> with every control it has, WITHOUT its task list — as a
 * full-width row directly under them.
 *
 * The tasks are read through the tasks GET in useProjectTasks — the task list's
 * one home for the read, the create and the category list. No fetch here.
 */

'use client';

import { useEffect, useState } from 'react';
import { ACCOUNT_CELL_WORDS, type AccountCellBook } from '@/lib/coa/accountCell';
import { isBlankPlanValue } from '@/lib/operations/planMoney';
import ProjectRow from './ProjectRow';
import TaskCreateInputs from './TaskCreateInputs';
import TaskTableRow from './TaskTableRow';
import type { Project } from './types';
import { STATUS_LABELS, STATUS_PILL_CLASSES, formatAllocatedCents } from './types';
import { useProjectTasks } from './useProjectTasks';
import { PROJECTS_TABLE_COLUMNS, TASK_COLUMNS, formatDate, requestsWords, statusCounts } from './projectsTableText';


const actionClass =
  'px-2 py-0.5 border border-border rounded hover:bg-bg-row disabled:opacity-50 text-xs';

interface Props {
  project: Project;
  /** The tab's entity list (useOperationsEntity) — the book's name and letter. */
  entities: (AccountCellBook & { name: string })[];
  allProjects: Project[];
  /** The section's one "show archived": archived tasks are read too. */
  showArchived: boolean;
  /** Re-read the projects (a project was saved, archived or deleted). */
  onProjectsChanged: () => void;
  isJumpTarget: boolean;
  onClearTarget: () => void;
  onJumpTo: (projectId: string) => void;
}

function withId(set: ReadonlySet<string>, id: string, on: boolean): ReadonlySet<string> {
  const next = new Set(set);
  if (on) next.add(id);
  else next.delete(id);
  return next;
}

export default function ProjectTableRows({
  project, entities, allProjects, showArchived, onProjectsChanged, isJumpTarget, onClearTarget, onJumpTo,
}: Props) {
  // Bumped by the detail when the project's tasks change — the rows read again.
  const [tasksVersion, setTasksVersion] = useState(0);
  const t = useProjectTasks({ projectId: project.id, entity_id: project.entity_id, showArchived, refreshKey: tasksVersion });
  const [detailsOpen, setDetailsOpen] = useState(false);
  // Which tasks have their edit inputs / their history open — each is a row the
  // project cell spans, so the count lives here.
  const [editIds, setEditIds] = useState<ReadonlySet<string>>(() => new Set());
  const [historyIds, setHistoryIds] = useState<ReadonlySet<string>>(() => new Set());

  // A dependency jump opens the target's details, where ProjectRow scrolls to
  // itself and flashes (ProjectRow's isJumpTarget effect) — as the queue card's
  // forceOpen did.
  useEffect(() => {
    if (isJumpTarget) setDetailsOpen(true);
  }, [isJumpTarget]);

  const book = entities.find((e) => e.id === project.entity_id);
  const openRows = t.tasks.reduce((n, task) => n + (editIds.has(task.id) ? 1 : 0) + (historyIds.has(task.id) ? 1 : 0), 0);
  const rowSpan = Math.max(t.tasks.length, 1) + openRows + (t.showCreate ? 1 : 0);

  const projectCell = (
    <td rowSpan={rowSpan} className="px-2 py-1.5 align-top border-t border-border w-64 min-w-[16rem]" data-project-cell>
      <div className="font-bold text-text-primary">{project.title}</div>
      <div className="mt-0.5 flex flex-wrap items-center gap-2">
        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_PILL_CLASSES[project.status]}`}>
          {STATUS_LABELS[project.status]}
        </span>
        <span className="text-text-muted" data-project-book>{book ? book.name : ACCOUNT_CELL_WORDS.bookNotLoaded}</span>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-2 text-[10px] text-text-muted" data-project-small-print>
        <span title="target completion date">target {formatDate(project.target_completion_date)}</span>
        {project.estimated_total_minutes !== null && <span title="estimated total minutes">est {project.estimated_total_minutes} min</span>}
        {!isBlankPlanValue(project.estimated_total_cost_usd) && <span title="estimated total cost">est ${project.estimated_total_cost_usd}</span>}
        {project.run_count !== undefined && <span title="pipe runs">{requestsWords(project.run_count)}</span>}
        {/* PROJECTS-UX-2: real allocated ledger money. No links / a failed rollup → nothing renders. */}
        {project.ledger_allocated && (
          <span className="font-mono tabular-nums font-bold text-text-primary" title="allocated from ledger" data-project-allocated>
            {formatAllocatedCents(project.ledger_allocated.cents)}
          </span>
        )}
        {t.tasks.length > 0 && <span data-project-status-counts>{statusCounts(t.tasks.map((task) => task.status))}</span>}
        {t.loading && t.tasks.length > 0 && <span className="italic">reading tasks…</span>}
      </div>
      {t.error && t.tasks.length > 0 && (
        <div className="mt-1 px-2 py-1 rounded border bg-red-50 border-red-200 text-red-800 text-xs">{t.error}</div>
      )}
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        <button type="button" onClick={t.startCreate} disabled={t.showCreate} className={actionClass} data-project-add-task>
          + task
        </button>
        <button
          type="button"
          onClick={() => setDetailsOpen((x) => !x)}
          className={actionClass}
          aria-expanded={detailsOpen}
          data-project-details-toggle
        >
          {detailsOpen ? 'hide details' : 'details'}
        </button>
      </div>
    </td>
  );

  return (
    <tbody className={project.status === 'archived' ? 'opacity-60' : undefined} data-project-rows={project.id}>
      {t.tasks.length === 0 ? (
        <tr data-project-no-tasks>
          {projectCell}
          <td className="px-2 py-1.5 align-top border-t border-border text-text-muted italic">
            {t.loading ? 'loading tasks…' : t.error ? (
              <span className="not-italic px-2 py-1 rounded border bg-red-50 border-red-200 text-red-800">{t.error}</span>
            ) : 'no tasks'}
          </td>
          {Array.from({ length: TASK_COLUMNS - 1 }, (_, i) => (
            <td key={i} className="border-t border-border" />
          ))}
        </tr>
      ) : (
        t.tasks.map((task, i) => (
          <TaskTableRow
            key={task.id}
            task={task}
            projectId={project.id}
            entities={entities}
            coaAccounts={t.coaAccounts}
            onChanged={t.fetchTasks}
            editing={editIds.has(task.id)}
            setEditing={(on) => setEditIds((s) => withId(s, task.id, on))}
            showHistory={historyIds.has(task.id)}
            setShowHistory={(on) => setHistoryIds((s) => withId(s, task.id, on))}
            projectCell={i === 0 ? projectCell : null}
          />
        ))
      )}
      {t.showCreate && (
        <tr data-project-create-task>
          <td colSpan={TASK_COLUMNS} className="p-2 border-t border-border-light">
            <TaskCreateInputs
              createForm={t.createForm}
              createSaving={t.createSaving}
              createError={t.createError}
              coaAccounts={t.coaAccounts}
              onCreateFormChange={t.setCreateForm}
              onCreate={t.handleCreate}
              onCancelCreate={t.cancelCreate}
            />
          </td>
        </tr>
      )}
      {detailsOpen && (
        <tr data-project-details>
          <td colSpan={PROJECTS_TABLE_COLUMNS} className="p-2 border-t border-border-light bg-bg-row">
            <ProjectRow
              project={project}
              entities={entities}
              allProjects={allProjects}
              onUpdate={onProjectsChanged}
              onDelete={onProjectsChanged}
              isJumpTarget={isJumpTarget}
              onClearTarget={onClearTarget}
              onJumpTo={onJumpTo}
              defaultExpanded
              withoutTaskSection
              onTasksChanged={() => setTasksVersion((n) => n + 1)}
            />
          </td>
        </tr>
      )}
    </tbody>
  );
}
