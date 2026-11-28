/**
 * PASTE-03 (Alex, 2026-11-28) — THE OCCURRENCES THAT CARRY NO MONEY.
 *
 * "i dont see any of this"
 *
 * He pasted his sheet as he keeps it, and not one row of it landed: a stop existed only where money was. The time sheet's rows
 * were /budget's lines (src/lib/budget/days.ts buildRoutineBudgetLines), /budget builds a line only for an AMOUNT, and a vendor
 * could sit only on a line that carried one — so a stop with no budget was a stop nobody could see, plan a vendor on or record.
 *
 * Since this change a routine's LINE may name its ACCOUNT with no AMOUNT (src/lib/operations/planMoney.ts — the pair bends one
 * way, for a line only). Such a line still happens on its days. This file builds THOSE occurrences — the same expansion, the same
 * day, the same key as the money builder's — and nothing else:
 *
 *   accountOnlyLinesOf(routine)   the routine's ACTIVE lines that carry an account and no amount — read off the one leaf
 *                                 (src/lib/operations/routineLines.ts routinePlanned), called exactly as days.ts calls it. None
 *                                 while the routine's own figure is in force (planned.from === 'routine'): its money is the
 *                                 routine's, and so is its vendor.
 *   buildRoutineOpenLines(…)      for each routine with such a line: its occurrences in the range (days.ts routineOccurrencesOf
 *                                 over dayWindow), each kept when its local day in the routine's zone is in the range and on or
 *                                 before the end date, and ONE OpenLine a line an occurrence — keyed by days.ts occurrenceKey,
 *                                 coded by days.ts parseBudgetCode with the routine's entity type.
 *
 * AN OPEN LINE HAS NO CENTS. Not 0 — no field: nothing here can be summed, and a reader that wants a figure has none to read.
 *
 * WHAT DOES NOT CHANGE. days.ts is not edited. buildRoutineBudgetLines builds what it built, and "a routine with no money
 * contributes nothing and lists nothing" stands — for /budget. No sum, no budget line and no report figure reads this file. Its
 * three readers ask only WHICH occurrences exist: the vendor rule (src/lib/operations/planVendor.ts occurrenceIn — a vendor may
 * be planned at one), the day's plan (src/lib/budget/planLines.ts dayPlanOf — a vendor at one is not stranded), and the time
 * sheet (src/lib/operations/ledger.ts — it lists the stop, BUDGET blank).
 *
 * NOTHING IS SKIPPED, AND NOTHING IS LISTED TWICE. A code the chart's rule refuses is a NotPlaced — that occurrence, that day, the
 * rule's own reason and detail, cents null (there is no amount to say). A routine that cannot be expanded (its zone, its start
 * date, its schedule) is a NotPlaced under the whole routine's key ONLY when none of its active lines carries an amount: with a
 * costed line the money builder already lists that routine, and one routine is never listed by both. A bad CALL — a range that is
 * not two 'YYYY-MM-DD' days in order, an end date that is not one — throws BudgetDaysError by the codes days.ts uses.
 *
 * Pure: no Prisma client, no request, no clock, no environment. Everything arrives as the plain data days.ts takes.
 */
import type { IsoDay } from '@/lib/budget/report';
import {
  BudgetDaysError, dayWindow, isIsoDay, occurrenceKey, parseBudgetCode, routineOccurrencesOf, wholeRoutineKey, within,
  type NotPlaced, type RoutinePlanInput,
} from '@/lib/budget/days';
import { routinePlanned, type RoutinePlanned } from '@/lib/operations/routineLines';
import { instantToZoned } from '@/lib/time';

/** One occurrence of a line that names its account and no amount. A budget line's facts WITHOUT its figure: there is no cents field. */
export interface OpenLine {
  readonly entityId: string;
  /** The bare four digits, as the chart's rule reads the line's code (days.ts parseBudgetCode). */
  readonly code: string;
  /** The occurrence's local day in the routine's zone — the day /budget would place it on. */
  readonly day: IsoDay;
  readonly source: 'routine';
  /** The occurrence's key, in days.ts's one format (occurrenceKey): routine:<routine>:line:<step>:<instant>. */
  readonly sourceId: string;
}

/** A line that names its account and no amount: its id, and its code as the leaf read it (trimmed, never blank). */
export interface AccountOnlyLine {
  readonly id: string;
  readonly coaCode: string;
}

export interface OpenLinesResult {
  readonly open: readonly OpenLine[];
  readonly notPlaced: readonly NotPlaced[];
}

