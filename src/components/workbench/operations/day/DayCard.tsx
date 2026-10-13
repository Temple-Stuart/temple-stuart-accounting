/**
 * DayCard — THE DAY CARD at /tasks/day (DAYCARD-01, 2026-10-11; the reel plate,
 * DAYCARD-01b, 2026-10-12).
 *
 * THE STAGE IS THE REEL PLATE — the card Alex approved on the demo's reel frames,
 * at two thirds of its 1080-wide size (the plate 540 CSS px wide; a recording
 * of it is placed over the footage in the editor): the gold TS badge and the
 * wordmark, "DAY n OF m" (STAY-01: the day's place in the stay covering it —
 * "Chiang Mai, Oct 20 → Nov 2"; NO STAY when none; STAY NOT READ when the
 * stays could not be read; blank while in flight), the day's planned total in
 * heavy type ("$75" — whole dollars read without ".00"), "Tue Oct 13 · Chiang
 * Mai" then "7 stops · under or over?", then every stop
 * in clock order — the time, the line (the step's activity) or the routine's
 * name or the task's title, the place under it (the day's vendor, else the
 * location), the planned amount ('—' where the Budget lists none, never $0.00);
 * ✓ on a done routine's stops, ✕ on a missed one's — and a foot that counts what
 * the hero does not price or place, with the sentences that name each item.
 * ?step=n is the demo's STEP card: "n OF N · time", the stop large, PLAN and
 * its amount, "so far $x of $y" with its bar. The URL carries the day and the
 * step, so both can be set before the record button; every control sits
 * OUTSIDE the plate, so the plate records clean. No ฿ yet (CURRENCY-01 — the
 * typed rate needs a place to live).
 *
 * STOP-01 (2026-10-12) — THE RECORD AT A STOP. The day's stop records (GET
 * /api/operations/stops?day=) join the stops by their key: a row shows what was
 * paid under its plan ("$12 ▲ $2"), its mark is its record's (✓ done, – skipped)
 * or its routine's; the line under the hook reads "spent $54 · 2 without an
 * amount · 6 of 7 done"; the step card adds ACTUAL with ▲▼ against PLAN, the
 * status with its source ("done 12:41 · 11 min late" / "routine marked done"),
 * the rating against its rubric, the note, the minutes, and "spent so far". The
 * form that writes a record sits UNDER the plate on the step view
 * (stops/StopForm.tsx, through the one writer stops/stopWrites.ts) and asks this
 * file to read the records again — the plate itself still writes nothing.
 *
 * THE RULES are day/dayCard.ts (pure); THE READS are week/weekReads.ts
 * (readDay, readItems) and day/dayReads.ts (readDayReport, readStays,
 * readStopRecords) — this file fetches nothing of its own. The stay bar above
 * the plate (stays/StayBar.tsx) edits stays through the one writer
 * (stays/stayWrites.ts) and asks this file to read the stays again. The day is ?date= when it is a 'YYYY-MM-DD' day, else the
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
 * it; so are records that match no stop, and records the route could not place.
 * THE PLATE WRITES NOTHING: it is a view of what Tasks, Budget and the stop
 * records hold; the form under it is the one way a record is written. Nothing
 * is stored in the browser.
 *
 * ROLE-01 (2026-10-13) — the routine's role. A routine whose role is all_day is
 * in the day's plan (its line is in the hero) but not a stop: it sits in the
 * plate's "also today" band under the rows, unnumbered, with no record. The
 * form under the plate asks what the stop's role asks (stops/StopForm.tsx); a
 * place stop plans its vendor there on its matched plan line, and the plate
 * reads the report again so the place shows. "tap a stop to record it" sits
 * under the full plate, outside the recorded box.
 *
 * JOURNAL-01 (2026-10-13) — THE JOURNAL STOP'S PLATE. On the step view of a
 * routine whose role is journal, the plain record block gives way to a plate of
 * three blocks: YESTERDAY (its numbers DERIVED here from yesterday's five reads —
 * the day, the report, the items, the records, its journal — through the day's
 * own rules, dayStops → dayTally, never stored; then "→ so today"), TODAY (the
 * day's plan and stops; one thing · witness · blocker · shipped) and PLAN (three
 * "if … then …" and the obstacle). Unanswered prints '—'. The journal stop's
 * OWN record (its status, its minutes) stays on the plate. The questions are
 * answered in the form under the plate (stops/JournalForm.tsx, through the one
 * writer stops/journalWrites.ts) and this file reads the journal again. The
 * journal read and the five yesterday reads run ONLY when the day has a journal
 * stop; each lands with its day under the live guard; a failed read prints its
 * own words; a thrown invariant in yesterday's build is said on the plate.
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
import StayBar from '../stays/StayBar';
import JournalForm from '../stops/JournalForm';
import StopForm from '../stops/StopForm';
import { ACCOUNT_CELL_WORDS } from '@/lib/coa/accountCell';
import {
  JOURNAL_LOADING_WORDS, JOURNAL_NOT_READ_WORDS, NO_ANSWERS, NO_YESTERDAY_WORDS, PAIRS, PLAN_BLOCK_WORD, QUESTION_WORDS, TODAY_BLOCK_WORD, YESTERDAY_LOADING_WORDS, YESTERDAY_WORD,
  answerLine, answersOf, journalProvenanceWords, noJournalWords, pairLine, yesterdayFailedWords,
  type Answers,
} from '@/lib/operations/journal';
import { ratingWords } from '@/lib/operations/stopRecord';
import { ALSO_TODAY_WORDS, TAP_A_STOP_WORDS, allDayBandWords, allDayCentsWords } from '@/lib/operations/stopRole';
import { readDayReport, readJournal, readStays, readStopRecords, type JournalAnswer, type StaysAnswer, type StopRecordsAnswer } from './dayReads';
import {
  ACTUAL_WORD, BADGE_WORDS, BRAND_WORDS, PLAN_WORD, TASK_WORD, TODAY_WORD, badDateWords, badStepWords, completenessWords, dayStops, deltaWords, focusStop,
  bandNameOf, headerWords, heroWord, hookWords, linesUnreadWords, linesWithoutStopWords, minutesLine, notPlacedWords, planDollars, progressPercent, provenanceWords,
  recordsUnplacedWords, recordsWithoutStopWords, routineFigureWords, rowActualWords, soFarWords, spentLineWords, spentSoFarWords, statusWords, stepHeaderWords,
  strandedWords, unmatchedWords, whereWords,
  dayShortWords, dayTally, tallyDoneWords, tallyLargestWords, tallyShippedWords, tallySpentWords, todayPlanWords, typedAtWords,
  type DayTally, type StayState, type Stop,
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
  if (status === 'skipped') return <span className="text-text-muted" aria-label="skipped">–</span>;
  return null;
}

/** The colour of an actual against its plan: over paints red, under or on it green, no plan to compare muted. */
const actualTone = (over: boolean | null): string => (over === null ? 'text-text-muted' : over ? 'text-brand-red' : 'text-brand-green');

