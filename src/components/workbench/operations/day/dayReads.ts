/**
 * dayReads — the day card's one read of its own (DAYCARD-01, 2026-10-11).
 *
 * The card reads three things for one day, all through the week's reader
 * (week/weekReads.ts readJson — the one way an answer is read: ok, or the
 * route's own words; signed out by name; nothing filled in):
 *
 *   · GET /api/operations/routines/today?date=<day>       weekReads.readDay
 *   · GET /api/operations/daily-plan/items?from=&to=      weekReads.readItems(day, day)
 *   · GET /api/budget/report?view=day&day=&asOf=          readDayReport, here
 *   · GET /api/operations/stays?day=<day>                 readStays, here (STAY-01)
 *   · GET /api/operations/stops?day=<day>                 readStopRecords, here (STOP-01)
 *   · GET /api/operations/journal?day=<day>               readJournal, here (JOURNAL-01)
 *   · GET /api/operations/projects                        readBacklog, here (JOURNAL-06 — the reflection prompt's THE BACKLOG;
 *                                                         BACKLOG-02 — and the morning card's THE LOG, the same one read;
 *                                                         WORK-02 — and THE WORK BLOCK's TO DO; with ?done_from=&done_to= on a
 *                                                         day with an execute stop, each row also carries the tasks done today)
 *   · GET /api/audit-log?prefix=operations_&after=&before=&limit=500   readMovedToday, here (JOURNAL-06 — WHAT MOVED TODAY)
 *
 * The report's answer is read exactly as the week reads its own (readReport):
 * the body as BudgetReportResponse, a failure in the card's words. Every fetch
 * the card makes is here or in weekReads.ts; DayCard.tsx fetches nothing.
 *
 * JOURNAL-06 (Alex, 2026-10-20): two cross-tool READS for the reflection prompt
 * (the card already reads six sources; a read is allowed). Both read-only, the
 * same auth order as every read here (the route's cookie → user; signed out by
 * name); a failed read is a failure in words — the prompt is never built with
 * a section silently missing (DayCard.tsx gates on both).
 */
import type { BudgetReportResponse } from '@/lib/budget/reportInputs';
import type { JournalRow, ReflectionMovedRow } from '@/lib/operations/journal';
import { OPEN_PROJECT_STATUSES, type LogDoneTask, type LogProject, type LogTask } from '@/lib/operations/morningLog';
import type { BlockWindow } from '@/lib/operations/workBlock';
import { AUDIT_READ_LIMIT, backlogOrder } from '@/lib/operations/journal';
import type { StayRow } from '@/lib/operations/stay';
import type { StopRecordPlan, StopRecordRow } from '@/lib/operations/stopRecord';
import { readJson, type Read } from '../week/weekReads';

export const dayReportFailedWords = (words: string): string => `The day's amounts and places could not be read — ${words}`;

/** The day's budget report — its plan lines (amounts, vendors) and what it could not place (asOf: the browser's date). */
export async function readDayReport(day: string, asOf: string): Promise<Read<BudgetReportResponse>> {
  const query = new URLSearchParams({ view: 'day', day, asOf });
  const read = await readJson(`/api/budget/report?${query.toString()}`);
  if (!read.ok) return { ok: false, words: dayReportFailedWords(read.words) };
  return { ok: true, value: read.value as unknown as BudgetReportResponse };
}

export interface StaysAnswer {
  readonly stays: readonly StayRow[];
  readonly covering: StayRow | null;
}

export const staysFailedWords = (words: string): string => `The stay could not be read — ${words}`;

/** STAY-01: the caller's stays and the one covering the day — DAY n OF m and the place on the plate. */
export async function readStays(day: string): Promise<Read<StaysAnswer>> {
  const read = await readJson(`/api/operations/stays?${new URLSearchParams({ day }).toString()}`);
  if (!read.ok) return { ok: false, words: staysFailedWords(read.words) };
  if (!Array.isArray(read.value.stays) || !('covering' in read.value)) return { ok: false, words: staysFailedWords('the stays came back without their list') };
  return { ok: true, value: { stays: read.value.stays as StayRow[], covering: read.value.covering as StayRow | null } };
}

