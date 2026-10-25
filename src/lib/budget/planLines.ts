/**
 * TAB13-04 (2026-09-29) — THE DAY'S PLAN: the plan lines behind a day's (or a
 * week's) figures, each with its vendor, and the vendors a day holds that no plan
 * line matches.
 *
 * WHICH LINES. For a DAY or WEEK view, the budget lines the view built — the
 * routine and task lines exactly as handed to the model (reportInputs.ts) —
 * dated on the view's DAY COLUMNS: a DAY's own day (not the month to date its MTD
 * column spans — report.ts columnsFor), a WEEK's seven. A YEAR lists none, and
 * says so in words.
 *
 * WHAT A LINE SAYS. Its book and account, day, cents and source; its label (the
 * routine's name or the task's title); its line (the step's activity, or null);
 * its time — a line's own time_of_day ('HH:MM', read once by the loader), a
 * stepless routine's occurrence time in the routine's zone, a task's null — never
 * another's time in its place; its address, read back from the key by days.ts
 * (the one format); and its vendor.
 *
 * ITS VENDOR, BY THE PLAN'S ONE GRAIN (VENDOR-01 — the database holds one): the
 * plan holds an every-occurrence vendor → that vendor, every time; the plan holds
 * occurrence vendors → this occurrence's, or none; none → none. A plan found
 * holding both is refused by name — never resolved by picking one.
 *
 * STRANDED. An occurrence vendor whose occurrence falls on a day column of this
 * view — its routine-local day, in the zone of its plan's routine — and whose
 * address matches no occurrence this view built (placed or not placed) is listed
 * by name, never dropped and never matched to a neighbour. A row whose routine's
 * zone cannot be read cannot be dated: it is listed too, undated, with that reason.
 *
 * BUDGET-02 (2026-10-20) — THE MATCHING, OVER EXPLICIT DAYS. Alex: "Lift
 * dayPlanOf's matching into a function over explicit days … no second rule."
 * planLinesOn() is that matching — the plan's one grain, a line's label, line,
 * time, address and vendor — over the days it is handed. dayPlanOf() is now a
 * DAY or WEEK view's days (planDays) handed to it, plus the stranded vendors;
 * the /budget drill (reportInputs.ts budgetCellResponse) hands it the days of
 * the one figure it lists. One rule, two callers.
 *
 * Pure — reached through reportInputs.ts, so the budget report purity law reads
 * it: no Prisma client, no framework, no network, no environment, no clock. A
 * call the route got wrong comes back as a named error for reportInputs.ts to
 * throw as BudgetInputError (the rows are the route's).
 */
import { viewRange, type BudgetLine, type BudgetSource, type BudgetView, type IsoDay } from './report';
import { occurrenceKey, readOccurrenceKey, type NotPlaced, type OccurrenceKind } from './days';
import { instantToZoned } from '@/lib/time';

// ── INPUT ───────────────────────────────────────────────────────────────────

/** A planned_item_vendors row as the report route reads it, with its vendor and its plan's words. */
export interface PlanVendorRow {
  readonly id: string;
  readonly routine_id: string | null;
  readonly step_id: string | null;
  readonly task_id: string | null;
  readonly occurrence_at: Date | null;
  readonly vendor: { readonly id: string; readonly vendor_name: string; readonly entity_id: string };
  readonly routine: { readonly name: string; readonly timezone: string } | null;
  readonly step: { readonly activity: string; readonly routine_id: string; readonly routine: { readonly name: string; readonly timezone: string } } | null;
  readonly task: { readonly title: string } | null;
}

/** A routine's words, from the rows the loader read. */
export interface RoutineWords {
  readonly name: string;
  readonly timezone: string;
  /** Each active line's activity and its own time ('HH:MM' or null). */
  readonly steps: ReadonlyMap<string, { readonly activity: string; readonly timeOfDay: string | null }>;
}

