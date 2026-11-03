'use client';

/**
 * AllBookings — THE TRAVEL LEDGER (TRAVEL-02a, Alex, 2026-11-02, rulings A, C, D).
 *
 * BOOKINGS-01 (2026-09-27) made this the ONE list of every booking of the signed-in user:
 * one authed GET of /api/reservations (every reservation WHERE userId = the caller,
 * newest first — guest rows never appear). TRAVEL-02a: the same GET, read for its `ledger`
 * facts, drawn as the TRAVEL LEDGER in THE table idiom — the shared DataTable (components/table)
 * over the leaf's spec (src/lib/reservations/travelLedger.ts TRAVEL_LEDGER_TABLE): one row
 * per booking and under it one per money event, the fifteen columns in Alex's order, each
 * column sortable and filterable, the rows shown downloadable as a CSV (the DATE cells
 * instants), and the two sum lines per currency under the table. The DATE column is the
 * instant drawn in the VIEWER's day (the browser's zone, read on the client). A booking's
 * row keeps its doors — Receipt (RECEIPT-01), Add to calendar (CAL-02), Trip (TRIPS-01) —
 * in its ID cell. This component types no word of its own — every one is the leaf's. It
 * writes nothing; its state (the filters, the sort, the open popover) is React state only.
 * TripBookings (a trip's), UnattachedBookings (the unattached) and TripBudgetActual (the
 * trip's budget ledger) stay as they are; this replaces only the table that was here.
 *
 * TRAVEL-02b (Alex, 2026-11-03, rulings B, D, E) — THE TYPED ROWS. A second authed GET,
 * /api/travel-expenses, brings the travel expenses the customer typed (a visa, an eSIM, a
 * one-off purchase), voided ones too; the leaf merges them with the bookings, newest first
 * (ledgerRowsOf), in the same columns. A voided row stays, struck through. Each typed row's ID
 * cell carries two doors: "link payment" opens the one link picker (ledger/LinkPicker.tsx —
 * the task ledger's and Bill Pay's, kind 'travel_expense', no instant, near its day; manual
 * only) under the row, and "void" (on a row not voided) opens the void control. The two
 * writers — the void and "+ travel expense" under the table — are TravelExpenseControls.tsx's;
 * this file still writes nothing (the bookings law). Either read refused: its words, and no
 * table — never a ledger missing half its rows. After a save, a void or a link, both read again.
 *
 * TRAVEL-02b-fix (Alex, 2026-11-03, ruling A) — NO SILENT EMPTY. A 200 that lacks a list it
 * promises (the bookings' `ledger`; the typed rows' `expenses`, `trips`, `accounts`) is a
 * malformed answer: the leaf's parse (travelLedger.ts travelLedgerReadsOf) fails the read by
 * name (missingListWords) into the same error state — never an empty table. A list that is
 * truly empty stays a list.
 */

