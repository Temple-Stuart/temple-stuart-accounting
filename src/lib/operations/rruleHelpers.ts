/**
 * Server-side RRULE expansion + form↔RRULE compilation.
 *
 * Routines store schedule_rrule as RFC 5545 strings. Per-routine timezone
 * is required because RRULE expansion is timezone-sensitive (DST, BYHOUR
 * semantics differ by zone). The rrule npm package handles standard RFC
 * 5545 semantics; we wrap it with timezone-aware helpers and a structured
 * form compiler so users never type RRULE strings directly.
 *
 * All exported functions are pure — no DB, no side effects. Used by:
 *   - Inngest cron (routine evaluator) for backward expansion
 *   - API routes for forward window expansion (next N occurrences)
 *   - Form validation for round-trip safety (form → RRULE → form)
 */

import { RRule, RRuleSet, rrulestr, Frequency } from 'rrule';
import { ValidationError } from '@/lib/errors/ValidationError';
import { instantToZoned } from '@/lib/time';
import type { CadenceGroup, CadenceMode, RoutineForm, WeekDay } from '@/components/workbench/operations/routines/types';

/**
 * ONEOFF-01 — A ONE-OFF IS A ROUTINE THAT HAPPENS ONCE.
 *
 * Cadence 'once' compiles to FREQ=DAILY;COUNT=1. A COUNT counts from DTSTART,
 * and every expansion here used to anchor DTSTART at a fixed 1971 instant — so
 * a COUNT=1 rule expanded to ONE occurrence in 1971 and nothing in any window a
 * reader ever asks for. The audit proved that on the library itself.
 *
 * THE ONE MECHANISM: an expansion is anchored on the ROUTINE'S OWN start_date
 * when it has one (scheduleAnchor), and on the fixed anchor when it has none.
 * Every call site passes it — the create and update routes, the completion
 * route, the upcoming and today routes, the calendar's window route and the
 * evaluator — so a one-off is one occurrence on its date to all of them, with
 * no second expansion path and no reader-side bound logic. A rule that names
 * its own components (BYDAY, BYMONTHDAY, BYHOUR — everything the builder
 * writes) expands identically on and after its start date under either anchor;
 * the audit's probe holds daily, weekly BYDAY and monthly BYMONTHDAY equal.
 */
export const ONCE_RRULE = /(^|;)COUNT=1(;|$)/;

/** Is this rule a one-off — a single occurrence, counted from its anchor? */
export function isOnceRRule(rruleString: string): boolean {
  return ONCE_RRULE.test(rruleString);
}

const FLOATING_ANCHOR = new Date(Date.UTC(1971, 0, 1, 0, 0, 0));

/**
 * The DTSTART every expansion of a routine is built on: its start_date at UTC
 * midnight (the @db.Date column stores that instant), or undefined when it has
 * none — in which case rruleFromString keeps the fixed anchor. A one-off MUST
 * have one; the migration's CHECK refuses a COUNT=1 row without a start_date.
 */
export function scheduleAnchor(startDate: Date | string | null | undefined): Date | undefined {
  if (startDate == null || startDate === '') return undefined;
  const d = typeof startDate === 'string'
    ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(startDate) ? `${startDate}T00:00:00.000Z` : startDate)
    : startDate;
  if (Number.isNaN(d.getTime())) throw new ValidationError('start_date is not a date', { field: 'start_date' });
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0));
}

/**
 * ROUTINE-02a (Alex, 2026-10-18) — END DATES HONOURED EVERYWHERE.
 *
 * A routine's end_date (@db.Date — the instant of UTC midnight on the day) is
 * the LAST LOCAL DAY an occurrence may fall on, in the routine's own zone. Both
 * expansions below take it as their last argument and drop every shifted
 * occurrence whose local day in the zone (lib/time.ts instantToZoned — the
 * Budget's own test, days.ts:351-353) is after it; a caller that passes nothing
 * gets every occurrence, as before. The evaluator, the create and update routes,
 * the completion's next-due and the month tables pass it, so a routine whose end
 * has passed expands to nothing: never a miss, next_due_at null.
 */
export function endDayOf(endDate: Date | string | null | undefined): string | null {
  if (endDate == null || endDate === '') return null;
  const d = typeof endDate === 'string'
    ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(endDate) ? `${endDate}T00:00:00.000Z` : endDate)
    : endDate;
  if (Number.isNaN(d.getTime())) throw new ValidationError('end_date is not a date', { field: 'end_date' });
  return d.toISOString().slice(0, 10);
}

