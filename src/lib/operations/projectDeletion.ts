/**
 * projectDeletion — THE ONE LEAF THAT DECIDES WHETHER A PROJECT MAY BE HARD-DELETED
 * (TASKS-01, 2026-09-18).
 *
 * A project is removed with its tasks and its dependencies in one transaction,
 * and NEVER through a live link. The delete is refused — 409, naming the task
 * and the reason — when any of these holds:
 *
 *   posting_link       a ledger line is allocated to the project
 *                      (ledger_line_links.project_id — the FK is Restrict, and
 *                      this names it before Postgres would refuse it blind)
 *   planned_item_link  a posting is linked to one of its tasks
 *                      (planned_item_links, target_kind 'project_task' — no FK,
 *                      so a cascade would have orphaned the link silently)
 *   posted_actual      a task carries a typed actual cost (actual_cost_usd)
 *   calendar_block     a calendar block sits on one of its tasks
 *                      (operations_calendar_blocks → daily_plan_item.task_id;
 *                      the FK cascades, which is exactly the cascade refused)
 *   scheduled_item     a hub schedule line points at the project or a task
 *                      (hub_scheduled_items — SetNull, which would have kept a
 *                      line whose project vanished)
 *
 * Archive is the path for those: it keeps every record. The same check runs
 * twice — once for the preview the confirm dialog reads, once INSIDE the delete
 * transaction — so the dialog and the delete can never disagree.
 *
 * What a permitted delete removes (cascade): the tasks, the dependency edges in
 * both directions, the tasks' daily-plan items, their status history. What it
 * severs (SetNull, the row survives without its project): issue-log entries and
 * content pieces linked to the project. Both are counted and named.
 */

import type { Prisma } from '@prisma/client';

export type DeletionBlockerKind = 'posting_link' | 'planned_item_link' | 'posted_actual' | 'calendar_block' | 'scheduled_item';

export interface DeletionBlocker {
  kind: DeletionBlockerKind;
  /** The task the link hangs off — null for a project-level link. */
  task_id: string | null;
  task_title: string | null;
  count: number;
  message: string;
}

export interface DeletionPreview {
  project: { id: string; title: string };
  blockers: DeletionBlocker[];
  removes: { tasks: number; dependencies: number; plan_items: number; status_history: number };
  severs: { issues: number; content_pieces: number };
}

/** The rows the check reads — a plain shape, so the decision is testable without a database. */
export interface DeletionFacts {
  project: { id: string; title: string };
  tasks: Array<{ id: string; title: string; actual_cost_usd: unknown | null }>;
  /** ledger_line_links rows with project_id = the project */
  ledgerLinkCount: number;
  /** planned_item_links rows (target_kind 'project_task') by task id */
  plannedLinkTaskIds: string[];
  /** operations_calendar_blocks by the task id of their daily-plan item */
  calendarBlockTaskIds: string[];
  /** hub_scheduled_items rows: the task they point at, or null when they point at the project */
  scheduledItemTaskIds: Array<string | null>;
  dependencyCount: number;
  planItemCount: number;
  statusHistoryCount: number;
  issueCount: number;
  contentPieceCount: number;
}

