/**
 * ProjectsTable — PROJECTS, the brief as a table (PROJECTS-02, Alex, 2026-10-25).
 *
 * The shared DataTable (IDIOM-01) named 'projects' over the spec in
 * src/lib/operations/projectsTable.ts — one row per project, in the order the
 * GET returned them, Alex's columns in his order:
 *
 *   RANK · PROJECT · TYPE · BOOK · STATUS · TASKS · EST · ACTUAL · WHAT IS WRONG TODAY ·
 *   WHY IT MATTERS · THE ONE CORRECT OUTCOME · ALREADY RULED · WANT A RECOMMENDATION ON ·
 *   TARGET · WHY BY THEN · PROOF OF DONE · LINKS · NOTES · THE AUDIT · THE PLAN · SIZE ·
 *   CAPTURED · PROMOTED · SCHEDULED · DONE · ID · controls
 *
 *   · THE READS are the section's (unchanged, ruling E): the projects GET with
 *     include_archived by its "show archived" checkbox, handed in as `projects`;
 *     each project's tasks through useProjectTasks — one ProjectTasksReader per
 *     project LOADED, mounted here whether or not the row is shown, so TASKS and
 *     EST filter, sort and download over every row; the entity list for BOOK.
 *   · THE DEFAULT (ruling C) — "STATUS: open only" is a VISIBLE chip in the
 *     controls row, already applied: every status not in OPEN_PROJECT_STATUSES is
 *     dropped — completed, cancelled, dropped, and archived once "show archived"
 *     has read them. A click on it clears it; "clear filters" clears it with the
 *     rest. "show archived" is a read switch: when it changes, the filters start
 *     over at the default for what the read now returns (the ledger's rule when
 *     its period changes).
 *   · download CSV — the rows SHOWN, projects_<day>.csv, the full brief text in
 *     every TEXT field; "n of m rows" under the table.
 *   · The row (ProjectTableRows) draws the cells and "details"; the TEXT cells
 *     opened to all of their text are one state here (projectCellKeyOf).
 *
 * React state only: the filters, the sort, the open popover, the opened cells and
 * the tasks reads; nothing stored in the browser.
 *
 * HISTORY. PROJECTS-01 (2026-09-30) made the projects ONE table — a row per task
 * under its project; WORK-01 (Alex, 2026-10-24) left it two columns, Project ·
 * Tasks, when the task rows went to THE WORK. PROJECTS-02 made it the DataTable.
 */

'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import DataTable from '@/components/table/DataTable';
import { dataAttr } from '@/components/table/dataAttr';
import type { TableColumn } from '@/lib/table/columns';
import { filterOn, filterRows, noFilters, type TableFilters } from '@/lib/table/filters';
import { sortRows, type TableSort } from '@/lib/table/sort';
import { localToday } from '@/lib/localToday';
import { CLEAR_CHIP_MARK, rowCountWords, statusChipWords, statusDroppedOf, withoutStatusFilter } from '@/lib/operations/work';
import {
  PROJECT_TABLE_NAME, projectDefault, projectDefaultFilters, projectRowsOf, projectTable, projectsCsvFileName,
  type ProjectColumn, type ProjectTableRow, type ProjectTasksRead,
} from '@/lib/operations/projectsTable';
import type { Entity } from '../EntitySelector';
import ProjectTableRows, { ProjectTasksReader } from './ProjectTableRows';
import type { Project } from './types';

const chipOn = 'px-2 py-0.5 border border-brand-purple bg-brand-purple text-white rounded text-xs';
const name = PROJECT_TABLE_NAME;

