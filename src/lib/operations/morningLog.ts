/**
 * morningLog — the morning card's running log (BACKLOG-02, Alex, 2026-10-20). Pure: no read, no write, no React.
 *
 * Alex, 15:42: "the morning card — it's a running log of all the projects that are ongoing and tasks that need to
 * be executed, and I need a way to rank them, and also add to them if needed, or adjust the scope if things are
 * evolving."
 *
 * The rulings this file holds the rules for:
 *   A. THE LOG — every OPEN project (OPEN_PROJECT_STATUSES), every book, in rank order (logOrder: rank asc,
 *      unranked last, then title); under each, its OPEN tasks (OPEN_TASK_STATUSES) in display_order.
 *   B. RANK — ▲ ▼ move a project one place (moveInLog, a pure list operation); the whole ordered list goes to
 *      PATCH /api/operations/projects/reorder, which checks it with reorderCheck (refused by name: an id listed
 *      twice, an id that is not one of the user's projects, a project that is not open, an open project missing)
 *      and writes ranksAfter — 1..n — in one transaction. Unranked projects get ranks the first time it is saved.
 *   C/D. THE DOORS TO /tasks — "+ project" is a LINK (newProjectHref: /tasks?new=project opens the capture form
 *      there; TOOL-LAW-01, the form is Tasks' and is never mounted on the card) and a project's title is a LINK to
 *      its row (projectHref: /tasks?project=<id>, opened and scrolled to). The list on /tasks reads the same
 *      param names from here — one contract, two ends.
 *   E. PICK TODAY'S — picksToGoals: the picked tasks' titles to APPEND to the goals box, never replacing typed
 *      goals, duplicates skipped (against the box and among the picks), order kept; appendGoalLines writes them
 *      under what is typed. Picking does not schedule.
 *
 * Imports only TYPES from journal.ts (no runtime cycle: journal.ts imports logOrder from here).
 */
import type { ReflectionBacklogRow } from './journal';

// ── A · WHAT IS OPEN ────────────────────────────────────────────────────────

/**
 * A project not done — what THE LOG lists and what the reorder ranks (ruling A); the reflection prompt's THE BACKLOG
 * reads the same set (dayReads.ts BACKLOG_STATUSES). BACKLOG-02b (Alex, 2026-10-20): `not_started` is open work — the
 * schema's default status, and discovery creates projects that way (lib/discovery/materializeProposal.ts) — so it is in
 * the set: never invisible in the log, rankable, and in THE BACKLOG.
 */
export const OPEN_PROJECT_STATUSES = ['backlog', 'scoped', 'scheduled', 'in_progress', 'blocked', 'not_started'] as const;
/** A task not done — what THE LOG lists under its project (ruling A); the projects GET's open_task_count counts the same four. */
export const OPEN_TASK_STATUSES = ['open', 'in_progress', 'blocked', 'pending_review'] as const;
export const isOpenProjectStatus = (status: string): boolean => (OPEN_PROJECT_STATUSES as readonly string[]).includes(status);

/** One open task under its project, as the projects GET answers it (open_tasks). */
export interface LogTask {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly displayOrder: number;
}
/** WORK-02 (Alex, 2026-10-26): one task done today under its project, as the projects GET answers it (done_tasks, when asked for a window). */
export interface LogDoneTask {
  readonly id: string;
  readonly title: string;
  /** The completion's instant, ISO text — THE WORK BLOCK narrows to the block by it. */
  readonly completedAt: string;
}
/** One open project of THE LOG — the reflection prompt's backlog row (journal.ts) plus what the card acts on. */
export interface LogProject extends ReflectionBacklogRow {
  readonly id: string;
  readonly entityId: string;
  /** Its open tasks, in display_order. */
  readonly tasks: readonly LogTask[];
  /** WORK-02: its tasks done in the window the read asked for (completed_at order) — present only when a window was asked. */
  readonly doneTasks?: readonly LogDoneTask[];
}

/** Rank order: rank ascending, unranked last, then by title — the same order however the rows arrive. */
export const logOrder = <T extends { readonly rank: number | null; readonly title: string }>(rows: readonly T[]): T[] =>
  [...rows].sort((a, b) => (a.rank === null && b.rank === null ? 0 : a.rank === null ? 1 : b.rank === null ? -1 : a.rank - b.rank) || a.title.localeCompare(b.title));

// ── B · THE RANK ────────────────────────────────────────────────────────────

