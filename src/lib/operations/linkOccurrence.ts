/**
 * LINK-LAW-01 (Alex, 2026-10-28, ruling B) — A LINK IS TO A REAL OCCURRENCE.
 *
 * A posting linked to a routine (or a routine's line) is linked to ONE occurrence, keyed on its instant
 * (linkKeys.ts requiresInstant). Until this ruling the links POST only parsed the instant
 * (src/app/api/calendar/links/route.ts readTarget): any timestamp was written, and a posting could be "paid"
 * against a moment the routine never had — a MATCH no screen would ever place.
 *
 * THE TEST is the budget's own occurrence builder, the one /budget and ROUTINE EXPENSES read
 * (src/lib/budget/days.ts buildRoutineBudgetLines): the instant's local day in the routine's OWN zone
 * (lib/time.ts instantToZoned — endedBy's precedent), the routine's start and end dates against that day as
 * calendar days (routineDay.ts), the rule expanded over the Budget's window for that one day (days.ts dayWindow)
 * anchored on the routine's start_date (rruleHelpers.ts expandBetween, scheduleAnchor — the one-off law's one
 * mechanism) and bounded by its end_date. The instant is an occurrence iff it IS one of that day's occurrences,
 * to the millisecond — every occurrence of the day, as the budget places them, not only the first.
 *
 * Anything else is refused by name: "<instant> is not an occurrence of <routine>" — and a zone Intl cannot read,
 * or a rule that does not parse, in the day rules' own words (days.ts NotPlacedReason), never read as UTC.
 * Pure: no Prisma, no request, no clock.
 */
import { dayWindow } from '@/lib/budget/days';
import { expandBetween, scheduleAnchor } from '@/lib/operations/rruleHelpers';
import { instantToZoned } from '@/lib/time';

/** What the test reads of the routine an occurrence belongs to (an operations_routines row). */
export interface OccurrenceRoutine {
  readonly name: string;
  readonly timezone: string;
  readonly schedule_rrule: string;
  /** @db.Date — the instant of UTC midnight on the day. */
  readonly start_date: Date | null;
  readonly end_date: Date | null;
}

/** The select the links POST makes of the routine — the test's input, nothing more. */
export const OCCURRENCE_ROUTINE_SELECT = { name: true, timezone: true, schedule_rrule: true, start_date: true, end_date: true } as const;

export type OccurrenceCheck = { readonly ok: true } | { readonly ok: false; readonly message: string };

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** The refusal, by name: the instant (and how it reads in the routine's zone) and the routine. */
export const notAnOccurrenceWords = (instant: Date, routine: Pick<OccurrenceRoutine, 'name' | 'timezone'>, local: { readonly date: string; readonly time: string }): string =>
  `${instant.toISOString()} (${local.date} ${local.time} ${routine.timezone}) is not an occurrence of ${JSON.stringify(routine.name)}`;

/** Is `instant` one of the routine's occurrences, in its own zone? */
export function occurrenceCheck(routine: OccurrenceRoutine, instant: Date): OccurrenceCheck {
  let local: { date: string; time: string };
  try {
    local = instantToZoned(instant, routine.timezone);
  } catch (error) {
    return { ok: false, message: `${instant.toISOString()} cannot be placed on a day of ${JSON.stringify(routine.name)}: timezone not recognised — ${JSON.stringify(routine.timezone)}: ${messageOf(error)}` };
  }
  const day = local.date;
  // The routine's start and end dates, as calendar days against the instant's local day (routineDay.ts's test).
  if (routine.start_date !== null && routine.start_date.toISOString().slice(0, 10) > day) return { ok: false, message: notAnOccurrenceWords(instant, routine, local) };
  if (routine.end_date !== null && routine.end_date.toISOString().slice(0, 10) < day) return { ok: false, message: notAnOccurrenceWords(instant, routine, local) };
  const { windowFrom, windowTo } = dayWindow(day, day);
  let occurrences: Date[];
  try {
    occurrences = expandBetween(routine.schedule_rrule, routine.timezone, windowFrom, windowTo, scheduleAnchor(routine.start_date), routine.end_date);
  } catch (error) {
    return { ok: false, message: `${instant.toISOString()} cannot be tested against ${JSON.stringify(routine.name)}: schedule does not parse — ${JSON.stringify(routine.schedule_rrule)}: ${messageOf(error)}` };
  }
  return occurrences.some((o) => o.getTime() === instant.getTime()) ? { ok: true } : { ok: false, message: notAnOccurrenceWords(instant, routine, local) };
}
