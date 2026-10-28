/**
 * TASKS-03 (Alex, 2026-10-26, ruling B) — A TASK'S MATCH: THE POSTINGS LINKED TO IT IN BOOKS.
 *
 * THE WORK's MATCH column is the ledger's pair to ACTUAL (as the task ledger and
 * ROUTINE EXPENSES already print it for a stop): the sum of the postings linked
 * BY HAND to the task on planned_item_links (LINK-01 — target_kind
 * 'project_task', target_id the task's id, no instant: a task happens once),
 * each posting's amount by LEDGER-03's one rule (src/lib/calendar/
 * postingAmount.ts amountCentsOf), summed by the ledger's own matchOf and read
 * as a figure by readableMatchCents (src/lib/operations/ledger.ts) — ROUTINES-03's
 * convention: a posting the rule cannot read is COUNTED and SAID
 * (match_unreadable) and the sum is blank, never a number that silently misses
 * it; no link is null, never 0.
 *
 * The project tasks GET (src/app/api/operations/projects/[id]/tasks/route.ts)
 * reads the project's tasks' links in ONE query, user-scoped through the
 * caller's journal entries as the ledger route scopes them, and hands the rows
 * here. Pure: no Prisma, no request, no clock. A row of a kind the query did not
 * ask for, or a task link carrying an instant, is the database's error — thrown
 * by name, never read as something else.
 *
 * LINK-LAW-01 (Alex, 2026-10-28, ruling C): A REVERSED POSTING PAYS NOTHING. The GET
 * selects each posting's reversal state too (postingAmount.ts LINKED_POSTING_SELECT);
 * matchOf leaves a reversal, or a reversed posting, out of the sum and counts it —
 * match_reversed, said beside THE WORK's count ("1 linked posting was reversed").
 */
import { amountCentsOf, isReversedPosting, type LinkedPostingRow } from '@/lib/calendar/postingAmount';
import { matchOf, readableMatchCents } from '@/lib/operations/ledger';

/** A planned_item_links row as the tasks GET selects it. */
export interface TaskLinkRow {
  readonly target_kind: string;
  readonly target_id: string;
  readonly target_instant: Date | null;
  readonly journal_entry_id: string;
  readonly journal_entry: LinkedPostingRow;
}

/** What the GET adds to a task, additively: the sum, how many postings, how many the rule could not read. */
export interface TaskMatch {
  readonly match_cents: number | null;
  readonly match_links: number;
  readonly match_unreadable: number;
  /** LINK-LAW-01 (ruling C): linked postings left out because they are a reversal or were reversed. */
  readonly match_reversed: number;
}

/** A task with no link: null, never 0. */
export const NO_TASK_MATCH: TaskMatch = { match_cents: null, match_links: 0, match_unreadable: 0, match_reversed: 0 };

/** The matches by task id, from the caller's project_task links — the ledger's matchOf per task, the figure by readableMatchCents. */
export function taskMatchesOf(rows: readonly TaskLinkRow[]): ReadonlyMap<string, TaskMatch> {
  const byTask = new Map<string, { amountCents: number | null; reversed: boolean }[]>();
  for (const row of rows) {
    if (row.target_kind !== 'project_task') throw new Error(`tasks GET: link ${row.journal_entry_id} is of kind ${JSON.stringify(row.target_kind)} — the query asked for project_task`);
    if (row.target_instant !== null) throw new Error(`tasks GET: link ${row.journal_entry_id} of a task carries an instant — a task happens once (the migration's CHECK holds none)`);
    byTask.set(row.target_id, [...(byTask.get(row.target_id) ?? []), { amountCents: amountCentsOf(row.journal_entry), reversed: isReversedPosting(row.journal_entry) }]);
  }
  const matches = new Map<string, TaskMatch>();
  for (const [taskId, links] of byTask) {
    const match = matchOf(links);
    matches.set(taskId, { match_cents: readableMatchCents(match), match_links: match?.postings ?? 0, match_unreadable: match?.unreadable ?? 0, match_reversed: match === null ? 0 : match.reversed });
  }
  return matches;
}

/** A task's match from the map — NO_TASK_MATCH when the task has no link. */
export const taskMatchOf = (matches: ReadonlyMap<string, TaskMatch>, taskId: string): TaskMatch => matches.get(taskId) ?? NO_TASK_MATCH;
