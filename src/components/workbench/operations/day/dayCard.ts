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
 * joined the two is gone (tallyShippedWords deleted). JOURNAL-03 (Alex,
 * 2026-10-15): END OF DAY itself is retired — the journal card reads no typed
 * end of day, yesterday's or today's.
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
import { NO_STAY_WORDS, STAY_NOT_READ_WORDS, placeParts, stayDay, stayDayWords, type StayRow } from '@/lib/operations/stay';
import type { Answers } from '@/lib/operations/journal';
import {
  LATER_WORD, NOT_RECORDED_WORDS, OPEN_WORD, ROUTINE_DONE_WORDS, ROUTINE_MISSED_WORDS, SKIPPED_WORD, TASK_DONE_WORDS, TASK_OPEN_WORDS, doneWords, lateWords, recordKey, skippedWords, starsWords,
  type StopRecordKind, type StopRecordPlan, type StopRecordRow,
} from '@/lib/operations/stopRecord';
import { NO_AMOUNT_NO_VENDOR_WORDS, REPORT_NOT_READ_NO_VENDOR_WORDS, UNMATCHED_NO_VENDOR_WORDS, isStop, isStopRole, type StopRole } from '@/lib/operations/stopRole';
import { minutesOf } from '@/lib/calendar/day';
import { instantToZoned, zonedToInstant } from '@/lib/time';
import { showsWorkBlock } from '@/lib/operations/workBlock';
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
  /** WORK-03b: the stop's planned minutes by the one rule (plannedMinutesOf) — a line's duration_minutes, a stepless routine's window length; null for a line that states none, a stepless routine without a window, and a task. */
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

/** What the planned-minutes rule reads: a line (its duration_minutes) or a stepless routine (its window — @db.Time values: a Date on the server, its JSON '1970-01-01THH:MM:SS.000Z' on the card). */
export type PlannedMinutesPlan =
  | { readonly kind: 'line'; readonly duration_minutes: number | null }
  | { readonly kind: 'routine'; readonly start_time: Date | string | null; readonly end_time: Date | string | null };
/** Minutes past midnight of a routine's @db.Time; null for none; a value that is no time is the read's error, thrown by name. */
const windowMinutesOf = (what: 'start_time' | 'end_time', v: Date | string | null): number | null => {
  if (v === null) return null;
  const m = minutesOf(clockOf(v instanceof Date ? v.toISOString() : v));
  if (m === null) throw new Error(`dayCard: ${what} ${JSON.stringify(v)} is not a time — a @db.Time arrives as 1970-01-01THH:MM:SS.000Z`);
  return m;
};
/**
 * WORK-03b (Alex, 2026-10-26): THE ONE PLANNED-MINUTES RULE — the stop's `minutes`: what the work block's length is drawn
 * from (workBlock.ts blockWindowOf), what the ledger prints as PLANNED MIN (ledger.ts, through the ledger route's
 * recordInputOf) and what the stop's own minutes are. A line → its duration_minutes (the line's own, as it was). A stepless
 * routine with both start_time and end_time → end − start in whole minutes, an end before the start ending the next day
 * (rruleHelpers.ts EMPTY_WINDOW_WORDS — MOVE-01's window convention); an end equal to the start is 0 — refused on write, and
 * no length here (blockWindowOf: ≤ 0 is none). Else null: a line that states none, a stepless routine without a window.
 * Applied here for the card's stops and in the ledger route for a record's plan; no reader restates it.
 */
export function plannedMinutesOf(plan: PlannedMinutesPlan): number | null {
  if (plan.kind === 'line') return plan.duration_minutes;
  const start = windowMinutesOf('start_time', plan.start_time);
  const end = windowMinutesOf('end_time', plan.end_time);
  if (start === null || end === null) return null;
  return end >= start ? end - start : end + 24 * 60 - start;
}

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
        minutes: plannedMinutesOf({ kind: 'routine', start_time: r.start_time, end_time: r.end_time }),
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
        minutes: plannedMinutesOf({ kind: 'line', duration_minutes: step.duration_minutes }),
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
 * TOTALS-01 amendment II (2026-10-15): the card passes the TOTAL row's BUDGET
 * as the second figure, not the hero's plan; this rule is unchanged.
 */
export const spentSoFarWords = (spentCents: number | null, plannedCents: number | null): string =>
  `${SPENT_SO_FAR_WORDS} ${planDollars(spentCents)} of ${planDollars(plannedCents)}`;
