/**
 * DayCard — THE DAY CARD at /tasks/day (DAYCARD-01, 2026-10-11; the reel plate,
 * DAYCARD-01b, 2026-10-12).
 *
 * THE STAGE IS THE REEL PLATE — the card Alex approved on the demo's reel frames,
 * at two thirds of its 1080-wide size (the plate 540 CSS px wide; a recording
 * of it is placed over the footage in the editor): the gold TS badge and the
 * wordmark, "DAY n OF m" (the day's place in its calendar quarter — pure
 * calendar math), the day's planned total in heavy type ("$75" — whole dollars
 * read without ".00"), "Tue Oct 13 · 7 stops · under or over?", then every stop
 * in clock order — the time, the line (the step's activity) or the routine's
 * name or the task's title, the place under it (the day's vendor, else the
 * location), the planned amount ('—' where the Budget lists none, never $0.00);
 * ✓ on a done routine's stops, ✕ on a missed one's — and a foot that counts what
 * the hero does not price or place, with the sentences that name each item.
 * ?step=n is the demo's STEP card: "n OF N · time", the stop large, PLAN and
 * its amount, "so far $x of $y" with its bar. The URL carries the day and the
 * step, so both can be set before the record button; every control sits
 * OUTSIDE the plate, so the plate records clean. No ฿ yet (CURRENCY-01 — the
 * typed rate needs a place to live); no ACTUAL yet (a posting linked to the
 * stop); the plate leaves them their places.
 *
 * THE RULES are day/dayCard.ts (pure); THE READS are week/weekReads.ts
 * (readDay, readItems) and day/dayReads.ts (readDayReport) — this file fetches
 * nothing of its own. The day is ?date= when it is a 'YYYY-MM-DD' day, else the
 * browser's date (localToday, read on mount); a ?date= that is not a day is
 * named above the card, never silently replaced; a ?step= outside 1..N is named
 * above the full card, never clamped — and judged only once the reads are in.
 * asOf for the report is today, as the week.
 *
 * NOTHING DROPPED. A read that fails is named with its words and the card still
 * draws what it has (a report that cannot be read leaves the stops with '—' and
 * the hero '—'); a refused routine is listed (RefusedRoutines, as the week);
 * unmatched lines, a routine priced as a whole, lines with no stop, the day's
 * not-placed plans and stranded vendors are counted on the plate and named under
 * it. THE CARD WRITES NOTHING: no vendor box, no mark-done, no note — it is a
 * view of what Tasks and Budget already hold. Nothing is stored.
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { isIsoDay } from '@/lib/budget/days';
import type { BudgetReportResponse } from '@/lib/budget/reportInputs';
import { shiftDay } from '@/lib/budget/reportView';
import { localToday } from '@/lib/localToday';
import type { DailyPlanItem } from '../dailyplan/types';
import RefusedRoutines from '../routines/RefusedRoutines';
import { readDay, readItems, type DayAnswer, type Read } from '../week/weekReads';
import { readDayReport } from './dayReads';
import {
  BADGE_WORDS, BRAND_WORDS, PLAN_WORD, TASK_WORD, TODAY_WORD, badDateWords, badStepWords, completenessWords, dayStops, focusStop,
  heroWord, hookWords, linesUnreadWords, linesWithoutStopWords, notPlacedWords, planDollars, progressPercent, provenanceWords, quarterDayWords,
  routineFigureWords, soFarWords, stepHeaderWords, strandedWords, unmatchedWords,
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

/** The plate's header: the badge, the wordmark, and the right-hand words. */
function PlateHeader({ right }: { right: string }) {
  return (
    <div className="flex items-center justify-between" data-day-header>
      <div className="flex items-center gap-2.5">
        <span className="bg-brand-gold text-text-primary rounded-lg flex items-center justify-center font-extrabold" style={{ width: 32, height: 32, fontSize: 16 }} aria-hidden="true">{BADGE_WORDS}</span>
        <span className="font-bold text-text-secondary" style={{ fontSize: 19, letterSpacing: '0.16em' }}>{BRAND_WORDS}</span>
      </div>
      <span className="font-mono font-semibold text-text-muted" style={{ fontSize: 21, letterSpacing: '0.04em' }} data-day-words>{right}</span>
    </div>
  );
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
  const dayFailed = dayRead !== null && !dayRead.ok;
  const entries = dayRead !== null && dayRead.ok ? dayRead.value.entries : [];
  const refused = dayRead !== null && dayRead.ok ? dayRead.value.refused : [];
  const plans = report !== null && report.ok ? report.value.plans : null;
  const lines = plans !== null && plans.listed ? plans.lines : [];
  const stranded = plans !== null && plans.listed ? plans.stranded : [];
  const notPlaced = report !== null && report.ok ? report.value.notPlaced : [];
  const dayItems = items !== null && items.ok ? items.value : [];
  const result = dayStops({ day, entries, lines, notPlaced, items: dayItems, viewerZone: zone });
  // The hero is the Budget's figure — '—' while the report cannot be read, never a sum of the stops.
  const plannedCents = report !== null && report.ok ? result.plannedCents : null;

  // ?step=n: one stop, or the whole card with the bad step named — never clamped; judged only once the reads are in
  // (before that the day has no stops yet, and "not one of this day's 0 stops" would be a false sentence).
  const n = stepParam === null ? null : /^\d+$/.test(stepParam) ? Number(stepParam) : Number.NaN;
  const focus = loaded && n !== null ? focusStop(result, n) : null;
  const badStep = loaded && n !== null && focus === null ? stepParam : null;
  const N = result.stops.length;
  const reportRead = report !== null && report.ok;
  const completeness = completenessWords(result, stranded.length, { day: !dayFailed, report: reportRead });
  const bar = progressPercent(plannedCents === null || focus === null ? null : focus.soFarCents, plannedCents);
  const foot = loaded && (result.unmatched.length > 0 || result.routineFigures.length > 0 || result.linesWithoutStop.length > 0 || result.notPlacedToday.length > 0 || stranded.length > 0 || refused.length > 0 || (report !== null && !report.ok) || (plans !== null && !plans.listed));

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
          <button type="button" className={chip} disabled={stepParam === null} onClick={() => go(hrefFor(day, null))}>all</button>
          <button type="button" className={chip} aria-label="Back one step" disabled={focus === null || focus.index === 1} onClick={() => { if (focus !== null) go(hrefFor(day, focus.index - 1)); }}>‹ step</button>
          <button type="button" className={chip} aria-label="Forward one step" disabled={N === 0 || (focus !== null && focus.index === N)} onClick={() => go(hrefFor(day, focus === null ? 1 : focus.index + 1))}>step ›</button>
        </div>
      </div>

      {/* Named above the card — never dropped, never filled in. */}
      {badDate !== null && <p className="text-xs text-brand-amber" data-day-bad-date>{badDateWords(badDate)}</p>}
      {badStep !== null && <p className="text-xs text-brand-amber" data-day-bad-step>{badStepWords(badStep, N)}</p>}
      {dayRead !== null && !dayRead.ok && <p className="text-xs text-brand-red" data-day-failed>{day} could not be read — {dayRead.words}</p>}
      {items !== null && !items.ok && <p className="text-xs text-brand-red" data-day-items-failed>The day&apos;s tasks could not be read — {items.words}</p>}

      {/* THE PLATE — the reel's card at two thirds of its size (540 wide); the page shows it on its own, the editor places it over the footage. Record this box alone. */}
      <div className="bg-ts-white border border-border flex flex-col mx-auto" style={{ width: 540, borderRadius: 23, padding: '25px 29px 24px', gap: 11 }} data-day-card data-day-step={focus === null ? undefined : focus.index}>
        <PlateHeader right={focus === null ? quarterDayWords(day) : stepHeaderWords(focus.index, focus.of, focus.stop.time)} />

        {!loaded && <p className="pt-4 text-text-muted" style={{ fontSize: 23 }} data-day-loading>loading the day…</p>}

        {loaded && focus === null && (
          <>
            <div className="flex items-baseline gap-3 pt-1" data-day-hero>
              <span className="font-extrabold text-text-primary tabular-nums" style={{ fontSize: 69, lineHeight: 1, letterSpacing: '-0.02em' }} data-day-planned>{planDollars(plannedCents)}</span>
              <span className="font-bold text-text-secondary" style={{ fontSize: 29, lineHeight: 1 }} data-day-hero-word>{heroWord(day, today)}</span>
            </div>
            <div className="font-semibold text-text-secondary" style={{ fontSize: 27, lineHeight: 1.15 }} data-day-hook>{hookWords(day, dayFailed ? null : N)}</div>
            <div className="flex flex-col" data-day-stops>
              {result.stops.map((s, i) => (
                <button
                  type="button"
                  key={s.key}
                  className="w-full text-left flex items-center gap-3 border-t border-border hover:bg-bg-row"
                  style={{ padding: '8px 0' }}
                  data-day-stop={s.key}
                  data-day-status={s.status}
                  onClick={() => go(hrefFor(day, i + 1))}
                >
                  <span className="shrink-0 text-center font-extrabold" style={{ width: 22, fontSize: 26, lineHeight: 1 }}><Mark status={s.status} /></span>
                  <span className={`font-mono font-semibold tabular-nums shrink-0 ${s.time === null ? 'text-text-faint' : 'text-text-muted'}`} style={{ width: 87, fontSize: 28 }}>{s.time === null ? '—' : s.time}</span>
                  <span className="min-w-0 flex-1 flex flex-col" style={{ gap: 3 }}>
                    <span className="font-bold text-text-primary break-words" style={{ fontSize: 31, lineHeight: 1.05 }} data-day-bold>{boldOf(s)}</span>
                    {smallOf(s) !== null && <span className="font-medium text-text-muted break-words" style={{ fontSize: 23, lineHeight: 1.1 }} data-day-small>{smallOf(s)}</span>}
                  </span>
                  <span className={`font-extrabold tabular-nums shrink-0 text-right ${s.cents === null ? 'text-text-faint' : 'text-text-primary'}`} style={{ fontSize: 31, lineHeight: 1.05 }} data-day-amount>{planDollars(s.cents)}</span>
                </button>
              ))}
              {N > 0 && <div className="border-t border-border" aria-hidden="true" />}
            </div>
            <div className="flex flex-col" style={{ gap: 4 }} data-day-plate-foot>
              {completeness !== null && <div className="font-semibold text-text-secondary" style={{ fontSize: 23, lineHeight: 1.2 }} data-day-count>{completeness}</div>}
              <div className="font-mono font-medium text-text-muted" style={{ fontSize: 20, lineHeight: 1.2 }} data-day-provenance>{provenanceWords(today, reportRead)}</div>
            </div>
          </>
        )}

        {loaded && focus !== null && (
          <div className="flex flex-col" style={{ gap: 13 }} data-day-focus>
            <div className="flex items-end justify-between gap-4 pt-1">
              <div className="min-w-0 flex flex-col" style={{ gap: 4 }}>
                <div className="font-extrabold text-text-primary break-words" style={{ fontSize: 43, lineHeight: 1, letterSpacing: '-0.01em' }} data-day-bold>{boldOf(focus.stop)}</div>
                {smallOf(focus.stop) !== null && <div className="font-medium text-text-muted break-words" style={{ fontSize: 27, lineHeight: 1.1 }} data-day-small>{smallOf(focus.stop)}</div>}
              </div>
              <div className="shrink-0 flex flex-col items-end" style={{ gap: 3 }}>
                <div className="font-semibold text-text-muted" style={{ fontSize: 24, lineHeight: 1.1, letterSpacing: '0.04em' }}>{PLAN_WORD}</div>
                <div className={`font-extrabold tabular-nums ${focus.stop.cents === null ? 'text-text-faint' : 'text-text-primary'}`} style={{ fontSize: 37, lineHeight: 1 }} data-day-amount>{planDollars(focus.stop.cents)}</div>
              </div>
            </div>
            <div className="flex flex-col border-t border-border" style={{ gap: 8, paddingTop: 13 }}>
              <div className="font-bold text-text-secondary tabular-nums" style={{ fontSize: 27 }} data-day-so-far>{soFarWords(plannedCents === null ? null : focus.soFarCents, plannedCents)}</div>
              {bar !== null && (
                <div className="bg-bg-row rounded-full overflow-hidden" style={{ height: 9 }} aria-hidden="true" data-day-progress={bar}>
                  <div className="bg-brand-green rounded-full" style={{ height: 9, width: `${bar}%` }} />
                </div>
              )}
              <div className="font-mono font-medium text-text-muted" style={{ fontSize: 20, lineHeight: 1.2 }} data-day-provenance>{provenanceWords(today, reportRead)}</div>
            </div>
          </div>
        )}
      </div>

      {/* Under the plate — the sentences that name what the plate counted; only when there is something to say. */}
      {foot && (
        <div className="mx-auto space-y-1 text-xs" style={{ width: 540 }} data-day-foot>
          {result.unmatched.length > 0 && <p className="text-brand-amber" data-day-unmatched>{unmatchedWords(result.unmatched)}</p>}
          {result.routineFigures.length > 0 && <p className="text-brand-amber" data-day-routine-figures>{routineFigureWords(result.routineFigures)}</p>}
          {result.linesWithoutStop.length > 0 && <p className="text-brand-amber" data-day-lines-without-stop>{dayFailed ? linesUnreadWords(result.linesWithoutStop) : linesWithoutStopWords(result.linesWithoutStop)}</p>}
          {result.notPlacedToday.length > 0 && <p className="text-brand-amber" data-day-not-placed>{notPlacedWords(result.notPlacedToday)}</p>}
          {stranded.length > 0 && <p className="text-brand-amber" data-day-stranded>{strandedWords(stranded)}</p>}
          <RefusedRoutines refused={refused} />
          {report !== null && !report.ok && <p className="text-brand-red" data-day-report-failed>{report.words}</p>}
          {plans !== null && !plans.listed && <p className="text-text-muted" data-day-plans-words>{plans.words}</p>}
        </div>
      )}
    </section>
  );
}
