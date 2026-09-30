/**
 * weekPlan — the week's rules, pure (WEEK-01, 2026-09-30).
 *
 * The seven days of a week come from the budget model's ONE Monday rule
 * (src/lib/budget/report.ts viewRange); the rows are the active routines in the
 * order they start; each of the budget report's plan lines sits in its row and
 * its day by its address kind; a cell may be marked done on today or an earlier
 * day, on the statuses Today lets you complete. No fetch, no clock, no React —
 * the tests drive every rule with fixtures.
 */
import { viewRange } from '@/lib/budget/report';
import type { PlanLine } from '@/lib/budget/planLines';
import type { TodayStatus } from '../routines/types';

export type WeekDay = string;

const DAY_MS = 24 * 60 * 60 * 1000;
const addDays = (day: WeekDay, n: number): WeekDay => new Date(Date.parse(`${day}T00:00:00.000Z`) + n * DAY_MS).toISOString().slice(0, 10);

/** Monday to Sunday of the week holding `weekOf` — the model's range, day by day. */
export function weekDays(weekOf: WeekDay): WeekDay[] {
  const { rangeFrom, rangeTo } = viewRange({ kind: 'week', weekOf });
  const days = Array.from({ length: 7 }, (_, i) => addDays(rangeFrom, i));
  if (days[6] !== rangeTo) throw new Error(`weekPlan: the week of ${weekOf} runs ${rangeFrom} to ${rangeTo}, not seven days`);
  return days;
}

/** The Monday `weeks` weeks from the week holding `weekOf` (‹ is −1, › is +1). */
export function shiftWeek(weekOf: WeekDay, weeks: number): WeekDay {
  return viewRange({ kind: 'week', weekOf: addDays(viewRange({ kind: 'week', weekOf }).rangeFrom, weeks * 7) }).rangeFrom;
}

export const WEEKDAY_WORDS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/** A row's routine, as the routines GET returns it (the fields the week reads). */
export interface WeekRoutine {
  readonly id: string;
  readonly name: string;
  /** '1970-01-01THH:MM:SS.000Z' (@db.Time), or null. */
  readonly start_time: string | null;
  readonly steps: readonly { readonly id: string }[];
}

/** The rows: by start time, then name; a routine with no start time last. */
export function orderRoutines<R extends WeekRoutine>(routines: readonly R[]): R[] {
  return [...routines].sort((a, b) => {
    if (a.start_time === null && b.start_time !== null) return 1;
    if (a.start_time !== null && b.start_time === null) return -1;
    if (a.start_time !== null && b.start_time !== null) {
      const at = a.start_time.slice(11, 16);
      const bt = b.start_time.slice(11, 16);
      if (at !== bt) return at < bt ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

/** 'HH:MM' of a @db.Time value. */
export const clockOf = (time: string): string => time.slice(11, 16);

/** "07:00–09:00" · "from 07:00" · "until 09:00" · null when the routine states no window. */
export function timeWindow(start: string | null, end: string | null): string | null {
  if (start !== null && end !== null) return `${clockOf(start)}–${clockOf(end)}`;
  if (start !== null) return `from ${clockOf(start)}`;
  if (end !== null) return `until ${clockOf(end)}`;
  return null;
}

/** Where the report's plan lines sit: a routine's row on a day, the Tasks row on a day, or — named — no row. */
export interface PlacedLines {
  /** `${routineId}|${day}` → its lines. */
  readonly routineCells: ReadonlyMap<string, readonly PlanLine[]>;
  /** day → the task lines. */
  readonly taskCells: ReadonlyMap<WeekDay, readonly PlanLine[]>;
  /** A routine line whose routine is not among the rows — named above the grid, never dropped. */
  readonly withoutRow: readonly PlanLine[];
}

export const cellKey = (routineId: string, day: WeekDay): string => `${routineId}|${day}`;

/**
 * Each plan line by its address kind (days.ts OccurrenceKind): 'routine' → that
 * routine's row; 'routine_line' → the routine that holds the step; 'project_task'
 * → the Tasks row. Its day is the line's own (the routine's local day).
 */
export function placeLines(lines: readonly PlanLine[], routines: readonly WeekRoutine[]): PlacedLines {
  const rowIds = new Set(routines.map((r) => r.id));
  const routineOfStep = new Map<string, string>();
  for (const r of routines) for (const s of r.steps) routineOfStep.set(s.id, r.id);
  const routineCells = new Map<string, PlanLine[]>();
  const taskCells = new Map<WeekDay, PlanLine[]>();
  const withoutRow: PlanLine[] = [];
  const push = <K>(map: Map<K, PlanLine[]>, key: K, line: PlanLine) => {
    const list = map.get(key);
    if (list === undefined) map.set(key, [line]);
    else list.push(line);
  };
  for (const line of lines) {
    const { kind, id } = line.address;
    if (kind === 'project_task') { push(taskCells, line.day, line); continue; }
    const routineId = kind === 'routine' ? (rowIds.has(id) ? id : null) : (routineOfStep.get(id) ?? null);
    if (routineId === null) { withoutRow.push(line); continue; }
    push(routineCells, cellKey(routineId, line.day), line);
  }
  return { routineCells, taskCells, withoutRow };
}

/** The statuses Today lets you complete (TodaysStrip.tsx canComplete — pending, upcoming, missed). */
export const COMPLETABLE: readonly TodayStatus[] = ['pending', 'upcoming', 'missed'];

/** A cell offers "✓ done" on today or an earlier day, on a status Today lets you complete — never on a later day. */
export function offersDone(status: TodayStatus, day: WeekDay, today: WeekDay): boolean {
  return day <= today && COMPLETABLE.includes(status);
}