export const SPENT_SO_FAR_WORDS = 'spent so far';
/** "over by $5" — the actuals past the day's planned total, in the card's over tone. */
export const overByWords = (cents: number): string => `over by ${planDollars(cents)}`;
/** The step view draws no bars when the day's planned total is unknown or nothing is planned — and says why. */
export const BARS_PLAN_NOT_READ_WORDS = 'no bars — the day’s planned total is not known (the Budget’s plan lines were not read)';
export const BARS_NOTHING_PLANNED_WORDS = 'no bars — nothing is planned for the day';
/** TOTALS-01 amendment II (2026-10-15): no bars because no stop carries a budget, while the day has a plan off the table (all-day lines, lines no stop carries). */
export const BARS_NO_STOP_BUDGET_WORDS = 'no bars — no stop of the day is priced; the day’s plan is off the table (all day / no stop)';
/** TOTALS-01 amendment II: no bars because the stops' budget is $0 or less, while the day's plan is more, off the table. */
export const barsStopsBudgetWords = (budgetCents: number): string => `no bars — the stops’ budget is ${planDollars(budgetCents)}; the day’s plan is off the table (all day / no stop)`;

/**
 * TOTALS-01 amendment II (Alex, 2026-10-15): why the step view draws no bars,
 * now that the bars measure the TOTAL row's BUDGET (the stops' budget) and not
 * the hero's plan. Called only when there is no plan bar; each answer stays
 * true. The report not read: the plan is not known. Nothing planned at all
 * (the hero is $0 or less): nothing is planned. Otherwise the hero has a plan
 * and the stops carry none of it (no stop priced, or priced at $0 or less): the
 * plan is off the table, said as such, never "nothing is planned". A positive
 * BUDGET total draws a bar, so asking why there is none is the caller's error.
 */
export function barsWhyWords(plannedCents: number | null, budgetCents: number | null): string {
  if (plannedCents === null) return BARS_PLAN_NOT_READ_WORDS;
  if (budgetCents !== null && budgetCents > 0) throw new Error(`dayCard: a BUDGET total of ${budgetCents} cents draws the bars — there is no why-line to say`);
  if (plannedCents <= 0) return BARS_NOTHING_PLANNED_WORDS;
  return budgetCents === null ? BARS_NO_STOP_BUDGET_WORDS : barsStopsBudgetWords(budgetCents);
}

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

// ── RETRO-01 (Alex, 2026-10-16): A RECORD THAT MATCHES NO STOP RE-ATTACHES TO ITS STOP ──
//
// A record typed before its routine's time or start date changed is keyed to an
// instant no stop of the day is at. The foot names each one — its plan's words
// (the stops GET hands them beside the records), its instant in the routine's
// zone, what it says — and offers "attach to <stop>" for every stop of the day
// that is the SAME plan and holds no record (a daily routine has one a day);
// the move is the stops/[id] PATCH, through stops/AttachRecord.tsx (the one
// writer's caller — the day folder writes nothing). No such stop → the line says
// what to do. recordsWithoutStopWords (one sentence for all) is gone.

/** "2 records of the day match no stop" — the head over the list. */
export const recordsWithoutStopHead = (n: number): string => (n === 1 ? '1 record of the day matches no stop' : `${n} records of the day match no stop`);

/** One stranded record: its plan's words, its instant in the routine's own zone, what it says — "Brunch · 11:00 Tue Oct 13: done, $22.00". */
export const recordWithoutStopWords = (r: StopRecordRow, plan: StopRecordPlan): string => {
  const at = instantToZoned(new Date(r.occurrence_at), plan.timezone);
  return `${stopName({ line: plan.activity, label: plan.routine_name })} · ${at.time} ${dayShortWords(at.date)}: ${r.outcome}${r.actual_cents === null ? '' : `, ${formatCents(r.actual_cents)}`}`;
};

/** The stops of the day that are the record's own plan (kind and id), with or without a record. */
export const planStops = (r: Pick<StopRecordRow, 'kind' | 'target_id'>, stops: readonly Stop[]): Stop[] =>
  stops.filter((s) => s.address !== null && s.address.kind === r.kind && s.address.id === r.target_id);

/** The stops of the day that are the record's own plan (kind and id) and hold no record — where it can attach. */
export const attachableStops = (r: Pick<StopRecordRow, 'kind' | 'target_id'>, stops: readonly Stop[]): Stop[] =>
  planStops(r, stops).filter((s) => s.record === null);

/** "attach to Brunch 11:00" — the button's words, the stop's bold name and its clock. */
export const attachWords = (s: Pick<Stop, 'line' | 'label' | 'time'>): string => `attach to ${stopName({ line: s.line, label: s.label })}${s.time === null ? '' : ` ${s.time}`}`;

/** No stop of the record's plan on this day — what to do. */
export const noStopToAttachWords = (routine: string): string => `no ${routine} stop on this day — extend the routine's start date, then attach`;

/** The plan's stop on this day already holds a record — the move would be refused by name; what to do. */
export const stopTakenWords = (routine: string): string => `the ${routine} stop on this day already has a record — clear one of the two first`;

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

/** "4 OF 7 · 12:30" — the step card's header words ('—' for a stop with no time). DECK-01 (2026-10-16): n and of count the deck's stops — the journal is not one of them. */
export const stepHeaderWords = (n: number, of: number, time: string | null): string => `${n} OF ${of} · ${time === null ? '—' : time}`;

// ── DECK-01 (Alex, 2026-10-16): THE DECK — the full card, then one card per stop, swiped sideways; the journal on its own under it ──