function countBy(ids: Array<string | null>): Map<string | null, number> {
  const m = new Map<string | null, number>();
  for (const id of ids) m.set(id, (m.get(id) ?? 0) + 1);
  return m;
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** The decision, from facts alone. Pure. */
export function assessDeletion(f: DeletionFacts): DeletionPreview {
  const titleOf = new Map(f.tasks.map((t) => [t.id, t.title]));
  const blockers: DeletionBlocker[] = [];

  if (f.ledgerLinkCount > 0) {
    blockers.push({
      kind: 'posting_link', task_id: null, task_title: null, count: f.ledgerLinkCount,
      message: `${plural(f.ledgerLinkCount, 'ledger line is', 'ledger lines are')} allocated to it`,
    });
  }
  for (const [taskId, n] of countBy(f.plannedLinkTaskIds)) {
    if (taskId === null) continue;
    blockers.push({
      kind: 'planned_item_link', task_id: taskId, task_title: titleOf.get(taskId) ?? null, count: n,
      message: `task "${titleOf.get(taskId) ?? taskId}" is linked to ${plural(n, 'posting')}`,
    });
  }
  for (const t of f.tasks) {
    if (t.actual_cost_usd === null || t.actual_cost_usd === undefined) continue;
    blockers.push({
      kind: 'posted_actual', task_id: t.id, task_title: t.title, count: 1,
      message: `task "${t.title}" carries a posted actual`,
    });
  }
  for (const [taskId, n] of countBy(f.calendarBlockTaskIds)) {
    if (taskId === null) continue;
    blockers.push({
      kind: 'calendar_block', task_id: taskId, task_title: titleOf.get(taskId) ?? null, count: n,
      message: `task "${titleOf.get(taskId) ?? taskId}" has ${plural(n, 'calendar block')}`,
    });
  }
  for (const [taskId, n] of countBy(f.scheduledItemTaskIds)) {
    blockers.push({
      kind: 'scheduled_item', task_id: taskId, task_title: taskId ? titleOf.get(taskId) ?? null : null, count: n,
      message: taskId
        ? `task "${titleOf.get(taskId) ?? taskId}" is on ${plural(n, 'scheduled item')}`
        : `${plural(n, 'scheduled item is', 'scheduled items are')} on the project`,
    });
  }

  return {
    project: f.project,
    blockers,
    removes: {
      tasks: f.tasks.length,
      dependencies: f.dependencyCount,
      plan_items: f.planItemCount,
      status_history: f.statusHistoryCount,
    },
    severs: { issues: f.issueCount, content_pieces: f.contentPieceCount },
  };
}

/** The 409's message: every blocker named, then the door that stays open. */
export function describeBlockers(p: DeletionPreview): string {
  const reasons = p.blockers.map((b) => b.message).join('; ');
  return `Can't delete "${p.project.title}": ${reasons}. Archive it instead — every record stays.`;
}

/** The confirm dialog's text: what goes, what is severed, and that it cannot be undone. */
export function removalSummary(p: DeletionPreview): string {
  const goes = [
    plural(p.removes.tasks, 'task'),
    plural(p.removes.dependencies, 'dependency', 'dependencies'),
    ...(p.removes.plan_items > 0 ? [plural(p.removes.plan_items, 'daily-plan item')] : []),
    ...(p.removes.status_history > 0 ? [plural(p.removes.status_history, 'status-history row')] : []),
  ].join(', ');
  const severed = [
    ...(p.severs.issues > 0 ? [plural(p.severs.issues, 'issue-log entry', 'issue-log entries')] : []),
    ...(p.severs.content_pieces > 0 ? [plural(p.severs.content_pieces, 'content piece')] : []),
  ];
  const severLine = severed.length > 0 ? ` ${severed.join(' and ')} will lose the link to it (they stay).` : '';
  return `Delete project "${p.project.title}"? This removes the project and its ${goes}.${severLine} This cannot be undone.`;
}

/** Any client that can read the operations tables — prisma itself or a transaction. */
export type DeletionReader = Pick<Prisma.TransactionClient,
  'operations_projects' | 'operations_project_tasks' | 'ledger_line_links' | 'planned_item_links' |
  'operations_calendar_blocks' | 'hub_scheduled_items' | 'operations_project_dependencies' |
  'operations_daily_plan_items' | 'operations_task_status_history' | 'operations_issue_log_entries' |
  'operations_content_pieces'>;

/**
 * Reads the facts, user-scoped, and decides. null when the project is not the
 * user's (the route answers 404 — a defensive 404, never a 403).
 */
export async function projectDeletionCheck(db: DeletionReader, projectId: string, userId: string): Promise<DeletionPreview | null> {
  const project = await db.operations_projects.findFirst({ where: { id: projectId, user_id: userId }, select: { id: true, title: true } });
  if (!project) return null;

  const tasks = await db.operations_project_tasks.findMany({
    where: { project_id: projectId },
    select: { id: true, title: true, actual_cost_usd: true },
    orderBy: { display_order: 'asc' },
  });
  const taskIds = tasks.map((t) => t.id);
  const byTask = taskIds.length > 0;

  const [ledgerLinkCount, plannedLinks, blocks, scheduled, dependencyCount, planItemCount, statusHistoryCount, issueCount, contentPieceCount] = await Promise.all([
    db.ledger_line_links.count({ where: { project_id: projectId } }),
    byTask
      ? db.planned_item_links.findMany({ where: { user_id: userId, target_kind: 'project_task', target_id: { in: taskIds } }, select: { target_id: true } })
      : Promise.resolve([] as Array<{ target_id: string }>),
    byTask
      ? db.operations_calendar_blocks.findMany({ where: { daily_plan_item: { task_id: { in: taskIds } } }, select: { daily_plan_item: { select: { task_id: true } } } })
      : Promise.resolve([] as Array<{ daily_plan_item: { task_id: string | null } }>),
    db.hub_scheduled_items.findMany({
      where: { OR: [{ project_id: projectId }, ...(byTask ? [{ task_id: { in: taskIds } }] : [])] },
      select: { task_id: true },
    }),
    db.operations_project_dependencies.count({ where: { OR: [{ project_id: projectId }, { depends_on_project_id: projectId }] } }),
    byTask ? db.operations_daily_plan_items.count({ where: { task_id: { in: taskIds } } }) : Promise.resolve(0),
    byTask ? db.operations_task_status_history.count({ where: { task_id: { in: taskIds } } }) : Promise.resolve(0),
    db.operations_issue_log_entries.count({ where: { linked_project_id: projectId } }),
    db.operations_content_pieces.count({ where: { project_id: projectId } }),
  ]);

  return assessDeletion({
    project,
    tasks,
    ledgerLinkCount,
    plannedLinkTaskIds: plannedLinks.map((l) => l.target_id),
    calendarBlockTaskIds: blocks.map((b) => b.daily_plan_item.task_id).filter((id): id is string => typeof id === 'string'),
    scheduledItemTaskIds: scheduled.map((s) => (s.task_id && taskIds.includes(s.task_id) ? s.task_id : null)),
    dependencyCount,
    planItemCount,
    statusHistoryCount,
    issueCount,
    contentPieceCount,
  });
}
