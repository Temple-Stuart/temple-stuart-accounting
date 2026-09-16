/**
 * DAY-01 STEP 0.5 / STEP 5 — CAN AN EVENT'S ACTUAL COST BE READ FROM BOOKS?
 *
 * THE VERDICT IS NO. The ruling provided for exactly this: "If actuals cannot be
 * joined reliably, say so — that is a finding, not something to fake." So this
 * file ships the finding and nothing else. The day view shows EXPECTED only, and
 * states this reason on the screen rather than leaving a blank column the reader
 * would fill in with a guess.
 *
 * The join the ruling asked about is `calendar_events(start_date, coa_code)`
 * against a posted amount in Books. A posted amount lives in
 * ledger_entries.amount, reached as
 *   journal_entries (userId, entity_id, date)
 *     → ledger_entries (journal_entry_id, account_id, entry_type, amount)
 *       → chart_of_accounts (id, userId, entity_id, code)
 * so the join would have to be
 *   calendar_events.coa_code = chart_of_accounts.code
 *   AND calendar_events.start_date = journal_entries.date
 *
 * Four things break it, any ONE of which is disqualifying. They are listed in
 * ACTUALS_JOIN_BLOCKERS so the screen can state them and a test can hold them.
 */

/** Is the date + coa_code join sound enough to render an actual? */
export const ACTUALS_JOIN_SOUND = false;

/** One reason the join does not hold, with the evidence for it. */
export interface ActualsBlocker {
  readonly name: string;
  readonly detail: string;
  readonly evidence: string;
}

export const ACTUALS_JOIN_BLOCKERS: readonly ActualsBlocker[] = [
  {
    name: 'the codes are not the same string',
    detail:
      "calendar_events.coa_code is written PREFIXED by the trip path ('P-9200'), while chart_of_accounts.code is a bare four digits ('9200'). An equality join matches nothing at all for a trip event, and the module sources write the bare code — so the two halves of the same column are in two different formats.",
    evidence:
      "src/app/api/trips/[id]/commit/route.ts:53-71 writes `${prefix}-9200`; src/lib/coa/seedSets.ts:140 is the law that every chart code is /^\\d{4}$/; src/components/shared/CalendarGrid.tsx:194-200 already documents the stored form as '<prefix>-<number>' and matches on the SUFFIX to find lodging",
  },
  {
    name: 'an event carries no entity',
    detail:
      'chart_of_accounts is unique on (userId, entity_id, code), so one bare code exists once per entity — the same 9200 under the personal chart and under the business chart. calendar_events has no entity_id column, so even a format-corrected code cannot say WHICH chart it means.',
    evidence: 'prisma/schema.prisma model calendar_events — no entity_id; model chart_of_accounts — @@unique([userId, entity_id, code])',
  },
  {
    name: 'the dates mean different things',
    detail:
      "an event's start_date is when the thing HAPPENS; journal_entries.date is when the money POSTED. A hotel booked in June for an August stay posts in June and happens in August. Matching them on equality would report the August night as unpaid and attribute nothing to June.",
    evidence: 'prisma/schema.prisma calendar_events.start_date @db.Date (the planned day) vs journal_entries.date @db.Date (the posting day)',
  },
  {
    name: 'the match is many-to-many',
    detail:
      'two activities on one day both carry P-9400, and a day can hold several postings to one account. A (date, code) pair therefore selects a SET of events and a SET of ledger entries with no key between them — there is no way to say which dollar belongs to which event without guessing.',
    evidence: 'no column links calendar_events to journal_entries or ledger_entries in either direction (prisma/schema.prisma: calendar_events has source/source_id only, pointing at its own writer’s row)',
  },
] as const;

/**
 * The line the day view prints where the actual column would be. It names the
 * verdict and the first reason; the PR body carries all four.
 */
export const ACTUALS_NOT_JOINABLE_LINE =
  'Actual cost is not shown: an event’s account code and a posted entry’s account code are not the same string, an event names no entity, a planned date is not a posting date, and one date-and-code selects many of each. Any match would be a guess.';

/**
 * The precedent this follows. The trip ledger refused the same class of guess
 * rather than inventing a mapping, and said so on the screen.
 */
export const ACTUALS_PRECEDENT =
  'src/components/trips/TripBudgetActual.tsx:27-33 — "per-budget-line mapping stays structurally impossible — no reservation↔line key exists, and it is never guessed by vendor-name heuristics"';
