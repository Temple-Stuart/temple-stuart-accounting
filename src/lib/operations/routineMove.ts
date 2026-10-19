/**
 * routineMove — "I'M MOVING": THE DATED MOVE, PURE (MOVE-01, Alex, 2026-10-19).
 *
 * He changes cities every two weeks. From a first day there, every current
 * routine ends the day before and — when carried over — runs on as a copy in
 * the new zone, at the row's own start and end time; a routine that starts on
 * or after that day is re-zoned instead (it has no history before it).
 * History stays in the old zone (the old routine's zone never changes, so
 * ROUTINE-02b's rekey moves nothing); the future runs in the new one.
 *
 * This file decides WHAT the move is and refuses it by name; it writes
 * nothing. The control (stops/MoveControl.tsx) shows its words before
 * anything is written and the route (routines/move/route.ts) writes exactly
 * its plan in ONE transaction — no drift: what the form says is what fires.
 *
 * THE RULES
 *   · the date is a 'YYYY-MM-DD' day, today or later in the new zone (a past
 *     date would split history, Alex 3 yes); the zone is one of Intl's names
 *     (ROUTINE-02a canonicalZone); neither is defaulted here or in the route.
 *   · CURRENT = active, end_date null or on/after the date. Every current
 *     routine has exactly one entry — the list IS the control (Alex 9 yes);
 *     an entry naming anything else is refused.
 *   · ENDS: a current routine whose start is before the date ends at date−1
 *     and is renamed "<name> (to <date−1>)": the routines table holds one
 *     name per user (@@unique([user_id, name])), so the copy keeps the bare
 *     name and the ended one carries its end in its name (Alex 1 yes).
 *   · COPIES: a carried routine's copy — the same rule with the row's clock
 *     (withClock, B1), start_date = the date, end_date = the old end when on
 *     or after the date, the row's start and end time. The window may cross
 *     midnight: an end before the start ends the next day (Alex 2 yes); an
 *     end equal to the start is an empty window, refused. Its first day is
 *     the first occurrence on/after the date in the new zone; none before
 *     its end refuses — nothing to copy.
 *   · RE-ZONED: a current routine that starts on/after the date, a one-off
 *     included — the zone alone changes; its clock stays.
 *   · THE STAY (optional): a place with its last day (stayInput, the one
 *     rule); the stay covering date−1 is shortened to date−1 when it runs
 *     later; any other stay meeting [date, last day] refuses the whole move
 *     (STAY-01's meeting()).
 *   · THE WORDS: "n routines end …; k copies start … in …; m re-zoned; …".
 *
 * Project tasks carry no zone (operations_project_tasks has no such column);
 * the form says so in one line (TASKS_WORDS) and lists none.
 */

import type { CadenceGroup } from '@/components/workbench/operations/routines/types';
import { isIsoDay } from '@/lib/budget/days';
import { shiftDay } from '@/lib/budget/reportView';
import { instantToZoned, zonedToInstant } from '@/lib/time';
import {
  EMPTY_WINDOW_WORDS, END_TIME_REQUIRED_WORDS, START_TIME_REQUIRED_WORDS,
  canonicalZone, classifyCadence, clockOfRule, clockOfTime, clockWords, endDayOf, expandForward, isOnceRRule, scheduleAnchor, withClock, zoneNotListedWords,
  type Clock,
} from './rruleHelpers';
import { coveringStay, meeting, overlapWords, stayInput, type StayRow } from './stay';

/** What the plan reads of a routine — the list's row (JSON) or the route's row (Prisma). */
export interface MoveRoutine {
  readonly id: string;
  readonly name: string;
  readonly schedule_rrule: string;
  readonly timezone: string;
  readonly start_date: Date | string | null;
  readonly end_date: Date | string | null;
  readonly start_time: Date | string | null;
  readonly end_time: Date | string | null;
  readonly is_active: boolean;
}

/** One row of the control, as sent: carry it, and the copy's window. */
export interface MoveEntry {
  readonly id: string;
  readonly carry: boolean;
  readonly start_time: string;
  readonly end_time: string;
}

