'use client';

/**
 * HomeLedger — HOME LEDGER · DAY on /home (HOME-LEDGER-01, Alex, 2026-11-06, rulings A, C, D, E).
 *
 * The day table of the home: every account with activity on the day the DAY CARD shows, by book, from REAL rows only —
 * the books, the task ledger's records, the travel ledger's stated rows, the bank rows not yet in the books — each row
 * naming its source and the rule that placed it on the day; every sum per currency; nothing calculated.
 *
 * THE DAY (ruling A) is the card's: the same `date` in the URL the card reads (DAY_CARD_PATH '/home'; DayCard.tsx —
 * ?date= when it is a day, else the browser's today, localToday, read on mount), so ‹ › on the card moves this table
 * to the same day; no second picker, no second "today". The viewer's zone is the browser's (Intl), read on mount, and
 * sent with the request — the route validates both and refuses a bad one by name; nothing is defaulted here.
 *
 * ONE authed GET (/api/home-ledger?date=&zone=); the leaf (src/lib/home/homeLedger.ts) built the rows, the summary and
 * the words on the server. THE SUMMARY (ruling D) above the rows: BOOK → ACCOUNT in the model's order, each line with
 * ACTUAL, TYPED ACTUAL per currency, STATED per currency and its row count — a line opens to the rows it adds; MATCH is
 * per row and never summed. THE ROWS in the one table idiom (DataTable — sort, filters, CSV); under them what is said
 * (counts by name, 'trading — not connected'). A 200 without a list it promises fails by name (travelLedger.ts
 * missingListWords through homeLedgerReadOf — the one reader). Every word is the leaf's; React state only.
 *
 * The shell's own component (ruling E): no registry row, as the day card. No `$` outside the currency home's formatters.
 */

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import DataTable, { cellClass, chipClass, moneyClass } from '@/components/table/DataTable';
import { isIsoDay } from '@/lib/budget/days';
import {
  DAY_WORDS, HOME_LEDGER_CSV_FILE_NAME, HOME_LEDGER_DAY_HEADING, HOME_LEDGER_KICKER_WORDS, HOME_LEDGER_LINE_WORDS, HOME_LEDGER_LOADING_WORDS,
  HOME_LEDGER_ROUTE, HOME_LEDGER_TABLE, HOME_LEDGER_UNREADABLE_WORDS, JOIN_WORDS, NO_ROWS_WORDS, SUMMARY_HEAD_WORDS, ZONE_WORDS, actualSumWords,
  homeLedgerCellWords, homeLedgerReadOf, rowsCountWords, saidLines, sumsWords,
  type HomeLedgerColumn, type HomeLedgerGroup, type HomeLedgerLine, type HomeLedgerRow, type HomeLedgerSaid,
} from '@/lib/home/homeLedger';
import { localToday } from '@/lib/localToday';
import { filterRows, noFilters, type TableFilters } from '@/lib/table/filters';
import { sortRows, type TableSort } from '@/lib/table/sort';
import { BLANK } from '@/lib/table/words';
import { noWordsRefusalWords } from '@/lib/travel/travelExpense';

type Loaded =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'done'; date: string; zone: string; rows: HomeLedgerRow[]; groups: HomeLedgerGroup[]; said: HomeLedgerSaid };

const NO_FILTERS = noFilters(HOME_LEDGER_TABLE);
const BLANK_CLASS = 'text-text-faint';
const head = 'px-2 py-1.5 font-normal text-left whitespace-nowrap text-[10px] uppercase tracking-wide text-text-faint';
const OPEN_ROWS_WORDS = 'rows';
const CLOSE_ROWS_WORDS = 'close';
/** The summary heads that read as text (left-aligned); the sums are right-aligned. */
const SUMMARY_TEXT_HEADS = ['BOOK · ACCOUNT', 'ACCOUNT NAME'] as const;

/** The server's words from an answer it gave (a 400's message, a 500's), or its status said when it gave none. */
function refusalWordsOf(data: unknown, status: number): string {
  if (typeof data === 'object' && data !== null) {
    const record = data as Record<string, unknown>;
    if (typeof record.message === 'string') return record.message;
    if (typeof record.error === 'string') return record.error;
  }
  return noWordsRefusalWords(status);
}

