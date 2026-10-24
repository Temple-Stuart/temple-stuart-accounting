/**
 * IDIOM-01 (Alex, 2026-10-24) — THE COLUMN FILTERS, PURE. Lifted from the task
 * ledger's rules (src/lib/operations/ledger.ts, LEDGER-04, Alex, 2026-10-20:
 * "filtering should work like a sheet: every column filterable, several at
 * once"), the rule unchanged:
 *
 *   · a VALUE column's filter is the cell words UNTICKED (empty is no filter —
 *     every value ticked, the state at first; "none" drops every value present;
 *     a blank cell is BLANK, listed as "(blank)");
 *   · a MONEY column's filter is a min and a max in cents, each null for no
 *     bound, both inclusive, and whether blank cells stay (they do at first);
 *   · a TEXT column's filter is a contains-text, matched case-insensitively
 *     after trimming; '' is no filter;
 *   · within a VALUE column the ticks are OR (the row's cell is not among the
 *     dropped); across columns AND; every key is the SAME cell words the table
 *     prints (the column's words reader), so a filter matches what is seen.
 *
 * The filters are held by column key (TableFilters); a column's filter is read
 * by the kind the spec gives it, and a filter that is missing or of another
 * shape is thrown — never read as "no filter". The ledger's ColumnFilters stays
 * its typed map of sixteen; its functions call these with its spec.
 */
import type { ColumnKind, TableColumn } from './columns';
import { csvMoney } from './csv';
import { sortRowsBy } from './sort';
import { BLANK, BLANK_CHOICE_WORDS, boundTypedWords } from './words';

/** A VALUE column's filter: the cell words UNTICKED. Empty is no filter — every value ticked, the state at first; "none" drops every value present. */
export interface ValueFilter { readonly dropped: readonly string[] }
/** A MONEY column's filter: a min and a max in cents, each null for no bound, both inclusive; blank — whether blank cells stay (they do at first). */
export interface MoneyFilter { readonly minCents: number | null; readonly maxCents: number | null; readonly blank: boolean }
/** A TEXT column's filter: a contains-text, matched case-insensitively after trimming; '' is no filter. */
export interface TextFilter { readonly contains: string }
export type ColumnFilter = ValueFilter | MoneyFilter | TextFilter;
/** One filter per column, by the column's key. */
export type TableFilters = Readonly<Record<string, ColumnFilter>>;
export const NO_VALUE_FILTER: ValueFilter = Object.freeze({ dropped: [] });
export const NO_MONEY_FILTER: MoneyFilter = Object.freeze({ minCents: null, maxCents: null, blank: true });
export const NO_TEXT_FILTER: TextFilter = Object.freeze({ contains: '' });

/** Every filter off, by the spec: the state at first. */
export function noFilters<Row, Key extends string>(columns: readonly TableColumn<Row, Key>[]): TableFilters {
  return Object.freeze(Object.fromEntries(columns.map((c) => [c.key, c.kind === 'money' ? NO_MONEY_FILTER : c.kind === 'text' ? NO_TEXT_FILTER : NO_VALUE_FILTER])));
}
/** `filters` with one column's filter replaced — in the shape the caller holds, so a typed map stays a typed map. */
export const withFilter = <F extends TableFilters>(filters: F, key: keyof F & string, filter: ColumnFilter): F => ({ ...filters, [key]: filter });

/** The contains-text as matched: trimmed, lower-cased; '' is no filter. */
export const containsNeedle = (contains: string): string => contains.trim().toLowerCase();

const filterOf = (filters: TableFilters, key: string): ColumnFilter => {
  const filter = filters[key];
  if (filter === undefined) throw new Error(`table: no filter held for column "${key}"`);
  return filter;
};
/** A VALUE column's filter, as held — thrown when the filter held is of another shape. */
export function valueFilterOf(filters: TableFilters, key: string): ValueFilter {
  const filter = filterOf(filters, key);
  if (!('dropped' in filter)) throw new Error(`table: the filter held for "${key}" is not a value filter`);
  return filter;
}
/** A MONEY column's filter, as held — thrown when the filter held is of another shape. */
export function moneyFilterOf(filters: TableFilters, key: string): MoneyFilter {
  const filter = filterOf(filters, key);
  if (!('minCents' in filter)) throw new Error(`table: the filter held for "${key}" is not a money filter`);
  return filter;
}
/** A TEXT column's filter, as held — thrown when the filter held is of another shape. */
export function textFilterOf(filters: TableFilters, key: string): TextFilter {
  const filter = filterOf(filters, key);
  if (!('contains' in filter)) throw new Error(`table: the filter held for "${key}" is not a text filter`);
  return filter;
}

