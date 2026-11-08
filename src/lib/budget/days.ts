/**
 * TAB13-02a — THE DAY RULES, PURE: routines and tasks become dated budget
 * lines, and what cannot be placed is listed.
 *
 * The report model (src/lib/budget/report.ts) takes budget lines that each
 * carry a DAY and integer cents. This file turns two kinds of plan into those
 * lines, by the rules Alex ruled on 2026-09-27. It reads nothing: every plan
 * arrives from the caller as plain data (TAB13-02b maps the rows), and a build
 * law holds it pure (scripts/assert-tool-registry.ts, the budget report purity
 * law — this file is its second root).
 *
 * ROUTINES (R1, R2). An occurrence's day is its LOCAL DATE in the routine's own
 * timezone (src/lib/time.ts instantToZoned) — the day Tab 1 draws it
 * (src/lib/hub/mapOperationsRoutines.ts:132). Occurrences come from the ONE
 * expansion (src/lib/operations/rruleHelpers.ts expandBetween, anchored with
 * scheduleAnchor(start_date), ONEOFF-01) over the floating window
 * [rangeFrom 00:00:00.000, rangeTo 23:59:59.999]; an occurrence is kept when
 * its local day is in [rangeFrom, rangeTo] and on or before end_date. What an
 * occurrence costs is decided by routinePlanned (src/lib/operations/
 * routineLines.ts:111, LINES-01) and never restated here: 'lines' → one line
 * per COSTED line; 'routine' → one line at the routine's amount; 'none' →
 * nothing. A $0 amount is a planned 0; a negative amount is kept.
 *
 * TASKS (R3, ruling 8 as amended). A task's estimate counts ONCE, on the
 * earliest plan_date whose daily-plan item has at least one calendar block that
 * is not cancelled (a missed block counts). plan_date is the day a person
 * declared — a date, no zone. Tab 1 draws a task tile by its block's
 * scheduled_start in the viewer's zone (mapOperationsBlocks.ts:31-37, :62-70),
 * so the two can differ; this report follows plan_date. A task is a plan when a
 * person accepted it (open, in_progress, blocked, completed); pending_review,
 * cancelled, superseded and archived are excluded and COUNTED per status.
 *
 * NOTHING IS SKIPPED (R6, R7). A plan that cannot be read or placed becomes a
 * NotPlaced record — source, id, label, cents, day, reason, detail — and every
 * error while reading ONE plan stays with that plan. Tab 1's silent paths are
 * not copied: its UTC-date fallback on an unrecognised zone
 * (operations-routines/route.ts:47-57, mapOperationsRoutines.ts:95-106) and its
 * skip-with-a-log on a schedule that does not parse (operations-routines/
 * route.ts:169-172). A bad CALL — a malformed range, a malformed end or plan
 * date, a status outside its enum, an amount that is not a decimal at all —
 * throws BudgetDaysError by name: those arrive from database columns the route
 * maps, so a bad one is the route's bug, not a plan's.
 *
 * MONEY IS EXACT (R5). A Decimal string becomes integer cents by string
 * arithmetic; a dollar number from routinePlanned becomes cents only when it is
 * whole cents to within 1e-6. Anything else is NotPlaced 'amount not whole cents'.
 *
 * CODES (R4; TAB13-02d, ruled 2026-09-27 — one truth, one rule). A code is read
 * by the chart's OWN rule, src/lib/coa/scheme.ts parseCode, with the plan's own
 * entity type: whatever the chart accepts, this accepts; whatever it refuses is
 * 'account code not recognised', in the chart's own words. The one budget fact
 * added: a plan with no code (null, undefined, blank) is 'no account'. Whether
 * the four digits exist in the chart is still the model's job ('not in chart').
 *
 * SUPERSEDE-01b (Alex, 2026-11-08, SUPERSEDE-00 rulings 1, 3, 5; ruling C). Budget
 * stops counting the routine occurrences travel supersedes. ONE expansion
 * (routineOccurrencesOf — the zone, the start date, the schedule, as the loop
 * above ran them inline) serves buildRoutineBudgetLines, unchanged in what it
 * builds, and routineSupersessionOf: for EVERY routine (costed or not) and EVERY
 * occurrence in the range, the occurrence WINDOWS exactly as the day card builds
 * them (dayCard.ts dayStops — a stepless routine's window at the occurrence with
 * its clocks' length; a lined routine's one window per ACTIVE line, at the line's
 * own time of day on the occurrence's local day in the routine's zone, with the
 * line's duration), each keyed by occurrenceKey and told whether a stop record is
 * at it (stopRecord.ts recordKey — the ONE key builder, so a record wins in one
 * place: the leaf's supersessionOf skips it). Then the ONE rule, supersession.ts
 * supersessionOf, marks them — never a second rule here. A lined routine's own
 * figure (planned.from === 'routine' with active lines) is keyed
 * routine:<r>:routine:<instant> while its windows are its LINES' — as on the card,
 * where the figure sits on no stop and is never struck — so that line is never
 * marked here; its lines' marks ride in the list, and the report counts those
 * figures (routineFiguresUnmarked). A later ruling may change it — never silently.
 */
