'use client';

/**
 * TAB13-02b — THE BUDGET REPORT on /budget: what you planned, what posted, and
 * the difference, by book and account. EVERY FIGURE IS READ-ONLY.
 *
 * BUDGET-02 (2026-10-20) — BUDGET IS ONE PAGE, ruled by Alex:
 *   · A. The page is the three tables and nothing else. The only control is
 *     ‹ year ›; the year lives in the URL (?year=YYYY — reportView.ts), and with
 *     none the page opens on the viewer's current year. The DAY and WEEK views,
 *     the section chips, the account filter, the "what this view is missing"
 *     notice and the day's plan with its vendor box (DayPlanDrill.tsx, deleted)
 *     left the screen.
 *   · B. One table per book, in the model's order — Business · Personal ·
 *     Trading, then any other book under its own name; two books of one type
 *     are "<type> · <book name>" (reportView.ts tableLabels).
 *   · C. Rows are the model's: every active revenue and expense account of the
 *     book's chart, an archived one only with a figure. Columns Jan … Dec, YTD.
 *   · D. Budget · Actual · Variance as the model gives them, written by the one
 *     formatter (format.ts): '—' is blank, never zero; a book with no plan line
 *     prints "no budget" in its Budget rows.
 *   · E. A Budget or Actual FIGURE is a button: it opens the lines behind it
 *     (GET /api/budget/report/cell), one panel at a time; a second click on the
 *     same figure closes it. The panel prints its own sum and whether it
 *     matches the cell, says which Budget figure it lists, links a routine's
 *     line to /tasks and a task's to /tasks?project=<id>, and an Actual's
 *     "open in Books" to /ledger?account=&book=&from=&to=.
 * The screen sums nothing: every figure is the model's, every word the pure
 * helpers'. asOf is the BROWSER's local date — the viewer's today — read once
 * on mount (never during the server render). No browser storage of any kind.
 *
 * Styled like the Travel tab: SECTION_HEADER headings (ModuleLauncher.tsx
 * TravelHeading), TripBudgetActual's statement table, ToggleStrip's toggleChip.
 */
