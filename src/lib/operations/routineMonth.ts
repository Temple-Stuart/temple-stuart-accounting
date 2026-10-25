/**
 * ROUTINES-03 (Alex, 2026-10-25) — THE MONTH BEHIND ROUTINE EXPENSES, PURE.
 *
 * ROUTINE EXPENSES (SectionF_RoutineExpenses over work.ts's routine spec) carries,
 * beside each routine line's own facts, five CALCULATED figures for as_of's
 * calendar month and the line's vendor. This module is that rule: given the
 * routines as /budget reads them (RoutinePlanInput — reportInputs.ts
 * toRoutinePlanInput), the stop records, the links with their postings' amounts,
 * the plan-vendor rows and as_of, one record per (routine_id, step_id):
 *
 *   · budget_month_cents   Σ the line's budget lines from buildRoutineBudgetLines
 *                          (src/lib/budget/days.ts — the ONE rule /budget uses) over
 *                          [the 1st, the last day]; null when the rule yields none.
 *   · budget_to_date_cents the same over [the 1st, as_of].
 *   · actual_cents         Σ actual_cents of the line's stop records whose stop falls
 *                          in [the 1st, as_of] in the routine's OWN zone (the ledger
 *                          GET's placing — instantToZoned); null when no record
 *                          carries an amount. actual_records counts the records placed.
 *   · match_cents          the postings linked to the line's occurrences in that
 *                          window (planned_item_links: routine_line, or routine for a
 *                          stepless routine), by LEDGER-03's one rule — matchOf /
 *                          readableMatchCents (ledger.ts), the amount by
 *                          postingAmount.ts amountCentsOf; null with no link, or with
 *                          an unreadable posting (said, counted in match_unreadable).
 *   · variance_cents       links.ts variance(TO DATE, ACTUAL): null unless both are
 *                          known. A whole-month budget is never set against a to-date
 *                          actual.
 *   · vendor_words         the plan's vendor at its ONE grain (VENDOR-01, planLines.ts
 *                          planHoldsOf — the rule planLinesOn reads): an every-
 *                          occurrence row → the vendor's name; occurrence rows only
 *                          (any instant) → "by occurrence"; none → null; a plan found
 *                          holding both grains → the refusal's words, never one picked.
 *
 * Every rule is REUSED, none restated: the budget's (buildRoutineBudgetLines), the
 * key's (readOccurrenceKey), the month's start (report.ts viewRange — the model's own
 * day view opens on the 1st), the placing (instantToZoned), the match (matchOf,
 * readableMatchCents), the variance (variance), the grain (planHoldsOf).
 *
 * Pure: no Prisma, no framework, no network, no clock — as_of is handed in (the
 * viewer's local day). What could not be placed or read is SAID, in words, beside
 * the figures — never dropped silently, never imputed as 0.
 */
import { buildRoutineBudgetLines, isIsoDay, readOccurrenceKey, type RoutinePlanInput } from '@/lib/budget/days';
import { viewRange, type IsoDay } from '@/lib/budget/report';
import { planHoldsOf, type PlanVendorRow } from '@/lib/budget/planLines';
import { matchOf, readableMatchCents, type LedgerLinkInput } from '@/lib/operations/ledger';
import { refusedWords, type StopRecordRow } from '@/lib/operations/stopRecord';
import { variance } from '@/lib/calendar/links';
import { instantToZoned } from '@/lib/time';

export const BY_OCCURRENCE_WORDS = 'by occurrence';
export const AS_OF_WORDS = 'as_of must be a real day written YYYY-MM-DD';

/** The figures the route CALCULATES, each naming its rule — labelled in the response and in the column's tooltip. */
export const ROUTINE_MONTH_CALCULATED = {
  budget_month_cents: 'calculated: occurrences in the month × amount — the /budget rule (buildRoutineBudgetLines)',
  budget_to_date_cents: 'calculated: occurrences from the 1st to as_of × amount — the /budget rule (buildRoutineBudgetLines)',
  actual_cents: 'calculated: the actuals recorded at the stops from the 1st to as_of, each placed in its routine\'s zone',
  match_cents: 'calculated: the postings linked in Books to the occurrences from the 1st to as_of (amountCentsOf)',
  variance_cents: 'calculated: TO DATE − ACTUAL — null unless both are known',
} as const;

