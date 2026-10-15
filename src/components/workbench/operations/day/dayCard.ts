/**
 * dayCard — THE DAY CARD'S RULES, PURE (DAYCARD-01, 2026-10-11).
 *
 * One day as its STOPS, in clock order, each with the planned amount the Budget
 * holds for it. The card is a view of what Tasks and Budget already hold — it
 * prices nothing, writes nothing, and matches a line to its stop by kind, id
 * AND the exact instant, never by nearness.
 *
 *   · The stops come from the today read (GET /api/operations/routines/today
 *     ?date=<day>): one stop per active line of each routine that occurs on the
 *     day, one stop for a routine with no lines, and one stop per daily-plan
 *     item (GET /api/operations/daily-plan/items?from=<day>&to=<day>).
 *   · The amounts come from the budget report's plan lines for the day
 *     (GET /api/budget/report?view=day&day=<day>&asOf=<asOf> → plans.lines) —
 *     the ONE priced truth. A line's address is the step's id for a routine
 *     line, the routine's id for a stepless routine, the task's id for a task,
 *     with the occurrence's instant as ISO text (planLines.ts textOf; days.ts
 *     OccurrenceAddress). A stop whose line the report does not list shows '—',
 *     never $0.00.
 *   · TABLE-01 (2026-10-13): the vendor and the location are TWO facts. The
 *     vendor is the matched line's vendor (the day's vendor, VENDOR-01) and
 *     nothing else — never a location. The location is the line's, when the
 *     stop is a line and the step states one, else the routine's — never a
 *     vendor. Neither is invented; a blank is no location.
 *
 * NOTHING DROPPED. A line of the same kind and id whose instant differs is
 * UNMATCHED and named (both instants); two lines for one stop are both named
 * and neither used; a line of the day that no stop carries is named; the
 * report's not-placed entries for the day (and every undated one) are named.
 * plannedCents is the Budget's own planned figure for the day — the sum of
 * EVERY line of the day, matched or not — so the two agree by construction.
 *
 * STOP-01 (2026-10-12) — THE RECORD AT A STOP. The day's stop records (GET
 * /api/operations/stops?day=<day>, src/lib/operations/stopRecord.ts) join the
 * stops by the same key — kind, id AND the exact instant. A line or a stepless
 * routine with a record of its own takes its status from it (done at an
 * instant, or skipped with the reason), its ACTUAL from what was typed, its
 * rating, note and minutes; one with none keeps the routine's completion as its
 * status and SAYS SO (statusSource 'routine' — the card prints "routine marked
 * done", never passes it off as the line's). A task's actual is the task's own
 * actual_cost_usd and its done is the task's status — one fact, one home. The
 * day's SPENT is the sum of the stops' actuals, with the count of stops that
 * have none beside it — never a zero filled in; null while the records were not
 * read. A record of the day whose key matches no stop is named, never dropped.
 *
 * ROLE-01 (2026-10-13) — THE ROUTINE'S ROLE. Every stop carries its routine's
 * role (src/lib/operations/stopRole.ts): what the step card asks. A routine
 * whose role is all_day (a subscription, a membership) is in the day's plan —
 * its line is in the hero's figure — but is NOT a stop: it is listed under
 * allDay for the plate's "also today" band, never numbered, never counted among
 * the stops' spent or done, and it takes no record. A line of a routine takes
 * its routine's role.
 *
 * JOURNAL-01 (2026-10-13) — YESTERDAY'S TALLY. The journal stop's plate opens
 * with yesterday's numbers — spent against the plan, the stops without an
 * amount, the largest delta named, done of N with the skipped named, what
 * shipped (the task stops done that day) — DERIVED here from yesterday's own
 * reads through dayStops (dayTally), never stored: a stored copy would drift
 * from the records and the plan lines. The words are each a function here.
 * JOURNAL-02 (2026-10-13): the plate prints the spent, largest and done lines;
 * yesterday's END OF DAY is its own typed text, so the "shipped:" line that
 * joined the two is gone (tallyShippedWords deleted).
 *
 * Pure: no fetch, no clock, no React, no Prisma (as week/weekPlan.ts) — the
 * tests drive every rule with fixtures. Every sentence the card prints from
 * here is an exported constant or a function returning one, so the tests pin
 * the exact words.
 *
 * TASKS-ONE-02 (2026-10-14): week/weekPlan.ts and week/WeekSection.tsx, cited
 * here as this file's models, are deleted (Alex's ruling: the day card replaces
 * the week grid); the words and rules this file took from them are its own.
 */
import { centsFromDecimalString, type NotPlaced } from '@/lib/budget/days';
import { formatCents } from '@/lib/budget/format';
import type { PlanLine } from '@/lib/budget/planLines';
import { NO_STAY_WORDS, STAY_NOT_READ_WORDS, stayDay, stayDayWords, type StayRow } from '@/lib/operations/stay';
import {
  LATER_WORD, NOT_RECORDED_WORDS, OPEN_WORD, ROUTINE_DONE_WORDS, ROUTINE_MISSED_WORDS, SKIPPED_WORD, TASK_DONE_WORDS, TASK_OPEN_WORDS, doneWords, lateWords, recordKey, skippedWords,
  type StopRecordKind, type StopRecordRow,
} from '@/lib/operations/stopRecord';
import { NO_AMOUNT_NO_VENDOR_WORDS, REPORT_NOT_READ_NO_VENDOR_WORDS, UNMATCHED_NO_VENDOR_WORDS, isStop, isStopRole, type StopRole } from '@/lib/operations/stopRole';
import { instantToZoned, zonedToInstant } from '@/lib/time';
import type { DailyPlanItem } from '../dailyplan/types';
import type { TodayRoutineEntry, TodayStatus } from '../routines/types';

// ── INPUT ───────────────────────────────────────────────────────────────────

export interface DayCardInput {
  /** 'YYYY-MM-DD' — the card's day. */
  readonly day: string;
  /** The today read's entries for the day. */
  readonly entries: readonly TodayRoutineEntry[];
  /** The report's plans.lines when listed, else []. */
  readonly lines: readonly PlanLine[];
  /** The report's notPlaced. */
  readonly notPlaced: readonly NotPlaced[];
  /** The daily-plan items of the day. */
  readonly items: readonly DailyPlanItem[];
  /** The viewer's zone — a task block's clock time is drawn in it (Tab 1's rule). */
  readonly viewerZone: string;
  /** STOP-01: the day's stop records when read; null while they were not (unread or failed) — unknown, never none. */
  readonly records: readonly StopRecordRow[] | null;
}

// ── OUTPUT ──────────────────────────────────────────────────────────────────

export type StopKind = 'line' | 'routine' | 'task';
export type StopStatus = 'done' | 'missed' | 'open' | 'later' | 'skipped';
/** Where a stop's status came from: its own record, its routine's completion, or the task. */
export type StatusSource = 'record' | 'routine' | 'task';
/** Where a stop's actual came from: the record (typed on the day) or the task's own column. */
export type ActualSource = 'typed' | 'task';

