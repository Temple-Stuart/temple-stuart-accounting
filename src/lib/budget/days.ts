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
 * CODES (R4). 'NNNN' or 'L-NNNN' after trimming; the letter must be the plan's
 * own entity's (src/lib/accountString.ts entityLetter). Whether the four digits
 * exist in the chart is the model's job ('not in chart'), not this file's.
 */
import type { BudgetLine, IsoDay } from '@/lib/budget/report';
import { routinePlanned } from '@/lib/operations/routineLines';
import { expandBetween, scheduleAnchor } from '@/lib/operations/rruleHelpers';
import { instantToZoned } from '@/lib/time';
import { entityLetter } from '@/lib/accountString';

// ── NOT PLACED ──────────────────────────────────────────────────────────────

/** Why a plan's money could not be placed on a day and an account. Closed. */
export type NotPlacedReason =
  | 'no account'
  | 'code names another book'
  | 'account code not recognised'
  | 'amount not whole cents'
  | 'schedule does not parse'
  | 'start date not recognised'
  | 'timezone not recognised'
  | 'not on the calendar';

export const NOT_PLACED_REASONS: readonly NotPlacedReason[] = [
  'no account', 'code names another book', 'account code not recognised', 'amount not whole cents',
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

const within = (day: IsoDay, from: IsoDay, to: IsoDay): boolean => from <= day && day <= to;

// ── CODES (R4) ──────────────────────────────────────────────────────────────

export type ParsedCode =
  | { readonly ok: true; readonly code: string }
  | { readonly ok: false; readonly reason: 'no account' | 'code names another book' | 'account code not recognised'; readonly detail: string | null };

const CODE_RE = /^(?:([A-Z])-)?(\d{4})$/;

/** A plan's code → the bare four digits, or why it cannot go on a line. */
export function parseBudgetCode(raw: string | null | undefined, entityType: string): ParsedCode {
  if (raw === null || raw === undefined) return { ok: false, reason: 'no account', detail: null };
  const trimmed = raw.trim();
  if (trimmed === '') return { ok: false, reason: 'no account', detail: JSON.stringify(raw) };
  const m = CODE_RE.exec(trimmed);
  if (!m) return { ok: false, reason: 'account code not recognised', detail: JSON.stringify(raw) };
  if (m[1] !== undefined) {
    const mine = entityLetter(entityType);
    if (m[1] !== mine) {
      return { ok: false, reason: 'code names another book', detail: `${JSON.stringify(raw)} on a ${entityType} entity, whose letter is ${mine === null ? 'none' : mine}` };
    }
  }
  return { ok: true, code: m[2] };
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
  /** The routine's active lines. */
  readonly steps: readonly RoutineLinePlanInput[];
}

export interface DayRuleResult {
  readonly lines: readonly BudgetLine[];
  readonly notPlaced: readonly NotPlaced[];
}

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** Every routine's occurrences in [rangeFrom, rangeTo], as dated budget lines, and what could not be placed. */
export function buildRoutineBudgetLines(routines: readonly RoutinePlanInput[], rangeFrom: IsoDay, rangeTo: IsoDay): DayRuleResult {
  checkRange(rangeFrom, rangeTo);
  const windowFrom = new Date(`${rangeFrom}T00:00:00.000Z`);
  const windowTo = new Date(`${rangeTo}T23:59:59.999Z`);
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
    const whole = (reason: NotPlacedReason, detail: string) =>
      notPlaced.push({ ...base, sourceId: `routine:${routine.id}`, cents: null, day: null, reason, detail });

    // The zone first: expandBetween only consults it when an occurrence exists,
    // so an unrecognised zone would otherwise pass unseen in an empty window.
    try {
      instantToZoned(windowFrom, routine.timezone);
    } catch (error) {
      whole('timezone not recognised', `${JSON.stringify(routine.timezone)}: ${messageOf(error)}`);
      continue;
    }
    if (routine.startDate !== null && !isIsoDay(routine.startDate)) {
      whole('start date not recognised', JSON.stringify(routine.startDate));
      continue;
    }
    let occurrences: Date[];
    try {
      occurrences = expandBetween(routine.scheduleRrule, routine.timezone, windowFrom, windowTo, scheduleAnchor(routine.startDate));
    } catch (error) {
      whole('schedule does not parse', `${JSON.stringify(routine.scheduleRrule)}: ${messageOf(error)}`);
      continue;
    }

    // What each occurrence costs, and on which code — routinePlanned decides
    // both (its codes are trimmed, blank → null); this only reads them.
    const items = planned.from === 'lines'
      ? planned.lines.filter((l) => l.amount !== null).map((l) => ({ key: `line:${l.id}`, dollars: l.amount as number, code: l.coaCode }))
      : [{ key: 'routine', dollars: planned.amount as number, code: planned.coaCode }];

    for (const instant of occurrences) {
      const day = instantToZoned(instant, routine.timezone).date;
      if (!within(day, rangeFrom, rangeTo)) continue;
      if (routine.endDate !== null && day > routine.endDate) continue;
      const at = instant.toISOString();
      for (const item of items) {
        const sourceId = `routine:${routine.id}:${item.key}:${at}`;
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

// ── TASKS (R3) ──────────────────────────────────────────────────────────────

export type TaskStatus = 'open' | 'in_progress' | 'blocked' | 'completed' | 'cancelled' | 'superseded' | 'archived' | 'pending_review';
export type BlockStatus = 'scheduled' | 'in_progress' | 'completed' | 'missed' | 'cancelled';
/** A person accepted it: it is a plan (OperationsTaskStatus, prisma/schema.prisma:3293-3302). */
export const PLAN_TASK_STATUSES: readonly TaskStatus[] = ['open', 'in_progress', 'blocked', 'completed'];
/** Not a plan: excluded, and counted. */
export const EXCLUDED_TASK_STATUSES: readonly TaskStatus[] = ['pending_review', 'cancelled', 'superseded', 'archived'];
const BLOCK_STATUSES: readonly BlockStatus[] = ['scheduled', 'in_progress', 'completed', 'missed', 'cancelled'];

export interface TaskPlanItemInput {
  /** operations_daily_plan_items.plan_date, 'YYYY-MM-DD'. */
  readonly planDate: IsoDay;
  /** The item's calendar blocks, by status (CalendarBlockStatus, prisma/schema.prisma:3304-3310). */
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

    const base = { source: 'task' as const, sourceId: `task:${task.id}`, entityId: task.entityId, label: task.title };
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
