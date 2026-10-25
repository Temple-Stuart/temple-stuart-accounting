/**
 * PROJECTS-02 (Alex, 2026-10-25) — PROJECTS IS THE BRIEF AS A TABLE, PURE.
 *
 * /tasks is three tables (WORK-01d); PROJECTS is the second, and it renders
 * through the shared DataTable (IDIOM-01) like THE WORK and ROUTINE EXPENSES:
 * table 'projects', one row per project, the brief's fields as columns — in
 * Alex's order and no other (ruling A):
 *
 *   RANK · PROJECT · TYPE · BOOK · STATUS · TASKS · EST · ACTUAL ·
 *   WHAT IS WRONG TODAY · WHY IT MATTERS · THE ONE CORRECT OUTCOME · ALREADY RULED ·
 *   WANT A RECOMMENDATION ON · TARGET · WHY BY THEN · PROOF OF DONE · LINKS · NOTES ·
 *   THE AUDIT · THE PLAN · SIZE · CAPTURED · PROMOTED · SCHEDULED · DONE · ID · controls
 *
 * THE CELLS (ruling B)
 *   · RANK      the project's rank (BACKLOG-02's reorder writes it) — blank "—",
 *               sorted as a number; the reorder itself stays THE LOG's ▲▼.
 *   · PROJECT   the title.  TYPE / STATUS / SIZE  the label maps' words
 *               (TYPE_LABELS · STATUS_LABELS · SIZE_LABELS).  BOOK  by name (the
 *               tab's entity list; a book it has not listed is said, never dropped).
 *   · TASKS     the tasks counted by status, as before (statusCounts), from the
 *               same tasks read (useProjectTasks); "loading tasks…" while it reads,
 *               the route's own words when it failed, "no tasks" when none.
 *   · EST       the SUM of the tasks' estimated_cost_usd (money) — the same cents
 *               THE WORK's ESTIMATE prints (work.ts estimateCentsOf); blank when no
 *               task carries one, never 0; the cell's tooltip declares the coverage,
 *               "n of m tasks carry an estimate". The project's own
 *               estimated_total_cost_usd and estimated_total_minutes are NOT printed
 *               (the row's edit view writes them through the project PATCH).
 *   · ACTUAL    ledger_allocated.cents — the Books rollup the projects GET layers
 *               on each row (PROJECTS-UX-2) — blank when null (no links) or absent
 *               (the rollup read failed; the route omits the field); tooltip
 *               "allocated from the books". The tasks' self-typed actual_cost_usd
 *               (the task PATCH) is NOT printed.
 *   · TEXT      WHAT IS WRONG TODAY problem · WHY IT MATTERS why · THE ONE CORRECT
 *               OUTCOME goal · ALREADY RULED rulings · WANT A RECOMMENDATION ON
 *               open_questions · WHY BY THEN deadline_reason · PROOF OF DONE
 *               definition_of_done · NOTES notes · THE AUDIT diagnosis · THE PLAN
 *               design. The head words are the brief's own (projectBrief.ts
 *               CAPTURE_QUESTIONS without the capture form's numbers, AUDIT_LABEL,
 *               PLAN_LABEL). The spec holds the FULL text: the filter and the sort
 *               read it, the CSV writes it; the SCREEN draws the journal tables'
 *               preview (journalTables.ts previewOf — the first 160 code points,
 *               "… (n chars)", "all of it" / "less"), re-exported below so the
 *               screen reads the one rule from here.
 *   · LINKS     one per line (links joined by a line break — the brief's own
 *               print); the CSV field carries the line breaks, quoted (csv.ts).
 *   · TARGET    target_completion_date's ISO day, drawn at local midnight (work.ts
 *               dayWords — COLUMNS-01), the ISO day under it for the sort and the CSV; CAPTURED created_at ·
 *               PROMOTED promoted_at · SCHEDULED scheduled_at · DONE done_at alike.
 *   · ID        the project's id (monospace on screen), in the CSV.
 *
 * THE DEFAULT (ruling C): "STATUS: open only" is a VISIBLE chip, already applied —
 * it drops every status that is NOT open. Open is morningLog.ts
 * OPEN_PROJECT_STATUSES, the one set THE LOG, the reorder route and THE WORK read,
 * applied here as the FILTER, never the read: the projects GET's default leaves
 * out the archived, so the chip drops completed, cancelled and dropped — and
 * archived once "show archived" has read them (projectDefault(true)).
 *
 * Pure: no React, no fetch, no clock (the CSV's day is handed in).
 */