export interface MoveInput {
  /** The first day there, 'YYYY-MM-DD'. */
  readonly date: string;
  /** The new zone, as sent — one of Intl's names, any case. */
  readonly timezone: string;
  /** The clock the plan judges "today" by — in the NEW zone. */
  readonly now: Date;
  /** The new place and its last day, or null for no stay change. */
  readonly stay: { readonly place: string; readonly ends_on: string } | null;
  readonly routines: readonly MoveRoutine[];
  readonly entries: readonly MoveEntry[];
  readonly stays: readonly StayRow[];
}

export interface MoveCopy {
  readonly from_id: string;
  readonly name: string;
  readonly schedule_rrule: string;
  readonly start_time: string;
  readonly end_time: string;
  readonly start_date: string;
  readonly end_date: string | null;
  /** The first occurrence's local day in the new zone. */
  readonly first_day: string;
  /** The end is before the start: the window ends the next day. */
  readonly overnight: boolean;
}

export interface MoveEnd {
  readonly id: string;
  readonly name: string;
  readonly renamed: string;
  readonly end_date: string;
  readonly timezone: string;
}

export interface MoveRezone {
  readonly id: string;
  readonly name: string;
}

export interface MoveRow {
  readonly id: string;
  readonly name: string;
  readonly cadence: CadenceGroup;
  readonly kind: 'ends' | 'rezoned';
  readonly carry: boolean;
  readonly copy: MoveCopy | null;
}

export interface MoveStayPlan {
  readonly shorten: { readonly id: string; readonly place: string; readonly ends_on: string } | null;
  readonly create: { readonly place: string; readonly starts_on: string; readonly ends_on: string };
}

export type MovePlan =
  | {
      readonly ok: true;
      readonly date: string;
      readonly day_before: string;
      readonly timezone: string;
      readonly today: string;
      readonly rows: readonly MoveRow[];
      readonly ends: readonly MoveEnd[];
      readonly copies: readonly MoveCopy[];
      readonly rezoned: readonly MoveRezone[];
      readonly stay: MoveStayPlan | null;
      readonly words: string;
    }
  | { readonly ok: false; readonly status: 400 | 404 | 409; readonly field: string; readonly message: string };

/** A refusal the route raises inside its transaction — rolled back, answered by name. */
export class MoveRefused extends Error {
  constructor(readonly status: 400 | 404 | 409, readonly field: string, message: string) {
    super(message);
    this.name = 'MoveRefused';
  }
}

export const MOVE_CHIP_WORDS = 'moving';
export const BODY_WORDS = 'the body must be an object with date, timezone, stay and routines';
export const ENTRIES_WORDS = 'routines must be a list of { id, carry, start_time, end_time } — one per current routine';
export const TASKS_WORDS = 'project tasks carry no zone — nothing to move';
export const REZONED_WORDS = 're-zoned, same clock';
export const renamedWords = (name: string, dayBefore: string): string => `${name} (to ${dayBefore})`;
export const dateWords = (date: unknown): string => `first day there ${JSON.stringify(date)} is not a 'YYYY-MM-DD' day`;
export const pastDateWords = (date: string, today: string, zone: string): string =>
  `the first day there, ${date}, is before today (${today} in ${zone}) — history stays where it was; pick today or later`;
export const notListedWords = (name: string): string => `${name} is not in the list — every current routine is`;
export const noSuchRoutineWords = (id: unknown): string => `no current routine ${JSON.stringify(id)}`;
export const twiceWords = (name: string): string => `${name} is listed twice`;
export const noOccurrenceWords = (name: string, date: string, end: string | null): string =>
  `${name}: no occurrence from ${date}${end === null ? '' : ` before its end ${end}`} — nothing to copy`;
export const hasHistoryWords = (name: string): string =>
  `${name} starts on or after the move and already holds records — re-zone it from its own row (its history would move)`;
export const nameTakenWords = (name: string): string => `a routine named ${JSON.stringify(name)} already exists`;
export const arrowWords = (firstDay: string, zone: string): string => `→ ${firstDay} in ${zone}`;

