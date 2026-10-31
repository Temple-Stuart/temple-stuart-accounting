/**
 * IDIOM-01 (Alex, 2026-10-24) — THE TABLE IDIOM'S WORDS. Lifted from the task
 * ledger's rules (src/lib/operations/ledger.ts, LEDGER-02 the CSV words,
 * LEDGER-04 the filters' and the sort's), every word unchanged: the null word
 * on screen, the empty state, the checklist's links, the popover's labels, the
 * marks, the CSV button. The ledger re-exports them, so its tests and its
 * screen read the same constants they always did. No new word on screen
 * (ruling D).
 */
import type { SortDirection } from './sort';

/**
 * The null word on screen — "—" for a blank cell (the CSV writes '' for the same
 * cell). Its ONE definition stays where the budget's figures and the day card
 * read it (src/lib/budget/format.ts BLANK); the idiom reads that definition,
 * never a second one.
 */
export { BLANK } from '@/lib/budget/format';

/** The empty state: rows are LOADED and a filter leaves none shown — the table stays, so the filters in its headers can be undone. */
export const NO_ROWS_SHOWN_WORDS = 'no row matches the filters';

// LEDGER-04 (Alex, 2026-10-20): the column filters' and the sort's words — ALL_WORDS is the checklist's "all" link.
export const ALL_WORDS = 'all';
export const NONE_WORDS = 'none';
/** The control beside every head word, and the mark a header carries while its filter narrows something. */
export const FILTER_OPEN_WORDS = '▾';
export const FILTER_ON_MARK = '●';
export const SORT_MARKS: Readonly<Record<SortDirection, string>> = { asc: '▲', desc: '▼' };
export const CLEAR_FILTERS_WORDS = 'clear filters';
/** A blank cell in a checklist, and the money tick that keeps or drops blank cells. */
export const BLANK_CHOICE_WORDS = '(blank)';
/** A checklist with more values than this gets a type-to-narrow box above it (it narrows the list, not the rows). */
export const NARROW_FROM = 10;
export const NARROW_WORDS = 'type to narrow';
export const MIN_WORDS = 'min $';
export const MAX_WORDS = 'max $';
export const CONTAINS_WORDS = 'contains';
export const CLOSE_FILTER_WORDS = 'close';
export const filterLabelWords = (head: string): string => `filter ${head}`;
export const sortLabelWords = (head: string): string => `sort by ${head}`;
export const boundTypedWords = (typed: string): string => `${JSON.stringify(typed)} is not dollars — 12, 8.50 or -3`;

// LEDGER-02 (Alex, 2026-10-19): the CSV button's words.
export const CSV_DOWNLOAD_WORDS = 'download CSV';
export const CSV_NO_ROWS_WORDS = 'no row shown — nothing to download';