import type { BudgetLine, IsoDay } from '@/lib/budget/report';
import { routinePlanned } from '@/lib/operations/routineLines';
import { expandBetween, scheduleAnchor } from '@/lib/operations/rruleHelpers';
import { instantToZoned, zonedToInstant } from '@/lib/time';
import { parseCode } from '@/lib/coa/scheme';
import { ValidationError } from '@/lib/errors/ValidationError';
// SUPERSEDE-01b: the one key of a stop record (pure — no imports) and the one supersession rule (pure — its one import is the calendar's minutesOf).
import { recordKey } from '@/lib/operations/stopRecord';
import { plannedMinutesOf, supersessionOf, type OccurrenceWindow, type Supersession, type TravelBlock } from '@/lib/operations/supersession';

// ── NOT PLACED ──────────────────────────────────────────────────────────────

/** Why a plan's money could not be placed on a day and an account. Closed. */
export type NotPlacedReason =
  | 'no account'
  | 'account code not recognised'
  | 'amount not whole cents'
  | 'schedule does not parse'
  | 'start date not recognised'
  | 'timezone not recognised'
  | 'not on the calendar';

export const NOT_PLACED_REASONS: readonly NotPlacedReason[] = [
  'no account', 'account code not recognised', 'amount not whole cents',
  'schedule does not parse', 'start date not recognised', 'timezone not recognised', 'not on the calendar',
];

/** A plan (or one occurrence of one) whose money is not on any budget line. Listed, never dropped. */
export interface NotPlaced {
  readonly source: 'routine' | 'task';
  /** Same scheme as a budget line's sourceId; `routine:<id>` when the whole routine could not be read. */
  readonly sourceId: string;
  readonly entityId: string;
  /** The routine's name or the task's title. */
  readonly label: string;
  /** Integer cents, or null only when truly unknown (a routine that could not be expanded, an amount that is not whole cents). */
  readonly cents: number | null;
  /** The day, or null when undated. An undated entry belongs in every view. */
  readonly day: IsoDay | null;
  readonly reason: NotPlacedReason;
  /** The raw code, the zone, the parser message — whatever explains the reason. */
  readonly detail: string | null;
}

// ── THE OCCURRENCE KEY (TAB13-04) ───────────────────────────────────────────

/**
 * TAB13-04 — ONE FORMAT. A budget line's sourceId (and a not-placed entry's) is
 * the key of the occurrence it came from. It is written, and read back, HERE —
 * VENDOR-01's rule asks this file rather than rebuilding the string:
 *   routine:<routine>:line:<step>:<instant>   a line of a routine whose figure is its lines
 *   routine:<routine>:routine:<instant>       a routine whose own figure is in force
 *   task:<task>                               a task — it happens once
 *   routine:<routine>                         the whole routine, when /budget cannot read it
 * The instant is Date#toISOString(). A key reads back into the ADDRESS the vendor
 * routes and the link route speak (linkKeys.ts; plan-vendors) — the step's id for
 * a line, the routine's for a stepless routine, the task's for a task.
 */
export type OccurrenceKind = 'routine_line' | 'routine' | 'project_task';

export interface OccurrenceAddress {
  readonly kind: OccurrenceKind;
  /** The step's id for a line, the routine's for a stepless routine, the task's for a task. */
  readonly id: string;
  /** The occurrence's instant; null for a task. */
  readonly instant: Date | null;
}

export type OccurrenceOf =
  | { readonly routineId: string; readonly lineId: string | null; readonly instant: Date }
  | { readonly taskId: string };