/** The address a record is written at — the Budget's kind, the plan's id, the occurrence's instant. */
export interface StopAddress {
  readonly kind: StopRecordKind;
  readonly id: string;
  readonly instant: string;
}

export interface Stop {
  readonly kind: StopKind;
  /** `line:<step>:<instant>` · `routine:<routine>:<instant>` · `task:<item>`. */
  readonly key: string;
  /** 'HH:MM', or null when nothing states a time. */
  readonly time: string | null;
  /** The routine's name, or the task's title (an ad hoc item's own title). */
  readonly label: string;
  /** The line's activity; null for a stepless routine and a task. */
  readonly line: string | null;
  /** TABLE-01: the matched plan line's vendor name — nothing else, never a location; null when the line has none or there is no line. */
  readonly vendor: string | null;
  /** TABLE-01: the line's location when the stop is a line and the step states one, else the routine's — never a vendor; null when neither states one. */
  readonly location: string | null;
  readonly minutes: number | null;
  /** The matched plan line's cents; null when the report lists none for this stop. */
  readonly cents: number | null;
  readonly status: StopStatus;
  readonly statusSource: StatusSource;
  /** ROLE-01: the routine's role — what the step card asks; 'none' for a task. */
  readonly role: StopRole;
  /** The matched plan line itself (the vendor box plans a vendor on it); null when the report lists none. */
  readonly planLine: PlanLine | null;
  /** Why planLine is what it is: matched; the Budget lists a line of this kind and id but at another instant or doubled (unmatched); or none at all. */
  readonly planLineState: 'matched' | 'unmatched' | 'none';
  /** STOP-01: where a record is written for this stop; null for a task (its record is the task). */
  readonly address: StopAddress | null;
  /** The routine's zone (a record's done-at is drawn in it); null for a task. */
  readonly zone: string | null;
  /** The stop's own record, or null — none, or the records not read. */
  readonly record: StopRecordRow | null;
  /** The record's typed cents, or a task's own actual; null when neither states one. */
  readonly actualCents: number | null;
  readonly actualSource: ActualSource | null;
  /** The record's done-at as a clock in the routine's zone, with its local day; null when not done by a record. */
  readonly doneAt: { readonly day: string; readonly time: string } | null;
  /** Minutes after the planned instant the stop was done (negative: early); null when no record says when. */
  readonly lateMinutes: number | null;
  /** The record's minutes, or a task's own; null when neither states them. */
  readonly actualMinutes: number | null;
}

export type UnmatchedReason = 'instant differs' | 'two plan lines for one stop';

/** A plan line of the stop's kind and id that the stop does not carry — named, never used. */
export interface UnmatchedLine {
  readonly label: string;
  readonly line: string | null;
  readonly cents: number;
  /** The line's instant (ISO text; null for a task line). */
  readonly lineInstant: string | null;
  /** The stop's instant (ISO text; null for a task). */
  readonly stopInstant: string | null;
  readonly reason: UnmatchedReason;
}

export interface DayStops {
  readonly stops: readonly Stop[];
  /** ROLE-01: the day's all-day lines (role all_day) — in the plan, not stops; the "also today" band. */
  readonly allDay: readonly Stop[];
  /** The band's money — the sum of the all-day lines that carry an amount (the ones without are counted on the band). */
  readonly allDayCents: number;
  /** The Budget's planned figure for the day: every line of the day, matched or not. */
  readonly plannedCents: number;
  /** How many stops have no amount. */
  readonly notPriced: number;
  readonly unmatched: readonly UnmatchedLine[];
  /**
   * A routine's OWN figure on the day (a 'routine'-kind line at the occurrence
   * of a routine that has lines) — the lines leaf's rule when no line carries an
   * amount (routineLines.ts): the Budget prices the routine, not any one line,
   * so no stop of it is priced. Named for what it is, in the hero's total.
   */
  readonly routineFigures: readonly PlanLine[];
  /** The day's lines no stop carries. */
  readonly linesWithoutStop: readonly PlanLine[];
  /** The report's not-placed entries for the day, and every undated one. */
  readonly notPlacedToday: readonly NotPlaced[];
  /**
   * STOP-01: the sum of the stops' actuals (typed, or a task's own); null while
   * the records were not read — a task's actual alone is not the day's spent.
   */
  readonly spentCents: number | null;
  /** Stops with no actual (records read) — printed beside every sum, never a zero filled in. */
  readonly withoutActual: number;
  /** PLAN-01: stops that carry an actual (records read) — none means nothing is recorded: "spent —", unknown, never $0. */
  readonly withActual: number;
  readonly done: number;
  readonly skipped: number;
  /** Line and routine stops with no record of their own (records read). */
  readonly notRecorded: number;
  /** Records of the day whose key matches no stop — named, never dropped. */
  readonly recordsWithoutStop: readonly StopRecordRow[];
}

export interface Focus {
  /** 1-based. */
  readonly index: number;
  readonly of: number;
  readonly stop: Stop;
  /** The sum of the priced stops 1..index. */
  readonly soFarCents: number;
  /** STOP-01: the sum of the actuals of stops 1..index; null while the records were not read. */
  readonly spentSoFarCents: number | null;
  /** Of stops 1..index, how many have no actual (records read). */
  readonly withoutActualSoFar: number;
  /** PLAN-01: of stops 1..index, how many carry an actual (records read) — none: "spent so far —" and no spent bar. */
  readonly withActualSoFar: number;
}

// ── THE RULES ───────────────────────────────────────────────────────────────

const STATUS: Record<TodayStatus, StopStatus> = { completed: 'done', missed: 'missed', pending: 'open', upcoming: 'later' };

/** 'HH:MM' of a @db.Time value ('1970-01-01THH:MM:SS.000Z'), as the week's clockOf. */
const clockOf = (time: string): string => time.slice(11, 16);

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
/** null sorts last. */
const cmpMaybe = (a: string | null, b: string | null): number => (a === b ? 0 : a === null ? 1 : b === null ? -1 : cmp(a, b));

/** A stored location, or null — a blank is no location, not a location called "". */
const locationText = (text: string | null | undefined): string | null => (typeof text === 'string' && text.trim() !== '' ? text : null);

/** TABLE-01: the stop's vendor — the matched plan line's, by name; null when the line names none or there is no line. Never a location. */
const vendorOf = (line: PlanLine | null): string | null => (line !== null && line.vendor !== null ? line.vendor.name : null);

/** TABLE-01: the stop's location — the first stated one in the order given (the line's, then the routine's); null when none is stated. Never a vendor. */
const locationOf = (...locations: readonly (string | null | undefined)[]): string | null => {
  for (const l of locations) {
    const stated = locationText(l);
    if (stated !== null) return stated;
  }
  return null;
};