/** Whether a column's filter narrows anything — the mark on its header. */
export function filterOn(filters: TableFilters, key: string, kind: ColumnKind): boolean {
  switch (kind) {
    case 'value': return valueFilterOf(filters, key).dropped.length > 0;
    case 'money': { const f = moneyFilterOf(filters, key); return f.minCents !== null || f.maxCents !== null || !f.blank; }
    case 'text': return containsNeedle(textFilterOf(filters, key).contains) !== '';
  }
}
export const anyFilterOn = <Row, Key extends string>(columns: readonly TableColumn<Row, Key>[], filters: TableFilters): boolean =>
  columns.some((c) => filterOn(filters, c.key, c.kind));

/** One row against every column's filter: within a VALUE column the ticks are OR (the row's cell is not among the dropped); across columns AND. */
export function rowPasses<Row, Key extends string>(row: Row, filters: TableFilters, columns: readonly TableColumn<Row, Key>[]): boolean {
  for (const c of columns) {
    if (c.kind === 'value') {
      if (valueFilterOf(filters, c.key).dropped.includes(c.words(row))) return false;
    } else if (c.kind === 'money') {
      const f = moneyFilterOf(filters, c.key);
      const cents = c.cents(row);
      if (cents === null) { if (!f.blank) return false; continue; }
      if (f.minCents !== null && cents < f.minCents) return false;
      if (f.maxCents !== null && cents > f.maxCents) return false;
    } else {
      const needle = containsNeedle(textFilterOf(filters, c.key).contains);
      if (needle === '') continue;
      const text = c.text(row);
      if (text === null || !text.toLowerCase().includes(needle)) return false;
    }
  }
  return true;
}
/** The rows shown, in the order given. Nothing else changes — a TOTAL row, a coverage, a summary and the CSV follow these. */
export const filterRows = <Row, Key extends string>(rows: readonly Row[], filters: TableFilters, columns: readonly TableColumn<Row, Key>[]): Row[] =>
  rows.filter((row) => rowPasses(row, filters, columns));

/** One entry of a VALUE column's checklist: a cell's words (BLANK for a blank cell) and how many of the rows loaded carry it. */
export interface ColumnValue { readonly key: string; readonly count: number }
/** The distinct values of a column among the rows loaded, each with its count, in the column's own sort order (ascending) — a blank last. */
export function columnValuesOf<Row, Key extends string>(rows: readonly Row[], column: TableColumn<Row, Key>): ColumnValue[] {
  const counts = new Map<string, number>();
  const first = new Map<string, Row>();
  for (const row of rows) {
    const key = column.words(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (!first.has(key)) first.set(key, row);
  }
  return sortRowsBy([...first.values()], 'asc', column.sortKey).map((row) => { const key = column.words(row); return { key, count: counts.get(key) as number }; });
}
/** A checklist entry's words — "(blank)" for the blank cell, else the cell words themselves. */
export const choiceWords = (key: string): string => (key === BLANK ? BLANK_CHOICE_WORDS : key);

/** A money bound as typed (dollars, a sign allowed — a variance runs negative) → cents, or null for no bound when the box is empty; else the words. */
export type BoundResult = { readonly ok: true; readonly cents: number | null } | { readonly ok: false; readonly words: string };
const BOUND_RE = /^(-?)(\d+)(?:\.(\d{1,2}))?$/;
export function boundCentsOf(typed: string): BoundResult {
  const text = typed.trim();
  if (text === '') return { ok: true, cents: null };
  const m = BOUND_RE.exec(text);
  if (m === null) return { ok: false, words: boundTypedWords(typed) };
  const cents = Number(m[2]) * 100 + Number((m[3] ?? '').padEnd(2, '0'));
  return { ok: true, cents: m[1] === '-' ? -cents : cents };
}
/** A bound's cents back as the box shows them — "12.00", "-3.50", '' for no bound (the CSV's own money text). */
export const boundDollarsOf = (cents: number | null): string => csvMoney(cents);
