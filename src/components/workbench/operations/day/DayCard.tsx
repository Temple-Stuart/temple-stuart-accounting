/**
 * DayCard — THE DAY CARD, the first section of /tasks (DAYCARD-01, 2026-10-11, at
 * /tasks/day; the reel plate, DAYCARD-01b, 2026-10-12; TASKS-ONE-01, 2026-10-14:
 * Alex's ruling — one Tasks page, no sub-tabs — so the card is mounted first on
 * /tasks and /tasks/day is one hop to it, keeping ?date= and ?step=).
 *
 * THE STAGE IS THE REEL PLATE — the card Alex approved on the demo's reel frames,
 * at two thirds of its 1080-wide size (the plate 540 CSS px wide — PLAN-01,
 * 2026-10-13: 640, dayCard.ts PLATE_WIDTH, so the card is shorter on the video;
 * a recording of it is placed over the footage in the editor): the gold TS badge and the
 * wordmark, "DAY n OF m" (STAY-01: the day's place in the stay covering it —
 * "Chiang Mai, Oct 20 → Nov 2"; NO STAY when none; STAY NOT READ when the
 * stays could not be read; blank while in flight), the day's planned total in
 * heavy type ("$75" — whole dollars read without ".00"), "Tue Oct 13 · Chiang
 * Mai" then "7 stops · under or over?" (CLEAN-01, 2026-10-14: "Under or Over?"
 * alone, under the hero — see below), then every stop
 * in clock order — the time, the line (the step's activity) or the routine's
 * name or the task's title, the vendor and the location beside it (TABLE-01:
 * two columns, two facts — once one "place" line under the name), the planned
 * amount ('—' where the Budget lists none, never $0.00);
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
 * amount · 6 of 7 done" (CLEAN-01: "spent $X out of $Y"; TOTALS-01, 2026-10-14:
 * gone — the spent is the table's TOTAL row); the step card adds ACTUAL with ▲▼ against PLAN, the
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
 * VENDOR-02 (2026-10-14) — Alex's ruling: the day card is the daily and overlay
 * surface; stranded vendor picks are Budget's to show and clear. Stranded
 * vendors are no longer counted or named here — /budget lists each with Clear.
 * VENDOR-03 (Alex, 2026-10-27): BUDGET-02 (2026-10-20) took that list off
 * /budget, and no screen showed them. They have a home here again — not on the
 * plate and not in the completeness line, but as a section under the full
 * card's plate, "STRANDED VENDORS", one line each with "clear"
 * (stops/StrandedVendors.tsx), read from the report the card already holds.
 * THE PLATE WRITES NOTHING: it is a view of what Tasks, Budget and the stop
 * records hold; the form under it is the one way a record is written. Nothing
 * is stored in the browser.
 *
 * ROLE-01 (2026-10-13) — the routine's role. A routine whose role is all_day is
 * in the day's plan (its line is in the hero) but not a stop: it sits in the
 * plate's "also today" band under the rows, unnumbered, with no record. The
 * form under the plate asks what the stop's role asks (stops/StopForm.tsx); a
 * place stop plans its vendor there on its matched plan line, and the plate
 * reads the report again so the VENDOR cell shows it. "tap a stop to record it" sits
 * under the full plate, outside the recorded box.
 * VENDOR-02 (2026-10-14) — Alex's ruling: EVERY priced stop plans its vendor, not
 * only a place stop — the VENDOR row (stops/StopVendor.tsx, by dayCard.ts
 * vendorSlot) sits directly above the record row, under the fine print (CLEAN-02
 * keeps "download image" directly under the plate). It no longer needs the
 * records read to succeed (a vendor is a plan write, not a record), and a task's
 * step view has it too.
 *
 * JOURNAL-01 (2026-10-13) — THE JOURNAL STOP'S PLATE. On the step view of a
 * routine whose role is journal, the plain record block gives way to a plate.
 * JOURNAL-02 (2026-10-13) — five blocks: YESTERDAY (its END OF DAY as typed, its
 * numbers DERIVED here from yesterday's five reads — the day, the report, the
 * items, the records, its journal — through the day's own rules, dayStops →
 * dayTally, never stored; and the steps it left open), TODAY (the day's plan
 * and stops; the goals), BLOCKERS, PLAN (each step a tick button through the
 * one writer, stops/journalWrites.ts setJournal — the plate's only write) and
 * END OF DAY. Unanswered prints '—'. The journal stop's OWN record (its status,
 * its minutes) stays on the plate. The questions are answered in the form
 * under the plate (stops/JournalForm.tsx, through the same writer) and this
 * file reads the journal again after every write. The
 * journal read and the five yesterday reads run ONLY when the day has a journal
 * stop; each lands with its day under the live guard; a failed read prints its
 * own words; a thrown invariant in yesterday's build is said on the plate.
 *
 * TABLE-01 (2026-10-13) — THE STOPS AS A TABLE. The full card's stop list is a
 * real table with a header row — TIME · VENDOR · LOCATION · DESCRIPTION ·
 * BUDGET (dayCard.ts's five head words): the status mark and the interval
 * ("07:00–07:30", the end the start plus the minutes — dayCard.ts
 * intervalWords), the vendor (the matched plan line's, nothing else), the
 * location (the line's, else the routine's), the description (the line or the
 * name, and the routine under its line — exactly the row's words before), the
 * budget. '—' where a fact is not stated. Fixed widths at the plate's width,
 * every text cell wrapping, a figure never split, nothing cut — an address
 * reads whole on video; a row's description is its door, a real button. The step
 * view shows the same five facts: VENDOR and LOCATION are two labeled lines in
 * its header area (a place stop's vendor box under the plate stays the editing
 * control; the header line is the fact). VENDOR-02 (2026-10-14): every priced
 * stop's vendor box, not only a place stop's — the header line is still the fact.
 *
 * PLAN-01 (2026-10-13) — Alex's rulings. The plate is 640 wide (dayCard.ts
 * PLATE_WIDTH; every width on and under it derives from it) so the card is
 * shorter on the video. The full card's table is FOUR columns — TIME · VENDOR ·
 * DESCRIPTION · BUDGET; LOCATION is off it (the step view's LOCATION line
 * stays). Nothing recorded is unknown, not zero: "spent —" with its count until
 * a stop carries an actual. The step view draws two bars against the day's
 * planned total, each with its words: PLAN (gold) the planned money of stops
 * 1..n, SPENT (green) their actuals ("over by $X" past the total); no spent bar
 * while the records are unread or nothing so far is recorded, and no bars — said
 * why — while the total is unknown or nothing is planned.
 *
 * CLEAN-01 (2026-10-14) — the full card, cleaned (Alex's ruling). Top to
 * bottom: the header; "Wed Oct 14 · Chiang Mai" (where, moved up); the hero;
 * "Under or Over?" (no stop count); "spent $9.69 out of $75" (no counts — "—"
 * while nothing is recorded); ONE budget meter at the plate's content width —
 * the track the planned total, the fill spent ÷ planned, green while spent ≤
 * planned, red and full past it, an empty track while spent is unknown, none
 * while the total is unknown; the verdict ("▼ $4.31 under" · "▲ $2 over" · "on
 * budget") ONLY once every stop that asks an amount carries one; then the table
 * with a fifth column, ACTUAL (the row's actual against its plan, or '—'), the
 * BUDGET cell the budget only. The completeness and source lines moved off the
 * plate to directly under it, small and muted — the same words. The step view
 * is unchanged.
 *
 * TOTALS-01 (2026-10-14) — the totals at the bottom (Alex's ruling). The hero
 * and "Under or Over?" stay on top; the spent line goes (spentOutOfWords is
 * deleted) — its numbers live in the table's TOTAL row, a <tfoot> in the same
 * five columns: TOTAL across TIME to DESCRIPTION, the BUDGET total (the cells
 * shown above it — a "—" adds nothing) and the ACTUAL total (the day's spent, or
 * "—" while nothing is recorded — never $0), coloured as a row's actual against
 * the BUDGET of the recorded rows only. The meter and the verdict (their rules
 * unchanged) sit directly under the table. When the hero's day plan is more
 * than the BUDGET total — the all-day band, lines no stop carries — the fine
 * print under the plate says so (planBeyondStopsWords); equal, nothing.
 * Amendment (Alex, 2026-10-15): the meter and the verdict measure the TOTAL row
 * they sit under — the spent against the BUDGET total, not the hero's whole
 * plan (an all-day line no stop can record made every day "under" by it). No
 * BUDGET total, no meter and no verdict.
 *
 * CLEAN-02 (2026-10-14) — the step cards, cleaned (Alex's ruling). The JOURNAL
 * card shows only its five blocks: YESTERDAY as its plan's ticks ("4 of 6 steps
 * done · left over: …") and its note when typed, TODAY's goals, BLOCKERS, PLAN,
 * END OF DAY — no money: no vendor, location, plan amount, yesterday's tally,
 * planned/stops line, status, source line or bars; yesterday is read as its
 * journal alone. A STOP card keeps VENDOR, PLAN, the rating as stars alone, the
 * note, ACTUAL with ▼/▲ and both bars ("spent so far $9.69 of $75"); its
 * LOCATION and status lines are gone, and its bars' why-line and source line
 * print in the fine print under the plate. "download image" sits directly under
 * every card view — the plate alone as a PNG (../cardImage.ts).
 * VENDOR-02 (2026-10-14) amends one clause: a PRICED journal stop shows the
 * VENDOR row under the card (Alex's VENDOR-02 list names journal among the roles
 * that get the box); the journal card itself — the plate — still draws no vendor
 * and no money.
 *
 * JOURNAL-03 (Alex, 2026-10-15) — END OF DAY IS RETIRED: the journal card shows
 * four blocks — YESTERDAY, TODAY, BLOCKERS, PLAN. The END OF DAY block and
 * YESTERDAY's typed note are gone; YESTERDAY keeps its plan's ticks and what was
 * left over, and the form's "+ yesterday's open steps" is unchanged. A tick
 * sends the four answers alone, so the words typed before stay in the row.
 *
 * DECK-01 (Alex, 2026-10-16) — THE DECK. "Up top, we keep the day toggle, but for
 * the steps, can we make the cards horizontal swipable, like a tinder swipe card,
 * with button on left and right of card for when on computer." The day controls
 * stay (‹ date › today); "all", "‹ step" and "step ›" are gone. Under them, ONE
 * horizontal deck (stops/DayDeck.tsx): card 1 is the full day card, then one card
 * per stop in the table's order — the journal stop excepted — swiped on a touch
 * screen, ‹ › at the card's edges and ← → on a computer, the next card peeking,
 * a position marker under it. Every plate is the same plate, its figures and
 * words unchanged; a stop card's header counts the deck's stops. ?step=n is the
 * card in view, kept with a REPLACE as the deck moves (a swipe never fills the
 * back button); a row of the full card opens its stop's card, the journal row the
 * journal card. Under the deck, one set of controls follows the card in view:
 * download image · copy caption · copy script on the full card; download image ·
 * download tag · copy script, then the VENDOR row and the record row on a stop
 * card. "download image" renders the plate in view alone, full size (on a phone
 * the deck scales the plates to the screen; the plate stays PLATE_WIDTH wide).
 * "Also all cards look great, but vision card, it cluttered, and also we can pull
 * this out of the stack, and put it under the stack by itself." THE JOURNAL CARD
 * sits under the deck and its controls, always shown on a day with a journal
 * stop: its plate (the time alone in the header), download image · copy script
 * (no tag — no money, no vendor), its record row, its form. Decluttered:
 * YESTERDAY is one line of counts; nothing typed is the one line "nothing typed
 * for <day>"; once something is typed a block with no answer is left out.
 * dayStops, dayTotals, the verdict, the caption, the script, the tag, every
 * route and the database are unchanged; the full card's table still lists the
 * journal stop.
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { isIsoDay } from '@/lib/budget/days';
import type { BudgetReportResponse } from '@/lib/budget/reportInputs';
import { shiftDay } from '@/lib/budget/reportView';
import { zonedToInstant } from '@/lib/time';
import type { LogProject } from '@/lib/operations/morningLog';
import { NO_DONE_IN_BLOCKS, carriesDoneTasks, dayWindowOf, doneInBlocksOf, showsWorkBlock } from '@/lib/operations/workBlock';
import { localToday } from '@/lib/localToday';
import type { DailyPlanItem } from '../dailyplan/types';
import RefusedRoutines from '../routines/RefusedRoutines';
import { readDay, readItems, type DayAnswer, type Read } from '../week/weekReads';
import { DOWNLOAD_IMAGE_WORDS, DOWNLOAD_TAG_WORDS, cardImageFailedWords, cardImageName, cardTagName, downloadCardImage } from '../cardImage';
import StopTag from '../stops/StopTag';
import DayDeck, { PlateFrame, underStyle, useDeckBleed, type DeckCard } from '../stops/DayDeck';
import StayBar from '../stays/StayBar';
import MoveControl from '../stops/MoveControl';
import JournalForm from '../stops/JournalForm';
import EveningForm from '../stops/EveningForm';
import { setJournal as writeJournal } from '../stops/journalWrites';
import StopForm from '../stops/StopForm';
import StopVendor from '../stops/StopVendor';
// VENDOR-03 (Alex, 2026-10-27): the day's stranded vendors, under the full card's plate, each with "clear".
import StrandedVendors from '../stops/StrandedVendors';
import { strandedRowsOf } from '@/lib/operations/strandedVendors';
import WorkBlock from '../stops/WorkBlock';
import AttachRecord from '../stops/AttachRecord';
import { onDayWritten } from '../dayWritten';
import { ACCOUNT_CELL_WORDS } from '@/lib/coa/accountCell';
import {
  AUDIT_WORD, BLOCKERS_BLOCK_WORD, EVENING_BLANK_WORD, EVENING_WORD, JOURNAL_LOADING_WORDS, MORNING_WORD, NEXT_WORD, PLAN_BLOCK_WORD, TODAY_BLOCK_WORD, TODAY_TICKS_WORD,
  VERDICT_WORD, YESTERDAY_LOADING_WORDS, YESTERDAY_WORD,
  answersOf, goalWords, journalInput, lastNightWords, noJournalWords, planDoneWords, planStepWords, reflectionPromptText, reflectionPromptWaitsWords, todayStepsWords, yesterdayStepsWords,
  type Answers, type ReflectionMovedRow, type ReflectionPromptState, type YesterdayForPrompt,
} from '@/lib/operations/journal';
import { DONE_WORD, NOT_RECORDED_WORDS, SKIPPED_WORD, starsWords, type StopRecordPlan, type StopRecordRow } from '@/lib/operations/stopRecord';
import { ALSO_TODAY_WORDS, allDayBandWords, allDayCentsWords } from '@/lib/operations/stopRole';
import { BACKLOG_READ_NAME, MOVED_READ_NAME, readBacklog, readDayReport, readJournal, readMovedToday, readStays, readStopRecords, type JournalAnswer, type StaysAnswer, type StopRecordsAnswer } from './dayReads';
import {
  ACTUAL_WORD, BADGE_WORDS, BRAND_WORDS, PLAN_WORD, TASK_WORD, TODAY_WORD, badDateWords, badStepWords, completenessWords, dayStops, deltaWords, focusStop,
  bandNameOf, headerWords, heroWord, HOOK_WORDS, linesUnreadWords, linesWithoutStopWords, minutesLine, notPlacedWords, planDollars, progressPercent, provenanceWords,
  recordsUnplacedWords, recordsWithoutStopHead, routineFigureWords, rowActualWords, planSoFarWords, stepHeaderWords,
  barsWhyWords, PLATE_PADDING_X, PLATE_WIDTH, overByWords,
  unmatchedWords, vendorSlot, whereWords,
  asksAmount, dayShortWords,
  ACTUAL_HEAD_WORD, BUDGET_HEAD_WORD, DESCRIPTION_HEAD_WORD, TIME_HEAD_WORD, VENDOR_HEAD_WORD, intervalWords, openStepWords,
  CELL_GAP, COLUMN_WIDTHS, dayMeter, dayVerdict,
  TOTAL_WORD, dayTotals, planBeyondStopsWords,
  CAPTION_COPIED_WORDS, COPY_CAPTION_WORDS, COPY_SCRIPT_WORDS, SCRIPT_COPIED_WORDS, captionText, copyFailedWords, reelDoneOf, reelReadsWords, reelWaitingWords, scriptText, stepSpentSoFarWords, stopName, stopScriptText, stopTagWords,
  type DeltaWords, type ReelReads, type ReelText,
  DAY_CARD_PATH,
  DECK_FULL_CARD_WORDS, SWIPE_HINT_WORDS, journalHeaderWords, journalImageName, openJournalWords,
  type Focus, type StayState, type Stop,
} from './dayCard';

const chip = 'px-2 py-0.5 border border-border rounded hover:bg-bg-row text-xs disabled:opacity-50';
/** DECK-01: the space kept above the journal card when the page scrolls to it (a row's door, or the #journal anchor). */
const JOURNAL_SCROLL_MARGIN = 8;

