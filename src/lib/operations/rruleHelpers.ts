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
import type { CadenceGroup, CadenceMode, RoutineForm, WeekDay } from '@/components/workbench/operations/routines/types';

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
      throw new Error('custom RRULE is required when cadence_mode=custom');
    }
    // Validate it parses; rrulestr throws on malformed input.
    rrulestr(trimmed.startsWith('RRULE:') ? trimmed : `RRULE:${trimmed}`);
    return trimmed.startsWith('RRULE:') ? trimmed.slice('RRULE:'.length) : trimmed;
  }

  const parts: string[] = [];

  if (form.cadence_mode === 'daily') {
    parts.push('FREQ=DAILY');
  } else if (form.cadence_mode === 'weekly') {
    if (form.weekly_byday.length === 0) {
      throw new Error('weekly cadence requires at least one weekday selection');
    }
    parts.push('FREQ=WEEKLY');
    parts.push(`BYDAY=${form.weekly_byday.join(',')}`);
  } else if (form.cadence_mode === 'monthly_day_of_month') {
    const dom = parseIntStrict(form.monthly_day_of_month, 1, 31);
    parts.push('FREQ=MONTHLY');
    parts.push(`BYMONTHDAY=${dom}`);
  } else if (form.cadence_mode === 'monthly_nth_weekday') {
    const nth = parseIntStrict(form.monthly_nth, -5, 5);
    if (nth === 0) throw new Error('monthly_nth must be non-zero');
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

/**
 * Classify an RRULE string into a cadence group for UI grouping.
 *
 * Heuristic — looks at FREQ + BYMONTH for quarterly detection:
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
 * The anchor date is intentionally distant in the past (epoch + 1 year)
 * so it never accidentally coincides with the current evaluation window.
 */
export function rruleFromString(rruleString: string): RRule {
  // rrulestr can return either RRule or RRuleSet depending on input; for
  // single-RRULE strings we expect RRule.
  const parsed = rrulestr(`RRULE:${rruleString.replace(/^RRULE:/, '')}`, {
    dtstart: new Date(Date.UTC(1971, 0, 1, 0, 0, 0)),
  });
  if (parsed instanceof RRuleSet) {
    throw new Error('RRuleSet not supported; provide a single RRULE');
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
  count: number
): Date[] {
  const rule = rruleFromString(rruleString);
  // Get UTC-anchored occurrences then shift to timezone.
  const rawOccurrences = rule.between(after, addYears(after, 5), true, (_, i) => i < count);
  return rawOccurrences.map((d) => shiftFloatingToZone(d, timezone));
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
  to: Date
): Date[] {
  const rule = rruleFromString(rruleString);
  const raw = rule.between(from, to, true);
  return raw.map((d) => shiftFloatingToZone(d, timezone));
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
    throw new Error(`invalid integer: "${value}" must be between ${min} and ${max}`);
  }
  return n;
}