export type LogMove = 'up' | 'down';
/** Can `id` move one place `move` in `ids`? Not the first up, not the last down, not an id that is not listed. */
export function canMove(ids: readonly string[], id: string, move: LogMove): boolean {
  const at = ids.indexOf(id);
  if (at === -1) return false;
  return move === 'up' ? at > 0 : at < ids.length - 1;
}
/** `ids` with `id` moved one place `move`; everything else keeps its order. Throws when it cannot move — the card disables that button. */
export function moveInLog(ids: readonly string[], id: string, move: LogMove): string[] {
  if (!canMove(ids, id, move)) throw new Error(`moveInLog: ${id} cannot move ${move} in a list of ${ids.length}`);
  const at = ids.indexOf(id);
  const to = move === 'up' ? at - 1 : at + 1;
  const next = [...ids];
  next[at] = next[to];
  next[to] = id;
  return next;
}
/** The ranks a saved list writes: its order, 1..n. */
export const ranksAfter = (ids: readonly string[]): { readonly id: string; readonly rank: number }[] => ids.map((id, i) => ({ id, rank: i + 1 }));

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** A project id is a UUID (operations_projects.id @db.Uuid) — anything else is never sent to the database. */
export const isProjectId = (id: string): boolean => UUID.test(id);

/** The reorder body's shape: { ids: string[] } — or why not, by name. */
export type ReorderIds = { readonly ok: true; readonly ids: readonly string[] } | { readonly ok: false; readonly rule: 'shape'; readonly message: string };
export const REORDER_SHAPE_WORDS = 'ids must be the list of your open projects\' ids, in order';
export function reorderIds(body: unknown): ReorderIds {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return { ok: false, rule: 'shape', message: REORDER_SHAPE_WORDS };
  const ids = (body as Record<string, unknown>).ids;
  if (!Array.isArray(ids) || !ids.every((id) => typeof id === 'string' && id !== '')) return { ok: false, rule: 'shape', message: REORDER_SHAPE_WORDS };
  return { ok: true, ids: ids as string[] };
}

/** One of the user's projects as the route reads it inside its transaction — every listed id the user owns, and every open project. */
export interface OwnedProject {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly rank: number | null;
}
export type ReorderRule = 'duplicate' | 'not_yours' | 'not_open' | 'missing';
export type ReorderCheck = { readonly ok: true } | { readonly ok: false; readonly rule: ReorderRule; readonly message: string };

export const duplicateWords = (id: string): string => `${id} is listed twice — each open project appears once`;
/** The same words whether the id belongs to another user or to no one: the route never confirms another user's row exists. */
export const notYoursWords = (id: string): string => `${id} is not one of your projects`;
export const notOpenWords = (title: string, status: string): string =>
  `"${title}" is ${status} — only open projects (${OPEN_PROJECT_STATUSES.join(' · ')}) are ranked`;
export const missingWords = (titles: readonly string[]): string =>
  `the list is missing ${titles.length} open project${titles.length === 1 ? '' : 's'}: ${titles.map((t) => `"${t}"`).join(', ')} — send every open project, in order`;

/**
 * Ruling B's four refusals, checked in this order, the first one named: an id listed twice; an id that is not one of the
 * user's projects (or is not a project id at all); a project of the user's that is not open; an open project of the
 * user's that the list leaves out. `owned` is what the route read for this user — the listed ids it owns and every open
 * project — so nothing here can see another user's row.
 */
export function reorderCheck(ids: readonly string[], owned: readonly OwnedProject[]): ReorderCheck {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) return { ok: false, rule: 'duplicate', message: duplicateWords(id) };
    seen.add(id);
  }
  const byId = new Map(owned.map((p) => [p.id, p]));
  for (const id of ids) if (!isProjectId(id) || !byId.has(id)) return { ok: false, rule: 'not_yours', message: notYoursWords(id) };
  for (const id of ids) {
    const p = byId.get(id) as OwnedProject;
    if (!isOpenProjectStatus(p.status)) return { ok: false, rule: 'not_open', message: notOpenWords(p.title, p.status) };
  }
  const missing = logOrder(owned.filter((p) => isOpenProjectStatus(p.status) && !seen.has(p.id))).map((p) => p.title);
  if (missing.length > 0) return { ok: false, rule: 'missing', message: missingWords(missing) };
  return { ok: true };
}
/** Would saving `ids` change any rank? (No change, no write and no audit row.) */
export const ranksChange = (ids: readonly string[], owned: readonly OwnedProject[]): boolean => {
  const rankOf = new Map(owned.map((p) => [p.id, p.rank]));
  return ranksAfter(ids).some(({ id, rank }) => rankOf.get(id) !== rank);
};