/** routinePlanned, called exactly as buildRoutineBudgetLines calls it (days.ts). */
function plannedOf(routine: RoutinePlanInput): RoutinePlanned {
  return routinePlanned({
    budget_amount: routine.budgetAmount,
    coa_code: routine.coaCode,
    steps: routine.steps.map((s) => ({ id: s.id, is_active: s.isActive, step_order: s.stepOrder, budget_amount: s.budgetAmount, coa_code: s.coaCode })),
  });
}

/** The account-only lines of a plan as the leaf read it: none while the routine's own figure is in force; else its active lines with an account and no amount, in the leaf's order. */
function accountOnlyOf(planned: RoutinePlanned): AccountOnlyLine[] {
  if (planned.from === 'routine') return [];
  return planned.lines.flatMap((line) => (line.amount === null && line.coaCode !== null ? [{ id: line.id, coaCode: line.coaCode }] : []));
}

/** The routine's ACTIVE lines that carry an account and no amount — none while its own figure is in force. */
export function accountOnlyLinesOf(routine: RoutinePlanInput): readonly AccountOnlyLine[] {
  return accountOnlyOf(plannedOf(routine));
}

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Every account-only line's occurrences in [rangeFrom, rangeTo] — and what of them could not be placed. No figure anywhere. */
export function buildRoutineOpenLines(routines: readonly RoutinePlanInput[], rangeFrom: IsoDay, rangeTo: IsoDay): OpenLinesResult {
  // A bad range is the caller's — refused by name, by the codes and in the words days.ts uses.
  if (!isIsoDay(rangeFrom)) throw new BudgetDaysError('bad-range', `rangeFrom ${JSON.stringify(rangeFrom)} is not a 'YYYY-MM-DD' day`);
  if (!isIsoDay(rangeTo)) throw new BudgetDaysError('bad-range', `rangeTo ${JSON.stringify(rangeTo)} is not a 'YYYY-MM-DD' day`);
  if (rangeFrom > rangeTo) throw new BudgetDaysError('bad-range', `rangeFrom ${rangeFrom} is after rangeTo ${rangeTo}`);
  const { windowFrom, windowTo } = dayWindow(rangeFrom, rangeTo);
  const open: OpenLine[] = [];
  const notPlaced: NotPlaced[] = [];

  for (const routine of routines) {
    if (routine.endDate !== null && !isIsoDay(routine.endDate)) {
      throw new BudgetDaysError('bad-end-date', `routine ${routine.id} endDate ${JSON.stringify(routine.endDate)} is not a 'YYYY-MM-DD' day`);
    }
    const planned = plannedOf(routine);
    const lines = accountOnlyOf(planned);
    // A routine with no such line has no occurrence that carries no money: nothing is built for it here.
    if (lines.length === 0) continue;

    const base = { source: 'routine' as const, entityId: routine.entityId, label: routine.name };

    // The SAME expansion as the money builder's — the zone, the start date, the schedule, in that order.
    const expanded = routineOccurrencesOf(routine, windowFrom, windowTo);
    if (!expanded.ok) {
      // With a costed line the money builder lists this routine under the same key — never twice. It lists it only then.
      if (!planned.lines.some((line) => line.amount !== null)) {
        notPlaced.push({ ...base, sourceId: wholeRoutineKey(routine.id), cents: null, day: null, reason: expanded.reason, detail: expanded.detail });
      }
      continue;
    }

    for (const instant of expanded.occurrences) {
      // The same day test: the occurrence's local day in the routine's zone, in the range, on or before the end date.
      const day = instantToZoned(instant, routine.timezone).date;
      if (!within(day, rangeFrom, rangeTo)) continue;
      if (routine.endDate !== null && day > routine.endDate) continue;
      for (const line of lines) {
        const sourceId = occurrenceKey({ routineId: routine.id, lineId: line.id, instant });
        const code = parseBudgetCode(line.coaCode, routine.entityType);
        if (!code.ok) {
          notPlaced.push({ ...base, sourceId, cents: null, day, reason: code.reason, detail: code.detail });
          continue;
        }
        open.push({ entityId: routine.entityId, code: code.code, day, source: 'routine', sourceId });
      }
    }
  }

  // By day, then key — an undated entry (a whole routine) first, as days.ts orders its own.
  return {
    open: open.sort((a, b) => cmp(a.day, b.day) || cmp(a.sourceId, b.sourceId)),
    notPlaced: notPlaced.sort((a, b) => cmp(a.day === null ? '' : a.day, b.day === null ? '' : b.day) || cmp(a.sourceId, b.sourceId)),
  };
}
