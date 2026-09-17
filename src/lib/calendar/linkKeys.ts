/**
 * LINK-01 — THE TARGET KEY, AND NOTHING ELSE.
 *
 * A pure leaf so the route, the panel and the tests agree on what a link may
 * point at. The kinds are the linkable ones from DRILL-01's census, and the
 * migration's CHECK holds the same set at the database.
 */
export const LINKABLE_KINDS = ['calendar_event', 'project_task', 'routine'] as const;
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
  return kind === 'routine';
}

/** The (routine id, instant) a grid tile id encodes: `routine:<id>:<iso>`. */
export function parseRoutineTileId(id: string): { routineId: string; instant: string } | null {
  const m = /^routine:([^:]+):(.+)$/.exec(id);
  if (!m) return null;
  const d = new Date(m[2]);
  if (Number.isNaN(d.getTime())) return null;
  return { routineId: m[1], instant: d.toISOString() };
}
