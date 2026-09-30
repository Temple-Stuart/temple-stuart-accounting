/**
 * projectsTableText — the words the projects table draws (PROJECTS-01, 2026-09-30).
 *
 * Pure: no React, no fetch. Every cell's text that is more than a field read
 * lives here, so the tests drive it with fixtures (TEST-TRUTH-01). A blank
 * value is "—", never 0.
 */
import { isBlankPlanValue } from '@/lib/operations/planMoney';
import type { TaskStatus } from './types';
import { TASK_STATUS_LABELS, TASK_STATUS_PILL_CLASSES } from './types';

/**
 * A date as the task row draws one — a copy of TaskRowView.tsx:46-49's four
 * lines, which PROJECTS-01's R3 allows because that view is not touched.
 */
export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * A task status in TASK_STATUS_LABELS' words. The database allows a status the
 * client does not label (superseded — schema.prisma OperationsTaskStatus); it
 * shows as its raw value, never blank.
 */
export function taskStatusWords(status: string): string {
  return Object.prototype.hasOwnProperty.call(TASK_STATUS_LABELS, status)
    ? TASK_STATUS_LABELS[status as TaskStatus]
    : status;
}

/** The pill's classes for a status; an unlabeled one is drawn plain, outlined — its raw value, marked as unlabeled. */
export const UNLABELED_STATUS_PILL = 'border border-border text-text-muted';
export function taskStatusPill(status: string): string {
  return Object.prototype.hasOwnProperty.call(TASK_STATUS_PILL_CLASSES, status)
    ? TASK_STATUS_PILL_CLASSES[status as TaskStatus]
    : UNLABELED_STATUS_PILL;
}

/** "1 pending review · 3 new · 2 done" — the tasks counted by status, in the order the tasks read returns them. */
export function statusCounts(statuses: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const s of statuses) {
    const n = counts.get(s);
    counts.set(s, n === undefined ? 1 : n + 1);
  }
  return [...counts].map(([s, n]) => `${n} ${taskStatusWords(s)}`).join(' · ');
}

/** "3 requests" — a project's pipe runs, counted as the queue card counted them (ProjectQueueCard.tsx:74). */
export function requestsWords(runCount: number): string {
  return `${runCount} ${runCount === 1 ? 'request' : 'requests'}`;
}

export const NOTES_PREVIEW_CHARS = 160;

/**
 * The notes under a task: in full when they fit, else the first 160 characters
 * and how many there are. Counted in characters (code points), so a character is
 * never cut in half.
 */
export function notesPreview(notes: string): { shown: string; more: string | null } {
  const chars = [...notes];
  if (chars.length <= NOTES_PREVIEW_CHARS) return { shown: notes, more: null };
  return { shown: chars.slice(0, NOTES_PREVIEW_CHARS).join(''), more: `… (${chars.length} chars — all of it in edit)` };
}

/** "est 30 · actual 45" — minutes; a blank side is "—". */
export function minutesPair(estimated: number | null, actual: number | null): string {
  return `est ${estimated === null ? '—' : estimated} · actual ${actual === null ? '—' : actual}`;
}

/** "est $12.50 · actual —" — cost as saved (a Decimal's string); a blank side is "—", never $0. */
export function costPair(estimated: string | null, actual: string | null): string {
  const side = (v: string | null) => (isBlankPlanValue(v) ? '—' : `$${v}`);
  return `est ${side(estimated)} · actual ${side(actual)}`;
}

/** The table's columns: Project · Task · Status · Minutes · Cost · Account · Deadline · Done, and the controls. */
export const PROJECTS_TABLE_COLUMNS = 9;
/** The columns beside the project cell — what a task row, and a row opened under a task, spans. */
export const TASK_COLUMNS = PROJECTS_TABLE_COLUMNS - 1;