import { Fragment, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { SECTION_HEADER, toggleChip } from '@/lib/ds';
import { formatAccountCode, formatBudget, formatCents, formatVariance } from '@/lib/budget/format';
import { shownBudget, type ReportBook, type ReportColumn, type ReportRow } from '@/lib/budget/report';
import type { BudgetCellResponse, BudgetReportResponse } from '@/lib/budget/reportInputs';
import {
  actualDrillWords, agreement, budgetDrillWords, cellQuery, ledgerHref, reportQuery, stepYear, tableLabels, yearHref, yearOf,
} from '@/lib/budget/reportView';
// WEEK-01: the browser's date — the one module that reads it.
import { localToday } from '@/lib/localToday';

type Read<T> =
  | { state: 'loading' }
  | { state: 'ok'; data: T }
  | { state: 'signedOut' }
  | { state: 'refused'; status: number; message: string }
  | { state: 'failed'; status: number | null; code: string; message: string | null };

/** The figure a drill opened from: one row's Budget or Actual in one column. */
interface Opened {
  readonly book: string;
  readonly code: string;
  readonly column: string;
  readonly figure: 'budget' | 'actual';
}

const sameOpen = (a: Opened | null, b: Opened): boolean =>
  a !== null && a.book === b.book && a.code === b.code && a.column === b.column && a.figure === b.figure;

// TripBudgetActual.tsx:367-368 — the statement table's cell classes.
const th = 'px-3 py-2 text-left font-medium text-text-faint whitespace-nowrap';
const td = 'px-3 py-2 whitespace-nowrap';
const num = `${td} text-right font-mono`;
const figureButton = 'font-mono underline decoration-dotted underline-offset-2 hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold rounded-sm';

/**
 * A GET of a budget route, read the report's way: a redirect (the middleware's
 * answer to no session, src/middleware.ts) is signed out; a body that is not JSON
 * fails by name; 400 · 404 · 422 are refusals in the route's own words.
 */
async function readBudget<T>(url: string): Promise<Read<T>> {
  let res: Response;
  try {
    res = await fetch(url, { cache: 'no-store', redirect: 'manual' });
  } catch (error) {
    return { state: 'failed', status: null, code: 'network', message: error instanceof Error ? error.message : String(error) };
  }
  if (res.type === 'opaqueredirect') return { state: 'signedOut' };
  const type = res.headers.get('content-type');
  if (type === null || !type.includes('application/json')) return { state: 'failed', status: res.status, code: 'not-json', message: `the route answered ${res.status} with no JSON` };
  let body: Record<string, unknown>;
  try {
    body = await res.json();
  } catch (error) {
    return { state: 'failed', status: res.status, code: 'bad-json', message: error instanceof Error ? error.message : String(error) };
  }
  if (res.ok) return { state: 'ok', data: body as unknown as T };
  if (res.status === 401) return { state: 'signedOut' };
  if (res.status === 400 || res.status === 404 || res.status === 422) return { state: 'refused', status: res.status, message: `${body.error}: ${body.message}` };
  return { state: 'failed', status: res.status, code: String(body.error), message: typeof body.message === 'string' && body.message !== body.error ? body.message : null };
}

function ReadWords<T>({ read, what }: { read: Read<T>; what: string }) {
  if (read.state === 'loading') return <p className="text-sm text-text-faint">Loading {what}…</p>;
  if (read.state === 'signedOut') return <p className="text-sm text-text-muted">Sign in to see {what}.</p>;
  if (read.state === 'refused') return <p className="text-sm text-brand-red" data-budget-refused={read.status}>{read.message}</p>;
  if (read.state === 'failed') {
    return (
      <p className="text-sm text-brand-red" data-budget-failed={read.code}>
        {what} failed: {read.code}{read.message !== null && <span> — {read.message}</span>}
      </p>
    );
  }
  return null;
}

/** The panel behind one figure: its lines, their sum against the cell, and where they live. */
function DrillPanel({ opened, column, account, clicked, asOf, close }: {
  opened: Opened;
  column: ReportColumn;
  account: string;
  /** The figure the viewer clicked, as the table printed it. */
  clicked: number | null;
  asOf: string;
  close: () => void;
}) {
  const [read, setRead] = useState<Read<BudgetCellResponse>>({ state: 'loading' });
  const query = cellQuery(opened.book, opened.code, column, asOf);
  useEffect(() => {
    let live = true;
    setRead({ state: 'loading' });
    (async () => {
      const next = await readBudget<BudgetCellResponse>(`/api/budget/report/cell?${query}`);
      if (live) setRead(next);
    })();
    return () => { live = false; };
  }, [query]);

  const title = `${account} — ${column.label} ${column.from.slice(0, 4)} — ${opened.figure === 'budget' ? 'Budget' : 'Actual'}`;
  return (
    <div className="space-y-2 rounded border border-border bg-bg-row px-3 py-3" role="region" aria-label={title} data-budget-drill={opened.figure}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-text-primary">{title}</p>
        <button type="button" className={toggleChip(false)} onClick={close} aria-label="Close the lines behind this figure">Close</button>
      </div>
      <ReadWords read={read} what="the lines behind this figure" />
      {read.state === 'ok' && opened.figure === 'budget' && (() => {
        const b = read.data.budget;
        const verdict = agreement(b.sum, clicked);
        return (
          <>
            <p className="text-xs text-text-faint" data-drill-which={b.shown}>Lists {budgetDrillWords(b)}.</p>
            {b.lines.length === 0 ? <p className="text-sm text-text-muted">No plan line is behind this figure.</p> : (
              <div className="overflow-x-auto rounded-lg border border-border bg-white">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-white font-mono text-[10px] uppercase tracking-wider">
                      <th className={th}>Date</th>
                      <th className={th}>Routine or task</th>
                      <th className={`${th} text-right`}>Amount</th>
                      <th className={th}>Vendor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {b.lines.map((l, i) => (
                      <tr key={`${l.day}:${l.label}:${l.line ?? ''}:${i}`} className="border-b border-border last:border-0">
                        <td className={`${td} font-mono`}>{l.day}</td>
                        <td className={td}>
                          <Link href={l.href} className="underline" data-drill-plan-link={l.source}>{l.label}</Link>
                          <span className="text-text-faint"> · {l.source}{l.line !== null && ` — ${l.line}`}</span>
                        </td>
                        <td className={num}>{formatCents(l.cents)}</td>
                        <td className={td}>{l.vendor === null ? <span className="text-text-faint">no vendor planned</span> : l.vendor}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className={`text-sm ${verdict.matches ? 'text-text-primary' : 'text-brand-red'}`} data-drill-sum={verdict.matches ? 'matches' : 'differs'}>
              Σ {formatCents(b.sum)} — {verdict.words}
            </p>
          </>
        );
      })()}
      {read.state === 'ok' && opened.figure === 'actual' && (() => {
        const a = read.data.actual;
        const verdict = agreement(a.sum, clicked);
        return (
          <>
            <p className="text-xs text-text-faint">Lists {actualDrillWords(a)}.</p>
            {a.lines.length === 0 ? <p className="text-sm text-text-muted">No ledger line is behind this figure.</p> : (
              <div className="overflow-x-auto rounded-lg border border-border bg-white">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-white font-mono text-[10px] uppercase tracking-wider">
                      <th className={th}>Date</th>
                      <th className={th}>Description</th>
                      <th className={`${th} text-right`}>Amount</th>
                      <th className={th}>Source</th>
                      <th className={th}>Entry</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.lines.map((l) => (
                      <tr key={l.lineId} className="border-b border-border last:border-0">
                        <td className={`${td} font-mono`}>{l.day}</td>
                        <td className={td}>{l.description}</td>
                        <td className={num}>{formatCents(l.signedCents)} <span className="text-xs text-text-faint">{l.entryType}</span></td>
                        <td className={`${td} text-text-muted`}>{l.sourceType}</td>
                        <td className={`${td} font-mono text-xs text-text-faint`}>{l.journalEntryId}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className={`text-sm ${verdict.matches ? 'text-text-primary' : 'text-brand-red'}`} data-drill-sum={verdict.matches ? 'matches' : 'differs'}>
              Σ {formatCents(a.sum)} — {verdict.words}
            </p>
            {a.through !== null && (
              <Link href={ledgerHref(opened.code, opened.book, a.from, a.through)} className="text-sm underline" data-drill-open-books>
                open in Books
              </Link>
            )}
          </>
        );
      })()}
    </div>
  );
}

/** A figure: a button that opens its lines when it has a figure, plain '—' when it is blank. */
function Figure({ cents, text, label, expanded, toggle }: {
  cents: number | null;
  text: React.ReactNode;
  label: string;
  expanded: boolean;
  toggle: () => void;
}) {
  if (cents === null) return <>{text}</>;
  return (
    <button type="button" className={figureButton} aria-expanded={expanded} aria-label={label} onClick={toggle}>
      {text}
    </button>
  );
}

/** One account's three lines across Jan … Dec and YTD, and — when one of its figures is open — the panel behind it. */
function AccountRows({ book, row, account, columns, asOf, opened, toggle }: {
  book: ReportBook;
  row: ReportRow;
  account: string;
  columns: readonly ReportColumn[];
  asOf: string;
  opened: Opened | null;
  toggle: (o: Opened) => void;
}) {
  const at = (column: ReportColumn, figure: Opened['figure']): Opened => ({ book: book.entityId, code: row.code, column: column.key, figure });
  const open = opened !== null && opened.book === book.entityId && opened.code === row.code ? opened : null;
  const openColumn = open === null ? undefined : columns.find((c) => c.key === open.column);
  const openCell = openColumn === undefined ? undefined : row.cells[columns.indexOf(openColumn)];
  return (
    <>
      <tr className="border-b border-border">
        <td className={`${td} font-medium text-text-primary`} rowSpan={3}>{account}</td>
        <td className={`${td} text-text-muted`}>Budget</td>
        {book.hasPlanLines ? columns.map((c, i) => {
          const cell = row.cells[i];
          const b = formatBudget(c.state, cell.budgetToDate, cell.budgetFull);
          const shown = shownBudget(c.state) === 'full' ? cell.budgetFull : cell.budgetToDate;
          return (
            <td key={c.key} className={num}>
              <Figure cents={shown} text={b.text} label={`${account}, ${c.label} budget ${b.text} — show its plan lines`} expanded={sameOpen(opened, at(c, 'budget'))} toggle={() => toggle(at(c, 'budget'))} />
              {b.note !== null && <span className="text-xs text-text-faint" data-budget-note={c.state}> {b.note}</span>}
            </td>
          );
        }) : <td className={`${td} text-text-faint italic`} colSpan={columns.length} data-no-budget>no budget</td>}
      </tr>
      <tr className="border-b border-border">
        <td className={`${td} text-text-muted`}>Actual</td>
        {columns.map((c, i) => {
          const actual = row.cells[i].actual;
          const text = formatCents(actual);
          return (
            <td key={c.key} className={num}>
              <Figure cents={actual} text={text} label={`${account}, ${c.label} actual ${text} — show its ledger lines`} expanded={sameOpen(opened, at(c, 'actual'))} toggle={() => toggle(at(c, 'actual'))} />
            </td>
          );
        })}
      </tr>
      <tr className="border-b border-border">
        <td className={`${td} text-text-muted`}>Variance</td>
        {row.cells.map((cell, i) => {
          const v = formatVariance(cell.variance);
          return <td key={columns[i].key} className={num}><span className={v.unfavourable ? 'text-brand-red' : undefined}>{v.text}</span></td>;
        })}
      </tr>
      {open !== null && openColumn !== undefined && openCell !== undefined && (
        <tr className="border-b border-border">
          <td colSpan={columns.length + 2} className="px-3 py-2">
            <DrillPanel
              opened={open}
              column={openColumn}
              account={account}
              clicked={open.figure === 'actual' ? openCell.actual : shownBudget(openColumn.state) === 'full' ? openCell.budgetFull : openCell.budgetToDate}
              asOf={asOf}
              close={() => toggle(open)}
            />
          </td>
        </tr>
      )}
    </>
  );
}

function BookTable({ book, label, report, asOf, opened, toggle }: {
  book: ReportBook;
  label: string;
  report: BudgetReportResponse['report'];
  asOf: string;
  opened: Opened | null;
  toggle: (o: Opened) => void;
}) {
  const { columns } = report;
  return (
    <section className="space-y-3" data-budget-table={book.entityId}>
      <h2 className={SECTION_HEADER}>{label}</h2>
      {book.rows.length === 0 ? (
        <p className="text-sm text-text-muted" data-budget-no-accounts>{label} has no income or expense account in its chart.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-white font-mono text-[10px] uppercase tracking-wider">
                <th className={th}>Account</th>
                <th className={th}><span className="sr-only">Figure</span></th>
                {columns.map((c) => <th key={c.key} className={`${th} text-right`}>{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {book.rows.map((row) => {
                const account = `${formatAccountCode(report.books, row.entityId, row.code)} · ${row.name}`;
                return (
                  <Fragment key={row.code}>
                    <AccountRows book={book} row={row} account={account} columns={columns} asOf={asOf} opened={opened} toggle={toggle} />
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function BudgetReport() {
  const router = useRouter();
  const search = useSearchParams();
  // The viewer's today, read on mount only — the server render has no business guessing it.
  const [asOf, setAsOf] = useState<string | null>(null);
  const [load, setLoad] = useState<Read<BudgetReportResponse>>({ state: 'loading' });
  // E: one panel at a time; a second click on the same figure closes it. React state only.
  const [opened, setOpened] = useState<Opened | null>(null);

  useEffect(() => { setAsOf(localToday()); }, []);

  const year = asOf === null ? null : yearOf(new URLSearchParams(search.toString()), asOf);
  const query = year === null || asOf === null ? null : reportQuery(year, asOf);

  useEffect(() => {
    if (query === null) return;
    let live = true;
    setLoad({ state: 'loading' });
    setOpened(null);
    (async () => {
      const next = await readBudget<BudgetReportResponse>(`/api/budget/report?${query}`);
      if (live) setLoad(next);
    })();
    return () => { live = false; };
  }, [query]);

  const back = year === null ? null : stepYear(year, -1);
  const forward = year === null ? null : stepYear(year, 1);
  const toggle = (o: Opened) => setOpened((current) => (sameOpen(current, o) ? null : o));

  return (
    <div className="space-y-6">
      {/* THE ONE CONTROL — ‹ year ›. */}
      <div className="flex flex-wrap items-center gap-3" data-budget-year-bar>
        <div className="flex items-center gap-1.5">
          <button type="button" className={toggleChip(false)} aria-label="Back one year" disabled={back === null} onClick={() => { if (back !== null) router.push(yearHref(back)); }}>‹</button>
          <span className="font-mono text-sm text-text-primary" data-budget-year>{year === null ? '—' : year}</span>
          <button type="button" className={toggleChip(false)} aria-label="Forward one year" disabled={forward === null} onClick={() => { if (forward !== null) router.push(yearHref(forward)); }}>›</button>
        </div>
        <span className="text-xs text-text-faint">as of {asOf === null ? '—' : asOf}</span>
      </div>

      <ReadWords read={load} what="your budget" />
      {load.state === 'ok' && asOf !== null && (() => {
        const { report } = load.data;
        const labels = tableLabels(report.books);
        return report.books.map((book, i) => (
          <BookTable key={book.entityId} book={book} label={labels[i]} report={report} asOf={asOf} opened={opened} toggle={toggle} />
        ));
      })()}
    </div>
  );
}