/** JOURNAL-01: yesterday's five reads, kept together — each a Read, so each failure prints its own words. */
interface YesterdayReads {
  readonly day: Read<DayAnswer>;
  readonly report: Read<BudgetReportResponse>;
  readonly items: Read<DailyPlanItem[]>;
  readonly records: Read<StopRecordsAnswer>;
  readonly journal: Read<JournalAnswer>;
}

/**
 * JOURNAL-01: yesterday's tally from its reads, through the day's own rules
 * (dayStops → dayTally). Wrapped: a thrown invariant is said in words on the
 * plate, never a plate stuck on "reading yesterday…". A day read that failed
 * builds nothing — its own words are printed instead (tally and words both null).
 */
function yesterdayTally(yday: string, reads: YesterdayReads, zone: string): { readonly tally: DayTally | null; readonly words: string | null } {
  if (!reads.day.ok) return { tally: null, words: null };
  try {
    const plans = reads.report.ok ? reads.report.value.plans : null;
    const result = dayStops({
      day: yday,
      entries: reads.day.value.entries,
      lines: plans !== null && plans.listed ? plans.lines : [],
      notPlaced: reads.report.ok ? reads.report.value.notPlaced : [],
      items: reads.items.ok ? reads.items.value : [],
      viewerZone: zone,
      records: reads.records.ok ? reads.records.value.records : null,
    });
    return { tally: dayTally(result, yday, reads.report.ok ? result.plannedCents : null), words: null };
  } catch (error) {
    return { tally: null, words: yesterdayFailedWords(error instanceof Error ? error.message : String(error)) };
  }
}

