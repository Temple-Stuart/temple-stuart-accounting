/**
 * BILLPAY-01 (Alex, 2026-10-28) — BILL PAY: EVERY BILL, EVERY DUE DAY, PAID OR NOT. THE PURE RULE.
 *
 * Ruling A — A BILL is a routine line (or a stepless routine) whose routine's role is all_day, that carries an amount
 * (the LINES-01 leaf, routinePlanned, decides the grain), and that names an EVERY-OCCURRENCE vendor (planned_item_vendors,
 * occurrence_at null — the plan-vendor grain rule, planLines.ts planHoldsOf). Nothing else is a bill. The all-day costed
 * plans WITHOUT such a vendor are not rows: one line under the table names them (noVendorWords).
 *
 * Ruling B — one row per bill per DUE day in the window [from, to]: the budget's own occurrence builder
 * (src/lib/budget/days.ts buildRoutineBudgetLines — the occurrence's local day in the routine's OWN zone, the window the
 * Budget expands over, so a stepless routine anchored at 1971 is clipped to it), its key (occurrenceKey) as the row's ID.
 * An occurrence the builder could place but whose account it could not read ('no account', 'account code not recognised')
 * is still a due day — a row, its ACCOUNT cell saying so; one it could not cost ('amount not whole cents') is a row with a
 * blank AMOUNT, never 0. A routine it could not read at all (its zone, its schedule, its start) is said by name.
 *
 *   · PAID — the postings linked to THAT occurrence exactly (kind, target_id, target_instant — the ledger's join, linkKeyOf),
 *     through LINK-LAW-01's one rule (ledger.ts matchOf): a reversed posting is left out and counted; blank when nothing
 *     pays it, or when a paying posting's amount cannot be read (said, never summed as zero).
 *   · PAID FROM — the account the paying postings were credited from: the credit ledger line's chart account (a bank posting
 *     is DR expense / CR bank — journal-entry-service.ts commitPlaidTransaction), read by BILL_POSTING_SELECT; two or more
 *     accounts are "several accounts"; blank when unpaid.
 *   · STATUS — paid when a non-reversed posting is linked; else, against TODAY IN THE ROUTINE'S OWN ZONE (endedBy's
 *     precedent, rruleHelpers.ts): overdue when the due day is before it, due today on it, upcoming after it. A link of a
 *     bill whose instant is no occurrence of its routine (linkOccurrence.ts occurrenceCheck) is a row of its own, "link off
 *     the rule" — never counted as paid or unpaid.
 *
 * Every rule is imported, none restated: routinePlanned, buildRoutineBudgetLines, occurrenceKey, readOccurrenceKey,
 * planHoldsOf, matchOf, readableMatchCents, linkKeyOf, amountCentsOf, isReversedPosting, occurrenceCheck, stopName,
 * accountCellsOf, bookNameOf, dayWords, deriveAccountString. Pure: no Prisma, no request, no clock — `now` is the caller's.
 * Nothing here pays, schedules or writes anything (ruling D).
 */
import { buildRoutineBudgetLines, isIsoDay, occurrenceKey, readOccurrenceKey, type NotPlaced, type NotPlacedReason, type RoutinePlanInput } from '@/lib/budget/days';
import { planHoldsOf, type PlanVendorRow } from '@/lib/budget/planLines';
import { routinePlanned } from '@/lib/operations/routineLines';
import { linkKeyOf, matchOf, readableMatchCents, type LedgerMatch } from '@/lib/operations/ledger';
import { occurrenceCheck } from '@/lib/operations/linkOccurrence';
import { amountCentsOf, isReversedPosting, reversedLinkedWords, type PostingState } from '@/lib/calendar/postingAmount';
import { stopName } from '@/components/workbench/operations/day/dayCard';
import { accountCellsOf, bookNameOf, dayWords, moneyColumn, textColumn, valueColumn, type WorkBook, type WorkCharts } from '@/lib/operations/work';
import { deriveAccountString } from '@/lib/accountString';
import type { TableColumn } from '@/lib/table/columns';
import { instantToZoned } from '@/lib/time';