/** The one builder of an occurrence's key. */
export function occurrenceKey(of: OccurrenceOf): string {
  if ('taskId' in of) return `task:${of.taskId}`;
  return `routine:${of.routineId}:${of.lineId === null ? 'routine' : `line:${of.lineId}`}:${of.instant.toISOString()}`;
}

/** The whole routine's key — a routine /budget cannot read at all (its zone, its start date, its schedule). */
export const wholeRoutineKey = (routineId: string): string => `routine:${routineId}`;

const LINE_KEY = /^routine:([^:]+):line:([^:]+):(.+)$/;
const ROUTINE_KEY = /^routine:([^:]+):routine:(.+)$/;
const TASK_KEY = /^task:([^:]+)$/;

/** An instant exactly as occurrenceKey writes it, or null. */
function keyInstant(text: string): Date | null {
  const at = new Date(text);
  return !Number.isNaN(at.getTime()) && at.toISOString() === text ? at : null;
}

/** A key → the address it names and the routine it belongs to; null when it is no occurrence's key (a whole routine's included). */
export function readOccurrenceKey(key: string): { readonly address: OccurrenceAddress; readonly routineId: string | null } | null {
  const line = LINE_KEY.exec(key);
  if (line) {
    const instant = keyInstant(line[3]);
    return instant === null ? null : { address: { kind: 'routine_line', id: line[2], instant }, routineId: line[1] };
  }
  const routine = ROUTINE_KEY.exec(key);
  if (routine) {
    const instant = keyInstant(routine[2]);
    return instant === null ? null : { address: { kind: 'routine', id: routine[1], instant }, routineId: routine[1] };
  }
  const task = TASK_KEY.exec(key);
  if (task) return { address: { kind: 'project_task', id: task[1], instant: null }, routineId: null };
  return null;
}

/** A call the caller got wrong — refused by name, never coerced. */
export type BudgetDaysErrorCode = 'bad-range' | 'bad-end-date' | 'bad-plan-date' | 'bad-task-status' | 'bad-block-status' | 'bad-amount';

export class BudgetDaysError extends Error {
  readonly code: BudgetDaysErrorCode;
  constructor(code: BudgetDaysErrorCode, message: string) {
    super(`BUDGET DAYS: ${message}`);
    this.name = 'BudgetDaysError';
    this.code = code;
  }
}

// ── DAYS ────────────────────────────────────────────────────────────────────

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A real calendar day written 'YYYY-MM-DD'. Exported for the route's inputs (TAB13-02b) — one copy. */
export function isIsoDay(value: unknown): value is IsoDay {
  if (typeof value !== 'string' || !DAY_RE.test(value)) return false;
  const midnight = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(midnight.getTime())) return false; // '2026-13-01' — no such month
  return midnight.toISOString().slice(0, 10) === value; // '2026-02-30' rolls to March — no such day
}

function checkRange(rangeFrom: IsoDay, rangeTo: IsoDay): void {
  if (!isIsoDay(rangeFrom)) throw new BudgetDaysError('bad-range', `rangeFrom ${JSON.stringify(rangeFrom)} is not a 'YYYY-MM-DD' day`);
  if (!isIsoDay(rangeTo)) throw new BudgetDaysError('bad-range', `rangeTo ${JSON.stringify(rangeTo)} is not a 'YYYY-MM-DD' day`);
  if (rangeFrom > rangeTo) throw new BudgetDaysError('bad-range', `rangeFrom ${rangeFrom} is after rangeTo ${rangeTo}`);
}

/** Is `day` in [from, to]? The one test of whether an occurrence's local day is in a view (DAYBOUNDS-01: exported — the today read asks the same question). */
export const within = (day: IsoDay, from: IsoDay, to: IsoDay): boolean => from <= day && day <= to;

/**
 * DAYBOUNDS-01 (2026-10-11) — THE ONE DEFINITION OF A DAY. The window a
 * routine is expanded over for the local days [rangeFrom, rangeTo]: FLOATING
 * bounds, the wall-clock day written as UTC, because expandBetween compares the
 * rule's floating occurrences against them before shifting to the zone
 * (rruleHelpers.ts). A real instant here (local midnight as UTC) would be off by
 * the zone's offset — in Bangkok, 17:00 the day before to 17:00 that day. The
 * occurrence's own local day (instantToZoned(...).date, within) is then the
 * test that places it. Stated once; the today read (routineDay.ts) uses this.
 */
