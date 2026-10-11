/**
 * DayCard — THE DAY CARD at /tasks/day (DAYCARD-01, 2026-10-11).
 *
 * One phone-shaped card (9:16 — 540×960 CSS px, half of 1080×1920, so a
 * recording of the stage is the reel's overlay at half size) in the app's own
 * light style: the day, the Budget's planned total for the day as the hero,
 * "N stops · k not priced", then every stop in clock order — the time, the
 * line (the step's activity) or the routine's name or the task's title, the
 * place (the day's vendor, else the location) and the planned amount ('—' when
 * the Budget lists none, never $0.00); ✓ on a done routine's stops, ✕ on a
 * missed one's. ?step=n shows ONE stop, large, with "n of N" and "so far $x of
 * $y"; the URL carries the day and the step, so both can be set before the
 * record button. Every control sits OUTSIDE the stage, so the stage records
 * clean.
 *
 * THE RULES are day/dayCard.ts (pure); THE READS are week/weekReads.ts
 * (readDay, readItems) and day/dayReads.ts (readDayReport) — this file fetches
 * nothing of its own. The day is ?date= when it is a 'YYYY-MM-DD' day, else the
 * browser's date (localToday, read on mount); a ?date= that is not a day is
 * named above the card, never silently replaced; a ?step= outside 1..N is named
 * above the full card, never clamped. asOf for the report is today, as the week.
 *
 * NOTHING DROPPED. A read that fails is named with its words and the card still
 * draws what it has (a report that cannot be read leaves the stops with '—' and
 * the hero '—'); a refused routine is listed (RefusedRoutines, as the week);
 * unmatched lines, lines with no stop and the day's not-placed plans are named
 * in the card's foot. THE CARD WRITES NOTHING: no vendor box, no mark-done, no
 * note — it is a view of what Tasks and Budget already hold. Nothing is stored.
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { isIsoDay } from '@/lib/budget/days';
import { formatCents } from '@/lib/budget/format';
import type { BudgetReportResponse } from '@/lib/budget/reportInputs';
import { shiftDay } from '@/lib/budget/reportView';
import { localToday } from '@/lib/localToday';
import type { DailyPlanItem } from '../dailyplan/types';
import RefusedRoutines from '../routines/RefusedRoutines';
import { readDay, readItems, type DayAnswer, type Read } from '../week/weekReads';
import { readDayReport } from './dayReads';
import {
  BRAND_WORDS, TASK_WORD, TODAY_WORD, badDateWords, badStepWords, dayStops, dayWords, focusStop,
  linesWithoutStopWords, notPlacedWords, notPricedWords, ofWords, provenanceWords, soFarWords, stopsWords, unmatchedWords,
  type Stop,
} from './dayCard';

const chip = 'px-2 py-0.5 border border-border rounded hover:bg-bg-row text-xs disabled:opacity-50';

/** The URL of a day, and of one of its stops. */
const hrefFor = (day: string, step: number | null): string => `/tasks/day?date=${day}${step === null ? '' : `&step=${step}`}`;

/** The row's bold text: the line (the step's activity) when it has one, else the label. */
const boldOf = (s: Stop): string => (s.line !== null ? s.line : s.label);

/** The row's small text: "routine · place" for a line, the place for a stepless routine, "task" for a task; null when there is nothing to say. */
function smallOf(s: Stop): string | null {
  if (s.kind === 'task') return TASK_WORD;
  if (s.kind === 'routine') return s.place;
  return [s.label, s.place].filter((part): part is string => part !== null).join(' · ');
}

function Mark({ status }: { status: Stop['status'] }) {
  if (status === 'done') return <span className="text-brand-green" aria-label="done">✓</span>;
  if (status === 'missed') return <span className="text-brand-amber" aria-label="missed">✕</span>;
  return null;
}

