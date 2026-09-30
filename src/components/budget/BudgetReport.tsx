'use client';

/**
 * TAB13-02b — THE BUDGET REPORT on /budget: what you planned, what posted, and
 * the difference, by book and account. EVERY FIGURE IS READ-ONLY. TAB13-04: the
 * one input on this screen writes a plan line's vendor (and a new vendor), through
 * the two vendor routes (/api/operations/plan-vendors, /api/operations/
 * vendor-directory) — never a figure.
 *
 * THE VIEW lives in the URL (?view=day&day= · ?view=week&weekOf= · ?view=year&year=),
 * so a link is shareable and the back button works; with no view in the URL the
 * screen opens on DAY, today. asOf is the BROWSER's local date — the viewer's
 * today — read once on mount (never during the server render, whose clock and
 * zone are the server's). No browser storage of any kind.
 *
 * TAB13-03 (2026-09-29): ONE SECTION AT A TIME. Under the view bar, a chip for
 * OVERVIEW and one per book (report.books — P, B, T, then books with no letter);
 * the choice is in the URL too (?book=<entityId>), and on a book the Account
 * column's header filters to one account (?account=<four digits>). Every link
 * keeps the choice — src/lib/budget/reportView.ts builds them all, and refuses
 * by name a choice the report cannot honour.
 *
 * TAB13-03b (2026-09-29): A BOOK IS ITS ITEMIZED TABLE — its heading and its
 * accounts, the Account filter in the header, nothing above the table (the
 * book's own totals stay in the model and the response). The Overview keeps the
 * report's totals, made by the model (report.ts totalsOf), never summed here.
 *
 * Every figure comes from GET /api/budget/report and is written by the one
 * formatter (src/lib/budget/format.ts): '—' is blank, never zero; an
 * unfavourable variance is in parentheses and brand red. What THIS view is
 * missing is DECLARED, never filled in: under whichever section is shown, one
 * line for each gap in its money that exists — plans not placed (BUDGET SHORT),
 * bank transactions not in the books (ACTUAL SHORT) — and nothing when there is
 * none (reportView.ts missingMoney, TAB13-03b).
 *
 * TAB13-04 (2026-09-29): THE DAY'S PLAN AND ITS VENDORS. On a book filtered to one
 * account with a row, under the table, the plan lines behind that account's
 * figure on a DAY or WEEK, each with its vendor box (DayPlanDrill.tsx); a YEAR
 * says in words that it lists none. VENDORS STRANDED — planned vendors no plan
 * line of this view matches — is one more line of the notice, each with Clear.
 * After a write the report is fetched again with the same query: the screen
 * shows what the server holds, never an optimistic copy.
 *
 * Styled like the Travel tab: SECTION_HEADER headings (ModuleLauncher.tsx
 * TravelHeading), TripBudgetActual's statement table, ToggleStrip's toggleChip.
 */
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SECTION_HEADER, toggleChip } from '@/lib/ds';
import { formatAccountCode, formatBudget, formatCents, formatVariance } from '@/lib/budget/format';
import type { ColumnTotals, ReportBook, ReportCell, ReportColumn, SectionTotal, UnplacedItem } from '@/lib/budget/report';
import type { BudgetReportResponse } from '@/lib/budget/reportInputs';
import {
  accountHref, anchorOf, bookChipLabels, choiceOf, hrefFor, missingMoney, sectionFor, sectionHref, stepHref,
  viewParams, type Section, type SectionChoice,
} from '@/lib/budget/reportView';
import DayPlanDrill, { ClearVendor } from '@/components/budget/DayPlanDrill';
// WEEK-01: the browser's date — the one module that reads it (moved from this file).
import { localToday } from '@/lib/localToday';

type Kind = 'day' | 'week' | 'year';
const KINDS: readonly { kind: Kind; label: string }[] = [
  { kind: 'day', label: 'DAY' },
  { kind: 'week', label: 'WEEK' },
  { kind: 'year', label: 'YEAR' },
];

type Load =
  | { state: 'loading' }
  | { state: 'ok'; data: BudgetReportResponse }
  | { state: 'signedOut' }
  | { state: 'refused'; status: number; message: string }
  | { state: 'failed'; status: number | null; code: string; message: string | null };

