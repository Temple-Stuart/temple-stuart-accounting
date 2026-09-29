/**
 * VENDOR-01 (2026-09-29) — THE VENDOR IS PLANNED: who a plan's money is paid to.
 *
 * ONE RULE for the two routes that write a vendor: the directory's create
 * (src/app/api/operations/vendor-directory/route.ts POST) and a plan's vendor
 * (src/app/api/operations/plan-vendors/route.ts). They read and write; this
 * decides. Pure: no Prisma client, no request, no clock (planMoney.ts is the
 * model).
 *
 * D1 ONE VENDOR LIST, per book: the directory. A name is read one way —
 * trimmed, every run of whitespace one space, 1–200 characters (VarChar(200),
 * schema :3920) — and a name the book already has, ignoring case, IS that
 * vendor, active or archived.
 *
 * THE ADDRESS speaks the link route's words (linkKeys.ts LINKABLE_KINDS; the
 * links route's readTarget): a kind, an id, and an instant — so a plan's vendor
 * and the posting that paid it share one key. No instant is EVERY occurrence; an
 * instant is ONE. A task happens once and takes no instant.
 *
 * THE CHECKS the plan-vendors route asks, in order, each refusal named:
 *   (d) the plan as /budget reads it — the routine (or a line's routine) in the
 *       ONE loader's list for its book, the line among its active lines, a task
 *       in PLAN_TASK_STATUSES;
 *   (e) THE VENDOR SITS WHERE THE MONEY SITS (D4) — decided by routinePlanned,
 *       the leaf /budget uses, called exactly as days.ts calls it;
 *   (f) an instant is an occurrence /budget builds — the route runs
 *       buildRoutineBudgetLines for that one routine over occurrenceWindow(), and
 *       the EXACT address (days.ts :276) decides, among its lines or its
 *       not-placed list. Ruled D1 (b), 2026-09-29: the window is the instant's
 *       UTC day and two days either side. A routine-local day is never more than
 *       a day from the UTC day, so the window always holds the instant's
 *       routine-local day and both its neighbours, for every zone — and it needs
 *       no zone, so a routine /budget cannot place (its zone, its schedule) is
 *       refused in the builder's own words;
 *   (g) the vendor — the caller's, active, in the plan's book;
 *   (h) THE GRAIN (D2) — a plan holding one grain refuses the other. The
 *       database holds the same (the migration's trigger, tagged GRAIN_TAG).
 * A vendor never changes a figure (D5): nothing here reads or writes an amount
 * except to ask whether there is one.
 */
import { isValidUuid } from '@/lib/operations/parseUuid';
import { routinePlanned } from '@/lib/operations/routineLines';
import type { LinkableKind } from '@/lib/calendar/linkKeys';
import type { IsoDay } from '@/lib/budget/report';
import { PLAN_TASK_STATUSES, type DayRuleResult, type RoutinePlanInput } from '@/lib/budget/days';
import { BudgetInputError, utcDay } from '@/lib/budget/reportInputs';
import { instantToZoned } from '@/lib/time';

// ── REFUSALS ────────────────────────────────────────────────────────────────

/** A named refusal: nothing is written. 404 never confirms another user's row. */
export interface Refusal {
  readonly ok: false;
  readonly status: 400 | 404 | 409;
  readonly error: string;
  readonly message: string;
}

const refuse = (status: Refusal['status'], error: string, message: string): Refusal => ({ ok: false, status, error, message });

/** The fixed tag the migration's grain trigger opens its message with. */
export const GRAIN_TAG = 'PLAN_VENDOR_GRAIN';

// ── D1: THE NAME ────────────────────────────────────────────────────────────

/** operations_vendor_directory.vendor_name is VarChar(200) — counted in characters, as Postgres counts them. */
export const VENDOR_NAME_MAX = 200;

const spaced = (raw: string): string => raw.trim().replace(/\s+/g, ' ');

