/**
 * TAB13-03 (2026-09-29) — WHAT /budget SHOWS, READ FROM THE URL. PURE.
 *
 * BUDGET-02 (2026-10-20) — BUDGET IS ONE PAGE, ruled by Alex. /budget shows the
 * three tables and nothing else; the only control is ‹ year ›, and the URL's
 * only key is ?year=YYYY (none → the viewer's current year). The DAY and WEEK
 * views, the section chips, the account filter, the "what this view is missing"
 * notice and the vendor box left the screen, and their helpers left this file
 * (the route's DAY and WEEK views stay — the Tasks day and week cards read them).
 * What is here:
 *
 *   · the year the URL names, ‹ › one year, the report's query;
 *   · each table's label (ruling B): its book's label, and "<label> · <book
 *     name>" when two books share a type — never re-typed;
 *   · the drill (ruling E): the cell route's query for a figure, which Budget
 *     figure the drill lists (to date, or the full budget), whether the panel's
 *     sum matches the cell it opened from (blank is never subtracted as 0), and
 *     "open in Books" → /ledger?account=&book=&from=&to= (ruling F). A plan
 *     line's door is built by the route (reportInputs.ts budgetCellResponse).
 *
 * shiftDay stays: the Tasks day card, the move control and two operations
 * modules import it. vendorChoices stays: the vendor box (VendorBox.tsx — what
 * was DayPlanDrill.tsx, less the drill) is mounted by the Tasks stop and expense
 * forms, and it offers names by it.
 *
 * Pure (the budget report purity law's fifth root, scripts/assert-tool-registry.ts):
 * no framework, no network, no environment, and no clock — today is handed in by
 * the screen, the one place that reads it.
 */
import type { ReportBook, ReportColumn, ShownBudget } from './report';
import { formatCents } from './format';
import { readVendorName, takenBy, vendorNameKey } from '@/lib/operations/planVendor';

