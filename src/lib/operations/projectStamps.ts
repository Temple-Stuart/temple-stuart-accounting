/**
 * COLUMNS-01 (Alex, 2026-10-25, ruling C) — THE DATES THE PROJECTS COLUMNS PRINT, STAMPED BY THE STATUS CHANGE.
 *
 * PROJECTS prints SCHEDULED (scheduled_at) and DONE (done_at) — PROJECTS-02 — and
 * until this ruling nothing wrote either (the PATCH stamped promoted_at alone).
 * This is the pure rule the project PATCH applies on its existing status-change
 * path (src/app/api/operations/projects/[id]/route.ts), inside the existing audit
 * entry (operations_project_status_changed — before/after carry the stamps):
 *
 *   · scheduled_at — the instant of the latest transition INTO scheduled; a move
 *     out of scheduled leaves it (the day it was scheduled stays a fact).
 *   · done_at      — the instant of the latest transition INTO completed; set to
 *     null when the status LEAVES completed — a project in process is not done,
 *     so DONE never contradicts STATUS.
 *   · promoted_at  keeps its own rule in the route (set once, backlog → scoped).
 *
 * No backfill: a project completed or scheduled before this ruling keeps its null
 * until it moves again — declared in COLUMNS-01's report, never imputed. No route,
 * no migration (both columns exist — BACKLOG-01). Pure: the instant is handed in.
 */
import type { ProjectStatus } from '@/components/workbench/operations/projects/types';

/** What the status change stamps: a key absent is left as it is; done_at null clears it. */
export interface StatusStamps { readonly scheduled_at?: Date; readonly done_at?: Date | null }

export function statusStampsOf(from: ProjectStatus, to: ProjectStatus, now: Date): StatusStamps {
  const stamps: { scheduled_at?: Date; done_at?: Date | null } = {};
  if (to === 'scheduled' && from !== 'scheduled') stamps.scheduled_at = now;
  if (to === 'completed' && from !== 'completed') stamps.done_at = now;
  if (from === 'completed' && to !== 'completed') stamps.done_at = null;
  return stamps;
}