export function dayWindow(rangeFrom: IsoDay, rangeTo: IsoDay): { windowFrom: Date; windowTo: Date } {
  const windowFrom = new Date(`${rangeFrom}T00:00:00.000Z`);
  const windowTo = new Date(`${rangeTo}T23:59:59.999Z`);
  return { windowFrom, windowTo };
}

// ── CODES (R4) ──────────────────────────────────────────────────────────────

export type ParsedCode =
  | { readonly ok: true; readonly code: string }
  | { readonly ok: false; readonly reason: 'no account' | 'account code not recognised'; readonly detail: string | null };

/**
 * A plan's code → the bare four digits, or why it cannot go on a line. The
 * chart's rule decides (scheme.ts parseCode); this adds only that no code is
 * 'no account'. A refusal carries the chart's own message; any error that is
 * not the chart's refusal is not a code question, and is thrown on.
 */
export function parseBudgetCode(raw: string | null | undefined, entityType: string): ParsedCode {
  if (raw === null || raw === undefined) return { ok: false, reason: 'no account', detail: null };
  if (raw.trim() === '') return { ok: false, reason: 'no account', detail: JSON.stringify(raw) };
  try {
    return { ok: true, code: parseCode(raw, entityType) };
  } catch (error) {
    if (error instanceof ValidationError) {
      return { ok: false, reason: 'account code not recognised', detail: `${JSON.stringify(raw)} — ${error.message}` };
    }
    throw error;
  }
}

// ── CENTS (R5) ──────────────────────────────────────────────────────────────

export type CentsResult = { readonly ok: true; readonly cents: number } | { readonly ok: false; readonly detail: string };

const DECIMAL_RE = /^(-?)(\d+)(?:\.(\d+))?$/;

/** A Decimal string ('12.30', '-5.00') → integer cents, by string arithmetic. Not a decimal at all → BudgetDaysError. */
export function centsFromDecimalString(value: string): CentsResult {
  const m = typeof value === 'string' ? DECIMAL_RE.exec(value.trim()) : null;
  if (!m) throw new BudgetDaysError('bad-amount', `${JSON.stringify(value)} is not a decimal amount`);
  const fraction = m[3] === undefined ? '' : m[3];
  if (fraction.length > 2) return { ok: false, detail: `${value} has more than two decimals` };
  const magnitude = BigInt(`${m[2]}${fraction.padEnd(2, '0')}`);
  if (magnitude > BigInt(Number.MAX_SAFE_INTEGER)) return { ok: false, detail: `${value} is past the safe integer range of cents` };
  const cents = Number(magnitude);
  return { ok: true, cents: m[1] === '-' && cents !== 0 ? -cents : cents };
}

/** Dollars as a number (routinePlanned's unit) → integer cents, only when whole cents to within 1e-6. */
export function centsFromDollars(dollars: number): CentsResult {
  if (!Number.isFinite(dollars)) return { ok: false, detail: `${dollars} is not a finite amount` };
  const scaled = dollars * 100;
  const cents = Math.round(scaled);
  if (Math.abs(scaled - cents) >= 1e-6) return { ok: false, detail: `${dollars} is not a whole number of cents` };
  if (!Number.isSafeInteger(cents)) return { ok: false, detail: `${dollars} is past the safe integer range of cents` };
  return { ok: true, cents: Object.is(cents, -0) ? 0 : cents };
}

// ── ROUTINES (R1, R2) ───────────────────────────────────────────────────────

export interface RoutineLinePlanInput {
  readonly id: string;
  /** Absent means active (the loader filters is_active on the server); false is honoured. */
  readonly isActive?: boolean;
  readonly stepOrder: number;
  /** Dollars — a number or a Decimal string — or null when the line carries no amount. */
  readonly budgetAmount: number | string | null;
  readonly coaCode: string | null;
  /**
   * SUPERSEDE-01a (Alex, 2026-11-07, SUPERSEDE-00 ruling 4): the line's duration_minutes as read — what supersession.ts
   * plannedMinutesOf's 'line' kind reads; null when the line states none. Required (null is stated, never absent).
   * SUPERSEDE-01b (2026-11-08): read by routineSupersessionOf — its window's length; 01a's fold undone (decision 9).
   */
  readonly durationMinutes: number | null;
  /**
   * SUPERSEDE-01b (Alex, 2026-11-08, ruling C): the line's time_of_day as the loader reads it ('HH:MM', or null when the
   * line states none) — its window's instant: that clock on the occurrence's local day in the routine's zone (the card's
   * composition, zonedToInstant), else the occurrence itself. Required, nullable.
   */
  readonly timeOfDay: string | null;
}

