/**
 * IDIOM-01 (Alex, 2026-10-24) — THE CSV, PURE. Lifted from the task ledger's
 * rules (src/lib/operations/ledger.ts, LEDGER-02, Alex, 2026-10-19: "the rows
 * shown, for a spreadsheet"), the bytes unchanged: the head words, then one line
 * per row in the table's order, each field the column's own csv reader (the fact
 * bare — '' for a blank, never 0 or "—"; money as csvMoney); RFC 4180 with
 * minimal quoting; every line ends CRLF, the last one too; UTF-8 with no BOM
 * (the screen writes it as a Blob of this string, which the browser encodes as
 * UTF-8 and prefixes with nothing). The ledger's ledgerCsv is tableCsv over its
 * spec (LEDGER_TABLE). Pure: no React, no DOM, no Blob.
 */
import type { TableColumn } from './columns';

/** A money field: dollars with two decimals from the integer cents, an ASCII minus, no symbol, no grouping — "10.00", "8.98", "-1.02"; null is the empty field. */
export const csvMoney = (cents: number | null): string => {
  if (cents === null) return '';
  const abs = Math.abs(cents);
  return `${cents < 0 ? '-' : ''}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
};
/** RFC 4180, minimal quoting: a field holding a comma, a quote, a CR or an LF is wrapped in quotes with its quotes doubled; any other field is written bare. */
export const csvField = (text: string): string => (/[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text);

/** The head words, then each line's fields, every field quoted by the one rule; every line ends CRLF, the last one too. */
export function csvText(heads: readonly string[], rows: readonly (readonly string[])[]): string {
  const lines = [heads.map(csvField).join(',')];
  for (const fields of rows) lines.push(fields.map(csvField).join(','));
  return `${lines.join('\r\n')}\r\n`;
}

/** The rows given, as a CSV of the spec: the labels as the head line, then each row's csv fields in the columns' order. */
export function tableCsv<Row, Key extends string>(columns: readonly TableColumn<Row, Key>[], rows: readonly Row[]): string {
  return csvText(columns.map((c) => c.label), rows.map((row) => columns.map((c) => c.csv(row))));
}
