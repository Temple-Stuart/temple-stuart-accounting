/**
 * ProjectTableRows — one project as a row of PROJECTS, and its tasks read.
 *
 * PROJECTS-02 (Alex, 2026-10-25): PROJECTS is the brief as a table — the shared
 * DataTable (IDIOM-01) over src/lib/operations/projectsTable.ts, like THE WORK
 * and ROUTINE EXPENSES. Two pieces live here:
 *
 *   · ProjectTasksReader — one per project LOADED, mounted by ProjectsTable
 *     whether or not the row is shown: the same tasks read as before
 *     (useProjectTasks — the section's "show archived" still reaches it, and the
 *     page's task-change signal re-reads it), reported up as the row's tasks read,
 *     so TASKS and EST filter, sort and download over every row loaded, not only
 *     the rows on screen. It draws nothing.
 *   · ProjectTableRows — the row: the spec's cells (WorkCell; a TEXT cell draws the
 *     journal tables' preview — the first 160 code points, "… (n chars)" and
 *     "all of it" / "less", one opened state per cell held by the table), EST
 *     and ACTUAL with their tooltips, then the one control: "details", which
 *     opens the project's existing detail — <ProjectRow> with every control it
 *     has, the brief and its task list — as a full-width row directly under it.
 *
 * Ruling D: a project saved, archived, unarchived or deleted in the detail
 * re-reads the projects AND bumps the page's WorkChanges signal (projectChanged),
 * so THE WORK re-reads without a reload — a task of a project archived here
 * leaves THE WORK at once.
 *
 * HISTORY. PROJECTS-01 (2026-09-30) made the projects one table with a row per
 * task; WORK-01 (Alex, 2026-10-24, ruling E) took the task rows to THE WORK and
 * left a project cell (title, pills, book, the small print) and a Tasks cell;
 * WORK-01d (Alex, 2026-10-25, ruling B): the detail keeps its task list again —
 * THE WORK reads only the OPEN projects' tasks, so a task of an archived,
 * completed, dropped or cancelled project has its home here (PROJECTS → show
 * archived → the row's details). WORK-01b (Alex, 2026-10-24, ruling 3): the
 * tasks read follows the page's task-change signal (WorkChanges); the detail's
 * task writes bump the same signal. BACKLOG-01 (Alex, 2026-10-20): TYPE and
 * SIZE beside STATUS, "—" when the row has none — now three columns.
 */

'use client';

import { Fragment, useEffect, useState } from 'react';
import { cellClass as cell } from '@/components/table/DataTable';
import { dataAttr } from '@/components/table/dataAttr';
import type { TableColumn } from '@/lib/table/columns';
import { BLANK } from '@/lib/table/words';
import {
  ACTUAL_TOOLTIP_WORDS, COLLAPSE_WORDS, DETAILS_WORDS, EXPAND_WORDS, HIDE_DETAILS_WORDS, PROJECT_TABLE_NAME, estimateCoverageWords, previewOf,
  projectActualCentsOf, projectCellKeyOf, projectEstimateOf, type ProjectColumn, type ProjectTableRow, type ProjectTasksRead,
} from '@/lib/operations/projectsTable';
import { useWorkChanges } from '../WorkChanges';
import type { Entity } from '../EntitySelector';
import { WorkCell } from '../workShared';
import ProjectRow from './ProjectRow';
import type { Project } from './types';
import { useProjectTasks } from './useProjectTasks';

const name = PROJECT_TABLE_NAME;
const actionClass = 'px-2 py-0.5 border border-border rounded hover:bg-bg-row disabled:opacity-50 text-xs';
const link = 'underline text-brand-purple hover:text-text-primary';

interface ReaderProps {
  project: Project;
  /** The section's one "show archived": archived tasks are read (and counted, and summed) too. */
  showArchived: boolean;
  /** The read, every time it changes — the table keeps one per project for its rows. */
  onRead: (projectId: string, read: ProjectTasksRead) => void;
}

/** One project's tasks read — the hook as before, reported up; draws nothing. */
export function ProjectTasksReader({ project, showArchived, onRead }: ReaderProps) {
  // The page's task-change signal (WORK-01b): the read runs again whenever a task changes anywhere on /tasks.
  const { version } = useWorkChanges();
  const t = useProjectTasks({ projectId: project.id, entity_id: project.entity_id, showArchived, refreshKey: version });
  useEffect(() => {
    onRead(project.id, t.loading ? { kind: 'loading' } : t.error !== null ? { kind: 'failed', words: t.error } : { kind: 'loaded', tasks: t.tasks });
  }, [onRead, project.id, t.loading, t.error, t.tasks]);
  return null;
}