// ── THE INPUT ───────────────────────────────────────────────────────────────

/** A routine as /budget reads it (reportInputs.ts toRoutinePlanInput), with its role and its lines' names (the loader's). */
export interface BillRoutine {
  readonly plan: RoutinePlanInput;
  /** operations_routines.role — a bill's routine is 'all_day'. */
  readonly role: string;
  /** The active lines' names by id (operations_routine_steps.activity) — SUB ACCOUNT NAME, by stopName's rule. */
  readonly lineNames: Readonly<Record<string, string>>;
}

/** A linked posting as the route reads it: its state (LINK-LAW-01) and its lines with each line's chart account (PAID FROM). */
export interface BillPosting extends PostingState {
  readonly ledger_entries: readonly { readonly entry_type: string; readonly amount: bigint; readonly account: { readonly code: string; readonly name: string; readonly entity_id: string } }[];
}

/** A planned_item_links row of a routine kind, as the route selects it. */
export interface BillLinkRow {
  readonly target_kind: string;
  readonly target_id: string;
  readonly target_instant: Date | null;
  readonly journal_entry_id: string;
  readonly journal_entry: BillPosting;
}

export interface BillPayInput {
  /** The window, local days 'YYYY-MM-DD', inclusive — validated by the route (ledger.ts spanInput). */
  readonly from: string;
  readonly to: string;
  /** The route's clock, read once — today is judged in each routine's own zone against it. */
  readonly now: Date;
  /** The caller's books (entities: id, name, entity_type) — BOOK, and the account's letter. */
  readonly books: readonly WorkBook[];
  /** Each book's chart — ACCOUNT NAME (work.ts chartNameOf through accountCellsOf). */
  readonly charts: WorkCharts;
  /** The caller's active routines, every role — the rule keeps the all_day ones. */
  readonly routines: readonly BillRoutine[];
  /** The caller's plan-vendor rows (reportReads.ts readPlanVendors): every-occurrence rows, and occurrence rows in the window. */
  readonly vendors: readonly PlanVendorRow[];
  /** The caller's links of a routine kind whose instant can fall in the window, one read. */
  readonly links: readonly BillLinkRow[];
}

// ── THE OUTPUT ──────────────────────────────────────────────────────────────

export const BILL_STATUSES = ['paid', 'due today', 'upcoming', 'overdue', 'link off the rule'] as const;
export type BillStatus = (typeof BILL_STATUSES)[number];
/** The statuses a payment is still owed on — the row's "link payment" control (ruling D). */
export const UNPAID_STATUSES: readonly BillStatus[] = ['due today', 'upcoming', 'overdue'];

export interface BillRow {
  /** The occurrence key (days.ts occurrenceKey) — the row's ID. */
  readonly id: string;
  /** DUE — the occurrence's local day in the routine's own zone, 'YYYY-MM-DD'. */
  readonly due: string;
  readonly kind: 'routine' | 'routine_line';
  /** The link address — (kind, target_id, instant): the picker's props, the ledger's join. */
  readonly target_id: string;
  readonly instant: string;
  readonly routine_id: string;
  readonly book: string;
  readonly account: string | null;
  readonly account_name: string | null;
  readonly sub_account: string;
  readonly vendor: string;
  readonly bill: string;
  /** AMOUNT — the occurrence's planned amount in cents; null when it is not whole cents (said) or for a link off the rule. */
  readonly amount_cents: number | null;
  /** PAID — readableMatchCents over the occurrence's links; null when nothing pays it or a paying amount is unreadable. */
  readonly paid_cents: number | null;
  readonly paid_postings: number;
  readonly paid_unreadable: number;
  readonly paid_reversed: number;
  readonly paid_from: string | null;
  readonly status: BillStatus;
}