export default function DayCard() {
  const router = useRouter();
  const search = useSearchParams();
  // The browser's date and zone, read on mount only — the server render has no business guessing them.
  const [today, setToday] = useState<string | null>(null);
  const [zone, setZone] = useState<string | null>(null);
  const [dayRead, setDayRead] = useState<Read<DayAnswer> | null>(null);
  const [report, setReport] = useState<Read<BudgetReportResponse> | null>(null);
  const [items, setItems] = useState<Read<DailyPlanItem[]> | null>(null);

  useEffect(() => {
    setToday(localToday());
    setZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  const dateParam = search.get('date');
  const stepParam = search.get('step');
  // The day: ?date= when it is a day, else today; a ?date= that is not a day is named, never replaced in silence.
  const badDate = dateParam !== null && !isIsoDay(dateParam) ? dateParam : null;
  const day = today === null ? null : dateParam !== null && isIsoDay(dateParam) ? dateParam : today;

  useEffect(() => {
    if (day === null || today === null) return;
    let live = true;
    setDayRead(null);
    setReport(null);
    setItems(null);
    (async () => {
      const [d, r, i] = await Promise.all([readDay(day), readDayReport(day, today), readItems(day, day)]);
      if (!live) return;
      setDayRead(d);
      setReport(r);
      setItems(i);
    })();
    return () => { live = false; };
  }, [day, today]);

  if (today === null || zone === null || day === null) {
    return <section className="text-xs text-text-muted" data-day-section>loading the day…</section>;
  }

  const loaded = dayRead !== null && report !== null && items !== null;
  const entries = dayRead !== null && dayRead.ok ? dayRead.value.entries : [];
  const refused = dayRead !== null && dayRead.ok ? dayRead.value.refused : [];
  const plans = report !== null && report.ok ? report.value.plans : null;
  const lines = plans !== null && plans.listed ? plans.lines : [];
  const notPlaced = report !== null && report.ok ? report.value.notPlaced : [];
  const dayItems = items !== null && items.ok ? items.value : [];
  const result = dayStops({ day, entries, lines, notPlaced, items: dayItems, viewerZone: zone });
  // The hero is the Budget's figure — '—' while the report cannot be read, never a sum of the stops.
  const plannedCents = report !== null && report.ok ? result.plannedCents : null;

  // ?step=n: one stop, or the whole card with the bad step named — never clamped.
  const n = stepParam === null ? null : /^\d+$/.test(stepParam) ? Number(stepParam) : Number.NaN;
  const focus = n === null ? null : focusStop(result, n);
  const badStep = n !== null && focus === null ? stepParam : null;
  const N = result.stops.length;

  const go = (href: string) => router.push(href);

  return (
    <section className="space-y-2" data-day-section>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-brand-purple">Day card</h2>
        <div className="flex flex-wrap items-center gap-1.5 text-xs" data-day-controls>
          <button type="button" className={chip} aria-label="Back one day" onClick={() => go(hrefFor(shiftDay(day, -1), null))}>‹</button>
          <span className="font-mono text-text-primary" data-day-day>{day}</span>
          <button type="button" className={chip} aria-label="Forward one day" onClick={() => go(hrefFor(shiftDay(day, 1), null))}>›</button>
          <button type="button" className={chip} disabled={day === today} onClick={() => go(hrefFor(today, null))}>{TODAY_WORD}</button>
          <span className="w-2" aria-hidden="true" />
          <button type="button" className={chip} disabled={focus === null} onClick={() => go(hrefFor(day, null))}>all</button>
          <button type="button" className={chip} aria-label="Back one step" disabled={focus === null || focus.index === 1} onClick={() => { if (focus !== null) go(hrefFor(day, focus.index - 1)); }}>‹ step</button>
          <button type="button" className={chip} aria-label="Forward one step" disabled={N === 0 || (focus !== null && focus.index === N)} onClick={() => go(hrefFor(day, focus === null ? 1 : focus.index + 1))}>step ›</button>
        </div>
      </div>

      {/* Named above the card — never dropped, never filled in. */}
      {badDate !== null && <p className="text-xs text-brand-amber" data-day-bad-date>{badDateWords(badDate)}</p>}
      {badStep !== null && <p className="text-xs text-brand-amber" data-day-bad-step>{badStepWords(badStep, N)}</p>}
      {dayRead !== null && !dayRead.ok && <p className="text-xs text-brand-red" data-day-failed>{day} could not be read — {dayRead.words}</p>}
      {items !== null && !items.ok && <p className="text-xs text-brand-red" data-day-items-failed>The day&apos;s tasks could not be read — {items.words}</p>}

      {/* THE STAGE — 9:16, half of 1080×1920; every size inside is half its video size. Record this box alone. */}
      <div className="bg-white border border-border rounded-lg overflow-hidden flex flex-col" style={{ width: 540, height: 960 }} data-day-card data-day-step={focus === null ? undefined : focus.index}>
        <div className="flex items-baseline justify-between px-6 pt-5">
          <span className="text-text-faint tracking-widest" style={{ fontSize: 11 }}>{BRAND_WORDS}</span>
          <span className="font-mono text-text-primary" style={{ fontSize: 13 }} data-day-words>{dayWords(day)}</span>
        </div>

        {!loaded && <p className="px-6 pt-6 text-text-muted" style={{ fontSize: 18 }} data-day-loading>loading the day…</p>}

        {loaded && focus === null && (
          <>
            <div className="px-6 pt-6" data-day-hero>
              <div className="flex items-baseline gap-3">
                <span className="font-mono tabular-nums font-bold text-text-primary" style={{ fontSize: 52, lineHeight: 1 }} data-day-planned>{formatCents(plannedCents)}</span>
                <span className="text-text-secondary" style={{ fontSize: 22 }}>{TODAY_WORD}</span>
              </div>
              <div className="text-text-muted pt-2" style={{ fontSize: 18 }} data-day-count>
                {stopsWords(N)}{result.notPriced > 0 && ` · ${notPricedWords(result.notPriced)}`}
              </div>
            </div>
            <div className="mt-4 flex-1 min-h-0 overflow-y-auto" data-day-stops>
              {result.stops.map((s, i) => (
                <button
                  type="button"
                  key={s.key}
                  className="w-full text-left flex items-baseline gap-3 px-6 py-2 border-t border-border-light hover:bg-bg-row"
                  data-day-stop={s.key}
                  data-day-status={s.status}
                  onClick={() => go(hrefFor(day, i + 1))}
                >
                  <span className="w-5 shrink-0" style={{ fontSize: 20 }}><Mark status={s.status} /></span>
                  <span className={`font-mono tabular-nums shrink-0 ${s.time === null ? 'text-text-muted' : 'text-text-primary'}`} style={{ fontSize: 23 }}>{s.time === null ? '—' : s.time}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-text-primary truncate" style={{ fontSize: 23 }}>{boldOf(s)}</span>
                    {smallOf(s) !== null && <span className="block text-text-muted truncate" style={{ fontSize: 17 }}>{smallOf(s)}</span>}
                  </span>
                  <span className={`font-mono tabular-nums font-bold shrink-0 ${s.cents === null ? 'text-text-muted' : 'text-text-primary'}`} style={{ fontSize: 23 }} data-day-amount>{formatCents(s.cents)}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {loaded && focus !== null && (
          <div className="px-8 pt-10 space-y-4 flex-1 min-h-0" data-day-focus>
            <div className="font-mono text-text-muted" style={{ fontSize: 15 }}>{ofWords(focus.index, focus.of)}</div>
            <div className={`font-mono tabular-nums ${focus.stop.time === null ? 'text-text-muted' : 'text-text-primary'}`} style={{ fontSize: 40, lineHeight: 1 }}>{focus.stop.time === null ? '—' : focus.stop.time}</div>
            <div className="font-bold text-text-primary" style={{ fontSize: 34, lineHeight: 1.15 }}>{boldOf(focus.stop)}</div>
            {smallOf(focus.stop) !== null && <div className="text-text-muted" style={{ fontSize: 20 }}>{smallOf(focus.stop)}</div>}
            <div className={`font-mono tabular-nums font-bold ${focus.stop.cents === null ? 'text-text-muted' : 'text-text-primary'}`} style={{ fontSize: 40, lineHeight: 1 }} data-day-amount>{formatCents(focus.stop.cents)}</div>
            <div className="text-text-muted" style={{ fontSize: 18 }} data-day-so-far>{soFarWords(plannedCents === null ? null : focus.soFarCents, plannedCents)}</div>
          </div>
        )}

        {/* The foot — only when there is something to say. */}
        {loaded && (result.unmatched.length > 0 || result.linesWithoutStop.length > 0 || result.notPlacedToday.length > 0 || refused.length > 0 || (report !== null && !report.ok) || (plans !== null && !plans.listed)) && (
          <div className="px-6 py-3 space-y-1 border-t border-border-light text-xs" data-day-foot>
            {result.unmatched.length > 0 && <p className="text-brand-amber" data-day-unmatched>{unmatchedWords(result.unmatched)}</p>}
            {result.linesWithoutStop.length > 0 && <p className="text-brand-amber" data-day-lines-without-stop>{linesWithoutStopWords(result.linesWithoutStop)}</p>}
            {result.notPlacedToday.length > 0 && <p className="text-brand-amber" data-day-not-placed>{notPlacedWords(result.notPlacedToday)}</p>}
            <RefusedRoutines refused={refused} />
            {report !== null && !report.ok && <p className="text-brand-red" data-day-report-failed>{report.words}</p>}
            {plans !== null && !plans.listed && <p className="text-text-muted" data-day-plans-words>{plans.words}</p>}
          </div>
        )}
      </div>

      <p className="text-xs text-text-muted" data-day-provenance>{provenanceWords(day, today)}</p>
    </section>
  );
}