import { Fragment, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import DataTable, { cellClass, chipClass, moneyClass } from '@/components/table/DataTable';
import TravelExpenseForm, { VoidTravelExpense } from '@/components/trips/TravelExpenseControls';
import LinkPicker from '@/components/workbench/operations/ledger/LinkPicker';
import { LINK_PAYMENT_WORDS } from '@/lib/operations/billPay';
import { BOOKING_WORDS } from '@/lib/reservations/bookingRow';
import {
  TRAVEL_LEDGER_CSV_FILE_NAME, TRAVEL_LEDGER_TABLE, cellWordsOf, ledgerRowsOf, settledSumLineWords, statedSumLineWords, travelLedgerReadsOf,
  type TravelLedgerColumn, type TravelLedgerReads, type TravelLedgerRow,
} from '@/lib/reservations/travelLedger';
import { TRAVEL_EXPENSES_UNREADABLE_WORDS, VOID_WORDS } from '@/lib/travel/travelExpense';
import { filterRows, noFilters, type TableFilters } from '@/lib/table/filters';
import { sortRows, type TableSort } from '@/lib/table/sort';

type Loaded =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | ({ state: 'done' } & TravelLedgerReads);

const BLANK_CLASS = 'text-text-faint';
const DOOR_CLASS = 'rounded border border-border px-2 py-1 text-xs font-medium text-text-secondary hover:bg-bg-row';
/** Every filter off, in the spec's shape — what "clear filters" hands back. */
const NO_FILTERS = noFilters(TRAVEL_LEDGER_TABLE);

export default function AllBookings() {
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });
  // The viewer's zone — the DATE column's day on screen (ruling C); read on the client, after mount.
  const [zone, setZone] = useState<string | null>(null);
  const [filters, setFilters] = useState<TableFilters>(NO_FILTERS);
  const [sort, setSort] = useState<TableSort<TravelLedgerColumn> | null>(null);
  const [openFilter, setOpenFilter] = useState<TravelLedgerColumn | null>(null);
  // TRAVEL-02b: the reads again after a save, a void or a link; the row whose picker, or whose void, is open.
  const [reads, setReads] = useState(0);
  const [picking, setPicking] = useState<string | null>(null);
  const [voiding, setVoiding] = useState<string | null>(null);
  const readAgain = () => setReads((n) => n + 1);
  const closePicker = () => setPicking(null);
  const closeVoid = () => setVoiding(null);
  const afterVoid = () => { setVoiding(null); readAgain(); };

  useEffect(() => { setZone(Intl.DateTimeFormat().resolvedOptions().timeZone); }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [res, typedRes] = await Promise.all([fetch('/api/reservations'), fetch('/api/travel-expenses')]);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : `${BOOKING_WORDS.unreadable} (${res.status})`);
        const answer = await typedRes.json().catch(() => ({}));
        if (!typedRes.ok) throw new Error(typeof answer.error === 'string' ? answer.error : `${TRAVEL_EXPENSES_UNREADABLE_WORDS} (${typedRes.status})`);
        // TRAVEL-02b-fix (ruling A): every list each 200 promises, or the read fails by name — never shown as empty.
        const reads = travelLedgerReadsOf(data, answer);
        if (alive) setLoaded({ state: 'done', ...reads });
      } catch (err) {
        if (alive) setLoaded({ state: 'error', message: err instanceof Error ? err.message : BOOKING_WORDS.unreadable });
      }
    })();
    return () => { alive = false; };
  }, [reads]);

  const rows: readonly TravelLedgerRow[] = useMemo(
    () => (loaded.state === 'done' && zone !== null ? ledgerRowsOf(loaded.ledger, loaded.expenses, zone) : []),
    [loaded, zone],
  );
  const shown = sortRows(filterRows(rows, filters, TRAVEL_LEDGER_TABLE), sort, TRAVEL_LEDGER_TABLE);
  const ready = loaded.state === 'done' && zone !== null;
  const cell = (b: TravelLedgerRow, column: TravelLedgerColumn, blank: boolean, className: string = cellClass) => (
    <td key={column} className={`${className} ${blank ? BLANK_CLASS : ''}`} data-travel-ledger-cell={column}>{cellWordsOf(b, column)}</td>
  );

  return (
    <div className="rounded-lg border border-border bg-white p-4 space-y-3" data-all-bookings>
      <DataTable
        name="travel-ledger"
        columns={TRAVEL_LEDGER_TABLE}
        rows={rows}
        shown={shown}
        loaded={ready}
        tableClassName="min-w-[96rem]"
        filters={filters}
        onFilters={setFilters}
        noFilters={NO_FILTERS}
        sort={sort}
        onSort={setSort}
        openFilter={openFilter}
        onOpenFilter={setOpenFilter}
        csv={shown.length > 0 ? { name: TRAVEL_LEDGER_CSV_FILE_NAME } : null}
        controls={null}
        renderRow={(b) => (
          <Fragment key={b.rowKey}>
            <tr className={`border-t border-border ${b.voided ? 'line-through text-text-muted' : ''}`} data-travel-ledger-row={b.rowKey} data-travel-ledger-kind={b.kind} data-travel-ledger-source={b.source} data-travel-ledger-voided={b.voided ? '' : undefined} data-booking-row={b.bookingId === null ? undefined : b.bookingId}>
              {cell(b, 'date', false, `${cellClass} whitespace-nowrap tabular-nums`)}
              {cell(b, 'kind', false)}
              {cell(b, 'lane', b.laneWord === null)}
              {cell(b, 'trip', b.trip === null)}
              {cell(b, 'book', b.book === null, `${cellClass} whitespace-nowrap`)}
              {cell(b, 'account', b.account === null, `${cellClass} whitespace-nowrap`)}
              {cell(b, 'vendor', false)}
              {cell(b, 'confirmation', b.confirmation === null, `${cellClass} font-mono`)}
              {cell(b, 'dates', b.dates === null, `${cellClass} whitespace-nowrap`)}
              {cell(b, 'stated', b.stated === null, `${moneyClass} ${b.stated === null ? '' : 'font-semibold text-text-primary'}`)}
              {cell(b, 'settled', b.settled.length === 0, `${moneyClass} ${b.settled.length === 0 ? '' : 'font-semibold text-text-primary'}`)}
              {cell(b, 'posted', b.posted.length === 0, `${cellClass} whitespace-nowrap`)}
              {cell(b, 'document', b.receipts === null)}
              {cell(b, 'status', false)}
              <td className={`${cellClass} font-mono text-[10px]`} data-travel-ledger-cell="id">
                <div>{b.id}</div>
                {b.kind === 'booking' && b.receiptHref !== null && b.icsHref !== null && (
                  <div className="mt-1 flex flex-wrap gap-1 font-sans text-xs">
                    <Link href={b.receiptHref} className={DOOR_CLASS} data-booking-receipt={b.id}>
                      {BOOKING_WORDS.receipt}
                    </Link>
                    {/* CAL-02 (2026-09-27): the booking as a calendar file — a plain anchor: the route answers it as an
                        attachment, and a refusal (no day stated yet) reads as its named words, not a saved error file. */}
                    <a href={b.icsHref} className={DOOR_CLASS} data-booking-ics={b.id}>
                      {BOOKING_WORDS.addToCalendar}
                    </a>
                    {b.tripHref !== null && (
                      <Link href={b.tripHref} className={DOOR_CLASS} data-booking-trip={b.id}>
                        {BOOKING_WORDS.trip}
                      </Link>
                    )}
                  </div>
                )}
                {/* TRAVEL-02b: a typed row's two doors — the one link picker (manual only), and its void while it is not voided. */}
                {b.source === 'typed' && (
                  <div className="mt-1 flex flex-wrap gap-1 font-sans text-xs">
                    <button type="button" className={chipClass} onClick={() => setPicking(picking === b.id ? null : b.id)} aria-expanded={picking === b.id} data-travel-expense-link={b.id}>{LINK_PAYMENT_WORDS}</button>
                    {!b.voided && <button type="button" className={chipClass} onClick={() => setVoiding(voiding === b.id ? null : b.id)} aria-expanded={voiding === b.id} data-travel-expense-void={b.id}>{VOID_WORDS}</button>}
                  </div>
                )}
              </td>
            </tr>
            {b.source === 'typed' && picking === b.id && (
              <tr className="border-t border-border" data-travel-expense-picker={b.id}>
                <td colSpan={TRAVEL_LEDGER_TABLE.length} className={cellClass}>
                  <LinkPicker kind="travel_expense" id={b.id} instant={null} near={b.day} onChanged={readAgain} onClose={closePicker} />
                </td>
              </tr>
            )}
            {b.source === 'typed' && voiding === b.id && (
              <tr className="border-t border-border" data-travel-expense-voiding={b.id}>
                <td colSpan={TRAVEL_LEDGER_TABLE.length} className={cellClass}>
                  <VoidTravelExpense id={b.id} onVoided={afterVoid} onClose={closeVoid} />
                </td>
              </tr>
            )}
          </Fragment>
        )}
        foot={(
          <tfoot>
            {/* Ruling D: the sum lines — STATED per currency, SETTLED per account currency, over the rows SHOWN; never one figure across currencies. */}
            <tr className="border-t border-border font-semibold text-text-primary" data-travel-ledger-sum="stated">
              <th scope="row" colSpan={TRAVEL_LEDGER_TABLE.length} className={`${cellClass} text-left`}>{statedSumLineWords(shown)}</th>
            </tr>
            <tr className="border-t border-border font-semibold text-text-primary" data-travel-ledger-sum="settled">
              <th scope="row" colSpan={TRAVEL_LEDGER_TABLE.length} className={`${cellClass} text-left`}>{settledSumLineWords(shown)}</th>
            </tr>
          </tfoot>
        )}
      >
        {loaded.state === 'loading' && <p className="text-sm text-text-faint" data-travel-ledger-loading>{BOOKING_WORDS.loading}</p>}
        {loaded.state === 'error' && <p className="text-sm text-brand-red" role="alert" data-travel-ledger-failed>{loaded.message}</p>}
        {ready && rows.length === 0 && <p className="text-sm text-text-faint" data-travel-ledger-none>{BOOKING_WORDS.none}</p>}
      </DataTable>
      {/* TRAVEL-02b (ruling E): "+ travel expense" under the ledger — its writer is TravelExpenseControls.tsx; the ledger reads again after a save. */}
      {loaded.state === 'done' && <TravelExpenseForm trips={loaded.trips} accounts={loaded.accounts} onSaved={readAgain} />}
    </div>
  );
}