/** A typed name → the name as the directory keeps it, or why not. */
export function readVendorName(raw: unknown): { readonly ok: true; readonly name: string } | Refusal {
  if (typeof raw !== 'string') return refuse(400, 'bad-name', 'name must be text');
  const name = spaced(raw);
  const length = Array.from(name).length;
  if (length === 0) return refuse(400, 'bad-name', 'a vendor needs a name');
  if (length > VENDOR_NAME_MAX) return refuse(400, 'bad-name', `a vendor name is at most ${VENDOR_NAME_MAX} characters — this one is ${length}`);
  return { ok: true, name };
}

/** Two names are one vendor when, read the same way, they are equal ignoring case. */
export const vendorNameKey = (raw: string): string => spaced(raw).toLowerCase();

/** The book's vendor that already carries this name — active or archived — or null. */
export function takenBy<V extends { readonly vendor_name: string }>(name: string, vendors: readonly V[]): V | null {
  const key = vendorNameKey(name);
  return vendors.find((v) => vendorNameKey(v.vendor_name) === key) ?? null;
}

// ── THE ADDRESS ─────────────────────────────────────────────────────────────

export const PLAN_VENDOR_KINDS = ['routine_line', 'routine', 'project_task'] as const satisfies readonly LinkableKind[];
export type PlanVendorKind = (typeof PLAN_VENDOR_KINDS)[number];

export interface PlanAddress {
  readonly kind: PlanVendorKind;
  readonly id: string;
  /** The occurrence's instant, or null for every occurrence. */
  readonly instant: Date | null;
}

/** (b) kind, id, instant — the link route's words; an id that is not a UUID names no row: 404. */
export function readPlanAddress(kind: unknown, id: unknown, instant: unknown): { readonly ok: true; readonly address: PlanAddress } | Refusal {
  if (typeof kind !== 'string' || !(PLAN_VENDOR_KINDS as readonly string[]).includes(kind)) {
    return refuse(400, 'bad-kind', `kind must be one of ${PLAN_VENDOR_KINDS.join(', ')}`);
  }
  if (!isValidUuid(id)) return refuse(404, 'not-found', 'No such plan');
  let at: Date | null = null;
  if (instant !== undefined && instant !== null) {
    at = typeof instant === 'string' ? new Date(instant) : new Date(Number.NaN);
    if (Number.isNaN(at.getTime())) return refuse(400, 'bad-instant', 'instant is not a valid timestamp');
  }
  if (kind === 'project_task' && at !== null) {
    return refuse(400, 'bad-instant', 'project_task carries no occurrence instant — a task happens once: its vendor is for every occurrence');
  }
  return { ok: true, address: { kind: kind as PlanVendorKind, id, instant: at } };
}

// ── THE BOOK ────────────────────────────────────────────────────────────────

export interface Book {
  readonly id: string;
  readonly name: string;
  readonly entity_type: string;
}

/** The plan's book among the caller's — the report's own refusal when it is not one (reportInputs.ts entityOf). */
export function bookOf(books: readonly Book[], entityId: string, what: string): Book {
  const book = books.find((b) => b.id === entityId);
  if (!book) throw new BudgetInputError('unknown-entity', `${what} names entity ${entityId}, which is not one of the viewer's entities`);
  return book;
}

// ── (d) THE PLAN AS /budget READS IT ────────────────────────────────────────

/** A routine's plan input, from the ONE loader's list for its book (mapped by reportInputs.ts toRoutinePlanInput). */
export function routineAsBudgetReads(
  loaded: readonly RoutinePlanInput[],
  routine: { readonly id: string; readonly name: string },
  lineId: string | null,
): { readonly ok: true; readonly routine: RoutinePlanInput } | Refusal {
  const input = loaded.find((r) => r.id === routine.id);
  if (!input) return refuse(409, 'inactive', `"${routine.name}" is not active — /budget does not read it`);
  if (lineId !== null && !input.steps.some((s) => s.id === lineId && s.isActive !== false)) {
    return refuse(409, 'inactive', `this line is not an active line of "${routine.name}" — /budget does not read it`);
  }
  return { ok: true, routine: input };
}

export interface TaskFacts {
  readonly title: string;
  readonly status: string;
  /** estimated_cost_usd as a Decimal string, or null. */
  readonly estimatedCostUsd: string | null;
}