/** A @db.Time (a Date at 1970-01-01, or its JSON) as 'HH:MM'; '' when none. */
export function timeOf(v: Date | string | null | undefined): string {
  if (v === null || v === undefined) return '';
  const iso = v instanceof Date ? v.toISOString() : v;
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(iso) ? iso.slice(11, 16) : /^\d{2}:\d{2}/.test(iso) ? iso.slice(0, 5) : '';
}

/** The row's default entry: carried, at the routine's own clock (the rule's, B1) and end time. */
export function defaultEntry(r: MoveRoutine): MoveEntry {
  const clock = clockOfRule(r.schedule_rrule);
  return { id: r.id, carry: true, start_time: clock === null ? timeOf(r.start_time) : clockWords(clock), end_time: timeOf(r.end_time) };
}

/** CURRENT: active, end_date null or on/after the date. Inactive routines are not the move's. */
export const isCurrent = (r: MoveRoutine, date: string): boolean => {
  if (!r.is_active) return false;
  const end = endDayOf(r.end_date);
  return end === null || end >= date;
};

/** A row of the list: the one judgement of which routines the move touches and how. */
export interface MoveListRow {
  readonly id: string;
  readonly name: string;
  readonly cadence: CadenceGroup;
  /** ends: ends at date−1 (a copy when carried); rezoned: starts on/after the date, or a one-off — the zone alone changes. */
  readonly kind: 'ends' | 'rezoned';
}

/** THE LIST: every current routine, in the order given, each judged once — the control renders this, the plan builds on it (no drift). */
export function listRows(routines: readonly MoveRoutine[], date: string): MoveListRow[] {
  return routines.filter((r) => isCurrent(r, date)).map((r) => {
    const startDay = endDayOf(r.start_date);
    const rezoned = isOnceRRule(r.schedule_rrule) || (startDay !== null && startDay >= date);
    return { id: r.id, name: r.name, cadence: classifyCadence(r.schedule_rrule), kind: rezoned ? 'rezoned' : 'ends' };
  });
}

/** The plan's one-line summary — shown before the write, kept in the audit. */
export function moveWords(p: { readonly ends: readonly unknown[]; readonly copies: readonly unknown[]; readonly rezoned: readonly unknown[]; readonly date: string; readonly day_before: string; readonly timezone: string; readonly stay: MoveStayPlan | null }): string {
  const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
  const stay = p.stay === null
    ? 'no stay change'
    : `stay ${p.stay.create.place} ${p.stay.create.starts_on} → ${p.stay.create.ends_on}${p.stay.shorten === null ? '' : `, ${p.stay.shorten.place} ends ${p.stay.shorten.ends_on}`}`;
  return `${n(p.ends.length, 'routine ends', 'routines end')} ${p.day_before}; ${n(p.copies.length, 'copy starts', 'copies start')} ${p.date} in ${p.timezone}; ${p.rezoned.length} re-zoned; ${stay}`;
}

const minutesOf = (c: Clock): number => c.hour * 60 + c.minute;

/** The copy's first day: the first occurrence on/after the date in the new zone (probed from the day before — expandForward compares floating times), or null. */
function firstDayOf(rrule: string, zone: string, date: string, endDate: string | null): string | null {
  const probe = zonedToInstant(shiftDay(date, -1), '00:00', zone);
  const found = expandForward(rrule, zone, probe, 8, scheduleAnchor(date), endDate).find((d) => instantToZoned(d, zone).date >= date);
  return found === undefined ? null : instantToZoned(found, zone).date;
}

