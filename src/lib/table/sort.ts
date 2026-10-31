/**
 * IDIOM-01 (Alex, 2026-10-24) — THE SORT, PURE. Lifted from the task ledger's
 * rules (src/lib/operations/ledger.ts, LEDGER-04, Alex, 2026-10-20), the rule
 * unchanged: one column at a time; a click on a head word sorts ascending, then
 * descending, then the table's own order; a blank cell (a null key) is last in
 * both directions; ties keep the order given (a stable sort); null gives the
 * rows as they came, a copy. The ledger's sortRows(rows, sort) calls sortRows
 * here with its spec (LEDGER_TABLE); its LedgerSort is TableSort<LedgerColumn>.
 */
import { columnOf, type SortKey, type TableColumn } from './columns';

/** One column, ascending or descending; null is the table's own order (the ledger's: newest day first, then the card's clock). */
export type SortDirection = 'asc' | 'desc';
export interface TableSort<Key extends string = string> { readonly column: Key; readonly direction: SortDirection }

/** A click on a head word: ascending, then descending, then the table's own order; a click on another column starts ascending there. */
export const nextSort = <Key extends string>(sort: TableSort<Key> | null, column: Key): TableSort<Key> | null =>
  (sort === null || sort.column !== column ? { column, direction: 'asc' } : sort.direction === 'asc' ? { column, direction: 'desc' } : null);

/** A number key, or null for a blank. */
export const numberKey = (n: number | null): SortKey => (n === null ? null : { kind: 'number', n });
/** A text key, or null for a blank. */
export const textKey = (t: string | null): SortKey => (t === null ? null : { kind: 'text', t });

/** Two keys in one direction: a blank after everything either way; numbers by difference; texts by localeCompare ('en', numeric). */
export const compareSortKeys = (a: SortKey, b: SortKey, direction: SortDirection): number => {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
  const d = a.kind === 'number' && b.kind === 'number' ? a.n - b.n : (a.kind === 'text' ? a.t : String(a.n)).localeCompare(b.kind === 'text' ? b.t : String(b.n), 'en', { numeric: true });
  return direction === 'asc' ? d : -d;
};

/** The rows by one key reader in one direction; ties keep the order given (a stable sort), blanks last either way. A copy. */
export function sortRowsBy<Row>(rows: readonly Row[], direction: SortDirection, keyOf: (row: Row) => SortKey): Row[] {
  return [...rows].sort((a, b) => compareSortKeys(keyOf(a), keyOf(b), direction));
}

/** The rows by one column of the spec; null gives the rows as they came. The TOTAL row is not a row here. */
export function sortRows<Row, Key extends string>(rows: readonly Row[], sort: TableSort<Key> | null, columns: readonly TableColumn<Row, Key>[]): Row[] {
  if (sort === null) return [...rows];
  return sortRowsBy(rows, sort.direction, columnOf(columns, sort.column).sortKey);
}
