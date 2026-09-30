/**
 * WeekSection — THIS WEEK, at the top of the Tasks tab (WEEK-01, 2026-09-30).
 *
 * Monday to Sunday across (the budget model's one Monday rule, viewRange), the
 * active routines down in the order they start. ‹ › moves a week, "this week"
 * comes back; today's column is marked (the browser's date, src/lib/localToday).
 *
 *   · Each row's head: the name, the time window, the book, the figure per
 *     occurrence (the lines leaf — routinePlanned / plannedLine).
 *   · Each cell: that day's occurrence from GET /api/operations/routines/today
 *     ?date=<day> — seven reads (WeekCell: done with its note, or a note box and
 *     "✓ done" on today or earlier).
 *   · Each paid routine's plan lines for the day — the amount and Budget's own
 *     vendor box (DayPlanDrill.tsx VendorBox, one useDirectory for the section)
 *     — from ONE read of the week's budget report, placed by address kind.
 *   · The last row, "Tasks": the day's scheduled items (one range read of the
 *     daily plan) and the day's task plan lines.
 *
 * Nothing is dropped: a routine a day read cannot place is named with its
 * reason above the grid; a report the section cannot read says so once, and the
 * routines, completions and tasks still show; stranded vendors, and any plan
 * line with no row, are named once above the grid. Every fetch is weekReads.ts's.
 */

'use client';

import { useEffect, useState } from 'react';
import { ACCOUNT_CELL_WORDS } from '@/lib/coa/accountCell';
import { localToday } from '@/lib/localToday';
import { plannedLine, routinePlanned } from '@/lib/operations/routineLines';
import type { BudgetReportResponse } from '@/lib/budget/reportInputs';
import type { PlanLine } from '@/lib/budget/planLines';
import { useDirectory } from '@/components/budget/DayPlanDrill';
import { useOperationsEntity } from '../EntitySelector';
import type { DailyPlanItem } from '../dailyplan/types';
import RefusedRoutines from '../routines/RefusedRoutines';
import type { RefusedRoutine, Routine } from '../routines/types';
import { taskStatusWords } from '../projects/projectsTableText';
import WeekCell, { DayPlanLines } from './WeekCell';
import { WEEKDAY_WORDS, cellKey, orderRoutines, placeLines, shiftWeek, timeWindow, weekDays } from './weekPlan';
import { readDay, readItems, readReport, readRoutines, type DayAnswer, type Read } from './weekReads';

const cellClass = 'px-2 py-1.5 align-top border-t border-border-light text-xs min-w-[8rem]';
const chip = 'px-2 py-0.5 border border-border rounded hover:bg-bg-row text-xs disabled:opacity-50';