/** The full card's hint, under the deck: the way in to a stop's card (was stopRole.ts TAP_A_STOP_WORDS, "tap a stop to record it"). */
export const SWIPE_HINT_WORDS = 'swipe or tap a stop to record it';
/** The deck, named for a screen reader. */
export const DECK_WORDS = 'the day’s cards';
export const DECK_PREVIOUS_WORDS = 'previous card';
export const DECK_NEXT_WORDS = 'next card';
/** The first card's name on the position marker. */
export const DECK_FULL_CARD_WORDS = 'the day';
/** "card 2 of 8 — Brunch" — a dot under the deck, and the card in view, named. */
export const deckCardWords = (n: number, of: number, what: string): string => `card ${n} of ${of} — ${what}`;
/** The journal card's header: its stop's time alone — no step number, it is not one of the deck's cards. */
export const journalHeaderWords = (time: string | null): string => (time === null ? '—' : time);
/** The journal row's door on the full card — it opens the journal card under the deck, not a step. */
export const openJournalWords = (what: string): string => `Open the journal card: ${what}`;
/** "temple-stuart-2026-10-14-journal.png" — the journal card's image; it has no step number (cardImage.ts names the deck's cards). */
export const journalImageName = (day: string): string => `temple-stuart-${day}-journal.png`;

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
 * VENDOR-03 (Alex, 2026-10-27): /budget has not listed them since BUDGET-02; the
 * card's full view lists them again, as a section under the plate with "clear"
 * (stops/StrandedVendors.tsx, src/lib/operations/strandedVendors.ts). This line
 * still counts none of them.
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
/** DECK-01 (2026-10-16): `of` counts the deck's stops (the journal is not one), so ?step= names a card of the deck. */
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
/**
 * WIDTH-01 (Alex, 2026-10-16): on screen a card is scaled to its frame's width — down on a phone, UP on a computer, so the
 * deck and the journal card fill the Tasks section as the tables under them do — and never past this, so a wide monitor does
 * not blow the card up past readability. The plate itself stays PLATE_WIDTH wide: "download image" renders it, not the scale.
 */
export const PLATE_SCALE_MAX = 2;
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
 * TOTALS-01 amendment (Alex, 2026-10-15): the card gives it the TOTAL row's
 * BUDGET (dayTotals budgetCents, the stops' budget) as the plan, not the
 * hero's plannedCents; null, no meter. This rule is unchanged.
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
 * TOTALS-01 amendment (Alex, 2026-10-15): the card gives it the TOTAL row's
 * BUDGET as the plan, so the verdict reads the row above it; null, none.
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
  /** The sum of the BUDGET cells the rows show — a row's "—" adds nothing (the fine print counts it, "N not priced"); null when no row shows one. The meter's and the verdict's plan (amendment, 2026-10-15). */
  readonly budgetCents: number | null;
  /** The day's spent — the recorded actuals summed (spentCents); null while nothing is recorded or the records were not read: "—", never $0. */
  readonly actualCents: number | null;
  /** The ACTUAL total's tone, as a row's: against the BUDGET cells of the recorded rows only; null (muted) when it is unknown or none of them shows a budget. */
  readonly over: boolean | null;
  /** LEDGER-01 (2026-10-16): the figure `over` is measured against — the BUDGET cells of the recorded rows summed; null when none of them shows a budget. The ledger prints the under/over in words from it. */
  readonly recordedBudgetCents: number | null;
  /** The hero's day plan the table does not show (all-day lines, plan lines with no stop): the planned total less the BUDGET total; null when equal or the plan is unknown. */
  readonly beyondCents: number | null;
}

/** LEDGER-01 (2026-10-16): what dayTotals reads of a day — a DayStops is one; the ledger's rows in a period are another. The rule is unchanged. */
export interface TotalsInput {
  readonly stops: readonly Pick<Stop, 'cents' | 'actualCents'>[];
  readonly spentCents: number | null;
  readonly withActual: number;
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
 *   · Amendment (Alex, 2026-10-15): the meter and the verdict under the row
 *     measure the row: the spent against the BUDGET total, not the whole plan.
 *   · LEDGER-01 (Alex, 2026-10-16): the ledger's TOTAL row and its summary groups
 *     are this rule over their rows (one rule, reused — never rewritten): the input
 *     is what the rule reads (TotalsInput), and the recorded budget it measures
 *     against is returned. The arithmetic is unchanged.
 */
export function dayTotals(result: TotalsInput, plannedCents: number | null): DayTotals {
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
    recordedBudgetCents: recordedBudget,
    beyondCents: beyond === 0 ? null : beyond,
  };
}

/** The fine print under the plate when the hero's day plan is more (or less) than the BUDGET total: "$11 more planned off the table (all day / no stop)". */
export const planBeyondStopsWords = (cents: number): string =>
  `${planDollars(Math.abs(cents))} ${cents > 0 ? 'more' : 'less'} planned off the table (all day / no stop)`;