/** Of the day's lines, those at this kind and id; the exact instant decides the match. The state says why there is no line when there is none. */
function matchLine(
  candidates: readonly PlanLine[],
  stopInstant: string | null,
  label: string,
  line: string | null,
  used: Set<PlanLine>,
  unmatched: UnmatchedLine[],
): { readonly line: PlanLine | null; readonly state: Stop['planLineState'] } {
  const exact = candidates.filter((l) => l.address.instant === stopInstant);
  for (const l of candidates) {
    if (l.address.instant !== stopInstant) {
      used.add(l);
      unmatched.push({ label, line, cents: l.cents, lineInstant: l.address.instant, stopInstant, reason: 'instant differs' });
    }
  }
  if (exact.length === 1) {
    used.add(exact[0]);
    return { line: exact[0], state: 'matched' };
  }
  if (exact.length > 1) {
    for (const l of exact) {
      used.add(l);
      unmatched.push({ label, line, cents: l.cents, lineInstant: l.address.instant, stopInstant, reason: 'two plan lines for one stop' });
    }
  }
  return { line: null, state: candidates.length > 0 ? 'unmatched' : 'none' };
}

/** A task's own actual (a Decimal string) as cents; a value the Books' rule cannot read as cents is the database's error, never a figure. */
function taskCents(value: string | null, what: string): number | null {
  if (value === null) return null;
  const read = centsFromDecimalString(value);
  if (!read.ok) throw new Error(`dayCard: ${what} ${JSON.stringify(value)} cannot be read as cents — ${read.detail}`);
  return read.cents;
}

/**
 * STOP-01: what a line's or a routine's record adds to its stop. With a record
 * the status is the record's (done, or skipped) and the actual is what was typed;
 * without one the status stays the routine's completion — labelled 'routine'.
 * The done-at is drawn in the routine's zone; lateness is against the planned
 * instant: the line's time of day on the card's day, else the occurrence.
 */
function recorded(
  record: StopRecordRow | null,
  routineStatus: StopStatus,
  zone: string,
  day: string,
  plannedInstant: Date,
): Pick<Stop, 'status' | 'statusSource' | 'record' | 'actualCents' | 'actualSource' | 'doneAt' | 'lateMinutes' | 'actualMinutes'> {
  if (record === null) {
    return { status: routineStatus, statusSource: 'routine', record: null, actualCents: null, actualSource: null, doneAt: null, lateMinutes: null, actualMinutes: null };
  }
  const done = record.outcome === 'done' && record.done_at !== null ? new Date(record.done_at) : null;
  const at = done === null ? null : instantToZoned(done, zone);
  return {
    status: record.outcome === 'done' ? 'done' : 'skipped',
    statusSource: 'record',
    record,
    actualCents: record.actual_cents,
    actualSource: record.actual_cents === null ? null : 'typed',
    doneAt: at === null ? null : { day: at.date, time: at.time },
    // Whole minutes, as the clocks print them: 07:30:40 against 07:30 is on time, not "1 min late".
    lateMinutes: done === null ? null : (toMinute(done) - toMinute(plannedInstant)) / 60_000,
    actualMinutes: record.actual_minutes,
  };
}

/** An instant floored to its minute, in ms. */
const toMinute = (d: Date): number => Math.floor(d.getTime() / 60_000) * 60_000;

/** The day's stops, their amounts from the Budget's lines, and everything the card must name. */
export function dayStops(input: DayCardInput): DayStops {
  const dayLines = input.lines.filter((l) => l.day === input.day);
  const used = new Set<PlanLine>();
  const unmatched: UnmatchedLine[] = [];
  const timed: Stop[] = [];
  const untimed: Stop[] = [];
  const allDay: Stop[] = [];
  // An all-day line is in the plan, not on the itinerary — it goes to the band, whatever its clock says.
  const push = (stop: Stop) => (isStop(stop.role) ? (stop.time === null ? untimed : timed) : allDay).push(stop);
  // STOP-01: the records by the card's own key; each one a stop takes is marked, the rest are named.
  const records = input.records === null ? [] : input.records;
  const byKey = new Map<string, StopRecordRow>();
  for (const r of records) {
    const key = recordKey(r);
    if (byKey.has(key)) throw new Error(`dayCard: two records at ${key} — the database holds one per (plan, occurrence)`);
    byKey.set(key, r);
  }
  const taken = new Set<string>();
  const recordAt = (key: string): StopRecordRow | null => {
    const found = byKey.get(key);
    if (found === undefined) return null;
    taken.add(key);
    return found;
  };

  for (const entry of input.entries) {
    const r = entry.routine;
    const status = STATUS[entry.status];
    const occurrence = new Date(entry.expected_at);
    const occurrenceTime = instantToZoned(occurrence, r.timezone).time;
    // A role outside the six is the read's error (the column is CHECKed) — never read as a work stop.
    if (!isStopRole(r.role)) throw new Error(`dayCard: routine ${r.id} carries role ${JSON.stringify(r.role)} — not one of the six`);
    // An all-day routine takes no record: its key is never looked up, so a record written at it is named as matching no stop.
    const recordFor = (key: string): StopRecordRow | null => (isStop(r.role) ? recordAt(key) : null);
    if (r.steps.length === 0) {
      const key = `routine:${r.id}:${entry.expected_at}`;
      const { line, state } = matchLine(dayLines.filter((l) => l.address.kind === 'routine' && l.address.id === r.id), entry.expected_at, r.name, null, used, unmatched);
      push({
        kind: 'routine',
        key,
        time: occurrenceTime,
        label: r.name,
        line: null,
        vendor: vendorOf(line),
        location: locationOf(r.location),
        minutes: null,
        cents: line === null ? null : line.cents,
        role: r.role,
        planLine: line,
        planLineState: state,
        address: { kind: 'routine', id: r.id, instant: entry.expected_at },
        zone: r.timezone,
        ...recorded(recordFor(key), status, r.timezone, input.day, occurrence),
      });
      continue;
    }
    for (const step of [...r.steps].sort((a, b) => a.step_order - b.step_order)) {
      const key = `line:${step.id}:${entry.expected_at}`;
      const { line, state } = matchLine(dayLines.filter((l) => l.address.kind === 'routine_line' && l.address.id === step.id), entry.expected_at, r.name, step.activity, used, unmatched);
      const time = step.time_of_day === null ? occurrenceTime : clockOf(step.time_of_day);
      // The planned instant: the line's own time of day on the card's day in the routine's zone, else the occurrence.
      const planned = step.time_of_day === null ? occurrence : zonedToInstant(input.day, time, r.timezone);
      push({
        kind: 'line',
        key,
        time,
        label: r.name,
        line: step.activity,
        vendor: vendorOf(line),
        location: locationOf(step.location, r.location),
        minutes: step.duration_minutes,
        cents: line === null ? null : line.cents,
        role: r.role,
        planLine: line,
        planLineState: state,
        address: { kind: 'routine_line', id: step.id, instant: entry.expected_at },
        zone: r.timezone,
        ...recorded(recordFor(key), status, r.timezone, input.day, planned),
      });
    }
  }

  for (const item of input.items) {
    // The task's title, else the item's own; an item with neither is named as such — never a blank row.
    const label = item.task !== null ? item.task.title : item.ad_hoc_title !== null ? item.ad_hoc_title : UNTITLED_WORDS;
    const block = item.calendar_blocks.find((b) => b.status !== 'cancelled');
    const matched = item.task_id === null
      ? { line: null, state: 'none' as const }
      : matchLine(dayLines.filter((l) => l.address.kind === 'project_task' && l.address.id === item.task_id), null, label, null, used, unmatched);
    const line = matched.line;
    // A task's record is the task: its status, its own actual, minutes and completed-at (one fact, one home) — the clock in the viewer's zone, as its block.
    const actualCents = item.task === null ? null : taskCents(item.task.actual_cost_usd, `task ${item.task.id} actual_cost_usd`);
    const completed = item.task !== null && item.task.status === 'completed' && item.task.completed_at !== null ? instantToZoned(new Date(item.task.completed_at), input.viewerZone) : null;
    push({
      kind: 'task',
      key: `task:${item.id}`,
      time: block === undefined ? null : instantToZoned(new Date(block.scheduled_start), input.viewerZone).time,
      label,
      line: null,
      // The matched project_task line's vendor, as every stop's (TABLE-01 review): a vendor planned on a task is a fact, never dropped. A task has no step and no routine, so no location.
      vendor: vendorOf(line),
      location: null,
      minutes: null,
      cents: line === null ? null : line.cents,
      status: item.task !== null && item.task.status === 'completed' ? 'done' : 'open',
      statusSource: 'task',
      role: 'none',
      planLine: line,
      planLineState: matched.state,
      address: null,
      zone: null,
      record: null,
      actualCents,
      actualSource: actualCents === null ? null : 'task',
      doneAt: completed === null ? null : { day: completed.date, time: completed.time },
      // A task's block is when it was planned to start, its completed-at when it was marked done — no lateness is drawn between the two.
      lateMinutes: null,
      actualMinutes: item.task === null ? null : item.task.actual_minutes,
    });
  }

  // Clock order: time, then label, then line; stops with no time last, as they arrived (routines, then items).
  timed.sort((a, b) => cmp(a.time as string, b.time as string) || cmp(a.label, b.label) || cmpMaybe(a.line, b.line));
  const stops = [...timed, ...untimed];

  // A 'routine'-kind line at the occurrence of a routine that HAS lines is the routine's own figure
  // (its lines carry no amount) — named as such, not as a line with no stop.
  const linedAt = new Map(input.entries.filter((e) => e.routine.steps.length > 0).map((e) => [e.routine.id, e.expected_at]));
  const isRoutineFigure = (l: PlanLine): boolean => l.address.kind === 'routine' && linedAt.get(l.address.id) === l.address.instant;
  const unused = dayLines.filter((l) => !used.has(l));

  const read = input.records !== null;
  // The band keeps the clock order too, so a day's subscriptions read the same way every day.
  allDay.sort((a, b) => cmpMaybe(a.time, b.time) || cmp(a.label, b.label) || cmpMaybe(a.line, b.line));
  return {
    stops,
    allDay,
    allDayCents: allDay.map((s) => s.cents).filter((c): c is number => c !== null).reduce((sum, c) => sum + c, 0),
    plannedCents: dayLines.reduce((sum, l) => sum + l.cents, 0),
    notPriced: stops.filter((s) => s.cents === null).length,
    unmatched,
    routineFigures: unused.filter(isRoutineFigure),
    linesWithoutStop: unused.filter((l) => !isRoutineFigure(l)),
    notPlacedToday: input.notPlaced.filter((n) => n.day === null || n.day === input.day),
    // The sum of the actuals that exist — the stops without one are COUNTED beside it (withoutActual), never summed as zero.
    spentCents: read ? stops.map((s) => s.actualCents).filter((c): c is number => c !== null).reduce((sum, c) => sum + c, 0) : null,
    withoutActual: read ? stops.filter((s) => s.actualCents === null).length : 0,
    withActual: read ? stops.filter((s) => s.actualCents !== null).length : 0,
    done: stops.filter((s) => s.status === 'done').length,
    skipped: stops.filter((s) => s.status === 'skipped').length,
    notRecorded: read ? stops.filter((s) => s.kind !== 'task' && s.record === null).length : 0,
    recordsWithoutStop: records.filter((r) => !taken.has(recordKey(r))),
  };
}

