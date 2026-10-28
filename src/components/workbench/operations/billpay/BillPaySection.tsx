'use client';

/**
 * BILLPAY-01 (Alex, 2026-10-28, rulings B and D) — BILL PAY'S TABLE: EVERY BILL, EVERY DUE DAY, PAID OR NOT.
 *
 * One read (GET /api/bill-pay?from=&to= — the pure rule src/lib/operations/billPay.ts builds the rows) over a bounded
 * window: the viewer's current calendar month in full at first, ‹ month › to move — never unbounded. The rows render
 * through the shared DataTable (IDIOM-01) over billPayTable's spec, in the house's order: DUE · KIND · BOOK · ACCOUNT ·
 * ACCOUNT NAME · SUB ACCOUNT NAME · VENDOR · BILL · AMOUNT · PAID · PAID FROM · STATUS · ID. Under the table: the row
 * count and what the rule said (the all-day expenses that name no vendor, the linked postings reversed, …).
 *
 * Writes nothing of its own (ruling D). An unpaid row's PAID cell carries "link payment", a paid row's (and a link off the
 * rule's) "payment": each opens, under the row, the EXISTING manual link picker (ledger/LinkPicker.tsx over
 * /api/calendar/links — LINK-01: nothing ranked, nothing pre-selected; LINK-LAW-01's refusals stand) on the occurrence's
 * own (kind, target_id, instant), near its due day. After a link or an unlink the table re-reads. Nothing is stored in
 * the browser; React state only.
 */
import { Fragment, useEffect, useMemo, useState } from 'react';
import DataTable, { cellClass as cell, chipClass as chip, moneyClass as money } from '@/components/table/DataTable';
import { dataAttr } from '@/components/table/dataAttr';
import LinkPicker from '../ledger/LinkPicker';
import { WorkCell, readJson } from '../workShared';
import { localToday } from '@/lib/localToday';
import { filterRows, noFilters, type TableFilters } from '@/lib/table/filters';
import { sortRows, type TableSort } from '@/lib/table/sort';
import type { TableColumn } from '@/lib/table/columns';
import { rowCountWords } from '@/lib/operations/work';
import {
  BILL_PAY_LOADING_WORDS, BILL_PAY_TABLE_NAME, LINK_PAYMENT_WORDS, NO_BILLS_WORDS, PAYMENT_WORDS, UNPAID_STATUSES,
  billPayCsvFileName, billPayFailedWords, billPayTable, monthWindowOf, monthWords, shiftMonth, type BillColumn, type BillRow,
} from '@/lib/operations/billPay';

const name = BILL_PAY_TABLE_NAME;

type BillsRead =
  | { readonly kind: 'loading' }
  | { readonly kind: 'failed'; readonly words: string }
  | { readonly kind: 'loaded'; readonly rows: readonly BillRow[]; readonly said: readonly string[] };