// ── REEL-01 (Alex, 2026-10-15): THE REEL KIT — A TAG PER STOP, THE CAPTION, THE SCRIPT ──
// REEL-02 (Alex, 2026-10-19): "Tomorrow:" — the evening's `next` ends the script and closes the caption before the tags (TOMORROW_WORDS).
// The reel reads goals, blocker and next; learned and audit are never read here.
//
// Alex posts a daily reel built on this card: one bold tag per scene, the full card as the receipt at the end,
// a caption and a narration he used to type by hand. Each is made here by one pure rule from the card's OWN
// figures (Stop, Focus, dayTotals, dayVerdict) — nothing recomputed another way, no number the card does not
// show (R3). Nothing leaves the browser but the PNG and the clipboard (R4): no fetch, no model, no route.
// A read the output uses that is in flight makes it wait; one that failed is named; never a partial text that
// hides a missing part (Alex, 2026-10-15). With no covering stay there is no caption and no script, said by name.

/** The stop's own name as the card prints it bold: its line (the step's activity) when it has one, else its label. */
export const stopName = (s: Pick<Stop, 'line' | 'label'>): string => (s.line !== null ? s.line : s.label);

/** One read an output uses: still in flight, failed, or in. */
export type ReelRead = 'waiting' | 'failed' | 'ok';

/**
 * The reads behind the reel outputs. The journal is read only on a day with a journal stop; null when the output does not use it.
 * WORK-03 (Alex, 2026-10-26): the backlog too — read with the day's window on a day with an execute stop (its done tasks are the
 * execute stops' scene lines); null on a day with none. A failed backlog read names itself; the reel never makes a scene without it.
 */
export interface ReelReads {
  readonly day: ReelRead;
  readonly tasks: ReelRead;
  readonly report: ReelRead;
  readonly records: ReelRead;
  readonly stay: ReelRead;
  readonly journal: ReelRead | null;
  readonly backlog: ReelRead | null;
}

/** Each read by the name the waiting and failure words give it, in this order. */
export const REEL_READ_NAMES: Readonly<Record<keyof ReelReads, string>> = {
  day: 'the day’s routines', tasks: 'the day’s tasks', report: 'the budget report', records: 'the stop records', stay: 'the stay', journal: 'the journal', backlog: 'the backlog',
};
const REEL_READ_ORDER: readonly (keyof ReelReads)[] = ['day', 'tasks', 'report', 'records', 'stay', 'journal', 'backlog'];

export const reelWaitingWords = (names: readonly string[]): string => `not ready — waiting for ${names.join(', ')}`;
export const reelFailedWords = (names: readonly string[]): string => `not made — ${names.join(', ')} could not be read`;

/** Null when every read the output uses is in; else why not: the failed reads by name (a failure never waits), or the ones still in flight. */
export function reelReadsWords(reads: ReelReads): string | null {
  const named = (state: ReelRead) => REEL_READ_ORDER.filter((k) => reads[k] === state).map((k) => REEL_READ_NAMES[k]);
  const failed = named('failed');
  if (failed.length > 0) return reelFailedWords(failed);
  const waiting = named('waiting');
  return waiting.length > 0 ? reelWaitingWords(waiting) : null;
}

/** A reel text, or why there is none. */
export type ReelText = { readonly ok: true; readonly text: string } | { readonly ok: false; readonly words: string };

export const noStayReelWords = (day: string): string => `no caption and no script — no stay covers ${dayShortWords(day)} (the place and the day count come from the stay)`;
export const COPY_CAPTION_WORDS = 'copy caption';
export const COPY_SCRIPT_WORDS = 'copy script';
export const CAPTION_COPIED_WORDS = 'caption copied';
export const SCRIPT_COPIED_WORDS = 'script copied';
export const copyFailedWords = (what: 'caption' | 'script', reason: string): string => `could not copy the ${what} — ${reason}`;

/** The covering stay's day count for the day — the header's rule (stayDay); a stay that does not cover the day is the caller's error. */
function stayAt(stay: StayRow, day: string): { readonly n: number; readonly of: number } {
  const at = stayDay({ startsOn: stay.starts_on, endsOn: stay.ends_on }, day);
  if (at === null) throw new Error(`dayCard: the stay ${stay.starts_on}..${stay.ends_on} does not cover ${day} — the reel was handed the wrong stay`);
  return at;
}

// R1 · THE TAG — one stop, for a phone over video.

/** The tag's width in CSS pixels; the PNG is CARD_IMAGE_PIXEL_RATIO times it, as the card's. */
export const TAG_WIDTH = 600;
/** "budget $15" — a stop not recorded: its budget alone. */
export const tagBudgetWords = (cents: number): string => `budget ${planDollars(cents)}`;