export interface DayPlanInput {
  readonly view: BudgetView;
  /** The routine and task lines as handed to the model. */
  readonly lines: readonly BudgetLine[];
  /** What the view built and could not place — with the lines, every occurrence the view built. */
  readonly notPlaced: readonly NotPlaced[];
  readonly routines: ReadonlyMap<string, RoutineWords>;
  /** Task id → title. */
  readonly tasks: ReadonlyMap<string, string>;
  /** The vendor rows the route read — for a DAY or WEEK view; null for a YEAR (not read). */
  readonly vendors: readonly PlanVendorRow[] | null;
}

// ── OUTPUT ──────────────────────────────────────────────────────────────────

/** The address as the response carries it: the words the vendor routes speak, the instant as ISO text. */
export interface PlanAddressText {
  readonly kind: OccurrenceKind;
  readonly id: string;
  readonly instant: string | null;
}

export interface PlanLineVendor {
  readonly id: string;
  readonly name: string;
  readonly entityId: string;
  /** every: the plan's vendor for every occurrence · occurrence: this occurrence's. */
  readonly grain: 'every' | 'occurrence';
}

export interface PlanLine {
  readonly entityId: string;
  readonly code: string;
  readonly day: IsoDay;
  readonly cents: number;
  readonly source: BudgetSource;
  /** The routine's name or the task's title. */
  readonly label: string;
  /** The step's activity, or null. */
  readonly line: string | null;
  /** 'HH:MM', or null when the plan states none. */
  readonly time: string | null;
  readonly address: PlanAddressText;
  readonly vendor: PlanLineVendor | null;
}

export interface StrandedVendor {
  readonly vendor: { readonly id: string; readonly name: string; readonly entityId: string };
  readonly label: string;
  readonly line: string | null;
  /** The routine-local day and time; null when the routine's zone cannot be read. */
  readonly day: IsoDay | null;
  readonly time: string | null;
  readonly address: PlanAddressText;
  readonly reason: string;
}

export type DayPlan =
  | { readonly listed: true; readonly days: readonly IsoDay[]; readonly lines: readonly PlanLine[]; readonly stranded: readonly StrandedVendor[] }
  | { readonly listed: false; readonly words: string };

export const YEAR_WORDS = 'a year lists no plan lines — open a day or a week';
export const STRANDED_WORDS = '/budget builds no occurrence at this instant — the line or routine is inactive, carries no money, or its schedule or zone changed';
export const undatedWords = (zone: string, detail: string): string => `its routine's zone ${JSON.stringify(zone)} cannot be read (${detail}) — this vendor cannot be dated`;

export type PlanLinesErrorCode = 'plan-vendors-not-read' | 'plan-vendors-read-for-year' | 'plan-vendor-both-grains' | 'plan-vendor-unreadable' | 'plan-line-unreadable';

export type DayPlanResult =
  | { readonly ok: true; readonly plan: DayPlan }
  | { readonly ok: false; readonly code: PlanLinesErrorCode; readonly message: string };

/** BUDGET-02: the matching's input — the days are explicit; the vendor rows are read for them. */
export interface PlanLinesInput {
  readonly days: readonly IsoDay[];
  /** The routine and task lines as handed to the model. */
  readonly lines: readonly BudgetLine[];
  readonly routines: ReadonlyMap<string, RoutineWords>;
  /** Task id → title. */
  readonly tasks: ReadonlyMap<string, string>;
  /** Every every-occurrence row and the occurrence rows in vendorWindowOf(days). */
  readonly vendors: readonly PlanVendorRow[];
}

export type PlanLinesResult =
  | { readonly ok: true; readonly lines: readonly PlanLine[] }
  | { readonly ok: false; readonly code: PlanLinesErrorCode; readonly message: string };

// ── DAYS ────────────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;
const midnight = (day: IsoDay): number => Date.parse(`${day}T00:00:00.000Z`);
const plusDays = (day: IsoDay, n: number): IsoDay => new Date(midnight(day) + n * DAY_MS).toISOString().slice(0, 10);

/** The view's day columns — a DAY's day, a WEEK's seven (the model's own range) — or null for a YEAR. */
export function planDays(view: BudgetView): IsoDay[] | null {
  if (view.kind === 'year') return null;
  const { rangeFrom } = viewRange(view);
  return view.kind === 'day' ? [view.day] : Array.from({ length: 7 }, (_, i) => plusDays(rangeFrom, i));
}

