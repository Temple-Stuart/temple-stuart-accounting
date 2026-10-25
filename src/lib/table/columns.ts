/**
 * IDIOM-01 (Alex, 2026-10-24) — THE TABLE IDIOM'S COLUMN SPEC, PURE.
 *
 * "The table idiom becomes one shared component." The task ledger's rules
 * (src/lib/operations/ledger.ts, LEDGER-04, Alex, 2026-10-20: "filtering should
 * work like a sheet: every column filterable, several at once, and sortable")
 * are lifted here, their words and rules unchanged, so a second table (JOURNAL-07
 * is the next) filters, sorts and downloads by the same rules. The ledger keeps
 * its sixteen columns, its row builder, its totals and its summary there and
 * builds its spec (ledger.ts LEDGER_TABLE) from this type; its own functions
 * call these with that spec, so every import it had keeps working.
 *
 * A column is `{ key, label, kind }` and the readers the rules need:
 *   · words   — the cell as the table prints it: what a VALUE filter matches,
 *               what a checklist lists (BLANK for a blank cell — words.ts);
 *   · sortKey — what the column sorts by: a number, a text, or null for a
 *               blank cell (last in both directions — sort.ts);
 *   · csv     — the field the CSV writes: the fact bare, '' for a blank, money
 *               as csvMoney (csv.ts) — never the screen's "—";
 * and by kind: a MONEY column's `cents` (what its min/max reads; null a blank)
 * or a TEXT column's `text` (what its contains-text reads; null a blank).
 *
 * THE KINDS are value | money | text — exactly the ledger's (ruling B). `date`
 * is NOT a kind: the ledger's DATE column sorts by its 'YYYY-MM-DD' text
 * (ledger.ts sortKeyOf, `text(row.day)`), which orders by day only because the
 * ISO form sorts lexicographically; its DAY column sorts by the weekday's number.
 * So a date column is a VALUE column whose sortKey is its ISO text, and nothing
 * here tells a date from a word.
 *
 * Pure: no React, no fetch, no clock.
 */

/** A VALUE column filters by a checklist of its cell words; a MONEY column by a min and a max; a TEXT column by a contains-text. */
export type ColumnKind = 'value' | 'money' | 'text';

/** What a column sorts by: a number (cents, stars, a weekday as 1…7), a text (localeCompare, numeric), or null for a blank cell — last in both directions. */
export type SortKey = { readonly kind: 'number'; readonly n: number } | { readonly kind: 'text'; readonly t: string } | null;

interface ColumnBase<Row, Key extends string> {
  readonly key: Key;
  /** The head word — the header, the popover's head and the CSV's head line. */
  readonly label: string;
  /** ROUTINES-03 (Alex, 2026-10-25): the head's tooltip — a CALCULATED column names its rule here; absent, the head has none. */
  readonly title?: string;
  /** The cell as the table prints it — the one key a VALUE filter matches and a checklist lists; BLANK for a blank cell. */
  readonly words: (row: Row) => string;
  /** What the column sorts by; null for a blank cell. */
  readonly sortKey: (row: Row) => SortKey;
  /** The CSV's field for the cell — the fact bare, '' for a blank (a null is an EMPTY field, never 0 or "—"). */
  readonly csv: (row: Row) => string;
}

/** One column of a table: its key, head word and kind, and the readers by which the rules filter, sort and write it. */
export type TableColumn<Row, Key extends string = string> = ColumnBase<Row, Key> & (
  | { readonly kind: 'value' }
  | { readonly kind: 'money'; readonly cents: (row: Row) => number | null }
  | { readonly kind: 'text'; readonly text: (row: Row) => string | null }
);

/** The column with this key — thrown when the spec has none: a key the spec does not name is a bug, never a blank column. */
export function columnOf<Row, Key extends string>(columns: readonly TableColumn<Row, Key>[], key: Key): TableColumn<Row, Key> {
  const column = columns.find((c) => c.key === key);
  if (column === undefined) throw new Error(`table: no column "${key}" among [${columns.map((c) => c.key).join(' ')}]`);
  return column;
}