export interface StopTagWords {
  /** "DAY 8 OF 15 · Chiang Mai, Thailand 🇹🇭" — the covering stay's count and its place as typed; the day alone with no stay (whereWords' rule). */
  readonly top: string;
  /** The vendor; the stop's name when it has none. */
  readonly big: string;
  /** The stop's name (when the vendor is the big line) and its time; null when neither is left to say. */
  readonly what: string | null;
  /** The actual with the row's delta words and tone; "budget $15" when there is no actual; null when the stop shows neither. */
  readonly money: { readonly kind: 'actual' | 'budget'; readonly words: string; readonly over: boolean | null } | null;
  /** The record's rating as the card's stars; null when not rated. */
  readonly stars: string | null;
  /** The step view's own spent-so-far words, exactly as it prints them (stepSpentSoFarWords). */
  readonly foot: string;
}

/**
 * R1: the tag's words for one stop — its vendor big (its name when it has none),
 * its name and time, the money as the row says it (the actual with the row's
 * delta, under green, over red; "budget $15" when not recorded; nothing when
 * not priced — never $0 for an unknown), the stars when rated, and the step
 * view's own spent-so-far line as its foot. Nothing else: no note, no bars.
 */
export function stopTagWords(input: { readonly day: string; readonly stay: StayRow | null; readonly stop: Stop; readonly foot: string }): StopTagWords {
  const { day, stay, stop } = input;
  const at = stay === null ? null : stayAt(stay, day);
  const name = stopName(stop);
  const what = [stop.vendor !== null ? name : null, stop.time].filter((w): w is string => w !== null).join(' · ');
  const money = stop.actualCents !== null
    ? { kind: 'actual' as const, words: rowActualWords(stop.actualCents, stop.cents), over: deltaWords(stop.actualCents, stop.cents).over }
    : stop.cents !== null ? { kind: 'budget' as const, words: tagBudgetWords(stop.cents), over: null } : null;
  return {
    top: stay === null || at === null ? dayShortWords(day) : `${stayDayWords(at.n, at.of)} · ${stay.place}`,
    big: stop.vendor !== null ? stop.vendor : name,
    what: what === '' ? null : what,
    money,
    stars: stop.record !== null && stop.record.rating !== null ? starsWords(stop.record.rating) : null,
    foot: input.foot,
  };
}

/** The step view's spent-so-far line — the actuals of stops 1..n of the TOTAL row's BUDGET; "—" while none so far is recorded (never $0). One rule for the card's line and the tag's foot. */
export const stepSpentSoFarWords = (focus: Pick<Focus, 'spentSoFarCents' | 'withActualSoFar'>, budgetCents: number | null): string =>
  spentSoFarWords(focus.spentSoFarCents === null || focus.withActualSoFar === 0 ? null : focus.spentSoFarCents, budgetCents);

// R2 · THE CAPTION and R5 · THE SCRIPT — the same reads, the same figures.

/** What the caption and the script are made from — the card's own reads and figures. */
export interface ReelDay {
  readonly day: string;
  /** The stay covering the day (read); null when none does. */
  readonly stay: StayRow | null;
  /** The card's stops, in the table's order. */
  readonly stops: readonly Stop[];
  readonly totals: DayTotals;
  /** The card's verdict (dayVerdict on the TOTAL row's BUDGET); null when the card shows none. */
  readonly verdict: DeltaWords | null;
  /**
   * The day's journal answers when the card read them; null when none was typed, or the day has no journal stop (the card reads none).
   * REEL-02 (Alex, 2026-10-19): `next` too — the evening's "where do I want to take it next?", the script's cliffhanger and the
   * caption's line before the tags. `learned` and `audit` are NOT here: they are Alex's, and the reel never reads them.
   */
  readonly journal: Pick<Answers, 'goals' | 'blocker' | 'next'> | null;
  /**
   * WORK-03 (Alex, 2026-10-26): per execute stop (by its key), the tasks done in its block — title and completed_at, in completed_at
   * order — handed in by the card from the backlog read it already holds (workBlock.ts doneInBlocksOf over the day's window). Every
   * execute stop of `stops` is keyed. No other stop is keyed.
   * WORK-03b (Alex, 2026-10-26): a stop with no length (blockWindowOf null) maps to null — no list, so no block line: the reel
   * never claims a count nothing could count.
   */
  readonly done: ReadonlyMap<string, readonly ReelDoneTask[] | null>;
}
/** WORK-03: one task done in an execute stop's block, as the reel reads it (the backlog read's LogDoneTask, narrowed). */
export interface ReelDoneTask {
  readonly title: string;
  readonly completedAt: string;
}
/** WORK-03: an execute stop's done tasks as the card handed them in — WORK-03b: null when its block has no length (no block line); null for any other stop; an execute stop the card did not hand in is the card's error. */
export function reelDoneOf(d: Pick<ReelDay, 'done'>, s: Stop): readonly ReelDoneTask[] | null {
  if (!showsWorkBlock(s)) return null;
  const list = d.done.get(s.key);
  if (list === undefined) throw new Error(`dayCard: ${s.key} is an execute stop with no done list — the card hands the reel every execute stop's (workBlock.ts doneInBlocksOf)`);
  return list;
}