const plateLabel = { fontSize: 17, letterSpacing: '0.14em' } as const;
const plateLine = { fontSize: 23, lineHeight: 1.15 } as const;
const plateSmall = { fontSize: 20, lineHeight: 1.2 } as const;

/**
 * JOURNAL-01: the journal stop's plate — YESTERDAY (derived), TODAY, PLAN, the
 * stop's own record, the source line. `journal` null is in flight; `yesterday`
 * null is in flight. Every answer prints '—' when unanswered.
 */
function JournalPlate({ day, zone, stop, plannedCents, stops, journal, yesterday }: {
  day: string; zone: string; stop: Stop; plannedCents: number | null; stops: number | null; journal: Read<JournalAnswer> | null; yesterday: YesterdayReads | null;
}) {
  const yday = shiftDay(day, -1);
  const row = journal !== null && journal.ok ? journal.value.journal : null;
  const a: Answers = row === null ? NO_ANSWERS : answersOf(row);
  const yJournal = yesterday === null ? null : yesterday.journal;
  const yRow = yJournal !== null && yJournal.ok ? yJournal.value.journal : null;
  const built = yesterday === null ? null : yesterdayTally(yday, yesterday, zone);
  const typed = row === null ? null : typedAtWords(row.typed_at, day, zone);
  return (
    <div className="flex flex-col border-t border-border" style={{ gap: 11, paddingTop: 13 }} data-day-journal>
      <div className="flex flex-col" style={{ gap: 3 }} data-day-journal-yesterday>
        <div className="font-bold text-text-faint" style={plateLabel}>{YESTERDAY_WORD}</div>
        {yesterday === null && <div className="font-medium text-text-muted" style={plateSmall} data-day-yesterday-loading>{YESTERDAY_LOADING_WORDS}</div>}
        {yesterday !== null && !yesterday.day.ok && <div className="font-medium text-brand-red break-words" style={plateSmall} data-day-yesterday-failed>{yday} could not be read — {yesterday.day.words}</div>}
        {built !== null && built.words !== null && <div className="font-medium text-brand-red break-words" style={plateSmall} data-day-yesterday-build-failed>{built.words}</div>}
        {built !== null && built.tally !== null && (
          <>
            <div className="font-semibold text-text-secondary tabular-nums" style={plateLine} data-day-yesterday-spent>{tallySpentWords(built.tally)}</div>
            <div className="font-semibold text-text-secondary tabular-nums break-words" style={plateLine} data-day-yesterday-largest>{tallyLargestWords(built.tally)}</div>
            <div className="font-semibold text-text-secondary tabular-nums break-words" style={plateLine} data-day-yesterday-done>{tallyDoneWords(built.tally)}</div>
            <div className="font-semibold text-text-secondary break-words" style={plateLine} data-day-yesterday-shipped>{tallyShippedWords(built.tally, yRow === null ? null : yRow.shipped)}</div>
          </>
        )}
        {/* A read that failed on its own prints its own words under the stats — never dropped. */}
        {yesterday !== null && yesterday.day.ok && !yesterday.report.ok && <div className="font-medium text-brand-red break-words" style={plateSmall} data-day-yesterday-report-failed>{yesterday.report.words}</div>}
        {yesterday !== null && yesterday.day.ok && !yesterday.records.ok && <div className="font-medium text-brand-red break-words" style={plateSmall} data-day-yesterday-records-failed>{yesterday.records.words}</div>}
        {yesterday !== null && yesterday.day.ok && !yesterday.items.ok && <div className="font-medium text-brand-red break-words" style={plateSmall} data-day-yesterday-items-failed>The day&apos;s tasks could not be read — {yesterday.items.words}</div>}
        {yJournal !== null && !yJournal.ok && <div className="font-medium text-brand-red break-words" style={plateSmall} data-day-yesterday-journal-failed>{yJournal.words}</div>}
        {yJournal !== null && yJournal.ok && yRow === null && <div className="font-medium text-text-muted" style={plateSmall} data-day-yesterday-journal-none>{NO_YESTERDAY_WORDS}</div>}
        <div className="font-semibold text-text-primary break-words" style={plateLine} data-day-journal-answer="adjustment">{answerLine(QUESTION_WORDS.adjustment, a.adjustment)}</div>
      </div>
      <div className="flex flex-col" style={{ gap: 3 }} data-day-journal-today>
        <div className="font-bold text-text-faint" style={plateLabel}>{TODAY_BLOCK_WORD}</div>
        <div className="font-semibold text-text-secondary tabular-nums" style={plateLine} data-day-journal-plan>{todayPlanWords(plannedCents, stops)}</div>
        {(['one_thing', 'witness', 'blocker', 'shipped'] as const).map((field) => (
          <div key={field} className="font-semibold text-text-primary break-words" style={plateLine} data-day-journal-answer={field}>{answerLine(QUESTION_WORDS[field], a[field])}</div>
        ))}
      </div>
      <div className="flex flex-col" style={{ gap: 3 }} data-day-journal-plan-block>
        <div className="font-bold text-text-faint" style={plateLabel}>{PLAN_BLOCK_WORD}</div>
        {PAIRS.map(([ifField, thenField]) => (
          <div key={ifField} className="font-semibold text-text-primary break-words" style={plateLine} data-day-journal-pair={ifField}>
            {ifField === 'obstacle_if'
              ? pairLine(QUESTION_WORDS.obstacle_if, a[ifField], QUESTION_WORDS.obstacle_then, a[thenField])
              : pairLine(QUESTION_WORDS.plan_if, a[ifField], QUESTION_WORDS.plan_then, a[thenField])}
          </div>
        ))}
      </div>
      {journal === null && <div className="font-medium text-text-muted" style={plateSmall} data-day-journal-loading>{JOURNAL_LOADING_WORDS}</div>}
      {journal !== null && !journal.ok && <div className="font-medium text-brand-red break-words" style={plateSmall} data-day-journal-failed>{JOURNAL_NOT_READ_WORDS} — {journal.words}</div>}
      {journal !== null && journal.ok && row === null && <div className="font-medium text-text-muted" style={plateSmall} data-day-journal-none>{noJournalWords(dayShortWords(day))}</div>}
      {/* The journal stop's OWN record — its status with its source, its minutes — stays on the plate the record block gave way to. */}
      <div className="flex flex-col border-t border-border" style={{ gap: 3, paddingTop: 10 }} data-day-journal-record>
        <div className="font-semibold text-text-secondary break-words" style={plateLine} data-day-journal-status>{statusWords(stop, day)}</div>
        {minutesLine(stop.minutes, stop.actualMinutes) !== null && <div className="font-medium text-text-muted" style={plateSmall} data-day-journal-minutes>{minutesLine(stop.minutes, stop.actualMinutes)}</div>}
      </div>
      <div className="font-mono font-medium text-text-muted" style={plateSmall} data-day-journal-provenance>{journalProvenanceWords(typed)}</div>
    </div>
  );
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
  // STAY-01: the stays, read for a day and again after a write from the stay bar — kept WITH the day they
  // were read for, so a day change never pairs the old answer with the new day (a render in between would).
  const [stays, setStays] = useState<{ readonly day: string; readonly read: Read<StaysAnswer> } | null>(null);
  const [stayReads, setStayReads] = useState(0);
  // STOP-01: the records, the same way — kept with their day, read again after a write from the form under the plate.
  const [records, setRecords] = useState<{ readonly day: string; readonly read: Read<StopRecordsAnswer> } | null>(null);
  const [recordReads, setRecordReads] = useState(0);
  // ROLE-01: the report read again after a vendor is planned from the step card — in place, never blanking the plate first.
  const [reportReads, setReportReads] = useState(0);
  // JOURNAL-01: the day's journal and yesterday's five reads — each kept WITH the card's day it was read for; the journal
  // read again after a write from the form under the plate. Read ONLY when the day has a journal stop.
  const [journal, setJournal] = useState<{ readonly day: string; readonly read: Read<JournalAnswer> } | null>(null);
  const [journalReads, setJournalReads] = useState(0);
  const [yesterday, setYesterday] = useState<{ readonly day: string; readonly reads: YesterdayReads } | null>(null);
  // The day has a journal stop: a routine whose role is journal occurs on it (the today read's entries).
  const hasJournalStop = dayRead !== null && dayRead.ok && dayRead.value.entries.some((e) => e.routine.role === 'journal');

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
    // ROLE-01: a new day starts its own report read here; the re-read counter goes back to zero so the second effect stays quiet.
    setReportReads(0);
    (async () => {
      const [d, r, i] = await Promise.all([readDay(day), readDayReport(day, today), readItems(day, day)]);
      if (!live) return;
      setDayRead(d);
      setReport(r);
      setItems(i);
    })();
    return () => { live = false; };
  }, [day, today]);

  useEffect(() => {
    if (day === null) return;
    let live = true;
    (async () => {
      const s = await readStays(day);
      if (live) setStays({ day, read: s });
    })();
    return () => { live = false; };
  }, [day, stayReads]);

  useEffect(() => {
    if (day === null) return;
    let live = true;
    (async () => {
      const r = await readStopRecords(day);
      if (live) setRecords({ day, read: r });
    })();
    return () => { live = false; };
  }, [day, recordReads]);

  useEffect(() => {
    if (day === null || today === null || reportReads === 0) return;
    let live = true;
    (async () => {
      const r = await readDayReport(day, today);
      if (live) setReport(r);
    })();
    return () => { live = false; };
  }, [day, today, reportReads]);

  // JOURNAL-01: the day's journal — only when the day has a journal stop; again after a write.
  useEffect(() => {
    if (day === null || !hasJournalStop) return;
    let live = true;
    (async () => {
      const j = await readJournal(day);
      if (live) setJournal({ day, read: j });
    })();
    return () => { live = false; };
  }, [day, hasJournalStop, journalReads]);

  // JOURNAL-01: yesterday's five reads — the day, its report (asOf today, as the card's own), its tasks, its records, its journal.
  useEffect(() => {
    if (day === null || today === null || !hasJournalStop) return;
    const yday = shiftDay(day, -1);
    let live = true;
    (async () => {
      const [d, r, i, s, j] = await Promise.all([readDay(yday), readDayReport(yday, today), readItems(yday, yday), readStopRecords(yday), readJournal(yday)]);
      if (live) setYesterday({ day, reads: { day: d, report: r, items: i, records: s, journal: j } });
    })();
    return () => { live = false; };
  }, [day, today, hasJournalStop]);

  if (today === null || zone === null || day === null) {
    return <section className="text-xs text-text-muted" data-day-section>loading the day…</section>;
  }

  // The records covering THIS day — unread (in flight, or read for another day), failed, or read.
  const recordsRead = records !== null && records.day === day ? records.read : null;
  const recordRows = recordsRead !== null && recordsRead.ok ? recordsRead.value.records : null;
  const unplacedRecords = recordsRead !== null && recordsRead.ok ? recordsRead.value.unplaced : [];
  const loaded = dayRead !== null && report !== null && items !== null && recordsRead !== null;
  const dayFailed = dayRead !== null && !dayRead.ok;
  const entries = dayRead !== null && dayRead.ok ? dayRead.value.entries : [];
  const refused = dayRead !== null && dayRead.ok ? dayRead.value.refused : [];
  const plans = report !== null && report.ok ? report.value.plans : null;
  const lines = plans !== null && plans.listed ? plans.lines : [];
  const stranded = plans !== null && plans.listed ? plans.stranded : [];
  const notPlaced = report !== null && report.ok ? report.value.notPlaced : [];
  const dayItems = items !== null && items.ok ? items.value : [];
  const result = dayStops({ day, entries, lines, notPlaced, items: dayItems, viewerZone: zone, records: recordRows });
  // The hero is the Budget's figure — '—' while the report cannot be read, never a sum of the stops.
  const plannedCents = report !== null && report.ok ? result.plannedCents : null;

  // ?step=n: one stop, or the whole card with the bad step named — never clamped; judged only once the reads are in
  // (before that the day has no stops yet, and "not one of this day's 0 stops" would be a false sentence).
  const n = stepParam === null ? null : /^\d+$/.test(stepParam) ? Number(stepParam) : Number.NaN;
  const focus = loaded && n !== null ? focusStop(result, n) : null;
  const badStep = loaded && n !== null && focus === null ? stepParam : null;
  const N = result.stops.length;
  const reportRead = report !== null && report.ok;
  const recordsOk = recordsRead !== null && recordsRead.ok;
  const completeness = completenessWords(result, stranded.length, { day: !dayFailed, report: reportRead, records: recordsOk });
  const bar = progressPercent(plannedCents === null || focus === null ? null : focus.soFarCents, plannedCents);
  const foot = loaded && (result.unmatched.length > 0 || result.routineFigures.length > 0 || result.linesWithoutStop.length > 0 || result.notPlacedToday.length > 0 || stranded.length > 0 || refused.length > 0 || (report !== null && !report.ok) || (plans !== null && !plans.listed) || result.recordsWithoutStop.length > 0 || unplacedRecords.length > 0 || (recordsRead !== null && !recordsRead.ok));
  const delta = focus === null ? null : deltaWords(focus.stop.actualCents, focus.stop.cents);
  // The matched line's book, by name, from the report's own books — named as not loaded when the report lists none.
  const bookNameOf = (entityId: string): string => {
    const book = report !== null && report.ok ? report.value.report.books.find((b) => b.entityId === entityId) : undefined;
    return book === undefined ? ACCOUNT_CELL_WORDS.bookNotLoaded : book.entityName;
  };

  const go = (href: string) => router.push(href);
  // The stay covering THIS day — unread (in flight, or read for another day), failed, or read (with or without one).
  const staysRead = stays !== null && stays.day === day ? stays.read : null;
  const stayState: StayState = staysRead === null ? { kind: 'unread' } : !staysRead.ok ? { kind: 'failed' } : { kind: 'read', stay: staysRead.value.covering };
  // JOURNAL-01: the journal and yesterday's reads covering THIS day — null while in flight or read for another day.
  const journalRead = journal !== null && journal.day === day ? journal.read : null;
  const yesterdayReads = yesterday !== null && yesterday.day === day ? yesterday.reads : null;

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

      {/* STAY-01: where you are — outside the recorded box; a write reads the stays again. */}
      <StayBar day={day} stays={staysRead} onChanged={() => setStayReads((n) => n + 1)} />

      {/* THE PLATE — the reel's card at two thirds of its size (540 wide); the page shows it on its own, the editor places it over the footage. Record this box alone. */}
      <div className="bg-ts-white border border-border flex flex-col mx-auto" style={{ width: 540, borderRadius: 23, padding: '25px 29px 24px', gap: 11 }} data-day-card data-day-step={focus === null ? undefined : focus.index}>
        <PlateHeader right={focus === null ? headerWords(stayState, day) : stepHeaderWords(focus.index, focus.of, focus.stop.time)} />

        {!loaded && <p className="pt-4 text-text-muted" style={{ fontSize: 23 }} data-day-loading>loading the day…</p>}

        {loaded && focus === null && (
          <>
            <div className="flex items-baseline gap-3 pt-1" data-day-hero>
              <span className="font-extrabold text-text-primary tabular-nums" style={{ fontSize: 69, lineHeight: 1, letterSpacing: '-0.02em' }} data-day-planned>{planDollars(plannedCents)}</span>
              <span className="font-bold text-text-secondary" style={{ fontSize: 29, lineHeight: 1 }} data-day-hero-word>{heroWord(day, today)}</span>
            </div>
            <div className="font-semibold text-text-secondary" style={{ fontSize: 27, lineHeight: 1.15 }} data-day-where>{whereWords(day, stayState)}</div>
            <div className="font-semibold text-text-secondary" style={{ fontSize: 27, lineHeight: 1.15 }} data-day-hook>{hookWords(dayFailed ? null : N)}</div>
            <div className="font-semibold text-text-secondary tabular-nums" style={{ fontSize: 27, lineHeight: 1.15 }} data-day-spent>{spentLineWords(result.spentCents, result.withoutActual, result.done, dayFailed ? null : N)}</div>
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
                  <span className="shrink-0 flex flex-col items-end" style={{ gap: 2 }}>
                    <span className={`font-extrabold tabular-nums text-right ${s.cents === null ? 'text-text-faint' : 'text-text-primary'}`} style={{ fontSize: 31, lineHeight: 1.05 }} data-day-amount>{planDollars(s.cents)}</span>
                    {s.actualCents !== null && <span className={`font-semibold tabular-nums text-right ${actualTone(deltaWords(s.actualCents, s.cents).over)}`} style={{ fontSize: 21, lineHeight: 1.05 }} data-day-actual>{rowActualWords(s.actualCents, s.cents)}</span>}
                  </span>
                </button>
              ))}
              {N > 0 && <div className="border-t border-border" aria-hidden="true" />}
            </div>
            {result.allDay.length > 0 && (
              <div className="flex flex-col" style={{ gap: 4 }} data-day-all-day>
                <div className="font-bold text-text-faint" style={{ fontSize: 17, letterSpacing: '0.14em' }}>{ALSO_TODAY_WORDS.toUpperCase()}</div>
                {result.allDay.map((s) => (
                  <div key={s.key} className="flex items-baseline justify-between gap-3" data-day-all-day-row={s.key}>
                    <span className="font-semibold text-text-secondary break-words" style={{ fontSize: 23, lineHeight: 1.1 }}>{bandNameOf(s)}</span>
                    <span className={`font-bold tabular-nums shrink-0 ${s.cents === null ? 'text-text-faint' : 'text-text-secondary'}`} style={{ fontSize: 23, lineHeight: 1.1 }} data-day-all-day-amount>{planDollars(s.cents)}</span>
                  </div>
                ))}
                <div className="font-medium text-text-muted" style={{ fontSize: 20, lineHeight: 1.2 }} data-day-all-day-words>{allDayBandWords(result.allDay.filter((s) => s.cents === null).length)}</div>
              </div>
            )}
            <div className="flex flex-col" style={{ gap: 4 }} data-day-plate-foot>
              {completeness !== null && <div className="font-semibold text-text-secondary" style={{ fontSize: 23, lineHeight: 1.2 }} data-day-count>{completeness}</div>}
              <div className="font-mono font-medium text-text-muted" style={{ fontSize: 20, lineHeight: 1.2 }} data-day-provenance>{provenanceWords(today, reportRead, recordsOk)}</div>
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
            {/* JOURNAL-01: the journal stop's plate in place of the record block; every other role keeps the plain record. */}
            {focus.stop.role === 'journal' ? (
              <JournalPlate day={day} zone={zone} stop={focus.stop} plannedCents={plannedCents} stops={dayFailed ? null : N} journal={journalRead} yesterday={yesterdayReads} />
            ) : (
              /* STOP-01: what happened — the status with its source, ACTUAL against PLAN, the rating against its rubric, the note, the minutes. */
              <div className="flex items-end justify-between gap-4 border-t border-border" style={{ paddingTop: 13 }} data-day-record>
                <div className="min-w-0 flex flex-col" style={{ gap: 4 }}>
                  <div className="font-semibold text-text-secondary break-words" style={{ fontSize: 27, lineHeight: 1.1 }} data-day-status>{statusWords(focus.stop, day)}</div>
                  {focus.stop.record !== null && focus.stop.record.rating !== null && <div className="font-medium text-text-secondary" style={{ fontSize: 23, lineHeight: 1.1 }} data-day-rating>{ratingWords(focus.stop.record.rating)}</div>}
                  {focus.stop.record !== null && focus.stop.record.outcome === 'done' && focus.stop.record.note !== null && <div className="font-medium text-text-muted break-words" style={{ fontSize: 23, lineHeight: 1.1 }} data-day-note>{focus.stop.record.note}</div>}
                  {minutesLine(focus.stop.minutes, focus.stop.actualMinutes) !== null && <div className="font-medium text-text-muted" style={{ fontSize: 23, lineHeight: 1.1 }} data-day-minutes>{minutesLine(focus.stop.minutes, focus.stop.actualMinutes)}</div>}
                </div>
                <div className="shrink-0 flex flex-col items-end" style={{ gap: 3 }}>
                  <div className="font-semibold text-text-muted" style={{ fontSize: 24, lineHeight: 1.1, letterSpacing: '0.04em' }}>{ACTUAL_WORD}</div>
                  <div className={`font-extrabold tabular-nums ${focus.stop.actualCents === null ? 'text-text-faint' : 'text-text-primary'}`} style={{ fontSize: 37, lineHeight: 1 }} data-day-actual>{planDollars(focus.stop.actualCents)}</div>
                  {delta !== null && delta.over !== null && <div className={`font-semibold tabular-nums ${actualTone(delta.over)}`} style={{ fontSize: 23, lineHeight: 1.1 }} data-day-delta>{delta.text}</div>}
                </div>
              </div>
            )}
            <div className="flex flex-col border-t border-border" style={{ gap: 8, paddingTop: 13 }}>
              <div className="font-bold text-text-secondary tabular-nums" style={{ fontSize: 27 }} data-day-so-far>{soFarWords(plannedCents === null ? null : focus.soFarCents, plannedCents)}{plannedCents !== null && result.allDayCents > 0 && <span className="font-medium text-text-muted" data-day-so-far-all-day> · {allDayCentsWords(planDollars(result.allDayCents))}</span>}</div>
              {bar !== null && (
                <div className="bg-bg-row rounded-full overflow-hidden" style={{ height: 9 }} aria-hidden="true" data-day-progress={bar}>
                  <div className="bg-brand-green rounded-full" style={{ height: 9, width: `${bar}%` }} />
                </div>
              )}
              <div className="font-semibold text-text-secondary tabular-nums" style={{ fontSize: 23 }} data-day-spent-so-far>{spentSoFarWords(focus.spentSoFarCents, focus.withoutActualSoFar)}</div>
              <div className="font-mono font-medium text-text-muted" style={{ fontSize: 20, lineHeight: 1.2 }} data-day-provenance>{provenanceWords(today, reportRead, recordsOk)}</div>
            </div>
          </div>
        )}
      </div>

      {/* ROLE-01: the record lives on the step view — said under the full plate, outside the recorded box. */}
      {loaded && focus === null && N > 0 && <p className="mx-auto text-xs text-text-muted" style={{ width: 540 }} data-day-hint>{TAP_A_STOP_WORDS}</p>}

      {/* STOP-01: the record, typed under the plate on the step view — outside the recorded box; a write reads the records again. Keyed by the stop and its record so each starts from what is held; never offered while the records could not be read (a save would write over a record the screen cannot see). */}
      {loaded && recordsOk && focus !== null && focus.stop.address !== null && (
        <StopForm key={`${focus.stop.key}:${focus.stop.record === null ? 'none' : focus.stop.record.id}`} stop={focus.stop} day={day} bookName={focus.stop.planLine === null ? ACCOUNT_CELL_WORDS.bookNotLoaded : bookNameOf(focus.stop.planLine.entityId)} reportRead={reportRead} onChanged={() => setRecordReads((n) => n + 1)} onPlanChanged={() => setReportReads((n) => n + 1)} />
      )}

      {/* JOURNAL-01: the questions, under the plate on the journal stop's step view — keyed by the day and the journal held; never offered while the journal could not be read (a save would write over answers the screen cannot see). */}
      {loaded && focus !== null && focus.stop.role === 'journal' && journalRead !== null && journalRead.ok && (
        <JournalForm key={`${day}:${journalRead.value.journal === null ? 'none' : journalRead.value.journal.id}`} day={day} journal={journalRead.value.journal} onChanged={() => setJournalReads((n) => n + 1)} />
      )}

      {/* Under the plate — the sentences that name what the plate counted; only when there is something to say. */}
      {foot && (
        <div className="mx-auto space-y-1 text-xs" style={{ width: 540 }} data-day-foot>
          {result.unmatched.length > 0 && <p className="text-brand-amber" data-day-unmatched>{unmatchedWords(result.unmatched)}</p>}
          {result.routineFigures.length > 0 && <p className="text-brand-amber" data-day-routine-figures>{routineFigureWords(result.routineFigures)}</p>}
          {result.linesWithoutStop.length > 0 && <p className="text-brand-amber" data-day-lines-without-stop>{dayFailed ? linesUnreadWords(result.linesWithoutStop) : linesWithoutStopWords(result.linesWithoutStop)}</p>}
          {result.notPlacedToday.length > 0 && <p className="text-brand-amber" data-day-not-placed>{notPlacedWords(result.notPlacedToday)}</p>}
          {stranded.length > 0 && <p className="text-brand-amber" data-day-stranded>{strandedWords(stranded)}</p>}
          {result.recordsWithoutStop.length > 0 && <p className="text-brand-amber" data-day-records-without-stop>{recordsWithoutStopWords(result.recordsWithoutStop)}</p>}
          {unplacedRecords.length > 0 && <p className="text-brand-amber" data-day-records-unplaced>{recordsUnplacedWords(unplacedRecords)}</p>}
          <RefusedRoutines refused={refused} />
          {recordsRead !== null && !recordsRead.ok && <p className="text-brand-red" data-day-records-failed>{recordsRead.words}</p>}
          {report !== null && !report.ok && <p className="text-brand-red" data-day-report-failed>{report.words}</p>}
          {plans !== null && !plans.listed && <p className="text-text-muted" data-day-plans-words>{plans.words}</p>}
        </div>
      )}
    </section>
  );
}