export interface RoutinePlanInput {
  readonly id: string;
  readonly name: string;
  readonly entityId: string;
  /** entities.entity_type of the routine's entity — the book its code's letter must match. */
  readonly entityType: string;
  /** IANA zone. */
  readonly timezone: string;
  readonly scheduleRrule: string;
  /** 'YYYY-MM-DD' or null. */
  readonly startDate: IsoDay | null;
  /** 'YYYY-MM-DD' or null — the last day an occurrence counts, inclusive. */
  readonly endDate: IsoDay | null;
  /** The routine-level amount, dollars. */
  readonly budgetAmount: number | string | null;
  readonly coaCode: string | null;
  /**
   * SUPERSEDE-01a (Alex, 2026-11-07, SUPERSEDE-00 ruling 4): the routine's window — the @db.Time's JSON,
   * '1970-01-01THH:MM:SS.000Z' — what supersession.ts plannedMinutesOf's 'routine' kind reads; null when the routine states
   * none. Required (null is stated, never absent). SUPERSEDE-01b (2026-11-08): read by routineSupersessionOf — a stepless
   * occurrence's length; 01a's fold undone (decision 9).
   */
  readonly startTime: string | null;
  readonly endTime: string | null;
  /** The routine's active lines. */
  readonly steps: readonly RoutineLinePlanInput[];
}

export interface DayRuleResult {
  readonly lines: readonly BudgetLine[];
  readonly notPlaced: readonly NotPlaced[];
}

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** SUPERSEDE-01b: the one expansion's answer — the occurrences, or why the routine cannot be read (the reasons buildRoutineBudgetLines names). */
export type RoutineOccurrences =
  | { readonly ok: true; readonly occurrences: readonly Date[] }
  | { readonly ok: false; readonly reason: NotPlacedReason; readonly detail: string };

/**
 * SUPERSEDE-01b (Alex, 2026-11-08, ruling C): ONE EXPANSION — the loop body buildRoutineBudgetLines ran inline (the zone,
 * the start date, expandBetween with its anchor), as a pure helper both it and routineSupersessionOf call; what it
 * answers, and in which order it refuses, is what the loop did.
 */
export function routineOccurrencesOf(routine: RoutinePlanInput, windowFrom: Date, windowTo: Date): RoutineOccurrences {
  // The zone first: expandBetween only consults it when an occurrence exists,
  // so an unrecognised zone would otherwise pass unseen in an empty window.
  try {
    instantToZoned(windowFrom, routine.timezone);
  } catch (error) {
    return { ok: false, reason: 'timezone not recognised', detail: `${JSON.stringify(routine.timezone)}: ${messageOf(error)}` };
  }
  if (routine.startDate !== null && !isIsoDay(routine.startDate)) {
    return { ok: false, reason: 'start date not recognised', detail: JSON.stringify(routine.startDate) };
  }
  let occurrences: Date[];
  try {
    occurrences = expandBetween(routine.scheduleRrule, routine.timezone, windowFrom, windowTo, scheduleAnchor(routine.startDate));
  } catch (error) {
    return { ok: false, reason: 'schedule does not parse', detail: `${JSON.stringify(routine.scheduleRrule)}: ${messageOf(error)}` };
  }
  return { ok: true, occurrences };
}