export type BillPayResult =
  | { readonly ok: true; readonly from: string; readonly to: string; readonly rows: readonly BillRow[]; readonly said: readonly string[] }
  | { readonly ok: false; readonly code: string; readonly message: string };

// ── THE WORDS ───────────────────────────────────────────────────────────────

export const KIND_WORDS: Readonly<Record<BillRow['kind'], string>> = { routine: 'routine', routine_line: 'routine line' };
export const SEVERAL_ACCOUNTS_WORDS = 'several accounts';
export const NO_CREDIT_LINE_WORDS = 'no credit line read';
export const LINK_PAYMENT_WORDS = 'link payment';
export const PAYMENT_WORDS = 'payment';
/** Ruling A's line: the all-day costed plans that name no every-occurrence vendor, by name. */
export function noVendorWords(names: readonly string[]): string {
  const n = names.length;
  return n === 1
    ? `1 all-day expense names no vendor — not a bill until it does: ${names[0]}`
    : `${n} all-day expenses name no vendor — not bills until they do: ${names.join(', ')}`;
}
export const unreadablePaidWords = (n: number): string => `${n} linked posting${n === 1 ? ' carries' : 's carry'} no readable amount — PAID is blank on ${n === 1 ? 'its row' : 'their rows'}`;
export const notPlacedWords = (n: NotPlaced): string => `${n.label}: its due days cannot be placed — ${n.reason}${n.detail === null ? '' : ` (${n.detail})`}`;
export const unplacedLinkWords = (journalEntryId: string, bill: string, instant: string): string =>
  `link ${journalEntryId} sits on an occurrence of ${JSON.stringify(bill)} (${instant}) this window did not place`;

/** The reasons the builder gives for an occurrence it placed on its day but could not book — still a due day, still a row. */
const DUE_DAY_REASONS: readonly NotPlacedReason[] = ['no account', 'account code not recognised', 'amount not whole cents'];

const planKeyOf = (kind: 'routine' | 'routine_line', id: string): string => `${kind}:${id}`;
const isoOf = (d: Date): string => d.toISOString();
const utcMidnight = (day: string | null): Date | null => (day === null ? null : new Date(`${day}T00:00:00.000Z`));

// ── THE RULE ────────────────────────────────────────────────────────────────

/** A paying posting's credit accounts, as one cell: the account and its name, "several accounts", or the reason none was read. */
function paidFromOf(postings: readonly BillPosting[], books: readonly WorkBook[]): string | null {
  if (postings.length === 0) return null;
  const accounts = new Map<string, string>();
  for (const p of postings) {
    for (const line of p.ledger_entries) {
      if (line.entry_type !== 'C') continue;
      const book = books.find((b) => b.id === line.account.entity_id);
      const account = deriveAccountString({ entityType: book?.entity_type, code: line.account.code });
      accounts.set(`${line.account.entity_id}:${line.account.code}`, `${account} · ${line.account.name}`);
    }
  }
  if (accounts.size === 0) return NO_CREDIT_LINE_WORDS;
  if (accounts.size > 1) return SEVERAL_ACCOUNTS_WORDS;
  return [...accounts.values()][0];
}