export function planMove(input: MoveInput): MovePlan {
  const refuse = (status: 400 | 404 | 409, field: string, message: string): MovePlan => ({ ok: false, status, field, message });
  if (!isIsoDay(input.date)) return refuse(400, 'date', dateWords(input.date));
  const zone = canonicalZone(input.timezone);
  if (zone === null) return refuse(400, 'timezone', zoneNotListedWords(input.timezone));
  const date = input.date;
  const today = instantToZoned(input.now, zone).date;
  if (date < today) return refuse(400, 'date', pastDateWords(date, today, zone));
  const dayBefore = shiftDay(date, -1);

  // The list IS the control: every current routine once, nothing else.
  const list = listRows(input.routines, date);
  const current = list.map((row) => input.routines.find((r) => r.id === row.id) as MoveRoutine);
  const byId = new Map(current.map((r) => [r.id, r]));
  const seen = new Set<string>();
  const entryOf = new Map<string, MoveEntry>();
  for (let i = 0; i < input.entries.length; i += 1) {
    const e = input.entries[i];
    const r = byId.get(e.id);
    if (r === undefined) return refuse(404, `routines[${i}].id`, noSuchRoutineWords(e.id));
    if (seen.has(e.id)) return refuse(400, `routines[${i}].id`, twiceWords(r.name));
    seen.add(e.id);
    entryOf.set(e.id, e);
  }
  for (const r of current) if (!entryOf.has(r.id)) return refuse(400, 'routines', notListedWords(r.name));

  const rows: MoveRow[] = [];
  const ends: MoveEnd[] = [];
  const copies: MoveCopy[] = [];
  const rezoned: MoveRezone[] = [];
  for (let i = 0; i < current.length; i += 1) {
    const r = current[i];
    const { cadence, kind } = list[i];
    const e = entryOf.get(r.id) as MoveEntry;
    const idx = input.entries.findIndex((x) => x.id === r.id);
    if (kind === 'rezoned') {
      rezoned.push({ id: r.id, name: r.name });
      rows.push({ id: r.id, name: r.name, cadence, kind, carry: false, copy: null });
      continue;
    }
    ends.push({ id: r.id, name: r.name, renamed: renamedWords(r.name, dayBefore), end_date: dayBefore, timezone: r.timezone });
    let copy: MoveCopy | null = null;
    if (e.carry) {
      const start = clockOfTime(e.start_time);
      if (start === null) return refuse(400, `routines[${idx}].start_time`, `${r.name}: ${START_TIME_REQUIRED_WORDS}`);
      const end = clockOfTime(e.end_time);
      if (end === null) return refuse(400, `routines[${idx}].end_time`, `${r.name}: ${END_TIME_REQUIRED_WORDS}`);
      if (minutesOf(start) === minutesOf(end)) return refuse(400, `routines[${idx}].end_time`, `${r.name}: ${EMPTY_WINDOW_WORDS}`);
      const oldEnd = endDayOf(r.end_date);
      const endDate = oldEnd !== null && oldEnd >= date ? oldEnd : null;
      const rrule = withClock(r.schedule_rrule, start);
      const firstDay = firstDayOf(rrule, zone, date, endDate);
      if (firstDay === null) return refuse(400, `routines[${idx}].id`, noOccurrenceWords(r.name, date, endDate));
      copy = { from_id: r.id, name: r.name, schedule_rrule: rrule, start_time: clockWords(start), end_time: clockWords(end), start_date: date, end_date: endDate, first_day: firstDay, overnight: minutesOf(end) < minutesOf(start) };
      copies.push(copy);
    }
    rows.push({ id: r.id, name: r.name, cadence, kind: 'ends', carry: e.carry, copy });
  }

  // The stay: shorten what covers the day before when it runs later; the new span must meet nothing else.
  let stay: MoveStayPlan | null = null;
  if (input.stay !== null) {
    const read = stayInput({ place: input.stay.place, starts_on: date, ends_on: input.stay.ends_on });
    if (!read.ok) return refuse(400, read.field === 'ends_on' ? 'stay.ends_on' : 'stay.place', read.message);
    const covering = coveringStay(input.stays, dayBefore);
    const shorten = covering !== null && covering.ends_on > dayBefore ? { id: covering.id, place: covering.place, ends_on: dayBefore } : null;
    const others = input.stays.map((s) => (shorten !== null && s.id === shorten.id ? { ...s, ends_on: dayBefore } : s));
    const span = { startsOn: date, endsOn: read.value.endsOn };
    const met = meeting(others, span);
    if (met.length > 0) return refuse(409, 'stay', overlapWords(span, met[0]));
    stay = { shorten, create: { place: read.value.place, starts_on: date, ends_on: read.value.endsOn } };
  }

  const words = moveWords({ ends, copies, rezoned, date, day_before: dayBefore, timezone: zone, stay });
  return { ok: true, date, day_before: dayBefore, timezone: zone, today, rows, ends, copies, rezoned, stay, words };
}
