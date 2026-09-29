/**
 * TAB13-03 (2026-09-29) — WHAT /budget SHOWS, READ FROM THE URL. PURE.
 *
 * The URL is the screen's only state (BudgetReport.tsx keeps no browser
 * storage): the VIEW (?view=day&day= · week&weekOf= · year&year=), the SECTION
 * (?book=<entityId>; none → OVERVIEW) and, on a book, the ACCOUNT filter
 * (?account=<the four digits the model gives a row>). This file reads those keys
 * and builds every link the screen follows, so a link can never drop a key:
 *
 *   · DAY · WEEK · YEAR and ‹ › keep the book and the account;
 *   · choosing a section keeps the view and CLEARS the account;
 *   · choosing an account keeps the view and the book.
 *
 * A choice the URL makes that the report cannot honour is REFUSED BY NAME —
 * never a silent switch to OVERVIEW or to all accounts: a book that is not in
 * the report, an account that is not four digits, an account with no book.
 *
 * TAB13-03b (2026-09-29): WHAT THIS VIEW IS MISSING. The strip of everything the
 * report does not hold left the screen; missingMoney() below decides the one
 * notice that replaces it — a line for each gap in this view's money that
 * exists (plans not placed; bank transactions not in the books), none when
 * there is none. The response still carries every count it did.
 *
 * Pure (the budget report purity law's fifth root, scripts/assert-tool-registry.ts):
 * no framework, no network, no environment, and no clock — today is handed in by
 * the screen, the one place that reads it.
 */
import type { ReportBook, ReportRow, UnplacedItem } from './report';
import type { NotPlaced } from './days';
import type { BudgetReportResponse } from './reportInputs';

export type ViewKind = 'day' | 'week' | 'year';

/** The screen's choice as the URL states it — raw, before the report is consulted. */
export interface SectionChoice {
  readonly book: string | null;
  readonly account: string | null;
}

/** What the screen shows under the chips. */
export type Section =
  | { readonly kind: 'overview' }
  | { readonly kind: 'book'; readonly book: ReportBook; readonly account: AccountFilter }
  | { readonly kind: 'refused'; readonly message: string };

/** A book's Account filter: every account, or one — with its row, or null when it has none in this view. */
export type AccountFilter =
  | { readonly kind: 'all' }
  | { readonly kind: 'one'; readonly code: string; readonly row: ReportRow | null };

/** The words of each refusal — the screen prints them as they are. */
export const SECTION_REFUSAL = {
  unknownBook: 'This link names a book that is not in your report',
  accountWithoutBook: (account: string) => `This link names an account (${account}) but no book — an account is chosen within a book`,
  badAccount: (account: string) => `This link names the account "${account}", which is not four digits — an account in a link is the four digits of its code, as 5100`,
} as const;

const VIEW_KEYS = ['view', 'day', 'weekOf', 'year'] as const;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const FOUR_DIGITS = /^\d{4}$/;