import type { TableColumn } from '@/lib/table/columns';
import type { TableFilters } from '@/lib/table/filters';
import { numberKey } from '@/lib/table/sort';
import { BLANK } from '@/lib/table/words';
import { isOpenProjectStatus } from '@/lib/operations/morningLog';
import { AUDIT_LABEL, PLAN_LABEL, captureQuestion } from '@/lib/operations/projectBrief';
import {
  bookNameOf, dayWords, defaultFiltersOf, estimateCentsOf, isoDayOf, moneyColumn, textColumn, valueColumn, type NamedDefault, type WorkBook,
} from '@/lib/operations/work';
import type { Project, ProjectStatus, Task } from '@/components/workbench/operations/projects/types';
import { SIZE_LABELS, STATUS_LABELS, TYPE_LABELS } from '@/components/workbench/operations/projects/types';
import { statusCounts } from '@/components/workbench/operations/projects/projectsTableText';

// The long-text rule is the journal tables' (JOURNAL-07, ruling E) — one rule, read from here by PROJECTS' screen.
export { COLLAPSE_WORDS, EXPAND_WORDS, PREVIEW_CHARS, previewMoreWords, previewOf } from '@/lib/operations/journalTables';

// ── THE ROWS ─────────────────────────────────────────────────────────────────

/** One project's tasks read (useProjectTasks, per project): reading, failed in the route's words, or the tasks. */
export type ProjectTasksRead =
  | { readonly kind: 'loading' }
  | { readonly kind: 'failed'; readonly words: string }
  | { readonly kind: 'loaded'; readonly tasks: readonly Task[] };

/** One row of PROJECTS: the project and its tasks read. */
export interface ProjectTableRow { readonly id: string; readonly project: Project; readonly tasks: ProjectTasksRead }

/** A project whose hook has not reported yet — the hook mounts reading (useProjectTasks starts with loading true). */
const NOT_YET_REPORTED: ProjectTasksRead = { kind: 'loading' };

/** One row per project, in the order the GET returned them, each with the read its hook reported. */
export function projectRowsOf(projects: readonly Project[], reads: ReadonlyMap<string, ProjectTasksRead>): ProjectTableRow[] {
  return projects.map((project) => {
    const read = reads.get(project.id);
    return { id: project.id, project, tasks: read === undefined ? NOT_YET_REPORTED : read };
  });
}

// ── THE COLUMNS ──────────────────────────────────────────────────────────────

export const PROJECT_COLUMNS = [
  'rank', 'title', 'type', 'book', 'status', 'tasks', 'est', 'actual',
  'problem', 'why', 'goal', 'rulings', 'open_questions', 'target', 'deadline_reason', 'definition_of_done', 'links', 'notes',
  'diagnosis', 'design', 'size', 'captured', 'promoted', 'scheduled', 'done', 'id',
] as const;
export type ProjectColumn = (typeof PROJECT_COLUMNS)[number];

/** The brief's head word for a capture question — its label without the capture form's number ("1 WHAT IS WRONG TODAY" → "WHAT IS WRONG TODAY"). */
const briefLabel = (key: string): string => captureQuestion(key).label.replace(/^\d+ /, '');

