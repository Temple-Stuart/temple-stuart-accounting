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
 *   · The place is the matched line's vendor (the day's vendor, VENDOR-01),
 *     else the line's location, else the routine's — never invented.
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
 * Pure: no fetch, no clock, no React, no Prisma (as week/weekPlan.ts) — the
 * tests drive every rule with fixtures. Every sentence the card prints from
 * here is an exported constant or a function returning one, so the tests pin
 * the exact words.
 */
import { centsFromDecimalString, type NotPlaced } from '@/lib/budget/days';
import { formatCents } from '@/lib/budget/format';
import type { PlanLine, StrandedVendor } from '@/lib/budget/planLines';
import { NO_STAY_WORDS, STAY_NOT_READ_WORDS, stayDay, stayDayWords, type StayRow } from '@/lib/operations/stay';
import {
  DONE_WORD, LATER_WORD, NOT_RECORDED_WORDS, OPEN_WORD, ROUTINE_DONE_WORDS, ROUTINE_MISSED_WORDS, SKIPPED_WORD, TASK_DONE_WORDS, TASK_OPEN_WORDS, doneWords, lateWords, recordKey, skippedWords,
  type StopRecordKind, type StopRecordRow,
} from '@/lib/operations/stopRecord';
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
  /** The matched line's vendor, else the line's location, else the routine's; null when none. */
  readonly place: string | null;
  readonly minutes: number | null;
  /** The matched plan line's cents; null when the report lists none for this stop. */
  readonly cents: number | null;
  readonly status: StopStatus;
  readonly statusSource: StatusSource;
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
}

// ── THE RULES ───────────────────────────────────────────────────────────────

const STATUS: Record<TodayStatus, StopStatus> = { completed: 'done', missed: 'missed', pending: 'open', upcoming: 'later' };

/** 'HH:MM' of a @db.Time value ('1970-01-01THH:MM:SS.000Z'), as the week's clockOf. */
const clockOf = (time: string): string => time.slice(11, 16);

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
/** null sorts last. */
const cmpMaybe = (a: string | null, b: string | null): number => (a === b ? 0 : a === null ? 1 : b === null ? -1 : cmp(a, b));

/** A stored place, or null — a blank is no place, not a place called "". */
const placeText = (text: string | null | undefined): string | null => (typeof text === 'string' && text.trim() !== '' ? text : null);

/** The stop's place: the matched line's vendor, else the first stated location in the order given. */
const placeOf = (line: PlanLine | null, ...locations: readonly (string | null | undefined)[]): string | null => {
  if (line !== null && line.vendor !== null) return line.vendor.name;
  for (const l of locations) {
    const p = placeText(l);
    if (p !== null) return p;
  }
  return null;
};

/** Of the day's lines, those at this kind and id; the exact instant decides the match. */
function matchLine(
  candidates: readonly PlanLine[],
  stopInstant: string | null,
  label: string,
  line: string | null,
  used: Set<PlanLine>,
  unmatched: UnmatchedLine[],
): PlanLine | null {
  const exact = candidates.filter((l) => l.address.instant === stopInstant);
  for (const l of candidates) {
    if (l.address.instant !== stopInstant) {
      used.add(l);
      unmatched.push({ label, line, cents: l.cents, lineInstant: l.address.instant, stopInstant, reason: 'instant differs' });
    }
  }
  if (exact.length === 1) {
    used.add(exact[0]);
    return exact[0];
  }
  if (exact.length > 1) {
    for (const l of exact) {
      used.add(l);
      unmatched.push({ label, line, cents: l.cents, lineInstant: l.address.instant, stopInstant, reason: 'two plan lines for one stop' });
    }
  }
  return null;
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
    lateMinutes: done === null ? null : Math.round((done.getTime() - plannedInstant.getTime()) / 60_000),
    actualMinutes: record.actual_minutes,
  };
}