export function billPayOf(input: BillPayInput): BillPayResult {
  const { from, to, now, books, charts } = input;
  if (!isIsoDay(from) || !isIsoDay(to) || from > to) throw new Error(`billPay: ${JSON.stringify(from)}..${JSON.stringify(to)} is not a span of days`);
  const said: string[] = [];

  // THE VENDORS — the plan's one grain; a row the database should not hold fails the read by name (routineMonth's rule).
  const grain = planHoldsOf(input.vendors);
  const unreadable = grain.refusals.find((r) => r.code !== 'plan-vendor-both-grains');
  if (unreadable !== undefined) return { ok: false, code: unreadable.code, message: unreadable.message };
  const bothGrains = new Map(grain.refusals.filter((r) => r.code === 'plan-vendor-both-grains').map((r) => [r.plan as string, r.message]));
  const everyVendorOf = (key: string): string | null => {
    const refused = bothGrains.get(key);
    if (refused !== undefined) return refused;
    const held = grain.holds.get(key);
    return held === undefined || held.every === null ? null : held.every.vendor.vendor_name;
  };

  // THE BILLS — the all-day routines' costed plans (routinePlanned decides the grain) that name an every-occurrence vendor.
  const allDay = input.routines.filter((r) => r.role === 'all_day');
  const bills = new Map<string, { readonly routine: BillRoutine; readonly lineId: string | null; readonly vendor: string; readonly name: string }>();
  const noVendor: string[] = [];
  for (const routine of allDay) {
    const p = routine.plan;
    const planned = routinePlanned({
      budget_amount: p.budgetAmount,
      coa_code: p.coaCode,
      steps: p.steps.map((s) => ({ id: s.id, is_active: s.isActive, step_order: s.stepOrder, budget_amount: s.budgetAmount, coa_code: s.coaCode })),
    });
    const plans = planned.from === 'lines'
      ? planned.lines.filter((l) => l.amount !== null).map((l) => ({ kind: 'routine_line' as const, id: l.id, lineId: l.id as string | null }))
      : planned.from === 'routine' ? [{ kind: 'routine' as const, id: p.id, lineId: null as string | null }] : [];
    for (const plan of plans) {
      const name = stopName({ line: plan.lineId === null ? null : routine.lineNames[plan.lineId] ?? null, label: p.name });
      const vendor = everyVendorOf(planKeyOf(plan.kind, plan.id));
      if (vendor === null) noVendor.push(name);
      else bills.set(planKeyOf(plan.kind, plan.id), { routine, lineId: plan.lineId, vendor, name });
    }
  }
  if (noVendor.length > 0) said.push(noVendorWords([...noVendor].sort((a, b) => a.localeCompare(b))));

  // THE DUE DAYS — the budget's builder over the window, for the bills' routines alone.
  const billRoutines = [...new Map([...bills.values()].map((b) => [b.routine.plan.id, b.routine])).values()];
  const built = buildRoutineBudgetLines(billRoutines.map((r) => r.plan), from, to);
  const occurrences: { readonly sourceId: string; readonly day: string; readonly cents: number | null }[] = built.lines.map((l) => ({ sourceId: l.sourceId, day: l.day, cents: l.cents }));
  for (const n of built.notPlaced) {
    // A due day the builder placed but could not book is still a row; a routine it could not read at all is said by name.
    if (n.day !== null && DUE_DAY_REASONS.includes(n.reason)) occurrences.push({ sourceId: n.sourceId, day: n.day, cents: n.cents });
    else said.push(notPlacedWords(n));
  }

  // THE LINKS — by the ledger's join key; one map, no query per occurrence.
  const linksByKey = new Map<string, BillLinkRow[]>();
  for (const l of input.links) {
    if (l.target_kind !== 'routine' && l.target_kind !== 'routine_line') throw new Error(`billPay: link ${l.journal_entry_id} is of kind ${JSON.stringify(l.target_kind)} — the read asked for routine or routine_line`);
    if (l.target_instant === null) throw new Error(`billPay: link ${l.journal_entry_id} of kind ${l.target_kind} has no instant — the migration's CHECK holds one`);
    const k = linkKeyOf(l.target_kind, l.target_id, isoOf(l.target_instant));
    linksByKey.set(k, [...(linksByKey.get(k) ?? []), l]);
  }

  const todayOf = new Map<string, string>();
  const today = (r: BillRoutine): string => {
    const known = todayOf.get(r.plan.id);
    if (known !== undefined) return known;
    const day = instantToZoned(now, r.plan.timezone).date;
    todayOf.set(r.plan.id, day);
    return day;
  };
  const cellsOf = (bill: { readonly routine: BillRoutine; readonly lineId: string | null }) => {
    const p = bill.routine.plan;
    const saved = bill.lineId === null ? p.coaCode : p.steps.find((s) => s.id === bill.lineId)?.coaCode ?? null;
    const account = accountCellsOf(books, charts, p.entityId, saved);
    return { book: bookNameOf(books, p.entityId), account: account.account, account_name: account.name };
  };

  const rows: BillRow[] = [];
  const joined = new Set<string>();
  let reversed = 0;
  let unreadableAmounts = 0;
  for (const o of occurrences) {
    const read = readOccurrenceKey(o.sourceId);
    if (read === null || read.routineId === null || read.address.instant === null || read.address.kind === 'project_task') throw new Error(`billPay: budget line ${JSON.stringify(o.sourceId)} is no routine occurrence's key`);
    const kind = read.address.kind;
    const bill = bills.get(planKeyOf(kind, read.address.id));
    if (bill === undefined) continue; // a costed plan of a bill's routine that names no vendor — said in the no-vendor line
    const instant = isoOf(read.address.instant);
    const key = linkKeyOf(kind, read.address.id, instant);
    const links = linksByKey.get(key) ?? [];
    if (links.length > 0) joined.add(key);
    const match: LedgerMatch | null = matchOf(links.map((l) => ({ amountCents: amountCentsOf(l.journal_entry), reversed: isReversedPosting(l.journal_entry) })));
    reversed += match === null ? 0 : match.reversed;
    unreadableAmounts += match === null ? 0 : match.unreadable;
    const paying = links.filter((l) => !isReversedPosting(l.journal_entry)).map((l) => l.journal_entry);
    const paid = match !== null && match.postings > 0;
    const t = today(bill.routine);
    rows.push({
      id: o.sourceId,
      due: o.day,
      kind,
      target_id: read.address.id,
      instant,
      routine_id: read.routineId,
      ...cellsOf(bill),
      sub_account: bill.name,
      vendor: bill.vendor,
      bill: bill.routine.plan.name,
      amount_cents: o.cents,
      paid_cents: readableMatchCents(match),
      paid_postings: match === null ? 0 : match.postings,
      paid_unreadable: match === null ? 0 : match.unreadable,
      paid_reversed: match === null ? 0 : match.reversed,
      paid_from: paid ? paidFromOf(paying, books) : null,
      status: paid ? 'paid' : o.day < t ? 'overdue' : o.day === t ? 'due today' : 'upcoming',
    });
  }

  // A BILL'S LINK THAT JOINED NO DUE DAY — off the rule (its own row), or an occurrence this window did not place (said).
  for (const [key, links] of linksByKey) {
    if (joined.has(key)) continue;
    const first = links[0];
    const kind = first.target_kind as 'routine' | 'routine_line';
    const bill = bills.get(planKeyOf(kind, first.target_id));
    if (bill === undefined) continue; // not a bill's link — not this table's
    const p = bill.routine.plan;
    const at = first.target_instant as Date;
    const day = instantToZoned(at, p.timezone).date;
    if (day < from || day > to) continue; // the read's window is wider than the days shown
    const check = occurrenceCheck({ name: p.name, timezone: p.timezone, schedule_rrule: p.scheduleRrule, start_date: utcMidnight(p.startDate), end_date: utcMidnight(p.endDate) }, at);
    if (check.ok) {
      for (const l of links) said.push(unplacedLinkWords(l.journal_entry_id, p.name, isoOf(at)));
      continue;
    }
    rows.push({
      id: occurrenceKey({ routineId: p.id, lineId: bill.lineId, instant: at }),
      due: day,
      kind,
      target_id: first.target_id,
      instant: isoOf(at),
      routine_id: p.id,
      ...cellsOf(bill),
      sub_account: bill.name,
      vendor: bill.vendor,
      bill: p.name,
      amount_cents: null,
      paid_cents: null,
      paid_postings: 0,
      paid_unreadable: 0,
      paid_reversed: 0,
      paid_from: null,
      status: 'link off the rule',
    });
  }

  if (reversed > 0) said.push(reversedLinkedWords(reversed));
  if (unreadableAmounts > 0) said.push(unreadablePaidWords(unreadableAmounts));
  rows.sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : a.bill.localeCompare(b.bill) || a.sub_account.localeCompare(b.sub_account) || a.instant.localeCompare(b.instant)));
  return { ok: true, from, to, rows, said };
}