/** The URL of a day, and of one of its stops — on /home, the home page, between the answers and the sheet (HOME-03, Alex, 2026-10-27: DAY_CARD_PATH is /home; HOME-01, 2026-10-24: /runway, the dashboard's Runway panel; TASKS-ONE-01 put it first on /tasks; TIME-01, 2026-10-19: /time). DECK-01: the step is the deck's card number. */
const hrefFor = (day: string, step: number | null): string => `${DAY_CARD_PATH}?date=${day}${step === null ? '' : `&step=${step}`}`;

/** The row's bold text: the line (the step's activity) when it has one, else the label. REEL-01 (2026-10-15): the rule moved to dayCard.ts stopName, so the reel's caption and script name a stop as the row does. */
const boldOf = (s: Stop): string => stopName(s);

/** The description's small text: the routine's name under its line, "task" under a task; null for a stepless routine (its name is the bold text). TABLE-01: the vendor and the location have their own columns. */
function smallOf(s: Stop): string | null {
  if (s.kind === 'task') return TASK_WORD;
  if (s.kind === 'routine') return null;
  return s.label;
}

/** A fact a stop does not state prints '—', never a blank. */
const factOf = (fact: string | null): string => (fact === null ? '—' : fact);

/**
 * TABLE-01: the columns at the plate's inner width (dayCard.ts PLATE_INNER_WIDTH).
 * Each fixed width holds its widest fact, measured in the card's own fonts:
 * TIME the mark's slot and "06:30–06:45" at 13 px mono (17 + 86 px); BUDGET
 * "$9,999.99" at 19 px extrabold (96.4 px) — a figure is never split, and a
 * larger one runs whole into the plate's padding; DESCRIPTION takes the rest.
 * PLAN-01 (2026-10-13, Alex's ruling): four columns — TIME · VENDOR ·
 * DESCRIPTION · BUDGET — at the plate's 640 (inner 580); LOCATION is off the
 * table (the step view's LOCATION line stays), VENDOR takes 140 px (a name of
 * two words on one line) and DESCRIPTION the 232 px left.
 * CLEAN-01 (2026-10-14, Alex's ruling): five columns — TIME · VENDOR ·
 * DESCRIPTION · BUDGET · ACTUAL — their widths are dayCard.ts COLUMN_WIDTHS,
 * derived there from the plate's inner width; every cell but the last keeps
 * CELL_GAP on its right.
 */
const CELL_PADDING = `7px ${CELL_GAP}px 7px 0`;
/** The status mark's own slot in the TIME cell, on every row, so every clock starts at one x (✓ is 13.3 px at 15 px). */
const MARK_SLOT = 17;
const headCell = 'font-bold text-text-faint text-left align-bottom';
const headStyle = { fontSize: 12, letterSpacing: '0.14em', paddingBottom: 6 } as const;

function Mark({ status }: { status: Stop['status'] }) {
  if (status === 'done') return <span className="text-brand-green" aria-label="done">✓</span>;
  if (status === 'missed') return <span className="text-brand-amber" aria-label="missed">✕</span>;
  if (status === 'skipped') return <span className="text-text-muted" aria-label="skipped">–</span>;
  return null;
}

/** The colour of an actual against its plan: over paints red, under or on it green, no plan to compare muted. */
const actualTone = (over: boolean | null): string => (over === null ? 'text-text-muted' : over ? 'text-brand-red' : 'text-brand-green');

const plateLabel = { fontSize: 17, letterSpacing: '0.14em' } as const;
const plateLine = { fontSize: 23, lineHeight: 1.15 } as const;
const plateSmall = { fontSize: 20, lineHeight: 1.2 } as const;

/** The browser's motion preference, read when a move is made — never at render. */
const reducedMotion = (): boolean => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** RETRO-01: the plan words the stops GET handed beside this record; a record it listed without them is the route's error, never a nameless line. */
const planOfRecord = (plans: StopRecordsAnswer['plans'], r: StopRecordRow): StopRecordPlan => {
  const plan = plans[r.id];
  if (plan === undefined) throw new Error(`dayCard: record ${r.id} came without its plan words`);
  return plan;
};

