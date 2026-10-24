/**
 * IDIOM-01 (Alex, 2026-10-24) — THE CALLER'S ATTRIBUTE NAMESPACE. The shared
 * table (DataTable.tsx, ColumnFilter.tsx) marks its elements `data-<name>-<part>`
 * with the name the caller gives — the task ledger's `data-ledger-*`, exactly as
 * they stood before the extraction, so its DOM is byte for byte the same.
 *
 * Two arguments write the attribute the way a bare JSX attribute is written:
 * `data-ledger-csv` in JSX is `true`, which React writes as data-ledger-csv="true"
 * — so the value handed to React is `true`, not '' (the DOM proof caught '').
 * A third argument is the value as given: '' writes an empty attribute (the
 * section's `data-ledger-filter-on={on ? '' : undefined}`), and an explicit
 * undefined is NO attribute, the way React drops one (a default parameter would
 * turn that undefined into a value and write the attribute on every header —
 * ledger04 and idiom01 pin the three cases). Pure.
 */
export const dataAttr = (name: string, part: string, ...value: readonly [] | readonly [string | undefined]): Readonly<Record<string, string | true>> => {
  const given = value.length === 0 ? true : value[0];
  return given === undefined ? {} : { [`data-${name}-${part}`]: given };
};