export default function HomeLedger() {
  const search = useSearchParams();
  const [today, setToday] = useState<string | null>(null);
  const [zone, setZone] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });
  const [filters, setFilters] = useState<TableFilters>(NO_FILTERS);
  const [sort, setSort] = useState<TableSort<HomeLedgerColumn> | null>(null);
  const [openFilter, setOpenFilter] = useState<HomeLedgerColumn | null>(null);
  // Ruling D: the summary line whose rows are open — one at a time; React state only.
  const [openLine, setOpenLine] = useState<string | null>(null);

  // The browser's today and zone, read on mount — never during the server render (the card's own rule, DayCard.tsx).
  useEffect(() => {
    setToday(localToday());
    setZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  // Ruling A — the card's day, by the card's own expression: ?date= when it is a day, else today (a bad ?date= is named by the card).
  const dateParam = search.get('date');
  const day = today === null ? null : dateParam !== null && isIsoDay(dateParam) ? dateParam : today;

  useEffect(() => {
    if (day === null) return;
    if (zone === null) return;
    let alive = true;
    setLoaded({ state: 'loading' });
    setOpenLine(null);
    (async () => {
      try {
        const res = await fetch(`${HOME_LEDGER_ROUTE}?${new URLSearchParams({ date: day, zone }).toString()}`, { cache: 'no-store' });
        // A body that is not JSON is read as none: a refusal then says its status; a 200 then fails by name (homeLedgerReadOf).
        const data: unknown = await res.json().catch(() => null);
        if (!res.ok) throw new Error(refusalWordsOf(data, res.status));
        const read = homeLedgerReadOf(data);
        if (alive) setLoaded({ state: 'done', ...read });
      } catch (err) {
        if (alive) setLoaded({ state: 'error', message: err instanceof Error ? err.message : HOME_LEDGER_UNREADABLE_WORDS });
      }
    })();
    return () => { alive = false; };
  }, [day, zone]);

  const rows: readonly HomeLedgerRow[] = useMemo(() => (loaded.state === 'done' ? loaded.rows : []), [loaded]);
  const shown = sortRows(filterRows(rows, filters, HOME_LEDGER_TABLE), sort, HOME_LEDGER_TABLE);
  const ready = loaded.state === 'done';
  const rowByKey = useMemo(() => new Map(rows.map((r) => [r.rowKey, r])), [rows]);

  const cell = (r: HomeLedgerRow, column: HomeLedgerColumn, blank: boolean, className: string = cellClass, title: string | null = null) => (
    <td key={column} className={`${className} ${blank ? BLANK_CLASS : ''}`} data-home-ledger-cell={column} title={title === null ? undefined : title}>{homeLedgerCellWords(r, column)}</td>
  );

  return (
    <section aria-label="Home ledger — day" data-home-ledger className="mt-5 sm:mt-6">
      <header className="mb-3">
        <p className="font-mono text-[10px] sm:text-xs uppercase tracking-[0.2em] text-text-faint">{HOME_LEDGER_KICKER_WORDS}</p>
        <h2 className="mt-1 text-lg sm:text-xl font-semibold tracking-tight text-text-primary" data-home-ledger-heading>{HOME_LEDGER_DAY_HEADING}</h2>
        <p className="mt-1 text-xs text-text-muted">{HOME_LEDGER_LINE_WORDS}</p>
        {day !== null && zone !== null && (
          <p className="mt-1 font-mono text-xs text-text-secondary" data-home-ledger-day={day} data-home-ledger-zone={zone}>
            {DAY_WORDS} {day}{JOIN_WORDS}{ZONE_WORDS} {zone}
          </p>
        )}
      </header>

      <div className="rounded-lg border border-border bg-white p-4 space-y-3">
        {/* Ruling D: THE DAY × COA SUMMARY above the rows — each line opens to the rows it adds. */}
        {ready && loaded.groups.length > 0 && (
          <div className="overflow-x-auto rounded border border-border bg-white" data-home-ledger-summary>
            <table className="w-full min-w-[56rem] border-collapse text-xs" data-home-ledger-summary-table>
              <thead>
                <tr>
                  {SUMMARY_HEAD_WORDS.map((h) => <th key={h} scope="col" className={(SUMMARY_TEXT_HEADS as readonly string[]).includes(h) ? head : `${head} text-right`}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {loaded.groups.map((g) => (
                  <Fragment key={g.key}>
                    <tr className="border-t border-border bg-bg-row" data-home-ledger-group={g.key}>
                      <td className={`${cellClass} font-semibold text-text-primary`} data-home-ledger-group-label>{g.label}</td>
                      <td className={cellClass} />
                      <td className={`${moneyClass}`} data-home-ledger-group-rows>{rowsCountWords(g.rows)}</td>
                      <td className={`${moneyClass} ${g.actualCents === null ? BLANK_CLASS : 'font-semibold text-text-primary'}`} data-home-ledger-group-actual>{actualSumWords(g.actualCents)}</td>
                      <td className={`${moneyClass} ${g.typedActual.byCode.length === 0 ? BLANK_CLASS : ''}`} data-home-ledger-group-typed>{sumsWords(g.typedActual)}</td>
                      <td className={`${moneyClass} ${g.stated.byCode.length === 0 ? BLANK_CLASS : ''}`} data-home-ledger-group-stated>{sumsWords(g.stated)}</td>
                    </tr>
                    {g.lines.map((l: HomeLedgerLine) => (
                      <Fragment key={l.key}>
                        <tr className="border-t border-border" data-home-ledger-line={l.key}>
                          <td className={`${cellClass} pl-6`}>
                            <button type="button" className={chipClass} onClick={() => setOpenLine(openLine === l.key ? null : l.key)} aria-expanded={openLine === l.key} data-home-ledger-line-open={l.key}>
                              {l.label}{JOIN_WORDS}{openLine === l.key ? CLOSE_ROWS_WORDS : OPEN_ROWS_WORDS}
                            </button>
                          </td>
                          <td className={`${cellClass} ${l.accountName === null ? BLANK_CLASS : ''}`} data-home-ledger-line-name>{l.accountName === null ? BLANK : l.accountName}</td>
                          <td className={moneyClass} data-home-ledger-line-rows>{rowsCountWords(l.rows)}</td>
                          <td className={`${moneyClass} ${l.actualCents === null ? BLANK_CLASS : ''}`} data-home-ledger-line-actual>{actualSumWords(l.actualCents)}</td>
                          <td className={`${moneyClass} ${l.typedActual.byCode.length === 0 ? BLANK_CLASS : ''}`} data-home-ledger-line-typed>{sumsWords(l.typedActual)}</td>
                          <td className={`${moneyClass} ${l.stated.byCode.length === 0 ? BLANK_CLASS : ''}`} data-home-ledger-line-stated>{sumsWords(l.stated)}</td>
                        </tr>
                        {openLine === l.key && (
                          <tr className="border-t border-border" data-home-ledger-line-rows-open={l.key}>
                            <td colSpan={SUMMARY_HEAD_WORDS.length} className={cellClass}>
                              <ul className="space-y-0.5 text-xs">
                                {l.rowKeys.map((k) => {
                                  const r = rowByKey.get(k);
                                  if (r === undefined) return null;
                                  return (
                                    <li key={k} className="flex flex-wrap items-baseline gap-2" data-home-ledger-opened-row={k}>
                                      <span className="font-mono text-text-muted">{homeLedgerCellWords(r, 'source')}</span>
                                      <span className="min-w-0 flex-1">{homeLedgerCellWords(r, 'description')}</span>
                                      <span className="font-mono tabular-nums">{homeLedgerCellWords(r, 'stated')}</span>
                                      <span className="font-mono tabular-nums">{homeLedgerCellWords(r, 'actual')}</span>
                                      <span className="font-mono tabular-nums">{homeLedgerCellWords(r, 'typedActual')}</span>
                                      <span className="font-mono text-[10px] text-text-faint">{r.id}</span>
                                    </li>
                                  );
                                })}
                              </ul>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <DataTable
          name="home-ledger"
          columns={HOME_LEDGER_TABLE}
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
          csv={shown.length > 0 ? { name: HOME_LEDGER_CSV_FILE_NAME } : null}
          controls={null}
          renderRow={(r) => (
            <tr key={r.rowKey} className={`border-t border-border ${r.voided ? 'line-through text-text-muted' : ''}`} data-home-ledger-row={r.rowKey} data-home-ledger-source={r.source}>
              {cell(r, 'date', false, `${cellClass} whitespace-nowrap tabular-nums`)}
              {cell(r, 'source', false, `${cellClass} whitespace-nowrap`)}
              {cell(r, 'book', r.book === null)}
              {cell(r, 'account', r.account === null)}
              {cell(r, 'accountName', r.accountName === null)}
              {cell(r, 'description', false)}
              {cell(r, 'vendor', r.vendor === null)}
              {cell(r, 'stated', r.stated === null && !r.notWholeCents, `${cellClass} whitespace-nowrap tabular-nums text-right`)}
              {cell(r, 'actual', r.actualCents === null, `${moneyClass} ${r.actualCents === null ? '' : 'font-semibold text-text-primary'}`)}
              {cell(r, 'typedActual', r.typedActualCents === null, moneyClass)}
              {cell(r, 'match', r.matchWords === BLANK, `${cellClass} whitespace-nowrap tabular-nums text-right`, r.matchTitle)}
              {cell(r, 'state', false, `${cellClass} whitespace-nowrap`)}
              {cell(r, 'id', false, `${cellClass} font-mono text-[10px]`)}
            </tr>
          )}
          foot={null}
        >
          {loaded.state === 'loading' && <p className="text-sm text-text-faint" data-home-ledger-loading>{HOME_LEDGER_LOADING_WORDS}</p>}
          {loaded.state === 'error' && <p className="text-sm text-brand-red" role="alert" data-home-ledger-failed>{loaded.message}</p>}
          {ready && rows.length === 0 && <p className="text-sm text-text-faint" data-home-ledger-none>{NO_ROWS_WORDS}</p>}
        </DataTable>

        {/* What is said under the table — counts by name, and the trading line. */}
        {ready && (
          <ul className="space-y-0.5 text-xs text-text-muted" data-home-ledger-said>
            {saidLines(loaded.said).map((line) => <li key={line}>{line}</li>)}
          </ul>
        )}
      </div>
    </section>
  );
}