/** The occurrences on or before the end day in the zone — every one of them when there is no end. */
export function throughEnd(occurrences: Date[], timezone: string, endDate: Date | string | null | undefined): Date[] {
  const last = endDayOf(endDate);
  if (last === null) return occurrences;
  return occurrences.filter((d) => instantToZoned(d, timezone).date <= last);
}

/** A routine's end as the list shows it: ended when its end day is before today in its own zone. */
export type RoutineEnd =
  /** Not ended; `reason` names a zone Intl could not read (the row is shown, with the reason), else null. */
  | { readonly ended: false; readonly reason: string | null }
  | { readonly ended: true; readonly day: string };

/**
 * ROUTINE-02a — THE ARCHIVE'S TEST. A routine has ended when its end_date is
 * before today in its OWN zone. A zone Intl cannot read is answered by name and
 * the routine counts as current — shown with the reason, never hidden and never
 * judged by another zone.
 */
export function endedBy(endDate: Date | string | null | undefined, timezone: string, now: Date): RoutineEnd {
  const day = endDayOf(endDate);
  if (day === null) return { ended: false, reason: null };
  let today: string;
  try {
    today = instantToZoned(now, timezone).date;
  } catch (error) {
    return { ended: false, reason: zoneUnreadWords(timezone, error instanceof Error ? error.message : String(error)) };
  }
  return day < today ? { ended: true, day } : { ended: false, reason: null };
}

/**
 * ROUTINE-02a — THE ZONE LIST. A routine's zone is one of Intl's own names
 * (Intl.supportedValuesOf('timeZone'); the server's list is the one of record),
 * matched without regard to case and stored in the list's spelling. Nothing
 * else: 'UTC' is not in the list, nor an alias such as 'US/Pacific' — each is
 * refused by name with "pick one from the list", never remapped in silence. A
 * stored name that differs from the list's only by case ('asia/bangkok') names
 * the same zone to Intl, so every instant is unchanged; it is shown as the list
 * spells it and stored that way on its next edit.
 */
export const TIME_ZONES: readonly string[] = Intl.supportedValuesOf('timeZone');
const ZONE_BY_LOWER: ReadonlyMap<string, string> = new Map(TIME_ZONES.map((z) => [z.toLowerCase(), z]));

/** The list's spelling of a zone name, matched without case; null when the name is not in the list. */
export function canonicalZone(name: unknown): string | null {
  if (typeof name !== 'string') return null;
  return ZONE_BY_LOWER.get(name.trim().toLowerCase()) ?? null;
}

/** The list by region — the part before the first "/" — in the list's own order. */
export function zonesByRegion(zones: readonly string[] = TIME_ZONES): readonly { readonly region: string; readonly zones: readonly string[] }[] {
  const groups: { region: string; zones: string[] }[] = [];
  for (const z of zones) {
    const region = z.includes('/') ? z.slice(0, z.indexOf('/')) : z;
    const g = groups.find((x) => x.region === region);
    if (g) g.zones.push(z);
    else groups.push({ region, zones: [z] });
  }
  return groups;
}

/** The route's refusal, by name. */
export const zoneNotListedWords = (name: unknown): string => `timezone ${JSON.stringify(name)} is not one of Intl's zone names — pick one from the list`;
/** The list's words for a stored name that is not in it. */
export const unlistedZoneWords = (name: string): string => `${name} — not in the list, pick one`;
/** The group the viewer's own zone sits in, first. */
export const VIEWER_ZONE_WORDS = "your browser's zone";
/** The list's reason for a zone Intl could not read — the routine stays in view with it. */
export const zoneUnreadWords = (name: string, detail: string): string => `zone ${JSON.stringify(name)} not recognised: ${detail} — pick one from the list`;

/**
 * Compile a RoutineForm's structured fields into an RFC 5545 RRULE string.
 *
 * For 'custom' mode, the raw form.custom_rrule is returned as-is (after
 * basic validation that it parses). For all other modes, the function
 * synthesizes an RRULE from the structured selections plus byhour/byminute.
 */
