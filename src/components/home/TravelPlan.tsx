'use client';

/**
 * TravelPlan — THE TRAVEL PLAN under HOME LEDGER · MONTH on /home (HOME-LEDGER-02a, Alex, 2026-11-07, ruling B).
 *
 * The caller's trip budget lines (budget_line_items, source 'trip') for the year the month table shows — ONE ROW PER
 * LINE, NEVER SUMMED: a line states no currency (FX-00), so no figure here is added to another, not even two lines of one
 * month on one code; the heading's lines say so, and that MONTH is the line's own (a line carries no day). The lines are
 * not in Budget (the budget report route law keeps every travel table out of Budget's files), so they sit in their own
 * table, read by their own route (GET /api/home-travel-plan?year=) and worded by their own leaf (src/lib/home/travelPlan.ts).
 *
 * THE YEAR is the host's (home/HomeMonth.tsx — the day card's year); this component takes it as a prop and reads no URL.
 * ONE authed GET; the rows in the one table idiom (DataTable — sort, filters, CSV). A 200 without its rows list fails by
 * name (travelPlanReadOf — the one reader). Every word is the leaf's; React state only. No `$` outside the currency home's
 * formatters; no total anywhere.
 */

import { useEffect, useMemo, useState } from 'react';
import DataTable, { cellClass } from '@/components/table/DataTable';
import {
  MONTH_RULE_WORDS, NO_TOTAL_WORDS, TRAVEL_PLAN_CSV_FILE_NAME, TRAVEL_PLAN_HEADING, TRAVEL_PLAN_KICKER_WORDS, TRAVEL_PLAN_LOADING_WORDS,
  TRAVEL_PLAN_ROUTE, TRAVEL_PLAN_TABLE, TRAVEL_PLAN_UNREADABLE_WORDS, noLinesWords, travelPlanCellWords, travelPlanReadOf,
  type TravelPlanColumn, type TravelPlanRow,
} from '@/lib/home/travelPlan';
import { filterRows, noFilters, type TableFilters } from '@/lib/table/filters';
import { sortRows, type TableSort } from '@/lib/table/sort';
import { noWordsRefusalWords } from '@/lib/travel/travelExpense';

type Loaded =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'done'; year: string; rows: TravelPlanRow[] };

const NO_FILTERS = noFilters(TRAVEL_PLAN_TABLE);
const BLANK_CLASS = 'text-text-faint';

/** The server's words from an answer it gave (a 400's message, a 500's), or its status said when it gave none. */
function refusalWordsOf(data: unknown, status: number): string {
  if (typeof data === 'object' && data !== null) {
    const record = data as Record<string, unknown>;
    if (typeof record.message === 'string') return record.message;
    if (typeof record.error === 'string') return record.error;
  }
  return noWordsRefusalWords(status);
}

export default function TravelPlan({ year }: { year: string }) {
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });
  const [filters, setFilters] = useState<TableFilters>(NO_FILTERS);
  const [sort, setSort] = useState<TableSort<TravelPlanColumn> | null>(null);
  const [openFilter, setOpenFilter] = useState<TravelPlanColumn | null>(null);

  useEffect(() => {
    let alive = true;
    setLoaded({ state: 'loading' });
    (async () => {
      try {
        const res = await fetch(`${TRAVEL_PLAN_ROUTE}?${new URLSearchParams({ year }).toString()}`, { cache: 'no-store' });
        // A body that is not JSON is read as none: a refusal then says its status; a 200 then fails by name (travelPlanReadOf).
        const data: unknown = await res.json().catch(() => null);
        if (!res.ok) throw new Error(refusalWordsOf(data, res.status));
        const read = travelPlanReadOf(data);
        if (alive) setLoaded({ state: 'done', ...read });
      } catch (err) {
        if (alive) setLoaded({ state: 'error', message: err instanceof Error ? err.message : TRAVEL_PLAN_UNREADABLE_WORDS });
      }
    })();
    return () => { alive = false; };
  }, [year]);

  const rows: readonly TravelPlanRow[] = useMemo(() => (loaded.state === 'done' ? loaded.rows : []), [loaded]);
  const shown = sortRows(filterRows(rows, filters, TRAVEL_PLAN_TABLE), sort, TRAVEL_PLAN_TABLE);
  const ready = loaded.state === 'done';

  const cell = (r: TravelPlanRow, column: TravelPlanColumn, blank: boolean, className: string = cellClass) => (
    <td key={column} className={`${className} ${blank ? BLANK_CLASS : ''}`} data-travel-plan-cell={column}>{travelPlanCellWords(r, column)}</td>
  );

  return (
    <section aria-label="Travel plan — trip budget lines" data-travel-plan className="mt-5 sm:mt-6">
      <header className="mb-3">
        <p className="font-mono text-[10px] sm:text-xs uppercase tracking-[0.2em] text-text-faint">{TRAVEL_PLAN_KICKER_WORDS}</p>
        <h2 className="mt-1 text-lg sm:text-xl font-semibold tracking-tight text-text-primary" data-travel-plan-heading>{TRAVEL_PLAN_HEADING}</h2>
        <p className="mt-1 text-xs text-text-muted" data-travel-plan-no-total>{NO_TOTAL_WORDS}</p>
        <p className="mt-1 text-xs text-text-muted" data-travel-plan-month-rule>{MONTH_RULE_WORDS}</p>
        <p className="mt-1 font-mono text-xs text-text-secondary" data-travel-plan-year={year}>year {year}</p>
      </header>

      <div className="rounded-lg border border-border bg-white p-4 space-y-3">
        <DataTable
          name="travel-plan"
          columns={TRAVEL_PLAN_TABLE}
          rows={rows}
          shown={shown}
          loaded={ready}
          tableClassName="min-w-[72rem]"
          filters={filters}
          onFilters={setFilters}
          noFilters={NO_FILTERS}
          sort={sort}
          onSort={setSort}
          openFilter={openFilter}
          onOpenFilter={setOpenFilter}
          csv={shown.length > 0 ? { name: TRAVEL_PLAN_CSV_FILE_NAME } : null}
          controls={null}
          renderRow={(r) => (
            <tr key={r.id} className="border-t border-border" data-travel-plan-row={r.id}>
              {cell(r, 'month', false, `${cellClass} whitespace-nowrap tabular-nums`)}
              {cell(r, 'source', false, `${cellClass} whitespace-nowrap`)}
              {cell(r, 'book', false)}
              {cell(r, 'account', false)}
              {cell(r, 'accountName', false)}
              {cell(r, 'description', r.description === null)}
              {cell(r, 'trip', false)}
              {cell(r, 'tripBudget', false, `${cellClass} whitespace-nowrap tabular-nums text-right`)}
              {cell(r, 'id', false, `${cellClass} font-mono text-[10px]`)}
            </tr>
          )}
          foot={null}
        >
          {loaded.state === 'loading' && <p className="text-sm text-text-faint" data-travel-plan-loading>{TRAVEL_PLAN_LOADING_WORDS}</p>}
          {loaded.state === 'error' && <p className="text-sm text-brand-red" role="alert" data-travel-plan-failed>{loaded.message}</p>}
          {ready && rows.length === 0 && <p className="text-sm text-text-faint" data-travel-plan-none>{noLinesWords(loaded.year)}</p>}
        </DataTable>
      </div>
    </section>
  );
}