export function taskAsBudgetReads(task: TaskFacts): { readonly ok: true } | Refusal {
  if (!(PLAN_TASK_STATUSES as readonly string[]).includes(task.status)) {
    return refuse(409, 'inactive', `"${task.title}" is ${task.status} — /budget counts a task only when it is ${PLAN_TASK_STATUSES.join(', ')}`);
  }
  return { ok: true };
}

// ── (e) THE VENDOR SITS WHERE THE MONEY SITS ────────────────────────────────

const NO_MONEY = 'a vendor is who a plan\'s money is paid to';

/** routinePlanned, called exactly as buildRoutineBudgetLines calls it (days.ts). */
function plannedOf(routine: RoutinePlanInput) {
  return routinePlanned({
    budget_amount: routine.budgetAmount,
    coa_code: routine.coaCode,
    steps: routine.steps.map((s) => ({ id: s.id, is_active: s.isActive, step_order: s.stepOrder, budget_amount: s.budgetAmount, coa_code: s.coaCode })),
  });
}

export type PlanFacts =
  | { readonly kind: 'routine'; readonly routine: RoutinePlanInput }
  | { readonly kind: 'routine_line'; readonly routine: RoutinePlanInput; readonly lineId: string }
  | { readonly kind: 'project_task'; readonly task: TaskFacts };

export function moneyIsHere(plan: PlanFacts): { readonly ok: true } | Refusal {
  if (plan.kind === 'project_task') {
    return plan.task.estimatedCostUsd === null ? refuse(409, 'no-money', `this task carries no estimate — ${NO_MONEY}`) : { ok: true };
  }
  const planned = plannedOf(plan.routine);
  if (plan.kind === 'routine') {
    if (planned.from === 'routine') return { ok: true };
    if (planned.from === 'lines') return refuse(409, 'money-on-lines', 'this routine\'s figure is the sum of its lines — its vendor goes on the line');
    return refuse(409, 'no-money', `this routine carries no amount — ${NO_MONEY}`);
  }
  const line = planned.lines.find((l) => l.id === plan.lineId);
  if (planned.from === 'lines' && line !== undefined && line.amount !== null) return { ok: true };
  if (planned.from === 'routine') {
    return refuse(409, 'no-money', `this line carries no amount — ${NO_MONEY}; this routine's own figure is in force — its vendor goes on the routine`);
  }
  return refuse(409, 'no-money', `this line carries no amount — ${NO_MONEY}`);
}

// ── (f) AN OCCURRENCE /budget BUILDS ────────────────────────────────────────

const DAY_MS = 86_400_000;

/** Ruled D1 (b): the instant's UTC day and two days either side — every zone's local day and its neighbours. */
export function occurrenceWindow(instant: Date): { readonly rangeFrom: IsoDay; readonly rangeTo: IsoDay } {
  return { rangeFrom: utcDay(new Date(instant.getTime() - 2 * DAY_MS)), rangeTo: utcDay(new Date(instant.getTime() + 2 * DAY_MS)) };
}

/** The budget line's sourceId this occurrence has (days.ts :276 — `routine:<routine>:<line:<id> | routine>:<instant>`). */
export function occurrenceSourceId(routineId: string, address: PlanAddress & { readonly instant: Date }): string {
  const item = address.kind === 'routine_line' ? `line:${address.id}` : 'routine';
  return `routine:${routineId}:${item}:${address.instant.toISOString()}`;
}

/** Does the builder's own output hold this exact occurrence — placed or not placed? */
export function occurrenceIn(
  built: DayRuleResult,
  routine: { readonly id: string; readonly name: string },
  address: PlanAddress & { readonly instant: Date },
): { readonly ok: true; readonly day: IsoDay | null } | Refusal {
  const whole = built.notPlaced.find((n) => n.sourceId === `routine:${routine.id}`);
  if (whole) return refuse(409, 'cannot-place', `/budget cannot place "${routine.name}": ${whole.reason}${whole.detail === null ? '' : ` — ${whole.detail}`}`);
  const key = occurrenceSourceId(routine.id, address);
  const line = built.lines.find((l) => l.sourceId === key);
  if (line) return { ok: true, day: line.day };
  const notPlaced = built.notPlaced.find((n) => n.sourceId === key);
  if (notPlaced) return { ok: true, day: notPlaced.day };
  return refuse(409, 'not-an-occurrence', `"${routine.name}" has no occurrence at ${address.instant.toISOString()} — /budget builds none at that instant`);
}

