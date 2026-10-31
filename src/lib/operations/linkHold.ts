/**
 * LINK-LAW-01 (Alex, 2026-10-28, ruling D) — NO ORPHANS.
 *
 * planned_item_links.target_id carries no foreign key (prisma/schema.prisma planned_item_links — the target is one of
 * five tables, so the database cannot hold it). A routine's hard DELETE (src/app/api/operations/routines/[id]/route.ts)
 * cascades its lines (operations_routine_steps routine_id onDelete: Cascade) and left every posting linked to the
 * routine or a line pointing at a row that no longer exists — a payment no screen can place. So the DELETE refuses
 * while the routine or any of its lines (active or archived) holds a link: 409, by name, "this routine has N postings
 * linked in Books — deactivate it instead (every record stays)". The move route's precedent
 * (src/app/api/operations/routines/move/route.ts proveNoHistory: the same OR over the routine and its lines, counted
 * inside the transaction, refused with 409).
 *
 * The line DELETE (src/app/api/operations/routines/steps/[stepId]/route.ts) is itself a deactivation — it archives the
 * line (is_active false), its row stays — so it refuses the same way while the line holds links, and its words send
 * the founder to the routine's deactivate: archiving a line drops it from ROUTINE EXPENSES' plans, and its links with
 * it. Deactivate is unchanged. Pure: the words and the query's shape, no Prisma.
 */

const postings = (n: number): string => `${n} posting${n === 1 ? '' : 's'}`;

/** The routine DELETE's refusal (the ruling's words). */
export const routineHoldsLinksWords = (n: number): string =>
  `this routine has ${postings(n)} linked in Books — deactivate it instead (every record stays)`;

/** The line DELETE's refusal — the line's own count; a line's DELETE is its deactivation, so the routine's is named. */
export const lineHoldsLinksWords = (n: number): string =>
  `this line has ${postings(n)} linked in Books — deactivate its routine instead (every record stays)`;

/** The links a routine holds: on the routine itself, or on any of its lines — the move route's OR. */
export function routineLinksWhere(userId: string, routineId: string, lineIds: readonly string[]) {
  return {
    user_id: userId,
    OR: [
      { target_kind: 'routine', target_id: routineId },
      ...(lineIds.length > 0 ? [{ target_kind: 'routine_line', target_id: { in: [...lineIds] } }] : []),
    ],
  };
}
