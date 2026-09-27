'use client';

/**
 * TAB13-02b — THE BUDGET REPORT on /budget: what you planned, what posted, and
 * the difference, by book and account. READ-ONLY — nothing on this screen writes.
 *
 * THE VIEW lives in the URL (?view=day&day= · ?view=week&weekOf= · ?view=year&year=),
 * so a link is shareable and the back button works; with no view in the URL the
 * screen opens on DAY, today. asOf is the BROWSER's local date — the viewer's
 * today — read once on mount (never during the server render, whose clock and
 * zone are the server's). No browser storage of any kind.
 *
 * Every figure comes from GET /api/budget/report and is written by the one
 * formatter (src/lib/budget/format.ts): '—' is blank, never zero; an
 * unfavourable variance is in parentheses and brand red. What the report does
 * NOT hold is always on screen (the COMPLETENESS section) — never hidden.
 *
 * Styled like the Travel tab: SECTION_HEADER headings (ModuleLauncher.tsx
 * TravelHeading), TripBudgetActual's statement table, ToggleStrip's toggleChip.
 */
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SECTION_HEADER, toggleChip } from '@/lib/ds';
import { formatCents, formatVariance } from '@/lib/budget/format';
import type { ReportCell, ReportColumn, SectionTotal, UnplacedItem } from '@/lib/budget/report';
import type { BudgetReportResponse } from '@/lib/budget/reportInputs';

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