/** BUDGET-02: every day of [from, to], in order — none when from is after to. */
export function daysOf(from: IsoDay, to: IsoDay): IsoDay[] {
  const out: IsoDay[] = [];
  for (let day = from; day <= to; day = plusDays(day, 1)) out.push(day);
  return out;
}

/**
 * The instants the route reads occurrence vendors in: [first day − 1 day, last
 * day + 2 days) UTC — a superset of those days' local times in every zone,
 * UTC−12 to UTC+14. planLines decides exactly. BUDGET-02: over explicit days
 * (the drill's); null when there are none.
 */
export function vendorWindowOf(days: readonly IsoDay[]): { readonly from: Date; readonly to: Date } | null {
  if (days.length === 0) return null;
  return { from: new Date(midnight(days[0]) - DAY_MS), to: new Date(midnight(days[days.length - 1]) + 2 * DAY_MS) };
}

/** A DAY's or WEEK's vendor window (vendorWindowOf over its day columns); null for a YEAR. */
export function vendorWindow(view: BudgetView): { readonly from: Date; readonly to: Date } | null {
  const days = planDays(view);
  return days === null ? null : vendorWindowOf(days);
}

// ── THE PLAN ────────────────────────────────────────────────────────────────

const textOf = (address: { kind: OccurrenceKind; id: string; instant: Date | null }): PlanAddressText =>
  ({ kind: address.kind, id: address.id, instant: address.instant === null ? null : address.instant.toISOString() });

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
/** null sorts last. */
const cmpMaybe = (a: string | null, b: string | null): number => (a === b ? 0 : a === null ? 1 : b === null ? -1 : cmp(a, b));

export interface PlanHolds {
  every: PlanVendorRow | null;
  readonly occurrences: Map<string, PlanVendorRow>;
}

/** One refusal the grain rule records, in row order: a both-grains plan (named by its key) or a row the database should not hold (plan null). */
export interface PlanHoldsRefusal {
  readonly plan: string | null;
  readonly code: PlanLinesErrorCode;
  readonly message: string;
}

export interface PlanHoldsRead {
  /** The plans by key ("<kind>:<id>"), each with its every-occurrence row and its occurrence rows by instant. */
  readonly holds: ReadonlyMap<string, PlanHolds>;
  /** Every refusal, in the order the rows raised it — planLinesOn fails on the first; ROUTINE EXPENSES prints a both-grains plan's words on its line. */
  readonly refusals: readonly PlanHoldsRefusal[];
}

/**
 * VENDOR-01's ONE GRAIN, indexed by plan. ROUTINES-03 (Alex, 2026-10-25): lifted
 * out of planLinesOn — the loop that was there, unchanged in what it holds and
 * what it refuses — so ROUTINE EXPENSES' VENDOR column (src/lib/operations/
 * routineMonth.ts) reads the same rule: an every-occurrence row → that vendor;
 * occurrence rows only → "by occurrence"; a plan holding both → the refusal's
 * words, never one picked (the BUDGET-02 precedent: one rule, two callers).
 * A row naming no plan or two, or two vendors at one address, is the database's
 * error ('plan-vendor-unreadable'); a both-grains plan is 'plan-vendor-both-grains',
 * recorded once, with the occurrences held when the conflict appeared.
 */