/** A 'YYYY-MM-DD' day moved by n days, by UTC arithmetic (no zone can shift it). */
export function shiftDay(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00.000Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

// ── THE YEAR (ruling A) ─────────────────────────────────────────────────────

const YEAR = /^\d{4}$/;

/** The year the URL names, as written, or the viewer's current year when it names none. Anything else passes to the route, which refuses it by name. */
export function yearOf(search: URLSearchParams, today: string): string {
  const year = search.get('year');
  return year === null ? today.slice(0, 4) : year;
}

/** '/budget?year=YYYY' — the page's one key. */
export function yearHref(year: string): string {
  return `/budget?year=${encodeURIComponent(year)}`;
}

/** ‹ › — one year back or forward. Null when the year is not four digits (the route's refusal says why on screen). */
export function stepYear(year: string, direction: -1 | 1): string | null {
  if (!YEAR.test(year)) return null;
  const next = Number(year) + direction;
  if (next < 1 || next > 9999) return null;
  return String(next).padStart(4, '0');
}

/** GET /api/budget/report's query for a year as of the viewer's today. */
export function reportQuery(year: string, asOf: string): string {
  const q = new URLSearchParams();
  q.set('view', 'year');
  q.set('year', year);
  q.set('asOf', asOf);
  return q.toString();
}

// ── THE TABLES (ruling B) ───────────────────────────────────────────────────

/** Each table's label, in the books' order: its book's label, and "<label> · <book name>" when another book shares the label. */
export function tableLabels(books: readonly Pick<ReportBook, 'entityName' | 'label'>[]): readonly string[] {
  const shared = (label: string): boolean => books.filter((b) => b.label === label).length > 1;
  return books.map((b) => (shared(b.label) ? `${b.label} · ${b.entityName}` : b.label));
}

// ── THE DRILL (rulings E, F, G) ─────────────────────────────────────────────

/** GET /api/budget/report/cell's query for one row's figures in one column. */
export function cellQuery(book: string, code: string, column: Pick<ReportColumn, 'from' | 'to'>, asOf: string): string {
  const q = new URLSearchParams();
  q.set('book', book);
  q.set('account', code);
  q.set('from', column.from);
  q.set('to', column.to);
  q.set('asOf', asOf);
  return q.toString();
}

/** Which Budget figure the drill lists — the one the cell prints (report.ts shownBudget). */
export function budgetDrillWords(budget: { readonly shown: ShownBudget; readonly from: string; readonly through: string }): string {
  return budget.shown === 'toDate'
    ? `the budget to date — plan lines dated ${budget.from} to ${budget.through}`
    : `the full planned budget — plan lines dated ${budget.from} to ${budget.through}`;
}

/** The ledger lines' words: the days they cover. */
export function actualDrillWords(actual: { readonly from: string; readonly through: string | null }): string {
  return actual.through === null ? 'nothing has posted yet — the range is in the future' : `ledger lines dated ${actual.from} to ${actual.through}, reversal pairs and year-end closing entries left out`;
}

export interface Agreement {
  readonly matches: boolean;
  readonly words: string;
}

/**
 * The panel's own sum against the figure the viewer clicked: "matches the cell",
 * or the cell's figure and the difference — never hidden.
 */
export function agreement(sum: number | null, cell: number | null): Agreement {
  if (sum === cell) return { matches: true, words: 'matches the cell' };
  // Blank is not zero: a side with nothing is said in words, never subtracted as 0.
  if (sum === null) return { matches: false, words: `no lines were found — the cell prints ${formatCents(cell)}` };
  if (cell === null) return { matches: false, words: `the cell is blank — these lines sum to ${formatCents(sum)}` };
  const difference = sum - cell;
  if (!Number.isSafeInteger(difference)) throw new Error(`BUDGET VIEW: the drill's difference left the safe integer range of cents (${difference})`);
  return { matches: false, words: `the cell prints ${formatCents(cell)} — these lines differ from it by ${formatCents(difference)}` };
}

/** "open in Books" (ruling F) — the general ledger filtered to the account, the book and the actual's days. */
export function ledgerHref(code: string, book: string, from: string, to: string): string {
  const q = new URLSearchParams();
  q.set('account', code);
  q.set('book', book);
  q.set('from', from);
  q.set('to', to);
  return `/ledger?${q.toString()}`;
}

// ── THE VENDOR BOX'S OFFER (TAB13-04) ───────────────────────────────────────

/** A vendor as GET /api/operations/vendor-directory gives it — the caller's ACTIVE vendors only (its where: is_active true). */
export interface DirectoryVendor {
  readonly id: string;
  readonly vendor_name: string;
  readonly entity_id: string;
}

export interface VendorChoices {
  /** The line's book's vendors whose name, read by the one rule, holds what was typed — by name. */
  readonly offered: readonly DirectoryVendor[];
  /** The book's vendor that IS the typed name (D1: ignoring case and spacing) — then nothing is added. */
  readonly exact: DirectoryVendor | null;
  /** The name to add to the book, as the directory would keep it — when the book has none. */
  readonly add: string | null;
  /** Why the typed name cannot be added, in the rule's words. */
  readonly refusal: string | null;
}

/** What the vendor box offers as a name is typed: the line's book only, by the ONE name rule. A blank offers nothing. */
export function vendorChoices(typed: string, vendors: readonly DirectoryVendor[], bookId: string): VendorChoices {
  const key = vendorNameKey(typed);
  if (key === '') return { offered: [], exact: null, add: null, refusal: null };
  const book = vendors.filter((v) => v.entity_id === bookId);
  const offered = book
    .filter((v) => vendorNameKey(v.vendor_name).includes(key))
    .sort((a, b) => (vendorNameKey(a.vendor_name) < vendorNameKey(b.vendor_name) ? -1 : vendorNameKey(a.vendor_name) > vendorNameKey(b.vendor_name) ? 1 : 0));
  const exact = takenBy(typed, book);
  if (exact !== null) return { offered, exact, add: null, refusal: null };
  const name = readVendorName(typed);
  return name.ok ? { offered, exact: null, add: name.name, refusal: null } : { offered, exact: null, add: null, refusal: name.message };
}