export interface StopRecordsAnswer {
  readonly records: readonly StopRecordRow[];
  /** Records whose routine's zone could not be read — named with the reason, never placed in UTC. */
  readonly unplaced: readonly { readonly record: StopRecordRow; readonly detail: string }[];
  /** RETRO-01: each listed record's plan words, by record id — the routine's name and zone, the line's activity. */
  readonly plans: Readonly<Record<string, StopRecordPlan>>;
}

export const stopRecordsFailedWords = (words: string): string => `The stop records could not be read — ${words}`;

/** STOP-01: the day's stop records — done-at, what was paid, the rating, the note — each placed by its routine's own zone. */
export async function readStopRecords(day: string): Promise<Read<StopRecordsAnswer>> {
  const read = await readJson(`/api/operations/stops?${new URLSearchParams({ day }).toString()}`);
  if (!read.ok) return { ok: false, words: stopRecordsFailedWords(read.words) };
  if (!Array.isArray(read.value.records) || !Array.isArray(read.value.unplaced)) return { ok: false, words: stopRecordsFailedWords('the records came back without their list') };
  // RETRO-01: the plan words ride every answer; an answer without them is a failure in words, never a record with no name.
  if (typeof read.value.plans !== 'object' || read.value.plans === null || Array.isArray(read.value.plans)) return { ok: false, words: stopRecordsFailedWords('the records came back without their plans') };
  return { ok: true, value: { records: read.value.records as StopRecordRow[], unplaced: read.value.unplaced as StopRecordsAnswer['unplaced'], plans: read.value.plans as StopRecordsAnswer['plans'] } };
}

export interface JournalAnswer {
  /** The day's journal, or null when nothing was typed for the day. */
  readonly journal: JournalRow | null;
}

export const journalFailedWords = (words: string): string => `The journal could not be read — ${words}`;

/** JOURNAL-01: the day's journal — the morning's answers; a body without `journal` is a failure in words, never read as "none typed". */
export async function readJournal(day: string): Promise<Read<JournalAnswer>> {
  const read = await readJson(`/api/operations/journal?${new URLSearchParams({ day }).toString()}`);
  if (!read.ok) return { ok: false, words: journalFailedWords(read.words) };
  if (!('journal' in read.value)) return { ok: false, words: journalFailedWords('the journal came back without its row') };
  return { ok: true, value: { journal: read.value.journal as JournalRow | null } };
}

/** JOURNAL-06: the statuses of a project NOT DONE — what THE BACKLOG lists. BACKLOG-02 (2026-10-20): THE LOG's open statuses, one home (morningLog.ts). */
export const BACKLOG_STATUSES: readonly string[] = OPEN_PROJECT_STATUSES;

/** The two reads by the name the prompt's waiting words give them (dayCard.ts reelWaitingWords, the reel's own shape). */
export const BACKLOG_READ_NAME = 'the backlog';
export const MOVED_READ_NAME = 'what moved today';

export const backlogFailedWords = (words: string): string => `The backlog could not be read — ${words}`;

/**
 * JOURNAL-06: the user's projects not done, every book (the projects GET since BACKLOG-01), filtered here to
 * BACKLOG_STATUSES and sorted rank asc with unranked last, then by title (journal.ts backlogOrder — the prompt's own
 * order). `open_task_count` is the GET's count of a project's tasks not done; a row without it is a failure in words.
 * BACKLOG-02 (Alex, 2026-10-20): the SAME read feeds THE LOG on the morning card — each row also carries its id, its
 * book and `open_tasks` (the GET's tasks not done, in display_order); a row without them, or a task without its id,
 * title, status or order, is a failure in words — the log is never drawn from a partial answer.
 * WORK-02 (Alex, 2026-10-26): the SAME read feeds THE WORK BLOCK — with a window (the day's bounds in the viewer's zone)
 * the GET is asked ?done_from=&done_to= and each row also carries `doneTasks` (the GET's done_tasks: id, title, completed_at);
 * a row without them, or a done task without its facts, is a failure in words. Without a window the read is as it was.
 */