export function planHoldsOf(vendors: readonly PlanVendorRow[]): PlanHoldsRead {
  const holds = new Map<string, PlanHolds>();
  const refusals: PlanHoldsRefusal[] = [];
  for (const row of vendors) {
    const plan = planOf(row);
    if (plan === null) {
      refusals.push({ plan: null, code: 'plan-vendor-unreadable', message: `plan-vendor row ${row.id} names ${[row.routine_id, row.step_id, row.task_id].filter((v) => v !== null).length} plans — a row names exactly one` });
      continue;
    }
    const key = `${plan.kind}:${plan.id}`;
    let held = holds.get(key);
    if (held === undefined) {
      held = { every: null, occurrences: new Map<string, PlanVendorRow>() };
      holds.set(key, held);
    }
    const at = row.occurrence_at === null ? null : row.occurrence_at.toISOString();
    if (at === null ? held.every !== null : held.occurrences.has(at)) {
      refusals.push({ plan: key, code: 'plan-vendor-unreadable', message: `plan ${key} holds two vendors at one address${at === null ? ' (every occurrence)' : ` (${at})`} — the database holds one` });
      continue;
    }
    if (at === null) held.every = row;
    else held.occurrences.set(at, row);
    if (held.every !== null && held.occurrences.size > 0 && !refusals.some((r) => r.plan === key && r.code === 'plan-vendor-both-grains')) {
      const single = [...held.occurrences.values()].map((r) => `"${r.vendor.vendor_name}" at ${(r.occurrence_at as Date).toISOString()}`).join(', ');
      refusals.push({ plan: key, code: 'plan-vendor-both-grains', message: `plan ${key} holds "${held.every.vendor.vendor_name}" for every occurrence AND ${single} — a plan holds one grain; this is never resolved by picking one` });
    }
  }
  return { holds, refusals };
}

/** A vendor row's plan: its kind and id — exactly one of the three columns (the migration's CHECK). */
function planOf(row: PlanVendorRow): { kind: OccurrenceKind; id: string } | null {
  const set = [row.routine_id, row.step_id, row.task_id].filter((v) => v !== null).length;
  if (set !== 1) return null;
  if (row.step_id !== null) return { kind: 'routine_line', id: row.step_id };
  if (row.routine_id !== null) return { kind: 'routine', id: row.routine_id };
  return { kind: 'project_task', id: row.task_id as string };
}

/**
 * BUDGET-02 — THE MATCHING: the lines handed to the model that fall on the
 * explicit days, each with its label, line, time, address and vendor by the
 * plan's one grain, ordered by day, time, label, line and key.
 */
export function planLinesOn(input: PlanLinesInput): PlanLinesResult {
  const fail = (code: PlanLinesErrorCode, message: string): PlanLinesResult => ({ ok: false, code, message });
  const days = new Set(input.days);

  // The plan's ONE grain — indexed by plan (planHoldsOf; ROUTINES-03 lifted it so ROUTINE EXPENSES' VENDOR reads the same rule).
  // The first refusal in row order fails the matching, as it did when the loop was here.
  const read = planHoldsOf(input.vendors);
  if (read.refusals.length > 0) return fail(read.refusals[0].code, read.refusals[0].message);
  const holds = read.holds;

  // The plan lines: the lines handed to the model, on the days handed in.
  const lines: { line: PlanLine; sourceId: string }[] = [];
  for (const l of input.lines) {
    if (!days.has(l.day)) continue;
    const read = readOccurrenceKey(l.sourceId);
    if (read === null) return fail('plan-line-unreadable', `budget line ${JSON.stringify(l.sourceId)} is no occurrence's key`);
    const { address, routineId } = read;
    let label: string;
    let line: string | null = null;
    let time: string | null = null;
    if (address.kind === 'project_task') {
      const title = input.tasks.get(address.id);
      if (title === undefined) return fail('plan-line-unreadable', `budget line ${l.sourceId} names task ${address.id}, which the route did not read`);
      label = title;
    } else {
      const routine = routineId === null ? undefined : input.routines.get(routineId);
      if (routine === undefined) return fail('plan-line-unreadable', `budget line ${l.sourceId} names routine ${routineId}, which the loader did not read`);
      label = routine.name;
      if (address.kind === 'routine_line') {
        const step = routine.steps.get(address.id);
        if (step === undefined) return fail('plan-line-unreadable', `budget line ${l.sourceId} names line ${address.id}, which is not an active line of "${routine.name}"`);
        line = step.activity;
        time = step.timeOfDay;
      } else {
        time = instantToZoned(address.instant as Date, routine.timezone).time;
      }
    }
    // The plan's one grain: every occurrence → that vendor; occurrences → this one's; a plan holding none has none.
    const held = holds.get(`${address.kind}:${address.id}`);
    const every = held === undefined ? null : held.every;
    const found = held === undefined || address.instant === null ? undefined : held.occurrences.get(address.instant.toISOString());
    const own = found === undefined ? null : found;
    const chosen = every !== null ? every : own;
    const vendor: PlanLineVendor | null = chosen === null ? null : {
      id: chosen.vendor.id, name: chosen.vendor.vendor_name, entityId: chosen.vendor.entity_id, grain: every !== null ? 'every' : 'occurrence',
    };
    lines.push({
      sourceId: l.sourceId,
      line: { entityId: l.entityId, code: l.code, day: l.day, cents: l.cents, source: l.source, label, line, time, address: textOf(address), vendor },
    });
  }
  lines.sort((a, b) => cmp(a.line.day, b.line.day) || cmpMaybe(a.line.time, b.line.time) || cmp(a.line.label, b.line.label) || cmpMaybe(a.line.line, b.line.line) || cmp(a.sourceId, b.sourceId));
  return { ok: true, lines: lines.map((l) => l.line) };
}