export function compileFormToRRule(form: RoutineForm): string {
  const byhour = parseIntStrict(form.byhour, 0, 23);
  const byminute = parseIntStrict(form.byminute, 0, 59);

  if (form.cadence_mode === 'custom') {
    const trimmed = form.custom_rrule.trim();
    if (trimmed.length === 0) {
      throw new ValidationError('custom RRULE is required when cadence_mode=custom', { field: 'custom_rrule' });
    }
    // Validate it parses; rrulestr throws on malformed input.
    rrulestr(trimmed.startsWith('RRULE:') ? trimmed : `RRULE:${trimmed}`);
    const bare = trimmed.startsWith('RRULE:') ? trimmed.slice('RRULE:'.length) : trimmed;
    // ONEOFF-01: a hand-written COUNT=1 is a one-off too, and a one-off has its date.
    if (isOnceRRule(bare)) requireOnceDate(form);
    return bare;
  }

  const parts: string[] = [];

  if (form.cadence_mode === 'once') {
    // ONEOFF-01: one occurrence, counted from the routine's start_date (the
    // anchor). Without the date the count would run from 1971.
    requireOnceDate(form);
    parts.push('FREQ=DAILY');
    parts.push('COUNT=1');
  } else if (form.cadence_mode === 'daily') {
    parts.push('FREQ=DAILY');
  } else if (form.cadence_mode === 'weekly') {
    if (form.weekly_byday.length === 0) {
      throw new ValidationError('weekly cadence requires at least one weekday selection', { field: 'weekdays' });
    }
    parts.push('FREQ=WEEKLY');
    parts.push(`BYDAY=${form.weekly_byday.join(',')}`);
  } else if (form.cadence_mode === 'monthly_day_of_month') {
    const dom = parseIntStrict(form.monthly_day_of_month, 1, 31);
    parts.push('FREQ=MONTHLY');
    parts.push(`BYMONTHDAY=${dom}`);
  } else if (form.cadence_mode === 'monthly_nth_weekday') {
    const nth = parseIntStrict(form.monthly_nth, -5, 5);
    if (nth === 0) throw new ValidationError('monthly_nth must be non-zero', { field: 'monthly_nth' });
    parts.push('FREQ=MONTHLY');
    parts.push(`BYDAY=${nth}${form.monthly_weekday}`);
  }

  parts.push(`BYHOUR=${byhour}`);
  parts.push(`BYMINUTE=${byminute}`);
  parts.push('BYSECOND=0');

  const rrule = parts.join(';');
  // Validate that what we synthesized is parseable.
  rrulestr(`RRULE:${rrule}`);
  return rrule;
}

/** ONEOFF-01: the one thing a one-off cannot be without. */
function requireOnceDate(form: Pick<RoutineForm, 'start_date'>): void {
  if (typeof form.start_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(form.start_date)) {
    throw new ValidationError('a one-off needs its date (start_date, YYYY-MM-DD) — the single occurrence is counted from it', { field: 'start_date' });
  }
}

/**
 * Classify an RRULE string into a cadence group for UI grouping.
 *
 * Heuristic — looks at FREQ + BYMONTH for quarterly detection:
 *   COUNT=1 (ONEOFF-01)                               → 'once'
 *   FREQ=DAILY                                        → 'daily'
 *   FREQ=WEEKLY                                       → 'weekly'
 *   FREQ=MONTHLY                                      → 'monthly'
 *   FREQ=YEARLY with BYMONTH=3,6,9,12 (quarterly)    → 'quarterly'
 *   FREQ=YEARLY                                       → 'yearly'
 *   anything else (including FREQ=HOURLY, MINUTELY)  → 'custom'
 */
export function classifyCadence(rruleString: string): CadenceGroup {
  let parsed: RRule;
  try {
    parsed = rruleFromString(rruleString);
  } catch {
    return 'custom';
  }

  // ONEOFF-01: one occurrence is its own group, whatever its FREQ.
  if (parsed.options.count === 1) return 'once';

  switch (parsed.options.freq) {
    case Frequency.DAILY:
      return 'daily';
    case Frequency.WEEKLY:
      return 'weekly';
    case Frequency.MONTHLY:
      return 'monthly';
    case Frequency.YEARLY: {
      const months = parsed.options.bymonth;
      if (months && months.length === 4 && months.every((m) => m % 3 === 0)) {
        return 'quarterly';
      }
      return 'yearly';
    }
    default:
      return 'custom';
  }
}

/**
 * Parse an RRULE string with timezone context. The rrule package treats
 * the RRULE as floating local time unless DTSTART is supplied; we use a
 * synthetic DTSTART anchor to make BYHOUR/BYMINUTE deterministic.
 *
 * The fixed anchor date is intentionally distant in the past (epoch + 1 year)
 * so it never accidentally coincides with the current evaluation window.
 * ONEOFF-01: a routine WITH a start_date is anchored on it (scheduleAnchor) —
 * that is what makes COUNT=1 mean "once, on that date".
 */
export function rruleFromString(rruleString: string, anchor?: Date): RRule {
  // rrulestr can return either RRule or RRuleSet depending on input; for
  // single-RRULE strings we expect RRule.
  const parsed = rrulestr(`RRULE:${rruleString.replace(/^RRULE:/, '')}`, {
    dtstart: anchor ?? FLOATING_ANCHOR,
  });
  if (parsed instanceof RRuleSet) {
    throw new ValidationError('RRuleSet not supported; provide a single RRULE', { field: 'schedule_rrule' });
  }
  return parsed;
}

