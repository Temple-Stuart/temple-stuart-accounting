'use client';

/**
 * AllBookings — THE TRAVEL LEDGER (TRAVEL-02a, Alex, 2026-11-02, rulings A, C, D).
 *
 * BOOKINGS-01 (2026-09-27) made this the ONE list of every booking of the signed-in user:
 * one authed GET of /api/reservations (every reservation WHERE userId = the caller, newest
 * first — guest rows never appear). TRAVEL-02a: the same GET, read for its `ledger` facts,
 * drawn as the TRAVEL LEDGER in THE table idiom — the shared DataTable (components/table)
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
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import DataTable, { cellClass, moneyClass } from '@/components/table/DataTable';
import { BOOKING_WORDS } from '@/lib/reservations/bookingRow';
import {
  TRAVEL_LEDGER_CSV_FILE_NAME, TRAVEL_LEDGER_TABLE, cellWordsOf, settledSumLineWords, statedSumLineWords, travelLedgerRows,
  type LedgerBookingIn, type TravelLedgerColumn, type TravelLedgerRow,
} from '@/lib/reservations/travelLedger';
import { filterRows, noFilters, type TableFilters } from '@/lib/table/filters';
import { sortRows, type TableSort } from '@/lib/table/sort';

type Loaded = { state: 'loading' } | { state: 'error'; message: string } | { state: 'done'; ledger: LedgerBookingIn[] };

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

  useEffect(() => { setZone(Intl.DateTimeFormat().resolvedOptions().timeZone); }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/reservations');
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : `${BOOKING_WORDS.unreadable} (${res.status})`);
        if (alive) setLoaded({ state: 'done', ledger: Array.isArray(data.ledger) ? (data.ledger as LedgerBookingIn[]) : [] });
      } catch (err) {
        if (alive) setLoaded({ state: 'error', message: err instanceof Error ? err.message : BOOKING_WORDS.unreadable });
      }
    })();
    return () => { alive = false; };
  }, []);

  const rows: readonly TravelLedgerRow[] = useMemo(
    () => (loaded.state === 'done' && zone !== null ? travelLedgerRows(loaded.ledger, zone) : []),
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
          <tr key={b.rowKey} className="border-t border-border" data-travel-ledger-row={b.rowKey} data-travel-ledger-kind={b.kind} data-booking-row={b.bookingId}>
            {cell(b, 'date', false, `${cellClass} whitespace-nowrap tabular-nums`)}
            {cell(b, 'kind', false)}
            {cell(b, 'lane', false)}
            {cell(b, 'trip', b.trip === null)}
            {cell(b, 'book', b.book === null, `${cellClass} whitespace-nowrap`)}
            {cell(b, 'account', b.account === null, `${cellClass} whitespace-nowrap`)}
            {cell(b, 'vendor', false)}
            {cell(b, 'confirmation', b.confirmation === null, `${cellClass} font-mono`)}
            {cell(b, 'dates', b.dates === null, `${cellClass} whitespace-nowrap`)}
            {cell(b, 'stated', b.stated === null, `${moneyClass} ${b.stated === null ? '' : 'font-semibold text-text-primary'}`)}
            {cell(b, 'settled', b.settled === null, `${moneyClass} ${b.settled === null ? '' : 'font-semibold text-text-primary'}`)}
            {cell(b, 'posted', !(b.kind === 'booking' && b.postedDay !== null), `${cellClass} whitespace-nowrap`)}
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
            </td>
          </tr>
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
    </div>
  );
}