// ── THE TABLE (ruling B — the house's order; IDIOM-01's shared factories) ─────────────────────────────

export const BILL_PAY_TABLE_NAME = 'bill-pay';
export const BILL_COLUMNS = ['due', 'kind', 'book', 'account', 'account_name', 'sub_account', 'vendor', 'bill', 'amount', 'paid', 'paid_from', 'status', 'id'] as const;
export type BillColumn = (typeof BILL_COLUMNS)[number];
export const BILL_HEAD_WORDS: Readonly<Record<BillColumn, string>> = {
  due: 'DUE', kind: 'KIND', book: 'BOOK', account: 'ACCOUNT', account_name: 'ACCOUNT NAME', sub_account: 'SUB ACCOUNT NAME',
  vendor: 'VENDOR', bill: 'BILL', amount: 'AMOUNT', paid: 'PAID', paid_from: 'PAID FROM', status: 'STATUS', id: 'ID',
};

/** The spec — every cell a reader of the row the route answered; nothing computed here. */
export function billPayTable(): readonly TableColumn<BillRow, BillColumn>[] {
  const head = BILL_HEAD_WORDS;
  return [
    valueColumn<BillRow, BillColumn>('due', head.due, (r) => dayWords(r.due), (r) => r.due),
    valueColumn<BillRow, BillColumn>('kind', head.kind, (r) => KIND_WORDS[r.kind]),
    valueColumn<BillRow, BillColumn>('book', head.book, (r) => r.book),
    valueColumn<BillRow, BillColumn>('account', head.account, (r) => r.account),
    valueColumn<BillRow, BillColumn>('account_name', head.account_name, (r) => r.account_name),
    textColumn<BillRow, BillColumn>('sub_account', head.sub_account, (r) => r.sub_account),
    valueColumn<BillRow, BillColumn>('vendor', head.vendor, (r) => r.vendor),
    textColumn<BillRow, BillColumn>('bill', head.bill, (r) => r.bill),
    moneyColumn<BillRow, BillColumn>('amount', head.amount, (r) => r.amount_cents),
    moneyColumn<BillRow, BillColumn>('paid', head.paid, (r) => r.paid_cents),
    valueColumn<BillRow, BillColumn>('paid_from', head.paid_from, (r) => r.paid_from),
    valueColumn<BillRow, BillColumn>('status', head.status, (r) => r.status),
    textColumn<BillRow, BillColumn>('id', head.id, (r) => r.id),
  ];
}

/** The viewer's calendar month in full, and the month either side — ‹ month › (ruling B). */
export function monthWindowOf(day: string): { readonly from: string; readonly to: string } {
  if (!isIsoDay(day)) throw new Error(`billPay: ${JSON.stringify(day)} is not a 'YYYY-MM-DD' day`);
  const y = Number(day.slice(0, 4));
  const m = Number(day.slice(5, 7));
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return { from: `${day.slice(0, 7)}-01`, to: last };
}
export function shiftMonth(from: string, by: number): { readonly from: string; readonly to: string } {
  const d = new Date(Date.UTC(Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 1 + by, 1));
  return monthWindowOf(d.toISOString().slice(0, 10));
}
export const monthWords = (from: string): string => new Date(`${from}T00:00:00.000Z`).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
export const billPayCsvFileName = (from: string): string => `bill-pay-${from.slice(0, 7)}.csv`;
export const BILL_PAY_LOADING_WORDS = 'Reading the bills…';
export const billPayFailedWords = (words: string): string => `Bill Pay could not be read — ${words}`;
export const NO_BILLS_WORDS = 'No bill falls due in this month.';