// ── C/D · THE DOORS TO /tasks ───────────────────────────────────────────────

/** The params the list on /tasks reads (SectionD_ProjectBacklog.tsx) — and the links that send them. */
export const TASKS_PROJECT_PARAM = 'project';
export const TASKS_NEW_PARAM = 'new';
export const TASKS_NEW_PROJECT = 'project';
/** "+ project" — a link to the capture form on /tasks, never the form mounted here (TOOL-LAW-01). */
export const newProjectHref = `/tasks?${TASKS_NEW_PARAM}=${TASKS_NEW_PROJECT}`;
/** A project's title — a link to its row on /tasks, opened and scrolled to; scope lives on the row (ruling D). */
export const projectHref = (id: string): string => `/tasks?${TASKS_PROJECT_PARAM}=${encodeURIComponent(id)}`;
/** /tasks?project=<id> names no project in the list — said in words, never a silent no-op. */
export const PROJECT_NOT_FOUND_WORDS = 'project not found';
/** /tasks?new=project before the books are read — the form opens once they are (it seeds the book). */
export const NEW_PROJECT_WAITS_WORDS = 'the capture form opens once your books are read';
/** /tasks?new=<anything but project> — said, never ignored. */
export const newParamWords = (value: string): string => `nothing opens for new=${value} — only new=${TASKS_NEW_PROJECT}`;

// ── E · PICK TODAY'S ────────────────────────────────────────────────────────

/** Two goal lines are the same goal when they match ignoring case and runs of whitespace. */
const goalKey = (line: string): string => line.trim().replace(/\s+/g, ' ').toLowerCase();
/**
 * The picked tasks' titles to append to the goals box: in the order picked, each once, none the box already holds.
 * `goals` is the box as the save reads it (linesOf + stripListMarker — JournalForm.tsx). Never replaces a typed goal.
 */
export function picksToGoals(goals: readonly string[], picked: readonly string[]): { readonly add: readonly string[]; readonly skipped: readonly string[] } {
  const held = new Set(goals.map(goalKey));
  const add: string[] = [];
  const skipped: string[] = [];
  for (const title of picked) {
    const key = goalKey(title);
    if (key === '' || held.has(key)) { skipped.push(title); continue; }
    held.add(key);
    add.push(title.trim().replace(/\s+/g, ' '));
  }
  return { add, skipped };
}
/** The goals box with `add` written under what is typed — what is typed stays exactly as typed. */
export function appendGoalLines(text: string, add: readonly string[]): string {
  if (add.length === 0) return text;
  const typed = text.replace(/\s+$/, '');
  return typed === '' ? add.join('\n') : `${typed}\n${add.join('\n')}`;
}

// ── THE WORDS ───────────────────────────────────────────────────────────────

export const LOG_WORD = 'THE LOG';
export const LOG_LOADING_WORDS = 'reading the projects…';
/** No open project in any book — the same words the reflection prompt's THE BACKLOG prints (journal.ts REFLECTION_PROMPT_NO_BACKLOG). */
export const NO_OPEN_PROJECTS_WORDS = '— no open projects —';
export const NO_OPEN_TASKS_WORDS = '— no open tasks —';
export const ADD_PROJECT_WORDS = '+ project';
export const ADD_TASK_WORDS = '+ task';
export const ADD_TASK_SAVE_WORDS = 'add';
export const ADD_TASK_CANCEL_WORDS = 'cancel';
export const TASK_TITLE_PLACEHOLDER = 'the task, in a line';
export const USE_AS_GOALS_WORDS = 'use as today\'s goals';
export const moveWords = (title: string, move: LogMove): string => `move "${title}" ${move}`;
/** "#3" — a project's place; "#—" while it has none (unranked until the list is first saved). */
export const rankWords = (rank: number | null): string => `#${rank === null ? '—' : rank}`;
/** What "use as today's goals" did — the draft only; the morning form's save keeps it. */
export function picksWords(added: number, skipped: number): string {
  if (added === 0) return 'nothing added — already in today\'s goals';
  return `${added} added to today's goals${skipped > 0 ? ` · ${skipped} already there` : ''} — save to keep them`;
}