// ── (g) THE VENDOR ──────────────────────────────────────────────────────────

export interface VendorFacts {
  readonly id: string;
  readonly vendor_name: string;
  readonly entity_id: string;
  readonly is_active: boolean;
}

const bookName = (books: readonly Book[], entityId: string): string => {
  const book = books.find((b) => b.id === entityId);
  return book ? book.name : `entity ${entityId}, which is not one of your books`;
};

export function vendorFits(vendor: VendorFacts | null, planBook: Book, books: readonly Book[]): { readonly ok: true; readonly vendor: VendorFacts } | Refusal {
  if (vendor === null) return refuse(404, 'not-found', 'No such vendor');
  if (!vendor.is_active) return refuse(409, 'vendor-archived', `"${vendor.vendor_name}" is archived — a plan names an active vendor`);
  if (vendor.entity_id !== planBook.id) {
    return refuse(409, 'other-book', `"${vendor.vendor_name}" is a vendor of ${bookName(books, vendor.entity_id)}; this plan is in ${planBook.name} — a plan's vendor comes from its own book`);
  }
  return { ok: true, vendor };
}

// ── (h) THE GRAIN ───────────────────────────────────────────────────────────

/** A vendor row the plan already holds. */
export interface HeldVendor {
  readonly id: string;
  readonly occurrenceAt: Date | null;
  readonly vendorId: string;
  readonly vendorName: string;
}

/**
 * A plan holding one grain refuses the other (D2). The occurrences a plan holds
 * are named by their routine-local days — the routine's zone, the day /budget
 * places them on. A task holds no occurrence (the migration's CHECK).
 */
export function grainAllows(
  address: PlanAddress,
  held: readonly HeldVendor[],
  timezone: string | null,
): { readonly ok: true; readonly existing: HeldVendor | null } | Refusal {
  const every = held.find((h) => h.occurrenceAt === null) ?? null;
  if (address.instant !== null) {
    if (every !== null) {
      return refuse(409, 'grain', `this plan's vendor is "${every.vendorName}" for every occurrence — clear it before choosing one for a single occurrence`);
    }
    const at = address.instant.getTime();
    return { ok: true, existing: held.find((h) => h.occurrenceAt !== null && h.occurrenceAt.getTime() === at) ?? null };
  }
  const single = held.filter((h) => h.occurrenceAt !== null).sort((a, b) => (a.occurrenceAt as Date).getTime() - (b.occurrenceAt as Date).getTime());
  if (single.length > 0) {
    if (timezone === null) throw new Error(`VENDOR-01: a plan with no zone holds ${single.length} single-occurrence vendor(s) — a task never carries an occurrence`);
    const days = [...new Set(single.map((h) => instantToZoned(h.occurrenceAt as Date, timezone).date))];
    return refuse(409, 'grain', `this plan holds a vendor for ${single.length} single occurrence${single.length === 1 ? '' : 's'} (${days.slice(0, 3).join(', ')}${days.length > 3 ? ', …' : ''}) — clear them before setting one vendor for every occurrence`);
  }
  return { ok: true, existing: every };
}

/** The write the address takes: the same vendor is unchanged, another replaces it, none creates. */
export function writeFor(existing: HeldVendor | null, vendorId: string): 'create' | 'replace' | 'unchanged' {
  if (existing === null) return 'create';
  return existing.vendorId === vendorId ? 'unchanged' : 'replace';
}

/**
 * Is this database error the migration's grain trigger refusing a row? The tag is
 * looked for in the error's message and, for a client error that carries one, its
 * meta — where the driver puts the database's own words.
 */
export function isGrainRefusal(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const meta = (error as { meta?: unknown }).meta;
  return error.message.includes(GRAIN_TAG) || (meta !== undefined && JSON.stringify(meta).includes(GRAIN_TAG));
}