// TripBudgetActual.tsx:367-368 — the statement table's cell classes.
const th = 'px-3 py-2 text-left font-medium text-text-faint whitespace-nowrap';
const td = 'px-3 py-2 whitespace-nowrap';
const num = `${td} text-right font-mono`;

function Heading({ children }: { children: React.ReactNode }) {
  return <h2 className={SECTION_HEADER}>{children}</h2>;
}

/** The budget line by the column's state (format.ts formatBudget): to date; "of <full>" in progress; the full plan, marked planned, in a future column. */
function BudgetFigure({ column, toDate, full }: { column: ReportColumn; toDate: number | null; full: number | null }) {
  const b = formatBudget(column.state, toDate, full);
  return (
    <>
      {b.text}
      {b.note !== null && <span className="text-xs text-text-faint" data-budget-note={column.state}> {b.note}</span>}
    </>
  );
}

function VarianceFigure({ cents }: { cents: number | null }) {
  const v = formatVariance(cents);
  return <span className={v.unfavourable ? 'text-brand-red' : undefined}>{v.text}</span>;
}

/** One figure line (Budget · Actual · Variance) across every column. */
function FigureRows({ label, columns, cells }: {
  label: string;
  columns: readonly ReportColumn[];
  cells: readonly (ReportCell | SectionTotal)[];
}) {
  return (
    <>
      <tr className="border-b border-border">
        <td className={`${td} font-medium text-text-primary`} rowSpan={3}>{label}</td>
        <td className={`${td} text-text-muted`}>Budget</td>
        {cells.map((c, i) => <td key={columns[i].key} className={num}><BudgetFigure column={columns[i]} toDate={c.budgetToDate} full={c.budgetFull} /></td>)}
      </tr>
      <tr className="border-b border-border">
        <td className={`${td} text-text-muted`}>Actual</td>
        {cells.map((c, i) => <td key={columns[i].key} className={num}>{formatCents(c.actual)}</td>)}
      </tr>
      <tr className="border-b border-border last:border-0">
        <td className={`${td} text-text-muted`}>Variance</td>
        {cells.map((c, i) => <td key={columns[i].key} className={num}><VarianceFigure cents={c.variance} /></td>)}
      </tr>
    </>
  );
}

function TableHead({ columns, first }: { columns: readonly ReportColumn[]; first: React.ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-border bg-white font-mono text-[10px] uppercase tracking-wider">
        <th className={th}>{first}</th>
        <th className={th}><span className="sr-only">Figure</span></th>
        {columns.map((c) => <th key={c.key} className={`${th} text-right`}>{c.label}</th>)}
      </tr>
    </thead>
  );
}

/** Why a NET figure in the first column is blank: NET is strict — both sides or nothing. */
function netBlanks(totals: ColumnTotals): string[] {
  const why: string[] = [];
  if (totals.net.budgetToDate === null) {
    if (totals.income.budgetToDate === null) why.push('NET budget is blank: income has no budget yet');
    if (totals.expense.budgetToDate === null) why.push('NET budget is blank: expenses have no budget yet');
  }
  if (totals.net.actual === null) {
    if (totals.income.actual === null) why.push('NET actual is blank: no income has posted yet');
    if (totals.expense.actual === null) why.push('NET actual is blank: no expense has posted yet');
  }
  return why;
}

/**
 * The Overview's table and its NET-blank lines — the report's totals, from the
 * model (report.ts totalsOf). TAB13-03b: drawn on the Overview only; a book is
 * its itemized table.
 */
function TotalsTable({ columns, totals }: { columns: readonly ReportColumn[]; totals: readonly ColumnTotals[] }) {
  const blanks = totals.length > 0 ? netBlanks(totals[0]) : [];
  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-border bg-white">
        <table className="w-full text-sm">
          <TableHead columns={columns} first="Total" />
          <tbody>
            <FigureRows label="Total income" columns={columns} cells={totals.map((t) => t.income)} />
            <FigureRows label="Total expenses" columns={columns} cells={totals.map((t) => t.expense)} />
            <FigureRows label="Net" columns={columns} cells={totals.map((t) => t.net)} />
          </tbody>
        </table>
      </div>
      {blanks.map((line) => <p key={line} className="text-xs text-text-faint" data-net-blank>{line}</p>)}
    </>
  );
}