interface Props {
  /** The projects as the GET returned them (the section's read). */
  projects: Project[];
  /** The tab's entity list (useOperationsEntity) — BOOK's names; the detail's books. */
  entities: Entity[];
  /** The section's read is in (its loading is over) — the table shows. */
  loaded: boolean;
  /** The section's one "show archived" — the tasks are read with it, and the default chip drops the archived once it is on. */
  showArchived: boolean;
  targetProjectId: string | null;
  onJumpTo: (projectId: string) => void;
  onClearTarget: () => void;
  /** Re-read the projects (a project was saved, archived or deleted). */
  onProjectsChanged: () => void;
  /** The section's loading, failed and nothing-yet lines — drawn between the controls and the table. */
  children?: ReactNode;
}

export default function ProjectsTable({ projects, entities, loaded, showArchived, targetProjectId, onJumpTo, onClearTarget, onProjectsChanged, children }: Props) {
  const columns: readonly TableColumn<ProjectTableRow, ProjectColumn>[] = useMemo(() => projectTable(entities), [entities]);
  const off = useMemo(() => noFilters(columns), [columns]);
  // One filter per column — STATUS dropping the default at first (ruling C); the sort; the open popover; the TEXT cells opened; each project's tasks read.
  const [filters, setFilters] = useState<TableFilters>(() => projectDefaultFilters(columns, showArchived));
  const [sort, setSort] = useState<TableSort<ProjectColumn> | null>(null);
  const [openFilter, setOpenFilter] = useState<ProjectColumn | null>(null);
  const [opened, setOpened] = useState<ReadonlySet<string>>(() => new Set());
  const [reads, setReads] = useState<ReadonlyMap<string, ProjectTasksRead>>(() => new Map());

  // Ruling C: "show archived" is the read switch — when it changes, the filters start over at the default for what the read now returns.
  useEffect(() => { setFilters(projectDefaultFilters(columns, showArchived)); }, [showArchived]); // eslint-disable-line react-hooks/exhaustive-deps

  const onRead = useCallback((projectId: string, read: ProjectTasksRead) => {
    setReads((prev) => { const next = new Map(prev); next.set(projectId, read); return next; });
  }, []);
  const toggleCell = useCallback((cellKey: string) => {
    setOpened((prev) => { const next = new Set(prev); if (next.has(cellKey)) next.delete(cellKey); else next.add(cellKey); return next; });
  }, []);

  const rows: readonly ProjectTableRow[] = useMemo(() => projectRowsOf(projects, reads), [projects, reads]);
  const shown = sortRows(filterRows(rows, filters, columns), sort, columns);
  const csv = loaded && shown.length > 0 ? { name: projectsCsvFileName(localToday()) } : null;

  const renderRow = (row: ProjectTableRow) => (
    <ProjectTableRows
      key={row.id}
      row={row}
      columns={columns}
      entities={entities}
      allProjects={projects}
      onProjectsChanged={onProjectsChanged}
      isJumpTarget={targetProjectId === row.id}
      onClearTarget={onClearTarget}
      onJumpTo={onJumpTo}
      opened={opened}
      onToggleCell={toggleCell}
    />
  );

  return (
    <>
      {/* Each project's tasks read — one hook per project loaded (useProjectTasks, as before), mounted whether or not its row is shown. */}
      {projects.map((p) => <ProjectTasksReader key={p.id} project={p} showArchived={showArchived} onRead={onRead} />)}
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
          // Ruling C: the STATUS filter is VISIBLE while it narrows — "STATUS: open only" at first, the values dropped otherwise; its click clears it.
          filterOn(filters, 'status', 'value') && (
            <button type="button" className={chipOn} onClick={() => setFilters(withoutStatusFilter(filters))} {...dataAttr(name, 'status-chip')}>
              {statusChipWords(statusDroppedOf(filters), projectDefault(showArchived))} {CLEAR_CHIP_MARK}
            </button>
          )
        )}
        renderRow={renderRow}
        foot={null}
      >
        {children}
      </DataTable>
      {loaded && rows.length > 0 && <p className="text-xs text-text-muted" {...dataAttr(name, 'count')}>{rowCountWords(shown.length, rows.length)}</p>}
    </>
  );
}
