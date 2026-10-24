/**
 * ProjectTableRows — one project as rows of the projects table (PROJECTS-01, 2026-09-30).
 *
 * WORK-01 (Alex, 2026-10-24) — ruling E and ruling 3: PROJECTS keeps project
 * rows only. The task rows left this table (THE WORK, SectionE_Work, is their
 * one home), and with them "+ task" on the project row (THE WORK's "+ task" is
 * the one door on /tasks; THE LOG's on the morning card stays — BACKLOG-02),
 * TaskTableRow, the create row and the rows a task opened. A project is ONE row:
 * its cell, and a Tasks cell counting its tasks by status (the small print's
 * line, moved) through the same tasks read (useProjectTasks — the section's
 * "show archived" still reaches it). "details" opens the project's existing
 * detail — <ProjectRow> with every control it has, WITHOUT its task list — as a
 * full-width row directly under it. The brief (BACKLOG-01b) is unchanged.
 *
 * The project's cell holds the title, the status pill, the book, the small
 * print (target date, the estimates when set, the requests, the money
 * allocated from the ledger) and its control: details.
 *
 * BACKLOG-01 (Alex, 2026-10-20): TYPE and SIZE pills beside the status pill —
 * "—" when the row has none (captured before the capture form). The book was
 * already named here (PROJECTS-01); with every book listed (ruling G) it is the
 * cell's second line.
 */

'use client';

import { useEffect, useState } from 'react';
import { ACCOUNT_CELL_WORDS, type AccountCellBook } from '@/lib/coa/accountCell';
import { isBlankPlanValue } from '@/lib/operations/planMoney';
import ProjectRow from './ProjectRow';
import type { Project } from './types';
import { SIZE_LABELS, STATUS_LABELS, STATUS_PILL_CLASSES, TYPE_LABELS, formatAllocatedCents } from './types';
import { useProjectTasks } from './useProjectTasks';
import { PROJECTS_TABLE_COLUMNS, formatDate, requestsWords, statusCounts } from './projectsTableText';


const actionClass =
  'px-2 py-0.5 border border-border rounded hover:bg-bg-row disabled:opacity-50 text-xs';

interface Props {
  project: Project;
  /** The tab's entity list (useOperationsEntity) — the book's name and letter. */
  entities: (AccountCellBook & { name: string })[];
  allProjects: Project[];
  /** The section's one "show archived": archived tasks are counted too. */
  showArchived: boolean;
  /** Re-read the projects (a project was saved, archived or deleted). */
  onProjectsChanged: () => void;
  isJumpTarget: boolean;
  onClearTarget: () => void;
  onJumpTo: (projectId: string) => void;
}

export default function ProjectTableRows({
  project, entities, allProjects, showArchived, onProjectsChanged, isJumpTarget, onClearTarget, onJumpTo,
}: Props) {
  // Bumped by the detail when the project's tasks change — the count reads again.
  const [tasksVersion, setTasksVersion] = useState(0);
  const t = useProjectTasks({ projectId: project.id, entity_id: project.entity_id, showArchived, refreshKey: tasksVersion });
  const [detailsOpen, setDetailsOpen] = useState(false);

  // A dependency jump opens the target's details, where ProjectRow scrolls to
  // itself and flashes (ProjectRow's isJumpTarget effect) — as the queue card's
  // forceOpen did.
  useEffect(() => {
    if (isJumpTarget) setDetailsOpen(true);
  }, [isJumpTarget]);

  const book = entities.find((e) => e.id === project.entity_id);

  const projectCell = (
    <td className="px-2 py-1.5 align-top border-t border-border w-64 min-w-[16rem]" data-project-cell>
      <div className="font-bold text-text-primary">{project.title}</div>
      <div className="mt-0.5 flex flex-wrap items-center gap-2">
        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_PILL_CLASSES[project.status]}`}>
          {STATUS_LABELS[project.status]}
        </span>
        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border border-border text-text-muted" title="type" data-project-type>
          {project.type ? TYPE_LABELS[project.type] : '—'}
        </span>
        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border border-border text-text-muted" title="size" data-project-size>
          {project.size ? SIZE_LABELS[project.size] : '—'}
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
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
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
      <tr data-project-row>
        {projectCell}
        {/* WORK-01: the tasks counted by status — the one line the task rows left behind; the rows themselves are THE WORK's. */}
        <td className="px-2 py-1.5 align-top border-t border-border text-text-muted" data-project-tasks>
          {t.loading ? (
            <span className="italic">loading tasks…</span>
          ) : t.error ? (
            <span className="not-italic px-2 py-1 rounded border bg-red-50 border-red-200 text-red-800">{t.error}</span>
          ) : t.tasks.length === 0 ? (
            <span className="italic">no tasks</span>
          ) : (
            <span data-project-status-counts>{statusCounts(t.tasks.map((task) => task.status))}</span>
          )}
        </td>
      </tr>
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