/** TAB13-02c: every account printed as its account string (B-5100, P-1500), by its book. */
function unplacedLine(item: UnplacedItem, books: readonly ReportBook[]): string {
  if (item.kind === 'budgetLine') {
    const l = item.line;
    return `${l.day} · ${l.source} budget line on ${formatAccountCode(books, l.entityId, l.code)} · ${formatCents(l.cents)} · ${item.reason}`;
  }
  const p = item.posting;
  return `${p.day} · ledger line on ${formatAccountCode(books, p.entityId, p.code)} (${p.entryType}) · ${formatCents(p.cents)} · ${item.reason}`;
}

/** THE TOGGLE — OVERVIEW, then one chip per book, in the report's own order. */
function SectionChips({ books, choice, go, search }: {
  books: readonly ReportBook[];
  choice: SectionChoice;
  go: (href: string) => void;
  search: URLSearchParams;
}) {
  const labels = bookChipLabels(books);
  return (
    <div className="flex flex-wrap gap-1.5" data-budget-sections>
      <button type="button" className={toggleChip(choice.book === null)} aria-pressed={choice.book === null} onClick={() => go(sectionHref(search, null))}>
        OVERVIEW
      </button>
      {books.map((b) => (
        <button
          key={b.entityId}
          type="button"
          className={toggleChip(choice.book === b.entityId)}
          aria-pressed={choice.book === b.entityId}
          onClick={() => go(sectionHref(search, b.entityId))}
        >
          {labels.get(b.entityId)}
        </button>
      ))}
    </div>
  );
}

/** A book is its itemized table (TAB13-03b): its heading, then its accounts — the Account header filters to one. */
function BookSection({ section, report, plans, go, search, reload }: {
  section: Extract<Section, { kind: 'book' }>;
  report: BudgetReportResponse['report'];
  plans: BudgetReportResponse['plans'];
  go: (href: string) => void;
  search: URLSearchParams;
  reload: () => void;
}) {
  const { book, account } = section;
  const { columns } = report;
  const shown = account.kind === 'all' ? book.rows : account.row === null ? [] : [account.row];
  const missing = account.kind === 'one' && account.row === null ? formatAccountCode(report.books, book.entityId, account.code) : null;
  const filter = (
    <select
      className="bg-white font-mono text-[10px] uppercase tracking-wider text-text-faint"
      aria-label="Filter by account"
      value={account.kind === 'all' ? '' : account.code}
      onChange={(e) => go(accountHref(search, book.entityId, e.target.value === '' ? null : e.target.value))}
      data-account-filter
    >
      <option value="">All accounts</option>
      {book.rows.map((row) => (
        <option key={row.code} value={row.code}>{formatAccountCode(report.books, row.entityId, row.code)} · {row.name}</option>
      ))}
      {missing !== null && account.kind === 'one' && <option value={account.code}>{missing}</option>}
    </select>
  );
  return (
    <section className="space-y-3" data-budget-section="book">
      <Heading>{book.label} · {book.entityName}</Heading>
      <div className="overflow-x-auto rounded-lg border border-border bg-white">
        <table className="w-full text-sm">
          <TableHead columns={columns} first={filter} />
          <tbody>
            {shown.map((row) => (
              <FigureRows key={row.code} label={`${formatAccountCode(report.books, row.entityId, row.code)} · ${row.name}`} columns={columns} cells={row.cells} />
            ))}
          </tbody>
        </table>
      </div>
      {missing !== null && <p className="text-sm text-text-muted" data-account-missing>{missing} has no planned or posted money in this view</p>}
      {missing === null && shown.length === 0 && <span className="text-xs text-text-muted italic">no planned or posted income or expense in this view.</span>}
      {/* TAB13-04: THE DAY'S PLAN — under an account filtered to one with a row: its plan lines and their vendors, or a YEAR's words. */}
      {account.kind === 'one' && account.row !== null && (plans.listed ? (
        <DayPlanDrill
          lines={plans.lines.filter((l) => l.entityId === book.entityId && l.code === account.code)}
          dayColumns={columns.filter((c) => c.kind === 'day')}
          week={report.view.kind === 'week'}
          bookName={`${book.label} · ${book.entityName}`}
          account={`${formatAccountCode(report.books, book.entityId, account.code)} · ${account.row.name}`}
          reload={reload}
        />
      ) : <p className="text-sm text-text-muted" data-plans-year>{plans.words}</p>)}
    </section>
  );
}