/** Every routine's occurrences in [rangeFrom, rangeTo], as dated budget lines, and what could not be placed. */
export function buildRoutineBudgetLines(routines: readonly RoutinePlanInput[], rangeFrom: IsoDay, rangeTo: IsoDay): DayRuleResult {
  checkRange(rangeFrom, rangeTo);
  const { windowFrom, windowTo } = dayWindow(rangeFrom, rangeTo);
  const lines: BudgetLine[] = [];
  const notPlaced: NotPlaced[] = [];

  for (const routine of routines) {
    if (routine.endDate !== null && !isIsoDay(routine.endDate)) {
      throw new BudgetDaysError('bad-end-date', `routine ${routine.id} endDate ${JSON.stringify(routine.endDate)} is not a 'YYYY-MM-DD' day`);
    }
    const planned = routinePlanned({
      budget_amount: routine.budgetAmount,
      coa_code: routine.coaCode,
      steps: routine.steps.map((s) => ({ id: s.id, is_active: s.isActive, step_order: s.stepOrder, budget_amount: s.budgetAmount, coa_code: s.coaCode })),
    });
    // A routine with no money contributes nothing and lists nothing (ruling 2026-09-27).
    if (planned.from === 'none') continue;

    const base = { source: 'routine' as const, entityId: routine.entityId, label: routine.name };

    // SUPERSEDE-01b: the one expansion (routineOccurrencesOf) — the zone, the start date, the schedule, in that order, as before.
    const expanded = routineOccurrencesOf(routine, windowFrom, windowTo);
    if (!expanded.ok) {
      notPlaced.push({ ...base, sourceId: wholeRoutineKey(routine.id), cents: null, day: null, reason: expanded.reason, detail: expanded.detail });
      continue;
    }

    // What each occurrence costs, and on which code — routinePlanned decides
    // both (its codes are trimmed, blank → null); this only reads them.
    const items = planned.from === 'lines'
      ? planned.lines.filter((l) => l.amount !== null).map((l) => ({ lineId: l.id as string | null, dollars: l.amount as number, code: l.coaCode }))
      : [{ lineId: null, dollars: planned.amount as number, code: planned.coaCode }];

    for (const instant of expanded.occurrences) {
      const day = instantToZoned(instant, routine.timezone).date;
      if (!within(day, rangeFrom, rangeTo)) continue;
      if (routine.endDate !== null && day > routine.endDate) continue;
      for (const item of items) {
        const sourceId = occurrenceKey({ routineId: routine.id, lineId: item.lineId, instant });
        const cents = centsFromDollars(item.dollars);
        if (!cents.ok) {
          notPlaced.push({ ...base, sourceId, cents: null, day, reason: 'amount not whole cents', detail: cents.detail });
          continue;
        }
        const code = parseBudgetCode(item.code, routine.entityType);
        if (!code.ok) {
          notPlaced.push({ ...base, sourceId, cents: cents.cents, day, reason: code.reason, detail: code.detail });
          continue;
        }
        lines.push({ entityId: routine.entityId, code: code.code, day, cents: cents.cents, source: 'routine', sourceId });
      }
    }
  }
  return { lines: sortLines(lines), notPlaced: sortNotPlaced(notPlaced) };
}

// ── SUPERSESSION (SUPERSEDE-01b, Alex, 2026-11-08, ruling C) ─────────────────

export interface RoutineSupersession {
  /** The marks by occurrence key — the leaf's answer (supersessionOf), nothing added. */
  readonly marks: ReadonlyMap<string, Supersession>;
  /** Every window's key, in order: a DAY or WEEK answer lists each with its mark or null, so the card can tell "no mark" from "not considered". */
  readonly occurrences: readonly string[];
  /** Routines whose zone, start date or schedule could not be read — no window from them; counted, by the same reasons buildRoutineBudgetLines names. */
  readonly unreadable: number;
}

/**
 * The occurrence WINDOWS of every routine in [rangeFrom, rangeTo] — costed or not: the `planned.from === 'none'` skip
 * above does not apply, a routine with no money is still on the day card — exactly as the card builds them (dayCard.ts
 * dayStops): a routine with no active lines → one window at the occurrence, its length by the one planned-minutes rule
 * over the routine's clocks; a routine with lines → one window per ACTIVE line, at the line's own time of day on the
 * occurrence's local day in the routine's zone (else the occurrence), its length the line's duration. The same `within`
 * and endDate rules as the lines. hasRecord by the ONE record key (stopRecord.ts recordKey) over the records the route
 * read — a record wins in one place, the leaf's supersessionOf. Then the ONE rule marks them.
 */
