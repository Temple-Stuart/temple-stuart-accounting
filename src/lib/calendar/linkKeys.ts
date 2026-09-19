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

/** The (routine id, instant) a grid tile id encodes: `routine:<id>:<iso>`. */
export function parseRoutineTileId(id: string): { routineId: string; instant: string } | null {
  const m = /^routine:([^:]+):(.+)$/.exec(id);
  if (!m) return null;
  const d = new Date(m[2]);
  if (Number.isNaN(d.getTime())) return null;
  return { routineId: m[1], instant: d.toISOString() };
}
