/**
 * routineDay — ONE DAY OF A ROUTINE, ANY DAY (WEEK-01, 2026-09-30).
 *
 * The day logic GET /api/operations/routines/today ran inline, moved here so
 * the route can answer any day and a test can drive it: the routine's local day
 * in its OWN zone (today at `now`, or the day asked for), that day's bounds,
 * the start/end-date checks against it, the expansion anchored on the routine's
 * start_date (scheduleAnchor — the one-off law's one mechanism), the first
 * occurrence of the day, and its status against `now`.
 *
 * NOTHING DROPPED. A routine whose zone cannot be read, or whose schedule does
 * not parse, is REFUSED in the day rules' own words (src/lib/budget/days.ts
 * NotPlacedReason) — never placed in UTC, never skipped with a console line.
 *
 * Pure: no Prisma, no request, no clock — `now` is the caller's.
 */
import type { NotPlacedReason } from '@/lib/budget/days';
import { isIsoDay } from '@/lib/budget/days';
import { expandBetween, scheduleAnchor } from '@/lib/operations/rruleHelpers';
import { instantToZoned } from '@/lib/time';
import type { TodayStatus } from '@/components/workbench/operations/routines/types';

/** A 'YYYY-MM-DD' calendar day. */
export type LocalDay = string;

/** Why a routine's day could not be read — the day rules' words. */
export type RoutineDayRefusal = Extract<NotPlacedReason, 'timezone not recognised' | 'schedule does not parse'>;

/** What the day logic reads of a routine (an operations_routines row). */
export interface RoutineDayInput {
  readonly timezone: string;
  readonly schedule_rrule: string;
  /** @db.Date — the instant of UTC midnight on the day. */
  readonly start_date: Date | null;
  readonly end_date: Date | null;
}

export type RoutineDay =
  | { readonly kind: 'refused'; readonly reason: RoutineDayRefusal; readonly detail: string }
  /** Out of its start/end dates that day, or no occurrence falls on it. */
  | { readonly kind: 'none'; readonly day: LocalDay }
  | { readonly kind: 'occurrence'; readonly day: LocalDay; readonly expectedAt: Date };

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * The ?date= parameter. Absent → null (today, in each routine's own zone). A
 * value that is not a real 'YYYY-MM-DD' day is refused by name — never today
 * instead.
 */
export function parseDayParam(raw: string | null): { readonly ok: true; readonly day: LocalDay | null } | { readonly ok: false; readonly message: string } {
  if (raw === null) return { ok: true, day: null };
  if (!isIsoDay(raw)) return { ok: false, message: `date ${JSON.stringify(raw)} is not a 'YYYY-MM-DD' day` };
  return { ok: true, day: raw };
}

/** The local calendar day of `now` in `tz` (the today route's formatter, :55-66). */
function localDayOf(now: Date, tz: string): LocalDay {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
  return `${String(get('year')).padStart(4, '0')}-${String(get('month')).padStart(2, '0')}-${String(get('day')).padStart(2, '0')}`;
}

/**
 * A local day's start and end in `tz`, as UTC instants: "00:00 in tz that day"
 * and 24 hours later (the today route's todayBounds, :68-87, for any day).
 */
export function dayBounds(day: LocalDay, tz: string): { start: Date; end: Date } {
  const [year, month, date] = day.split('-').map(Number);
  // Construct UTC midnight for the local date, then shift by the tz's
  // offset at that instant to get the actual UTC instant of local midnight.
  const utcMidnight = Date.UTC(year, month - 1, date, 0, 0, 0);
  const fmt2 = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const partsAtUtcMidnight = fmt2.formatToParts(new Date(utcMidnight));
  const get2 = (type: string) => Number(partsAtUtcMidnight.find((p) => p.type === type)?.value ?? '0');
  const tzShown = Date.UTC(
    get2('year'), get2('month') - 1, get2('day'),
    get2('hour') === 24 ? 0 : get2('hour'), get2('minute'), get2('second')
  );
  const offsetMs = tzShown - utcMidnight;
  const localMidnightUtc = utcMidnight - offsetMs;

  return {
    start: new Date(localMidnightUtc),
    end: new Date(localMidnightUtc + 24 * 60 * 60 * 1000),
  };
}

/**
 * The routine's day: `day` (a local date in the routine's own zone) or, when
 * null, today in its zone at `now`. The first occurrence in the day's bounds, or
 * none, or a refusal.
 */
export function routineDay(r: RoutineDayInput, day: LocalDay | null, now: Date): RoutineDay {
  // The zone first — an unreadable zone is refused, never read as UTC.
  try {
    instantToZoned(now, r.timezone);
  } catch (error) {
    return { kind: 'refused', reason: 'timezone not recognised', detail: `${JSON.stringify(r.timezone)}: ${messageOf(error)}` };
  }
  const localDay = day === null ? localDayOf(now, r.timezone) : day;
  const { start, end } = dayBounds(localDay, r.timezone);

  // In scope that day iff within [start_date, end_date] — the @db.Date bounds
  // are UTC midnights, compared as calendar days against the routine's local day.
  if (r.start_date && r.start_date.toISOString().slice(0, 10) > localDay) return { kind: 'none', day: localDay };
  if (r.end_date && r.end_date.toISOString().slice(0, 10) < localDay) return { kind: 'none', day: localDay };

  let occurrences: Date[];
  try {
    // ONEOFF-01: anchored on the routine's start_date — the one mechanism.
    occurrences = expandBetween(r.schedule_rrule, r.timezone, start, end, scheduleAnchor(r.start_date));
  } catch (error) {
    return { kind: 'refused', reason: 'schedule does not parse', detail: `${JSON.stringify(r.schedule_rrule)}: ${messageOf(error)}` };
  }
  if (occurrences.length === 0) return { kind: 'none', day: localDay };
  return { kind: 'occurrence', day: localDay, expectedAt: occurrences[0] };
}

/**
 * An occurrence's status against `now` (the today route's rule, :162-174):
 * a completion → completed; past its fail threshold → missed; due → pending;
 * else upcoming.
 */
export function routineStatus(expectedAt: Date, completed: boolean, failThresholdMinutes: number, now: Date): TodayStatus {
  if (completed) return 'completed';
  const failThresholdMs = failThresholdMinutes * 60 * 1000;
  if (now.getTime() > expectedAt.getTime() + failThresholdMs) return 'missed';
  if (expectedAt.getTime() <= now.getTime()) return 'pending';
  return 'upcoming';
}