export default function BillPaySection() {
  const [span, setSpan] = useState(() => monthWindowOf(localToday()));
  const [read, setRead] = useState<BillsRead>({ kind: 'loading' });
  // Bumped after a link or an unlink — the table re-reads (ruling D).
  const [writes, setWrites] = useState(0);
  const columns: readonly TableColumn<BillRow, BillColumn>[] = useMemo(() => billPayTable(), []);
  const off = useMemo(() => noFilters(columns), [columns]);
  const [filters, setFilters] = useState<TableFilters>(off);
  const [sort, setSort] = useState<TableSort<BillColumn> | null>(null);
  const [openFilter, setOpenFilter] = useState<BillColumn | null>(null);
  // The one picker open, by row id — React state only.
  const [picking, setPicking] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setRead({ kind: 'loading' });
    readJson(`/api/bill-pay?from=${span.from}&to=${span.to}`, 'Bill Pay')
      .then((body) => { if (live) setRead({ kind: 'loaded', rows: (body.rows ?? []) as BillRow[], said: (body.said ?? []) as string[] }); })
      .catch((e: unknown) => { if (live) setRead({ kind: 'failed', words: e instanceof Error ? e.message : String(e) }); });
    return () => { live = false; };
  }, [span, writes]);

  const loaded = read.kind === 'loaded';
  const rows: readonly BillRow[] = read.kind === 'loaded' ? read.rows : [];
  const shown = sortRows(filterRows(rows, filters, columns), sort, columns);
  const csv = loaded && shown.length > 0 ? { name: billPayCsvFileName(span.from) } : null;
  // A month moved: its own filters and no picker open.
  const move = (by: number) => { setFilters(off); setPicking(null); setSpan((w) => shiftMonth(w.from, by)); };

  const renderRow = (row: BillRow) => (
    <Fragment key={row.id}>
      <tr className="border-t border-border" {...dataAttr(name, 'row', row.id)} {...dataAttr(name, 'status', row.status)}>
        {columns.map((column) => column.key !== 'paid'
          ? <WorkCell key={column.key} name={name} column={column} row={row} />
          : (
            <td key={column.key} className={money} {...dataAttr(name, 'cell', 'paid')}>
              <span {...dataAttr(name, 'paid-words')}>{column.words(row)}</span>
              <button type="button" className={`${chip} ml-1 font-normal`} onClick={() => setPicking(picking === row.id ? null : row.id)} aria-expanded={picking === row.id} {...dataAttr(name, 'link', row.id)}>
                {UNPAID_STATUSES.includes(row.status) ? LINK_PAYMENT_WORDS : PAYMENT_WORDS}
              </button>
            </td>
          ))}
      </tr>
      {picking === row.id && (
        <tr className="border-t border-border" {...dataAttr(name, 'picker', row.id)}>
          <td colSpan={columns.length} className={cell}>
            <LinkPicker kind={row.kind} id={row.target_id} instant={row.instant} near={row.due} onChanged={() => setWrites((n) => n + 1)} onClose={() => setPicking(null)} />
          </td>
        </tr>
      )}
    </Fragment>
  );

  return (
    <section className="space-y-3" {...dataAttr(name, 'section')}>
      <DataTable
        name={name}
        columns={columns}
        rows={rows}
        shown={shown}
        loaded={loaded}
        tableClassName="min-w-[110rem]"
        filters={filters}
        onFilters={setFilters}
        noFilters={off}
        sort={sort}
        onSort={setSort}
        openFilter={openFilter}
        onOpenFilter={setOpenFilter}
        csv={csv}
        controls={(
          <>
            <button type="button" className={chip} onClick={() => move(-1)} aria-label="previous month" {...dataAttr(name, 'prev')}>‹</button>
            <span className="text-text-primary" {...dataAttr(name, 'month', span.from)}>{monthWords(span.from)}</span>
            <button type="button" className={chip} onClick={() => move(1)} aria-label="next month" {...dataAttr(name, 'next')}>›</button>
          </>
        )}
        renderRow={renderRow}
        foot={null}
      >
        {read.kind === 'loading' && <div className="text-xs text-text-muted" {...dataAttr(name, 'loading')}>{BILL_PAY_LOADING_WORDS}</div>}
        {read.kind === 'failed' && <div className="text-xs px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800" {...dataAttr(name, 'failed')}>{billPayFailedWords(read.words)}</div>}
        {loaded && rows.length === 0 && <div className="text-xs text-text-muted" {...dataAttr(name, 'none')}>{NO_BILLS_WORDS}</div>}
      </DataTable>
      {loaded && rows.length > 0 && <p className="text-xs text-text-muted" {...dataAttr(name, 'count')}>{rowCountWords(shown.length, rows.length)}</p>}
      {read.kind === 'loaded' && read.said.length > 0 && (
        <ul className="text-xs text-amber-800 space-y-0.5" {...dataAttr(name, 'said')}>
          {read.said.map((words, i) => <li key={i}>{words}</li>)}
        </ul>
      )}
    </section>
  );
}