export async function readBacklog(done: BlockWindow | null = null): Promise<Read<readonly LogProject[]>> {
  const read = await readJson(done === null ? '/api/operations/projects' : `/api/operations/projects?${new URLSearchParams({ done_from: done.from.toISOString(), done_to: done.to.toISOString() })}`);
  if (!read.ok) return { ok: false, words: backlogFailedWords(read.words) };
  if (!Array.isArray(read.value.projects)) return { ok: false, words: backlogFailedWords('the projects came back without their list') };
  const rows: LogProject[] = [];
  for (const p of read.value.projects as Record<string, unknown>[]) {
    if (typeof p.status !== 'string' || !BACKLOG_STATUSES.includes(p.status)) continue;
    if (typeof p.title !== 'string' || typeof p.open_task_count !== 'number') return { ok: false, words: backlogFailedWords('a project came back without its title or its open-task count') };
    if (typeof p.id !== 'string' || typeof p.entity_id !== 'string' || !Array.isArray(p.open_tasks)) return { ok: false, words: backlogFailedWords(`"${p.title}" came back without its id, its book or its open tasks`) };
    const tasks: LogTask[] = [];
    for (const t of p.open_tasks as Record<string, unknown>[]) {
      if (typeof t.id !== 'string' || typeof t.title !== 'string' || typeof t.status !== 'string' || typeof t.display_order !== 'number') return { ok: false, words: backlogFailedWords(`a task of "${p.title}" came back without its id, title, status or order`) };
      tasks.push({ id: t.id, title: t.title, status: t.status, displayOrder: t.display_order });
    }
    // WORK-02: the done tasks, only when a window was asked — the GET answers done_tasks only then.
    const doneTasks: LogDoneTask[] = [];
    if (done !== null) {
      if (!Array.isArray(p.done_tasks)) return { ok: false, words: backlogFailedWords(`"${p.title}" came back without its done tasks`) };
      for (const t of p.done_tasks as Record<string, unknown>[]) {
        if (typeof t.id !== 'string' || typeof t.title !== 'string' || typeof t.completed_at !== 'string') return { ok: false, words: backlogFailedWords(`a done task of "${p.title}" came back without its id, title or completed_at`) };
        doneTasks.push({ id: t.id, title: t.title, completedAt: t.completed_at });
      }
    }
    rows.push({
      id: p.id,
      entityId: p.entity_id,
      tasks,
      ...(done === null ? {} : { doneTasks }),
      rank: typeof p.rank === 'number' ? p.rank : null,
      title: p.title,
      type: typeof p.type === 'string' ? p.type : null,
      status: p.status,
      size: typeof p.size === 'string' ? p.size : null,
      target: typeof p.target_completion_date === 'string' ? p.target_completion_date.slice(0, 10) : null,
      openTasks: p.open_task_count,
    });
  }
  return { ok: true, value: backlogOrder(rows) };
}

export const movedFailedWords = (words: string): string => `What moved today could not be read — ${words}`;

/**
 * JOURNAL-06: the day's audit-log slice for the actor — the operations_ prefix, the card's day window in the viewer's
 * zone (after/before as instants, DayCard.tsx: zonedToInstant of the day's midnight and the next), at most 500 rows.
 * The route answers the audit_log rows as stored (action_type, action_description — the column's name), newest first;
 * the prompt reads oldest first. FOUND in the browser (2026-10-20): the first cut read `description`, a key no row has —
 * every day was "could not be read"; the reader now names the column.
 * JOURNAL-06b (Alex, 2026-10-20): the limit asked is AUDIT_READ_LIMIT — the route's own cap (audit-log/route.ts:137) — so a full
 * read is exactly that many rows, and the prompt names the cap when it is hit (journal.ts movedWords).
 */
export async function readMovedToday(after: Date, before: Date): Promise<Read<readonly ReflectionMovedRow[]>> {
  const query = new URLSearchParams({ prefix: 'operations_', after: after.toISOString(), before: before.toISOString(), limit: String(AUDIT_READ_LIMIT) });
  const read = await readJson(`/api/audit-log?${query.toString()}`);
  if (!read.ok) return { ok: false, words: movedFailedWords(read.words) };
  if (!Array.isArray(read.value.rows)) return { ok: false, words: movedFailedWords('the audit log came back without its rows') };
  const rows: ReflectionMovedRow[] = [];
  for (const r of read.value.rows as Record<string, unknown>[]) {
    if (typeof r.action_type !== 'string' || typeof r.action_description !== 'string') return { ok: false, words: movedFailedWords('a row came back without its action type or description') };
    rows.push({ action_type: r.action_type, description: r.action_description });
  }
  return { ok: true, value: rows.reverse() };
}