/** A 'YYYY-MM-DD' day moved by n days, by UTC arithmetic (no zone can shift it). */
export function shiftDay(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00.000Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

/** The URL's view parameters, or DAY of today when the URL names no view. Anything else passes to the route, which refuses it by name. */
export function viewParams(search: URLSearchParams, today: string): URLSearchParams {
  const out = new URLSearchParams();
  const view = search.get('view');
  if (view === null) {
    out.set('view', 'day');
    out.set('day', today);
    return out;
  }
  out.set('view', view);
  for (const key of ['day', 'weekOf', 'year']) {
    const value = search.get(key);
    if (value !== null) out.set(key, value);
  }
  return out;
}

/**
 * The day a switch of view starts from: the day shown, the week's weekOf, or —
 * from YEAR — today when it is this year and Jan 1 otherwise. Null when the URL's
 * view is not one the route accepts: the toggles are then disabled, and the
 * route's refusal says why on screen.
 */
export function anchorOf(params: URLSearchParams, asOf: string): string | null {
  const view = params.get('view');
  const isDay = (v: string | null): v is string => v !== null && ISO_DAY.test(v);
  if (view === 'day') return isDay(params.get('day')) ? params.get('day') : null;
  if (view === 'week') return isDay(params.get('weekOf')) ? params.get('weekOf') : null;
  const year = params.get('year');
  if (view !== 'year' || year === null || !/^\d{4}$/.test(year)) return null;
  return year === asOf.slice(0, 4) ? asOf : `${year}-01-01`;
}

/** The section and account the URL names — raw strings, or null when absent. */
export function choiceOf(search: URLSearchParams): SectionChoice {
  return { book: search.get('book'), account: search.get('account') };
}

/** '/budget?<view keys>&book=…&account=…' — the choice appended to a view, in that order. */
function budgetHref(view: URLSearchParams, choice: SectionChoice): string {
  const out = new URLSearchParams(view);
  if (choice.book !== null) out.set('book', choice.book);
  if (choice.account !== null) out.set('account', choice.account);
  return `/budget?${out.toString()}`;
}

/** The view keys the URL carries, as they are — none when the URL names no view (DAY of today). */
function viewKeysOf(search: URLSearchParams): URLSearchParams {
  const out = new URLSearchParams();
  for (const key of VIEW_KEYS) {
    const value = search.get(key);
    if (value !== null) out.set(key, value);
  }
  return out;
}

/** DAY · WEEK · YEAR from an anchor day — the book and the account kept. */
export function hrefFor(kind: ViewKind, anchor: string, choice: SectionChoice): string {
  const view = new URLSearchParams();
  view.set('view', kind);
  if (kind === 'day') view.set('day', anchor);
  else if (kind === 'week') view.set('weekOf', anchor);
  else view.set('year', anchor.slice(0, 4));
  return budgetHref(view, choice);
}

/** ‹ › — one day, one week or one year, the book and the account kept. Null when the view cannot be stepped. */
export function stepHref(params: URLSearchParams, direction: -1 | 1, choice: SectionChoice): string | null {
  const view = params.get('view');
  const day = params.get('day');
  const weekOf = params.get('weekOf');
  const year = params.get('year');
  if (view === 'day' && day) return hrefFor('day', shiftDay(day, direction), choice);
  if (view === 'week' && weekOf) return hrefFor('week', shiftDay(weekOf, 7 * direction), choice);
  if (view === 'year' && year && /^\d{4}$/.test(year)) return hrefFor('year', `${String(Number(year) + direction).padStart(4, '0')}-01-01`, choice);
  return null;
}

/** A section chip: the view kept, the book set (null → OVERVIEW), the account CLEARED. */
export function sectionHref(search: URLSearchParams, book: string | null): string {
  return budgetHref(viewKeysOf(search), { book, account: null });
}

/** The Account select: the view and the book kept, the account set (null → all accounts). */
export function accountHref(search: URLSearchParams, book: string, account: string | null): string {
  return budgetHref(viewKeysOf(search), { book, account });
}

/**
 * The section the choice names, against the report's books. Refused by name:
 * an account with no book, a book that is not in the report, an account that is
 * not four digits. An account of four digits with no row in this view is KEPT,
 * with a null row — the screen says it has no money in this view.
 */
export function sectionFor(choice: SectionChoice, books: readonly ReportBook[]): Section {
  if (choice.book === null) {
    if (choice.account !== null) return { kind: 'refused', message: SECTION_REFUSAL.accountWithoutBook(choice.account) };
    return { kind: 'overview' };
  }
  const book = books.find((b) => b.entityId === choice.book);
  if (!book) return { kind: 'refused', message: SECTION_REFUSAL.unknownBook };
  if (choice.account === null) return { kind: 'book', book, account: { kind: 'all' } };
  if (!FOUR_DIGITS.test(choice.account)) return { kind: 'refused', message: SECTION_REFUSAL.badAccount(choice.account) };
  const code = choice.account;
  const rows = book.rows.filter((r) => r.code === code);
  return { kind: 'book', book, account: { kind: 'one', code, row: rows.length === 1 ? rows[0] : null } };
}

// ── WHAT THIS VIEW IS MISSING (TAB13-03b) ───────────────────────────────────

/** Σ of integer cents, null when there are none; a sum past the safe range is refused, never shown. */
function sumCents(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  let total = 0;
  for (const v of values) {
    total += v;
    if (!Number.isSafeInteger(total)) throw new Error(`BUDGET VIEW: a missing-money total left the safe integer range of cents (${total})`);
  }
  return total;
}

/** The book an unplaced item belongs to — its line's or its posting's entity. */
export const unplacedEntityId = (item: UnplacedItem): string => (item.kind === 'budgetLine' ? item.line.entityId : item.posting.entityId);

/** Not placed, in the section's scope: a book's own items on a book; every item on OVERVIEW or a refused section. */
export interface NotPlacedInScope {
  readonly scope: 'book' | 'all books';
  readonly notPlaced: readonly NotPlaced[];
  readonly unplaced: readonly UnplacedItem[];
  /** notPlaced + unplaced. */
  readonly count: number;
  /** Σ of the plans' known cents: notPlaced with an amount, and unplaced budget lines. Null when none has one. */
  readonly plannedCents: number | null;
  /** notPlaced items whose amount is truly unknown (cents null) — counted, never summed as 0. */
  readonly withoutAmount: number;
  /** Unplaced ledger lines — actuals, each with its own direction; listed, not summed with the plans. */
  readonly postings: number;
}

export function notPlacedIn(data: Pick<BudgetReportResponse, 'notPlaced' | 'report'>, section: Section): NotPlacedInScope {
  const book = section.kind === 'book' ? section.book.entityId : null;
  const notPlaced = book === null ? data.notPlaced : data.notPlaced.filter((n) => n.entityId === book);
  const unplaced = book === null ? data.report.unplaced : data.report.unplaced.filter((u) => unplacedEntityId(u) === book);
  const known = notPlaced.map((n) => n.cents).filter((c): c is number => c !== null);
  const lines = unplaced.flatMap((u) => (u.kind === 'budgetLine' ? [u.line.cents] : []));
  return {
    scope: book === null ? 'all books' : 'book',
    notPlaced,
    unplaced,
    count: notPlaced.length + unplaced.length,
    plannedCents: sumCents([...known, ...lines]),
    withoutAmount: notPlaced.length - known.length,
    postings: unplaced.length - lines.length,
  };
}

/** One line of the notice: a gap in THIS view's money, with what it needs to be drawn. */
export type MissingLine =
  | {
      /** Plans not placed on any row — the book's own on a book, all books on OVERVIEW or a refused section. */
      readonly kind: 'budgetShort';
      readonly placed: NotPlacedInScope;
    }
  | {
      /** Bank transactions not yet in the ledger, from the view's widest column (columns[0] — MTD, WEEK or YTD). */
      readonly kind: 'actualShort';
      readonly label: string;
      readonly transactions: number;
      /** Σ of their Plaid amounts in cents (outflows positive), or null when none totals. */
      readonly bankCents: number | null;
      /** Bank rows in that column whose amount is not whole cents — listed, never summed. */
      readonly notTotalled: number;
    };

/**
 * TAB13-03b — WHAT THIS VIEW IS MISSING: one line per gap that exists, budget
 * first, and NONE when there is none. Not a line: costed tasks set aside by
 * status, ledger lines left out by name (correct accounting, not missing money),
 * travel, the record counts. Bank rows are in no book, so ACTUAL SHORT is every
 * book's; a future widest column (transactions null) has had nothing happen yet.
 */
export function missingMoney(data: Pick<BudgetReportResponse, 'notPlaced' | 'report' | 'notInBooks'>, section: Section): MissingLine[] {
  const lines: MissingLine[] = [];
  const placed = notPlacedIn(data, section);
  if (placed.count > 0) lines.push({ kind: 'budgetShort', placed });
  const widest = data.notInBooks.columns[0];
  if (widest.transactions !== null && widest.notTotalled !== null && (widest.transactions > 0 || widest.notTotalled > 0)) {
    lines.push({ kind: 'actualShort', label: widest.label, transactions: widest.transactions, bankCents: widest.bankCents, notTotalled: widest.notTotalled });
  }
  return lines;
}

/** The chip label of each book: its label, and its entity name when another book shares the label. */
export function bookChipLabels(books: readonly ReportBook[]): ReadonlyMap<string, string> {
  const shared = (label: string): boolean => books.filter((b) => b.label === label).length > 1;
  return new Map(books.map((b) => [b.entityId, shared(b.label) ? `${b.label} · ${b.entityName}` : b.label]));
}