export const PROJECT_HEAD_WORDS: Readonly<Record<ProjectColumn, string>> = {
  rank: 'RANK', title: 'PROJECT', type: 'TYPE', book: 'BOOK', status: 'STATUS', tasks: 'TASKS', est: 'EST', actual: 'ACTUAL',
  problem: briefLabel('problem'), why: briefLabel('why'), goal: briefLabel('goal'), rulings: briefLabel('rulings'), open_questions: briefLabel('open_questions'),
  target: 'TARGET', deadline_reason: 'WHY BY THEN', definition_of_done: briefLabel('definition_of_done'), links: briefLabel('links'), notes: briefLabel('notes'),
  diagnosis: AUDIT_LABEL, design: PLAN_LABEL, size: briefLabel('size'), captured: 'CAPTURED', promoted: 'PROMOTED', scheduled: 'SCHEDULED', done: 'DONE', id: 'ID',
};
/** The CALCULATED columns' head tooltips — each names its rule (ROUTINES-03's convention). */
export const PROJECT_TOOLTIPS: Readonly<Partial<Record<ProjectColumn, string>>> = {
  est: 'calculated: the sum of the tasks\' estimates — a task without one adds nothing',
  actual: 'calculated: the postings allocated to the project in Books',
};
export const PROJECT_TABLE_NAME = 'projects';

// ── THE CELLS ────────────────────────────────────────────────────────────────

/** A brief field as text: null, and a blank or all-space string, are "not stated" — a blank cell. */
const textOrNull = (text: string | null | undefined): string | null => (text == null || text.trim() === '' ? null : text);

export const projectTypeOf = (row: ProjectTableRow): string | null => (row.project.type === null ? null : TYPE_LABELS[row.project.type]);
export const projectSizeOf = (row: ProjectTableRow): string | null => (row.project.size === null ? null : SIZE_LABELS[row.project.size]);
export const projectStatusOf = (row: ProjectTableRow): string => STATUS_LABELS[row.project.status];

export const TASKS_LOADING_WORDS = 'loading tasks…';
export const NO_TASKS_WORDS = 'no tasks';
/** TASKS: the counts by status (statusCounts, as before); "loading tasks…" while the hook reads; the route's words when it failed; "no tasks" when none. */
export function projectTasksWordsOf(row: ProjectTableRow): string {
  const read = row.tasks;
  if (read.kind === 'loading') return TASKS_LOADING_WORDS;
  if (read.kind === 'failed') return read.words;
  return read.tasks.length === 0 ? NO_TASKS_WORDS : statusCounts(read.tasks.map((task) => task.status));
}

/** EST's sum and its coverage: the cents (null when no task carries an estimate), how many tasks carry one, of how many. */
export interface EstimateSum { readonly cents: number | null; readonly counted: number; readonly of: number }
/** The sum of the tasks' estimates — each task's cents by THE WORK's rule (estimateCentsOf); a task without one adds nothing and is not counted. */
export function estimateSumOf(tasks: readonly Pick<Task, 'estimated_cost_usd'>[]): EstimateSum {
  let cents = 0;
  let counted = 0;
  for (const task of tasks) {
    const c = estimateCentsOf(task);
    if (c === null) continue;
    cents += c;
    counted += 1;
  }
  return { cents: counted === 0 ? null : cents, counted, of: tasks.length };
}
/** "2 of 3 tasks carry an estimate" — the EST cell's tooltip. */
export const estimateCoverageWords = (sum: EstimateSum): string => `${sum.counted} of ${sum.of} tasks carry an estimate`;
/** The row's EST, once its tasks are read; null while they are not. */
export const projectEstimateOf = (row: ProjectTableRow): EstimateSum | null => (row.tasks.kind === 'loaded' ? estimateSumOf(row.tasks.tasks) : null);
export function projectEstimateCentsOf(row: ProjectTableRow): number | null {
  const sum = projectEstimateOf(row);
  return sum === null ? null : sum.cents;
}