/**
 * Expand the next N occurrences of an RRULE starting from `after`,
 * interpreted in the given IANA timezone.
 *
 * The rrule package returns Date objects representing UTC instants. We
 * apply timezone offset adjustment so BYHOUR=8 in 'America/Los_Angeles'
 * yields 08:00 PT (15:00 or 16:00 UTC depending on DST), not 08:00 UTC.
 *
 * Implementation note: rrule's `tzid` option requires a specific
 * configuration. For now we compute UTC-anchored occurrences and
 * post-shift them by the routine's timezone offset at each occurrence's
 * date. This handles DST correctly because Intl.DateTimeFormat is
 * applied per-occurrence.
 */
export function expandForward(
  rruleString: string,
  timezone: string,
  after: Date,
  count: number,
  /** ONEOFF-01: the routine's start_date anchor (scheduleAnchor), or undefined. */
  anchor?: Date,
  /** ROUTINE-02a: the routine's end_date — nothing after its day in the zone (throughEnd); absent → no end. */
  endDate?: Date | string | null
): Date[] {
  const rule = rruleFromString(rruleString, anchor);
  // Get UTC-anchored occurrences then shift to timezone.
  const rawOccurrences = rule.between(after, addYears(after, 5), true, (_, i) => i < count);
  return throughEnd(rawOccurrences.map((d) => shiftFloatingToZone(d, timezone)), timezone, endDate);
}

/**
 * Expand all occurrences of an RRULE between `from` and `to` (inclusive),
 * interpreted in the given timezone. Used by the cron's backward
 * evaluation: "what occurrences should have happened between
 * last_evaluated_at and now()?"
 */
export function expandBetween(
  rruleString: string,
  timezone: string,
  from: Date,
  to: Date,
  /** ONEOFF-01: the routine's start_date anchor (scheduleAnchor), or undefined. */
  anchor?: Date,
  /** ROUTINE-02a: the routine's end_date — nothing after its day in the zone (throughEnd); absent → no end. */
  endDate?: Date | string | null
): Date[] {
  const rule = rruleFromString(rruleString, anchor);
  const raw = rule.between(from, to, true);
  return throughEnd(raw.map((d) => shiftFloatingToZone(d, timezone)), timezone, endDate);
}

/**
 * Shift a floating-time Date (interpreted as if it were in 'timezone')
 * to a true UTC instant.
 *
 * Example: rrule returns 2026-05-08T08:00:00.000Z for BYHOUR=8 (UTC).
 * If the routine's timezone is 'America/Los_Angeles', we want the
 * actual instant when LA wall-clock reads 08:00 — which is
 * 2026-05-08T15:00:00.000Z in May (PDT, UTC-7).
 *
 * We compute the offset by formatting the floating Date in the target
 * timezone and the actual UTC instant, then differencing.
 */
function shiftFloatingToZone(floatingDate: Date, timezone: string): Date {
  const utcMs = floatingDate.getTime();
  const offset = getTimezoneOffsetMs(floatingDate, timezone);
  return new Date(utcMs + offset);
}

/**
 * Get the offset in milliseconds between UTC and the named timezone at
 * the given instant. Positive when the timezone is BEHIND UTC (e.g.,
 * America/Los_Angeles is UTC-8 standard or UTC-7 DST → offset is
 * +28800000 or +25200000 ms).
 */
function getTimezoneOffsetMs(instant: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
  const tzAsUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour') === 24 ? 0 : get('hour'),
    get('minute'),
    get('second')
  );
  // PR-Ops-5.7: sign corrected. Prior implementation returned
  // `tzAsUtc - instant.getTime()` which had the opposite sign of what the
  // docstring above promises (negative for behind-UTC zones), causing
  // shiftFloatingToZone to shift every routine occurrence 2× the timezone
  // offset in the WRONG direction. Manifested as Alex's SLEEP routine
  // displaying "expected: 16:00 / missed" for a 00:00–06:00 window in
  // America/New_York. See audit-reports/pr-ops-5.7-phase-1.md.
  return instant.getTime() - tzAsUtc;
}

function addYears(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCFullYear(r.getUTCFullYear() + n);
  return r;
}

function parseIntStrict(value: string, min: number, max: number): number {
  const n = parseInt(value, 10);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new ValidationError(`invalid integer: "${value}" must be between ${min} and ${max}`);
  }
  return n;
}