/** The one key of a line's month record — the routine's id and the line's; a stepless routine's the routine's alone (ROUTINE EXPENSES' row id). */
export const monthLineKey = (routineId: string, stepId: string | null): string => (stepId === null ? `routine:${routineId}` : `routine:${routineId}:${stepId}`);

/** as_of's calendar month: the 1st (the model's own month start — a day view's range opens on it) to the last day. */
export function monthRangeOf(asOf: IsoDay): { readonly from: IsoDay; readonly to: IsoDay } {
  if (!isIsoDay(asOf)) throw new Error(`routineMonth: ${JSON.stringify(asOf)} is not a 'YYYY-MM-DD' day`);
  const { rangeFrom } = viewRange({ kind: 'day', day: asOf });
  const to = new Date(Date.UTC(Number(asOf.slice(0, 4)), Number(asOf.slice(5, 7)), 0)).toISOString().slice(0, 10);
  return { from: rangeFrom, to };
}

export interface RoutineMonthLine {
  readonly routine_id: string;
  /** The line's id; null for a stepless routine. */
  readonly step_id: string | null;
  readonly vendor_words: string | null;
  readonly budget_month_cents: number | null;
  readonly budget_to_date_cents: number | null;
  readonly actual_cents: number | null;
  readonly actual_records: number;
  readonly match_cents: number | null;
  readonly match_links: number;
  readonly match_unreadable: number;
  readonly variance_cents: number | null;
}

export interface RoutineMonthInput {
  readonly asOf: IsoDay;
  /** Every routine of the caller as /budget reads one, active and not. */
  readonly routines: readonly RoutinePlanInput[];
  /** The stop records the route read for the month's window (stopRecordRowOf). */
  readonly records: readonly StopRecordRow[];
  /** The links the route read for the window, each with its posting's amount (linkInputOf). */
  readonly links: readonly LedgerLinkInput[];
  /** Every plan-vendor row of the caller's routines and lines, any instant. */
  readonly vendors: readonly PlanVendorRow[];
}

export type RoutineMonthResult =
  | { readonly ok: true; readonly as_of: IsoDay; readonly from: IsoDay; readonly to: IsoDay; readonly lines: readonly RoutineMonthLine[]; readonly said: readonly string[] }
  | { readonly ok: false; readonly code: string; readonly message: string };

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));
const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