/** The browser's local date, 'YYYY-MM-DD'. */
function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** A 'YYYY-MM-DD' day moved by n days, by UTC arithmetic (no zone can shift it). */
function shiftDay(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00.000Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

/** The URL's view parameters, or DAY of today when the URL names no view. Anything else passes to the route, which refuses it by name. */
function viewParams(search: URLSearchParams, today: string): URLSearchParams {
  const out = new URLSearchParams();
  const view = search.get('view');
  if (view === null) {
    out.set('view', 'day');
    out.set('day', today);
    return out;
  }
  out.set('view', view);
  for (const key of ['day', 'weekOf', 'year']) {
    const value = search.get(key);
    if (value !== null) out.set(key, value);
  }
  return out;
}

/**
 * The day a switch of view starts from: the day shown, the week's weekOf, or —
 * from YEAR — today when it is this year and Jan 1 otherwise. Null when the URL's
 * view is not one the route accepts: the toggles are then disabled, and the
 * route's refusal says why on screen.
 */
function anchorOf(params: URLSearchParams, asOf: string): string | null {
  const view = params.get('view');
  const isDay = (v: string | null): v is string => v !== null && /^\d{4}-\d{2}-\d{2}$/.test(v);
  if (view === 'day') return isDay(params.get('day')) ? params.get('day') : null;
  if (view === 'week') return isDay(params.get('weekOf')) ? params.get('weekOf') : null;
  const year = params.get('year');
  if (view !== 'year' || year === null || !/^\d{4}$/.test(year)) return null;
  return year === asOf.slice(0, 4) ? asOf : `${year}-01-01`;
}

function hrefFor(kind: Kind, anchor: string): string {
  if (kind === 'day') return `/budget?view=day&day=${anchor}`;
  if (kind === 'week') return `/budget?view=week&weekOf=${anchor}`;
  return `/budget?view=year&year=${anchor.slice(0, 4)}`;
}

function stepHref(params: URLSearchParams, direction: -1 | 1): string | null {
  const view = params.get('view');
  const day = params.get('day');
  const weekOf = params.get('weekOf');
  const year = params.get('year');
  if (view === 'day' && day) return hrefFor('day', shiftDay(day, direction));
  if (view === 'week' && weekOf) return hrefFor('week', shiftDay(weekOf, 7 * direction));
  if (view === 'year' && year && /^\d{4}$/.test(year)) return `/budget?view=year&year=${String(Number(year) + direction).padStart(4, '0')}`;
  return null;
}

function Heading({ children }: { children: React.ReactNode }) {
  return <h2 className={SECTION_HEADER}>{children}</h2>;
}

/** Budget-to-date, plus "of <full>" while the column is in progress and the full budget differs. */
function BudgetFigure({ column, toDate, full }: { column: ReportColumn; toDate: number | null; full: number | null }) {
  return (
    <>
      {formatCents(toDate)}
      {column.state === 'inProgress' && full !== toDate && <span className="text-xs text-text-faint"> of {formatCents(full)}</span>}
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

function TableHead({ columns, first }: { columns: readonly ReportColumn[]; first: string }) {
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
function netBlanks(totals: BudgetReportResponse['report']['totals'][number]): string[] {
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

function unplacedLine(item: UnplacedItem): string {
  if (item.kind === 'budgetLine') {
    const l = item.line;
    return `${l.day} · ${l.source} budget line on ${l.code} · ${formatCents(l.cents)} · ${item.reason}`;
  }
  const p = item.posting;
  return `${p.day} · ledger line on ${p.code} (${p.entryType}) · ${formatCents(p.cents)} · ${item.reason}`;
}

function Report({ data }: { data: BudgetReportResponse }) {
  const { report } = data;
  const { columns } = report;
  const blanks = report.totals.length > 0 ? netBlanks(report.totals[0]) : [];
  const excludedTasks = data.excludedTasks.byStatus.filter((s) => s.tasks > 0);

  return (
    <div className="space-y-6">
      {/* OVERVIEW — the three totals first. */}
      <section className="space-y-3" data-budget-section="overview">
        <Heading>Overview</Heading>
        <div className="overflow-x-auto rounded-lg border border-border bg-white">
          <table className="w-full text-sm">
            <TableHead columns={columns} first="Total" />
            <tbody>
              <FigureRows label="Total income" columns={columns} cells={report.totals.map((t) => t.income)} />
              <FigureRows label="Total expenses" columns={columns} cells={report.totals.map((t) => t.expense)} />
              <FigureRows label="Net" columns={columns} cells={report.totals.map((t) => t.net)} />
            </tbody>
          </table>
        </div>
        {blanks.map((line) => <p key={line} className="text-xs text-text-faint" data-net-blank>{line}</p>)}
      </section>

      {/* THE BOOKS — each book, then each account. */}
      {report.books.map((book) => (
        <section key={book.entityId} className="space-y-3" data-budget-section="book">
          <Heading>{book.label} · {book.entityName}</Heading>
          {book.rows.length === 0 ? (
            <span className="text-xs text-text-muted italic">no planned or posted income or expense in this view.</span>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-white">
              <table className="w-full text-sm">
                <TableHead columns={columns} first="Account" />
                <tbody>
                  {book.rows.map((row) => (
                    <FigureRows key={row.code} label={`${row.code} · ${row.name}`} columns={columns} cells={row.cells} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}

      {/* COMPLETENESS — what the figures above do NOT hold. Always on screen. */}
      <section className="space-y-3" data-budget-section="completeness">
        <Heading>What this report does not hold</Heading>
        <div className="rounded-lg border border-border bg-white p-4 space-y-4">
          <div data-completeness="not-placed">
            <p className="text-sm font-bold text-text-primary">Not placed — {data.notPlaced.length + report.unplaced.length}</p>
            <p className="text-xs text-text-faint">Plans and postings whose money is on no row above, with the reason.</p>
            {data.notPlaced.length + report.unplaced.length === 0 ? (
              <p className="text-sm text-text-faint">Nothing — every plan and posting in this view is on a row.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm text-text-muted">
                {data.notPlaced.map((n) => (
                  <li key={`${n.sourceId}:${n.reason}`}>
                    <span className="font-medium text-text-primary">{n.label}</span> · {n.source} · {n.day === null ? 'undated' : n.day} · {formatCents(n.cents)} · {n.reason}
                    {n.detail !== null && <span className="text-xs text-text-faint"> ({n.detail})</span>}
                  </li>
                ))}
                {report.unplaced.map((u, i) => <li key={`unplaced:${i}`}>{unplacedLine(u)}</li>)}
              </ul>
            )}
          </div>

          <div data-completeness="excluded-tasks">
            <p className="text-sm font-bold text-text-primary">Not counted as plans — ALL TIME</p>
            <p className="text-xs text-text-faint">Costed tasks nobody accepted, across all time — not only this view.</p>
            {excludedTasks.length === 0 ? (
              <p className="text-sm text-text-faint">None.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm text-text-muted">
                {excludedTasks.map((s) => (
                  <li key={s.status}><span className="rounded-full bg-bg-row px-2 py-0.5 text-xs font-medium text-text-muted">{s.status}</span> {s.tasks} task{s.tasks === 1 ? '' : 's'} · {formatCents(s.cents)}</li>
                ))}
              </ul>
            )}
          </div>

          <div data-completeness="not-in-books">
            <p className="text-sm font-bold text-text-primary">Not in the books yet</p>
            <p className="text-xs text-text-faint">Bank transactions not yet committed to the ledger — a bank figure, not an actual. {data.notInBooks.sign}.</p>
            <div className="mt-2 overflow-x-auto rounded-lg border border-border bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-white font-mono text-[10px] uppercase tracking-wider">
                    <th className={th}>Column</th>
                    <th className={`${th} text-right`}>Transactions</th>
                    <th className={`${th} text-right`}>Bank amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.notInBooks.columns.map((c) => (
                    <tr key={c.key} className="border-b border-border last:border-0">
                      <td className={`${td} text-text-muted`}>{c.label}</td>
                      <td className={num}>{c.transactions === null ? <span className="text-text-faint">—</span> : c.transactions}</td>
                      <td className={num}>{formatCents(c.bankCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div data-completeness="left-out">
            <p className="text-sm font-bold text-text-primary">Left out by name</p>
            <ul className="mt-2 space-y-1 text-sm text-text-muted">
              <li>Reversal pairs — {data.excludedLines.reversalPairLines} ledger line{data.excludedLines.reversalPairLines === 1 ? '' : 's'}</li>
              <li>Closing entries — {data.excludedLines.closingEntryLines} ledger line{data.excludedLines.closingEntryLines === 1 ? '' : 's'}</li>
              <li>Posted after {data.asOf} — {data.excludedLines.linesAfterAsOf} ledger line{data.excludedLines.linesAfterAsOf === 1 ? '' : 's'}</li>
            </ul>
          </div>

          <p className="text-sm text-text-muted" data-completeness="travel">Travel budgets connect after the Travel tab ships.</p>

          <p className="text-xs text-text-faint" data-completeness="records">
            Read: {data.records.entities} books · {data.records.accounts} accounts · {data.records.routines} routines · {data.records.costedTasks} costed tasks · {data.records.ledgerLines} ledger lines · {data.records.bankRows} bank rows → {data.records.budgetLines.routine} routine and {data.records.budgetLines.task} task budget lines.
          </p>
        </div>
      </section>
    </div>
  );
}

export default function BudgetReport() {
  const router = useRouter();
  const search = useSearchParams();
  // The viewer's today, read on mount only — the server render has no business guessing it.
  const [asOf, setAsOf] = useState<string | null>(null);
  const [load, setLoad] = useState<Load>({ state: 'loading' });

  useEffect(() => { setAsOf(localToday()); }, []);

  const params = asOf === null ? null : viewParams(new URLSearchParams(search.toString()), asOf);
  const query = params === null || asOf === null ? null : `${params.toString()}&asOf=${asOf}`;

  useEffect(() => {
    if (query === null) return;
    let live = true;
    setLoad({ state: 'loading' });
    (async () => {
      let res: Response;
      try {
        res = await fetch(`/api/budget/report?${query}`, { cache: 'no-store' });
      } catch (error) {
        if (live) setLoad({ state: 'failed', status: null, code: 'network', message: error instanceof Error ? error.message : String(error) });
        return;
      }
      const type = res.headers.get('content-type');
      if (type === null || !type.includes('application/json')) {
        if (live) setLoad({ state: 'failed', status: res.status, code: 'not-json', message: `the report answered ${res.status}${res.redirected ? ` after a redirect to ${res.url}` : ''} with no JSON` });
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
  }, [query]);

  const view = params === null ? null : params.get('view');
  const anchor = params === null || asOf === null ? null : anchorOf(params, asOf);
  const back = params === null ? null : stepHref(params, -1);
  const forward = params === null ? null : stepHref(params, 1);
  const shown = view === 'day' ? params?.get('day') : view === 'week' ? `week of ${params?.get('weekOf')}` : view === 'year' ? params?.get('year') : null;

  return (
    <div className="space-y-6">
      {/* THE VIEW BAR — DAY · WEEK · YEAR, the date, ‹ › to step, and as of. */}
      <div className="flex flex-wrap items-center gap-3" data-budget-view-bar>
        <div className="flex gap-1.5">
          {KINDS.map((k) => (
            <button
              key={k.kind}
              type="button"
              className={toggleChip(view === k.kind)}
              aria-pressed={view === k.kind}
              disabled={anchor === null}
              onClick={() => { if (anchor !== null) router.push(hrefFor(k.kind, anchor)); }}
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
      {load.state === 'ok' && <Report data={load.data} />}
    </div>
  );
}
