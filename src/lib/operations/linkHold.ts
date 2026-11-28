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
 *
 * EDIT-02 (Alex, 2026-11-28) — A PLAN CODED ON A BOOKS LINE. ledger_line_links.routine_id is ON DELETE RESTRICT (prisma/schema.prisma
 * ledger_line_links; migration 20260722000000_dim_links_vendor): a routine a Books line is coded to cannot be deleted, and the DELETE
 * failed in the generic fail-closed words. It now counts those lines in the same transaction and refuses 409 by name, nothing deleted —
 * "this plan is coded on N lines in Books — re-code them there first, or deactivate the plan on Expenses".
 *
 * EDIT-03 (Alex, 2026-11-29) — A PLAN MOVES TO ANOTHER BOOK (routines/[id]/route.ts PATCH, entity_id; the plan, src/lib/operations/bookMove.ts).
 * The same two holds refuse the move, by name, with nothing moved — a posting linked to the plan, a Books line coded to it — and two more: an
 * account its book's chart does not hold, and another record of the plan that keeps its own book. EDIT-04 (Alex, 2026-11-29): no account
 * carries over by its number — the plan's CATEGORY is picked in the new book: a plan with none takes no pick, a plan with one takes one, a
 * plan whose lines carry two or more is refused.
 */

const postings = (n: number): string => `${n} posting${n === 1 ? '' : 's'}`;

/** The routine DELETE's refusal (the ruling's words). */
export const routineHoldsLinksWords = (n: number): string =>
  `this routine has ${postings(n)} linked in Books — deactivate it instead (every record stays)`;

/** EDIT-02 (2026-11-28): the routine DELETE's refusal while Books lines are coded to the plan (ledger_line_links — RESTRICT). */
export const ROUTINE_CODED_ON_BOOKS_WORDS = (n: number): string =>
  `this plan is coded on ${n} line${n === 1 ? '' : 's'} in Books — re-code ${n === 1 ? 'it' : 'them'} there first, or deactivate the plan on Expenses`;

/** EDIT-03 (2026-11-29): the book move's refusals (bookMove.ts) — (a) a posting linked to the plan, (b) Books lines coded to it, (d) other records of the plan that keep their own book; EDIT-04 (2026-11-29): the account, where (c) stood — a CATEGORY sent for a plan with none, none picked for a plan with one, a plan whose lines carry two or more ((c), accounts the target book's chart did not hold by their number, until then). Nothing is moved. */
export const BOOKS_LINK_MOVE_WORDS = 'a posting in Books is linked to this plan — unlink it there before moving the plan to another book';
export const BOOKS_CODED_MOVE_WORDS = (n: number): string =>
  `this plan is coded on ${n} line${n === 1 ? '' : 's'} in Books — re-code ${n === 1 ? 'it' : 'them'} there before moving the plan to another book`;
export const MOVE_NO_ACCOUNT_WORDS = 'this plan has no CATEGORY — pick the book alone';
export const MOVE_PICK_ACCOUNT_WORDS = (book: string): string => `pick its CATEGORY in ${book} — the list under ENTITY holds that book's accounts`;
export const MOVE_ACCOUNTS_MANY_WORDS = (codes: readonly string[]): string => `this plan's lines carry ${codes.join(' and ')} — give them one CATEGORY, then move it`;
export const MOVE_OTHER_BOOK_ROWS_WORDS = (n: number): string =>
  `${n} other record${n === 1 ? '' : 's'} of this plan — on the hub's schedule or in Content — ${n === 1 ? 'keeps its' : 'keep their'} book; nothing was moved`;

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