export const ACTUAL_TOOLTIP_WORDS = 'allocated from the books';
/** ACTUAL in cents: the Books rollup on the row; null when the project has no links (null) or the rollup was not read (absent). */
export const projectActualCentsOf = (row: ProjectTableRow): number | null => (row.project.ledger_allocated == null ? null : row.project.ledger_allocated.cents);

/** The brief's text fields, by column key. */
export const PROJECT_TEXT_FIELDS = {
  problem: 'problem', why: 'why', goal: 'goal', rulings: 'rulings', open_questions: 'open_questions', deadline_reason: 'deadline_reason',
  definition_of_done: 'definition_of_done', notes: 'notes', diagnosis: 'diagnosis', design: 'design',
} as const satisfies Partial<Record<ProjectColumn, keyof Project>>;
export type ProjectTextColumn = keyof typeof PROJECT_TEXT_FIELDS;
export const projectTextOf = (row: ProjectTableRow, column: ProjectTextColumn): string | null => textOrNull(row.project[PROJECT_TEXT_FIELDS[column]]);
/** LINKS, one per line — the brief's own print (projectBrief.ts: links.join('\n')); none is blank. */
export const projectLinksOf = (row: ProjectTableRow): string | null => (row.project.links.length === 0 ? null : row.project.links.join('\n'));

/** The dates, by column key: the project's ISO instant (null when unset). */
export const PROJECT_DATE_FIELDS = {
  target: 'target_completion_date', captured: 'created_at', promoted: 'promoted_at', scheduled: 'scheduled_at', done: 'done_at',
} as const satisfies Partial<Record<ProjectColumn, keyof Project>>;
export type ProjectDateColumn = keyof typeof PROJECT_DATE_FIELDS;
export const projectDateOf = (row: ProjectTableRow, column: ProjectDateColumn): string | null => row.project[PROJECT_DATE_FIELDS[column]];
/**
 * A date column: the ISO day under it (isoDayOf — what it sorts by and writes) drawn at LOCAL midnight (dayWords), as THE WORK's DEADLINE
 * and DONE and ROUTINE EXPENSES' START · END · NEXT are. COLUMNS-01 (Alex, 2026-10-25, ruling B): formatDate(instant) drew the instant in the
 * viewer's zone, which west of Greenwich was the day before the ISO day under it — one rule now, one place (work.ts dayWords).
 */
const dateColumn = (column: ProjectDateColumn): TableColumn<ProjectTableRow, ProjectColumn> =>
  valueColumn<ProjectTableRow, ProjectColumn>(column, PROJECT_HEAD_WORDS[column], (r) => { const d = isoDayOf(projectDateOf(r, column)); return d === null ? null : dayWords(d); }, (r) => isoDayOf(projectDateOf(r, column)));