/** The day's stops, their amounts from the Budget's lines, and everything the card must name. */
export function dayStops(input: DayCardInput): DayStops {
  const dayLines = input.lines.filter((l) => l.day === input.day);
  const used = new Set<PlanLine>();
  const unmatched: UnmatchedLine[] = [];
  const timed: Stop[] = [];
  const untimed: Stop[] = [];
  const push = (stop: Stop) => (stop.time === null ? untimed : timed).push(stop);
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
    if (r.steps.length === 0) {
      const key = `routine:${r.id}:${entry.expected_at}`;
      const line = matchLine(dayLines.filter((l) => l.address.kind === 'routine' && l.address.id === r.id), entry.expected_at, r.name, null, used, unmatched);
      push({
        kind: 'routine',
        key,
        time: occurrenceTime,
        label: r.name,
        line: null,
        place: placeOf(line, r.location),
        minutes: null,
        cents: line === null ? null : line.cents,
        address: { kind: 'routine', id: r.id, instant: entry.expected_at },
        zone: r.timezone,
        ...recorded(recordAt(key), status, r.timezone, input.day, occurrence),
      });
      continue;
    }
    for (const step of [...r.steps].sort((a, b) => a.step_order - b.step_order)) {
      const key = `line:${step.id}:${entry.expected_at}`;
      const line = matchLine(dayLines.filter((l) => l.address.kind === 'routine_line' && l.address.id === step.id), entry.expected_at, r.name, step.activity, used, unmatched);
      const time = step.time_of_day === null ? occurrenceTime : clockOf(step.time_of_day);
      // The planned instant: the line's own time of day on the card's day in the routine's zone, else the occurrence.
      const planned = step.time_of_day === null ? occurrence : zonedToInstant(input.day, time, r.timezone);
      push({
        kind: 'line',
        key,
        time,
        label: r.name,
        line: step.activity,
        place: placeOf(line, step.location, r.location),
        minutes: step.duration_minutes,
        cents: line === null ? null : line.cents,
        address: { kind: 'routine_line', id: step.id, instant: entry.expected_at },
        zone: r.timezone,
        ...recorded(recordAt(key), status, r.timezone, input.day, planned),
      });
    }
  }

  for (const item of input.items) {
    // The task's title, else the item's own; an item with neither is named as such — never a blank row.
    const label = item.task !== null ? item.task.title : item.ad_hoc_title !== null ? item.ad_hoc_title : UNTITLED_WORDS;
    const block = item.calendar_blocks.find((b) => b.status !== 'cancelled');
    const line = item.task_id === null
      ? null
      : matchLine(dayLines.filter((l) => l.address.kind === 'project_task' && l.address.id === item.task_id), null, label, null, used, unmatched);
    // A task's record is the task: its status, its own actual and minutes (one fact, one home).
    const actualCents = item.task === null ? null : taskCents(item.task.actual_cost_usd, `task ${item.task.id} actual_cost_usd`);
    push({
      kind: 'task',
      key: `task:${item.id}`,
      time: block === undefined ? null : instantToZoned(new Date(block.scheduled_start), input.viewerZone).time,
      label,
      line: null,
      place: null,
      minutes: null,
      cents: line === null ? null : line.cents,
      status: item.task !== null && item.task.status === 'completed' ? 'done' : 'open',
      statusSource: 'task',
      address: null,
      zone: null,
      record: null,
      actualCents,
      actualSource: actualCents === null ? null : 'task',
      doneAt: null,
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
  return {
    stops,
    plannedCents: dayLines.reduce((sum, l) => sum + l.cents, 0),
    notPriced: stops.filter((s) => s.cents === null).length,
    unmatched,
    routineFigures: unused.filter(isRoutineFigure),
    linesWithoutStop: unused.filter((l) => !isRoutineFigure(l)),
    notPlacedToday: input.notPlaced.filter((n) => n.day === null || n.day === input.day),
    // The sum of the actuals that exist — the stops without one are COUNTED beside it (withoutActual), never summed as zero.
    spentCents: read ? stops.map((s) => s.actualCents).filter((c): c is number => c !== null).reduce((sum, c) => sum + c, 0) : null,
    withoutActual: read ? stops.filter((s) => s.actualCents === null).length : 0,
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
  };
}

// ── WORDS ───────────────────────────────────────────────────────────────────

const WEEKDAY_WORDS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTH_WORDS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export const TODAY_WORD = 'today';
export const TASK_WORD = 'task';
export const BRAND_WORDS = 'TEMPLE STUART';
export const UNTITLED_WORDS = 'untitled item';

export const stopsWords = (n: number): string => (n === 1 ? '1 stop' : `${n} stops`);
export const notPricedWords = (k: number): string => `${k} not priced`;
/** "so far $14.00 of $50.00" — both '—' while the report cannot be read (null), never $0.00 for an unknown figure. */
export const soFarWords = (soFarCents: number | null, plannedCents: number | null): string => `so far ${planDollars(soFarCents)} of ${planDollars(plannedCents)}`;
/** The plate's source line — the day itself is in the hook line above it; what could not be read says so (STOP-01: the records are a source too). */
export const provenanceWords = (asOf: string, reportRead: boolean, recordsRead: boolean): string =>
  `Budget plan lines${reportRead ? '' : ' NOT READ'} · stop records${recordsRead ? '' : ' NOT READ'} · as of ${asOf}`;

// ── STOP-01: THE RECORD'S WORDS ON THE CARD ──────────────────────────────────

export const ACTUAL_WORD = 'ACTUAL';
export const SPENT_WORD = 'spent';
export const RECORDS_NOT_READ_WORDS = 'records not read';
export const ON_PLAN_WORDS = 'on plan';

/** "2 without an amount" — the stops a sum of actuals does not cover; printed beside every such sum. */
export const withoutAmountWords = (n: number): string => `${n} without an amount`;

/** "spent $14 · 2 without an amount" · "spent $14" · "spent — · records not read" (null: the records were not read). */
export function spentWords(spentCents: number | null, withoutActual: number): string {
  if (spentCents === null) return `${SPENT_WORD} — · ${RECORDS_NOT_READ_WORDS}`;
  return withoutActual > 0 ? `${SPENT_WORD} ${planDollars(spentCents)} · ${withoutAmountWords(withoutActual)}` : `${SPENT_WORD} ${planDollars(spentCents)}`;
}

/** "spent so far $14 · 2 without an amount" — the step card's running actual. */
export const spentSoFarWords = (spentCents: number | null, withoutActual: number): string => spentWords(spentCents, withoutActual).replace(/^spent/, 'spent so far');

/** The plate's line under the hook: "spent $14 · 2 without an amount · 3 of 7 done" — the done count only when the stops were read. */
export const spentLineWords = (spentCents: number | null, withoutActual: number, done: number, of: number | null): string =>
  (of === null ? spentWords(spentCents, withoutActual) : `${spentWords(spentCents, withoutActual)} · ${doneOfWords(done, of)}`);

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

/** "3 of 7 done" */
export const doneOfWords = (done: number, of: number): string => `${done} of ${of} ${DONE_WORD}`;
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
  if (stop.statusSource === 'record') {
    if (stop.status === 'skipped') return skippedWords(stop.record !== null && stop.record.note !== null ? stop.record.note : '');
    if (stop.doneAt === null) throw new Error(`dayCard: ${stop.key} is done by its record but has no done-at`);
    const when = stop.doneAt.day === day ? stop.doneAt.time : `${monthDayWords(stop.doneAt.day)} ${stop.doneAt.time}`;
    return stop.lateMinutes === null ? doneWords(when) : `${doneWords(when)} · ${lateWords(stop.lateMinutes)}`;
  }
  if (stop.statusSource === 'task') return stop.status === 'done' ? TASK_DONE_WORDS : TASK_OPEN_WORDS;
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
  return `${head} — ${list.map((r) => `${r.kind} ${r.target_id} at ${r.occurrence_at}: ${r.outcome}${r.actual_cents === null ? '' : `, ${formatCents(r.actual_cents)}`} (the line is archived, or its routine's schedule moved)`).join(' · ')}`;
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

export const HOOK_WORDS = 'under or over?';
export const PLANNED_WORD = 'planned';
export const STOPS_NOT_READ_WORDS = 'stops not read';
export const PLAN_WORD = 'PLAN';
export const BADGE_WORDS = 'TS';

/** "7 stops · under or over?" — the line under the place; the stops are unknown (null) while the day read failed. */
export const hookWords = (stops: number | null): string => `${stops === null ? STOPS_NOT_READ_WORDS : stopsWords(stops)} · ${HOOK_WORDS}`;

/** "4 OF 7 · 12:30" — the step card's header words ('—' for a stop with no time). */
export const stepHeaderWords = (n: number, of: number, time: string | null): string => `${n} OF ${of} · ${time === null ? '—' : time}`;

/** How far along the planned money the day's stops 1..n are, in whole percent, 0–100; null when the plan is unknown or nothing is planned. */
export function progressPercent(soFarCents: number | null, plannedCents: number | null): number | null {
  if (soFarCents === null || plannedCents === null || plannedCents <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((100 * soFarCents) / plannedCents)));
}

/**
 * The plate's completeness line — what the hero's figure does not price or place,
 * counted, in one line; null when every stop is priced and nothing is set aside.
 * The sentences that name each item follow it in the foot.
 */
export function completenessWords(result: DayStops, stranded: number, read: { readonly day: boolean; readonly report: boolean; readonly records: boolean }): string | null {
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
  if (stranded > 0) parts.push(stranded === 1 ? '1 vendor stranded' : `${stranded} vendors stranded`);
  return parts.length === 0 ? null : parts.join(' · ');
}
export const badDateWords = (raw: string): string => `?date=${raw} is not a day (YYYY-MM-DD) — showing today`;
export const badStepWords = (raw: string | number, of: number): string => `?step=${raw} is not one of this day's ${of} stops — showing the whole card`;

const lineName = (label: string, line: string | null): string => (line === null ? label : `${label} — ${line}`);

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

/** The report's stranded vendors on the day, in the week's own words (WeekSection.tsx). */
export const strandedWords = (list: readonly StrandedVendor[]): string => {
  const head = list.length === 1 ? '1 vendor stranded' : `${list.length} vendors stranded`;
  return `${head} — ${list.map((s) => `${s.vendor.name} (${s.label}${s.line !== null ? ` — ${s.line}` : ''}${s.day !== null ? `, ${s.day}` : ''}): ${s.reason}`).join(' · ')}`;
};

export const notPlacedWords = (list: readonly NotPlaced[]): string => {
  const head = list.length === 1 ? '1 plan not placed' : `${list.length} plans not placed`;
  return `${head} — ${list.map((n) => `${n.label}: ${n.reason}${n.detail !== null ? ` (${n.detail})` : ''}${n.day === null ? ', undated' : ''}`).join(' · ')}`;
};