export function routineMonthOf(input: RoutineMonthInput): RoutineMonthResult {
  const { asOf } = input;
  const { from, to } = monthRangeOf(asOf);
  const said: string[] = [];

  // The plans: one per active line, one per stepless routine — in the order the routines came.
  const routineById = new Map(input.routines.map((r) => [r.id, r]));
  const routineOfStep = new Map<string, RoutinePlanInput>();
  const plans: { readonly routineId: string; readonly stepId: string | null }[] = [];
  for (const routine of input.routines) {
    const steps = routine.steps.filter((s) => s.isActive !== false);
    if (steps.length === 0) plans.push({ routineId: routine.id, stepId: null });
    for (const step of steps) {
      routineOfStep.set(step.id, routine);
      plans.push({ routineId: routine.id, stepId: step.id });
    }
  }

  // THE BUDGET — the one rule, over the month; the key says which line each occurrence belongs to.
  const built = buildRoutineBudgetLines(input.routines, from, to);
  const month = new Map<string, number>();
  const toDate = new Map<string, number>();
  for (const line of built.lines) {
    const read = readOccurrenceKey(line.sourceId);
    if (read === null || read.routineId === null) {
      said.push(`budget line ${JSON.stringify(line.sourceId)} is no routine occurrence's key`);
      continue;
    }
    const key = monthLineKey(read.routineId, read.address.kind === 'routine_line' ? read.address.id : null);
    month.set(key, (month.get(key) ?? 0) + line.cents);
    if (line.day <= asOf) toDate.set(key, (toDate.get(key) ?? 0) + line.cents);
  }
  if (built.notPlaced.length > 0) {
    said.push(`${plural(built.notPlaced.length, 'occurrence', 'occurrences')} /budget could not place — ${built.notPlaced.map((n) => `${n.sourceId}: ${n.reason}${n.detail === null ? '' : ` (${n.detail})`}`).join('; ')}`);
  }

  // THE PLACING — the ledger GET's: an instant on the day it falls in the routine's own zone; a zone Intl cannot read is said, never placed in UTC.
  const placed = (kind: 'routine' | 'routine_line', targetId: string, instant: string, what: string): { readonly key: string } | 'outside' | null => {
    const routine = kind === 'routine_line' ? routineOfStep.get(targetId) : routineById.get(targetId);
    if (routine === undefined) {
      said.push(`${what} names ${kind} ${targetId}, which the route did not read`);
      return null;
    }
    let day: string;
    try {
      day = instantToZoned(new Date(instant), routine.timezone).date;
    } catch (error) {
      said.push(`${what}: ${refusedWords('timezone not recognised', `${JSON.stringify(routine.timezone)}: ${messageOf(error)}`)}`);
      return null;
    }
    if (day < from || day > asOf) return 'outside';
    return { key: monthLineKey(routine.id, kind === 'routine_line' ? targetId : null) };
  };

  // THE ACTUAL — the records in [the 1st, as_of].
  const actuals = new Map<string, { records: number; cents: number | null }>();
  for (const record of input.records) {
    const at = placed(record.kind, record.target_id, record.occurrence_at, `record ${record.id}`);
    if (at === null || at === 'outside') continue;
    const sum = actuals.get(at.key) ?? { records: 0, cents: null };
    sum.records += 1;
    if (record.actual_cents !== null) sum.cents = (sum.cents ?? 0) + record.actual_cents;
    actuals.set(at.key, sum);
  }

  // THE MATCH — the links in [the 1st, as_of], by LEDGER-03's rule.
  const linksByKey = new Map<string, LedgerLinkInput[]>();
  for (const link of input.links) {
    const at = placed(link.kind, link.targetId, link.instant, `link ${link.journalEntryId}`);
    if (at === null || at === 'outside') continue;
    const list = linksByKey.get(at.key) ?? [];
    list.push(link);
    linksByKey.set(at.key, list);
  }

  // THE VENDOR — the plan's one grain; a row the database should not hold fails the read by name.
  const grain = planHoldsOf(input.vendors);
  const unreadable = grain.refusals.find((r) => r.code !== 'plan-vendor-both-grains');
  if (unreadable !== undefined) return { ok: false, code: unreadable.code, message: unreadable.message };
  const bothGrains = new Map(grain.refusals.filter((r) => r.code === 'plan-vendor-both-grains').map((r) => [r.plan as string, r.message]));
  const vendorWordsOf = (plan: { readonly routineId: string; readonly stepId: string | null }): string | null => {
    const key = plan.stepId === null ? `routine:${plan.routineId}` : `routine_line:${plan.stepId}`;
    const refused = bothGrains.get(key);
    if (refused !== undefined) return refused;
    const held = grain.holds.get(key);
    if (held === undefined) return null;
    if (held.every !== null) return held.every.vendor.vendor_name;
    return held.occurrences.size > 0 ? BY_OCCURRENCE_WORDS : null;
  };

  let unreadablePostings = 0;
  const lines: RoutineMonthLine[] = plans.map((plan) => {
    const key = monthLineKey(plan.routineId, plan.stepId);
    const actual = actuals.get(key) ?? { records: 0, cents: null };
    const match = matchOf(linksByKey.get(key) ?? []);
    unreadablePostings += match?.unreadable ?? 0;
    const budgetToDate = toDate.get(key) ?? null;
    return {
      routine_id: plan.routineId,
      step_id: plan.stepId,
      vendor_words: vendorWordsOf(plan),
      budget_month_cents: month.get(key) ?? null,
      budget_to_date_cents: budgetToDate,
      actual_cents: actual.cents,
      actual_records: actual.records,
      match_cents: readableMatchCents(match),
      match_links: match?.postings ?? 0,
      match_unreadable: match?.unreadable ?? 0,
      variance_cents: variance(budgetToDate, actual.cents),
    };
  });
  if (unreadablePostings > 0) said.push(`${plural(unreadablePostings, 'posting is', 'postings are')} linked but carry no readable amount — MATCH is blank on those lines`);
  return { ok: true, as_of: asOf, from, to, lines, said };
}
