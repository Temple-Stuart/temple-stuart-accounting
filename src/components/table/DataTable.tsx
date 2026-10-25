/**
 * DataTable — THE TABLE IDIOM, ONE SHARED COMPONENT (IDIOM-01, Alex, 2026-10-24).
 *
 * "Uniform tables across the board." Lifted from the task ledger's section
 * (workbench/operations/ledger/LedgerSection.tsx, LEDGER-02 the CSV, LEDGER-04
 * the filters and the sort), every element, class, word and attribute as it
 * stood — the attributes carry the caller's `name` (dataAttr.ts: the ledger's
 * `data-ledger-*`), so the ledger's DOM is byte for byte what it was. The rules
 * are src/lib/table's (columns · filters · sort · csv · words); nothing here
 * computes a figure. It renders, in this order:
 *
 *   1. THE CONTROLS ROW — the caller's `controls` first (the ledger's period
 *      chips, ‹ date ›, the period words), then "download CSV" (the rows SHOWN
 *      as csv.ts tableCsv writes them over the spec — a Blob, UTF-8, no BOM, and
 *      an object URL revoked after the click; disabled with the reason when no
 *      row is shown), "clear filters" while any filter is on, the reason while
 *      nothing is shown, then the caller's `trailing`;
 *   2. the caller's `children` — its loading, failed and nothing-recorded lines;
 *   3. "no row matches the filters" when rows are LOADED and a filter leaves
 *      none shown — THE TABLE STAYS (the filters live in its headers, so they
 *      must stay to be undone);
 *   4. THE TABLE while rows are loaded: one header per column of the spec — the
 *      head word is the sort button (a click: ascending, then descending, then
 *      the table's own order; the mark showing the direction; money heads
 *      right-aligned) and a ▾ that opens the column's popover; a mark while its
 *      filter narrows something — then the rows the caller renders (renderRow,
 *      over `shown`: the caller's filterRows then sortRows), then the caller's
 *      `foot` whole (the ledger's TOTAL row);
 *   5. ONE POPOVER at a time (ColumnFilter.tsx), fixed under its own ▾ — the
 *      buttons are kept in a ref map — built from the rows LOADED, not the rows
 *      shown; its filter handed back whole through onFilters.
 *
 * The state is the caller's (controlled): the filters, the sort and the column
 * whose popover is open — the ledger resets its filters when its period changes
 * and keeps them across a re-read. React state only here (the ▾ map); nothing
 * stored in the browser; nothing fetched.
 */

'use client';

import { useCallback, useRef, type ReactNode } from 'react';
import ColumnFilter from './ColumnFilter';
import { dataAttr } from './dataAttr';
import { columnOf, type TableColumn } from '@/lib/table/columns';
import { tableCsv } from '@/lib/table/csv';
import { anyFilterOn, columnValuesOf, filterOn, moneyFilterOf, textFilterOf, valueFilterOf, withFilter, type TableFilters } from '@/lib/table/filters';
import { nextSort, type TableSort } from '@/lib/table/sort';
import { CLEAR_FILTERS_WORDS, CSV_DOWNLOAD_WORDS, CSV_NO_ROWS_WORDS, FILTER_ON_MARK, FILTER_OPEN_WORDS, NO_ROWS_SHOWN_WORDS, SORT_MARKS, filterLabelWords, sortLabelWords } from '@/lib/table/words';

/** The idiom's classes — the ledger's, for every table: a chip, a head cell, a text cell, a money cell. */
export const chipClass = 'px-2 py-0.5 border border-border rounded hover:bg-bg-row text-xs disabled:opacity-50';
export const headClass = 'px-2 py-1.5 font-normal text-left whitespace-nowrap';
export const cellClass = 'px-2 py-1.5 align-top';
export const moneyClass = 'px-2 py-1.5 align-top text-right tabular-nums whitespace-nowrap';

export interface DataTableProps<Row, Key extends string, F extends TableFilters> {
  /** The attribute namespace — `data-<name>-*` on every element here and in the popover. */
  readonly name: string;
  readonly columns: readonly TableColumn<Row, Key>[];
  /** The rows LOADED — a checklist lists their values. */
  readonly rows: readonly Row[];
  /** The rows SHOWN — the caller's filterRows then sortRows, in that order; the body and the CSV are these. */
  readonly shown: readonly Row[];
  /** Whether the rows are in: the table renders while loaded with rows; the empty state says no row matches. */
  readonly loaded: boolean;
  /** The table's own width class (the ledger's min-w-[96rem]) — composed with the idiom's. */
  readonly tableClassName: string;
  readonly renderRow: (row: Row) => ReactNode;
  /** The foot, whole — the caller's TOTAL row in its <tfoot>. */
  readonly foot: ReactNode;
  readonly filters: F;
  readonly onFilters: (next: F) => void;
  /** Every filter off, in the caller's shape — what "clear filters" hands back. */
  readonly noFilters: F;
  readonly sort: TableSort<Key> | null;
  readonly onSort: (next: TableSort<Key> | null) => void;
  readonly openFilter: Key | null;
  readonly onOpenFilter: (column: Key | null) => void;
  /** The CSV's file name while there is something to download; null disables the button with the reason. */
  readonly csv: { readonly name: string } | null;
  /** The caller's controls, before the CSV button, in the controls row. */
  readonly controls: ReactNode;
  /** After the CSV words, in the same row. */
  readonly trailing?: ReactNode;
  /** Between the controls row and the table: the caller's loading, failed and nothing-recorded lines. */
  readonly children?: ReactNode;
}