export const CAPTION_PLAN_HEAD_WORDS = 'Today’s plan:';
export const captionBlockerWords = (blocker: string): string => `Blocker: ${blocker}`;
/**
 * REEL-02 (Alex, 2026-10-19): the forward guidance. The reel is a daily earnings report — the plan, each stop, the tally, then
 * where it goes next: the evening's `next`, one line typed at night, is the script's LAST block (the cliffhanger) and the caption's
 * last section BEFORE the tags. One constant, both texts; nothing when the journal has no `next` — the texts are then as REEL-01 left them.
 */
export const TOMORROW_WORDS = 'Tomorrow:';
export const tomorrowWords = (next: string): string => `${TOMORROW_WORDS} ${next}`;
export const CAPTION_POINT_WORDS = '👇';
export const CAPTION_STAR_WORDS = '⭐️';
export const SKIPPED_TAIL_WORDS = ': skipped';
/**
 * WORK-03 (Alex, 2026-10-26): THE BLOCK IN THE REEL. An execute stop's scene gains one line after the note line — "Done in this
 * block: <task>, <task>." in completed_at order (as the card handed them), or "Nothing ticked in this block." — and the caption gains
 * "<name>: <k> tasks done" ("1 task done") for an execute stop with at least one; none ticked adds no caption line. Every other
 * stop's scene and caption line are unchanged, byte for byte.
 * WORK-03b (Alex, 2026-10-26): no block line without a length — a block blockWindowOf reads as null (no minutes, ≤ 0) carries
 * neither sentence; the panel's no-length words on the step view say why (workBlock.ts NO_LENGTH_WORDS).
 */
export const DONE_IN_BLOCK_SCENE_WORDS = 'Done in this block:';
export const NOTHING_TICKED_WORDS = 'Nothing ticked in this block.';
export const doneInBlockSceneWords = (done: readonly ReelDoneTask[]): string => (done.length === 0 ? NOTHING_TICKED_WORDS : `${DONE_IN_BLOCK_SCENE_WORDS} ${done.map((t) => t.title).join(', ')}.`);
export const doneCountWords = (name: string, k: number): string => `${name}: ${k} task${k === 1 ? '' : 's'} done`;
/** The caption's constant tags, after the place's. */
export const CAPTION_TAGS = ['#digitalnomad', '#costofliving', '#buildinpublic'] as const;

/** A part of the place as a tag: NFC, lowercased, Unicode letters and digits only — spaces, punctuation and the flag emoji go. */
const tagWord = (part: string): string => part.normalize('NFC').toLowerCase().replace(new RegExp('[^\\p{L}\\p{N}]+', 'gu'), '');

/**
 * R2: the place's tags, then the three constants. The place is split at its
 * FIRST comma: the city before it, the country after ("Chiang Mai, Thailand 🇹🇭"
 * → #chiangmai #thailand). A place with no comma gives the city tag and the three
 * constants. A part with no letter or digit left gives no tag — never a guessed one.
 * LEDGER-01 (Alex, 2026-10-16): the split is stay.ts placeParts — the one split,
 * shared with the ledger's CITY and COUNTRY; the tags are unchanged (tagWord drops
 * the whitespace the split now trims).
 */
export function captionTags(stayPlace: string): string[] {
  const place = placeParts(stayPlace);
  const parts = place.country === null ? [place.city] : [place.city, place.country];
  return [...parts.map(tagWord).filter((w) => w !== '').map((w) => `#${w}`), ...CAPTION_TAGS];
}

/** "<name> at <vendor>" — the name alone when the stop has no vendor. */
const atVendor = (s: Stop): string => (s.vendor !== null ? `${stopName(s)} at ${s.vendor}` : stopName(s));
const skippedRecord = (s: Stop): boolean => s.record !== null && s.record.outcome === 'skipped';
/** The row's delta words, only when both figures are known (deltaWords says '—' otherwise, which is no words). */
const knownDelta = (s: Stop): string | null => {
  const d = deltaWords(s.actualCents, s.cents);
  return d.over === null ? null : d.text;
};

/**
 * R2: the caption — one text, made from the card's own reads. Line 1 the
 * covering stay's place as typed and its day count; line 2 the TOTAL row's
 * budget and the hook (none when the TOTAL row has no budget); the journal's
 * goals and blocker when the card read a journal; one block per stop that has a
 * record and shows a budget or an actual, in the table's order (tasks and the
 * journal stop left out — never shown as $0); the totals and the card's verdict;
 * REEL-02 (2026-10-19): "Tomorrow: <next>" when the journal carries a `next`;
 * the tags, last. Sections are separated by a blank line. No covering stay → no caption.
 */
