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
 * Pure: no fetch, no clock, no React, no Prisma (as week/weekPlan.ts) — the
 * tests drive every rule with fixtures. Every sentence the card prints from
 * here is an exported constant or a function returning one, so the tests pin
 * the exact words.
 */
import type { NotPlaced } from '@/lib/budget/days';
import { formatCents } from '@/lib/budget/format';
import type { PlanLine } from '@/lib/budget/planLines';
import { instantToZoned } from '@/lib/time';
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
}

// ── OUTPUT ──────────────────────────────────────────────────────────────────

export type StopKind = 'line' | 'routine' | 'task';
export type StopStatus = 'done' | 'missed' | 'open' | 'later';

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
  /** The day's lines no stop carries. */
  readonly linesWithoutStop: readonly PlanLine[];
  /** The report's not-placed entries for the day, and every undated one. */
  readonly notPlacedToday: readonly NotPlaced[];
}

export interface Focus {
  /** 1-based. */
  readonly index: number;
  readonly of: number;
  readonly stop: Stop;
  /** The sum of the priced stops 1..index. */
  readonly soFarCents: number;
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

/** The day's stops, their amounts from the Budget's lines, and everything the card must name. */
export function dayStops(input: DayCardInput): DayStops {
  const dayLines = input.lines.filter((l) => l.day === input.day);
  const used = new Set<PlanLine>();
  const unmatched: UnmatchedLine[] = [];
  const timed: Stop[] = [];
  const untimed: Stop[] = [];
  const push = (stop: Stop) => (stop.time === null ? untimed : timed).push(stop);

  for (const entry of input.entries) {
    const r = entry.routine;
    const status = STATUS[entry.status];
    const occurrenceTime = instantToZoned(new Date(entry.expected_at), r.timezone).time;
    if (r.steps.length === 0) {
      const line = matchLine(dayLines.filter((l) => l.address.kind === 'routine' && l.address.id === r.id), entry.expected_at, r.name, null, used, unmatched);
      push({
        kind: 'routine',
        key: `routine:${r.id}:${entry.expected_at}`,
        time: occurrenceTime,
        label: r.name,
        line: null,
        place: placeOf(line, r.location),
        minutes: null,
        cents: line === null ? null : line.cents,
        status,
      });
      continue;
    }
    for (const step of [...r.steps].sort((a, b) => a.step_order - b.step_order)) {
      const line = matchLine(dayLines.filter((l) => l.address.kind === 'routine_line' && l.address.id === step.id), entry.expected_at, r.name, step.activity, used, unmatched);
      push({
        kind: 'line',
        key: `line:${step.id}:${entry.expected_at}`,
        time: step.time_of_day === null ? occurrenceTime : clockOf(step.time_of_day),
        label: r.name,
        line: step.activity,
        place: placeOf(line, step.location, r.location),
        minutes: step.duration_minutes,
        cents: line === null ? null : line.cents,
        status,
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
    });
  }

  // Clock order: time, then label, then line; stops with no time last, as they arrived (routines, then items).
  timed.sort((a, b) => cmp(a.time as string, b.time as string) || cmp(a.label, b.label) || cmpMaybe(a.line, b.line));
  const stops = [...timed, ...untimed];

  return {
    stops,
    plannedCents: dayLines.reduce((sum, l) => sum + l.cents, 0),
    notPriced: stops.filter((s) => s.cents === null).length,
    unmatched,
    linesWithoutStop: dayLines.filter((l) => !used.has(l)),
    notPlacedToday: input.notPlaced.filter((n) => n.day === null || n.day === input.day),
  };
}

/** Stop n of N (1-based) and the sum of the priced stops up to it; null for an n outside 1..N — never clamped. */
export function focusStop(result: DayStops, n: number): Focus | null {
  if (!Number.isInteger(n) || n < 1 || n > result.stops.length) return null;
  const priced = result.stops.slice(0, n).map((s) => s.cents).filter((c): c is number => c !== null);
  const soFarCents = priced.reduce((sum, c) => sum + c, 0);
  return { index: n, of: result.stops.length, stop: result.stops[n - 1], soFarCents };
}

// ── WORDS ───────────────────────────────────────────────────────────────────

const WEEKDAY_WORDS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTH_WORDS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** "Sat Oct 11 2026" from the day string, by its UTC parts — never the browser's zone. */
export function dayWords(day: string): string {
  const d = new Date(`${day}T00:00:00.000Z`);
  return `${WEEKDAY_WORDS[d.getUTCDay()]} ${MONTH_WORDS[d.getUTCMonth()]} ${d.getUTCDate()} ${d.getUTCFullYear()}`;
}

export const TODAY_WORD = 'today';
export const TASK_WORD = 'task';
export const BRAND_WORDS = 'TEMPLE STUART';
export const UNTITLED_WORDS = 'untitled item';

export const stopsWords = (n: number): string => (n === 1 ? '1 stop' : `${n} stops`);
export const notPricedWords = (k: number): string => `${k} not priced`;
export const ofWords = (n: number, of: number): string => `${n} of ${of}`;
/** "so far $14.00 of $50.00" — both '—' while the report cannot be read (null), never $0.00 for an unknown figure. */
export const soFarWords = (soFarCents: number | null, plannedCents: number | null): string => `so far ${formatCents(soFarCents)} of ${formatCents(plannedCents)}`;
export const provenanceWords = (day: string, asOf: string): string => `amounts: the Budget's plan lines for ${day} · as of ${asOf}`;
export const badDateWords = (raw: string): string => `?date=${raw} is not a day (YYYY-MM-DD) — showing today`;
export const badStepWords = (raw: string | number, of: number): string => `?step=${raw} is not one of this day's ${of} stops — showing the whole card`;

const lineName = (label: string, line: string | null): string => (line === null ? label : `${label} — ${line}`);

export const unmatchedWords = (list: readonly UnmatchedLine[]): string => {
  const head = list.length === 1 ? '1 plan line does not match its stop' : `${list.length} plan lines do not match their stops`;
  return `${head} — ${list.map((u) => (
    u.reason === 'instant differs'
      ? `${lineName(u.label, u.line)} ${formatCents(u.cents)}: the line is at ${u.lineInstant ?? 'no instant'}, the stop at ${u.stopInstant ?? 'no instant'} (instant differs)`
      : `${lineName(u.label, u.line)} ${formatCents(u.cents)}: two plan lines for one stop`
  )).join(' · ')}`;
};

export const linesWithoutStopWords = (list: readonly PlanLine[]): string => {
  const head = list.length === 1 ? '1 plan line has no stop today' : `${list.length} plan lines have no stop today`;
  return `${head} — ${list.map((l) => `${lineName(l.label, l.line)} ${formatCents(l.cents)}${l.time !== null ? ` at ${l.time}` : ''}`).join(' · ')}`;
};

export const notPlacedWords = (list: readonly NotPlaced[]): string => {
  const head = list.length === 1 ? '1 plan not placed' : `${list.length} plans not placed`;
  return `${head} — ${list.map((n) => `${n.label}: ${n.reason}${n.detail !== null ? ` (${n.detail})` : ''}${n.day === null ? ', undated' : ''}`).join(' · ')}`;
};
