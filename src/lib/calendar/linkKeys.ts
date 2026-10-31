/**
 * LINK-01 — THE TARGET KEY, AND NOTHING ELSE.
 *
 * A pure leaf so the route, the panel and the tests agree on what a link may
 * point at. The kinds are the linkable ones from DRILL-01's census, and the
 * migration's CHECK holds the same set at the database.
 */
/**
 * LINES-01 adds 'routine_line': a posting linked to the LINE it settled, keyed
 * on (operations_routine_steps.id, the occurrence instant). 'routine' STAYS for
 * a stepless routine and is never repurposed.
 */
/**
 * TRAVEL-01 adds 'trip_item': a posting linked to a committed trip item, keyed on
 * trip_itinerary.id (a stored cuid — no instant). The whole-trip row stays a
 * calendar_event. The migration's CHECK gains the kind in
 * prisma/migrations/20260919100100_travel_01_trip_item_link_kind.
 */
import { isValidUuid } from '@/lib/operations/parseUuid';

export const LINKABLE_KINDS = ['calendar_event', 'project_task', 'routine', 'routine_line', 'trip_item'] as const;
export type LinkableKind = (typeof LINKABLE_KINDS)[number];

export function isLinkableKind(k: string): k is LinkableKind {
  return (LINKABLE_KINDS as readonly string[]).includes(k);
}

/**
 * A routine OCCURRENCE has no row — it is computed from an RRULE — so it is
 * addressed on its INSTANT, the way operations_routine_completions already does
 * (@@unique([routine_id, expected_at])). A key of YYYY-MM-DD would silently miss
 * a 07:00 Asia/Bangkok occurrence read from another zone.
 */
export function requiresInstant(kind: LinkableKind): boolean {
  // A line of an occurrence is still an occurrence: the same instant discipline.
  return kind === 'routine' || kind === 'routine_line';
}

/**
 * SEC-TASKS-01 — WHOSE TARGET IS IT? A link may point only at the caller's own
 * item. Each kind names its own table and the user-scoped `where` that finds it;
 * the route runs that one read before it writes, and a miss is the defensive 404.
 *
 *   calendar_event → calendar_events.user_id
 *   project_task   → operations_project_tasks.user_id
 *   routine        → operations_routines.user_id
 *   routine_line   → operations_routine_steps, through its ROUTINE's user_id
 *   trip_item      → trip_itinerary, through its TRIP's userId (read-only, Alex
 *                    ruled D2 (a) 2026-09-28 — no Travel file changes)
 *
 * The four uuid-keyed tables cannot hold an id that is not a UUID, so such an id
 * names no row of them: null here, and the same 404 — never a database error.
 */
export type TargetOwnerQuery =
  | { readonly table: 'calendar_events'; readonly where: { id: string; user_id: string } }
  | { readonly table: 'operations_project_tasks'; readonly where: { id: string; user_id: string } }
  | { readonly table: 'operations_routines'; readonly where: { id: string; user_id: string } }
  | { readonly table: 'operations_routine_steps'; readonly where: { id: string; routine: { user_id: string } } }
  | { readonly table: 'trip_itinerary'; readonly where: { id: string; trip: { userId: string } } };

export function targetOwnerQuery(kind: LinkableKind, id: string, userId: string): TargetOwnerQuery | null {
  if (kind === 'trip_item') return { table: 'trip_itinerary', where: { id, trip: { userId } } };
  if (!isValidUuid(id)) return null;
  if (kind === 'calendar_event') return { table: 'calendar_events', where: { id, user_id: userId } };
  if (kind === 'project_task') return { table: 'operations_project_tasks', where: { id, user_id: userId } };
  if (kind === 'routine') return { table: 'operations_routines', where: { id, user_id: userId } };
  // routine_line — the last kind: the line's routine must be the user's.
  return { table: 'operations_routine_steps', where: { id, routine: { user_id: userId } } };
}

/** The (routine id, instant) a grid tile id encodes: `routine:<id>:<iso>`. */
export function parseRoutineTileId(id: string): { routineId: string; instant: string } | null {
  const m = /^routine:([^:]+):(.+)$/.exec(id);
  if (!m) return null;
  const d = new Date(m[2]);
  if (Number.isNaN(d.getTime())) return null;
  return { routineId: m[1], instant: d.toISOString() };
}