/**
 * TAB13-03b — WHAT THIS VIEW IS MISSING, under whichever section is shown: one
 * line per gap in its money that exists (reportView.ts missingMoney), NOTHING
 * when there is none. Each line's items open in place in a native <details>.
 */
function MissingNotice({ data, section, reload }: { data: BudgetReportResponse; section: Section; reload: () => void }) {
  const lines = missingMoney(data, section);
  if (lines.length === 0) return null;
  const { report } = data;
  return (
    <div className="space-y-2" data-missing-money>
      {lines.map((line) => (line.kind === 'budgetShort' ? (
        <details key="budget-short" open className="rounded border border-border bg-white px-3 py-2" data-missing="budget-short">
          <summary className="cursor-pointer text-sm text-text-primary">
            <span className="font-bold">BUDGET SHORT</span> — {line.placed.count} not placed · {formatCents(line.placed.plannedCents)} planned
            {line.placed.withoutAmount > 0 && <span> · {line.placed.withoutAmount} with no amount</span>}
            {line.placed.postings > 0 && <span> · {line.placed.postings} ledger line{line.placed.postings === 1 ? '' : 's'}</span>}
            <span className="text-xs text-text-faint"> · {line.placed.scope === 'book' ? 'this book' : 'all books'}</span>
          </summary>
          <ul className="mt-2 space-y-1 text-sm text-text-muted">
            {line.placed.notPlaced.map((n) => (
              <li key={`${n.sourceId}:${n.reason}`}>
                <span className="font-medium text-text-primary">{n.label}</span> · {n.source} · {n.day === null ? 'undated' : n.day} · {formatCents(n.cents)} · {n.reason}
                {n.detail !== null && <span className="text-xs text-text-faint"> ({n.detail})</span>}
              </li>
            ))}
            {line.placed.unplaced.map((u, i) => <li key={`unplaced:${i}`}>{unplacedLine(u, report.books)}</li>)}
          </ul>
        </details>
      ) : line.kind === 'actualShort' ? (
        <details key="actual-short" className="rounded border border-border bg-white px-3 py-2" data-missing="actual-short">
          <summary className="cursor-pointer text-sm text-text-primary">
            <span className="font-bold">ACTUAL SHORT</span> — {line.label}: {line.transactions} bank transaction{line.transactions === 1 ? '' : 's'} ({formatCents(line.bankCents)}) {line.transactions === 1 ? "isn't" : "aren't"} in the books yet — no Actual includes {line.transactions === 1 ? 'it' : 'them'}
            {line.notTotalled > 0 && <span> · {line.notTotalled} more not totalled</span>}
            <span className="text-xs text-text-faint"> · all books</span>
          </summary>
          <div className="mt-2 space-y-1 text-sm text-text-muted">
            <p className="text-xs text-text-faint">Bank transactions not yet committed to the ledger — a bank figure, not an actual. {data.notInBooks.sign}.</p>
            <div className="overflow-x-auto rounded-lg border border-border bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-white font-mono text-[10px] uppercase tracking-wider">
                    <th className={th}>Column</th>
                    <th className={`${th} text-right`}>Transactions</th>
                    <th className={`${th} text-right`}>Bank amount</th>
                    <th className={`${th} text-right`}>Not totalled</th>
                  </tr>
                </thead>
                <tbody>
                  {data.notInBooks.columns.map((c) => (
                    <tr key={c.key} className="border-b border-border last:border-0">
                      <td className={`${td} text-text-muted`}>{c.label}</td>
                      <td className={num}>{c.transactions === null ? <span className="text-text-faint">—</span> : c.transactions}</td>
                      <td className={num}>{formatCents(c.bankCents)}</td>
                      <td className={num}>{c.notTotalled === null ? <span className="text-text-faint">—</span> : c.notTotalled}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Ruled 2026-09-27: a row whose amount is not whole cents is listed here, never summed and never fatal. */}
            <p className="text-xs text-text-faint" data-not-totalled={data.notInBooks.notTotalled.length}>
              Left out of these totals: {data.notInBooks.notTotalled.length} bank row{data.notInBooks.notTotalled.length === 1 ? '' : 's'} whose amount is not a whole number of cents.
            </p>
            {data.notInBooks.notTotalled.length > 0 && (
              <ul className="space-y-1">
                {data.notInBooks.notTotalled.map((row) => (
                  <li key={row.id}>
                    <span className="font-mono">{row.day}</span> · {row.id} · <span className="font-mono">{row.amount}</span> as stored
                    <span className="text-xs text-text-faint"> ({row.detail})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </details>
      ) : (
        /* TAB13-04: planned vendors no plan line of this view matches — each named, each with Clear. */
        <details key="vendors-stranded" open className="rounded border border-border bg-white px-3 py-2" data-missing="vendors-stranded">
          <summary className="cursor-pointer text-sm text-text-primary">
            <span className="font-bold">VENDORS STRANDED</span> — {line.stranded.length} planned vendor{line.stranded.length === 1 ? '' : 's'} match{line.stranded.length === 1 ? 'es' : ''} no plan line in this view
            <span className="text-xs text-text-faint"> · {section.kind === 'book' ? 'this book' : 'all books'}</span>
          </summary>
          <ul className="mt-2 space-y-1 text-sm text-text-muted">
            {line.stranded.map((v) => (
              <li key={JSON.stringify(v.address)} className="flex flex-wrap items-center gap-1.5">
                <span className="font-medium text-text-primary">{v.label}{v.line !== null && ` — ${v.line}`}</span>
                <span>· {v.day === null ? 'undated' : v.day}{v.time !== null && ` ${v.time}`} · {v.vendor.name} · {v.reason}</span>
                <ClearVendor address={v.address} reload={reload} />
              </li>
            ))}
          </ul>
        </details>
      )))}
    </div>
  );
}

function Report({ data, search, go, reload }: { data: BudgetReportResponse; search: URLSearchParams; go: (href: string) => void; reload: () => void }) {
  const { report } = data;
  const { columns } = report;
  const choice = choiceOf(search);
  const section = sectionFor(choice, report.books);

  return (
    <div className="space-y-6">
      <SectionChips books={report.books} choice={choice} go={go} search={search} />

      {/* ONE SECTION AT A TIME — the Overview, one book, or a choice refused by name — then what this view is missing, if anything. */}
      {section.kind === 'overview' && (
        <section className="space-y-3" data-budget-section="overview">
          <Heading>Overview</Heading>
          <TotalsTable columns={columns} totals={report.totals} />
        </section>
      )}
      {section.kind === 'book' && <BookSection section={section} report={report} plans={data.plans} go={go} search={search} reload={reload} />}
      {section.kind === 'refused' && <p className="text-sm text-brand-red" data-section-refused>{section.message}</p>}

      <MissingNotice data={data} section={section} reload={reload} />
    </div>
  );
}

export default function BudgetReport() {
  const router = useRouter();
  const search = useSearchParams();
  // The viewer's today, read on mount only — the server render has no business guessing it.
  const [asOf, setAsOf] = useState<string | null>(null);
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  // TAB13-04: after a vendor write, the report is read again with the same query — never an optimistic copy.
  const [reads, setReads] = useState(0);

  useEffect(() => { setAsOf(localToday()); }, []);

  const current = new URLSearchParams(search.toString());
  const params = asOf === null ? null : viewParams(current, asOf);
  const query = params === null || asOf === null ? null : `${params.toString()}&asOf=${asOf}`;
  const choice = choiceOf(current);

  useEffect(() => {
    if (query === null) return;
    let live = true;
    setLoad({ state: 'loading' });
    (async () => {
      let res: Response;
      try {
        // redirect: 'manual' — the middleware answers a request with no valid session by
        // a 307 to the landing (src/middleware.ts), and that is kept (ruled 2026-09-27).
        // The screen does not follow it: a redirect is read as signed out.
        res = await fetch(`/api/budget/report?${query}`, { cache: 'no-store', redirect: 'manual' });
      } catch (error) {
        if (live) setLoad({ state: 'failed', status: null, code: 'network', message: error instanceof Error ? error.message : String(error) });
        return;
      }
      if (res.type === 'opaqueredirect') {
        if (live) setLoad({ state: 'signedOut' });
        return;
      }
      const type = res.headers.get('content-type');
      if (type === null || !type.includes('application/json')) {
        if (live) setLoad({ state: 'failed', status: res.status, code: 'not-json', message: `the report answered ${res.status} with no JSON` });
        return;
      }
      let body: Record<string, unknown>;
      try {
        body = await res.json();
      } catch (error) {
        if (live) setLoad({ state: 'failed', status: res.status, code: 'bad-json', message: error instanceof Error ? error.message : String(error) });
        return;
      }
      if (!live) return;
      if (res.ok) setLoad({ state: 'ok', data: body as unknown as BudgetReportResponse });
      else if (res.status === 401) setLoad({ state: 'signedOut' });
      else if (res.status === 400 || res.status === 422) setLoad({ state: 'refused', status: res.status, message: `${body.error}: ${body.message}` });
      else setLoad({ state: 'failed', status: res.status, code: String(body.error), message: typeof body.message === 'string' && body.message !== body.error ? body.message : null });
    })();
    return () => { live = false; };
  }, [query, reads]);

  const view = params === null ? null : params.get('view');
  const anchor = params === null || asOf === null ? null : anchorOf(params, asOf);
  const back = params === null ? null : stepHref(params, -1, choice);
  const forward = params === null ? null : stepHref(params, 1, choice);
  const shown = view === 'day' ? params?.get('day') : view === 'week' ? `week of ${params?.get('weekOf')}` : view === 'year' ? params?.get('year') : null;

  return (
    <div className="space-y-6">
      {/* THE VIEW BAR — DAY · WEEK · YEAR, the date, ‹ › to step, and as of. Every link keeps the section and the account. */}
      <div className="flex flex-wrap items-center gap-3" data-budget-view-bar>
        <div className="flex gap-1.5">
          {KINDS.map((k) => (
            <button
              key={k.kind}
              type="button"
              className={toggleChip(view === k.kind)}
              aria-pressed={view === k.kind}
              disabled={anchor === null}
              onClick={() => { if (anchor !== null) router.push(hrefFor(k.kind, anchor, choice)); }}
            >
              {k.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" className={toggleChip(false)} aria-label="Back one step" disabled={back === null} onClick={() => { if (back !== null) router.push(back); }}>‹</button>
          <span className="font-mono text-sm text-text-primary">{shown === null || shown === undefined ? '—' : shown}</span>
          <button type="button" className={toggleChip(false)} aria-label="Forward one step" disabled={forward === null} onClick={() => { if (forward !== null) router.push(forward); }}>›</button>
        </div>
        <span className="text-xs text-text-faint">as of {asOf === null ? '—' : asOf}</span>
      </div>

      {load.state === 'loading' && <p className="text-sm text-text-faint">Loading your budget…</p>}
      {load.state === 'signedOut' && <p className="text-sm text-text-muted">Sign in to see your budget.</p>}
      {load.state === 'refused' && <p className="text-sm text-brand-red" data-budget-refused={load.status}>{load.message}</p>}
      {load.state === 'failed' && (
        <p className="text-sm text-brand-red" data-budget-failed={load.code}>
          The report failed: {load.code}{load.message !== null && <span> — {load.message}</span>}
        </p>
      )}
      {load.state === 'ok' && <Report data={load.data} search={current} go={(href) => router.push(href)} reload={() => setReads((n) => n + 1)} />}
    </div>
  );
}