export function routineSupersessionOf(
  routines: readonly RoutinePlanInput[],
  rangeFrom: IsoDay,
  rangeTo: IsoDay,
  blocks: readonly TravelBlock[],
  recorded: ReadonlySet<string>,
): RoutineSupersession {
  checkRange(rangeFrom, rangeTo);
  const { windowFrom, windowTo } = dayWindow(rangeFrom, rangeTo);
  const windows: OccurrenceWindow[] = [];
  let unreadable = 0;

  for (const routine of routines) {
    if (routine.endDate !== null && !isIsoDay(routine.endDate)) {
      throw new BudgetDaysError('bad-end-date', `routine ${routine.id} endDate ${JSON.stringify(routine.endDate)} is not a 'YYYY-MM-DD' day`);
    }
    const expanded = routineOccurrencesOf(routine, windowFrom, windowTo);
    if (!expanded.ok) {
      unreadable += 1;
      continue;
    }
    // The active lines in step order — the card's order (dayStops sorts a routine's steps by step_order).
    const steps = routine.steps.filter((s) => s.isActive !== false).slice().sort((a, b) => a.stepOrder - b.stepOrder);

    for (const instant of expanded.occurrences) {
      const day = instantToZoned(instant, routine.timezone).date;
      if (!within(day, rangeFrom, rangeTo)) continue;
      if (routine.endDate !== null && day > routine.endDate) continue;
      if (steps.length === 0) {
        windows.push({
          key: occurrenceKey({ routineId: routine.id, lineId: null, instant }),
          at: instant,
          minutes: plannedMinutesOf({ kind: 'routine', start_time: routine.startTime, end_time: routine.endTime }),
          hasRecord: recorded.has(recordKey({ kind: 'routine', target_id: routine.id, occurrence_at: instant.toISOString() })),
        });
        continue;
      }
      for (const step of steps) {
        windows.push({
          key: occurrenceKey({ routineId: routine.id, lineId: step.id, instant }),
          // The planned instant: the line's own time of day on the occurrence's local day in the routine's zone, else the occurrence (the card's composition).
          at: step.timeOfDay === null ? instant : zonedToInstant(day, step.timeOfDay, routine.timezone),
          minutes: plannedMinutesOf({ kind: 'line', duration_minutes: step.durationMinutes }),
          hasRecord: recorded.has(recordKey({ kind: 'routine_line', target_id: step.id, occurrence_at: instant.toISOString() })),
        });
      }
    }
  }
  return { marks: supersessionOf(blocks, windows), occurrences: windows.map((w) => w.key), unreadable };
}

// ── TASKS (R3) ──────────────────────────────────────────────────────────────

export type TaskStatus = 'open' | 'in_progress' | 'blocked' | 'completed' | 'cancelled' | 'superseded' | 'archived' | 'pending_review';
export type BlockStatus = 'scheduled' | 'in_progress' | 'completed' | 'missed' | 'cancelled';
/** A person accepted it: it is a plan (OperationsTaskStatus, prisma/schema.prisma:3295-3304 (as of CRM-02, 2026-11-07: the users model grew two relations)). */
export const PLAN_TASK_STATUSES: readonly TaskStatus[] = ['open', 'in_progress', 'blocked', 'completed'];
/** Not a plan: excluded, and counted. */
export const EXCLUDED_TASK_STATUSES: readonly TaskStatus[] = ['pending_review', 'cancelled', 'superseded', 'archived'];
const BLOCK_STATUSES: readonly BlockStatus[] = ['scheduled', 'in_progress', 'completed', 'missed', 'cancelled'];

export interface TaskPlanItemInput {
  /** operations_daily_plan_items.plan_date, 'YYYY-MM-DD'. */
  readonly planDate: IsoDay;
  /** The item's calendar blocks, by status (CalendarBlockStatus, prisma/schema.prisma:3306-3312 (as of CRM-02, 2026-11-07: the users model grew two relations)). */
  readonly blocks: readonly { readonly status: string }[];
}

export interface TaskPlanInput {
  readonly id: string;
  readonly title: string;
  readonly entityId: string;
  readonly entityType: string;
  readonly status: string;
  /** operations_project_tasks.estimated_cost_usd as a Decimal string, or null. */
  readonly estimatedCostUsd: string | null;
  readonly coaCode: string | null;
  /** EVERY daily-plan item of the task — not only those in range: the earliest day decides. */
  readonly planItems: readonly TaskPlanItemInput[];
}

/** Costed tasks set aside by status — reported, never silent. */
export interface ExcludedByStatus {
  readonly status: TaskStatus;
  readonly tasks: number;
  /** Σ of their estimates in cents, or null when there are none. */
  readonly cents: number | null;
}

export interface TaskDayRuleResult extends DayRuleResult {
  /** One entry per excluded status, in EXCLUDED_TASK_STATUSES order. */
  readonly excluded: readonly ExcludedByStatus[];
}

