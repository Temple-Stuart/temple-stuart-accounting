/**
 * Map the /api/hub/operations-routines response → CalendarGrid events.
 *
 * Emits one CalendarEvent per (routine, occurrence) pair so each
 * occurrence renders as its own tile on the Hub calendar.
 *
 * Display strategy (PR-Ops-5.8):
 *
 *   TIMED routines (routine.start_time present):
 *     - startTime / endTime are extracted DIRECTLY from routine.start_time /
 *       routine.end_time via .slice(11, 16), mirroring the routines-page
 *       convention (DailyPlanRoutineRow.tsx:65-79 / RoutineRow.tsx:211-222).
 *       These are the user's intent-window — the literal HH:MM they typed —
 *       so the Hub and the routines page now agree on what time a routine is.
 *     - The rrule's BYHOUR/BYMINUTE is cron metadata for miss-evaluation, NOT
 *       a display source. PR-Ops-5.6 incorrectly extracted display time from
 *       the occurrence ISO via browser-local getHours(), causing the Hub to
 *       disagree with the routines page (e.g., gym intent 07:00–09:00 rendered
 *       at 02:00 on the Hub for some viewer-timezone × routine-timezone combos).
 *
 *   TIME-LESS routines (routine.start_time is null — cadence-only):
 *     - Emitted WITHOUT startTime, which CalendarGrid interprets as an all-day
 *       event (CalendarGrid.tsx:109 skips timed-block builder for events
 *       without startTime; :350 collects them into the all-day row at the
 *       top of the calendar, same mechanism as the existing AT&T / Food /
 *       Coffee sources).
 *     - This is a DELIBERATE, Alex-approved design choice per PR-Ops-5.8:
 *       a routine with no intent-window start is not a timed event; placing
 *       it in the hourly grid would assert a time it doesn't have. All-day
 *       placement is the honest representation.
 *     - Cost/expense semantics for these come LATER with the cost-fields
 *       schema migration; this PR is display placement only.
 *
 * startDate is always converted from the occurrence ISO to YYYY-MM-DD IN THE
 * ROUTINE'S TIMEZONE (via Intl.DateTimeFormat), not the viewer's browser
 * timezone, so the tile lands on the correct calendar day regardless of
 * where the Hub is being viewed. Mirrors the server's own formatLocalDate
 * helper at /api/hub/operations-routines/route.ts:45-55.
 */

import type { CalendarEvent } from '@/components/shared/CalendarGrid';

export interface RoutineWindowEntry {
  routine_id: string;
  name: string;
  entity_id: string;
  timezone: string;
  start_time: string | null;  // "1970-01-01THH:MM:SS.000Z" or null (cadence-only)
  end_time: string | null;
  occurrences: string[];      // ISO instants from expandBetween
  coa_code: string | null;    // routine's COA (soft ref to chart_of_accounts.code) or null
  budget_amount: number | null; // per-occurrence budget, or null if the routine has no budget
}

export interface RoutinesWindowResponse {
  routines: RoutineWindowEntry[];
  truncated: boolean;
}

const ROUTINES_SOURCE = 'routines';
const ROUTINES_HREF = '/operations/routines';

/**
 * Convert a UTC ISO instant to YYYY-MM-DD in the given IANA timezone.
 * Falls back to UTC date if the timezone is malformed (defensive — every
 * routine has a real timezone in practice, but Intl.DateTimeFormat can
 * throw on bogus zone strings).
 */
function formatDateInZone(iso: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toISOString().slice(0, 10);
  }
}

export function mapOperationsRoutines(response: RoutinesWindowResponse): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  for (const routine of response.routines) {
    // Intent-window times — literal HH:MM the user typed, no tz math.
    // Matches DailyPlanRoutineRow.tsx:65-79 exactly.
    const startTime = routine.start_time ? routine.start_time.slice(11, 16) : null;
    const endTime = routine.end_time ? routine.end_time.slice(11, 16) : null;
    // Carry the routine's COA + budget onto every occurrence tile so the detail panel can show
    // them (snake→camel, mirroring the lodging feed at HubCalendar.tsx:201,204). Real values
    // only — coaCode passes null truthfully; budgetAmount is number-or-absent (CalendarEvent's
    // budgetAmount is `number?`, so a null budget maps to undefined = "no budget", never 0).
    const coaCode = routine.coa_code;
    const budgetAmount = routine.budget_amount ?? undefined;

    for (const occISO of routine.occurrences) {
      const startDate = formatDateInZone(occISO, routine.timezone);

      if (startTime) {
        // Timed routine → hourly-grid block at the user's intent window.
        events.push({
          id: `routine:${routine.routine_id}:${occISO}`,
          source: ROUTINES_SOURCE,
          title: routine.name,
          startDate,
          startTime,
          endTime: endTime ?? undefined,
          isRecurring: true,
          href: ROUTINES_HREF,
          coaCode,
          budgetAmount,
        });
      } else {
        // Time-less routine → all-day event at the top of the calendar.
        // CalendarGrid uses the absence of startTime as the all-day signal
        // (CalendarGrid.tsx:350 — `dayEvts.filter(e => !e.startTime)`).
        // Deliberate per PR-Ops-5.8: a routine with no intent-window start
        // is not a timed event; rendering it in the hourly grid would assert
        // a time it doesn't have. Same visual treatment as the existing
        // AT&T / Food / Coffee all-day sources.
        events.push({
          id: `routine:${routine.routine_id}:${occISO}`,
          source: ROUTINES_SOURCE,
          title: routine.name,
          startDate,
          // startTime intentionally omitted → CalendarGrid renders all-day
          isRecurring: true,
          href: ROUTINES_HREF,
          coaCode,
          budgetAmount,
        });
      }
    }
  }

  return events;
}