export function captionText(d: ReelDay): ReelText {
  if (d.stay === null) return { ok: false, words: noStayReelWords(d.day) };
  const at = stayAt(d.stay, d.day);
  const sections: string[][] = [];
  const head = [`${d.stay.place} Day ${at.n} of ${at.of}!`];
  if (d.totals.budgetCents !== null) head.push(`Budget today: ${planDollars(d.totals.budgetCents)}. ${HOOK_WORDS} ${CAPTION_POINT_WORDS}`);
  sections.push(head);
  if (d.journal !== null) {
    const journal = [...(d.journal.goals.length > 0 ? [CAPTION_PLAN_HEAD_WORDS, ...d.journal.goals] : []), ...(d.journal.blocker !== null ? [captionBlockerWords(d.journal.blocker)] : [])];
    if (journal.length > 0) sections.push(journal);
  }
  for (const s of d.stops) {
    // WORK-03: an execute stop with tasks done in its block has a section even without money; its count line comes after its money lines.
    const done = reelDoneOf(d, s);
    const ticked = done === null ? 0 : done.length;
    const money = s.record !== null && (s.cents !== null || s.actualCents !== null);
    if (s.kind === 'task' || s.role === 'journal' || (!money && ticked === 0)) continue;
    const block: string[] = [];
    if (s.record !== null && money) {
      block.push(`${atVendor(s)}${skippedRecord(s) ? SKIPPED_TAIL_WORDS : ''}`, `Budget: ${planDollars(s.cents)}`, `Actual: ${planDollars(s.actualCents)}`);
      const delta = knownDelta(s);
      if (delta !== null) block.push(delta);
      if (s.record.rating !== null) block.push(CAPTION_STAR_WORDS.repeat(s.record.rating));
      if (s.record.note !== null) block.push(s.record.note);
    }
    if (ticked > 0) block.push(doneCountWords(stopName(s), ticked));
    sections.push(block);
  }
  sections.push([`Total budget: ${planDollars(d.totals.budgetCents)}`, `Spent: ${planDollars(d.totals.actualCents)}`, ...(d.verdict !== null ? [d.verdict.text] : [])]);
  if (d.journal !== null && d.journal.next !== null) sections.push([tomorrowWords(d.journal.next)]);
  sections.push([captionTags(d.stay.place).join(' ')]);
  return { ok: true, text: sections.map((lines) => lines.join('\n')).join('\n\n') };
}

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
/** The narration's blanks — a missing piece to fill, never $0 and never invented. */
export const SCRIPT_BLANKS = { budget: '[budget]', actual: '[actual]', stars: '[stars]', what: '[what you got]', verdict: '[verdict]' } as const;
export const SCRIPT_HOOK_TAIL_WORDS = 'Let’s find out.';

/**
 * R5: one stop's scene. A skipped stop: "<name>: skipped." and its reason. Else
 * "<name> at <vendor>." / the note, or [what you got] / "Budget <b>, actual <a>,
 * <the row's delta>." when the stop shows a budget or an actual (each missing
 * figure a blank, the delta only when both are known) / "<n> out of 5.", or
 * [stars]. A stop that shows neither figure has no money sentence.
 * WORK-03 (Alex, 2026-10-26): an execute stop's scene gains one line after the
 * note line (the reason line of a skipped one) — doneInBlockSceneWords over the
 * tasks done in its block, which the caller hands in (`done`, as reelDoneOf
 * reads it off the map: the list; WORK-03b, null for a block with no length —
 * no block line; nothing for any other stop). An execute stop handed nothing is
 * the caller's error.
 */
export function stopSceneLines(s: Stop, done?: readonly ReelDoneTask[] | null): string[] {
  const block = ((): string | null => {
    if (!showsWorkBlock(s)) return null;
    if (done === undefined) throw new Error(`dayCard: ${s.key} is an execute stop — its scene needs the tasks done in its block`);
    return done === null ? null : doneInBlockSceneWords(done);
  })();
  if (skippedRecord(s) && s.record !== null) {
    if (s.record.note === null) throw new Error(`dayCard: ${s.key} is skipped by its record but carries no reason`);
    return [`${stopName(s)}${SKIPPED_TAIL_WORDS}.`, s.record.note, ...(block === null ? [] : [block])];
  }
  const lines = [`${atVendor(s)}.`, s.record !== null && s.record.note !== null ? s.record.note : SCRIPT_BLANKS.what];
  if (block !== null) lines.push(block);
  if (s.cents !== null || s.actualCents !== null) {
    const delta = knownDelta(s);
    lines.push(`Budget ${s.cents === null ? SCRIPT_BLANKS.budget : planDollars(s.cents)}, actual ${s.actualCents === null ? SCRIPT_BLANKS.actual : planDollars(s.actualCents)}${delta === null ? '' : `, ${delta}`}.`);
  }
  lines.push(`${s.record !== null && s.record.rating !== null ? s.record.rating : SCRIPT_BLANKS.stars} out of 5.`);
  return lines;
}

/** R5, the step view: that one stop's scene; no covering stay → no script, said by name. WORK-03: an execute stop's done tasks are handed in (`done`), as the card holds them — WORK-03b: null for a block with no length. */
export function stopScriptText(day: string, stay: StayRow | null, stop: Stop, done?: readonly ReelDoneTask[] | null): ReelText {
  if (stay === null) return { ok: false, words: noStayReelWords(day) };
  return { ok: true, text: stopSceneLines(stop, done).join('\n') };
}

