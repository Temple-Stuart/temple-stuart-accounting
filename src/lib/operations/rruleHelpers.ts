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
import type { CadenceGroup, CadenceMode, DaysChoice, RoutineForm, WeekDay } from '@/components/workbench/operations/routines/types';
import { CADENCE_GROUP_LABELS, DEFAULT_ROUTINE_FORM, WEEKDAYS, WEEKDAY_LABELS, WEEKDAY_ORDER, WEEKEND } from '@/components/workbench/operations/routines/types';

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
 * ROUTINE-02b (Alex, 2026-10-18) — ONE TIME PER ROUTINE: THE START TIME IS THE CLOCK.
 *
 * "Why not just have it read off the start time… make it not optional, remove
 * the Hour section… and when I set it up, it updates everything." A routine's
 * clock — the BYHOUR/BYMINUTE every reader expands (routineDay.ts, the
 * evaluator, the month tables) — is DERIVED from its start time, here, by the
 * one compiler. The hour and minute boxes are gone from the builder; a body's
 * byhour/byminute, when still sent (the ledger's "+ expense" sends agreeing
 * ones), must agree with the start time, and a custom rule that names a
 * different BYHOUR/BYMINUTE is refused by name — one fact, a second writer
 * refused, never remapped in silence. A custom rule naming neither gets them
 * appended from the start time. The start time is REQUIRED: a routine with no
 * clock is not a routine.
 */
export interface Clock {
  readonly hour: number;
  readonly minute: number;
}