export default function WeekSection() {
  const { entities } = useOperationsEntity();
  // The browser's date, read on mount only — the server render has no business guessing it.
  const [today, setToday] = useState<string | null>(null);
  const [weekOf, setWeekOf] = useState<string | null>(null);
  const [routines, setRoutines] = useState<Read<Routine[]> | null>(null);
  const [daysRead, setDaysRead] = useState<Record<string, Read<DayAnswer>>>({});
  const [report, setReport] = useState<Read<BudgetReportResponse> | null>(null);
  const [items, setItems] = useState<Read<DailyPlanItem[]> | null>(null);
  const [reportReads, setReportReads] = useState(0);
  const directory = useDirectory();

  useEffect(() => {
    const t = localToday();
    setToday(t);
    setWeekOf(shiftWeek(t, 0));
  }, []);

  const days = weekOf === null ? null : weekDays(weekOf);

  const readOneDay = async (day: string) => {
    const answer = await readDay(day);
    setDaysRead((prev) => ({ ...prev, [day]: answer }));
  };

  useEffect(() => {
    if (days === null) return;
    let live = true;
    setRoutines(null);
    setDaysRead({});
    setItems(null);
    (async () => {
      const [r, dayAnswers, i] = await Promise.all([
        readRoutines(),
        Promise.all(days.map(async (day) => [day, await readDay(day)] as const)),
        readItems(days[0], days[6]),
      ]);
      if (!live) return;
      setRoutines(r);
      setDaysRead(Object.fromEntries(dayAnswers));
      setItems(i);
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOf]);

  useEffect(() => {
    if (weekOf === null || today === null) return;
    let live = true;
    setReport(null);
    (async () => {
      const r = await readReport(weekOf, today);
      if (live) setReport(r);
    })();
    return () => { live = false; };
  }, [weekOf, today, reportReads]);

  if (today === null || weekOf === null || days === null) {
    return <section className="text-xs text-text-muted" data-week-section>loading this week…</section>;
  }

  const bookName = (entityId: string): string => {
    const book = entities.find((e) => e.id === entityId);
    return book ? book.name : ACCOUNT_CELL_WORDS.bookNotLoaded;
  };
  const reloadReport = () => setReportReads((n) => n + 1);

  // Every routine a day read refused, once each, with its reason.
  const refused: RefusedRoutine[] = [];
  for (const day of days) {
    const read = daysRead[day];
    if (read === undefined || !read.ok) continue;
    for (const r of read.value.refused) {
      if (!refused.some((x) => x.routine_id === r.routine_id && x.reason === r.reason)) refused.push(r);
    }
  }
  const dayFailures = days.flatMap((day) => {
    const read = daysRead[day];
    return read !== undefined && !read.ok ? [{ day, words: read.words }] : [];
  });

  const rows = routines !== null && routines.ok ? orderRoutines(routines.value) : [];
  const plans = report !== null && report.ok ? report.value.plans : null;
  const listedLines: readonly PlanLine[] = plans !== null && plans.listed ? plans.lines : [];
  const placed = placeLines(listedLines, rows);
  const itemsOf = (day: string): DailyPlanItem[] => (items !== null && items.ok ? items.value.filter((it) => it.plan_date.slice(0, 10) === day) : []);
  const planProps = (lines: readonly PlanLine[]) => ({ lines, bookName, directory, reload: reloadReport });

  return (
    <section className="space-y-2" data-week-section>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-brand-purple">This week</h2>
        <div className="flex items-center gap-1.5 text-xs">
          <button type="button" className={chip} aria-label="Back one week" onClick={() => setWeekOf(shiftWeek(weekOf, -1))}>‹</button>
          <span className="font-mono text-text-primary" data-week-range>{days[0]} – {days[6]}</span>
          <button type="button" className={chip} aria-label="Forward one week" onClick={() => setWeekOf(shiftWeek(weekOf, 1))}>›</button>
          <button type="button" className={chip} disabled={weekOf === shiftWeek(today, 0)} onClick={() => setWeekOf(shiftWeek(today, 0))}>this week</button>
        </div>
      </div>

      {/* Named once above the grid — never dropped, never filled in. */}
      {routines !== null && !routines.ok && (
        <p className="text-xs text-red-800" data-week-routines-failed>The routines could not be read — {routines.words}</p>
      )}
      {dayFailures.map((f) => (
        <p key={f.day} className="text-xs text-red-800" data-week-day-failed={f.day}>{f.day} could not be read — {f.words}</p>
      ))}
      <RefusedRoutines refused={refused} />
      {report !== null && !report.ok && <p className="text-xs text-red-800" data-week-report-failed>{report.words}</p>}
      {plans !== null && !plans.listed && <p className="text-xs text-text-muted" data-week-plans-words>{plans.words}</p>}
      {plans !== null && plans.listed && plans.stranded.length > 0 && (
        <div className="text-xs text-amber-900" data-week-stranded>
          {plans.stranded.length === 1 ? '1 vendor stranded' : `${plans.stranded.length} vendors stranded`} —{' '}
          {plans.stranded.map((s) => `${s.vendor.name} (${s.label}${s.line !== null ? ` — ${s.line}` : ''}${s.day !== null ? `, ${s.day}` : ''}): ${s.reason}`).join(' · ')}
        </div>
      )}
      {placed.withoutRow.length > 0 && (
        <div className="text-xs text-amber-900" data-week-lines-without-row>
          {placed.withoutRow.length === 1 ? '1 plan line has no row this week' : `${placed.withoutRow.length} plan lines have no row this week`} —{' '}
          {placed.withoutRow.map((l) => `${l.label}${l.line !== null ? ` — ${l.line}` : ''}, ${l.day}`).join(' · ')}
        </div>
      )}

      <div className="overflow-x-auto border border-border rounded bg-white">
        <table className="w-full min-w-[64rem] border-collapse text-xs" data-week-table>
          <thead>
            <tr className="text-left text-text-faint uppercase tracking-wide">
              <th className="px-2 py-1.5 font-normal">Routine</th>
              {days.map((day, i) => (
                <th key={day} className={`px-2 py-1.5 font-normal ${day === today ? 'bg-purple-50 text-brand-purple' : ''}`} data-week-day={day} data-week-today={day === today ? '' : undefined}>
                  {WEEKDAY_WORDS[i]} {day.slice(8, 10)}{day === today && ' · today'}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {routines === null && (
              <tr><td colSpan={8} className={cellClass}>loading the routines…</td></tr>
            )}
            {routines !== null && routines.ok && rows.length === 0 && (
              <tr><td colSpan={8} className={`${cellClass} italic text-text-muted`}>no active routines</td></tr>
            )}
            {rows.map((r) => {
              const planned = routinePlanned({ budget_amount: r.budget_amount ?? null, coa_code: r.coa_code ?? null, steps: r.steps });
              const hours = timeWindow(r.start_time, r.end_time);
              const isRefused = refused.some((x) => x.routine_id === r.id);
              return (
                <tr key={r.id} data-week-row={r.id}>
                  <td className={`${cellClass} w-56`} data-week-row-head>
                    <div className="font-bold text-text-primary">{r.name}</div>
                    {hours !== null && <div className="font-mono text-text-muted">{hours}</div>}
                    <div className="text-text-muted">{bookName(r.entity_id)}</div>
                    {planned.amount !== null && (
                      <div className="font-mono tabular-nums text-text-primary" data-week-planned={planned.from}>{plannedLine(planned)}</div>
                    )}
                    {isRefused && <div className="text-amber-900">cannot be placed — named above</div>}
                  </td>
                  {days.map((day) => {
                    const read = daysRead[day];
                    const lines = placed.routineCells.get(cellKey(r.id, day)) ?? [];
                    return (
                      <td key={day} className={`${cellClass} ${day === today ? 'bg-purple-50/40' : ''}`} data-week-cell={day}>
                        {read === undefined ? (
                          <span className="text-text-faint">…</span>
                        ) : !read.ok ? (
                          <span className="text-text-muted" title={read.words}>not read</span>
                        ) : (
                          <WeekCell
                            entry={read.value.entries.find((e) => e.routine.id === r.id)}
                            timezone={r.timezone}
                            day={day}
                            today={today}
                            onDone={() => readOneDay(day)}
                            plan={planProps(lines)}
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            <tr data-week-tasks-row>
              <td className={`${cellClass} font-bold text-text-primary`}>Tasks</td>
              {days.map((day) => {
                const dayItems = itemsOf(day);
                const lines = placed.taskCells.get(day) ?? [];
                return (
                  <td key={day} className={`${cellClass} ${day === today ? 'bg-purple-50/40' : ''}`} data-week-tasks-cell={day}>
                    {items === null && <span className="text-text-faint">…</span>}
                    {items !== null && !items.ok && <span className="text-red-800">{items.words}</span>}
                    {items !== null && items.ok && dayItems.length === 0 && lines.length === 0 && <span className="text-text-muted">—</span>}
                    {dayItems.map((it) => (
                      <div key={it.id} data-week-item={it.id}>
                        {it.task !== null ? (
                          <>
                            <span className="text-text-primary">{it.task.title}</span>
                            <span className="text-text-muted"> · {taskStatusWords(it.task.status)}</span>
                          </>
                        ) : (
                          <span className="text-text-primary">{it.ad_hoc_title}</span>
                        )}
                      </div>
                    ))}
                    <DayPlanLines {...planProps(lines)} />
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