/** Stop n of N (1-based) and the sums over the stops up to it — the priced, and the actuals; null for an n outside 1..N — never clamped. */
export function focusStop(result: DayStops, n: number): Focus | null {
  if (!Number.isInteger(n) || n < 1 || n > result.stops.length) return null;
  const upTo = result.stops.slice(0, n);
  const priced = upTo.map((s) => s.cents).filter((c): c is number => c !== null);
  const actuals = upTo.map((s) => s.actualCents).filter((c): c is number => c !== null);
  return {
    index: n,
    of: result.stops.length,
    stop: result.stops[n - 1],
    soFarCents: priced.reduce((sum, c) => sum + c, 0),
    spentSoFarCents: result.spentCents === null ? null : actuals.reduce((sum, c) => sum + c, 0),
    withoutActualSoFar: result.spentCents === null ? 0 : upTo.length - actuals.length,
    withActualSoFar: result.spentCents === null ? 0 : actuals.length,
  };
}

// ── VENDOR-02 (2026-10-14): THE VENDOR UNDER THE CARD ───────────────────────

/** What the step view shows for a stop's vendor: Budget's own box on its matched plan line, a place stop's one reason, or nothing. */
export type VendorSlot =
  | { readonly kind: 'box'; readonly line: PlanLine }
  | { readonly kind: 'reason'; readonly words: string }
  | { readonly kind: 'none' };

/**
 * VENDOR-02 (2026-10-14): the vendor box shows for EVERY stop that is a stop
 * and is priced — a matched plan line, read from the report — whatever its role
 * (ROLE-01 mounted it on place stops only). A plan line exists only for a line
 * that carries an amount (budget/days.ts), so "priced" is the matched line
 * itself, as it was for a place stop. Without one, a place stop keeps its one
 * reason per cause; any other stop shows nothing — a work stop with no money has
 * nothing to pay. An all-day line is not a stop: nothing.
 */
export function vendorSlot(stop: Pick<Stop, 'role' | 'planLine' | 'planLineState'>, reportRead: boolean): VendorSlot {
  if (!isStop(stop.role)) return { kind: 'none' };
  if (reportRead && stop.planLine !== null) return { kind: 'box', line: stop.planLine };
  if (stop.role !== 'place') return { kind: 'none' };
  return { kind: 'reason', words: !reportRead ? REPORT_NOT_READ_NO_VENDOR_WORDS : stop.planLineState === 'unmatched' ? UNMATCHED_NO_VENDOR_WORDS : NO_AMOUNT_NO_VENDOR_WORDS };
}

// ── WORDS ───────────────────────────────────────────────────────────────────

const WEEKDAY_WORDS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTH_WORDS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export const TODAY_WORD = 'today';
export const TASK_WORD = 'task';
export const BRAND_WORDS = 'TEMPLE STUART';
export const UNTITLED_WORDS = 'untitled item';