/** 'HH:MM' → the clock it names; null for anything else (blank, absent, not a time). */
export function clockOfTime(time: unknown): Clock | null {
  if (typeof time !== 'string') return null;
  const m = /^(\d{2}):(\d{2})$/.exec(time.trim());
  if (!m) return null;
  const hour = Number(m[1]), minute = Number(m[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

/** The clock a rule names — its BYHOUR and BYMINUTE (a BYHOUR alone is minute 0, rrule's own default); null when it names no BYHOUR. */
export function clockOfRule(rrule: string): Clock | null {
  const hour = /(?:^|;)BYHOUR=(\d+)(?:;|$)/.exec(rrule)?.[1];
  if (hour === undefined) return null;
  const minute = /(?:^|;)BYMINUTE=(\d+)(?:;|$)/.exec(rrule)?.[1];
  return { hour: Number(hour), minute: minute === undefined ? 0 : Number(minute) };
}

/** The clock as 'HH:MM'. */
export const clockWords = (clock: Clock): string => `${String(clock.hour).padStart(2, '0')}:${String(clock.minute).padStart(2, '0')}`;

/** Two clocks the same? */
export const sameClock = (a: Clock | null, b: Clock | null): boolean => a !== null && b !== null && a.hour === b.hour && a.minute === b.minute;

/** The rule with this clock: its BYHOUR and BYMINUTE parts replaced, or appended when it names none. The other parts are untouched. */
export function withClock(rrule: string, clock: Clock): string {
  const hour = `BYHOUR=${clock.hour}`;
  const minute = `BYMINUTE=${clock.minute}`;
  let sawHour = false;
  let sawMinute = false;
  const parts = rrule.split(';').filter((p) => p !== '').map((p) => {
    if (/^BYHOUR=/.test(p)) { sawHour = true; return hour; }
    if (/^BYMINUTE=/.test(p)) { sawMinute = true; return minute; }
    return p;
  });
  if (!sawHour) parts.push(hour);
  if (!sawMinute) parts.push(minute);
  return parts.join(';');
}

export const START_TIME_REQUIRED_WORDS = "start time is required — it is the routine's time";
export const END_TIME_REQUIRED_WORDS = 'end time is required when a start time is set — the window';
/** MOVE-01 (Alex, 2026-10-19): the window may cross midnight — an end before the start ends the next day; only an end EQUAL to the start is refused (an empty window). */
export const EMPTY_WINDOW_WORDS = 'end_time equals start_time — the window is empty; an end before the start ends the next day';
/** A second writer of the clock that disagrees with the start time — refused by name. */
export const clockDisagreeWords = (what: string, theirs: string, startTime: string): string =>
  `${what} ${theirs} disagree with the start time ${startTime} — the start time is the routine's time; send one or make them agree`;

/** The byhour/byminute a body still sends (strings) read as a clock, or null when neither is sent. Not a time → thrown by name. */
function sentClock(form: Pick<RoutineForm, 'byhour' | 'byminute'>): Clock | null {
  const sentHour = typeof form.byhour === 'string' && form.byhour.trim() !== '';
  const sentMinute = typeof form.byminute === 'string' && form.byminute.trim() !== '';
  if (!sentHour && !sentMinute) return null;
  return { hour: sentHour ? parseIntStrict(form.byhour, 0, 23) : 0, minute: sentMinute ? parseIntStrict(form.byminute, 0, 59) : 0 };
}

/** ROUTINE-02b: the clock the form's start time names — required; a byhour/byminute still sent must agree with it. */
function requireClock(form: Pick<RoutineForm, 'start_time' | 'byhour' | 'byminute'>): Clock {
  const clock = clockOfTime(form.start_time);
  if (clock === null) throw new ValidationError(START_TIME_REQUIRED_WORDS, { field: 'start_time' });
  const sent = sentClock(form);
  if (sent !== null && !sameClock(sent, clock)) {
    throw new ValidationError(clockDisagreeWords('byhour/byminute', clockWords(sent), form.start_time), { field: 'byhour' });
  }
  return clock;
}

/**
 * Compile a RoutineForm's structured fields into an RFC 5545 RRULE string.
 *
 * For 'custom' mode, the raw form.custom_rrule is returned as-is (after
 * basic validation that it parses), its clock checked against the start time
 * (ROUTINE-02b) and appended when it names none. For all other modes, the
 * function synthesizes an RRULE from the structured selections plus the clock
 * the start time names.
 */
export function compileFormToRRule(form: RoutineForm): string {
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
    // ROUTINE-02b: the clock is the start time; the rule's own clock must be it, and a rule naming none gets it.
    const clock = requireClock(form);
    const ruleClock = clockOfRule(bare);
    if (ruleClock !== null && !sameClock(ruleClock, clock)) {
      throw new ValidationError(clockDisagreeWords("the raw rule's BYHOUR/BYMINUTE", clockWords(ruleClock), form.start_time), { field: 'custom_rrule' });
    }
    return ruleClock === null ? withClock(bare, clock) : bare;
  }

  const parts: string[] = [];

  if (form.cadence_mode === 'once') {
    // ONEOFF-01: one occurrence, counted from the routine's start_date (the
    // anchor). Without the date the count would run from 1971.
    requireOnceDate(form);
  }
  // ROUTINE-02b: the clock is the start time — required; byhour/byminute, when sent, must agree.
  const clock = requireClock(form);
  const byhour = clock.hour;
  const byminute = clock.minute;

  if (form.cadence_mode === 'once') {
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

// ── FORM-01 (Alex, 2026-10-19): THE DAYS CONTROL AND THE LIST'S WORDS ─────────
//
// A routine is which days · what time · how much · which account. The form's
// DAYS control is one choice (types.ts DaysChoice); the edit form opens in the
// MATCHING choice (formOfRule): a stored rule opens structured when its PARTS
// equal the choice's compiled parts as a set — the same keys and values, order
// ignored (Alex, 2 yes amended) — else as Custom rule with the raw box, so a
// rule no choice reproduces is never silently rewritten. The list prints the
// cadence (classifyCadence's word), the days the rule falls on (daysWords),
// the window (timeWords), and sorts by the rule's clock (clockMinutesOf).

/** The rule's parts, KEY → value ('RRULE:' stripped, keys upper-cased, blanks dropped). */
export function ruleParts(rrule: string): Map<string, string> {
  const bare = rrule.trim().replace(/^RRULE:/i, '');
  const out = new Map<string, string>();
  for (const part of bare.split(';')) {
    if (part.trim() === '') continue;
    const eq = part.indexOf('=');
    if (eq === -1) { out.set(part.trim().toUpperCase(), ''); continue; }
    out.set(part.slice(0, eq).trim().toUpperCase(), part.slice(eq + 1).trim());
  }
  return out;
}

/** Two rules with the same parts as a set — the same keys and values, order ignored. */
export function samePartSet(a: string, b: string): boolean {
  const pa = ruleParts(a);
  const pb = ruleParts(b);
  if (pa.size !== pb.size) return false;
  for (const [k, v] of pa) if (pb.get(k) !== v) return false;
  return true;
}

/** The fields the days control and the rule share. */
export type RuleForm = Pick<RoutineForm, 'days' | 'cadence_mode' | 'weekly_byday' | 'monthly_day_of_month' | 'monthly_nth' | 'monthly_weekday' | 'custom_rrule'>;

const isWeekDay = (v: string): v is WeekDay => (WEEKDAY_ORDER as readonly string[]).includes(v);
const byOrder = (days: readonly WeekDay[]): WeekDay[] => [...days].sort((a, b) => WEEKDAY_ORDER.indexOf(a) - WEEKDAY_ORDER.indexOf(b));
const pad2 = (n: number): string => String(n).padStart(2, '0');

/** The form with this days choice — the wire fields follow it; a switch to Custom rule seeds the box with the rule the form compiles to, when it compiles. */
export function withDays(form: RoutineForm, days: DaysChoice): RoutineForm {
  switch (days) {
    case 'every_day': return { ...form, days, cadence_mode: 'daily' };
    case 'weekdays': return { ...form, days, cadence_mode: 'weekly', weekly_byday: [...WEEKDAYS] };
    case 'weekends': return { ...form, days, cadence_mode: 'weekly', weekly_byday: [...WEEKEND] };
    case 'pick_days': return { ...form, days, cadence_mode: 'weekly' };
    case 'once': return { ...form, days, cadence_mode: 'once' };
    case 'monthly': return { ...form, days, cadence_mode: form.cadence_mode === 'monthly_nth_weekday' ? 'monthly_nth_weekday' : 'monthly_day_of_month' };
    case 'custom': {
      if (form.custom_rrule.trim() !== '') return { ...form, days, cadence_mode: 'custom' };
      let seed = '';
      try { seed = form.cadence_mode === 'custom' ? '' : compileFormToRRule(form); } catch { seed = ''; }
      return { ...form, days, cadence_mode: 'custom', custom_rrule: seed };
    }
  }
}

/**
 * The stored rule as the days control: the choice whose compiled parts equal
 * the rule's as a set, with its fields; else Custom rule with the raw box.
 * Pure: the rule's own clock is the start time the compile sees.
 */
export function formOfRule(rrule: string, startDate: string | Date | null): RuleForm {
  // The start date as the compiler reads it — a 'YYYY-MM-DD' day, whether handed a Date, a @db.Date's JSON or the day itself.
  const startDay = startDate instanceof Date ? startDate.toISOString().slice(0, 10) : startDate === null ? null : startDate.slice(0, 10);
  const custom: RuleForm = {
    days: 'custom', cadence_mode: 'custom',
    weekly_byday: [...DEFAULT_ROUTINE_FORM.weekly_byday], monthly_day_of_month: DEFAULT_ROUTINE_FORM.monthly_day_of_month,
    monthly_nth: DEFAULT_ROUTINE_FORM.monthly_nth, monthly_weekday: DEFAULT_ROUTINE_FORM.monthly_weekday, custom_rrule: rrule,
  };
  const clock = clockOfRule(rrule);
  if (clock === null) return custom;
  const parts = ruleParts(rrule);
  const freq = parts.get('FREQ');
  let candidate: RuleForm | null = null;
  const structured = (over: Partial<RuleForm>): RuleForm => ({ ...custom, custom_rrule: '', ...over });
  if (isOnceRRule(rrule)) {
    candidate = structured({ days: 'once', cadence_mode: 'once' });
  } else if (freq === 'DAILY') {
    candidate = structured({ days: 'every_day', cadence_mode: 'daily' });
  } else if (freq === 'WEEKLY' && parts.has('BYDAY')) {
    const listed = (parts.get('BYDAY') ?? '').split(',').map((d) => d.trim().toUpperCase());
    if (listed.length > 0 && listed.every(isWeekDay)) {
      const days = byOrder(listed as WeekDay[]);
      const set = days.join(',');
      const choice: DaysChoice = set === WEEKDAYS.join(',') ? 'weekdays' : set === WEEKEND.join(',') ? 'weekends' : 'pick_days';
      candidate = structured({ days: choice, cadence_mode: 'weekly', weekly_byday: days });
    }
  } else if (freq === 'MONTHLY' && parts.has('BYMONTHDAY')) {
    candidate = structured({ days: 'monthly', cadence_mode: 'monthly_day_of_month', monthly_day_of_month: parts.get('BYMONTHDAY') ?? '' });
  } else if (freq === 'MONTHLY' && parts.has('BYDAY')) {
    const m = /^(-?\d+)(MO|TU|WE|TH|FR|SA|SU)$/i.exec(parts.get('BYDAY') ?? '');
    if (m) candidate = structured({ days: 'monthly', cadence_mode: 'monthly_nth_weekday', monthly_nth: m[1], monthly_weekday: m[2].toUpperCase() as WeekDay });
  }
  if (candidate === null) return custom;
  let compiled: string;
  try {
    compiled = compileFormToRRule({ ...DEFAULT_ROUTINE_FORM, ...candidate, start_date: startDay ?? '', start_time: clockWords(clock), byhour: pad2(clock.hour), byminute: pad2(clock.minute) });
  } catch {
    return custom;
  }
  return samePartSet(compiled, rrule) ? candidate : custom;
}

const MONTH_WORDS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Oct 24, 2026" from a 'YYYY-MM-DD' day (or a @db.Date's JSON) — no locale, no zone. */
export function dayWords(day: string | Date | null | undefined): string {
  const iso = day instanceof Date ? day.toISOString() : (day ?? '');
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return '—';
  return `${MONTH_WORDS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
}

/** 1st, 2nd, 3rd, 4th … 11th, 12th, 13th … 21st, 22nd, 23rd, 31st. */
export function ordinalWords(n: number): string {
  const abs = Math.abs(n);
  const suffix = abs % 100 >= 11 && abs % 100 <= 13 ? 'th' : abs % 10 === 1 ? 'st' : abs % 10 === 2 ? 'nd' : abs % 10 === 3 ? 'rd' : 'th';
  return `${n}${suffix}`;
}

/** The nth of a monthly weekday: "1st", "2nd", "last", "2nd last". */
export const nthWords = (nth: number): string => (nth === -1 ? 'last' : nth < 0 ? `${ordinalWords(-nth)} last` : ordinalWords(nth));

export const DAYS_NONE_WORDS = '—';

/** THE DAYS COLUMN: the days the rule falls on — "Mon–Sun", "Mon–Fri", "Sat–Sun", "Mon, Wed, Fri", "15th" / "2nd Tue" / "last Fri", the date (once), "—" (custom). */
export function daysWords(rrule: string, startDate: string | Date | null | undefined): string {
  const f = formOfRule(rrule, startDate ?? null);
  switch (f.days) {
    case 'every_day': return 'Mon–Sun';
    case 'weekdays': return 'Mon–Fri';
    case 'weekends': return 'Sat–Sun';
    case 'pick_days': return f.weekly_byday.map((d) => WEEKDAY_LABELS[d]).join(', ');
    case 'once': return dayWords(startDate);
    case 'monthly': return f.cadence_mode === 'monthly_day_of_month' ? ordinalWords(Number(f.monthly_day_of_month)) : `${nthWords(Number(f.monthly_nth))} ${WEEKDAY_LABELS[f.monthly_weekday]}`;
    case 'custom': return DAYS_NONE_WORDS;
  }
}

/** THE CADENCE COLUMN: the classifier's word — daily · weekly · monthly · quarterly · yearly · once · custom. */
export const cadenceWords = (rrule: string): string => CADENCE_GROUP_LABELS[classifyCadence(rrule)].toLowerCase();

/** THE TIME COLUMN: the rule's clock and the stored end, "HH:MM – HH:MM"; the clock alone; "—" when the rule names none. */
export function timeWords(r: { readonly schedule_rrule: string; readonly end_time: string | Date | null }): string {
  const clock = clockOfRule(r.schedule_rrule);
  if (clock === null) return DAYS_NONE_WORDS;
  const end = r.end_time === null ? '' : r.end_time instanceof Date ? r.end_time.toISOString().slice(11, 16) : r.end_time.slice(11, 16);
  return end === '' ? clockWords(clock) : `${clockWords(clock)} – ${end}`;
}

/** THE SORT KEY: minutes from midnight of the rule's clock; null when it names none (sorted last). */
export function clockMinutesOf(rrule: string): number | null {
  const clock = clockOfRule(rrule);
  return clock === null ? null : clock.hour * 60 + clock.minute;
}

/** Clock order: by the rule's clock, a routine with none last, then name. */
export function byClockThenName<T extends { readonly name: string; readonly schedule_rrule: string }>(a: T, b: T): number {
  const ka = clockMinutesOf(a.schedule_rrule);
  const kb = clockMinutesOf(b.schedule_rrule);
  if (ka === null && kb !== null) return 1;
  if (kb === null && ka !== null) return -1;
  return (ka ?? 0) - (kb ?? 0) || a.name.localeCompare(b.name);
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