export default function DataTable<Row, Key extends string, F extends TableFilters>(props: DataTableProps<Row, Key, F>) {
  const { name, columns, rows, shown, loaded, tableClassName, renderRow, foot, filters, onFilters, noFilters, sort, onSort, openFilter, onOpenFilter, csv, controls, trailing, children } = props;
  // The ▾ buttons by column (a ref map): the open popover is anchored under its own.
  const filterButtons = useRef(new Map<Key, HTMLButtonElement>());
  const closeFilter = useCallback(() => onOpenFilter(null), [onOpenFilter]);

  // The rows SHOWN as a CSV (csv.ts tableCsv over the spec) — a Blob (UTF-8, no BOM) and an object URL, the shape dashboard/GeneralLedger.tsx
  // exports; the file is named by the caller; the URL is revoked after the click. Nothing to download until a row is shown.
  const downloadCsv = (fileName: string): void => {
    const url = URL.createObjectURL(new Blob([tableCsv(columns, shown)], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  /** The one popover open — the leaf by the column's kind, under that column's ▾, with its filter and (a VALUE column) the values among the rows loaded. */
  const popover = (key: Key) => {
    const anchor = filterButtons.current.get(key);
    if (anchor === undefined) return null;
    const c = columnOf(columns, key);
    if (c.kind === 'value') return <ColumnFilter kind="value" name={name} column={key} head={c.label} anchor={anchor} values={columnValuesOf(rows, c)} filter={valueFilterOf(filters, key)} onChange={(f) => onFilters(withFilter(filters, key, f))} onClose={closeFilter} />;
    if (c.kind === 'money') return <ColumnFilter kind="money" name={name} column={key} head={c.label} anchor={anchor} filter={moneyFilterOf(filters, key)} onChange={(f) => onFilters(withFilter(filters, key, f))} onClose={closeFilter} />;
    return <ColumnFilter kind="text" name={name} column={key} head={c.label} anchor={anchor} filter={textFilterOf(filters, key)} onChange={(f) => onFilters(withFilter(filters, key, f))} onClose={closeFilter} />;
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 text-xs" {...dataAttr(name, 'controls')}>
        {controls}
        <button type="button" className={chipClass} disabled={csv === null} title={csv === null ? CSV_NO_ROWS_WORDS : undefined} onClick={() => csv !== null && downloadCsv(csv.name)} {...dataAttr(name, 'csv')}>{CSV_DOWNLOAD_WORDS}</button>
        {anyFilterOn(columns, filters) && <button type="button" className={chipClass} onClick={() => onFilters(noFilters)} {...dataAttr(name, 'clear-filters')}>{CLEAR_FILTERS_WORDS}</button>}
        {loaded && shown.length === 0 && <span className="text-text-faint" {...dataAttr(name, 'csv-why')}>{CSV_NO_ROWS_WORDS}</span>}
        {trailing}
      </div>
      {children}
      {loaded && rows.length > 0 && shown.length === 0 && <div className="text-xs text-text-muted" {...dataAttr(name, 'none-shown')}>{NO_ROWS_SHOWN_WORDS}</div>}
      {/* The table stays while rows are LOADED, even when a filter leaves none shown — the filters live in its headers, so they must stay to be undone. */}
      {loaded && rows.length > 0 && (
        <div className="overflow-x-auto border border-border rounded bg-white">
          <table className={`w-full ${tableClassName} border-collapse text-xs`} {...dataAttr(name, 'table')}>
            <thead>
              <tr className="text-text-faint uppercase tracking-wide">
                {/* Each header is its head word (a click sorts — nextSort — the mark showing the direction) and a ▾ that opens the column's popover; a mark while its filter is on. */}
                {columns.map((c) => {
                  const h = c.label;
                  const on = filterOn(filters, c.key, c.kind);
                  const sorted = sort !== null && sort.column === c.key;
                  return (
                    <th key={c.key} className={c.kind === 'money' ? `${headClass} text-right` : headClass}>
                      <span className="inline-flex items-center gap-1">
                        <button type="button" className="hover:text-text-primary" onClick={() => onSort(nextSort(sort, c.key))} aria-label={sortLabelWords(h)} title={c.title} {...dataAttr(name, 'sort', c.key)} {...dataAttr(name, 'sort-direction', sorted ? sort.direction : undefined)}>{h}</button>
                        {sorted && <span {...dataAttr(name, 'sort-mark')}>{SORT_MARKS[sort.direction]}</span>}
                        <button type="button" ref={(el) => { if (el === null) filterButtons.current.delete(c.key); else filterButtons.current.set(c.key, el); }} className={on ? 'text-brand-purple' : 'hover:text-text-primary'} onClick={() => onOpenFilter(c.key)} aria-label={filterLabelWords(h)} aria-expanded={openFilter === c.key} {...dataAttr(name, 'filter', c.key)} {...dataAttr(name, 'filter-on', on ? '' : undefined)}>
                          {on && <span {...dataAttr(name, 'filter-mark')}>{FILTER_ON_MARK}</span>}
                          <span {...dataAttr(name, 'filter-open')}>{FILTER_OPEN_WORDS}</span>
                        </button>
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {shown.map(renderRow)}
            </tbody>
            {foot}
          </table>
        </div>
      )}
      {openFilter !== null && popover(openFilter)}
    </>
  );
}
