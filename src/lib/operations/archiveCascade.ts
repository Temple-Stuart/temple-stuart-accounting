import type { OperationsTaskStatus } from '@prisma/client';

/**
 * ARCHIVE-01 (Alex, 2026-10-25/27) — unarchive restores exactly what the cascade archived, provably.
 *
 * THE CASCADE (projects/[id]/route.ts PATCH, status → archived): every ACTIVE task of the project
 * (open · in_progress · blocked) goes to 'archived', and — as it has since the cascade was built —
 * each gets its operations_task_status_history row in the same transaction: previous_status = the
 * status it had, new_status 'archived', reason CASCADE_ARCHIVE_REASON, changed_by the actor
 * (recordTaskStatusChange). The project's audit entry carries cascade_archived_task_ids. Ruling A:
 * the cascade already writes the history rows, so nothing there changed; the reason stays the
 * word it has always written.
 *
 * THE RESTORE (the same PATCH, archived → not_started — the row's "unarchive"), in the same
 * transaction as the project's update:
 *   · ONE SOURCE for WHICH tasks the latest cascade archived: the project's latest audit entry
 *     whose status_to is 'archived' (audit_log: target operations_projects/<id>, action
 *     operations_project_status_changed), its payload_metadata.cascade_archived_task_ids. The
 *     history rows cannot delineate a cascade on their own (one reason string, one timestamp per
 *     row); the audit entry is one row per cascade with the exact list. Named in the entry the
 *     restore writes (cascade_source).
 *   · the PREVIOUS STATUS of each: its own history row from the cascade — the task's latest
 *     history row, when that row is the cascade's (new_status 'archived', reason
 *     CASCADE_ARCHIVE_REASON). Never a guessed status.
 *   · a cascaded task is restored only while it is STILL archived by that cascade: its status is
 *     'archived' and its latest history row is the cascade's row. A task unarchived by hand and
 *     archived again since is archived on its own and stays. A task archived on its own, or by
 *     an earlier cascade (its latest row is a cascade row, but the latest cascade did not list
 *     it), stays archived and is listed with its why.
 *   · no cascade entry on record → nothing restored; the entry and the response say so in words.
 * The restore writes each task's history row (reason CASCADE_RESTORE_REASON) and the project's
 * audit entry carries cascade_restored_task_ids and cascade_left_archived_task_ids.
 *
 * Pure: the rule and the words live here; the route reads the rows and writes; the row prints.
 */

/** The cascade's history reason — written by the cascade since it was built (route.ts, recordTaskStatusChange). */
export const CASCADE_ARCHIVE_REASON = 'project archived';
/** The restore's history reason. */
export const CASCADE_RESTORE_REASON = 'project unarchived — cascade restored';
/** The words when the project has no cascade entry on record. */
export const NO_CASCADE_ON_RECORD = 'no cascade on record';

/** Why a task of an unarchived project stays archived. */
export type LeftArchivedWhy =
  | 'archived on its own'
  | 'archived by an earlier cascade'
  | 'archived by a cascade not on record'
  | 'no previous status on record';

/** The order the whys are counted in the words. */
export const LEFT_ARCHIVED_WHYS: readonly LeftArchivedWhy[] = [
  'archived on its own',
  'archived by an earlier cascade',
  'archived by a cascade not on record',
  'no previous status on record',
];

/** A task's latest status-history row, as the restore reads it. */
export interface LatestHistoryRow {
  new_status: OperationsTaskStatus;
  previous_status: OperationsTaskStatus | null;
  reason: string | null;
}

/** One archived task of the project, with its latest history row (null when it has none). */
export interface ArchivedTaskFacts {
  id: string;
  latest: LatestHistoryRow | null;
}

export interface RestorePlan {
  /** Restored: each to the status its cascade row recorded. */
  restore: ReadonlyArray<{ id: string; status: OperationsTaskStatus }>;
  /** Still archived after the restore, each with its why. */
  left: ReadonlyArray<{ id: string; why: LeftArchivedWhy }>;
  /** Ids the latest cascade archived that are no longer archived (changed by hand since) — neither restored nor left. */
  noLongerArchived: readonly string[];
}

/** Is this history row the cascade's own? */
export const isCascadeRow = (row: LatestHistoryRow | null): row is LatestHistoryRow =>
  row !== null && row.new_status === 'archived' && row.reason === CASCADE_ARCHIVE_REASON;

/** The cascade's id list from an audit entry's payload_metadata — null unless it is an array of strings. */
export function cascadeIdsOf(metadata: unknown): string[] | null {
  if (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const ids = (metadata as Record<string, unknown>).cascade_archived_task_ids;
  if (!Array.isArray(ids) || !ids.every((x) => typeof x === 'string')) return null;
  return ids as string[];
}

/**
 * The restore, decided from the latest cascade's ids (null = no cascade on record) and every
 * archived task of the project with its latest history row.
 */
export function restorePlanOf(cascadeIds: readonly string[] | null, archived: readonly ArchivedTaskFacts[]): RestorePlan {
  const listed = new Set(cascadeIds ?? []);
  const archivedIds = new Set(archived.map((t) => t.id));
  const restore: Array<{ id: string; status: OperationsTaskStatus }> = [];
  const left: Array<{ id: string; why: LeftArchivedWhy }> = [];
  for (const t of archived) {
    if (listed.has(t.id)) {
      if (t.latest === null) left.push({ id: t.id, why: 'no previous status on record' });
      else if (!isCascadeRow(t.latest)) left.push({ id: t.id, why: 'archived on its own' });
      else if (t.latest.previous_status === null) left.push({ id: t.id, why: 'no previous status on record' });
      else restore.push({ id: t.id, status: t.latest.previous_status });
    } else if (isCascadeRow(t.latest)) {
      left.push({ id: t.id, why: cascadeIds === null ? 'archived by a cascade not on record' : 'archived by an earlier cascade' });
    } else {
      left.push({ id: t.id, why: 'archived on its own' });
    }
  }
  const noLongerArchived = (cascadeIds ?? []).filter((id) => !archivedIds.has(id));
  return { restore, left, noLongerArchived };
}

/** "3 tasks restored · 1 left archived (archived on its own)" — or "no cascade on record — nothing restored". */
export function unarchiveWords(plan: RestorePlan, cascadeFound: boolean): string {
  const n = plan.restore.length;
  const head = !cascadeFound
    ? `${NO_CASCADE_ON_RECORD} — nothing restored`
    : n === 0
      ? 'nothing restored'
      : `${n} task${n === 1 ? '' : 's'} restored`;
  const m = plan.left.length;
  if (m === 0) return head;
  const groups = LEFT_ARCHIVED_WHYS.map((why) => [why, plan.left.filter((l) => l.why === why).length] as const).filter(([, k]) => k > 0);
  const whys = groups.length === 1 ? groups[0][0] : groups.map(([why, k]) => `${k} ${why}`).join(' · ');
  return `${head} · ${m} left archived (${whys})`;
}
