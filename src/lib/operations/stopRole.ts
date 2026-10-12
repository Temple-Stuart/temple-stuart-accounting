/**
 * stopRole — WHAT KIND OF STOP A ROUTINE IS, PURE (ROLE-01, 2026-10-13).
 *
 * The day card asked every stop the same questions. A day has five kinds of
 * stop, and three are about work, not money. The role is ONE field on the
 * routine (operations_routines.role, the migration's CHECK), set once on the
 * Tasks tab; a line of a routine takes its routine's role. It decides what the
 * step card asks, and whether the routine is a stop at all:
 *
 *   journal  — the morning questions (JOURNAL-01 brings them)
 *   plan     — the execution plan: the vision in, the plan out (PLAN-01)
 *   execute  — a work block: what was finished up to the break
 *   place    — somewhere you go and pay: the vendor, the amount, the stars
 *   all_day  — a subscription or a membership: in the day's plan, NOT a stop —
 *              no time slot, nothing to record; the plate's "also today" band
 *   none     — a stop with the plain record (done, when, minutes, a note)
 *
 * Here: the six values, the input rule the routes share, the words. No fetch,
 * no clock, no Prisma — the tests drive every rule.
 */

export const STOP_ROLES = ['journal', 'plan', 'execute', 'place', 'all_day', 'none'] as const;
export type StopRole = (typeof STOP_ROLES)[number];

export const DEFAULT_ROLE: StopRole = 'none';

export const isStopRole = (v: unknown): v is StopRole => (STOP_ROLES as readonly unknown[]).includes(v);

export type RoleInputResult =
  | { readonly ok: true; readonly role: StopRole }
  | { readonly ok: false; readonly field: 'role'; readonly message: string };

/** The one rule for a role given to a route: absent → the default; present → one of the six, by name. */
export function roleInput(raw: unknown): RoleInputResult {
  if (raw === undefined) return { ok: true, role: DEFAULT_ROLE };
  if (!isStopRole(raw)) return { ok: false, field: 'role', message: `role must be one of ${STOP_ROLES.join(', ')}` };
  return { ok: true, role: raw };
}

/** Is this routine a stop on the day card? A subscription is in the plan, not on the itinerary. */
export const isStop = (role: StopRole): boolean => role !== 'all_day';

// ── WORDS ───────────────────────────────────────────────────────────────────

/** The role as the Tasks tab offers it — the sentence under each is the card's promise. */
export const ROLE_WORDS: Readonly<Record<StopRole, string>> = {
  journal: 'journal — the morning questions',
  plan: 'plan — the vision in, the plan out',
  execute: 'execute — a work block; what got finished',
  place: 'place — somewhere you go and pay',
  all_day: 'all day — a subscription or membership, not a stop',
  none: 'none — the plain record',
};

/** The short word the card prints. */
export const ROLE_SHORT_WORDS: Readonly<Record<StopRole, string>> = {
  journal: 'journal',
  plan: 'plan',
  execute: 'execute',
  place: 'place',
  all_day: 'all day',
  none: '',
};

export const ALSO_TODAY_WORDS = 'also today';
export const NOT_A_STOP_WORDS = 'in the day\'s plan, not a stop';
/** The hint under the full plate — the record lives on the step view. */
export const TAP_A_STOP_WORDS = 'tap a stop to record it';
/** Why a place stop has no plan line to plan its vendor on — one sentence per cause, never one for all. */
export const NO_AMOUNT_NO_VENDOR_WORDS = 'give this line an amount on the Tasks tab to plan its vendor';
export const REPORT_NOT_READ_NO_VENDOR_WORDS = "the day's amounts could not be read — no vendor can be planned until they are";
export const UNMATCHED_NO_VENDOR_WORDS = "the Budget's line for this stop is at another instant (named under the plate) — no vendor can be planned on it here";
/** The stops route's refusal: an all-day routine is not a stop, so it takes no record. */
export const NOT_A_STOP_RECORD_WORDS = 'the routine is all day — not a stop, so it takes no record';
/** The band's words when some of its lines carry no amount: those are not in the day's plan at all. */
export const allDayBandWords = (withoutAmount: number): string =>
  (withoutAmount === 0 ? NOT_A_STOP_WORDS : `${NOT_A_STOP_WORDS} · ${withoutAmount === 1 ? '1 with no amount, not in the plan' : `${withoutAmount} with no amount, not in the plan`}`);
/** The labels the screens print. */
export const VENDOR_LABEL_WORDS = 'Vendor';
export const ROLE_FIELD_WORDS = 'on the day card';
export const ROLE_TITLE_WORDS = 'role on the day card';
/** "$11 all day" — the band's money, said beside the step card's running figure so its denominator reads right. */
export const allDayCentsWords = (dollars: string): string => `${dollars} all day`;

/** The note box's prompt, by role — what the plain record asks for at a work stop. */
export const NOTE_PROMPT_WORDS: Readonly<Record<Exclude<StopRole, 'all_day'>, string>> = {
  journal: "today's vision — one line",
  plan: 'the plan — one line',
  execute: 'finished up to here',
  place: 'why the delta',
  none: 'note',
};