interface Props {
  row: ProjectTableRow;
  columns: readonly TableColumn<ProjectTableRow, ProjectColumn>[];
  /** The tab's entity list (useOperationsEntity) — the detail's book names and letters. */
  entities: Entity[];
  allProjects: Project[];
  /** Re-read the projects (a project was saved, archived or deleted). */
  onProjectsChanged: () => void;
  isJumpTarget: boolean;
  onClearTarget: () => void;
  onJumpTo: (projectId: string) => void;
  /** The TEXT cells opened to all of their text (projectCellKeyOf), and the click that opens or closes one. */
  opened: ReadonlySet<string>;
  onToggleCell: (cellKey: string) => void;
}

export default function ProjectTableRows({ row, columns, entities, allProjects, onProjectsChanged, isJumpTarget, onClearTarget, onJumpTo, opened, onToggleCell }: Props) {
  const { project } = row;
  // The page's task-change signal (WORK-01b): the detail's task writes bump it, so THE WORK re-reads too.
  const { bump } = useWorkChanges();
  const [detailsOpen, setDetailsOpen] = useState(false);

  // A dependency jump opens the target's details, where ProjectRow scrolls to
  // itself and flashes (ProjectRow's isJumpTarget effect) — as the queue card's
  // forceOpen did.
  useEffect(() => {
    if (isJumpTarget) setDetailsOpen(true);
  }, [isJumpTarget]);

  // Ruling D: a project saved, archived, unarchived or deleted re-reads the projects AND bumps the page's signal — THE WORK re-reads without a reload.
  const projectChanged = () => {
    onProjectsChanged();
    bump();
  };

  return (
    <Fragment>
      <tr className={'border-t border-border ' + (project.status === 'archived' ? 'opacity-60' : '')} {...dataAttr(name, 'row', row.id)}>
        {columns.map((c) => <ProjectCell key={c.key} column={c} row={row} open={opened.has(projectCellKeyOf(row, c.key))} onToggle={() => onToggleCell(projectCellKeyOf(row, c.key))} />)}
        <td className={cell}>
          <button type="button" onClick={() => setDetailsOpen((x) => !x)} className={actionClass} aria-expanded={detailsOpen} {...dataAttr(name, 'details-toggle')}>
            {detailsOpen ? HIDE_DETAILS_WORDS : DETAILS_WORDS}
          </button>
        </td>
      </tr>
      {detailsOpen && (
        <tr {...dataAttr(name, 'details', row.id)}>
          <td colSpan={columns.length + 1} className="p-2 border-t border-border-light bg-bg-row">
            <ProjectRow
              project={project}
              entities={entities}
              allProjects={allProjects}
              onUpdate={projectChanged}
              onDelete={projectChanged}
              isJumpTarget={isJumpTarget}
              onClearTarget={onClearTarget}
              onJumpTo={onJumpTo}
              defaultExpanded
              onTasksChanged={bump}
            />
          </td>
        </tr>
      )}
    </Fragment>
  );
}

/** One cell: a TEXT column through the preview; EST and ACTUAL with their tooltips; every other through the shared cell. */
function ProjectCell({ column, row, open, onToggle }: { column: TableColumn<ProjectTableRow, ProjectColumn>; row: ProjectTableRow; open: boolean; onToggle: () => void }) {
  if (column.kind === 'text') return <TextCell column={column.key} text={column.text(row)} open={open} onToggle={onToggle} />;
  if (column.key === 'est') {
    const sum = projectEstimateOf(row);
    return <WorkCell name={name} column={column} row={row} title={sum !== null && sum.of > 0 ? estimateCoverageWords(sum) : undefined} />;
  }
  if (column.key === 'actual') return <WorkCell name={name} column={column} row={row} title={projectActualCentsOf(row) === null ? undefined : ACTUAL_TOOLTIP_WORDS} />;
  return <WorkCell name={name} column={column} row={row} />;
}

/** A TEXT cell, as the journal tables draw one (JournalDayTable.tsx): the full text when it fits or when opened; else its first 160 code points, how many there are, and the control. */
function TextCell({ column, text, open, onToggle }: { column: ProjectColumn; text: string | null; open: boolean; onToggle: () => void }) {
  if (text === null) return <td className={`${cell} text-text-faint`} {...dataAttr(name, 'cell', column)}>{BLANK}</td>;
  const preview = previewOf(text);
  return (
    <td className={`${cell} max-w-[24rem] whitespace-pre-line break-words`} {...dataAttr(name, 'cell', column)} {...dataAttr(name, 'cell-open', open ? '' : undefined)}>
      {open || preview.more === null ? text : preview.shown}
      {preview.more !== null && (
        <>
          {!open && <span className="text-text-faint"> {preview.more}</span>}
          {' '}
          <button type="button" className={link} onClick={onToggle} {...dataAttr(name, 'cell-toggle')}>{open ? COLLAPSE_WORDS : EXPAND_WORDS}</button>
        </>
      )}
    </td>
  );
}