export function dayPlanOf(input: DayPlanInput): DayPlanResult {
  const fail = (code: PlanLinesErrorCode, message: string): DayPlanResult => ({ ok: false, code, message });
  const days = planDays(input.view);
  if (days === null) {
    if (input.vendors !== null) return fail('plan-vendors-read-for-year', 'a YEAR view was handed plan-vendor rows — a year lists no plan lines, and the route reads none for it');
    return { ok: true, plan: { listed: false, words: YEAR_WORDS } };
  }
  if (input.vendors === null) return fail('plan-vendors-not-read', `a ${input.view.kind.toUpperCase()} view was handed no plan-vendor rows — the route reads them for a day or a week`);

  // BUDGET-02: the matching, on the view's day columns — every vendor row is checked there.
  const matched = planLinesOn({ days, lines: input.lines, routines: input.routines, tasks: input.tasks, vendors: input.vendors });
  if (!matched.ok) return matched;

  // Stranded: an occurrence vendor on a day of this view that matches no occurrence the view built.
  const built = new Set<string>([...input.lines.map((l) => l.sourceId), ...input.notPlaced.map((n) => n.sourceId)]);
  const stranded: StrandedVendor[] = [];
  for (const row of input.vendors) {
    if (row.occurrence_at === null) continue;
    const plan = planOf(row) as { kind: OccurrenceKind; id: string };
    const owner = plan.kind === 'routine_line' ? (row.step === null ? null : { routineId: row.step.routine_id, name: row.step.routine.name, zone: row.step.routine.timezone, line: row.step.activity as string | null })
      : plan.kind === 'routine' ? (row.routine === null ? null : { routineId: plan.id, name: row.routine.name, zone: row.routine.timezone, line: null })
      : null;
    if (owner === null) return fail('plan-vendor-unreadable', `plan-vendor row ${row.id} holds an occurrence its plan cannot carry, or its plan's words were not read`);
    const vendor = { id: row.vendor.id, name: row.vendor.vendor_name, entityId: row.vendor.entity_id };
    const address = textOf({ kind: plan.kind, id: plan.id, instant: row.occurrence_at });
    let local: { date: string; time: string };
    try {
      local = instantToZoned(row.occurrence_at, owner.zone);
    } catch (error) {
      // The zone /budget cannot read (days.ts reads it the same way): undated, listed — never skipped.
      stranded.push({ vendor, label: owner.name, line: owner.line, day: null, time: null, address, reason: undatedWords(owner.zone, error instanceof Error ? error.message : String(error)) });
      continue;
    }
    if (!days.includes(local.date)) continue;
    if (built.has(occurrenceKey({ routineId: owner.routineId, lineId: plan.kind === 'routine_line' ? plan.id : null, instant: row.occurrence_at }))) continue;
    stranded.push({ vendor, label: owner.name, line: owner.line, day: local.date, time: local.time, address, reason: STRANDED_WORDS });
  }
  stranded.sort((a, b) => cmpMaybe(a.day, b.day) || cmpMaybe(a.time, b.time) || cmp(a.label, b.label) || cmp(a.vendor.name, b.vendor.name));

  return { ok: true, plan: { listed: true, days, lines: matched.lines, stranded } };
}