export const notPricedWords = (k: number): string => `${k} not priced`;
/** PLAN-01: "plan so far $10 of $75" — the PLAN bar's words (the planned money of stops 1..n against the day's planned total); both '—' while the report cannot be read (null), never $0.00 for an unknown figure. */
export const planSoFarWords = (soFarCents: number | null, plannedCents: number | null): string => `plan so far ${planDollars(soFarCents)} of ${planDollars(plannedCents)}`;
/** The source line — the day itself is in the where line; what could not be read says so (STOP-01: the records are a source too). CLEAN-01 (2026-10-14): under the full plate, small; on the step view's plate as before. */
export const provenanceWords = (asOf: string, reportRead: boolean, recordsRead: boolean): string =>
  `Budget plan lines${reportRead ? '' : ' NOT READ'} · stop records${recordsRead ? '' : ' NOT READ'} · as of ${asOf}`;

// ── STOP-01: THE RECORD'S WORDS ON THE CARD ──────────────────────────────────

export const ACTUAL_WORD = 'ACTUAL';
export const RECORDS_NOT_READ_WORDS = 'records not read';
export const ON_PLAN_WORDS = 'on plan';

/**
 * PLAN-01: the SPENT bar's words, the actuals of stops 1..n against the day's
 * planned total. CLEAN-02 (2026-10-14, Alex's ruling): "spent so far $9.69 of
 * $75" — no count beside it; "spent so far — of $75" while nothing so far is
 * recorded or the records were not read (the caller passes null — unknown,
 * never $0; the fine print under the plate says what was not read).
 */
export const spentSoFarWords = (spentCents: number | null, plannedCents: number | null): string =>
  `${SPENT_SO_FAR_WORDS} ${planDollars(spentCents)} of ${planDollars(plannedCents)}`;
export const SPENT_SO_FAR_WORDS = 'spent so far';
/** "over by $5" — the actuals past the day's planned total, in the card's over tone. */
export const overByWords = (cents: number): string => `over by ${planDollars(cents)}`;
/** The step view draws no bars when the day's planned total is unknown or nothing is planned — and says why. */
export const BARS_PLAN_NOT_READ_WORDS = 'no bars — the day’s planned total is not known (the Budget’s plan lines were not read)';
export const BARS_NOTHING_PLANNED_WORDS = 'no bars — nothing is planned for the day';

/**
 * TOTALS-01 (2026-10-14): spentOutOfWords — CLEAN-01's full-card line under the
 * hook, "spent $9.69 out of $75" — is deleted with its words (SPENT_WORD,
 * PLANNED_NOT_READ_WORDS), nothing else reading them. Its numbers live in the
 * table's TOTAL row now (dayTotals): the spent is the ACTUAL total, "—" while
 * nothing is recorded (never $0); the day's planned total stays the hero.
 */

/** A row's actual under its plan: "$12 ▲ $2" · "$12 ▼ $3" · "$12 on plan" · "$12" when the plan is unknown. */
export function rowActualWords(actualCents: number, planCents: number | null): string {
  const d = deltaWords(actualCents, planCents);
  if (d.over === null) return planDollars(actualCents);
  return `${planDollars(actualCents)} ${d.text.replace(/ (over|under)$/, '')}`;
}

export interface DeltaWords {
  readonly text: string;
  /** true over the plan (paints red), false under or on it (green); null when either figure is unknown. */
  readonly over: boolean | null;
}

/** "▲ $4.25 over" · "▼ $3 under" · "on plan" · '—' when the plan or the actual is unknown. */
export function deltaWords(actualCents: number | null, planCents: number | null): DeltaWords {
  if (actualCents === null || planCents === null) return { text: '—', over: null };
  const d = actualCents - planCents;
  if (d === 0) return { text: ON_PLAN_WORDS, over: false };
  return d > 0 ? { text: `▲ ${planDollars(d)} over`, over: true } : { text: `▼ ${planDollars(-d)} under`, over: false };
}

/** "1 skipped" */
export const skippedCountWords = (n: number): string => `${n} ${SKIPPED_WORD}`;

/**
 * The stop's status line, with its source said: a record's "done 12:41 · 11 min
 * late" (another day: "done Oct 12 12:41"), "skipped — closed"; a line with no
 * record of its own carries its routine's completion and says so ("routine
 * marked done", "routine missed"); a task says "task done" / "task open";
 * otherwise "open" / "later".
 */
export function statusWords(stop: Stop, day: string): string {
  const when = stop.doneAt === null ? null : stop.doneAt.day === day ? stop.doneAt.time : `${monthDayWords(stop.doneAt.day)} ${stop.doneAt.time}`;
  if (stop.statusSource === 'record') {
    if (stop.status === 'skipped') {
      // A skipped record carries its reason (the migration's CHECK) — one without is the database's error, never a blank.
      if (stop.record === null || stop.record.note === null) throw new Error(`dayCard: ${stop.key} is skipped by its record but carries no reason`);
      return skippedWords(stop.record.note);
    }
    if (when === null) throw new Error(`dayCard: ${stop.key} is done by its record but has no done-at`);
    return stop.lateMinutes === null ? doneWords(when) : `${doneWords(when)} · ${lateWords(stop.lateMinutes)}`;
  }
  if (stop.statusSource === 'task') return stop.status === 'done' ? (when === null ? TASK_DONE_WORDS : `${TASK_DONE_WORDS} ${when}`) : TASK_OPEN_WORDS;
  if (stop.status === 'done') return ROUTINE_DONE_WORDS;
  if (stop.status === 'missed') return ROUTINE_MISSED_WORDS;
  return stop.status === 'later' ? LATER_WORD : OPEN_WORD;
}

/** "30 min planned · 42 min" · "30 min planned" · "42 min" · null when neither is stated. */
export function minutesLine(planned: number | null, actual: number | null): string | null {
  if (planned === null && actual === null) return null;
  const parts: string[] = [];
  if (planned !== null) parts.push(`${planned} min planned`);
  if (actual !== null) parts.push(`${actual} min`);
  return parts.join(' · ');
}

/** The sentence under the plate for records whose key matches no stop. */
export const recordsWithoutStopWords = (list: readonly StopRecordRow[]): string => {
  const head = list.length === 1 ? '1 record of the day matches no stop' : `${list.length} records of the day match no stop`;
  return `${head} — ${list.map((r) => `${r.kind} ${r.target_id} at ${r.occurrence_at}: ${r.outcome}${r.actual_cents === null ? '' : `, ${formatCents(r.actual_cents)}`}`).join(' · ')}`;
};

/** The sentence under the plate for records the route could not place in a day. */
export const recordsUnplacedWords = (list: readonly { readonly record: StopRecordRow; readonly detail: string }[]): string => {
  const head = list.length === 1 ? '1 record could not be placed in a day' : `${list.length} records could not be placed in a day`;
  return `${head} — ${list.map((u) => `${u.record.kind} ${u.record.target_id} at ${u.record.occurrence_at}: ${u.detail}`).join(' · ')}`;
};

/** "not recorded" is a count on the plate's completeness line; its word is the record's own. */
export const notRecordedWords = (n: number): string => `${n} ${NOT_RECORDED_WORDS}`;

/** The hero's word: "today" on the browser's day, "planned" on any other day. */
export const heroWord = (day: string, today: string): string => (day === today ? TODAY_WORD : PLANNED_WORD);

// ── THE REEL PLATE'S WORDS (DAYCARD-01b, 2026-10-12 — the look Alex approved on the demo's reel frames) ──