/**
 * JOURNAL-01: the journal stop's plate. `journal` null is in flight; `yesterday`
 * (yesterday's journal read) null is in flight. JOURNAL-02 (2026-10-13): five
 * blocks in order, large for video; PLAN's steps are buttons that flip their tick
 * through the one writer — the whole journal with that one flag flipped, busy
 * while it writes, the route's words on a refusal, the journal read again after,
 * never an optimistic copy — with "n of N done". Every unanswered block prints
 * '—'. No retired answer is read.
 * CLEAN-02 (2026-10-14, Alex's ruling): the journal card shows ONLY its five
 * blocks — YESTERDAY is its plan's ticks ("4 of 6 steps done · left over: a ·
 * b", "all 6 steps done", "no plan yesterday", "no journal yesterday", or the
 * read's failure words) and its note when one was typed; TODAY the goals;
 * BLOCKERS; PLAN; END OF DAY. No money: yesterday's spent, largest difference
 * and done-of-stops, TODAY's planned/stops line, the status line and the source
 * line are gone, and the step view draws no vendor, location, plan amount or
 * bars for a journal stop (VENDOR-02, 2026-10-14: on its plate — a priced journal
 * stop's VENDOR row sits under the card, as every priced stop's). The journal's own read state (in flight, failed,
 * nothing typed) is still said — an unknown is never an empty block.
 * JOURNAL-03 (Alex, 2026-10-15): four blocks — END OF DAY and YESTERDAY's note are gone; a tick sends the four
 * answers alone (no shipped), so the words typed there before stay in the row.
 * DECK-01 (Alex, 2026-10-16) — DECLUTTERED: YESTERDAY is one line of counts ("4 of 6 steps done · 2 left over" —
 * the steps themselves are the form's "+ yesterday's open steps" and the plan prompt's); nothing typed for the day
 * is the one line noJournalWords in place of TODAY, BLOCKERS and PLAN; once something is typed, a block with no
 * answer is left out — nothing prints '—'. The read's own state (in flight, failed) is still said.
 * JOURNAL-05 (Alex, 2026-10-19) — THE MORNING CARD, named: MORNING_WORD is the first line of the plate's journal
 * block (under the stop's bold and small words, above YESTERDAY). The YESTERDAY block gains ONE line above its
 * counts, only when yesterday's row has a `next` — "Last night: …" (lastNightWords); nothing when it has none.
 * TODAY, BLOCKERS, PLAN and the tick are unchanged. The evening is its own plate (EveningPlate), under the form.
 */