/**
 * R5, the full card: the reel's narration in scene order — the hook on the TOTAL
 * row's budget; the greeting with the weekday, the stay's count and place, and
 * every stop by name (and vendor); the journal's list and blocker when read; one
 * scene per stop that shows a budget or an actual, in the table's order; the
 * outro on the TOTAL row and the card's verdict. Until the day is fully recorded
 * (the card shows no verdict) the tally and the verdict are blanks to fill.
 * REEL-02 (2026-10-19): then, when the journal carries a `next`, one last block —
 * "Tomorrow: <next>", the cliffhanger; the outro's own last sentence is unchanged.
 */
export function scriptText(d: ReelDay): ReelText {
  if (d.stay === null) return { ok: false, words: noStayReelWords(d.day) };
  const at = stayAt(d.stay, d.day);
  const budget = d.totals.budgetCents === null ? SCRIPT_BLANKS.budget : planDollars(d.totals.budgetCents);
  const weekday = WEEKDAY_NAMES[new Date(`${d.day}T00:00:00.000Z`).getUTCDay()];
  const blocks: string[][] = [[`Budget today: ${budget}. ${HOOK_WORDS} ${SCRIPT_HOOK_TAIL_WORDS}`]];
  const greeting = `Happy ${weekday} everyone, welcome to day ${at.n} of ${at.of}, here in ${d.stay.place}.`;
  blocks.push([d.stops.length === 0 ? greeting : `${greeting} Today: ${d.stops.map(atVendor).join(', ')}.`]);
  if (d.journal !== null) {
    const journal = [...(d.journal.goals.length > 0 ? [`Today’s list: ${d.journal.goals.join(', ')}.`] : []), ...(d.journal.blocker !== null ? [`Blocker: ${d.journal.blocker}.`] : [])];
    if (journal.length > 0) blocks.push(journal);
  }
  // WORK-03: an execute stop gets a scene when it shows money OR has at least one task done in its block; every other stop as before.
  for (const s of d.stops) {
    const done = reelDoneOf(d, s);
    if (s.cents !== null || s.actualCents !== null || (done !== null && done.length > 0)) blocks.push(stopSceneLines(s, done));
  }
  const tally = d.verdict === null ? SCRIPT_BLANKS.actual : planDollars(d.totals.actualCents);
  blocks.push([`Final tally: ${tally} out of ${budget}. ${d.verdict === null ? SCRIPT_BLANKS.verdict : d.verdict.text}. Day ${at.n} of ${at.of}, done.`]);
  if (d.journal !== null && d.journal.next !== null) blocks.push([tomorrowWords(d.journal.next)]);
  return { ok: true, text: blocks.map((lines) => lines.join('\n')).join('\n\n') };
}

// ── TASKS-ONE-01 (2026-10-14): WHERE THE CARD LIVES — THE FIRST SECTION OF /tasks ──
// TIME-01 (Alex, 2026-10-19): THE FIRST SECTION OF /time. The day card is the narration of the
// day — it moved to Time with the ledger; Tasks keeps the work (projects, routines). Every URL
// the card pushes derives from this one constant, so the move is this line; /tasks/day's hop
// follows it, and a dated /tasks?date= is sent here by next.config.ts (the same query).
// HOME-01 (Alex, 2026-10-24): THE CARD IS ON THE DASHBOARD — the cockpit's Runway panel, /runway
// (home/ModuleLauncher.tsx, the default tab; the front door '/' shows the same panel). The card stays
// Time's component (the registry's Time row says so); /time is the three tables. The move is this line
// again: hrefFor, the move control's reload and /tasks/day's hop follow it, and next.config.ts sends a
// dated /tasks?date|step= and /time?date|step= here with the same query (307).
// HOME-03 (Alex, 2026-10-27): THE CARD IS ON THE HOME PAGE — /home, the rail's HOME (answers/AnswersClient.tsx: THE
// ANSWERS, then the card, then THE SHEET; a signed-in `/` lands there). The card stays Time's component; the cockpit's
// Runway panel, /runway, is the runway pipe's again. The move is this line once more: hrefFor, the move control's reload
// and /tasks/day's hop follow it, and next.config.ts sends a dated /runway, /tasks or /time ?date|step= here (307).

/** The card's page — the home page, /home (Alex, 2026-10-27, HOME-03; the cockpit's Runway panel, /runway, from HOME-01, 2026-10-24; the first section of Time's one page from TIME-01, 2026-10-19; Tasks' from TASKS-ONE-01). Every URL the card pushes, the move control's reload, and /tasks/day's one hop start here. */
export const DAY_CARD_PATH = '/home';

/** The card's two query parameters (DayCard.tsx reads `date` and `step`, and nothing else on the card's page reads one) — the only ones /tasks/day carries over. */
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