/**
 * A planned amount as the reel writes it: whole dollars read "$75", not "$75.00";
 * cents that exist are kept ("$5.07"); null is '—'. Lossless — formatCents with a
 * trailing ".00" removed, nothing rounded.
 */
export const planDollars = (cents: number | null): string => formatCents(cents).replace(/\.00$/, '');

/** "Tue Oct 13" — the day without its year, from the day's UTC parts. */
export function dayShortWords(day: string): string {
  const d = new Date(`${day}T00:00:00.000Z`);
  return `${WEEKDAY_WORDS[d.getUTCDay()]} ${MONTH_WORDS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** "Oct 13" — a done-at on another day than the card's. */
export function monthDayWords(day: string): string {
  const d = new Date(`${day}T00:00:00.000Z`);
  return `${MONTH_WORDS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/**
 * STAY-01: the header's right-hand words — "DAY 3 OF 14" from the stay covering
 * the day (src/lib/operations/stay.ts stayDay), or NO STAY when none does. One
 * meaning: the day's place in where you are. (DAYCARD-01b counted the calendar
 * quarter here; that counter is gone — a stay is what Alex counts.)
 */
export type StayState =
  | { readonly kind: 'unread' }
  | { readonly kind: 'failed' }
  | { readonly kind: 'read'; readonly stay: StayRow | null };

export function headerWords(state: StayState, day: string): string {
  if (state.kind === 'unread') return '';
  if (state.kind === 'failed') return STAY_NOT_READ_WORDS;
  if (state.stay === null) return NO_STAY_WORDS;
  const at = stayDay({ startsOn: state.stay.starts_on, endsOn: state.stay.ends_on }, day);
  if (at === null) throw new Error(`dayCard: the stay ${state.stay.starts_on}..${state.stay.ends_on} does not cover ${day} — the route answered the wrong stay`);
  return stayDayWords(at.n, at.of);
}

/** "Tue Oct 13 · Chiang Mai" — the day and, when a read stay covers it, its place; the day alone while unread, failed or none. */
export const whereWords = (day: string, state: StayState): string => (state.kind === 'read' && state.stay !== null ? `${dayShortWords(day)} · ${state.stay.place}` : dayShortWords(day));

/** CLEAN-01 (2026-10-14, Alex's ruling): the hook, exactly — no stop count beside it. */
export const HOOK_WORDS = 'Under or Over?';
export const PLANNED_WORD = 'planned';
export const STOPS_NOT_READ_WORDS = 'stops not read';
export const PLAN_WORD = 'PLAN';
export const BADGE_WORDS = 'TS';

/** "4 OF 7 · 12:30" — the step card's header words ('—' for a stop with no time). */
export const stepHeaderWords = (n: number, of: number, time: string | null): string => `${n} OF ${of} · ${time === null ? '—' : time}`;

/** How far along the planned money the day's stops 1..n are, in whole percent, 0–100; null when the plan is unknown or nothing is planned. */
export function progressPercent(soFarCents: number | null, plannedCents: number | null): number | null {
  if (soFarCents === null || plannedCents === null || plannedCents <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((100 * soFarCents) / plannedCents)));
}

/**
 * The completeness line — what the hero's figure does not price or place,
 * counted, in one line; null when every stop is priced and nothing is set aside.
 * The sentences that name each item follow it in the foot. CLEAN-01
 * (2026-10-14): it sits directly under the full plate, small and muted.
 * VENDOR-02 (2026-10-14) — Alex's ruling: the day card is the daily and overlay
 * surface; stranded vendor picks are Budget's to show and clear. "N vendors
 * stranded" left this line (and its count left the signature); /budget lists
 * them, each with Clear. strandedWords, the amber sentence that named them under
 * the plate, is deleted with its one caller.
 */
export function completenessWords(result: DayStops, read: { readonly day: boolean; readonly report: boolean; readonly records: boolean }): string | null {
  const parts: string[] = [];
  // What was not read is unknown, not zero — said as such, never counted as "not priced", "no stop" or "not recorded".
  if (!read.day) parts.push(STOPS_NOT_READ_WORDS);
  if (!read.report) parts.push('amounts not read');
  if (!read.records) parts.push(RECORDS_NOT_READ_WORDS);
  if (read.day && read.report && result.notPriced > 0) parts.push(notPricedWords(result.notPriced));
  // STOP-01: the stops with no record of their own, and the skipped ones — counted here, named on their rows.
  if (read.day && read.records && result.notRecorded > 0) parts.push(notRecordedWords(result.notRecorded));
  if (result.skipped > 0) parts.push(skippedCountWords(result.skipped));
  if (result.routineFigures.length > 0) parts.push(result.routineFigures.length === 1 ? '1 routine priced as a whole' : `${result.routineFigures.length} routines priced as a whole`);
  const moved = result.unmatched.filter((u) => u.reason === 'instant differs').length;
  const doubled = result.unmatched.filter((u) => u.reason === 'two plan lines for one stop').length;
  if (moved > 0) parts.push(moved === 1 ? '1 line at another instant' : `${moved} lines at another instant`);
  if (doubled > 0) parts.push(`${doubled} plan lines for one stop`);
  if (result.linesWithoutStop.length > 0) {
    parts.push(read.day
      ? (result.linesWithoutStop.length === 1 ? '1 line with no stop' : `${result.linesWithoutStop.length} lines with no stop`)
      : (result.linesWithoutStop.length === 1 ? '1 line, its stop not read' : `${result.linesWithoutStop.length} lines, their stops not read`));
  }
  if (result.notPlacedToday.length > 0) parts.push(result.notPlacedToday.length === 1 ? '1 plan not placed' : `${result.notPlacedToday.length} plans not placed`);
  return parts.length === 0 ? null : parts.join(' · ');
}
export const badDateWords = (raw: string): string => `?date=${raw} is not a day (YYYY-MM-DD) — showing today`;
export const badStepWords = (raw: string | number, of: number): string => `?step=${raw} is not one of this day's ${of} stops — showing the whole card`;

const lineName = (label: string, line: string | null): string => (line === null ? label : `${label} — ${line}`);
/** The band's name for an all-day line: the routine, and its line when it has one ("Memberships — Gym membership"). */
export const bandNameOf = (s: Stop): string => lineName(s.label, s.line);

/**
 * A line of the stop's kind and id at another instant of the day: the Budget
 * plans it at that instant, the today read names ONE occurrence per routine per
 * day (routineDay.ts, the first) — so a second occurrence has no stop here, and
 * a line whose schedule moved has none either. Both instants are named; nothing
 * is matched by nearness.
 */
export const unmatchedWords = (list: readonly UnmatchedLine[]): string => {
  const allMoved = list.every((u) => u.reason === 'instant differs');
  const allDoubled = list.every((u) => u.reason === 'two plan lines for one stop');
  const head = allMoved
    ? (list.length === 1 ? '1 plan line is at another instant than its stop' : `${list.length} plan lines are at another instant than their stops`)
    : allDoubled
      ? `${list.length} plan lines for one stop`
      : `${list.length} plan lines not matched to a stop`;
  return `${head} — ${list.map((u) => (
    u.reason === 'instant differs'
      ? `${lineName(u.label, u.line)} ${formatCents(u.cents)}: planned at ${u.lineInstant ?? 'no instant'}, the day's one stop is at ${u.stopInstant ?? 'no instant'} (the today read names one occurrence per routine per day — this line has no stop)`
      : `${lineName(u.label, u.line)} ${formatCents(u.cents)}: two plan lines for one stop — neither used`
  )).join(' · ')}`;
};

const lineList = (list: readonly PlanLine[]): string => list.map((l) => `${lineName(l.label, l.line)} ${formatCents(l.cents)}${l.time !== null ? ` at ${l.time}` : ''}`).join(' · ');

export const linesWithoutStopWords = (list: readonly PlanLine[]): string => {
  const head = list.length === 1 ? '1 plan line has no stop today' : `${list.length} plan lines have no stop today`;
  return `${head} — ${lineList(list)}`;
};

/** The same lines while the day could not be read: their stops are unknown, not absent. */
export const linesUnreadWords = (list: readonly PlanLine[]): string => {
  const head = list.length === 1 ? '1 plan line today — its stop could not be read' : `${list.length} plan lines today — their stops could not be read`;
  return `${head} — ${lineList(list)}`;
};

/** A routine priced by its own figure: its lines carry no amount, so the Budget prices the routine and no one stop. */
export const routineFigureWords = (list: readonly PlanLine[]): string => {
  const head = list.length === 1 ? "1 routine is priced as a whole — its lines carry no amount, so none of its stops is" : `${list.length} routines are priced as a whole — their lines carry no amount, so none of their stops is`;
  return `${head} — ${lineList(list)}`;
};

export const notPlacedWords = (list: readonly NotPlaced[]): string => {
  const head = list.length === 1 ? '1 plan not placed' : `${list.length} plans not placed`;
  return `${head} — ${list.map((n) => `${n.label}: ${n.reason}${n.detail !== null ? ` (${n.detail})` : ''}${n.day === null ? ', undated' : ''}`).join(' · ')}`;
};

// ── JOURNAL-01 (2026-10-13): WHICH STOPS ASK AN AMOUNT (CLEAN-02, 2026-10-14: yesterday's tally is gone — the journal card shows no money; asksAmount stays for the verdict) ──

/**
 * Which stops' forms ask an amount (stops/StopForm.tsx `asks`): a place stop and
 * a stop with no role set — a task is a 'none' stop, so a task without its own
 * actual counts. A work stop (journal · plan · execute) is never "without an
 * amount": nothing asked for one.
 */
export const asksAmount = (role: StopRole): boolean => role === 'place' || role === 'none';

// ── TABLE-01 (2026-10-13): THE STOPS AS A TABLE — TIME · VENDOR · LOCATION · DESCRIPTION · BUDGET ──
// PLAN-01 (2026-10-13): the full card's table is TIME · VENDOR · DESCRIPTION · BUDGET — LOCATION_HEAD_WORD now heads the step view's line only.
// CLEAN-02 (2026-10-14): LOCATION is off the step view too — LOCATION_HEAD_WORD is gone (the stop still carries its location; nothing prints it).
// CLEAN-01 (2026-10-14): a fifth column, ACTUAL, after BUDGET — the BUDGET cell carries the budget only.

// ── PLAN-01 (2026-10-13): THE PLATE'S WIDTH — ONE CONSTANT ────────────────

/** The plate's width in CSS px — Alex's ruling: 640, so the card is shorter on the video. Every width on and under the plate derives from it. */
export const PLATE_WIDTH = 640;
/** The plate's side padding and its hairline border. */
export const PLATE_PADDING_X = 29;
export const PLATE_BORDER = 1;
/** What the plate's content may use: 640 − 2 × 29 − 2 × 1 = 580. */
export const PLATE_INNER_WIDTH = PLATE_WIDTH - 2 * PLATE_PADDING_X - 2 * PLATE_BORDER;

export const TIME_HEAD_WORD = 'TIME';
export const VENDOR_HEAD_WORD = 'VENDOR';
export const DESCRIPTION_HEAD_WORD = 'DESCRIPTION';
export const BUDGET_HEAD_WORD = 'BUDGET';
/** CLEAN-01 (2026-10-14): the full card's fifth column — what was paid, after BUDGET. */
export const ACTUAL_HEAD_WORD = 'ACTUAL';
/** Every cell's gap on its right, so no two columns' words touch (TABLE-01's 4 px). */
export const CELL_GAP = 4;
/** A money figure whole: "$9,999.99" at 19 px extrabold is 96.4 px (TABLE-01's measure). */
export const FIGURE_WIDTH = 98;
/** TIME (TABLE-01): the mark's 17 px slot, "06:30–06:45" at 13 px mono (86 px), and the gap. */
const TIME_WIDTH = 110;
const SHARED_WIDTH = PLATE_INNER_WIDTH - TIME_WIDTH - (FIGURE_WIDTH + CELL_GAP) - FIGURE_WIDTH;
/**
 * CLEAN-01 (2026-10-14, Alex's ruling): the full card's five columns, from the
 * plate's inner width — no other number. Each money column holds its figure
 * whole; BUDGET adds a cell's gap on its right so its figure never touches
 * ACTUAL's (ACTUAL is last: the plate's padding is its margin); TIME keeps its
 * mark slot and clock; VENDOR and DESCRIPTION share what is left, and both
 * wrap. The five sum to PLATE_INNER_WIDTH.
 */
export const COLUMN_WIDTHS = {
  time: TIME_WIDTH,
  vendor: Math.floor(SHARED_WIDTH / 2),
  description: SHARED_WIDTH - Math.floor(SHARED_WIDTH / 2),
  budget: FIGURE_WIDTH + CELL_GAP,
  actual: FIGURE_WIDTH,
} as const;

/** TABLE-01: a row's door, named for a screen reader — the step it opens and the row's own words (the visible words stay inside the name). */
export const openStepWords = (index: number, what: string): string => `Open step ${index}: ${what}`;

const MINUTES_IN_A_DAY = 24 * 60;

/** The days a span's end lies past its start's day — "+1d" after the end's clock; nothing when the end is the same day. */
export const dayCarryWords = (days: number): string => (days === 0 ? '' : ` +${days}d`);

/**
 * "07:00–07:30" when the stop states a start and a duration — the end is the
 * start plus the minutes, never a default duration; "07:00" when it states a
 * start alone; null when nothing states a time. An end past the start's day
 * says so: the clock it lands on and the days it carried ("23:45–00:15 +1d";
 * a day-long step "07:00–07:00 +1d") — the modulo never hides a day (TABLE-01
 * review). The dash is the week's (weekPlan.ts timeWindow — deleted TASKS-ONE-02,
 * 2026-10-14; the dash lives here now).
 */
export function intervalWords(time: string | null, minutes: number | null): string | null {
  if (time === null) return null;
  if (minutes === null) return time;
  if (!Number.isInteger(minutes) || minutes < 0) throw new Error(`dayCard: a duration is a whole number of minutes, 0 or more, not ${minutes}`);
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error(`dayCard: a time is HH:MM, not ${time}`);
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const end = total % MINUTES_IN_A_DAY;
  return `${time}–${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}${dayCarryWords(Math.floor(total / MINUTES_IN_A_DAY))}`;
}

// ── CLEAN-01 (2026-10-14): THE FULL CARD'S BUDGET METER AND ITS VERDICT ─────

/** The verdict when the day's actuals equal its planned total. */
export const ON_BUDGET_WORDS = 'on budget';

export interface DayMeter {
  /** The fill's width in whole percent of the track (0–100); null — spent is unknown, the track is drawn empty. */
  readonly percent: number | null;
  /** Spent is past the planned total: the fill is red and full. */
  readonly over: boolean;
}

/**
 * The meter under the spent line (TOTALS-01, 2026-10-14: under the table and its
 * TOTAL row — the spent line is gone; this rule is unchanged): the track is the day's planned total, the
 * fill spent ÷ planned (progressPercent — rounded, capped at 100), green while
 * spent ≤ planned, red and full past it. Spent unknown (null — nothing recorded,
 * or the records not read): an empty track, never a $0 fill. No meter while
 * the planned total is unknown — or is nothing (≤ 0): a track of $0 has no scale
 * (progressPercent's own rule, the step view's bars' too).
 */
export function dayMeter(spentCents: number | null, plannedCents: number | null): DayMeter | null {
  if (plannedCents === null || plannedCents <= 0) return null;
  if (spentCents === null) return { percent: null, over: false };
  const over = spentCents > plannedCents;
  return { percent: over ? 100 : progressPercent(spentCents, plannedCents), over };
}

/**
 * The day's verdict — only once every stop that asks an amount (asksAmount —
 * the PLAN-01 count) carries one, at least one actual is recorded, and both
 * totals are known: "▼ $4.31 under" · "▲ $2 over" (deltaWords, the card's
 * under/over tone) · "on budget" when they are equal. null otherwise — a
 * verdict on part of the day would be a guess.
 */
export function dayVerdict(result: DayStops, plannedCents: number | null): DeltaWords | null {
  if (result.spentCents === null || plannedCents === null || result.withActual === 0) return null;
  if (result.stops.some((s) => asksAmount(s.role) && s.actualCents === null)) return null;
  if (result.spentCents === plannedCents) return { text: ON_BUDGET_WORDS, over: false };
  return deltaWords(result.spentCents, plannedCents);
}

// ── TOTALS-01 (2026-10-14): THE FULL CARD'S TOTAL ROW ──────────────────────

/** The first cell of the table's foot row, spanning TIME through DESCRIPTION. */
export const TOTAL_WORD = 'TOTAL';

export interface DayTotals {
  /** The sum of the BUDGET cells the rows show — a row's "—" adds nothing (the fine print counts it, "N not priced"); null when no row shows one. */
  readonly budgetCents: number | null;
  /** The day's spent — the recorded actuals summed (spentCents); null while nothing is recorded or the records were not read: "—", never $0. */
  readonly actualCents: number | null;
  /** The ACTUAL total's tone, as a row's: against the BUDGET cells of the recorded rows only; null (muted) when it is unknown or none of them shows a budget. */
  readonly over: boolean | null;
  /** The hero's day plan the table does not show (all-day lines, plan lines with no stop): the planned total less the BUDGET total; null when equal or the plan is unknown. */
  readonly beyondCents: number | null;
}

/**
 * TOTALS-01 (2026-10-14, Alex's ruling): the full card's totals at the bottom —
 * a TOTAL row under the table, the meter and the verdict below it.
 *   · BUDGET total: what the eye can add up — the BUDGET cells shown above it;
 *     a "—" row adds nothing.
 *   · ACTUAL total: the day's spent (spentCents), or unknown (null) while no
 *     stop carries an actual or the records were not read — never $0 (PLAN-01).
 *     Its tone is a row's (deltaWords): the spent against the BUDGET cells of
 *     the recorded rows only, so a day half recorded is not "under" by the
 *     half not yet spent.
 *   · The difference from the hero: the hero is the Budget's figure for the
 *     WHOLE day (plannedCents — every line of the day, matched or not), the
 *     column only the stops' matched lines. What the table does not show — the
 *     all-day band's lines, the lines no stop carries, lines at another instant,
 *     a routine priced as a whole — is said under the plate, computed, never
 *     invented; equal, nothing is said.
 */
export function dayTotals(result: DayStops, plannedCents: number | null): DayTotals {
  const shown = result.stops.map((s) => s.cents).filter((c): c is number => c !== null);
  const budgetCents = shown.length === 0 ? null : shown.reduce((sum, c) => sum + c, 0);
  const actualCents = result.spentCents === null || result.withActual === 0 ? null : result.spentCents;
  const recordedBudgets = result.stops.filter((s) => s.actualCents !== null).map((s) => s.cents).filter((c): c is number => c !== null);
  const recordedBudget = recordedBudgets.length === 0 ? null : recordedBudgets.reduce((sum, c) => sum + c, 0);
  const beyond = plannedCents === null ? 0 : plannedCents - (budgetCents === null ? 0 : budgetCents);
  return {
    budgetCents,
    actualCents,
    over: deltaWords(actualCents, recordedBudget).over,
    beyondCents: beyond === 0 ? null : beyond,
  };
}

/** The fine print under the plate when the hero's day plan is more (or less) than the BUDGET total: "$11 more planned off the table (all day / no stop)". */
export const planBeyondStopsWords = (cents: number): string =>
  `${planDollars(Math.abs(cents))} ${cents > 0 ? 'more' : 'less'} planned off the table (all day / no stop)`;

// ── TASKS-ONE-01 (2026-10-14): WHERE THE CARD LIVES — THE FIRST SECTION OF /tasks ──

/** The card's page — the first section of Tasks' one page (Alex, 2026-10-14: one Tasks page, no sub-tabs). Every URL the card pushes, and /tasks/day's one hop, start here. */
export const DAY_CARD_PATH = '/tasks';

/** The card's two query parameters (DayCard.tsx reads `date` and `step`, and nothing else on /tasks reads one) — the only ones /tasks/day carries over. */
export const DAY_CARD_PARAMS = ['date', 'step'] as const;

/**
 * /tasks/day's one hop: DAY_CARD_PATH with `date` and `step` exactly as given —
 * every value of each, in the order given, date's first as the card's own links
 * write them — and nothing else: no other parameter carried, none invented, none
 * checked. A value that is not a day or not a step arrives as it was sent, and
 * the card names it (badDateWords, badStepWords) as it did at /tasks/day. Neither
 * given → the bare path.
 */
export function dayCardRedirectHref(given: Readonly<Record<string, string | readonly string[] | undefined>>): string {
  const kept = new URLSearchParams();
  for (const key of DAY_CARD_PARAMS) {
    const value = given[key];
    for (const v of value === undefined ? [] : typeof value === 'string' ? [value] : value) kept.append(key, v);
  }
  const query = kept.toString();
  return query === '' ? DAY_CARD_PATH : `${DAY_CARD_PATH}?${query}`;
}