function JournalPlate({ day, journal, yesterday, onChanged }: {
  day: string; journal: Read<JournalAnswer> | null; yesterday: Read<JournalAnswer> | null; onChanged: () => void;
}) {
  const [busyStep, setBusyStep] = useState<number | null>(null);
  const [tickWords, setTickWords] = useState<string | null>(null);
  const row = journal !== null && journal.ok ? journal.value.journal : null;
  const a: Answers = answersOf(row === null ? {} : row);
  const yRow = yesterday !== null && yesterday.ok ? yesterday.value.journal : null;

  // A tick: the whole journal as held with that one flag flipped — the eleven answers of the row read for the day (JOURNAL-04, 2026-10-19 / JOURNAL-06, 2026-10-20: the evening's seven ride as held, learned never sent, so a tick never clears an evening; the card
  // re-reads the journal after every write), through the route's own rule and the one writer; then the journal read again.
  const tick = async (i: number) => {
    if (row === null || busyStep !== null) return;
    const read = journalInput({ day, ...answersOf(row), plan_done: row.plan_done.map((d, j) => (j === i ? !d : d)) });
    if (!read.ok) { setTickWords(read.message); return; }
    setBusyStep(i);
    setTickWords(null);
    try {
      const answer = await writeJournal(day, read.value.answers);
      if (!answer.ok) { setTickWords(answer.message); return; }
      onChanged();
    } finally {
      setBusyStep(null);
    }
  };

  return (
    <div className="flex flex-col border-t border-border" style={{ gap: 13, paddingTop: 13 }} data-day-journal>
      <div className="font-bold text-text-faint" style={plateLabel} data-day-journal-morning>{MORNING_WORD}</div>
      <div className="flex flex-col" style={{ gap: 3 }} data-day-journal-yesterday>
        <div className="font-bold text-text-faint" style={plateLabel}>{YESTERDAY_WORD}</div>
        {yesterday === null && <div className="font-medium text-text-muted" style={plateSmall} data-day-yesterday-loading>{YESTERDAY_LOADING_WORDS}</div>}
        {yesterday !== null && !yesterday.ok && <div className="font-medium text-brand-red break-words" style={plateSmall} data-day-yesterday-journal-failed>{yesterday.words}</div>}
        {yesterday !== null && yesterday.ok && yRow !== null && yRow.next !== null && <div className="font-semibold text-text-primary break-words" style={plateLine} data-day-yesterday-next>{lastNightWords(yRow.next)}</div>}
        {yesterday !== null && yesterday.ok && <div className="font-semibold text-text-primary break-words" style={plateLine} data-day-yesterday-steps>{yesterdayStepsWords(yRow)}</div>}
      </div>
      {journal === null && <div className="font-medium text-text-muted" style={plateSmall} data-day-journal-loading>{JOURNAL_LOADING_WORDS}</div>}
      {journal !== null && !journal.ok && <div className="font-medium text-brand-red break-words" style={plateSmall} data-day-journal-failed>{journal.words}</div>}
      {journal !== null && journal.ok && row === null && <div className="font-medium text-text-muted" style={plateSmall} data-day-journal-none>{noJournalWords(dayShortWords(day))}</div>}
      {row !== null && a.goals.length > 0 && (
        <div className="flex flex-col" style={{ gap: 3 }} data-day-journal-today>
          <div className="font-bold text-text-faint" style={plateLabel}>{TODAY_BLOCK_WORD}</div>
          {a.goals.map((goal, i) => (
            <div key={`${i}:${goal}`} className="font-semibold text-text-primary break-words" style={plateLine} data-day-journal-goal>{goalWords(goal)}</div>
          ))}
        </div>
      )}
      {row !== null && a.blocker !== null && (
        <div className="flex flex-col" style={{ gap: 3 }} data-day-journal-blockers>
          <div className="font-bold text-text-faint" style={plateLabel}>{BLOCKERS_BLOCK_WORD}</div>
          <div className="font-semibold text-text-primary break-words" style={plateLine} data-day-journal-blocker>{a.blocker}</div>
        </div>
      )}
      {row !== null && a.plan_steps.length > 0 && (
        <div className="flex flex-col" style={{ gap: 3 }} data-day-journal-plan-block>
          <div className="font-bold text-text-faint" style={plateLabel}>{PLAN_BLOCK_WORD}</div>
          {a.plan_steps.map((step, i) => (
            <button
              type="button"
              key={`${i}:${step}`}
              className={`block w-full text-left font-semibold break-words disabled:opacity-50 ${a.plan_done[i] ? 'text-text-secondary' : 'text-text-primary'}`}
              style={plateLine}
              disabled={busyStep !== null}
              aria-pressed={a.plan_done[i]}
              aria-busy={busyStep === i}
              onClick={() => tick(i)}
              data-day-journal-step={i + 1}
              data-day-journal-step-done={a.plan_done[i] ? 'true' : 'false'}
            >{planStepWords(i + 1, step, a.plan_done[i])}</button>
          ))}
          <div className="font-medium text-text-muted tabular-nums" style={plateSmall} data-day-journal-plan-done>{planDoneWords(a.plan_done.filter((d) => d).length, a.plan_steps.length)}</div>
          {tickWords !== null && <div className="font-medium text-brand-red break-words" style={plateSmall} data-day-journal-tick-words>{tickWords}</div>}
        </div>
      )}
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

/**
 * THE PLATE — the reel's card at two thirds of its size (PLATE_WIDTH wide — PLAN-01: 640); the editor places it over the
 * footage. Record this box alone. DECK-01: one per card of the deck (data-day-step is the deck's card number) and one for the
 * journal card under it (data-day-journal-card); the deck centres and scales them, so the plate carries no margin of its own.
 */
function Plate({ plateRef, step, journal, right, children }: {
  plateRef: (el: HTMLDivElement | null) => void; step?: number; journal?: boolean; right: string; children: React.ReactNode;
}) {
  return (
    <div ref={plateRef} className="bg-ts-white border border-border flex flex-col" style={{ width: PLATE_WIDTH, borderRadius: 23, padding: `25px ${PLATE_PADDING_X}px 24px`, gap: 11 }} data-day-card data-day-step={step} data-day-journal-card={journal ? 'true' : undefined}>
      <PlateHeader right={right} />
      {children}
    </div>
  );
}

/** The evening plate has no image button — its Plate takes no ref. */
const noPlateRef = (): void => undefined;

/**
 * JOURNAL-05 (Alex, 2026-10-19): THE EVENING PLATE — reflection, derived, never typed here. TODAY'S TICKS by the
 * morning's own counts rule applied to today's row (todayStepsWords — "no plan today" when none); the card's VERDICT
 * as it already says it (the dayVerdict words, in the card's tone; '—' when the card shows none); then the three
 * answers as held — ACCOMPLISHED the narrative as pasted (whitespace-pre-line, full) and NEXT — each '—' when null; the
 * five blocks between them (JOURNAL-06) are the form's alone, the plate does not repeat them; LEARNED is retired. The
 * journal's own read state (in flight, failed) is said, as the morning says it. No money beyond the verdict line
 * (CLEAN-02 stands); no image, no reel button (REEL-02 decides the reel).
 */
function EveningPlate({ journal, verdict }: { journal: Read<JournalAnswer> | null; verdict: DeltaWords | null }) {
  const row = journal !== null && journal.ok ? journal.value.journal : null;
  const answer = (text: string | null): string => (text === null ? EVENING_BLANK_WORD : text);
  return (
    <div className="flex flex-col border-t border-border" style={{ gap: 13, paddingTop: 13 }} data-day-evening>
      <div className="font-bold text-text-faint" style={plateLabel} data-day-evening-label>{EVENING_WORD}</div>
      {journal === null && <div className="font-medium text-text-muted" style={plateSmall} data-day-evening-loading>{JOURNAL_LOADING_WORDS}</div>}
      {journal !== null && !journal.ok && <div className="font-medium text-brand-red break-words" style={plateSmall} data-day-evening-failed>{journal.words}</div>}
      {journal !== null && journal.ok && (
        <>
          <div className="flex flex-col" style={{ gap: 3 }} data-day-evening-ticks>
            <div className="font-bold text-text-faint" style={plateLabel}>{TODAY_TICKS_WORD}</div>
            <div className="font-semibold text-text-primary break-words" style={plateLine} data-day-evening-ticks-words>{todayStepsWords(row)}</div>
          </div>
          <div className="flex flex-col" style={{ gap: 3 }} data-day-evening-verdict>
            <div className="font-bold text-text-faint" style={plateLabel}>{VERDICT_WORD}</div>
            <div className={`font-semibold break-words ${verdict === null ? 'text-text-muted' : actualTone(verdict.over)}`} style={plateLine} data-day-evening-verdict-words>{verdict === null ? EVENING_BLANK_WORD : verdict.text}</div>
          </div>
          <div className="flex flex-col" style={{ gap: 3 }} data-day-evening-audit>
            <div className="font-bold text-text-faint" style={plateLabel}>{AUDIT_WORD}</div>
            <div className={`font-semibold break-words whitespace-pre-line ${row === null || row.audit === null ? 'text-text-muted' : 'text-text-primary'}`} style={plateLine} data-day-evening-audit-words>{answer(row === null ? null : row.audit)}</div>
          </div>
          <div className="flex flex-col" style={{ gap: 3 }} data-day-evening-next>
            <div className="font-bold text-text-faint" style={plateLabel}>{NEXT_WORD}</div>
            <div className={`font-semibold break-words ${row === null || row.next === null ? 'text-text-muted' : 'text-text-primary'}`} style={plateLine} data-day-evening-next-words>{answer(row === null ? null : row.next)}</div>
          </div>
        </>
      )}
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
  // JOURNAL-01: the day's journal and yesterday's — each kept WITH the card's day it was read for; the journal
  // read again after a write from the form under the plate. Read ONLY when the day has a journal stop.
  // CLEAN-02 (2026-10-14): yesterday is its journal alone — the card shows no money from yesterday, so its day,
  // report, tasks and records are no longer read.
  const [journal, setJournal] = useState<{ readonly day: string; readonly read: Read<JournalAnswer> } | null>(null);
  const [journalReads, setJournalReads] = useState(0);
  const [yesterday, setYesterday] = useState<{ readonly day: string; readonly read: Read<JournalAnswer> } | null>(null);
  // JOURNAL-06 (Alex, 2026-10-20): the reflection prompt's two reads — THE BACKLOG (the projects not done) and WHAT MOVED TODAY (the
  // operations_ audit-log slice for the card's day in the viewer's zone) — each kept WITH the day it was read for, read only on a day with
  // a journal stop, and again after any write the card knows of (a journal write, a record write, the ledger's one-off stop), so the prompt
  // never carries a stale backlog or a day that stopped moving before its last write.
  // BACKLOG-02 (Alex, 2026-10-20): the same read is THE LOG on the morning card (stops/MorningLog.tsx) — each row with its id,
  // its book and its open tasks — read again after a write from THE LOG (logReads: a rank or a task), never re-reading the journal.
  const [backlog, setBacklog] = useState<{ readonly day: string; readonly read: Read<readonly LogProject[]> } | null>(null);
  const [logReads, setLogReads] = useState(0);
  const [moved, setMoved] = useState<{ readonly day: string; readonly read: Read<readonly ReflectionMovedRow[]> } | null>(null);
  // CLEAN-02 (2026-10-14): "download image" — the plate element, busy while it renders, and a failure kept with the view it was pressed on.
  // DECK-01 (2026-10-16): one plate per card of the deck (by its card number, 0 the full card) and the journal card's own.
  const plateRefs = useRef<(HTMLDivElement | null)[]>([]);
  const journalPlateRef = useRef<HTMLDivElement | null>(null);
  const journalCardRef = useRef<HTMLDivElement>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageFailed, setImageFailed] = useState<{ readonly view: string; readonly words: string } | null>(null);
  // REEL-01 (2026-10-15): the stop's tag element (rendered off the page, made a PNG by the same helper), busy while it renders;
  // and the last reel answer — copied, or a failure in words — kept with the view it was pressed on.
  const tagRef = useRef<HTMLDivElement>(null);
  const [tagBusy, setTagBusy] = useState(false);
  const [reelWords, setReelWords] = useState<{ readonly view: string; readonly ok: boolean; readonly words: string } | null>(null);
  // The day the three reads above landed for: a day change renders once with the old day's reads before they are blanked, and
  // the journal and yesterday effects must not fire on that render.
  const [readsDay, setReadsDay] = useState<string | null>(null);
  // RETRO-01 (2026-10-16): the ledger's "+ expense" writes a one-off stop, its vendor and its record for a day (dayWritten.ts);
  // a card showing that day reads it again — the day, the report, the tasks and the records — through its own reads.
  const [dayWrites, setDayWrites] = useState(0);
  // WIDTH-01 (Alex, 2026-10-16): whether the deck bleeds into the page gutter — what sits under a card takes the card's width either way.
  const bleed = useDeckBleed();

  useEffect(() => {
    setToday(localToday());
    setZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  const dateParam = search.get('date');
  const stepParam = search.get('step');
  // The day: ?date= when it is a day, else today; a ?date= that is not a day is named, never replaced in silence.
  const badDate = dateParam !== null && !isIsoDay(dateParam) ? dateParam : null;
  const day = today === null ? null : dateParam !== null && isIsoDay(dateParam) ? dateParam : today;
  // The day has a journal stop: a routine whose role is journal occurs on it (the today read's entries, landed for THIS day).
  const hasJournalStop = readsDay === day && dayRead !== null && dayRead.ok && dayRead.value.entries.some((e) => e.routine.role === 'journal');
  // WORK-02 (Alex, 2026-10-26): the day has an execute stop — THE WORK BLOCK reads the backlog too, with the day's bounds.
  const hasExecuteStop = readsDay === day && dayRead !== null && dayRead.ok && dayRead.value.entries.some((e) => e.routine.role === 'execute');

  useEffect(() => {
    if (day === null || today === null) return;
    let live = true;
    setDayRead(null);
    setReport(null);
    setItems(null);
    setReadsDay(null);
    // ROLE-01: a new day starts its own report read here; the re-read counter goes back to zero so the second effect stays quiet.
    setReportReads(0);
    (async () => {
      const [d, r, i] = await Promise.all([readDay(day), readDayReport(day, today), readItems(day, day)]);
      if (!live) return;
      setDayRead(d);
      setReport(r);
      setItems(i);
      setReadsDay(day);
    })();
    return () => { live = false; };
  }, [day, today, dayWrites]);

  // RETRO-01: told that this day was written to from another section, the card reads it again.
  useEffect(() => {
    if (day === null) return;
    return onDayWritten((written) => { if (written === day) setDayWrites((n) => n + 1); });
  }, [day]);

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
  }, [day, recordReads, dayWrites]);

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

  // JOURNAL-01: yesterday's journal — CLEAN-02 (2026-10-14): the one read of yesterday (its ticks; JOURNAL-03, 2026-10-15: no note).
  useEffect(() => {
    if (day === null || !hasJournalStop) return;
    const yday = shiftDay(day, -1);
    let live = true;
    (async () => {
      const j = await readJournal(yday);
      if (live) setYesterday({ day, read: j });
    })();
    return () => { live = false; };
  }, [day, hasJournalStop]);

  // JOURNAL-06: THE BACKLOG — the projects not done (dayReads.ts readBacklog), for a day with a journal stop; again after any write the card knows of.
  // WORK-02 (Alex, 2026-10-26): and for a day with an execute stop — THE WORK BLOCK's TO DO is the same read, asked with the DAY's bounds in the
  // viewer's zone (dayWindowOf) so each project also carries the tasks done today; the block narrows to its window client-side.
  useEffect(() => {
    if (day === null || !(hasJournalStop || hasExecuteStop)) return;
    const doneWindow = hasExecuteStop && zone !== null ? dayWindowOf(day, zone) : null;
    let live = true;
    (async () => {
      const b = await readBacklog(doneWindow);
      if (live) setBacklog({ day, read: b });
    })();
    return () => { live = false; };
  }, [day, zone, hasJournalStop, hasExecuteStop, journalReads, recordReads, dayWrites, logReads]);

  // JOURNAL-06: WHAT MOVED TODAY — the operations_ audit-log slice between the day's midnight and the next IN THE VIEWER'S ZONE (zonedToInstant);
  // the window ends the last millisecond before the next day's midnight (the route's `before` is inclusive), so the next day's first write is not this day's.
  useEffect(() => {
    if (day === null || zone === null || !hasJournalStop) return;
    const after = zonedToInstant(day, '00:00', zone);
    const before = new Date(zonedToInstant(shiftDay(day, 1), '00:00', zone).getTime() - 1);
    let live = true;
    (async () => {
      const m = await readMovedToday(after, before);
      if (live) setMoved({ day, read: m });
    })();
    return () => { live = false; };
  }, [day, zone, hasJournalStop, journalReads, recordReads, dayWrites, logReads]);

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
  // VENDOR-03 (Alex, 2026-10-27): the report's stranded vendors — none while the report is unread or failed (its words show in the foot).
  const strandedRows = strandedRowsOf(plans);
  const notPlaced = report !== null && report.ok ? report.value.notPlaced : [];
  const dayItems = items !== null && items.ok ? items.value : [];
  const result = dayStops({ day, entries, lines, notPlaced, items: dayItems, viewerZone: zone, records: recordRows });
  // The hero is the Budget's figure — '—' while the report cannot be read, never a sum of the stops.
  const plannedCents = report !== null && report.ok ? result.plannedCents : null;

  // DECK-01: the deck's stops — the table's order, the journal stop excepted (it has its own card under the deck); each with its
  // place on the itinerary (focusStop's n — the so-far sums are the itinerary's, unchanged) and its card number.
  const deckStops = result.stops.map((stop, j) => ({ stop, at: j + 1 })).filter((x) => x.stop.role !== 'journal');
  const deckNumberOf = new Map(deckStops.map((x, i) => [x.stop.key, i + 1]));
  const journalStop = result.stops.find((s) => s.role === 'journal') ?? null;
  // ?step=n: the deck's card n — one stop, or the whole card with the bad step named — never clamped; judged only once the reads
  // are in (before that the day has no stops yet, and "not one of this day's 0 stops" would be a false sentence).
  const n = stepParam === null ? null : /^\d+$/.test(stepParam) ? Number(stepParam) : Number.NaN;
  const deckStop = loaded && n !== null && Number.isInteger(n) && n >= 1 && n <= deckStops.length ? deckStops[n - 1] : null;
  const focusOf = (at: number): Focus => {
    const f = focusStop(result, at);
    if (f === null) throw new Error(`dayCard: stop ${at} is not one of the day's ${result.stops.length} stops`);
    return f;
  };
  const focus = deckStop === null ? null : focusOf(deckStop.at);
  const badStep = loaded && n !== null && deckStop === null ? stepParam : null;
  const N = deckStops.length;
  const deckIndex = deckStop === null ? 0 : (n as number);
  const reportRead = report !== null && report.ok;
  const recordsOk = recordsRead !== null && recordsRead.ok;
  const completeness = completenessWords(result, { day: !dayFailed, report: reportRead, records: recordsOk });
  // CLEAN-01 (2026-10-14): the full card's spent — unknown ('—', null) while the records are unread or no stop carries an actual (PLAN-01: never $0);
  // the meter against the planned total, and the verdict only once every stop that asks an amount carries one.
  // TOTALS-01 (2026-10-14): the TOTAL row's figures (dayTotals) — the spent is its ACTUAL total, one rule for the row and the meter.
  // TOTALS-01 amendment (Alex, 2026-10-15): the meter and the verdict sit under the TOTAL row and measure ITS two figures — the spent
  // against the stops' budget (totals.budgetCents), not the hero's whole plan: an all-day line no stop can record read as "under" by
  // that money every day (the fine print's off-the-table line names it). No BUDGET total, no meter and no verdict. Rules unchanged.
  const totals = dayTotals(result, plannedCents);
  const spent = totals.actualCents;
  const meter = dayMeter(spent, totals.budgetCents);
  const verdict = dayVerdict(result, totals.budgetCents);
  // PLAN-01 (2026-10-13): two bars on the step view against the day's planned total — PLAN (gold) the planned money of stops 1..n,
  // SPENT (green) their actuals. No spent bar while the records are unread or nothing so far carries an actual (unknown, not zero).
  // TOTALS-01 amendment II (Alex, 2026-10-15): against the TOTAL row's BUDGET (totals.budgetCents), as the meter and the verdict are —
  // the stops' own budget, not the hero's whole plan, whose all-day money no stop can record. Rules unchanged; moved inputs only.
  // DECK-01 (2026-10-16): the same three, for each stop card of the deck (barsOf) — the rules unchanged, the card's focus handed in.
  const barsOf = (f: Focus) => ({
    planBar: progressPercent(totals.budgetCents === null ? null : f.soFarCents, totals.budgetCents),
    spentBar: f.spentSoFarCents === null || f.withActualSoFar === 0 ? null : progressPercent(f.spentSoFarCents, totals.budgetCents),
    overCents: f.spentSoFarCents === null || f.withActualSoFar === 0 || totals.budgetCents === null || f.spentSoFarCents <= totals.budgetCents ? null : f.spentSoFarCents - totals.budgetCents,
  });
  const planBar = focus === null ? null : barsOf(focus).planBar;
  const foot = loaded && (result.unmatched.length > 0 || result.routineFigures.length > 0 || result.linesWithoutStop.length > 0 || result.notPlacedToday.length > 0 || refused.length > 0 || (report !== null && !report.ok) || (plans !== null && !plans.listed) || result.recordsWithoutStop.length > 0 || unplacedRecords.length > 0 || (recordsRead !== null && !recordsRead.ok));
  // The matched line's book, by name, from the report's own books — named as not loaded when the report lists none.
  const bookNameOf = (entityId: string): string => {
    const book = report !== null && report.ok ? report.value.report.books.find((b) => b.entityId === entityId) : undefined;
    return book === undefined ? ACCOUNT_CELL_WORDS.bookNotLoaded : book.entityName;
  };

  const go = (href: string) => router.push(href);
  // DECK-01: the deck moves with a REPLACE — a swipe, a button, a key, a dot or a tap on a row never fills the back button, and a
  // link or a reload opens the same card. The page is not scrolled.
  const show = (step: number | null) => router.replace(hrefFor(day, step), { scroll: false });
  // The journal row's door: the page scrolls to the journal card by its measured place (window.scrollTo — under a phone's emulation the
  // root's scrollIntoView moved the visual viewport, not the page), JOURNAL_SCROLL_MARGIN above it; the #journal anchor keeps the same margin.
  const showJournal = () => {
    const el = journalCardRef.current;
    if (el === null) return;
    window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - JOURNAL_SCROLL_MARGIN, behavior: reducedMotion() ? 'auto' : 'smooth' });
  };
  // The stay covering THIS day — unread (in flight, or read for another day), failed, or read (with or without one).
  const staysRead = stays !== null && stays.day === day ? stays.read : null;
  const stayState: StayState = staysRead === null ? { kind: 'unread' } : !staysRead.ok ? { kind: 'failed' } : { kind: 'read', stay: staysRead.value.covering };
  // JOURNAL-01: the journal and yesterday's reads covering THIS day — null while in flight or read for another day.
  const journalRead = journal !== null && journal.day === day ? journal.read : null;
  const yesterdayRead = yesterday !== null && yesterday.day === day ? yesterday.read : null;
  // JOURNAL-02: yesterday for the form's "+ yesterday's open steps"; PLAN-01: for the plan prompt (CLEAN-02: its row — the ticks; JOURNAL-03: no note) —
  // or why yesterday is not known (in flight, or its journal read failed): the form offers neither then, and never writes "no journal" for an unknown.
  const yesterdayForPrompt: YesterdayForPrompt = yesterdayRead === null
    ? { ok: false, words: YESTERDAY_LOADING_WORDS }
    : !yesterdayRead.ok
      ? { ok: false, words: yesterdayRead.words }
      : { ok: true, row: yesterdayRead.value.journal };
  // CLEAN-02 (2026-10-14): the plate alone as a PNG, named for the day and the view; busy while it renders; a failure is said under the button, in words — nothing else is tried.
  // DECK-01: the view is the card in view (the deck's card number), or the journal card; each button renders ITS plate — full size, whatever the deck's scale.
  const view = hrefFor(day, deckStop === null ? null : deckIndex);
  const journalView = `${hrefFor(day, null)}#journal`;
  const downloadImage = async (plate: HTMLDivElement | null, name: string, at: string) => {
    if (imageBusy) return;
    setImageBusy(true);
    setImageFailed(null);
    try {
      if (plate === null) throw new Error('the card is not on the page');
      await downloadCardImage(plate, name);
    } catch (error) {
      setImageFailed({ view: at, words: cardImageFailedWords(error instanceof Error ? error.message : String(error)) });
    } finally {
      setImageBusy(false);
    }
  };

  // REEL-01 (Alex, 2026-10-15): the reel kit — the stop's tag, the day's caption, the reel's script — each made by one pure rule
  // (dayCard.ts) from the card's own reads and figures; nothing leaves the browser but the PNG and the clipboard. A read an output uses
  // that is still in flight makes it wait, a failed one is named (a refused routine is a stop the card cannot show) — never a partial
  // text. The journal is the card's own read: on a day with a journal stop it is waited for; on any other day the card reads none.
  const reelReads: ReelReads = {
    day: dayRead === null ? 'waiting' : dayRead.ok && refused.length === 0 ? 'ok' : 'failed',
    tasks: items === null ? 'waiting' : items.ok ? 'ok' : 'failed',
    report: report === null ? 'waiting' : report.ok && report.value.plans.listed ? 'ok' : 'failed',
    records: recordsRead === null ? 'waiting' : recordsRead.ok ? 'ok' : 'failed',
    stay: staysRead === null ? 'waiting' : staysRead.ok ? 'ok' : 'failed',
    journal: !hasJournalStop ? null : journalRead === null ? 'waiting' : journalRead.ok ? 'ok' : 'failed',
    // WORK-03 (Alex, 2026-10-26): the backlog, on a day with an execute stop — in once it carries the day's done tasks (read with the window).
    backlog: !hasExecuteStop ? null : backlog === null || backlog.day !== day ? 'waiting' : !backlog.read.ok ? 'failed' : carriesDoneTasks(backlog.read.value) ? 'ok' : 'waiting',
  };
  // A stop's script (the deck's cards and the journal card) reads no journal answer — its wait is the other reads'.
  const reelWait = focus === null ? reelReadsWords(reelReads) : reelReadsWords({ ...reelReads, journal: null });
  const stopWait = reelReadsWords({ ...reelReads, journal: null });
  const reelStay = stayState.kind === 'read' ? stayState.stay : null;
  const reelJournal = journalRead !== null && journalRead.ok ? journalRead.value.journal : null;
  // WORK-03 (Alex, 2026-10-26): each execute stop's done tasks — from the backlog read the card already holds (with the day's window, WORK-02),
  // narrowed per stop by the one rule; none until that read is in (the reel waits on it by name, reelReads.backlog). No new read.
  const reelDone = reelReads.backlog === 'ok' && backlog !== null && backlog.read.ok ? doneInBlocksOf(result.stops, day, backlog.read.value) : NO_DONE_IN_BLOCKS;
  const reelDay = { day, stay: reelStay, stops: result.stops, totals, verdict, journal: reelJournal, done: reelDone };
  // JOURNAL-05 (Alex, 2026-10-19): the prompt's day — the card's OWN reads and words, nothing else: the journal as held, every stop
  // in the table's order with the card's BUDGET and ACTUAL words for it (rowActualWords — the row's own delta; a skipped stop "skipped", an
  // unrecorded one "—", as the card names them), the TOTAL row's two figures and the verdict as the card says it. Offered only once every
  // read is in (the gating "copy script" uses: reelReadsWords); nothing paid, nothing leaves the browser but the clipboard (EveningForm.tsx).
  // REEL-02 (Alex, 2026-10-19): money only for a stop whose form asks it (asksAmount — the card's own rule): the others hand the rule their
  // name and their outcome in the card's own words (DONE_WORD · SKIPPED_WORD · NOT_RECORDED_WORDS) and no budget or actual words at all.
  // JOURNAL-06 (Alex, 2026-10-20): the REFLECTION prompt (journal.ts reflectionPromptText) replaces the audit prompt — the same day lines, then
  // THE BACKLOG and WHAT MOVED TODAY from the card's two reads (a failed read is named, a waiting one waited on, in the reel's own words — never a
  // partial prompt), then THE ANSWERS from the STORED row (the five and NEXT as saved: the form copies, it does not build — save first), then THE
  // ASK, the same words every day (REFLECTION_PROMPT_ASK).
  const backlogRead = backlog !== null && backlog.day === day ? backlog.read : null;
  const movedRead = moved !== null && moved.day === day ? moved.read : null;
  const dayWait = reelReadsWords(reelReads);
  const reflectionPrompt: ReflectionPromptState = (() => {
    if (dayWait !== null) return { ok: false, words: reflectionPromptWaitsWords(dayWait) };
    if (backlogRead !== null && !backlogRead.ok) return { ok: false, words: reflectionPromptWaitsWords(backlogRead.words) };
    if (movedRead !== null && !movedRead.ok) return { ok: false, words: reflectionPromptWaitsWords(movedRead.words) };
    if (backlogRead === null || movedRead === null) {
      return { ok: false, words: reflectionPromptWaitsWords(reelWaitingWords([...(backlogRead === null ? [BACKLOG_READ_NAME] : []), ...(movedRead === null ? [MOVED_READ_NAME] : [])])) };
    }
    return { ok: true, text: reflectionPromptText({
      dayWords: dayShortWords(day),
      journal: reelJournal,
      stops: result.stops.map((s) => (asksAmount(s.role)
        ? { name: stopName(s), vendor: s.vendor, asksAmount: true, budgetWords: factOf(s.cents === null ? null : planDollars(s.cents)), actualWords: s.status === 'skipped' ? SKIPPED_WORD : s.actualCents === null ? factOf(null) : rowActualWords(s.actualCents, s.cents) }
        : { name: stopName(s), vendor: s.vendor, asksAmount: false, outcomeWords: s.status === 'done' ? DONE_WORD : s.status === 'skipped' ? SKIPPED_WORD : NOT_RECORDED_WORDS })),
      budgetWords: factOf(totals.budgetCents === null ? null : planDollars(totals.budgetCents)),
      actualWords: factOf(totals.actualCents === null ? null : planDollars(totals.actualCents)),
      verdictWords: verdict === null ? null : verdict.text,
      backlog: backlogRead.value,
      moved: movedRead.value,
    }) };
  })();
  const caption: ReelText | null = focus === null && reelWait === null ? captionText(reelDay) : null;
  const script: ReelText | null = reelWait !== null ? null : focus === null ? scriptText(reelDay) : stopScriptText(day, reelStay, focus.stop, reelDoneOf(reelDay, focus.stop));
  const journalScript: ReelText | null = journalStop === null || stopWait !== null ? null : stopScriptText(day, reelStay, journalStop, reelDoneOf(reelDay, journalStop));
  const tag = focus !== null && reelWait === null ? stopTagWords({ day, stay: reelStay, stop: focus.stop, foot: stepSpentSoFarWords(focus, totals.budgetCents) }) : null;
  const copyReel = async (what: 'caption' | 'script', text: ReelText | null, at: string) => {
    if (text === null || !text.ok) return;
    setReelWords(null);
    try {
      await navigator.clipboard.writeText(text.text);
      setReelWords({ view: at, ok: true, words: what === 'caption' ? CAPTION_COPIED_WORDS : SCRIPT_COPIED_WORDS });
    } catch (error) {
      setReelWords({ view: at, ok: false, words: copyFailedWords(what, error instanceof Error ? error.message : String(error)) });
    }
  };
  const downloadTag = async () => {
    if (tagBusy || focus === null) return;
    setTagBusy(true);
    setReelWords(null);
    try {
      if (tagRef.current === null) throw new Error('the tag is not on the page');
      await downloadCardImage(tagRef.current, cardTagName(day, { index: deckIndex, label: boldOf(focus.stop) }));
    } catch (error) {
      setReelWords({ view, ok: false, words: cardImageFailedWords(error instanceof Error ? error.message : String(error)) });
    } finally {
      setTagBusy(false);
    }
  };

  // DECK-01: the deck's cards — the full card, then one per stop — and the plates they hold.
  const cards: DeckCard[] = [{ key: 'all', words: DECK_FULL_CARD_WORDS }, ...deckStops.map(({ stop }) => ({ key: stop.key, words: boldOf(stop) }))];

  /** A stop's card: the stop large, VENDOR, PLAN; what happened (ACTUAL against PLAN, the stars, the note, the minutes); the two bars. */
  const stopPlate = (f: Focus) => {
    const d = deltaWords(f.stop.actualCents, f.stop.cents);
    const bars = barsOf(f);
    return (
      <div className="flex flex-col" style={{ gap: 13 }} data-day-focus>
        <div className="flex items-end justify-between gap-4 pt-1">
          <div className="min-w-0 flex flex-col" style={{ gap: 4 }}>
            <div className="font-extrabold text-text-primary break-words" style={{ fontSize: 43, lineHeight: 1, letterSpacing: '-0.01em' }} data-day-bold>{boldOf(f.stop)}</div>
            {smallOf(f.stop) !== null && <div className="font-medium text-text-muted break-words" style={{ fontSize: 27, lineHeight: 1.1 }} data-day-small>{smallOf(f.stop)}</div>}
            {/* TABLE-01: the vendor as a labeled line; the time and the budget are the header's and PLAN's. CLEAN-02 (2026-10-14): LOCATION is off the stop card. */}
            <div className="flex items-baseline gap-2" data-day-vendor>
              <span className="font-bold text-text-faint" style={{ fontSize: 13, letterSpacing: '0.14em' }}>{VENDOR_HEAD_WORD}</span>
              <span className={`font-medium break-words min-w-0 ${f.stop.vendor === null ? 'text-text-faint' : 'text-text-primary'}`} style={{ fontSize: 21, lineHeight: 1.1 }}>{factOf(f.stop.vendor)}</span>
            </div>
          </div>
          <div className="shrink-0 flex flex-col items-end" style={{ gap: 3 }}>
            <div className="font-semibold text-text-muted" style={{ fontSize: 24, lineHeight: 1.1, letterSpacing: '0.04em' }}>{PLAN_WORD}</div>
            <div className={`font-extrabold tabular-nums ${f.stop.cents === null ? 'text-text-faint' : 'text-text-primary'}`} style={{ fontSize: 37, lineHeight: 1 }} data-day-amount>{planDollars(f.stop.cents)}</div>
          </div>
        </div>
        {/* STOP-01: what happened — ACTUAL against PLAN, the note, the minutes. CLEAN-02 (2026-10-14): the rating as stars alone; no status line (the full card's ✓ says done). */}
        <div className="flex items-end justify-between gap-4 border-t border-border" style={{ paddingTop: 13 }} data-day-record>
          <div className="min-w-0 flex flex-col" style={{ gap: 4 }}>
            {f.stop.record !== null && f.stop.record.rating !== null && <div className="font-medium text-text-secondary" style={{ fontSize: 23, lineHeight: 1.1 }} data-day-rating>{starsWords(f.stop.record.rating)}</div>}
            {f.stop.record !== null && f.stop.record.outcome === 'done' && f.stop.record.note !== null && <div className="font-medium text-text-muted break-words" style={{ fontSize: 23, lineHeight: 1.1 }} data-day-note>{f.stop.record.note}</div>}
            {minutesLine(f.stop.minutes, f.stop.actualMinutes) !== null && <div className="font-medium text-text-muted" style={{ fontSize: 23, lineHeight: 1.1 }} data-day-minutes>{minutesLine(f.stop.minutes, f.stop.actualMinutes)}</div>}
          </div>
          <div className="shrink-0 flex flex-col items-end" style={{ gap: 3 }}>
            <div className="font-semibold text-text-muted" style={{ fontSize: 24, lineHeight: 1.1, letterSpacing: '0.04em' }}>{ACTUAL_WORD}</div>
            <div className={`font-extrabold tabular-nums ${f.stop.actualCents === null ? 'text-text-faint' : 'text-text-primary'}`} style={{ fontSize: 37, lineHeight: 1 }} data-day-actual>{planDollars(f.stop.actualCents)}</div>
            {d.over !== null && <div className={`font-semibold tabular-nums ${actualTone(d.over)}`} style={{ fontSize: 23, lineHeight: 1.1 }} data-day-delta>{d.text}</div>}
          </div>
        </div>
        {/* PLAN-01: the two bars. CLEAN-02 (2026-10-14): their why-line and the source line print under the plate, in the fine print.
            TOTALS-01 amendment II (2026-10-15): both lines and both bars against the TOTAL row's BUDGET; the "· $N all day" note is unchanged. */}
        <div className="flex flex-col border-t border-border" style={{ gap: 8, paddingTop: 13 }}>
          <div className="font-bold text-text-secondary tabular-nums" style={{ fontSize: 27 }} data-day-plan-so-far>{planSoFarWords(totals.budgetCents === null ? null : f.soFarCents, totals.budgetCents)}{plannedCents !== null && result.allDayCents > 0 && <span className="font-medium text-text-muted" data-day-so-far-all-day> · {allDayCentsWords(planDollars(result.allDayCents))}</span>}</div>
          {bars.planBar !== null && (
            <div className="bg-bg-row rounded-full overflow-hidden" style={{ height: 9 }} aria-hidden="true" data-day-plan-bar={bars.planBar}>
              <div className="bg-brand-gold rounded-full" style={{ height: 9, width: `${bars.planBar}%` }} />
            </div>
          )}
          <div className="font-semibold text-text-secondary tabular-nums" style={{ fontSize: 23 }} data-day-spent-so-far>{stepSpentSoFarWords(f, totals.budgetCents)}{bars.overCents !== null && <span className={actualTone(true)} data-day-over-by> · {overByWords(bars.overCents)}</span>}</div>
          {bars.planBar !== null && bars.spentBar !== null && (
            <div className="bg-bg-row rounded-full overflow-hidden" style={{ height: 9 }} aria-hidden="true" data-day-spent-bar={bars.spentBar}>
              <div className="bg-brand-green rounded-full" style={{ height: 9, width: `${bars.spentBar}%` }} />
            </div>
          )}
        </div>
      </div>
    );
  };

  /** The full card: where, the hero, the hook, the table with its TOTAL row, the meter and the verdict, the all-day band. */
  const fullPlate = (
    <>
      {/* CLEAN-01 (2026-10-14): the order, top to bottom — where, the hero, the hook, the spent line, the meter, the verdict, the table.
          TOTALS-01 (2026-10-14): where, the hero, the hook, the table with its TOTAL row, then the meter and the verdict — the spent line is gone. */}
      <div className="font-semibold text-text-secondary" style={{ fontSize: 27, lineHeight: 1.15 }} data-day-where>{whereWords(day, stayState)}</div>
      <div className="flex items-baseline gap-3 pt-1" data-day-hero>
        <span className="font-extrabold text-text-primary tabular-nums" style={{ fontSize: 69, lineHeight: 1, letterSpacing: '-0.02em' }} data-day-planned>{planDollars(plannedCents)}</span>
        <span className="font-bold text-text-secondary" style={{ fontSize: 29, lineHeight: 1 }} data-day-hero-word>{heroWord(day, today)}</span>
      </div>
      <div className="font-semibold text-text-secondary" style={{ fontSize: 27, lineHeight: 1.15 }} data-day-hook>{HOOK_WORDS}</div>
      {/* TABLE-01: the stops as a table — fixed columns at the plate's width (CLEAN-01: five); every text cell wraps, a figure is never split, nothing is cut. A row's description is its door, a real button (click, Enter or Space opens the step); a click anywhere on the row opens it too. A day with no stops shows no lone header, and the closing rule sits flush under the last row. TOTALS-01 (2026-10-14): under the TOTAL row now — the table's last row.
          DECK-01 (2026-10-16): a row's door opens its stop's card in the deck (a replace); the journal row's opens the journal card under the deck. The journal stop is still a row — it is on the day's itinerary. */}
      {result.stops.length > 0 && (
        <div className="flex flex-col">
          <table className="w-full" style={{ tableLayout: 'fixed', borderCollapse: 'collapse' }} data-day-stops>
            <colgroup>
              <col style={{ width: COLUMN_WIDTHS.time }} />
              <col style={{ width: COLUMN_WIDTHS.vendor }} />
              <col style={{ width: COLUMN_WIDTHS.description }} />
              <col style={{ width: COLUMN_WIDTHS.budget }} />
              <col style={{ width: COLUMN_WIDTHS.actual }} />
            </colgroup>
            <thead>
              <tr data-day-stops-head>
                <th scope="col" className={headCell} style={headStyle}>{TIME_HEAD_WORD}</th>
                <th scope="col" className={headCell} style={headStyle}>{VENDOR_HEAD_WORD}</th>
                <th scope="col" className={headCell} style={headStyle}>{DESCRIPTION_HEAD_WORD}</th>
                <th scope="col" className={`${headCell} text-right`} style={{ ...headStyle, paddingRight: CELL_GAP }}>{BUDGET_HEAD_WORD}</th>
                <th scope="col" className={`${headCell} text-right`} style={headStyle}>{ACTUAL_HEAD_WORD}</th>
              </tr>
            </thead>
            <tbody>
              {result.stops.map((s) => {
                const card = deckNumberOf.get(s.key);
                const open = card === undefined ? showJournal : () => show(card);
                return (
                  <tr
                    key={s.key}
                    className="border-t border-border hover:bg-bg-row focus-within:bg-bg-row cursor-pointer align-top"
                    data-day-stop={s.key}
                    data-day-status={s.status}
                    data-day-stop-card={card === undefined ? 'journal' : card}
                    onClick={open}
                  >
                    <td className="break-words" style={{ padding: CELL_PADDING }} data-day-col="time">
                      <span className="inline-block font-extrabold" style={{ width: MARK_SLOT, fontSize: 15, lineHeight: 1 }}><Mark status={s.status} /></span>
                      <span className={`font-mono font-semibold tabular-nums ${s.time === null ? 'text-text-faint' : 'text-text-muted'}`} style={{ fontSize: 13, lineHeight: 1.2 }} data-day-interval>{factOf(intervalWords(s.time, s.minutes))}</span>
                    </td>
                    <td className={`font-medium break-words ${s.vendor === null ? 'text-text-faint' : 'text-text-primary'}`} style={{ fontSize: 15, lineHeight: 1.2, padding: CELL_PADDING }} data-day-col="vendor">{factOf(s.vendor)}</td>
                    <td className="break-words" style={{ padding: CELL_PADDING }} data-day-col="description">
                      <button type="button" className="block w-full text-left font-bold text-text-primary break-words" style={{ fontSize: 19, lineHeight: 1.1 }} aria-label={card === undefined ? openJournalWords(boldOf(s)) : openStepWords(card, boldOf(s))} data-day-bold>{boldOf(s)}</button>
                      {smallOf(s) !== null && <span className="block font-medium text-text-muted break-words" style={{ fontSize: 14, lineHeight: 1.15 }} data-day-small>{smallOf(s)}</span>}
                    </td>
                    <td className="text-right" style={{ padding: CELL_PADDING }} data-day-col="budget">
                      <span className={`block font-extrabold tabular-nums ${s.cents === null ? 'text-text-faint' : 'text-text-primary'}`} style={{ fontSize: 19, lineHeight: 1.1 }} data-day-amount>{planDollars(s.cents)}</span>
                    </td>
                    <td className="text-right" style={{ padding: '7px 0' }} data-day-col="actual">
                      <span className={`block font-extrabold tabular-nums ${s.actualCents === null ? 'text-text-faint' : actualTone(deltaWords(s.actualCents, s.cents).over)}`} style={{ fontSize: 19, lineHeight: 1.1 }} data-day-actual>{s.actualCents === null ? factOf(null) : rowActualWords(s.actualCents, s.cents)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* TOTALS-01 (2026-10-14): the TOTAL row — the BUDGET cells shown above summed (a "—" adds nothing), the day's spent or "—" (never $0), in a row's tone against the BUDGET of the recorded rows; bold, above the closing rule. */}
            <tfoot>
              <tr className="border-t border-border align-top" data-day-total>
                <th scope="row" colSpan={3} className="text-left font-extrabold text-text-primary" style={{ fontSize: 19, lineHeight: 1.1, padding: CELL_PADDING }} data-day-col="total">{TOTAL_WORD}</th>
                <td className="text-right" style={{ padding: CELL_PADDING }} data-day-col="budget">
                  <span className={`block font-extrabold tabular-nums ${totals.budgetCents === null ? 'text-text-faint' : 'text-text-primary'}`} style={{ fontSize: 19, lineHeight: 1.1 }} data-day-total-budget>{planDollars(totals.budgetCents)}</span>
                </td>
                <td className="text-right" style={{ padding: '7px 0' }} data-day-col="actual">
                  <span className={`block font-extrabold tabular-nums ${totals.actualCents === null ? 'text-text-faint' : actualTone(totals.over)}`} style={{ fontSize: 19, lineHeight: 1.1 }} data-day-total-actual>{planDollars(totals.actualCents)}</span>
                </td>
              </tr>
            </tfoot>
          </table>
          <div className="border-t border-border" aria-hidden="true" />
        </div>
      )}
      {/* TOTALS-01 (2026-10-14): the meter and the verdict, directly under the table — their rules unchanged (CLEAN-01).
          Amendment (Alex, 2026-10-15): they measure the TOTAL row above them — its ACTUAL against its BUDGET. */}
      {meter !== null && (
        <div className="bg-bg-row rounded-full overflow-hidden" style={{ height: 13 }} aria-hidden="true" data-day-meter={meter.percent === null ? 'empty' : meter.percent}>
          {meter.percent !== null && <div className={`${meter.over ? 'bg-brand-red' : 'bg-brand-green'} rounded-full`} style={{ height: 13, width: `${meter.percent}%` }} />}
        </div>
      )}
      {verdict !== null && <div className={`font-bold tabular-nums ${actualTone(verdict.over)}`} style={{ fontSize: 27, lineHeight: 1.15 }} data-day-verdict>{verdict.text}</div>}
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
    </>
  );

  // WIDTH-01: everything under a card takes the card's width on screen (stops/DayDeck.tsx underStyle) — one left edge, one width.
  const under = underStyle(bleed);

  return (
    <section className="space-y-2" data-day-section>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-brand-purple">Day card</h2>
        {/* DECK-01 (2026-10-16): the day controls stay; "all", "‹ step" and "step ›" are gone — the deck is the way through the cards. */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs" data-day-controls>
          <button type="button" className={chip} aria-label="Back one day" onClick={() => go(hrefFor(shiftDay(day, -1), null))}>‹</button>
          <span className="font-mono text-text-primary" data-day-day>{day}</span>
          <button type="button" className={chip} aria-label="Forward one day" onClick={() => go(hrefFor(shiftDay(day, 1), null))}>›</button>
          <button type="button" className={chip} disabled={day === today} onClick={() => go(hrefFor(today, null))}>{TODAY_WORD}</button>
        </div>
        {/* MOVE-01 (2026-10-19): "moving" beside the day controls — the dated move's one control (stops/MoveControl.tsx). */}
        <MoveControl today={today} />
      </div>

      {/* Named above the card — never dropped, never filled in. */}
      {badDate !== null && <p className="text-xs text-brand-amber" data-day-bad-date>{badDateWords(badDate)}</p>}
      {badStep !== null && <p className="text-xs text-brand-amber" data-day-bad-step>{badStepWords(badStep, N)}</p>}
      {dayRead !== null && !dayRead.ok && <p className="text-xs text-brand-red" data-day-failed>{day} could not be read — {dayRead.words}</p>}
      {items !== null && !items.ok && <p className="text-xs text-brand-red" data-day-items-failed>The day&apos;s tasks could not be read — {items.words}</p>}

      {/* STAY-01: where you are — outside the recorded box; a write reads the stays again. */}
      <StayBar day={day} stays={staysRead} onChanged={() => setStayReads((n) => n + 1)} />

      {/* The reads in flight: the one plate, with the loading line — no deck yet (the day has no cards until the reads are in). */}
      {!loaded && (
        <PlateFrame>
          <Plate plateRef={(el) => { plateRefs.current[0] = el; }} right={headerWords(stayState, day)}>
            <p className="pt-4 text-text-muted" style={{ fontSize: 23 }} data-day-loading>loading the day…</p>
          </Plate>
        </PlateFrame>
      )}

      {/* DECK-01: THE DECK — the full card, then one card per stop; the card in view is ?step= (a replace as it moves). */}
      {loaded && (
        <DayDeck cards={cards} index={deckIndex} onIndexChange={(i) => show(i === 0 ? null : i)}>
          {[
            <Plate key="all" plateRef={(el) => { plateRefs.current[0] = el; }} right={headerWords(stayState, day)}>{fullPlate}</Plate>,
            ...deckStops.map(({ stop, at }, i) => (
              <Plate key={stop.key} plateRef={(el) => { plateRefs.current[i + 1] = el; }} step={i + 1} right={stepHeaderWords(i + 1, N, stop.time)}>
                {stopPlate(focusOf(at))}
              </Plate>
            )),
          ]}
        </DayDeck>
      )}

      {/* CLEAN-02 (2026-10-14): "download image" — directly under every card view, outside the recorded box: the plate alone as a PNG (cardImage.ts). Busy while it renders; a failure in words under it, nothing else.
          DECK-01 (2026-10-16): ONE set of controls under the deck, following the card in view. */}
      {loaded && (
        <div className="mx-auto flex flex-col items-start gap-1 text-xs" style={under} data-day-image>
          {/* REEL-01 (2026-10-15): beside "download image" — the full card's "copy caption", the step view's "download tag", and "copy script" on both. */}
          <div className="flex flex-wrap items-center gap-1.5" data-day-reel>
            <button type="button" className={chip} disabled={imageBusy} aria-busy={imageBusy} onClick={() => downloadImage(plateRefs.current[deckIndex] ?? null, cardImageName(day, focus === null ? null : { index: deckIndex, label: boldOf(focus.stop) }), view)} data-day-download-image>{DOWNLOAD_IMAGE_WORDS}</button>
            {focus === null && <button type="button" className={chip} disabled={caption === null || !caption.ok} onClick={() => copyReel('caption', caption, view)} data-day-copy-caption>{COPY_CAPTION_WORDS}</button>}
            {focus !== null && <button type="button" className={chip} disabled={tag === null || tagBusy} aria-busy={tagBusy} onClick={downloadTag} data-day-download-tag>{DOWNLOAD_TAG_WORDS}</button>}
            <button type="button" className={chip} disabled={script === null || !script.ok} onClick={() => copyReel('script', script, view)} data-day-copy-script>{COPY_SCRIPT_WORDS}</button>
          </div>
          {imageFailed !== null && imageFailed.view === view && <p className="text-brand-red" data-day-image-failed>{imageFailed.words}</p>}
          {reelWait !== null && <p className="text-text-muted" data-day-reel-waits>{reelWait}</p>}
          {script !== null && !script.ok && <p className="text-text-muted" data-day-reel-no-stay>{script.words}</p>}
          {reelWords !== null && reelWords.view === view && <p className={reelWords.ok ? 'text-text-muted' : 'text-brand-red'} data-day-reel-words>{reelWords.words}</p>}
          {/* REEL-01: the stop's tag, rendered off the page for "download tag" alone — never seen, never in the card's own image. */}
          {tag !== null && (
            <div aria-hidden="true" style={{ position: 'fixed', left: -10000, top: 0, pointerEvents: 'none' }} data-day-tag-stage>
              <StopTag ref={tagRef} words={tag} moneyTone={actualTone(tag.money === null ? null : tag.money.over)} />
            </div>
          )}
        </div>
      )}

      {/* CLEAN-01 (2026-10-14): the fine print — the completeness line and the source line, moved off the full plate to under it, small and muted (the same words).
          CLEAN-02 (2026-10-14): on a stop card too — its bars' why-line and its source line, moved off the plate (the same words, the same rules); the journal card has none. */}
      {loaded && (
        <div className="mx-auto space-y-1 text-xs text-text-muted" style={under} data-day-fine-print>
          {focus === null && completeness !== null && <p data-day-count>{completeness}</p>}
          {/* TOTALS-01 (2026-10-14): the hero's day plan beyond the BUDGET total — computed, said only when the two differ. */}
          {focus === null && totals.beyondCents !== null && <p data-day-beyond>{planBeyondStopsWords(totals.beyondCents)}</p>}
          {/* TOTALS-01 amendment II (2026-10-15): why there are no bars, now that they measure the TOTAL row's BUDGET (barsWhyWords) — a day whose plan is all off the table says so, never "nothing is planned". */}
          {focus !== null && planBar === null && <p data-day-bars-why>{barsWhyWords(plannedCents, totals.budgetCents)}</p>}
          <p className="font-mono" data-day-provenance>{provenanceWords(today, reportRead, recordsOk)}</p>
        </div>
      )}

      {/* ROLE-01: the record lives on the step view — said under the full plate, outside the recorded box. DECK-01: the deck's way in. */}
      {loaded && focus === null && N > 0 && <p className="mx-auto text-xs text-text-muted" style={under} data-day-hint>{SWIPE_HINT_WORDS}</p>}

      {/* VENDOR-03 (Alex, 2026-10-27): STRANDED VENDORS — on the full card only, under the plate: one line per stranded vendor the report
          lists, each with "clear" (Budget's own Clear, the plan-vendors DELETE at its address); a clear reads the report again, as the
          vendor box does. No row → no section, nothing says "none". */}
      {loaded && focus === null && strandedRows.length > 0 && (
        <StrandedVendors rows={strandedRows} reload={() => setReportReads((n) => n + 1)} />
      )}

      {/* VENDOR-02 (2026-10-14): the stop's VENDOR, directly above the record row — Budget's own box for every priced stop, a place stop's one reason, else nothing (vendorSlot). A write reads the report again, so the plate's VENDOR shows it; keyed by the stop, so a swipe starts a fresh box. */}
      {loaded && focus !== null && (
        <StopVendor key={focus.stop.key} slot={vendorSlot(focus.stop, reportRead)} bookName={focus.stop.planLine === null ? ACCOUNT_CELL_WORDS.bookNotLoaded : bookNameOf(focus.stop.planLine.entityId)} reload={() => setReportReads((n) => n + 1)} />
      )}

      {/* WORK-02 (Alex, 2026-10-26): THE WORK BLOCK — on an execute stop alone (showsWorkBlock), between the VENDOR row and the record form: TO DO (the backlog's open tasks, ✓ through the one writer) and
          DONE IN THIS BLOCK (by completed_at, inside the block's window); a write reads the backlog again (logReads). Never on the journal card. */}
      {loaded && focus !== null && showsWorkBlock(focus.stop) && (
        <WorkBlock key={focus.stop.key} stop={focus.stop} day={day} viewerZone={zone} log={backlogRead} onChanged={() => setLogReads((n) => n + 1)} />
      )}

      {/* STOP-01: the record, typed under the plate on the step view — outside the recorded box; a write reads the records again. Keyed by the stop and its record so each starts from what is held; never offered while the records could not be read (a save would write over a record the screen cannot see). */}
      {loaded && recordsOk && focus !== null && focus.stop.address !== null && (
        <StopForm key={`${focus.stop.key}:${focus.stop.record === null ? 'none' : focus.stop.record.id}`} stop={focus.stop} day={day} viewerZone={zone} onChanged={() => setRecordReads((n) => n + 1)} />
      )}

      {/* DECK-01 (Alex, 2026-10-16): THE JOURNAL CARD, on its own under the deck and its controls — always shown on a day with a journal stop:
          its plate (the time alone in the header), download image · copy script (no tag: no money, no vendor), its record row, its form. */}
      {loaded && journalStop !== null && (
        <div ref={journalCardRef} className="space-y-2 pt-3" style={{ scrollMarginTop: JOURNAL_SCROLL_MARGIN }} id="journal" data-day-journal-section>
          <PlateFrame>
            <Plate plateRef={(el) => { journalPlateRef.current = el; }} journal right={journalHeaderWords(journalStop.time)}>
              <div className="flex flex-col pt-1" style={{ gap: 4 }}>
                <div className="font-extrabold text-text-primary break-words" style={{ fontSize: 43, lineHeight: 1, letterSpacing: '-0.01em' }} data-day-bold>{boldOf(journalStop)}</div>
                {smallOf(journalStop) !== null && <div className="font-medium text-text-muted break-words" style={{ fontSize: 27, lineHeight: 1.1 }} data-day-small>{smallOf(journalStop)}</div>}
              </div>
              {/* JOURNAL-01: the journal stop's plate; CLEAN-02 (2026-10-14): no money on the journal card. */}
              <JournalPlate key={day} day={day} journal={journalRead} yesterday={yesterdayRead} onChanged={() => setJournalReads((n) => n + 1)} />
            </Plate>
          </PlateFrame>
          <div className="mx-auto flex flex-col items-start gap-1 text-xs" style={under} data-day-journal-image>
            <div className="flex flex-wrap items-center gap-1.5" data-day-journal-reel>
              <button type="button" className={chip} disabled={imageBusy} aria-busy={imageBusy} onClick={() => downloadImage(journalPlateRef.current, journalImageName(day), journalView)} data-day-download-image>{DOWNLOAD_IMAGE_WORDS}</button>
              <button type="button" className={chip} disabled={journalScript === null || !journalScript.ok} onClick={() => copyReel('script', journalScript, journalView)} data-day-copy-script>{COPY_SCRIPT_WORDS}</button>
            </div>
            {imageFailed !== null && imageFailed.view === journalView && <p className="text-brand-red" data-day-image-failed>{imageFailed.words}</p>}
            {stopWait !== null && <p className="text-text-muted" data-day-reel-waits>{stopWait}</p>}
            {journalScript !== null && !journalScript.ok && <p className="text-text-muted" data-day-reel-no-stay>{journalScript.words}</p>}
            {reelWords !== null && reelWords.view === journalView && <p className={reelWords.ok ? 'text-text-muted' : 'text-brand-red'} data-day-reel-words>{reelWords.words}</p>}
          </div>
          {/* STOP-01: the journal stop's record row — when the journal was done (StopForm asks the minutes only for a journal stop). */}
          {recordsOk && journalStop.address !== null && (
            <StopForm key={`${journalStop.key}:${journalStop.record === null ? 'none' : journalStop.record.id}`} stop={journalStop} day={day} viewerZone={zone} onChanged={() => setRecordReads((n) => n + 1)} />
          )}
          {/* JOURNAL-01: the questions, under the journal card — keyed by the day and the journal held; never offered while the journal could not be read (a save would write over answers the screen cannot see). */}
          {journalRead !== null && journalRead.ok && (
            <JournalForm key={`${day}:${journalRead.value.journal === null ? 'none' : journalRead.value.journal.id}`} day={day} journal={journalRead.value.journal} yesterday={yesterdayForPrompt} log={backlogRead} onChanged={() => setJournalReads((n) => n + 1)} onLogChanged={() => setLogReads((n) => n + 1)} />
          )}
          {/* JOURNAL-05 (Alex, 2026-10-19): THE EVENING CARD — reflection, under the morning form, inside the journal section: its plate (today's ticks,
              the verdict, ACCOMPLISHED and NEXT as held — EveningPlate) and its form (EveningForm — JOURNAL-06: the reflection prompt, then the
              seven questions in order: ACCOMPLISHED · GAPS · EVOLUTION · DIRECTION · ALIGNMENT · ON TRACK · NEXT; keyed like the morning's, never
              offered while the journal could not be read). No image, no reel button here (REEL-02). */}
          <div className="space-y-2 pt-3" id="evening" data-day-evening-section>
            <PlateFrame>
              <Plate plateRef={noPlateRef} journal right={journalHeaderWords(journalStop.time)}>
                <EveningPlate journal={journalRead} verdict={verdict} />
              </Plate>
            </PlateFrame>
            {journalRead !== null && journalRead.ok && (
              <EveningForm key={`${day}:${journalRead.value.journal === null ? 'none' : journalRead.value.journal.id}`} day={day} journal={journalRead.value.journal} reflectionPrompt={reflectionPrompt} onChanged={() => setJournalReads((n) => n + 1)} />
            )}
          </div>
        </div>
      )}

      {/* Under the plate — the sentences that name what the plate counted; only when there is something to say. */}
      {foot && (
        <div className="mx-auto space-y-1 text-xs" style={under} data-day-foot>
          {result.unmatched.length > 0 && <p className="text-brand-amber" data-day-unmatched>{unmatchedWords(result.unmatched)}</p>}
          {result.routineFigures.length > 0 && <p className="text-brand-amber" data-day-routine-figures>{routineFigureWords(result.routineFigures)}</p>}
          {result.linesWithoutStop.length > 0 && <p className="text-brand-amber" data-day-lines-without-stop>{dayFailed ? linesUnreadWords(result.linesWithoutStop) : linesWithoutStopWords(result.linesWithoutStop)}</p>}
          {result.notPlacedToday.length > 0 && <p className="text-brand-amber" data-day-not-placed>{notPlacedWords(result.notPlacedToday)}</p>}
          {/* RETRO-01 (2026-10-16): each record that matches no stop, named with its plan's words, and the stop it can attach to (stops/AttachRecord.tsx). */}
          {result.recordsWithoutStop.length > 0 && recordsRead !== null && recordsRead.ok && (
            <div className="text-brand-amber space-y-1" data-day-records-without-stop>
              <p>{recordsWithoutStopHead(result.recordsWithoutStop.length)}</p>
              {result.recordsWithoutStop.map((r) => (
                <AttachRecord key={r.id} record={r} plan={planOfRecord(recordsRead.value.plans, r)} stops={result.stops} onChanged={() => setRecordReads((n) => n + 1)} />
              ))}
            </div>
          )}
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