/** Every accepted, costed task as one dated budget line — or listed as not placed — and the excluded ones counted. */
export function buildTaskBudgetLines(tasks: readonly TaskPlanInput[], rangeFrom: IsoDay, rangeTo: IsoDay): TaskDayRuleResult {
  checkRange(rangeFrom, rangeTo);
  const lines: BudgetLine[] = [];
  const notPlaced: NotPlaced[] = [];
  const excludedCount = new Map<TaskStatus, { tasks: number; cents: number }>();

  for (const task of tasks) {
    if (!(PLAN_TASK_STATUSES as readonly string[]).includes(task.status) && !(EXCLUDED_TASK_STATUSES as readonly string[]).includes(task.status)) {
      throw new BudgetDaysError('bad-task-status', `task ${task.id} status ${JSON.stringify(task.status)} is not an OperationsTaskStatus`);
    }
    for (const item of task.planItems) {
      if (!isIsoDay(item.planDate)) throw new BudgetDaysError('bad-plan-date', `task ${task.id} planDate ${JSON.stringify(item.planDate)} is not a 'YYYY-MM-DD' day`);
      for (const block of item.blocks) {
        if (!(BLOCK_STATUSES as readonly string[]).includes(block.status)) {
          throw new BudgetDaysError('bad-block-status', `task ${task.id} block status ${JSON.stringify(block.status)} is not a CalendarBlockStatus`);
        }
      }
    }
    // A task with no estimate is not money.
    if (task.estimatedCostUsd === null) continue;

    const base = { source: 'task' as const, sourceId: occurrenceKey({ taskId: task.id }), entityId: task.entityId, label: task.title };
    const cents = centsFromDecimalString(task.estimatedCostUsd);
    // The day it counts on: the earliest plan_date with a block that is not cancelled.
    const days = task.planItems
      .filter((item) => item.blocks.some((b) => b.status !== 'cancelled'))
      .map((item) => item.planDate)
      .sort();
    const day = days.length > 0 ? days[0] : null;

    if (!cents.ok) {
      if (day === null || within(day, rangeFrom, rangeTo)) {
        notPlaced.push({ ...base, cents: null, day, reason: 'amount not whole cents', detail: `${cents.detail} (status ${task.status})` });
      }
      continue;
    }
    if ((EXCLUDED_TASK_STATUSES as readonly string[]).includes(task.status)) {
      const status = task.status as TaskStatus;
      let tally = excludedCount.get(status);
      if (tally === undefined) {
        tally = { tasks: 0, cents: 0 };
        excludedCount.set(status, tally);
      }
      tally.tasks += 1;
      tally.cents += cents.cents;
      if (!Number.isSafeInteger(tally.cents)) throw new BudgetDaysError('bad-amount', `the ${status} estimates left the safe integer range of cents`);
      continue;
    }
    if (day === null) {
      notPlaced.push({ ...base, cents: cents.cents, day: null, reason: 'not on the calendar', detail: null });
      continue;
    }
    if (!within(day, rangeFrom, rangeTo)) continue; // counted on a day outside this view
    const code = parseBudgetCode(task.coaCode, task.entityType);
    if (!code.ok) {
      notPlaced.push({ ...base, cents: cents.cents, day, reason: code.reason, detail: code.detail });
      continue;
    }
    lines.push({ entityId: task.entityId, code: code.code, day, cents: cents.cents, source: 'task', sourceId: base.sourceId });
  }

  const excluded: ExcludedByStatus[] = EXCLUDED_TASK_STATUSES.map((status) => {
    const tally = excludedCount.get(status);
    return tally ? { status, tasks: tally.tasks, cents: tally.cents } : { status, tasks: 0, cents: null };
  });
  return { lines: sortLines(lines), notPlaced: sortNotPlaced(notPlaced), excluded };
}

// ── ORDER ───────────────────────────────────────────────────────────────────

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

function sortLines(lines: BudgetLine[]): BudgetLine[] {
  return lines.sort((a, b) => cmp(a.day, b.day) || cmp(a.entityId, b.entityId) || cmp(a.code, b.code) || cmp(a.sourceId, b.sourceId));
}

function sortNotPlaced(entries: NotPlaced[]): NotPlaced[] {
  return entries.sort((a, b) =>
    cmp(a.day === null ? '' : a.day, b.day === null ? '' : b.day) || cmp(a.sourceId, b.sourceId) || cmp(a.reason, b.reason));
}