/** PROJECTS' spec, over the tab's books (BOOK names them). */
export function projectTable(books: readonly WorkBook[]): readonly TableColumn<ProjectTableRow, ProjectColumn>[] {
  const head = PROJECT_HEAD_WORDS;
  const columns: TableColumn<ProjectTableRow, ProjectColumn>[] = [
    // RANK sorts as a number — blank last in both directions (sort.ts).
    { key: 'rank', label: head.rank, kind: 'value', words: (r) => (r.project.rank === null ? BLANK : String(r.project.rank)), sortKey: (r) => numberKey(r.project.rank), csv: (r) => (r.project.rank === null ? '' : String(r.project.rank)) },
    textColumn<ProjectTableRow, ProjectColumn>('title', head.title, (r) => r.project.title),
    valueColumn<ProjectTableRow, ProjectColumn>('type', head.type, projectTypeOf),
    valueColumn<ProjectTableRow, ProjectColumn>('book', head.book, (r) => bookNameOf(books, r.project.entity_id)),
    valueColumn<ProjectTableRow, ProjectColumn>('status', head.status, projectStatusOf),
    textColumn<ProjectTableRow, ProjectColumn>('tasks', head.tasks, projectTasksWordsOf),
    moneyColumn<ProjectTableRow, ProjectColumn>('est', head.est, projectEstimateCentsOf),
    moneyColumn<ProjectTableRow, ProjectColumn>('actual', head.actual, projectActualCentsOf),
    textColumn<ProjectTableRow, ProjectColumn>('problem', head.problem, (r) => projectTextOf(r, 'problem')),
    textColumn<ProjectTableRow, ProjectColumn>('why', head.why, (r) => projectTextOf(r, 'why')),
    textColumn<ProjectTableRow, ProjectColumn>('goal', head.goal, (r) => projectTextOf(r, 'goal')),
    textColumn<ProjectTableRow, ProjectColumn>('rulings', head.rulings, (r) => projectTextOf(r, 'rulings')),
    textColumn<ProjectTableRow, ProjectColumn>('open_questions', head.open_questions, (r) => projectTextOf(r, 'open_questions')),
    dateColumn('target'),
    textColumn<ProjectTableRow, ProjectColumn>('deadline_reason', head.deadline_reason, (r) => projectTextOf(r, 'deadline_reason')),
    textColumn<ProjectTableRow, ProjectColumn>('definition_of_done', head.definition_of_done, (r) => projectTextOf(r, 'definition_of_done')),
    textColumn<ProjectTableRow, ProjectColumn>('links', head.links, projectLinksOf),
    textColumn<ProjectTableRow, ProjectColumn>('notes', head.notes, (r) => projectTextOf(r, 'notes')),
    textColumn<ProjectTableRow, ProjectColumn>('diagnosis', head.diagnosis, (r) => projectTextOf(r, 'diagnosis')),
    textColumn<ProjectTableRow, ProjectColumn>('design', head.design, (r) => projectTextOf(r, 'design')),
    valueColumn<ProjectTableRow, ProjectColumn>('size', head.size, projectSizeOf),
    dateColumn('captured'),
    dateColumn('promoted'),
    dateColumn('scheduled'),
    dateColumn('done'),
    textColumn<ProjectTableRow, ProjectColumn>('id', head.id, (r) => r.project.id),
  ];
  return columns.map((c) => (PROJECT_TOOLTIPS[c.key] === undefined ? c : { ...c, title: PROJECT_TOOLTIPS[c.key] }));
}

// ── THE DEFAULT CHIP (ruling C) ──────────────────────────────────────────────

export const PROJECT_DEFAULT_WORDS = 'STATUS: open only';
/**
 * The statuses the chip drops: every status NOT in OPEN_PROJECT_STATUSES (the one set, morningLog.ts) — in STATUS_LABELS' words, since the
 * filter matches the cell — and among them archived only once "show archived" has read them (the GET's default returns none).
 */
export const projectDefault = (archivedRead: boolean): NamedDefault => ({
  dropped: (Object.keys(STATUS_LABELS) as ProjectStatus[])
    .filter((status) => !isOpenProjectStatus(status) && (archivedRead || status !== 'archived'))
    .map((status) => STATUS_LABELS[status]),
  words: PROJECT_DEFAULT_WORDS,
});
export const projectDefaultFilters = (columns: readonly TableColumn<ProjectTableRow, ProjectColumn>[], archivedRead: boolean): TableFilters =>
  defaultFiltersOf(columns, 'status', projectDefault(archivedRead));

// ── THE SCREEN'S WORDS ───────────────────────────────────────────────────────

/** One opened state per TEXT cell: the row's id and the column's key (the journal tables' cellKeyOf, over this table's rows). */
export const projectCellKeyOf = (row: ProjectTableRow, column: ProjectColumn): string => `${row.id}:${column}`;
export const DETAILS_WORDS = 'details';
export const HIDE_DETAILS_WORDS = 'hide details';
/** "projects_2026-10-25.csv" — the day the CSV was downloaded (the viewer's local day). */
export const projectsCsvFileName = (day: string): string => `projects_${day}.csv`;
